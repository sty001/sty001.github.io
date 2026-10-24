---
title: "03-目录结构与挂载"
date: 2026-10-24 10:39:00 +0800
categories: [软件, Linux, 02-系统操作]
tags: [Linux, 02-系统操作]
slug: "linux-system-03"
---

{% raw %}
先把命令行快捷键补齐，再讲清"挂载"并用光驱完整演示一遍挂载与卸载，然后逐个过根目录下的常见目录，最后拆解网卡配置文件和 DNS 解析配置文件——这两份文件是排网络问题的主战场。

## 命令行常用快捷键

| 快捷键 | 作用 |
| --- | --- |
| `Ctrl + a` | 将光标快速移动到行首 |
| `Ctrl + e` | 将光标快速移动到行尾 |
| `Ctrl + ←` / `Ctrl + →` | 将光标按单词快速左右移动 |
| `Ctrl + w` | 将空格分隔的一个字符串整体删除（剪切） |
| `Ctrl + u` | 将光标所在位置到行首的内容删除（剪切） |
| `Ctrl + k` | 将光标所在位置到行尾的内容删除（剪切） |
| `Ctrl + y` | 粘贴被剪切的内容 |
| `Ctrl + s` | Xshell 进入锁定状态（suo，锁） |
| `Ctrl + q` | 解除锁定状态（quit，退出锁定状态） |

> **注意：** 如果不小心按了 `Ctrl + s`，终端看起来"卡死"、输入无反应，其实是进入了锁定状态，按 `Ctrl + q` 即可恢复。新手容易栽在这——以为终端卡死，直接把窗口关了。

> **补充：** 还有几个高频快捷键：`Ctrl + c` 中断当前命令，`Ctrl + d` 发送 EOF（退出登录或结束输入），`Ctrl + l` 清屏（等价于 `clear`），`Ctrl + r` 在历史命令中反向搜索，`Tab` 补全命令与路径。把 `Ctrl + r` 用熟练，可以少敲一半命令。再补一个不常提但极好用的：`Esc + .`（或 `Alt + .`）把上一条命令的最后一个参数直接粘到光标处——刚 `ls` 完一个长路径要 `cd` 进去，按一下就出来了。

## Linux 的目录结构与挂载技术

- **Linux 目录结构**：一切从根（`/`）开始，是一棵倒挂的树。
- **Windows 目录结构**：按照盘符进行划分，如 `C:`、`D:`。

**什么是挂载？**

挂载技术让用户可以将一个目录作为存储设备的**挂载点**，通过挂载点就可以看到存储设备中的数据。磁盘存储数据之后，需要把一个目录和磁盘建立关系（挂载），进入这个目录（挂载点）就能看到磁盘中的数据。说白了，挂载就是给磁盘开一扇门，门开在哪个目录由你定。

为什么 Linux 只有一棵目录树、Windows 却按盘符切？因为 Linux 把"存储"和"路径"解耦了：路径永远从 `/` 出发，磁盘随时挂到任何目录下插拔，上层应用不用改一个字；Windows 把路径绑死在盘符上，加一块盘就要纠结它叫 E 还是 F。这个设计让 Linux 的扩容、迁移、网络存储（NFS）都天然平滑。

## 原理解析：一切皆文件与挂载的本质

Linux 的设计哲学是"**一切皆文件**"：普通文件是文件，目录是文件，硬盘、键盘、进程信息也都是文件。这一切靠内核的 **VFS（Virtual File System，虚拟文件系统）** 层实现。

1. VFS 是内核中的一层抽象：不管底层是 ext4、xfs、NFS 还是虚拟的 proc，对上都统一呈现成"文件 / 目录 / inode"的接口；
2. 整个系统只有**一棵目录树**，根是 `/`；
3. 每块新磁盘是一个独立的文件系统，自带自己的根；把它"接"到主目录树的某个空目录上，这个动作就是**挂载（mount）**；
4. 挂载的实质：在内核的挂载表里登记一条记录"设备 X 现在挂在目录 Y 下"，之后所有对 Y 的访问都被 VFS 转发给设备 X 的文件系统驱动；
5. 卸载（umount）则是把这条记录删掉，Y 恢复成普通空目录，设备中的数据从目录树上"消失"。

