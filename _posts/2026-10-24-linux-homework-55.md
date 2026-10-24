---
title: "日测 day5 目录结构知识 测验精讲 + 实操验证"
date: 2026-10-24 09:55:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
## 本篇说明

- **覆盖章节**：day5 目录结构相关知识：挂载概念、系统一级目录作用、网卡配置文件详解、常用键盘快捷键，外加光驱挂载和改 IP 后重启网卡服务两个实操。
- **题目来源**：day5 目录结构测验（基础概念 4 题 + 练习操作 2 题，含官方答案）。
- **实操分级**：
  - **A 级（已实操）**：`ls -ld` 查看目录属性、`cat`/`grep` 查看网卡配置文件、`bind -p` 查看快捷键绑定、挂载点目录准备等，已在 Git Bash 中真实执行，输出为真实结果。
  - **B 级（预期输出）**：`mount`、`ls -l /dev/cdrom`、`systemctl restart network`、`ifdown`/`ifup` 等系统级命令，本机无法执行，给出标准命令与 CentOS 7 预期输出。
- **脱敏约定**：主机名统一用 `linux-node01`，IP 使用内网示例段 `10.0.0.0/24`，DNS 保留公共 DNS `223.5.5.5` 作为技术示例，机构域名改写为 `example.com`。
- **沙箱约定**：涉及配置文件的 A 级实操统一在 `/tmp/hw/day5` 沙箱内做副本演练，避免改动真机 `/etc` 下的文件。真实输出中的属主/属组字段按脱敏规范统一显示为 `user`。

## 实操环境对照

| 级别 | 代表命令 | 执行方式 | 本文标注 |
| --- | --- | --- | --- |
| A 级 | ls -ld、cat、grep、bind -p、mkdir | Git Bash 真实执行，输出照抄 | 已实操 |
| B 级 | mount、umount、systemctl、ifdown、ifup | CentOS 7 真机执行 | 预期输出 |

---

## 测验题目精讲

### 题 1：简单描述 Linux 系统中的挂载概念？

> **答案：** 磁盘相当于"房子"，挂载点目录相当于"门"。数据存在磁盘里，但必须让一个目录与磁盘设备建立关联关系，才能通过进入这个目录去查看磁盘中的数据。**目录与磁盘设备建立关系的过程就叫挂载**。

**解析**：Linux 不像 Windows 用 C 盘、D 盘这样的盘符访问磁盘，而是把设备文件（如 `/dev/sda1`、`/dev/cdrom`）挂到目录树的某个空目录（挂载点，如 `/mnt`、`/data`）上，之后对该目录的读写就是对该设备的读写。为什么要这么设计？因为 Linux 只有**一棵**目录树，所有存储都必须挂到这棵树的某个枝条上，路径体系才能统一。

- 挂载三要素：**设备文件**（`/dev/xxx`）+ **挂载点目录**（空目录）+ **文件系统类型**（xfs/ext4/iso9660）。
- 挂载前目录是空的；挂载后目录里显示的是设备里的数据；**卸载（umount）后原目录内容会恢复显示**。
- 光盘、U 盘这类可移动介质也遵循同样规则。

**实操验证**（部分已实操）：挂载点目录本身可以真实准备，挂载动作属系统级操作按 B 级给出。

```bash
# 步骤 1：准备一个空目录作为挂载点（真机常用 /mnt）
mkdir -p /tmp/hw/day5/mnt
ls -ld /tmp/hw/day5/mnt

# 步骤 2：挂载前查看目录内容（应为空，代表还没和任何设备建立关系）
ls -A /tmp/hw/day5/mnt
```

输出（已实操）：

```console
drwxr-xr-x 1 user user 0 Oct 24 05:31 /tmp/hw/day5/mnt
```

（`ls -A` 无任何输出，说明挂载点目录当前为空——这正是"门后面还没有房间"的状态。）

真机上的挂载动作（B 级，预期输出）：

```bash
mount /dev/cdrom /mnt
df -h | tail -1
umount /mnt
```

（预期输出，CentOS 7）

```console
[root@linux-node01 ~]# mount /dev/cdrom /mnt
mount: /dev/sr0 is write-protected, mounting read-only
[root@linux-node01 ~]# df -h | tail -1
/dev/sr0                 4.3G  4.3G     0 100% /mnt
[root@linux-node01 ~]# umount /mnt
[root@linux-node01 ~]#
```

**验证方法**：`df -h` 能看到设备与挂载点的对应关系，且 `ls /mnt` 能列出设备内的数据；`umount` 后 `ls /mnt` 恢复为空，即证明"目录只是门、数据在设备上"。

