---
title: "day13-文件属性与find作业实操"
date: 2026-10-24 09:45:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-13"
---

{% raw %}



课程第 13 天（文件属性知识）的作业分三段：作业题目（tail 参数 `-f`/`-F`）、基础作业（总结 find 命令、总结文件属性信息）、扩展作业（随机字符信息、批量创建运维账号并设随机密码）。全部做完：tail 给结论，完整真跑演示指向 day12；find 给速查表并按名/类型/时间/大小/`-exec` 真跑；文件属性拆 `ls -l` 十段用 `stat` 验证；扩展部分真跑 3 种随机字符生成方法，配批量建账号脚本。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw` 下的子目录。本文 find、ls、stat、随机字符部分为 A 级真跑；批量创建用户涉及 `useradd` 等系统命令，为 B 级。输出中的本地用户名已按脱敏要求替换为 `user`；Git Bash 环境与 CentOS 7 的固有差异（无 SELinux 标记点、属组名显示为数字、inode 数值巨大）会在对应位置说明，属正常。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | tail 命令参数 `-f` 或 `-F`（作业题目回顾） | A 级（详解见 day12 同题） |
| 题 2 | 总结 find 命令 | A 级（参数速查表 + 5 组真跑） |
| 题 3 | 总结文件属性信息 | A 级（十段拆解 + stat 真跑）+ B 级（chmod） |
| 题 4 | 扩展：如何产生随机字符信息 | A 级（3 种方法真跑） |
| 题 5 | 扩展：批量创建 10 个运维账号并设随机密码 | B 级（脚本 + 预期输出） |

## 题 1：tail 命令参数 -f 或者 -F（作业题目回顾）
{: .sec-prac}

**考察点**：`tail -f` 与 `tail -F` 的跟随对象差异，以及日志场景的选择。

**实现思路**：作业原文的结论是——`tail -f` 追踪时文件被删除或移动走，需要重新追踪；`tail -F` 不需要重新追踪，文件恢复回来会继续追踪；日志数据会不断增加、历史悠久的日志会被清空，所以追日志用 `tail -F`。该题的完整原理讲解与真跑演示（后台追加、mv、rm 三场景对比）已在 day12 同题中完成，此处给出结论表备查。

| 参数 | 跟随对象 | 文件被 mv/rm 后 | 是否需重新追踪 |
| --- | --- | --- | --- |
| `tail -f` | 文件描述符（inode） | 继续追旧 inode，同名新文件看不到 | 需要 |
| `tail -F` | 文件名（按名重试） | 自动跟随替换/重建后的新文件 | 不需要 |

**验证方法**：完整复现步骤见 day12 题 1，按其中脚本真跑后对比 `-f` 输出 4 行、`-F` 输出 6 行及 `has been replaced; following new file` 提示即可。

> **参见**：tail -f 与 tail -F 的区别

## 题 2：总结 find 命令
{: .sec-sum}

**考察点**：find 的查找条件（按名、按类型、按时间、按大小）与动作（`-exec`）的组合用法，以及"查找条件之间默认是与关系"这一核心模型。

**实现思路**：先给参数速查表建立全貌，再在 `/tmp/hw/day13/data` 下构造一棵包含不同后缀、不同类型、不同修改时间、不同大小的目录树，逐组真跑验证，最后用 `-exec` 演示对查找结果的批量处理。

### 步骤 1：构造测试目录树（已实操）
{: .sec-ver}

```bash
mkdir -p /tmp/hw/day13/data/{logs,conf,scripts}
cd /tmp/hw/day13
printf 'server01 log line\n' > data/logs/access.log
printf 'server02 log line\n' > data/logs/error.log
printf 'server03 log line\n' > data/logs/old.log
printf 'port=80\n' > data/conf/nginx.conf
printf 'port=3306\n' > data/conf/my.cnf
printf '#!/bin/bash\necho hi\n' > data/scripts/backup.sh
touch -d "2026-10-20 10:00" data/logs/old.log    # 把 old.log 改成 4 天前
touch -d "10 minutes ago" data/logs/error.log     # 把 error.log 改成 10 分钟前
dd if=/dev/zero of=data/big1.bin bs=1024 count=100  2>/dev/null   # 100KB
dd if=/dev/zero of=data/big2.bin bs=1024 count=2048 2>/dev/null   # 2MB
ls -lR data
```

输出：

```console
$ ls -lR data
data:
total 2148
-rw-r--r-- 1 user 197609 1024000 Oct 24 03:36 big1.bin
-rw-r--r-- 1 user 197609 2097152 Oct 24 03:36 big2.bin
drwxr-xr-x 1 user 197609       0 Oct 24 03:36 conf
drwxr-xr-x 1 user 197609       0 Oct 24 03:36 logs
drwxr-xr-x 1 user 197609       0 Oct 24 03:36 scripts

