---
title: "day25-网络基础作业实操"
date: 2026-10-24 09:33:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-25"
---

{% raw %}



课程第 25 天（网络基础）留的作业共四题：①手工给 Linux 配静态 IP；②`ip` / `ping` / `traceroute` / `ss` 这几个排查命令的用法；③子网划分计算（192.168.1.0/26 等）；④OSI 七层与 TCP/IP 四层模型对照。第 1 题要动真实网卡配置文件还要重启网络，定为 B 级（标准命令 + CentOS 7 预期输出）；第 2、3 题的 `ping`、端口查看、`ipaddress` 计算本机就能真跑，定为 A 级；第 4 题是原理整理（对照表）。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：核心命令在本机环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，读者在虚拟机/CentOS 7 上可直接复现。

本篇 A 级部分：`ping` 网关、本机 IP 与路由查看、端口监听查看（宿主机无 `ss` 命令，用 `netstat -ano` 真跑替代并给出 `ss -tlnp` 的 CentOS 7 预期输出）、Python `ipaddress` 模块子网计算。B 级部分：`ifcfg-eth0` 静态 IP 配置与 `systemctl restart network`。输出中的本地用户名已按脱敏要求替换为 `user`，示例主机名为 `linux-node01`，示例域名统一用 `example.com`，实操目录统一用 `/tmp/hw/day25`。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 手工配置静态 IP 的完整流程 | B 级（ifcfg-eth0 + 重启网络） |
| 题 2 | ip / ping / traceroute / ss 等命令排查网络 | A 级（ping 网关、端口查看真跑）+ B 级（CentOS 7 命令序列） |
| 题 3 | 子网划分计算（192.168.1.0/26 等） | A 级（Python ipaddress 真跑）+ 手算过程 |
| 题 4 | OSI 七层与 TCP/IP 四层对照 | 原理整理（对照表） |

## 题 1：手工配置静态 IP 的完整流程
{: .sec-expl}

**考察点**：网卡配置文件 `/etc/sysconfig/network-scripts/ifcfg-eth0` 各参数的含义、静态 IP 与 DHCP 的区别、重启网络的方法与验证步骤。

**实现思路**：运维给服务器配 IP 的标准动作是「改配置文件 → 重启网络服务 → 验证」。配置前先想清楚五个参数：IP 地址、子网掩码、网关、DNS、网卡名。整体分四步：

1. 确认网卡名与当前地址（`ip addr`）；
2. 编辑 `/etc/sysconfig/network-scripts/ifcfg-eth0`；
3. 重启网络服务；
4. 验证（本机地址、网关连通性、域名解析）。

### 步骤 1：确认网卡与当前地址（B 级）
{: .sec-ver}

```bash
ip addr
ip route
```

```console
（预期输出，CentOS 7）
$ ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP
    link/ether 00:1a:2b:3c:4d:5e brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.10/24 brd 192.168.1.255 scope global eth0
$ ip route
default via 192.168.1.254 dev eth0
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10
```

网卡名是 `eth0`，当前是 DHCP 或旧静态地址。网关通常与 IP 同网段（这里 `192.168.1.254`），拿不准时在能上网的同类机器上执行 `ip route` 看第一行。

### 步骤 2：编辑网卡配置文件（B 级）
{: .sec-prac}

```bash
vim /etc/sysconfig/network-scripts/ifcfg-eth0
```

静态 IP 模板（逐行含义见后表）：

```conf
TYPE=Ethernet
BOOTPROTO=none
NAME=eth0
DEVICE=eth0
ONBOOT=yes
IPADDR=192.168.1.10
PREFIX=24
GATEWAY=192.168.1.254
DNS1=223.5.5.5
DNS2=114.114.114.114
```

| 参数 | 含义 | 备注 |
| --- | --- | --- |
| BOOTPROTO | 获取地址方式 | `dhcp` 自动获取；静态 IP 写 `none` 或 `static` |
| ONBOOT | 开机是否激活网卡 | 必须写 `yes`，否则重启后网卡不启动 |
| IPADDR | 静态 IP 地址 | 与规划一致，避免与同网段其他主机冲突 |
| PREFIX | 子网掩码前缀长度 | 24 等价于 `NETMASK=255.255.255.0`，二选一 |
| GATEWAY | 默认网关 | 访问其他网络的必经之路，只能配一个默认网关 |
| DNS1 / DNS2 | DNS 服务器 | 写入后最终落在 `/etc/resolv.conf` |

