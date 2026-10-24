---
title: "day34-Ansible剧本部署rsync-nfs作业实操"
date: 2026-10-24 09:23:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操]
slug: "linux-homework-35"
---

{% raw %}
课程第 34 天的作业就两道题：用剧本部署 rsync 服务，再用剧本部署 nfs 服务。原题只给方向，思路得自己补全——下面给出完整可跑的剧本（含变量、模板、handler）：rsync 做成「服务端 + 客户端」一体化剧本，nfs 做成「全体装软件 → 服务端配置 → 客户端挂载」三段式。环境里没有 ansible，A 级用 Python 的 pyyaml 对剧本做 YAML 语法真跑校验，`ansible-playbook` 的执行给标准命令与 CentOS 7 预期输出（B 级）。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），且未安装 ansible / ansible-playbook，因此采用分级实操：

- **A 级（已真实执行）**：剧本与模板文件落盘到沙箱目录 `/tmp/hw/day34`，用 Python 3.13 + pyyaml 6.0.3 做 YAML 语法校验，另做「tab 缩进报错」翻车演示，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`ansible-playbook --syntax-check`、剧本执行与各步验证，给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

环境实测：`python`（3.13，含 pyyaml 6.0.3）可用，`command -v ansible-playbook` 返回 NOT FOUND。示例主机角色沿用课程架构：`172.16.1.41`（rsync 服务端 / backup）、`172.16.1.31`（nfs 服务端 / nfs01）、`172.16.1.7`（客户端 / web01），主机清单分组名为 `rsync_server`、`rsync_clients`、`nfs`、`nfs_server`、`nfs_client`。口令一律用 `<your-password>` 占位，输出中的本地用户名已按脱敏要求替换为 `user`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 利用剧本部署 rsync 服务（daemon 模式，服务端 + 客户端） | A 级（YAML 校验真跑）+ B 级（预期执行） |
| 题 2 | 利用剧本部署 nfs 服务（服务端共享 + 客户端挂载） | A 级（YAML 校验真跑）+ B 级（预期执行） |

## 题 1：利用剧本部署 rsync 服务

**考察点**：把一个服务的部署流程（装软件 → 推配置 → 建用户 → 建目录 → 建密码文件 → 启动服务）固化成多 play 剧本；掌握 `vars` 变量、`template` 模板、`handlers` + `notify` 触发器的综合运用；理解「服务端 + 客户端」两组主机的剧本拆分方式；用 `no_log` 保护含口令的任务输出。

**实现思路**：先写出不用剧本时的 ad-hoc 部署历程，再把每条 ad-hoc 命令翻译成一个 task。rsync 以 daemon 模式提供服务，需要三样差异化的东西——守护进程配置 `rsyncd.conf`、系统虚拟用户 `rsync`、密码文件 `/etc/rsync.password`。配置文件带变量（uid、端口、备份目录），得用 `template` 渲染后再下发，`copy` 只会原样搬运；配置变了要让 rsyncd 重启，就用 `notify` 挂一个 handler。ad-hoc 历程与剧本 task 的对应关系如下：

| 历程 | ad-hoc 写法 | 剧本 task（模块） |
| --- | --- | --- |
| 1. 安装软件 | `ansible rsync_server -m yum -a "name=rsync state=installed"` | `yum` |
| 2. 创建虚拟用户 | `-m user -a "name=rsync create_home=no shell=/sbin/nologin"` | `user` |
| 3. 创建备份目录 | `-m file -a "path=/backup state=directory owner=rsync group=rsync"` | `file` |
| 4. 推送配置文件 | `-m template -a "src=rsyncd.conf.j2 dest=/etc/rsyncd.conf"` | `template` + `notify` |
| 5. 创建密码文件 | `-m copy -a "content=... dest=/etc/rsync.password mode=0600"` | `copy` + `no_log` |
| 6. 启动服务 | `-m service -a "name=rsyncd state=started enabled=yes"` | `service` |

### 步骤 1：目录结构与配置模板

剧本目录里放一个 `files/` 子目录存模板，结构如下：

```text
/tmp/hw/day34/
├── rsync_server.yaml        # 一体化剧本（服务端 play + 客户端 play）
└── files/
    └── rsyncd.conf.j2       # rsync daemon 配置模板（含 Jinja2 变量）
```

模板 `files/rsyncd.conf.j2`，三处变量由剧本的 `vars` 注入：

