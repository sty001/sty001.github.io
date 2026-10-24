---
title: "day15 作业实操：磁盘 block 大小、数据存储与读取原理、磁盘满的原因"
date: 2026-10-24 09:43:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 15 天的作业三道：① 修改磁盘中 block 大小、查看默认 block 大小；② 总结数据存储与读取原理；③ 磁盘满无法存储数据的原因。第 1 题涉及 `mkfs` 这类格式化命令，按规范定 B 级（标准命令 + CentOS 7 预期输出），另用 `stat -f`、`du --block-size` 在本机做 A 级验证；第 2 题是原理题，转成「原理讲解 + 本地可做的验证实验 + 结论」；第 3 题三种原因各给排查命令，「小文件耗尽 inode」「句柄未释放」两个实验在本机真跑。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明在真机执行方式。

本篇 A 级部分：`stat -f`、`stat -c`、`du --block-size`、`ls -i`、硬链接 inode 验证、500 小文件实验、句柄未释放实验。B 级部分：`mkfs.ext4 -b`、`mkfs.xfs -b size=`、`dumpe2fs`、`tune2fs -l`、`xfs_info`、`blockdev`、`df -i`、`lsof +L1`——这些命令需要真实块设备或 root 权限，文中给出完整命令序列与 CentOS 7 标准预期输出，读者在虚拟机/CentOS 7 上可直接复现。

两处环境差异属正常：`stat -f` 在本机报告 `Block size: 4096`，CentOS 7 的 ext4 默认同样为 4096；本机文件系统不提供 inode 配额，`df -i` 显示为 `-`，CentOS 7 会正常显示数值。输出中的本地用户名已按脱敏要求替换为 `user`。实操目录统一用 `/tmp/hw/day15`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 如何修改磁盘中 block 大小、如何查看默认 block 大小 | B 级（mkfs/dumpe2fs/tune2fs/xfs_info）+ A 级（stat -f 实测） |
| 题 2 | 总结数据存储与读取原理 | 原理讲解 + A 级（inode/block 验证实验） |
| 题 3 | 磁盘满无法存储数据的原因 | A 级（inode 实验、句柄实验）+ B 级（df -i、lsof） |

## 题 1：如何修改磁盘中 block 大小、如何查看默认的 block 大小

**考察点**：block 的概念、block 大小的查看方法（ext 系列与 xfs 两套命令）、block 大小的设定时机与代价。

**实现思路**：先说前提——**block 大小是格式化（创建文件系统）时定的，不能在线改**。想改就得重新格式化，等于清空数据。所以这题的标准答案就两句：

1. 查看：ext 系列用 `dumpe2fs -h` 或 `tune2fs -l`，xfs 用 `xfs_info`，通用用 `stat -f`；
2. 修改：`mkfs.ext4 -b 大小 设备` 或 `mkfs.xfs -b size=大小 设备`，且必须重新格式化。

### 步骤 1：先看 block 是什么（已实操）

block（数据块）是文件系统**分配空间的最小单位**。文件再小也要占一整块，文件不是整块倍数时最后一块的剩余空间就浪费掉（内部碎片）。实测一下：

```bash
cd /tmp/hw/day15
printf 'x' > one.txt
head -c 5000 /dev/zero > big.txt
ls -l one.txt big.txt
du --block-size=1 one.txt big.txt
du --block-size=1 --apparent-size big.txt
```

输出：

```console
$ ls -l one.txt big.txt
-rw-r--r-- 1 user 197609    1 Oct 24 04:43 one.txt
-rw-r--r-- 1 user 197609 5000 Oct 24 04:43 big.txt
$ du --block-size=1 one.txt big.txt
1024	one.txt
8192	big.txt
$ du --block-size=1 --apparent-size big.txt
5000	big.txt
```

1 字节的文件占了 1024 字节；5000 字节的文件占了 8192 字节（两块 4096），浪费 3192 字节。这就是「按块分配」的直接证据。

### 步骤 2：查看 block 大小的四种方法

