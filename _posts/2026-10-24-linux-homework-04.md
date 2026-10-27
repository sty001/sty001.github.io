---
title: "day04-远程连接与命令作业实操"
date: 2026-10-24 09:54:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-04"
---

{% raw %}



课程第 4 天讲远程连接与系统管理，作业两道：虚拟机克隆、已学命令总结。下面是在实操环境里的完整过程，每道题都留了可复现的步骤和真实结果。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级操作（VMware 克隆、`shutdown` 等）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明在真机执行方式。

实操目录统一用 `/tmp/hw` 下的子目录，示例中进入目录后使用相对路径，读者可复制。本文所有 A 级输出均在 Git Bash（bash 5.3）中真实执行；输出中的本地用户名已按脱敏要求替换为 `user`，属正常环境差异。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 练习虚拟软件的虚拟主机克隆功能 | B 级（VMware 图形化操作，给出标准步骤与注意事项） |
| 题 2 | 总结已学命令（ls/cd/pwd 等）并实际使用 | A 级（真跑贴真实输出） |

## 题 1：练习虚拟软件的虚拟主机克隆功能
{: .sec-prac}

**考察点**：克隆功能的操作步骤要熟，完整克隆和链接克隆各自适合什么场合要能选对，克隆完的收尾工作不能漏。

**实现思路**：克隆就是拿当前虚拟机当模板，复制出一台新机器，VMware Workstation 里走 `管理 → 克隆` 向导，岔路口在选完整克隆还是链接克隆。本环境没有 VMware 可自动操作，按 B 级给标准步骤，真机上验证。

**实操过程**：

克隆前准备（真机执行）：关闭或挂起源虚拟机，确认源虚拟机系统可正常启动，建议先拍一个快照作为"后悔药"。

```bash
# 步骤 1：VMware Workstation 左侧虚拟机列表，选中源虚拟机
# 步骤 2：菜单栏或右键 → 管理（VM）→ 克隆（Clone）→ 下一步
# 步骤 3：选择"虚拟机中的当前状态"（也可以选某个快照作为克隆点）→ 下一步
# 步骤 4：选择克隆方法：
#         a. 创建完整克隆（Create a full clone）：复制全部数据，不依赖源虚拟机
#         b. 创建链接克隆（Create a linked clone）：只存差异数据，依赖源虚拟机磁盘
# 步骤 5：填写克隆机名称（如 linux-node2），选择存放位置 → 完成
```

完整克隆与链接克隆对比如下：

| 对比项 | 完整克隆 | 链接克隆 |
| --- | --- | --- |
| 数据完整性 | 复制全部磁盘数据 | 只存差异数据，共享源磁盘 |
| 磁盘占用 | 与源虚拟机相当 | 很小，随使用逐渐增长 |
| 对源虚拟机的依赖 | 完全独立，源可随意删除 | 强依赖，源被删除或移动后副本不可用 |
| 创建速度 | 较慢 | 很快 |
| 典型用途 | 正式环境、分发机器 | 临时实验、快速批量开机 |

链接克隆为什么又快又小：它基于写时复制（Copy-on-Write）。新机器不复制源盘数据，而是共享源磁盘文件，只在产生差异的地方写自己的差异盘——读没改过的数据直接命中源盘，写新数据才落差异文件。所以能秒级创建、几乎不占空间，代价是命脉握在源虚拟机手里。

**注意事项**（克隆完成后必须做的收尾工作）：

1. **改主机名**：两台机器主机名相同会导致集群、监控类服务混乱。

```bash
hostnamectl set-hostname linux-node2
```

2. **改 IP 地址**：克隆机的网卡配置文件会原样复制过来，IP 与源机器冲突会导致网络故障。编辑 `/etc/sysconfig/network-scripts/ifcfg-eth0`（网卡名以 `ip addr` 实际输出为准），修改 `IPADDR` 后执行 `systemctl restart network`。
3. **链接克隆的源不要动**：源虚拟机的磁盘文件被删除、移动或快照被清理，链接克隆副本会直接无法启动。
4. **VMware 不支持多实例**：克隆过程中不要重复启动 VMware 主程序。
5. 删除克隆机与删除普通虚拟机一样：先关机，再右键 `管理 → 从磁盘中删除`。

生产 / 共用环境再多一句：克隆完先改好 IP 再接回网络，别让两台机器抢同一个地址把 ARP 表搅乱。

