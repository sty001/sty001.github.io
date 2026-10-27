---
title: "02-常用文件操作命令"
date: 2026-10-24 10:40:00 +0800
categories: [软件, Linux, 02-系统操作]
tags: [Linux, 02-系统操作, Linux基础]
slug: "linux-system-02"
---

{% raw %}



文件操作是运维每天敲得最多的命令：`ls -l` 查属性、`touch` 建空文件、`vi` 编辑、`echo` 配合 `>` / `>>` 写入、`cat` 查内容、`cp` 备份、`rm` 删除、`mv` 移动重命名。每个命令下面都有实例，跟着敲。

## 原理解析：一条命令在 Linux 中是怎么被执行的
{: .sec-know}

理解命令的执行流程，很多"灵异现象"（比如命令明明存在却找不到、别名为什么不生效）都能解释清楚。

shell 处理一条命令的完整流程：

1. **读取输入**：shell（bash）等待用户输入，读取整行命令；
2. **解析与展开**：按顺序进行别名替换、花括号扩展、波浪号展开、变量替换、命令替换、通配符（glob）展开、重定向与管道的识别；
3. **判断命令类型**：先查内置命令（shell 自带的 `cd`、`echo` 等），再查外置命令；
4. **查找可执行文件**：外置命令按照 `PATH` 环境变量中目录的先后顺序，从左到右查找第一个匹配的可执行文件；
5. **fork + exec 执行**：shell 创建子进程，把命令加载进内存执行，等待其结束；
6. **返回退出码**：执行结果通过 `$?` 获取，`0` 表示成功，非 `0` 表示失败。

> **注意：** 第 2 步的顺序很关键：别名展开发生在通配符之前，所以 `ls` 被别名为 `ls --color=auto` 之后，再执行 `ls *.txt`，实际运行的是带颜色参数的 `ls`。这也是 `\cp`（反斜杠）能绕开别名、`/usr/bin/cp`（绝对路径）能绕开 PATH 顺序的原因。
{: .sec-pit}

## 查看文件信息

`ls` 查看文件是否存在，`ls -l` 查看文件的详细属性信息：

```bash
# 提示符 [root@主机名 当前目录]# 表示以 root 身份在该目录，命令执行后的下一行是输出
[root@linux-node1 test02]# ls /etc/services
/etc/services
[root@linux-node1 test02]# ls -l /etc/services
-rw-r--r--. 1 root root 670293 Jun  7  2013 /etc/services
```

`ls -l` 输出的每一列都有固定含义，这是后续学习权限与 inode 的基础：

| 输出片段 | 含义 |
| --- | --- |
| `-rw-r--r--` | 文件类型与权限（类型 + 属主权限 + 属组权限 + 其他人权限） |
| `1` | 硬链接数 |
| `root` | 属主（第一个）与属组（第二个） |
| `670293` | 文件大小，单位字节 |
| `Jun 7 2013` | 最后修改时间 |
| `.`（权限后的点） | 表示该文件带有 SELinux 安全上下文 |

### 拓展：`ls -l` 第一位认文件类型
{: .sec-ext}

那串权限的第一位是文件类型：`-` 普通文件、`d` 目录、`l` 软链接、`b` 块设备（磁盘）、`c` 字符设备（终端）、`s` 套接字、`p` 管道。`ls -l /dev/sda` 能看到 `b` 开头的设备文件——"一切皆文件"在这里具象化。

### `ls` 常用参数详解
{: .sec-expl}

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `-l` | 长格式显示，列出权限、属主、大小、时间等详细信息 | `ls -l /etc/hosts` |
| `-a` | 显示所有文件，包括以 `.` 开头的隐藏文件 | `ls -a /root` |
| `-h` | 配合 `-l` 使用，以人类可读方式显示大小（K / M / G） | `ls -lh /var/log` |
| `-d` | 只查看目录本身的信息，不列出目录内容 | `ls -d /data` |
| `-i` | 显示文件的 inode 号 | `ls -i /etc/hosts` |
| `-t` | 按修改时间排序，最新的在前 | `ls -lt` |
| `-r` | 逆序排列（配合 `-t` 即最旧的在前） | `ls -ltr` |
| `-S` | 按文件大小排序，大的在前 | `ls -lS` |
| `-R` | 递归列出子目录内容 | `ls -R /etc` |
| `--color=auto` | 按文件类型着色显示（CentOS 默认通过别名启用） | `ls --color=auto` |

`ls -R` 对大目录要慎用——全盘递归能把终端刷到卡死，配合 `head` 截断更安全。

> **注意：** 排查"谁改了配置"时，`ls -ltr` 是最常用组合：反向按时间排序，最新被改的文件排在最后一行，一眼就能看到。
{: .sec-pit}

## 创建空文件：`touch`

```bash
touch /data/test.txt
```