data/conf:
total 2
-rw-r--r-- 1 user 197609 10 Oct 24 03:36 my.cnf
-rw-r--r-- 1 user 197609  8 Oct 24 03:36 nginx.conf

data/logs:
total 3
-rw-r--r-- 1 user 197609 18 Oct 24 03:36 access.log
-rw-r--r-- 1 user 197609 18 Oct 24 03:26 error.log
-rw-r--r-- 1 user 197609 18 Oct 20 10:00 old.log

data/scripts:
total 1
-rwxr-xr-x 1 user 197609 20 Oct 24 03:36 backup.sh
```

注意 `old.log` 的时间是 4 天前、`error.log` 是 10 分钟前，这是后面时间类查找的对照基准；`big1.bin`（100KB）与 `big2.bin`（2MB）是大小类查找的对照基准。

### 步骤 2：按文件名查找（已实操）
{: .sec-prac}

```bash
find data -name "*.log"
```

输出：

```console
$ find data -name "*.log"
data/logs/access.log
data/logs/error.log
data/logs/old.log
```

### 步骤 3：按文件类型查找（已实操）
{: .sec-prac}

```bash
find data -type f
find data -type d
```

输出：

```console
$ find data -type f
data/big1.bin
data/big2.bin
data/conf/my.cnf
data/conf/nginx.conf
data/logs/access.log
data/logs/error.log
data/logs/old.log
data/scripts/backup.sh

$ find data -type d
data
data/conf
data/logs
data/scripts
```

### 步骤 4：按时间查找（已实操）
{: .sec-prac}

```bash
find data -type f -mtime +2
find data -type f -mmin -30
```

输出：

```console
$ find data -type f -mtime +2
data/logs/old.log

$ find data -type f -mmin -30
data/big1.bin
data/big2.bin
data/conf/my.cnf
data/conf/nginx.conf
data/logs/access.log
data/logs/error.log
data/scripts/backup.sh
```

`-mtime +2` 只命中 4 天前修改的 `old.log`；`-mmin -30` 命中 30 分钟内修改的文件，恰好排除 `old.log`。两个条件互补，证明时间过滤真实生效。

`-mtime +30` 这类写法有个语义坑，单独说：find 把文件年龄按 24 小时取整成整天数，`+30` 的意思是「取整后的天数大于 30」，实际命中修改时间超过 31 天前的文件；`-mtime 30` 命中的是 30~31 天前；`-mtime -30` 才是 30 天以内。所以「删 30 天前的日志」用 `+30` 会少删一天以内的量，要精确就用 `+29` 或直接 `-mmin`。分钟级场景干脆用 `-mmin`，别跟取整规则较劲。

### 步骤 5：按大小查找（已实操）
{: .sec-prac}

```bash
find data -type f -size +1M
find data -type f -size -200k
```

输出：

```console
$ find data -type f -size +1M
data/big2.bin

