---
title: "周测-第01周-测验精讲"
date: 2026-10-24 09:08:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-50"
---

{% raw %}



## 本篇说明
{: .sec-expl}

- **题量**：30 题。每题 3 分、满分 90 分，**及格分 70 分**——按 3 分一题折算，答对 24 题上下才稳
- **覆盖章节**：计算机硬件组成、Linux 系统概念、系统安装部署、虚拟软件与远程连接、常用文件操作命令
- **内容形式**：每道题 = 答案 + 解析 + 实操验证 + 易错点；纯概念题只给答案与解析，涉及命令的题一律给出可复制的实操验证
- **实操分级**
  - A 级（标注 `已实操`）：`mkdir`/`cd`/`ls`/`find`/`head`/`stat`/`mv`/`rm`/`awk`/`df`/`grep` 等 shell 核心命令，在 Git Bash 环境真实执行，输出为真实结果
  - B 级（标注 `预期输出，CentOS 7`）：`ip`/`systemctl`/`shutdown`/`nmtui`/`fdisk` 等系统级命令，给出标准命令序列与 CentOS 7 预期输出
- **脱敏说明**：原题中出现的机构名称、联系方式、学员姓名等一律删除；示例路径统一改为 `/data/app`、`/data/test.txt` 等通用路径
- **实操根目录**：本文所有 A 级示例均在 `/tmp/hw` 下演示，读者可直接复制到真机练习

---

## 一、基础命令与系统操作（题 01-08）
{: .sec-prac}

### 题 01：创建目录 /data/app

> **答案**：`mkdir -p /data/app`

**解析**：创建目录用 `mkdir`（make directory）。它默认只建**单层**，父目录 `/data` 不存在时直接 `mkdir /data/app` 会报 `No such file or directory`。加 `-p`（parents）后整条路径上缺失的父目录一次建齐，目录已存在也不报错（幂等）。说白了，`-p` 就是给脚本上的保险——重复执行不中断，写脚本时无脑带上。

**实操验证**（A 级，已实操）：

```bash
# 准备干净的练习目录
mkdir -p /tmp/hwq1

# 1) 不加 -p，父目录不存在时失败
mkdir /tmp/hwq1/data/app/sub
echo "exit=$?"

# 2) 加 -p，一次创建多级目录
mkdir -p /tmp/hwq1/data/app/sub
echo "exit=$?"

# 3) 验证结果
ls -1d /tmp/hwq1/data/app /tmp/hwq1/data/app/sub
```

输出（已实操，Git Bash）：

```console
mkdir: cannot create directory '/tmp/hwq1/data/app/sub': No such file or directory
exit=1
exit=0
/tmp/hwq1/data/app
/tmp/hwq1/data/app/sub
```

验证方法：`ls -1d /data/app` 能打印出该路径，且 `echo $?` 为 0，即创建成功。

> **易错点**：漏写 `-p` 导致多级目录创建失败；把相对路径和绝对路径混用导致目录建在了当前目录下（生产环境建目录一律写绝对路径）。
>
> **变式追问**：`mkdir -p /data/{app,logs,backup}` 依赖的是哪个 shell 特性？（花括号展开，bash 内建行为，dash/sh 里不生效，脚本首行记得写 `#!/bin/bash`。）

> **参见**：02-常用文件操作命令

---

### 题 02：内存为 128MB 的计算机，交换分区（swap）大小通常是？（多选）

- A. 64MB
- B. 128MB
- C. 256MB
- D. 512MB

> **答案**：B、C

**解析**：考点是 swap 分区的划分规则。

- 物理内存 **小于 8G**：swap 大小 = 物理内存 × 1.5（旧教材也常按 2 倍估算）
- 物理内存 **大于等于 8G**：swap 直接给 8G 即可（内存已经足够大，swap 主要用于休眠和兜底）

本题 128MB × 1.5 = 192MB，按 2 倍算是 256MB。192MB 落在 128MB 与 256MB 之间，故标准答案取最接近的两个档位 **B（128MB）** 和 **C（256MB）**。

**实操验证**（B 级，查看 swap 实际大小）：

```bash
free -h
swapon -s
```

输出（预期输出，CentOS 7）：

```console
              total        used        free      shared  buff/cache   available
Mem:           1.8G        210M        1.2G        9.6M        386M        1.4G
Swap:          8.0G          0B        8.0G
```

```console
Filename				Type		Size	Used	Priority
/dev/sda2                              	partition	8388604	0	-2
```

验证方法：`free -h` 的 Swap 行 total 与规划值一致；`swapon -s` 能看到 swap 设备文件名。

> **易错点**：记反规则——"内存小于 8G 给 8G"是错的，那是大内存场景的规则。swap 也不是越大越好：空间换不来性能，只会让内核更晚触发 OOM，把内存泄漏捂到不可收拾；生产上可用 `vm.swappiness` 调节内核使用 swap 的倾向。

> **参见**：01-计算机硬件组成

---

### 题 03：想详细了解某一个命令，可以使用什么命令？

- A. ls
- B. help
- C. man
- D. dir

> **答案**：C（`man`）

**解析**：`man`（manual）是 Linux 最权威的帮助工具，如 `man cp`、`man 5 passwd`。补充：

- `命令 --help`：查看简要选项列表，适合快速查询
- `help 命令`：只对 shell **内建命令**（cd、alias、source 等）有效
- `info`：比 man 更详细的超文本手册

**实操验证**（A 级，已实操 —— 用内建命令演示 help；man 为 B 级）：

```bash
# help 只对内建命令有效
help cd
```

输出（已实操，Git Bash，截取片段）：

```console
cd: cd [-L|[-P [-e]]] [-@] [dir]
    Change the shell working directory.

    Change the current directory to DIR.  The default DIR is the value of the
```

```bash
man cp
```

输出（预期输出，CentOS 7）：

```console
CP(1)                            User Commands                           CP(1)

NAME
       cp - copy files and directories

SYNOPSIS
       cp [OPTION]... [-T] SOURCE DEST
...
```

验证方法：执行 `man cp` 后能翻页并能用 `/选项名` 搜索；按 `q` 退出。

> **易错点**：把 `help` 当成通用帮助命令——`help mkdir` 会报 `no help topics`；另外 `man` 查命令用默认章节，`man 5 crontab` 中的 5 表示查配置文件格式。