**方法一：`stat -f`（通用，任何文件系统都能用，已实操）**

```bash
stat -f .
```

输出：

```console
$ stat -f .
  File: "."
    ID: 66bb8f8b00000000 Namelen: 255     Type: UNKNOWN (0x3e72eff)
Block size: 4096       Fundamental block size: 4096
Blocks: Total: 124734207  Free: 69493042   Available: 69493042
Inodes: Total: 18446744073709551615 Free: -1
```

`Block size: 4096` 就是首选的 I/O 块大小。这行输出在 CentOS 7 上同样可读，是排查时最快的查看方式。

**方法二：`dumpe2fs`（ext2/3/4，B 级）**

```bash
dumpe2fs -h /dev/sdb1 | grep -i "block size"
```

```console
（预期输出，CentOS 7）
$ dumpe2fs -h /dev/sdb1 | grep -i "block size"
dumpe2fs 1.42.9 (28-Dec-2013)
Block size:               4096
```

**方法三：`tune2fs -l`（ext2/3/4，B 级）**

```bash
tune2fs -l /dev/sdb1 | grep -iE "block size|block count|free blocks|inode"
```

```console
（预期输出，CentOS 7）
$ tune2fs -l /dev/sdb1 | grep -iE "block size|block count|free blocks|inode"
Block count:              2621440
Free blocks:              2558341
Block size:               4096
Inode count:              655360
Free inodes:              655349
Inode size:               256
```

**方法四：`xfs_info`（xfs，B 级）**

```bash
xfs_info /dev/sdb1
# 或按挂载点查
xfs_info /data
```

```console
（预期输出，CentOS 7）
$ xfs_info /data
meta-data=/dev/sdb1              isize=512    agcount=4, agsize=655360 blks
         =                       sectsz=512   attr=2, projid32bit=1
data     =                       bsize=4096   blocks=2621440, imaxpct=25
         =                       sunit=0      swidth=0 blks
naming   =version 2              bsize=4096   ascii-ci=0 ftype=1
log      =internal               bsize=4096   blocks=2560, version=2
realtime =none                   extsz=4096   blocks=0, rtextents=0
```

xfs 看 `data` 行的 `bsize=4096`。

补充一个查**物理块**大小的命令（B 级）：

```bash
blockdev --getbsz /dev/sdb1
```

```console
（预期输出，CentOS 7）
$ blockdev --getbsz /dev/sdb1
4096
```

四种方法速查：

| 方法 | 命令 | 适用文件系统 | 是否需要 root |
| --- | --- | --- | --- |
| stat -f | `stat -f 挂载点` | 全部 | 否 |
| dumpe2fs | `dumpe2fs -h /dev/sdb1 \| grep -i "block size"` | ext2/3/4 | 否（读元数据） |
| tune2fs | `tune2fs -l /dev/sdb1 \| grep -i "block size"` | ext2/3/4 | 否（读元数据） |
| xfs_info | `xfs_info /data` | xfs | 否 |
| blockdev | `blockdev --getbsz /dev/sdb1` | 全部（物理块） | 否 |

### 步骤 3：修改 block 大小（B 级，重新格式化）

ext4 用 `-b` 指定，取值只能是 **1024 / 2048 / 4096**（且不能超过 CPU 页大小，x86_64 页大小为 4K，所以生产环境上限就是 4096）：

```bash
mkfs.ext4 -b 4096 /dev/sdb1
# 也可用 -t 指定文件系统类型
mkfs -t ext4 -b 1024 /dev/sdb1
```

```console
（预期输出，CentOS 7）
$ mkfs.ext4 -b 4096 /dev/sdb1
mke2fs 1.42.9 (28-Dec-2013)
Filesystem label=
OS type: Linux
Block size=4096 (log=2)
Fragment size=4096 (log=2)
Stride=0 blocks, Stripe width=0 blocks
655360 inodes, 2621440 blocks
131072 blocks (5.00%) reserved for the super user
First data block=0
Maximum filesystem blocks=2684354560
...
Creating journal (32768 blocks): done
Writing superblocks and filesystem accounting information: done
```

