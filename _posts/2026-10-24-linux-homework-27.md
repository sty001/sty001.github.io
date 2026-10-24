---
title: "day27 作业实操：综合架构规划与主机克隆"
date: 2026-10-24 09:31:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 27 天（综合架构开篇）的作业任务是：把一套中小规模网站的 3 层架构规划出来，落成「角色 / 主机名 / IP / 用途」对照表，生成全集群统一的 `/etc/hosts` 映射，再把模板机克隆之后的网络配置修改完整走一遍。作业原文是「将其他虚拟主机克隆配置完成；预习 rsync 守护进程部署方法」，这里把「克隆配置完成」拆成规划表、hosts 映射、克隆后改网三步来做，前两步与第三步的配置文件部分全部在沙箱真跑，涉及虚拟化操作与系统服务的部分给标准命令加预期输出。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker，也没有虚拟化软件），因此采用分级实操：

- **A 级（已真实执行）**：表格生成、文本处理（awk/sed/grep/sort/diff）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；克隆后的网卡配置修改用沙箱里还原的 `ifcfg-eth0`/`ifcfg-eth1` 文件真跑 `sed -i`，效果与真机完全一致；
- **B 级（标准命令 + 预期输出）**：`hostnamectl`、`systemctl restart network`、`ip addr`、`ping` 等系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw/day27`。主机名沿用课程规划的角色缩写命名（lb01、web01 等），IP 使用私有地址段：10.0.0.0/24 模拟外网区，172.16.1.0/24 作为内网区，输出中的本地用户名已按脱敏要求替换为 `user`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 规划 3 层架构，产出主机名 / IP / 用途对照表并做唯一性校验 | A 级（printf 生成 + awk 校验真跑） |
| 题 2 | 生成全集群 `/etc/hosts` 映射并正反查询验证 | A 级（真跑）+ 分发后 ping 为 B 级 |
| 题 3 | 克隆虚拟主机后的网络配置修改（改主机名 / 改 IP / 删 UUID） | 配置文件部分 A 级真跑，系统命令 B 级 |

## 题 1：规划三层架构并生成主机与 IP 对照表

**考察点**：综合架构的分层思想（接入层、负载均衡层、Web 层、数据与存储层、备份层）、主机命名规范（角色缩写 + 两位编号）、IP 网段按角色划分与地址预留，以及把「规划」从脑图落成机器可校验的文本——规划表本身也要能用命令查错。

**实现思路**：先画分层（每层解决什么问题），再定命名与 IP 规则（先有规则才有表），最后用 `printf` 的对齐格式生成对照表落盘。落盘之后立即用 `awk | sort | uniq -d` 检查主机名与 IP 是否重复——规划阶段的重复 IP 到了克隆阶段就是 IP 冲突事故，必须在这一步拦住。

### 架构分层与角色职责

| 层 | 角色 | 解决的问题 |
| --- | --- | --- |
| 接入层 | 防火墙（可扩展 CDN / WAF） | 只放行业务端口，过滤恶意流量 |
| 负载均衡层 | lb01 / lb02（nginx + keepalived） | 分发请求，消除 Web 接入单点（VIP 漂移） |
| Web 层 | web01 / web02（nginx） | 处理用户请求，可横向扩容 |
| 数据层 | db01（mysql） | 存储字符数据，后续做主从 |
| 存储层 | nfs01（nfs） | 图片、附件等共享存储，多台 Web 共用一份文件 |
| 备份层 | backup01（rsync） | 全网数据备份汇聚点 + 日志统一保存 |

### 主机规划总表（目标形态）

| 序号 | 角色 | 主机名 | 外网地址 | 内网地址 | 软件 |
| --- | --- | --- | --- | --- | --- |
| 01 | 防火墙服务器 | firewalld | 10.0.0.81 | 172.16.1.81 | firewalld |
| 02 | 负载均衡服务器 | lb01 | 10.0.0.5 | 172.16.1.5 | nginx+keepalived |
| 03 | 负载均衡服务器 | lb02 | 10.0.0.6 | 172.16.1.6 | nginx+keepalived |
| 04 | web 服务器 | web01 | 10.0.0.7 | 172.16.1.7 | nginx |
| 05 | web 服务器 | web02 | 10.0.0.8 | 172.16.1.8 | nginx |
| 06 | 数据库服务器 | db01 | 10.0.0.51 | 172.16.1.51 | mysql |
| 07 | 存储服务器 | nfs01 | 10.0.0.31 | 172.16.1.31 | nfs |
| 08 | 备份服务器 | backup01 | 10.0.0.41 | 172.16.1.41 | rsync |

命名与 IP 规划遵循四条规则：

1. 主机名 = 角色缩写 + 两位编号，同角色多台依次递增（lb01、lb02），见名知意；
2. IP 按角色分段预留：负载均衡 .5-.6、Web .7-.8、存储 .31、备份 .41、数据库 .51，段与段之间留出扩容空间，不要用到最后几个地址；
3. 外网地址（10.0.0.0/24）只给需要对外提供服务的角色，内网地址（172.16.1.0/24）是服务器之间通信的主通道；
4. 全集群统一一份 hosts 映射，先保证内网用主机名互通，再谈服务部署。

### 步骤 1：用 printf 生成对照表（已实操）

```bash
mkdir -p /tmp/hw/day27 && cd /tmp/hw/day27
cat > plan.txt <<'EOF'
01 防火墙 firewalld 10.0.0.81 172.16.1.81 firewalld
02 负载均衡 lb01 10.0.0.5 172.16.1.5 nginx+keepalived
03 负载均衡 lb02 10.0.0.6 172.16.1.6 nginx+keepalived
04 web服务器 web01 10.0.0.7 172.16.1.7 nginx
05 web服务器 web02 10.0.0.8 172.16.1.8 nginx
06 数据库 db01 10.0.0.51 172.16.1.51 mysql
07 存储 nfs01 10.0.0.31 172.16.1.31 nfs
08 备份 backup01 10.0.0.41 172.16.1.41 rsync
EOF
printf '%-4s %-14s %-12s %-14s %-14s %s\n' 序号 角色 主机名 外网地址 内网地址 软件
printf '%-4s %-14s %-12s %-14s %-14s %s\n' $(cat plan.txt)
```

输出：

```text
序号 角色         主机名    外网地址   内网地址   软件
01   防火墙      firewalld    10.0.0.81      172.16.1.81    firewalld
02   负载均衡   lb01         10.0.0.5       172.16.1.5     nginx+keepalived
03   负载均衡   lb02         10.0.0.6       172.16.1.6     nginx+keepalived
04   web服务器   web01        10.0.0.7       172.16.1.7     nginx
05   web服务器   web02        10.0.0.8       172.16.1.8     nginx
06   数据库      db01         10.0.0.51      172.16.1.51    mysql
07   存储         nfs01        10.0.0.31      172.16.1.31    nfs
08   备份         backup01     10.0.0.41      172.16.1.41    rsync
```

### 步骤 2：唯一性校验（已实操）

规划表落盘后立刻查重，主机名与 IP 都不允许出现重复行：

```bash
echo "===== 检查主机名是否有重复（无输出=全部唯一）====="
awk 'NR>0{print $3}' plan.txt | sort | uniq -d
echo "(以上无输出)"
echo "===== 检查内网 IP 是否有重复 ====="
awk '{print $5}' plan.txt | sort | uniq -d
echo "(以上无输出)"
echo "===== 按内网 IP 排序输出 ====="
sort -k5 plan.txt
```

输出：

```text
===== 检查主机名是否有重复（无输出=全部唯一）=====
(以上无输出)
===== 检查内网 IP 是否有重复 =====
(以上无输出)
===== 按内网 IP 排序输出 =====
07 存储 nfs01 10.0.0.31 172.16.1.31 nfs
08 备份 backup01 10.0.0.41 172.16.1.41 rsync
02 负载均衡 lb01 10.0.0.5 172.16.1.5 nginx+keepalived
06 数据库 db01 10.0.0.51 172.16.1.51 mysql
03 负载均衡 lb02 10.0.0.6 172.16.1.6 nginx+keepalived
04 web服务器 web01 10.0.0.7 172.16.1.7 nginx
05 web服务器 web02 10.0.0.8 172.16.1.8 nginx
01 防火墙 firewalld 10.0.0.81 172.16.1.81 firewalld
```

`uniq -d` 只输出重复行，两个查询都没有输出，说明 8 台主机的主机名与内网 IP 全部唯一，规划表可用。这一步看着像仪式感，其实是把人眼查表换成机器查表——表格一多，肉眼扫重复的漏检率高得吓人。

> **易错点**：
>
> - 规划表只存在于文档里没法校验，一旦落成纯文本就能用 awk/sort 查错——「可校验」是规划表与随手画的草图的本质区别；
> - IP 分段要给扩容预留地址（Web 段 .7-.8 后面还留了 .9 起的余量），不要从 .1 顺序用到底；
> - 数据库这类只对内提供服务的角色，外网地址可以不分配，减小暴露面。

## 题 2：生成全集群 /etc/hosts 映射并验证

**考察点**：`/etc/hosts` 的格式（IP + 主机名，空格分隔）、全集群配置一致性（每台机器同一份文件）、用 awk 做「正向查 IP / 反查主机名」的双向验证。

**实现思路**：hosts 是整套架构互通的基础——后续 rsync 推送、NFS 挂载、数据库连接全都要靠主机名解析。先把标准映射写成一个文件（后面题 3 会看到，克隆机也要用同一份内容覆盖 `/etc/hosts`），然后在沙箱里完成三步验证：条目数量对不对、主机名反查 IP 对不对、IP 正查主机名对不对。

### 步骤 1：编写映射文件（已实操）

```bash
cd /tmp/hw/day27
cat > hosts.new <<'EOF'
127.0.0.1   localhost localhost.localdomain localhost4 localhost4.localdomain4
::1         localhost localhost.localdomain localhost6 localhost6.localdomain6
172.16.1.5      lb01
172.16.1.6      lb02
172.16.1.7      web01
172.16.1.8      web02
172.16.1.51     db01
172.16.1.31     nfs01
172.16.1.41     backup01
EOF
cat -n hosts.new
```

输出：

```text
     1	127.0.0.1   localhost localhost.localdomain localhost4 localhost4.localdomain4
     2	::1         localhost localhost.localdomain localhost6 localhost6.localdomain6
     3	172.16.1.5      lb01
     4	172.16.1.6      lb02
     5	172.16.1.7      web01
     6	172.16.1.8      web02
     7	172.16.1.51     db01
     8	172.16.1.31     nfs01
     9	172.16.1.41     backup01
