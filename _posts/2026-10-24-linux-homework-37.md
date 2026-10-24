---
title: "day36-Ansible一键部署作业实操"
date: 2026-10-24 09:21:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操]
slug: "linux-homework-37"
---

{% raw %}
本篇对应课程第 36 天的课后作业，共三题：① 一键化部署全网备份项目；② 一键化部署 NFS 服务；③ 一键化部署实时同步服务。作业原文只给了三个方向，本篇把 day29（全网备份）、day30（NFS 存储）、day31（实时同步 sersync/inotify）三套服务整合进一个 `import_playbook` 入口剧本，做到「一条命令拉起整套架构」。环境里没有 ansible，用 Python 的 pyyaml 对入口与全部子剧本做语法真跑校验（A 级），并用 Python 模拟 Jinja2 渲染展示备份脚本的最终形态；`ansible-playbook` 执行与验证给出标准命令与 CentOS 7 预期输出（B 级）。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），且未安装 ansible / ansible-playbook，因此采用分级实操：

- **A 级（已真实执行）**：入口剧本 `site.yml` 与四个子剧本全部落盘到沙箱 `/tmp/hw/day36`，用 Python 3.13 + pyyaml 6.0.3 做解析校验；用 Python 字符串替换模拟 `template` 模块渲染 `backup.sh`，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`ansible-playbook` 执行、按组件验证，给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

环境实测：`python`（3.13，含 pyyaml 6.0.3）可用，`command -v ansible-playbook` 返回 NOT FOUND。主机角色：`172.16.1.41` 为备份 / 同步服务端（清单组 `rsync_server`），`172.16.1.7`、`172.16.1.31` 为客户端（清单组 `rsync_clients`、`sync_clients`、`nfs_client`），NFS 服务端 `172.16.1.31`。口令一律用 `<your-password>` 占位，输出中的本地用户名已按脱敏要求替换为 `user`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 一键化部署全网备份项目（rsync 服务端 + 客户端定时备份） | A 级（YAML 校验 + 模板渲染）+ B 级（预期执行） |
| 题 2 | 一键化部署 NFS 服务（服务端共享 + 客户端挂载） | A 级（YAML 校验）+ B 级（预期执行） |
| 题 3 | 一键化部署实时同步服务（inotify + sersync 触发式推送） | A 级（YAML 校验）+ B 级（预期执行） |

## 一键化总体设计

### 部署流程总览

一键入口 `site.yml` 用 `import_playbook` 按依赖顺序串起四个子剧本，每个子剧本对应一个服务组件：

```text
site.yml
 ├─ 1. base.yml          所有主机：装 rsync/tree、统一时区（公共底座）
 ├─ 2. nfs_onekey.yml    NFS：全体装软件 → 服务端共享 → 客户端挂载
 ├─ 3. backup.yml        全网备份：rsync 服务端 → 客户端脚本 + 定时任务
 └─ 4. sersync.yml       实时同步：inotify + sersync 客户端监听推送
```

执行顺序有讲究：公共底座在最前；NFS 与备份互不依赖可任意排序；实时同步依赖 rsync 服务端与密码文件（由 backup.yml 的服务端 play 提供），所以放在最后。四条子剧本的设计概要如下表：

| 子剧本 | 目标组 | 核心动作 | 关键模块 |
| --- | --- | --- | --- |
| base.yml | all | 装公共工具、设时区 | `yum`、`command` |
| nfs_onekey.yml | nfs / nfs_server / nfs_client | 装软件、推 exports、建目录、启动服务、挂载 | `yum`、`template`、`loop`、`mount` |
| backup.yml | rsync_server / rsync_clients | 服务端六步部署、客户端发脚本配定时任务 | `user`、`template`、`cron` |
| sersync.yml | sync_clients | 装 inotify、下发 sersync 并常驻监听 | `get_url`、`unarchive`、`cron` |

### 一键入口 site.yml（已实操）

```yaml
- import_playbook: base.yml
- import_playbook: nfs_onekey.yml
- import_playbook: backup.yml
- import_playbook: sersync.yml
```