**验证方法**：克隆完成后开机，在登录界面确认主机名是新名字；执行 `ip addr` 看到的 IP 与源机器不同；用 Xshell 以新 IP 能远程连接，即证明克隆成功且收尾配置正确。

> **易错点**：一是克隆后忘记改 IP，导致与原虚拟机 IP 冲突，两台机器互相"抢"地址，表现为时通时断；二是用链接克隆后又删除了源虚拟机，副本直接报废；三是在 VMware 运行中再次双击图标启动第二个实例，报错无法获得服务控制权。

> **参见**：[虚拟软件与远程连接](/posts/linux-system-01/)、[重要系统文件与运行级别](/posts/linux-system-04/)

## 题 2：总结已学命令及参数用法（ls/cd/pwd 等）
{: .sec-sum}

**考察点**：第 4 天的命令要串成体系记牢——`shutdown`/`reboot` 管系统运行，`ls`、`mkdir`、`cd`、`pwd` 管目录路径，`man` 管查手册。

**实现思路**：按"讲解 + 速查表 + 真跑示例 + 自测"的路子做。先把每条命令最高频的用法列出来，然后到 `/tmp/hw/day4` 里逐条运行，输出原样贴上。

### 命令速查表
{: .sec-chk}

| 命令 | 作用 | 高频用法 |
| --- | --- | --- |
| `shutdown` | 关机 / 重启 / 取消计划 | `shutdown -h now`、`shutdown -r 5`、`shutdown -c` |
| `reboot` | 立即重启 | `reboot` |
| `ls` | 列出目录内容 / 检查文件是否存在 | `ls -l`、`ls -a`、`ls -d 目录` |
| `mkdir` | 创建目录 | `mkdir -p /a/b/c` |
| `cd` | 切换目录 | `cd /绝对路径`、`cd ..`、`cd -`、`cd ~` |
| `pwd` | 显示当前所在路径 | `pwd` |
| `man` | 查看命令手册 | `man mkdir` |

`shutdown` 常用参数（B 级，真机执行）：

| 命令 | 作用 |
| --- | --- |
| `shutdown -h now` | 立即关机 |
| `shutdown -h 5` | 5 分钟后关机 |
| `shutdown -r now` | 立即重启 |
| `shutdown -r 12:30` | 在 12:30 重启 |
| `shutdown -c` | 取消待执行的关机 / 重启计划 |
| `shutdown -k time` | 只发送警告信息，并不真正关机 |

`ls` 常用参数：

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `-l` | 长格式显示权限、属主、大小、时间 | `ls -l /etc/hosts` |
| `-a` | 显示所有文件，含隐藏文件 | `ls -a /root` |
| `-d` | 只查看目录本身，不列出内容 | `ls -d /data` |
| `-i` | 显示 inode 号 | `ls -i /etc/hosts` |
| `-t` | 按修改时间排序，最新在前 | `ls -lt` |
| `-r` | 逆序排列 | `ls -ltr` |
| `-h` | 配合 `-l` 人类可读显示大小 | `ls -lh /var/log` |

### 真跑示例（已实操）
{: .sec-ex}

准备目录，之后所有示例都在其中进行：

```bash
mkdir -p /tmp/hw/day4/test01/test02/test03
cd /tmp/hw/day4
pwd
```

输出：

```console
$ mkdir -p /tmp/hw/day4/test01/test02/test03
$ cd /tmp/hw/day4
$ pwd
/tmp/hw/day4
```

检查目录与文件是否存在（`ls` 的最基本功）：

```bash
ls -d test01/test02/test03
```

输出：

```console
$ ls -d test01/test02/test03
test01/test02/test03
```

相对路径与绝对路径切换、返回上级：

```bash
cd test01/test02/test03
pwd
cd ../..
pwd
```

输出：

```console
$ cd test01/test02/test03
$ pwd
/tmp/hw/day4/test01/test02/test03
$ cd ../..
$ pwd
/tmp/hw/day4/test01
```

两个目录之间快速切换（`cd -` 跳回上一次所在目录）：

```bash
cd /tmp/hw/day4/test01/test02/test03
cd /tmp/hw/day4
cd -
```

输出：

```console
$ cd /tmp/hw/day4/test01/test02/test03
$ cd /tmp/hw/day4
$ cd -
/tmp/hw/day4/test01/test02/test03
```

