---
title: "day35-Ansible扩展与roles作业实操"
date: 2026-10-24 09:22:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-36"
---

{% raw %}



本篇对应课程第 35 天的课后作业，共三题：① 对 ansible 剧本扩展功能进行总结；②（选做）总结 ansible 剧本 roles；③ 预习 Web 服务——HTTP 协议原理与 Nginx 的安装、配置。作业原文偏「总结 + 预习」，本篇把扩展功能（loop / when / tags / register / ignore_errors / block）写成一个可校验的综合示例剧本并真跑语法校验；roles 在沙箱里实际建出标准目录骨架并逐个填充角色文件；HTTP 部分用 `curl -v` 真跑一次完整请求，对照报文结构逐段讲解。环境里没有 ansible，扩展示例与角色文件用 Python 的 pyyaml 做语法真跑校验（A 级），`ansible-playbook` 执行与 Nginx 安装给出标准命令与预期输出（B 级）。

## 实操环境说明 {: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），且未安装 ansible / ansible-playbook，因此采用分级实操：

- **A 级（已真实执行）**：扩展示例剧本 `ext_demo.yml`、roles 角色文件（tasks/handlers/defaults/site.yml）落盘到沙箱 `/tmp/hw/day35` 并用 Python 3.13 + pyyaml 6.0.3 校验；roles 目录骨架真实创建后用 `find` 列出；`curl -v` 对 `example.com` 真跑一次 HTTPS 请求，输出均为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`ansible-playbook` 的执行与标签挑选、Nginx 安装部署，给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

环境实测：`python`（3.13，含 pyyaml 6.0.3）可用，`command -v ansible-playbook` 返回 NOT FOUND，`nginx` 未安装，`curl` 8.21.0 可用且外网可达。示例主机名统一用 `linux-node01`、`linux-node02`，域名统一用 `example.com`，口令占位、输出中的本地用户名按脱敏要求处理为 `user`。

## 题目总览 {: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 总结 Ansible 剧本扩展功能（loop / when / tags / register / block 落地示例） | A 级（YAML 校验真跑） |
| 题 2（选做） | 总结 Ansible 剧本 roles 的目录结构与调用方式 | A 级（目录骨架真建 + 角色文件校验）+ B 级（调用方式） |
| 题 3 | 预习 Web 服务：HTTP 协议原理 + Nginx 安装配置 | A 级（curl -v 真跑）+ B 级（Nginx 安装） |

## 题 1：Ansible 剧本扩展功能总结 {: .sec-ext}

**考察点**：把课堂讲的扩展功能从「概念」变成「可运行示例」——变量集中管理、`loop` 批量执行、`when` 按 facts 条件执行、`register` 接住任务结果、`ignore_errors` 容错、`block/rescue/always` 错误处理、`tags` 按需挑选任务。每种扩展功能的一句话总结见下表：

| 扩展功能 | 关键字 | 一句话记忆 |
| --- | --- | --- |
| 变量 | `vars` / `--extra-vars` | 重复的值提出来统一管理，命令行变量优先级最高 |
| 注册 | `register` | 把任务结果存成变量，带 rc / stdout / changed 字段 |
| 条件 | `when` | 条件为真才执行，条件多来自 facts |
| 循环 | `loop` / `with_items` | 遍历列表批量执行，`item` 为当前元素 |
| 忽略错误 | `ignore_errors: yes` | 单任务失败不中断剧本 |
| 精细控制 | `failed_when` / `changed_when` | 自定义什么算失败、什么算变更 |
| 标签 | `tags` | 配合 `--tags` / `--skip-tags` 挑选执行 |
| 触发 | `notify` + `handlers` | 配置变更才触发，play 末尾执行一次 |
| 错误处理 | `block/rescue/always` | 相当于 try / except / finally |
| 拆分复用 | `import_tasks` / `include_tasks` | 静态导入与动态包含两种任务拆分方式 |

**实现思路**：写一个综合示例剧本 `ext_demo.yml`，把上面除 handlers 之外的核心功能各安排一个任务：`loop` 批量装包、`when` 按 facts 建文件、`register` 回显端口检查、`ignore_errors` 容错、`block/rescue/always` 演示回滚，每个任务打上 `tags`。

### 步骤 1：编写扩展示例剧本（已实操） {: .sec-ext}

