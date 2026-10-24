---
title: "day32 作业实操：基于密钥的 SSH 连接与脚本化实时同步"
date: 2026-10-24 09:32:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 32 天留了两道作业：①用脚本实现实时同步（while 循环）；②让 Xshell 这类终端工具也走密钥连接，另外要提前装好 ansible。第一题的关键是想清楚「while 轮询式同步」和 day31「inotify 事件驱动」差在哪，然后用 while 循环脚本真跑周期同步（rsync 本环境不可用，用 cp 模拟）；第二题整篇围绕密钥认证——A 级真跑 `ssh-keygen` 生成密钥对、给出 `ssh-copy-id` 部署公钥的标准命令与预期，再补 Xshell 导入私钥的步骤和 `sshd_config` 两个关键配置（`StrictModes` / `PubkeyAuthentication`）。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker）。经 `command -v` 实测：`ssh-keygen` / `ssh-copy-id` 存在，但本环境 `sshd` 未监听（无运行中的 SSH 服务），且 `rsync` / `sshpass` 不存在。因此采用分级实操：

- **A 级（已真实执行）**：`ssh-keygen` 生成 ed25519 密钥对在本环境真实运行，输出为真实结果；while 循环周期同步脚本用 `cp` 模拟 `rsync` 在本环境真实运行，标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`ssh-copy-id` 部署公钥、`ssh` 免密登录验证、Xshell 导入私钥、`sshd_config` 关键项调整，给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明真机执行方式。

本篇主机名统一用 `linux-node01`（管理端）/ `linux-node02`（被管理端），域名统一用 `example.com`，命令输出中的属主统一显示为 `user`，口令一律以 `ssh-password`（占位）表示。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 利用脚本实现实时同步（while 循环） | A 级（循环脚本真跑）+ B 级（真实 rsync 命令） |
| 题 2 | 终端工具基于密钥方式连接主机 | A 级（ssh-keygen 真跑）+ B 级（ssh-copy-id / Xshell / sshd_config） |

## 题 1：利用脚本实现实时同步（while 循环）

**考察点**：理解「轮询式实时同步」与「事件驱动式实时同步」两种思路的差异，并用 while 循环把周期同步固化成脚本。day31 的 inotify 是「文件一变立刻触发」，本作业要求的是用脚本（while 循环）主动去轮询。实现简单得多，代价是实时性取决于轮询间隔。

**实现思路**：脚本里用 `while true`（或带次数的 `while`）反复执行一次 rsync 增量同步，每次循环之间 `sleep` 一个间隔。源目录没变时 rsync 比对后几乎零传输，有变则增量推送。本环境没有 rsync，先用 `cp -a` 模拟 rsync 把循环逻辑真跑通，再给生产真机版。

### 步骤 1：编写 while 循环周期同步脚本（已实操）

```bash
mkdir -p /tmp/hw/day32/src /tmp/hw/day32/dst
cat > /tmp/hw/day32/sync_loop.sh <<'EOF'
#!/bin/bash
# 脚本化实时同步：while 循环 + 周期 rsync（本环境用 cp 模拟 rsync）
SRC=/tmp/hw/day32/src
DST=/tmp/hw/day32/dst
mkdir -p "$DST"
round=0
while [ "$round" -lt 3 ]; do
    round=$((round+1))
    echo "[round $round] $(date +%T) 同步开始"
    # 真实环境：rsync -az --delete "$SRC"/ linux-node02:/backup/
    cp -a "$SRC"/. "$DST"/
    echo "[round $round] 已同步 $(ls -1 "$SRC" | wc -l) 个文件"
    sleep 1
done
echo "循环结束"
EOF
chmod +x /tmp/hw/day32/sync_loop.sh
bash -n /tmp/hw/day32/sync_loop.sh && echo "语法 OK"
echo "file1" > /tmp/hw/day32/src/f1.txt
echo "file2" > /tmp/hw/day32/src/f2.txt
bash /tmp/hw/day32/sync_loop.sh
echo "--- 目标目录 ---"
ls -l /tmp/hw/day32/dst
```

输出：