```bash
# touch 新建的空文件大小为 0，ls -l 才能看到属性
[root@linux-node1 test02]# ls /data/test.txt
/data/test.txt
[root@linux-node1 test02]# ls -l /data/test.txt
-rw-r--r--. 1 root root 0 Apr  1 09:57 /data/test.txt
```

> **原理：** `touch` 的本意是" touch 一下文件的三个时间戳"——文件不存在时就创建空文件；文件已存在时，默认把访问时间与修改时间更新为当前时刻。

批量建文件用花括号：`touch /data/{1..10}.txt` 一次建十个，配合 `mkdir -p`，搭实验环境两秒钟。

### `touch` 常用参数详解
{: .sec-expl}

| 参数 | 作用 |
| --- | --- |
| `-a` | 只修改访问时间（access time） |
| `-m` | 只修改修改时间（modification time） |
| `-d` | 按指定字符串设置时间，如 `-d "2026-10-24 10:00"` |
| `-t` | 按 `[[CC]YY]MMDDhhmm[.ss]` 格式设置时间 |
| `-r` | 把时间戳设置为与参考文件一致，如 `touch -r a.txt b.txt` |

### 拓展：文件的三种时间戳
{: .sec-ext}

`ls -l` 显示的只是 mtime（modify，内容修改时间）。完整的有三种：atime（access，读内容时更新）、mtime（写内容时更新）、ctime（change，inode 变化时更新——改权限、改属主、改内容都会变）。用 `stat 文件名` 一次看全。排错时的推论：文件内容没变不代表没被动过——只改了权限的话，mtime 不变、ctime 会变。

## 如何编辑文件

### 方式一：打开文件直接编辑（vi / vim）

`vi` / `vim` 是用于编辑文件的命令：

```bash
vi test.txt
```

| 步骤 | 操作 |
| --- | --- |
| 第一步：进入编辑状态（插入模式） | 按键盘上小写字母 `i` |
| 第二步：编写文件内容 | 正常输入内容 |
| 第三步：保存并关闭文档 | 按 `Esc`（退出编辑状态），然后输入 `:wq` |

末行模式的常用指令：

| 指令 | 含义 |
| --- | --- |
| `:wq` | **w**rite 保存 + **q**uit 退出 |
| `:q` | 不保存直接退出 |
| `:w` | 只保存但不退出 |

> **注意：** Vim 的完整三种模式与更多快捷键在《系统优化实践（上）》中有详细讲解，本篇先掌握"打开 → `i` 编辑 → `Esc` → `:wq`"的最小闭环即可。
{: .sec-pit}

### 方式二：不用打开文件，直接把信息写入

**第一步：让屏幕上有信息显示**

```bash
[root@linux-node1 data]# echo "hello world"
hello world
```

echo 的参数建议加引号：`echo hello world` 碰巧能输出，但遇到 `*`、`$`、`;` 这类对 shell 有特殊含义的字符，不加引号会被提前展开或拆词。`echo "hello world"` 才是稳妥写法。

**第二步：把屏幕上显示的信息放入文件中**

写多行内容还有更整洁的方式——here-document：`cat > file <<EOF` 回车后逐行输入，单独一行 `EOF` 结束，不用反复 echo 追加。

```bash
# echo 只是把文本打到屏幕，> 是重定向：先清空 test.txt 再写入
[root@linux-node1 data]# echo "hello world" >  test.txt
[root@linux-node1 data]# vi test.txt
hello world
```

追加内容：

```bash
# >> 是追加重定向：不清空原内容，在最后一行往后接着写
[root@linux-node1 data]# echo "hello linux 02" >>  test.txt
[root@linux-node1 data]# vi test.txt
hello world
hello linux 01
hello linux 02
```

两个重定向符号的区别：

| 符号 | 执行原理 |
| --- | --- |
| `>` | 将原有文件内容先进行清空，再添加新的信息（覆盖） |
| `>>` | 不会清空原文件内容，而是在原文件最后一行追加新的信息（追加） |

> **原理：** shell 在执行命令前先处理重定向——遇到 `>` 就以只写模式打开文件（长度截断为 0），遇到 `>>` 就以追加模式打开（文件指针移到末尾）。所以 `>` 清空内容不是"命令删的"，而是打开文件时系统完成的。

> **注意：** 生产上 `>` 覆盖是高频事故源——脚本里变量为空时，`echo $VAR > file` 会直接把配置文件清空。防御手段：重要文件改前先 `cp file file.bak`，或在脚本里 `set -o noclobber` 禁止 `>` 覆盖已存在的文件（确要覆盖时用 `>|`）。
{: .sec-pit}

## 查看文件内容：`cat`

```bash
# cat 一次性输出全文；/etc/hosts 是本机域名解析表，127.0.0.1 与 ::1 是环回地址
[root@linux-node1 data]# cat test.txt
hello world
hello linux 01
hello linux 02
[root@linux-node1 data]# cat /etc/hosts
127.0.0.1   localhost localhost.localdomain localhost4 localhost4.localdomain4
::1         localhost localhost.localdomain localhost6 localhost6.localdomain6
```

