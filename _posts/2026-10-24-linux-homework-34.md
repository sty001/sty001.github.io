---
title: "day33-Ansible模块与剧本预习作业实操"
date: 2026-10-24 09:24:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-34"
---

{% raw %}



这份预习作业对应课程第 33 天：①把八个新模块——`yum`、`service`、`cron`、`mount`、`user`、`group`、`unarchive`、`archive`——逐个过一遍；②摸清剧本（playbook）的编写格式。八模块整理成对比表，逐个配 ad-hoc 标准命令与 CentOS 7 预期输出；剧本则手写一份最小化 playbook（`hosts` / `remote_user` / `tasks`，任务用到 `yum` / `copy` / `service`）。本环境没装 ansible，语法校验的 A 级用 Python 的 yaml 模块真跑，B 级给 `ansible-playbook --syntax-check` 的标准命令与预期输出。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），且经 `command -v` 实测 `ansible` / `ansible-playbook` 均不存在，因此采用分级实操：

- **A 级（已真实执行）**：在 Git Bash 用 Python 3 的 `yaml` 模块对自写的 playbook 做语法/结构校验，输出为真实结果，标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：八模块的 ad-hoc 命令、`ansible-playbook --syntax-check` 与三步执行法，给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

本篇主机名统一用 `linux-node01` / `linux-node02`，域名统一用 `example.com`，命令输出中的属主统一显示为 `user`，口令以 `your-password`（占位）表示。环境实测：Python 3.13.12（含 `yaml` 6.0.3）。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 预习新模块 yum/service/cron/mount/user/group/unarchive/archive | B 级（作用对比表 + ad-hoc 标准命令） |
| 题 2 | 预习剧本（playbook）编写格式 | A 级（YAML 校验真跑）+ B 级（--syntax-check 与执行三步） |

## 题 1：预习八个新模块

**考察点**：理解每个模块「管什么对象、关键参数、典型 state 取值」，以及模块化的意义——一条 `yum` 命令背后是幂等的「检测已装就跳过」。这八个模块覆盖了「装软件 / 管服务 / 定时任务 / 挂载 / 用户 / 用户组 / 打包 / 解包」八类最常见运维动作。

### 1.1 八模块作用对比表

| 模块 | 管理对象 | 关键参数 | 典型 `state` / 取值 |
| --- | --- | --- | --- |
| `yum` | RPM 软件包 | `name`、`state` | `installed` / `latest` / `absent` |
| `service` | 系统服务运行状态 | `name`、`state`、`enabled` | `started` / `stopped` / `restarted` |
| `cron` | 定时任务 | `minute`/`hour`/`day`/`month`/`weekday`、`job`、`name` | `present` / `absent` / `disabled` |
| `mount` | 挂载点与 fstab | `src`、`path`、`fstype`、`state` | `present` / `mounted` / `unmounted` / `absent` |
| `user` | 系统用户 | `name`、`uid`、`group`、`groups`、`shell`、`password` | `present` / `absent` |
| `group` | 系统用户组 | `name`、`gid`、`system` | `present` / `absent` |
| `archive` | 在被管端打包压缩 | `path`、`dest`、`format` | `gz` / `bz2` / `xz` / `zip` |
| `unarchive` | 解压到被管端 | `src`、`dest`、`remote_src` | 是否存在由 `creates` 控制 |

### 1.2 各模块 ad-hoc 标准命令与预期（B 级）
{: .sec-best}

**yum —— 批量装软件**

```bash
ansible linux-node02 -m yum -a "name=nginx state=installed"
```

（预期输出，CentOS 7）

```text
linux-node02 | CHANGED => {
    "changed": true,
    "msg": "Installed: nginx-1.20.1-1.el7.x86_64",
    "rc": 0,
    "results": ["Loaded plugins: fastestmirror", "Resolving Dependencies"]
}
```

`state=latest` 升级到最新版，`state=absent` 卸载。重复执行已安装的包会返回 `changed: false`（幂等）。

**service —— 管理服务**

```bash
ansible linux-node02 -m service -a "name=nginx state=started enabled=yes"
```

（预期输出，CentOS 7）

```text
linux-node02 | CHANGED => {
    "changed": true,
    "enabled": true,
    "name": "nginx",
    "state": "started"
}
```

`state=restarted` 重启、`state=stopped` 停止；`enabled=yes` 设开机自启。

**cron —— 批量定时任务**

