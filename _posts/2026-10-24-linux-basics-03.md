---
title: "03-系统安装部署"
date: 2026-10-24 10:42:00 +0800
categories: [软件, Linux, 01-基础入门]
tags: [Linux, 01-基础入门, Linux基础]
slug: "linux-basics-03"
---

{% raw %}



装系统是运维的第一个动手环节。这一章完整走一遍 CentOS 7 的安装：引导界面、网卡命名、网络配置、三种分区方案、安全与时区、软件选择、创建用户，装完再做网络检查与远程连接；后面补上安装前规划、Rocky 9 安装差异、Kickstart 批量装机、安装后初始化和救援模式重置密码这些企业里用得上的动作。

## 原理解析：安装前先规划 {: .sec-know}

装系统前的规划决定后续运维的便利性，建议按以下清单逐项确认：

1. **硬件兼容性**：CPU 架构（x86_64/ARM/aarch64）、内存大小、磁盘接口（SATA/SAS/NVMe）、RAID 卡型号是否被系统支持。老版本系统可能不识别新硬件，新硬件建议配 Rocky 9 等新系统。
2. **RAID 配置**：物理服务器装系统前先配好 RAID（外置管理卡或开机按 Ctrl+R 进入配置界面），让系统看到的是逻辑磁盘；虚拟机则无需配置，直接给虚拟磁盘。
3. **磁盘规划**：确认每块盘的容量与用途（系统盘、数据盘），确定分区方案（详见下文三种方案）。
4. **IP 规划表**：提前规划好主机名、IP、网关、DNS、用途，避免上线后冲突。

IP 规划表示例（内网用私有地址段，主机名按用途命名）：

| 主机名 | IP 地址 | 网关 | 用途 |
| --- | --- | --- | --- |
| web01 | 10.0.0.11 | 10.0.0.1 | Nginx Web 服务器 |
| db01 | 10.0.0.12 | 10.0.0.1 | MySQL 数据库 |
| nfs01 | 10.0.0.13 | 10.0.0.1 | NFS 存储服务 |
| lb01 | 10.0.0.14 | 10.0.0.1 | 负载均衡 |
| backup | 10.0.0.15 | 10.0.0.1 | 备份服务器 |

> **注意：** 内网地址使用 10.0.0.0/8、172.16.0.0/12、192.168.0.0/16 三个私有地址段；生产环境网关、DNS 按机房实际规划填写，并同步登记到资产表。
{: .sec-pit}

## 系统架构：先选对镜像 {: .sec-expl}

不同架构识别内存的能力不同：

| 架构 | 位数 | 寻址能力 |
| --- | --- | --- |
| x86_64 | 64 位 | 2 的 64 次方 == 18EB，可支持 128G、256G 等大内存 |
| i386 | 32 位 | 2 的 32 次方 == 4G，实际可用约 3.2G ~ 3.5G |

> **注意：** 现代服务器基本都是 x86_64（或 ARM 的 aarch64），32 位系统已淘汰，内存超过 4G 时必须用 64 位系统。
{: .sec-pit}

## 系统的安装部署过程

### 第一个历程：进入引导界面进行配置 {: .sec-expl}

引导项说明：

| 引导项 | 说明 |
| --- | --- |
| Install CentOS 7 | 安装 CentOS 7 系统（常用） |
| Test this media & install CentOS 7 | 测试光盘镜像并安装系统 |
| Troubleshooting | 排错模式（修复系统、重置系统密码） |

排错模式里除了救援，还有 memtest 内存检测——服务器频繁莫名重启时先怀疑内存，跑一轮 memtest 比瞎换硬件省事得多。

#### 补充：CentOS 7 网卡名称的调整 {: .sec-ext}

- CentOS 6 默认网卡名称：`eth0`、`eth1`
- CentOS 7 默认网卡名称：`ens33`、`ens34`

如果希望沿用 `eth0` 这种命名，在选择安装项时按 `Tab` 键，追加内核参数：

```bash
net.ifnames=0 biosdevname=0
```

这个参数的作用是关闭 systemd 的可预测网卡命名（基于硬件拓扑的 `ens`/`enp` 命名），回退到传统的 `eth0` 风格。永久生效需要修改 `/etc/default/grub`，在 `GRUB_CMDLINE_LINUX` 中追加该参数后执行 `grub2-mkconfig -o /boot/grub2/grub.cfg`。

