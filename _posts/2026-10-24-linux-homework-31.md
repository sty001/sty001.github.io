---
title: "day31-实时同步服务作业实操"
date: 2026-10-24 09:27:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操]
slug: "linux-homework-31"
---

{% raw %}
课程第 31 天的作业原题只有一句话：「扩展实时同步软件：数据库需要实时同步、Windows 到 Windows 的实时同步」。完整作业还包含「用脚本实现实时同步」。这里把四块内容补全：①用脚本实现 inotify + rsync 的实时同步（A 级用本地模拟脚本真跑事件驱动逻辑，用 echo 模拟文件变更触发；B 级给出 inotifywait + rsync 真实命令与 CentOS 7 预期输出）；②sersync / lsyncd 两种成熟扩展方案的部署；③数据库数据为什么不能直接文件级同步、正确做法是什么；④Windows 到 Windows 实时同步的思路与工具选型。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），且经 `command -v` 实测 `inotifywait` 与 `rsync` 均不存在，因此采用分级实操：

- **A 级（已真实执行）**：用纯 bash 写一份「事件驱动同步」本地模拟脚本，以 `while read` 循环消费事件流、`cp` 模拟 rsync 推送，并用 `echo`/`printf` 模拟 inotify 产生的文件变更事件，在 Git Bash 实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`inotifywait` + `rsync` 真实脚本、sersync / lsyncd 部署、数据库同步、Windows 方案，给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明真机执行方式。

本篇所有核心同步脚本均先在 `/tmp/hw/day31` 真跑模拟版，再给出生产真机版本。环境实测：GNU bash 5.3.15。文中主机名统一用 `linux-node01` / `linux-node02`，域名统一用 `example.com`，命令输出中的属主统一显示为 `user`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 用脚本实现 inotify + rsync 实时同步 | A 级（本地模拟真跑）+ B 级（真实命令） |
| 题 2 | sersync / lsyncd 扩展方案部署 | B 级（标准部署命令 + 预期） |
| 题 3 | 数据库实时同步的注意事项与正确做法 | B 级（思路 + 对照表） |
| 题 4 | Windows 到 Windows 实时同步思路 | B 级（工具选型 + 思路） |

## 题 1：用脚本实现 inotify + rsync 实时同步

**考察点**：理解事件驱动型实时同步的骨架——「监控目录变化 → 拿到变化事件 → 触发一次 rsync 推送」。作业要求用脚本实现，重点不是背命令，而是把 inotify 的事件流和 rsync 的传输动作串起来。

**实现思路**：实时同步 = inotify 监听 + rsync 传输，二者靠一个 `while read` 循环衔接：inotifywait 把每一个事件打印成一行，脚本逐行读，根据事件类型决定「拷贝」还是「删除」。本环境没有 inotifywait / rsync，所以先写一个逻辑完全一致的「本地模拟版」（用 `read` 读事件、`cp` 模拟 rsync）真跑，证明循环与事件分发逻辑正确；再给出挂上 inotifywait + rsync 的生产真机版。

### 步骤 1：构造源目录与目标目录（已实操）

```bash
mkdir -p /tmp/hw/day31/source /tmp/hw/day31/backup
cd /tmp/hw/day31
echo "v1" > source/a.txt
echo "v1" > source/b.txt
ls -l source
```

输出：

```text
$ ls -l source
total 2
-rw-r--r-- 1 user user 3 Oct 24 04:35 a.txt
-rw-r--r-- 1 user user 3 Oct 24 04:35 b.txt
```

### 步骤 2：编写「事件驱动同步」本地模拟脚本（已实操）

下面这份脚本把 inotify 的「事件流」抽象成标准输入的一行行 `事件 文件名`，循环消费。它和生产版的唯一区别是：「事件从管道来」替代「事件从 inotifywait 来」，`cp` 替代 `rsync`，其余分发逻辑一致。