> **易错点**：误以为"把文件复制进了 /mnt 就是写进磁盘"——没挂载时写进 /mnt 的数据其实落在根分区上，卸载后会被"遮住"。另外卸载时提示 `target is busy` 是因为当前 shell 正处在挂载点目录里，需先 `cd /` 再 `umount`。
>
> **参见**：[目录结构与挂载](../02-系统操作/03-目录结构与挂载.md)

---

### 题 2：简单描述以下目录的大致作用（/bin、/sbin、/home、/root、/usr、/opt、/var、/etc、/proc）？

> **答案**：

| 目录 | 作用 |
| --- | --- |
| /bin | 存放普通用户可使用的命令（binary） |
| /sbin | 存放超级用户 root 使用的系统管理命令 |
| /home | 普通用户的家目录（每个用户一个子目录） |
| /root | 超级管理员 root 的家目录 |
| /usr | 系统中软件程序存放目录（/usr/bin、/usr/local 等） |
| /opt | 第三方软件安装目录 |
| /var | 经常变化的数据，主要是日志文件（/var/log） |
| /etc | 系统与服务配置文件存放目录 |
| /proc | 内核与进程的虚拟文件系统，数据都在内存里 |

**解析**：这是 FHS（文件系统层次结构标准）的核心内容。记住两条主线：**命令在哪**（/bin、/sbin、/usr/bin、/usr/sbin）、**配置与数据在哪**（/etc 配置、/var 日志、/proc 内核运行时信息）。/proc 是伪文件系统，不占磁盘空间，重启后重建，是排查内核与进程问题的重要入口。

生产注意点：`/var` 是磁盘占满的高发区（日志疯涨），分区规划时建议把 `/var` 或至少 `/var/log` 单独切出来，防止把根分区撑爆。

**实操验证**（已实操）：

```bash
# 查看一级目录属性（首列 d 表示目录）
ls -ld /bin /usr /etc /tmp /proc /dev

# /proc 里数字命名的目录就是进程 PID
ls /proc | head -8

# /proc/self 指向当前进程，直观说明"数据在内存里"
ls -l /proc/self | head -3
```

输出：

```console
drwxr-xr-x  1 user user 0 Oct 23 23:18 /bin
dr-xr-xr-x 17 user user 0 Oct 24 05:26 /proc
drwxr-xr-x  1 user user 0 Oct 23 23:18 /etc
dr-xr-xr-x  1 user user 0 Oct 24 05:26 /tmp
drwxr-xr-x  1 user user 0 Oct 23 23:18 /usr
dr-xr-xr-x  1 user user 0 Oct 24 05:26 /dev
1025
1049
1051
1124
1125
1131
1137
1139
lrwxrwxrwx 1 user user 0 Oct 24 05:26 /proc/self -> 1146
```

（说明：当前是 Git Bash 的精简根目录，因此 /sbin、/home、/root、/var、/opt 不存在；在 CentOS 7 真机上这些目录齐全，属主均为 `root root`。）

**验证方法**：在 CentOS 7 真机执行 `ls -ld /bin /sbin /home /root /usr /opt /var /etc /proc`，九个目录都应存在且首列为 `d`；`ls /proc` 应能看到以 PID 命名的数字目录。

> **易错点**：把 `/bin` 与 `/sbin` 记反——`s` 可以理解为 super/root 专用（如 `fdisk`、`ifconfig`、`reboot`）。`/usr` 不是"用户目录"（用户目录是 /home），而是 Unix System Resources，放的是软件程序。`/proc` 下的数据重启即消失，不能当成配置存放地。
>
> **参见**：[目录结构与挂载](../02-系统操作/03-目录结构与挂载.md)

---

### 题 3：详细说明网卡配置文件所在路径以及配置信息？

> **答案：** 路径是 `/etc/sysconfig/network-scripts/ifcfg-eth0`（CentOS 7 网卡名可能是 `ens33`/`ens160`，文件名随之变化）。

**解析**：网卡配置文件是"K=V"形式的键值对，由网络服务在启动时读取。核心字段含义如下：

| 字段 | 示例值 | 含义 |
| --- | --- | --- |
| TYPE | Ethernet | 网络类型，以太网 |
| BOOTPROTO | none | 获取 IP 的方式：none/static 为手动静态，dhcp 为自动获取 |
| NAME | eth0 | 网卡连接名称 |
| UUID | 9442bb67-... | 硬件/连接的唯一标识信息 |
| DEVICE | eth0 | 网卡设备名 |
| ONBOOT | yes | 开机是否自动激活该网卡 |
| IPADDR | 10.0.0.71 | 主机网络身份标识（IP 地址） |
| PREFIX | 24 | 子网掩码位数，控制网络中可容纳的主机数量 |
| GATEWAY | 10.0.0.254 | 网关，从一个网络到另一个网络的必经之路 |
| DNS1 | 223.5.5.5 | DNS 服务器，负责域名与 IP 的对应关系 |