关键行是 `Block size=4096 (log=2)` 与 `655360 inodes, 2621440 blocks`——**inode 数量与 block 数量都在这一刻确定下来**。

xfs 用 `-b size=`（注意是 `size=` 而不是裸数值）：

```bash
mkfs.xfs -b size=4096 /dev/sdb1
mkfs.xfs -f -b size=4096 /dev/sdb1    # 设备已有文件系统时加 -f 强制
```

```console
（预期输出，CentOS 7）
$ mkfs.xfs -b size=4096 /dev/sdb1
meta-data=/dev/sdb1              isize=512    agcount=4, agsize=655360 blks
         =                       sectsz=512   attr=2, projid32bit=1
data     =                       bsize=4096   blocks=2621440, imaxpct=25
         =                       sunit=0      swidth=0 blks
naming   =version 2              bsize=4096   ascii-ci=0 ftype=1
log      =internal               bsize=4096   blocks=2560, version=2
realtime =none                   extsz=4096   blocks=0, rtextents=0
```

完整流程（含分区与挂载，B 级）：

```bash
fdisk /dev/sdb                        # 分区，假设得到 /dev/sdb1
partprobe /dev/sdb                    # 通知内核重读分区表
mkfs.ext4 -b 4096 /dev/sdb1           # 按 4K block 格式化
mkdir -p /data
mount /dev/sdb1 /data                 # 挂载
echo "/dev/sdb1 /data ext4 defaults 0 0" >> /etc/fstab   # 开机自动挂载
mount -a                              # 校验 fstab 写得对不对
df -h /data                           # 确认挂载成功
```

> **易错点**：`mkfs` 会**清空整个分区**，执行前必须确认设备名（用 `lsblk`、`fdisk -l` 核对），并确认数据已备份。把 `-b` 误写成 `-B` 在 `mkfs.ext4` 上会被拒绝；`mkfs.xfs` 必须写成 `-b size=4096`，写 `-b 4096` 会报错。

### 步骤 4：block 大小的选型（大一点好还是小一点好）

这是本知识点的经典面试题，答案是「**看业务，默认是 4096，绝大多数场景不要动**」。

| block 大小 | 优点 | 缺点 | 适合场景 |
| --- | --- | --- | --- |
| 1024 / 2048 | 小文件浪费少，磁盘利用率高 | 大文件需要更多块，inode 里要记更多块指针，元数据开销大，读写 I/O 次数多 | 海量小文件（邮件、小图片、碎片化缓存） |
| 4096（默认） | 通用性最好，与内存页大小一致，综合性能最优 | 无 | 通用业务、数据库、Web 站点 |
| 8192 及以上 | 大文件顺序读写 I/O 次数少，吞吐高 | 小文件浪费极严重（1 字节文件占 8K） | 视频、备份归档、大数据分析等大文件场景 |

判断依据一句话：**文件普遍大于 block 就选大，普遍小于 block 就选小**；不确定就用 4096 默认值。

**验证方法**：

1. `stat -f 挂载点` 输出的 `Block size` 与格式化时指定的一致（已实操，本机为 4096）；
2. 建一个 1 字节文件，`du --block-size=1` 显示的值等于 block 大小的整数倍；建一个「block 大小 + 1」字节的文件，应占用 2 个 block（本机 5000 字节占 8192，即 2×4096，已验证）；
3. `mkfs` 输出的 `Block size=` 行与预期一致；`tune2fs -l` 或 `xfs_info` 复查一致。

> **参见**：block 大小的查看与调整 · 文件系统类型与格式化命令

## 题 2：总结数据存储与读取原理

**考察点**：inode、block、超级块、位图（inode 位图 + block 位图）四者的职责，以及一个文件从创建到落盘、从路径到内容的完整流程。

**实现思路**：先讲四类元数据结构，再用「写入一个文件」「读取一个文件」两个流程串起来，最后用 `stat`、`ls -i`、硬链接等命令真机验证。

