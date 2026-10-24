---
title: "day28-rsync备份服务部署作业实操"
date: 2026-10-24 09:30:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操]
slug: "linux-homework-28"
---

{% raw %}
课程第 28 天（备份服务 rsync）的作业：完成 rsync 守护进程服务端的完整部署，掌握七大常用参数的差异，并分别用「密码文件」和「环境变量」两种方式实现客户端免密推送。参数对比部分结合本地同步实测展开，服务端部署与 systemctl 管理属系统级操作，给出标准命令与 CentOS 7 预期输出。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：cp / diff / tar / ls 等本地命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；实操目录统一用 `/tmp/hw/day28`，模拟源目录 `src/`、目标目录 `dest/`，输出中的本地用户名已按脱敏要求替换为 `user`；
- **B 级（标准命令 + 预期输出）**：rsync 守护进程服务端部署、客户端免密推送、systemctl 服务管理属系统级操作，给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

特别说明：经 `command -v rsync` 实测，本 Git Bash 环境**没有 rsync 命令**，因此「同步行为对比」这一部分用 `cp -a` + `diff` 做等价演示并明确标注，rsync 特有行为（增量块传输、`--delete`、`--bwlimit`）以参数表与预期输出形式呈现。主机名约定：备份服务器为 linux-node01，客户端为 linux-node02。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 对比 rsync 七大常用参数（-a -v -z --delete --exclude --bwlimit -P）的行为差异 | A 级（本地等价实测）+ 参数表 |
| 题 2 | 完成 rsync daemon 服务端完整部署（rsyncd.conf、虚拟用户、密码文件、备份目录） | B 级 |
| 题 3 | 客户端免密推送的两种方式（--password-file 与 RSYNC_PASSWORD） | B 级 |
| 题 4 | systemctl 启动、停止 rsyncd 并设置开机自启 | B 级 |

## 题 1：rsync 七大常用参数对比

**考察点**：区分「归档、显示、压缩、删除、排除、限速、进度」七类参数各自的职责，理解 `-a` 的展开含义与 `--delete` 的风险边界。

**实现思路**：把七个参数按「影响什么」分成三组记忆——影响**传什么**（--exclude、--delete）、影响**怎么传**（-z、--bwlimit）、影响**怎么显示**（-v、-P），而 `-a` 是一个打包了六个子参数的「归档总开关」。

| 参数 | 含义 | 归类 | 使用注意 |
| --- | --- | --- | --- |
| `-a` | 归档模式，等价于 `-rtopgDl`：递归 + 保留修改时间/属主/属组/权限/设备文件/软链 | 打包 | 远程同步时属主属组能否保留取决于服务端 `fake super` 配置 |
| `-v` | 显示详细传输信息，列出每个被传输的文件 | 显示 | 排错必加；写进定时任务脚本时可去掉减少日志 |
| `-z` | 传输时压缩数据，省带宽、费 CPU | 传输 | 适合日志/配置等文本；图片、视频、压缩包不要再压 |
| `--delete` | 无差异同步：源端没有的文件，目标端也删除 | 内容 | **高危**：源目录被误清空，备份端跟着删空，用前先 `-n` 演练 |
| `--exclude=PATTERN` | 排除匹配的数据不传输，支持通配符与相对路径 | 内容 | 规则多时用 `--exclude-from=文件` 集中管理 |
| `--bwlimit=RATE` | 限制传输速率，避免备份流量挤占业务带宽 | 传输 | 经验值：按总带宽的一半限速，并安排在业务低峰期 |
| `-P` | 等价于 `--progress --partial`：显示进度 + 保留中断文件便于续传 | 显示 | 大文件传输、网络不稳时必加 |

`-a` 的展开对照：

```text
-r  递归子目录
-t  保留修改时间
-o  保留属主
-g  保留属组
-p  保留权限
-D  保留设备文件与特殊文件
-l  保留软链接本身（不加 -L 的话）
```

> **易错点**：想让 `-o` / `-g` 真正生效，需要服务端 `rsyncd.conf` 里 `uid` / `gid` 改为 root 并注释 `fake super`；否则守护进程以普通虚拟用户身份落盘，属主会被替换成该虚拟用户。

### 本地同步行为实测（A 级，已实操）

在沙箱里用 `cp -a` 与 `diff` 等价模拟「全量 → 增量 → 删除缺口 → 排除」四个环节，直观看到 rsync 各参数对应解决的问题。

**步骤 1：构造测试数据（已实操）**

