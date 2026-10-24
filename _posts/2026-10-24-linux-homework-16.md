---
title: "day16 作业实操：真正统计目录大小的 du 命令"
date: 2026-10-24 09:16:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 16 天的作业只考一条命令：利用什么命令**真正**统计目录的大小（答案 `du -xxx`）。别小看这一条，背后有三层东西要掰开——为什么 `ls -lh` 看到的不是目录的真实大小、`du` 统计的到底是「文件字节和」还是「磁盘占用块」、`du` 与 `df` 为什么经常对不上。参数表、真跑演示、排错案例都在下面。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

本篇 du、ls、stat、sort、df、ln、dd 全部为 A 级真跑。有两处环境差异（属正常，不影响结论）要提前说明：本机 `stat` 显示的 `IO Block` 为 65536（Windows 文件系统报告值），CentOS 7 的 ext4/xfs 通常为 4096；`df -i` 在本机显示 `-`（Windows 文件系统不报告 inode 配额），CentOS 7 会正常显示 inode 总数。输出中的本地用户名已按脱敏要求替换为 `user`。

实操目录统一用 `/tmp/hw/day16`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 利用什么命令真正统计目录的大小（`du -xxx`） | A 级（目录树真跑 + 参数全覆盖） |
| 题 1-扩展 | `du -sh` 与 `ls -lh` 的区别、「真正」的含义 | A 级（稀疏文件/硬链接实测验证） |
| 题 1-扩展 | `du` 与 `df` 的差异与磁盘排错 | A 级（真跑）+ B 级（lsof 场景） |

## 题 1：利用 linux 什么命令真正统计目录的大小

**考察点**：`du` 的常用参数组合，以及「目录大小」这个概念的真实含义。

**实现思路**：先明确两件事，再说命令。

第一，**目录本身在 Linux 里只是一个「文件名 → inode」的映射表**，`ls -lh` 看到的目录大小（通常 4.0K、40 之类）只是这个映射表自身占的空间，不包含里面文件的大小。所以 `ls -lh 目录` 永远看不到目录的真实占用。

第二，`du` 统计的是**每个文件实际占用的磁盘块数**（allocated blocks），不是文件内容的字节和。一个 5 字节的文件也要占用一个块；一个 1GB 的稀疏文件可能一个块都不占。这就是题目里「真正」二字的含义。

所以标准答案是：

```bash
du -sh 目录名
```

`-s` 只给汇总值（summary，不逐层列出），`-h` 以人类可读单位显示（human-readable）。

### du 参数速查表

| 参数 | 全称/含义 | 作用 | 典型用法 |
| --- | --- | --- | --- |
| `-s` | summarize | 只显示总计，不逐层列出子目录 | `du -sh /var/log` |
| `-h` | human-readable | 以 K/M/G 为单位显示 | `du -h /data` |
| `-a` | all | 把**文件**也列出来（默认只列目录） | `du -ah /data` |
| `-c` | total | 在最后额外输出一行 `total` 总计 | `du -ch dir1 dir2` |
| `--max-depth=N` | 层级深度 | 只统计到第 N 层子目录 | `du -h --max-depth=1 /data` |
| `--exclude=模式` | 排除 | 按文件名模式跳过不统计 | `du -sh --exclude="*.log" /data` |
| `--apparent-size` | 表面大小 | 按文件字节数统计，而非占用块 | `du -sh --apparent-size` |
| `-x` | one-file-system | 不跨越文件系统边界（不统计挂载点） | `du -x /` |
| `-S` | separate-dirs | 目录大小**不含**子目录，只看本层文件 | `du -hS /data` |
| `-d N` | max-depth 的短写 | 同 `--max-depth=N` | `du -hd 1 /data` |
| `--block-size=SIZE` | 块单位 | 指定显示单位（1 = 字节，1M = MB） | `du -s --block-size=1` |
| `--time` | 时间 | 额外显示该目录最后修改时间 | `du -h --time /data` |
| `-L` | 跟随软链 | 统计符号链接指向的目标（默认不跟随） | `du -Lh /data` |

### 步骤 1：构造测试目录树（已实操）

模拟一个网站目录：html（网页）、logs（日志）、upload（上传图片）、static（静态资源 css/js），外加一个只有 5 字节的小文件，用于后面做块对齐的对照。