> **注意：** 因为挂载点只是目录树上的一个"接入点"，所以**挂载点目录里原有的数据会被暂时遮住**——挂载后只能看到新设备的内容，卸载后才能重新看到原数据。因此生产环境严禁把 `/etc`、`/home` 这类有数据的目录当挂载点。另外，设备文件名（如 `/dev/sdb1`）不是固定的，重启或调整硬件顺序后可能变化，所以 `/etc/fstab` 里推荐用 UUID 标识设备。

## 实操演示：挂载光驱

**第一个步骤：拥有一个存储设备（光驱）**，使光驱加载光盘。

**第二个步骤：在 Linux 系统中找到光驱设备**

```bash
[root@linux-node1 data]# ls -l /dev/cdrom
lrwxrwxrwx. 1 root root 3 Mar 29 12:02 /dev/cdrom -> sr0
```

> **说明：** `/dev/cdrom` 是一个软链接，指向真实设备文件 `/dev/sr0`。设备文件也可以直接使用，两个路径等价。

**第三个步骤：将存储设备进行挂载**

挂载命令的语法格式：

```bash
mount 挂载设备文件信息 挂载点（目录信息）
```

> **注意：** 挂载点目录必须存在，否则会报错——mount 故意不帮你自动创建，防止手滑把设备挂到错误的深层路径上遮住原数据。挂载点还应该是空目录，原因见下面的原理解析。

```bash
[root@linux-node1 /]# mount /dev/cdrom /mnt
mount: /dev/sr0 is write-protected, mounting read-only
[root@linux-node1 /]# cd /mnt
[root@linux-node1 mnt]# ls
CentOS_BuildTag  EULA  images    LiveOS    repodata              RPM-GPG-KEY-CentOS-Testing-7
EFI              GPL   isolinux  Packages  RPM-GPG-KEY-CentOS-7  TRANS.TBL
```

**卸载（umount）后，挂载点目录中就看不到设备里的数据了：**

```bash
[root@linux-node1 mnt]# cd
[root@linux-node1 ~]# umount /mnt
[root@linux-node1 ~]# cd /mnt
[root@linux-node1 mnt]# ls
[root@linux-node1 mnt]#
```

> **注意：** 卸载前必须**退出挂载点目录**（示例中先 `cd` 回家目录），否则会报 `target is busy`。如果找不到谁在占用，用 `fuser -m /mnt` 或 `lsof +D /mnt` 定位进程。

挂载之后，挂载点目录自身的权限设置就不再起作用了——读写控制权交给文件系统内的目录和挂载选项，想收紧权限从这两处下手。

### `mount` 常用参数详解

| 参数 | 作用 |
| --- | --- |
| `-t 类型` | 指定文件系统类型，如 `xfs`、`ext4`、`iso9660`、`vfat`、`ntfs-3g` |
| `-o 选项` | 指定挂载选项，多个用逗号分隔 |
| `-a` | 按照 `/etc/fstab` 的内容挂载所有未挂载的设备 |
| `-L 卷标` / `-U UUID` | 按卷标或 UUID 挂载，避免设备文件名变化 |
| `-B` / `--bind` | 绑定挂载，把一个目录映射到另一个目录 |
| `-r` | 只读挂载（等价于 `-o ro`） |
| `-w` | 读写挂载（默认） |

`-B` / `--bind` 绑定挂载值得单独一说：它和软链接效果相似但机制不同——绑定挂载在内核挂载表里生效，对一切程序透明；软链接是路径层面的跳转，某些程序会"看穿"它拿真实路径。chroot 环境、容器里做目录映射，用的都是绑定挂载。

`-o` 常用挂载选项：

| 选项 | 作用 |
| --- | --- |
| `defaults` | 默认选项，等价于 `rw,suid,dev,exec,auto,nouser,async` |
| `ro` / `rw` | 只读 / 读写 |
| `remount` | 不卸载的情况下重新挂载并应用新选项，如 `mount -o remount,ro /data` |
| `loop` | 挂载镜像文件（把普通文件当成块设备） |
| `noatime` | 不更新访问时间，减少磁盘写入，性能优化常用 |
| `nodiratime` | 不更新目录访问时间 |
| `noexec` | 禁止执行该文件系统上的可执行文件，安全加固用 |
| `nosuid` | 忽略该文件系统上的 setuid / setgid 位 |
| `bind` | 绑定挂载，与 `-B` 等价 |

挂载也不止本地盘：NFS、CIFS 网络共享、tmpfs 内存盘，在 mount 眼里都是"设备挂到目录"，语法完全一致——学会 mount，存储全家桶都通了。安全加固的常规项还有给 `/tmp` 加 `noexec,nosuid`：临时目录不需要执行权限，恶意脚本最爱往这里落文件。