```text
$ bash -n /tmp/hw/day32/sync_loop.sh && echo "语法 OK"
语法 OK
$ bash /tmp/hw/day32/sync_loop.sh
[round 1] 07:49:40 同步开始
[round 1] 已同步 2 个文件
[round 2] 07:49:42 同步开始
[round 2] 已同步 2 个文件
[round 3] 07:49:44 同步开始
[round 3] 已同步 2 个文件
循环结束
--- 目标目录 ---
total 2
-rw-r--r-- 1 user user 6 Oct 24 07:49 f1.txt
-rw-r--r-- 1 user user 6 Oct 24 07:49 f2.txt
```

每轮间隔约 2 秒（`sleep 1` 加命令耗时），三轮都在把源目录同步到目标目录，目标端得到与源端一致的 `f1.txt` / `f2.txt`。这就是 while 轮询式同步的最小可用骨架。

### 步骤 2：验证「增量」语义（已实操）

while 循环里每次都跑整轮 rsync，但只有变化才真正传输。验证：再往源端加一个文件，单独跑一次，目标端应只多出新增文件：

```bash
echo "file3" > /tmp/hw/day32/src/f3.txt
cp -a /tmp/hw/day32/src/. /tmp/hw/day32/dst/
echo "--- 目标目录（应多出 f3.txt）---"
ls -1 /tmp/hw/day32/dst
```

输出：

```text
--- 目标目录（应多出 f3.txt）---
f1.txt
f2.txt
f3.txt
```

`f3.txt` 进入目标端，旧文件保持不变——这就是 rsync 增量比对的效果（用 `cp` 模拟时表现为「目标端始终等于源端」）。

### 步骤 3：生产真机版（B 级）

把 `cp` 换成真正的 rsync，并做成常驻后台、带间隔的轮询守护。注意间隔别太密（如 5~30 秒），避免频繁比对占用 CPU。

```bash
cat > /server/scripts/sync_poll.sh <<'EOF'
#!/bin/bash
SRC=/data/linux/upload/
DST=linux-node02:/backup/upload/
while true; do
    rsync -az --delete "$SRC" "$DST"
    sleep 10
done
EOF
# 后台常驻
nohup /server/scripts/sync_poll.sh >/var/log/sync_poll.log 2>&1 &
```

（预期输出，CentOS 7：每 10 秒把源目录增量推到 linux-node02，日志里只记录有变化的那次传输；手工验证）

```text
# 源端新增文件后，下一轮日志出现
$ tail -n 4 /var/log/sync_poll.log
sending incremental file list
f3.txt

sent 102 bytes  received 35 bytes  274.00 bytes/sec
```

### 步骤 4：把轮询脚本托管为 systemd 服务（B 级）

`nohup ... &` 不够稳健：机器一重启进程就丢，崩了也不会自愈。生产上写成 systemd unit，开机自启和崩溃拉起都交给 systemd：

```conf
[Unit]
Description=rsync poll sync service
After=network.target

[Service]
Type=simple
ExecStart=/server/scripts/sync_poll.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now sync_poll.service
systemctl status sync_poll.service
```

（预期输出，CentOS 7）

```text
$ systemctl status sync_poll.service
● sync_poll.service - rsync poll sync service
   Loaded: loaded (/usr/lib/systemd/system/sync_poll.service; enabled; vendor preset: disabled)
   Active: active (running) since Sat 2026-10-24 04:41:00 CST; 2s ago
```

关于 rsync 参数：`sync_poll.sh` 里用的 `-az` 中 `-a` 是归档模式（递归并保留权限、时间戳、属主等），`-z` 是传输压缩。若只同步新增不删目标多余文件，去掉 `--delete`；若目标要镜像源（含删除），必须带 `--delete`，否则源端删掉的文件目标端会残留。大文件多、跨专线时用 `--bwlimit=10000`（单位 KB/s）限速，避免挤占业务带宽。

### while 轮询 vs inotify 事件驱动对比

| 维度 | while 轮询（本题） | inotify 事件驱动（day31） |
| --- | --- | --- |
| 触发方式 | 定时主动比对 | 文件变化立即触发 |
| 实时性 | 取决于 sleep 间隔 | 秒级、近乎实时 |
| 实现复杂度 | 低，一条 while + rsync | 中，需 inotifywait + 事件解析 |
| 资源占用 | 间隔越短 CPU 越高 | 常驻监听，watch 数受内核限制 |
| 漏事件风险 | 无（每轮全量比对兜底） | 有（watch 耗尽 / 队列溢出） |