### 2.1 四种核心结构

| 结构 | 存什么 | 作用 | 类比 |
| --- | --- | --- | --- |
| 超级块（superblock） | 文件系统的整体信息：block 大小、block 总数、inode 总数、已用/空闲数量、文件系统类型、挂载状态 | 文件系统的「总账本」，挂载时第一个被读入内存 | 图书馆的馆藏总目录 |
| inode 位图（inode bitmap） | 每个 inode 是否已被占用（1 位对应一个 inode） | 分配 inode 时快速找到空闲号 | 座位表上哪些座位已坐人 |
| block 位图（block bitmap） | 每个 block 是否已被占用 | 分配 block 时快速找到空闲块 | 停车位占用情况图 |
| inode 表（inode table） | 每个文件的元数据：权限、属主属组、大小、三种时间、链接数、**block 指针**、文件类型 | 通过 inode 号找到文件属性与数据块位置 | 一本书的版权页 + 目录 |
| block（数据块） | 文件的真实内容；目录的 block 里存的是「文件名 → inode 号」的映射表 | 存放数据 | 书的正文页 |

一句话概括：**文件的内容存在 block 里，文件的属性存在 inode 里，block 的位置记在 inode 里，inode 号记在目录的 block 里，谁空闲记在位图里，一共多少记在超级块里。**

block 与 inode 的数量关系值得一记：格式化时按「每多少字节配一个 inode」的比例分配，ext4 默认是每 16KB 数据区一个 inode（`mkfs.ext4 -i` 可调），inode 表本身也要占用 block。所以 inode 不是无限的免费资源——总量在格式化那一刻就与 block 绑定，海量小文件吃 inode 的速度快过吃 block，题 3 的实验会看到这一点。

### 2.2 存储流程：写入一个文件（以 `/data/test.txt` 写入 "hello" 为例）

1. 进程调用 `open("/data/test.txt", O_CREAT)` 发起创建请求。
2. 内核从根目录 `/` 的 inode 开始，逐级解析路径：读根目录的 block，找到 `data` 对应的 inode 号；再读 `data` 目录的 block，确认 `test.txt` 不存在且目录有写权限。
3. 查 **inode 位图**，找一个空闲 inode 号（如 131075），把它标记为已用。
4. 在 **inode 表**中初始化该 inode：写入权限 0644、属主属组、文件类型（普通文件）、链接数 1、大小 0、时间，block 指针暂时为空。
5. 写入数据 "hello"（5 字节）。查 **block 位图**，找空闲 block（如第 90001 块），标记为已用。
6. 把数据写进该 block；因为 5 字节 < 4096 字节，只占 1 块，剩余 4091 字节闲置（内部碎片，其它文件不能用）。
7. 回写 inode：把 `size` 改成 5，把 block 指针指向第 90001 块。
8. 在 `data` 目录的 block 里追加一条目录项：`test.txt → 131075`。
9. 更新**超级块**的空闲 inode 数、空闲 block 数；把脏元数据刷回磁盘（受 `commit`/`sync` 策略控制）。

关键点：**文件名不存在 inode 里，只存在目录的 block 里**。所以「改文件名」只是改目录项，不动 inode、不动数据；「移动文件到同一分区的另一个目录」同理，瞬间完成。

### 2.3 读取流程：读取一个文件（以 `cat /data/test.txt` 为例）

1. 进程调用 `open("/data/test.txt")`，内核从根 inode 开始逐级解析路径。
2. 读根目录 block，取到 `data` 的 inode 号 → 读 `data` 的 inode → 权限校验（目录必须有 x 权限才能进入）。
3. 读 `data` 目录的 block，在目录项里查到 `test.txt → 131075`。
4. 用 inode 号 131075 读 **inode 表**，校验权限（文件必须有 r 权限），取到文件大小和 block 指针。
5. 按 block 指针定位到数据块（第 90001 块），把内容读入页缓存（page cache）。
6. 内核把数据从内核态拷贝到用户态缓冲区，交给 `cat`。
7. `cat` 写到标准输出，读取完成。