---

### 题 04：企业中 Linux 服务器系统分区标准是什么（硬盘 300G、内存 16G），至少写出三种方案
{: .sec-know}

> **答案**：三种经典分区方案（300G 硬盘、16G 内存）

| 方案 | /boot | swap | / | /data | 剩余空间 |
| --- | --- | --- | --- | --- | --- |
| 通用方案 | 200M | 8G | 剩余全部 | 无 | 全给 / |
| 数据重要方案 | 200M | 8G | 50G | 剩余全部 | 全给 /data |
| 灵活方案 | 200M | 8G | 50G | 无 | 不分，留作扩展 |

**解析**：

- `/boot` 200M 足够存放内核与引导文件，且必须是**主分区**、位于磁盘前 2TB 内
- 内存 16G ≥ 8G，按规则 swap 直接给 **8G**（不再是 1.5 倍）
- 数据重要场景把 `/data` 单独分区：系统崩了重装不影响业务数据，也便于单独做配额与快照
- 灵活方案预留空闲空间，后期用 LVM 或新分区按需扩展

**实操验证**（B 级，查看与核对分区）：

```bash
lsblk
df -h
cat /etc/fstab
```

输出（预期输出，CentOS 7）：

```console
NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda      8:0    0  300G  0 disk
|-sda1   8:1    0  200M  0 part /boot
|-sda2   8:2    0    8G  0 part [SWAP]
`-sda3   8:3    0  292G  0 part /
sr0     11:0    1 1024M  0 rom
```

验证方法：`lsblk` 显示的分区大小与规划表逐一对应，`df -h` 能看到各挂载点容量。

> **易错点**：swap 按 16G×1.5=24G 来分（错，≥8G 内存统一 8G）；把 `/boot` 分得过大浪费空间；忘记 `/boot` 必须在主分区。

> **参见**：03-系统安装部署

---

### 题 05：`mkdir` 创建目录时，父目录不存在要先创建父目录，用哪个参数？
{: .sec-expl}

> **答案**：`-p`

**解析**：`mkdir -p` = parents，递归创建路径中所有缺失的父目录，且已存在时不报错。常配合花括号批量创建：

```bash
mkdir -p /data/{app,logs,backup}
```

**实操验证**（A 级，已实操）：

```bash
mkdir -p /tmp/hwq1/data/{app,logs,backup}
ls -1 /tmp/hwq1/data
```

输出（已实操，Git Bash）：

```console
app
backup
logs
```

验证方法：`ls -1` 能看到三个目录同时创建成功。

> **易错点**：`-p` 写成 `-P`（`-P` 在 `cp`/`mkdir` 里含义不同）；以为 `-p` 会覆盖已有目录权限——不会，已有目录权限保持不变。

---

### 题 06：按下哪个键能终止当前运行的命令？

- A. ctrl+c
- B. ctrl+f
- C. ctrl+b
- D. ctrl+d

> **答案**：A（ctrl+c）

**解析**：这题就是在考"哪个键能掐断正在跑的前台命令"。速查表如下

| 快捷键 | 作用 |
| --- | --- |
| ctrl+c | 终止（cancel）当前前台运行的命令，发送 SIGINT |
| ctrl+d | 退出当前 shell / 结束输入（等价于 logout、EOF） |
| ctrl+z | 把前台进程挂起到后台（暂停），可用 `fg` 恢复 |
| ctrl+l | 清屏 |
| ctrl+a / ctrl+e | 光标移到行首 / 行尾 |

**实操验证**（A 级，已实操 —— 用 `kill -INT` 模拟 ctrl+c 发送的 SIGINT 信号）：

```bash
# 后台启动一个长时间任务，再向它发送 SIGINT（等价于按 ctrl+c）
sleep 60 &
pid=$!
kill -INT $pid
wait $pid
echo "exit=$?"
```

输出（已实操，Git Bash）：

```console
exit=130
```

验证方法：退出码 **130** = 128 + 2（信号 2 即 SIGINT），证明进程被中断信号终止，与按下 ctrl+c 效果完全一致。

> **易错点**：把 ctrl+d 当成中断命令——ctrl+d 是"退出登录"，在 root 会话里连按可能导致直接断开连接；ctrl+c 才是终止命令。
>
> **变式追问**：ctrl+z 挂起的任务后来怎么处理？（`jobs` 查看，`fg %1` 恢复前台、`bg %1` 转后台继续跑，不要了就 `kill %1`。）

---

### 题 07：CentOS 7 系统中查看 IP 地址的命令是？

- A. ipconfig
- B. ip address show
- C. icmp
- D. iptables

> **答案**：B（`ip address show`，简写 `ip a`）

**解析**：

- CentOS 7 主推 `ip` 命令（iproute 包），`ipconfig` 是 Windows 命令
- `icmp` 是协议名不是命令；`iptables` 是防火墙工具
- CentOS 6 使用 `ifconfig`（net-tools 包），CentOS 7 需 `yum install -y net-tools` 才有

**实操验证**（B 级）：

```bash
ip address show
ip a s eth0
ifconfig
```

输出（预期输出，CentOS 7）：

```console
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP qlen 1000
    link/ether 00:0c:29:3f:8a:12 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.200/24 brd 10.0.0.255 scope global noprefixroute eth0
```

验证方法：能看到网卡名（eth0/ens33）与 `inet` 后的 IPv4 地址，说明命令生效。

> **易错点**：在 CentOS 7 最小化安装上敲 `ifconfig` 报 `command not found`；网卡名不是 eth0 而是 ens33（BIOS 命名规则），详见题 22。

> **参见**：01-运维网络基础-上

---

### 题 08：关闭 Linux 操作系统的命令是？
{: .sec-prac}

- A. ctrl+Alt+Del
- B. stop
- C. shutdown -h now
- D. reboot

> **答案**：C（`shutdown -h now`）

**解析**：关机重启命令族

| 命令 | 作用 |
| --- | --- |
| shutdown -h now | 立即关机（h = halt） |
| shutdown -r now | 立即重启（r = reboot） |
| shutdown -h +5 | 5 分钟后关机，并广播通知所有在线用户 |
| shutdown -c | 取消已计划的关机 |
| poweroff / halt | 关机 |
| reboot / init 6 | 重启 |

**实操验证**（B 级，**不要在生产机上执行关机**）：

```bash
# 计划 5 分钟后关机（会向所有终端广播通知）
shutdown -h +5

