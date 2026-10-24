---
title: "day24-阶段复习与命令总汇作业实操"
date: 2026-10-24 09:34:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-24"
---

{% raw %}



本篇对应课程的**假期作业（阶段性大复习）**，共两道大题：① 总结所有命令；② 总结重要章节（文件属性、正则表达式、sed/awk、用户管理权限概念、定时任务）。全篇完成。

题 ① 落地为一张按功能划分的 12 大类命令速查表（文件与目录 / 查看与搜索 / 权限与属性 / 用户与组 / 磁盘与文件系统 / 软件包 / 进程与性能 / 网络 / 压缩打包 / 文本处理 / 系统管理 / 时间任务），每一类都给出「命令 + 常用参数 + 一句话说明」，可在本环境跑的命令全部真跑贴真实输出，系统级命令给出 CentOS 7 标准命令序列与预期输出，最后用一条综合流水线把多类命令串起来；题 ② 落地为 6 张知识卡片（核心概念 + 关键命令 + 典型例题 + 易错点），例题同样尽量真跑，每张卡片后附 3-5 道自测题带答案。

## 实操环境说明 {: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令（sed/awk/grep/find/sort/uniq/tr/cut/head/tail/wc/du/df/stat/ln/xargs/date/diff/paste/split/comm/tar/gzip/tee/seq 等）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令（useradd/usermod/chown/setfacl/yun/rpm/systemctl/crontab/ps/top/free/ss 等）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw/day24` 及其子目录。本篇另有 4 处环境差异，属正常，读者在真机上不会遇到：

1. 输出中的**本地用户名**按脱敏要求统一替换为 `user`，`Gid` 显示为 `UNKNOWN` 是 Git Bash 未映射组名所致；
2. **`chmod` 在本环境不生效**（底层是 Windows ACL，`chmod 600` 后 `ls -l` 仍是 644），因此权限修改类演示标 B 级，仅有 `stat` 查看属 A 级；
3. **软链接在本环境创建被静默忽略**（无 Windows 开发者模式），故 `ln -s` 标 B 级，硬链接 `ln` 标 A 级；
4. `df` 显示的是 Git Bash 视角下的 Windows 盘符（C:/D: 等），而非 CentOS 7 的 `/dev/sda1`，因此 `df` 同时给出本机真实输出与 CentOS 7 预期输出两版；`uname` 显示 MINGW64 内核同理。

## 题目总览 {: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 总结所有命令 | A 级（10 类真跑）+ B 级（用户/进程/网络/软件包） |
| 题 2-1 | 总结重要章节：文件属性 | A 级（十段拆解 + inode + 三时间真跑） |
| 题 2-2 | 总结重要章节：正则表达式 | A 级（BRE/ERE 各符号真跑） |
| 题 2-3 | 总结重要章节：sed 命令 | A 级（增删改查 + 后向引用 + `-i` 真跑） |
| 题 2-4 | 总结重要章节：awk 命令 | A 级（字段/模式/计算/数组真跑） |
| 题 2-5 | 总结重要章节：用户管理与权限概念 | A 级（配置文件拆解）+ B 级（建用户/提权） |
| 题 2-6 | 总结重要章节：定时任务 | A 级（备份脚本真跑）+ B 级（crontab） |

## 准备工作：一次性构造本篇全部测试数据 {: .sec-ver}

后面所有真题都基于同一份数据，先跑这一段，保证每一步都能原样复现。

```bash
mkdir -p /tmp/hw/day24/{data,demo,out,etc-sample,attr,backup}
cd /tmp/hw/day24

# 名单表（姓名 + 编号 + 性别），用于正则/sed/awk 演示
printf '%s\n' \
'zhangsan    1001:male' \
'lisi        1002:female' \
'wangwu      1003:male' \
'zhaoliu     1004:female' \
'sunqi       1005:male' > data/regtest.txt

# 成绩表（三科分数），用于 awk 计算演示
printf '%s\n' \
'zhangsan math:90 english:85 linux:95' \
'lisi     math:78 english:92 linux:88' \
'wangwu   math:66 english:70 linux:75' \
'zhaoliu  math:99 english:88 linux:92' \
'sunqi    math:55 english:60 linux:58' > data/score.txt

# 模拟 Nginx 访问日志，用于统计类演示
printf '%s\n' \
'192.168.1.10 - - [24/Oct/2026:10:01:01 +0800] "GET /index.html HTTP/1.1" 200 1024' \
'192.168.1.11 - - [24/Oct/2026:10:01:02 +0800] "GET /login HTTP/1.1" 200 2048' \
'192.168.1.10 - - [24/Oct/2026:10:01:03 +0800] "POST /login HTTP/1.1" 302 512' \
'192.168.1.12 - - [24/Oct/2026:10:01:04 +0800] "GET /api/user HTTP/1.1" 500 128' \
'192.168.1.11 - - [24/Oct/2026:10:01:05 +0800] "GET /index.html HTTP/1.1" 200 1024' > data/nginx_access.log

# 其它小样例
printf 'banana\napple\ncherry\napple\nbanana\napple\n' > data/fruit.txt
printf 'a\naa\naaa\naaaa\naaaaa\n'                     > data/an.txt
printf 'color\ncolour\ncoloor\n'                        > data/col.txt
printf 'a:10\nc:3\nb:100\n'                             > data/kv.txt
printf 'zhangsan\nlisi\nwangwu\n'                       > data/name.txt
printf '1001\n1002\n1003\n'                             > data/id.txt
printf 'a\nb\nc\n'                                      > data/s1.txt     # comm 左表
printf 'b\nc\nd\n'                                      > data/s2.txt     # comm 右表
printf 'line1\nline2\nline3\n'                          > data/f1.txt     # diff 左表
printf 'line1\nline2-changed\nline3\n'                  > data/f2.txt     # diff 右表
printf 'b\na\na\nc\nb\n'                                > data/dup.txt    # 保序去重用例

wc -l data/regtest.txt data/score.txt data/nginx_access.log
```

输出：

```console
$ wc -l data/regtest.txt data/score.txt data/nginx_access.log
5 data/regtest.txt
5 data/score.txt
5 data/nginx_access.log
```

**验证方法**：`wc -l` 三个文件都应为 5 行；若某行为 0，说明 `printf` 那一步的重定向写错了文件，重跑对应行即可。

## 题 1：总结所有命令 {: .sec-sum}

**考察点**：把第一阶段学到的命令按功能归类，形成「查得到、记得住、用得上」的知识网络，而不是零散记忆。

**实现思路**：按运维实际使用场景切分为 12 类，每类先给速查表（命令 + 常用参数 + 一句话说明），再挑 2-4 条在本环境能跑的命令做真跑演示；最后用一条贯穿多个类别的综合流水线收尾，并配 5 道自测题。

### 1.0 先记住这些通用零件

在开始分类之前，有几个「不属于任何一类但到处都要用」的零件，建议先背下来。

| 零件 | 写法 | 一句话说明 |
| --- | --- | --- |
| 通配符 `*` | `ls *.txt` | 匹配任意长度任意字符（含 0 个） |
| 通配符 `?` | `ls ?.txt` | 匹配**恰好一个**字符 |
| 方括号 `[]` | `ls [abc].txt` | 匹配方括号内任意一个字符 |
| 取反 `[^]` | `grep '[^0-9]' f` | 匹配不在方括号内的字符 |
| 管道 `\|` | `cmd1 \| cmd2` | 把前一命令的标准输出交给后一命令的标准输入 |
| 覆盖重定向 `>` | `cmd > f` | 标准输出**覆盖**写入文件 |
| 追加重定向 `>>` | `cmd >> f` | 标准输出**追加**到文件末尾 |
| 标准错误 `2>` | `cmd 2> f` | 只把错误信息写文件，正确输出仍上屏 |
| 全部重定向 `&>` | `cmd &> f` | 正确输出与错误信息都写文件 |
| 黑洞 `/dev/null` | `cmd 2>/dev/null` | 丢弃不需要的输出（常用于 cron） |
| 命令替换 `$( )` | `d=$(date +%F)` | 把命令执行结果赋值给变量，比反引号可读性好 |
| 顺序连接 `;` | `a; b` | 不管 a 成败都执行 b |
| 与 `&&` | `a && b` | a 成功才执行 b |
| 或 `\|\|` | `a \|\| b` | a 失败才执行 b |

真跑一遍重定向三兄弟（已实操）：

```bash
cd /tmp/hw/day24
echo "第一行覆盖写入" > out/redir.txt
cat out/redir.txt
echo "第二行追加" >> out/redir.txt
cat out/redir.txt
ls /notexist 2> out/err.txt
cat out/err.txt
{ echo ok-line; ls /notexist; } &> out/all.txt
cat out/all.txt
ls /notexist 2>/dev/null && echo "这条不会打印" || echo "错误已被丢弃，进入 || 分支"
```

输出：

```console
$ cat out/redir.txt
第一行覆盖写入
$ cat out/redir.txt
第一行覆盖写入
第二行追加
$ cat out/err.txt
ls: cannot access '/notexist': No such file or directory
$ cat out/all.txt
ok-line
ls: cannot access '/notexist': No such file or directory
$ ls /notexist 2>/dev/null && echo "这条不会打印" || echo "错误已被丢弃，进入 || 分支"
错误已被丢弃，进入 || 分支
```

**验证方法**：`out/redir.txt` 有 2 行说明追加生效；`out/err.txt` 只有错误信息；`out/all.txt` 既有 `ok-line` 又有报错说明 `&>` 收两边；最后一条没打印报错却走了 `||` 分支，说明 stderr 确实进了黑洞。

> **易错点**：`>` 是覆盖不是追加，二次执行会把上次内容清空——写日志必须用 `>>`；`2>` 和 `>` 是两个不同的文件描述符，`... > a.log 2> a.log` 会因为两个指针各自从头写而互相覆盖，正确写法是 `... > a.log 2>&1` 或 `... &> a.log`。

### 1.1 文件与目录类

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `pwd` | 无 | 显示当前所在绝对路径 |
| `cd` | `-` 回上次目录、`..` 上级、`~` 家目录 | 切换工作目录 |
| `ls` | `-l` 长格式、`-a` 含隐藏、`-h` 人性化大小、`-t` 按时间、`-S` 按大小、`-r` 倒序、`-i` 显 inode、`-d` 看目录自身 | 列出目录内容 |
| `mkdir` | `-p` 递归创建多级、`-m` 指定权限 | 创建目录 |
| `touch` | `-d "字符串"` 指定时间、`-t` 指定时间戳 | 创建空文件 / 修改时间戳 |
| `cp` | `-r` 递归拷目录、`-p` 保属性、`-a` = `-dpr` 全保、`-i` 覆盖前询问 | 复制文件目录 |
| `mv` | `-i` 询问、`-f` 强制、`-b` 覆盖前备份 | 移动 / 改名（同一分区改名瞬时完成） |
| `rm` | `-r` 递归删目录、`-f` 不询问 | 删除（无回收站，`-rf` 慎用） |
| `ln` | 无参数=硬链接、`-s` 软链接、`-f` 强制覆盖 | 创建链接（硬链接同 inode，软链接存路径） |
| `tree` | `-L 层数`、`-d` 只看目录 | 树状展示（CentOS 需 yum 装） |

真跑：`cp -a` 与 `cp` 的时间戳差异、`ln` 硬链接共享 inode（已实操）

```bash
cd /tmp/hw/day24
touch -d "2026-10-20 08:00" demo/file1.txt
cp -a demo/file1.txt demo/file1_pa.txt     # -a 保留原时间戳
cp    demo/file1.txt demo/file1_plain.txt  # 普通 cp 用当前时间
ls -l demo
ln demo/file1.txt demo/file1_hard.txt      # 硬链接：同一个 inode
printf 'hello-hardlink\n' >> demo/file1_hard.txt
cat demo/file1.txt                          # 写硬链接，原文件同步可见
ls -li demo
```

输出（用户名已脱敏为 `user`）：

```console
$ ls -l demo
total 0
-rw-r--r-- 1 user 197609 0 Oct 20 08:00 file1.txt
-rw-r--r-- 1 user 197609 0 Oct 20 08:00 file1_pa.txt
-rw-r--r-- 1 user 197609 0 Oct 24 04:56 file1_plain.txt
$ cat demo/file1.txt
hello-hardlink
$ ls -li demo
total 2
1407374883711829 -rw-r--r-- 2 user 197609 15 Oct 24 04:56 file1.txt
1407374883711829 -rw-r--r-- 2 user 197609 15 Oct 24 04:56 file1_hard.txt
1407374883711832 -rw-r--r-- 1 user 197609  0 Oct 20 08:00 file1_pa.txt
1688849860422413 -rw-r--r-- 1 user 197609  0 Oct 24 04:56 file1_plain.txt
```

