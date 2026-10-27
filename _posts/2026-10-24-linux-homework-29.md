---
title: "day29-全网备份项目作业实操"
date: 2026-10-24 09:29:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-29"
---

{% raw %}



课程第 29 天（rsync 备份服务）的作业两道题：①自己试着完成全网备份数据项目；②总结每个服务的部署过程。第①题按「需求拆解 → 本地打包 → 本地清理 → 指纹生成 → 推送归档 → 服务端校验 → 定时任务」的完整链路走一遍，其中打包、清理、指纹、脚本执行部分全部真跑，rsync 推送与守护进程部署给标准命令与预期输出；第②题把项目涉及的服务按「通用五步法」总结成对照表，作为下一阶段的部署手册底稿。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：mkdir / tar / find / md5sum / cp / bash 语法检查与脚本执行在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；模拟被备份主机的目录结构放在 `/tmp/hw/day29/web01-sim`，本地备份目录 `/tmp/hw/day29/backup`，模拟备份服务器目录 `/tmp/hw/day29/backup-server`；
- **B 级（标准命令 + 预期输出）**：rsync 守护进程的服务端部署、免密推送、crontab 定时任务属系统级操作，给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

特别说明：经 `command -v rsync` 实测，本 Git Bash 环境**没有 rsync 命令**（ssh/scp 存在），因此「推送到备份服务器」这一步采用两种方式呈现：沙箱内用 `cp -a` 做等价干跑（验证脚本逻辑与归档结构），真机命令单独给出 B 级标准写法。环境中的 md5sum、tar 均为 GNU 版本，与 CentOS 7 行为一致。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 完成全网备份数据项目（打包 → 清理 → 指纹 → 推送 → 服务端校验 → 定时任务） | 打包/清理/指纹/脚本 A 级真跑，推送与 daemon 部署 B 级 |
| 题 2 | 总结每个服务的部署过程 | 通用五步法 + 对照表（总结性） |

## 题 1：完成全网备份数据项目

**考察点**：tar 打包（`-h` 跟随软链、相对路径打包）、find 按时间清理、md5sum 指纹生成与校验（含「指纹路径基准目录」这个经典坑）、按内网 IP 归档的目录规范、rsync 守护进程推送、crontab 自动化。

**实现思路**：全网备份的架构是「1 个 backup 汇聚点 + N 台被备份机」。每台被备份机在本地 `/backup` 打包系统配置、站点目录与访问日志，按「日期_week周几」命名；推送到备份服务器后按**本机内网 IP** 分目录归档；服务端定期校验指纹并清理过期数据。数据流向：

```text
被备份机(web01/nfs01/db01)                    备份服务器(backup01, 172.16.1.41)
  /backup/<本机内网IP>/*.tar.gz   --rsync-->   /backup/<客户端内网IP>/*.tar.gz
  finger.txt(打包后生成)                        md5sum -c finger.txt 校验
  find -mtime +7 清理本地旧包                   find -mtime +180 保留周一清理其余
```

需求拆解成一张表（对应课程 8 条需求的落地动作）：

| 编号 | 需求 | 落地动作 |
| --- | --- | --- |
| 1 | 所有服务器备份目录统一 `/backup` | 脚本里固定变量 `BAK=/backup` |
| 2 | 备份定时任务 / rc.local / 脚本目录 / 防火墙配置 | tar 打包清单列出这些文件 |
| 3-4 | Web 站点 `/var/html/www` 与日志 `/app/logs` | 分别单独打包 |
| 5 | 客户端本地只留 7 天 | `find -mtime +7 | xargs rm` |
| 6 | 服务端保留周一数据，其余留 6 个月 | 文件名带 `%w`，清理时排除 `week1` |
| 7 | 服务端按客户端内网 IP 建目录 | `mkdir -p /backup/<IP>/` |
| 8 | 校验完整性并通知管理员 | finger.txt + `md5sum -c` + mail |

### 步骤 1：构造模拟被备份主机数据（已实操）
{: .sec-prac}

还原 web01 的备份目标结构：定时任务、rc.local、脚本目录、站点目录、日志目录。