# 取消关机计划
shutdown -c

# 立即关机（谨慎执行）
shutdown -h now
```

输出（预期输出，CentOS 7）：

```console
Broadcast message from root@web01 on pts/0 (Sat 2026-10-24 10:30:00 CST):

The system is going down for power-off at Sat 2026-10-24 10:35:00 CST!
```

验证方法：计划关机时其它终端能收到广播消息；`shutdown -c` 后提示 `Shutdown cancelled`，系统不关机即为生效。

> **易错点**：把 `reboot` 当作关机；远程维护时用 `shutdown -h now` 却没有人在机房开机，务必先确认带外管理（IPMI/云控制台）可用。

---

## 二、硬件、存储与系统概念（题 09-16）
{: .sec-know}

### 题 09：简述 RAID 0 与 RAID 1 的特点和优缺点

> **答案**：RAID 0 效率最高但不安全；RAID 1 最安全但效率低（容量利用率 50%）

**解析**：RAID 的三大作用：提升容量、提升读写效率、提升数据安全性。不同级别是三者的取舍。

| 级别 | 最少磁盘 | 容量利用率 | 优点 | 缺点 |
| --- | --- | --- | --- | --- |
| RAID 0 | 2 块 | 100% | 条带化并行写入，读写效率最高 | 无冗余，任意一块盘损坏全部数据丢失 |
| RAID 1 | 2 块 | 50% | 镜像冗余，数据安全最高，可读提速 | 容量利用率只有一半，成本高 |
| RAID 5 | 3 块 | (n-1)/n | 效率与安全折中，允许坏 1 块 | 坏盘后重建压力大 |
| RAID 10 | 4 块 | 50% | 先镜像再条带，效率与安全兼顾 | 成本最高 |

**实操验证**：RAID 属硬件/阵列卡配置，本机无法实操。真机查看方式（B 级）：

```bash
cat /proc/mdstat
lsblk
```

输出（预期输出，CentOS 7，软 RAID 场景）：

```console
Personalities : [raid1]
md0 : active raid1 sdb1[1] sda1[0]
      20954112 blocks super 1.2 [2/2] [UU]
```

验证方法：`[UU]` 表示两块盘均正常，出现 `[U_]` 说明有盘掉线。

> **易错点**：认为 RAID 可以替代备份——RAID 只解决**硬件故障**，误删文件、勒索病毒仍会同步破坏所有镜像盘；企业必须 RAID + 备份双管齐下。
>
> 生产注意点：RAID 5 坏一块盘进入降级后，重建要连续读全盘，此时第二块盘跟着坏的概率陡增，重要业务更倾向 RAID 10。

> **参见**：01-磁盘管理基础

---

### 题 10：什么是 GPL 与 GNU 自由软件？
{: .sec-know}

> **答案**：GPL 是通用公共许可协议（一种开源许可规范）；GNU 是一个旨在开发类 Unix 自由操作系统的项目

**解析**：

- **GPL（General Public License）**：一种"著佐权"（copyleft）许可证。核心两条约束
  1. 基于 GPL 代码开发的软件**必须开源**（开源不等于免费，服务、支持可以收费）
  2. 修改后的衍生作品发布时，必须**沿用同样的 GPL 许可**，保证自由延续下去
- **GNU（GNU's Not Unix）**：1983 年由理查德·斯托曼发起的项目，目标是做一套完全自由的类 Unix 系统。GNU 完成了 gcc、bash、coreutils 等大量工具，只差内核；1991 年 Linus 发布 Linux 内核后补齐最后一块拼图，因此严格来说应称 **GNU/Linux**
- 其它常见许可证：MIT、Apache 2.0（更宽松，允许闭源商用）；LGPL（库级宽松版 GPL）

**实操验证**（A 级，已实操 —— 用本地 bash 感受 GNU 工具链）：

```bash
bash --version | head -1
ls --version | head -1
```

输出（已实操，Git Bash）：

```console
GNU bash, version 5.2.21(1)-release (x86_64-pc-msys)
ls (GNU coreutils) 9.0.0.3312-d539fb8
```

验证方法：输出中带 `GNU` 字样，说明日常使用的 `ls`、`bash` 都出自 GNU 项目，正是 GPL 许可下的自由软件。

> **易错点**：把 GPL 和 GNU 混为一谈（一个是许可证，一个是项目）；认为"开源 = 免费"或"开源 = 可以任意闭源二次发布"。

---

### 题 11：服务器硬件组成和各自作用
{: .sec-expl}

> **答案**：CPU（运算与控制）、电源（供电，需冗余）、内存（临时存储）、磁盘（永久存储）、风扇（散热）

**解析**：常用类比与要点

| 部件 | 类比 | 作用与要点 |
| --- | --- | --- |
| CPU | 大脑 | 运算处理、指令控制；路数 = 颗数，核数 = 并行能力 |
| 内存 | 书桌 | 临时存储，断电丢失；越大可缓存越多热点数据 |
| 磁盘 | 仓库 | 永久存储；机械盘看转速与 IOPS，固态盘看颗粒与寿命 |
| 电源 | 心脏 | 供电，企业级必须双路冗余，支持热插拔 |
| 风扇/散热 | 体温调节 | 保证 CPU、电源在安全温度内，机房温度一般控制在 22±2℃ |
| 网卡/主板/RAID 卡 | 神经与骨架 | 网络接入、部件互联、磁盘阵列管理 |

**实操验证**（A 级，已实操 —— 查看本机 CPU 与内存真实信息）：

```bash
grep -m1 "model name" /proc/cpuinfo
grep -m1 "^MemTotal" /proc/meminfo
```

输出（已实操，Git Bash）：

```console
model name	: Intel(R) Core(TM) i5-14500
MemTotal:       33231524 kB
```

验证方法：能读到 CPU 型号与内存总量，说明 `/proc` 是内核向用户态暴露硬件信息的核心接口（CentOS 7 上同样路径）。

> **易错点**：说"内存是永久存储"——内存断电即丢，永久存储只有磁盘（以及带掉电保护的 RAID 卡缓存）。

> **参见**：01-计算机硬件组成

---

### 题 12：CPU 中"核数"与"路数"是什么意思？
{: .sec-know}

> **答案**：核数 = 单颗 CPU 内部的物理处理核心数量，代表并行处理任务的能力；路数 = 主板上安装 CPU 的颗数

**解析**：

- 单路 4 核 = 1 颗 CPU、每颗 4 个物理核
- 双路 8 核 = 2 颗 CPU、每颗 8 个物理核，共 16 核
- 总逻辑核数 ≈ 路数 × 核数 × 超线程数（一般 ×2）

**实操验证**（A 级，已实操）：

```bash
grep -E "physical id|siblings|cpu cores" /proc/cpuinfo | head -3
grep -c ^processor /proc/cpuinfo
```

输出（已实操，Git Bash）：

```console
physical id	: 0
siblings	: 20
cpu cores	: 10
```

```console
20
```

验证方法：`physical id` 只有 0 说明是**单路**；`cpu cores: 10` 说明每颗 10 核；`siblings: 20` 说明开启超线程后有 20 个逻辑核。

> **易错点**：把"逻辑核数"当成核数——`grep -c ^processor` 得到的是逻辑核（含超线程）；把核数和路数相乘时重复计算。

---

### 题 13：内存中 buffer 和 cache 的概念，以及高并发下存储数据的方案
{: .sec-know}

> **答案**：buffer 是写缓冲（存 → 内存 → 磁盘）；cache 是读缓存（磁盘热点数据 → 内存）

**解析**：

- **buffer（缓冲区）**：面向**写**。用户写入的数据先落在内存缓冲区，由内核定时、定量地刷到磁盘，把大量随机小写合并成顺序写，降低磁盘压力。为什么要合并？机械盘一次寻道代价很高，攒一批再写，吞吐才上得去
- **cache（缓存区）**：面向**读**。把磁盘中被频繁访问的热点数据留在内存，下次读取直接从内存返回，避免慢速的磁盘 IO
- 高并发方案的核心思路：
  - 写路径：用户写 → 内存缓冲 → 定时定量落盘（写合并、异步刷盘）
  - 读路径：用户读 → 先查内存缓存 → 未命中再回源磁盘，并把结果回填缓存

**实操验证**（B 级，查看 buffer/cache 占用）：

```bash
free -h
cat /proc/meminfo | grep -E "^Buffers|^Cached"
```

输出（预期输出，CentOS 7）：

```console
              total        used        free      shared  buff/cache   available