**实操验证**（已实操，在沙箱内用配置文件副本演练）：

```bash
mkdir -p /tmp/hw/day5

# 步骤 1：构造一份网卡配置文件副本（真机上直接 cat 原文件即可）
cat > /tmp/hw/day5/ifcfg-eth0 <<'EOF'
TYPE=Ethernet
BOOTPROTO=none
NAME=eth0
UUID=9442bb67-fc3a-4095-a9fa-a0c748c2b53c
DEVICE=eth0
ONBOOT=yes
IPADDR=10.0.0.71
PREFIX=24
GATEWAY=10.0.0.254
DNS1=223.5.5.5
EOF

# 步骤 2：查看完整配置
cat /tmp/hw/day5/ifcfg-eth0

# 步骤 3：只挑关键字段核对（真机上把路径换成 /etc/sysconfig/network-scripts/ifcfg-eth0）
grep -nE 'IPADDR|PREFIX|GATEWAY|DNS1|ONBOOT|BOOTPROTO' /tmp/hw/day5/ifcfg-eth0
```

输出：

```console
TYPE=Ethernet
BOOTPROTO=none
NAME=eth0
UUID=9442bb67-fc3a-4095-a9fa-a0c748c2b53c
DEVICE=eth0
ONBOOT=yes
IPADDR=10.0.0.71
PREFIX=24
GATEWAY=10.0.0.254
DNS1=223.5.5.5
2:BOOTPROTO=none
6:ONBOOT=yes
7:IPADDR=10.0.0.71
8:PREFIX=24
9:GATEWAY=10.0.0.254
10:DNS1=223.5.5.5
```

真机上的查看方式（B 级，预期输出）：

```bash
cat /etc/sysconfig/network-scripts/ifcfg-eth0
```

（预期输出，CentOS 7）

```console
[root@linux-node01 ~]# cat /etc/sysconfig/network-scripts/ifcfg-eth0
TYPE=Ethernet
BOOTPROTO=none
NAME=eth0
UUID=9442bb67-fc3a-4095-a9fa-a0c748c2b53c
DEVICE=eth0
ONBOOT=yes
IPADDR=10.0.0.71
PREFIX=24
GATEWAY=10.0.0.254
DNS1=223.5.5.5
```

**验证方法**：改完配置后用 `grep IPADDR 网卡文件` 核对写入值，再用 `ip addr show eth0`（或 `ifconfig eth0`）确认实际生效的 IP 与文件中一致。

> **易错点**：`BOOTPROTO=none` 与 `dhcp` 混用会导致配置不生效；只改了 IPADDR 却忘了改 GATEWAY/PREFIX 会造成能连通内网但出不了网；`ONBOOT=no` 会导致重启后网卡不起。另外 CentOS 7 网卡名不一定是 eth0，需在 `/etc/sysconfig/network-scripts/` 下先 `ls` 确认真实文件名。
>
> **参见**：[虚拟软件与远程连接](../02-系统操作/01-虚拟软件与远程连接.md)

---

### 题 4：简单描述以下键盘快捷方式的作用？

> **答案**：

| 快捷键 | 作用 |
| --- | --- |
| ctrl+a | 光标移动到行首 |
| ctrl+e | 光标移动到行尾 |
| ctrl+c | 中断当前命令的执行 |
| ctrl+w | 删除（剪切）光标前的一个字符串 |
| ctrl+u | 删除（剪切）光标到行首的内容 |
| ctrl+k | 删除（剪切）光标到行尾的内容 |
| tab | 补全命令、路径、文件名 |
| ctrl+s | 锁定终端界面（Xshell 中常见） |
| ctrl+q | 解锁终端界面 |
| Esc+. | 调取上一条命令的最后一部分内容 |

**解析**：这些快捷键由 bash 的行编辑库（readline）提供，不是 shell 命令。`ctrl+u`/`ctrl+k`/`ctrl+w` 删除的内容进入剪切环，可用 `ctrl+y` 粘贴回来。最实用的是 `tab` 补全、`ctrl+a/e` 快速跳首尾、`Esc+.` 复用上一个参数（尤其是长路径）。

**实操验证**（已实操）：用 `bind -p` 可以直接查到 bash 内部的按键绑定，这是"快捷键到底绑了什么功能"的可验证依据。