```bash
rm -rf /tmp/hw/day28/src /tmp/hw/day28/dest
mkdir -p /tmp/hw/day28/src/{conf,logs}
cd /tmp/hw/day28/src
echo 'server config' > nginx.conf
echo 'log data 01' > logs/access.log
echo 'hosts entry' > conf/hosts.conf
printf 'keep me\n' > keep.txt
touch -d '2026-01-01 08:00' nginx.conf
ls -lR /tmp/hw/day28/src
```

输出：

```text
/tmp/hw/day28/src:
total 2
drwxr-xr-x 1 user 197609  0 Oct 24 09:18 conf
-rw-r--r-- 1 user 197609  8 Oct 24 09:18 keep.txt
drwxr-xr-x 1 user 197609  0 Oct 24 09:18 logs
-rw-r--r-- 1 user 197609 14 Jan  1  2026 nginx.conf

/tmp/hw/day28/src/conf:
total 1
-rw-r--r-- 1 user 197609 12 Oct 24 09:18 hosts.conf

/tmp/hw/day28/src/logs:
total 1
-rw-r--r-- 1 user 197609 12 Oct 24 09:18 access.log
```

其中 nginx.conf 的修改时间被特意改成 2026-01-01，用于验证属性保留。

**步骤 2：全量同步，等价于 rsync 首次全量传输（已实操）**

```bash
cd /tmp/hw/day28
cp -av src/. dest/
echo '=== 属性保留验证 ==='
ls -l src/nginx.conf dest/nginx.conf
```

输出：

```text
'src/.' -> 'dest/'
'src/./keep.txt' -> 'dest/keep.txt'
'src/./logs' -> 'dest/logs'
'src/./logs/access.log' -> 'dest/logs/access.log'
'src/./conf' -> 'dest/conf'
'src/./conf/hosts.conf' -> 'dest/conf/hosts.conf'
'src/./nginx.conf' -> 'dest/nginx.conf'
=== 属性保留验证 ===
-rw-r--r-- 1 user 197609 14 Jan  1  2026 dest/nginx.conf
-rw-r--r-- 1 user 197609 14 Jan  1  2026 src/nginx.conf
```

`cp -a` 与 rsync `-a` 一样保留了修改时间（Jan 1 2026）。源路径末尾的 `/.` 表示「同步目录**内容**」，与 rsync 源目录末尾加 `/` 的语义完全一致——这是最容易写错的地方。

**步骤 3：增量同步，等价于 rsync 的快速检查（已实操）**

只改一个文件、新增一个文件，再同步一次：

```bash
cd /tmp/hw/day28
echo 'log data 02' >> src/logs/access.log
echo 'new file' > src/new.txt
cp -auv src/. dest/
echo '=== diff 校验一致性 ==='
diff -r src dest && echo '一致(退出码 0)'
```

输出：

```text
'src/./logs/access.log' -> 'dest/logs/access.log'
'src/./new.txt' -> 'dest/new.txt'
=== diff 校验一致性 ===
一致(退出码 0)
```

`cp -u`（update）只复制源端比目标端**新**的文件——未变化的 keep.txt、nginx.conf、conf/ 全部被跳过，只传了 2 个变化的条目。这正是 rsync「快速检查」的简化版：rsync 比对大小与 mtime 跳过未变文件，变化的文件再用 delta 算法只传差异块，而 `cp -u` 是整文件重传，这是两者的本质差距。

**步骤 4：删除缺口，说明 --delete 解决什么问题（已实操）**

源端删除一个文件后再同步：

```bash
cd /tmp/hw/day28
rm src/new.txt
cp -auv src/. dest/
diff -r src dest; echo "diff 退出码=$?"
```

输出：

```text
Only in dest: new.txt
diff 退出码=1
```

`cp -u` 不会删除目标端多余的文件，目标端留下了「孤儿」new.txt，两端出现差异。rsync 加 `--delete` 后会把目标端的 new.txt 一并删除，实现真正的「无差异同步」——威力大、风险也大，源目录被误清空时备份端会跟着删空，生产上务必先 `-n` 演练。

真要防 `--delete` 误删，光靠小心不够，可以再加两道保险：其一，`--backup --backup-dir=/backup/deleted_$(date +%F)` 让被删除的文件先挪进一个按日期命名的目录而不是直接消失，误删后还能捞回来；其二，定时任务里跑删除逻辑前，先用 `rsync -avzn`（dry-run）把「将要删除的清单」打进日志人工过一眼，确认没有大面积删除再真跑。