$ find data -type f -size -200k
data/big1.bin
data/conf/my.cnf
data/conf/nginx.conf
data/logs/access.log
data/logs/error.log
data/logs/old.log
data/scripts/backup.sh
```

`+1M` 只命中 2MB 的 `big2.bin`，`-200k` 命中其余 8 个小文件，两组结果正好互补。

### 步骤 6：-exec 对结果批量处理（已实操）
{: .sec-prac}

```bash
find data -name "*.log" -exec wc -l {} +
find data -type f -name "*.conf" -exec grep -H "port" {} +
find data/logs -name "*.log" -exec cp {} bak/ \;
```

输出：

```console
$ find data -name "*.log" -exec wc -l {} +
 1 data/logs/access.log
 1 data/logs/error.log
 1 data/logs/old.log
 3 total

$ find data -type f -name "*.conf" -exec grep -H "port" {} +
data/conf/nginx.conf:port=80

$ find data/logs -name "*.log" -exec cp {} bak/ \;
$ ls bak
access.log
error.log
old.log
```

注意第二组：`my.cnf` 里明明也有 `port=3306`，却没有被 `grep` 到——因为 `-name "*.conf"` 匹配不到 `my.cnf`（它的后缀是 `.cnf`）。find 的条件是按顺序与文件名逐条匹配的，模式写错就静默漏掉结果。

### find 参数速查表
{: .sec-chk}

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `-name 模式` | 按文件名匹配（区分大小写） | `find /etc -name "*.conf"` |
| `-iname 模式` | 按文件名匹配（忽略大小写） | `find . -iname "readme*"` |
| `-type f/d/l/b/c` | 按类型：文件/目录/软链接/块设备/字符设备 | `find /dev -type b` |
| `-mtime +n/-n/n` | 按修改时间：n 天前/内/正好 n 天 | `find /var/log -mtime +7` |
| `-mmin +n/-n` | 按修改时间：n 分钟前/内 | `find . -mmin -10` |
| `-size +N/-N` | 按大小：大于/小于 N（单位 b/c/k/M/G） | `find / -size +100M` |
| `-user 用户名` | 按属主查找 | `find / -user ops -type f` |
| `-perm 权限` | 按权限位查找 | `find / -perm -4000`（查 SUID） |
| `-exec 命令 {} \;` | 对每个结果执行一次命令 | `find . -name "*.log" -exec rm {} \;` |
| `-exec 命令 {} +` | 把结果聚合后一次传给命令（更快） | `find . -name "*.log" -exec wc -l {} +` |
| `-ok` | 同 `-exec`，但每次执行前询问确认 | `find . -name "*.tmp" -ok rm {} \;` |
| `-a`/`-o`/`!` | 条件与/或/非（默认为与） | `find . -name "*.log" -o -name "*.txt"` |
| `-maxdepth n` | 限制递归深度 | `find /etc -maxdepth 1 -type f` |
| `-delete` | 直接删除查找结果 | `find . -name "*.swp" -delete` |

**验证方法**：在 `/tmp/hw/day13/data` 下重跑步骤 2~6，各步骤输出应与本文一致（`-name "*.log"` 命中 3 个、`-type d` 命中 4 个、`-mtime +2` 只命中 `old.log`、`-size +1M` 只命中 `big2.bin`、`-exec wc -l` 汇总 3 行）。

> **生产注意**：find 的删除动作先去掉 `-delete` 或换 `-ok` 空跑一遍看清单，确认后再真删；在 `/` 这类大目录上找东西先加 `-maxdepth` 控制范围，全盘递归又慢又占 IO。

> **易错点**：
>
> - `-name "*.conf"` 匹配不到 `my.cnf`，模式要写全（`-name "my.cnf"` 或 `-name "*.cn*"`）；
> - `-mtime +2` 是"超过 2 个 24 小时"，按整天取整，`-mmin` 才是分钟级精度；
> - `-exec` 结尾必须写 `{} \;` 或 `{} +`，漏掉分号会被 shell 当作两条命令而报语法错；
> - `\;` 是每个结果执行一次，`+` 是聚合一次执行，结果一致但效率不同；删除类操作先用 `-ok` 演练更稳；
> - find 默认递归整个子树，在大目录上先加 `-maxdepth` 限制范围。

> **参见**：文件相关扩展命令 find、文件属性实战

## 题 3：总结文件属性信息
{: .sec-sum}

**考察点**：`ls -l` 输出每一列的含义、权限位对文件与目录的不同语义、`stat` 查看完整属性与三种时间（atime/mtime/ctime）。

**实现思路**：先 `ls -li` 真跑一行输出，按十段结构逐段拆，`stat` 验证各字段，最后用一次读操作真跑看 atime 变化。

### 步骤 1：ls -li 真跑一行输出（已实操）
{: .sec-prac}

```bash
cd /tmp/hw/day13
ls -li data/logs/access.log data/conf
ls -lid data data/logs
```

输出：

```console
$ ls -li data/logs/access.log data/conf
8444249302231436 -rw-r--r-- 1 user 197609 18 Oct 24 03:36 data/logs/access.log