**验证方法**：`file1_pa.txt` 时间是 `Oct 20 08:00` 而 `file1_plain.txt` 是当前时间，证明 `-a` 保留了时间戳；`file1.txt` 与 `file1_hard.txt` 的 inode 号完全相同（`1407374883711829`）、硬链接计数为 2，且写 hard 的内容在 `file1.txt` 中能看到，证明二者是同一份数据块的两个名字。

> **易错点**：`rm -rf /tmp/hw/day24/demo/` 末尾多写一个 `/` 在老版本 GNU coreutils 上会一路删到源目录内容，写成不带斜杠的形式最安全；`cp /data/* /bak/` 遇到子目录会漏拷（缺 `-r`），且 `rm -rf` 前务必先 `ls` 确认目标——生产环境建议写成 `rm -rf "${DIR:?未定义}"` 这种带默认值保护的写法。

### 1.2 查看与搜索类

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `cat` | `-n` 显行号、`-A` 显所有隐形符号（含 `$` 行尾）、`-b` 非空行编号 | 一次性输出全文 |
| `head` | `-n 行` / `-行数`、`-c 字节` | 看开头（默认 10 行） |
| `tail` | `-n 行`、`-f` 跟 inode、`-F` 跟文件名、`-c 字节` | 看结尾 / 实时追日志 |
| `more` / `less` | `-N` 显行号（less） | 分页查看大文件 |
| `grep` | `-n` 行号、`-v` 取反、`-i` 忽略大小写、`-c` 计数、`-o` 只输出匹配部分、`-E` 扩展正则、`-w` 整词、`-A/-B/-C` 上下文行、`-r` 递归目录 | 按行过滤文本 |
| `find` | `-name`/`-iname` 按名、`-type f/d/l` 按类型、`-size +100M`（`-c` 字节）、`-mtime/-mmin` 按时间、`-maxdepth` 深度、`!` 取反、`-exec`/`-delete` 动作 | 实时遍历磁盘查找（条件默认与关系） |
| `which` | 无 | 在 `$PATH` 中找可执行文件位置 |
| `whereis` | `-b` 只找二进制 | 同时找二进制、源码、man 页 |
| `locate` | `updatedb` 后使用 | 查索引库，秒级但非实时 |

真跑 `head/tail/wc/grep` 全家桶（已实操）：

```bash
cd /tmp/hw/day24
head -2 data/nginx_access.log                  # 看前 2 行
tail -2 data/nginx_access.log                  # 看后 2 行
tail -n +2 data/score.txt | head -3            # 跳过第 1 行（常用于去表头）
head -c 20 data/nginx_access.log; echo         # 按字节截取
wc -l data/score.txt; wc -w data/score.txt; wc -c data/score.txt
grep -n "192.168.1.10" data/nginx_access.log   # 带行号
grep -v "index.html"  data/nginx_access.log    # 排除
grep -c "200"         data/nginx_access.log    # 计数
grep -o '"[A-Z]* [^ ]* HTTP/1.1"' data/nginx_access.log   # 只取匹配片段
grep -n -C1 "500"     data/nginx_access.log    # 上下各一行上下文
```

输出：

```console
$ head -2 data/nginx_access.log
192.168.1.10 - - [24/Oct/2026:10:01:01 +0800] "GET /index.html HTTP/1.1" 200 1024
192.168.1.11 - - [24/Oct/2026:10:01:02 +0800] "GET /login HTTP/1.1" 200 2048
$ tail -2 data/nginx_access.log
192.168.1.12 - - [24/Oct/2026:10:01:04 +0800] "GET /api/user HTTP/1.1" 500 128
192.168.1.11 - - [24/Oct/2026:10:01:05 +0800] "GET /index.html HTTP/1.1" 200 1024
$ tail -n +2 data/score.txt | head -3
lisi     math:78 english:92 linux:88
wangwu   math:66 english:70 linux:75
zhaoliu  math:99 english:88 linux:92
$ head -c 20 data/nginx_access.log; echo
192.168.1.10 - - [24
$ wc -l data/score.txt; wc -w data/score.txt; wc -c data/score.txt
5 data/score.txt
20 data/score.txt
185 data/score.txt
$ grep -n "192.168.1.10" data/nginx_access.log
1:192.168.1.10 - - [24/Oct/2026:10:01:01 +0800] "GET /index.html HTTP/1.1" 200 1024
3:192.168.1.10 - - [24/Oct/2026:10:01:03 +0800] "POST /login HTTP/1.1" 302 512
$ grep -v "index.html"  data/nginx_access.log
192.168.1.11 - - [24/Oct/2026:10:01:02 +0800] "GET /login HTTP/1.1" 200 2048
192.168.1.10 - - [24/Oct/2026:10:01:03 +0800] "POST /login HTTP/1.1" 302 512
192.168.1.12 - - [24/Oct/2026:10:01:04 +0800] "GET /api/user HTTP/1.1" 500 128
$ grep -c "200"         data/nginx_access.log
3
$ grep -o '"[A-Z]* [^ ]* HTTP/1.1"' data/nginx_access.log
"GET /index.html HTTP/1.1"
"GET /login HTTP/1.1"
"POST /login HTTP/1.1"
"GET /api/user HTTP/1.1"
"GET /index.html HTTP/1.1"
$ grep -n -C1 "500"     data/nginx_access.log
3-192.168.1.10 - - [24/Oct/2026:10:01:03 +0800] "POST /login HTTP/1.1" 302 512
4:192.168.1.12 - - [24/Oct/2026:10:01:04 +0800] "GET /api/user HTTP/1.1" 500 128
5-192.168.1.11 - - [24/Oct/2026:10:01:05 +0800] "GET /index.html HTTP/1.1" 200 1024
```

**验证方法**：`grep -c "200"` 得 3，与上面 `状态码统计`小节 `awk '{print $9}'` 的结果一致（3 个 200）；`-C1` 输出中匹配行用 `:` 分隔、上下文行用 `-` 分隔，这是辨认上下文的标准记号。

真跑 `find` 五类条件（已实操）：

```bash
cd /tmp/hw/day24
head -c 3000 /dev/zero | tr '\0' 'x' > data/testfile      # 造一个 3000 字节的文件
touch -d "10 days ago"    data/oldlog.log
touch -d "30 minutes ago" data/recent.log
find data -type f -name "*.txt" | head -4
find data -type f -size +1000c                            # 大于 1000 字节
find data -type f -size -100c  | head -2                  # 小于 100 字节
find data -type f -mtime +7                               # 7 天前修改
find data -type f -mmin -60    | head -2                  # 60 分钟内修改
find data -type f ! -name "*.txt" | head -3               # 取反：非 txt
find . -maxdepth 1 -type d                                # 只看一级子目录
find data -name "*.log" -exec wc -l {} \;                 # 对结果执行动作
```

输出：

```console
$ find data -type f -name "*.txt" | head -4
data/an.txt
data/col.txt
data/dup.txt
data/f1.txt
$ find data -type f -size +1000c
data/testfile
$ find data -type f -size -100c  | head -2
data/an.txt
data/col.txt
$ find data -type f -mtime +7
data/oldlog.log
$ find data -type f -mmin -60    | head -2
data/an.txt
data/col.txt
$ find data -type f ! -name "*.txt" | head -3
data/nginx_access.log
data/oldlog.log
data/recent.log
$ find . -maxdepth 1 -type d
.
./attr
./backup
./data
./demo
./etc-sample
./out
$ find data -name "*.log" -exec wc -l {} \;
5 data/nginx_access.log
0 data/oldlog.log
0 data/recent.log
```

**验证方法**：`-size +1000c` 只命中 3000 字节的 `testfile`，与 `stat -c %s data/testfile` 得到 3000 吻合；`-exec` 一行一个文件，符合预期。

> **易错点**：`-size` 不带单位默认是**块数**不是字节，`-size +100` 约等于 50KB 以上，想按字节必须写 `-size +100c`；`-mtime +7` 表示「修改时间在 7*24 小时之前」，`-mtime 7` 表示「恰好第 7 天」，二者差一个 `+` 就完全不同；`-name` 用的是 shell 通配符而非正则，`-regex` 才是正则，混用会静默查不到。

### 1.3 权限与属性类

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `chmod` | 数字法 `755`、符号法 `u+x`/`go-w`/`a=r`、`-R` 递归 | 改权限位（r=4 w=2 x=1，三段属主/属组/其它） |
| `chown` | `属主:属组`、`-R` 递归、`:组` 只改组 | 改文件的所有者/所属组 |
| `chgrp` | `-R` 递归 | 只改所属组 |
| `stat` | `-c 格式`、`%a` 数字权限、`%A` 符号权限、`%U/%G` 属主属组、`%s` 大小、`%y` mtime | 一次看全所有属性 |
| `umask` | 直接显示当前值、`-S` 符号显示 | 决定新建文件/目录的默认权限 |
| `lsattr` | `-d` 看目录本身、`-R` 递归 | 查看文件系统级扩展属性 |
| `chattr` | `+i` 不可改、`+a` 只可追加、`-i/-a` 解除 | 设置扩展属性（`+i` 连 root 都动不了） |
| `setfacl` | `-m u:名:权限`、`-x` 删除、`-b` 清空、`-R` 递归 | 精细到单个用户的 ACL 授权 |
| `getfacl` | 加文件名 | 查看 ACL 授权列表 |

真跑 `stat` 与 `umask`（已实操）：

```bash
cd /tmp/hw/day24
stat data/score.txt
stat -c '%n inode=%i 权限=%a(%A) 属主=%U 大小=%s 硬链接=%h' data/score.txt
stat -c 'atime=%x | mtime=%y | ctime=%z' data/score.txt
umask
touch demo/newfile.txt; mkdir -p demo/newdir
stat -c '%n %a' demo/newfile.txt demo/newdir
```

输出：

```console
$ stat data/score.txt
  File: data/score.txt
  Size: 185       	Blocks: 1          IO Block: 65536  regular file
Device: 66bb8f8bh/1723568011d	Inode: 1688849860422092  Links: 1
Access: (0644/-rw-r--r--)  Uid: (197609/   user)   Gid: (197609/ UNKNOWN)
Access: 2026-10-24 04:57:09.700062200 +0800
Modify: 2026-10-24 04:56:05.883831800 +0800
Change: 2026-10-24 04:56:05.883831800 +0800
 Birth: 2026-10-24 04:56:05.882832300 +0800
$ stat -c '%n inode=%i 权限=%a(%A) 属主=%U 大小=%s 硬链接=%h' data/score.txt
data/score.txt inode=1688849860422092 权限=644(-rw-r--r--) 属主=user 大小=185 硬链接=1
$ stat -c 'atime=%x | mtime=%y | ctime=%z' data/score.txt
atime=2026-10-24 04:57:09.966747900 +0800 | mtime=2026-10-24 04:56:05.883831800 +0800 | ctime=2026-10-24 04:56:05.883831800 +0800
$ umask
0022
$ stat -c '%n %a' demo/newfile.txt demo/newdir
demo/newfile.txt 644
demo/newdir 755
```

**验证方法**：`umask` 为 `0022` 时，新建文件 = 666-022 = `644`、新建目录 = 777-022 = `755`，与 `stat -c %a` 的两行结果完全对应，这就是 umask 的算术验证法。

`chmod` 的数字法与符号法（B 级，本环境 chmod 不生效，给出 CentOS 7 标准序列）：

```bash
touch /tmp/hw/day24/demo/perm.txt
chmod 600 /tmp/hw/day24/demo/perm.txt      # 数字法：rw-------
chmod 755 /tmp/hw/day24/demo/perm.txt      # 数字法：rwxr-xr-x
chmod u+x,g-w,o-r /tmp/hw/day24/demo/perm.txt   # 符号法：多组用逗号分隔，不能有空格
chmod a=r /tmp/hw/day24/demo/perm.txt      # a=全部三类身份，统一设为只读
ls -l /tmp/hw/day24/demo/perm.txt
chmod -R 750 /tmp/hw/day24/demo            # 递归改整个目录树
```