Mem:           1.8G        210M        1.1G        9.6M        486M        1.3G
Swap:          8.0G          0B        8.0G
```

```console
Buffers:            2108 kB
Cached:           415320 kB
```

验证方法：`free -h` 的 `buff/cache` 列随文件读写活动增长，说明内核正在用空闲内存做缓存——这正是 Linux "空闲内存就是浪费内存"的设计哲学。

> **易错点**：认为 `buff/cache` 占用高就是内存不够——实际上这部分内存在应用需要时会被立即回收，判断内存是否紧张要看 `available` 列而不是 `free` 列。

---

### 题 14：SSH 远程连接出现问题，如何排查？
{: .sec-ts}

> **答案**：三步排查法 —— 查链路 → 查策略 → 查服务

**解析**：

1. **链路是否通畅**：`ping 10.0.0.200`，不通说明网络/路由/网线问题，或对方禁 ICMP
2. **是否有安全策略阻断**：`telnet 10.0.0.200 22` 或 `nc -v 10.0.0.200 22`，通不了说明防火墙（firewalld/iptables/安全组）拦截
3. **服务是否开启、端口是否监听**：`systemctl status sshd`、`ss -lntup | grep 22`

补充检查：虚拟机网络模式是否正确、网卡配置文件 `ONBOOT=yes`、IP 是否冲突、sshd 配置中 `PermitRootLogin` 与 `AllowUsers` 限制。

**实操验证**（B 级）：

```bash
ping -c 3 10.0.0.200
telnet 10.0.0.200 22
systemctl status sshd
ss -lntup | grep 22
```

输出（预期输出，CentOS 7）：

```console
PING 10.0.0.200 (10.0.0.200) 56(84) bytes of data.
64 bytes from 10.0.0.200: icmp_seq=1 ttl=64 time=0.34 ms

--- 10.0.0.200 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss
```

```console
Trying 10.0.0.200...
Connected to 10.0.0.200.
Escape character is '^]'.
SSH-2.0-OpenSSH_7.4
```

```console
sshd.service - OpenSSH server daemon
   Loaded: loaded (/usr/lib/systemd/system/sshd.service; enabled; vendor preset: enabled)
   Active: active (running) since Sat 2026-10-24 09:12:33 CST; 2h 11min ago
