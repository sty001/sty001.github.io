---
title: "day02-硬件与系统概念作业实操"
date: 2026-10-24 09:56:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操]
slug: "linux-homework-02"
---

{% raw %}
day2 的主题是 Linux 系统概念。作业分基础 3 题、扩展 1 题，每一题都实际做一遍，过程、结果、易错点一个不少。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令（numfmt、awk、sort、uniq、date、stat、du、df 等）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`。
- **B 级（标准命令 + 预期输出）**：系统级命令（lsblk、fdisk、storcli、ipmitool、systemctl 等）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `（预期输出，CentOS 7）`，并说明在真机执行方式。

实操目录统一用 `/tmp/hw/day2`，示例中先 `cd` 到该目录后用相对路径，读者可复制。

```bash
mkdir -p /tmp/hw/day2 && cd /tmp/hw/day2
```

## 题 1：如果你购买了一块 100G 的硬盘，硬盘实际大小应该多大，如何进行运算

**考察点**：厂商按 1000 进制、系统按 1024 进制，这套差异要能讲明白，还要动手算出标称 100G 的硬盘在系统里显示多大。

**实现思路**：手工推导一遍换算公式，然后用 numfmt、awk 实算对答案，最后上真机 lsblk、df -h 看显示值——三步对上了，这道题才算懂。

**实操过程**：

步骤 1：理解两套进制。

| 标准 | 使用者 | 1K | 1M | 1G |
| --- | --- | --- | --- | --- |
| 1000 进制（SI） | 硬盘厂商 | 1000 B | 1000 KB | 1000 MB |
| 1024 进制（IEC） | 操作系统 | 1024 B | 1024 KB | 1024 MB |

厂商标称 100G = 100 x 1000^3 = 100,000,000,000 字节；系统按 1024 进制显示 = 100,000,000,000 / 1024^3 ≈ 93.13 GiB。所以标称 100G 的硬盘，系统里大约显示 93 GiB，"缩水"约 6.87 GiB，这不是质量问题，是两套单位标准之差。

为什么会有两套进制？1024 来自二进制世界：内存和 CPU 地址总线天然按 2 的幂编址，1024 = 2^10，用 2 的幂做换算对硬件最自然；而硬盘、U 盘这类存储设备沿用国际单位制（SI）的 1000 进制，因为厂商标称直接对标克、米这类十进制单位，数字上也好看。两套标准谁都没错，只是没人提前对齐，这个"缩水"误会就这么留了几十年。

步骤 2：用 numfmt 实际换算。

`已实操`：

```bash
# 厂商 100G 硬盘的字节数，换算为系统显示的 GiB（--round=nearest 四舍五入）
numfmt --to=iec-i --suffix=B --round=nearest 100000000000
```

输出：

```console
93GiB
```

注意 numfmt 默认向上取整，同一数值不加 `--round=nearest` 会得到 94GiB；精确小数要用 awk 计算：

```bash
# 精确到小数点后两位
awk 'BEGIN{printf "%.2f GiB\n", 100000000000/1024/1024/1024}'
```

输出：

```console
93.13 GiB
```

步骤 3：批量换算常见容量，形成速查表。

`已实操`：

```bash
# 把常见标称容量一次性换算成系统显示值
for size in 100G 120G 128G 200G 256G 500G 1T 2T 4T; do
  bytes=$(echo $size | awk '{v=$0; sub(/[A-Za-z]/,"",v); u=substr($0,length($0)); if(u=="T") printf "%d", v*1000*1000*1000*1000; else printf "%d", v*1000*1000*1000}')
  gib=$(awk -v b=$bytes 'BEGIN{printf "%.2f", b/1073741824}')
  echo "$size = $bytes bytes ≈ $gib GiB"