写完配置重启后，可以用 `grep -i nameserver /etc/resolv.conf` 确认 DNS 确实被写进去了——网卡配置文件和 `resolv.conf` 是「源头」与「落点」的关系，排查解析问题时两头都要看（分工辨析见本篇题 1 末尾的小节）。

> **易错点**：① `ONBOOT=yes` 忘写，重启后网卡不激活，表现为「第一次能连，重启就连不上」；② IP 与网关不在同一网段，配置能生效但外网不通；③ 同网段 IP 冲突，表现为时通时断；④ 改配置前先备份原文件（`cp ifcfg-eth0 ifcfg-eth0.bak`），配错还能回退。

### 步骤 3：重启网络（B 级）
{: .sec-prac}

```bash
systemctl restart network
# 或只重启单个连接（nmtui 体系）
nmcli connection reload
```

```console
（预期输出，CentOS 7）
$ systemctl restart network
$ echo $?
0
```

重启无报错且退出码为 0 即基本成功。远程 SSH 操作时务必小心：配置错误会导致网络中断，虚拟机环境建议先用控制台，生产环境用带外管理或另开一个连接验证成功后再断开旧连接。

### 步骤 4：验证（B 级）
{: .sec-ver}

```bash
ip addr show eth0            # 确认新 IP 已生效
ping -c 3 192.168.1.254      # 网关连通性
ping -c 3 www.example.com    # 域名解析 + 外网连通
cat /etc/resolv.conf         # DNS 是否按配置写入
```

```console
（预期输出，CentOS 7）
$ ping -c 3 www.example.com
PING www.example.com (93.184.216.34) 56(84) bytes of data.
64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=32.1 ms
64 bytes from 93.184.216.34: icmp_seq=2 ttl=56 time=31.8 ms
64 bytes from 93.184.216.34: icmp_seq=3 ttl=56 time=32.4 ms

--- www.example.com ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2003ms
```

三步验证分别对应「地址对不对 → 内网通不通 → DNS 与外网通不通」，逐层排查比一把梭高效。

**验证方法**：`ip addr` 显示新 IP；`ping -c 3 网关` 0% 丢包；`ping -c 3 www.example.com` 能解析出 IP 且通；重启系统后以上仍然成立（验证 ONBOOT）。

### 辨析：hosts 与 resolv.conf 的分工

这两个文件经常被混为一谈，其实分工很清楚：

- `/etc/hosts` 是**静态映射表**，本地说了算，优先级高于 DNS。适合机器少、内网集群互访（day27 的 hosts 映射就是典型用法），缺点是每台机器都要单独维护一份，改一条映射得全集群同步；
- `/etc/resolv.conf` 只声明「去问谁」——里面是 DNS 服务器地址，本身不存任何「域名 → IP」的记录，解析结果由远端 DNS 决定。适合面向公网域名，集中管理、改一处全局生效。

查找顺序上 hosts 在前：hosts 命中就不再问 DNS；反过来 `dig` 只走 DNS 不查 hosts，所以「hosts 配了但 dig 查不到」是正常行为，别误判成故障。生产内网机器多以后，hosts 同步成本会陡增，主流做法是内网自建 DNS，hosts 只留 `localhost` 一类兜底条目。

## 题 2：ip / ping / traceroute / ss 等网络排查命令
{: .sec-ts}

**考察点**：网络排错四件套的分工——`ip` 看本机地址与路由、`ping` 测连通性、`traceroute` 看路径、`ss` 看端口监听与连接。

**实现思路**：按「从下到上、从近到远」的顺序排查：先确认自己的地址与路由，再 ping 网关（内网），再 ping 外网 IP（外网），再看域名（DNS），最后查端口与服务。

### 步骤 1：确认本机地址与默认路由（已实操）
{: .sec-ver}

```bash
route print -4 | head -8
```

输出（已实操，本机形态；CentOS 7 用 `ip route`，见题 1）：

```console
$ route print -4 | head -8
===========================================================================
Interface List
  6...00 1a 2b 3c 4d 5e ......Intel(R) Ethernet Connection
===========================================================================
Active Routes:
  Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0   192.168.238.253  192.168.238.216     55
```