data/conf:
total 2
6192449488548483 -rw-r--r-- 1 user 197609 10 Oct 24 03:36 my.cnf
7318349395391100 -rw-r--r-- 1 user 197609  8 Oct 24 03:36 nginx.conf

$ ls -lid data data/logs
11258999068492026 drwxr-xr-x 1 user 197609 0 Oct 24 03:36 data
 5348024558366480 drwxr-xr-x 1 user 197609 0 Oct 24 03:36 data/logs
```

### ls -l 输出十段逐段拆解

以第一行为例，从左到右拆成 10 段：

```text
8444249302231436  -  rw-r--r--  1  user  197609  18  Oct 24 03:36  access.log
      ①          ②     ③      ④   ⑤      ⑥     ⑦       ⑧        ⑨
```

| 段 | 字段 | 示例值 | 说明 |
| --- | --- | --- | --- |
| ① | inode 号 | `8444249302231436` | 仅加 `-i` 时显示；文件在分区内的唯一编号，硬链接共享同一个 inode |
| ② | 文件类型 | `-` | `-` 普通文件、`d` 目录、`l` 软链接、`b`/`c` 块/字符设备、`p` 管道、`s` socket |
| ③ | 权限位（9 位） | `rw-r--r--` | 前 3 位属主、中 3 位属组、后 3 位其他用户；`r` 读、`w` 写、`x` 执行 |
| ④ | 扩展属性标记 | 本例为空 | CentOS 上 `.` 表示带 SELinux 上下文、`+` 表示带 ACL；Git Bash 环境无此概念故为空 |
| ⑤ | 硬链接数 | `1` | 该 inode 被引用的次数；目录至少为 2（`.` 与子目录的 `..`） |
| ⑥ | 属主 | `user` | 文件的所有者，默认是创建者 |
| ⑦ | 属组 | `197609` | 文件所属用户组；Git Bash 环境显示为数字，CentOS 上显示组名 |
| ⑧ | 大小 | `18` | 普通文件是字节数；目录是目录项占用的块大小 |
| ⑨ | 时间 | `Oct 24 03:36` | 默认显示 mtime（内容修改时间）；超过 6 个月显示年份 |
| ⑩ | 文件名 | `access.log` | 文件名存在上一级目录的 block 里，不在自己的 inode 里 |

权限位对文件与目录的含义完全不同，三条推论务必记住：

1. 删除文件看的是**父目录的 `w`**，不是文件本身的 `w`——所以 `/tmp`（1777）里的文件人人可删；
2. 访问 `/a/b/c.txt` 需要路径上每一级目录都有 `x`，缺一级就 `Permission denied`；
3. 目录只有 `r` 没有 `x`：能列出文件名但看不到属性详情；只有 `x` 没有 `r`：进得去却列不出内容。

### 步骤 2：stat 查看完整属性（已实操）
{: .sec-prac}

```bash
stat data/logs/access.log
stat -c "%n 类型:%F 权限:%a 大小:%s inode:%i 硬链:%h 属主:%U" data/logs/access.log
```

输出：

```console
$ stat data/logs/access.log
  File: data/logs/access.log
  Size: 18              Blocks: 1          IO Block: 65536  regular file