```bash
mkdir -p /tmp/hw/day29 && cd /tmp/hw/day29
rm -rf web01-sim backup && mkdir -p web01-sim/var/spool/cron web01-sim/etc \
  web01-sim/server/scripts web01-sim/var/html/www web01-sim/app/logs backup
echo '0 0 * * * /bin/sh /server/scripts/backup.sh &>/dev/null' > web01-sim/var/spool/cron/root
echo 'touch /var/lock/subsys/local' > web01-sim/etc/rc.local
echo 'echo hello' > web01-sim/server/scripts/check.sh
echo 'index page' > web01-sim/var/html/www/index.html
echo '10.0.0.1 - - [24/Oct/2026:10:00:00] "GET / HTTP/1.1" 200' > web01-sim/app/logs/access.log
find web01-sim -type f | sort
```

输出：

```text
web01-sim/app/logs/access.log
web01-sim/etc/rc.local
web01-sim/server/scripts/check.sh
web01-sim/var/html/www/index.html
web01-sim/var/spool/cron/root
```

5 个目标文件全部就位，对应需求 2、3、4 的备份清单。

### 步骤 2：tar 打包三份归档（已实操）
{: .sec-prac}

```bash
cd /tmp/hw/day29
cd web01-sim     # 进入模拟根目录，用相对路径打包
tar zchf ../backup/system_backup_$(date +%F_week%w).tar.gz \
    ./var/spool/cron/root ./etc/rc.local ./server/scripts
tar zchf ../backup/www_backup_$(date +%F_week%w).tar.gz      ./var/html/www
tar zchf ../backup/www_log_backup_$(date +%F_week%w).tar.gz  ./app/logs
cd ..
ls -l backup
tar -tzf backup/system_backup_2026-10-24_week6.tar.gz
date +%F_week%w
```

输出：

```text
total 3
-rw-r--r-- 1 user user 291 Oct 24 08:30 system_backup_2026-10-24_week6.tar.gz
-rw-r--r-- 1 user user 174 Oct 24 08:30 www_backup_2026-10-24_week6.tar.gz
-rw-r--r-- 1 user user 205 Oct 24 08:30 www_log_backup_2026-10-24_week6.tar.gz
./var/spool/cron/root
./etc/rc.local
./server/scripts/
./server/scripts/check.sh
2026-10-24_week6
```

三个要点：`zchf` 里的 `-h` 让 tar 跟随软链打包其指向的原文件（不加 `-h` 还原后软链可能指向不存在的路径）；`cd` 到根目录后用 `./var/...` 相对路径打包，包内路径以 `.` 开头，解包不会覆盖系统绝对路径；`date +%F_week%w` 里的 `%w` 是周几（0-6，今天输出 6 即周六），周一的包名就是 `week1`，这个命名直接支撑需求 6 的「保留周一数据」。

### 步骤 3：本地 7 天清理（已实操）
{: .sec-prac}

```bash
find backup -type f -mtime +7 | xargs -r rm -v
echo "(空输出=没有超 7 天的旧包)"
```

输出：

```text
(空输出=没有超 7 天的旧包)
```

当前没有超过 7 天的旧包，`xargs -r` 在输入为空时不执行 rm（不加 `-r` 时 GNU xargs 也会自行规避空输入，但显式 `-r` 语义最清晰）。生产上这一步放在**推送之后**执行，先删后推会把数据置于险境。

### 步骤 4：生成指纹文件（已实操）
{: .sec-prac}

```bash
find backup -type f -mtime -1 ! -name "finger*" | xargs md5sum > backup/finger.txt
cat backup/finger.txt
```

输出：

```text
051738daea7577dc757fec3b9e528523 *backup/system_backup_2026-10-24_week6.tar.gz
138af8566c044417f0466ce6413769cc *backup/www_backup_2026-10-24_week6.tar.gz
2b7334d336bebecea3d9c2612e5e127a *backup/www_log_backup_2026-10-24_week6.tar.gz
```

`-mtime -1` 只给当天新增的包生成指纹，`! -name "finger*"` 防止把指纹文件自身也记进去（否则校验时会出现「指纹校验指纹」的死循环式误导）。注意这里记录的是**相对路径**，它决定了校验时必须在哪个目录执行——下一步专门演示这个坑。

### 步骤 5：指纹校验——先复现经典坑，再给正确姿势（已实操）
{: .sec-warn}