done
```

输出：

```console
100G = 100000000000 bytes ≈ 93.13 GiB
120G = 120000000000 bytes ≈ 111.76 GiB
128G = 128000000000 bytes ≈ 119.21 GiB
200G = 200000000000 bytes ≈ 186.26 GiB
256G = 256000000000 bytes ≈ 238.42 GiB
500G = 500000000000 bytes ≈ 465.66 GiB
1T = 1000000000000 bytes ≈ 931.32 GiB
2T = 2000000000000 bytes ≈ 1862.65 GiB
4T = 4000000000000 bytes ≈ 3725.29 GiB
```

速查结论：**标称容量 x 0.9313 ≈ 系统显示的 GiB 数**。

步骤 4：在真机上查看系统识别的实际大小。

（预期输出，CentOS 7）

```bash
# 查看系统识别的磁盘与分区大小
lsblk
# 查看文件系统层的可用空间
df -h
```

```console
NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda      8:0    0  100G  0 disk
├─sda1   8:1    0    1G  0 part /boot
├─sda2   8:2    0    4G  0 part [SWAP]
└─sda3   8:3    0   95G  0 part /
```

注意：lsblk 显示的 100G 是取整后的约数，精确字节数要用 `blockdev --getsize64 /dev/sda` 查看。且系统可用容量还要再扣掉文件系统元数据、inode 表和保留块，所以"可用空间"会比 93.13 GiB 再小一点。

**验证方法**：用 `blockdev --getsize64 /dev/sdX` 拿到精确字节数，除以 1024^3 后应与 93.13 吻合；`numfmt --to=iec-i` 的结果与 awk 的两位小数结果互相印证，说明计算无误。

> **易错点**：
> - 把"系统显示 93G"当成硬盘缺容量：这是单位标准差异，非质量问题。
> - 混淆 GiB 与 GB：GiB 是 1024 进制，GB 是 1000 进制，书面表述要用对单位。
> - 忽略 numfmt 的取整方式：默认向上取整得 94GiB，要精确值得加 `--round=nearest` 或用 awk。
> - 以为 93.13 GiB 全部可用：文件系统开销和保留块（ext4 默认 5%）会再占一部分。
> - 采购 SSD 时还要注意 OP 预留空间与磨损均衡，实际可用同样小于标称。

> **参见**：Linux 系统概念 的"硬盘的数据存储单位"。

### 辨析：GB 与 GiB

GB 和 GiB 不是同一个单位的两种写法，是两套进制：GB 走 1000 进制，1 GB = 10^9 字节；GiB 走 1024 进制，1 GiB = 2^30 字节。`lsblk`、`free -h`、`df -h` 显示的其实是 GiB 口径，只是没打那个 i。对外沟通（采购单、容量报备）统一用 GB，看系统输出时心里换算成 GiB，两边就不会打架。

## 题 2：Dell 服务器如何配置 RAID 卡

**考察点**：Dell 服务器 RAID 卡（PERC）的配置流程要说得清：进配置界面、建磁盘组、配热备，一步不落。

**实现思路**：RAID 配置是板级硬件操作，Git Bash 模拟不了，只能按 B 级给标准步骤和每步的界面要素。本地 Ctrl+R 和远程 iDRAC 两条入口分开写，装完系统再补验证命令。

**实操过程**：

步骤 1：进入 RAID 卡配置界面。开机自检（POST）阶段，当屏幕提示按组合键时按下进入。

（预期输出，CentOS 7）

```text
Dell PowerEdge Server
...
PERC H730P Mini BIOS
Press <Ctrl><R> to Run Configuration Utility
```

不同厂商的进入组合键：

| 厂商 | RAID 卡 | 进入按键 |
| --- | --- | --- |
| Dell | PERC 系列 | Ctrl + R |
| HP | Smart Array | F9 或引导界面选 HPE Smart Storage Administrator |
| 华为 | 板载 SAS / RAID 卡 | 开机提示阶段按对应功能键（常见 Ctrl + R / Ctrl + H） |

步骤 2：创建磁盘组（Virtual Disk）。进入配置界面后按以下流程操作：

```text
1. 在主界面确认 No Configuration present 或已有阵列状态
2. 光标移到 Controller 菜单，按 F2 选择 Create New VD（创建新虚拟磁盘）
3. 在 RAID Level 处选择级别：RAID 5 / RAID 10 等
4. 在 Physical Disks 列表中，用空格勾选参与阵列的硬盘（至少满足该级别最少盘数）
5. 在 VD Name 处命名，VD Size 默认全部容量，可调整
6. 光标移到 OK，回车确认创建
```

步骤 3：初始化与热备设置。

```text
1. 创建完成后回到主界面，新 VD 会显示 Initialization 状态
   快速初始化（Fast Initialization）会清零前部元数据，建议生产用完整初始化