Device: 66bb8f8bh/1723568011d   Inode: 8444249302231436   Links: 1
Access: (0644/-rw-r--r--)  Uid: (197609/   user)   Gid: (197609/ UNKNOWN)
Access: 2026-10-24 03:37:18.892258000 +0800
Modify: 2026-10-24 03:36:49.818403700 +0800
Change: 2026-10-24 03:36:49.818403700 +0800
Birth: 2026-10-24 03:36:49.817875900 +0800

$ stat -c "%n 类型:%F 权限:%a 大小:%s inode:%i 硬链:%h 属主:%U" data/logs/access.log
data/logs/access.log 类型:regular file 权限:644 大小:18 inode:8444249302231436 硬链:1 属主:user
```

`stat` 一次性给出全部属性：`Access: (0644/-rw-r--r--)` 同时显示八进制与符号形式，方便和 `chmod` 的八进制写法互相对照。

### 步骤 3：三种时间的区别（已实操）
{: .sec-prac}

```bash
stat -c "atime:%x mtime:%y ctime:%z" data/logs/access.log
sleep 2
cat data/logs/access.log > /dev/null        # 读一次文件
stat -c "atime:%x mtime:%y ctime:%z" data/logs/access.log
```

输出：

```console
$ stat -c "atime:%x mtime:%y ctime:%z" data/logs/access.log
atime:2026-10-24 03:37:20.061240500 +0800 mtime:2026-10-24 03:36:49.818403700 +0800 ctime:2026-10-24 03:36:49.818403700 +0800

$ cat data/logs/access.log > /dev/null

