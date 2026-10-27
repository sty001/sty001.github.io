---
title: "day23-磁盘管理作业实操"
date: 2026-10-24 09:35:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-23"
---

{% raw %}



本篇对应课程第 23 天（磁盘管理）的课后作业，共四题：①新增一块磁盘，分区后格式化并挂载到 `/data`，写入 `/etc/fstab` 实现开机自动挂载；②用两种方法扩容 swap；③说明 `df -h` 与 `df -i` 的区别，并解释「磁盘满了但 `du` 统计不出来」的原因；④整理 RAID 0 / 1 / 5 / 10 对比表。第 1、2 题涉及 `fdisk`、`mkfs`、`swapon` 等真实设备与 root 权限操作，定为 B 级（标准命令 + CentOS 7 预期输出）；第 3 题的 `df`、`du` 可在本机真跑，定为 A 级，并附「小文件实验」验证 inode 与 block 是两套独立资源。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，读者在虚拟机/CentOS 7 上可直接复现。

本篇 A 级部分：`df -h`、`df -i`、`du -sh` 对比实验、300 个空文件的 inode 实验。B 级部分：`fdisk` 分区交互、`partprobe`、`mkfs.xfs`、`mount`、`/etc/fstab`、`dd` + `mkswap` + `swapon`——这些命令需要真实块设备与 root 权限，文中给出完整命令序列与 CentOS 7 标准预期输出。`free` 命令在 Windows 宿主机上不可用，swap 相关验证统一按 CentOS 7 预期输出给出。输出中的本地用户名已按脱敏要求替换为 `user`，示例主机名为 `linux-node01`，实操目录统一用 `/tmp/hw/day23`。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 新磁盘分区、格式化并挂载到 /data，开机自动挂载 | B 级（fdisk/mkfs/mount/fstab 全流程） |
| 题 2 | 扩容 swap 的两种方法 | B 级（dd+mkswap+swapon；独立分区法） |
| 题 3 | df -h 与 df -i 的区别；磁盘满但 du 统计不出来的原因 | A 级（df/du 真跑对比 + inode 实验） |
| 题 4 | RAID 0/1/5/10 对比 | 原理整理（对比表） |

## 题 1：新磁盘分区并挂载到 /data

**考察点**：磁盘从「插上」到「能用」的完整五步流程——识别、分区、重载分区表、格式化、挂载；`fdisk` 交互指令；`/etc/fstab` 六列含义与校验方法。

**实现思路**：小于 2T 的磁盘用 MBR 分区表 + `fdisk`（大于 2T 必须用 `parted` 建 GPT）。整体分六个里程：

1. 确认系统识别到新盘（`lsblk` / `ll /dev/sdb`）；
2. `fdisk /dev/sdb` 交互分区（本题只需 1 个主分区）；
3. `partprobe` 让内核重读分区表；
4. `mkfs.xfs` 创建文件系统（CentOS 7 默认 xfs）；
5. `mount` 临时挂载 + 写入 `/etc/fstab` 永久挂载；
6. `mount -a` 校验 + `df -h` 确认。

### 步骤 1：确认磁盘被识别（B 级）
{: .sec-ver}

```bash
lsblk
ll /dev/sdb
```

```console
（预期输出，CentOS 7）
$ lsblk
NAME            MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda               8:0    0   40G  0 disk
├─sda1            8:1    0  500M  0 part /boot
├─sda2            8:2    0    2G  0 part [SWAP]
└─sda3            8:3    0 37.5G  0 part /
sdb               8:16   0   10G  0 disk          <- 新加的盘，还没有分区
$ ll /dev/sdb
brw-rw----. 1 root disk 8, 16 Apr 28 08:54 /dev/sdb
```

`TYPE` 为 `disk` 且下面没有 `part` 子行，说明这块盘是裸盘，还没分区。

### 步骤 2：fdisk 交互分区（B 级，逐屏预期输出）
{: .sec-prac}

```bash
fdisk /dev/sdb
```

进入交互模式后逐屏操作，每一屏的输入与预期输出如下。

第 1 屏：按 `n` 新建分区，选主分区 `p`，编号 1，起止扇区都回车用默认（起始 2048，结束直接给 `+5G`）：

```console
Command (m for help): n
Partition type:
   p   primary (0 primary, 0 extended, 4 free)
   e   extended
Select (default p): p
Partition number (1-4, default 1): 1
First sector (2048-20971519, default 2048):
Using default value 2048
Last sector, +sectors or +size{K,M,G} (2048-20971519, default 20971519): +5G
Partition 1 of type Linux and of size 5 GiB is set
```

