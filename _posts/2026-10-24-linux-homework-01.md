---
title: "day01-硬件与存储作业实操"
date: 2026-10-24 09:57:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-01"
---

{% raw %}



day1 讲的是计算机硬件组成。作业一共 3 题，每题都按"题目 + 完整过程 + 可验证结果 + 易错点"的结构亲手过一遍。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令（dd、md5sum、stat、du、df、sync、sort、uniq 等）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`。
- **B 级（标准命令 + 预期输出）**：系统级命令（free、dmidecode、ipmitool 等）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `（预期输出，CentOS 7）`，并说明在真机执行方式。

实操目录统一用 `/tmp/hw/day1`，示例中先 `cd` 到该目录后用相对路径，读者可复制。

```bash
mkdir -p /tmp/hw/day1 && cd /tmp/hw/day1
```

## 题 1：机架式服务器品牌以及服务器配置参数
{: .sec-expl}

**考察点**：主流机架式服务器的品牌和系列要能张口就来，还要能按 CPU / 内存 / 硬盘 / RAID 卡 / 电源 / 网卡这几个维度把一台机器的配置说完整。

**实现思路**：调研拆成两张表——品牌型号表管"买什么"，配置参数表管"买到什么"。最后补几条真机核对命令，结论不是纸上谈兵，能对着机器验。

**实操过程**：

步骤 1：整理主流品牌与机架系列（1U / 2U 为常见形态，4U 支持更多硬盘位）。

品牌型号表：

| 品牌 | 主流机架系列 | 形态 | 特点 |
| --- | --- | --- | --- |
| Dell | PowerEdge R 系列（R740、R750 等） | 1U / 2U | 市场占有率高，iDRAC 远程管理口碑好 |
| HP（HPE） | ProLiant DL 系列（DL360、DL380 等） | 1U / 2U | 企业级常用，iLO 远程管理成熟 |
| 华为 | FusionServer（2288H 等）、鲲鹏系列 | 2U | 国产化主力，鲲鹏为 ARM 架构 |
| 浪潮 | NF 系列（NF5280 等） | 2U | 国内出货量大，定制化能力强 |
| H3C | R 系列、UniServer | 1U / 2U | 网络起家，服务器与网络协同 |
| 联想 | ThinkSystem（原 IBM x86 服务器业务） | 1U / 2U | 继承 IBM 部分技术积累 |

Dell 机架服务器代际速查：R620 为第 12 代，R720 / R730 为第 13 代，R740 为第 14 代，R750 为第 15 代。代际越新，支持的 CPU 代际、内存频率、硬盘接口（NVMe）和远程管理功能越强。

步骤 2：按六个配置维度整理典型配置参数。

配置参数表：

| 配置维度 | 常见参数 | 示例值 | 运维关注点 |
| --- | --- | --- | --- |
| CPU | 架构、路数、核数、主频、缓存 | 2 路 Intel Xeon Silver 4310，12 核 / 路，2.1 GHz | 双路四核 = 2 个物理 CPU、共 4 个物理核心；核心数按"路数 x 每路核数"算 |
| 内存 | 容量、代数、频率、ECC、通道 | 4 x 32GB DDR4 3200 ECC | 服务器必须 ECC；按主板插槽颜色成对插入组双通道 |
| 硬盘 | 接口、转速、容量、数量 | 2 x 480GB SSD（SATA）+ 4 x 4TB（SAS 7200 转） | 系统盘用 SSD，数据盘按容量和 IO 需求选 |
| RAID 卡 | 型号、缓存、电池保护 | PERC H730P，2GB 缓存，含 BBU | 缓存 + 电池（或闪存备份）防止掉电丢写缓存数据 |
| 电源 | 冗余模块数、功率 | 2 x 750W 冗余电源 | 双电源分别接两路市电，坏一个不影响运行 |
| 网卡 | 数量、速率 | 2 x 1GbE 板载 + 4 口 10GbE | 业务网与管理网分离；管理口接入 BMC 管理网络 |

步骤 3：在真机上核对配置。以下命令在已装 Linux 的服务器上执行，可逐项验证表格里的参数。

（预期输出，CentOS 7）

```bash
# 查看 CPU 型号、路数、核数
lscpu
# 查看内存型号、频率、是否 ECC、每条容量
dmidecode -t memory
# 查看磁盘型号、容量、接口
lsblk -o NAME,SIZE,TYPE,MODEL,TRAN
# 查看 RAID 卡型号与阵列状态（硬件 RAID 用厂商工具）
storcli64 /c0 show
# 查看电源、风扇、温度等硬件健康状态（通过带外管理）
ipmitool sensor list
```

输出示例（lscpu 节选）：

```console
Architecture:          x86_64
CPU(s):                12
Thread(s) per core:    2
Core(s) per socket:    6
Socket(s):             1
Model name:            Intel Xeon CPU E5-2620 v3 @ 2.40GHz
```

**验证方法**：对照上表逐项核对——`lscpu` 的 Socket(s) 对应路数、Core(s) per socket 对应每路核数；`dmidecode -t memory` 的 Error Correction Type 为 Multi-bit ECC 才说明 ECC 已生效；`lsblk` 看到的单盘容量总和应大于 RAID 阵列可用容量（RAID 5 按 (N-1) x 单盘容量计算）。

> **易错点**：
> - 混淆"路数"与"核数"：双路 = 2 个物理 CPU，不是 2 个核。
> - 混淆品牌与系列层级：Dell 的 R 系列、HP 的 DL 系列是系列名，不是具体型号，采购单上必须写到具体型号（如 R740）。
> - 忽略二手与保修：同型号有全新机和翻新机之分，采购时要核对保修年限与出厂日期。
> - 配置表漏掉远程管理卡：Dell iDRAC、HP iLO 是服务器的独立管理通道，上架时必须插管理网线，否则无法远程运维。

> **参见**：计算机硬件组成 的"服务器的种类""服务器硬件组成详解""服务器品牌与代际"。

## 题 2：总结缓冲和缓存的概念（缓存服务器）
{: .sec-know}

**考察点**：buffer（缓冲）和 cache（缓存）到底差在哪，`free -h` 的 buff/cache 列怎么读，以及"缓存服务器"凭什么快。

**实现思路**：一张概念对比表打底，然后拿真机 `free -h` 输出逐列过一遍，最后在本地跑一组写盘实验——buffer 是不是"写延迟"，cache 是不是"读加速"，跑出数据说话。

**实操过程**：

步骤 1：概念对比。buffer 与 cache 都占用内存，但服务的方向相反。

| 概念 | 英文 | 数据流向 | 作用 | 所在层 |
| --- | --- | --- | --- | --- |
| 缓冲 | buffer | 应用写出的数据先落到内存，再刷到磁盘 | 写延迟：合并写、异步落盘，加快写的返回速度 | 内核层（块设备缓冲） |
| 缓存 | cache | 磁盘读过的数据留在内存，下次直接读内存 | 读加速：热数据命中内存，避免重复读盘 | 内核层（page cache） |

两者的关系可以概括为一句话：**buffer 为"写"服务，cache 为"读"服务，都由内核自动管理，内存不够时可被回收**。

步骤 2：读懂 `free -h` 输出。`free -h` 的 buff/cache 列就是内核持有的缓冲与缓存总量。

（预期输出，CentOS 7）

```bash
free -h
```

```console
              total        used        free      shared  buff/cache   available