第一行 `0.0.0.0/0` 就是默认路由，网关 `192.168.238.253`——ping 它就是 ping 网关。

### 步骤 2：ping 网关测内网连通（已实操）
{: .sec-prac}

```bash
ping -n 4 192.168.238.253
```

输出：

```console
$ ping -n 4 192.168.238.253
正在 Ping 192.168.238.253 具有 32 字节的数据:
来自 192.168.238.253 的回复: 字节=32 时间=7ms TTL=64
来自 192.168.238.253 的回复: 字节=32 时间=3ms TTL=64
来自 192.168.238.253 的回复: 字节=32 时间=3ms TTL=64
来自 192.168.238.253 的回复: 字节=32 时间=4ms TTL=64

192.168.238.253 的 Ping 统计信息:
    数据包: 已发送 = 4，已接收 = 4，丢失 = 0 (0% 丢失)，
往返行程的估计时间(以毫秒为单位):
    最短 = 3ms，最长 = 7ms，平均 = 4ms
```

已发送 4、已接收 4、丢失 0，网关连通正常；`TTL=64` 是 Linux 家族设备的典型初始值（Windows 为 128），报文每经过一台路由器减 1，可根据 TTL 粗估跨了几跳。CentOS 7 上的等价命令是 `ping -c 4 192.168.1.254`。ping 不通网关时按顺序查：IP 与掩码是否配对、网卡是否 UP（`ip link show eth0`）、对端是否禁 ping。

一句生产提醒：ping 只适合做初筛，别拿「ping 得通」当服务存活的判据——ICMP 通只代表协议栈活着，应用可能已经挂了；反过来很多服务器禁 ping，也照样正常对外服务。探活要走端口探测（`ss` 看监听、`curl` 验应用）。

### 步骤 3：traceroute 看数据包路径（B 级）
{: .sec-prac}

```bash
traceroute -n www.example.com
```

```console
（预期输出，CentOS 7）
$ traceroute -n www.example.com
traceroute to www.example.com (93.184.216.34), 30 hops max, 60 byte packets
 1  192.168.238.253   3.12 ms   2.98 ms   3.05 ms      <- 网关
 2  10.10.0.1         5.44 ms   5.21 ms   5.38 ms      <- 运营商接入
 3  202.96.0.1       12.87 ms  12.55 ms  12.66 ms      <- 城域网
 ...
 8  93.184.216.34    31.90 ms  31.77 ms  32.05 ms      <- 目标
```

每一跳显示「地址 + 三次探测的往返时间」。`-n` 不做反向解析、输出更快；某一跳全是 `* * *` 表示该跳设备不响应 ICMP（常见于运营商设备），若后续跳正常则不算故障。Windows 上的等价命令是 `tracert -d 目标`（本机无 traceroute，故为 B 级）。

### 步骤 4：查看端口监听与连接（A 级替代 + B 级标准命令）
{: .sec-best}

宿主机没有 `ss`，先用 `netstat -ano` 真跑查看本机监听端口（已实操）：

```bash
netstat -ano | grep LISTEN | head -8
```

输出：

```console
$ netstat -ano | grep LISTEN | head -8
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       2036
  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING       4
  TCP    0.0.0.0:902            0.0.0.0:0              LISTENING       5624
  TCP    0.0.0.0:912            0.0.0.0:0              LISTENING       5624
  TCP    0.0.0.0:2343           0.0.0.0:0              LISTENING       7308
  TCP    0.0.0.0:3580           0.0.0.0:0              LISTENING       5500
  TCP    0.0.0.0:5040           0.0.0.0:0              LISTENING       10168
  TCP    0.0.0.0:7680           0.0.0.0:0              LISTENING       6172
```

四个字段分别是协议、本地地址（IP:端口）、远端地址、状态与进程 PID。`0.0.0.0:端口` 表示监听本机所有网卡的该端口，`127.0.0.1:端口` 表示只接受本机访问——服务「起了但连不上」时先看监听的是哪个地址。

CentOS 7 上的标准命令是 `ss`（net-tools 已停止维护，`netstat -lntp` 的替代品）。ss 快不只因为「新」：netstat 每次都要遍历 `/proc` 文件系统把全部连接读一遍，ss 走 netlink 接口直接跟内核对话，机器上连接数上万时差距非常明显。