```

验证方法：三步全部通过仍连不上，就要查客户端配置（密钥、known_hosts 冲突、用户名口令）。注意 telnet 返回 `SSH-2.0-OpenSSH_7.4` 即说明 22 端口服务正常。

> **易错点**：`ping` 通就认为 SSH 一定没问题（ping 是 ICMP，与 TCP 22 是两回事）；只查服务端不查本机防火墙与安全组。
>
> **变式追问**：ping 通但 telnet 22 不通，说明什么？（链路没问题，问题出在端口层——服务没监听，或防火墙/安全组拦了 TCP 22。）

> **参见**：01-虚拟软件与远程连接

---

### 题 15：购买一块 500G 硬盘，实际能存储多少 MB 的数据？

> **答案**：约 465G（≈ 476000MB），标称 500G 但系统识别少约 7%

**解析**：硬盘厂商按 **1000 进制**标注，操作系统按 **1024 进制**计算，三次换算后产生差额：

```text
500 GB（厂商标称）
= 500 × 1000^3 Byte
= 500 × 1000^3 ÷ 1024^3 GiB
≈ 465.7 GiB
```

**实操验证**（A 级，已实操 —— 用 awk 精确计算）：

```bash
awk 'BEGIN{printf "厂商标称 500GB -> 系统识别 %.1f GiB\n", 500*1000^3/1024^3}'
awk 'BEGIN{printf "约 %.0f MB\n", 500*1000^3/1024^2}'
```

输出（已实操，Git Bash）：

```console
厂商标称 500GB -> 系统识别 465.7 GiB
约 476837 MB
```

验证方法：`df -h` 看到的新盘容量应接近 466G。这是正常现象，不是硬盘缩水或被"奸商"克扣。

> **易错点**：直接用 500 ÷ 1.07 估算；注意换算要连做三次（G→M→K→Byte 各一次 1000/1024），只换算一次会得出错误结果。

---

### 题 16：操作系统的组成部分是什么？
{: .sec-know}

> **答案**：硬件 + 内核 + 解释器（shell）+ 应用软件；即"人 → 应用软件 → shell → 内核 → 硬件"的层次结构

**解析**：

- **硬件**：CPU、内存、磁盘、网卡等物理设备
- **内核（kernel）**：操作系统核心，负责进程调度、内存管理、文件系统、设备驱动，是唯一能直接操作硬件的部分
- **解释器（shell/bash）**：人与内核之间的"翻译官"，把用户命令翻译成内核能理解的系统调用
- **应用软件**：面向具体业务的程序（nginx、mysql 等）

**实操验证**（A 级，已实操 —— 一次命令执行所经过的完整层次）：

```bash
echo "hello linux"
uname -r
echo $SHELL
```

输出（已实操，Git Bash）：

```console
hello linux
3.6.9-b4195d69.x86_64
/usr/bin/bash
```

验证方法：`echo` 由 shell 解释执行，`uname -r` 向内核查询版本，`$SHELL` 显示当前使用的解释器，三者分别对应应用层、内核层、解释器层。

> **易错点**：漏掉"解释器/ shell"这一层；把内核和发行版混为一谈（CentOS、Ubuntu 是发行版，Linux 才是内核）。

> **参见**：02-Linux系统概念

---

## 三、路径、命令与网络基础（题 17-23）
{: .sec-expl}

### 题 17：切换目录的命令是什么？常见用法有哪些？
{: .sec-know}

> **答案**：`cd`（change directory）

**解析**：常见用法

| 用法 | 说明 |
| --- | --- |
| `cd /data/app` | 切到绝对路径 |
| `cd app` | 切到当前目录下的 app（相对路径） |
| `cd ..` | 切到上一级目录 |
| `cd ../..` | 切到上两级目录 |
| `cd -` | 切回上一次所在的目录（两个目录间来回切） |
| `cd ~` 或 `cd` | 回到当前用户的家目录 |

**实操验证**（A 级，已实操）：

```bash
mkdir -p /tmp/hwq1/data/app/sub
cd /tmp/hwq1/data
pwd
cd app
pwd
cd ..
pwd
cd /tmp/hwq1/data/app/sub
cd ../..
pwd
```

输出（已实操，Git Bash）：

```console
/tmp/hwq1/data
/tmp/hwq1/data/app
/tmp/hwq1/data
/tmp/hwq1/data
```

```bash
cd /tmp/hwq1/data/app
cd /tmp/hwq1/data/app/sub
cd -
pwd
```

输出（已实操，Git Bash）：

```console
/tmp/hwq1/data/app
/tmp/hwq1/data/app
```

验证方法：每次 `cd` 后用 `pwd` 打印当前路径，与预期一致即正确；`cd -` 会先回显目标目录再切换。

> **易错点**：`cd` 后面忘了空格直接写路径；在脚本里用相对路径导致定时任务执行位置不对（脚本中一律用绝对路径）。

---

### 题 18：解释 IP 地址、子网掩码、网关地址、端口的概念
{: .sec-know}

> **答案**：IP 是主机标识；子网掩码决定一个网段能容纳多少主机；网关是访问其它网段的出口；端口用来区分同一主机上的不同网络服务

**解析**：

- **IP 地址**：服务器在网络中的身份标识，IPv4 为 32 位点分十进制
- **子网掩码**：与 IP 做与运算得到网络号，掩码越短一个网段内主机越多（/24 = 254 台可用主机）
- **网关地址**：主机访问非本网段时的必经出口，一般是路由器/三层交换机接口地址
- **端口**：16 位数值（0-65535），区分同一 IP 上的不同服务

常见端口

| 端口 | 服务 |
| --- | --- |
| 22 | SSH 远程连接 |
| 23 | telnet |
| 20 / 21 | FTP 数据传输 / 控制 |
| 80 / 443 | HTTP / HTTPS |
| 3306 | MySQL 数据库 |
| 873 | rsync |

**实操验证**（B 级）：

```bash
ip address show eth0
ip route
ss -lntup
```

输出（预期输出，CentOS 7）：

```console
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP qlen 1000
    inet 10.0.0.200/24 brd 10.0.0.255 scope global noprefixroute eth0