Mem:           3.7G        1.1G        512M         26M        2.1G        2.3G
Swap:          2.0G          0B        2.0G
```

各列含义：

| 列 | 含义 | 运维视角 |
| --- | --- | --- |
| total | 物理内存总量 | 硬件上限 |
| used | 已被进程占用的内存 | 真正"被程序拿走的" |
| free | 完全空闲的内存 | 数值小是正常的，不代表内存不足 |
| shared | 多个进程共享的内存（如 tmpfs） | 一般关注度低 |
| buff/cache | 缓冲 + 缓存占用的内存 | 可随时回收，是系统在"借内存提速" |
| available | 估算可用内存（free + 可回收的 buff/cache） | 判断内存是否紧张要看这一列 |

判断内存是否够用的经验：持续观察 `available` 列，明显变小才紧张；`free` 很小而 `available` 很大，说明缓存利用充分，是健康状态。

步骤 3：本地实验，验证 buffer 的"写延迟"效果。同样写 64MB 数据，加不加 `conv=fsync`（强制刷盘）的耗时差异，就是 buffer 在起作用。

`已实操`：

```bash
# 步骤 1：不带 fsync，写入命令很快返回，数据此时主要在内核缓冲中
dd if=/dev/urandom of=buf-demo-1.bin bs=1M count=64
```

输出：

```console
67108864 bytes (67 MB, 64 MiB) copied, 0.0317069 s, 2.1 GB/s
```

```bash
# 步骤 2：带 conv=fsync，必须等数据真正落到磁盘才返回，耗时明显增加
dd if=/dev/urandom of=buf-demo-2.bin bs=1M count=64 conv=fsync
```

输出：

```console
67108864 bytes (67 MB, 64 MiB) copied, 0.160353 s, 419 MB/s
```

```bash
# 步骤 3：清理演示文件
rm -f buf-demo-1.bin buf-demo-2.bin
```

步骤 4：理解 cache 的"读加速"效果。第一次读文件要从磁盘加载，重复读同一文件时命中 page cache，速度大幅提升。Linux 上可以用 `dd` 连续读同一文件两次对比耗时，也可以先 `echo 3 > /proc/sys/vm/drop_caches` 清掉缓存再读做对照（生产环境慎用）。

**验证方法**：步骤 3 中两次 dd 的速率差（2.1 GB/s 对 419 MB/s）即为 buffer 带来的写加速比例；速率越高说明数据越多地暂存在内存而未真正落盘。清缓存前后重复读同一文件，第二次更快即证明 cache 命中。

> **易错点**：
> - 看到 `free` 很小就以为内存不够：buff/cache 随时可回收，要看 `available`。
> - 认为 buffer/cache 是被浪费的内存：恰恰相反，空闲内存不拿来做缓存才是浪费。
> - 忽略"延迟写"的风险：只写进 buffer 就认为数据安全，掉电时未刷盘的数据会丢失（这正是题 3 的切入点）。
> - `sync` 只负责发起刷盘，不保证磁盘物理写入完成（除非设备带掉电保护），重要场景要用 RAID 卡缓存 + 电池或应用层确认。

> **参见**：计算机硬件组成 的"内存：缓冲与缓存"；Linux 系统概念 的"内存：CPU 与磁盘之间的桥梁"。

### 辨析：buffer 与 cache

两个词都常被翻译成"缓存"，所以容易混。区分它们有个简单抓手：看数据往哪流。往磁盘写，中途歇脚的地方叫 buffer；从磁盘读，提前搬进内存待命的地方叫 cache。实际内核里两者经常共用同一批 page，`free -h` 也把它们合在 buff/cache 一列统计——概念上分开理解，计量上合在一起，这不矛盾。日常排查内存问题，也犯不着把两者精确拆开，看 available 就够了。

生产上一句话：评估应用"写进去了没"，别只看 buffer，要么 fsync，要么用带掉电保护的 RAID 卡缓存，否则掉电就是丢数据。

## 题 3：总结企业存储数据的案例——大型企业如何避免内存中的数据丢失
{: .sec-ex}

**考察点**：企业存储数据的典型案例要能总结出来，更关键的是回答"先写内存再落盘"的架构里，内存中那份不安全的数据怎么保住。

**实现思路**：先画两张数据流图，大型、中小企业各一张；然后专门讲数据只到内存为什么不算安全，配持久化、RAID、备份三道防线；收尾用 dd + md5sum 在本地把"写盘 - 读回 - 校验"整个走一遍。

**实操过程**：

步骤 1：企业存储数据案例总结。

大型企业（高并发场景）：

```text
存储数据：数据 → 内存中（缓冲） → 存储到磁盘中
读取数据：磁盘数据 → 内存中（缓存） → 从内存中读取
```

先写内存再落盘，读的时候尽量命中内存，用内存的高性能换取高并发下的响应速度。代价是：数据在内存中存在一个"危险窗口"，宕机或掉电时未落盘部分会丢失。

中小型企业（低并发场景）：

```text
存储数据：数据 → 直接存储到磁盘中
读取数据：磁盘数据 → 内存中 → 从内存中读取
```

并发量不高，直接落盘即可，架构更简单，数据丢失窗口也更小。

步骤 2：大型企业避免内存数据丢失的三道防线。

| 防线 | 措施 | 说明 |
| --- | --- | --- |
| 第一道：落盘确认 | 应用写完数据后调用 fsync / fdatasync，或由数据库按配置刷盘 | 把"进入 buffer"变成"真正落盘"，消除掉电丢失窗口 |
| 第二道：磁盘冗余 | RAID（常用 RAID 5 / 10，大盘用 RAID 6） | 防止单块硬盘硬件故障导致阵列数据丢失 |
| 第三道：备份策略 | 全量 + 增量备份，异地容灾，3-2-1 原则（3 份副本、2 种介质、1 份异地） | 防误删除、病毒、文件系统损坏——RAID 防不了这些 |

RAID 不是备份：RAID 只能防硬盘硬件故障，重要数据仍需异地备份。数据库场景还要配合主从复制、binlog、事务日志，保证已确认提交的数据不丢。

3-2-1 原则为什么这样定？"2 种介质"防的是同一批次介质集体失效（比如一次采购的硬盘带相同固件缺陷），"1 份异地"防的是机房级灾难——火灾、水淹、勒索病毒加密整个机房，任何单一防线都挡不住这类风险。

还有一个选型细节：md5sum 验证传输完整性够用且成本低，但安全场景（校验下载的安装包有没有被篡改）建议换 sha256sum——md5 已有构造碰撞的公开方法，防不住恶意篡改。

步骤 3：本地完整演示"写盘 - 读回 - 校验"闭环，模拟企业数据保全流程。

`已实操`：

```bash
# 步骤 1：生成 8MB 模拟业务数据，conv=fsync 确保真正落盘
dd if=/dev/urandom of=enterprise-data.bin bs=1M count=8 conv=fsync
```

输出：

```console
8+0 records in
8+0 records out
8388608 bytes (8.4 MB, 8.0 MiB) copied, 0.0147711 s, 568 MB/s
```

```bash
# 步骤 2：计算校验和，作为"数据指纹"存档
md5sum enterprise-data.bin
```

输出：

```console
bdee70674d5099779a75cd10a78e0b21 *enterprise-data.bin
```

```bash
# 步骤 3：模拟"从备份介质读回"并校验，与源数据对比
dd if=enterprise-data.bin of=readback.bin bs=1M
md5sum enterprise-data.bin readback.bin | awk '{print $1}' | uniq -c
```

输出：

```console
bdee70674d5099779a75cd10a78e0b21 *enterprise-data.bin
bdee70674d5099779a75cd10a78e0b21 *readback.bin
      2 bdee70674d5099779a75cd10a78e0b21