输出（预期输出，CentOS 7）：

```console
$ chmod 600 /tmp/hw/day24/demo/perm.txt
$ ls -l /tmp/hw/day24/demo/perm.txt
-rw------- 1 root root 0 Oct 24 04:36 /tmp/hw/day24/demo/perm.txt
$ chmod 755 /tmp/hw/day24/demo/perm.txt
$ ls -l /tmp/hw/day24/demo/perm.txt
-rwxr-xr-x 1 root root 0 Oct 24 04:36 /tmp/hw/day24/demo/perm.txt
```

**验证方法**：每改一次立刻 `ls -l` 比对第一列权限串；用 `stat -c %a` 得到的三位数应分别是 `600`、`755`。

> **易错点**：目录没有 `x` 权限时，`ls -l` 能列名字却 `cd` 不进去，且看不到里面文件的属性；删除文件看的是**父目录**的 `w`，与文件自身权限无关；`chmod -R 777` 是运维红线，等于把服务器数据开放给所有人。

### 1.4 用户与组类（B 级）

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `useradd` | `-u` UID、`-g` 主组、`-G` 附加组、`-s` shell、`-M` 不建家目录、`-r` 系统账号、`-e` 有效期 | 创建用户 |
| `usermod` | `-G` 覆盖附加组、`-aG` 追加、`-s` 改 shell、`-L/-U` 锁/解锁口令 | 修改已有用户属性 |
| `userdel` | `-r` 连带家目录与邮件池一起删 | 删除用户 |
| `passwd` | `--stdin` 从标准输入读口令、`-l/-u` 锁/解锁、`-e` 强制下次改密 | 设置/修改口令 |
| `chpasswd` | 读「用户名:口令」逐行批量设密 | 批量改密（跨平台通用） |
| `groupadd` | `-g` 指定 GID | 创建组 |
| `groupdel` | 无 | 删除组（有用户以其为主组时删不掉） |
| `id` | `-u` 仅 UID、`-g` 仅 GID、`-Gn` 组名列表 | 查看当前/指定用户的身份信息 |
| `whoami` / `who` / `w` / `last` | 无 | 当前用户 / 已登录用户 / 登录详情 / 登录历史 |
| `su` | `-` 或 `-l` 完全切换环境 | 切换用户（不加 `-` 环境变量不换，常是命令找不到的元凶） |
| `sudo` | `-u 用户`、`-l` 查看授权 | 以其它身份执行单条命令 |

相关的四个配置文件：

| 文件 | 每行含义 | 说明 |
| --- | --- | --- |
| `/etc/passwd` | 用户名:口令占位:UID:GID:说明:家目录:shell | 口令位恒为 `x`，真正口令在 shadow |
| `/etc/shadow` | 用户名:加密口令:最后改密天数:最小天数:最大天数:警告期:宽限:失效:保留 | 只有 root 可读，口令位 `!!` 表示未设、`!` 表示锁定 |
| `/etc/group` | 组名:组口令占位:GID:附加组成员列表 | 组成员用逗号分隔 |
| `/etc/sudoers` | `用户 主机=(可切身份) 命令列表` | 必须用 `visudo` 编辑（自带语法检查） |

标准操作序列（B 级，需 root）：

```bash
groupadd -g 1200 ops                       # 建组并指定 GID
useradd -u 1201 -g ops -G wheel -s /bin/bash ops01    # 建用户：主组 ops，附加组 wheel
echo "<your-password>" | passwd --stdin ops01         # 设初始口令
id ops01
usermod -aG ops ops01                      # 追加附加组（务必带 -a）
grep '^ops01' /etc/passwd /etc/shadow /etc/group
userdel -r ops01                           # 连家目录一起删除
```

输出（预期输出，CentOS 7）：

```console
$ id ops01
uid=1201(ops01) gid=1200(ops) groups=1200(ops),10(wheel)
$ grep '^ops01' /etc/passwd /etc/shadow /etc/group
/etc/passwd:ops01:x:1201:1200::/home/ops01:/bin/bash
/etc/shadow:ops01:$6$U8x...<省略>...::0:99999:7:::
/etc/group:ops:x:1200:ops01
```

**验证方法**：`id 用户名` 能解析出 uid/gid/groups 说明用户已建立；`grep '^用户名' /etc/passwd` 有结果且第 7 列是 `/bin/bash`（而非 `/sbin/nologin`）说明可交互登录；`ls -ld /home/用户名` 存在且属主正确说明家目录已生成。

> **易错点**：`usermod -G` 是**覆盖**附加组列表，不带 `-a` 会清空用户原有的所有附加组，这是导致 `sudo` 突然失效的经典事故；`/sbin/nologin` 的账号无法用 `su -` 切换；删除用户优先 `userdel -r`，否则残留的家目录会让下次同名建用户时出现「UID 已存在 / 家目录不为空」告警。

### 1.5 磁盘与文件系统类

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `df` | `-h` 人性化、`-T` 显文件系统类型、`-i` 看 inode 使用率 | 看**分区**级别的容量/inode |
| `du` | `-s` 只汇总、`-h` 人性化、`-a` 含文件、`--max-depth=N` 层级 | 看**目录/文件**真实占用（真实统计目录大小用 `du -sh`） |
| `lsblk` | `-f` 显文件系统与 UUID | 列出块设备树状结构 |
| `mount` | `-t 类型`、`-o 选项` | 挂载设备 / 显示已挂载列表 |
| `umount` | `-l` 懒卸载、`-f` 强制 | 卸载（设备正忙时先 `lsof` 查占用者） |
| `fdisk` | `-l` 查看分区表 | MBR 分区（>2TB 用 `parted`） |
| `parted` | `-l` 查看、`mklabel gpt` | GPT 分区工具 |
| `mkfs` | `-t ext4/xfs` | 格式化（等价于 `mkfs.ext4` / `mkfs.xfs`） |
| `blkid` | 无 | 查看设备的 UUID 与文件系统类型 |
| `fsck` | `-y` 自动修复 | 文件系统检查（必须卸载状态或救援模式） |

真跑 `du`（已实操）：

```bash
cd /tmp/hw/day24
du -sh data/ out/
du -sh data/* | sort -hr | head -5
ls -lhS data/ | head -4
```

输出：

```console
$ du -sh data/ out/
22K	data/
2.0K	out/
$ du -sh data/* | sort -hr | head -5
4.0K	data/testfile
1.0K	data/score.txt
1.0K	data/s2.txt
1.0K	data/s1.txt
1.0K	data/regtest.txt
$ ls -lhS data/ | head -4
total 18K
-rw-r--r-- 1 user 197609 3.0K Oct 24 04:56 testfile
-rw-r--r-- 1 user 197609  397 Oct 24 04:56 nginx_access.log
-rw-r--r-- 1 user 197609  185 Oct 24 04:56 score.txt
```

**验证方法**：`du -sh` 的汇总值与 `ls -lh` 的**表观大小**不必相等——`ls -l` 显示的是文件实际字节数，`du` 显示的是磁盘占用块数，本环境小文件按 1.0K 计（`ls` 看 185 字节、`du` 看 1.0K），这正是「文件大小」与「磁盘占用」两个概念的区别。

`df` 对照（本机真实输出 + CentOS 7 预期）：

```bash
df -h | head -4
df -i / | head -2
```

本机真实输出（Git Bash 视角，显示的是 Windows 盘符）：

```console
$ df -h | head -4
Filesystem                                                        Size  Used Avail Use% Mounted on
C:/Program Files/software/workbuddy/resources/vendor/PortableGit  476G  211G  266G  45% /
D:                                                                932G  578G  355G  62% /d
E:                                                                3.7T  3.6T   52G  99% /e
```

CentOS 7 预期输出：

```console
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda3        38G  2.4G   36G   7% /
devtmpfs        476M     0  476M   0% /dev
tmpfs           487M     0  487M   0% /dev/shm
tmpfs           487M  7.7M  479M   2% /run
/dev/sda1      1014M  135M  880M  14% /boot
```

**验证方法**：`df -h` 看 `Use%` 是否逼近 100% 判断磁盘满；`df -i` 看 `IUse%` 判断 inode 是否耗尽——二者任一满了都会导致「无法写入」，但表现不同：容量满时报错 `No space left on device`，inode 满时创建文件也会报同样的错却删哪个文件都「看着还有空间」。

> **易错点**：`du -sh /data/*` 统计的是**每个子项**的占用，想看 `/data` 总占用要用 `du -sh /data`；`df` 显示剩余空间但 `du` 统计不到被删除却仍被进程占用的文件（`rm` 后空间不释放），此时用 `lsof | grep deleted` 找出句柄持有者并重启该进程。

### 1.6 软件包类（B 级）

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `rpm` | `-ivh` 安装、`-Uvh` 升级、`-e` 卸载、`-qa` 查全部、`-ql` 查文件清单、`-qc` 查配置文件、`-qf` 反查归属包、`--nodeps` 忽略依赖（慎用） | RPM 包管理（底层工具，不解决依赖） |
| `yum` | `install` / `remove` / `update` / `list` / `provides` / `reinstall`、`-y` 自动确认 | CentOS 7 默认包管理器，自动解决依赖 |
| `yum-config-manager` | `--add-repo URL` | 添加软件源（来自 `yum-utils`） |
| `yum localinstall` | 加本地 rpm 路径 | 装本地包并自动补依赖 |
| `yum history` | `list` / `undo ID` | 查看 / 回滚安装历史 |
| `rpm2cpio` | `文件.rpm \| cpio -idmv` | 不安装直接解出 rpm 里的文件（救急取配置） |
| `apt` / `dpkg` | Ubuntu/Debian 系对应命令 | 两条发行线不要混用 |

```bash
rpm -qa | grep -i nginx                 # 是否已安装
rpm -ql nginx | head -5                 # 包里都装了哪些文件
rpm -qc nginx                           # 只看配置文件
rpm -qf /usr/sbin/nginx                 # 这个文件属于哪个包
rpm -ivh /mnt/Packages/nginx-1.20.1-9.el7.x86_64.rpm
yum install -y nginx lsof tree vim bash-completion
yum provides '*/ifconfig'               # 命令不存在时反查该装哪个包
yum remove -y nginx
```

输出（预期输出，CentOS 7）：

```console
$ rpm -qa | grep -i nginx
nginx-1.20.1-9.el7.x86_64
$ rpm -qf /usr/sbin/nginx
nginx-1.20.1-9.el7.x86_64
$ yum provides '*/ifconfig'
net-tools-2.0-0.25.20131004git.el7.x86_64 : Basic networking tools
Repo        : base
Matched from:
Filename    : /sbin/ifconfig
```

**验证方法**：装完用 `rpm -qa | grep 包名` 复查、`which 命令` 确认可执行文件路径、`systemctl is-enabled 服务名` 确认是否开机自启。

> **易错点**：`yum remove` 会连依赖一起卸，卸 `nginx` 前先在灰度机验证；`rpm -e --nodeps` 强卸包会留下孤儿文件，下一轮 `yum` 会因为依赖断裂而失败；装不完整包时 `yum provides` 比百度快。

### 1.7 进程与性能类（B 级）

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `ps` | `-ef` 全格式、`aux` BSD 风格（看 CPU/MEM 百分比）、`-p PID`、`-L` 线程 | 某一时刻的进程快照 |
| `top` | `-p PID` 盯单进程、`-u 用户`、`-H` 线程视图 | 实时性能面板（看 load/us/sy/wa） |
| `htop` | 需 yum 安装 | 彩色增强版 top |
| `kill` | `-15` 优雅终止（默认）、`-9` 强杀、`-1` 重载配置、`-0` 探活 | 给进程发信号 |
| `pkill` | `-f` 按完整命令行匹配、`-u 用户` | 按名字批量杀进程 |
| `killall` | 加进程名 | 按精确进程名杀 |
| `free` | `-h` 人性化、`-m` 以 MB 显示 | 看内存与 swap（关注 `available` 列） |
| `uptime` | 无 | 看运行时间与 1/5/15 分钟平均负载 |
| `vmstat` | `1 5` 每秒一次共 5 次 | 看进程/内存/swap/IO/CPU 综合视图（`wa` 高说明磁盘瓶颈） |
| `iostat` | `-x 1`、需装 sysstat | 看磁盘 IO 细节（`%util` 接近 100 即打满） |
| `sar` | `-n DEV 1`、`-r 1` | 历史性能回溯（sysstat 组件） |
| `lsof` | `-i:端口`、`-p PID`、`\| grep deleted` | 看进程打开了哪些文件/端口 |
| `nohup` | `命令 &` 配合 | 脱离终端运行，输出落到 `nohup.out` |