```bash
ss -tlnp                      # t TCP / l 监听 / n 数字 / p 进程
ss -tnp                       # 已建立的连接（看谁连着我）
ss -s                         # 连接统计汇总
```

```console
（预期输出，CentOS 7）
$ ss -tlnp
State   Recv-Q  Send-Q   Local Address:Port    Peer Address:Port   Process
LISTEN  0       128            0.0.0.0:22           0.0.0.0:*        users:(("sshd",pid=1180,fd=3))
LISTEN  0       128                  [::]:22                 [::]:*        users:(("sshd",pid=1180,fd=4))
LISTEN  0       80                   [::]:3306               [::]:*        users:(("mysqld",pid=1425,fd=33))
```

`Recv-Q`/`Send-Q` 在 LISTEN 状态表示当前等待 accept 的连接数，持续不为 0 说明进程处理不过来。新旧命令对照：`ifconfig` → `ip addr`、`route -n` → `ip route`、`netstat -lntp` → `ss -lntp`、`arp -a` → `ip neigh`。

### 命令分工速查
{: .sec-chk}

| 命令 | 回答的问题 | 常用写法 |
| --- | --- | --- |
| ip addr / ip route | 我的地址和路由是什么 | `ip addr show eth0`、`ip route` |
| ping | 对方通不通、延迟多少 | `ping -c 4 网关` |
| traceroute | 数据包走了哪些跳、在哪一跳出问题 | `traceroute -n 目标` |
| ss | 谁在监听、谁连着我 | `ss -tlnp`、`ss -tnp` |
| dig | 域名解析成什么 IP | `dig www.example.com` |

**验证方法**：① `ping` 网关 0% 丢包（已实操）；② `ss -tlnp` 能看到本机 SSH 的 22 端口监听；③ 能复述「ping 通网关但 ping 不通外网 = 网关或路由问题；ping 通外网 IP 但域名打不开 = DNS 问题」两条经典定位结论。

## 题 3：子网划分计算

**考察点**：借位公式（子网数 = 2^n）、块大小（256 - 掩码末段）、可用主机数（2^m - 2，减网络地址与广播地址）。

**实现思路**：题目是「把 192.168.1.0/24 平均划分成 4 个子网」。手算三步：① 4 个子网需借 log2(4) = 2 位主机位，前缀变 /26；② 掩码末段 11000000 = 192，块大小 = 256 - 192 = 64，子网起始地址按 0、64、128、192 递增；③ 主机位剩 6 位，每个子网可用 2^6 - 2 = 62 台。再用 Python `ipaddress` 模块真跑核对。

### 步骤 1：手算过程
{: .sec-prac}

```text
原网络    192.168.1.0/24    主机位 8 位
借位      2 位 -> 子网数 2^2 = 4 个，新前缀 /26
新掩码    255.255.255.192   （末段 11000000 = 192）
块大小    256 - 192 = 64    （子网边界：0 / 64 / 128 / 192）
可用主机  2^6 - 2 = 62      （去掉网络地址与广播地址）
```

### 步骤 2：Python ipaddress 真跑核对（已实操）
{: .sec-prac}

```bash
python3 - <<'EOF'
import ipaddress
net = ipaddress.ip_network('192.168.1.0/26')
print('network   =', net.network_address)
print('netmask   =', net.netmask)
print('broadcast =', net.broadcast_address)
hosts = list(net.hosts())
print('hosts     =', hosts[0], '~', hosts[-1], f'({len(hosts)})')
for i, sub in enumerate(ipaddress.ip_network('192.168.1.0/24').subnets(new_prefix=26), 1):
    h = list(sub.hosts())
    print(f'subnet{i}: {sub}  usable {h[0]}-{h[-1]} ({len(h)})  bc {sub.broadcast_address}')
EOF
```

输出：

```console
$ python3 - <<'EOF'
network   = 192.168.1.0
netmask   = 255.255.255.192
broadcast = 192.168.1.63
hosts     = 192.168.1.1 ~ 192.168.1.62 (62)
subnet1: 192.168.1.0/26  usable 192.168.1.1-192.168.1.62 (62)  bc 192.168.1.63
subnet2: 192.168.1.64/26  usable 192.168.1.65-192.168.1.126 (62)  bc 192.168.1.127
subnet3: 192.168.1.128/26  usable 192.168.1.129-192.168.1.190 (62)  bc 192.168.1.191
subnet4: 192.168.1.192/26  usable 192.168.1.193-192.168.1.254 (62)  bc 192.168.1.255
EOF
```