同一设备重复挂到不同目录不会报错，但会挂出多份视图，卸载要逐个 umount——动手前先 `mount` 不带参数看一眼挂了什么。

### `umount` 常用参数详解

| 参数 | 作用 |
| --- | --- |
| `-l` | 懒卸载（lazy），立即从目录树分离，等设备不被占用时真正清理 |
| `-r` | 卸载失败时，改为只读方式重新挂载 |
| `-f` | 强制卸载（对 NFS 网络挂载有效） |

`umount -l` 是懒卸载，目录树里先摘掉、占用清完才真正释放——应急可用，别当常规操作。另外，盘要先用 fdisk/parted 分区、mkfs 格式化出文件系统才能挂载，没格式化直接 mount 会报"you must specify the filesystem type"。

## FHS 目录标准逐个详解

FHS（Filesystem Hierarchy Standard，文件系统层次结构标准）规定了每个目录该放什么。运维判断"什么文件该放哪、什么目录能清"，都以此为依据。

| 目录 | 作用 | 是否该清 |
| --- | --- | --- |
| `/bin` | 普通用户可执行的基础命令（CentOS 7 起是指向 `usr/bin` 的快捷方式） | 不清 |
| `/sbin` | 管理员可执行的基础管理命令（指向 `usr/sbin`） | 不清 |
| `/usr` | 系统程序与只读共享资源，用户的应用程序大多在这里 | 不清 |
| `/usr/local` | 本地编译安装的软件，`yum` 不管理，手动维护 | 卸载时清 |
| `/var` | 经常变化的数据，如日志、邮件、缓存、数据库文件 | 日志与缓存可定期清理 |
| `/etc` | 系统与服务的配置文件 | 不清，修改前先备份 |
| `/proc` | 虚拟文件系统，进程与内核信息，数据在内存中 | 不清，也不要改 |
| `/sys` | 虚拟文件系统，内核、驱动与设备信息 | 不清，也不要改 |
| `/dev` | 设备文件，如 `/dev/sda`、`/dev/cdrom` | 不清，系统动态生成 |
| `/home` | 普通用户的家目录 | 慎清，全是用户数据 |
| `/root` | root 用户的家目录 | 慎清 |
| `/opt` | 第三方大型软件安装目录 | 卸载软件时清 |
| `/srv` | 服务数据目录，如网站站点数据、FTP 数据 | 慎清，业务数据 |
| `/boot` | 系统引导文件与内核镜像 | 不清，误删无法开机 |
| `/run` | 系统运行时的临时数据，如 PID 文件、socket | 系统自管，重启自动清 |
| `/tmp` | 临时文件目录，任何用户可写 | 可清，系统会定期自动清理 |
| `/media` | 可移动设备（U 盘、光盘）的自动挂载点 | 卸载后可清 |
| `/mnt` | 临时挂载点，手工挂载设备时使用 | 卸载后可清 |

> **注意：** 判断目录能不能清的简单口诀：**配置在 `/etc` 不动、日志在 `/var` 轮转、临时 `/tmp` `/run` 自动清、业务数据 `/home` `/srv` 慎动、系统命令 `/usr` `/bin` 绝不碰**。磁盘空间满了优先查 `/var/log` 和大文件，不要手动删 `/usr` 下的东西。

> **补充：** `/proc` 下的文件有个怪现象：`ls -l` 显示大小全是 0，`cat` 出来却全是内容——这些文件不在磁盘上，是内核在读取瞬间实时生成的。`/proc/meminfo`、`/proc/cpuinfo` 都是这么来的，往里写值内存里也留不住，没有意义。

## 根目录下的基础目录结构