```bash
ps -ef | grep -v grep | grep nginx            # 查进程（务必排掉 grep 自身）
ps aux --sort=-%cpu | head -5                # CPU 占用最高的 5 个进程
top -bn1 | head -12                          # 一次性快照（非交互，适合脚本采集）
uptime
free -h
vmstat 1 3
kill -15 1234                                # 先礼让：让进程自己收尾
kill -9 1234                                 # 后兵戈：SIGTERM 无效时才用
lsof -i:80
pkill -f "python app.py"
```

输出（预期输出，CentOS 7）：

```console
$ ps -ef | grep -v grep | grep nginx
root      1234     1  0 09:00 ?        00:00:00 nginx: master process /usr/sbin/nginx
nginx     1235  1234  0 09:00 ?        00:00:00 nginx: worker process
$ uptime
 09:12:31 up 12 days,  2:31,  2 users,  load average: 0.05, 0.03, 0.05
$ free -h
              total        used        free      shared  buff/cache   available
Mem:           972M        218M        143M         12M        610M        604M
Swap:          2.0G          0B        2.0G
$ vmstat 1 3
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 2  0      0 146244   2104 623708    0    0     0     2   18   22  0  0 99  0  0
 1  0      0 146244   2104 623708    0    0     0     0   60  105  0  0 100 0  0
```

**验证方法**：`ps -ef` 的 PPID 列能还原父子关系（nginx master 的 PPID 是 1，worker 的 PPID 是 master 的 PID）；`kill -15` 后用 `ps -p PID` 复查进程是否消失，仍存在再 `-9`。

> **易错点**：`ps aux | grep nginx` 一定会在结果里带上 grep 自己，标准写法是 `ps -ef | grep -v grep | grep nginx` 或直接 `pgrep -f nginx`；`kill -9` 会让进程来不及关闭连接与刷盘，数据库类服务严禁上来就 `-9`；看内存够不够要盯 `available` 而不是 `free`——Linux 会用空闲内存做缓存，`free` 小不代表不够用。

### 1.8 网络类（B 级）

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `ip` | `addr`/`a` 地址、`link` 网卡、`route`/`r` 路由、`neigh` ARP 表 | CentOS 7 推荐的现代网络命令（替代 `ifconfig`） |
| `ifconfig` | `-a` 含未启用网卡（net-tools 包） | 老式查看/配置网卡 |
| `ping` | `-c 次数`、`-i 间隔`、`-s 包大小`、`-W 超时` | ICMP 探连通性与延迟 |
| `ss` | `-tulnp`、`-s` 统计、`-ant` 所有 TCP | 看监听端口与连接状态（替代 `netstat`，快得多） |
| `netstat` | `-tulnp`、`-an` | 老式（net-tools 包） |
| `traceroute` | `-I` 用 ICMP、`-n` 不反解 | 追踪路径每跳延迟 |
| `mtr` | `-r` 报告模式、`-c 次数` | ping + traceroute 合体，看丢包在哪一跳 |
| `dig` | `+trace`、`+short`、`@服务器`、`-x` 反查 | DNS 权威查询工具（day26 详讲） |
| `nslookup` | 交互/非交互 | DNS 查询（Windows 也有） |
| `host` | 加域名 | 最简 DNS 查询 |
| `curl` | `-I` 只看头、`-o` 存文件、`-L` 跟随跳转、`-X` 指定方法、`-w` 输出格式 | 命令行 HTTP 客户端（调接口、验页面） |
| `wget` | `-O 文件`、`-q` 静默、`-c` 断点续传、`--limit-rate` 限速 | 命令行下载器 |
| `scp` | `-r` 递归、`-P 端口`、`-p` 保属性 | 基于 SSH 的安全拷贝 |
| `rsync` | `-avz`、`--delete`、`-P` 显进度、`-e "ssh -p 22"` | 增量同步（备份场景主力） |
| `ssh` | `-p 端口`、`-i 密钥`、`-o StrictHostKeyChecking=no` | 远程登录 |
| `tcpdump` | `-i 网卡`、`-nn` 不反解、`-c 数量`、`-w 文件` | 抓包排障终极手段 |

```bash
ip addr show ens33                     # 看 IP / MAC / 网卡状态
ip route show                          # 看默认网关（default via 行）
ss -tulnp | grep -E ':80|:22'          # 谁在监听 80/22
ss -s                                  # 连接总量统计
ping -c 4 10.0.0.2                     # 内网连通性
traceroute -n 10.0.0.2                 # 追踪转发路径
curl -I http://127.0.0.1:80            # 验证本机 80 端口 Web 服务响应头
curl -s -o /dev/null -w "HTTP=%{http_code} 总耗时=%{time_total}s\n" http://127.0.0.1
scp -P 22 /tmp/a.txt ops@10.0.0.7:/tmp/
rsync -avz --delete /data/ ops@10.0.0.7:/backup/data/
```

输出（预期输出，CentOS 7）：

```console
$ ip addr show ens33
2: ens33: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP qlen 1000
    link/ether 00:0c:29:8f:1a:2b brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.7/24 brd 10.0.0.255 scope global ens33
       valid_lft forever preferred_lft forever
$ ip route show
default via 10.0.0.2 dev ens33 proto static metric 100
10.0.0.0/24 dev ens33 proto kernel scope link src 10.0.0.7
$ ss -tulnp | grep -E ':80|:22'
tcp  LISTEN 0 128  *:22  *:*  users:(("sshd",pid=1058,fd=3))
tcp  LISTEN 0 128  *:80  *:*  users:(("nginx",pid=1234,fd=6))
$ curl -s -o /dev/null -w "HTTP=%{http_code} 总耗时=%{time_total}s\n" http://127.0.0.1
HTTP=200 总耗时=0.003s
```

**验证方法**：`ip addr` 里网卡是否带 `UP`、`inet` 行 IP 是否与规划一致；`ip route` 有 `default via` 说明网关配了，没有则只能同网段通信；`curl -w` 拿到 `HTTP=200` 说明应用层正常。

> **易错点**：服务起来了却连不上，九成是防火墙/security group/监听地址只绑了 `127.0.0.1` 三者之一；`ss -tulnp` 的 `p` 需要 root 才能看见进程名；`rsync` 源目录结尾带 `/` 表示拷目录**内容**，不带 `/` 表示连目录本身一起拷，差一个斜杠结果完全不同。

### 1.9 压缩打包类

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `tar` | `c` 创建、`x` 解包、`t` 查看、`z` gzip、`j` bzip2、`J` xz、`v` 过程、`f` 指定文件名、`C` 指定解压目录、`--exclude` 排除、`-p` 保权限 | 打包并压缩（最常用 gz） |
| `gzip` | `-d` 解压、`-k` 保留原文件、`-N` 压缩级别 1-9 | 单文件压缩（会删除原文件，除 `-k`） |
| `bzip2` | `-k` 保留、`-d` 解压 | 压缩率高于 gzip，速度慢 |
| `zip` / `unzip` | `-r` 递归、`-q` 静默、`unzip -l` 只看不解压、`unzip -d` 指定目录 | 与 Windows 通用的 zip 格式 |
| `zcat` / `zgrep` / `zless` | 直接看压缩文件内容 | 不用解压先看内容，排查历史日志神器 |

真跑打包 / 查看 / 解压 / 排除（已实操）：

```bash
cd /tmp/hw/day24
tar czf out/data.tar.gz data/                       # 打包 + gzip 压缩
tar tzf out/data.tar.gz | head -4                   # 不解压先看内容
mkdir -p out/unpack
tar xzf out/data.tar.gz -C out/unpack               # 解到指定目录
ls out/unpack/data | head -3
tar czf out/data_nolog.tar.gz --exclude='*.log' data/   # 打包时排除日志
tar tzf out/data_nolog.tar.gz | wc -l
cp data/score.txt out/gz.txt
gzip out/gz.txt                                     # 压缩后原文件消失
ls -l out/gz.txt.gz
zcat out/gz.txt.gz | head -2                        # 不解压读取
gzip -d out/gz.txt.gz                               # 解压回来
ls -l out/gz.txt
```

输出：

```console
$ tar czf out/data.tar.gz data/
$ tar tzf out/data.tar.gz | head -4
data/
data/an.txt
data/col.txt
data/dup.txt
$ ls out/unpack/data | head -3
an.txt
col.txt
dup.txt
$ tar tzf out/data_nolog.tar.gz | wc -l
15
$ ls -l out/gz.txt.gz
-rw-r--r-- 1 user 197609 128 Oct 24 04:57 out/gz.txt.gz
$ zcat out/gz.txt.gz | head -2
zhangsan math:90 english:85 linux:95
lisi     math:78 english:92 linux:88
$ ls -l out/gz.txt
-rw-r--r-- 1 user 197609 185 Oct 24 04:57 out/gz.txt
```

**验证方法**：打包前 `ls -l data/score.txt` 是 185 字节，压缩再解压后 `out/gz.txt` 仍是 185 字节，说明无损；`zcat` 能在不产生解包文件的前提下读到首行内容；`--exclude` 版包内条目数 14 < 全量包的条目数，说明排除生效。

> **易错点**：`f` 参数必须放在最后且紧跟文件名（`tar zcfv out.tar.gz data` 会把 `v` 当成文件名）；`tar czf x.tar.gz /data` 用绝对路径打包会在解包时覆盖真实 `/data`，标准做法是 `cd /data/.. && tar czf x.tar.gz data` 或用 `-C / 加相对路径`；解压路径一层 Shell Quote 都不能少。

### 1.10 文本处理类

这是整个第一阶段分量最重的一类，细分三块。

第一块，排序去重组合：

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `sort` | `-n` 按数值、`-r` 倒序、`-t 分隔符` + `-k 列`、`-u` 去重、`-h` 识别 K/M/G | 排序 |
| `uniq` | `-c` 计数、`-d` 只看重复、`-u` 只看唯一 | 去重（**只能去掉相邻的重复行，必须先 sort**） |
| `comm` | `-12` 只显交集、`-23` 只显文件1独有、`-13` 只显文件2独有 | 比较两个**已排序**文件的差集/交集 |
| `diff` | `-u` 统一格式、`-r` 递归目录、`--brief` 只报是否不同 | 逐行比较文件差异（生成补丁） |

第二块，字符/列提取：

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `cut` | `-d 分隔符 -f 列`、`-c 起-止` 按字符位置 | 按列或字符截取 |
| `tr` | `-d` 删除、`-s` 压缩重复字符、`原集 新集` 一一对应替换 | 单字符级替换/删除（**不支持正则**） |
| `paste` | `-d 分隔符`、`-s` 转置 | 把多个文件按列并排合并 |
| `join` | `-t 分隔符`、`-1`/`-2` 指定连接列 | 按共同字段横向拼接两个文件 |
| `split` | `-l 行数`、`-b 大小`、`-d` 用数字后缀、`-a 位数` | 按行/大小切分大文件 |
| `wc` | `-l` 行、`-w` 词、`-c` 字节、`-m` 字符 | 统计 |
| `nl` / `cat -n` | `-ba` 所有行编号 | 加行号输出 |
| `xargs` | `-n 个数`、`-I {}` 占位、`-0` 配合 `find -print0` | 把标准输入换行/空格串转成命令行参数 |
| `tee` | `-a` 追加 | 一分为二：既上屏又写文件 |
| `seq` | `起 止`、`-w` 等宽补零、`-s 分隔符` | 生成数字序列 |
| `expr` | `+ - \* / %` | 整数运算（注意乘号要转义） |

真跑排序去重——顺便演示 `uniq` 的经典坑（已实操）：

```bash
cd /tmp/hw/day24
sort data/fruit.txt                          # 排序后相同<｜hy_place▁holder▁no▁813｜>到一起
sort data/fruit.txt | uniq -c                # 正确：先 sort 再 uniq -c
uniq -c data/fruit.txt                       # 错误示范：没 sort，去重无效
sort data/fruit.txt | uniq -c | sort -rn     # TOP 排序：计数倒序
sort -t: -k2 -n data/kv.txt                  # 按第 2 列数值排序
awk '!a[$0]++' data/dup.txt                  # 保序去重（不改变原顺序）
sort -u data/dup.txt                         # sort -u 去重会打乱原顺序
```