**步骤 5：排除传输，等价于 --exclude（已实操）**

rsync 没有 rsync 命令可用，用 `tar` 管道模拟「排除 logs 目录只同步其余内容」：

```bash
cd /tmp/hw/day28
rm src/keep.txt
rm -rf dest && mkdir dest
tar -C src -cf - --exclude=./logs . | tar -C dest -xf -
diff -r src dest; echo "diff 退出码=$?"
```

输出：

```text
Only in src: logs
diff 退出码=1
```

logs 目录被排除未同步，其余内容完整复制——语义与 `rsync -av --exclude=logs/ src/ dest/` 一致。排除路径是相对于**传输源目录**的，写 `logs/` 而不是绝对路径。

### 题 1 验证方法

1. 参数表中每个参数能在 `man rsync` 中找到对应原文；
2. 步骤 3 的输出证明「未变化的文件被跳过」——verbose 清单里没有 keep.txt 与 conf/；
3. 步骤 4 的 diff 退出码为 1，证明目标端存在多余文件，即 `--delete` 的作用对象。

## 题 2：rsync daemon 服务端完整部署

**考察点**：守护进程模式的部署五步法（装软件 → 写配置 → 建环境 → 起服务 → 做测试），rsyncd.conf 全局参数与模块参数的分工，密码文件 600 权限这个高频坑。

**实现思路**：服务端在 linux-node01（172.16.1.41）上部署。配置文件分两部分：`[backup]` 模块之前是全局参数，模块内是模块级参数；守护进程以专用虚拟用户 rsync 身份写盘，因此备份目录属主必须是 rsync。

### 步骤 1：安装软件（预期输出，CentOS 7）

```bash
rpm -qa | grep rsync
yum install -y rsync
```

输出：

```text
rsync-3.1.2-12.el7_9.x86_64
Complete!
```

### 步骤 2：编写配置文件 /etc/rsyncd.conf（预期输出）

```bash
vim /etc/rsyncd.conf
```

配置文件内容（每行参数对应一个部署要点）：

```conf
uid = rsync
gid = rsync
port = 873
fake super = yes
use chroot = no
max connections = 200
timeout = 300
pid file = /var/run/rsyncd.pid
lock file = /var/run/rsync.lock
log file = /var/log/rsyncd.log
ignore errors
read only = false
list = false
hosts allow = 172.16.1.0/24
auth users = rsync_backup
secrets file = /etc/rsync.password
[backup]
comment = "backup dir by linux-node01"
path = /backup
```

关键参数速查：

| 参数 | 作用 | 注意 |
| --- | --- | --- |
| uid / gid | 守护进程读写备份目录的用户身份 | 用专用虚拟用户，不要 root |
| fake super = yes | 让虚拟用户能完整记录/恢复文件属性 | 想让 `-o`/`-g` 生效需注释它并把 uid 改 root |
| read only = false | 备份目录可写 | 纯分发场景才设 true |
| list = false | 不允许客户端列出模块清单 | 隐藏模块信息，生产建议保持 false |
| hosts allow | 白名单 | 只配一种名单，避免与 hosts deny 产生歧义 |
| auth users | 认证用户名 | 不配则匿名可访问，不推荐 |
| path | 模块对应的真实目录 | 客户端上传的文件落在这里 |

### 步骤 3：创建虚拟用户（预期输出）

```bash
useradd rsync -M -s /sbin/nologin
id rsync
```

输出：

```text
uid=1001(rsync) gid=1001(rsync) 组=1001(rsync)
```

`-M` 不建家目录、`-s /sbin/nologin` 禁止登录——虚拟用户只跑服务，不能交互登录，这是最小权限原则。

### 步骤 4：创建密码文件（预期输出）

```bash
echo "rsync_backup:<your-password>" >/etc/rsync.password
chmod 600 /etc/rsync.password
ls -l /etc/rsync.password
```

输出：

```text
-rw------- 1 root root 23 Oct 24 10:00 /etc/rsync.password
```

> **易错点（600 权限坑）**：服务端密码文件是 `用户名:密码` 格式，**权限必须是 600**。如果误设为 644，rsyncd 会拒绝工作，日志报 `password file must not be other-accessible`。另一个对称的坑：客户端密码文件**只放密码**，不要把用户名也写进去，否则认证必然失败。

### 步骤 5：创建备份目录并改属主（预期输出）