```conf
## rsync daemon config (rendered by ansible template)
uid = {{ rsync_uid }}
gid = {{ rsync_gid }}
port = {{ rsync_port }}
fake super = yes
pid file = /var/run/rsyncd.pid
log file = /var/log/rsyncd.log

[backup]
path = {{ backup_dir }}
read only = no
list = yes
auth users = rsync_backup
secrets file = /etc/rsync.password
```

> **注意**：`fake super = yes` 让 rsync 用文件属性模拟 root 权限，免去了「备份文件属主必须是 root」与「守护进程降权运行」的矛盾，配合属主为普通用户的备份目录即可正常读写。

### 步骤 2：编写服务端 + 客户端一体化剧本（已实操）

```yaml
- hosts: rsync_server
  remote_user: root
  vars:
    rsync_uid: rsync
    rsync_gid: rsync
    rsync_port: 873
    backup_dir: /backup
  tasks:
    - name: 01-install rsync
      yum:
        name: rsync
        state: installed

    - name: 02-create virtual user
      user:
        name: "{{ rsync_uid }}"
        create_home: no
        shell: /sbin/nologin

    - name: 03-create backup dir
      file:
        path: "{{ backup_dir }}"
        state: directory
        owner: "{{ rsync_uid }}"
        group: "{{ rsync_gid }}"
        mode: "0755"

    - name: 04-push config from template
      template:
        src: files/rsyncd.conf.j2
        dest: /etc/rsyncd.conf
        owner: root
        group: root
        mode: "0644"
      notify: restart rsyncd

    - name: 05-create password file
      copy:
        content: "rsync_backup:<your-password>\n"
        dest: /etc/rsync.password
        owner: root
        group: root
        mode: "0600"
      no_log: true

    - name: 06-start rsync daemon
      service:
        name: rsyncd
        state: started
        enabled: yes

  handlers:
    - name: restart rsyncd
      service:
        name: rsyncd
        state: restarted

- hosts: rsync_clients
  remote_user: root
  tasks:
    - name: 01-install rsync
      yum:
        name: rsync
        state: installed

    - name: 02-create password file
      copy:
        content: "<your-password>\n"
        dest: /etc/rsync.password
        owner: root
        group: root
        mode: "0600"
      no_log: true
```

剧本要点逐条说明：

1. 两个 `- hosts:` 段落分别面向服务端组与客户端组，一个剧本文件即可完成两端部署；
2. `vars` 集中管理 uid、端口、目录四个变量，模板里引用同一份，改端口只改一处；
3. `template` 任务挂 `notify: restart rsyncd`：notify 只是登记，handler 压到该 play 全部任务结束后统一执行，且仅当配置文件真的变化（任务显示 changed）才触发；
4. 密码文件任务的 `content` 含口令占位符，配 `no_log: true` 防止内容回显到终端与日志；
5. `mode: "0644"`、`"0600"` 一律加引号，避免 YAML 把八进制权限解析成数字。

### 步骤 3：YAML 语法校验（已实操）

环境无 ansible，用 pyyaml 对剧本做解析级校验，能抓住缩进、冒号、短横线等语法错误：

```bash
cd /tmp/hw/day34
python -c "import yaml,sys; yaml.safe_load(open(sys.argv[1],encoding='utf-8')); print('YAML OK:', sys.argv[1])" rsync_server.yaml
```

输出（真实结果）：

```console
YAML OK: rsync_server.yaml
```

再做一个反面演示：故意把缩进写成 tab，看校验器如何报错（ansible 的报错也是同一类原因）：

```bash
printf -- "- hosts: nfs\n  tasks:\n\t- name: tab demo\n\t  debug:\n\t\tmsg: hi\n" > tab_error.yaml
python -c "import yaml,sys; yaml.safe_load(open(sys.argv[1],encoding='utf-8'))" tab_error.yaml; echo "exit=$?"
```

输出（真实结果，已截取关键行）：

```console
yaml.scanner.ScannerError: while scanning for the next token
found character '\t' that cannot start any token
  in "tab_error.yaml", line 3, column 1
exit=1
```

`found character '\t' that cannot start any token` 一行直接点名了 tab 字符与行号——YAML 规范禁止 tab 缩进，剧本里必须统一用两个空格。真机上有 ansible 时，用官方三步法的第一步做同样的检查：