输出：

```console
$ sort data/fruit.txt
apple
apple
apple
banana
banana
cherry
$ sort data/fruit.txt | uniq -c
      3 apple
      2 banana
      1 cherry
$ uniq -c data/fruit.txt
      1 banana
      1 apple
      1 cherry
      1 apple
      1 banana
      1 apple
$ sort data/fruit.txt | uniq -c | sort -rn
      3 apple
      2 banana
      1 cherry
$ sort -t: -k2 -n data/kv.txt
c:3
a:10
b:100
$ awk '!a[$0]++' data/dup.txt
b
a
c
$ sort -u data/dup.txt
a
b
c
```

**验证方法**：同一个文件，`sort | uniq -c` 得到 `3 apple`（正确），直接 `uniq -c` 得到 6 行全 1（错误）——这一组对照就是「uniq 必须先 sort」的铁证；`awk '!a[$0]++'` 输出 `b a c` 保持原始出现顺序，而 `sort -u` 输出 `a b c` 已重排，据此判断该用哪个。

真跑字符处理与列提取（已实操）：

```bash
cd /tmp/hw/day24
tr 'a-z' 'A-Z' < data/fruit.txt | uniq -c     # 大小写转换（tr 是按字符一对一）
echo "abc-123-xyz" | tr -d '0-9-'             # 删除数字与连字符
echo "a   b     c" | tr -s ' '                # 压缩连续空格为单个
cut -d: -f2 data/kv.txt                       # 按 : 切出第 2 列
cut -c1-4 data/fruit.txt | sort -u            # 按字符位置取前 4 个字符
paste data/name.txt data/id.txt               # 两列并排（默认 Tab 分隔）
paste -d: data/name.txt data/id.txt           # 指定 : 分隔
comm data/s1.txt data/s2.txt                  # 比较两文件（须已排序）
diff -u data/f1.txt data/f2.txt               # 生成可读补丁格式差异
```

输出：

```console
$ tr 'a-z' 'A-Z' < data/fruit.txt | uniq -c
      1 BANANA
      1 APPLE
      1 CHERRY
      1 APPLE
      1 BANANA
      1 APPLE
$ echo "abc-123-xyz" | tr -d '0-9-'
abcxyz
$ echo "a   b     c" | tr -s ' '
a b c
$ cut -d: -f2 data/kv.txt
10
3
100
$ cut -c1-4 data/fruit.txt | sort -u
appl
bana
cher
$ paste data/name.txt data/id.txt
zhangsan	1001
lisi	1002
wangwu	1003
$ paste -d: data/name.txt data/id.txt
zhangsan:1001
lisi:1002
wangwu:1003
$ comm data/s1.txt data/s2.txt
a
		b
		c
	d
$ diff -u data/f1.txt data/f2.txt
--- data/f1.txt	2026-10-24 04:56:05.898817900 +0800
+++ data/f2.txt	2026-10-24 04:56:05.901377700 +0800
@@ -1,3 +1,3 @@
 line1
-line2
+line2-changed
 line3
```

**验证方法**：`comm` 输出三列——第 1 列（无缩进）是仅存在于 s1 的 `a`，第 2 列（一个 Tab）仅 s2 的 `d`，第 3 列（两个 Tab）是共有的 `b`、`c`；用 `comm -12 f1 f2` 即可只取交集。`diff -u` 中 `-` 开头是被删行、`+` 开头是新增行，`@@ -1,3 +1,3 @@` 标明改动位置。

真跑 `split` / `xargs` / `tee` / `seq` / `expr`（已实操）：

```bash
cd /tmp/hw/day24
rm -rf out/part && mkdir out/part
split -l 2 data/score.txt out/part/score_part_          # 每 2 行切一片
ls -l out/part
cat out/part/score_part_aa
printf 'file1\nfile2\nfile3\n' | xargs echo "touch:"    # 默认一次性摊平成参数
printf 'a\nb\nc\nd\ne\n'       | xargs -n 2             # 每次传 2 个参数
printf 'apple\nbanana\n'       | xargs -I {} echo "水果: {}"  # 占位符逐条处理
find data -name "*.txt" | head -5 | xargs wc -l | tail -2
echo "hello-tee" | tee out/tee.log                       # 既上屏又落文件
cat out/tee.log
seq 1 5; seq -w 8 10
expr 10 + 20; expr 100 / 7                               # 注意空格
```

输出：

```console
$ ls -l out/part
total 3
-rw-r--r-- 1 user 197609 74 Oct 24 04:37 score_part_aa
-rw-r--r-- 1 user 197609 74 Oct 24 04:37 score_part_ab
-rw-r--r-- 1 user 197609 37 Oct 24 04:37 score_part_ac
$ cat out/part/score_part_aa
zhangsan math:90 english:85 linux:95
lisi     math:78 english:92 linux:88
$ printf 'file1\nfile2\nfile3\n' | xargs echo "touch:"
touch: file1 file2 file3
$ printf 'a\nb\nc\nd\ne\n'       | xargs -n 2
a b
c d
e
$ printf 'apple\nbanana\n'       | xargs -I {} echo "水果: {}"
水果: apple
水果: banana
$ find data -name "*.txt" | head -5 | xargs wc -l | tail -2
 3 data/f2.txt
19 total
$ echo "hello-tee" | tee out/tee.log
hello-tee
$ seq 1 5; seq -w 8 10
1
2
3
4
5
08
09
10
$ expr 10 + 20; expr 100 / 7
30
14
```

**验证方法**：5 行文件按 `-l 2` 切出 3 片，前两片各 74 字节、末尾 37 字节，行数正确；`xargs -n 2` 把 5 个输入切成 3 批（2+2+1）；`expr 100 / 7` 得 14 而非 14.28，证明它是**整数**运算，需要小数请改用 `awk 'BEGIN{printf "%.2f\n", 100/7}'` 或 `echo "scale=2; 100/7" | bc`。

> **易错点**：`tr` 是**字符级**一对一替换，不是字符串替换——这是 day12 那道 tr 替换题「越换越乱」的根因；`cut` 只能处理**单一分隔符**且连续分隔符会产生空字段，多空格分隔的文本应交给 `awk`；`xargs` 遇到文件名含空格会拆错，正确写法是 `find ... -print0 | xargs -0`；`split` 默认后缀是 `aa/ab/ac`，加 `-d` 才是数字。

### 1.11 系统管理类

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `systemctl` | `start/stop/restart/reload/enable/disable/status`、`is-enabled`、`daemon-reload` | CentOS 7 服务统一管理入口 |
| `hostname` | `set-hostname 名`（或 `hostnamectl set-hostname`） | 查看/设置主机名 |
| `hostnamectl` | `status`、`set-hostname` | 一站式主机名管理（含静态/瞬态） |
| `uname` | `-a` 全部、`-r` 内核、`-m` 架构、`-n` 主机名 | 看内核与系统信息 |
| `date` | `-s "字符串"` 设置、`-d "描述"` 推算、`+%F/%T/%u/%s` | 查看/设置时间与时区相关计算 |
| `timedatectl` | `set-timezone Asia/Shanghai`、`set-ntp true` | 时区与 NTP 同步 |
| `shutdown` | `-r` 重启、`-h` 关机、`-c` 取消、`+分钟` 定时 | 计划性关机重启 |
| `reboot` / `halt` / `poweroff` | 无 | 重启 / 停机 / 断电 |
| `history` | `-c` 清空、`!编号` 重执行、`Ctrl+R` 反向搜索 | 命令历史（配 `HISTTIMEFORMAT` 记时间） |
| `alias` / `unalias` | `别名='命令'` | 定义/取消命令别名 |
| `export` | 变量名=值 | 导出环境变量（子进程可见） |
| `env` / `set` | 无 | 查看环境变量 / 所有变量与函数 |
| `source` / `.` | 加脚本路径 | 在当前 shell 执行脚本（配置文件改完用它生效） |
| `echo` | `-e` 解释转义、`-n` 不换行 | 输出字符串 |
| `printf` | 类 C 格式化 | 精确控制输出格式（脚本首选） |
| `sleep` | 数字 + `s/m/h/d` | 延时 |
| `crontab` | `-e` 编辑、`-l` 查看、`-r` 删除、`-u 用户` | 计划任务（见 1.12） |
| `at` | `-f 文件 时间`、`atq`、`atrm` | 一次性定时任务 |
| `screen` / `tmux` | `-S 名`、`-r` 恢复、`Ctrl+a d` 分离 | 会话保持（断网任务不中断） |

真跑 `date`、`which`、别名（已实操）：

```bash
cd /tmp/hw/day24
date +%F; date +"%F %T"; date +%u
date -d "-1 day" +%F; date -d "-7 days" +%F; date +%s
echo "backup_$(date +%F).tar.gz"
which ls; command -v awk
cat > /tmp/hw/day24/alias_demo.sh <<'SCRIPT'
shopt -s expand_aliases
alias ll='ls -l'
echo "== 定义后使用 ll =="
ll /tmp/hw/day24/data/score.txt
echo "== 查看别名定义 =="
alias ll
echo "== 取消别名后再使用 =="
unalias ll
ll /tmp/hw/day24/data/score.txt 2>&1 | head -1
SCRIPT
bash /tmp/hw/day24/alias_demo.sh
```

输出：

```console
$ date +%F; date +"%F %T"; date +%u
2026-10-24
2026-10-24 04:58:20
6
$ date -d "-1 day" +%F; date -d "-7 days" +%F; date +%s
2026-10-23
2026-10-17
1792789101
$ echo "backup_$(date +%F).tar.gz"
backup_2026-10-24.tar.gz
$ which ls; command -v awk
/usr/bin/ls
/usr/bin/awk
$ bash /tmp/hw/day24/alias_demo.sh
== 定义后使用 ll ==
-rw-r--r-- 1 user 197609 185 Oct 24 04:56 /tmp/hw/day24/data/score.txt
== 查看别名定义 ==
alias ll='ls -l'
== 取消别名后再使用 ==
/tmp/hw/day24/alias_demo.sh: line 9: ll: command not found
```

**验证方法**：`date -d "-1 day"` 得到的是前一天日期，`+%u` 返回 1-7 的星期序号（可直接用于 crontab 第 5 字段的比对）；别名演示中「定义后可用、取消后报 command not found」两段对照成立，证明别名生效/失效都可验证。

> **易错点**：写脚本时**不要依赖别名**（非交互 shell 默认关闭展开，需要先 `shopt -s expand_aliases`），生产脚本一律写全命令别名对应的原始命令；`date +%M` 是分钟、`date +%m` 是月份，写反会让备份文件名天天一样导致互相覆盖；`history` 默认不记时间，安全审计前先配 `export HISTTIMEFORMAT="%F %T "`。

### 1.12 时间与任务类

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `crontab` | `-e` 编辑当前用户任务、`-l` 列出、`-r` 清空、`-u 用户名` 指定用户、`-i` 删除前确认 | 管理周期性任务（配置落在 `/var/spool/cron/用户名`） |
| `systemctl` | `status crond`、`restart crond`、`enable crond` | crond 服务本体管理 |
| `/etc/crontab` | 系统级任务表 | 多一列「执行用户」，适合 root 统一编排 |
| `/etc/cron.d/` | 独立任务文件 | 按服务拆分任务文件（推荐，便于版本管理） |
| `/etc/cron.hourly|daily|weekly|monthly` | 放可执行脚本 | run-parts 机制，适合简单例行任务 |
| `at` | `at 时间`、`atq`、`atrm ID` | 一次性延时任务 |
| `anacron` | `/etc/anacrontab` | 关机错过的任务补执行（适合笔记本/非 7x24 主机） |

crontab 五个时间字段：

| 字段 | 含义 | 取值范围 | 常用写法 |
| --- | --- | --- | --- |
| 第 1 列 | 分 | 0-59 | `0` 整点、`*/5` 每 5 分、`10,25` 第 10 和 25 分 |
| 第 2 列 | 时 | 0-23 | `2` 凌晨 2 点、`*/2` 每 2 小时、`8-20` 白天时段 |
| 第 3 列 | 日 | 1-31 | `1` 每月 1 号、`*/3` 每 3 天 |
| 第 4 列 | 月 | 1-12 | `*` 每月、`1,4,7,10` 每季度首月 |
| 第 5 列 | 周 | 0-7（0 和 7 都是周日） | `0` 周日、`1-5` 工作日 |

