---
title: "day03-系统安装作业实操"
date: 2026-10-24 09:55:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-03"
---

{% raw %}

课程第 3 天讲系统安装部署。基础作业 3 题、扩展 1 题，照旧逐题实做，过程和验证结果都留在本篇里。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：文件写入与查看类操作（cat 写配置、grep 核对、wc 统计等）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`。
- **B 级（标准命令 + 预期输出）**：安装过程、系统级命令（ip、ping、dig、systemctl、hostnamectl 等）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `（预期输出，CentOS 7）`，并说明在真机执行方式。

实操目录统一用 `/tmp/hw/day3`，示例中先 `cd` 到该目录后用相对路径，读者可复制。

```bash
mkdir -p /tmp/hw/day3 && cd /tmp/hw/day3
```

安装过程的完整图文步骤见主笔记，本篇按可复现手册的要求整理为步骤清单与检查项。

## 题 1：编写系统安装过程文档

**考察点**：CentOS 7 的安装过程要能整理成一份拿来就能用的装机文档。

**实现思路**：按安装向导实际走过的顺序拆成四步清单，每步标注关键决策点和完成标志。装机时对着清单逐项打勾，不容易漏。

**实操过程**：

步骤 1：安装前准备。

| 准备项 | 要求 |
| --- | --- |
| 系统镜像 | CentOS 7 x86_64 DVD ISO（或 Everything / Minimal 版） |
| 虚拟 / 物理机 | 至少 2G 内存、2 核 CPU、20G 磁盘（学习环境） |
| 启动方式 | BIOS 设为从光盘 / ISO 启动；新服务器注意 UEFI 与 Secure Boot |
| 远程工具 | Xshell / SecureCRT / PuTTY，协议 SSH，端口 22 |

步骤 2：安装四步清单。

| 步骤 | 界面操作 | 关键决策点 | 完成标志 |
| --- | --- | --- | --- |
| 第一步：进入引导界面 | 选择 Install CentOS 7，回车 | Test this media 用于校验镜像；Troubleshooting 用于救援（见扩展作业） | 出现语言选择界面 |
| 第二步：设置安装语言 | 选简体中文或 English | 安装语言不影响系统最终语言环境 | 进入安装汇总界面 |
| 第三步：安装配置 | 依次完成网络、分区、安全、时区、软件五配置（见下表） | 网络激活并设 IP；分区按方案选择；安全本阶段关闭 | 五项无告警，Begin Installation 可点 |
| 第四步：创建用户 | 设 root 密码，按需创建普通用户 | root 密码复杂度要够；忘记可用救援模式重置 | 安装进度跑完自动重启 |

第三步的五项配置明细：

| 配置项 | 入口 | 要点 |
| --- | --- | --- |
| 网络 | SYSTEM → Network & Hostname | 激活网卡，设静态 IP 与主机名 |
| 分区 | SYSTEM → Installation Destination | 按分区方案操作（见题 2），勾选"我要自己配置分区" |
| 安全 | SYSTEM → Security Policy | 学习 / 测试阶段关闭，生产再按等保要求开启 |
| 时区 | SYSTEM → Date & Time | Asia / Shanghai，建议开启网络时间 |
| 软件 | SYSTEM → Software Selection | 最小安装选 Minimal Install；需要图形界面选 GNOME |

步骤 3：安装后初始化检查。

（预期输出，CentOS 7）

```bash
# 确认系统版本
cat /etc/redhat-release
# 确认网卡与 IP
ip a
# 确认主机名
hostname
# 确认磁盘与分区
lsblk
# 确认远程登录服务正常
systemctl status sshd
```

```console
CentOS Linux release 7.9.2009 (Core)
```

步骤 4：把清单存档为模板。建议把上述四步清单 + 分区方案 + 网络参数固化成装机 checklist，每装一台逐项打勾，避免批量装机时遗漏网络激活这类高频失误。

**验证方法**：重启后能用 root 从 Xshell 登录；`ip a` 显示的 IP 与规划一致；`lsblk` 分区与所选方案一致；`cat /etc/redhat-release` 显示预期版本。四项全过即安装成功。

> **易错点**：
> - 忘记激活网卡：安装时不打开网卡开关，装完系统没有 IP，无法远程连接。
> - 安装完成没弹出 ISO：重启后又进入安装界面，形成"安装循环"。
> - 虚拟机磁盘接口选错：CentOS 7 选 LSI Logic SAS 兼容性好；模式不对会出现找不到硬盘。
> - UEFI 模式装老系统异常：找不到硬盘或引导失败时，尝试关闭 Secure Boot 或切 Legacy。
> - 误操作清空磁盘：生产装机前确认磁盘上无业务数据，重要数据先备份。

> **参见**：系统安装部署 全文（完整图文流程与 CentOS 7 / Rocky 9 差异）。

## 题 2：总结系统分区方案（3 种）

**考察点**：三种分区方案各自的挂载点怎么划、适合什么场景、代价是什么，都要说得清。

**实现思路**：一张对比表摆出三种方案的完整划分，本地真跑一份分区规划单生成脚本，再补真机验证命令。方案、规划单、验证三样凑齐。

**实操过程**：

步骤 1：三种分区方案对比。

| 对比项 | 方案一：通用方案 | 方案二：数据重要方案 | 方案三：灵活方案 |
| --- | --- | --- | --- |
| /boot | 200M | 200M | 200M |
| swap | 内存 < 8G 取 1.5 倍内存；内存 ≥ 8G 取 8G | 同左 | 同左 |
| / | 剩余全部空间 | 20G ~ 200G | 20G ~ 200G |
| /data | 无 | 剩余空间 | 无 |
| 剩余空间 | — | — | 先不分，后续按需分配 |
| 适用场景 | 学习环境、普通测试机 | 数据与系统需分离的生产机 | 后期可能扩容 / 加盘的生产机 |
| 主要优点 | 简单，不会浪费空间 | 重装系统不动数据 | 扩容自由，可配合 LVM |
| 主要缺点 | 系统盘满会拖垮全局 | 空间预估要准 | 需要后期规划，不省事 |

三种方案的 swap 规则一致：内存小于 8G 时建议 swap 为内存的 1.5 倍（如内存 1G 则 swap 1.5G）；内存大于等于 8G 时 swap 取 8G 即可。

swap 为什么必须留：物理内存不够时，内核把不活跃的冷数据页换出到磁盘，给活跃进程腾地方——没有 swap，内存一满就直接触发 OOM killer 杀进程，连挣扎的机会都没有。学习机可以给小一点，但不能没有。

步骤 2：理解为什么要单独分 /boot 和 /data。

- /boot 独立：系统重装或内核损坏时不影响其他分区，老版引导器对分区位置有要求。
- /data 独立：重装系统时数据盘可保留，配合 LVM 还能在线扩容，业务数据与系统文件互不干扰。
- 空间紧张的学习环境可以不分区，全部给 /。

步骤 3：生成本机适用的分区规划单（按实际内存计算 swap）。

`已实操`：

```bash
# 步骤 1：声明规划参数（内存 2G 的测试机，磁盘 100G）
MEM=2
DISK=100
# 步骤 2：按规则计算 swap：内存 < 8G 取 1.5 倍
SWAP=$(awk -v m=$MEM 'BEGIN{printf "%.1f", m*1.5}')
# 步骤 3：生成规划单文件
{
  echo "磁盘: ${DISK}G (系统显示约 $(awk -v d=$DISK 'BEGIN{printf "%.1f", d*0.9313}')GiB)"
  echo "/boot  : 200M   (引导分区)"
  echo "swap   : ${SWAP}G (内存 ${MEM}G x 1.5)"
  echo "/      : 20G    (根分区)"
  echo "/data  : 剩余空间 (约 $(awk -v d=$DISK 'BEGIN{printf "%.1f", d*0.9313-20-2}')GiB)"
} > partition-plan.txt
cat partition-plan.txt
```

输出：

```console
磁盘: 100G (系统显示约 93.1GiB)
/boot  : 200M   (引导分区)
swap   : 3.0G (内存 2G x 1.5)
/      : 20G    (根分区)
/data  : 剩余空间 (约 71.1GiB)
```

步骤 4：真机验证分区结果。

（预期输出，CentOS 7）

```bash
# 查看分区与挂载点对应关系
lsblk
# 查看各挂载点使用率
df -h
```

```console
NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda      8:0    0  100G  0 disk
├─sda1   8:1    0    1G  0 part /boot
├─sda2   8:2    0    4G  0 part [SWAP]
└─sda3   8:3    0   95G  0 part /
```

`df -h` 输出中各挂载点独立成行（如 /boot、/data 各自一行），即证明分区按方案落实。

**验证方法**：`lsblk` 的分区数量与挂载点和所选方案逐项对应；`df -h` 能看到 /boot 与 /data 独立行；写入大文件到 /data 后 `/` 的使用率不增长，证明数据与系统已隔离。

> **易错点**：
> - 只分一个 /：某天日志或数据把根分区写满，系统服务直接受影响，恢复要进救援模式。
> - swap 拍脑袋：内存 1G 只给 512M swap，稍有大应用就 OOM；盲目给超大 swap 也浪费磁盘。
> - /boot 给太小：多个内核升级后 /boot 写满，更新失败，200M 是经验下限，装多系统的酌情加大。
> - 装机时误删原有数据分区：生产环境操作前用 lsblk 确认盘符，重要数据先备份再动手。
> - LVM 与传统分区混装不清：方案三后续加 LVM 时，先把剩余空间建成 PV，再建 VG、LV，顺序别反。

> **参见**：系统安装部署 的"系统的分区配置"。

## 题 3：总结网络配置方法（IP 地址、网关、主机名）

**考察点**：能否说清 CentOS 7 网络配置的三个层次——网卡 ifcfg 文件、主机名、DNS，并给出每种的配置写法与生效方式。

**实现思路**：先在本地真写出一份标准 ifcfg 配置（A 级），逐行讲每个参数是干嘛的；主机名三种设置方法、DNS 配置各给一张对比表，收尾补真机验证命令。

**实操过程**：

步骤 1：写出标准网卡配置文件（CentOS 7 路径为 /etc/sysconfig/network-scripts/ifcfg-ens33，此处先在实操目录生成样例再逐行讲解）。

`已实操`：

```bash
# 步骤 1：按标准模板写出 ifcfg 配置样例
cat > ifcfg-ens33 <<'EOF'
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
EOF
```

```bash
# 步骤 2：读回文件，核对内容
cat ifcfg-ens33
```

输出：

```console
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