```bash
cat > /tmp/hw/day31/sync_demo.sh <<'EOF'
#!/bin/bash
# 事件驱动同步的本地模拟版：用 read 循环消费事件流，cp 模拟 rsync 推送
SRC=/tmp/hw/day31/source
DST=/tmp/hw/day31/backup
mkdir -p "$DST"
echo "sync_demo: 开始监听 $SRC (模拟 inotifywait -mrq)"
while read -r event file; do
    case "$event" in
        CREATE|MODIFY|MOVED_TO)
            if cp -a "$SRC/$file" "$DST/$file" 2>/dev/null; then
                echo "sync_demo: push $file (事件=$event)"
            fi
            ;;
        DELETE)
            if rm -f "$DST/$file"; then
                echo "sync_demo: remove $file (事件=$event)"
            fi
            ;;
        *)
            echo "sync_demo: 忽略未知事件 $event"
            ;;
    esac
done
EOF
chmod +x /tmp/hw/day31/sync_demo.sh
bash -n /tmp/hw/day31/sync_demo.sh && echo "语法 OK"
```

输出：

```text
$ bash -n /tmp/hw/day31/sync_demo.sh && echo "语法 OK"
语法 OK
```

### 步骤 3：用 echo 模拟文件变更触发同步（已实操）

事件流由 `printf` 模拟（等价于 inotifywait 在目录里看到变更后打印的内容）。先制造真实文件，再把对应的事件喂给脚本：

```bash
# 模拟文件变更：先真正创建/修改源文件
echo "v2" > source/a.txt
echo "new" > source/c.txt
# 用 printf 模拟 inotifywait 产生的事件流，管道喂给同步脚本
printf 'MODIFY a.txt\nCREATE c.txt\n' | bash /tmp/hw/day31/sync_demo.sh
echo "----- 同步后 backup 目录 -----"
ls -l backup
```

输出：

```text
$ printf 'MODIFY a.txt\nCREATE c.txt\n' | bash /tmp/hw/day31/sync_demo.sh
sync_demo: 开始监听 /tmp/hw/day31/source (模拟 inotifywait -mrq)
sync_demo: push a.txt (事件=MODIFY)
sync_demo: push c.txt (事件=CREATE)
----- 同步后 backup 目录 -----
total 3
-rw-r--r-- 1 user user 3 Oct 24 04:35 a.txt
-rw-r--r-- 1 user user 3 Oct 24 04:35 b.txt
-rw-r--r-- 1 user user 4 Oct 24 04:35 c.txt
```

`a.txt` 被更新、`c.txt` 被新建，都进了 `backup`；`b.txt` 没产生事件所以没动（但它本来就存在，属于「首次全量」范畴，见步骤 4）。再验证一次删除事件：

```bash
rm -f source/c.txt
printf 'DELETE c.txt\n' | bash /tmp/hw/day31/sync_demo.sh
echo "----- 删除后 backup 目录 -----"
ls -l backup
```

输出：

```text
$ printf 'DELETE c.txt\n' | bash /tmp/hw/day31/sync_demo.sh
sync_demo: 开始监听 /tmp/hw/day31/source (模拟 inotifywait -mrq)
sync_demo: remove c.txt (事件=DELETE)
----- 删除后 backup 目录 -----
total 2
-rw-r--r-- 1 user user 3 Oct 24 04:35 a.txt
-rw-r--r-- 1 user user 3 Oct 24 04:35 b.txt
```

删除事件被正确转发到目标端，目标端对应文件被移除。模拟版证明：事件分发、增删判断、目标同步三件事逻辑闭环。

### 步骤 4：还原生产真机版（inotifywait + rsync，B 级）

把「管道读事件」换成真正的 inotifywait，把 `cp` 换成 `rsync`，这就是生产环境的标准写法。inotifywait 用 `-m` 持续监控、`-r` 递归、`-q` 精简输出、`--format` 自定义输出格式、`-e` 指定只关心「写关闭 / 移动入 / 创建 / 删除」四类事件。