### `cat` 常用参数详解
{: .sec-expl}

| 参数 | 作用 |
| --- | --- |
| `-n` | 显示行号（所有行都编号） |
| `-b` | 显示行号，但空行不编号 |
| `-s` | 连续多个空行压缩成一个空行 |
| `-A` | 显示所有不可见字符：行尾显示 `$`，制表符显示 `^I` |
| `-E` | 在每行末尾显示 `$` |

看配置文件时 `cat -ns` 带行号又压掉连续空行，比裸 cat 清爽。head/tail 也吃管道：`命令 | tail -20` 只看输出末尾，配合 sort、uniq 做统计非常常用。

> **注意：** 排查"文件里到底有没有多余空格、Windows 换行符"时，`cat -A` 是利器：Windows 换行符（`\r\n`）会显示为 `^M$`，而行尾多余空格也一目了然。
{: .sec-pit}

### 按行查看：`head` 与 `tail`

```bash
head -5 /etc/profile       # 查看前面几行信息（默认查看前面 10 行内容）
tail -6 /etc/profile       # 查看倒数几行信息（默认查看倒数 10 行内容）
tail -f /var/log/secure    # 一直追踪查看文件内容的变化，查看日志常用
```

| 命令 | 参数 | 作用 |
| --- | --- | --- |
| `head` | `-n N` | 显示文件前 N 行 |
| `head` | `-c N` | 显示文件前 N 个字节 |
| `head` | `-q` | 不显示文件名标题（多文件时） |
| `tail` | `-n N` | 显示文件后 N 行 |
| `tail` | `-n +N` | 从第 N 行开始显示到末尾 |
| `tail` | `-f` | 持续跟踪文件新增内容（follow），看日志必用 |
| `tail` | `-F` | 跟踪文件并按文件名重试，文件被轮转后自动重新打开 |

> **注意：** `tail -f` 适合日志被追加写入的场景；如果日志会被 logrotate 轮转（改名），用 `tail -F` 才能继续跟踪新文件。退出跟踪按 `Ctrl + c`。
{: .sec-pit}

为什么 `tail -f` 能实时看到新内容？它不是反复重读文件，而是打开文件后持续从文件描述符里读新增字节。所以日志被轮转（原文件被改名）后，`-f` 盯着的其实还是被改名的那份——这就是 `-F` 存在的理由。

顺带一个统计工具 `wc`：`wc -l 文件` 数行数、`-w` 数单词、`-c` 数字节。管道里最常见的是 `命令 | wc -l`，数结果条数。

## 文件通配符（glob）

在命令中使用通配符，可以一次匹配一批文件，大幅减少重复输入。

| 通配符 | 含义 | 示例 | 匹配结果 |
| --- | --- | --- | --- |
| `*` | 匹配任意长度的任意字符（不匹配 `/`，也不匹配开头的 `.`） | `ls /data/*.txt` | 所有 .txt 文件 |
| `?` | 匹配任意单个字符 | `ls /data/test?.txt` | test1.txt、testA.txt 等 |
| `[abc]` | 匹配方括号中列出的任意一个字符 | `ls /data/test[123].txt` | test1.txt、test2.txt、test3.txt |
| `[a-z]` | 匹配指定范围内的单个字符 | `ls /data/test[a-c].txt` | testa.txt、testb.txt、testc.txt |
| `[!...]` | 取反，匹配不在列表中的单个字符 | `ls /data/test[!0-9].txt` | testa.txt 但不匹配 test1.txt |
| `{a,b}` | 花括号扩展，展开成多个以逗号分隔的词 | `touch /data/file{1,2,3}.txt` | 生成 file1.txt、file2.txt、file3.txt |

文件名带空格是通配符的另一坑：展开后按空格拆成多个"文件"，处理这类文件路径要整体加引号。

> **注意：** 花括号扩展与 `*`、`?` 有本质区别：`*`、`?`、`[]` 是"文件名匹配"——必须磁盘上真实存在对应文件才会展开；而 `{...}` 是 shell 的"字符串展开"，与文件是否存在无关。所以 `mkdir /data/{a,b,c}` 不需要任何前提，一定生成三个目录。实际敲一遍就明白：想把不存在的文件名批量传给别的命令（如 `cp a.txt /tmp/xx{1,2}.txt`），只有 `{}` 做得到。
{: .sec-pit}

> **补充：** `*` 不匹配开头的 `.` 是刻意设计——`.` 和 `..` 是每个目录都有的特殊条目，一旦被通配符扫到，`rm *` 的后果不堪设想。想列出隐藏文件得显式用 `ls -a` 或 `.*`。

### 辨析：通配符与正则表达式