内核参数（kernel parameter）是引导时传给内核的选项，网卡命名只是其中之一。常见的还有 `nomodeset`（装系统花屏时加上）、`rescue`（直接进救援环境）。记住一点：Tab 键编辑的参数只对本次引导生效，想长期保留必须写进 grub 配置。

> **注意：** 从虚拟主机返回到 Windows 系统的方法是按 `Ctrl + Alt`，否则鼠标会被虚拟机"吃掉"。
{: .sec-pit}

### 第二个历程：设置安装语言

选择安装过程使用的语言（如简体中文 / English）。

### 第三个历程：对系统安装过程进行配置 {: .sec-expl}

#### 1. 系统网络的配置 {: .sec-expl}

进入 `SYSTEM` → `Network & Hostname`：

- `Configure` → 通用配置：**激活网卡功能**，并设置 IP 地址；
- 同时设置系统主机名。

#### 2. 系统分区的配置 {: .sec-expl}

进入 `SYSTEM` → `Installation Destination` 进行分区。Linux 常见三种分区方案：

**方案一：通用分区方案**

| 挂载点 | 说明 | 建议大小 |
| --- | --- | --- |
| `/boot` | 引导分区（相当于 C 盘的角色） | 200M |
| `swap` | 交换分区：当内存不够用时，把硬盘空间充当内存使用 | 内存 < 8G 时，建议为内存大小的 1.5 倍（如内存 1G → swap 1.5G）；内存 ≥ 8G 时，建议 8G |
| `/` | 根分区 | 剩余全部空间 |

**方案二：数据信息比较重要的分区方案**

| 挂载点 | 建议大小 |
| --- | --- |
| `/boot` | 200M |
| `swap` | 内存 < 8G 取 1.5 倍内存；内存 ≥ 8G 取 8G |
| `/` | 20G ~ 200G |
| `/data` | 剩余空间大小 |

**方案三：灵活的分区方案**

| 挂载点 | 建议大小 |
| --- | --- |
| `/boot` | 200M |
| `swap` | 内存 < 8G 取 1.5 倍内存；内存 ≥ 8G 取 8G |
| `/` | 20G ~ 200G |
| — | 剩余空间**先不分**，后续按需再分配 |

> **注意：** 灵活分区方案把剩余空间预留下来，后期扩容、新建挂载点时更自由，生产环境中很常见。
{: .sec-pit}

swap 为什么封顶 8G？内存已经够大时，再多的 swap 只是心理安慰——真用上几十 G 的 swap，机器早就慢成幻灯片了，它是应急垫子，不是内存扩容。`/boot` 分 200M 够不够？这里只放内核镜像和 initramfs，系统升级会同时保留新旧两三个内核，200M 略紧，分 500M 更稳妥。

> **原理解析：** 为什么要单独分 `/boot` 和 `/data`？`/boot` 独立出来，系统重装或内核损坏时不影响其他分区，且老版引导器对分区位置有要求；`/data` 独立出来，重装系统时数据盘可以直接保留，也可配合 LVM 在线扩容，业务数据与系统文件互不干扰。空间紧张的学习环境也可以不分区，直接全部给 `/`。

### 辨析：标准分区与 LVM {: .sec-best}

上面三种方案说的都是标准分区：容量在装系统时一次分死，后期想扩容只能靠工具折腾。LVM（逻辑卷管理）多加了一层抽象——物理磁盘先组成卷组（VG），再从卷组里切出逻辑卷（LV）给挂载点用。说白了就是把"分区"和"磁盘"解耦：磁盘可以随时加进卷组，分区可以在线扩容，`/` 满了从 VG 里划一块过去，不用停机不用搬数据。Rocky 9 默认就装成 LVM。代价是多一层概念，排障多一步。生产环境容量会涨的机器（数据库、日志机），一开始就用 LVM。

#### 3. 系统安全的配置（本阶段关闭） {: .sec-expl}

| 配置项 | 说明 |
| --- | --- |
| `SYSTEM` → `KDUMP` | 将宕机前系统中的内存异常信息进行保存，学习环境可关闭 |
| `SYSTEM` → `SECURITY POLICY` | 系统的安全策略配置，学习环境可关闭 |

#### 4. 系统时区的设置

进入 `LOCALIZATION` → `Date & Time`，选择所在时区（如 Asia/Shanghai）。