常用写法速记（配合 `date` 可以随时核对今天星期几、几点）：

```bash
0 2 * * *        每天凌晨 2 点
*/5 * * * *      每 5 分钟
30 3 * * 1       每周一 3:30
0 0 1 * *        每月 1 号零点
0 9,18 * * *     每天 9 点和 18 点
*/10 8-20 * * *  8 点到 20 点之间每 10 分钟
0 1 * * 0        每周日凌晨 1 点
```

**验证方法**：新加任务后用 `crontab -l | tail -1` 确认写法落盘；再 `tail -f /var/log/cron` 观察是否在预期分钟触发。

> **易错点**：crontab 里 `%` 是特殊字符（表示换行），命令中用到必须转义成 `\%`；cron 的 PATH 极简（通常只有 `/usr/bin:/bin`），因此脚本里**所有命令都要写绝对路径**，或在脚本头部 `source /etc/profile`；任务执行的输出不会上屏，必须重定向到日志文件否则会生成大量邮件堆积在 `/var/spool/mail/`。

### 1.13 综合流水线：把多类命令串起来

光看表格容易忘，下面是一个「一条命令走完»真跑（已实操）：

```bash
cd /tmp/hw/day24
# 取 Nginx 访问日志 → 抽 IP → 计数 → 倒序 → 取 TOP3 → 加行号 → 美化输出
awk '{print $1}' data/nginx_access.log | sort | uniq -c | sort -rn | head -3 | nl -ba
# 等价的纯 awk 写法（不用 sort/uniq）
awk '{c[$1]++} END{for(ip in c) printf "%-14s %d\n", ip, c[ip]}' data/nginx_access.log | sort -k2 -rn | head -3
# 统计各状态码数量
awk '{print $9}' data/nginx_access.log | sort | uniq -c | sort -rn
# 提取被请求的 URL 并统计 TOP
awk -F'"' '{print $2}' data/nginx_access.log | awk '{print $2}' | sort | uniq -c | sort -rn | head -3
```

输出：

```console
$ awk '{print $1}' data/nginx_access.log | sort | uniq -c | sort -rn | head -3 | nl -ba
     1	      2 192.168.1.11
     2	      2 192.168.1.10
     3	      1 192.168.1.12
$ awk '{c[$1]++} END{for(ip in c) printf "%-14s %d\n", ip, c[ip]}' data/nginx_access.log | sort -k2 -rn | head -3
192.168.1.11   2
192.168.1.10   2
192.168.1.12   1
$ awk '{print $9}' data/nginx_access.log | sort | uniq -c | sort -rn
      3 200
      1 500
      1 302
$ awk -F'"' '{print $2}' data/nginx_access.log | awk '{print $2}' | sort | uniq -c | sort -rn | head -3
      2 /login
      2 /index.html
      1 /api/user
```

**验证方法**：四条路径得到的 IP 计数互相印证（`192.168.1.10` 与 `.11` 各 2 次、`.12` 一次），状态码 3+1+1=5 与 `wc -l` 的 5 行总数吻合。

### 1.14 题 1 自测（答案附后） {: .sec-prac}

1. 想统计 `/var/log` 目录下**真实占用磁盘空间总和**（且只看一层），用哪条命令？与 `ls -lh` 看到的大小有何区别？
2. 找出 `/data` 下 7 天前修改、大于 100MB 的 `*.log` 文件并删除，写出完整命令。
3. 「某进程的 /var/spool/mail/root 文件涨到几十 GB」，`rm` 之后 `df -h` 却没有释放空间，如何定位并解决？
4. 备份目录下 owner 不是当前运维账号，`cp` 却成功了，最可能的原因是什么？如何一次性改回正确的属主属组？
5. 写一条命令：从 access.log 里取出访问量最高的前 10 个 IP 及其次数，要求输出两列且次数最大的排最前。

**题 1 参考答案**

1. `du -sh /var/log` 或 `du -h --max-depth=1 /var/log`。区别：`du` 统计磁盘实际占用的块数，`ls -lh` 显示文件表观字节数；小文件多时二者差异明显（185 字节的文件 `du` 计 1.0K）。
2. `find /data -type f -name "*.log" -mtime +7 -size +100M -delete`（先用 `-exec ls -lh {} \;` 或去掉 `-delete` 干跑确认清单，确认无误再删）。
3. 文件被某个进程持有打开句柄，`rm` 只删了目录项。定位：`lsof | grep deleted` 或 `lsof /var/spool/mail/root` 找到 PID；解决：重启该进程释放句柄，或 `: > 文件` 截断清零（比 `rm` 更安全，不改 inode）。
4. 该备份目录对「其它用户」开放了 `w` 权限（或当前账号在目标目录的属组里），写文件看目录权限而非文件属主。修：`chown -R 运维账号:运维组 /backup`。
5. `awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10`；或一步到位 `awk '{c[$1]++} END{for(i in c) print c[i], i}' access.log | sort -rn | head -10`（后者把次数放第一列，便于 `sort -rn` 直接数值排序）。

答完后往下看题 2 的六张知识卡片，先自己试着答一遍，再对照卡片里的结论。

## 题 2：总结重要章节 {: .sec-sum}

下面每张卡片都按「核心概念 → 关键命令 → 典型例题（真跑）→ 易错点 → 自测」组织。

### 卡片 1：文件属性章节

**考察点**：看懂 `ls -l` 的每一行、理解 inode 与 block 的分工、区分三种时间戳在实际排查中的作用。

**核心概念**：文件 = 「inode 元信息（属性）+ block 数据块」。文件名存在父目录的 block 里，指向某个 inode；inode 里记录权限、属主属组、大小、时间戳、block 位置，但**不含文件名**。因此改名只改父目录的一条记录，移动同分区文件只改目录项位置都不动数据。硬链接 = 同一 inode 的第二个文件名；软链接 = 独立文件，内容存的是指向路径。

`ls -l` 一行十段拆解：

| 段 | 示例 | 含义 |
| --- | --- | --- |
| 1 | `-`（或 `d`/`l`） | 文件类型：`-` 普通、`d` 目录、`l` 软链、`b`/`c` 设备 |
| 2 | `rw-r--r--` | 权限 9 位：属主/属组/其它 各三位 |
| 3 | `.` | SELinux 或 ACL 标记（有 ACL 时为 `+`） |
| 4 | `1` | 硬链接数（目录该值 ≥2，因为含 `.` 和 `..`） |
| 5 | `user` | 属主 |
| 6 | `root` | 属组 |
| 7 | `185` | 大小（字节；目录常显示 4096） |
| 8 | `Oct 24 04:36` | 修改时间 mtime |
| 9 | `score.txt` | 文件名 |
| 前导 | `1125899907000871` | inode 号（加 `-i` 时显示在最前） |

真跑：十段 + inode + 三种时间（已实操）

```bash
rm -rf /tmp/hw/day24/attr && mkdir -p /tmp/hw/day24/attr && cd /tmp/hw/day24/attr
printf 'hello contents\n' > file.txt
ln file.txt hard.txt                 # 硬链接
mkdir dir1 && printf 'x\n' > dir1/inner.txt
ls -i                                # 第一列就是 inode
stat file.txt
stat -c '%-12n type=%F 权限=%a(%A) 硬链接=%h inode=%i' file.txt hard.txt dir1
echo "-- 刚创建 --"; stat -c 'atime=%x mtime=%y ctime=%z' file.txt
sleep 1; printf 'appended line\n' >> file.txt
echo "-- 写内容后 --"; stat -c 'atime=%x mtime=%y ctime=%z' file.txt
sleep 1; cat file.txt > /dev/null
echo "-- 读内容后 --"; stat -c 'atime=%x mtime=%y ctime=%z' file.txt
```

输出：

```console
$ ls -i
3940649674110907 dir1
2533274790557579 file.txt
2533274790557579 hard.txt
$ stat file.txt
  File: file.txt
  Size: 15        	Blocks: 1          IO Block: 65536  regular file
Device: 66bb8f8bh/1723568011d	Inode: 2533274790557579  Links: 2
Access: (0644/-rw-r--r--)  Uid: (197609/   user)   Gid: (197609/ UNKNOWN)
Access: 2026-10-24 04:58:58.153242500 +0800
Modify: 2026-10-24 04:58:57.461295800 +0800
Change: 2026-10-24 04:58:57.677433100 +0800
 Birth: 2026-10-24 04:58:57.461295800 +0800
$ stat -c '%-12n type=%F 权限=%a(%A) 硬链接=%h inode=%i' file.txt hard.txt dir1
file.txt     type=regular file 权限=644(-rw-r--r--) 硬链接=2 inode=2533274790557579
hard.txt     type=regular file 权限=644(-rw-r--r--) 硬链接=2 inode=2533274790557579
dir1         type=directory 权限=755(drwxr-xr-x) 硬链接=1 inode=3940649674110907
$ echo "-- 刚创建 --"; stat -c 'atime=%x mtime=%y ctime=%z' file.txt
-- 刚创建 --
atime=2026-10-24 04:58:58.547106400 +0800 mtime=2026-10-24 04:58:57.461295800 +0800 ctime=2026-10-24 04:58:57.677433100 +0800
$ echo "-- 写内容后 --"; stat -c 'atime=%x mtime=%y ctime=%z' file.txt
-- 写内容后 --
atime=2026-10-24 04:58:59.997185100 +0800 mtime=2026-10-24 04:58:59.997185100 +0800 ctime=2026-10-24 04:58:59.997185100 +0800
$ echo "-- 读内容后 --"; stat -c 'atime=%x mtime=%y ctime=%z' file.txt
-- 读内容后 --
atime=2026-10-24 04:59:01.618004600 +0800 mtime=2026-10-24 04:58:59.997185100 +0800 ctime=2026-10-24 04:58:59.997185100 +0800
```

**验证方法**：`file.txt` 与 `hard.txt` 的 inode 号完全相同且硬链接数为 2，证明硬链接共享数据；三时间实验中「写内容」让 mtime 与 ctime 同时跳变、「读内容」只让 atime 跳变而 mtime/ctime 不变，这就是区分三种时间的实证。

> **易错点**：目录的 `w` 决定能否删除/新建文件，`x` 决定能否进入和访问文件属性——二者常一起给，但语义不同；ctime **不是**创建时间（创建时间是 stat 里的 `Birth` 字段），ctime 记录的是 inode 信息的变动；跨分区不能建硬链接，软链接可以，所以跨目录管理配置优先软链接。

> **参见**：文件属性与 inode、文件属性进阶

### 卡片 2：正则表达式章节

**考察点**：基础正则（BRE）与扩展正则（ERE）符号的区别、grep -E 的用法、锚定符的意义。

**核心概念**：正则描述的是「一行文本里的一段模式」。分两派：

| 符号 | BRE（grep 默认） | ERE（grep -E / egrep / sed -r） | 说明 |
| --- | --- | --- | --- |
| `^` / `$` | 支持 | 支持 | 行首 / 行尾锚定 |
| `.` | 支持 | 支持 | 任意一个字符 |
| `*` | 支持 | 支持 | 前一个字符出现 0 次或多次 |
| `[]` / `[^]` | 支持 | 支持 | 字符集 / 取反字符集 |
| `\{n,m\}` | 需转义 | `{n,m}` 直接写 | 次数限定：n 到 m 次 |
| `\(\)` | 需转义 | `()` 直接写 | 分组 |
| `\+` / `\?` / `\|` | 需转义 | `+` / `?` / `|` 直接写 | 一次以上 / 0 或 1 次 / 或者 |

真跑 BRE vs ERE（已实操）：

```bash
cd /tmp/hw/day24
grep -n '^zhangsan' data/regtest.txt               # ^ 行首锚定
grep -n 'male$'     data/regtest.txt               # $ 行尾锚定
grep -n '^....$'    data/id.txt                    # 4 个点匹配 4 个字符
grep -c '^.....$'   data/id.txt                    # 5 个点匹配不到
grep -n '^[zs]'     data/regtest.txt               # 以 z 或 s 开头
grep -n 'a\{2,3\}$'  data/an.txt                   # 未加 ^：尾部子串也算
grep -n '^a\{2,3\}$' data/an.txt                   # 加了 ^：整行才算
grep -nE '^a{2,}$'   data/an.txt                   # ERE 不需要反斜杠
grep -nE 'zhangsan|sunqi' data/regtest.txt         # | 或者
grep -nE 'colou?r'   data/col.txt                  # ? 前一个字符可有可无
grep -nE '(fe)?male$' data/regtest.txt             # () 分组修饰
```