```bash
ansible linux-node02 -m cron -a "name='time sync' minute=0 hour=2 job='/usr/sbin/ntpdate ntp1.aliyun.com >/dev/null 2>&1'"
```

（预期输出，CentOS 7）

```text
linux-node02 | CHANGED => {
    "changed": true,
    "envs": [],
    "jobs": ["time sync"]
}
```

删除用 `state=absent` 且指定相同的 `name`；Ansible 只能删自己加过 `name` 的任务，手工 `crontab -e` 写的不带标识无法精确删除。

**mount —— 批量挂载**

```bash
ansible linux-node02 -m mount -a "src=10.0.0.31:/data path=/mnt/nfs fstype=nfs state=mounted"
```

（预期输出，CentOS 7）

```text
linux-node02 | CHANGED => {
    "changed": true,
    "dump": "0",
    "fstab": "/etc/fstab",
    "name": "/mnt/nfs",
    "opts": "defaults",
    "passno": "0",
    "src": "10.0.0.31:/data"
}
```

`state=mounted` 立即挂载并写 fstab；`unmounted` 立即卸载但保留 fstab；`absent` 卸载并删 fstab 条目。

**user —— 批量建用户**

```bash
ansible linux-node02 -m user -a "name=appuser uid=2001 group=app shell=/sbin/nologin"
```

（预期输出，CentOS 7）

```text
linux-node02 | CHANGED => {
    "changed": true,
    "comment": "",
    "create_home": true,
    "group": 2001,
    "name": "appuser",
    "shell": "/sbin/nologin",
    "state": "present",
    "uid": 2001
}
```

`group` 是基本组、`groups` 是附属组，两者不同；设密码须先用 `password_hash` 生成密文且外层单引号包裹。

**group —— 批量建组**

```bash
ansible linux-node02 -m group -a "name=app gid=2001"
```

（预期输出，CentOS 7）

```text
linux-node02 | CHANGED => {
    "changed": true,
    "gid": 2001,
    "name": "app",
    "state": "present"
}
```

**archive —— 在被管端打包**

```bash
ansible linux-node02 -m archive -a "path=/var/log/nginx dest=/backup/nginx-logs.tar.gz format=gz"
```

（预期输出，CentOS 7）

```text
linux-node02 | CHANGED => {
    "changed": true,
    "dest": "/backup/nginx-logs.tar.gz",
    "state": "archive",
    "size": 20480
}
```

**unarchive —— 解压到被管端**

```bash
ansible linux-node02 -m unarchive -a "src=/server/tools/app.tar.gz dest=/opt/ creates=/opt/app"
```

（预期输出，CentOS 7）

```text
linux-node02 | CHANGED => {
    "changed": true,
    "dest": "/opt/",
    "extract_results": {"cmd": ["/usr/bin/gtar", "--extract", "-C", "/opt/", ...]},
    "src": "/server/tools/app.tar.gz"
}
```

`src` 默认在**管理端**查找（`unarchive` 会自动推送过去）；若压缩包已在远程，加 `remote_src=yes`。

> **易错点**：
>
> - `command` 模块不认管道/重定向，与 `shell` 的取舍见下方辨析，需要 `ps aux | grep nginx` 这类命令时必须用 `shell` 模块。
> - `user` 模块设密码必须密文 + 单引号，明文不会生效。
> - `mount` 的 `mounted` 与 `present` 区别：`present` 只写 fstab 不立即挂载，`mounted` 一步到位。
> - `unarchive` 的 `src` 默认在管理端，与 `copy` 的 `remote_src` 语义一致。

### 辨析：command 与 shell 模块

两个模块都在远端执行命令，长得很像，差别就一条：`command` 不经过 bash 解析，管道、重定向、`&&` 全是字面量，直接报错；`shell` 走完整 bash 解析，这些都认。口诀：命令里出现 `|`、`>`、`&&` 就用 `shell`，否则优先 `command`（不额外起 shell 进程，更快也更可控）。但生产剧本里更要紧的原则是——能用专用模块（yum / copy / service / user）就别绕到 shell 或 command，专用模块天然幂等，还支持 `--check` 模拟。

### 1.3 模块共性：幂等性与 ad-hoc 常用参数
{: .sec-expl}

这八个模块之所以能放进剧本反复执行，核心在于**幂等性**。白话版：模块动手前先看目标主机现在的样子，已经是你想要的状态就什么都不做、返回 `ok`；不是才动手改成你想要的。例如 `yum: name=nginx state=installed` 在已安装时直接返回 `ok`，不会重复安装；`copy` 比对校验值，内容一致就跳过。想通这一点，剧本跑一百遍也不怕——第一遍是「部署」，后面九十九遍都是「确认」。