```bash
[root@linux-node1 /]# ls -l /
total 20
lrwxrwxrwx.   1 root root    7 Mar 28 10:40 bin -> usr/bin
dr-xr-xr-x.   5 root root 4096 Mar 28 10:45 boot
drwxr-xr-x.  19 root root 3180 Mar 29 12:02 dev
drwxr-xr-x.  79 root root 8192 Apr  2 08:41 etc
drwxr-xr-x.   3 root root   20 Mar 28 10:45 home
lrwxrwxrwx.   1 root root    7 Mar 28 10:40 lib -> usr/lib
lrwxrwxrwx.   1 root root    9 Mar 28 10:40 lib64 -> usr/lib64
drwxr-xr-x.   2 root root    6 Apr 11  2018 media
drwxr-xr-x.   2 root root    6 Apr 11  2018 mnt
drwxr-xr-x.   2 root root    6 Apr 11  2018 opt
dr-xr-xr-x. 103 root root    0 Mar 29 12:02 proc
dr-xr-xr-x---.   2 root root  135 Mar 28 12:33 root
drwxr-xr-x.  25 root root  680 Apr  1 11:42 run
lrwxrwxrwx.   1 root root    8 Mar 28 10:40 sbin -> usr/sbin
drwxr-xr-x.   2 root root    6 Apr 11  2018 srv
dr-xr-xr-x.  13 root root    0 Mar 29 12:02 sys
drwxrwxrwt.  11 root root 4096 Apr  2 09:37 tmp
drwxr-xr-x.  13 root root  155 Mar 28 10:40 usr
drwxr-xr-x.  19 root root  267 Mar 28 10:48 var
```

常见目录速查：

| 目录 | 说明 |
| --- | --- |
| `/bin` | 普通用户可执行的命令（本质是指向 `usr/bin` 的快捷方式） |
| `/sbin` | 管理员可执行的命令（本质是指向 `usr/sbin` 的快捷方式） |
| `/lib`、`/lib64` | 系统库文件（分别指向 `usr/lib`、`usr/lib64`） |
| `/boot` | 系统引导文件 |
| `/dev` | 设备文件目录，如 `/dev/cdrom`、`/dev/sda` |
| `/etc` | 系统与服务配置文件目录 |
| `/home` | 普通用户的家目录 |
| `/root` | root 用户的家目录 |
| `/media`、`/mnt` | 常用的临时挂载点 |
| `/opt` | 第三方软件安装目录 |
| `/proc` | 虚拟文件系统，目录中的数据都存储在内存中 |
| `/run` | 系统运行时的临时数据 |
| `/srv` | 服务数据目录 |
| `/sys` | 虚拟文件系统，内核与设备信息 |
| `/tmp` | 临时文件目录 |
| `/usr` | 用户程序与系统资源 |
| `/var` | 经常变化的数据，如日志 |

> **说明：** CentOS 7 把 `/bin`、`/sbin`、`/lib`、`/lib64` 全部做成指向 `/usr` 下对应目录的软链接（usr merge），这是 Fedora 推动的目录合并，目的是简化维护——两套目录合并后，`/usr` 可以在只读挂载下独立运行。`ls -l /` 输出中开头的 `l`（link）就是软链接的标志。

`mount` 不带参数时列出当前所有挂载（含挂载选项），`df -h` 则是容量视角。看"挂了什么、带什么参数"用 mount，看"还剩多少空间"用 df，两者对照着用。

## 常见存储设备的挂载方法

### 挂载 ISO 镜像文件

ISO 镜像是普通文件，需要用 `loop` 选项把它模拟成块设备：

```bash
mkdir /mnt/iso                          # 挂载点必须存在
mount -o loop /data/CentOS-7-x86_64-DVD.iso /mnt/iso
ls /mnt/iso                             # 看到镜像里的 Packages 等内容
umount /mnt/iso                         # 用完卸载
```

### 挂载 U 盘

```bash
fdisk -l                                # 插入 U 盘后查看新增的设备，如 /dev/sdb1
mkdir /mnt/usb
mount /dev/sdb1 /mnt/usb                # vfat/exfat 文件系统通常能被自动识别
mount -o iocharset=utf8 /dev/sdb1 /mnt/usb   # 中文文件名显示乱码时指定字符集
```

> **注意：** 老内核的 vfat 驱动在显示中文文件名时可能需要 `iocharset=utf8,codepage=936` 组合参数；U 盘拔除前务必先 `umount /mnt/usb`，直接热插拔可能丢数据——写缓存还没落盘，一拔就没了。

### 挂载 NTFS 分区（Windows 磁盘）

CentOS 7 内核不原生支持 NTFS 写操作，需要安装 `ntfs-3g`（EPEL 源或系统源提供）：

```bash
yum install -y ntfs-3g
mount -t ntfs-3g /dev/sdb1 /mnt/ntfs
```

较新的内核（5.15+）提供了 `ntfs3` 驱动，可以直接 `mount -t ntfs3 /dev/sdb1 /mnt/ntfs`，性能更好。