新手最容易混的一对。通配符（glob）由 shell 处理，用于匹配文件名，`*` 表示"任意长度任意字符"，如 `ls *.txt`；正则表达式由 grep / sed / awk 等工具处理，用于匹配文本内容，`*` 的含义完全不同（前一个字符重复 0 到多次），`a*` 匹配的是"零个或多个 a"。同一个符号两套语义，切换场景前先想清楚：当前这行命令，是谁在解析。

## 相对路径与绝对路径

| 路径类型 | 定义 | 优点 | 缺点 |
| --- | --- | --- | --- |
| 绝对路径 | 从根开始进行查找数据 | 准确性高 | 寻找数据更慢（写得长） |
| 相对路径 | 从当前路径位置查找数据 | 寻找数据更快（写得短） | 准确性低 |

常用路径符号速查：

| 符号 | 含义 | 示例 |
| --- | --- | --- |
| `/` | 根目录，一切路径的起点 | `cd /etc` |
| `.` | 当前目录 | `cat ./test.txt` |
| `..` | 上一级目录 | `cd ..` |
| `~` | 当前用户的家目录 | `cd ~`、`ls ~/.bashrc` |
| `~用户名` | 指定用户的家目录 | `cd ~testuser` |
| `-` | 上一次所在目录（配合 `cd` 使用） | `cd -` |

> **注意：** 写脚本、配置定时任务、写 systemd 单元文件时，一律使用绝对路径——因为脚本的执行环境无法保证当前目录是什么，相对路径极有可能找错文件。这是运维规范中的硬性要求。脚本里 `cd` 过再操作还有个连带坑：cd 失败后脚本继续往下跑，文件全写进错误目录。规范写法是 `cd 目标路径 || exit 1`，失败即退出。
{: .sec-pit}

## 复制保存数据：`cp`（copy）

**用法**：`cp 要复制的数据信息（文件/目录） 复制到什么位置（目录中）`

### 文件备份方法

```bash
# cp 复制文件；复制后两份文件各有独立 inode，修改互不影响
[root@linux-node1 data]# cp /data/test.txt /tmp
[root@linux-node1 data]# ls -l /tmp/test.txt
-rw-r--r--. 1 root root 50 Apr  1 10:36 /tmp/test.txt
[root@linux-node1 data]# ls -l test.txt
-rw-r--r--. 1 root root 50 Apr  1 10:24 /data/test.txt
```

备份文件最朴素的形态就是 `cp file file.bak`——改配置前敲这一条，应该是运维的肌肉记忆。

### 目录备份方法

```bash
# 复制目录必须加 -r；ls -d 只看目录本身，不展开里面的内容
[root@linux-node1 data]# cp -r /data/test01/ /tmp
[root@linux-node1 data]# ls /tmp/test01
test02
[root@linux-node1 data]# ls -d /tmp/test01
/tmp/test01
[root@linux-node1 data]# ls -d /tmp/test01/test02
/tmp/test01/test02
[root@linux-node1 data]# ls -d /tmp/test01/test02/test03
/tmp/test01/test02/test03
```

> **注意：** 备份目录必须加 `-r` 参数，否则会跳过目录。另外目录备份时如果目标位置已有同名文件，会逐个询问是否覆盖：
{: .sec-pit}

```bash
# 目标已有同名文件时逐个询问，输入 y 覆盖；想跳过提示用 \cp 绕过别名
[root@linux-node1 test01]# cp -r /data/test01/ /tmp/
cp: overwrite '/tmp/test01/test.txt'? y
cp: overwrite '/tmp/test01/test01.txt'? y
cp: overwrite '/tmp/test01/test02.txt'? y
cp: overwrite '/tmp/test01/test03.txt'? y
```

> **注意：** 出现覆盖提示的原因是系统默认给 `cp` 设置了别名 `cp='cp -i'`。在命令前加反斜杠 `\cp` 可以绕过别名，强行覆盖，不弹出确认：
{: .sec-pit}

```bash
[root@linux-node1 test01]# \cp -r /data/test01/ /tmp/
```

### `cp` 常用参数详解
{: .sec-expl}

| 参数 | 作用 |
| --- | --- |
| `-r` / `-R` | 递归复制目录及其内容 |
| `-p` | 保留权限、属主、时间戳等属性 |
| `-a` | 归档模式，等价于 `-d -p -r`，备份整棵目录树首选 |
| `-i` | 覆盖前询问确认（CentOS 默认通过别名启用） |
| `-f` | 强制覆盖，不询问 |
| `-v` | 显示复制过程 |
| `-u` | 仅当源文件比目标新（或目标不存在）时才复制 |

> **注意：** 备份配置目录时推荐 `cp -a`：它连权限、属主、时间戳一起保留，还原后与原环境完全一致。脚本中批量复制用 `\cp -rf` 避免交互卡住。增量备份再往前一步是 rsync——`cp -u` 只比较时间戳，rsync 还比对大小与校验和，且支持断点续传和远程传输。
{: .sec-pit}