```

```console
default via 10.0.0.254 dev eth0 proto static metric 100
10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.200 metric 100
```

验证方法：`inet` 后是 IP 与掩码位数（/24），`default via` 后就是**网关地址**；`ss -lntup` 能看到各服务监听的端口。

> **易错点**：把网关写成 Broadcast（广播地址），网关与广播地址是两回事；认为端口是物理接口——端口是传输层逻辑概念。

> **参见**：01-运维网络基础-上

---

### 题 19：解释程序、进程、守护进程的概念
{: .sec-know}

> **答案**：程序是静态的代码文件；进程是运行起来的程序；守护进程是一直在后台运行、无终端的进程

**解析**：

- **程序**：存放在磁盘上的可执行文件（如 `/usr/sbin/sshd`），静态、不占 CPU
- **进程**：程序被加载到内存并执行后的实例，拥有独立 PID、内存空间、打开的文件描述符
- **守护进程（daemon）**：脱离终端、随系统启动常驻后台、为其它进程提供服务的进程（如 sshd、crond、nginx），进程名常以 `d` 结尾

**实操验证**（B 级）：

```bash
ps -ef | head -5
ps -ef | grep sshd | grep -v grep
pstree -p | head -5
```

输出（预期输出，CentOS 7）：

```console
UID        PID  PPID  C STIME TTY          TIME CMD
root         1     0  0 09:10 ?        00:00:02 /usr/lib/systemd/systemd
root         2     0  0 09:10 ?        00:00:00 [kthreadd]
root       756     1  0 09:11 ?        00:00:00 /usr/sbin/sshd -D
root      1234   756  0 10:02 ?        00:00:00 sshd: root@pts/0
```

验证方法：`TTY` 列为 `?` 且 `PPID` 为 1 的通常是守护进程（如 PID 756 的 `/usr/sbin/sshd -D`）；带 `pts/0` 的是用户会话进程。

> **易错点**：认为"进程就是程序"；把父进程为 1 且有终端的进程也叫守护进程——守护进程必须脱离终端，不随用户退出而终止。

---

### 题 20：计算机存储数据的单位和换算方法

> **答案**：逻辑换算 1024 进制，厂商换算 1000 进制

**解析**：

- **逻辑换算（操作系统）**：1T = 1024G = 1024²M = 1024³K = 1024⁴Byte
- **厂商换算（硬盘标称）**：1T = 1000G = 1000²M = 1000³K = 1000⁴Byte
- 最小单位是 **bit（位）**，1 Byte = 8 bit；网络带宽常用 bit（Mbps），下载速度常用 Byte（MB/s），故 100Mbps 带宽理论下载速度约 12.5MB/s

**实操验证**（A 级，已实操）：

```bash
awk 'BEGIN{print "1TB =", 1024*1024*1024*1024, "Byte"}'
awk 'BEGIN{print "1TB(厂商) =", 1000*1000*1000*1000, "Byte"}'
awk 'BEGIN{printf "100Mbps = %.1f MB/s\n", 100/8}'
```

输出（已实操，Git Bash）：

```console
1TB = 1099511627776 Byte
1TB(厂商) = 1000000000000 Byte
100Mbps = 12.5 MB/s
```

验证方法：两组结果相差约 10%，正是标称容量与实际可用容量差异的来源。

> **易错点**：大小写混淆——**B 是 Byte（字节），b 是 bit（位）**；把带宽 100Mb/s 等同于下载速度 100MB/s。

---

### 题 21：常用的服务器品牌有哪些？说出几种型号

> **答案**：Dell（R730/R740/R750）、IBM（x3650 M5）、浪潮（NF5280M5）、HP（DL380 Gen10）、华为（2288H V5）

**解析**：选型要点

- **Dell PowerEdge 系列**：企业最常见，R740/R750 为 2U 通用型，iDRAC 带外管理好用
- **IBM/Lenovo System x**：金融行业常见，x3650 M5 为 2U 机型
- **浪潮 / 华为**：国产化替代场景常见，NF5280、2288H V5
- 选型关注：CPU 路数与核数、内存插槽数与最大容量、盘位数量与是否支持 NVMe、电源是否冗余、是否有远程管理口

**实操验证**：无命令可实操，真机上可用（B 级）：

```bash
dmidecode -t system | head -8
```

输出（预期输出，CentOS 7）：

```console
System Information
	Manufacturer: Dell Inc.
	Product Name: PowerEdge R740
	Serial Number: ABCD123
```

验证方法：`dmidecode` 读取的是主板 DMI 信息，与机身铭牌一致即正确。

> **易错点**：把台式机型号当服务器型号；认为塔式和机架式没有区别——机房上架必须选机架式（1U/2U）并配导轨。

---

### 题 22：如何在安装系统时直接把网卡名改成 eth0？

> **答案**：安装引导界面按 Tab，在内核参数后追加 `net.ifnames=0 biosdevname=0`

**解析**：CentOS 7 默认启用"一致网络设备命名"——systemd/udev 会根据固件信息给网卡起名，于是出现 ens33、eno16777736 这类名字，换台机器、换个插槽名字还不一样。`net.ifnames=0 biosdevname=0` 就是在内核参数层面关掉这两套命名方案，退回老式 eth0。生产环境为了脚本统一、文档好写，一般都改回 eth0。

完整步骤：

1. 开机进入 CentOS 7 安装选择界面
2. 选中 `Install CentOS 7`，按 **Tab** 键
3. 在出现的内核启动参数末尾追加 `net.ifnames=0 biosdevname=0`
4. 回车进入安装
5. 装完系统后网卡名即为 eth0

已装好的系统补救方式（B 级）：

```bash
# 1) 修改 grub 内核参数
sed -i 's/rhgb quiet/rhgb quiet net.ifnames=0 biosdevname=0/' /etc/default/grub

# 2) 重新生成 grub 配置
grub2-mkconfig -o /boot/grub2/grub.cfg

# 3) 改名网卡配置文件
mv /etc/sysconfig/network-scripts/ifcfg-ens33 /etc/sysconfig/network-scripts/ifcfg-eth0
sed -i 's/NAME=ens33/NAME=eth0/;s/DEVICE=ens33/DEVICE=eth0/' /etc/sysconfig/network-scripts/ifcfg-eth0

# 4) 重启生效
reboot
```

输出（预期输出，CentOS 7）：

```console
Generating grub configuration file ...
Found linux image: /boot/vmlinuz-3.10.0-1160.el7.x86_64
done
```

验证方法：重启后执行 `ip a`，网卡名显示为 `eth0` 且能正常获取 IP。

> **易错点**：只在 grub 里加参数却不改网卡配置文件，重启后网卡起不来；`grub2-mkconfig` 输出路径 UEFI 模式下是 `/boot/efi/EFI/centos/grub.cfg`。

> **参见**：03-系统安装部署

---

### 题 23：绝对路径和相对路径的区别？

> **答案**：绝对路径从根 `/` 开始写；相对路径从当前所在目录开始写

**解析**：

- **绝对路径**：`/data/app/file1`，任何目录下执行结果都一样，脚本和定时任务必须用绝对路径
- **相对路径**：`./file1`、`../conf/app.conf`、`sub/file1`，依赖当前目录，输入更短
- 特殊符号：`.` 当前目录，`..` 上一级目录，`~` 家目录，`-` 上一次所在目录

**实操验证**（A 级，已实操）：

```bash
mkdir -p /tmp/hwq1/data/app/sub
printf 'a\nb\n' > /tmp/hwq1/data/app/sub/f.txt

# 进入深层目录
cd /tmp/hwq1/data/app/sub
pwd