> **注意：** 挂载 NTFS 分区时要确认分区号，可以用 `lsblk -f` 或 `blkid` 查看分区的文件系统类型，避免把 ext4 分区当成 NTFS 挂载。

## 开机自动挂载：`/etc/fstab`

### 文件作用与原始示例

`/etc/fstab` 用于实现存储设备**开机自动挂载**：

```bash
[root@linux-node1 mnt]# cat /etc/fstab
UUID=e2fc8646-2b36-47cc-a35a-8c13208f4d0b /       xfs     defaults        0 0
UUID=34fc45ba-c38c-42bc-a120-90f9d5dd2382 /boot   xfs     defaults        0 0
UUID=62100743-6f8a-4f83-a37d-e2088c4830e2 swap    swap    defaults        0 0
定义存储设备文件信息                      挂载点
/dev/cdrom                                /mnt    ？？？  defaults        0 0
```

列的含义依次是：设备（或 UUID）、挂载点、文件系统类型、挂载参数、dump 备份标志、fsck 检查顺序。

### 六字段逐列详解

| 字段 | 含义 | 取值说明 |
| --- | --- | --- |
| 第 1 列：设备 | 要挂载的存储设备 | 可以写设备名（`/dev/sdb1`）、UUID（`UUID=xxx`）或卷标（`LABEL=xxx`）。生产环境推荐 UUID，重启不会变 |
| 第 2 列：挂载点 | 挂载到哪个目录 | 必须是已存在的空目录，如 `/`、`/boot`、`/data` |
| 第 3 列：文件系统类型 | 设备上的文件系统格式 | `xfs`、`ext4`、`swap`、`iso9660`、`vfat`、`ntfs-3g`，auto 表示自动识别 |
| 第 4 列：挂载参数 | 以什么方式挂载 | `defaults`（默认）、`noatime`、`nodiratime`、`ro`、`noexec` 等，多个用逗号分隔 |
| 第 5 列：dump 备份标志 | 是否被 dump 命令备份 | `0` 不备份，`1` 备份。该机制已基本废弃，一律写 `0` |
| 第 6 列：fsck 检查顺序 | 开机时磁盘检查的次序 | `0` 不检查；`1` 留给根文件系统；其他文件系统用 `2`；多个盘同为 `2` 时并行检查 |

> **注意：** 原文中光驱那行的文件系统类型处是 `？？？`（待填写），正确值是 `iso9660`——光盘的标准文件系统。完整写法为 `/dev/cdrom /mnt iso9660 defaults 0 0`。

顺带回答"开机后谁去读 fstab"：启动流程里，内核挂完根分区后，由 systemd 的 local-fs.target 逐条挂载 fstab 里的设备——`mount -a` 做的就是同一件事。fstab 出错的机器会卡进 emergency mode，挂载这一步挡在启动路径上，所以它是"改错就开不了机"的高危文件。

挂载光驱最典型的用途是做本地 yum 源：光盘里的 `Packages` 目录就是仓库本体，`baseurl=file:///mnt` 指过去即可（完整配置见《软件安装与硬件信息查看》）。机房里不能上外网的机器全靠这招。

### 配置开机自动挂载的完整步骤

```bash
blkid /dev/sdb1                          # 第一步：查出设备的 UUID 与文件系统类型
mkdir /data                              # 第二步：准备挂载点目录
vi /etc/fstab                            # 第三步：写入配置
```

```ini
UUID=12345678-1234-1234-1234-123456789abc /data xfs defaults 0 2
```

```bash
mount -a                                 # 第四步：按 fstab 挂载所有设备（不重启验证）
df -h                                    # 第五步：确认 /data 已挂载且容量正确
```

> **注意：** `mount -a` 是配置 fstab 后的标准验证动作——如果 fstab 写错，这里立刻报错，还能进系统修复；如果不经验证直接重启，fstab 错误可能导致系统无法启动（尤其在根分区配置出错时）。修改 fstab 前先 `cp /etc/fstab /etc/fstab.bak`，这里偷懒的后果是开不了机。

## 重要文件一：网卡配置文件

### 文件内容信息