```bash
mkdir -p /tmp/hw/day16/site/{html,logs,upload,static/css,static/js}
cd /tmp/hw/day16
printf 'index\n' > site/html/index.html
printf 'a\n'    > site/html/about.html
head -c 3000   /dev/zero > site/logs/access.log
head -c 50000  /dev/zero > site/logs/error.log
head -c 200000 /dev/zero > site/upload/pic1.png
head -c 100000 /dev/zero > site/upload/pic2.png
printf 'body{color:red}\n' > site/static/css/style.css
printf 'var a=1;\n'        > site/static/js/app.js
printf 'tiny\n' > site/tiny.txt
ls -lR site
```

输出：

```console
$ ls -lR site
site:
total 1
drwxr-xr-x 1 user 197609 0 Oct 24 04:39 html
drwxr-xr-x 1 user 197609 0 Oct 24 04:39 logs
drwxr-xr-x 1 user 197609 0 Oct 24 04:39 static
-rw-r--r-- 1 user 197609 5 Oct 24 04:39 tiny.txt
drwxr-xr-x 1 user 197609 0 Oct 24 04:39 upload

site/html:
total 2
-rw-r--r-- 1 user 197609 2 Oct 24 04:39 about.html
-rw-r--r-- 1 user 197609 6 Oct 24 04:39 index.html

site/logs:
total 56
-rw-r--r-- 1 user 197609  3000 Oct 24 04:39 access.log
-rw-r--r-- 1 user 197609 50000 Oct 24 04:39 error.log

site/static:
total 0
drwxr-xr-x 1 user 197609 0 Oct 24 04:39 css
drwxr-xr-x 1 user 197609 0 Oct 24 04:39 js

site/static/css:
total 1
-rw-r--r-- 1 user 197609 16 Oct 24 04:39 style.css

site/static/js:
total 1
-rw-r--r-- 1 user 197609 9 Oct 24 04:39 app.js

site/upload:
total 296
-rw-r--r-- 1 user 197609 200000 Oct 24 04:39 pic1.png
-rw-r--r-- 1 user 197609 100000 Oct 24 04:39 pic2.png
```

### 步骤 2：du -sh 与 ls -lh 的核心区别（已实操）

先看整个目录：

```bash
du -sh site
```

输出：

```console
$ du -sh site
357K	site
```

再看 `ls -lh` 对同一目录给出什么：

```bash
ls -ldh site
```

输出（预期形态，CentOS 7 与本机一致）：

```console
$ ls -ldh site
drwxr-xr-x 1 user 197609 0 Oct 24 04:39 site
```

目录自身大小显示 0（ext4 上通常显示 4.0K，即目录项占一个块），而 `du -sh` 给出 357K——**差了两个数量级**。第一次见到这个读数基本都会愣一下，想通原理就好了：`ls -ldh` 只报目录这个「索引文件」自己的大小，`du` 才递归累加里面所有文件的磁盘占用。

再用单个小文件把「块」的概念量化：

```bash
ls -lh site/tiny.txt
du -h site/tiny.txt
du -h --apparent-size site/tiny.txt
stat site/tiny.txt
```

输出：

```console
$ ls -lh site/tiny.txt
-rw-r--r-- 1 user 197609 5 Oct 24 04:39 site/tiny.txt
$ du -h site/tiny.txt
1.0K	site/tiny.txt
$ du -h --apparent-size site/tiny.txt
5	site/tiny.txt
$ stat site/tiny.txt
  File: site/tiny.txt
  Size: 5         	Blocks: 1          IO Block: 65536  regular file
Device: 66bb8f8bh/1723568011d	Inode: 1125899907001331  Links: 1
Access: (0644/-rw-r--r--)  Uid: (197609/   user)   Gid: (197609/ UNKNOWN)
Access: 2026-10-24 04:40:08.126193400 +0800
Modify: 2026-10-24 04:39:54.938721400 +0800
Change: 2026-10-24 04:39:54.938721400 +0800
 Birth: 2026-10-24 04:39:54.938721400 +0800
```

一句话总结三者的分工：

| 命令 | 看到的是什么 | 5 字节文件的读数 |
| --- | --- | --- |
| `ls -lh 文件` | 文件内容的字节数（逻辑大小） | 5 |
| `du -h 文件` | 文件占用的磁盘块 | 1.0K |
| `du -h --apparent-size` | 文件内容的字节数（同 ls） | 5 |
| `stat 文件` | 两者都有：`Size` 是字节数，`Blocks` 是块数 | Size: 5，Blocks: 1 |