入口只描述「按什么顺序导入哪些子剧本」，不含任何任务细节；临时只想部署某一个组件时，直接执行对应子剧本即可，不必整场跑。

### 公共底座 base.yml

```yaml
- hosts: all
  remote_user: root
  tasks:
    - name: 01-install common tools
      ansible.builtin.yum:
        name:
          - rsync
          - tree
        state: present
    - name: 02-set timezone
      ansible.builtin.command: timedatectl set-timezone Asia/Shanghai
      changed_when: false
```

`changed_when: false` 把时区设置声明为「非变更」动作，避免每次执行都显示 changed。语法校验（已实操）：

```bash
cd /tmp/hw/day36
python -c "
import yaml
for f in ['site.yml','base.yml','nfs_onekey.yml','backup.yml','sersync.yml']:
    yaml.safe_load(open(f,encoding='utf-8')); print('YAML OK:', f)
"
```

输出（真实结果）：

```console
YAML OK: site.yml
YAML OK: base.yml
YAML OK: nfs_onekey.yml
YAML OK: backup.yml
YAML OK: sersync.yml
```

五个剧本一次全过，入口与子剧本的 YAML 结构均合法。

## 题 1：一键化部署全网备份项目

**考察点**：把「rsync 服务端部署 + 客户端发密码文件 + 发备份脚本 + 配定时任务 + 立即试跑一次」固化成两个 play；`template` 渲染脚本里的服务器地址；`cron` 模块幂等部署定时任务；`changed_when` 精确判定同步是否发生。

**实现思路**：全网备份的完整链路是「客户端每天定时把本地数据 rsync 推到备份机的 backup 模块」。拆成两个 play：第一个 play 把备份机配成 rsync daemon（服务端）；第二个 play 给所有客户端发脚本、配 cron，并当场跑一次做链路验证。服务端与客户端的分工如下：

| 角色 | 关键任务清单 |
| --- | --- |
| 服务端（rsync_server） | 01 装 rsync → 02 建虚拟用户 rsync → 03 建 /backup 目录 → 04 推 rsyncd.conf → 05 建服务端密码文件 → 06 启动 rsyncd（handler 兜底重启） |
| 客户端（rsync_clients） | 01 装 rsync → 02 建客户端密码文件 → 03 建测试数据目录 → 04 造测试数据文件 → 05 渲染下发备份脚本 → 06 配每日 01:30 定时任务 → 07 手动试跑一次验证 |

### 步骤 1：备份脚本模板

脚本里会出现服务器 IP 与数据目录，这类「可能按环境变化」的值全部写成 Jinja2 变量，由剧本 `vars` 渲染。`files/backup.sh.j2`：

```bash
#!/bin/bash
# network backup script, rendered by ansible template
Local_dir={{ data_dir }}
Backup_server={{ backup_server }}
Module=backup
Password_file=/etc/rsync.password
Date=$(date +%F)
Remote_path=/${Date}

rsync -az --password-file=${Password_file} ${Local_dir}/ rsync_backup@${Backup_server}::${Module}${Remote_path}
```

三个细节：源目录 `${Local_dir}/` 带尾部斜杠表示同步目录内容本身；`Remote_path=/${Date}` 按日期在远端分目录，历史备份互不覆盖；`-az` 足够日常备份用，`-v` 留给人工排错时加。

### 步骤 2：部署剧本 backup.yml（已实操）