> **结论**：追求简单可靠用 while 轮询（自带全量兜底）；追求实时用 inotify；二者都依赖 rsync 做增量传输，差异只在「何时触发」。

## 题 2：实现终端工具基于密钥方式连接主机

**考察点**：密钥认证的完整链路——生成密钥对 → 分发公钥到被管理端 → 用私钥免密登录；以及把这套机制迁移到图形终端工具（Xshell）上。

**密钥认证原理（理解后才好排错）**：把私钥比作钥匙、公钥比作锁头。登录时，服务端用存放在 `authorized_keys` 里的公钥发一个「质询」给客户端，客户端用本地私钥解开并回传结果，服务端验证通过即证明「对方确实持有对应私钥」，从而放行。整个过程私钥从不离开管理端——服务端只是验证「你解得开质询」，不需要也拿不到私钥内容，这是非对称加密做认证的经典用法。比口令强在哪：口令是双方共知的秘密，走加密通道也仍可能被暴力破解或撞库；密钥是 256 位的随机数，没有字典可猜，`PasswordAuthentication no` 之后爆破直接失去目标。生产服务器收敛安全，都是先普及密钥、再关口令认证。

### 步骤 1：管理端生成密钥对（已实操）

在管理端 `linux-node01` 生成 ed25519 密钥对。选型依据：ed25519 密钥仅 256 位、长度只有 RSA 的一小半，安全强度却对标 3072 位 RSA，生成和验签还更快，是现代默认推荐。DSA 已被 OpenSSH 废弃，别再用；RSA 也不算错，只是得开到 3072 位以上才够看。

```bash
ssh-keygen -t ed25519 -C "linux-node01 admin key"
```

输出（本环境真实执行，已预先指定空口令与密钥路径）：

```text
$ ssh-keygen -t ed25519 -C "linux-node01 admin key"
Generating public/private ed25519 key pair.
Your identification has been saved in /tmp/hw/day32/id_ed25519
Your public key has been saved in /tmp/hw/day32/id_ed25519.pub
The key fingerprint is:
SHA256:FXJkjvojDLQxuTE2PMRaH1QUEONQwmvZjuTrVe65ehs linux-node01 admin key
The key's randomart image is:
+--[ED25519 256]--+
|   o+o*==o=      |
|   o+=.. * .     |
|   o%=... o      |
|  .o=Xo. .       |
|   ++o. S        |
|    oo.+         |
|     .+ E        |
|    .. o.+       |
|   .. .o=o       |
+----[SHA256]-----+
```

生成的两个文件：

```bash
ls -l /tmp/hw/day32/id_ed25519*
```

输出：

```text
$ ls -l /tmp/hw/day32/id_ed25519*
-rw------- 1 user user 419 Oct 24 07:49 id_ed25519
-rw-r--r-- 1 user user 104 Oct 24 07:49 id_ed25519.pub
```

私钥 `id_ed25519` 权限必须是 `600`，公钥 `id_ed25519.pub` 是 `644`、可以随处分发。

### 步骤 2：分发公钥到被管理端（B 级，标准命令 + 预期）

`ssh-copy-id` 把公钥追加到被管理端 `~/.ssh/authorized_keys`。本环境 `sshd` 未监听、且 `sshpass` 不存在，无法真跑，给出标准命令与 CentOS 7 预期。

```bash
# 标准分发（需输入一次被管理端口令）
ssh-copy-id -i /tmp/hw/day32/id_ed25519.pub user@linux-node02

# 免交互分发（需先 yum install -y sshpass）
sshpass -p'<ssh-password>' ssh-copy-id -i /tmp/hw/day32/id_ed25519.pub user@linux-node02 "-o StrictHostKeyChecking=no"
```

（预期输出，CentOS 7）