```bash
mkdir /backup
chown rsync.rsync /backup/
ls -ld /backup
```

输出：

```text
drwxr-xr-x 2 rsync rsync 6 Oct 24 10:01 /backup
```

守护进程以 rsync 身份写盘，root 建的目录默认 755，rsync 用户照样写不进去——漏掉 chown 是「客户端推送报 permission denied」的最常见原因。还有一层别漏：`hosts allow = 172.16.1.0/24` 写的是内网网段，客户端走内网地址 172.16.1.41 推送没问题；哪天有人改走公网地址 10.0.0.41 推，就会被白名单拦下报 `connection refused` 或 `unauthorized`，先核对连的是哪个地址再怀疑密码。

### 题 2 验证方法

1. `rsync --version` 确认版本；`cat /etc/rsyncd.conf` 核对模块名与 path；
2. `ls -l /etc/rsync.password` 权限为 600 且格式为 `用户名:密码`；
3. `ls -ld /backup` 属主属组均为 rsync。

## 题 3：客户端免密推送两种方式

**考察点**：`--password-file=` 与环境变量 `RSYNC_PASSWORD` 两种免交互方案的使用场景与安全差异；客户端密码文件「只放密码」的格式要求。

**实现思路**：两种方式的差别只在「密码从哪里读」。密码文件适合写进定时任务脚本（稳定、不依赖会话环境）；环境变量适合临时手工操作（不用落盘密码文件，但只对当前会话生效）。生产脚本推荐密码文件，且绝不把密码直接写在命令行参数里（会留在 shell 历史与 ps 输出中）。

顺带把推拉两种模式分清楚，这决定了密码文件该配在哪端：

- **推（push）**：客户端主动把数据送向服务端，命令在客户端执行，`rsync 源 rsync_backup@服务端::backup`。本篇用的就是推模式，密码文件配在客户端。每台被备份机的定时任务各自触发，一台机器故障不影响其他机器备份；
- **拉（pull）**：备份服务器主动去各客户端取数据，命令在服务端执行，`rsync rsync_backup@客户端::模块 /backup/`。密码要配在备份服务器这一端。好处是备份节奏完全由服务端统一调度，客户端只需要起服务，密钥与权限收敛在一台机器上，安全审计面小。

选型的直觉：客户端数量多、各自有本地脚本要跑，用推；集中管控、客户端不希望持有任何备份凭据，用拉。

### 方式一：密码文件（预期输出，linux-node02 上执行）

方式一的要点：客户端密码文件只放密码，不含用户名。

```bash
echo "<your-password>" >/etc/rsync.password
chmod 600 /etc/rsync.password
rsync -avz /etc/hosts rsync_backup@172.16.1.41::backup --password-file=/etc/rsync.password
```

输出：

```text
sending incremental file list
hosts
sent 226 bytes  received 43 bytes  538.00 bytes/sec
total size is 371  speedup is 1.38
```

### 方式二：环境变量 RSYNC_PASSWORD（预期输出）

```bash
export RSYNC_PASSWORD='<your-password>'
rsync -avz /etc/hosts rsync_backup@172.16.1.41::backup
```

输出：

```text
sending incremental file list
hosts
sent 226 bytes  received 43 bytes  538.00 bytes/sec
total size is 371  speedup is 1.38
```

两种方式对比：

| 方式 | 命令写法 | 优点 | 缺点 | 适用 |
| --- | --- | --- | --- | --- |
| 密码文件 | `--password-file=/etc/rsync.password` | 稳定，不依赖会话，crontab 可用 | 密码落盘，需 600 保护 | 定时任务脚本（推荐） |
| 环境变量 | `export RSYNC_PASSWORD='<your-password>'` | 不落盘，临时用完即弃 | 只对当前会话生效，换终端失效 | 临时手工测试 |

> **易错点**：客户端密码文件内容是纯密码，多一个用户名前缀、多一个空格都会导致 `auth failed`；环境变量方式在 crontab 里不可靠，因为定时任务不会继承交互会话的环境变量。

### 题 3 验证方法

1. 两种方式各推送一次，服务端 `/backup/` 下都能看到 hosts 文件；
2. 故意改错密码重试，确认报 `@ERROR: auth failed on module backup`，验证认证链路真的在工作；
3. `ls -l /etc/rsync.password` 确认 600 权限、内容只有密码。

## 题 4：systemctl 启停与开机自启

**考察点**：用 systemd 管理 rsyncd 的启动、停止、状态查看与开机自启；确认 873 端口监听。