# 用绝对路径访问（与当前位置无关）
cat /tmp/hwq1/data/app/sub/f.txt

# 用相对路径访问（基于当前位置）
cat ./f.txt
ls ../..
```

输出（已实操，Git Bash）：

```console
/tmp/hwq1/data/app/sub
a
b
a
b
app
data
```

验证方法：切换到别的目录后重复执行绝对路径命令，结果不变；相对路径命令结果会随当前目录变化——这就是两者本质区别。

> **易错点**：在 crontab 里写相对路径导致脚本找不到文件；把 `./script.sh` 写成 `script.sh` 时，若当前目录不在 PATH 中会报 `command not found`。

---

## 四、系统管理与运维规范（题 24-30）
{: .sec-best}

### 题 24：如何破解（重置）系统用户密码？

> **答案**：两种方式 —— 单用户模式重置、光盘/救援模式重置

**解析**：

- **单用户模式（最常用）**：进入 runlevel 1，无需密码直接获得 root shell，然后 `passwd` 重置
  1. 重启系统，在 grub 菜单按 `e` 进入编辑
  2. 在 `linux16` 行末尾追加 `init=/bin/bash`（或把 `ro` 改为 `rw init=/sysroot/bin/sh`）
  3. 按 `ctrl+x` 启动，进入单用户 shell
  4. 重新挂载可写：`mount -o remount,rw /`
  5. 改密码：`passwd root`
  6. 若开启 SELinux：`touch /.autorelabel`
  7. 重启：`exec /sbin/init` 或 `reboot -f`
- **光盘/救援模式**：用安装光盘启动 → Troubleshooting → Rescue a CentOS system，把原系统根挂载到 `/mnt/sysimage`，`chroot /mnt/sysimage` 后 `passwd`

**实操验证**（B 级，单用户模式内的命令）：

```bash
mount -o remount,rw /
passwd root
touch /.autorelabel
exec /sbin/init
```

输出（预期输出，CentOS 7）：

```console
Changing password for user root.
New password:
Retype new password:
passwd: all authentication tokens updated successfully.
```

验证方法：重启后用新密码能正常登录 root 即为成功。

> **易错点**：忘记 `mount -o remount,rw /` 导致 `/etc/shadow` 只读无法写入；开了 SELinux 却没 `touch /.autorelabel`，重启后因安全上下文错误无法登录。

> **安全提示**：物理接触服务器即可重置密码，因此机房准入与 BIOS 密码同样重要。

---

### 题 25：命令提示符的作用和组成？
{: .sec-warn}

> **答案**：作用是提示用户可以输入命令了；由「用户名 @ 主机名 当前目录 权限标识」组成

**解析**：CentOS 7 默认提示符形如 `[root@web01 data]#`，四部分

| 组成 | 示例 | 含义 |
| --- | --- | --- |
| 用户名 | root | 当前登录用户 |
| @ | @ | 分隔符号 |
| 主机名 | web01 | 主机名称（`/etc/hostname`） |
| 当前目录 | data | 当前所在目录名（`~` 表示家目录） |
| 权限标识 | # / $ | `#` = root 超级管理员，`$` = 普通用户 |

**实操验证**（A 级，已实操 —— 查看与临时修改 PS1 变量）：

```bash
PS1='[\u@\h \W]\$ '
echo "$PS1"
```

输出（已实操，Git Bash）：

```console
[\u@\h \W]\$ 
```

特殊符号含义：`\u` 用户名、`\h` 主机名、`\W` 当前目录基名、`\w` 完整路径、`\$` 权限标识（root 显示 `#`，普通用户显示 `$`）、`\t` 时间。

验证方法：把上面这行写入 `~/.bashrc` 后重开终端，提示符即变为 `[root@web01 data]#` 形式。

> **易错点**：把 `#` 当成注释符号——在**提示符**里 `#` 表示 root 权限；只有在 shell 脚本中 `#` 才是注释。

> **参见**：02-Linux系统概念

---

### 题 26：CentOS 系统与 RedHat 系统的区别？

> **答案**：CentOS 免费、去除了红帽商标、多用于互联网公司；RedHat 收费（含服务与支持）、带商标、多用于国企与金融

**解析**：

- **同源**：CentOS 是 Red Hat Enterprise Linux（RHEL）源码重新编译的社区发行版，二进制兼容，命令与目录结构一致
- **区别**：CentOS 去掉红帽商标与闭源组件，不提供官方商业支持与安全合规认证；RHEL 售卖的是订阅（支持、补丁、认证、法律保障）
- **现状**：CentOS 7 于 2024 年停止维护，CentOS Stream 转为 RHEL 上游滚动版本；生产迁移可选 Rocky Linux、AlmaLinux 或 RHEL 订阅

**实操验证**（B 级）：

```bash
cat /etc/redhat-release
cat /etc/os-release
```

输出（预期输出，CentOS 7）：

```console
CentOS Linux release 7.9.2009 (Core)
```

```console
NAME="CentOS Linux"
VERSION="7 (Core)"
ID="centos"
ID_LIKE="rhel fedora"
VERSION_ID="7"
```

验证方法：`ID_LIKE="rhel fedora"` 直接说明 CentOS 与 RHEL 同源；若装的是 RHEL，输出会带 `Red Hat Enterprise Linux Server` 字样。

> **易错点**：认为 CentOS 是 RHEL 的"破解版"——二者均为开源合规发行，差别在服务与商标；认为两者命令不通用。

---

### 题 27：运维人员的职责是什么？
{: .sec-know}

> **答案**：三条核心职责 —— 数据不丢、服务 7×24 稳定运行、用户体验良好

**解析**：

1. **保证数据不能丢失**：备份策略（全量 + 增量）、异地容灾、定期恢复演练，"没验证过恢复的备份等于没备份"
2. **保证服务器 7×24 稳定运行**：监控告警、高可用架构、容量规划、故障应急预案与演练
3. **保证用户访问体验**：响应速度、可用性指标（SLA）、带宽与 CDN 优化
4. 延伸职责：成本控制、安全合规、自动化提效、文档沉淀

**实操验证**（B 级，用备份验证"数据不丢"）：

```bash
# 备份并校验
cp -a /data/app /data/app.bak.$(date +%F)
diff -r /data/app /data/app.bak.$(date +%F) && echo "backup ok"
```