```

### 步骤 2：三向验证（已实操）

```bash
echo "--- 条目数（去掉 localhost 行）---"
grep -vc 'localhost' hosts.new
echo "--- 反查：web01 对应的 IP ---"
awk '$2=="web01"{print $1}' hosts.new
echo "--- 正查：172.16.1.31 对应的主机名 ---"
awk '$1=="172.16.1.31"{print $2}' hosts.new
```

输出：

```text
--- 条目数（去掉 localhost 行）---
7
--- 反查：web01 对应的 IP ---
172.16.1.7
--- 正查：172.16.1.31 对应的主机名 ---
nfs01
```

三个结果互相印证：8 行内容去掉 1 行 localhost 行 = 7 条架构映射，与规划表条数一致；`web01` 反查出 `172.16.1.7`、`172.16.1.31` 正查出 `nfs01`，与题 1 的规划表逐条吻合。

### 步骤 3：分发到真机并做连通性测试（预期输出，CentOS 7）

```bash
\cp /etc/hosts{,.bak}          # 先备份原 hosts
cat /tmp/hw/day27/hosts.new > /etc/hosts
ping -c 1 web01
```

输出：

```text
PING web01 (172.16.1.7) 56(84) bytes of data.
64 bytes from web01 (172.16.1.7): icmp_seq=1 ttl=64 time=0.321 ms