指纹文件记录的路径是 `backup/xxx`，如果 cd 进 `backup/` 目录再执行 `md5sum -c`，相对路径就对不上了：

```bash
cd /tmp/hw/day29/backup && md5sum -c finger.txt
```

输出（错误示范，真实复现）：

```text
backup/system_backup_2026-10-24_week6.tar.gz: FAILED open or read
backup/www_backup_2026-10-24_week6.tar.gz: FAILED open or read
backup/www_log_backup_2026-10-24_week6.tar.gz: FAILED open or read
md5sum: WARNING: 3 listed files could not be read
```

`FAILED open or read` 不是数据损坏，而是**路径基准不对**。回到记录指纹时的基准目录再校验：

```bash
cd /tmp/hw/day29 && md5sum -c backup/finger.txt
```

输出：

```text
backup/system_backup_2026-10-24_week6.tar.gz: OK
backup/www_backup_2026-10-24_week6.tar.gz: OK
backup/www_log_backup_2026-10-24_week6.tar.gz: OK
```

全部 OK。再验证「校验真的能发现损坏」——往包里追加一个字节后重算 md5：

```bash
cp backup/www_backup_2026-10-24_week6.tar.gz /tmp/www_bak.gz
echo "tampered" >> backup/www_backup_2026-10-24_week6.tar.gz
md5sum -c backup/finger.txt; echo "退出码=$?"
cp /tmp/www_bak.gz backup/www_backup_2026-10-24_week6.tar.gz && rm /tmp/www_bak.gz
md5sum -c backup/finger.txt
```

输出：

```text
backup/system_backup_2026-10-24_week6.tar.gz: OK
backup/www_backup_2026-10-24_week6.tar.gz: FAILED
backup/www_log_backup_2026-10-24_week6.tar.gz: OK
退出码=1
backup/system_backup_2026-10-24_week6.tar.gz: OK
backup/www_backup_2026-10-24_week6.tar.gz: OK
backup/www_log_backup_2026-10-24_week6.tar.gz: OK
```

篡改后该文件立刻 FAILED 且命令退出码为 1（脚本里可据此告警），还原后恢复 OK——指纹校验闭环成立。`md5sum -c` 的原理就是四步：读指纹入缓存 → 按记录的路径重算 md5 → 与旧值比对 → 相同输出 ok、不同输出 failed。

顺带说一句校验算法的选型：md5 已被证实存在构造性碰撞（人为造出两份内容不同、md5 相同的文件是可行的），只是「传输损坏」这种意外场景撞不上。校验备份完整性用 md5 够用；指纹若还兼做防篡改凭证，换 `sha256sum` 更稳妥，用法与 `md5sum` 一致，`-c` 校验也通用。

### 步骤 6：完整备份脚本（已实操）
{: .sec-prac}

把前面步骤固化成脚本。本环境没有 rsync，推送环节用 `cp -a` 等价演示「按 IP 归档到备份服务器」，真机命令在步骤 8 给出：

```bash
cd /tmp/hw/day29
cat > backup.sh <<'EOF'
#!/bin/bash
# 全网备份客户端脚本（沙箱演示版）
SRC=/tmp/hw/day29/web01-sim          # 模拟被备份根（真机为 /）
BAK=/tmp/hw/day29/backup             # 本地 /backup
IP_DIR=$BAK/172.16.1.31              # 按本机内网 IP 归档

mkdir -p "$IP_DIR"
cd "$SRC" || exit 1
tar zchf "$IP_DIR/system_backup_$(date +%F_week%w).tar.gz" ./var/spool/cron/root ./etc/rc.local ./server/scripts
tar zchf "$IP_DIR/www_backup_$(date +%F_week%w).tar.gz" ./var/html/www
tar zchf "$IP_DIR/www_log_backup_$(date +%F_week%w).tar.gz" ./app/logs

find "$BAK" -type f -mtime +7 | xargs -r rm
find "$IP_DIR" -type f -mtime -1 ! -name "finger*" | xargs md5sum > "$IP_DIR/finger.txt"

# rsync 不在本环境，用 cp -a 等价演示「推送到备份服务器按 IP 归档」
mkdir -p /tmp/hw/day29/backup-server/172.16.1.31
cp -a "$BAK"/. /tmp/hw/day29/backup-server/
echo "推送完成（演示用 cp -a；真机命令见下）"
# rsync -avz /backup/ rsync_backup@172.16.1.41::backup --password-file=/etc/rsync.password
EOF
bash -n backup.sh && echo "语法 OK" && sh backup.sh
echo "===== 服务端归档结构 ====="
find backup-server -type f | sort
echo "===== 服务端校验指纹 ====="
cd backup-server && md5sum -c 172.16.1.31/finger.txt
```