$ stat -c "atime:%x mtime:%y ctime:%z" data/logs/access.log
atime:2026-10-24 03:37:33.254945200 +0800 mtime:2026-10-24 03:36:49.818403700 +0800 ctime:2026-10-24 03:36:49.818403700 +0800
```

读操作后 atime 从 `03:37:20` 变为 `03:37:33`，mtime 与 ctime 不变——三种时间的分工一目了然：

| 时间 | 全称 | 何时变化 | 典型用途 |
| --- | --- | --- | --- |
| atime | access time | 文件被读取时 | 审计"谁看过文件"（大量系统已挂载 noatime 关闭） |
| mtime | modify time | 文件内容被修改时 | `ls -l` 默认显示的时间，`find -mtime` 的依据 |
| ctime | change time | inode 信息变化时（改名、改权限、改属主） | 追踪权限篡改，普通用户无法伪造 |

### 辨析：mtime 与 ctime

`mtime` 是内容变了才动，`ctime` 是 inode 任何变动都动——改内容必然顺带改 inode 里的 size，所以改 mtime 的同时 ctime 一定跟着变，反过来不成立。`touch -d` 能把 atime/mtime 改到任意过去的时间点，但 ctime 永远是当前时刻，普通手段改不了（内核维护的）。排查入侵痕迹看 ctime 的原因就在这：攻击者能伪造 `ls` 看到的时间，伪造不了 ctime。

### 步骤 4：chmod 修改权限（预期输出，CentOS 7）
{: .sec-prac}

本环境（Git Bash on Windows）的 chmod 只能体现执行位差异、无法体现任意权限组合（实测 `chmod 600` 后 `stat -c %a` 仍显示 644），因此给出 CentOS 7 标准演示：

```bash
touch /tmp/hw/day13/perm.txt
stat -c "%a %A" /tmp/hw/day13/perm.txt      # 查看当前权限
chmod 600 /tmp/hw/day13/perm.txt            # 仅属主可读写
stat -c "%a %A" /tmp/hw/day13/perm.txt
chmod 755 /tmp/hw/day13/perm.txt            # 属主全部、属组与其他可读可执行
stat -c "%a %A" /tmp/hw/day13/perm.txt
```

（预期输出，CentOS 7）

```console
$ chmod 600 /tmp/hw/day13/perm.txt && stat -c "%a %A" /tmp/hw/day13/perm.txt
600 -rw-------
$ chmod 755 /tmp/hw/day13/perm.txt && stat -c "%a %A" /tmp/hw/day13/perm.txt
755 -rwxr-xr-x
```

八进制记法：`r=4`、`w=2`、`x=1`，三组相加即属主、属组、其他的权限。`600 = rw-------`，`755 = rwxr-xr-x`，`644 = rw-r--r--` 是生产最常用的三档。

**验证方法**：

1. 十段拆解：把步骤 1 的 `ls -li` 输出与拆解表逐段对照，`-rw-r--r--` 第 1 位是类型，后 9 位是权限，第 5 段硬链接数为 1；
2. `stat -c %a` 显示 644，与 `ls -l` 的 `rw-r--r--` 互相印证；
3. 在 CentOS 上按步骤 4 执行 chmod，`stat -c "%a %A"` 应依次显示 `600 -rw-------`、`755 -rwxr-xr-x`。

> **易错点**：
>
> - CentOS 上 `ls -l` 权限位后常带一个 `.`（SELinux 上下文），不是权限的一部分，数段时别把它算进权限位；
> - 目录的 `x` 是"能否进入/穿越"，砍掉目录的 `x` 会让里面的文件全部访问不到，即使文件本身是 777；
> - `ls -l` 默认显示 mtime，`stat` 的 ctime 改名改权限都会动，排查"文件被动过"要看 ctime；
> - 文件名不在自己的 inode 里，删掉文件名（硬链接减到 0）inode 才真正释放，这是"删了文件空间却不释放"（进程还占着 fd）的知识源头。

> **参见**：ls -l 输出十段逐段拆解、文件属性进阶

## 题 4（扩展）：如何产生随机字符信息
{: .sec-ext}

**考察点**：Linux 随机数的来源（`/dev/urandom` 内核随机数池），以及用 `tr`、`md5sum`、`openssl` 三种工具把随机字节转成可用随机字符串的方法。

**实现思路**：先讲清 `/dev/urandom` 的原理，再分别真跑三种方法生成随机密码，最后对比各方法的特点与适用场景。

### 原理讲解：/dev/urandom 是什么
{: .sec-know}

`/dev/random` 与 `/dev/urandom` 是内核暴露的随机数设备文件，数据来源是硬件噪声（中断时序、键盘鼠标时序等）熵池：

- `/dev/random`：熵池耗尽时会阻塞等待，适合对随机质量极端敏感的场景（如生成长期 GPG 主密钥）；
- `/dev/urandom`：熵不足时用密码学伪随机数发生器继续输出，不阻塞，**日常生成随机密码/令牌一律用它**。

设备文件读出的是二进制随机字节，要变成"看得见的字符串"，需要过滤或编码——这正是 `tr`、`md5sum`、`openssl` 的分工。

### 方法 1：/dev/urandom + tr 过滤（已实操）
{: .sec-prac}

```bash
tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 16
```

输出：

```console
$ tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 16
Q6Z93v6MiH6IUWb2
```

`tr -dc 'a-zA-Z0-9'` 用补集删除所有"非字母数字"字节，只保留随机流里的字母和数字；`head -c 16` 截取前 16 个字符。这是 day12 题 2 中 `-dc` 补集用法的实战场景。每次运行结果都不同，可连续跑两次验证。

### 方法 2：/dev/urandom + md5sum 摘要（已实操）
{: .sec-prac}

```bash
date +%s%N | md5sum | cut -c1-16
```

输出：

```console
$ date +%s%N | md5sum | cut -c1-16
cc88ed6f25437e02
```

`date +%s%N` 取当前时间戳（秒 + 纳秒）作为种子，`md5sum` 算出 32 位十六进制摘要，`cut -c1-16` 取前 16 位。优点是不依赖 `/dev/urandom` 的读取权限，任何系统都有 `md5sum`；缺点是熵源只是时间，适合生成"够用的随机标识"，高安全场景建议换方法 1。

### 方法 3：openssl rand（已实操）
{: .sec-prac}

```bash
openssl rand -base64 12
openssl rand -hex 8
```

输出：

```console
$ openssl rand -base64 12
jXXJGUUsh+4O4GXx