`cd -` 的本质是切换到 `$OLDPWD` 变量记录的目录，shell 每次切换目录都会更新它。所以 `echo $OLDPWD` 也能看到上次所在目录，但不执行跳转。这两个符号敲一遍就明白：`cd -` 是来回跳，`cd ..` 只往上走一级。

快速返回家目录（`~` 就是当前用户的家目录）：

```bash
cd ~
pwd
```

输出：

```console
$ cd ~ && pwd
/c/Users/user/AppData/Roaming/SPB_Data
```

> **说明：** Git Bash 中 `~` 指向 Windows 用户目录；CentOS 7 中 root 用户的 `~` 是 `/root`，普通用户是 `/home/用户名`。命令行为完全一致，只是路径不同。
{: .sec-note}

长格式查看文件属性（`ls -l` 是后续权限与 inode 学习的基础）：

```bash
cd /tmp/hw/day4
echo "hello linux" > readme.txt
ls -l
```

输出：

```console
$ cd /tmp/hw/day4 && echo "hello linux" > readme.txt && ls -l
total 1
-rw-r--r-- 1 user user 12 Oct 24 03:25 readme.txt
drwxr-xr-x 1 user user  0 Oct 24 03:24 test01
```

`ls -l` 输出列的含义：

| 输出片段 | 含义 |
| --- | --- |
| `-rw-r--r--` | 文件类型与权限（`-` 普通文件，`d` 目录） |
| `1` | 硬链接数 |
| `user user` | 属主与属组 |
| `12` | 文件大小，单位字节 |
| `Oct 24 03:25` | 最后修改时间 |

显示隐藏文件与只查看目录本身：

```bash
ls -a
ls -d test01
```

输出：

```console
$ ls -a
.
..
test01
$ ls -d test01
test01
```

用 `ls` 判断文件不存在时的报错（这也是排查"文件到底在不在"的标准手段）：

```bash
ls ./not-exist
```

输出：

```console
$ ls ./not-exist
ls: cannot access './not-exist': No such file or directory
```

### 辨析：reboot 与 shutdown -r now

两者都能重启，行为不一样。`reboot` 立刻动手，不通知、不等待，其他登录用户的会话说断就断；`shutdown -r now` 会先广播消息给所有在线用户，正常关闭服务、同步文件系统后再重启，生产环境更稳妥。`shutdown -r +5 "系统 5 分钟后重启"` 还能预约时间并说明原因——这也是它比 reboot 值钱的地方：重启变成一个可取消（`shutdown -c`）、可预告的计划，而不是突发事件。

### 自测
{: .sec-prac}

1. `ls -l` 输出中每一列分别是什么含义？`ls -ltr` 常用于什么排查场景？
2. `cd -` 和 `cd ..` 的区别是什么？
3. 一条命令忘了参数怎么办？`man` 手册中 NAME、SYNOPSIS、DESCRIPTION 三节分别看什么？

> **参考答案：** 1. 依次为类型与权限、硬链接数、属主、属组、大小（字节）、修改时间、文件名；`ls -ltr` 反向按时间排序，最新改的文件在最后一行，用于排查"谁改了配置"。2. `cd -` 跳回上一次所在目录，`cd ..` 返回上一级目录。3. 用 `man 命令` 查手册：NAME 看命令作用，SYNOPSIS 看使用方法，DESCRIPTION 看参数解释；也可以用 `命令 --help`。

## 本篇小结
{: .sec-sum}

几条收尾：

- 克隆 = 从模板复制新机器。完整克隆独立、占整份空间；链接克隆只存差异，源没了它也活不成。
- 克隆完两件事必须做：改主机名（`hostnamectl set-hostname`）、改 IP（改 ifcfg 配置文件），不然新旧机器打架。
- `shutdown -h now` 关机、`-r` 重启、`-c` 取消计划；执行时会广播给所有登录用户，生产重启优先它而不是 reboot。
- 目录路径四件套：`ls` 验存在、`mkdir -p` 建多级、`cd` 会跳（`..`、`-`、`~`）、`pwd` 报位置。
- `ls -l` 长格式是后面学权限和 inode 的地基，`ls -ltr` 专治"最近谁动过文件"。
- 命令忘了用法就 `man`，重点看 NAME、SYNOPSIS、DESCRIPTION 三节，分别是作用、用法、参数。


{% endraw %}