```yaml
- hosts: all
  remote_user: root
  vars:
    pkg_list:
      - wget
      - tree
      - lrzsz
  tasks:
    - name: 01-batch install packages with loop
      yum:
        name: "{{ item }}"
        state: installed
      loop: "{{ pkg_list }}"
      tags: [pkg]

    - name: 02-touch file only on linux-node01
      file:
        path: "/tmp/this_is_{{ ansible_hostname }}_file"
        state: touch
      when: ansible_hostname == "linux-node01"
      tags: [when]

    - name: 03-check sshd port
      shell: ss -lntup | grep :22 || true
      register: port_info
      changed_when: false
      tags: [check]

    - name: display port info
      debug:
        msg: "{{ port_info.stdout_lines }}"
      tags: [check]

    - name: 04-ignore a failed probe
      command: /bin/false
      ignore_errors: yes
      tags: [err]

    - name: 05-block with rescue and always
      block:
        - name: install a not-exist package
          yum:
            name: no-such-pkg-demo
            state: installed
      rescue:
        - name: report rollback
          debug:
            msg: "install failed, rollback done"
      always:
        - name: cleanup temp file
          file:
            path: /tmp/ext_demo.tmp
            state: absent
      tags: [block]
```

每个任务对应的知识点：任务 01 用 `loop` 遍历 `vars` 里的 `pkg_list`，装包清单改成纯数据；任务 02 的 `when` 依赖 facts 的 `ansible_hostname`，只在 `linux-node01` 上生效，`linux-node02` 会显示 skipped；任务 03 把 shell 结果注册成 `port_info` 并回显，`changed_when: false` 声明这是检查类任务；任务 04 故意失败但被 `ignore_errors` 放行；任务 05 的 block 内装一个不存在的包必然失败，于是进入 rescue 打印回滚信息，always 里的清理无论如何都执行。

### 步骤 2：YAML 语法校验（已实操） {: .sec-prac}

```bash
cd /tmp/hw/day35
python -c "import yaml,sys; yaml.safe_load(open(sys.argv[1],encoding='utf-8')); print('YAML OK:', sys.argv[1])" ext_demo.yml
```

输出（真实结果）：

```console
YAML OK: ext_demo.yml
```

### 步骤 3：执行与标签挑选（B 级） {: .sec-prac}

```bash
ansible-playbook --syntax-check ext_demo.yml
ansible-playbook ext_demo.yml --list-tags          # 列出全部标签
ansible-playbook ext_demo.yml --tags check         # 只跑检查类任务
ansible-playbook ext_demo.yml --skip-tags err      # 跳过容错演示
```

输出（预期输出，CentOS 7，已省略部分任务行）：

```console
$ ansible-playbook ext_demo.yml --list-tags

playbook: ext_demo.yml

  play #1 (all): all        TAGS: []
      TASK TAGS: [block, check, err, pkg, when]

$ ansible-playbook ext_demo.yml --tags check

PLAY [all] ********************************************************************
TASK [03-check sshd port] *****************************************************
changed: [172.16.1.7]
TASK [display port info] ******************************************************
ok: [172.16.1.7] => {
    "msg": [
        "users:((\"sshd\",pid=1012,fd=3))",
        "LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:((\"sshd\",pid=1012,fd=3))"
    ]
}
```

另一个执行细节（预期输出，CentOS 7）——`when` 条件不满足时任务显示 skipped 而不是 ok：

```console
TASK [02-touch file only on linux-node01] *************************************
skipping: [172.16.1.8]
changed: [172.16.1.7]
```

### 常用 when 表达式速查 {: .sec-chk}

| 写法 | 示例 | 说明 |
| --- | --- | --- |
| 相等比较 | `ansible_hostname == "linux-node01"` | 最常用 |
| 逻辑与或 | `a == "x" and b == "y"` | and / or / not |
| 成员判断 | `"nfs_server" in group_names` | 判断主机属于哪个组 |
| 定义判断 | `Data_dir is defined` | 避免变量未定义报错 |
| 版本比较 | `ansible_distribution_major_version \| int >= 8` | 配合 int 过滤器 |

> **易错点**：
>
> - `when` 里写变量**不带** `{{ }}` 花括号（`when: ansible_hostname == "linux-node01"`），任务参数里才需要花括号；
> - 列表型 facts（如 `ansible_all_ipv4_addresses`）用相等比较几乎不会命中，应改用 `"'172.16.1.7' in ansible_all_ipv4_addresses"`；
> - `ignore_errors` 是一刀切的放行，生产上更推荐 `failed_when` 精确声明失败条件；
> - block / rescue / always 必须同级缩进，层级写错 rescue 不会生效；
> - `register` 的变量名不能带空格，取输出用 `变量.stdout_lines`，判断返回码用 `变量.rc == 0`。

## 题 2（选做）：总结 Ansible 剧本 roles {: .sec-sum}