```bash
[root@linux-node1 data]# ls /etc/sysconfig/network-scripts/ifcfg-eth0
/etc/sysconfig/network-scripts/ifcfg-eth0
[root@linux-node1 tmp]# cat /etc/sysconfig/network-scripts/ifcfg-eth0
TYPE=Ethernet       -- 指定网络类型：以太网 Ethernet（还有电话 10M、军用帧中继、金融 FastEthernet 等）
BOOTPROTO=none      -- 网络启动协议：如何让主机得到 IP 地址
                       a 自己手动配置 none / static（静态）
                       b 自动获取地址 dhcp（了解）
NAME=eth0           -- 主机网卡的名称，逻辑名称
UUID=31d48995-e74f-4f99-8e19-0da439ea257b   -- 虚拟主机会给每个硬件一个标识
DEVICE=eth0         -- 主机网卡的名称，设备名称（物理名称）
ONBOOT=yes          -- 设置网卡是否处于开启（激活）状态
IPADDR=10.0.0.200   -- 静态配置 IP 地址，标识主机身份，相当于人的名字
PREFIX=24           -- 定义网络中可以有多少主机（相当于房间里可以有多少人）
GATEWAY=10.0.0.2    -- 一个网络到另一个网络的必经之路（相当于人从一个国家到另一个国家的海关）
DNS1=223.5.5.5      -- DNS：建立名称和 IP 地址的对应关系，如 14.215.177.38 对应某个名称
```

各字段速查：

| 字段 | 含义 | 常见取值 |
| --- | --- | --- |
| `TYPE` | 网络类型 | `Ethernet` |
| `BOOTPROTO` | 地址获取方式 | `none` / `static`（静态）、`dhcp`（动态） |
| `NAME` | 网卡逻辑名称 | `eth0` |
| `DEVICE` | 网卡设备名称 | `eth0` |
| `UUID` | 网卡唯一标识 | 由系统生成，可用 `uuidgen` 生成新的 |
| `ONBOOT` | 是否随系统启动激活 | `yes` / `no` |
| `IPADDR` | 静态 IP 地址 | 如 `10.0.0.200` |
| `PREFIX` | 子网前缀长度（相当于子网掩码） | `24`（即 255.255.255.0） |
| `GATEWAY` | 默认网关 | 如 `10.0.0.2` |
| `DNS1` | 首选 DNS 服务器 | 如 `223.5.5.5` |

ifcfg 文件不是每个字段都要写全：TYPE、NAME 等多数有默认值，最小可用的静态配置就 ONBOOT、BOOTPROTO、IPADDR、PREFIX、GATEWAY、DNS1 六项。还有个源头关系要理清：网卡里的 DNS1 最终会被写进 `/etc/resolv.conf`——一个管源头、一个是生成结果，改错位置就会出现"改了不生效"。

> **注意：** 在 CentOS 7 中网卡命名规则与早期版本不同：物理网卡可能叫 `eno1`、`ens33` 这类名字（可预测网络设备名），`eth0` 多见于虚拟机或手动改过 `biosdevname` 的环境。记文件时以 `ip addr` 实际看到的网卡名为准。

生产服务器一律 `static`（或 `none`）手动配 IP，不用 DHCP——租约到期一换 IP，依赖这个 IP 的 DNS、监控、防火墙策略全部失效。DHCP 只留给个人练机环境。多网卡机器每块网卡一个 `ifcfg-xxx` 文件，文件名与 `DEVICE` 对应；复制旧配置改新网卡时，`UUID` 和 `DEVICE` 两项必须改，UUID 重复会让网络服务启动异常。

### 配置文件修改后重启网络服务

**方法一：针对所有网卡进行重启**

```bash
systemctl restart network
systemctl status  network
```

**方法二：企业中常见用法，针对指定网卡进行重启**

```bash
ifdown eth0 && ifup eth0
```

> **注意：** 异常问题——网卡配置文件正确，却无法重启网络服务。此时需要关闭 NetworkManager 网络管理服务：

```bash
systemctl stop NetworkManager
```

> **注意：** NetworkManager 与传统的 `network` 服务会互相覆盖配置，这是"配置改了不生效"的经典原因。两选一：要么停用 NetworkManager 用 `network` 服务（传统运维习惯），要么停用 `network` 服务、改用 NetworkManager 的命令行工具 `nmcli` 管理（现代发行版的默认做法）。远程操作时停网络服务有断开连接的风险，优先用 `ifdown eth0 && ifup eth0` 精准重启单块网卡。

## 重要文件二：DNS 解析配置文件（了解）

```bash
[root@linux-node1 ~]# vi /etc/resolv.conf
# Generated by NetworkManager
search com
nameserver 10.10.10.10
```

各字段含义：