**结论**：`ls` 看「写进去多少字节」，`du` 看「磁盘腾出多少空间」。文件系统按块分配，一个块放不满也要占一整块，所以 `du` 的读数永远 ≥ `ls` 的字节和。

### 步骤 3：--apparent-size 让两个口径同时现身（已实操）

```bash
du -sh site
du -sh --apparent-size site
du -sh site/*
du -sh --apparent-size site/*
```

输出：

```console
$ du -sh site
357K	site
$ du -sh --apparent-size site
345K	site
$ du -sh site/*
2.0K	site/html
56K	site/logs
2.0K	site/static
1.0K	site/tiny.txt
296K	site/upload
$ du -sh --apparent-size site/*
8	site/html
52K	site/logs
25	site/static
5	site/tiny.txt
293K	site/upload
```

逐项对比：

| 路径 | du（磁盘占用） | du --apparent-size（字节和） | 差值来源 |
| --- | --- | --- | --- |
| site/html | 2.0K | 8 | 2 个文件 + 目录各占块 |
| site/logs | 56K | 52K | 2 个文件块对齐 + 目录块 |
| site/static | 2.0K | 25 | 2 层目录 + 2 个小文件 |
| site/tiny.txt | 1.0K | 5 | 单个块对齐 |
| site/upload | 296K | 293K | 2 个文件块对齐 + 目录块 |
| 合计 site | 357K | 345K | 全部块对齐损耗累积 |

差值就是**块对齐浪费**（内部碎片）。文件越小、数量越多，两个口径差得越明显：一个目录下放 10 万个 10 字节的小文件，字节和只有 1MB，磁盘占用却可能是 400MB。

### 步骤 4：--max-depth 分层统计（已实操）

排查磁盘占用时最常用的就是「一层一层往下钻」：

```bash
du -h --max-depth=1 site
du -h --max-depth=2 site
```

输出：

```console
$ du -h --max-depth=1 site
2.0K	site/html
56K	site/logs
2.0K	site/static
296K	site/upload
357K	site
$ du -h --max-depth=2 site
2.0K	site/html
56K	site/logs
1.0K	site/static/css
1.0K	site/static/js
2.0K	site/static
296K	site/upload
357K	site
```

注意两点：

1. 不加 `-a` 时 `du` **只打印目录**，所以 `--max-depth=1` 的输出里看不到 `site/tiny.txt`（它是文件）。想把文件也列出来必须加 `-a`。
2. 每行目录的数值都是**含子目录的累计值**：`site/static` 的 2.0K 已经包含了 css 和 js。

### 步骤 5：-a、-c、--exclude、-x、-S、--time（已实操）

`-a` 把文件一并列出，`-c` 额外给一个总计：

```bash
du -ah site/upload
du -ch site/logs site/upload
```

输出：

```console
$ du -ah site/upload
196K	site/upload/pic1.png
100K	site/upload/pic2.png
296K	site/upload
$ du -ch site/logs site/upload
56K	site/logs
296K	site/upload
352K	total
```

`--exclude` 按模式跳过（常用于排除日志、缓存）：

```bash
du -ah --exclude="*.png" site
```

输出：

```console
$ du -ah --exclude="*.png" site
1.0K	site/html/about.html
1.0K	site/html/index.html
2.0K	site/html
4.0K	site/logs/access.log
52K	site/logs/error.log
56K	site/logs
1.0K	site/static/css/style.css
1.0K	site/static/css
1.0K	site/static/js/app.js
1.0K	site/static/js
2.0K	site/static
1.0K	site/tiny.txt
0	site/upload
61K	site
```

两张 png 被排除后，`site/upload` 变成 0，总计从 357K 降到 61K。注意 `--exclude` 只按**文件名**匹配，写 `*.png` 而不是 `site/upload/*.png`。

`-S`（separate-dirs）让每个目录只显示**本层文件**的占用，不含子目录，用来定位「到底是哪一层的文件在吃空间」：

```bash
du -h -S site
```

输出：

```console
$ du -h -S site
2.0K	site/html
56K	site/logs
1.0K	site/static/css
1.0K	site/static/js
0	site/static
296K	site/upload
1.0K	site
```

`site/static` 变成 0——因为它的两个子目录 css/js 已被单独统计，本层没有文件。