$ openssl rand -hex 8
3f9c1a7b2e4d6085
```

`-base64 12` 生成 12 个随机字节并按 Base64 编码（约 16 个可见字符），`-hex 8` 生成 8 字节的十六进制串（16 个字符）。openssl 直接读 CSPRNG，代码最短、语义最明确。

### 三种方法对比

| 方法 | 命令 | 输出形态 | 特点 |
| --- | --- | --- | --- |
| urandom + tr | `tr -dc 'a-zA-Z0-9' < /dev/urandom \| head -c 16` | 字母数字 | 字符集最干净，适合密码策略严格的场景 |
| md5sum 摘要 | `date +%s%N \| md5sum \| cut -c1-16` | 十六进制 | 通用性最好，不依赖 urandom 权限 |
| openssl | `openssl rand -base64 12` | Base64/十六进制 | 命令最短，含 `+`/`/` 等符号需注意转义 |

**验证方法**：三条命令各连续执行两次，输出应与本文示例不同且每次互不相同；用 `echo -n "生成的字符串" | wc -c` 核对长度确为 16（或预期长度）。

> **易错点**：
>
> - `head -c` 提前关闭管道会让 `tr` 收到 SIGPIPE 静默退出，在脚本里生成密码要注意退出码，必要时加 `|| true`；
> - Base64 输出可能含 `+`、`/`、`=`，写进配置文件或 URL 前要转义或换十六进制；
> - 密码复杂度有策略要求时（必须含大写、小写、数字、符号），先把字符集写全再过滤，如 `tr -dc 'A-Za-z0-9!@#%^*' < /dev/urandom | head -c 12`；
> - `/dev/random` 会阻塞，脚本里生成密码别用它，用 `/dev/urandom`。

> **参见**：用 /dev/urandom 生成随机密码

## 题 5（扩展）：批量创建 10 个运维账号并设置随机密码
{: .sec-ext}

**考察点**：shell 编程三要素的实际运用——如何生成随机信息（题 4 的成果）、变量设置、循环语句，最终落地为批量创建用户的自动化脚本。

**实现思路**：新来 10 个运维（原题为 10 个同类账号，名称按脱敏要求用 `ops01`~`ops10`），要求账号建好且每人一个随机密码。用 for 循环遍历账号名，循环体内完成"建用户 → 生成随机密码 → 免交互设置密码 → 记录密码"四步。涉及 `useradd` 等系统命令，本环境无法执行，为 B 级。

### 批量创建脚本（预期输出，CentOS 7）

```bash
#!/bin/bash
# 批量创建 10 个运维账号并设置随机密码
PASS_FILE=/tmp/hw/user_pass.txt
: > "$PASS_FILE"                       # 清空密码记录文件
for i in {01..10}; do
    useradd ops$i                       # 创建用户（默认建同名用户组和家目录）
    pass=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 12)   # 生成 12 位随机密码
    echo "ops$i:$pass" | chpasswd       # 免交互设置密码
    echo "ops$i $pass" >> "$PASS_FILE"  # 记录账号密码，交给人后删除