时区错了别将就：日志时间全乱套，排障时对不上账。装完顺手确认 chronyd 在跑、时间同步正常，这一分钟的前期投入能省掉后面数小时的"为什么两台机器日志时间差八小时"。

#### 5. 系统软件的安装

进入 `SOFTWARE` → `Software Selection`，选择**最小化安装**（对应 1、2、3、6 这几个环境包）。

> **注意：** 生产环境同样推荐最小化安装：软件包越少，攻击面越小、补丁维护量越小、系统资源占用越低。需要什么服务再单独装，是运维的基本原则。
{: .sec-pit}

> **注意：** UEFI 机器装系统时分区方案多一项：引导要用 EFI 系统分区（ESP，通常 500M、FAT 格式），替代传统 BIOS 下 `/boot` 的引导角色；装 2 TB 以上的大系统盘则必须 UEFI + GPT。新手容易栽在这：照着 BIOS 机器的分区方案直接套，装完引导不起来。
{: .sec-pit}

### 第四个历程：创建系统用户

- 系统管理员用户：`root`，设置密码；
- 系统普通用户：创建一个普通用户并设置密码（日常操作建议用普通用户，需要权限时再提权）。

生产里通常还会禁用 root 直接 SSH 登录（`PermitRootLogin no`），所有人用普通用户 + sudo 干活——审计日志里能看出"谁"做了操作，全是 root 就查无可查。

#### 补充：运维工作流程 {: .sec-ext}

1. 准备 / 检查好环境；
2. 进行操作前的备份（给自己留退路）；
3. 进行配置之后注意保存；
4. 配置完成需要检查；
5. 编写项目文档。

## CentOS 7 与 Rocky 9 安装差异

CentOS 7 已于 2024 年 6 月 30 日 EOL，新系统建议直接装 Rocky Linux 9。安装器同为 Anaconda，界面逻辑相似，但细节差异如下：

| 对比项 | CentOS 7 | Rocky 9 |
| --- | --- | --- |
| 安装器界面 | 经典 Anaconda 界面 | Anaconda Web UI，布局略有调整 |
| 默认网卡名 | `ens33` 等（可 kernel 参数改回 eth0） | `enp1s0` 风格，同样支持 `net.ifnames=0` |
| 默认分区 | 标准分区或 LVM | 默认 LVM，自动分区更智能 |
| 安全模块 | SELinux（可关）、firewalld | SELinux 默认 enforcing、firewalld 默认开启 |
| 时间同步 | chrony | chrony（默认启用） |
| 网络工具 | `nmtui`、`ifconfig`（net-tools） | `nmtui` 保留，`ifconfig` 需自行安装 |
| 安装源 | DVD 或网络源 | DVD、网络源、Kickstart 均支持 |
| 支持周期 | 已 EOL | 约 10 年 |

## Kickstart 自动安装

**Kickstart** 是 Red Hat 系系统提供的无人值守自动安装技术：把安装过程中需要回答的问题（语言、分区、网络、用户、软件包）预先写成一个应答文件（通常命名为 `ks.cfg`），安装时通过内核参数指定该文件的位置，安装器即可全自动完成安装，无需人工交互。批量装机、云主机镜像定制都依赖它。

使用方式：引导界面按 `Tab`（或 `e`）编辑启动项，追加内核参数：

```bash
inst.ks=http://10.0.0.1/kickstart/ks.cfg
```

最小可用的 Kickstart 示例：

```text
# 安装源：使用 HTTP 网络源
install
url --url=http://mirrors.aliyun.com/rocky/9/BaseOS/x86_64/os/
lang en_US.UTF-8
keyboard us
# 网络配置：静态 IP
network --bootproto=static --ip=10.0.0.100 --netmask=255.255.255.0 --gateway=10.0.0.1 --nameserver=10.0.0.1 --device=ens160 --onboot=yes
# root 密码（加密串，可用 openssl passwd -6 生成）
rootpw --iscrypted <your-password>
firewall --enabled
selinux --enforcing
timezone Asia/Shanghai --utc
bootloader --location=mbr
# 磁盘：清空并初始化所有分区
clearpart --all --initlabel
part /boot --fstype=xfs --size=500
part swap --size=2048
part / --fstype=xfs --grow --size=1
reboot
# 软件包选择
%packages
@core
%end
```

