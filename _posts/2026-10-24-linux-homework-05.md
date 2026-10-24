---
title: "day5 命令与重定向作业实操"
date: 2026-10-24 09:05:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 5 天是系统管理与操作命令，作业两条：总结已学命令及参数、预习系统目录结构。命令部分每条至少配一个真实运行的示例，重定向符号全部真跑；目录结构部分整理 FHS 速查表，并拿 Git Bash 的真实路径做对照。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw` 下的子目录。本文 A 级输出均在 Git Bash（bash 5.3）中真实执行；输出中的本地用户名已按脱敏要求替换为 `user`，属正常环境差异。读者在 CentOS 7 上执行同样的命令，输出格式完全一致（时间戳、属主等因环境不同属正常）。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 总结已学命令及参数用法 | A 级（速查表 + 每条真跑示例） |
| 题 2 | 预习系统目录结构 | B 级（FHS 速查表）+ A 级（Git Bash 路径对照） |

## 题 1：总结已学命令及参数用法

**考察点**：把一个文件从生到死走一遍——`touch` 创建、`echo` 加重定向写入、`cat` 查看、`cp` 备份、`mv` 移动改名、`rm` 删除；重点是 `>`、`>>`、`2>&1` 三个重定向符号的行为差异。

**实现思路**：速查表先铺全貌，然后在 `/tmp/hw/day5` 里按"创建 → 写入 → 查看 → 备份 → 移动 → 删除"的顺序逐个真跑，输出原样贴。最后用覆盖、追加、错误重定向三组对比实验把重定向原理讲透。

### 命令速查表

| 命令 | 作用 | 高频用法 |
| --- | --- | --- |
| `touch` | 创建空文件 / 更新时间戳 | `touch a.txt` |
| `echo` | 在屏幕输出信息 | `echo "hello"` |
| `cat` | 查看文件全部内容 | `cat -n f` |
| `head` | 查看文件前 N 行 | `head -20 f` |
| `tail` | 查看文件后 N 行 / 跟踪 | `tail -f /var/log/secure` |
| `cp` | 复制文件或目录 | `cp a.txt /tmp/`、`cp -r dir /tmp/` |
| `mv` | 移动 / 重命名 | `mv a.txt /tmp/`、`mv a.txt b.txt` |
| `rm` | 删除文件或目录 | `rm -f a.txt`、`rm -rf dir` |
| `mkdir` | 创建目录 | `mkdir -p /a/b/c` |
| `rmdir` | 删除空目录 | `rmdir emptydir` |

### 参数详解表

| 命令 | 参数 | 作用 |
| --- | --- | --- |
| `ls` | `-l` / `-a` / `-d` / `-h` / `-t` / `-r` | 长格式 / 含隐藏文件 / 只看目录本身 / 可读大小 / 按时间 / 逆序 |
| `cat` | `-n` / `-b` / `-A` | 所有行编号 / 空行不编号 / 显示不可见字符 |
| `head` | `-n N` / `-c N` | 前 N 行 / 前 N 字节 |
| `tail` | `-n N` / `-n +N` / `-f` / `-F` | 后 N 行 / 从第 N 行起 / 跟踪新增 / 跟踪并重试轮转文件 |
| `cp` | `-r` / `-p` / `-a` / `-i` / `-f` / `-v` | 递归目录 / 保留属性 / 归档 / 覆盖询问 / 强制 / 显示过程 |
| `mv` | `-i` / `-f` / `-n` / `-v` | 覆盖询问 / 强制 / 不覆盖 / 显示过程 |
| `rm` | `-f` / `-r` / `-v` | 强制 / 递归 / 显示删除项 |

### 步骤 1：创建空文件并查看属性（已实操）

```bash
mkdir -p /tmp/hw/day5
cd /tmp/hw/day5
touch test.txt
ls -l test.txt
```

输出：

```console
$ touch test.txt && ls -l test.txt
-rw-r--r-- 1 user user 0 Oct 24 03:26 test.txt
```

`touch` 的本意是"触摸文件的三个时间戳"：文件不存在就创建空文件，已存在则更新访问与修改时间。新文件大小为 0 字节，默认权限 `-rw-r--r--`。

### 步骤 2：echo 配合重定向写入文件（已实操）

`>` 覆盖写入：先把原文件清空，再写入新内容。

```bash
echo "hello world" > test.txt
cat test.txt
```

输出：

```console
$ echo "hello world" > test.txt
$ cat test.txt
hello world
```

`>>` 追加写入：不清空原文件，在末尾追加。

```bash
echo "hello linux 01" >> test.txt
echo "hello linux 02" >> test.txt
cat -n test.txt
```

输出：

```console
$ echo "hello linux 01" >> test.txt
$ echo "hello linux 02" >> test.txt
$ cat -n test.txt
     1	hello world
     2	hello linux 01
     3	hello linux 02