关键点：**读取至少要两次磁盘 I/O**（一次读目录 block 拿 inode 号，一次读 inode，再一次读数据 block），这也是为什么目录层级很深、小文件极多时性能会下降；页缓存会缓存目录项（dentry）与 inode，第二次访问同一个文件会快得多。

### 2.4 结构关系（文字图示）

```text
超级块 superblock ──▶ 记录：block 大小 4096、总 block 数、总 inode 数、空闲数量
        │
        ├── inode 位图   ──▶ [0,1,1,0,1,...]  第 N 个 inode 是否已用
        ├── block 位图   ──▶ [1,1,0,0,1,...]  第 N 个 block 是否已用
        │
        ├── inode 表
        │       inode 131074（目录 /data）
        │           type=dir  mode=0755  size=4096
        │           block 指针 ──▶ block 5000
        │                              └─▶ 目录项表：
        │                                    "test.txt"  → 131075
        │                                    "pic.png"   → 131076
        │       inode 131075（文件 /data/test.txt）
        │           type=file mode=0644 size=5 links=1
        │           block 指针 ──▶ block 90001  ──▶ 内容 "hello"
        │
        └── 数据区 block：... 5000(目录项) ... 90001(文件数据) ...
```

软链接与硬链接在这个模型下的差异：

- **硬链接**：新建一个目录项指向**同一个 inode 号**，链接数 +1。两个文件名地位完全平等，删掉一个另一个还在。
- **软链接**：新建一个 inode，它的 block 里存的是**目标文件的路径字符串**。删掉目标后软链接失效（断链）。

### 2.5 本地验证实验（已实操）

**实验一：inode 号与链接数。**

```bash
cd /tmp/hw/day15
printf 'link test\n' > src.txt
ln src.txt dst.txt          # 建硬链接
ls -i src.txt dst.txt
stat -c 'inode=%i links=%h size=%s blocks=%b' src.txt dst.txt
```

输出：

```console
$ ls -i src.txt dst.txt
3096224743976094 dst.txt
3096224743976094 src.txt
$ stat -c 'inode=%i links=%h size=%s blocks=%b' src.txt dst.txt
inode=3096224743976094 links=2 size=10 blocks=1
inode=3096224743976094 links=2 size=10 blocks=1
```

两个文件名指向**同一个 inode**（号码完全相同），链接数为 2，size 与 blocks 完全一致——证明「文件名只是目录项，数据由 inode 唯一持有」。

**实验二：目录也是 inode。**

```bash
ls -idi . many
```

输出：

```console
$ ls -idi . many
2251799813844047 .
1125899907001518 many
```

目录自己也有 inode 号；`-d` 表示查看目录本身而不是它的内容。

**实验三：文件属性与数据分离。**

```bash
stat -c 'size=%s blocks=%b' big.txt
du --block-size=1 big.txt
```

输出：

```console
$ stat -c 'size=%s blocks=%b' big.txt
size=5000 blocks=8
$ du --block-size=1 big.txt
8192	big.txt
```

`size` 是属性（记在 inode 里），`blocks` 是实际占用（记在位图与块指针里），两者不是一回事。

**验证方法**：能不查资料回答下面四个问题即为掌握——①文件名存在哪里（目录的 block）；②文件内容存在哪里（数据 block）；③怎么从路径找到内容（目录项 → inode 号 → inode 表 → block 指针 → 数据块）；④为什么硬链接的两个文件 size 相同而软链接不同（前者同 inode，后者是新 inode 存路径串）。

> **参见**：inode：索引节点 · block：数据块 · 磁盘的结构体系

## 题 3：磁盘满无法存储数据的原因

**考察点**：「磁盘满」不是一个原因而是三种，且报错信息不同，排查命令也不同。

**实现思路**：三种原因分别是 block 满、inode 满、文件被删除但句柄未释放。先给对照表，再逐个给排查命令与处置方法，其中 inode 耗尽与句柄未释放两个实验在本机真跑。

### 3.1 三种原因对照表