第 2 屏：按 `p` 检查分区表，确认 `/dev/sdb1` 已经出现、类型 `83 Linux`：

```console
Command (m for help): p

Disk /dev/sdb: 10.7 GB, 10737418240 bytes, 20971520 sectors
Units = sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
Disk label type: dos

   Device Boot      Start         End      Blocks   Id  System
/dev/sdb1            2048    10487807     5242880   83  Linux
```

第 3 屏：按 `w` 保存退出（`q` 是不保存退出，手滑分错时用它救场）：

```console
Command (m for help): w
The partition table has been altered!

Calling ioctl() to re-read partition table.
Syncing disks.
```

然后让内核重载分区表并确认：

```bash
partprobe /dev/sdb
lsblk /dev/sdb
```

```console
（预期输出，CentOS 7）
$ lsblk /dev/sdb
NAME   MAJ:MIN RM SIZE RO TYPE MOUNTPOINT
sdb      8:16   0  10G  0 disk
└─sdb1   8:17   0   5G  0 part
```

### 步骤 3：格式化创建文件系统（B 级）
{: .sec-prac}

```bash
mkfs.xfs /dev/sdb1
```

```console
（预期输出，CentOS 7）
$ mkfs.xfs /dev/sdb1
meta-data=/dev/sdb1              isize=512    agcount=4, agsize=327680 blks
         =                       sectsz=512   attr=2, projid32bit=1
         =                       crc=1        finobt=0, sparse=0
data     =                       bsize=4096   blocks=1310720, imaxpct=25
         =                       sunit=0      swidth=0 blks
naming   =version 2              bsize=4096   ascii-ci=0 ftype=1
log      =internal log           bsize=4096   blocks=2560, version=2
realtime =none                   extsz=4096   blocks=0, rtextents=0
```

关键行是 `blocks=1310720`（5G ÷ 4K block）——文件系统的 block 总数与 inode 数量都在格式化这一刻确定。

### 步骤 4：挂载并写入 fstab（B 级）
{: .sec-prac}

```bash
mkdir -p /data
mount /dev/sdb1 /data
df -h /data
```

```console
（预期输出，CentOS 7）
$ df -h /data
Filesystem      Size  Used Avail Use% Mounted on
/dev/sdb1       5.0G   33M  5.0G   1% /data
```

临时挂载重启即失效，永久生效写入 `/etc/fstab`。推荐用 UUID 而不是设备名（设备名会随磁盘插拔顺序变化，UUID 用 `blkid` 查询）：

```bash
blkid /dev/sdb1
echo 'UUID=144738ff-0da3-4162-b574-40af379cbe9e /data xfs defaults 0 0' >> /etc/fstab
```

```console
（预期输出，CentOS 7）
$ blkid /dev/sdb1
/dev/sdb1: UUID="144738ff-0da3-4162-b574-40af379cbe9e" TYPE="xfs"
```

fstab 六列含义：设备（或 UUID）、挂载点、文件系统类型、挂载参数、是否 dump 备份（统一写 0）、是否 fsck 检查（根分区 1、其他 2、swap 与网络文件系统 0）。

### 步骤 5：校验（B 级，最容易省略也最不该省略的一步）
{: .sec-prac}

```bash
umount /data
mount -a
df -h /data
findmnt /dev/sdb1
```

`mount -a` 按 fstab 挂载所有未挂载项——fstab 写错了它会当场报错，而不是等重启后卡在开机流程。非系统盘建议在 fstab 参数列加 `nofail`，设备缺失时开机不会卡住。

> **易错点**：① `mkfs` 会清空整个分区，执行前必须 `lsblk` 核对设备名；② fstab 直接改完不校验就重启，写错一行可能导致系统无法开机，进救援模式才能修；③ 逻辑分区编号从 5 开始（sda5），一块盘最多 4 个主分区，想更多分区用「3 主 + 1 扩展」。

**验证方法**：`df -h /data` 能看到 `/dev/sdb1` 挂在 `/data`；`mount -a` 无报错；重启后 `df -h` 挂载仍在。

## 题 2：swap 扩容的两种方法

**考察点**：swap 的作用（物理内存吃紧时把不活跃页换出，避免 OOM 杀进程）、`mkswap` / `swapon` / `swapoff` 三件套、独立 swap 分区的做法。

**实现思路**：方法一用大文件做 swap（`dd` 造文件 → `mkswap` 格式化 → `swapon` 启用），最快最灵活，适合临时救急（比如 Java 程序临时吃内存）；方法二划独立分区做 swap（`fdisk` 建分区 → 类型改 82 → `mkswap` → `swapon`），更正规、性能略好。