```yaml
- hosts: rsync_server
  remote_user: root
  vars:
    backup_dir: /backup
  tasks:
    - name: 01-install rsync
      yum:
        name: rsync
        state: installed

    - name: 02-create virtual user
      user:
        name: rsync
        create_home: no
        shell: /sbin/nologin

    - name: 03-create backup dir
      file:
        path: "{{ backup_dir }}"
        state: directory
        owner: rsync
        group: rsync
        mode: "0755"

    - name: 04-push rsync conf
      copy:
        src: files/rsyncd.conf
        dest: /etc/rsyncd.conf
        mode: "0644"
      notify: restart rsyncd

    - name: 05-create password file
      copy:
        content: "rsync_backup:<your-password>\n"
        dest: /etc/rsync.password
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
  vars:
    backup_server: 172.16.1.41
    backup_script_dir: /server/scripts
    data_dir: /var/www/html
  tasks:
    - name: 01-install rsync
      yum:
        name: rsync
        state: installed

    - name: 02-create password file
      copy:
        content: "<your-password>\n"
        dest: /etc/rsync.password
        mode: "0600"
      no_log: true

    - name: 03-create data dir for test
      file:
        path: "{{ data_dir }}"
        state: directory
        mode: "0755"

    - name: 04-create test data file
      copy:
        content: "backup test data on {{ inventory_hostname }}\n"
        dest: "{{ data_dir }}/index.html"
        mode: "0644"

    - name: 05-push backup script
      template:
        src: files/backup.sh.j2
        dest: "{{ backup_script_dir }}/backup.sh"
        owner: root
        group: root
        mode: "0750"

    - name: 06-setup daily backup cron
      cron:
        name: "daily network backup"
        hour: "1"
        minute: "30"
        job: "/bin/bash {{ backup_script_dir }}/backup.sh &> /var/log/backup.log"

    - name: 07-run backup once for test
      shell: /bin/bash {{ backup_script_dir }}/backup.sh
      register: backup_test
      changed_when: "'sent' not in backup_test.stdout"
```

关键 task 的设计意图：

1. `05-push backup script` 用 `template` 而非 `copy`：脚本里的 `{{ backup_server }}`、`{{ data_dir }}` 要按变量渲染，换备份机时只改 `vars`；
2. `06-setup daily backup cron` 用 `cron` 模块而不是手改 crontab：模块按 `name` 识别任务，重复执行是更新而不是追加，天然幂等；
3. `07-run backup once` 注册输出并用 `changed_when` 判定：只有输出里出现 `sent`（rsync 真的传了数据）才算变更，验证失败会直接让剧本报错，问题当场暴露。

用 Python 模拟渲染，看脚本在客户端的最终形态（已实操）：

```bash
cd /tmp/hw/day36
python -c "
t = open('files/backup.sh.j2',encoding='utf-8').read()
print(t.replace('{{ data_dir }}','/var/www/html').replace('{{ backup_server }}','172.16.1.41'))
"
```

输出（真实结果）：

```console
#!/bin/bash
# network backup script, rendered by ansible template
Local_dir=/var/www/html
Backup_server=172.16.1.41
Module=backup
Password_file=/etc/rsync.password
Date=$(date +%F)
Remote_path=/${Date}

rsync -az --password-file=${Password_file} ${Local_dir}/ rsync_backup@${Backup_server}::${Module}${Remote_path}
```

与手写脚本逐行一致，变量替换符合预期。

### 步骤 3：变量表

| 变量 | 作用域 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `backup_dir` | 服务端 play | /backup | 备份存储根目录 |
| `backup_server` | 客户端 play | 172.16.1.41 | 备份服务器地址，换机只改这里 |
| `data_dir` | 客户端 play | /var/www/html | 待备份的本地数据目录 |
| `backup_script_dir` | 客户端 play | /server/scripts | 备份脚本落盘目录 |

### 步骤 4：执行与验证（B 级）

```bash
ansible-playbook --syntax-check backup.yml
ansible-playbook backup.yml
```

输出（预期输出，CentOS 7，已省略部分任务行）：

```console
$ ansible-playbook backup.yml

PLAY [rsync_server] ***********************************************************
TASK [06-start rsync daemon] **************************************************
changed: [172.16.1.41]

PLAY [rsync_clients] **********************************************************
TASK [05-push backup script] **************************************************
changed: [172.16.1.7]
TASK [06-setup daily backup cron] *********************************************
changed: [172.16.1.7]
TASK [07-run backup once for test] ********************************************
changed: [172.16.1.7]

PLAY RECAP ********************************************************************
172.16.1.41               : ok=7   changed=6    unreachable=0    failed=0
172.16.1.7                : ok=6   changed=5    unreachable=0    failed=0
```