--- web01 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
```

ping 输出第一行括号里的 IP 是 `172.16.1.7`，说明解析走的正是 hosts 映射而不是 DNS，这条映射生效。机器少时 hosts 是最省事的互通方案；集群过了十几台还靠手工同步 hosts，改一条映射就得全量下发一遍，这时该考虑内网 DNS 了。另外可以用 `arping -I eth1 172.16.1.41` 在启动克隆机之前探一下目标 IP 是否已被占用，比「启动机器后发现时通时断再回头排查」主动得多。

> **易错点**：
>
> - hosts 是「每台机器各自生效」的本地文件，改一台不改其他台，就会出现「web01 能 ping 通 backup01、backup01 却解析不了 web01」的半通不通状态，务必用同一份文件下发；
> - 覆盖 `/etc/hosts` 前先 `\cp /etc/hosts{,.bak}` 备份，反斜杠是跳过 alias 强制执行 cp，防止原文件被误覆盖后无法回滚；
> - 主机名与 IP 之间用空格或制表符均可，但一行只能写「一个 IP 对应多个主机名别名」，不能一个主机名对多个 IP（后写的会被忽略或产生歧义）。

## 题 3：克隆虚拟主机后的网络配置修改

**考察点**：链接克隆与完整克隆的取舍、克隆机「逐台顺序启动」的原因（同时启动必然 IP 冲突）、UUID 冲突的原理，以及用 sed 批量改网卡配置的标准动作（改 IP、删 UUID、重启网络）。

**实现思路**：克隆出来的机器与模板机「长得一模一样」——主机名相同、两张网卡的 IP 相同、网卡 UUID 相同。上线前必须做三件事：改主机名、把每张网卡的 IP 从模板机的 `.200` 改成本机规划地址、删掉克隆来的 UUID 让系统重新生成。本篇在沙箱里还原两份网卡配置文件，把改 IP 与删 UUID 的 sed 过程连同 diff 前后对比全部真跑；改主机名与重启网络属系统动作，给标准命令与预期输出。

克隆方式的选择：

| 方式 | 优势 | 劣势 | 适用 |
| --- | --- | --- | --- |
| 链接克隆 | 节省物理主机资源，克隆效率快 | 模板主机删除，链接主机也会失效 | 学习环境 |
| 完整克隆 | 模板主机删除后克隆主机依然可用 | 消耗物理主机资源，克隆效率低 | 企业应用 |

### 步骤 1：还原克隆机原始网卡配置（已实操）

假设模板机两张网卡的 IP 都是 `.200`，克隆机拿到手就是这个状态：

```bash
cd /tmp/hw/day27 && mkdir -p sysconfig-network
cat > sysconfig-network/ifcfg-eth0 <<'EOF'
TYPE=Ethernet
BOOTPROTO=none
NAME=eth0
DEVICE=eth0
ONBOOT=yes
IPADDR=10.0.0.200
PREFIX=24
GATEWAY=10.0.0.254
DNS1=223.5.5.5
UUID=2b8e4f5a-6c3d-4e21-9a77-1f0c8d552001
EOF
cat > sysconfig-network/ifcfg-eth1 <<'EOF'
TYPE=Ethernet
BOOTPROTO=none
NAME=eth1
DEVICE=eth1
ONBOOT=yes
IPADDR=172.16.1.200
PREFIX=24
UUID=9f3a1c7b-8d24-4b6e-b5c1-77e0a9932002
EOF
cp sysconfig-network/ifcfg-eth0 sysconfig-network/ifcfg-eth0.bak
cp sysconfig-network/ifcfg-eth1 sysconfig-network/ifcfg-eth1.bak
echo "===== 克隆机原始配置（IP 全是模板机的 .200）====="
grep -H 'IPADDR\|UUID' sysconfig-network/ifcfg-eth[01]
```

输出：

```text
===== 克隆机原始配置（IP 全是模板机的 .200）=====
sysconfig-network/ifcfg-eth0:IPADDR=10.0.0.200
sysconfig-network/ifcfg-eth0:UUID=2b8e4f5a-6c3d-4e21-9a77-1f0c8d552001
sysconfig-network/ifcfg-eth1:IPADDR=172.16.1.200
sysconfig-network/ifcfg-eth1:UUID=9f3a1c7b-8d24-4b6e-b5c1-77e0a9932002
```

### 步骤 2：sed 改 IP、删 UUID，并用 diff 验证（已实操）

本台克隆机规划为 backup01（内网 172.16.1.41 / 外网 10.0.0.41），所以把 `.200` 统一替换为 `.41`：

```bash
sed -i 's#200#41#g' sysconfig-network/ifcfg-eth[01]
sed -i '/UUID/d' sysconfig-network/ifcfg-eth[01]
echo "===== 修改后（IP 改为 .41，UUID 已删除）====="
grep -H 'IPADDR\|UUID' sysconfig-network/ifcfg-eth[01]
echo "(无 UUID 输出即已删干净)"
echo "===== diff 前后对比（ifcfg-eth0）====="
diff -u sysconfig-network/ifcfg-eth0.bak sysconfig-network/ifcfg-eth0
```

输出：

```text
===== 修改后（IP 改为 .41，UUID 已删除）=====
sysconfig-network/ifcfg-eth0:IPADDR=10.0.0.41
sysconfig-network/ifcfg-eth1:IPADDR=172.16.1.41
(无 UUID 输出即已删干净)
===== diff 前后对比（ifcfg-eth0）=====
--- sysconfig-network/ifcfg-eth0.bak	2026-10-24 08:30:00 +0800
+++ sysconfig-network/ifcfg-eth0	2026-10-24 08:30:01 +0800
@@ -3,8 +3,7 @@
 NAME=eth0
 DEVICE=eth0
 ONBOOT=yes