| 字段 | 含义 |
| --- | --- |
| `nameserver` | DNS 服务器地址，最多 3 个，按顺序查询 |
| `search` | 域名后缀补全列表，解析短名时自动尝试这些后缀 |
| `domain` | 本地域名 |

把完整解析链串起来：程序发起查询 → `/etc/nsswitch.conf` 决定查找顺序 → 先查 `/etc/hosts` → 查不到再问 `/etc/resolv.conf` 里配置的 nameserver → DNS 服务器逐级向上查。排错时按这条链逐段确认，每一环都有对应的配置文件。

> **注意：** `/etc/resolv.conf` 可能被 NetworkManager、dhclient 或云主机初始化脚本自动覆盖，手动改完重启网络后丢失是正常现象——要么改网卡配置文件里的 `DNS1`，要么给 resolv.conf 加 `chattr +i` 防止被修改。域名解析不通时，先用 `ping 223.5.5.5`（测 IP）和 `ping www.example.com`（测域名）区分是网络问题还是 DNS 问题。

### 辨析：/mnt 与 /media

两个都是挂载点，习惯分工不同：`/media` 交给桌面环境自动挂载可移动设备（U 盘、光盘插上后系统自动挂到这里）；`/mnt` 留给管理员手动临时挂载。服务器上手动挂载一律用 `/mnt` 或自建目录，别跟 `/media` 抢地方。

### 辨析：/etc/hosts 与 /etc/resolv.conf

两者都和域名有关，分工完全不同：`/etc/hosts` 是本地写死的"通讯录"，查询优先级高、改完立即生效，适合内网机器互访和临时测试；`/etc/resolv.conf` 决定"去问哪个 DNS 服务器"，管的是本地查不到的所有域名。排错口诀：解析不对，先看 hosts 是不是有旧记录把域名劫持了，再去查 DNS。

## 知识卡片：目录与挂载速查

| 知识点 | 一句话结论 |
| --- | --- |
| 一切皆文件 | 设备、进程信息都是文件，靠 VFS 统一抽象 |
| 挂载本质 | 在内核挂载表登记"设备 X 挂到目录 Y" |
| 挂载点 | 必须存在的空目录，不要用有数据的目录 |
| 卸载卡住 | `target is busy`，先退出挂载点目录 |
| 查 UUID | `blkid`、`lsblk -f` |
| ISO 挂载 | `mount -o loop xxx.iso /mnt` |
| fstab 六列 | 设备、挂载点、类型、参数、dump、fsck |
| fstab 验证 | `mount -a` 不重启直接验证 |
| 根分区 fsck | 根写 `1`，其他写 `2`，swap 写 `0` |
| 能清的目录 | `/tmp`、`/var/log`（轮转）、`/run` |

## 常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `mount: mount point does not exist` | 挂载点目录不存在 | `ls -d /mnt/xxx` | 先 `mkdir` 创建挂载点 |
| `umount: target is busy` | 有进程正在使用挂载点 | `fuser -m /mnt`、`lsof +D /mnt` | 退出目录、结束进程，或用 `umount -l` |
| 挂载后找不到原文件 | 挂载点原有数据被遮住 | `ls` 对比卸载前后 | 卸载后恢复，挂载前确认是空目录 |
| 重启后设备名变成 `/dev/sdb1` | 设备名不固定 | `lsblk` 对比 | fstab 改用 UUID |
| `mount -a` 报错但能进系统 | fstab 配置错误 | 看报错行号 | 用备份恢复 `/etc/fstab.bak` 后重写 |
| fstab 写错后开不了机 | 根分区或关键挂载失败 | 进救援模式（rescue target） | 挂载根分区为 rw，修正 fstab |
| 改了网卡配置不生效 | NetworkManager 覆盖了配置 | `systemctl status NetworkManager` | 停用其一，二选一管理网络 |
| DNS 时好时坏 | resolv.conf 被自动覆盖 | `cat /etc/resolv.conf` 看生成注释 | 改 `DNS1` 或 `chattr +i` 锁定文件 |

## 现代环境补充

| 旧做法 | 现代做法 | 说明 |
| --- | --- | --- |
| `ifconfig` 看网卡 | `ip addr` | net-tools 已停止维护 |
| `netstat -lnt` | `ss -lnt` | ss 直接读内核，更快更详细 |
| `service network restart` | `systemctl restart network` | CentOS 7 起 service 只是兼容入口 |
| `route -n` 看路由 | `ip route` | 同上 |
| `fdisk -l` 看分区 | `lsblk -f` + `blkid` | lsblk 以树形展示，blkid 专查 UUID 与类型 |
| `network` 服务管网络 | NetworkManager + `nmcli` / `nmtui` | Rocky / AlmaLinux 默认 NetworkManager |