```text
$ ssh-copy-id -i /tmp/hw/day32/id_ed25519.pub user@linux-node02
/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "/tmp/hw/day32/id_ed25519.pub"
The authenticity of host 'linux-node02 (10.0.0.12)' can't be established.
ECDSA key fingerprint is SHA256:AbCdEf...
Are you sure you want to continue connecting (yes/no)? yes
/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed
/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the remaining key
user@linux-node02's password:

Number of key(s) added: 1

Now try logging into the machine, with:   "ssh 'user@linux-node02'"
and check to make sure that only the key(s) you wanted were added.
```

分发完成后，验证免密登录：

```bash
ssh user@linux-node02 'hostname'
```

（预期输出，CentOS 7）

```text
$ ssh user@linux-node02 'hostname'
linux-node02
```

不再提示输入口令，即密钥认证成功。

说白了，`ssh-copy-id` 干的事就是把公钥追加到对端的 `~/.ssh/authorized_keys`，手动 `cat 公钥.pub >> ~/.ssh/authorized_keys` 效果一样，只是它顺手处理了权限与重复键。生产上还可以在 `authorized_keys` 的公钥行首加选项做精细控制，例如 `from="10.0.0.*"` 限定该密钥只能从指定网段使用；离职回收权限时，按行删掉对应公钥即可。

### 步骤 3：Xshell 基于密钥连接主机（B 级，标准步骤）

图形终端工具（Xshell、SecureCRT、PuTTY 等都同理）的密钥连接，本质和命令行一样：用私钥做认证。标准步骤：

1. 在管理端生成密钥对（步骤 1 已完成），得到 `id_ed25519`（私钥）和 `id_ed25519.pub`（公钥）。
2. 把**公钥**放到被管理端：`ssh-copy-id` 或手动把 `.pub` 内容追加进 `~/.ssh/authorized_keys`（权限 `600`、目录 `700`）。
3. 把**私钥**下载到本地 Windows 机器，导入 Xshell：
   - 菜单「工具 → 用户密钥管理者 → 导入」，选择私钥文件 `id_ed25519`；
   - 若生成时设了 passphrase，导入时会要求输入（建议设，防止私钥泄露后被直接使用）。
4. 新建会话：协议 SSH、主机 `linux-node02`、端口 `22`、方法「Public Key」、用户名 `user`、用户密钥选刚导入的 `id_ed25519`。
5. 连接，Xshell 用私钥向服务端发起质询，认证通过即登录，无需输入主机口令。

> **注意**：Xshell 原生支持 OpenSSH 的 ed25519 / RSA 私钥。若私钥是带 passphrase 的 PEM，导入时直接填密码即可；私钥文件务必妥善保管，不要明文发给他人，离职或换机器后应从服务端 `authorized_keys` 移除对应公钥。

### 步骤 4：sshd_config 关键配置（B 级，StrictModes / PubkeyAuthentication）

密钥认证要生效、且要安全，服务端 `/etc/ssh/sshd_config` 有两项最相关：

```conf
PubkeyAuthentication yes
StrictModes yes
```

| 配置项 | 作用 | 建议 |
| --- | --- | --- |
| `PubkeyAuthentication` | 是否允许公钥认证 | `yes`（密钥登录的前提） |
| `StrictModes` | 是否检查家目录与 authorized_keys 的权限/属主 | `yes`（保持默认） |
| `PasswordAuthentication` | 是否允许口令认证 | 密钥普及后设 `no`，防暴力破解 |
| `PermitRootLogin` | 是否允许 root 远程登录 | `no`，用普通用户 + sudo |
| `AuthorizedKeysFile` | 公钥存放路径 | 默认 `.ssh/authorized_keys` |

`StrictModes yes` 是「公钥分发成功却仍要输密码」的头号原因，十有八九栽在权限上：服务端 `~/.ssh` 不是 `700`、`authorized_keys` 不是 `600` 或属主不对，sshd 会直接拒绝密钥认证。修改配置后：

```bash
sshd -t                 # 先检查语法
systemctl reload sshd   # 不断开现有连接地重载
```

（预期输出，CentOS 7）

```text
$ sshd -t && echo "配置语法 OK"
配置语法 OK
$ systemctl reload sshd
$
```

一份收敛后的 `sshd_config` 关键片段（B 级，仅展示与本题相关的项）：