-IPADDR=10.0.0.200
+IPADDR=10.0.0.41
 PREFIX=24
 GATEWAY=10.0.0.254
 DNS1=223.5.5.5
-UUID=2b8e4f5a-6c3d-4e21-9a77-1f0c8d552001
```

diff 显示恰好两处变更：IPADDR 一行被替换、UUID 一行被删除，其余配置原样保留——这正是我们想要的最小改动。

### 步骤 3：真机完整流程（预期输出，CentOS 7）

```bash
# a. 修改主机名称
hostnamectl set-hostname backup01

# b. 修改主机地址并删除 UUID（与步骤 2 相同的 sed）
sed -i 's#200#41#g' /etc/sysconfig/network-scripts/ifcfg-eth[01]
grep 41 /etc/sysconfig/network-scripts/ifcfg-eth[01]
sed -i '/UUID/d' /etc/sysconfig/network-scripts/ifcfg-eth[01]
grep UUID /etc/sysconfig/network-scripts/ifcfg-eth[01]

# c. 重启网络服务使配置生效
systemctl restart network

# d. 确认新地址已生效
ip addr show eth1
hostname
```

输出：

```text
IPADDR=10.0.0.41
IPADDR=172.16.1.41
(grep UUID 无输出，UUID 已删除)

3: eth1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP qlen 1000
    link/ether 00:0c:29:aa:bb:41 brd ff:ff:ff:ff:ff:ff
    inet 172.16.1.41/24 brd 172.16.1.255 scope global eth1
       valid_lft forever preferred_lft forever