`--time` 附带最后修改时间，判断「是不是最近才涨起来的」：

```bash
du -h --time --max-depth=1 site
```

输出：

```console
$ du -h --time --max-depth=1 site
2.0K	2026-10-24 04:39	site/html
56K	2026-10-24 04:39	site/logs
2.0K	2026-10-24 04:39	site/static
296K	2026-10-24 04:39	site/upload
357K	2026-10-24 04:39	site
```

`-x` 不跨越文件系统边界。统计根分区时用不上 `/data`、`/boot` 这些独立挂载点：

```bash
du -sx site
```

输出：

```console
$ du -sx site
357	site
```

（`-x` 是「不跨文件系统」而非「排除」，本机 `site` 下没有其它挂载点，数值不变；在真机上 `du -shx /` 与 `du -sh /` 会有明显差异。）

### 步骤 6：硬链接与稀疏文件——「真正」含义的极端验证（已实操）

这两个实验能彻底说明 `du` 统计的到底是什么。

**实验一：硬链接只计一次。** 同一个 inode 有两个文件名，`du` 不会重复计算：

```bash
ln site/upload/pic1.png hardlink.png
ls -l hardlink.png
du -ch site/upload/pic1.png hardlink.png
```

输出：

```console
$ ls -l hardlink.png
-rw-r--r-- 2 user 197609 200000 Oct 24 04:39 hardlink.png
$ du -ch site/upload/pic1.png hardlink.png
196K	site/upload/pic1.png
196K	total
```

链接数变成 2，但 `total` 仍是 196K——`du` 按 inode 记账，第一次访问过的 inode 后续跳过。这正是 `du` 能反映「磁盘真实占用」的证明，而 `ls -l` 累加会给出 400000 的错误答案。

**实验二：稀疏文件。** 创建一个逻辑大小 1MB 但内容全为空洞的文件：

```bash
rm -f sparse.img
dd if=/dev/zero of=sparse.img bs=1 count=0 seek=1048576 2>/dev/null
ls -lh sparse.img
du -h sparse.img
du -h --apparent-size sparse.img
stat -c '%s %b %B' sparse.img
```

输出：

```console
$ ls -lh sparse.img
-rw-r--r-- 1 user 197609 1.0M Oct 24 04:40 sparse.img
$ du -h sparse.img
0	sparse.img
$ du -h --apparent-size sparse.img
1.0M	sparse.img
$ stat -c '%s %b %B' sparse.img
1048576 0 1024
```

`stat -c '%s %b %B'` 依次输出：逻辑大小 1048576 字节、占用块数 0、每块 1024 字节。**`ls` 说它 1.0M，磁盘上一个字节都没给它**。此时只有 `du` 给出正确答案 0。

> **易错点**：虚拟机磁盘镜像、数据库文件、日志文件经常是稀疏文件。`ls -lh` 看到 100G 就以为磁盘要满了，实际 `du` 一跑可能只有 2G——排查时务必以 `du`（或 `df`）为准。

### 步骤 7：精确字节数与排序定位（已实操）

`-h` 便于人看，但不便于排序比较。要精确值用 `--block-size=1`：

```bash
du -s --block-size=1 site
du -s --block-size=1 --apparent-size site
```

输出：

```console
$ du -s --block-size=1 site
365568	site
$ du -s --block-size=1 --apparent-size site
353038	site
```

磁盘占用 365568 字节，字节和 353038 字节，块对齐损耗 12530 字节。

排序定位最大目录（`sort -h` 能正确识别 K/M/G 单位——普通 `sort` 按字典序会把 `296K` 排到 `56K` 前面，`-h` 才按数值真大小比）：

```bash
du -sh site/* | sort -h
du -sh site/* | sort -hr | head -3
```

输出：

```console
$ du -sh site/* | sort -h
1.0K	site/tiny.txt
2.0K	site/html
2.0K	site/static
56K	site/logs
296K	site/upload
$ du -sh site/* | sort -hr | head -3
296K	site/upload
56K	site/logs
2.0K	site/static
```

找出 TOP5 大文件（`-a` + `sort -hr`）：

```bash
du -ah site | sort -hr | head -5
```

输出：

```console
$ du -ah site | sort -hr | head -5
357K	site
296K	site/upload
196K	site/upload/pic1.png
100K	site/upload/pic2.png
56K	site/logs
```