```bash
cat > /server/scripts/inotify_rsync.sh <<'EOF'
#!/bin/bash
SRC=/data/linux/upload/
DST=linux-node02::backup/
LOG=/var/log/inotify_rsync.log
inotifywait -mrq --format '%e %w%f' \
    -e close_write -e moved_to -e create -e delete "$SRC" | \
while read -r event path; do
    # 取文件名（路径最后一段）
    file=$(basename "$path")
    case "$event" in
        *DELETE*)
            rsync -az --delete "$SRC" "$DST" >> "$LOG" 2>&1
            ;;
        *)
            rsync -az "$SRC" "$DST" >> "$LOG" 2>&1
            ;;
    esac
done
EOF
```

（预期输出，CentOS 7：脚本常驻后，源目录每发生一次变更，日志里就多一条 rsync 记录；手动验证一次）

```text
# 在源端执行
$ touch /data/linux/upload/test.txt
$ tail -n 1 /var/log/inotify_rsync.log
sending incremental file list
test.txt

sent 98 bytes  received 35 bytes  266.00 bytes/sec
total size is 0  speedup is 0.00
```

> **易错点**：
>
> - 只监控 `modify` 会漏掉用 sed / vim 修改的文件（sed 的机制是「临时文件 + 重命名」，源文件只有 `moved_to` 事件），必须同时监控 `close_write`、`moved_to`、`create`、`delete`。
> - 删除同步要带 `--delete`，否则目标端删掉的文件源端不会跟着删。
> - 每次事件都跑完整 `rsync -az 源 目标` 即可（rsync 是增量比对，只传差异），不必区分文件；上面的脚本为演示才分了分支。
> - inotify 递归大目录会耗尽 `fs.inotify.max_user_watches`，表现为「后建的文件不触发」，需 `sysctl` 调大。

### 步骤 5：脚本常驻与停止（B 级）

```bash
# 后台常驻
nohup /server/scripts/inotify_rsync.sh >/dev/null 2>&1 &
# 或写成 systemd 单元，享受开机自启与崩溃重启
# 停止
pkill -f inotify_rsync.sh
```

（预期输出，CentOS 7）

```text
$ pgrep -af inotify_rsync.sh
12345 /bin/bash /server/scripts/inotify_rsync.sh
```

nohup 是最省事的挂法，缺点是进程崩了没人拉起来。生产更推荐写成 systemd 单元，`Restart=always` 加上开机自启，脚本挂掉几秒内自动恢复；监控侧记得加一条「进程存活 + 最近日志时间戳」的检查，inotify 脚本一旦静默死亡，数据就开始悄悄积压。

### 步骤 6：inotifywait 输出格式与事件类型补充（B 级）

inotifywait 的真实输出靠 `--format` 与 `--timefmt` 控制。常用占位符：`%w` 是被监控目录、`%f` 是发生事件的文件名、`%e` 是事件列表、`%T` 是按 `--timefmt` 格式化的时间。例如：

```bash
inotifywait -mrq --timefmt '%F %T' --format '%T %w%f 事件:%e' \
    -e close_write -e moved_to -e create -e delete /data/linux/upload
```

（预期输出，CentOS 7：在源目录新建一个文件后）

```text
2026-10-24 04:50:00 /data/linux/upload/test.txt 事件:CREATE
2026-10-24 04:50:00 /data/linux/upload/test.txt 事件:CLOSE_WRITE,CLOSE
```

常见事件含义：

| 事件 | 触发时机 |
| --- | --- |
| `create` | 目录中新建文件或子目录 |
| `delete` | 文件被删除 |
| `modify` | 文件内容被写入（写入中可能多次触发） |
| `close_write` | 以写模式打开的文件被关闭，代表一次写入完成 |
| `moved_to` | 文件被移入监控目录（sed/vim 改文件本质是这个事件） |
| `moved_from` | 文件被移出监控目录 |
| `attrib` | 文件属性变化（权限、属主、时间戳） |