backup01
```

验证三连：`ip addr` 显示新地址、`hostname` 显示新主机名、从别的机器 `ping 172.16.1.41` 能通，这台克隆机才算正式入列。

### 辨析：UUID 与 MAC——克隆机到底要改哪些标识

克隆机与模板机雷同的「身份信息」不止 IP 和主机名，完整的清单有五项：

| 标识 | 位置 | 克隆后状态 | 处理方式 |
| --- | --- | --- | --- |
| IP 地址 | 网卡配置文件 | 与模板机相同 | sed 改成本机规划地址 |
| 主机名 | 内核与 `/etc/hostname` | 与模板机相同 | `hostnamectl set-hostname` |
| 网卡 UUID | `ifcfg-eth*` 的 `UUID=` 行 | 与模板机相同 | 删掉，重启后 NetworkManager 自动生成 |
| MAC 地址 | 虚拟机配置 | VMware 完整/链接克隆会重新生成，一般无需手工改 | 若手工复制虚拟机目录导致 MAC 相同，需在虚拟机设置里重新生成 |
| machine-id | `/etc/machine-id` | 与模板机相同 | `echo "" > /etc/machine-id && systemd-machine-id-setup` 或删除后重启重新生成 |

UUID 与 MAC 是两个不同层面的东西，别搞混：UUID 是 NetworkManager 给「连接配置文件」编的号，只在本机网卡配置里用，冲突的后果是配置错乱、接口名漂移；MAC 是链路层的硬件地址，跟着帧在整个二层网络里广播，两台机器 MAC 相同会出现交换机转发表来回跳、时通时断的诡异现象。machine-id 最容易被漏掉——它影响 systemd 日志定位、DHCP 租约识别，克隆机不重置的话，日志系统里两台机器会以同一个 ID 出现。本篇作业只硬性要求改前三项，后两项建议养成习惯一并处理。

### 验证方法

1. `diff -u 配置.bak 配置` 确认改动只有预期的 IPADDR 行与被删除的 UUID 行，没有误伤；
2. `grep -c UUID 配置文件` 输出为 0；
3. 重启网络后 `ip addr` 两个网卡分别显示新外网与内网地址；
4. 全部克隆完成后，在任意一台机器上 `ping -c 1 主机名` 逐台测试，全部能解析且能通。

> **易错点**：
>
> - 克隆好的主机必须一台一台顺序启动、逐台修改，不要同时启动——所有克隆机都带着模板机的 IP，同时开机必然 IP 冲突；
> - 删 UUID 的原因：多台主机携带相同 UUID 时，NetworkManager / udev 难以区分网卡，可能出现配置错乱、接口名漂移；删除后系统下次启动会重新生成；
> - `sed 's#200#41#g'` 是全文替换，如果配置里网关或 DNS 恰好含 `200`（例如 `GATEWAY=10.0.0.200`）会被一起改掉——替换前先 `grep 200 配置文件` 看一眼命中范围，或把匹配写得更精确（如 `s#IPADDR=.*200#IPADDR=10.0.0.41#`）；
> - `systemctl restart network` 之前务必保存好当前会话，网卡配置写错会导致失联，只能在虚拟机控制台里修复；
> - 克隆机无法远程连接时：先用 `ping 新IP` 测试，再关闭远程终端软件重新打开，排除会话缓存问题。