ad-hoc 还有几个提效参数（B 级，标准命令 + 预期）：

```bash
ansible web --list-hosts                 # 先确认本次会动哪些主机，不真正执行
ansible web -f 20 -m ping                # -f 调大并发，适合机器多
ansible web -m yum -a "name=iotop state=installed" --check   # 模拟，只报告会改什么
```

（预期输出，CentOS 7）

```text
$ ansible web --list-hosts
  hosts (2):
    linux-node01
    linux-node02
```

### 1.4 主机清单：剧本的「演员表」
{: .sec-chk}

模块要作用于谁，由清单（inventory）决定。清单写在 `/etc/ansible/hosts`，支持分组，上面示例里的 `web` 组就来自这里（B 级，标准写法 + 预期）：

```conf
[web]
linux-node01
linux-node02

[nfs]
linux-node03
```

```bash
ansible web -m ping
```

（预期输出，CentOS 7）

```text
linux-node01 | SUCCESS => {"changed": false, "ping": "pong"}
linux-node02 | SUCCESS => {"changed": false, "ping": "pong"}
```

清单里还可以给主机/组设变量（如 `ansible_user`、`ansible_port`），实现「不同机器不同连接方式」；变量优先级是主机变量高于组变量。

### 1.5 查文档与调试技巧（B 级）
{: .sec-ts}

Ansible 模块上百个，记不住参数时现场查最稳（标准命令 + 预期）：

```bash
ansible-doc -l            # 列出所有模块名称与一句话简介
ansible-doc yum           # 查看 yum 模块的完整参数说明
ansible-doc -s yum        # 只看精简的参数表，排障时最常用
```

（预期输出，CentOS 7）

```text
$ ansible-doc -s yum
- name: Manages packages with the yum package manager
  yum:
      name:                  # A package name or list of package names...
      state:                 # Whether to install (`present'/'latest')...
      update_cache:          # Force yum to check if cache is out of date...
```

执行结果的颜色是第一手判断依据：绿色表示对主机**未做改动**（`ok`）、黄色表示**做了修改**（`changed`）、红色表示**执行出错**（`failed`）、粉色是警告、蓝色是过程信息。跑完剧本先扫颜色，黄色越多说明本次实际变更越多。

剧本调试也讲方法：先用 `ansible-playbook -C`（或 `--check`）模拟，看清会改什么再真跑；任务多时加 `--start-at-task "任务名"` 从指定任务断点续跑，不必每次都从头来；需看每个任务的详细返回时加 `-v`（或 `-vvv` 逐级加详）。

## 题 2：预习剧本（playbook）编写格式

**考察点**：把一串 ad-hoc 命令固化成「可重复执行、幂等、可读」的 YAML 剧本。核心是理解 `hosts`（在哪些主机执行）、`remote_user`（以谁登录）、`tasks`（具体任务列表），以及 YAML 的三条书写规范。

### 步骤 1：写一份最小化 playbook（已实操）
{: .sec-prac}

下面这份剧本用到了 `hosts` / `remote_user` / `tasks`，任务里包含 `yum`、`copy`、`service` 三个模块，安装并启动 nginx。先写到本地文件：

```bash
mkdir -p /tmp/hw/day33
cat > /tmp/hw/day33/web_setup.yaml <<'EOF'
- hosts: web
  remote_user: user
  become: yes
  tasks:
    - name: 01-install nginx
      ansible.builtin.yum:
        name: nginx
        state: installed
    - name: 02-push index page
      ansible.builtin.copy:
        src: files/index.html
        dest: /usr/share/nginx/html/index.html
        owner: user
        group: user
        mode: "0644"
    - name: 03-start and enable nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: yes
EOF
```

由于本环境没有 `ansible-playbook`，无法跑 `--syntax-check`，改用 Python 的 `yaml` 模块对剧本做真实语法与结构校验——它能抓出缩进错误、冒号缺失等 YAML 层面问题（Ansible 语法检查的底层也是先解析 YAML）：

```bash
cd /tmp/hw/day33
python3 -c "import yaml; d=yaml.safe_load(open('web_setup.yaml')); print('YAML 解析成功, plays=', len(d)); [print('  hosts:', p.get('hosts'), 'tasks=', len(p.get('tasks',[]))) for p in d]"
```

输出：

```text
$ python3 -c "import yaml; d=yaml.safe_load(open('web_setup.yaml')); print('YAML 解析成功, plays=', len(d)); [print('  hosts:', p.get('hosts'), 'tasks=', len(p.get('tasks',[]))) for p in d]"
YAML 解析成功, plays= 1
  hosts: web tasks= 3