步骤 2：逐行讲解 ifcfg 文件参数。

| 配置项 | 含义 | 说明 |
| --- | --- | --- |
| TYPE | 网卡类型 | 以太网填 Ethernet |
| BOOTPROTO | 地址获取方式 | static 静态、dhcp 动态、none 不配置地址 |
| DEVICE | 网卡名称 | 必须与 ip addr 看到的真实网卡名一致，否则配置不生效 |
| ONBOOT | 开机是否启用 | yes 开机激活网卡，no 则不激活 |
| IPADDR | IP 地址 | 静态方式时填写 |
| NETMASK | 子网掩码 | 与 IP 配套，也可用 PREFIX=24 代替 |
| GATEWAY | 网关地址 | 访问外网的出口 |
| DNS1 / DNS2 | DNS 服务器 | 主 / 备 DNS |
| NM_CONTROLLED | 是否允许 NetworkManager 管理 | yes 允许（默认），no 则只由 network 服务管理 |

改完配置文件后重启网卡服务生效：systemctl restart network。

步骤 3：主机名三种设置方法对比。

| 方法 | 命令 / 操作 | 特点 |
| --- | --- | --- |
| 临时设置 | hostname web01 | 立即生效，重启后失效 |
| 永久设置（推荐） | hostnamectl set-hostname web01 | systemd 提供，立即生效且重启保留 |
| 修改配置文件 | 编辑 /etc/hostname，写入主机名 | 重启后生效 |