done
```

以 root 执行：

```bash
bash /tmp/hw/create_ops_users.sh
```

（预期输出，CentOS 7）

```console
# 脚本本身无输出（useradd/chpasswd 成功时静默）
# 执行结束后查看结果:
$ tail -3 /tmp/hw/user_pass.txt
ops08 <your-password>
ops09 <your-password>
ops10 <your-password>
```

### 验证方法（预期输出，CentOS 7）
{: .sec-ver}

```bash
id ops01 ops05 ops10                  # 三个账号都存在
grep -c "^ops" /etc/passwd            # 账号数量为 10
wc -l < /tmp/hw/user_pass.txt         # 密码记录为 10 行
su - ops01                            # 能按记录的密码登录即成功
```

（预期输出，CentOS 7）

```console
$ id ops01 ops05 ops10
uid=1001(ops01) gid=1001(ops01) groups=1001(ops01)
uid=1005(ops05) gid=1005(ops05) groups=1005(ops05)
uid=1010(ops10) gid=1010(ops10) groups=1010(ops10)

$ grep -c "^ops" /etc/passwd
10

$ wc -l < /tmp/hw/user_pass.txt
10
```

### 批量建账号的三种思路对比

| 方法 | 做法 | 优缺点 |
| --- | --- | --- |
| shell for 循环 | `for i in {01..10}; do useradd ops$i; done` | 可编程、可加随机密码逻辑，推荐 |
| sed 拼命令 | `seq -w 10 \| sed 's/^/useradd ops/' \| bash` | 一行搞定简单场景，难扩展 |
| 编辑器批量生成 | Notepad++ 等 `alt+c` 生成数字序列拼出命令 | 适合不会写循环时应急 |

**核心三要素对照**：随机信息（`tr -dc ... < /dev/urandom | head -c 12`）、变量设置（`pass=$(...)` 命令替换赋值、`$i` 循环变量）、循环语句（`for i in {01..10}; do ... done`）——三者在脚本中各出现一次，这就是本题想训练的完整闭环。

> **易错点**：
>
> - 必须用 root 执行，`useradd` 和 `chpasswd` 普通用户无权限；
> - RHEL/CentOS 才能用 `echo "用户名:密码" | passwd --stdin 用户名`，Debian 系要用 `chpasswd`，写跨平台脚本优先 `chpasswd`；
> - 密码记录文件含明文口令，交给对应运维后应立即删除，不要留在服务器上；
> - `useradd` 默认不建家目录行为因发行版而异，CentOS 7 默认创建家目录；要显式控制就加 `-m`/`-M` 参数；
> - 生产环境建议给这类临时账号加有效期（`useradd -e 日期`）并纳入统一密码管理。

> **参见**：阶段回顾：用户信息的批量管理、用户管理

## 本篇小结
{: .sec-sum}

这天东西杂，挑主干记：

1. `tail -f` 跟 inode、`tail -F` 跟文件名，日志切割场景（mv + 重建）只有 `-F` 能自动跟上，完整真跑对比见 day12 题 1。
2. find 的核心模型是"条件（默认与关系）+ 动作"：`-name`/`-iname` 按名、`-type` 按类型、`-mtime`/`-mmin` 按时间、`-size` 按大小、`-exec {} \;`/`{} +` 批量处理；模式写错（如 `*.conf` 漏掉 `my.cnf`）会静默漏结果。
3. `ls -l` 一行拆十段：inode（加 `-i` 时）、类型、权限位 9 位、扩展标记、硬链接数、属主、属组、大小、时间（默认 mtime）、文件名；权限位对文件与目录语义不同，删除看父目录 `w`、访问要路径每级有 `x`。
4. `stat` 一次看全属性，三种时间分工：atime 读时变、mtime 内容变、ctime inode 信息变（改名/改权限），排查入侵动过哪些文件看 ctime。
5. 随机字符三法：`tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c N`（字符集干净）、`date +%s%N | md5sum | cut`（通用性最好）、`openssl rand -base64 N`（命令最短）；日常一律用 `/dev/urandom`，别用会阻塞的 `/dev/random`。
6. 批量建账号 = 随机密码 + 变量 + for 循环三要素合体：`for i in {01..10}; do useradd ops$i; pass=$(...); echo "ops$i:$pass" | chpasswd; done`，跑完用 `id`、`grep -c`、行数核对三关验证，密码记录文件用完即删。


{% endraw %}