四条验证命令分别对准四个环节：

```bash
# 验证一：客户端定时任务已生成
ansible rsync_clients -m shell -a "crontab -l | grep backup"
# 验证二：备份服务器按日期分目录收到数据
ansible rsync_server -m shell -a "ls -R /backup/ | head -5"
# 验证三：客户端备份日志尾部正常
ansible rsync_clients -m shell -a "tail -3 /var/log/backup.log"
# 验证四：脚本权限与属主
ansible rsync_clients -m shell -a "ls -l /server/scripts/backup.sh"
```

输出（预期输出，CentOS 7）：

```console
$ ansible rsync_clients -m shell -a "crontab -l | grep backup"
172.16.1.7 | CHANGED | rc=0 >>
#ansible: daily network backup
30 1 * * * /bin/bash /server/scripts/backup.sh &> /var/log/backup.log

$ ansible rsync_server -m shell -a "ls -R /backup/ | head -5"
172.16.1.41 | CHANGED | rc=0 >>
/backup/:
2026-10-24

/backup/2026-10-24:
index.html
```

> **易错点**：
>
> - 备份目录为空：`${Local_dir}/` 尾部斜杠写法语义是「同步目录内容」，写成不带斜杠会把目录本身套一层，远端变成 `/backup/日期/var/www/html`；
> - cron 不执行：脚本无执行权限（漏了 `mode: "0750"`）或 job 里没写绝对路径；
> - 历史备份互相覆盖：忘了 `Remote_path=/${Date}`，所有日期的备份都挤进同一个模块根目录；
> - 客户端密码文件内容必须是「纯口令」，写成 `用户:口令` 会被当作口令本身，报 auth failed。

## 题 2：一键化部署 NFS 服务

**考察点**：复用 day34 的三段式 NFS 剧本并纳入一键入口；理解「同一个服务在一键体系里就是一个子剧本」的组织方式。

**实现思路**：NFS 部署在 day34 已写成三段式剧本（全体装软件 → 服务端共享 → 客户端挂载），一键化只是把它改名落位为 `nfs_onekey.yml` 并挂进 `site.yml`，内容不再展开，完整的剧本、模板与逐行讲解见 day34 题 2。这里只保留两张速查表。

关键 task 清单：

| play | 目标组 | 关键任务 | 关键参数 |
| --- | --- | --- | --- |
| 1 | nfs | `yum` 安装 nfs-utils、rpcbind | `name: ['nfs-utils', 'rpcbind']` |
| 2 | nfs_server | `template` 推 exports、`file` 建共享目录、`loop` 启动服务 | `owner: nfsnobody`、`state: started` |
| 3 | nfs_client | `mount` 挂载、`register` + `debug` 回显 | `state: mounted`、`fstype: nfs` |

变量表：

| 变量 | 作用域 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `Data_dir` | 服务端 / 客户端 | /data | 共享目录，两端引用同一变量保证一致 |
| `nfs_server_ip` | 客户端 | 172.16.1.31 | 挂载源地址 |

执行与验证（B 级）：

```bash
ansible-playbook nfs_onekey.yml
# 验证：服务端共享生效、客户端挂载成功、读写测试通过
ansible nfs_server -m shell -a "exportfs -arv"
ansible nfs_client -m shell -a "df -h | grep nfs"
ansible nfs_client -m shell -a "touch /mnt/testfile && ls -l /mnt/testfile"
```

输出（预期输出，CentOS 7）：

```console
$ ansible nfs_client -m shell -a "df -h | grep nfs"
172.16.1.7 | CHANGED | rc=0 >>
172.16.1.31:/data   8G  1.2G  6.8G  15% /mnt
```

## 题 3：一键化部署实时同步服务