> **注意：** Kickstart 文件中写明文密码等于泄露口令，生产环境应使用 `rootpw --iscrypted` 加密码哈希；本示例统一用 `<your-password>` 占位。`inst.ks` 支持 http、https、ftp、nfs 以及本地路径（如 `inst.ks=cdrom:/ks.cfg`）。生成 ks.cfg 还有一个捷径：装完一台机器后，root 家目录下的 `anaconda-ks.cfg` 就是本次安装的应答记录，可改作模板复用。
{: .sec-pit}

批量装机的完整链路一般三层：DHCP 分地址 → PXE 网络引导 → Kickstart 应答。机器上架插网线通电就能自己装完，机房里不用搬键盘显示器——几十台服务器同时上架时，这是唯一现实的做法。ks.cfg 里还能写 `%post` 段，装完系统自动执行初始化脚本（改 sshd 配置、装基础软件包），装机和初始化一口气完成。

## 网络检查确认工作 {: .sec-ver}

1. 确认网卡配置是否正确；
2. 确认外网连接正常。

```bash
ping 10.0.0.200    # Linux 下的 ping 会一直持续，需要用 Ctrl + C 停止
```

> **注意：** Linux 系统中的 `ping` 是一个长期停不下来的过程，不像 Windows 默认只发 4 个包。
{: .sec-pit}

ping 不通外网时按顺序查：先 ping 网关，再 ping 公网 IP（如 223.5.5.5），最后 ping 域名。网关不通查 IP 配置，IP 通域名不通查 DNS——分层排查，一次定位一层，别一上来就乱改配置。

### 网络常见问题分析

**01. 网卡地址配置不正确**

- a. 网卡地址和虚拟主机的网卡地址不统一；
- b. 网关和 DNS 的信息不正确。

**02. 如何重新配置网卡地址信息**

- a. 通过系统命令重新配置网卡地址信息：

```bash
nmtui
```

配置时需要理解三个概念：

| 概念 | 作用 |
| --- | --- |
| IP 地址 | 网络通讯标识信息 |
| 子网掩码 | 决定在局域网中可以有多少个主机 |
| 网关地址 | 从一个局域网（如中国）到另一个局域网（如美国）的必经之路 |

- b. 让配置生效，重启网卡服务：

```bash
systemctl restart network
```

> **注意：** Linux 系统执行命令的特点——一个命令执行完，没有消息就是最好的结果（无输出即成功）。
{: .sec-pit}

> **现代环境补充：** Rocky 9 等新系统默认由 NetworkManager 管理网络，改完配置除了 `systemctl restart NetworkManager`，也可以用 `nmcli con reload` 让配置重新加载。排障时用 `nmcli dev status` 查看网卡连接状态，用 `ip addr`、`ip route` 核对地址与路由。

工具选择上有条经验：nmtui 是给人点的，nmcli 是给脚本调的。批量改几十台机器的地址时，把 nmcli 命令写进脚本跑，比一台台开 nmtui 点界面现实得多。

顺带说清三种网络模式的区别，装虚拟机时经常要选：NAT 是借宿主机的 IP 上网，虚拟机之间互相独立；桥接是局域网里的独立住户，占用真实网段的 IP；仅主机是只跟宿主机通话的孤岛。学习环境用 NAT 最省心，要模拟生产多机组网再上桥接。

## 实现远程连接

常用远程软件类型：

| 软件 | 收费情况 | 特点 |
| --- | --- | --- |
| Xshell | 免费（个人版） | 功能比较强大，实用 |
| SecureCRT | 收费 | 功能丰富 |
| PuTTY | 免费 | 功能简单 |

配置要点：协议选 SSH，主机填虚拟主机的 IP 地址，端口 22，然后输入用户名和密码登录。

顺带说一句改端口这件事：把 SSH 默认端口 22 改掉属于"防扫描"级别的加固，挡得住脚本小子挡不住定向攻击，真正的安全靠密钥登录 + sudo 审计。端口改不改按公司规范来，别当成主要防线。

## 安装后初始化配置 {: .sec-expl}

装好系统只是开始，下面几项初始化是企业装机的标准动作。

### 网卡配置文件逐行详解 {: .sec-expl}

CentOS 7 的网卡配置在 `/etc/sysconfig/network-scripts/` 目录下，每个网卡一个 `ifcfg-` 开头的文件，例如 `/etc/sysconfig/network-scripts/ifcfg-ens33`：