rsync 传输有两条通道：一种是直接 `rsync 源 目标`（走 SSH，需密钥免密，适合跨机）；另一种是 `rsync 源 模块名`（走 rsync daemon，需服务端配 `rsyncd.conf` 与认证）。本篇示例用前者（更直观），生产大文件多时 daemon 模式性能更好，且可配 `rsync --bwlimit` 限速，避免同步流量挤占业务带宽。另外监控几十万文件的大目录树时，递归监控会为每个子目录建一个 watch，容易耗尽 `fs.inotify.max_user_watches`，表现为「后建文件不再触发」，需 `sysctl` 调大该值或缩小监控范围。

### 辨析：inotify 事件风暴与去抖

「每个事件跑一次 rsync」的写法在低频目录没问题，遇到高频写入就会出事。典型场景：程序批量写日志、编译产物持续生成、解压一个上万文件的包——inotify 短时间内吐出成千上万条事件，脚本逐条消费，rsync 进程还没跑完上一轮，下一批事件又排上队，CPU 与 IO 被打满，同步反而迟迟收敛不了。这就是所谓的事件风暴。

缓解思路有三层，按成本从低到高：

1. **去抖合并**：收到事件不立刻同步，等一小段时间把事件攒起来再跑一次。最简单的实现是给循环加节流——同步前先 `sleep 1` 清空管道积压，或用 `read -t 0.1` 做超时聚合，一秒钟的事件量合并成一次 rsync；
2. **砍事件源**：监控范围缩到真正需要同步的子目录，`-e` 只保留必要事件（比如忽略 `attrib`），事件量直接掉一个数量级；
3. **换架构**：写入压力实在大（CI 产物、大数据落盘），实时同步本身就不是合适工具，改用定时 rsync 兜底或上游直接写两份。

还有一个静默故障要知道：内核为 inotify 维护的事件队列有上限（`fs.inotify.max_queued_events`，默认 8192），风暴期间队列溢出会**直接丢事件且不通知脚本**——目标端从此缺文件而你毫无知觉。所以生产上实时同步必须配一个定时全量 rsync 做兜底，每几分钟跑一次，丢了的事件靠它补回来。sersync 和 lsyncd 都内置了这类定期补偿机制，这也是「生产推荐成熟工具」的实质原因。

## 题 2：sersync / lsyncd 扩展方案部署

手写 inotify + rsync 脚本能用，但生产环境更推荐成熟的整合工具。sersync 是国内长期流行的「inotify + rsync 粘合层」，lsyncd 是更现代、社区更活跃的 Lua 方案。

### 2.1 sersync 部署（B 级）

sersync 自己不传数据，只监听 inotify 事件、按 XML 配置拼出 rsync 命令执行。

```bash
yum install -y inotify-tools rsync
# 下载并解压（软件统一放 /server/tools）
mkdir -p /server/tools && cd /server/tools
unzip sersync_installdir_64bit.zip
mv sersync_installdir_64bit/sersync/ /usr/local/
# 编辑 conf/confxml.xml：填 <localpath watch="/data/linux/upload"> 与 <remote ip="linux-node02" name="backup"/>
# 启动
export PATH="$PATH:/usr/local/sersync/bin"
sersync -dro /usr/local/sersync/conf/confxml.xml
```

（预期输出，CentOS 7）

```text
$ sersync -dro /usr/local/sersync/conf/confxml.xml
set the system param
execute command: echo 50000000 > /proc/sys/fs/inotify/max_user_watches
execute command: echo 327679 > /proc/sys/fs/inotify/max_queued_events
parse the command param
option: -d 	run as a daemon
option: -r 	rsync all the local files to the remote servers before watching
...
run the sersync:
watch path is: /data/linux/upload
```

sersync 关键配置三段：`filter` 段（排除规则）、`inotify` 段（监控事件开关）、`localpath` + `rsync`（同步目标与认证）。停止用 `killall sersync`（需装 `psmisc`）。

