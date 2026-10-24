---
title: "day6 目录结构作业实操"
date: 2026-10-24 09:06:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
本篇对应课程第 6 天（操作命令与目录结构）的课后作业：总结命令快捷方式、总结存储设备挂载步骤、总结目录结构作用。三条作业全部完成——快捷方式在 Git Bash 中真跑 `history` 与补全机制，挂载流程给出 CentOS 7 标准命令序列，目录结构逐目录对照真实路径。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 机制类演示（`history`、`compgen`、目录对照）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：挂载类命令（`mount`/`umount`/`fstab`）与依赖交互式终端的功能（`!!`、`!$`、`Ctrl + r`）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明在真机执行方式。

实操目录统一用 `/tmp/hw` 下的子目录。本文 A 级输出均在 Git Bash（bash 5.3）中真实执行，本地用户名已按脱敏要求替换为 `user`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 总结命令快捷方式 | A 级（history、补全机制真跑）+ B 级（history 扩展、Ctrl 系列） |
| 题 2 | 总结存储设备挂载步骤 | B 级（标准命令 + 预期输出） |
| 题 3 | 总结目录结构作用 | B 级（作用表）+ A 级（Git Bash 路径对照） |

## 题 1：总结命令快捷方式

**考察点**：命令行效率工具——`Tab` 补全、`history` 历史命令、`Ctrl + r` 反向搜索、`!!` 重复上一条、`!$` 引用上一条最后一个参数，以及常用 `Ctrl` 系列编辑快捷键。

**实现思路**：先给速查表建立全貌；`Tab` 补全用 `compgen` 真跑其底层机制，`history` 在交互式 bash 中真跑；依赖真实终端的功能（`!!`、`!$`、`Ctrl + r`）给出 CentOS 7 预期输出并说明限制原因。

### 快捷方式速查表

| 快捷方式 | 作用 | 本篇处理方式 |
| --- | --- | --- |
| `Tab` | 补全命令、路径、文件名；唯一候选直接补全，多个候选按两次列出 | A 级：真跑补全机制 |
| `history` | 查看历史命令列表（带编号） | A 级：已实操 |
| `history N` | 查看最近 N 条 | A 级：已实操 |
| `Ctrl + r` | 反向增量搜索历史命令 | B 级：预期输出 |
| `!!` | 重新执行上一条命令 | B 级：预期输出 |
| `!$` | 引用上一条命令的最后一个参数 | B 级：预期输出 |
| `!n` | 直接执行编号为 n 的历史命令 | B 级：预期输出 |
| `Ctrl + a` / `Ctrl + e` | 光标移到行首 / 行尾 | B 级：预期输出 |
| `Ctrl + u` / `Ctrl + k` / `Ctrl + w` | 剪切到行首 / 行尾 / 删除一个单词 | B 级：预期输出 |
| `Ctrl + y` | 粘贴被剪切的内容 | B 级：预期输出 |
| `Ctrl + s` / `Ctrl + q` | 锁定终端 / 解除锁定 | B 级：预期输出 |
| `Ctrl + c` / `Ctrl + d` / `Ctrl + l` | 中断命令 / 发送 EOF / 清屏 | B 级：预期输出 |

### Tab 补全的原理（已实操）

按 `Tab` 时，shell 实际在做的事：以已输入的内容为前缀，枚举所有匹配的命令或路径，唯一则补全，多个则列出候选。这个能力可以用 `compgen`（programmable completion 的脚本化接口）直接调用——它和 `Tab` 用的是同一套补全机制。

```bash
compgen -c | grep -c .
compgen -c ls | head -5
compgen -f -- /tmp/hw/day5/ | head -5
```

输出：