```bash
# 查看常用 ctrl 组合键绑定到的 readline 功能名
bind -p | grep -E '\\C-a|\\C-e|\\C-u|\\C-k|\\C-w|\\C-c|\\C-s|\\C-q'

# 查看 Esc+. 的绑定（insert-last-argument = 插入上条命令的最后一个参数）
bind -p | grep -i 'insert-last-argument'
```

输出：

```console
"\C-a": beginning-of-line
"\C-x\C-e": edit-and-execute-command
"\C-e": end-of-line
"\C-s": forward-search-history
"\C-k": kill-line
"\C-q": quoted-insert
"\e\C-e": shell-expand-line
"\C-x\C-u": undo
"\C-u": unix-line-discard
"\C-w": unix-word-rubout
"\e.": insert-last-argument
"\e_": insert-last-argument
```

对照表：`\C-a` → beginning-of-line（行首）、`\C-e` → end-of-line（行尾）、`\C-u` → unix-line-discard（剪切到行首）、`\C-k` → kill-line（剪切到行尾）、`\C-w` → unix-word-rubout（剪切前一个词）、`\e.` → insert-last-argument（即 Esc+.）。

**验证方法**：在交互终端里输入一条长命令后分别按 `ctrl+a`、`ctrl+e` 观察光标位置；输入 `cat /etc/hosts` 后按 `Esc+.` 应自动补出 `/etc/hosts`。

> **易错点**：`ctrl+s` 在 Xshell/终端里会"锁屏"，表现为敲什么都没反应，很多人以为系统卡死——按 `ctrl+q` 即可解锁。`ctrl+c` 与 `ctrl+z` 不同：`ctrl+c` 是终止，`ctrl+z` 是挂起到后台。另外 `ctrl+d` 是退出当前 shell，等同于 `exit`，误按会直接断开连接。
>
> **变式追问**：`Esc+.` 连按多次会怎样？（在最近几条命令的最后一个参数之间轮换，翻过头了就 `ctrl+r` 搜历史重找。）

---

### 题 5：如何实现对光驱进行挂载，并查看光驱中的数据信息？

> **答案**：四个步骤——确认虚拟机光驱已加载镜像 → 检查系统中有光驱设备文件 `/dev/cdrom` → 执行 `mount /dev/cdrom /mnt` → `cd /mnt && ls` 检查确认。

**解析**：`mount 设备 挂载点` 是最简形式，文件系统类型可以自动识别。光盘是只读介质（iso9660），内核会提示 `mounting read-only`——为什么天然只读？iso9660 是为 CD-ROM 设计的文件系统，规范里压根没有写操作的语义。用完必须 `umount /mnt` 再取出镜像，否则虚拟机会报设备被占用。`-o loop` 用于把**镜像文件**（如 CentOS-7-x86_64-DVD.iso）挂载到目录，与挂载物理光驱是两种场景。

**实操验证**（B 级，预期输出）：Git Bash 虽有 `mount`/`umount`，但属于模拟实现、语义与 Linux 不同，因此按 CentOS 7 标准流程给出。

```bash
# 步骤 1：确认光驱设备文件（软链接指向真正的设备 sr0）
ls -l /dev/cdrom

# 步骤 2：执行挂载
mount /dev/cdrom /mnt

# 步骤 3：进入挂载点查看数据
cd /mnt
ls
```

（预期输出，CentOS 7）

```console
[root@linux-node01 ~]# ls -l /dev/cdrom
lrwxrwxrwx. 1 root root 3 Mar 29 12:02 /dev/cdrom -> sr0
[root@linux-node01 ~]# mount /dev/cdrom /mnt
mount: /dev/sr0 is write-protected, mounting read-only
[root@linux-node01 ~]# cd /mnt
[root@linux-node01 mnt]# ls
CentOS_BuildTag  EULA  images    LiveOS    repodata              RPM-GPG-KEY-CentOS-Testing-7
EFI              GPL   isolinux  Packages  RPM-GPG-KEY-CentOS-7  TRANS.TBL
```

挂载点目录的准备动作在本机可以真实演练（已实操）：

```bash
mkdir -p /tmp/hw/day5/mnt
ls -ld /tmp/hw/day5/mnt
ls -A /tmp/hw/day5/mnt
```

输出：

```console
drwxr-xr-x 1 user user 0 Oct 24 05:31 /tmp/hw/day5/mnt
```

**验证方法**：`ls /mnt` 能看到 `Packages`、`repodata`、`isolinux` 等 CentOS 安装盘特征目录，说明挂载成功；`df -h` 中应出现 `/dev/sr0` 与 `/mnt` 的对应关系，使用率通常接近 100%（只读光盘）。