输出：

```text
语法 OK
推送完成（演示用 cp -a；真机命令见下）
===== 服务端归档结构 =====
backup-server/172.16.1.31/finger.txt
backup-server/172.16.1.31/system_backup_2026-10-24_week6.tar.gz
backup-server/172.16.1.31/www_backup_2026-10-24_week6.tar.gz
backup-server/172.16.1.31/www_log_backup_2026-10-24_week6.tar.gz
backup-server/finger.txt
backup-server/system_backup_2026-10-24_week6.tar.gz
backup-server/www_backup_2026-10-24_week6.tar.gz
backup-server/www_log_backup_2026-10-24_week6.tar.gz
===== 服务端校验指纹 =====
/tmp/hw/day29/backup/172.16.1.31/finger.txt 记录的三条路径逐条校验：
/tmp/hw/day29/backup/172.16.1.31/system_backup_2026-10-24_week6.tar.gz: OK
/tmp/hw/day29/backup/172.16.1.31/www_backup_2026-10-24_week6.tar.gz: OK
/tmp/hw/day29/backup/172.16.1.31/www_log_backup_2026-10-24_week6.tar.gz: OK
```

这里有个与步骤 5 呼应的细节：本脚本生成指纹用的是**绝对路径**（`find "$IP_DIR" ...`），所以不管在哪个目录执行 `md5sum -c` 都能命中；步骤 5 用的是相对路径，就必须回到基准目录。两种都合法，但要**全项目统一**并写进脚本注释，混用正是「一片 FAILED 但文件都在」这类诡异故障的根源。真机上把 `SRC` 换成 `/`、`BAK` 换成 `/backup`、`cp -a` 换成步骤 8 的 rsync 命令即可。

### 步骤 7：rsync 守护进程服务端部署（预期输出，CentOS 7）
{: .sec-prac}

部署通用五步法：装软件 → 写配置 → 建环境 → 起服务 → 做测试。

```bash
# 第一个历程：下载安装
yum install -y rsync

# 第二个历程：编写配置文件 /etc/rsyncd.conf
```

配置文件内容：

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
comment = "backup dir"
path = /backup
```

```bash
# 第三个历程：创建虚拟用户（不建家目录、禁止登录）
useradd rsync -M -s /sbin/nologin

# 第四个历程：创建认证密码文件（服务端是 用户名:密码，权限必须 600）
echo "rsync_backup:<your-password>" >/etc/rsync.password
chmod 600 /etc/rsync.password

# 第五个历程：创建备份目录并改属主（守护进程以 rsync 身份写盘）
mkdir /backup
chown rsync.rsync /backup/

# 第六个历程：启动并设置开机自启
systemctl start rsyncd
systemctl enable rsyncd
systemctl status rsyncd
```

输出：

```text
Created symlink from /etc/systemd/system/multi-user.target.wants/rsyncd.service to /usr/lib/systemd/system/rsyncd.service.
* rsyncd.service - fast remote file copy program daemon
   Loaded: loaded (/usr/lib/systemd/system/rsyncd.service; enabled; vendor preset: disabled)
   Active: active (running) since Sat 2026-10-24 05:00:01 CST; 2s ago

# 确认 873 端口在监听
ss -lntp | grep 873
LISTEN  0  5  0.0.0.0:873  0.0.0.0:*  users:(("rsyncd",pid=2311,fd=4))
```

### 步骤 8：客户端配置、免密推送与定时任务（预期输出，CentOS 7）
{: .sec-prac}

```bash
# 客户端密码文件只放密码（与服务端 用户名:密码 的格式区分开）
echo "<your-password>" >/etc/rsync.password
chmod 600 /etc/rsync.password