2. 配置全局热备：在 Physical Disks 列表选中一块空闲盘，按 F2
   选择 Make Global HS（全局热备），该盘可在任意阵列中顶替坏盘
3. 也可按 F2 选择 Make Dedicated HS，把热备盘绑定到指定阵列
```

步骤 4（远程方式）：通过 iDRAC 远程配置。服务器上架后，如果人在办公室，可以走带外管理通道：

```text
1. 给 iDRAC 独立管理网口插网线，开机自检时按 F2 进入 System Setup
2. 进入 iDRAC Settings → Network，配置静态 IP、子网掩码、网关
3. 浏览器访问 https://iDRAC-IP，用默认账号登录（首次登录需改密码）
4. 左侧进入 Storage → Controller，可在线查看阵列状态、创建虚拟磁盘
   注意：在线做配置变动要评估业务影响，重要操作安排在维护窗口
```

步骤 5：装好系统后验证阵列状态。

（预期输出，CentOS 7）

```bash
# 查看系统识别到的逻辑盘
lsblk
# Dell 硬件 RAID 用厂商命令行工具查看详细状态
/opt/MegaRAID/storcli/storcli64 /c0 show
# 或使用旧版工具
MegaCli64 -LDInfo -Lall -aALL
```

```console
Drive's Positions: 0 1 2 3
Number of PDs: 4
...
Virtual Drive: 0 (Target Id: 0)
Name: data_vd
RAID Level: Primary-5, Secondary-0, RAID Level Qualifier-3
Size: 12.0 TB
State: Optimal
```

State 为 Optimal 表示阵列健康；Degraded 表示有盘掉线正在降级运行，需立即处理。

顺带说下 RAID 5 为什么坏一块盘数据还在：它把校验值分布存到每块盘上，校验值是同一条带上其他盘数据的异或（XOR）结果。XOR 有个好用的特性——a XOR b = c，那么 a XOR c 就能还原 b。所以任意一块盘坏掉，用剩下的盘加校验值逐条带异或一遍，数据全能反推回来。这就是"能容 1 块盘故障"的数学基础，也是它最多只容 1 块的原因；RAID 6 多了一套独立校验（P + Q），所以能容 2 块。

热备盘也要纳入日常巡检：它长期不通电写入，真顶上的时候状态如何没人说得准，定期跑一致性校验才放心。

**验证方法**：创建 VD 后 `lsblk` 应看到对应大小的逻辑盘（RAID 5 四盘 4TB 可用容量为 (4-1) x 4TB = 12TB，厂商十进制口径）；`storcli64 /c0 show` 中 VD 状态为 Optimal；配置热备后 `storcli64 /c0 /eall /sall show` 能看到 Global HS 属性的空闲盘。

> **易错点**：
> - 忘记初始化就装系统：未完成初始化的阵列直接使用，性能和可靠性都没有保障。
> - 不配热备盘：一块盘损坏后没有自动顶替，阵列长时间降级运行，再坏一块即数据全丢。
> - RAID 5 使用大盘（4TB 以上）：重建时间长，重建期间再坏盘风险高，优先 RAID 6 / RAID 10。
> - 在配置界面误选 Clear Configuration：会清掉已有阵列配置，操作前务必确认服务器上无业务数据。
> - 远程 iDRAC 用默认口令不修改：管理网暴露等于把服务器钥匙挂在门上，首次登录必须改密码。

> **参见**：Linux 系统概念 的"RAID 卡""远程管理卡"；计算机硬件组成 的"RAID：把多块磁盘整合起来"。

## 题 3：进行课程知识总结

**考察点**：把 day1 至 day2 的硬件与系统概念组织成结构化、可检索、可自测的知识体系。

**实现思路**：按规范把"总结型"作业转化为：知识卡片 + 速查表 + 可直接运行的示例（真实执行）+ 自测题。

**实操过程**：

步骤 1：知识卡片——硬件组成。

| 部件 | 关键参数 | 运维视角速记 |
| --- | --- | --- |
| CPU | 架构（x86_64 / ARM）、路数、核数、主频、缓存 | 双路四核 = 2 个物理 CPU、共 4 个物理核心 |
| 内存 | 容量、ECC、频率、通道数 | 服务器必须 ECC，成对插组双通道 |
| 磁盘 | 接口（SATA / SAS / NVMe）、转速（7200 / 15K）、容量 | 系统盘可用 SSD，数据盘按容量和 IO 需求选 |
| RAID | 0 / 1 / 5 / 6 / 10 / 50 / 60 | 常用 5、10；大盘用 6；RAID 不是备份 |
| 电源 | 冗余模块数 | 双电源分别接两路电 |
| 管理 | BMC / iDRAC / iLO / RSA | 独立管理网口，系统挂了也能远程管 |

步骤 2：知识卡片——系统概念。

| 主题 | 核心要点 |
| --- | --- |
| 操作系统 | 人与硬件沟通的桥梁 = 硬件 + 内核 + Shell（解释器）+ 应用程序 |
| 两套容量单位 | 厂商 1000 进制 vs 系统 1024 进制，标称 100G 系统显示约 93.13 GiB |
| buffer / cache | buffer 服务写（缓冲），cache 服务读（缓存），均在内存、可回收 |
| RAID 卡 | 把多块硬盘整合为逻辑盘，在容量、安全、效率间取舍 |
| 远程管理卡 | BMC 通过 IPMI 实现带外管理，独立网口独立 IP |
| 服务器采购 | 先定品牌型号，出三个方案供选择，再找集成商询价 |

步骤 3：常用命令速查表。

| 命令 | 用途 |
| --- | --- |
| `lscpu` | 查看 CPU 型号、路数、核数 |
| `dmidecode -t memory` | 查看内存型号、频率、ECC |
| `lsblk` | 查看磁盘与分区树 |
| `free -h` | 查看内存与 buff/cache |
| `df -h` | 查看文件系统使用率 |
| `du -sh 目录` | 统计目录实际占用 |
| `stat 文件` | 查看文件元数据（大小、时间戳、权限） |
| `md5sum 文件` | 计算校验和，验证数据完整性 |

步骤 4：可直接运行的示例（以下均在 Git Bash 真实执行，读者可复现）。

`已实操`：

```bash
# 示例 1：统计访问来源 top3（sort + uniq + sort -rn 组合）
printf 'web01\nweb02\nweb01\nweb03\nweb01\n' > access.log
sort access.log | uniq -c | sort -rn
```

输出：

```console
      3 web01
      1 web03
      1 web02