```bash
ansible-playbook --syntax-check rsync_server.yaml
```

输出（预期输出，CentOS 7）：

```console
$ ansible-playbook --syntax-check rsync_server.yaml

playbook: rsync_server.yaml
```

只回显一行 `playbook: 文件名` 即代表语法通过；若 YAML 有错，会给出 `ERROR! Syntax Error while loading YAML` 并指明行号。

### 步骤 4：执行剧本（B 级）

按「检查语法 → 模拟执行 → 真正执行」三步走：

```bash
ansible-playbook --syntax-check rsync_server.yaml   # 1. 语法检查
ansible-playbook -C rsync_server.yaml               # 2. 模拟执行（check 模式）
ansible-playbook rsync_server.yaml                  # 3. 真正执行
```

输出（预期输出，CentOS 7，已省略部分任务行）：

```console
$ ansible-playbook rsync_server.yaml

PLAY [rsync_server] ***********************************************************

TASK [Gathering Facts] ********************************************************
ok: [172.16.1.41]
TASK [01-install rsync] *******************************************************
changed: [172.16.1.41]
TASK [04-push config from template] *******************************************
changed: [172.16.1.41]
TASK [05-create password file] ************************************************
changed: [172.16.1.41]
TASK [06-start rsync daemon] **************************************************
changed: [172.16.1.41]

PLAY [rsync_clients] **********************************************************
changed: [172.16.1.7]

PLAY RECAP ********************************************************************
172.16.1.41               : ok=8   changed=6    unreachable=0    failed=0
172.16.1.7                : ok=2   changed=2    unreachable=0    failed=0
```

注意 `05-create password file` 一行没有回显任何 content 内容——这就是 `no_log: true` 的作用。第二次执行剧本时，模板未变化则 `04-push config` 显示 ok，handler 不触发，rsyncd 不会被无谓重启。剧本天生适合放 cron 里反复跑，靠的就是这层幂等。

### 步骤 5：验证 rsync 服务（B 级）

```bash
# 验证一：服务端 873 端口监听
ansible rsync_server -m shell -a "ss -lntup | grep 873"
# 验证二：客户端推一个测试文件
ansible rsync_clients -m shell -a "rsync -avz /etc/hosts rsync_backup@172.16.1.41::backup --password-file=/etc/rsync.password"
# 验证三：服务端确认文件到达
ansible rsync_server -m shell -a "ls -l /backup/"
```

输出（预期输出，CentOS 7）：

```console
$ ansible rsync_server -m shell -a "ss -lntup | grep 873"
172.16.1.41 | CHANGED | rc=0 >>
users:(("rsync",pid=2831,fd=4))
LISTEN 0 5 0.0.0.0:873 0.0.0.0:* users:(("rsync",pid=2831,fd=4))

$ ansible rsync_server -m shell -a "ls -l /backup/"
172.16.1.41 | CHANGED | rc=0 >>
total 4
-rw-r--r-- 1 user user 189 Oct 17 10:02 hosts
```

三个关卡都过——端口在听、推送成功、文件到达——rsync 服务部署才算完成。生产上多留个心眼：rsyncd 的 873 端口只对内网放开，直接暴露公网会被扫描器盯上，密码文件再规范也扛不住高频爆破。

> **易错点**：
>
> - 一个 `- name:` 下面只能挂一个模块，写了两个会直接报 `ERROR! no action detected in task`；
> - `notify` 后面的名字必须与 handler 的 `name` 完全一致，否则 handler 永远不触发；
> - 服务端密码文件内容是 `用户:口令`，客户端只写口令，两边口令不一致会报 `@ERROR: auth failed on module backup`；
> - rsync 要求密码文件权限不超过 600，`mode: "0600"` 不能省；
> - `user` 任务里 `create_home: no` 忘写会多建一个家目录，虽不报错但不规范。

### 辨析：copy 与 template

都是「把管理端文件推到被管端」，分界线在内容里有没有变量：

- `copy`：原样搬运，内容固定。推密码文件、静态页面、二进制包用它。
- `template`：先在管理端渲染 Jinja2 变量再下发，`{{ xxx }}` 会被替换成实际值。配置里含主机名、端口、目录这类环境相关值时必须用它，模板文件按惯例以 `.j2` 结尾。

快速自检：把推过去的文件打开看到 `{{ }}` 残留，说明该用 template 的地方用了 copy。