```ini
TYPE=Ethernet
BOOTPROTO=static
DEVICE=ens33
ONBOOT=yes
IPADDR=10.0.0.100
NETMASK=255.255.255.0
GATEWAY=10.0.0.1
DNS1=10.0.0.1
DNS2=114.114.114.114
NM_CONTROLLED=yes
```

| 配置项 | 含义 | 说明 |
| --- | --- | --- |
| `TYPE` | 网卡类型 | 以太网填 `Ethernet` |
| `BOOTPROTO` | 地址获取方式 | `static` 静态、`dhcp` 动态、`none` 不配置地址 |
| `DEVICE` | 网卡名称 | 必须与 `ip addr` 看到的真实网卡名一致，否则配置不生效 |
| `ONBOOT` | 开机是否启用 | `yes` 开机激活网卡，`no` 则不激活 |
| `IPADDR` | IP 地址 | 静态方式时填写 |
| `NETMASK` | 子网掩码 | 与 IP 配套 |
| `GATEWAY` | 网关地址 | 访问外网的出口 |
| `DNS1`/`DNS2` | DNS 服务器 | 主 / 备 DNS |
| `NM_CONTROLLED` | 是否允许 NetworkManager 管理 | `yes` 允许（默认），`no` 则只由 network 服务管理 |

改完配置文件后重启网卡服务生效：`systemctl restart network`。

一个高频坑：改了 ifcfg 却忘 `ONBOOT=yes`，重启后网卡根本没起来，远程连接直接失联，只能接显示器或走 BMC 控制台救火。装完系统第一时间核对这一项，再关掉虚拟机。

### 三种设置主机名的方法

| 方法 | 命令 / 操作 | 特点 |
| --- | --- | --- |
| 临时设置 | `hostname web01` | 立即生效，重启后失效 |
| 永久设置（推荐） | `hostnamectl set-hostname web01` | systemd 提供，立即生效且重启保留 |
| 修改配置文件 | 编辑 `/etc/hostname`，写入主机名 | 重启后生效 |

无论哪种方法，都建议同步在 `/etc/hosts` 中加入本机 IP 与主机名的映射，避免 DNS 解析延迟导致的启动变慢：

```text
127.0.0.1   localhost localhost.localdomain
10.0.0.11   web01
```

### DNS 配置 {: .sec-expl}

Linux 的 DNS 解析配置在 `/etc/resolv.conf`：

```ini
nameserver 10.0.0.1
nameserver 114.114.114.114
search example.com
```

- `nameserver`：指定 DNS 服务器，按顺序查询，最多 3 个生效；
- `search`：解析不完整域名时自动补全的域后缀。

> **注意：** 如果使用 NetworkManager（或 DHCP），`/etc/resolv.conf` 可能被自动覆盖，通过修改网卡 ifcfg 文件中的 `DNS1`/`DNS2` 或 `nmcli` 修改连接配置才是长久之计。直接编辑 `/etc/resolv.conf` 可能重启后失效。
{: .sec-pit}

## VMware 虚拟机安装注意事项 {: .sec-warn}

| 注意事项 | 说明 |
| --- | --- |
| 虚拟机网络模式 | 学习阶段推荐 NAT（共享主机 IP 上网）或仅主机模式；桥接模式让虚拟机获得与主机同网段的独立 IP |
| 磁盘接口类型 | CentOS 7 选 LSI Logic SAS 或 SCSI 兼容性好；新系统可选 NVMe 模拟 |
| 磁盘置厚 / 置薄 | 置薄按需增长节省空间，置厚性能更好，按宿主机磁盘余量选择 |
| 内存与 CPU 分配 | 学习环境 2G 内存、2 核足够，不要超分宿主机物理资源 |
| 挂载 ISO 镜像 | 启动前确认已挂载系统 ISO，安装完成后记得弹出，避免循环进入安装界面 |
| 释放鼠标键盘 | 按 `Ctrl + Alt` 从虚拟机切回宿主机 |
| 安装 VMware Tools | 装好后安装 Tools，可改善分辨率、支持拖拽共享文件 |
| 关闭与重启 | 先 `shutdown` 或 `poweroff` 正常关机，再关闭虚拟机，避免虚拟磁盘损坏 |
| 快照功能 | 重大操作前打快照，出问题可秒回滚，是练习神器 |

快照最好在关机状态下打：开机态快照要连内存一起存，文件更大、恢复更慢。练习装系统这种"一步一坑"的操作，每过一关打一个快照，搞砸了秒回滚，重装系统的时间全省下来。