## 小结

1. 架构规划先分层再定表：接入、负载均衡、Web、数据、存储、备份各司其职，每个角色都要想清楚「它解决什么问题、挂了会怎样、怎么备份」。
2. 命名与 IP 规则先于表格：角色缩写 + 编号、按角色分段并预留地址、内网 172.16.1.0/24 承担服务器间通信、外网 10.0.0.0/24 只给对外服务角色。
3. 规划表落成纯文本后立即用 `awk | sort | uniq -d` 校验主机名与 IP 唯一性，规划期的重复就是上线期的 IP 冲突，人眼查表不如让机器查。
4. hosts 映射是全集群互通的底座，同一份文件下发到每台机器，并用「反查 IP、正查主机名、条目计数」三向验证；ping 输出里括号中的 IP 能证明解析走的是 hosts。机器规模上去之后，hosts 迟早要让位给内网 DNS。
5. 克隆方式按需选择：学习环境用链接克隆（省资源、快），企业环境用完整克隆（模板机删除不影响克隆机）。
6. 克隆机上线三件事：`hostnamectl set-hostname` 改主机名、sed 批量改两张网卡 IP、`sed -i '/UUID/d'` 删 UUID；`diff -u` 前后对比确认无误伤后再 `systemctl restart network`。追求完整的话，machine-id 也一并重置。
7. 克隆机逐台顺序启动是铁律，同时启动必然 IP 冲突；改配置前先备份（`.bak`），重启网络前先保存会话，这是网络类操作的两条保命习惯。

> **参见**：综合架构开篇：架构组成、环境规划、模板机优化与 rsync 入门 · 备份服务 rsync · day14 文件批量压缩作业实操
{% endraw %}