```

解析出一个 play、目标主机组 `web`、3 个任务，结构正确，说明剧本的 YAML 层面没有错误。

### 步骤 2：ansible-playbook 语法检查（B 级，标准命令 + 预期）
{: .sec-best}

真机环境下，剧本写完后第一件事是 `--syntax-check`，只检查语法不动主机：

```bash
ansible-playbook --syntax-check /tmp/hw/day33/web_setup.yaml
```

（预期输出，CentOS 7）

```text
$ ansible-playbook --syntax-check /tmp/hw/day33/web_setup.yaml
playbook: web_setup.yaml

The Pre-Playbook syntax check completed successfully with 0 errors.
```

### 步骤 3：剧本完整结构讲解
{: .sec-prac}

一个 playbook 由若干「play」组成，每个 play 含以下关键字段：

| 字段 | 作用 | 说明 |
| --- | --- | --- |
| `hosts` | 在哪些主机执行 | 主机组名、`all` 或具体地址 |
| `remote_user` | 以哪个用户 SSH 登录 | 等价于 `-u` |
| `become` | 是否提权 | `yes` 相当于 sudo |
| `gather_facts` | 是否收集 facts | 不需要时设 `no` 提速 |
| `vars` | 剧本级变量 | 供任务引用 |
| `tasks` | 任务列表 | 真正要干的事，按顺序执行 |
| `handlers` | 处理器 | 由任务 `notify` 触发，常用于「改配置后重启」 |

加上 `vars` 与 `handlers` 的更完整形态：

```yaml
- hosts: web
  remote_user: user
  become: yes
  vars:
    nginx_port: 80
  tasks:
    - name: 安装 nginx
      ansible.builtin.yum:
        name: nginx
        state: installed
    - name: 推送配置文件
      ansible.builtin.copy:
        src: files/nginx.conf
        dest: /etc/nginx/nginx.conf
      notify: 重启 nginx
  handlers:
    - name: 重启 nginx
      ansible.builtin.service:
        name: nginx
        state: restarted
```

`handler` 只在被 `notify` 命中、且对应任务确实产生变更（`changed`）时才执行；配置没变就不重启——这正是幂等性的体现。两个细节常被忽略：`notify` 只做登记不立即执行，handler 统一压到该 play 的所有任务跑完后才执行，避免「后面的任务还没配完服务就重启了」；多个任务 notify 同一个 handler，一场 play 也只执行一次，不会重启三次。

### 步骤 3.5：playbook 进阶（变量 / 循环 / 条件）
{: .sec-ext}

真实剧本很少把所有值写死，常用 `vars` 提取变量、`loop` 做循环、`when` 做条件。例如批量创建用户并安装一组软件：

```yaml
- hosts: web
  remote_user: user
  become: yes
  vars:
    pkgs:
      - nginx
      - vim
      - rsync
  tasks:
    - name: 安装一组软件
      ansible.builtin.yum:
        name: "{{ item }}"
        state: installed
      loop: "{{ pkgs }}"
    - name: 批量创建用户
      ansible.builtin.user:
        name: "{{ item }}"
        state: present
      loop:
        - appuser01
        - appuser02
      when: ansible_os_family == "RedHat"