| 原因 | 报错信息 | 判断依据 | 排查命令 | 处置方式 |
| --- | --- | --- | --- | --- |
| ① block 空间满 | `No space left on device` | `df -h` 的 `Use%` 接近 100%，`df -i` 的 `IUse%` 很低 | `df -h`、`du -h --max-depth=1` | 删除/归档大文件，清理日志 |
| ② inode 耗尽 | `No space left on device`（同样的话，容易误判） | `df -h` 还有空间，但 `df -i` 的 `IUse%` 是 100% | `df -i`、`find 目录 -type f \| wc -l` | 删除海量小文件，必要时重新格式化增大 inode 数 |
| ③ 文件删除但句柄未释放 | 空间没被回收，写入报 `No space left on device` | `df -h` 显示已用很高，`du -sh` 累加却很小，两者对不上 | `lsof \| grep deleted`、`lsof +L1` | 重启持有句柄的进程，或截断文件 `> 文件名` |

> **易错点**：三种情况的报错**完全相同**，都是 `No space left on device`。光看报错无法区分，必须同时跑 `df -h` 和 `df -i`。

### 3.2 原因一：block 存储空间不足（B 级排查命令 + A 级 df 实测）

这是最常见的一种，就是「数据真的放太多了」。

```bash
df -h
```

输出（已实操，本机形态；CentOS 7 的列名与单位一致）：

```console
$ df -h
Filesystem                         Size  Used Avail Use% Mounted on
C:/Users/user/AppData/Local/Temp  476G  211G  266G  45% /tmp
```

分级定位（B 级，CentOS 7）：

```bash
df -h                                              # 第一步：确认哪个分区满了
du -h --max-depth=1 / 2>/dev/null | sort -hr | head -10    # 第二步：一层层往下钻
du -ah /var/log | sort -hr | head -20              # 第三步：定位 TOP 文件
```

```console
（预期输出，CentOS 7）
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda3        40G   38G  2.0G  96% /
tmpfs           1.9G     0  1.9G   0% /dev/shm
/dev/sda1       497M  120M  377M  25% /boot
```

`Use%` 到 96% 就基本满了——注意 ext 系列默认**保留 5% 空间给 root**，普通用户看到 100% 时 root 还能写，这也是「明明还有空间却写不进去」的一个次要原因。

处置：按时间清理，避免误删正在用的文件。

```bash
find /var/log -type f -name "*.log.*" -mtime +30 -exec rm -f {} +
find /tmp -type f -mtime +7 -exec rm -f {} +
```

### 3.3 原因二：inode 存储空间不足（A 级实验验证）

inode 数量在格式化时就固定了（步骤 3 输出里的 `655360 inodes`）。**每个文件至少消耗一个 inode**，所以哪怕每个文件只有 1 字节、磁盘还剩几百 G，只要小文件数量超过 inode 总数，就再也建不出新文件了。

本机实验：造 500 个空文件，看「文件数量」与「数据体积」的脱节（已实操）：

```bash
cd /tmp/hw/day15
rm -rf many && mkdir many
for i in $(seq 1 500); do : > many/f$i.dat; done
ls many | wc -l
du -sh many
du -sh --apparent-size many
```

输出：

```console
$ ls many | wc -l
500
$ du -sh many
96K	many
$ du -sh --apparent-size many
0	many
```

500 个文件的**内容总量是 0 字节**，却消耗了 500 个 inode 和 96K 的磁盘块。把这个数量放大到百万级，就会出现「`df -h` 还剩 20G，`df -i` 却已 100%」的现象。

CentOS 7 上的判断命令（B 级）：

```bash
df -i
df -i /data
```

```console
（预期输出，CentOS 7）
$ df -i
Filesystem      Inodes  IUsed   IFree IUse% Mounted on
/dev/sda3      2621440 2621440       0  100% /
tmpfs           483205       1  483204    1% /dev/shm
/dev/sda1       128016      39  127977    1% /boot
```