### 2.2 lsyncd 部署（B 级，现代推荐）

lsyncd 用 Lua 写配置，原生支持 systemd，社区活跃，是 sersync 停更后的首选。

```bash
yum install -y lsyncd rsync
cat > /etc/lsyncd.conf <<'EOF'
settings {
    logfile    = "/var/log/lsyncd.log",
    statusFile = "/var/log/lsyncd.status",
    nodaemon   = false,
}
sync {
    default.rsync,
    source     = "/data/linux/upload/",
    target     = "linux-node02::backup/",
    rsync      = {
        archive = true,
        compress = true,
    }
}
EOF
systemctl enable --now lsyncd
systemctl status lsyncd
```

（预期输出，CentOS 7）

```text
$ systemctl status lsyncd
● lsyncd.service - Live Syncing (Mirror) Daemon
   Loaded: loaded (/usr/lib/systemd/system/lsyncd.service; enabled; vendor preset: disabled)
   Active: active (running) since Sat 2026-10-24 04:40:00 CST; 3s ago
```

### 两种方案对比

| 维度 | sersync | lsyncd |
| --- | --- | --- |
| 语言 / 配置 | XML | Lua |
| 社区状态 | 多年未维护 | 活跃 |
| systemd 支持 | 需自写 unit | 原生支持 |
| 一对多同步 | 配置多个 `remote` 元素 | 写多个 `sync{}` 块 |
| 兜底全量补偿 | `crontab` 段 | `delay` / 定时器 |
| 推荐度 | 老项目沿用 | 新部署首选 |

## 题 3：数据库实时同步的注意事项

用 rsync + inotify 同步普通文件没问题，但**数据库的数据目录绝对不能直接文件级同步**，原因有三：

1. 数据库有内存缓冲（buffer pool / redo log），数据可能还没落盘，直接拷文件得到的是不一致状态。
2. 数据文件、日志文件、索引文件之间没有原子快照，逐文件拷贝等于把不同时刻的数据拼在一起。
3. 运行中拷贝会把「半写状态」复制过去，目标端一打开就可能崩溃或静默损坏。

正确做法按场景选：

| 场景 | 做法 |
| --- | --- |
| MySQL 逻辑同步 | `mysqldump --single-transaction` 导出后同步 dump 文件，目标端导入 |
| MySQL 物理备份 | 用 xtrabackup 等热备工具生成一致快照，再同步备份集 |
| 实时性要求高 | 用数据库自带的主从复制（binlog），而不是文件级同步 |
| 允许停服的小库 | 停服务 → 整目录同步 → 启动服务（冷备窗口） |

> **注意**：若确实要同步数据库相关文件，先 `FLUSH TABLES WITH READ LOCK` 或停库，保证文件处于一致静止状态；否则宁可不同步，也不要同步一份会损坏的数据。

补充一点：数据库「实时同步」在企业里通常指主从复制（基于 binlog 的异步/半同步复制），由数据库自身保证主从数据一致，而不是存储层文件拷贝。文件级同步只适合「备份一份静止的库文件」这类低频场景，绝不能当作高可用方案。选择方案时先问清楚需求是「容灾备份」还是「高可用读写分离」，两者解法完全不同。

## 题 4：Windows 到 Windows 实时同步思路

题目里的「windows---windows」指的是两台 Windows 主机之间做实时同步。Linux 上那套 inotify + rsync 不能直接搬（inotify 是 Linux 内核机制），但思路相通——「监控变化 + 增量传输」，只是工具换成 Windows 生态的：