无论哪种方法，都建议同步在 /etc/hosts 中加入本机 IP 与主机名的映射，避免 DNS 解析延迟导致的启动变慢：

```bash
# 生成本地 hosts 映射样例
cat > hosts-sample <<'EOF'
127.0.0.1   localhost localhost.localdomain
10.0.0.11   web01
EOF
cat hosts-sample
```

输出：

```console
127.0.0.1   localhost localhost.localdomain
10.0.0.11   web01
```

步骤 4：DNS 配置。Linux 的 DNS 解析配置在 /etc/resolv.conf：

```bash
cat > resolv.conf-sample <<'EOF'
nameserver 10.0.0.1
nameserver 114.114.114.114
search example.com
EOF
cat resolv.conf-sample
```

输出：

```console
nameserver 10.0.0.1
nameserver 114.114.114.114
search example.com
```

| 指令 | 作用 |
| --- | --- |
| nameserver | 指定 DNS 服务器，按顺序查询，最多 3 个生效 |
| search | 解析不完整域名时自动补全的域后缀 |

注意：如果使用 NetworkManager（或 DHCP），/etc/resolv.conf 可能被自动覆盖，通过 ifcfg 文件中的 DNS1 / DNS2 或 nmcli 修改连接配置才是长久之计。

为什么会覆盖：NetworkManager 接管网络后，从 DHCP 拿到的 DNS 会由它写进 /etc/resolv.conf，你手工改的内容在下一次租约更新或重启时就被冲掉了。要么在 ifcfg 里配 DNS1/DNS2 让 NM 替你写，要么用 nmcli 改连接配置——源头改对了，文件自然长期正确。