## 题 2：利用剧本部署 NFS 服务

**考察点**：NFS 部署的三段式结构（全体装软件、服务端配置共享、客户端挂载）；`loop` 循环启动多个服务；`mount` 模块 `state=mounted` 的「立即挂载 + 写 fstab」语义；`register` + `debug` 回显挂载结果。

**实现思路**：NFS 比 rsync 多一个「客户端挂载」环节，所以剧本由三个 play 组成。服务端要动的东西是 `/etc/exports` 与共享目录，客户端只做一件事——把服务端的共享目录挂到本地。把共享目录路径提成变量 `Data_dir`，服务端创建目录、客户端挂载路径引用同一个变量，改共享目录只改一处：

| play | 目标组 | 关键任务 |
| --- | --- | --- |
| play 1 | `nfs`（含服务端与客户端） | `yum` 安装 `nfs-utils`、`rpcbind` |
| play 2 | `nfs_server` | `template` 推 exports、`file` 建共享目录、`loop` 启动 rpcbind 与 nfs |
| play 3 | `nfs_client` | `mount` 挂载、`register` + `debug` 回显挂载信息 |

### 步骤 1：exports 模板与目录结构

```text
/tmp/hw/day34/
├── rsync_server.yaml
├── nfs.yaml                 # NFS 三段式剧本
└── files/
    ├── rsyncd.conf.j2
    └── exports.j2           # exports 模板（含变量）
```

`files/exports.j2`：

```conf
# nfs exports (rendered by ansible template)
{{ Data_dir }} 172.16.1.0/24(rw,sync)
```

### 步骤 2：编写三段式剧本（已实操）

```yaml
- hosts: nfs
  tasks:
    - name: 01-install nfs software
      yum:
        name: ['nfs-utils', 'rpcbind']
        state: installed

- hosts: nfs_server
  vars:
    Data_dir: /data
  tasks:
    - name: 01-push exports conf
      template:
        src: files/exports.j2
        dest: /etc/exports
        owner: root
        group: root
        mode: "0644"
      notify: restart nfs server

    - name: 02-create data dir
      file:
        path: "{{ Data_dir }}"
        state: directory
        owner: nfsnobody
        group: nfsnobody
        mode: "0755"

    - name: 03-boot nfs services
      service:
        name: "{{ item }}"
        state: started
        enabled: yes
      loop:
        - rpcbind
        - nfs

  handlers:
    - name: restart nfs server
      service:
        name: nfs
        state: restarted

- hosts: nfs_client
  vars:
    Data_dir: /data
    nfs_server_ip: 172.16.1.31
  tasks:
    - name: 01-mount nfs share
      mount:
        src: "{{ nfs_server_ip }}:{{ Data_dir }}"
        path: /mnt
        fstype: nfs
        state: mounted

    - name: 02-check mount info
      shell: df -h | grep /mnt
      register: mount_info
      changed_when: false

    - name: display mount info
      debug:
        msg: "{{ mount_info.stdout_lines }}"
```

剧本要点：`yum` 的 `name` 直接接收列表一次装两个包；`loop` 遍历启动 rpcbind 与 nfs 两个服务，`item` 为当前服务名；`mount` 用 `state=mounted` 一步做到「立即挂载 + 写入 fstab」；`changed_when: false` 告诉 ansible 检查类 shell 任务不算变更，避免重复执行时显示 changed；exports 走模板 + handler，共享目录配置变了自动重启 nfs。目录属主用 `nfsnobody` 是有意的：默认 `root_squash` 会把客户端 root 映射成 `nfsnobody`，属主对上才有写入权限。

### 步骤 3：YAML 语法校验（已实操）

```bash
cd /tmp/hw/day34
python -c "import yaml,sys; yaml.safe_load(open(sys.argv[1],encoding='utf-8')); print('YAML OK:', sys.argv[1])" nfs.yaml
```

输出（真实结果）：

```console
YAML OK: nfs.yaml
```

### 步骤 4：执行与验证（B 级）

```bash
ansible-playbook --syntax-check nfs.yaml
ansible-playbook -C nfs.yaml
ansible-playbook nfs.yaml
```

输出（预期输出，CentOS 7，已省略部分任务行）：