### 辨析：cp 与 mv 的底层差异
{: .sec-know}

`cp` 是真刀真枪搬数据：读源文件、分配新 inode、写目标数据块，大文件复制耗时与体积成正比；`mv` 在同一文件系统内只改目录映射，不动数据。备份用 `cp`（两份都在），腾挪用 `mv`（只剩一份）。二者还有个行为差异要记牢：`cp` 之后源文件还在，`mv` 之后源文件没了——脚本里用错，就是数据"消失"事故的常见来源。

## 删除数据命令：`rm`（remove，慎用）
{: .sec-warn}

**用法**：`rm 要删除的数据信息`

删除前先 `ls` 一遍目标路径，确认是它再删——多花两秒，省掉一整天。

### 删除文件

```bash
# 默认别名 rm='rm -i'，删除前会询问确认；^C 表示按 Ctrl + C 中断
[root@linux-node1 test01]# rm /tmp/test.txt
rm: remove regular file '/tmp/test.txt'? ^C      # 输入 n 或 Ctrl + C 取消
[root@linux-node1 test01]# \rm /tmp/test.txt     # 加反斜杠绕过别名，不提示
[root@linux-node1 test01]# ls -l /tmp/test.txt
ls: cannot access /tmp/test.txt: No such file or directory

# 重新建一个空文件再试，注意空文件同样会触发确认提示
[root@linux-node1 test01]# touch /tmp/test.txt
[root@linux-node1 test01]# ls -l /tmp/test.txt
-rw-r--r--. 1 root root 0 Apr  1 11:09 /tmp/test.txt
[root@linux-node1 test01]# rm /tmp/test.txt
rm: remove regular empty file '/tmp/test.txt'? ^C
[root@linux-node1 test01]# rm -f /tmp/test.txt  # -f 强制删除，不提示
[root@linux-node1 test01]# ls -l /tmp/test.txt
ls: cannot access /tmp/test.txt: No such file or directory
```

### 删除目录

```bash
# rm 不带 -r 不删目录；-f 只能压制确认，对目录无效
[root@linux-node1 test01]# rm /tmp/test01/
rm: cannot remove '/tmp/test01/': Is a directory
[root@linux-node1 test01]# rm -f /tmp/test01/
rm: cannot remove '/tmp/test01/': Is a directory
[root@linux-node1 test01]# rm -r /tmp/test01/
rm: descend into directory '/tmp/test01/'? ^C
[root@linux-node1 test01]# rm -rf /tmp/test01/   # -r 递归 + -f 强制，不提示
[root@linux-node1 test01]# ls -d /tmp/test01
ls: cannot access /tmp/test01: No such file or directory
```

| 参数 | 作用 |
| --- | --- |
| `-f` | force，强制删除，不弹出确认 |
| `-r` | recursive，递归删除目录及其中的内容 |
| `-v` | verbose，显示删除了哪些文件 |
| `--preserve-root` | 保护根目录不被递归删除（默认开启） |

> **注意：** 运维人员两大经典错误：一是**删根目录**，二是**删库跑路**。执行 `rm -rf` 前务必确认路径，确认再确认。生产规范中 `rm -rf` 应搭配 `find` 的 `-delete` 或回收站机制使用，且禁止在变量可能为空的脚本里写 `rm -rf $VAR/`。
{: .sec-pit}

> **注意：** 把 `rm` 别名成 `echo`（见系统优化篇）在生产上确有防护作用，但要说清它的边界：只防得住交互会话里的手滑，防不住脚本里的 `rm -rf` 和 `/usr/bin/rm` 绝对路径调用。真正的防线是权限最小化加备份。
{: .sec-pit}

## 移动数据信息：`mv`（move，剪切）

`mv` 命令的用法和 `cp` 命令类似。

### 移动剪切文件数据

```bash
# mv 移动后源文件就没了，ls 报 No such file 属正常
[root@linux-node1 ~]# mv /data/test.txt /tmp/
[root@linux-node1 ~]# ls -l /tmp/test.txt
-rw-r--r--. 1 root root 50 Apr  1 10:24 /tmp/test.txt
[root@linux-node1 ~]# ls -l /data/test.txt
ls: cannot access /data/test.txt: No such file or directory
```

### 移动剪切目录数据

```bash
# 目录同理，mv 走的是改名，源目录随即消失
[root@linux-node1 ~]# mv /data/test01/ /tmp
[root@linux-node1 ~]# ls -d /tmp/test01
/tmp/test01
[root@linux-node1 ~]# ls -ld /tmp/test01
drwxr-xr-x. 3 root root 100 Apr  1 11:00 /tmp/test01
[root@linux-node1 ~]# ls -ld /data/test01
ls: cannot access /data/test01: No such file or directory
```

### 用 `mv` 实现重命名