## du 与 df 的差异对比

两者都在报「用了多少空间」，但数据来源完全不同，所以经常对不上。

| 对比项 | `du` | `df` |
| --- | --- | --- |
| 全称 | disk usage | disk free |
| 数据来源 | 逐级遍历目录树，累加每个文件的块数 | 直接读取文件系统的**超级块**统计信息 |
| 统计对象 | 指定的目录/文件 | 整个已挂载的文件系统（分区） |
| 速度 | 慢（要遍历所有文件，目录大时耗时久） | 快（读一次元数据即可） |
| 是否需要权限 | 受目录读权限限制，读不到的目录会报错并跳过 | 不需要遍历文件，只读文件系统元数据 |
| 常见读数关系 | 通常 **小于** df 显示的已用空间 | 通常 **大于** du 的累加值 |
| 典型用途 | 定位到底哪个目录/文件占空间 | 快速看分区还剩多少空间、是否已满 |
| 常用写法 | `du -sh 目录`、`du -h --max-depth=1` | `df -h`、`df -i`、`df -Th` |

为什么速度差这么多：`df` 只读一次超级块，开销固定，跟文件数量无关；`du` 要把目录树里每个文件都摸一遍，目录越大越慢，还实打实消耗磁盘 IO。顺带一提，同一份文件放在块大小不同（1K/2K/4K）的文件系统上，`du` 读数也会不一样——块越大，小文件的内部碎片越多。

生产注意点：业务高峰期别在数据盘上随手 `du -sh /`，大目录遍历会拖慢服务；真要查就挑低峰期，或用 `--max-depth` 控制深度。

`df` 的真实输出（已实操）：

```bash
df -h .
```

输出：

```console
$ df -h .
Filesystem                         Size  Used Avail Use% Mounted on
C:/Users/user/AppData/Local/Temp  476G  211G  266G  45% /tmp
```

`df -i` 看 inode 用量（本机文件系统不提供 inode 配额，显示为 `-`；CentOS 7 预期输出如下）：

```bash
df -i .
```

```console
（预期输出，CentOS 7）
$ df -i .
Filesystem      Inodes  IUsed   IFree IUse% Mounted on
/dev/sda3      26214400 120345 26094055    1% /
```

inode 总数在 `mkfs` 那一刻就定死了，ext4 按默认密度一次性建好 inode 表，运行期加不了；xfs 则是动态分配 inode，海量小文件场景更抗造——这也是 CentOS 7 把根分区默认格式化成 xfs 的原因之一。

### df 比 du 大的三种原因

| 原因 | 现象 | 排查命令 |
| --- | --- | --- |
| 文件被删除但句柄未释放 | `du` 已经不统计它，`df` 仍算作已用；进程不重启空间不释放 | `lsof \| grep deleted` 或 `lsof +L1` |
| 挂载点遮盖 | 挂载前目录下已有文件，挂载后被遮住，`du` 看不到但空间已被占 | 卸挂载后查看，或用 `du -x` 限定 |
| 文件系统自身开销 | 超级块、inode 表、日志区、保留块（默认 5%）都算已用 | `tune2fs -l /dev/sda3`、`dumpe2fs -h` |

第一类最常见，判断与处置：

```bash
lsof | grep deleted
lsof +L1
```

```console
（预期输出，CentOS 7）
$ lsof +L1
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NLINK  NODE NAME
nginx    1234 root    5w   REG  253,0 8.5G     0     12345 /var/log/nginx/access.log (deleted)
```

处置办法是让进程释放句柄（重启进程或 `> 日志文件` 截断），**不要**直接 `rm -rf` 正在写入的日志文件。

### 辨析：du 与 df 对不上时该信谁

两个都没错，只是口径不同：`df` 回答「这个分区还剩多少」，`du` 回答「这个目录占了多少」。看问题类型选工具——

- 看容量告警、判断要不要扩容：信 `df`，它直接来自文件系统记账，包含 deleted 句柄、元数据开销这些 `du` 看不见的部分；
- 定位谁在吃空间：信 `du`，`df` 给不出目录级答案；
- 两者差距突然拉大：先跑 `lsof +L1`，多半是刚删了大日志没释放。

一句话：`df` 定性质，`du` 定位置。

## 实战案例：网站目录磁盘满了怎么排错