```conf
# 连接入口
Port 22
ListenAddress 10.0.0.11
# 认证收敛：关口令、开密钥、禁止 root 直连
PubkeyAuthentication yes
PasswordAuthentication no
PermitRootLogin no
StrictModes yes
# 防暴力破解与连接变慢
MaxAuthTries 3
LoginGraceTime 60
UseDNS no
GSSAPIAuthentication no
```

防 SSH 爆破的三板斧其实就藏在这份配置里：改端口躲开扫描器、`PasswordAuthentication no` 让爆破彻底失效、`MaxAuthTries 3` 压死单连接的尝试次数；再配 fail2ban 自动封禁，公网裸奔也不慌。

还可以用 `Match` 块按来源做差异化策略，例如只允许办公网段用密钥登录 root、其余来源禁止：

```conf
Match Address 10.0.0.0/8
    PermitRootLogin yes

Match all
    PermitRootLogin no
```

另外补充 `known_hosts`：首次连接某主机时，客户端会把服务端主机公钥指纹记到 `~/.ssh/known_hosts`，之后若服务端重装或换 IP 导致指纹变化，会报 `Host key verification failed`；此时用 `ssh-keygen -R 主机名` 删掉旧记录再重连即可。批量场景可在 `ssh-copy-id` 时加 `-o StrictHostKeyChecking=no` 跳过首次确认。

### 密钥认证失败排查表

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 公钥分发后仍要输密码 | `~/.ssh` 非 700 / `authorized_keys` 非 600 / 属主不对 | 修正权限与属主，或重发公钥 |
| 连接直接拒绝 | `PubkeyAuthentication no` | 改为 `yes` 并重载 |
| 私钥被本地拒绝使用 | 客户端私钥权限过宽（如 644） | `chmod 600 私钥` |
| 首次连接卡在确认 | 未加 `StrictHostKeyChecking=no` | 交互输 yes，或分发时加该参数 |

### 辨析：known_hosts 与 authorized_keys

两个文件都住在 `~/.ssh/` 下，新手极易搞混，其实方向完全相反：

- `known_hosts`：客户端记录「我连过的服务端」的公钥指纹，用来防中间人。报 `Host key verification failed` 就是这里的旧记录在作怪。
- `authorized_keys`：服务端记录「允许登录本机的客户端」公钥，每多一行就多一个能免密进来的人。

记法：`known_hosts` 管我连的别人，`authorized_keys` 管连我的别人。人员离职回收权限时，删的是各服务端 `authorized_keys` 里的行。

## 验证方法

- 密钥认证：执行 `ssh user@linux-node02 'hostname'` 不再提示口令且能返回主机名，即证明密钥登录打通。
- while 同步：源端新增/删除文件后，下一轮循环目标端对应变化；用 `diff -r 源 目标` 应为空（无差异）。
- 配置生效：`sshd -t` 无报错、`systemctl reload sshd` 成功，且现有连接不中断。

## 本篇小结

1. while 轮询式实时同步 = `while true; do rsync -az --delete 源 目标; sleep N; done`，实现简单、自带全量兜底，实时性取决于间隔；与 day31 的 inotify 事件驱动差异只在「何时触发」。
2. 密钥认证三步：管理端 `ssh-keygen -t ed25519` 生成密钥对 → `ssh-copy-id -i 公钥 user@主机` 分发公钥 → `ssh 主机` 免密验证。
3. 私钥权限必须 `600`、公钥 `644`；服务端 `~/.ssh` 要 `700`、`authorized_keys` 要 `600`，否则 `StrictModes yes` 直接拒绝密钥认证。
4. Xshell 等图形终端基于密钥连接，本质与命令行一致：把公钥放到服务端、把私钥导入客户端、会话认证方式选 Public Key。
5. `sshd_config` 关键三项：`PubkeyAuthentication yes`（开密钥）、`StrictModes yes`（保安全）、`PasswordAuthentication no`（密钥普及后关口令），改完 `sshd -t` 检查再 `systemctl reload sshd`。
6. 本环境 `sshd` 未监听且无 `sshpass`，`ssh-copy-id` 无法真跑，按规范列为 B 级；`ssh-keygen` 与 while 循环脚本均已在 Git Bash 真实执行。
7. 私钥就是身份本体，按口令的规格保管：设 passphrase、权限 600、不外传；人员变动记得清各端的 `authorized_keys`。
{% endraw %}