```bash
# 同一目录下 mv 等于改名，只是换了个文件名
[root@linux-node1 ~]# cd /data
[root@linux-node1 data]# ls
[root@linux-node1 data]# touch test.txt
[root@linux-node1 data]# ls
test.txt
[root@linux-node1 data]# echo "hello linux" > test.txt
[root@linux-node1 data]# cat test.txt
hello linux
[root@linux-node1 data]# mv test.txt new.txt
[root@linux-node1 data]# ls
new.txt
[root@linux-node1 data]# cat new.txt
hello linux
```

> **注意：** 移动数据时，如果目标位置出现同名文件，同样会提示是否覆盖，提示长这样：
{: .sec-pit}

```bash
# 目标存在同名文件时同样会询问确认
[root@linux-node1 data]# ls -l /tmp/test.txt
-rw-r--r--. 1 root root 50 Apr  1 10:24 /tmp/test.txt
[root@linux-node1 data]# touch test.txt
[root@linux-node1 data]# mv test.txt /tmp/
mv: overwrite '/tmp/test.txt'?
```

重命名要留神：`mv test.txt new.txt` 在 new.txt 已存在时会覆盖它，给重要文件改名前先确认目标名没被占用。

### `mv` 常用参数详解
{: .sec-expl}

| 参数 | 作用 |
| --- | --- |
| `-i` | 覆盖前询问确认（CentOS 默认通过别名启用） |
| `-f` | 强制覆盖，不询问 |
| `-n` | 不覆盖已存在的文件 |
| `-v` | 显示移动过程 |
| `-t` | 指定目标目录，源文件写在前面，如 `mv -t /tmp a.txt b.txt` |

> **原理：** 同一文件系统内，`mv` 只是修改目录数据块中的"文件名 → inode"映射，瞬间完成且不搬动数据；跨文件系统时（如从 `/boot` 移到 `/data`），`mv` 等价于"复制 + 删除"，耗时与数据量成正比。所以大文件"移动"突然变慢，先确认是不是跨了文件系统。

## 删除空目录：`rmdir` 与浏览目录：`tree`

### `rmdir`：只能删除空目录

```bash
mkdir /data/test-empty
rmdir /data/test-empty          # 删除成功，因为目录是空的
rmdir /data/test01              # 失败，因为目录里还有文件
```

| 参数 | 作用 |
| --- | --- |
| `-p` | 递归删除多级空目录，如 `rmdir -p /a/b/c` 在三级都为空时一并删除 |
| `-v` | 显示删除过程 |

> **注意：** `rmdir` 只能删空目录，好处是"安全"——它永远不会误删你的数据。删非空目录用 `rm -r`，但务必先确认路径，新手容易栽在多敲或漏敲一级目录上。
{: .sec-pit}

### `tree`：树形浏览目录

```bash
# tree 不是 CentOS 7 默认安装的软件，用前先 yum install -y tree
tree /data                 # 树形展示目录结构
tree -L 2 /data            # 只看两层
tree -d /data              # 只显示目录，不显示文件
tree -f /data              # 显示完整路径
tree -h /data              # 显示文件大小
tree -a /data              # 包含隐藏文件
```

| 参数 | 作用 |
| --- | --- |
| `-L N` | 限制递归层级为 N 层 |
| `-d` | 只显示目录 |
| `-f` | 每个文件显示完整路径 |
| `-a` | 显示隐藏文件 |
| `-h` | 人类可读方式显示大小 |
| `-p` | 显示权限位 |

> **注意：** `tree` 不属于 CentOS 7 默认安装的软件，使用前需 `yum install -y tree`。
{: .sec-pit}

## 原理解析：硬链接与软链接（inode 视角）
{: .sec-know}

Linux 文件系统里，**文件名和文件数据是分开存储的**：

1. 磁盘上有一块区域存放 inode（索引节点），每个 inode 记录文件的权限、属主、大小、时间戳、数据块位置；
2. inode 中**不存文件名**；
3. 目录的数据块里存的是"文件名 → inode 号"的映射表；
4. 用户访问 `/data/test.txt` 时，系统先在目录数据块里查到 `test.txt` 对应的 inode 号，再通过 inode 找到数据块。

硬链接和软链接，就是在这套结构上做文章的两种手段。

### 硬链接（hard link）

```bash
ln /data/test.txt /data/test-hard.txt      # 创建硬链接
ls -li /data/test.txt /data/test-hard.txt  # 对比 inode 号与链接数
```

- 本质：说白了就是给同一份数据再起一个名字——在目录数据块里**新增一条"文件名 → 同一个 inode 号"的映射**；
- 硬链接不占用新的 inode 和新的数据块，只是文件的引用计数 +1；
- 删除其中任意一个文件名，只是引用计数 −1，只要还有一个名字指向该 inode，数据就安然无恙；
- **限制**：不能跨文件系统（inode 号只在同一文件系统内有意义）；不能对目录创建硬链接（会造成目录环，系统禁止）。