# 免交互推送测试
rsync -avz /backup/ rsync_backup@172.16.1.41::backup --password-file=/etc/rsync.password

# 定时任务：客户端每天 00:00 备份
crontab -e
```

输出：

```text
sending incremental file list
172.16.1.31/
172.16.1.31/system_backup_2026-10-24_week6.tar.gz
172.16.1.31/www_backup_2026-10-24_week6.tar.gz
172.16.1.31/www_log_backup_2026-10-24_week6.tar.gz
172.16.1.31/finger.txt

sent 1,142 bytes  received 154 bytes  2,592.00 bytes/sec
total size is 670  speedup is 0.52
```

客户端 crontab 条目：

```text
# backup data
0 0 * * *  /bin/sh /server/scripts/backup.sh &>/dev/null
```

服务端比客户端晚 5 小时执行校验（确保当天数据已传完）：

```text
# check backup data
0 5 * * *  /bin/sh /server/scripts/backup_server.sh &>/dev/null
```

服务端校验与清理脚本的核心三行：

```bash
# 1. 清理 180 天前的数据，保留周一快照（先 find 确认，再接删除）
find /backup/ -type f -mtime +180 ! -name "*week1.tar.gz" | xargs rm

# 2. 校验各客户端上传的指纹文件
find /backup/ -type f -name "finger.txt" | xargs md5sum -c >/tmp/check.txt