步骤 5：真机验证网络配置。

（预期输出，CentOS 7）

```bash
# 查看网卡状态与 IP
ip a
# 测试网关连通性
ping -c 4 10.0.0.1
# 确认主机名
hostnamectl status
```

```console
2: ens33: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 00:0c:29:1a:2b:3c brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.100/24 brd 10.0.0.255 scope global ens33
       valid_lft forever preferred_lft forever
```

**验证方法**：ip a 显示 ens33 拿到 10.0.0.100/24；ping 网关 4 个包全通；hostnamectl status 的 Static hostname 为设置值且重启后仍在。三项全过即配置正确。

> **易错点**：
> - ONBOOT=no：配置文件写了但开机不激活，表现是"配置都对就是没网"。
> - DEVICE 名与真实网卡名不一致：CentOS 7 默认 ens33，改成 eth0 风格需要内核参数 net.ifnames=0。
> - 直接改 /etc/resolv.conf：重启或被 DHCP 覆盖后失效，要从 ifcfg 或 nmcli 改。
> - 网关填错：本机 ping 得通、外网 ping 不通，先核对 GATEWAY。
> - 子网掩码与 IP 不配套：用 ipcalc 或 PREFIX 写法核对网段，别凭记忆写 255.255.255.0。

> **参见**：系统安装部署 的"网卡配置文件逐行详解""三种设置主机名的方法""DNS 配置"。

## 题 4：网络异常排错方法

**考察点**：能否按"由近及远"的顺序系统性定位网络故障，而不是盲目乱试。

**实现思路**：四步固定流程——看本机网卡（ip a）→ ping 网关 → ping 外网 → 查 DNS，每步配正常、异常两种输出样例和处置办法，当成排错剧本来用。

**实操过程**：

步骤 1：记住标准排错流程。

```text
第 1 步：ip a                 本机网卡是否 UP、是否拿到 IP
第 2 步：ping 网关             二层 / 本网段是否通
第 3 步：ping 外网 IP          路由与出口是否通（先 ping IP，避开 DNS 干扰）
第 4 步：dig / nslookup 域名   DNS 解析是否正常
```

顺序不能乱：每一步通过才进入下一步，故障点立刻定位在第一个失败环节。

步骤 2：第 1 步，查看本机网卡状态。

（预期输出，CentOS 7）

```bash
ip a
```

正常输出（网卡 UP 且有 IP）：

```console
2: ens33: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    inet 10.0.0.100/24 brd 10.0.0.255 scope global ens33
```

异常表现与处置：

| 现象 | 原因 | 处置 |
| --- | --- | --- |
| 只有 lo，没有 ens33 | 网卡未识别或驱动问题 | dmesg 配合 grep -i eth 查驱动，检查网卡是否禁用 |
| ens33 state DOWN | 网线没插或对端口故障 | 换网线、换交换机端口，看网口指示灯 |
| 没有 inet 行 | 没拿到 IP | 检查 ifcfg 的 ONBOOT / BOOTPROTO，systemctl restart network |