```

`uniq -c` 输出为 2，说明源文件与读回文件校验和完全一致，数据在"写盘 - 读回"全过程中保持完整。

```bash
# 步骤 4：模拟存储介质单字节损坏，验证校验和能否发现问题
printf '\xFF' | dd of=enterprise-data.bin bs=1 seek=1024 count=1 conv=notrunc
md5sum enterprise-data.bin
```

输出：

```console
1+0 records in
1+0 records out
1 byte copied, 0.0001959 s, 5.1 kB/s
67036785fa1d570eb95cf3471ddc76cc *enterprise-data.bin
```

只改了 1 个字节，校验和从 `bdee7067...` 变成 `67036785...`，任何微小损坏都能被发现。

```bash
# 步骤 5：从备份恢复数据，再次校验确认恢复完整
cp readback.bin enterprise-data.bin
md5sum enterprise-data.bin readback.bin | awk '{print $1}' | uniq -c
```

输出：

```console
      2 bdee70674d5099779a75cd10a78e0b21
```

```bash
# 步骤 6：确认落盘后查看文件元数据与占用
stat enterprise-data.bin | head -4
du -h enterprise-data.bin
sync
```

输出：

```console
  File: enterprise-data.bin
  Size: 8388608   	Blocks: 8192       IO Block: 65536  regular file