```console
$ compgen -c | grep -c .
6222
$ compgen -c ls | head -5
ls.exe
lsattr.exe
lsaadt.dll
lsasrv.dll
lsass.exe
$ compgen -f -- /tmp/hw/day5/ | head -5
/tmp/hw/day5/backup
/tmp/hw/day5/demo.txt
/tmp/hw/day5/dir01
/tmp/hw/day5/dir01-copy
/tmp/hw/day5/err.txt
```

三条真实输出对应 `Tab` 的三种行为：当前环境共 6222 个可补全的命令名；输入 `ls` 后按 `Tab`，候选就是所有以 `ls` 开头的命令；输入路径前缀 `/tmp/hw/day5/` 后按 `Tab`，候选就是该目录下的文件名。把 `Tab` 用成肌肉记忆，长路径一个键都不用背。

### history 历史命令（已实操）

在交互式 bash 中连续执行几条命令后查看历史：

```bash
cd /tmp/hw/day6
ls
echo hello linux
history 5
```

输出：

```console
$ history 5
    1  cd /tmp/hw/day6
    2  ls
    3  echo hello linux
    4  history 5
```

**history 工作机制**：

1. 命令执行后先存入**内存**中的历史缓冲区，**退出登录时**才写入 `~/.bash_history` 文件；
2. 缓冲区大小由 `HISTSIZE` 控制（默认 1000 条），文件大小由 `HISTFILESIZE` 控制；
3. `HISTTIMEFORMAT` 变量控制是否显示时间戳，为空则不显示。

常用配置（写入 `/etc/profile` 或 `~/.bashrc` 永久生效）：

```bash
export HISTTIMEFORMAT='%F %T '           # 显示 2026-10-24 10:30:00 格式的时间
export HISTSIZE=5000                     # 内存中保存 5000 条
export HISTFILESIZE=10000                # 文件中保存 10000 条
export HISTCONTROL=ignoreboth            # 忽略连续重复与空格开头的命令
```

**验证方法**：`history 5` 只列出最近 5 条且编号连续递增，与刚才输入的命令一一对应，证明历史缓冲区按执行顺序记录。

### `!!`、`!$`、`!n` 与 `Ctrl + r`（预期输出，CentOS 7）

本环境无真实终端（管道输入不触发 history 扩展），以下给出真机标准行为。`!!` 重复执行上一条命令：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# echo hello world
hello world
[root@linux-node1 ~]# !!
echo hello world
hello world
```

`!$` 引用上一条命令的最后一个参数（最常用于"刚查看一个文件，接着编辑它"）：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# cat /etc/hosts
127.0.0.1   localhost localhost.localdomain
[root@linux-node1 ~]# vi !$
vi /etc/hosts
```

`!n` 执行编号为 n 的历史命令；`Ctrl + r` 进入反向搜索，输入关键词后回车执行、按 `Esc` 调到光标处编辑：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# !12
systemctl restart sshd
(reverse-i-search)`hosts': cat /etc/hosts
```

> **易错点**：`!!` 适合重复上一条，但**危险操作千万别用 `!!` 复用**——上一条如果是 `rm -rf`，`!!` 会再执行一遍。`Ctrl + r` 搜索到的命令同样要先看清再回车。另外 `~/.bash_history` 里会明文留下所有敲过的命令（包括密码），生产规范中用 `HISTCONTROL=ignorespace` 加前置空格屏蔽敏感命令。

> **参见**：重要系统文件与运行级别、系统目录结构与挂载

## 题 2：总结存储设备挂载步骤

**考察点**：挂载的本质（把一个目录作为存储设备的挂载点）、`mount`/`umount` 标准流程、`/etc/fstab` 开机自动挂载的配置方法。

**实现思路**：挂载需要真实块设备与 root 权限，本环境无法真跑，给出 CentOS 7 标准命令序列（B 级）：手工挂载四步、ISO/U 盘/NTFS 三类设备挂载法、fstab 六列配置与 `mount -a` 不重启验证法。

### 挂载四步标准流程（预期输出，CentOS 7）