步骤 3：第 2 步，ping 网关。

（预期输出，CentOS 7）

```bash
ping -c 4 10.0.0.1
```

正常输出：

```console
PING 10.0.0.1 (10.0.0.1) 56(84) bytes of data.
64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.312 ms
64 bytes from 10.0.0.1: icmp_seq=2 ttl=64 time=0.289 ms
--- 10.0.0.1 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3000ms
```

异常输出：

```console
From 10.0.0.100 icmp_seq=1 Destination Host Unreachable
--- 10.0.0.1 ping statistics ---
4 packets transmitted, 0 received, +4 errors, 100% packet loss
```

ping 不通网关的排查方向：IP / 掩码是否与网关同网段、网线或交换机端口、防火墙是否禁 ICMP、虚拟机的网络模式（NAT / 桥接）是否选对。

步骤 4：第 3 步，ping 外网 IP（刻意避开域名，先验证纯网络层）。

（预期输出，CentOS 7）

```bash
# ping 公网 IP，通说明路由和 NAT 正常
ping -c 4 223.5.5.5
```

正常输出：

```console
64 bytes from 223.5.5.5: icmp_seq=1 ttl=54 time=8.12 ms
--- 223.5.5.5 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss
```

ping 通外网 IP 但打不开网站，问题基本锁定在 DNS（进入第 4 步）；ping 不通外网 IP，检查网关设置、路由、防火墙与上级网络。

步骤 5：第 4 步，检查 DNS 解析。

（预期输出，CentOS 7）

```bash
# CentOS 7 默认不带 dig，先安装
yum install -y bind-utils
# 查询域名解析
dig example.com
```

正常输出：

```console
; <<>> DiG 9.11.4 <<>> example.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; QUESTION SECTION:
;example.com.			IN	A

;; ANSWER SECTION:
example.com.		60	IN	A	93.184.216.34

;; Query time: 20 msec
;; SERVER: 10.0.0.1#53(10.0.0.1)
```

关键看两点：status 为 NOERROR 说明查询成功；ANSWER SECTION 有 A 记录说明域名能解析。异常处置：dig 超时换 DNS 服务器试（dig @223.5.5.5 example.com）；解析出的 IP 不对则检查 /etc/resolv.conf 与 ifcfg 的 DNS 配置。

排错结论模板：把四步结果记录下来（如"网卡 UP 有 IP → 网关通 → 外网 IP 通 → dig 超时"），结论即 DNS 故障，处置即修正 nameserver。

**验证方法**：在正常主机上按四步走一遍，四步全过说明网络健康；故意把 DNS 改成不可用地址，前三步通过、第四步失败，证明该流程能把故障精确定位到 DNS 层。

> **易错点**：
> - 跳过 ip a 直接 ping：网卡没起来、IP 没拿到，ping 什么都白费。
> - 一上来 ping 域名：分不清是网络不通还是 DNS 故障，必须先 ping IP 再 ping 域名。
> - 忽略防火墙：本机 firewall / 云平台安全组禁 ICMP 时，ping 不通不代表网络断，要换端口测试（如 curl 或 telnet）。
> - 只在客户机排查：路由对端、上级网关、DNS 服务端的状态也要会看，排错是双向的。
> - 虚拟机网络模式搞错：NAT / 桥接 / 仅主机模式选错，表现为"虚拟机有 IP 但上不了网"。

> **参见**：系统安装部署 的"网络检查确认工作""网络常见问题分析"。

### 辨析：NAT 与桥接 {: .sec-bianxi}

排错前先确认虚拟机用的哪种网络模式，两者的故障表现完全不同。NAT 模式下虚拟机躲在宿主机后面，借宿主机的地址出去，外部机器反过来访问不到它；桥接模式下虚拟机直接接入局域网，是独立成员，和局域网里其他机器平等，也因此会跟别人抢 IP。经验：只出不进的实验用 NAT；要在局域网内被访问（比如从宿主机之外的机器 SSH 进来）用桥接。云服务器的公网 IP 本质也是一层 NAT 映射，道理相通。

## 题 5（扩展作业）：如何利用 CentOS 7 的排错模式进行重置密码