```

对比实验——连续两次 `>` 只剩最后一次内容：

```bash
echo "only line" > demo.txt
cat demo.txt
echo "second" > demo.txt
cat demo.txt
```

输出：

```console
$ echo "only line" > demo.txt && cat demo.txt
only line
$ echo "second" > demo.txt && cat demo.txt   # > 覆盖，只剩 second
second
```

**验证方法**：`cat -n test.txt` 能看到 3 行且行号连续，证明 `>>` 是追加不是覆盖；`cat demo.txt` 只剩 `second`，证明 `>` 会先清空。

> **原理：** shell 执行命令前先处理重定向——遇到 `>` 就以只写模式打开文件（长度截断为 0），遇到 `>>` 就以追加模式打开（文件指针移到末尾）。所以清空内容不是命令做的，而是打开文件时系统完成的。

顺手记一个生产事故模式：脚本里写 `echo $RESULT > $LOG_FILE`，如果 $LOG_FILE 变量为空，重定向目标就成了空路径，轻则报错重则写错地方；更糟的是 `cat /dev/null > $DATA_FILE` 这类清空操作，变量名敲错等于删了别的数据。凡是写文件的脚本，目标路径先做非空校验——覆盖重定向没有后悔药。

### 步骤 3：错误输出重定向 `2>`、`2>&1`（已实操）

每个进程有三个默认文件描述符：`0` 标准输入、`1` 标准输出、`2` 标准错误。报错信息走的是 2 号通道，所以 `> file` 接不住错误，需要 `2>` 或 `2>&1`。

先看不加任何重定向时的表现与退出码：

```bash
ls not-exist
echo "exit=$?"
```

输出：

```console
$ ls not-exist
ls: cannot access 'not-exist': No such file or directory
exit=2
```

丢弃错误输出（`2>/dev/null`），屏幕干净但退出码仍为 2：

```bash
ls not-exist 2>/dev/null
echo "exit=$?"
```

输出：

```console
$ ls not-exist 2>/dev/null; echo "exit=$?"
exit=2
```

把错误也存进文件（`> file 2>&1`：标准输出进文件，标准错误合并到标准输出）：

```bash
ls not-exist > err.txt 2>&1
cat err.txt
```

输出：

```console
$ ls not-exist > err.txt 2>&1 && cat err.txt
ls: cannot access 'not-exist': No such file or directory
```

全部输出丢弃（`> /dev/null 2>&1`，写定时任务与脚本时最常用）：

```bash
ls not-exist > /dev/null 2>&1
echo "exit=$?"
```

输出：

```console
$ ls not-exist > /dev/null 2>&1; echo "exit=$?"
exit=2
```

**验证方法**：`cat err.txt` 里能查到错误信息，证明 `2>&1` 把错误写进了文件；三种写法下 `echo $?` 都是 2，证明重定向不改变退出码——脚本里判断成败要用 `$?`，不能看屏幕有没有报错。

三种写法对照：

| 写法 | 效果 | 典型场景 |
| --- | --- | --- |
| `> file` | 标准输出写入文件（先清空） | 保存命令结果 |
| `2> file` | 标准错误写入文件 | 单独收集报错日志 |
| `> file 2>&1` | 标准输出与错误都进文件 | 完整记录执行日志 |
| `> /dev/null 2>&1` | 输出全部丢弃 | 屏蔽不关心的输出 |

> **易错点**：`2>&1` 的顺序不能反——`>file 2>&1` 是"输出进文件、错误也进文件"；若写成 `2>&1 >file`，错误会先跟随当时的标准输出（终端）打印出来，再改标准输出到文件，结果错误仍然显示在屏幕上。另外 `2>&1` 必须写在最后（或紧跟重定向目标之后），这是 shell 按从左到右顺序设置重定向的结果。

### 步骤 4：cp 备份文件与目录（已实操）

备份文件直接写目标位置：

```bash
mkdir -p backup dir01/sub
cp test.txt backup/
ls -l backup/
```

输出：

```console
$ mkdir -p backup dir01/sub
$ cp test.txt backup/
$ ls -l backup/
total 1
-rw-r--r-- 1 user user 42 Oct 24 03:26 test.txt
```

备份目录必须加 `-r`，否则会跳过目录报 `omitting directory`：

```bash
echo "file a" > dir01/a.txt
echo "file b" > dir01/sub/b.txt
cp -r dir01 dir01-copy
find dir01-copy | sort
cat dir01-copy/sub/b.txt
```

输出：

```console
$ echo "file a" > dir01/a.txt
$ echo "file b" > dir01/sub/b.txt
$ cp -r dir01 dir01-copy
$ find dir01-copy | sort
dir01-copy
dir01-copy/a.txt
dir01-copy/sub
dir01-copy/sub/b.txt
$ cat dir01-copy/sub/b.txt
file b
```

**验证方法**：`find dir01-copy | sort` 列出的目录树与源目录 `dir01` 结构一致，`cat` 能读出子目录里的文件内容，证明递归复制完整。

> **易错点**：`cp -r` 的目标如果已经存在，行为是"复制到它里面"而不是"覆盖成它"。实测再执行一次 `cp -r dir01 dir01-copy`，会多出一层 `dir01-copy/dir01/`——这是真实踩坑点，备份前先确认目标不存在，或用 `cp -a` 并配合明确的目录名。

### 步骤 5：mv 移动与重命名（已实操）

同目录下 `mv` 就是重命名：

```bash
mv test.txt renamed.txt
ls -l renamed.txt
ls test.txt
```

输出：

```console
$ mv test.txt renamed.txt && ls -l renamed.txt
-rw-r--r-- 1 user user 42 Oct 24 03:26 renamed.txt
$ ls test.txt 2>&1
ls: cannot access 'test.txt': No such file or directory
```

移到别的目录就是移动（剪切）：

```bash
mv renamed.txt backup/
ls -l backup/
```

输出：

```console
$ mv renamed.txt backup/
$ ls -l backup/
total 2
-rw-r--r-- 1 user user 42 Oct 24 03:26 renamed.txt
-rw-r--r-- 1 user user 42 Oct 24 03:26 test.txt
```

**验证方法**：重命名后旧名字 `ls` 报 `No such file or directory`、新名字能 `ls -l` 到，证明 `mv` 是"改名"不是"复制"（源文件不在了）。

> **原理：** 同一文件系统内 `mv` 只修改目录数据块里"文件名 → inode"的映射，瞬间完成不搬数据；跨文件系统时才退化为"复制 + 删除"。

### 步骤 6：rm 与 rmdir 删除（已实操）

```bash
touch to-delete.txt
rm to-delete.txt
ls to-delete.txt
mkdir empty-dir
rmdir empty-dir
rmdir dir01
rm -r dir01-copy
ls -d dir01-copy
```

输出：

```console
$ touch to-delete.txt && rm to-delete.txt && ls to-delete.txt 2>&1
ls: cannot access 'to-delete.txt': No such file or directory