`IUse%` 到 100% 而 `Use%` 很低，即确认是 inode 耗尽。接着找出小文件最多的目录：

```bash
for d in /*; do echo "$(find $d -type f 2>/dev/null | wc -l) $d"; done | sort -rn | head -10
```

```console
（预期输出，CentOS 7）
$ for d in /*; do echo "$(find $d -type f 2>/dev/null | wc -l) $d"; done | sort -rn | head -10
1523873 /var
 284611 /usr
  15233 /opt
```

处置：删除无用的小文件（如邮件队列、会话文件、碎片缓存）。若要彻底解决，需备份后重新格式化并指定更大的 inode 数量：

```bash
mkfs.ext4 -i 2048 /dev/sdb1        # 每 2048 字节分配一个 inode（默认是每 16384 字节一个）
mkfs.ext4 -N 2000000 /dev/sdb1     # 或直接指定 inode 总数
```

```console
（预期输出，CentOS 7）
$ mkfs.ext4 -i 2048 /dev/sdb1
mke2fs 1.42.9 (28-Dec-2013)
...
5242880 inodes, 2621440 blocks
```

`-i 2048` 让 inode 数从 655360 涨到 5242880，代价是 inode 表本身占用更多空间（每个 inode 默认 256 字节）。

### 3.4 原因三：文件被删除但句柄未释放（A 级实验验证）

Linux 删除文件的本质是**把目录项删掉、把 inode 的链接数减 1**。只有当链接数归零**且没有任何进程持有该文件的句柄**时，block 才会真正回收。如果某个进程（比如正在写日志的 nginx）还开着这个文件，那它占的 block 就一直不释放：`du` 遍历目录树已经看不到它了（目录项没了），但 `df` 读超级块仍然把它算作已用。

本机实验：让一个进程持有文件句柄，然后删除文件（已实操）：

```bash
cd /tmp/hw/day15
printf 'web access log line1\n' > held.log
ls -l held.log
bash -c 'exec 3>>held.log; rm -f held.log; \
echo "--- 删除后 ls ---"; ls -l held.log 2>&1; \
echo "--- 进程持有的 fd ---"; ls -l /proc/$$/fd | grep held; \
echo "--- 目录里还能看到吗 ---"; ls -l | grep held || echo "目录项已消失"'
```

输出：

```console
$ ls -l held.log
-rw-r--r-- 1 user 197609 21 Oct 24 04:44 held.log
--- 删除后 ls ---
ls: cannot access 'held.log': No such file or directory
--- 进程持有的 fd ---
lrwxrwxrwx 1 user 197609 0 Oct 24 04:44 3 -> /tmp/hw/day15/held.log (deleted)
--- 目录里还能看到吗 ---
目录项已消失
```

目录项已经没了（`ls` 报找不到），但进程的 3 号文件描述符仍指向这个文件，状态标记为 `(deleted)`——这就是「空间没释放」的现场。在 Linux 上用 `lsof` 能一次列出所有这类文件（B 级）：

```bash
lsof | grep deleted
lsof +L1                    # +L1 表示链接数小于 1 的文件，即已删除但仍被打开
lsof +L1 /data              # 限定某个挂载点
```

```console
（预期输出，CentOS 7）
$ lsof +L1
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NLINK   NODE NAME
nginx    1234 root    5w   REG  253,0 8.5G        0  12345 /var/log/nginx/access.log (deleted)
rsyslogd  987 root    3w   REG  253,0 1.2G        0   6789 /var/log/messages (deleted)
```

`SIZE/OFF` 那一列就是被白白占住的空间（nginx 这个占了 8.5G）。

处置办法二选一：

```bash
# 方法一：让进程重新打开/释放句柄（推荐，最干净）
systemctl restart nginx

# 方法二：不重启，把文件内容截断（句柄还在，但大小归零，空间立即回收）
> /var/log/nginx/access.log
```

### 辨析：df 与 du 为什么对不上