**考察点**：inotify + sersync 的工作原理（内核监听文件事件 → sersync 调 rsync 增量推送）；用 `get_url` + `unarchive` 部署二进制包；常驻进程的启动与开机自启；`confxml.xml` 模板化。

**实现思路**：实时同步解决「备份有定时窗口、数据会丢一个周期」的问题：客户端用 inotify 监听 `/data` 目录的写入事件，sersync 收到事件立即调 rsync 把变更推到备份机。前提是备份机的 rsync daemon 已就绪（backup.yml 的服务端 play 已完成）。客户端要装的东西分四层：

| 层 | 内容 | 剧本任务 |
| --- | --- | --- |
| 系统工具 | rsync、inotify-tools | `yum` 安装 |
| 密码文件 | /etc/rsync.client.password（纯口令，600） | `copy` 生成 |
| sersync 程序 | 官方二进制包下载、解压 | `get_url` + `unarchive` |
| 配置与常驻 | confxml.xml（模板渲染）+ 后台启动 + 开机自启 | `template` + `shell` + `cron` |

### 步骤 1：confxml 模板

sersync 的行为全部由 `confxml.xml` 控制，把监听目录与推送目标提成变量。`files/confxml.xml.j2` 的核心片段：

```text
<sersync>
    <localpath watch="{{ sync_dir }}">
        <remoteip ip="{{ sync_server_ip }}" name="backup"/>
        <rsync><params><param param="-az" />
        <param param="--password-file=/etc/rsync.client.password"/></params></rsync>
    </localpath>
</sersync>
```

`watch` 指定监听目录，`remoteip` 指定推送目标与模块名，rsync 参数里挂上密码文件实现免交互。

### 步骤 2：部署剧本 sersync.yml（已实操）

```yaml
- hosts: sync_clients
  remote_user: root
  vars:
    sync_dir: /data
    sync_server_ip: 172.16.1.41
    sersync_pkg: sersync2.5.4_64bit_binary_stable_final.tar.gz
    sersync_url: "https://example.com/pkg/{{ sersync_pkg }}"
    tools_dir: /server/tools
    install_dir: /usr/local
  tasks:
    - name: 01-install rsync and inotify
      yum:
        name: ['rsync', 'inotify-tools']
        state: installed

    - name: 02-create client password file
      copy:
        content: "<your-password>\n"
        dest: /etc/rsync.client.password
        mode: "0600"

    - name: 03-download sersync package
      get_url:
        url: "{{ sersync_url }}"
        dest: "{{ tools_dir }}/{{ sersync_pkg }}"
        mode: "0644"

    - name: 04-unpack sersync
      unarchive:
        src: "{{ tools_dir }}/{{ sersync_pkg }}"
        dest: "{{ install_dir }}/"
        remote_src: yes
        creates: "{{ install_dir }}/GNU-Linux-x86"

    - name: 05-push sersync conf
      template:
        src: files/confxml.xml.j2
        dest: "{{ install_dir }}/GNU-Linux-x86/confxml.xml"
        mode: "0644"
      notify: restart sersync

    - name: 06-start sersync
      shell: nohup {{ install_dir }}/GNU-Linux-x86/sersync2 -dro {{ install_dir }}/GNU-Linux-x86/confxml.xml &>/dev/null &
      args:
        executable: /bin/bash

    - name: 07-setup sersync boot cron
      cron:
        name: "sersync autostart"
        special_time: reboot
        job: "{{ install_dir }}/GNU-Linux-x86/sersync2 -dro {{ install_dir }}/GNU-Linux-x86/confxml.xml &>/dev/null"

  handlers:
    - name: restart sersync
      shell: pkill sersync2; sleep 1; {{ install_dir }}/GNU-Linux-x86/sersync2 -dro {{ install_dir }}/GNU-Linux-x86/confxml.xml &>/dev/null &
      args:
        executable: /bin/bash
```