```bash
lsblk -f                                # 第一步：查看系统中的存储设备、UUID 与文件系统类型
mkdir /mnt/disk1                        # 第二步：创建挂载点目录（必须已存在）
mount /dev/sdb1 /mnt/disk1              # 第三步：挂载
df -h /mnt/disk1                        # 第四步：验证——能看到设备与容量即成功
```

输出：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# mount /dev/sdb1 /mnt/disk1
[root@linux-node1 ~]# df -h /mnt/disk1
Filesystem      Size  Used Avail Use% Mounted on
/dev/sdb1        20G   45M   20G   1% /mnt/disk1
```

卸载：先退出挂载点目录，再 `umount`。

```bash
cd                                     # 第一步：退出挂载点目录（关键！）
umount /mnt/disk1                      # 第二步：卸载
ls /mnt/disk1                          # 第三步：验证——目录恢复为空
```

输出：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# umount /mnt/disk1
[root@linux-node1 ~]# ls /mnt/disk1
[root@linux-node1 ~]#
```

> **注意：** 卸载前不退出挂载点目录会报 `target is busy`。找不到谁在占用时，用 `fuser -m /mnt/disk1` 或 `lsof +D /mnt/disk1` 定位进程，必要时 `umount -l` 懒卸载。

### mount / umount 常用参数

| 命令 | 参数 | 作用 |
| --- | --- | --- |
| `mount` | `-t 类型` | 指定文件系统类型：`xfs`、`ext4`、`iso9660`、`vfat`、`ntfs-3g` |
| `mount` | `-o 选项` | 挂载选项：`ro`/`rw`、`loop`、`noatime`、`remount` 等，多个逗号分隔 |
| `mount` | `-U UUID` / `-L 卷标` | 按 UUID 或卷标挂载，避免设备文件名变化 |
| `mount` | `-a` | 按 `/etc/fstab` 挂载所有未挂载设备（不重启验证法） |
| `mount` | `-o loop` | 挂载 ISO 镜像文件（把普通文件模拟成块设备） |
| `umount` | `-l` | 懒卸载，立即从目录树分离 |
| `umount` | `-f` | 强制卸载（对 NFS 有效） |

三类常见设备的挂载法：

```bash
# ISO 镜像文件
mkdir /mnt/iso
mount -o loop /data/CentOS-7-x86_64-DVD.iso /mnt/iso

# U 盘（插入后用 fdisk -l 或 lsblk 确认设备名，如 /dev/sdb1）
mkdir /mnt/usb
mount /dev/sdb1 /mnt/usb
umount /mnt/usb                          # 拔除前务必先卸载

# NTFS 分区（CentOS 7 内核不原生支持 NTFS 写，需 ntfs-3g）
yum install -y ntfs-3g
mount -t ntfs-3g /dev/sdb1 /mnt/ntfs
```

### 开机自动挂载：/etc/fstab（预期输出，CentOS 7）

`/etc/fstab` 六列依次为：设备（或 UUID）、挂载点、文件系统类型、挂载参数、dump 备份标志、fsck 检查顺序。

| 字段 | 含义 | 取值说明 |
| --- | --- | --- |
| 第 1 列：设备 | 要挂载的存储设备 | 推荐写 `UUID=xxx`（重启不变），也可写 `/dev/sdb1`、`LABEL=xxx` |
| 第 2 列：挂载点 | 挂到哪个目录 | 必须是已存在的空目录 |
| 第 3 列：文件系统类型 | 设备上的格式 | `xfs`、`ext4`、`swap`、`iso9660`、`vfat`，`auto` 自动识别 |
| 第 4 列：挂载参数 | 以什么方式挂载 | `defaults`、`noatime`、`ro` 等，逗号分隔 |
| 第 5 列：dump | 是否被 dump 备份 | 已基本废弃，一律写 `0` |
| 第 6 列：fsck | 开机检查顺序 | 根分区 `1`，其他文件系统 `2`，swap 与光驱写 `0` |