> **注意：** CentOS 7 已于 2024 年 6 月停止维护，Rocky Linux、AlmaLinux 等系统上本篇的目录标准、挂载机制、fstab 格式完全一致；差异主要在网卡命名（如 `ens160`）与网络管理工具（NetworkManager 为默认）。查询设备用 `lsblk -f` 可以一次性看到分区、UUID、文件系统类型与挂载点，是替代 `blkid` + `fdisk -l` 组合的最佳实践。

## 课后练习

1. 总结命令快捷方式。
2. 总结存储设备挂载步骤。
3. 总结目录结构作用。

**预习作业**

1. 预习系统的启动级别。
2. 预习系统的启动顺序。

## 小结

1. 熟练使用 `Ctrl + a/e/u/k/w/y` 等快捷键可以大幅提升命令行效率；`Ctrl + s` 会锁定终端，`Ctrl + q` 解锁。
2. 挂载的本质是把一个目录作为存储设备的挂载点，进入该目录即可看到设备中的数据；挂载点目录必须事先存在，且不要用有数据的目录。
3. 挂载用 `mount 设备 挂载点`，卸载用 `umount 挂载点`，卸载前先退出挂载点目录；卸载后挂载点目录恢复为空。
4. ISO 用 `mount -o loop` 挂载，U 盘挂载后卸载再拔，NTFS 需要 `ntfs-3g`。
5. Linux 目录一切从根开始，FHS 标准规定了每个目录的用途；`/etc` 放配置、`/var` 放日志等变化数据、`/proc` 数据存在内存中、`/mnt` 和 `/media` 用于挂载。
6. `/etc/fstab` 六列依次为：设备（推荐 UUID）、挂载点、文件系统类型、挂载参数、dump（写 0）、fsck（根 1 其他 2 swap 0）；改完用 `mount -a` 验证。
7. 网卡配置文件 `/etc/sysconfig/network-scripts/ifcfg-eth0` 是重点，`ONBOOT`、`IPADDR`、`PREFIX`、`GATEWAY`、`DNS1` 是最常改的几项。
8. 改完网卡配置后重启服务：`systemctl restart network` 或 `ifdown eth0 && ifup eth0`；重启失败先关掉 NetworkManager 再试。

## 自测题

1. 挂载点目录里原有数据在挂载后会怎样？卸载后呢？
2. `mount -o loop /data/xx.iso /mnt` 中的 `loop` 参数起什么作用？
3. `/etc/fstab` 的六个字段分别是什么？为什么推荐用 UUID 而不是 `/dev/sdb1`？
4. `umount /mnt` 报 `target is busy`，怎么排查和处理？
5. 一台服务器要加一块数据盘，要求开机自动挂载到 `/data`，写出完整操作步骤。

> **答案：**
> 1. 挂载后原数据被新设备的内容遮住（暂时不可见但未被删除），卸载挂载点后又恢复可见。所以挂载点必须是空目录。
> 2. `loop` 把普通文件（ISO 镜像）虚拟成一个块设备，从而可以像磁盘一样被挂载。
> 3. 六字段：设备（或 UUID）、挂载点、文件系统类型、挂载参数、dump 备份标志、fsck 检查顺序。设备名会随硬件顺序变化（重启后可能从 sdb 变 sdc），UUID 是分区唯一标识不会变，所以推荐 UUID。
> 4. 先用 `fuser -m /mnt` 或 `lsof +D /mnt` 找出占用进程（常见是自己 shell 还 cd 在挂载点里），结束进程或退出目录后再 umount；必要时 `umount -l` 懒卸载。
> 5. `fdisk -l` 确认新设备 → `mkfs.xfs /dev/sdb1` 格式化 → `blkid` 查 UUID → `mkdir /data` → 把 `UUID=xxx /data xfs defaults 0 2` 写入 `/etc/fstab` → `mount -a` 验证 → `df -h` 确认。

## 相关阅读

- 磁盘管理基础
- 磁盘管理进阶
- 重要系统文件与运行级别
- 运维网络基础（上）
- 附录-命令速查表
{% endraw %}