`df` 读的是文件系统超级块的统计（整个分区用了多少 block），`du` 是遍历目录树把看得到的文件加起来。三个典型差异：① deleted 句柄占的空间，`df` 算、`du` 看不见；② 硬链接的文件，`du` 单目录统计会重复算，跨目录求和又可能算重；③ 挂载点下挂了别的文件系统，`du` 默认会穿进去（加 `-x` 可限定同一文件系统）。排查磁盘满时先看两者差多少，对不上就往 deleted 句柄查。

> **易错点**：正确的日志清理姿势是**先截断后删除**，或者干脆只截断不删除（`> access.log`）。直接 `rm` 正在被写入的日志，是生产环境「磁盘莫名其妙满了」的第一号原因。另外日志切割工具（logrotate）要用 `copytruncate` 或给进程发 `reopen` 信号，也是同一个道理。

### 3.5 磁盘满排错总流程

收到 `No space left on device` 后，按下面六步走，不要跳步：

1. `df -h` 看 `Use%`——确认是哪个分区、block 是否真的满。
2. `df -i` 看 `IUse%`——排除 inode 耗尽（这一步最容易被漏掉）。
3. block 满就 `du -h --max-depth=1 挂载点 2>/dev/null | sort -hr | head -10`，一层层往下钻到具体目录。
4. `du -ah 可疑目录 | sort -hr | head -20` 找出 TOP 大文件，人工确认后再删。
5. `df` 与 `du` 数值对不上，就 `lsof +L1` 查 deleted 句柄，重启进程或截断文件。
6. 清理完再跑一次 `df -h` 与 `df -i` 复查，确认 `Use%` 与 `IUse%` 都降下来了。

> **生产注意**：动手清理前先 `df -h` 与 `df -i` 各截一张图留档，删错文件的代价远大于晚十分钟清理。

**验证方法**：

1. 能同时说出三种原因的区分依据（`df -h` 的 `Use%` 与 `df -i` 的 `IUse%`，以及 `du`/`df` 是否对得上）；
2. 本机 500 空文件实验中，`du -sh` 与 `du -sh --apparent-size` 的差异能说明 inode 与 block 是两套独立资源（已实操）；
3. 本机句柄实验中能看到 `(deleted)` 标记，并知道在 CentOS 7 上用 `lsof +L1` 得到同样的信息（已实操）。

> **参见**：企业常见问题：磁盘满 · 容量查看：df 与 du · du 命令详解

## 本篇小结

三道题落到纸面，就这几条：

1. block 大小在**格式化时**确定，不能在线修改；查看用 `stat -f`（通用）、`dumpe2fs -h` / `tune2fs -l`（ext 系列）、`xfs_info`（xfs）；修改用 `mkfs.ext4 -b 4096` 或 `mkfs.xfs -b size=4096`，代价是数据全清。
2. block 越大越利于大文件顺序读写但小文件浪费严重，越小越省空间但元数据开销大；默认 4096 适用绝大多数场景，不要为了调优而调优。
3. 存储原理的核心是「**文件名在目录的 block 里，属性在 inode 里，内容在数据 block 里，空闲情况在位图里，总量在超级块里**」，五级索引一级都不能少。
4. 写入流程是「查 inode 位图取号 → 初始化 inode → 查 block 位图取块 → 写数据 → 回写指针 → 目录项加一条」；读取流程是「目录项 → inode 号 → inode 表 → block 指针 → 数据块」。
5. 磁盘满有三种原因且**报错完全相同**，必须 `df -h` 与 `df -i` 一起看：`Use%` 高是 block 满，`IUse%` 高是 inode 耗尽，两者对不上是句柄未释放。
6. inode 数量格式化时固定，海量小文件会在磁盘还剩很多空间时把 inode 吃光；需要更多 inode 用 `mkfs.ext4 -i 2048` 或 `-N` 重新格式化。
7. 清理正在被写入的日志用截断 `> 文件名` 而不是 `rm`，否则空间不会释放；已发生则用 `lsof +L1` 定位进程后重启。

> **参见**：文件系统类型与格式化命令 · 格式化操作与磁盘满 · inode/block 概念
{% endraw %}