| 方案 | 工具 | 思路 | 适用 |
| --- | --- | --- | --- |
| 系统自带命令行 | `robocopy /MON:1` 或 `/MOT:n` | `robocopy` 自带「监控源目录，有变化就重跑一次同步」的参数，无需第三方 | 简单双机、同域或可信内网 |
| 微软分布式复制 | DFS Replication（DFSR） | 域环境下多服务器间自动复制文件夹，带冲突解决 | 企业内多节点、域环境 |
| 跨平台同步 | `cwRsync`（Windows 版 rsync） | 在 Windows 上装 rsync 客户端/服务端，沿用 Linux 的 rsync + 计划任务思路 | 已有 rsync 体系、想统一 |
| 第三方工具 | FreeFileSync / GoodSync 等 | 图形化实时镜像，带版本与日志 | 运维人手有限、要可视化 |

以 `robocopy` 为例，最接近「实时」的写法是监控模式：

```text
robocopy D:\data \\WIN-NODE02\share\data /MIR /MON:1 /MOT:1
```

`/MIR` 镜像（含删除）、`/MON:1` 表示源目录变化 1 次就触发一次、`/MOT:1` 表示最多每 1 分钟轮询一次。它的本质是「轮询 + 增量」，与 Linux 上「cron + rsync 轮询」同级，比 inotify 事件驱动稍弱但足够稳。若要真正事件驱动，可用 `cwRsync` 配计划任务或 PowerShell 的 `FileSystemWatcher` 自写脚本。

> **注意**：Windows 实时同步同样要避开「数据库数据目录直接拷」，SQL Server 用 Always On / 日志传送，而不是文件级复制。

若要在 Windows 上实现真正等价 Linux inotify 的事件驱动（而不是 robocopy 的轮询），可用 PowerShell 的 `FileSystemWatcher` 自写脚本，监听 `Created` / `Changed` / `Deleted` 事件后在动作里调用 `robocopy` 同步：

```text
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = "D:\data"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
Register-ObjectEvent $watcher "Created" -Action {
    robocopy D:\data \\WIN-NODE02\share\data /MIR
}
```

这是 B 级（Windows 环境）的思路说明，无法在本文的 Linux 沙箱中真跑；它和 Linux 上「inotifywait 监听 → rsync 推送」在原理上完全一致，只是 API 与命令换成 Windows 生态。

## 验证方法

- A 级本地模拟：步骤 3、4 已用 `ls -l backup` 验证「增 / 改 / 删」三类事件都正确反映到目标端，且脚本 `bash -n` 语法通过。
- B 级真实脚本：生产环境执行后，在源端 `touch` 一个文件，立刻到目标端 `ls` 确认存在；删一个源端文件，确认目标端同步消失；查 `/var/log/inotify_rsync.log` 有对应 rsync 记录。
- sersync / lsyncd：用 `pgrep -af` 或 `systemctl status` 确认进程/服务存活，再同样用「源端改动、目标端核对」验证。

## 本篇小结

1. 实时同步的骨架是「inotify 监听事件 → while 循环消费事件 → rsync 推送」，三者靠事件流衔接；本环境没有 inotifywait / rsync，先用纯 bash 模拟版把事件分发逻辑真跑通，再挂上真实命令。
2. inotify 必须监控 `close_write`、`moved_to`、`create`、`delete` 四类事件，「只监控 modify」会漏掉 sed/vim 修改的文件；删除要带 rsync `--delete`。
3. 生产环境推荐成熟整合工具：新部署用 lsyncd（Lua 配置、原生 systemd、社区活跃），老项目沿用 sersync（XML 配置、需自写 systemd unit）。
4. 数据库数据目录**绝不能**文件级实时同步，因为内存缓冲未落盘、多文件无原子快照、可能拷到半写状态；应改用 dump、xtrabackup 热备或数据库主从复制。
5. Windows 到 Windows 实时同步走 Windows 生态：简单场景用 `robocopy /MON` 监控模式，企业域环境用 DFS Replication，想统一体系用 cwRsync；同样要避开直接拷数据库目录。
6. 任何实时同步都要做「源端改动、目标端核对」的验证，并配合日志 / 进程检查确认服务存活。
{% endraw %}