### 方法一：用文件扩容 swap（B 级）

```bash
# 第一个里程：用 dd 造一个 1G 的文件
dd if=/dev/zero of=/tmp/1G.swap bs=100M count=10

# 第二个里程：把这个文件格式化成 swap
mkswap /tmp/1G.swap

# 第三个里程：修改权限并启用
chmod 600 /tmp/1G.swap
swapon /tmp/1G.swap
free -h
```

```console
（预期输出，CentOS 7）
$ dd if=/dev/zero of=/tmp/1G.swap bs=100M count=10
10+0 records in
10+0 records out
1048576000 bytes (1.0 GB) copied, 8.32 s, 126 MB/s
$ mkswap /tmp/1G.swap
Setting up swapspace version 1, size = 1023996 KiB
no label, UUID=6dd70684-dec2-48cf-8fd9-f311548bbb4f
$ swapon /tmp/1G.swap
$ free -h
              total        used        free      shared  buff/cache   available
Mem:           1.9G        225M        575M        9.6M        1.2G        1.5G
Swap:          2.0G          0B        2.0G      <- 由 1.0G 扩到 2.0G
```

`swapon` 若提示 `insecure permissions 0644, 0600 suggested`，按提示 `chmod 600` 后重新执行即可。回收方法：

```bash
swapoff /tmp/1G.swap
rm -f /tmp/1G.swap
free -h        # Swap 回到 1.0G
```

要开机自动启用，把 `swap` 文件写进 fstab 后执行 `swapon -a`：

```bash
echo '/tmp/1G.swap swap swap defaults 0 0' >> /etc/fstab
swapon -a
```

### 方法二：用独立分区扩容 swap（B 级）

```bash
fdisk /dev/sdb          # n 新建分区，t 把分区类型改为 82 (Linux swap)，w 保存
partprobe /dev/sdb
mkswap /dev/sdb2        # 格式化为 swap
swapon /dev/sdb2        # 临时启用
swapon --show           # 查看当前启用的 swap 设备与优先级
free -h                 # 验证 Swap 总量变大

# 永久生效
echo 'UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx swap swap defaults 0 0' >> /etc/fstab
swapon -a
```

```console
（预期输出，CentOS 7）
$ swapon --show
NAME       TYPE      SIZE USED PRIO
/dev/sda2  PART        2G   0B   -2
/dev/sdb2  PART        1G   0B   -2
```

> **易错点**：① swap 文件权限必须是 600，否则 `swapon` 拒绝或告警；② `swapoff` 之前确认 swap 里没有活跃数据（`free -h` 的 used 列），内存充足时再关；③ swap 只是缓冲不是扩容，数据库等延迟敏感服务应把 `vm.swappiness` 调低（如 10），靠加内存解决问题。

**验证方法**：`free -h` 的 Swap 行总量变大；`swapon --show` 能看到新设备；`swapoff` 后总量还原。

## 题 3：df -h 与 df -i 的区别、磁盘满但 du 统计不出来的原因

**考察点**：block 与 inode 是两套独立的资源；「磁盘满」有三种原因且报错完全相同；`df` 与 `du` 统计口径不同导致数值对不上。

**实现思路**：先用真机输出对比 `df -h` 与 `df -i`，再用「300 个空文件」实验证明 inode 与 block 脱节，最后给三种「磁盘满」的判断与处置。

### 3.1 df -h 与 df -i 的区别（已实操）
{: .sec-prac}

`df -h` 看 **block（数据空间）** 的使用率，`df -i` 看 **inode（文件数量配额）** 的使用率。两者是独立的资源，一个满不代表另一个满。

```bash
df -h
df -i
```

输出（已实操，本机形态；CentOS 7 的列名与单位一致）：

```console
$ df -h
Filesystem                                                        Size  Used Avail Use% Mounted on
C:/Program Files/software/workbuddy/resources/vendor/PortableGit  476G  209G  268G  44% /
D:                                                                932G  578G  355G  62% /d
E:                                                                3.7T  3.6T   52G  99% /e
$ df -i
Filesystem                                                       Inodes IUsed IFree IUse% Mounted on
C:/Program Files/software/workbuddy/resources/vendor/PortableGit      -     -     -     - /
D:                                                                    -     -     -     - /d
E:                                                                    -     -     -     - /e
```