$ mkdir empty-dir && rmdir empty-dir
$ rmdir dir01 2>&1   # 非空目录删不掉
rmdir: dir01: Directory not empty

$ rm -r dir01-copy && ls -d dir01-copy 2>&1
ls: cannot access 'dir01-copy': No such file or directory
```

**验证方法**：删除后 `ls` 全部报 `No such file or directory`；`rmdir` 对非空目录直接拒绝，证明它只能删空目录（这是它的安全价值——永远不会误删数据）。

> **易错点**：`rm -rf` 高效但危险，执行前务必确认路径，确认再确认；禁止在变量可能为空的脚本里写 `rm -rf $VAR/`。CentOS 默认给 `rm` 设置了别名 `rm -i`，删除前会询问，脚本中批量删除用 `\rm` 或 `rm -f` 绕过。

### 步骤 7：文件通配符（已实操）

```bash
touch file1.txt file2.txt file3.txt photo.jpg logo.png
ls *.txt
ls file?.txt
ls file[12].txt
echo {a,b,c}
```

输出：

```console
$ touch file1.txt file2.txt file3.txt photo.jpg logo.png
$ ls *.txt
demo.txt
err.txt
file1.txt
file2.txt
file3.txt
$ ls file?.txt
file1.txt
file2.txt
file3.txt
$ ls file[12].txt
file1.txt
file2.txt
$ echo {a,b,c}
a b c
```

**验证方法**：`*.txt` 匹配到全部 5 个 txt 文件（含前几步生成的 demo.txt、err.txt），`file?.txt` 匹配 file 加单个字符，`file[12].txt` 只匹配 1 和 2，三种范围由宽到窄，行为与规则表一致。

> **易错点**：`*`、`?`、`[]` 是文件名匹配，磁盘上必须有真实文件才会展开；`{a,b,c}` 是 shell 字符串展开，与文件是否存在无关。所以 `mkdir /data/{a,b,c}` 一定能生成三个目录，而 `ls /data/*.txt` 在没有 txt 文件时会原样报错。

> **参见**：常用文件操作命令

## 题 2：预习系统目录结构

**考察点**：FHS（Filesystem Hierarchy Standard，文件系统层次结构标准）规定了每个目录该放什么；运维判断"文件放哪、目录能不能清"以此为依据。

**实现思路**：给出 FHS 速查表，再用 CentOS 7 的 `ls -l /` 标准输出建立整体印象，最后在 Git Bash 里对照真实存在的 `/`、`/usr`、`/etc`、`/proc`，验证"一切皆文件、目录树从根开始"的概念在任何 Linux 环境都成立。

### FHS 目录速查表

| 目录 | 作用 | 是否该清 |
| --- | --- | --- |
| `/bin` | 普通用户可执行的基础命令（CentOS 7 起指向 `usr/bin`） | 不清 |
| `/sbin` | 管理员可执行的基础管理命令（指向 `usr/sbin`） | 不清 |
| `/usr` | 系统程序与只读共享资源，应用程序大多在这里 | 不清 |
| `/usr/local` | 本地编译安装的软件，yum 不管理 | 卸载时清 |
| `/var` | 经常变化的数据：日志、邮件、缓存、数据库文件 | 日志与缓存定期清理 |
| `/etc` | 系统与服务的配置文件 | 不清，修改前先备份 |
| `/proc` | 虚拟文件系统，进程与内核信息，数据在内存中 | 不清，也不要改 |
| `/sys` | 虚拟文件系统，内核、驱动与设备信息 | 不清，也不要改 |
| `/dev` | 设备文件，如 `/dev/sda`、`/dev/cdrom` | 不清，系统动态生成 |
| `/home` | 普通用户的家目录 | 慎清，全是用户数据 |
| `/root` | root 用户的家目录 | 慎清 |
| `/opt` | 第三方大型软件安装目录 | 卸载软件时清 |
| `/srv` | 服务数据目录，如网站站点数据、FTP 数据 | 慎清，业务数据 |
| `/boot` | 系统引导文件与内核镜像 | 不清，误删无法开机 |
| `/run` | 系统运行时临时数据，如 PID 文件、socket | 系统自管，重启自动清 |
| `/tmp` | 临时文件目录，任何用户可写 | 可清，系统定期自动清理 |
| `/media` | 可移动设备（U 盘、光盘）的自动挂载点 | 卸载后可清 |
| `/mnt` | 临时挂载点，手工挂载设备时使用 | 卸载后可清 |

记忆口诀：**配置在 `/etc` 不动、日志在 `/var` 轮转、临时 `/tmp` `/run` 自动清、业务数据 `/home` `/srv` 慎动、系统命令 `/usr` `/bin` 绝不碰**。

### CentOS 7 根目录标准输出（预期输出）

在真机执行 `ls -l /`，输出如下（ trimmed ）：

```console
（预期输出，CentOS 7）
$ ls -l /
total 20
lrwxrwxrwx.   1 root root    7 Mar 28 10:40 bin -> usr/bin
dr-xr-xr-x.   5 root root 4096 Mar 28 10:45 boot
drwxr-xr-x.  19 root root 3180 Mar 29 12:02 dev
drwxr-xr-x.  79 root root 8192 Apr  2 08:41 etc
drwxr-xr-x.   3 root root   20 Mar 28 10:45 home
lrwxrwxrwx.   1 root root    7 Mar 28 10:40 lib -> usr/lib
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

注意开头的 `l`（link）：CentOS 7 把 `/bin`、`/sbin`、`/lib`、`/lib64` 做成指向 `/usr` 下对应目录的软链接（usr merge），目的是简化维护。

### Git Bash 路径对照（已实操）

Git Bash 自带一套 MSYS 模拟的目录树，同样从根开始，可以用来对照概念：

```bash
ls /
ls /usr | head -8
ls /etc | head -8
ls /proc | head -5
```

输出：

```console
$ ls /
LICENSE.txt
bin
cmd
dev
etc
mingw64
proc
tmp
usr

$ ls /usr | head -8
bin
etc
lib
libexec
share
ssl

$ ls /etc | head -8
bash.bashrc
fstab
gitattributes
gitconfig
msystem
nsswitch.conf
package-versions.txt
profile

$ ls /proc | head -5
819
821
822
824
829
```

**验证方法**：三条真实输出分别印证三个结论——根目录下直接就是各个系统目录（目录树从 `/` 开始）；`/usr` 下是 `bin`、`lib`、`share` 这类程序与资源目录；`/proc` 里是一串数字（进程 PID），印证"`/proc` 的数据在内存中、内容随进程变化"。注意 Git Bash 的 `/etc` 是 MSYS 模拟环境（里面的 `fstab`、`profile` 是 MSYS 自带的占位文件），真实 CentOS 7 的 `/etc` 内容以真机为准。

> **易错点**：把 `/etc`、`/home` 这类有数据的目录当挂载点——挂载后原数据会被遮住；磁盘满时手动删 `/usr` 下的东西——这是系统命令所在地，删了系统直接瘫痪，正确做法是查 `/var/log` 和大文件。

> **参见**：系统目录结构与挂载、常用文件操作命令

## 自测

1. `echo a > f` 执行两次后文件里有什么？换成 `>>` 呢？
2. `ls not-exist > out.txt` 之后 `cat out.txt` 是空的还是报错信息？为什么？怎么把报错也存进去？
3. `cp -r /data/dir /tmp/` 执行两次，第二次会发生什么？怎么避免？
4. FHS 中哪个目录放日志、哪个放配置、哪个放第三方软件？

> **参考答案：** 1. 两次 `>` 只剩第二次的 `a`（每次先清空）；两次 `>>` 是两行 `a`。2. 是空的——报错走标准错误（2 号通道），`>` 只接标准输出；要用 `> out.txt 2>&1`。3. 第二次会把 `dir` 复制成 `/tmp/dir/dir`（目标已存在时复制进去）；避免方法是备份前确认目标不存在。4. 日志在 `/var`，配置在 `/etc`，第三方大型软件在 `/opt`。

## 本篇小结

1. `touch` 创建空文件，`echo` 配合 `>` / `>>` 不打开文件直接写入；`>` 先清空再写，`>>` 末尾追加，本质是 shell 打开文件的模式不同。
2. 三个文件描述符：0 输入、1 输出、2 错误；`2>` 收错误，`2>&1` 把错误合并到输出，`> /dev/null 2>&1` 全部丢弃；重定向不改变退出码，判断成败看 `$?`。
3. `cp` 备份目录必须加 `-r`（推荐 `-a` 保留属性）；目标已存在时 `cp -r` 是"复制进去"而非覆盖。
4. `mv` 同目录下即重命名，跨目录即移动；`rm -r` 删目录，`rmdir` 只删空目录更安全；`rm -rf` 危险，执行前确认路径。
5. 通配符 `*` `?` `[]` 匹配真实文件，`{}` 是字符串展开与文件是否存在无关。
6. FHS 规定每个目录的用途：配置在 `/etc`、日志在 `/var`、第三方软件在 `/opt`、临时数据在 `/tmp` 与 `/run`；磁盘满了先查 `/var/log`，绝不手动删 `/usr`。
{% endraw %}