配置开机自动挂载的完整步骤：

```bash
blkid /dev/sdb1                          # 第一步：查出 UUID 与文件系统类型
mkdir /data                              # 第二步：准备挂载点
cp /etc/fstab /etc/fstab.bak             # 第三步：改前先备份
vi /etc/fstab                            # 第四步：写入配置行
```

```ini
UUID=12345678-1234-1234-1234-123456789abc /data xfs defaults 0 2
```

```bash
mount -a                                 # 第五步：按 fstab 挂载所有设备（不重启验证）
df -h                                    # 第六步：确认 /data 已挂载且容量正确
```

光驱开机自动挂载的配置行（文件系统类型一列要填 `iso9660`，这是光盘的标准文件系统）：

```ini
/dev/cdrom  /mnt  iso9660  defaults  0 0
```

> **注意：** `mount -a` 是配置 fstab 后的标准验证动作——写错这里立刻报错，还能进系统修复；不经验证直接重启，fstab 错误可能导致系统无法启动（根分区配置出错时）。设备文件名不固定（重启后可能从 sdb 变 sdc），所以 fstab 推荐用 UUID。

**验证方法**：`df -h` 输出中能看到新设备挂在指定目录且容量正确；重启后再次 `df -h` 仍在，证明开机自动挂载生效。

> **易错点**：一是挂载点目录不存在，`mount` 直接报 `mount point does not exist`；二是把有数据的目录当挂载点，挂载后原数据被遮住，卸载才恢复；三是卸载时还 `cd` 在挂载点里，报 `target is busy`；四是 fstab 写错不 `mount -a` 验证直接重启，系统起不来。

> **参见**：系统目录结构与挂载

## 题 3：总结目录结构作用

**考察点**：FHS 标准下每个目录的用途，做到"看到路径就知道该不该动"。

**实现思路**：给出逐目录作用表，并在 Git Bash 中用 `ls` 对照真实路径——存在的看内容印证作用，不存在的明确说明，让抽象表格落到真实输出上。

### 目录作用对照表

| 目录 | 作用 | Git Bash 实测（已实操） |
| --- | --- | --- |
| `/` | 目录树根，一切路径的起点 | 存在，直接列出各系统目录 |
| `/bin`、`/sbin` | 基础命令（CentOS 7 起指向 `usr/bin`、`usr/sbin`） | 存在（MSYS bin） |
| `/usr` | 系统程序与只读共享资源 | 存在，含 bin、lib、share 等 |
| `/etc` | 系统与服务配置文件 | 存在（MSYS 模拟环境，含 fstab、profile 等占位文件） |
| `/proc` | 虚拟文件系统，进程与内核信息，数据在内存中 | 存在，内容为进程 PID 数字 |
| `/tmp` | 临时文件目录，任何用户可写 | 存在，可正常读写（本系列实操目录 `/tmp/hw` 就在其中） |
| `/var` | 经常变化的数据：日志、邮件、缓存 | 不存在（MSYS 未模拟；CentOS 7 上存在） |
| `/home`、`/root` | 普通用户与 root 的家目录 | 不存在（MSYS 未模拟） |
| `/opt` | 第三方大型软件安装目录 | 不存在（MSYS 未模拟） |
| `/srv` | 服务数据目录（网站、FTP 数据） | 不存在（MSYS 未模拟） |
| `/media`、`/mnt` | 可移动设备与临时挂载点 | 不存在（MSYS 未模拟） |
| `/boot` | 系统引导文件与内核镜像 | 不存在（MSYS 未模拟） |
| `/sys` | 虚拟文件系统，内核、驱动与设备信息 | 不存在（MSYS 未模拟） |

### Git Bash 路径对照（已实操）

```bash
ls /
ls -d /var /home /root /opt /srv /media /mnt /boot /sys
ls /etc/fstab
```

输出：