```

```bash
# 示例 2：date 三种常用格式
date '+%F %T'
date '+%Y-%m-%d'
date -d 'yesterday' '+%F'
```

输出：

```console
2026-10-24 03:22:20
2026-10-24
2026-10-23
```

```bash
# 示例 3：stat 查看文件精确字节数（判断容量用字节数更准）
stat -c '%s bytes, %y' access.log
```

输出：

```console
30 bytes, 2026-10-24 03:22:20.375833600 +0800
```

```bash
# 示例 4：du 统计目录大小、df 查看磁盘使用率
du -sh /tmp/hw
df -h /tmp | awk 'NR==1 || NR==2 {print $1, $2, $3, $4, $5, $6}'
```

输出：

```console
17M	/tmp/hw
Filesystem Size Used Avail Use% Mounted
C:/Users/user/AppData/Local/Temp 476G 210G 267G 45% /tmp
```

```bash
# 示例 5：容量换算（对应题 1 的核心结论）
numfmt --to=iec-i --suffix=B --round=nearest 100000000000
awk 'BEGIN{printf "标称100G ≈ %.2f GiB，少了 %.2f GiB\n", 100*1000^3/1024^3, 100-100*1000^3/1024^3}'
```

输出：

```console
93GiB
标称100G ≈ 93.13 GiB，少了 6.87 GiB
```

步骤 5：自测题（含参考答案）。

1. 一块标称 2T 的硬盘，系统显示约多少 GiB？答：2 x 0.9313 ≈ 1862.65 GiB。
2. `free -h` 中 buff/cache 很大，是否说明内存不足？答：不是，buff/cache 可回收，应看 available 列。
3. RAID 5 用 4 块 4TB 盘，可用容量是多少？答：(4-1) x 4TB = 12TB（十进制标称），系统显示约 11.1 TiB。
4. 服务器掉电时，已写入文件但未落盘的数据会怎样？答：丢失，需 fsync 确认落盘或依赖 RAID 卡电池保护写缓存。
5. 双路 24 核的服务器总物理核心数是多少？答：2 x 24 = 48 个物理核心。

**验证方法**：示例 1 至 5 在 Git Bash 或任意 Linux 上直接粘贴执行，输出与文中一致；自测题 5 题全部答对说明知识卡片掌握到位。

> **易错点**：
> - 总结只抄结论不记命令：运维场景要"概念 + 命令 + 预期输出"三位一体。
> - RAID 容量估算忘记扣校验盘：RAID 5 是 (N-1) 块盘的容量，不是 N 块。
> - 容量单位混用：对外说 GB（厂商口径），对内看 GiB（系统口径），换算别用错进制。

> **参见**：Linux 系统概念 全文；计算机硬件组成 的"知识卡片"。

## 题 4（扩展作业）：如何通过网络安装系统（PXE / Kickstart）

**考察点**：能否讲清通过网络（PXE + Kickstart）批量安装系统的流程与关键配置。

**实现思路**：先画 PXE 启动的数据流，再过一遍服务端搭建的标准命令，最后给一份最小可用的 ks.cfg 应答文件，流程、配置、验证齐了。

**实操过程**：

步骤 1：理解 PXE 网络启动流程。

```text
客户机网卡 PXE 启动
  → 1. DHCP 服务器分配 IP，并告知"引导文件在哪台 TFTP 服务器"
  → 2. 客户机从 TFTP 下载引导程序（pxelinux.0 / bootx64.efi）
  → 3. 引导程序加载安装内核与 initrd，读取启动参数
  → 4. 启动参数指定 Kickstart 文件位置（inst.ks=http://10.0.0.1/kickstart/ks.cfg）
  → 5. 安装器按 ks.cfg 全自动完成分区、网络、软件包安装
  → 6. 安装完成自动重启，交付可用系统