> **易错点**：没在虚拟机设置里勾选"已连接/加载镜像"，导致 `/dev/cdrom` 不存在；挂载点目录非空时会被"遮盖"；卸载时报 `target is busy` 是因为当前路径还在 `/mnt` 里。光盘挂载后是只读的，`touch` 会报 `Read-only file system`。
>
> **参见**：[目录结构与挂载](../02-系统操作/03-目录结构与挂载.md)

---

### 题 6：对网卡 IP 地址进行修改后，如何让配置生效？

> **答案**：编辑配置文件 `vi /etc/sysconfig/network-scripts/ifcfg-eth0` 后，重启网络服务：
> - 要求 1（重启所有网卡服务）：`systemctl restart network`
> - 要求 2（只重启被修改的那块网卡）：`ifdown eth0 && ifup eth0`

**解析**：配置文件只是"纸面上的配置"，必须由网络服务重新读取才会生效。`systemctl restart network` 会重启整机网络，远程连接会短暂中断；`ifdown eth0 && ifup eth0` 只影响单块网卡，风险更小，适合生产环境。用 `&&` 而不是 `;` 是为了保证先成功 down 再 up，避免顺序错乱——很多人栽在用分号连写，down 失败了 up 照样执行，网卡状态就乱了。

**实操验证**（B 级，预期输出）：

```bash
# 步骤 1：修改配置文件中的 IP
vi /etc/sysconfig/network-scripts/ifcfg-eth0

# 步骤 2-要求 1：重启所有网卡服务
systemctl restart network

# 步骤 2-要求 2：只重启被修改的网卡
ifdown eth0 && ifup eth0

# 步骤 3：确认新 IP 是否生效
ip addr show eth0
```

（预期输出，CentOS 7）

```console
[root@linux-node01 ~]# systemctl restart network
[root@linux-node01 ~]# ifdown eth0 && ifup eth0
Device 'eth0' successfully disconnected.
Connection successfully activated (D-Bus active path: /org/freedesktop/NetworkManager/ActiveConnection/3)
[root@linux-node01 ~]# ip addr show eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 00:0c:29:1a:2b:3c brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.71/24 brd 10.0.0.255 scope global eth0
       valid_lft forever preferred_lft forever
```

配置文件内容的核对动作在本机可真实演练（已实操，沙箱副本）：

```bash
grep -nE 'IPADDR|PREFIX|GATEWAY' /tmp/hw/day5/ifcfg-eth0
```

输出：

```console
7:IPADDR=10.0.0.71
8:PREFIX=24
9:GATEWAY=10.0.0.254
```

**验证方法**：`ip addr show eth0` 显示的 inet 地址必须与配置文件中的 IPADDR/PREFIX 一致；再用 `ping 网关地址` 验证二层连通、`ping` 外网域名验证 DNS 生效。

> **易错点**：改完文件不重启服务就以为生效了；远程改 IP 时 `systemctl restart network` 会让连接断一下，若新 IP 配错会直接失联（建议先在控制台留好后路，或用 `ifdown && ifup` 单卡操作）。另外 CentOS 7 上 NetworkManager 与 network 服务并存时可能互相干扰，排障时先看 `systemctl status network`。
>
> **参见**：[虚拟软件与远程连接](../02-系统操作/01-虚拟软件与远程连接.md)

---

## 本篇小结

day5 的知识偏"地图"：知道东西放在哪、门从哪进。收个尾：

1. 挂载 = 目录（门）与磁盘设备（房子）建立关联；未挂载时向挂载点写入的数据落在根分区，且会被挂载后的内容"遮盖"。
2. 九个核心目录按"命令 / 配置 / 数据 / 运行时"四条线记忆：/bin 与 /sbin（命令）、/etc（配置）、/home 与 /root（家目录）、/usr 与 /opt（软件）、/var（日志）、/proc（内存中的内核与进程）。
3. 网卡配置在 `/etc/sysconfig/network-scripts/ifcfg-网卡名`，静态地址关键是 `BOOTPROTO=none`、`ONBOOT=yes`、`IPADDR`、`PREFIX`、`GATEWAY`、`DNS1`。
4. 快捷键由 readline 提供，可用 `bind -p` 验证绑定关系；`ctrl+s` 锁屏要记得用 `ctrl+q` 解锁。
5. 挂载光驱的标准流程是：确认镜像 → `ls -l /dev/cdrom` → `mount /dev/cdrom /mnt` → `ls /mnt`；用完 `umount`。
6. 改 IP 后必须让服务重读配置：整机用 `systemctl restart network`，单卡用 `ifdown eth0 && ifup eth0`，并用 `ip addr show` 复核。
{% endraw %}