**考察点**：roles 的标准化目录结构、各子目录职责、角色内文件的自动查找规则、主剧本 site.yml 与角色的配合方式。

**实现思路**：roles 解决单文件剧本的五个痛点——目录结构不规范、任务无法复用、配置改动后关联参数不联动、汇总剧本看不出主机角色、单个剧本过长难读。roles 的本质是一个「按约定命名的文件夹」：playbook 用 `roles:` 引用角色名后，ansible 自动加载角色内固定位置的文件，`copy` 的 src 只写文件名也能在角色 `files/` 里找到。

### 步骤 1：真实创建角色目录骨架（已实操） {: .sec-prac}

在沙箱里为 nginx 建一个标准角色目录，子目录一次建齐：

```bash
cd /tmp/hw/day35
mkdir -p roles/nginx/{tasks,templates,handlers,files,vars,defaults,meta}
find roles -print | sort
```

输出（真实结果）：

```console
roles
roles/nginx
roles/nginx/defaults
roles/nginx/files
roles/nginx/handlers
roles/nginx/meta
roles/nginx/tasks
roles/nginx/templates
roles/nginx/vars
```

七个子目录的职责分工：

| 子目录 | 作用 | 加载方式 |
| --- | --- | --- |
| `tasks/` | 角色任务入口，`main.yml` 自动执行 | 引用角色时自动加载 |
| `handlers/` | 角色的触发器 | 自动加载 |
| `vars/` | 角色变量，优先级高，不建议被覆盖 | 自动加载 |
| `defaults/` | 默认变量，优先级最低，允许被调用方覆盖 | 自动加载 |
| `files/` | 静态分发文件，`copy` 按文件名自动查找 | 模块引用时查找 |
| `templates/` | Jinja2 模板，`template` 按文件名自动查找 | 模块引用时查找 |
| `meta/` | 角色依赖与支持平台声明 | 自动加载，依赖角色先执行 |

`vars/` 与 `defaults/` 都放变量，区别在优先级：defaults 是「可以被使用者覆盖的默认值」，vars 是「角色内部固定的值」。用 `ansible-galaxy init nginx` 也能一键生成同样的骨架（B 级，本环境无 ansible 未执行）。

### 步骤 2：填充角色文件（已实操） {: .sec-prac}

角色变量放 `defaults/main.yml`（允许调用方按主机覆盖端口等参数）：

```yaml
http_port: 80
server_name: web.example.com
web_root: /data/www
```

任务入口 `tasks/main.yml`：

```yaml
- name: 01-install nginx
  yum:
    name: nginx
    state: present

- name: 02-create web root dir
  file:
    path: "{{ web_root }}"
    state: directory
    owner: nginx
    group: nginx
    mode: "0755"

- name: 03-push index page
  copy:
    content: "<h1>this is {{ inventory_hostname }}</h1>\n"
    dest: "{{ web_root }}/index.html"
    mode: "0644"

- name: 04-render nginx conf from template
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/conf.d/site.conf
    mode: "0644"
  notify: restart nginx

- name: 05-start nginx service
  service:
    name: nginx
    state: started
    enabled: yes
```

触发器 `handlers/main.yml`：

```yaml
- name: restart nginx
  service:
    name: nginx
    state: restarted
```

站点模板 `templates/nginx.conf.j2`：

```nginx
server {
    listen {{ http_port }};
    server_name {{ server_name }};
    root {{ web_root }};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

注意任务里的 `src: nginx.conf.j2` 只写了文件名——ansible 会自动到角色的 `templates/` 目录查找，这正是 roles 约定的价值。主剧本 `site.yml`：

```yaml
- hosts: web
  remote_user: root
  roles:
    - role: nginx
      vars:
        http_port: 8080
```

主剧本只描述「哪些主机扮演什么角色」，一行任务都不写；调用时通过 `vars` 把端口覆盖为 8080，`defaults` 里的 80 被覆盖——这就是 defaults 低优先级设计的用途。

### 步骤 3：角色文件语法校验（已实操） {: .sec-prac}

```bash
cd /tmp/hw/day35
python -c "
import yaml
for f in ['site.yml','roles/nginx/tasks/main.yml','roles/nginx/handlers/main.yml','roles/nginx/defaults/main.yml']:
    yaml.safe_load(open(f,encoding='utf-8')); print('YAML OK:', f)