## 救援模式重置 root 密码

忘记 root 密码时，无需重装系统，通过救援模式即可重置。完整步骤如下：

救援模式的本质，是借安装盘里的迷你系统把原系统挂起来改。所以对应版本的安装 ISO/U 盘要一直备着——机房抽屉里存几个常用版本的安装盘，是老运维的习惯。

1. 开机，在引导界面选择 `Troubleshooting` → `Rescue a CentOS system`，按回车进入。
2. 出现交互提示（询问是否查找并挂载原系统、是否进入 chroot）时按回车继续，系统会尝试把原系统挂载到 `/mnt/sysimage`。
3. 提示是否 chroot 进入挂载的系统时，输入 `1` 并回车（选择 Continue）。
4. 进入 chroot 环境，把根目录切换为原系统：

```bash
chroot /mnt/sysimage
```

5. 直接修改 root 密码，按提示输入两次新密码：

```bash
passwd root
```

6. SELinux 开启的系统必须执行重打标签，否则可能无法正常登录：

```bash
touch /.autorelabel
```

7. 连续两次 `exit` 退出 chroot 和救援环境，系统自动重启。首次启动会因重打标签稍慢，属正常现象。
8. 重启后用新密码登录验证。

> **注意：** 整个过程是本地物理操作，从安全设计上就假定"能摸到机器"即拥有最高权限。若服务器托管在机房，需要联系机房人员协助或使用远程管理卡（iDRAC/iLO）重定向完成。RHEL 8 / Rocky 9 的等价做法是在启动菜单按 `e`，找到以 `linux` 开头的行，把 `ro` 改成 `rw init=/bin/bash`，按 `Ctrl + x` 进入单用户 shell，执行 `passwd root` 与 `touch /.autorelabel` 后 `exec /sbin/init` 重启。
{: .sec-pit}

补一句 `/.autorelabel` 的原理：SELinux 给每个文件都打了安全上下文标签，救援模式改的 `/etc/shadow` 没带正确标签，下次登录就会因为上下文不符被拒。`touch /.autorelabel` 是告诉系统下次开机把全盘标签重打一遍——这就是首次启动明显变慢的原因，属正常流程，别中途断电。

## 知识卡片 {: .sec-know}

| 命令 / 文件 | 用途 |
| --- | --- |
| `nmtui` | 文本图形化网络配置工具 |
| `systemctl restart network` | 重启网卡服务使配置生效 |
| `hostnamectl set-hostname web01` | 永久设置主机名 |
| `/etc/sysconfig/network-scripts/ifcfg-*` | 网卡配置文件 |
| `/etc/resolv.conf` | DNS 解析配置 |
| `ip addr` / `ip route` | 查看网卡地址与路由（替代 `ifconfig`/`route`） |
| `inst.ks=http://xxx/ks.cfg` | Kickstart 无人值守安装参数 |
| `anaconda-ks.cfg` | 安装后自动生成的应答文件，可作 Kickstart 模板 |

## 常见错误与排错 {: .sec-ts}

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| ping 网关不通 | IP / 掩码 / 网关配置错误，或网卡未激活 | `ip addr`、`ip route`、`nmcli dev status` | 核对 ifcfg 文件，用 `nmtui` 重新配置后重启网卡服务 |
| Xshell 连不上虚拟机 | sshd 服务未启动、防火墙拦截或 IP 不通 | `ss -tlnp \| grep 22`、`systemctl status sshd`、`firewall-cmd --list-services` | 启动 sshd 并设置开机自启，放行防火墙或关闭防火墙（学习环境） |
| 修改 ifcfg 后不生效 | `DEVICE` 与实际网卡名不符，或 `ONBOOT=no` | `ip addr` 查看真实网卡名、`nmcli con show` | 修正 `DEVICE` 与 `ONBOOT`，重启 network 或 NetworkManager |
| 重启后网卡名从 eth0 变回 ens 系 | `net.ifnames=0` 参数未写入 grub，重启丢失 | `ip addr`、`cat /etc/default/grub` | 在 `GRUB_CMDLINE_LINUX` 追加参数并 `grub2-mkconfig -o /boot/grub2/grub.cfg` 重建引导 |
| 救援模式改完密码仍无法登录 | 未执行 `.autorelabel`，SELinux 文件上下文不匹配 | `ls -Z /etc/shadow`、`getenforce` | chroot 后执行 `touch /.autorelabel` 再重启 |