**考察点**：能否说清救援模式（Rescue Mode）重置 root 密码的完整步骤与安全含义。

**实现思路**：按 B 级给出 CentOS 7 救援模式的八步标准流程，附上 RHEL 8 / Rocky 9 的等价做法，最后是验证方法和安全提醒。

**实操过程**：

步骤 1：进入救援模式。开机，在引导界面选择 Troubleshooting → Rescue a CentOS system，按回车进入。

```text
Troubleshooting
  └─ Rescue a CentOS system     # 选这一项，回车
```

步骤 2：应答交互提示。出现交互提示（询问是否查找并挂载原系统、是否进入 chroot）时按回车继续，系统会尝试把原系统挂载到 /mnt/sysimage。

步骤 3：进入 chroot。提示是否 chroot 进入挂载的系统时，输入 1 并回车（选择 Continue）。

```console
1) Continue
2) Read-only mount
3) Skip
4) Shell
Please make a selection from the above: 1
```

步骤 4：切换根目录到原系统。

（预期输出，CentOS 7）

```bash
chroot /mnt/sysimage
```

步骤 5：重置 root 密码，按提示输入两次新密码（输入不回显，属正常）。

```bash
passwd root
```

```console
Changing password for user root.
New password: 
Retype new password: 
passwd: all authentication tokens must be updated successfully.
```

步骤 6：SELinux 开启的系统必须执行重打标签，否则可能无法正常登录。

```bash
touch /.autorelabel
```

步骤 7：退出并重启。连续两次 exit 退出 chroot 和救援环境，系统自动重启。首次启动会因重打标签稍慢，属正常现象。

步骤 8：用新密码登录验证。

```bash
# 重启后本地登录或用 Xshell 远程登录，输入新密码
ssh root@10.0.0.100
```

RHEL 8 / Rocky 9 的等价做法（引导流程不同，原理一致）：

```text
1. 开机在引导菜单按 e 编辑启动项
2. 找到以 linux 开头的行，把 ro 改成 rw init=/bin/bash
3. 按 Ctrl + x 进入单用户 shell
4. 执行 passwd root，再执行 touch /.autorelabel
5. exec /sbin/init 重启系统
```

**验证方法**：重启后使用新密码登录成功即验证通过；若登录被拒且系统没有重打标签，检查是否遗漏 touch /.autorelabel（SELinux 标签不匹配会导致认证失败）。

> **易错点**：
> - 跳过 SELinux 重打标签：CentOS 7 开启 SELinux 时不做 touch /.autorelabel，重启后可能无法登录。
> - 忘记退出 chroot 直接重启：文件系统可能未正常卸载，有损坏风险，务必两步 exit。
> - 以为此操作能找回原密码：救援模式是"重置"不是"找回"，旧密码无法恢复。
> - 忽略物理安全前提：整个过程是本地物理操作，安全设计上就假定"能摸到机器"即拥有最高权限；机房托管机器需联系机房人员或用 iDRAC / iLO 重定向完成。
> - 在共享 / 生产环境练习：重置 root 前先确认授权与变更窗口，避免影响他人业务。

> **参见**：系统安装部署 的"救援模式重置 root 密码"。

## 本篇小结

day3 干下来的几点体会：

- 装机文档按"准备 → 引导 → 配置 → 用户 → 检查"五段写，每段带完成标志，打勾执行。
- 分区三种方案对应三种取舍：图省事全给 /、数据重要分 /data、要扩容留空间配 LVM；swap 统一按内存 1.5 倍（小于 8G）或 8G 给，这是 OOM 前的最后一道缓冲。
- 网络配置三件套各管一摊：ifcfg 定 IP / 网关 / DNS，hostnamectl 定主机名，/etc/hosts 做本地映射。ONBOOT=yes 和 DEVICE 名写对，能避开两个最常见坑。
- 排错认准四步：ip a → ping 网关 → ping 外网 IP → dig 域名，第一个走不通的环节就是故障点。
- 救援模式改密码八步，touch /.autorelabel 和两次 exit 最容易漏。
- 记住一条：能摸到机器就等于拿到最高权限，生产环境重置 root 必须走授权和变更流程。
{% endraw %}