要点说明：`unarchive` 的 `remote_src: yes` 表示压缩包已在远程主机上（03 步下载的），`creates` 参数让目录已存在时跳过解压、保证幂等；sersync 是二进制常驻进程，用 `nohup ... &` 后台拉起，并用 `special_time: reboot` 的 cron 保证开机自启；配置更新走 `notify` 触发 handler，先 pkill 再拉起完成「重启」。

### 步骤 3：变量表

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `sync_dir` | /data | 监听并推送的本地目录 |
| `sync_server_ip` | 172.16.1.41 | rsync 备份机地址 |
| `sersync_pkg` / `sersync_url` | 二进制包名与下载地址 | 换版本只改这两个变量 |
| `tools_dir` / `install_dir` | /server/tools、/usr/local | 包暂存与安装目录 |

### 步骤 4：执行与验证（B 级）

```bash
ansible-playbook sersync.yml
# 验证一：sersync 进程常驻
ansible sync_clients -m shell -a "ps -ef | grep [s]ersync2"
# 验证二：在监听目录造一个文件，看是否秒级同步到备份机
ansible sync_clients -m shell -a "touch /data/realtime_test.txt"
ansible rsync_server -m shell -a "ls -l /backup/realtime_test.txt"
```

输出（预期输出，CentOS 7）：

```console
$ ansible sync_clients -m shell -a "ps -ef | grep [s]ersync2"
172.16.1.7 | CHANGED | rc=0 >>
root  3521  1  0 10:05 ?  00:00:00 /usr/local/GNU-Linux-x86/sersync2 -dro /usr/local/GNU-Linux-x86/confxml.xml

$ ansible rsync_server -m shell -a "ls -l /backup/realtime_test.txt"
172.16.1.41 | CHANGED | rc=0 >>
-rw-r--r-- 1 user user 0 Oct 24 10:06 /backup/realtime_test.txt
```

客户端造文件后无需任何人工干预，备份机几秒内就能看到同名文件，实时同步链路打通。

> **易错点**：
>
> - `unarchive` 忘写 `remote_src: yes`：ansible 会在管理端找压缩包，报文件不存在；
> - 密码文件用错名字：sersync 的 rsync 参数里 `--password-file` 指向的路径必须与 02 步创建的文件一致；
> - 常驻进程启动任务每次执行都 changed：后台启动类 shell 天然不幂等，必要时配 `changed_when: false` 或先用 `ps` 判断进程存在再启动；
> - 监听目录权限不足：sersync 以 root 运行没问题，但 rsync 推送时受服务端目录属主约束，`/backup` 属主必须是 rsync。

## 小结

1. 一键化的组织方式是「site.yml 只写 import_playbook，任务细节全部下沉到子剧本」：入口即文档，按依赖顺序排列组件，单个组件可单独执行，整场也可一条命令拉起。
2. 公共底座（装工具、设时区）单独抽成 base.yml 放在最前，避免每个子剧本重复写「装 rsync」这类动作。
3. 全网备份 = 服务端 daemon 部署 + 客户端「密码文件、脚本、cron、试跑」四件套；脚本里的环境相关值全部模板化，`cron` 模块按 name 幂等管理定时任务，试跑任务用 `changed_when` 把真实同步与空跑区分开。
4. NFS 一键化就是 day34 三段式剧本的落位复用：一个服务在一个一键体系里对应一个子剧本，共享目录等跨端参数用同名变量保证一致。
5. 实时同步的关键是把 sersync 的部署拆成「系统工具 → 密码文件 → 二进制程序 → 配置与常驻」四层，`unarchive` 配 `creates` 保证幂等，常驻进程用 nohup 拉起并用 reboot 级 cron 做开机自启。
6. 口令类任务统一 `<your-password>` 占位 + `no_log: true`，真实环境应接入 ansible-vault，生产清单中不写任何明文口令。
7. 验证按组件分关：备份看 crontab、远端目录与日志；NFS 看 exportfs、df 与读写测试；实时同步看进程存活与「造文件秒级到达」。

> **参见**：Ansible 剧本实战 · 批量管理 Ansible（下） · day34 剧本部署 rsync/nfs · 备份项目实战
{% endraw %}