程序输出与手算完全一致，汇总成表：

| 子网 | 网络地址 | 可用地址范围 | 广播地址 |
| --- | --- | --- | --- |
| 子网 1 | 192.168.1.0/26 | 192.168.1.1 - 192.168.1.62 | 192.168.1.63 |
| 子网 2 | 192.168.1.64/26 | 192.168.1.65 - 192.168.1.126 | 192.168.1.127 |
| 子网 3 | 192.168.1.128/26 | 192.168.1.129 - 192.168.1.190 | 192.168.1.191 |
| 子网 4 | 192.168.1.192/26 | 192.168.1.193 - 192.168.1.254 | 192.168.1.255 |

### 步骤 3：举一反三
{: .sec-prac}

再练一题「划分 8 个子网」：借 3 位，前缀 /27，掩码 `255.255.255.224`，块大小 32，每个子网可用 2^5 - 2 = 30 台（本机已用 ipaddress 验证 /27 的掩码与可用数为 `255.255.255.224`、30）。判断两个 IP 是否同网段的快捷方法：分别与掩码按位与，结果相同即同网段——例如 `192.168.1.65` 与 `192.168.1.1` 与 `255.255.255.192` 相与都得到 `192.168.1.64`，同属子网 2，可直接二层通信。

顺带补一个冷知识：可用主机数「减 2」减的是网络地址和广播地址，这条规则在 /31 上是例外——RFC 3021 规定点对点链路可以用 /31，两个地址都是主机地址、不设广播，运营商设备互联经常这么配。日常划分子网还是老老实实按 2^m - 2 算。

常用前缀速查：

| 前缀 | 掩码 | 可用主机数 | 典型用途 |
| --- | --- | --- | --- |
| /24 | 255.255.255.0 | 254 | 常规办公/机房网段 |
| /26 | 255.255.255.192 | 62 | 一分为四 |
| /27 | 255.255.255.224 | 30 | 一分为八 |
| /30 | 255.255.255.252 | 2 | 路由器点对点互联 |

**验证方法**：① 手算结果与 `ipaddress` 输出一致（已实操）；② 能口算任意 /24 划分 n 个子网的掩码、块大小与可用数；③ 能用「与掩码相与」判断两个 IP 是否同网段。

## 题 4：OSI 七层与 TCP/IP 四层模型对照
{: .sec-expl}

**考察点**：两个模型的层次划分、各层职责与典型协议/设备、数据的封装与解封装。

**实现思路**：OSI 七层是 ISO 定义的「先有模型后有实现」的教学标准；TCP/IP 四层是「先有实现后有模型」的工程实践。实际排错按 TCP/IP 四层更顺手，OSI 用于协议归类。发送方自上而下逐层加头（封装），接收方自下而上逐层去头（解封装）。

### 4.1 对照表
{: .sec-chk}

| OSI 七层 | TCP/IP 四层 | 核心功能 | 典型协议 | 典型设备 | 数据单元 |
| --- | --- | --- | --- | --- | --- |
| 应用层 | 应用层 | 为应用提供网络服务接口 | HTTP、HTTPS、FTP、SMTP、DNS、DHCP、SSH | 七层负载均衡 | 数据 Data |
| 表示层 | 应用层 | 格式转换、加解密、压缩 | TLS/SSL、JPEG、ASCII | — | 数据 Data |
| 会话层 | 应用层 | 建立与管理会话 | NetBIOS、RPC | — | 数据 Data |
| 传输层 | 主机到主机层 | 端到端通信、区分进程 | TCP、UDP | 四层负载均衡、四层防火墙 | 段 Segment |
| 网络层 | 互联网层 | 逻辑寻址（IP）与路由 | IP、ICMP、RIP、OSPF | 路由器、三层交换机 | 包 Packet |
| 数据链路层 | 接入层 | 物理寻址（MAC）、成帧 | Ethernet、PPP、ARP | 交换机、网卡 | 帧 Frame |
| 物理层 | 接入层 | 比特流传输 | RJ45、双绞线、光纤 | 集线器、中继器 | 比特 Bit |

### 4.2 封装与解封装流程
{: .sec-expl}