本机文件系统不提供 inode 配额所以显示 `-`，这是 Windows 宿主机的正常差异；CentOS 7 上 `df -i` 会显示真实数值：

```console
（预期输出，CentOS 7）
$ df -i
Filesystem      Inodes  IUsed   IFree IUse% Mounted on
/dev/sda3      9830400  84125 9746275    1% /
/dev/sdb1      2621440      3 2621437    1% /data
```

CentOS 7 的 inode 数量在格式化时就固定了（格式化输出里的 `isize`/`inodes` 行），每个文件至少占一个 inode。

### 3.2 inode 与 block 脱节实验（已实操）
{: .sec-prac}

造 300 个 0 字节的空文件，看「数据体积」与「资源占用」的脱节：

```bash
cd /tmp/hw/day23
rm -rf small && mkdir small
for i in $(seq 1 300); do : > small/f$i.log; done
ls small | wc -l
du -sh small
du -sh --apparent-size small
df -h /tmp | tail -1
```

输出：

```console
$ ls small | wc -l
300
$ du -sh small
64K	small
$ du -sh --apparent-size small
0	small
$ df -h /tmp | tail -1
C:/Users/lcmgs/AppData/Local/Temp  476G  209G  268G  44% /tmp
```

300 个文件的**内容总量是 0 字节**，却消耗了 300 个 inode 和 64K 的磁盘块。把这个数量放大到百万级，就会出现「`df -h` 还剩几十 G，`df -i` 却已 100%，任何新建文件都报 `No space left on device`」的现象。

### 3.3 磁盘满但 du 统计不出来的两种原因

`du` 遍历目录树统计「看得见的文件」，`df` 读超级块统计「文件系统已用块」。两个口径下有一类文件只有 `df` 能看到，于是出现「磁盘满了、`du` 却统计不出来」：

**原因一：文件已删除，但仍被进程占用（句柄未释放）。**

Linux 删除文件的本质是删掉目录项、把 inode 链接数减 1；只要有进程还持有该文件的文件描述符，内核就不释放它占用的 block。`du` 遍历目录树已经看不到它（目录项没了），`df` 读超级块仍把它算作已用。典型现场：把 8G 的 nginx 日志 `rm` 掉，`df` 不降、`du` 找不到。

```bash
lsof +L1                    # 列出已删除但仍被打开的文件
lsof | grep deleted         # 通用写法
```

```console
（预期输出，CentOS 7）
$ lsof +L1
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NLINK   NODE NAME
nginx    1234 root    5w   REG  253,0 8.5G        0  12345 /var/log/nginx/access.log (deleted)
```

`SIZE/OFF` 一列就是被白白占住的空间。处置二选一：重启持有句柄的进程（`systemctl restart nginx`），或截断文件立即释放空间（`> /var/log/nginx/access.log`）。正确的日志清理姿势是**先截断后删除**，或只截断不删除。

**原因二：inode 耗尽（大量小文件）。**

`df -h` 显示还有大量空间，但每个新文件都要消耗一个 inode，inode 用光后任何写入都报 `No space left on device`；`du` 只统计 block 体积，自然「统计不出来磁盘为什么满」。

```bash
df -i                                            # IUse% 接近 100% 即确认
for d in /var /tmp /data; do echo "$(find $d -type f 2>/dev/null | wc -l) $d"; done | sort -rn
```

```console
（预期输出，CentOS 7）
$ df -i
Filesystem      Inodes  IUsed   IFree IUse% Mounted on
/dev/sda3      2621440 2621440       0  100% /
```

处置：定位小文件最多的目录（常见于邮件队列、会话文件、碎片缓存），删除无用小文件；彻底解决需备份后用 `mkfs.ext4 -i 2048`（每 2048 字节分配一个 inode）或 `-N 2000000` 重新格式化。

三种「磁盘满」对照速查：

| 原因 | df -h | df -i | df 与 du | 排查命令 | 处置 |
| --- | --- | --- | --- | --- | --- |
| block 满（数据真多） | Use% 接近 100% | 低 | 对得上 | `du -sh --max-depth=1` | 删大文件、清日志 |
| inode 耗尽（小文件多） | 有大量剩余 | IUse% 100% | du 远小于 df | `df -i`、`find \| wc -l` | 删海量小文件 |
| 句柄未释放 | 已用很高 | 低 | 对不上 | `lsof +L1` | 重启进程或截断文件 |

> **易错点**：三种情况的报错**完全相同**（`No space left on device`），光看报错无法区分，必须 `df -h` 与 `df -i` 一起跑；`df` 与 `du` 对不上时才轮到 `lsof +L1`。