```

`loop` 让同一任务逐项执行列表；`when` 只在满足条件时才跑（这里限定 RedHat 系）。`vars` 让剧本更易维护——改软件清单只动 `pkgs` 一处。注意 `{{ }}` 是 Jinja2 变量语法，引号不能省，否则 YAML 会把 `{{` 当字典起始而报错。

剧本默认会先收集 **facts**——被管主机自动上报的 IP、内存、发行版等系统信息，可在任务里当变量直接引用，例如 `ansible_default_ipv4.address`、`ansible_os_family`、`ansible_memtotal_mb`。前面 `when: ansible_os_family == "RedHat"` 之所以能生效，靠的就是 facts。主机多又不需要这些信息时，在 play 里设 `gather_facts: no` 可省去每台主机的收集开销，几百台的规模下提速很明显。

建议把剧本按项目目录组织，便于版本管理与复用（B 级，目录结构示例）：

```text
nginx-deploy/
├── ansible.cfg            # 项目级配置（当前目录优先于 /etc/ansible/ansible.cfg）
├── hosts                  # 项目级主机清单
├── web_setup.yaml         # 剧本
├── files/                 # copy/template 引用的源文件
│   └── index.html
└── group_vars/            # 按组拆分变量，自动加载
    └── web.yml
```

把 `ansible.cfg` 与 `hosts` 放进项目目录，就能实现「一套项目一套配置」，不再依赖全局配置，也方便随代码入库。

### 步骤 4：YAML 编写三规范
{: .sec-best}

| 规范 | 要求 | 反例 |
| --- | --- | --- |
| 缩进 | 只能空格，两个空格一级，禁止 tab | 用 tab 缩进会直接报 YAML 错误 |
| 冒号 | 冒号后必须有空格 | `hosts:web`（缺空格） |
| 短横线 | 列表项 `-` 后必须有空格 | `-name: x`（缺空格） |

另外注意布尔值陷阱：`yes` / `no` / `on` / `off` 会被 YAML 解析成布尔，想当字符串需加引号；权限 `mode: "0644"` 也必须加引号，否则 YAML 可能把 `0644` 当作非字符串导致权限错误。

### 步骤 5：执行剧本的三步法（B 级）
{: .sec-prac}

养成「先检查、再模拟、最后执行」的习惯：

```bash
ansible-playbook --syntax-check web_setup.yaml   # 1. 语法检查
ansible-playbook -C web_setup.yaml               # 2. 模拟执行（--check）
ansible-playbook web_setup.yaml                  # 3. 真正执行
```

（预期输出，CentOS 7：真正执行时）

```text
$ ansible-playbook web_setup.yaml

PLAY [web] *****************************************************************

TASK [Gathering Facts] *****************************************************
ok: [linux-node02]

TASK [01-install nginx] ****************************************************
changed: [linux-node02]

TASK [02-push index page] **************************************************
changed: [linux-node02]

TASK [03-start and enable nginx] *******************************************
changed: [linux-node02]

PLAY RECAP *****************************************************************
linux-node02 : ok=4  changed=3  unreachable=0  failed=0
```

加 `--limit linux-node02` 可只跑单台做灰度，加 `--diff` 可看清文件会怎么变。生产习惯：新剧本第一次上线先 `--limit` 一台试水，确认没问题再放量到全组。

## 验证方法
{: .sec-ver}

- A 级：本环境用 `python3` + `yaml.safe_load` 解析剧本，输出「YAML 解析成功, plays= 1、hosts: web、tasks= 3」即证明剧本 YAML 层面无错。
- B 级真机：`ansible-playbook --syntax-check` 返回「completed successfully with 0 errors」；`ansible-playbook` 执行后 `PLAY RECAP` 中 `failed=0`，且目标主机 `nginx -v` 可查、80 端口可访问。
- 模块验证：每个模块先 `--check` 模拟，再用 `ansible 主机 -m 模块 -a 参数` 单条跑，对照本文预期输出中的 `changed` / `ok` 字段确认幂等性。

## 本篇小结
{: .sec-sum}

1. 八个预习模块对号入座：`yum` 管包、`service` 管服务、`cron` 管定时任务、`mount` 管挂载、`user`/`group` 管账号、`archive`/`unarchive` 管压缩解压，正好覆盖日常八类运维动作。
2. 模块大多幂等：已满足预期就返回 `ok`，重复执行不会重复变更；`command` 不认管道重定向、需管道时用 `shell`。
3. 剧本 = 把 ad-hoc 固化成 YAML：核心是 `hosts`（在哪跑）、`remote_user`（以谁跑）、`tasks`（跑什么）；高级字段有 `vars`、`handlers`、`become`。
4. YAML 三规范：只用空格缩进（禁用 tab）、冒号后加空格、短横线后加空格；`mode: "0644"` 与布尔值务必加引号。
5. 本环境无 ansible，A 级用 Python `yaml` 模块对剧本做真实语法/结构校验；B 级给出 `ansible-playbook --syntax-check` 与「检查 → 模拟 → 执行」三步法，避免把错误配置推上生产。
6. `handler` 由任务 `notify` 触发、且只有任务真正变更才执行，是「改配置后重启服务」的标准幂等写法；通知只登记、play 末尾统一跑一遍，多个 notify 也只重启一次。
7. 口令、密钥这类敏感数据别裸写在剧本里，`ansible-vault` 加密后入库，仓库里不留明文。


{% endraw %}