```

无人值守安装的三个前提：DHCP 分配地址、TFTP 提供引导文件、HTTP / FTP / NFS 提供安装源与 ks.cfg。

步骤 2：服务端搭建（以 CentOS 7 为例，用 dnsmasq 同时提供 DHCP 与 TFTP）。

（预期输出，CentOS 7）

```bash
# 安装必要组件
yum install -y dnsmasq syslinux xinetd httpd vsftpd
```

dnsmasq 关键配置（/etc/dnsmasq.conf 节选）：

```ini
# DHCP 地址池与租期
dhcp-range=10.0.0.100,10.0.0.200,12h
# 网关与 DNS
dhcp-option=option:router,10.0.0.1
dhcp-option=option:dns-server,10.0.0.1
# PXE 引导文件名与 TFTP 服务器地址
enable-tftp
tftp-root=/var/lib/tftpboot
dhcp-boot=pxelinux.0,10.0.0.1,10.0.0.1
```

TFTP 引导目录就绪：

```bash
# 拷贝引导程序到 TFTP 根目录
cp -r /usr/share/syslinux/* /var/lib/tftpboot/
# 放置安装内核与 initrd（从系统 ISO 的 images/pxeboot/ 取出）
cp /mnt/iso/images/pxeboot/vmlinuz  /var/lib/tftpboot/centos7/
cp /mnt/iso/images/pxeboot/initrd.img /var/lib/tftpboot/centos7/
# 配置默认启动项
mkdir -p /var/lib/tftpboot/pxelinux.cfg
```

/var/lib/tftpboot/pxelinux.cfg/default 内容：

```text
default centos7
label centos7
  kernel centos7/vmlinuz
  append initrd=centos7/initrd.img inst.ks=http://10.0.0.1/kickstart/ks.cfg ip=dhcp
```

步骤 3：编写 Kickstart 应答文件。以下为最小可用示例（`rootpw` 一律用占位符，实际用 `openssl passwd -6` 生成哈希并以 `--iscrypted` 传入）：

```text
# 安装源：HTTP 网络源
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

把该文件放到 HTTP 服务目录（如 /var/www/html/kickstart/ks.cfg），保证客户机可以下载。

步骤 4：验证安装结果。

（预期输出，CentOS 7）

```bash
# 安装完成后在客户机上确认系统版本、IP、主机名
cat /etc/redhat-release
ip a show ens160
hostnamectl
# 对照 ks.cfg 逐项核对：IP、网关、分区、时区、软件包
lsblk
df -h
```

**验证方法**：客户机网卡启动后自动获取 IP 并进入安装界面，全程无人工交互即说明 PXE + Kickstart 生效；安装完成后，`ip a` 看到的 IP、`lsblk` 看到的分区与 ks.cfg 中 `network`、`part` 指令逐项一致。

> **易错点**：
> - 忘记在 DHCP 里指定 dhcp-boot：客户机下载不到引导文件，PXE 启动失败。
> - ks.cfg 里写明文密码：等于把口令发布到网络上，必须 `rootpw --iscrypted` 传哈希。
> - 网卡名写死：新服务器的网卡名可能与 `device=ens160` 不一致，导致网络配置不生效，可先用 `ip=dhcp` 再按实际网卡名调整。
> - BIOS 未开启网络启动：部分服务器默认禁用 PXE，需在 BIOS / UEFI 里启用 Network Boot。
> - 安装源与 ks.cfg 地址不可达：先用 `curl -I http://10.0.0.1/kickstart/ks.cfg` 确认客户机视角下地址有效。
> - 生成 ks.cfg 的捷径：装完一台机器后，root 家目录的 anaconda-ks.cfg 就是本次安装的应答记录，可改作模板复用。

> **参见**：系统安装部署 的"Kickstart 自动安装"。

## 本篇小结

把 day2 的收获捋一下：

- 标称 100G 的盘就是 100,000,000,000 字节，系统按 1024 进制折算约 93.13 GiB，速算乘 0.9313。
- 要精确小数找 awk；numfmt 默认向上取整，想要 93GiB 得加 `--round=nearest`。
- Dell 配 RAID 两条路：开机 Ctrl + R 进 PERC 界面，或者远程 iDRAC。流程都是建磁盘组、初始化、配热备。
- RAID 5 容量按 (N-1) 块盘估，坏盘靠 XOR 反推恢复；大盘别用 RAID 5，重建窗口太危险。
- 总结知识别只抄结论，"概念 + 命令 + 预期输出"凑齐才算掌握，配几道自测题检查。
- 网络安装四件套：DHCP 指路、TFTP 给引导程序、HTTP 提供安装源、Kickstart 负责无人值守应答，缺一不可。
{% endraw %}