## 现代环境补充 {: .sec-ext}

1. **CentOS 7 已于 2024-06-30 EOL**：新系统安装 Rocky Linux 9 或 AlmaLinux 9，安装流程与本文一致，分区、网络、Kickstart 思路通用。
2. **网卡命名**：Rocky 9 默认 `enp1s0` 等可预测命名，如运维脚本依赖 `eth0`，同样用 `net.ifnames=0 biosdevname=0` 改回。
3. **网络管理**：NetworkManager 已是事实标准，`nmtui`、`nmcli`、ifcfg 文件三种方式并存；`ifconfig` 等旧命令来自 net-tools，已废弃，建议用 `ip`。
4. **防火墙**：CentOS 7 的 `firewalld` 在 Rocky 9 中默认启用，开放端口用 `firewall-cmd --add-service=ssh --permanent` 后 `--reload`；下一代规则引擎为 nftables。
5. **自动化装机**：Kickstart 之外，云环境还有 Ignition（CoreOS 系）、cloud-init（云主机首次启动配置）等机制，思路都是"用文件描述系统初始状态"。

## 课后练习 {: .sec-prac}

**基础作业**

1. 编写系统安装过程文档。
2. 总结系统分区方案（3 种）。
3. 总结网络配置方法（IP 地址、网关、主机名）。
4. 总结网络异常问题的排错方法。

**扩展作业**

1. 如何利用 CentOS 7 的排错模式重置密码？

## 自测题 {: .sec-prac}

1. CentOS 7 如何把默认网卡名 `ens33` 改回 `eth0`？
2. 网卡 ifcfg 文件中 `ONBOOT=yes` 的作用是什么？
3. 永久设置主机名有哪几种方式？
4. 救援模式重置 root 密码的关键步骤有哪些？
5. swap 分区大小的常规建议是什么？

> **答案：** 1. 引导界面选中安装项按 `Tab`，追加内核参数 `net.ifnames=0 biosdevname=0`；永久生效需写入 `/etc/default/grub` 并执行 `grub2-mkconfig -o /boot/grub2/grub.cfg`。2. 设置网卡随系统开机自动激活，否则重启后网卡不启用、无法远程连接。3. `hostnamectl set-hostname 主机名`（推荐）、修改 `/etc/hostname`、`hostname 主机名`（仅临时生效，重启丢失）。4. 引导界面选 Troubleshooting → Rescue → 按提示继续并 chroot 到 `/mnt/sysimage` → `passwd root` → `touch /.autorelabel` → 退出重启。5. 内存小于 8G 时取内存的 1.5 倍，内存大于等于 8G 时取 8G。

## 相关阅读

- 计算机硬件组成
- Linux 系统概念
- 虚拟软件与远程连接
- 目录结构与挂载
- 运维网络基础-上

## 小结 {: .sec-sum}

1. 安装镜像要按架构选择：x86_64（64 位）寻址能力远高于 i386（32 位）。
2. CentOS 7 默认网卡名为 `ens33`，可通过启动参数 `net.ifnames=0 biosdevname=0` 改回 `eth0` 风格。
3. 分区有三种思路：通用方案（`/boot` + `swap` + `/`）、重要数据方案（额外分 `/data`）、灵活方案（剩余空间预留）。
4. swap 交换分区在内存不足时充当内存：内存小于 8G 取 1.5 倍，大于等于 8G 取 8G。
5. 学习环境建议最小化安装；装完先检查网卡配置和外网连通性，再用远程工具连接。
6. 运维操作要遵循流程：检查环境 → 操作前备份 → 配置后保存 → 完成后检查 → 编写文档。
7. 装机前先规划：硬件兼容性、RAID 配置、磁盘用途、IP 规划表，一项都不能少。
8. Kickstart 应答文件实现无人值守安装，装完系统后自动生成的 `anaconda-ks.cfg` 可直接改作模板。
9. 安装后初始化三件套：网卡 ifcfg 配置、主机名设置、DNS 配置，都要确保重启后依然有效。
10. 忘记 root 密码不用重装：救援模式 chroot 后 `passwd root`，SELinux 系统记得 `touch /.autorelabel`。
11. CentOS 7 已 EOL，新系统装 Rocky 9 / AlmaLinux，安装流程与本文通用，工具向 `nmcli`、`ip`、`ss`、`firewalld` 迁移。


{% endraw %}