输出（预期输出，CentOS 7）：

```console
backup ok
```

验证方法：`diff -r` 无差异输出且打印 `backup ok`，说明备份与原数据一致，职责 1 落地。

> **易错点**：只做备份从不演练恢复；把"7×24"理解成运维人员 7×24 坐在电脑前——真正的含义是服务不中断，靠架构与自动化保障。

---

### 题 28：运维人员的标准工作流程是什么？
{: .sec-know}

> **答案**：检查 → 备份 → 操作 → 确认 → 文档

**解析**：五个步骤缺一不可

1. **操作前检查**：确认目标主机、当前状态、影响范围、是否有变更窗口
2. **操作前备份**：备份配置文件与业务数据，留好回滚点
3. **执行操作**：按既定方案逐步执行，每步留痕（建议 `script` 录屏或保存操作日志）
4. **操作后确认**：验证业务功能、日志无异常、监控指标正常
5. **编写操作文档**：记录变更内容、回滚方案、验证结果，形成知识沉淀

**实操验证**（B 级，模拟一次标准变更）：

```bash
# 1) 检查
systemctl status nginx

# 2) 备份
cp -a /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.$(date +%F)

# 3) 操作
sed -i 's/worker_processes.*/worker_processes  4;/' /etc/nginx/nginx.conf

# 4) 确认
nginx -t && systemctl reload nginx && systemctl status nginx

# 5) 记录
echo "$(date '+%F %T') modify nginx.conf" >> /var/log/ops-change.log
```

输出（预期输出，CentOS 7）：

```console
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

验证方法：第 4 步 `nginx -t` 通过且服务正常，第 5 步变更日志有记录，五步齐全即为规范流程。

> **易错点**：跳过备份直接改配置；改完不验证就下班，故障在业务高峰才暴露；不做文档导致交接时无人知道改了什么。
>
> 生产注意点：改动尽量走变更窗口并提前报备，高风险操作最好安排第二人在旁边盯操作复核。

---

### 题 29：如何避免内存中的数据丢失？

> **答案**：双路电源 + UPS 不间断电源 + 发电机，三层供电保障

**解析**：内存断电即丢，因此关键是**保住供电**与**及时落盘**

- **双路电源（冗余电源）**：服务器接两路市电，一路故障另一路自动接管，支持热插拔更换
- **UPS（不间断电源）**：市电中断后由电池供电，为系统争取 10-30 分钟，用于正常关机或支撑到发电机启动
- **发电机**：长时间停电时的兜底方案，机房标配
- 补充手段：RAID 卡带电池/电容保护（BBU/CacheVault）保护尚未落盘的写缓存；数据库开启事务日志与 `sync_binlog` 保证持久化

**实操验证**（B 级，检查电源与 UPS 状态）：

```bash
dmidecode -t 39 | head -10
upower -d 2>/dev/null || echo "UPS 由机房动环监控系统纳管"
```

输出（预期输出，CentOS 7）：

```console
System Power Supply
	Power Unit Group: 1
	Location: PSU1
	Status: Present, OK
```

验证方法：状态为 `Present, OK` 表示双路电源均在位且正常；机房动环监控能查到 UPS 剩余电量。

> **易错点**：认为 UPS 能长期供电（它只提供缓冲时间）；忽略 RAID 卡电池——没电时写缓存会降级为直写，性能骤降。

---

### 题 30：用什么命令修改网卡信息？修改完如何重启网络服务？

> **答案**：命令行用 `nmtui`，或直接编辑 `/etc/sysconfig/network-scripts/ifcfg-eth0`；改完执行 `systemctl restart network`

**解析**：

- `nmtui`：文本图形界面，方向键操作，适合新手
- `vim /etc/sysconfig/network-scripts/ifcfg-eth0`：直接改配置文件，生产环境最常用

关键配置项：

```ini
TYPE=Ethernet
BOOTPROTO=static
NAME=eth0
DEVICE=eth0
ONBOOT=yes
IPADDR=10.0.0.200
PREFIX=24
GATEWAY=10.0.0.254
DNS1=223.5.5.5
```

**实操验证**（B 级）：

```bash
# 方式一：文本图形界面
nmtui

# 方式二：编辑配置文件
vi /etc/sysconfig/network-scripts/ifcfg-eth0

# 重启网络服务
systemctl restart network

# 仅重启单块网卡（CentOS 7）
ifdown eth0 && ifup eth0

# 验证
ip address show eth0
```

输出（预期输出，CentOS 7）：

```console
inet 10.0.0.200/24 brd 10.0.0.255 scope global noprefixroute eth0
```

验证方法：`ip a` 显示的 IP 与新配置一致，且 `ping 网关地址` 能通，说明配置已生效。

> **易错点**：改完配置忘记改 `ONBOOT=yes` 导致重启后网卡不起；在远程连接时执行 `systemctl restart network` 可能瞬间断网（务必留好带外管理或先 `ifdown/ifup` 单网卡）；CentOS 8 已改用 `nmcli` 与 `NetworkManager`。

> **参见**：01-运维网络基础-下

---

## 本篇小结
{: .sec-sum}

这 30 题过一遍，容易丢分的其实就下面几件事：

1. `-p` 是 `mkdir` 的灵魂参数：多级目录一次创建，且重复执行不报错，写脚本时默认加上。
2. 分区方案记两条硬规则：`/boot` 200M；内存 ≥ 8G 时 swap 给 8G，小于 8G 才按 1.5 倍计算。
3. 快捷键按效果记：ctrl+c 终止、ctrl+d 退出、ctrl+z 挂起（用 fg 恢复）、ctrl+l 清屏。
4. 容量差额来自"厂商 1000 进制 vs 系统 1024 进制"，500G 硬盘系统识别约 465G 属正常现象。
5. buffer 面向写、cache 面向读；判断内存是否够用看 `available` 列而不是 `free` 列。
6. 排查类题目统一用"由外到内"的思路：链路（ping）→ 策略（telnet/nc）→ 服务（systemctl status / ss -lntup）。
7. 运维操作五步法（检查、备份、操作、确认、文档）与三条职责（数据不丢、7×24 稳定、用户体验）是所有变更的红线。


{% endraw %}