**实现思路**：rsync 包自带 systemd 单元文件 `/usr/lib/systemd/system/rsyncd.service`，直接 `systemctl` 管理即可；CentOS 6 时代通过 xinetd 托管的方式已淘汰。

（预期输出，CentOS 7）

```bash
systemctl start rsyncd      # 启动
systemctl enable rsyncd     # 开机自启
systemctl status rsyncd     # 查看状态
systemctl stop rsyncd       # 停止（验证启停闭环后再 start 回来）
ss -lntp | grep 873         # 确认端口监听
```

输出：

```text
Created symlink from /etc/systemd/system/multi-user.target.wants/rsyncd.service to /usr/lib/systemd/system/rsyncd.service.
* rsyncd.service - fast remote file copy program daemon
   Loaded: loaded (/usr/lib/systemd/system/rsyncd.service; enabled; vendor preset: disabled)
   Active: active (running) since Sat 2026-10-24 10:05:01 CST; 2s ago
LISTEN  0  5  0.0.0.0:873  0.0.0.0:*  users:(("rsyncd",pid=2311,fd=4))
```

状态行里两个关键词：`enabled` 表示开机自启已配置，`active (running)` 表示服务正在运行；`ss` 看到只写 873 端口即可对外提供服务。启动失败时第一现场看 `systemctl status rsyncd` 与 `tail /var/log/rsyncd.log`（配置里 log file 指定的路径）。远程机器连不上 873 时别急着怀疑 rsync 本身——先在服务端本地 `rsync rsync_backup@127.0.0.1::backup` 试一发，本地通远程不通，基本就是防火墙或安全组没放行 873。

### 题 4 验证方法

1. `systemctl is-enabled rsyncd` 返回 `enabled`；
2. `systemctl is-active rsyncd` 返回 `active`；stop 后再查询返回 `inactive`，start 后恢复；
3. `ss -lntp | grep 873` 能看到 rsyncd 进程监听。

## 验证方法

按以下四条自查，全部满足即证明部署闭环：

1. 题 1 的本地实测链路完整：全量 → 增量（只传变化文件）→ 删除缺口（diff 报 Only in dest）→ 排除（diff 报 Only in src），每一步输出与文中一致；
2. 服务端 `systemctl is-active rsyncd` 为 active 且 873 端口监听；
3. 客户端两种免密方式都能推送成功，服务端 `/backup/` 出现文件；
4. 故意把密码文件权限改成 644 或在客户端密码里多写用户名，均能复现对应的报错——排错能力来自「故意弄坏再修好」。

## 小结

1. 七大参数按「传什么（--exclude/--delete）、怎么传（-z/--bwlimit）、怎么显示（-v/-P）、归档总开关（-a）」分组记忆；`-a` 展开为 `rtopgDl`，属主属组的保留依赖服务端 `fake super` 配置。
2. `cp -u` 与 rsync 的「快速检查」思想一致（比对 mtime 跳过未变文件），但 cp 只能整文件重传、不能删除目标端多余文件，这就是 rsync 增量算法与 `--delete` 的价值所在——本篇已用 diff 真实复现两端的差异。给 `--delete` 配上 `--backup-dir` 与 dry-run 清单，才算把风险关进笼子。
3. 服务端部署六步：装软件 → 写 `/etc/rsyncd.conf` → `useradd rsync -M -s /sbin/nologin` → 密码文件（`用户名:密码`，600 权限）→ 建目录并 `chown rsync.rsync` → 启动并开机自启。
4. 客户端免密两法：`--password-file=`（定时任务推荐，密码只放密码）与 `RSYNC_PASSWORD` 环境变量（临时手工）；命令行参数里明文写密码是安全红线。推还是拉，决定了密码文件配在哪一端。
5. 密码文件 600 权限是两端共同的高频坑：644 会被拒绝，报 `password file must not be other-accessible`；服务端与客户端的文件格式差异（有无用户名前缀）是 `auth failed` 的第一大来源。
6. `--delete` 无差异同步务必先 `-n` 演练；`--exclude` 的路径相对于源目录，规则多时用 `--exclude-from` 集中管理。
7. systemctl 管理三件套：`is-active`、`is-enabled`、`ss -lntp | grep 873`；排错先分「本地通不通、远程通不通」，再查配置与日志。

> **参见**：备份服务 rsync · day29 全网备份项目作业实操 · day14 文件批量压缩作业实操
{% endraw %}