### 软链接（soft link / symbolic link）

```bash
ln -s /data/test.txt /data/test-soft.txt   # 创建软链接（-s 必须加）
ls -l /data/test-soft.txt                  # l 开头，即 link 类型
```

- 本质：创建一个**新的 inode**，这个 inode 里存的内容是"目标文件的路径字符串"；
- 访问软链接时，系统读取其中保存的路径，再跳转到目标文件；
- **可以跨文件系统**（因为它存的只是路径），**可以指向目录**；
- 目标文件被删除后，软链接成为"悬空链接"，访问报错；
- 软链接指向相对路径时，相对于软链接所在目录解析，容易出错，**推荐使用绝对路径**。

两者的经典分工：软链接做版本切换——`/usr/local/python -> python3.11`，升级时把指向改到新目录，全系统跟着切；硬链接做防误删与多路径共享同一份数据。单个改名用 `mv`，批量改名交给 `rename` 或 `find` 组合，不用一条条敲。

### 对比表

| 对比项 | 硬链接 | 软链接 |
| --- | --- | --- |
| inode | 与源文件共用同一个 | 独立的新 inode |
| 文件类型显示 | `-`（普通文件） | `l`（link） |
| 跨文件系统 | 不可以 | 可以 |
| 链接目录 | 不可以 | 可以 |
| 删除源文件后 | 数据仍在（引用计数未归零） | 链接失效（悬空） |
| 创建命令 | `ln 源 目标` | `ln -s 源 目标` |
| 占用空间 | 几乎不占（仅目录里一条记录） | 占用一个 inode 存路径字符串 |
| 查看手段 | `ls -i` 看 inode 号是否相同 | `ls -l` 看 `->` 指向 |

> **注意：** 判断两个硬链接是否指向同一份数据，看 `ls -li` 输出的 inode 号是否相同即可；这是排查"磁盘被神秘占满"时的常用手段——大量硬链接会让 `du` 统计与实际占用不符。
{: .sec-pit}

> **补充：** inode 是有限资源，`df -i` 能看每个文件系统的 inode 总量与使用量。海量小文件（缓存目录、邮件目录）会把 inode 耗光，此时 `df -h` 明明还有空间，任何写入都报 `No space left on device`——经典故障，先查 `df -i` 再下结论。

## 知识卡片：文件操作命令速查
{: .sec-know}

| 命令 | 最高频用法 | 说明 |
| --- | --- | --- |
| `ls -l` | `ls -ltr` | 长格式 + 反向时间排序，看最近改了什么 |
| `touch` | `touch a.txt` | 创建空文件 / 更新时间戳 |
| `cat` | `cat -n f` | 看小文件全文，`-n` 带行号 |
| `head -n 20` | `head -20 f` | 看前 20 行 |
| `tail -f` | `tail -f /var/log/secure` | 实时跟踪日志 |
| `cp -a` | `cp -a /etc/nginx /backup/` | 归档式复制目录 |
| `rm -rf` | `rm -rf /tmp/test01` | 递归强制删除（危险，先确认路径） |
| `mv` | `mv a.txt /tmp/` | 移动 / 重命名 |
| `mkdir -p` | `mkdir -p /a/b/c` | 创建多级目录 |
| `rmdir` | `rmdir emptydir` | 只删空目录，安全 |
| `ln -s` | `ln -s /data /link` | 软链接，可跨文件系统 |
| `ln` | `ln a.txt b.txt` | 硬链接，同 inode |

## 常见错误与排错
{: .sec-ts}

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `cat: file: No such file or directory` | 路径写错或当前目录不对 | `pwd` + `ls` 确认 | 改用绝对路径 |
| `cp: omitting directory` | 复制目录忘加 `-r` | 检查命令 | 加 `-r` 或用 `cp -a` |
| 脚本里 `cp` / `rm` 卡住不动 | 别名 `-i` 在等待交互确认 | `type cp` 看别名定义 | 用 `\cp`、`cp -f` 或在脚本中 `unalias -a` |
| `rm -rf` 提示 permission denied | 父目录没有写权限 | `ls -ld 父目录` | 先给父目录加写权限，或 `chattr -i` 解除 immutable |
| `ls` 通配符没匹配到文件却报错 | `*` 只匹配已存在的文件 | `ls /data/*.txt` 看输出 | 确认文件存在；用 `{}` 展开可绕过 |
| 软链接打开报 `Too many levels of symbolic links` | 软链形成了环（如 `a -> b`、`b -> a`） | `ls -l` 看指向 | 删除环上的某个链接 |
| 移动大文件突然变慢 | 跨文件系统，退化为复制 + 删除 | `df -h` 对比源与目标 | 预期内行为，或先压缩再传 |

## 现代环境补充
{: .sec-ext}