```console
$ ansible-playbook nfs.yaml

PLAY [nfs] ********************************************************************
TASK [01-install nfs software] ************************************************
changed: [172.16.1.31]
changed: [172.16.1.7]

PLAY [nfs_server] *************************************************************
TASK [03-boot nfs services] ***************************************************
changed: [172.16.1.31] => (item=rpcbind)
changed: [172.16.1.31] => (item=nfs)

PLAY [nfs_client] *************************************************************
TASK [display mount info] *****************************************************
ok: [172.16.1.7] => {
    "msg": [
        "172.16.1.31:/data  8G  1.2G  6.8G  15% /mnt"
    ]
}

PLAY RECAP ********************************************************************
172.16.1.31               : ok=6   changed=4    unreachable=0    failed=0
172.16.1.7                : ok=4   changed=3    unreachable=0    failed=0
```

再在真机上补三条验证：

```bash
# 验证一：服务端 exports 是否生效
ansible nfs_server -m shell -a "exportfs -arv"
# 验证二：客户端挂载结果
ansible nfs_client -m shell -a "df -h | grep nfs"
# 验证三：客户端读写测试
ansible nfs_client -m shell -a "touch /mnt/testfile && ls -l /mnt/testfile"
```

输出（预期输出，CentOS 7）：

```console
$ ansible nfs_server -m shell -a "exportfs -arv"
172.16.1.31 | CHANGED | rc=0 >>
exporting 172.16.1.0/24:/data

$ ansible nfs_client -m shell -a "touch /mnt/testfile && ls -l /mnt/testfile"
172.16.1.7 | CHANGED | rc=0 >>
-rw-r--r-- 1 user user 0 Oct 24 09:12 /mnt/testfile
```

`exportfs -arv` 能列出 `/data`、客户端挂载表有记录、touch 测试文件成功，NFS 链路打通。

> **易错点**：
>
> - `'Data_dir' is undefined`：变量只在注释里出现或大小写不一致（YAML 区分大小写），必须在 `vars` 中显式定义；
> - 客户端 mount 报 permission denied：exports 未放开客户端网段，或防火墙拦了 rpcbind / mountd 端口；
> - showmount 看不到共享：先 `systemctl status rpcbind nfs` 确认两个服务都起来了，NFS 依赖 rpcbind 注册端口；
> - 挂载成功但写不进：共享目录属主不是 `nfsnobody`，或 exports 未配 `rw`；
> - `mount` 的 `state=present` 只写 fstab 不立即挂载，日常一步到位用 `mounted`。

## 小结

1. 剧本部署服务的套路万变不离其宗：把 ad-hoc 部署历程列成表，逐条翻译成 task——装软件 `yum`、建用户 `user`、建目录 `file`、推配置 `copy`/`template`、管服务 `service`。
2. 配置文件里带变量的场景必须用 `template`（渲染后下发）而不是 `copy`（原样拷贝），变量集中在 play 的 `vars` 里，服务端与客户端引用同一份，改一处全局生效。
3. handler 的触发条件是「notify 它的任务真的产生了 changed」，且在整场 play 结束后统一执行一次；配置没变就不会重复重启服务，这是剧本幂等性的核心保障。
4. rsync 一体化剧本分服务端、客户端两个 play：服务端六步（装、建用户、建目录、推配置、建密码文件、启动），客户端只需装软件 + 建仅口令的密码文件；含口令任务一律 `no_log: true`。
5. NFS 三段式剧本：全体装 `nfs-utils` + `rpcbind`、服务端推 exports 建目录并 `loop` 启动两个服务、客户端 `mount state=mounted` 挂载；共享目录提成 `Data_dir` 变量保证两端一致。
6. 校验顺序不可省：`--syntax-check`（或 pyyaml 解析）→ `-C` 模拟 → 真正执行；YAML 禁止 tab 缩进，报错 `found character '\t' that cannot start any token` 就是 tab 引起的。
7. 权限值（`"0644"`、`"0600"`、`"0755"`）一律加引号，防止 YAML 把八进制解析成数字；验证要过三关——端口在听（`ss -lntup`）、功能测试（推送/读写）、结果落盘（服务端能看到文件）。
8. 含口令的任务记得 `no_log: true`，进阶做法是口令走 `ansible-vault` 加密的变量文件，剧本和代码仓库里都不留明文。

> **参见**：批量管理 Ansible（中） · Ansible 剧本实战 · 备份服务 rsync · 存储服务 NFS
{% endraw %}