```text
发送方（封装，自上而下加头）：
应用层  产生原始数据（如 HTTP 请求报文）
传输层  + TCP 头部（源端口、目标端口、序列号） -> 段
网络层  + IP 头部（源 IP、目标 IP、TTL）       -> 包
链路层  + 帧头帧尾（源 MAC、目标 MAC、FCS）    -> 帧
物理层  转为比特流（电信号/光信号）发送

接收方（解封装，自下而上去头）：
物理层  比特流还原成帧
链路层  FCS 校验 + 比对目标 MAC -> 去帧头帧尾上交
网络层  核对目标 IP -> 去 IP 头部上交
传输层  按端口号找到进程 -> 去 TCP 头部上交
应用层  拿到原始数据并处理
```

两个直接推论：交换机（二层设备）只需解到帧头看 MAC、路由器（三层设备）要解到 IP 头看 IP——这正是「交换机按 MAC 转发、路由器按 IP 转发」的根本原因；TTL 每过一台路由器减 1、减到 0 丢弃，防止路由环路导致报文无限循环。

顺着封装再记一个生产里高频的坑：每一层加头都会让报文变大，链路层能承载的上限就是 MTU（以太网默认 1500 字节），超了就得分片。VPN 隧道、GRE 封装会额外吃掉几十字节，两端 MTU 不一致时典型表现是「小包通、大包断」——网站打不开、大文件传不动。用 `ping -s 1472 -M do 目标` 可以快速探测路径上的真实 MTU。

### 4.3 排错口诀与 TCP/UDP 速记
{: .sec-ts}

按分层排错的口诀：**网线网卡看一层、MAC 交换看二层、IP 路由看三层、端口服务看四层、协议内容看七层**。题 2 的命令正好按这个分层各就各位：`ip link` 在一/二层、`ping`/`ip route` 在三层、`ss` 在四层、`dig` 在应用层。

| 对比项 | TCP | UDP |
| --- | --- | --- |
| 连接 | 面向连接（三次握手） | 无连接 |
| 可靠性 | 高（确认、重传、流量/拥塞控制） | 低（尽力而为） |
| 效率 | 较低 | 高 |
| 典型应用 | HTTP、SSH、MySQL | DNS 查询、视频流、DHCP |

**验证方法**：① 能默写七层名称与四层归并关系；② 能说清一份 HTTP 请求从应用到网线的五步封装与对应数据单元；③ 能把题 2 的每条命令对应到它所在的层。

## 本篇小结
{: .sec-sum}

1. 静态 IP 配置四步走：`ip addr` 确认网卡 → 改 `ifcfg-eth0`（BOOTPROTO=none、ONBOOT=yes、IPADDR/PREFIX/GATEWAY/DNS）→ `systemctl restart network` → 分层验证（本机地址、ping 网关、ping 域名）。
2. `ONBOOT=yes` 与「IP 与网关同网段」是静态 IP 两个最高频的坑；远程改网络配置务必留后路。
3. 网络排错从近到远：`ip addr`/`ip route` 看自己 → `ping` 网关测内网 → `ping` 外网 IP 测路由 → `ping` 域名测 DNS → `ss -tlnp` 看服务端口。ping 只做初筛，探活要落到端口与应用层。
4. `ss` 已取代 `netstat`：`ss -tlnp` 看监听与进程，`ss -tnp` 看已建连接；`0.0.0.0:端口` 对外服务、`127.0.0.1:端口` 仅本机。
5. `traceroute -n` 逐跳定位故障层：断在第 1 跳是内网问题，中间某跳 `***` 但后续正常不算故障，最后一跳不通则查目标侧。
6. 子网划分三要素：借位数（子网数 = 2^n）、块大小（256 - 掩码末段）、可用主机（2^m - 2）；192.168.1.0/24 一分为四的结果是 4 个 /26，各 62 个可用地址，已用 Python `ipaddress` 真跑核对。/31 点对点是减 2 规则的唯一例外。
7. hosts 与 resolv.conf 一个管「本地写死」、一个管「去问谁」，hosts 命中不问 DNS，`dig` 不查 hosts。
8. OSI 七层用于教学与协议归类，TCP/IP 四层用于实际排错；发送封装、接收解封装，交换机解到二层、路由器解到三层，TTL 防环路；MTU 决定要不要分片，排查「大包不通」先想到它。

> **参见**：运维网络基础（上） · day23 磁盘管理作业实操


{% endraw %}