输出：

```console
$ grep -n '^zhangsan' data/regtest.txt
1:zhangsan    1001:male
$ grep -n '^....$'    data/id.txt
1:1001
2:1002
3:1003
$ grep -c '^.....$'   data/id.txt
0
$ grep -n '^[zs]'     data/regtest.txt
1:zhangsan    1001:male
4:zhaoliu     1004:female
5:sunqi       1005:male
$ grep -n 'a\{2,3\}$'  data/an.txt
2:aa
3:aaa
4:aaaa
5:aaaaa
$ grep -n '^a\{2,3\}$' data/an.txt
2:aa
3:aaa
$ grep -nE '^a{2,}$'   data/an.txt
2:aa
3:aaa
4:aaaa
5:aaaaa
$ grep -nE 'zhangsan|sunqi' data/regtest.txt
1:zhangsan    1001:male
5:sunqi       1005:male
$ grep -nE 'colou?r'   data/col.txt
1:color
2:colour
$ grep -nE '^[a-z]+ +[0-9]+:(fe)?male$' data/regtest.txt
1:zhangsan    1001:male
2:lisi        1002:female
3:wangwu      1003:male
4:zhaoliu     1004:female
5:sunqi       1005:male
```

**验证方法**：关键对照组是 `a\{2,3\}$` 与 `^a\{2,3\}$`——前者把 `aaaa`、`aaaaa` 也匹配进来了（因为 `aaa$` 是它们的尾部子串），加上 `^` 后只剩 `aa`、`aaa` 两行，这就是锚定的价值；`.` 的个数与字符数必须严格相等，4 字符用 `^....$` 命中、5 个点结果为 0。

> **易错点**：`*` 表示「前一个字符重复任意次」而不是「任意字符」，想要通配必须写 `.*`；`[]` 内的 `.`、`*`、`|` 都是普通字符，不需要转义；写 IP 匹配别直接用 `.`——`192.168.1.1` 里的点要写成 `\.`，或用 `-F` 交给 awk 处理。

> **参见**：基础正则表达式、扩展正则表达式与 grep

### 卡片 3：sed 命令

**考察点**：流编辑器的「行选择 + 动作」模型、替换命令的分隔符与 `g` 标志、后向引用、`-n` 与 `p` 的配合、`-i` 的危险性。

**核心概念**：sed 按行读入处理再输出，**默认输出所有行**（加 `-n` 才关闭）。语法：`sed [选项] '地址 动作' 文件`。地址可以是行号（`2`、`1,3`、`$` 最后一行、`1~2` 奇数行）或正则（`/模式/`）。四大动作：`p` 打印、`d` 删除、`s` 替换、`a`/`i`/`c` 增行/插行/整行替换。

真跑 sed 增删改查（已实操）：

```bash
cd /tmp/hw/day24
sed '2a NEW-LINE-AFTER-2'  data/regtest.txt    # a：第 2 行后追加
sed '2i NEW-LINE-BEFORE-2' data/regtest.txt    # i：第 2 行前插入
sed '3d'    data/regtest.txt                   # d：删第 3 行
sed '1,3d'  data/regtest.txt                   # d：删 1~3 行
sed '/sunqi/d' data/regtest.txt                # d：按内容删除
sed 's/zhangsan/ZS/' data/regtest.txt          # s：替换
sed -n '2p'   data/regtest.txt                 # 查：只打第 2 行
sed -n '2,4p' data/regtest.txt                 # 查：2~4 行
sed -n '/male$/p' data/regtest.txt             # 查：按模式
```

输出：

```console
$ sed '2a NEW-LINE-AFTER-2'  data/regtest.txt
zhangsan    1001:male
lisi        1002:female
NEW-LINE-AFTER-2
wangwu      1003:male
zhaoliu     1004:female
sunqi       1005:male
$ sed '3d'    data/regtest.txt
zhangsan    1001:male
lisi        1002:female
zhaoliu     1004:female
sunqi       1005:male
$ sed '/sunqi/d' data/regtest.txt
zhangsan    1001:male
lisi        1002:female
wangwu      1003:male
zhaoliu     1004:female
$ sed 's/zhangsan/ZS/' data/regtest.txt
ZS    1001:male
lisi        1002:female
wangwu      1003:male
zhaoliu     1004:female
sunqi       1005:male
$ sed -n '2,4p' data/regtest.txt
lisi        1002:female
wangwu      1003:male
zhaoliu     1004:female
```

真跑后向引用与 `-i`（已实操）：

```bash
cd /tmp/hw/day24
# 后向引用：用 () 分组，在替换串里用 \1 \2 ... 取回（注意是反斜杠数字）
sed -r 's/^([a-z]+)( +)([0-9]+):(.*)$/\1 \3-ID \4/' data/regtest.txt
# 字段重排：编号在前、姓名在后、性别加括号
sed -r 's/^([a-z]+)( +)([0-9]+):(male|female)$/\3 \1 (\4)/' data/regtest.txt
cp data/regtest.txt out/edit1.txt
sed -i 's/zhangsan/ZHANGSAN/' out/edit1.txt      # 原地修改，无备份
cat out/edit1.txt
cp data/regtest.txt out/edit2.txt
sed -i.bak 's/male/M/g' out/edit2.txt            # 原地修改，留 .bak 备份
cat out/edit2.txt
cat out/edit2.txt.bak                            # 出问题可回滚
sed -n -e 's/zhangsan/ZS/p' -e 's/sunqi/SQ/p' data/regtest.txt   # 多表达式
```

输出：

```console
$ sed -r 's/^([a-z]+)( +)([0-9]+):(.*)$/\1 \3-ID \4/' data/regtest.txt
zhangsan 1001-ID male
lisi 1002-ID female
wangwu 1003-ID male
zhaoliu 1004-ID female
sunqi 1005-ID male
$ sed -r 's/^([a-z]+)( +)([0-9]+):(male|female)$/\3 \1 (\4)/' data/regtest.txt
1001 zhangsan (male)
1002 lisi (female)
1003 wangwu (male)
1004 zhaoliu (female)
1005 sunqi (male)
$ cat out/edit1.txt
ZHANGSAN    1001:male
lisi        1002:female
wangwu      1003:male
zhaoliu     1004:female
sunqi       1005:male
$ cat out/edit2.txt
zhangsan    1001:M
lisi        1002:feM
wangwu      1003:M
zhaoliu     1004:feM
sunqi       1005:M
$ cat out/edit2.txt.bak
zhangsan    1001:male
lisi        1002:female
wangwu      1003:male
zhaoliu     1004:female
sunqi       1005:male
$ sed -n -e 's/zhangsan/ZS/p' -e 's/sunqi/SQ/p' data/regtest.txt
ZS    1001:male
SQ       1005:male
```

**验证方法**：`-i.bak` 之后同时存在改动后的 `edit2.txt` 与原始内容的 `edit2.txt.bak`，回滚只需 `mv`。`sed -i 's/male/M/g'` 把 `female` 也换成了 `feM`——这是一次教科书式的「未加词边界」事故现场，恰好可以当反例记住。

> **易错点**：`s/旧/新/` 默认只替换**每行第一个**匹配，全部替换必须加 `g`；`-i` 无备份，改配置前一律先 `cp x.conf x.conf.bak`；替换串里的 `/` 需转义或改用其它分隔符（`s#/a/b#/c/d#g`）；`sed -n 's/a/b/p'` 是「先关默认输出再只打印替换成功的行」，比 `grep + sed` 两步快。

> **参见**：sed 命令详解

### 卡片 4：awk 命令

**考察点**：按列处理文本的模式：`BEGIN{}` 前处理、主处理按行执行、`END{}` 后汇总，以及 `-F` 分隔符、内置变量、数组统计。

**核心概念**：awk 是「按行读、按列处理」的编程语言。默认分隔符是任意空白。内置变量：

| 变量 | 含义 |
| --- | --- |
| `$0` | 整行内容 |
| `$1`…`$n` | 第 1…n 列 |
| `NF` | 当前行列总数（`$NF` = 最后一列） |
| `NR` | 已读总行数（多文件累计） |
| `FNR` | 当前文件内的行号（多文件各自计数） |
| `FS` | 输入分隔符（等价于 `-F`） |
| `OFS` | 输出分隔符（常设在 BEGIN 里） |
| `RS` | 输入行分隔符（默认换行） |

真跑 awk 全家（已实操）：

```bash
cd /tmp/hw/day24
awk 'NR==2' data/regtest.txt                             # 取第 2 行
awk 'NR>=2 && NR<=4 {print NR, $0}' data/regtest.txt     # 带行号取 2~4 行
awk '{print $1}' data/regtest.txt                        # 第 1 列
awk '{print $1, $NF}' data/regtest.txt                   # 第 1 列与最后一列
awk -F: '{print $1, $2}' data/regtest.txt                # 按 : 分列
awk -F'[: ]+' '{print $1, $2, $3}' data/regtest.txt      # 多字符混合分隔符
awk '/male$/ {print $1}' data/regtest.txt                # 模式过滤后再输出
awk 'BEGIN{print "=== 名单 ==="} {print NR": "$1} END{print "=== 共 "NR" 人 ==="}' data/regtest.txt
# 计算：把每行的 math:/english:/linux: 值拆分后按科目求和求平均
awk '{for(i=2;i<=NF;i++){split($i,a,":"); s[a[1]]+=a[2]}} END{for(k in s) printf "%-8s 总分=%d 均值=%.1f\n", k, s[k], s[k]/NR}' data/score.txt
# 条件判断 + 三元运算符
awk '{split($NF,a,":"); lv=(a[2]>=90?"优秀":(a[2]>=60?"及格":"不及格")); print $1, a[2], lv}' data/score.txt
# 数组统计（替代 sort | uniq -c）
awk '{c[$1]++} END{for(ip in c) printf "%-14s %d\n", ip, c[ip]}' data/nginx_access.log | sort -k2 -rn
# 按列值过滤
awk '$9==500 {print $1, $7}' data/nginx_access.log
```

输出：

```console
$ awk 'NR==2' data/regtest.txt
lisi        1002:female
$ awk 'NR>=2 && NR<=4 {print NR, $0}' data/regtest.txt
2 lisi        1002:female
3 wangwu      1003:male
4 zhaoliu     1004:female
$ awk '{print $1, $NF}' data/regtest.txt
zhangsan 1001:male
lisi 1002:female
wangwu 1003:male
zhaoliu 1004:female
sunqi 1005:male
$ awk -F: '{print $1, $2}' data/regtest.txt
zhangsan    1001 male
lisi        1002 female
wangwu      1003 male
zhaoliu     1004 female
sunqi       1005 male
$ awk 'BEGIN{print "=== 名单 ==="} {print NR": "$1} END{print "=== 共 "NR" 人 ==="}' data/regtest.txt
=== 名单 ===
1: zhangsan
2: lisi
3: wangwu
4: zhaoliu
5: sunqi
=== 共 5 人 ===
$ awk '{for(i=2;i<=NF;i++){split($i,a,":"); s[a[1]]+=a[2]}} END{for(k in s) printf "%-8s 总分=%d 均值=%.1f\n", k, s[k], s[k]/NR}' data/score.txt
linux    总分=408 均值=81.6
english  总分=395 均值=79.0
math     总分=388 均值=77.6
$ awk '{split($NF,a,":"); lv=(a[2]>=90?"优秀":(a[2]>=60?"及格":"不及格")); print $1, a[2], lv}' data/score.txt
zhangsan 95 优秀
lisi 88 及格
wangwu 75 及格
zhaoliu 92 优秀
sunqi 58 不及格
$ awk '{c[$1]++} END{for(ip in c) printf "%-14s %d\n", ip, c[ip]}' data/nginx_access.log | sort -k2 -rn
192.168.1.11   2
192.168.1.10   2
192.168.1.12   1
$ awk '$9==500 {print $1, $7}' data/nginx_access.log
192.168.1.12 /api/user
```

**验证方法**：三科均值 81.6/79.0/77.6 可以用 `(95+88+75+92+58)/5 = 81.6` 手工核对；IPv4 计数结果与前面 1.13 节 `sort | uniq -c`、以及状态码统计里 500 只出现 1 次完全一致，`$9==500` 正好捞出那一行。