场景：收到告警，网站分区 `Use%` 达到 95%，需要定位是哪个目录在涨。别慌，这个场景有固定套路。

**第一步：确认是哪个分区满了。**

```bash
df -h
```

**第二步：从挂载点往下钻，一次一层。** 不要一上来就 `du -sh /`，既慢又会混进其它挂载点。

```bash
du -h --max-depth=1 / 2>/dev/null | sort -hr | head -10
du -h --max-depth=1 /var 2>/dev/null | sort -hr | head -10
du -h --max-depth=1 /var/log 2>/dev/null | sort -hr | head -10
```

**第三步：锁定目录后找出 TOP 文件。** 用 `-a` 把文件列出来，配合 `sort -hr`：

```bash
du -ah /var/log | sort -hr | head -20
```

**第四步：确认是不是「删了没释放」。** 如果 `du` 累加值远小于 `df` 的已用值，基本就是这一类：

```bash
lsof | grep deleted
du -sh /var/log
df -h /var
```

**第五步：处理。** 正在被进程写入的日志用**截断**而不是删除：

```bash
> /var/log/nginx/access.log
```

删除已确认无用的归档文件，并按时间筛选，避免误删：

```bash
find /var/log -name "*.log.*" -mtime +30 -exec rm -f {} +
```

排错口诀：**df 看总量，du 找目标，--max-depth 分层钻，-a 定位大文件，对不上就查 deleted 句柄。**

## 验证方法

按以下四条自查，全部满足即证明 `du` 用法掌握到位：

1. `du -sh 目录` 的数值明显大于 `ls -ldh 目录` 的数值，能说出原因是「目录自身大小不含内容」。
2. 对同一个目录，`du -sh` 与 `du -sh --apparent-size` 结果不同，能指出差值是块对齐损耗。
3. 5 字节文件 `du -h` 显示 1.0K 而 `ls -lh` 显示 5，能用 `stat` 的 `Blocks` 字段佐证。
4. 稀疏文件 `ls -lh` 显示 1.0M 而 `du -h` 显示 0，能解释「du 按占用块统计」。

## 自测题

1. 想看 `/data` 下各一级子目录分别占多大，只要一层，命令是？
2. 如何统计 `/data` 的大小但不包含任何 `.log` 文件？
3. `du -sh` 与 `du -sh --apparent-size` 数值相差很大，说明什么？
4. `df -h` 显示已用 90%，但 `du -sh /` 累加只有 40%，最可能的原因是什么，怎么确认？
5. 统计根分区占用时，为什么要加 `-x`？

答案：

1. `du -h --max-depth=1 /data`（等价 `du -hd 1 /data`）
2. `du -sh --exclude="*.log" /data`
3. 目录下存在大量小文件，块对齐导致的内部碎片很多
4. 文件被删除但句柄未释放，用 `lsof | grep deleted` 或 `lsof +L1` 确认，重启对应进程或截断文件
5. 避免 `du` 跨进 `/boot`、`/data` 等独立挂载点，把别的分区算进根分区

## 本篇小结

1. 真正统计目录大小用 `du -sh 目录`；`ls -lh` 看到的是目录这个索引文件自身的大小，不含内容，两者不可混用。
2. 「真正」的含义是**按磁盘占用块统计**：`du` 读的是文件的块数（stat 的 `Blocks` 字段），`ls`/`--apparent-size` 读的是字节数（stat 的 `Size` 字段）。
3. 因为按块分配，小文件越多，`du` 与字节和的差距越大；10 万个 10 字节文件字节和仅 1MB，磁盘占用可达数百 MB。
4. `--max-depth` 是排错主力，配合 `sort -hr` 一次一层往下钻；要看到文件必须加 `-a`；要总计加 `-c`。
5. `du` 按 inode 记账，硬链接的多个文件名只计一次；稀疏文件 `du` 显示接近 0 而 `ls` 显示逻辑大小，这正是 `du` 更「真」的证明。
6. `df` 读超级块看整个分区，`du` 遍历文件看指定目录；`df` 明显大于 `du` 时优先查 `lsof +L1` 的 deleted 句柄。
7. 收尾一条最容易被忽略的坑：正在被写入的日志要截断（`> 日志文件`），直接 `rm` 空间并不释放。

> **参见**：容量查看：df 与 du · 企业常见问题：磁盘满 · inode 与 block · day15 磁盘 block 与存储原理
{% endraw %}