Device: 66bb8f8bh/1723568011d	Inode: 3940649674831737  Links: 1
Access: (0644/-rw-r--r--)  Uid: (197609/   user)   Gid: (197609/ UNKNOWN)
8.0M	enterprise-data.bin
```

> 说明：本演示在 Git Bash（Windows 临时目录）中执行，路径与权限字段与 Linux 略有差异，属正常；命令序列与校验逻辑在 Linux 上完全一致。
{: .sec-note}
{: .sec-note}

**验证方法**：`md5sum` 前后两次输出逐字符相同，即证明"写盘 - 读回"零损坏；步骤 4 中单字节篡改导致校验和巨变，证明该校验手段对损坏敏感；步骤 5 从备份恢复后校验和还原，证明备份可用。

> **易错点**：
> - 认为"写进内存"或"写进 RAID"就等于数据安全：前者怕掉电，后者怕误删和逻辑损坏。
> - 备份从不演练恢复：没验证过的备份等于没有备份，恢复流程要定期演练。
> - 只在源端算校验和：传输 / 备份后必须在目标端重新校验并比对，才能发现传输损坏。
> - 混淆 RAID 重建期风险：RAID 5 重建期间再坏一块盘会全部丢失，大盘场景优先 RAID 6 / RAID 10。

> **参见**：计算机硬件组成 的"企业存储数据的案例""RAID：把多块磁盘整合起来"。

## 本篇小结
{: .sec-sum}

这天记几条就够：

- 选服务器先圈品牌系列（Dell R 系 / HP DL 系 / 华为 FusionServer 等），参数按 CPU、内存、硬盘、RAID 卡、电源、网卡六个维度列，采购单必须落到具体型号。
- buffer 管写、cache 管读，都是内核拿空闲内存做的提速，随时能回收。
- 内存紧不紧张只看 `free -h` 的 available，free 小不说明任何问题。
- 高并发先写内存是有代价的——掉电就丢，所以 fsync 落盘确认、RAID 冗余、备份策略三道防线一道都不能省。
- md5sum 算两次、逐字符比对，就能证明数据零损坏，成本极低；防恶意篡改换 sha256sum。
- 再念一遍：RAID 防硬件故障，备份防人为与逻辑故障，互为补充，谁也替代不了谁。


{% endraw %}