| 旧做法 | 现代做法 | 说明 |
| --- | --- | --- |
| `cat` 看大文件 | `less` / `more` 分页查看 | cat 一次刷屏，less 可上下翻页、搜索 |
| `tail -f` 日志 | `tail -F` 或 `journalctl -f` | `-F` 能跟踪轮转后的新文件；`journalctl` 是 systemd 时代的日志入口 |
| `tree` 未安装 | `yum install -y tree` | 不属于默认安装集 |
| `netstat` 系列 | `ss` / `ip` | net-tools 已废弃 |
| 别名临时定义 | 写入 `~/.bashrc` | 重启终端后依然生效 |

> **注意：** CentOS 7 已于 2024 年 6 月停止维护，Rocky Linux、AlmaLinux 等后继发行版上本篇所有命令与行为完全一致。若系统使用 journald 管理日志，`tail -f /var/log/messages` 的替代方案是 `journalctl -f`，并可按服务过滤：`journalctl -u nginx -f`。
{: .sec-pit}

## 课后练习
{: .sec-prac}

1. 总结已学命令及参数用法。
2. 预习系统目录结构。

## 小结
{: .sec-sum}

1. `touch` 创建空文件，`ls -l` 查看文件详细属性，`cat` 查看文件内容。
2. 编辑文件有两种方式：`vi` 打开后按 `i` 进入插入模式、`:wq` 保存退出；或用 `echo` 配合重定向不打开直接写入。
3. 重定向符号 `>` 会先清空原文件再写入，`>>` 则在文件末尾追加；本质是 shell 打开文件时的模式不同。
4. `cp` 备份文件直接写路径，备份目录必须加 `-r`；`cp -a` 归档复制保留全部属性；遇到覆盖确认可用 `\cp` 绕过别名。
5. `rm` 删除需谨慎：`-f` 强制、`-r` 递归，`rm -rf` 高效但危险，删根目录和删库是运维两大事故。
6. `mv` 既可移动数据（文件或目录），也可用于同目录下重命名；目标存在同名文件时同样会提示覆盖。
7. 通配符 `*` `?` `[]` 匹配真实文件，`{}` 是 shell 字符串展开；硬链接共用 inode 不能跨文件系统，软链接存路径可以跨文件系统但会因目标删除而失效。
8. 写脚本一律用绝对路径；看最近改动用 `ls -ltr`；跟日志用 `tail -f`。

## 自测题
{: .sec-prac}

1. `>` 和 `>>` 的区别是什么？为什么 `echo a > f && echo b > f` 执行后文件里只有 `b`？
2. 硬链接和软链接在 inode 层面有什么区别？为什么硬链接不能跨文件系统？
3. 执行 `cp -r /data/test01/ /tmp/` 时弹出 `overwrite` 提示，系统层面是什么原因？三种绕过方式是什么？
4. `ls *.txt` 和 `ls test?.txt` 分别匹配什么样的文件？`{1,2}.txt` 与 `[12].txt` 效果相同吗？
5. 一条命令从输入到执行，shell 依次做了哪些事？为什么命令明明在 `/data` 里却执行不了？

> **答案：**
> 1. `>` 先清空再写入，`>>` 在末尾追加。第一次 `echo a > f` 写入 a，第二次 `echo b > f` 又把文件截断为 0 再写入 b，所以只剩 b。
> 2. 硬链接与源文件共用同一个 inode，只是目录里多一条文件名映射；软链接是独立 inode，内容为目标路径。inode 号只在同一文件系统内有效，所以硬链接不能跨文件系统。
> 3. 原因是系统给 `cp` 设置了别名 `cp='cp -i'`，`-i` 会在覆盖前询问。绕过方式：`\cp -r ...`、`cp -rf ...`、先 `unalias cp` 或直接用 `/bin/cp`。
> 4. `*.txt` 匹配所有以 .txt 结尾的文件；`test?.txt` 匹配 test 加任意单个字符再加 .txt 的文件。`{1,2}.txt` 展开为 `1.txt 2.txt` 两个词（与文件是否存在无关）；`[12].txt` 匹配已存在的 1.txt 或 2.txt 单个文件，二者效果不同。
> 5. 流程：读取输入 → 别名 / 花括号 / 变量 / 通配符等展开 → 判断内置还是外置 → 外置命令按 PATH 从左到右查找可执行文件 → fork + exec 执行 → 返回退出码。命令在 `/data` 里执行不了，是因为 `/data` 不在 PATH 中，需用绝对路径或把 `/data` 加入 PATH。

## 相关阅读

- [文件属性与 inode](/posts/linux-fileattr-03/)

- [系统目录结构与挂载](/posts/linux-system-03/)

- [sed 命令详解](/posts/linux-textproc-01/)

- [awk 命令详解](/posts/linux-textproc-02/)

- [附录-命令速查表](/posts/linux-appendix-01/)



{% endraw %}