"
```

输出（真实结果）：

```console
YAML OK: site.yml
YAML OK: roles/nginx/tasks/main.yml
YAML OK: roles/nginx/handlers/main.yml
YAML OK: roles/nginx/defaults/main.yml
```

### 步骤 4：角色的四种调用方式（B 级） {: .sec-prac}

| 方式 | 写法 | 适用场景 |
| --- | --- | --- |
| roles 列表 | `- roles: [common, nginx]` | 最常用，按列表顺序执行 |
| 调用时传参 | `- role: nginx` + `vars: {http_port: 8080}` | 覆盖 defaults |
| 条件调用 | `- role: nfs` + `when: "'nfs_server' in group_names"` | 同一剧本适配不同角色 |
| 动态导入 | `include_role: name: nfs` | 任务流中间按需加载 |

执行与验证（预期输出，CentOS 7）：

```console
$ ansible-playbook site.yml --syntax-check
playbook: site.yml
$ ansible-playbook site.yml
PLAY [web] ********************************************************************
TASK [nginx : 01-install nginx] ***********************************************
changed: [172.16.1.7]
TASK [nginx : 04-render nginx conf from template] *****************************
changed: [172.16.1.7]
$ ansible web -m shell -a "curl -s http://127.0.0.1:8080/"
172.16.1.7 | CHANGED | rc=0 >>
<h1>this is linux-node01</h1>
```

> **易错点**：
>
> - 角色目录名与 `roles:` 引用名必须一致，目录叫 `nginx` 就写 `- nginx`，否则报 `the role 'xxx' was not found`；
> - `copy` 的 src 找不到文件：静态文件要放进角色的 `files/` 子目录；
> - 角色内 handler 不触发：handler 必须写在角色自己的 `handlers/main.yml` 里，名称与 notify 一致；
> - 变量改了不生效：检查是不是放在了优先级更高的 `vars/main.yml` 里把 defaults 盖住了。

## 题 3：预习 Web 服务——HTTP 协议原理与 Nginx {: .sec-know}

**考察点**：一次完整 HTTP 请求的全流程；请求 / 响应报文的四段结构；用 `curl -v` 观察真实报文；Nginx 的安装与最小配置。

**实现思路**：HTTP 是协议（报文格式与方法的规范），Nginx 是协议的具体实现（监听端口、解析报文、返回数据的软件）。预习抓两条线：一是访问流程——DNS 解析 → TCP 三次握手 → 发送请求 → 返回响应 → 浏览器渲染 → 四次挥手；二是报文结构——请求由「请求行、请求头、空行、（POST 才有的）请求主体」四部分组成，响应由「起始行、响应头、空行、响应主体」四部分组成。空行是头部结束的标志，必须存在。

### 步骤 1：curl -v 真跑一次完整请求（已实操） {: .sec-prac}

`curl -v` 会把请求报文（`>` 开头）与响应报文（`<` 开头）原样打印，是预习 HTTP 结构最直观的工具：

```bash
curl -sv -o /dev/null https://example.com/
```

输出（真实结果，已省略代理隧道与 TLS 握手细节行；本机走了本地代理，`Trying` 一行显示的是代理地址）：

```console
* Uses proxy env variable https_proxy == 'http://127.0.0.1:61266'
*   Trying 127.0.0.1:61266...
* CONNECT tunnel established, response 200
* Established connection to 127.0.0.1 (127.0.0.1 port 61266)
* using HTTP/1.x
> GET / HTTP/1.1
> Host: example.com
> User-Agent: curl/8.21.0
> Accept: */*
>
* Request completely sent off
< HTTP/1.1 200 OK
< Date: Sat, 24 Oct 2026 00:31:48 GMT
< Content-Type: text/html; charset=utf-8
< Transfer-Encoding: chunked
< Connection: keep-alive
< Server: cloudflare
< last-modified: Wed, 21 Oct 2026 20:09:25 GMT
< Accept-Ranges: bytes
< Age: 5
< alt-svc: h3=":443"; ma=86400
```

对照报文结构逐段读：

| 报文行 | 归属 | 说明 |
| --- | --- | --- |
| `> GET / HTTP/1.1` | 请求行 | 方法 + 请求 URI + 协议版本 |
| `> Host: example.com` | 请求头 | 一台服务器托管多站点时靠它区分站点 |
| `> User-Agent: curl/8.21.0` | 请求头 | 客户端身份 |
| `>` 后的空行 | 空行 | 头部结束标志（GET 无请求主体） |
| `< HTTP/1.1 200 OK` | 起始行 | 版本 + 状态码 + 原因短语，200 表示成功 |
| `< Content-Type: text/html; charset=utf-8` | 响应头 | 主体类型，浏览器据此决定怎么解析 |
| `< Connection: keep-alive` | 通用头 | HTTP/1.1 默认长连接 |
| `< Server: cloudflare` | 响应头 | 服务器软件信息 |

两点观察值得记录：一是本机纯 HTTP（非 TLS）请求被本地代理直接以 `403 Forbidden` 拦下、根本没到目标站——同一个 URL 换个协议结果完全不同，说明代理可以代替服务器「伪造」响应，排查时要先确认响应到底是谁发的；二是响应尾部的 `alt-svc: h3=":443"` 是服务器在广告自己支持 HTTP/3，与笔记中「HTTP/3 基于 QUIC」的演进对应。

### 步骤 2：常见状态码速记（预习清单） {: .sec-chk}

| 状态码 | 含义 | 运维排查切入点 |
| --- | --- | --- |
| 200 | 成功 | 正常 |
| 301 / 302 | 永久 / 临时重定向 | 检查跳转配置是否形成环路 |
| 403 | 禁止访问 | 文件权限、SELinux、目录索引配置 |
| 404 | 资源不存在 | root 路径配错、文件缺失、伪静态失效 |
| 500 | 服务器内部错误 | 程序异常、配置错误 |
| 502 | 错误网关 | 后端服务（如 PHP-FPM）挂了 |
| 504 | 网关超时 | 后端处理太慢，查慢查询 |

### 步骤 3：Nginx 安装与最小配置（B 级） {: .sec-prac}

```bash
# 安装（CentOS 7 需先配 epel 源，或使用 nginx 官方源）
yum install -y epel-release && yum install -y nginx
# 启动并设置开机自启
systemctl start nginx && systemctl enable nginx
# 验证：端口监听与默认页
ss -lntp | grep :80
curl -s http://127.0.0.1/ | head -3
```

输出（预期输出，CentOS 7）：

```console
$ ss -lntp | grep :80
LISTEN 0 511 0.0.0.0:80 0.0.0.0:* users:((\"nginx\",pid=2101,fd=6))

$ curl -s http://127.0.0.1/ | head -3
<!DOCTYPE html>
<html>
<head><title>Welcome to nginx!</title></head>
```

安装后先认识三个位置：主配置 `/etc/nginx/nginx.conf`、站点子配置目录 `/etc/nginx/conf.d/`、默认站点根 `/usr/share/nginx/html/`。最小可用站点配置就是上面 roles 案例里 `nginx.conf.j2` 渲染出来的样子——`listen` 定端口、`server_name` 定域名、`root` 定站点目录、`index` 定首页文件；每次改完配置先 `nginx -t` 做语法检查再 reload，这是 Nginx 运维的第一习惯。

> **易错点**：
>
> - `curl -v` 的输出里 `>` 是发出的请求、`<` 是收到的响应，`*` 开头是连接过程信息，三者别混；
> - 走了代理的环境里，状态码可能来自代理本身而不是目标服务器，先用 `env | grep -i proxy` 确认；
> - 403 与 404 都「打不开页面」，但 403 查权限与 SELinux，404 查路径与文件，排查方向完全不同；
> - Nginx 配置里每条指令以分号结尾，漏分号是新手报错第一名，改完必须 `nginx -t`。

## 小结 {: .sec-sum}

1. 扩展功能是剧本从「能跑」到「好用」的分水岭：`loop` 消灭重复任务、`when` 让剧本按主机差异分支、`tags` 支持按需执行、`register` 让后续任务能读到前面的结果、`block/rescue/always` 提供回滚与清理。
2. `when` 中的变量不加花括号；列表型 facts 用 `in` 判断；检查类任务配 `changed_when: false`，避免剧本重复执行时显示假变更。
3. roles 的本质是「目录约定 + 自动查找」：七个标准子目录各司其职，`tasks/main.yml` 是入口，`files/` 与 `templates/` 让模块参数只写文件名，`defaults/` 与 `vars/` 按优先级分工；主剧本 site.yml 只描述主机与角色的对应关系。
4. 角色调用四种方式（列表、传参、条件、include_role）覆盖了从简单到动态的全部场景，传参覆盖 defaults 是最常见的定制手段。
5. HTTP 报文四段结构与状态码五分类是 Web 运维的地基；`curl -v` 用 `>` / `<` 前缀把请求与响应原样打印，是预习阶段性价比最高的实操工具。
6. 环境无 ansible / nginx 时，扩展示例与角色文件用 pyyaml 做语法真跑校验、Nginx 行为用标准命令 + 预期输出描述，既保证内容可执行，又不伪造真实输出。

> **参见**：Ansible 剧本扩展功能 · 批量管理 Ansible（下） · HTTP 协议原理 · Nginx 网站服务部署


{% endraw %}