```console
$ ls /
LICENSE.txt
bin
cmd
dev
etc
mingw64
proc
tmp
usr

$ ls -d /var /home /root /opt /srv /media /mnt /boot /sys 2>&1
ls: cannot access '/var': No such file or directory
ls: cannot access '/home': No such file or directory
ls: cannot access '/root': No such file or directory
ls: cannot access '/opt': No such file or directory
ls: cannot access '/srv': No such file or directory
ls: cannot access '/media': No such file or directory
ls: cannot access '/mnt': No such file or directory
ls: cannot access '/boot': No such file or directory
ls: cannot access '/sys': No such file or directory

$ ls /etc/fstab
/etc/fstab
```

**验证方法**：三条真实输出分别印证——根目录下直接就是各系统目录（目录树从 `/` 开始，这是挂载技术的前提）；`/etc`、`/proc`、`/tmp` 存在且内容符合各自职责（`/proc` 里是 PID 数字，印证数据在内存中）；`/var`、`/home` 等在 MSYS 环境不存在，以真机 CentOS 7 为准。注意 Git Bash 的 `/etc` 是 MSYS 模拟目录，真实系统的 `/etc` 内容（如 `sysconfig/network-scripts/`）以真机为准。

> **易错点**：判断目录能不能清的口诀——**配置在 `/etc` 不动、日志在 `/var` 轮转、临时 `/tmp` `/run` 自动清、业务数据 `/home` `/srv` 慎动、系统命令 `/usr` `/bin` 绝不碰**。磁盘满优先查 `/var/log` 和大文件，不要手动删 `/usr` 下的东西。

> **参见**：系统目录结构与挂载、重要系统文件与运行级别

## 自测

1. `Tab` 补全在只有一个候选和多个候选时分别是什么行为？
2. `history` 命令执行后先写入哪里，什么时候才写入文件？
3. `umount /mnt/disk1` 报 `target is busy`，可能是什么原因？怎么排查？
4. `/etc/fstab` 六个字段分别是什么？为什么推荐用 UUID 而不是 `/dev/sdb1`？

> **参考答案：** 1. 唯一候选直接补全；多个候选按两次 `Tab` 列出全部候选。2. 先存入内存中的历史缓冲区，退出登录时才写入 `~/.bash_history`。3. 有进程正在使用挂载点（常见是自己的 shell 还 `cd` 在里面）；用 `fuser -m /mnt/disk1` 或 `lsof +D /mnt/disk1` 定位，退出目录或结束进程后再卸载。4. 设备、挂载点、文件系统类型、挂载参数、dump、fsck；设备名会随硬件顺序变化，UUID 是分区唯一标识不变。

## 本篇小结

1. `Tab` 补全与 `compgen` 是同一套机制：唯一候选直接补全，多个候选列出；长路径靠 `Tab`，不靠背。
2. `history` 命令先进内存缓冲区、退出登录才写 `~/.bash_history`；`HISTSIZE`、`HISTFILESIZE`、`HISTTIMEFORMAT`、`HISTCONTROL` 控制其行为。
3. `!!` 重复上一条、`!$` 引用最后一个参数、`!n` 执行第 n 条、`Ctrl + r` 反向搜索；历史文件会明文留痕，敏感命令用前置空格屏蔽。
4. 挂载四步：查看设备（`lsblk -f`）→ 建挂载点 → `mount` → `df -h` 验证；卸载前先退出挂载点目录，否则 `target is busy`。
5. `/etc/fstab` 六列：设备（推荐 UUID）、挂载点、文件系统类型、挂载参数、dump（写 0）、fsck（根 1 其他 2 swap 0）；改完必须 `mount -a` 验证再重启。
6. 目录职责口诀：`/etc` 配置不动、`/var` 日志轮转、`/tmp` `/run` 自动清、`/home` `/srv` 慎动、`/usr` `/bin` 绝不碰。
{% endraw %}