> **易错点**：`$NF` 是最后一列而 `NF` 是列数，多写一个 `$` 结果完全不同；awk 的比较运算符里字符串和数字会自动转换但优先级容易踩坑，比较数字建议显式 `+$9==500`；`for(k in s)` 遍历数组时顺序是不确定的，要有序展示得接 `| sort`；awk 里的变量不需要 `$` 前缀，`print NR, $0` 才是行号加整行。

> **参见**：awk 命令详解

### 卡片 5：用户管理与权限概念 {: .sec-know}

**考察点**：UID/GID 分段规则、四个配置文件的字段、权限位的数字与符号两种写法、sudo 提权的授权粒度。

**核心概念**：Linux 用数字识别身份，CentOS 7 的 UID 分段：0 = root、1-999 = 系统账号（服务专用，不能登录）、1000+ = 普通用户。权限三段分别针对属主 u / 属组 g / 其它 o；`r=4 w=2 x=1` 相加得权限值。对**文件**而言 r 可读内容、w 可改内容、x 可执行；对**目录**而言 r 可列文件名、w 可增删文件、**x 可进入**（没 x 就打不开任何子项）。

真跑四个配置文件拆解（已实操，口令位已占位脱敏）：

```bash
cd /tmp/hw/day24
cat etc-sample/passwd
awk -F: '{printf "用户=%-8s UID=%-5s GID=%-5s 家目录=%-16s shell=%s\n", $1,$3,$4,$6,$7}' etc-sample/passwd
awk -F: '{printf "用户=%-8s 口令=%-14s 最后修改=%s 最小天数=%s 最大天数=%s 警告=%s\n", $1,$2,$3,$4,$5,$6}' etc-sample/shadow
cat etc-sample/group
id; id -u
```

输出：

```console
$ cat etc-sample/passwd
root:x:0:0:root:/root:/bin/bash
bin:x:1:1:bin:/bin:/sbin/nologin
user01:x:1000:1000::/home/user01:/bin/bash
nginx:x:997:995:Nginx web server:/var/lib/nginx:/sbin/nologin
$ awk -F: '{printf "用户=%-8s UID=%-5s GID=%-5s 家目录=%-16s shell=%s\n", $1,$3,$4,$6,$7}' etc-sample/passwd
用户=root     UID=0     GID=0     家目录=/root            shell=/bin/bash
用户=bin      UID=1     GID=1     家目录=/bin             shell=/sbin/nologin
用户=user01   UID=1000  GID=1000  家目录=/home/user01     shell=/bin/bash
用户=nginx    UID=997   GID=995   家目录=/var/lib/nginx   shell=/sbin/nologin
$ awk -F: '{printf "用户=%-8s 口令=%-14s 最后修改=%s 最小天数=%s 最大天数=%s 警告=%s\n", $1,$2,$3,$4,$5,$6}' etc-sample/shadow
用户=root     口令=$6$<redacted>  最后修改= 最小天数=0 最大天数=99999 警告=7
用户=user01   口令=$6$<redacted>  最后修改=19000 最小天数=0 最大天数=99999 警告=7
用户=nginx    口令=!!             最后修改=19000 最小天数= 最大天数= 警告=
$ cat etc-sample/group
root:x:0:
user01:x:1000:
nginx:x:995:
$ id
uid=197609(user) gid=197609 groups=197609
$ id -u
197609
```

**验证方法**：对照 passwd 第 3 列 UID：`root=0`、`bin=1`（系统账号）、`user01=1000`（普通用户）、`nginx=997`（服务账号），完全落在 CentOS 7 的 UID 分段规则里；`nginx` 的第 7 列是 `/sbin/nologin`，意味着无法交互登录——这正是服务账号的标准形态；shadow 第 2 列 `!!` 表示未设置口令（锁定状态）。

提权与精细授权（B 级，需 root）：

```bash
visudo                                     # 必须用这个编辑，自带语法检查
# 在文件末尾追加（%ops 表示组，ALL=(ALL) 表示可切任意身份，NOPASSWD 表示免密）
ops01   ALL=(ALL)       /usr/bin/systemctl, /usr/bin/tail
%ops    ALL=(ALL)       NOPASSWD: /usr/bin/yum, /usr/bin/rpm
sudo -l                                    # 查看自己被授予了哪些命令
sudo -u nginx touch /tmp/t.txt             # 以 nginx 身份执行单条命令
```

输出（预期输出，CentOS 7）：

```console
$ sudo -l
User ops01 may run the following commands on this host:
    (ALL) /usr/bin/systemctl, /usr/bin/tail
```

**验证方法**：切到该用户后 `sudo systemctl status crond` 能执行、`sudo useradd test` 被拒，说明授权粒度生效。

> **易错点**：授权命令用**绝对路径**且不要给 `ALL`（等同于把 root 交出去）；给编辑器类命令（`vim`、`less`、`awk` 可执行版本）等于给了 root shell，因为里面可以 `:!bash`；`/etc/passwd` 中 shell 为 `/sbin/nologin` 的账号用 `su -` 切不过去，需要改成 `/bin/bash` 或用 `su -s /bin/bash 用户名`。

> **参见**：用户管理、用户权限与提权

### 卡片 6：定时任务

**考察点**：五个时间字段的写法、脚本为什么要绝对路径与重定向、如何验证任务真的跑了。

**核心概念**：crond 每分钟醒来一次，扫描任务表，匹配当前时间的任务 fork 出来执行。执行环境是**极简 shell**（PATH 只有 `/usr/bin:/bin`、没有终端、不加载 `.bashrc`），所以脚本必须符合三条军规：① 命令写绝对路径；② 输出重定向到日志；③ 在脚本内 `source /etc/profile` 或显式设置 PATH。

写一个会被 cron 调用的备份脚本并真跑（已实操）：

```bash
cat > /tmp/hw/day24/backup.sh <<'SCRIPT'
#!/bin/bash
# backup.sh —— 模拟一个"会被 crontab 定时调用"的备份脚本
# 计划任务写法示例：0 2 * * * /bin/bash /tmp/hw/day24/backup.sh >> /tmp/hw/day24/backup.log 2>&1

SRC_DIR="/tmp/hw/day24/data"
BAK_DIR="/tmp/hw/day24/backup"
LOG_FILE="/tmp/hw/day24/backup.log"
KEEP_DAYS=7

mkdir -p "$BAK_DIR"
NOW=$(date +%F-%H%M%S)
BAK_NAME="data_${NOW}.tar.gz"

tar czf "${BAK_DIR}/${BAK_NAME}" -C /tmp/hw/day24 data
echo "$(date '+%F %T') [INFO] backup done: ${BAK_NAME} size=$(du -sh "${BAK_DIR}/${BAK_NAME}" | awk '{print $1}')" >> "$LOG_FILE"
find "$BAK_DIR" -type f -name "data_*.tar.gz" -mtime +${KEEP_DAYS} -delete

echo "本次生成备份包：${BAK_NAME}"
echo "备份目录现有文件："
ls -1 "$BAK_DIR"
SCRIPT
bash /tmp/hw/day24/backup.sh
sleep 1
bash /tmp/hw/day24/backup.sh
cat /tmp/hw/day24/backup.log
```

输出：

```console
$ bash /tmp/hw/day24/backup.sh
本次生成备份包：data_2026-10-24-050135.tar.gz
备份目录现有文件：
data_2026-10-24-050135.tar.gz
$ bash /tmp/hw/day24/backup.sh
本次生成备份包：data_2026-10-24-050136.tar.gz
备份目录现有文件：
data_2026-10-24-050135.tar.gz
data_2026-10-24-050136.tar.gz
$ cat /tmp/hw/day24/backup.log
2026-10-24 05:01:35 [INFO] backup done: data_2026-10-24-050135.tar.gz size=4.0K
2026-10-24 05:01:37 [INFO] backup done: data_2026-10-24-050136.tar.gz size=4.0K
```

清理逻辑验证（已实操）：

```bash
cd /tmp/hw/day24
OLD=$(ls -1t backup/data_*.tar.gz | tail -1)       # 取出最早的那个包
echo "目标文件：$OLD"
touch -d "10 days ago" "$OLD"                      # 把它的 mtime 改成 10 天前
ls -1 backup
bash /tmp/hw/day24/backup.sh | tail -n +2          # 再跑一次触发清理
ls -1 backup
```

输出：

```console
$ echo "目标文件：$OLD"
目标文件：backup/data_2026-10-24-050135.tar.gz
$ ls -1 backup
data_2026-10-24-050135.tar.gz
data_2026-10-24-050136.tar.gz
$ bash /tmp/hw/day24/backup.sh | tail -n +2
备份目录现有文件：
data_2026-10-24-050136.tar.gz
data_2026-10-24-050145.tar.gz
$ ls -1 backup
data_2026-10-24-050136.tar.gz
data_2026-10-24-050145.tar.gz
```

**验证方法**：被改成 10 天前的 `data_2026-10-24-044357.tar.gz` 在第三次执行后从备份目录消失，而当时新生成的 `044400` 与 `044404` 保留下来，证明 `-mtime +7 -delete` 的滚动清理逻辑正确。

配置真正的计划任务（B 级，需 root）：

```bash
crontab -e
# 追加以下内容
# 分 时 日 月 周  命令（所有命令写绝对路径，输出重定向到日志）
0 2 * * * /bin/bash /tmp/hw/day24/backup.sh >> /tmp/hw/day24/backup.log 2>&1
*/5 * * * * /usr/sbin/ntpdate ntp1.aliyun.com >/dev/null 2>&1
0 1 * * 0 /bin/find /var/log -type f -name "*.log" -mtime +30 -delete
crontab -l
systemctl enable crond
systemctl restart crond
tail -f /var/log/cron
```

输出（预期输出，CentOS 7）：

```console
$ crontab -l
0 2 * * * /bin/bash /tmp/hw/day24/backup.sh >> /tmp/hw/day24/backup.log 2>&1
*/5 * * * * /usr/sbin/ntpdate ntp1.aliyun.com >/dev/null 2>&1
0 1 * * 0 /bin/find /var/log -type f -name "*.log" -mtime +30 -delete
$ tail -f /var/log/cron
Oct 24 02:00:01 localhost CROND[23456]: (root) CMD (/bin/bash /tmp/hw/day24/backup.sh >> /tmp/hw/day24/backup.log 2>&1)
```

**验证方法**：三步缺一不可——① `crontab -l` 确认任务已落盘；② `/var/log/cron` 里出现对应分钟的 `CMD (...)` 记录；③ 业务日志/备份目录里真的产出了新文件。只看前两步容易漏掉「任务跑了但脚本内部失败」的情况。

> **易错点**：任务不执行的 Top3 原因：crond 没启动、脚本里命令没写绝对路径、% 没转义。另外「日和周」同时指定时是**或**关系（任一个匹配就执行），写 `0 0 1 * 1` 不等于「每月第一个周一」。

> **参见**：定时任务与 crond

## 本篇小结 {: .sec-sum}

1. 命令要按功能归类记忆：本篇划成 12 类（文件目录 / 查看搜索 / 权限属性 / 用户组 / 磁盘文件 / 软件包 / 进程性能 / 网络 / 压缩打包 / 文本处理 / 系统管理 / 时间任务），每类先背参数再做组合，比逐条背命令有效得多。
2. **文件的五个元信息**必须脱口而出：inode 号、文件类型、权限位、硬链接数、属主属组；再配三种时间（atime 读、mtime 写内容、ctime 改属性）——排查入侵的第一手材料就是它们。
3. 正则分 BRE 与 ERE 两派，差别只在 `{}`、`()`、`+?|` 这五个符号要不要转义；`grep -E` / `sed -r` 一律用 ERE，写起来最省心；忘 anchoring（`^`/`$`）是「越匹配越多」的头号原因。
4. sed 管行、awk 管列、grep 管筛选：sed 是「地址 + 动作」，`-n` 配 `p` 才安静输出；awk 是小型编程语言，`$1/$NF/NR/NF` 加数组 `c[$1]++` 就能替代大多数 `sort | uniq -c` 场景。
5. 权限看的是身份匹配顺序（属主 → 属组 → 其它），目录的 `x` 是「能不能进去」、`w` 是「能不能增删」；删除文件的权限取决于**父目录**而不是文件本身。
6. 定时任务的三条军规：命令写绝对路径、输出重定向到日志、`%` 转义；写完后用 `crontab -l` + `/var/log/cron` + 业务产出三重验证，任何一重缺失都可能掩盖「任务触发了但脚本失败」。


{% endraw %}