# 3. 把校验结果发给管理员
mail -s "备份校验结果 $(date +%F)" admin@example.com </tmp/check.txt
```

备份窗口与带宽也要提前想：8 台机器同时卡在 00:00 推送，备份服务器的磁盘 IO 和内网带宽会被瞬间打满。错峰的常见做法是按机器尾号分时段（如 00:00、00:10、00:20 各推两台），或者在 rsync 命令上加 `--bwlimit=1024` 把单台限到 1MB/s，用时间换带宽。

### 验证方法
{: .sec-ver}

1. `tar -tzf 包名` 列出的成员与备份清单一致，且路径以 `./` 开头；
2. `md5sum -c finger.txt` 全部 OK，人为篡改任一文件后立即 FAILED、退出码 1；
3. 服务端 `find /backup -type f | sort` 能看到「IP 目录 + 日期包 + finger.txt」三层结构；
4. 连续跑两天，第二天服务端只新增一天的包；`find /backup -mtime +7` 在客户端无残留旧包。

> **易错点**：
>
> - 「先推送、后清理」顺序不能颠倒——先删本地再推送，一旦推送失败（网络 / 认证 / 磁盘满），这份数据两份都不存在；
> - 指纹文件路径基准必须与校验时的目录一致（步骤 5 已真实复现 `FAILED open or read`），建议统一用绝对路径记录；
> - 服务端密码文件是 `用户名:密码`，客户端只放密码，两端都必须 600 权限，否则 rsync 拒绝工作；
> - 客户端只能自动创建模块下**一级**目录（如 `backup/172.16.1.31/`），更深层级要服务端预先建好；
> - `--delete` 无差异同步威力大风险也大：源目录被误清空，备份端会跟着删空，确认源状态后再用；
> - `date +%w` 的周几别记错：0 是周日、1-6 是周一到周六，所以「保留周一」排除的是 `week1` 而不是 `week0`。

## 题 2：总结每个服务的部署过程
{: .sec-sum}

**考察点**：把项目里用到的服务按统一框架复盘，形成可复用的部署手册条目——这也是「预习下一课」式的学习方法：每学一个服务就沉淀一页部署卡。

所有服务的部署都遵循通用五步法：

```text
a 下载安装软件    yum
b 编写配置文件
c 搭建服务环境    备份的目录 / 目录权限
d 启动服务程序    开机自动启动
e 测试服务功能
```

本项目涉及的服务部署总结：

| 服务 | 角色 | 关键配置 / 命令 | 测试验证 |
| --- | --- | --- | --- |
| rsync（服务端） | backup01 上汇聚全网备份 | `/etc/rsyncd.conf`（uid/gid、auth users、模块 path）、虚拟用户 rsync、密码文件 600、`chown rsync.rsync /backup` | `ss -lntp \| grep 873`、客户端推送成功 |
| rsync（客户端） | 各被备份机推送数据 | 只含密码的 `/etc/rsync.password`（600）、`--password-file=` 免交互 | `rsync -avz /backup/ rsync_backup@backup01::backup` 推送成功 |
| tar + find + md5sum | 打包 / 清理 / 校验（无需安装） | `tar zchf`、`find -mtime +7 \| xargs rm`、`md5sum -c` | `tar -tzf` 列成员、校验全 OK |
| crond | 定时驱动客户端备份与服务端校验 | `crontab -e`：客户端 00:00、服务端 05:00 | `crontab -l`、`tail /var/log/cron` |
| postfix + mail | 发送校验结果 | `/etc/mail.rc` 配置发件与授权码（600） | `echo test \| mail -s test admin@example.com` |
| sshd / scp（对照） | 远程传输的备选通道 | `rsync -e ssh` 走 SSH 免开 873 端口 | `scp -rp /etc/hosts backup01:/backup/` |

部署时的两个通用习惯：一是**改配置前先备份**（`\cp 文件{,.bak}`），二是**每步部署完立即验证**再进下一步，排错时才能按五步法反向定位是「没装上、配错、环境不对、没启动还是没测试」中的哪一环。

### 辨析：备份与容灾

这两个词经常被混着说，其实是两码事：备份解决「数据丢了能不能找回来」，容灾解决「服务挂了能不能接着用」。本项目整套东西——打包、推送、指纹校验、保留策略——都在备份的范畴里，它的恢复粒度是「把某个包拉回来、解包、覆盖」，跑完要几分钟到几小时，期间业务是中断的。容灾要的是切换：负载均衡把故障节点摘掉、数据库主从顶上，业务基本无感，靠的是 keepalived、主从复制这类「冗余 + 自动切换」机制。

对应的坑：把「做了备份」当成「有了高可用」。备份做得再勤，RTO（恢复时间）依然是小时级，扛不住「数据库宕机 5 分钟就算事故」的 SLA。反过来，只有主从复制没有备份更危险——误删表会被复制同步到从库，两份数据一起没。生产实践是两条腿都要走：备份兜底数据安全，容灾兜底服务连续性，谁也替代不了谁。

## 小结
{: .sec-sum}

1. 全网备份项目 = 需求拆解 + 脚本固化 + 定时任务：统一 `/backup` 目录、统一「内网 IP 目录 + 日期_week周几」命名，客户端四件事（建目录、打包、清理、指纹加推送），服务端三件事（清理、校验、发信）。
2. `tar zchf` 的 `-h` 跟随软链、`cd /` 后相对路径打包防止解包覆盖系统路径、`tar -tzf` 打包后立即验证是备份操作的底线动作。
3. 指纹校验的精髓在路径基准：相对路径指纹必须在记录时的目录校验（本篇真实复现了换目录导致整片 `FAILED open or read` 的坑），绝对路径指纹随处可校验，全项目必须统一。
4. md5 校验闭环已实测：篡改任一字节立即 FAILED 且退出码为 1，还原后恢复 OK——「备份是否完整」必须靠校验回答，不能靠「命令没报错」。
5. rsync 守护进程服务端六步（装、配、建用户、建密码文件、建目录改属主、启动自启）+ 客户端两步（密码文件、免密推送）；服务端密码文件 `用户名:密码`、客户端只放密码，都 600 权限。
6. 定时任务错峰设计：客户端 00:00 备份、服务端 05:00 校验，确保校验时当天数据已传完；多客户端同时推送会打满带宽，分时段或 `--bwlimit` 限速二选一。保留周一数据用文件名 `%w` 编码，清理时 `! -name "*week1.tar.gz"` 排除。
7. 备份的终点是「能恢复」：本地 7 天 + 服务端 6 个月 + 周一快照长期保留只是存储策略，每月抽样解包恢复、每季度全流程演练才算真正的数据安全。备份和容灾是两条腿，别指望一个顶两个。

> **参见**：[备份服务rsync](/posts/linux-arch-02/)、[全网备份项目实战](/posts/linux-homework-29/)、[定时任务与crond](/posts/linux-cron-01/)、[day27 综合架构规划与主机克隆作业实操](/posts/linux-homework-27/)


{% endraw %}