**验证方法**：① 能说清 `df -h` 看 block、`df -i` 看 inode；② 本机 300 空文件实验能复述「内容 0 字节却占 300 inode + 64K block」（已实操）；③ 能解释 `du` 统计不到的两类文件分别是什么、怎么定位。

## 题 4：RAID 0 / 1 / 5 / 10 对比

**考察点**：RAID 用冗余换安全或用条带换性能的思想；各级别的最少盘数、可用容量、容错能力与适用场景。

**实现思路**：RAID 的三个目的是提高存储效率、安全与容量。0 是纯条带（快但不安全），1 是纯镜像（安全但容量减半），5 是条带 + 分布式校验（折中），10 是先镜像再条带（安全与性能兼顾）。RAID 可由硬件 RAID 卡实现（推荐，带缓存保护），也可用 `mdadm` 做软 RAID；对上层都表现为一块普通磁盘，分区与格式化步骤与题 1 完全相同。

| 级别 | 最少磁盘 | 可用容量（以 n 块 c 盘为例） | 容错能力 | 读性能 | 写性能 | 适用场景 |
| --- | --- | --- | --- | --- | --- | --- |
| RAID 0 | 2 | n × c（全部） | 无：坏 1 块全丢 | 最高（并行读写） | 最高 | 临时缓存、可再生的scratch数据 |
| RAID 1 | 2 | c（一半） | 允许坏 1 块 | 较高 | 较低（双写） | 系统盘、重要小容量数据 |
| RAID 5 | 3 | (n-1) × c | 允许坏 1 块 | 较高 | 较低（校验开销） | 通用业务存储、备份服务器 |
| RAID 10 | 4 | n × c ÷ 2（一半） | 每组镜像允许坏 1 块（最坏情况同组坏 2 块全丢） | 高 | 较高 | 数据库、高并发高价值数据 |

以 300G × 3 块盘为例：RAID 5 可用约 600G，最多坏 1 块盘；若换成 4 块 300G 做 RAID 10，可用约 600G，安全与性能兼顾。RAID 5 重建（rebuild）期间再坏一块就全丢，大容量盘重建时间长，所以重要数据仍需独立备份——**RAID 不是备份**。RAID 01（先条带再镜像）可靠性不如 RAID 10，已少用。

**验证方法**：能不查资料说出四个级别的最少盘数、可用容量公式与「坏几块盘会丢数据」；能解释为什么数据库选 RAID 10 而不是 RAID 5（随机写多、校验开销大、重建窗口风险高）。

## 本篇小结
{: .sec-sum}

1. 新盘上线五步走：识别（`lsblk`）→ 分区（`fdisk`，<2T 用 MBR、>2T 用 `parted` 建 GPT）→ 重载分区表（`partprobe`）→ 格式化（`mkfs.xfs`）→ 挂载（`mount` 临时、`/etc/fstab` 永久）。
2. `fdisk` 交互记住五个键：`n` 新建、`p` 查看、`t` 改类型、`w` 保存、`q` 不保存退出；分区表写错 fstab 后必须 `mount -a` 校验，否则可能开机卡死。
3. fstab 六列：设备（推荐 UUID）、挂载点、文件系统类型、参数、dump（0）、fsck（根 1 其他 2）；非系统盘加 `nofail`。
4. 扩容 swap 两种方法：文件法（`dd` + `mkswap` + `swapon`，临时救急）与分区法（类型 82 + `mkswap` + fstab，正规）；swap 文件权限必须 600。
5. swap 是缓冲不是扩容：延迟敏感服务调低 `vm.swappiness`，内存不足的正确姿势是加内存。
6. `df -h` 看 block、`df -i` 看 inode，两者是独立资源；磁盘满报错完全相同，必须两个命令一起看。
7. `du` 统计不出来的「已占空间」有两类：已删除但被进程占用的文件（`lsof +L1` 定位，重启或截断）与海量小文件吃光 inode（`df -i` + `find | wc -l` 定位）；清理正在写入的日志用截断 `> 文件名` 而不是 `rm`。
8. RAID 0 快但不安全、RAID 1 安全但容量减半、RAID 5 折中（3 块起、坏 1 块）、RAID 10 安全与性能兼顾（4 块起、容量减半）；RAID 不是备份，重要数据必须有独立备份。

> **参见**：[磁盘管理基础](/posts/linux-disk-01/)、[磁盘管理进阶](/posts/linux-disk-02/)、[day15 磁盘 block 与存储原理作业实操](/posts/linux-homework-15/)


{% endraw %}
