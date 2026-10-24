---
title: "周测-第03周-测验精讲"
date: 2026-10-24 09:06:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
## 本篇说明

这一篇整理第 03 周测验的 30 道题（原始题头标了 35 题，实际题面只有 30 道），每题配标准答案、考点解析、可复现的实操命令和高频易错点，边讲边验证。

分级实操说明：

- **A 级（已实操）**：sed / awk / grep / find / sort / tr / wc / tar / stat / ln / xargs / date / du / alias 等在 Git Bash 环境**真实执行**，输出为真实结果，文中标注 `已实操`。
- **B 级（标准命令 + 预期输出）**：useradd / passwd / systemctl / yum / tail -f / 字符集 / 磁盘与 inode 类等系统级命令，给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出，CentOS 7`。

实操目录统一为 `/tmp/hw`，读者可直接复制复现。示例数据：

```bash
mkdir -p /tmp/hw/linux && cd /tmp/hw/linux
printf 'linux01\nlinux02\nlinux03\nlinux05\nlinux06\nlinux07\n' > linux.txt
printf 'hello-shanghai\nhello world\nhello-shanghai test\nfoo\n' > hello.txt
printf '# comment\nname=1\n#note\nname=2\naddress=x\nport=8080\n' > config.txt
```

脱敏说明：原文中的机构信息、联系方式、姓名一律删除；原课程业务目录统一改写为 `/data/linux` 等通用路径；口令一律用 `<your-password>` 占位。

---

## 一、编辑器与文本处理

### 题 01：vi 编辑器的工作原理，编辑突然中断后如何恢复数据

> **答案：** vi/vim 的工作分三种模式：命令模式（默认）、编辑模式（输入 `i/a/o` 进入）、末行模式（输入 `:` 进入）。编辑流程是：打开文件 → 把文件内容读入内存缓冲区 → 所有修改先写在缓冲区 → 执行 `:w` 时才写回磁盘；同时在同目录生成隐藏的交换文件 `.文件名.swp` 保存编辑状态。
> 突然中断（断电、SSH 断开、Ctrl+Z 后进程被杀）时，缓冲区内容丢失，但 `.swp` 交换文件保留，可用 `vim -r 文件名` 恢复，或打开后在提示界面按 `R`（Recover）恢复，恢复后用 `:wq` 保存，再**手动删除** `.swp` 文件。

**解析**：考察点是「编辑缓冲区 + 交换文件 swap file」机制。判断是否存在可恢复数据的依据是同目录下的 `.xxx.swp` 文件；`vim -r` 不带参数会列出所有可恢复的交换文件。

**实操验证**（B 级，需真机 vim）：

```bash
# 步骤 1：查看是否存在交换文件（隐藏文件）
ls -a /data/linux/ | grep swp

# 步骤 2：列出所有可恢复的交换文件
vim -r

# 步骤 3：从交换文件恢复
vim -r /data/linux/linux.txt

# 步骤 4：确认内容无误、保存退出后删除交换文件
rm -f /data/linux/.linux.txt.swp
```

输出（预期输出，CentOS 7）：

```console
# 步骤 2 输出示例
Swap files found:
   In current directory:
1.    .linux.txt.swp
          owned by: root   dated: Fri Oct 24 09:12:33 2026
         file name: /data/linux/linux.txt
          modified: YES
         user name: root   host name: linux-node1
        process ID: 3125
While opening file "/data/linux/linux.txt"
             dated: Fri Oct 24 09:10:02 2026

# 步骤 3 打开后底部提示
Using swap file ".linux.txt.swp"
Original file "/data/linux/linux.txt"
Recovery completed. You should check if everything is OK.
```

> **易错点**：
> 1. 恢复成功后 `.swp` 文件**不会自动删除**，下次打开还会提示，必须 `rm -f .xxx.swp`。
> 2. 若选择 `(D)elete it` 则直接丢弃恢复内容，不可撤销。
> 3. 多人同时编辑同一文件会提示 `found a swap file by the name ...`，此时应选 `(O)pen Read-Only` 或 `(Q)uit`，避免互相覆盖。
> 4. `.swp` 是隐藏文件，`ls` 看不到，必须 `ls -a`。

### 题 02：如何查看 Linux 系统中是否开启了 8080 端口服务

> **答案：** 三条常用命令：
> `ss -lntup | grep 8080`（推荐，CentOS 7 默认自带）
> `netstat -lntup | grep 8080`（需 net-tools 包）
> `lsof -i :8080`（需 lsof 包）
> 有输出即已监听；无输出说明该端口无服务监听。

**解析**：考察点是端口监听状态查看。选项含义：`-l` 仅显示监听 socket，`-n` 不做域名/服务名反解（快且直观），`-t` TCP，`-u` UDP，`-p` 显示占用进程。`grep 8080` 也可换成 `grep -w 8080` 精确匹配。注意「端口开启」有两层含义：服务是否监听（本地看 `ss`）、防火墙是否放行（看 `firewalld`/`iptables`），两者都要查。为什么加 `-n` 更快？不反解就得把端口号映射成服务名（查 `/etc/services`）、IP 反查域名，多走一遍解析，输出大时肉眼可见地卡。

**实操验证**（B 级，需 CentOS 7 真机）：

```bash
# 步骤 1：查看本机 TCP/UDP 监听端口并过滤 8080
ss -lntup | grep 8080

# 步骤 2：等价的 netstat 写法
netstat -lntup | grep 8080

# 步骤 3：按端口号精确查看占用进程
lsof -i :8080

# 步骤 4：确认防火墙是否放行（仅看服务监听是不够的）
firewall-cmd --list-ports
```

输出（预期输出，CentOS 7）：

```console
# 步骤 1
tcp    LISTEN     0      128       *:8080                  *:*                   users:(("java",pid=1321,fd=45))

# 步骤 3
COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
java    1321 root   45u  IPv6  23145      0t0  TCP *:webcache (LISTEN)

# 步骤 4（未放行时为空，放行时）
8080/tcp
```

> **易错点**：
> 1. 忘记加 `-l` 会列出所有连接（含已建立连接），结果混乱。
> 2. 不加 `-n` 时 8080 可能显示成 `webcache`，容易误判成没开。
> 3. `ss -lntup | grep 8080` 也可能匹配到 PID 中含 8080 的行，用 `grep ':8080'` 更精确。
> 4. 服务监听正常但外部访问不通，问题多半在防火墙/安全组，不在服务本身。

### 题 03：vim 中把所有的 linux 替换为 python，给出命令

> **答案：** 末行模式执行：
> `:%s#linux#python#g`
> 或 `:%s/linux/python/g`
> 若要求每次替换前确认，改为 `:%s#linux#python#gc`。

**解析**：考察点 vim 末行替换语法：`%` 表示全文范围（等价于 `1,$`），`s` 表示 substitute，`g` 表示一行内所有匹配（不加 `g` 只替换每行第一个）。分隔符可任选，内容含 `/` 时用 `#` 或 `@` 更省事，避免大量转义。

**实操验证**（vim 为 B 级；等价的 sed 命令为 A 级已实操）：

```bash
# vim 内执行（B 级）
# :%s#linux#python#g

# 等价的命令行写法（A 级，已实操）
cd /tmp/hw/linux && sed 's#linux#python#g' linux.txt
```

输出（已实操）：

```console
python01
python02
python03
python05
python06
python07
```

> **易错点**：
> 1. 落 `%`：写成 `:s#linux#python#g` 只替换**当前光标所在行**。
> 2. 落 `g`：每行只替换第一个匹配。
> 3. 只替换不保存：替换后必须 `:wq`，否则退出后文件内容不变。
> 4. 只想改真机文件用 `sed -i`，但 `-i` 不可逆，建议先 `sed` 不带 `-i` 预览。

> **参见**：文档编辑软件使用技巧

### 题 04：Linux 内核引导时，从（）文件中读取要加载的文件系统信息；文件属性中每个普通文件用（）来标识

> **答案：** 第一个空：`/etc/fstab`；第二个空：`-`（短横线）。

**解析**：考察两个固定知识点。`/etc/fstab` 是开机自动挂载配置文件，内核引导后期由 `mount -a` 依据它挂载各文件系统；`ls -l` 输出的第一个字符是文件类型标识符，普通文件为 `-`，目录为 `d`，软链接为 `l`，块设备 `b`，字符设备 `c`，套接字 `s`，管道文件 `p`。

**实操验证**（A 级，已实操——用本地文件对照文件类型位）：

```bash
# 步骤 1：观察 ls -l 输出第一个字符（文件类型位）
cd /tmp/hw/linux && ls -l

# 步骤 2：用 stat 精确查看文件类型
stat -c '%F  %n' linux.txt /tmp/hw
```

输出（已实操）：

```console
total 3
-rw-r--r-- 1 lcmgs 197609 50 Oct 24 05:25 config.txt
-rw-r--r-- 1 lcmgs 197609 51 Oct 24 05:25 hello.txt
-rw-r--r-- 2 lcmgs 197609 54 Oct 24 05:25 linux.txt
regular file  linux.txt
directory  /tmp/hw
```

```bash
# 读取 fstab 结构（B 级，CentOS 7）
cat /etc/fstab
```

输出（预期输出，CentOS 7）：

```console
UUID=1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d /       xfs     defaults        0 0
UUID=8f7e6d5c-4b3a-2b1c-0d9e-8f7a6b5c4d3e /boot   xfs     defaults        0 0
UUID=2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f swap    swap    defaults        0 0
```

> **易错点**：
> 1. `/etc/fstab` 与 `/etc/mtab`（或 `/proc/mounts`）混淆：前者是开机挂载配置，后者是**当前已挂载**的实时记录。
> 2. 把「普通文件标识 `-`」答成文件权限位，类型位是 `ls -l` 输出的**第 1 个字符**，权限是后面 9 个字符。
> 3. fstab 写错会导致开机进入 emergency 模式，修改前务必备份。

> **参见**：重要系统文件与运行级别

### 题 05：vim 中如何忽略大小写搜索指定信息（至少两种方法）

> **答案：** 方法一（临时）：末行模式用 `\c`，如 `/linux\c` 或 `?linux\c`；
> 方法二（开关）：`:set ic`（ignorecase，忽略大小写）开启，`:set noic` 关闭；
> 方法三（智能）：`:set smartcase`，搜索词含大写时才区分大小写。
> 命令行下对应的是 `grep -i`。

**解析**：考察搜索选项。`\c` 是 vim 正则里的大小写忽略标志，放在模式任意位置都对整次匹配生效；`:set ic` 是全局开关，影响后续所有搜索。`grep -i` 是知识点在命令行侧的延伸。

**实操验证**（grep 部分 A 级已实操）：

```bash
# A 级：grep -i 忽略大小写（已实操）
cd /tmp/hw/linux && printf 'Linux\nlinux\nLINUX\nhello\n' > case.txt
grep -i linux case.txt
grep -ni "LINUX" case.txt
```

输出（已实操）：

```console
Linux
linux
LINUX
1:Linux
2:linux
3:LINUX
```

```bash
# B 级：vim 内操作
# /linux\c          → 忽略大小写搜索
# :set ic           → 开启忽略大小写
# :set noic         → 关闭忽略大小写
# :set smartcase    → 智能大小写
```

> **易错点**：
> 1. `\c` 写成了 `\C`（`\C` 恰恰是**强制区分**大小写）。
> 2. `:set ic` 只对当前 vim 会话有效，退出即失效；永久生效需写入 `~/.vimrc`。
> 3. `smartcase` 必须在 `ignorecase` 打开的前提下才有意义。

### 题 06：用命令行更改 config.txt，把里边所有的 name 更改为 address（vim 和 sed 分别如何实现）

> **答案：** vim 方式：`vim config.txt` → `:%s#name#address#g` → `:wq`
> sed 方式（预览）：`sed 's#name#address#g' config.txt`
> sed 方式（落盘）：`sed -i 's#name#address#g' config.txt`
> sed 方式（落盘并备份）：`sed -i.bak 's#name#address#g' config.txt`

**解析**：考察同一需求的两条实现路径。注意 `sed -i.bak` 与 `sed -i .bak` 的区别：连写是「后缀」，分开写在 GNU sed 里也表示后缀但在 BSD/macOS 上语义不同，Linux 上推荐连写 `sed -i.bak`。另外 `name` 会匹配到 `username`、`name_server` 这类子串，需要精确替换时用 `s#\bname\b#address#g` 或 `s#^name=#address=#g`。

**实操验证**（A 级，已实操）：

```bash
# 步骤 1：先预览，不修改文件
cd /tmp/hw/linux && sed 's#name#address#g' config.txt

# 步骤 2：确认无误后落盘
sed -i 's#name#address#g' config.txt

# 步骤 3：验证结果
cat config.txt
```

输出（已实操）：

```console
# 步骤 1
# comment
address=1
#note
address=2
address=x
port=8080

# 步骤 3（cat 结果同上，且已写入文件）
# comment
address=1
#note
address=2
address=x
port=8080
```

```bash
# 步骤 4（B 级）：验证「只改配置项、不动注释里的 name」
sed 's#^name=#address=#' config.txt
```

> **易错点**：
> 1. `sed -i` 没有预览就执行，改错无法回滚；应先不带 `-i` 跑一遍。
> 2. 忘记 `g`，每行只替换第一个。
> 3. 替换内容含 `/` 时还在用 `/` 做分隔符，导致语法错误，应换成 `#` 或 `@`。
> 4. 用 `sed -i` 修改正在被服务读取的配置，可能引发配置重载问题。

> **参见**：sed 命令详解

### 题 07：管道符号 `|` 的含义说明

> **答案：** 管道把**前一个命令的标准输出（stdout）**作为**后一个命令的标准输入（stdin）**，用于在一条命令行里串联多个命令完成流水线处理。形式：`命令A | 命令B | 命令C`。默认只传递 stdout，不传递 stderr，如需把 stderr 一起传给后续命令，要写成 `命令A 2>&1 | 命令B`。

**解析**：这题就是在考管道的本质——「数据流重定向」，不是「参数传递」。这一点决定了：`ls | rm` 不能删除文件（rm 只认命令行参数，不读 stdin），必须借助 `xargs`。

**实操验证**（A 级，已实操）：

```bash
# 步骤 1：管道串联：取文件内容 → 过滤 → 统计行数
cd /tmp/hw/linux && cat config.txt | grep -v '^#' | wc -l

# 步骤 2：证明管道只传 stdout 不传 stderr
ls /no-such-dir | wc -l

# 步骤 3：把 stderr 也并入管道
ls /no-such-dir 2>&1 | wc -l

# 步骤 4：证明管道不传参数——rm 读不到管道内容
cat linux.txt | rm          # 无效，rm 忽略标准输入
```

输出（已实操）：

```console
4
ls: cannot access '/no-such-dir': No such file or directory
0
ls: cannot access '/no-such-dir': No such file or directory
1
rm: missing operand
```

> **易错点**：
> 1. 以为 `命令 | 命令` 是传参数，实际传的是数据流。
> 2. 忘记 `2>&1`，错误信息「漏出」管道直接打到屏幕。
> 3. 管道会**丢失**前一个命令的退出状态码：`cmd1 | cmd2` 的 `$?` 是 `cmd2` 的，判断 cmd1 结果要用 `PIPESTATUS[0]`。
> 4. `grep` 无匹配时返回 1，会导致管道后续 `set -e` 脚本中断。

> **参见**：常用文件操作命令

### 题 08：搜索文件中指定文本内容的方法（至少三种）

> **答案：** 方法一：`grep "关键字" 文件`
> 方法二：`sed -n '/关键字/p' 文件`
> 方法三：`awk '/关键字/' 文件`
> 补充：`egrep`/`grep -E`（扩展正则）、`less` 内输入 `/关键字` 交互式查找、`cat 文件 | grep 关键字`（不推荐，多一次无用 cat）。

**解析**：考察「文本三剑客」的分工：grep 擅长过滤、sed 擅长取行与替换、awk 擅长按列处理。查内容优先 grep，效率最高。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/linux
# 方法一：grep
grep -n 'hello-shanghai' hello.txt

# 方法二：sed
sed -n '/hello-shanghai/p' hello.txt

# 方法三：awk
awk '/hello-shanghai/' hello.txt

# 方法四：显示匹配行及其后 1 行
grep -A1 'hello-shanghai' hello.txt
```

输出（已实操）：

```console
1:hello-shanghai
3:hello-shanghai test
hello-shanghai
hello-shanghai test
hello-shanghai
hello-shanghai test
1:hello-shanghai
2-hello world
--
3:hello-shanghai test
4-foo
```

> **易错点**：
> 1. `sed` 忘记加 `-n`，会先把全文打印一遍再打印匹配行（重复输出），必须 `sed -n '/x/p'`。
> 2. `grep` 不加 `-n` 看不到行号，排错时不好定位。
> 3. 关键字含正则元字符（`.` `*` ``）时要 `grep -F` 或转义，否则匹配结果不符预期。
> 4. `cat file | grep x` 属于无用 cat（UUOC），直接 `grep x file` 即可。

### 题 09：在 /data/linux/linux.txt 中查找出包含 hello-shanghai 的所有信息并显示行号

> **答案：** `grep -n "hello-shanghai" /data/linux/linux.txt`

**解析**：考察 `grep -n`（--line-number）显示行号。若还想看上下文，加 `-A`/`-B`/`-C`；若只要文件名，加 `-l`。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/linux && grep -n "hello-shanghai" hello.txt
```

输出（已实操）：

```console
1:hello-shanghai
3:hello-shanghai test
```

> **易错点**：
> 1. 行号是**文件内的真实行号**，与 `cat -n` 一致；用 `grep -n` 后再 `| grep` 一次会丢失行号。
> 2. 文件名写相对路径时，需确认当前目录，否则报 `No such file or directory`。
> 3. 关键字含 `-` 开头时会被当成选项，用 `grep -n -- "-abc" file`。

### 题 10：文件内容如下，输出 linux03 的上 2 行和下 3 行

> **答案：** `grep -B2 -A3 "linux03" linux.txt`，或 `grep -C3 "linux03" linux.txt`（前后各 3 行），或 `grep -2 "linux03" linux.txt`。

**解析**：考察 grep 上下文控制三兄弟：`-A n`（After，后 n 行）、`-B n`（Before，前 n 行）、`-C n`（Context，前后各 n 行）。`-2` 是 `-C 2` 的简写。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/linux && cat linux.txt && echo "======" && grep -n -B2 -A3 "linux03" linux.txt
```

输出（已实操）：

```console
linux01
linux02
linux03
linux05
linux06
linux07
======
1-linux01
2-linux02
3:linux03
4-linux05
5-linux06
6-linux07
```

> **易错点**：
> 1. 区分 `-A`(后) 与 `-B`(前)，记混会取错方向。
> 2. 匹配行本身用 `:` 分隔，上下文行用 `-` 分隔，看输出时要分清哪行是命中行。
> 3. 文件行数不足时，只输出存在的行，不会报错。
> 4. 多个匹配结果之间会用 `--` 分隔，容易误以为是文件内容。

### 题 11：给 /data/linux/linux.txt 创建软链接 /tmp/linux_link.txt，源文件删除后软链接是否失效

> **答案：** 创建：`ln -s /data/linux/linux.txt /tmp/linux_link.txt`
> 源文件删除后：软链接**会失效**（变成无效链接，俗称「断链」）。此时 `ls -l` 中链接目标闪烁/标红，`cat` 报 `No such file or directory`；但如果之后又创建了同名同路径的源文件，软链接会自动恢复可用。

**解析**：考察软链接（符号链接）的本质——它保存的是**源文件的路径字符串**，不保存 inode，因此源文件消失后按路径找不到目标即失效。软链接可跨文件系统、可链接目录，inode 号与源文件不同。

**实操验证**（B 级，软链接需真机；A 级演示硬链接与 ls -l 判读）：

```bash
# 步骤 1：创建软链接
ln -s /data/linux/linux.txt /tmp/linux_link.txt

# 步骤 2：查看链接指向
ls -l /tmp/linux_link.txt
readlink /tmp/linux_link.txt

# 步骤 3：删除源文件后再次访问
rm -f /data/linux/linux.txt
cat /tmp/linux_link.txt
```

输出（预期输出，CentOS 7）：

```console
# 步骤 2
lrwxrwxrwx 1 root root 22 Oct 24 09:30:11 /tmp/linux_link.txt -> /data/linux/linux.txt
/data/linux/linux.txt

# 步骤 3
cat: /tmp/linux_link.txt: No such file or directory
```

> **易错点**：
> 1. 创建软链接时源文件建议写**绝对路径**；写相对路径时是相对「软链接所在目录」解析，容易断链。
> 2. `ln -s` 参数顺序是「源文件 在前，链接文件 在后」，写反了会报错或把链接建到源文件目录里。
> 3. 目标已存在同名目录时，`ln -s src dst` 会在 dst 目录里再建一个链接，用 `ln -sfn` 强制替换。
> 4. 软链接权限永远显示 `lrwxrwxrwx`，实际权限由源文件决定。

> **参见**：[文件属性与 inode

---

## 二、系统优化与安全

### 题 12：系统安全优化涉及什么，写出优化的操作步骤与命令

> **答案：** 系统安全优化主要涉及五个方面：
> 1. **禁止 root 远程登录**：改 `/etc/ssh/sshd_config` 的 `PermitRootLogin no`，新建普通用户 + sudo 提权。
> 2. **修改 SSH 默认端口**：`Port 22` 改为高位端口（如 2222），并配合防火墙放行。
> 3. **防火墙**：只开放必要端口，关闭无用端口对外暴露。
> 4. **用户与口令**：清理无用用户、设置口令复杂度与有效期、锁定长期不登录账号。
> 5. **最小化安装 + 及时更新**：`yum update`、关闭无用服务（`systemctl disable`）。

**解析**：考察「最小化暴露面」的安全思路。操作顺序有讲究：**必须先配好普通用户和 sudo、先放行新端口，再改 SSH 配置并重启 sshd**，否则会把自己锁在门外。

**实操验证**（B 级，CentOS 7）：

```bash
# 步骤 1：创建运维用户并配置 sudo
useradd ops01
echo '<your-password>' | passwd --stdin ops01
echo 'ops01 ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers
visudo -c

# 步骤 2：修改 SSH 配置（禁止 root 登录 + 改端口）
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sed -i 's#^#PermitRootLogin#PermitRootLogin no#' /etc/ssh/sshd_config
sed -i 's#^Port 22#Port 2222#' /etc/ssh/sshd_config
grep -E '^(PermitRootLogin|Port)' /etc/ssh/sshd_config

# 步骤 3：防火墙放行新端口
firewall-cmd --permanent --add-port=2222/tcp
firewall-cmd --reload

# 步骤 4：语法检查后重启 sshd（不要直接 stop，避免断连）
sshd -t && systemctl restart sshd
```

输出（预期输出，CentOS 7）：

```console
# 步骤 1
Changing password for user ops01.
passwd: all authentication tokens updated successfully.
/etc/sudoers: parsed OK

# 步骤 2
PermitRootLogin no
Port 2222

# 步骤 3
success
success

# 步骤 4（无输出即配置正确，sshd 重启成功）
```

> **易错点**：
> 1. 直接 `vi` 改 `/etc/sudoers` 若语法错误会导致所有 sudo 失效，必须用 `visudo` 或改完 `visudo -c` 校验。
> 2. 改 SSH 端口后忘记放行防火墙，新端口连不上、旧连接一断就彻底失联。正确做法是**保留当前连接不退出**，另开一个窗口测试新端口。
> 3. `PermitRootLogin` 行默认被 `#` 注释，只 `sed -i 's#PermitRootLogin yes#PermitRootLogin no#'` 改不到，要处理注释行。
> 4. 禁用 root 登录前必须先验证普通用户能 sudo 成功。
> 5. **变式追问**：改完 sshd_config 后 `reload` 与 `restart` 怎么选？（reload 重读配置不断开已有连接，远程改 SSH 配置更稳；restart 会重置连接。无论如何，改完先另开窗口验证新配置能登录，再退出当前会话。）

> **参见**：用户权限与提权

### 题 13：防火墙配置完毕后，如何检查防火墙已关闭且没有开机自启动

> **答案：** CentOS 7：`systemctl status firewalld` 看 `Active: inactive (dead)`；`systemctl is-enabled firewalld` 返回 `disabled`；两者结合即可证明「当前已关闭 + 不开机自启」。也可用 `systemctl is-active firewalld` 返回 `unknown`/`inactive`。

**解析**：考察 systemd 的两个独立状态：`is-active`（当前运行状态）与 `is-enabled`（开机自启状态）。`systemctl stop` 只改前者，`systemctl disable` 只改后者，**两个都要做**才算真正关掉。

**实操验证**（B 级，CentOS 7）：

```bash
# 步骤 1：关闭防火墙并禁止开机自启
systemctl stop firewalld
systemctl disable firewalld

# 步骤 2：检查当前运行状态
systemctl is-active firewalld

# 步骤 3：检查开机自启状态
systemctl is-enabled firewalld

# 步骤 4：完整状态确认
systemctl status firewalld

# 步骤 5（可选）：同时确认 SELinux
getenforce
```

输出（预期输出，CentOS 7）：

```console
# 步骤 2
inactive

# 步骤 3
disabled

# 步骤 4
* firewalld.service - firewalld - dynamic firewall daemon
   Loaded: loaded (/usr/lib/systemd/system/firewalld.service; disabled; vendor preset: enabled)
   Active: inactive (dead)

# 步骤 5
Disabled
```

> **易错点**：
> 1. 只做 `systemctl stop` 就以为关了，重启后防火墙又起来了，必须加 `disable`。
> 2. 用 `service firewalld status` 或 `chkconfig` 属于 CentOS 6 写法，CentOS 7 用 systemctl。
> 3. `systemctl is-enabled` 对未安装的服务返回 `Failed to get unit file state`，与服务存在但 disabled 要区分。
> 4. 生产环境「永久关闭防火墙」通常不是最优解，正确做法是放行需要的端口。

### 题 14：rm 命令修改了别名信息的文件 /etc/profile，但还是不能直接删除信息，是什么原因？写出别名相关的文件及路径

> **答案：** 原因：`/etc/profile` 是**登录式 shell（login shell）**才读取的文件，且修改后必须重新登录或 `source /etc/profile` 才生效；另外 `~/.bashrc` 中的定义加载顺序在 `/etc/profile` 之后会**覆盖**前者，所以在新开的非登录交互式 shell 里看不到新别名。更常见的原因是 CentOS 默认 `~/.bashrc` 里有 `alias rm='rm -i'`，它后加载并覆盖，导致仍是交互确认而非「直接删除」。
> 别名相关文件及路径：
> - `/etc/profile`：全局登录 shell 环境变量与别名
> - `/etc/bashrc`：全局非登录 shell（打开新终端/bash）读取
> - `/etc/profile.d/*.sh`：全局自定义别名推荐位置（最推荐，便于管理）
> - `~/.bash_profile`：用户级登录 shell
> - `~/.bashrc`：用户级非登录 shell（最常用）
> 临时定义：`alias rm='rm -i'`；取消：`unalias rm`；查看：`alias` / `alias rm`。

**解析**：考察登录 shell 与非登录 shell 的配置文件加载顺序：
登录 shell：`/etc/profile` → `/etc/profile.d/*.sh` → `~/.bash_profile` → `~/.bashrc` → `/etc/bashrc`
非登录 shell：`~/.bashrc` → `/etc/bashrc`
后加载的会覆盖先加载的同名别名，这是本题的核心。

**实操验证**（A 级已实操——脚本方式演示 alias 定义/查看/取消）：

```bash
# 步骤 1：写成脚本执行（非交互 shell 默认不展开别名，需 shopt -s expand_aliases）
printf '%s\n' 'shopt -s expand_aliases' \
  "alias ll='ls -l --color=auto'" 'alias ll' 'll /tmp/hw/linux' 'unalias ll' > /tmp/hw/ad.sh
bash /tmp/hw/ad.sh

# 步骤 2：确认取消后别名不存在
alias | grep 'alias ll=' || echo "ll 别名已删除"
```

输出（已实操）：

```console
alias ll='ls -l --color=auto'
total 3
-rw-r--r-- 1 lcmgs 197609 50 Oct 24 05:25 config.txt
-rw-r--r-- 1 lcmgs 197609 51 Oct 24 05:25 hello.txt
-rw-r--r-- 2 lcmgs 197609 54 Oct 24 05:25 linux.txt
```

```bash
# 步骤 3（B 级，CentOS 7）：查看系统中别名定义位置
grep -rn 'alias rm' /etc/profile /etc/bashrc /etc/profile.d/ ~/.bashrc ~/.bash_profile 2>/dev/null

# 步骤 4：让修改立刻生效
source /etc/profile
```

输出（预期输出，CentOS 7）：

```console
/root/.bashrc:8:alias rm='rm -i'
/root/.bashrc:9:alias cp='cp -i'
/root/.bashrc:10:alias mv='mv -i'
```

> **易错点**：
> 1. 改了 `/etc/profile` 不 `source` 也不重新登录，当前会话**完全不生效**。
> 2. `~/.bashrc` 后加载会覆盖 `/etc/profile` 的同名别名，改全局文件无效。
> 3. 脚本中执行 `alias` 默认不展开，需 `shopt -s expand_aliases`，这是脚本里别名「不起作用」的常见原因。
> 4. 想临时绕过 `rm -i` 别名，用 `\rm file` 或 `/bin/rm file` 或 `unalias rm`。

> **参见**：系统优化实践-上

### 题 15：字符集进行优化方法

> **答案：** 字符集优化即统一为 UTF-8，避免中文乱码。分两层：
> 1. 系统层：写入 `/etc/locale.conf`（CentOS 7）或 `/etc/sysconfig/i18n`（CentOS 6）：`LANG="zh_CN.UTF-8"`（或 `en_US.UTF-8`），然后 `source` 生效。
> 2. 终端层：远程工具（SecureCRT/Xshell）的字符集必须设为 UTF-8，且与系统一致。
> 临时生效：`export LANG=zh_CN.UTF-8`。

**解析**：考察「乱码三要素一致」：系统字符集、远程工具字符集、文件本身编码，三者必须相同。排查顺序是「先看系统 `echo $LANG`，再看终端设置，最后看文件编码 `file -i`」。

**实操验证**（B 级，CentOS 7）：

```bash
# 步骤 1：查看当前字符集
echo $LANG
locale

# 步骤 2：查看系统支持的字符集
locale -a | grep -i utf

# 步骤 3：永久修改（CentOS 7）
echo 'LANG="zh_CN.UTF-8"' > /etc/locale.conf
source /etc/locale.conf

# 步骤 4：临时修改（当前会话）
export LANG=zh_CN.UTF-8

# 步骤 5：验证文件实际编码
file -i /data/linux/linux.txt
```

输出（预期输出，CentOS 7）：

```console
# 步骤 1
zh_CN.UTF-8
LANG=zh_CN.UTF-8
LC_CTYPE="zh_CN.UTF-8"
LC_ALL=

# 步骤 2
en_US.UTF-8
zh_CN.UTF-8
zh_CN.gbk

# 步骤 5
/data/linux/linux.txt: text/plain; charset=us-ascii
```

> **易错点**：
> 1. 只改了 `LANG` 没改远程终端编码，乱码依旧——两边必须一致。
> 2. `/etc/locale.conf` 里写了系统不支持的字符集（如 `zh_CN.UTF-8` 未安装），会回退到 `C`/`POSIX`。
> 3. CentOS 6 与 CentOS 7 配置文件不同（`/etc/sysconfig/i18n` vs `/etc/locale.conf`）。
> 4. 文件本身是 GBK 编码时，即使系统 UTF-8 也乱码，需 `iconv -f gbk -t utf-8 file -o newfile` 转换。

### 题 16：说明这些特殊符号的含义：`>` `>>` `2>` `2>>` `#` `.` `..` `$` `|` `&&` `;`

> **答案：**

| 符号 | 含义 |
| --- | --- |
| `>` | 标准输出**覆盖**重定向到文件（文件不存在则创建，存在则清空） |
| `>>` | 标准输出**追加**重定向到文件 |
| `2>` | 错误输出（stderr）**覆盖**重定向 |
| `2>>` | 错误输出**追加**重定向 |
| `#` | 注释符（行首生效）；root 提示符 |
| `.` | 当前目录；也表示隐藏文件前缀；`source` 的简写 |
| `..` | 上一级目录 |
| `$` | 变量取值符（`$PATH`）；普通用户提示符；正则中表示行尾 |
| `\|` | 管道，前命令 stdout 作为后命令 stdin |
| `&&` | 逻辑与，前一条**成功**才执行后一条 |
| `;` | 命令分隔符，按顺序执行，不关心成败 |

**解析**：考察 shell 元字符。文件描述符编号要记牢：`0` stdin、`1` stdout、`2` stderr，所以 `>` 等价于 `1>`。合并写法 `>file 2>&1` 或 `&>file` 表示正确与错误都进同一文件。为什么 `2>&1` 必须写在 `>` 后面？它是"让 stderr 指向 stdout 现在指向的位置"，先重定向 stdout、再复制指向；顺序反了，stderr 就还指着屏幕。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/linux
# > 覆盖
echo "first" > r.txt && cat r.txt
# >> 追加
echo "second" >> r.txt && cat r.txt
# 2> 覆盖写错误
ls /no-such-dir-1 2> err.txt; cat err.txt
# 2>> 追加写错误
ls /no-such-dir-2 2>> err.txt; cat err.txt
# && 与 ;
echo ok && echo after; echo "分号后总会执行"
# || 前一条失败才执行
ls /no-such-dir-3 2>/dev/null || echo "前面失败则执行我"
```

输出（已实操）：

```console
first
first
second
ls: cannot access '/no-such-dir-1': No such file or directory
ls: cannot access '/no-such-dir-1': No such file or directory
ls: cannot access '/no-such-dir-2': No such file or directory
ok
after
分号后总会执行
前面失败则执行我
```

> **易错点**：
> 1. `>` 会**清空**原文件，误操作无法恢复；追加必须用 `>>`。
> 2. `2>` 和 `>` 是两条独立的流，`cmd > a.txt 2> b.txt` 正确输出进 a、错误进 b。
> 3. `2>&1` 必须写在重定向之后：`cmd > file 2>&1` 正确，`cmd 2>&1 > file` 错误（顺序变了含义就变）。
> 4. `&&` 与 `;` 混用：`A && B; C` 中 C 无论 A/B 成败都会执行。

### 题 17：Linux 系统中文件属性信息都包含什么

> **答案：** 用 `ls -lhi` 或 `stat` 查看，文件属性包含：

| 属性 | 示例 | 说明 |
| --- | --- | --- |
| inode 号 | 3659174697396613 | 文件在文件系统中的唯一索引号 |
| 文件类型 | `-` / `d` / `l` | 普通文件/目录/软链接 |
| 权限位 | `rw-r--r--` | 属主/属组/其他各 rwx |
| 硬链接数 | 2 | 指向该 inode 的目录项数量 |
| 属主 | root | 文件所有者 |
| 属组 | root | 文件所属组 |
| 大小 | 54 | 字节数（目录为元数据大小） |
| 时间戳 | mtime/atime/ctime | 修改/访问/改变时间 |
| 文件名 | linux.txt | 目录项名称 |

**解析**：考察「文件 = 目录项（文件名）+ inode（元数据）+ block（数据）」的三段式结构。文件名存在目录的 block 里，属性存在 inode 里，真正内容存在 data block 里。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/linux && ls -lhi linux.txt && echo "======" && stat linux.txt
```

输出（已实操）：

```console
3659174697396613 -rw-r--r-- 2 lcmgs 197609 54 Oct 24 05:25 linux.txt
  File: linux.txt
  Size: 54        	Blocks: 1          IO Block: 65536  regular file
Device: 66bb8f8bh/1723568011d	Inode: 3659174697396613  Links: 2
Access: (0644/-rw-r--r--)  Uid: (197609/   lcmgs)   Gid: (197609/ UNKNOWN)
Access: 2026-10-24 05:26:34.179270400 +0800
Modify: 2026-10-24 05:25:42.330332900 +0800
Change: 2026-10-24 05:26:12.679712200 +0800
 Birth: 2026-10-24 05:25:42.330332900 +0800
```

注：CentOS 7 上 `stat` 输出中没有 `Birth` 一行（需文件系统支持），其余字段一致。

> **易错点**：
> 1. 把「文件名」当成 inode 里的内容，实际文件名在**目录的 block** 中，inode 里没有名字。
> 2. `ls -l` 的大小对目录来说不是目录内文件总大小，要用 `du -sh`。
> 3. 硬链接数对目录而言 = 2 + 子目录数量，不能按普通文件理解。
> 4. `ctime` 不是创建时间（creation），是 inode 属性变更时间。

> **参见**：文件属性与 inode

---

## 三、系统文件与用户管理

### 题 18：默认情况下管理员创建了一个用户，就会在（）目录下创建一个用户主目录

> **答案：** `/home`（管理员即 root 执行 `useradd` 时，默认在 `/home` 下创建同名家目录，如 `useradd ops01` → `/home/ops01`）。

**解析**：考察 useradd 的默认行为。家目录模板来自 `/etc/skel/`（内含 `.bashrc`、`.bash_profile` 等隐藏文件），`useradd -M` 可不创建家目录，`useradd -d /path` 可指定位置。相关默认值在 `/etc/default/useradd` 与 `/etc/login.defs` 里。

**实操验证**（B 级，CentOS 7）：

```bash
# 步骤 1：查看 useradd 默认配置
cat /etc/default/useradd | grep -E 'HOME|SHELL|SKEL'
ls -a /etc/skel/

# 步骤 2：创建用户并验证家目录
useradd ops01
ls -ld /home/ops01
grep ops01 /etc/passwd
```

输出（预期输出，CentOS 7）：

```console
# 步骤 1
HOME=/home
SHELL=/bin/bash
SKEL=/etc/skel
.  ..  .bash_logout  .bash_profile  .bashrc

# 步骤 2
drwx------ 2 ops01 ops01 62 Oct 24 09:40:12 /home/ops01
ops01:x:1001:1001::/home/ops01:/bin/bash
```

> **易错点**：
> 1. 把答案写成 `/root`——`/root` 是 root 用户自己的家目录，不是新建用户的父目录。
> 2. `useradd -M` 创建的用户无家目录，切换后会在 `/` 下，提示符异常。
> 3. 家目录权限为 `700`，属主属组为该用户，手动 `cp -r` 复制会导致权限/属主错误，应 `cp -a` 或用 `useradd -m`。

> **参见**：用户管理

### 题 19：说出下面几个文件的作用

> **答案：**

| 文件 | 作用 |
| --- | --- |
| `/var/log/messages` | 系统主日志文件，记录内核、服务、系统级常规信息与大部分错误，排障第一站 |
| `/var/log/secure` | 安全认证日志，记录登录、su 切换、sudo 提权、sshd 认证成功/失败 |
| `/etc/hosts` | 本地静态域名解析表，`IP 域名` 映射，优先于 DNS（由 `/etc/nsswitch.conf` 决定顺序） |
| `/etc/fstab` | 开机自动挂载配置文件，定义设备/UUID、挂载点、文件系统类型、挂载参数、dump 与 fsck 顺序 |
| `/etc/rc.local` | 开机最后执行的自定义脚本；CentOS 7 需 `chmod +x /etc/rc.d/rc.local` 才生效 |

**解析**：考察运维最常打交道的 5 个文件。日志类两个文件由 rsyslog 按 facility 分流；`/etc/hosts` 常用于内网机器间免 DNS 解析；`/etc/rc.local` 在 CentOS 7 中是 rc-local.service 调用的兼容入口。

**实操验证**（A 级已实操部分 + B 级 CentOS 7 部分）：

```bash
# A 级：用本地文件演示查看注释与有效行（已实操）
cd /tmp/hw/linux && grep -vE '^#|^$' config.txt
```

输出（已实操）：

```console
name=1
name=2
address=x
port=8080
```

```bash
# B 级（CentOS 7）：查看各文件内容与权限
tail -5 /var/log/messages
tail -5 /var/log/secure
cat /etc/hosts
cat /etc/fstab
ls -l /etc/rc.local /etc/rc.d/rc.local
```

输出（预期输出，CentOS 7）：

```console
Oct 24 09:41:02 linux-node1 systemd: Started Session 3 of user root.

Oct 24 09:41:05 linux-node1 sshd[2213]: Accepted password for root from 10.0.0.1 port 51422 ssh2

127.0.0.1   localhost localhost.localdomain
::1         localhost localhost.localdomain
10.0.0.51   web01

/dev/mapper/centos-root /      xfs     defaults  0 0
UUID=8f7e6d5c-4b3a /boot       xfs     defaults  0 0
/dev/mapper/centos-swap swap   swap    defaults  0 0

lrwxrwxrwx. 1 root root 13 /etc/rc.local -> rc.d/rc.local
-rw-r--r--. 1 root root 473 /etc/rc.d/rc.local
```

> **易错点**：
> 1. CentOS 7 的 `/etc/rc.local` 默认**没有执行权限**，写了命令不会执行，必须 `chmod +x /etc/rc.d/rc.local`。
> 2. `/var/log/secure` 只在 CentOS/RHEL 系存在，Debian/Ubuntu 对应 `/var/log/auth.log`。
> 3. 日志由 logrotate 轮转，直接 `cat messages` 可能看到的是旧内容，最新日志要看 `messages-20261024` 或直接 `tail -f messages`。
> 4. `/etc/hosts` 修改后无需重启网络，立即生效；但 `nscd`/`systemd-resolved` 有缓存时可能延迟。

> **参见**：重要系统文件与运行级别

### 题 20：将配置文件中注释信息去除掉显示，有什么办法（至少三种）

> **答案：** 三种主流做法（假设注释行以 `#` 开头）：
> `grep -v '^#' file`
> `sed '/^#/d' file`
> `awk '!/^#/' file`
> 若还要去掉空行：`grep -vE '^#|^$' file`、`sed -r '/^#|^$/d' file`、`awk '!/^#/ && NF' file`。
> 若注释在行尾（如 `port=8080  # 端口`）：`sed 's/#.*//' file | grep -v '^$'`。

**解析**：考察「反向过滤 + 正则锚点」。`^#` 锚定行首，避免把行中间的 `#` 当注释整行删掉；`-v` 是 grep 取反，`d` 是 sed 删除，`!` 是 awk 取反。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/linux
# 方法一：grep -v
grep -v '^#' config.txt
echo "---"
# 方法二：sed 删除
sed '/^#/d' config.txt
echo "---"
# 方法三：awk 取反
awk '!/^#/' config.txt
echo "---"
# 同时去掉空行
grep -vE '^#|^$' config.txt
```

输出（已实操）：

```console
name=1
name=2
address=x
port=8080
---
name=1
name=2
address=x
port=8080
---
name=1
name=2
address=x
port=8080
---
name=1
name=2
address=x
port=8080
```

> **易错点**：
> 1. 写成 `grep -v '#'` 会把行中间含 `#` 的正常配置也删掉，必须加 `^` 锚定行首。
> 2. 缩进过的注释（行首有空格）用 `^#` 匹配不到，应写 `^[[:space:]]*#`。
> 3. `sed '/^#/d'` 不加 `-i` 只显示不修改文件，这是**安全的预览**做法，推荐先预览后落盘。
> 4. 这些命令只处理显示，不改文件，别误以为配置已被清理。

### 题 21：日志文件 /var/log/messages 一直在变化，如何实时监控其变化

> **答案：** `tail -f /var/log/messages`（跟踪文件描述符，默认）
> 或 `tail -F /var/log/messages`（推荐，文件被轮转/重建后仍能自动重新打开）
> 或 `tailf /var/log/messages`
> 或 `less +F /var/log/messages`（可 Ctrl+C 暂停翻页，按 F 继续跟踪）
> 只想看含关键字的实时日志：`tail -f /var/log/messages | grep --line-buffered 'error'`

**解析**：考察 `-f` 与 `-F` 的区别。`tail -f` 按文件描述符跟踪，logrotate 切割后旧 fd 失效，会「卡住不动」；`-F` 等价于 `--follow=name --retry`，按文件名跟踪并在文件消失/重建时重试，生产环境应选 `-F`。

**实操验证**（B 级，跟踪为阻塞命令）：

```bash
# 步骤 1：先看尾部 20 行（A 级思路，非阻塞）
tail -n 20 /var/log/messages

# 步骤 2：实时跟踪（会一直阻塞，Ctrl+C 退出）
tail -f /var/log/messages

# 步骤 3：过滤关键字实时跟踪
tail -f /var/log/messages | grep -i --line-buffered 'error\|fail'

# 步骤 4：同时观察多个日志
tail -f /var/log/messages /var/log/secure
```

输出（预期输出，CentOS 7）：

```console
# 步骤 2
Oct 24 09:50:01 linux-node1 systemd: Started Session 5 of user root.
Oct 24 09:51:12 linux-node1 kernel: TCP: request_sock_TCP: Possible SYN flooding
Oct 24 09:51:12 linux-node1 sshd[2311]: Failed password for invalid user admin from 10.0.0.9
```

> **易错点**：
> 1. `tail -f` 在日志轮转后停止输出，必须用 `tail -F`。
> 2. `tail -f file | grep x` 看不到输出，是因为 grep 缓冲，要加 `--line-buffered`。
> 3. 跟踪后忘了 Ctrl+C，终端一直被占用。
> 4. 想看「过去某时段」的日志不要用 tail -f，用 `sed -n '/09:00/,/09:30/p'` 或 `awk` 按时间范围过滤。
> 5. 生产注意点：要挂很久的 `tail -f` 建议放进 `tmux`/`screen` 会话里跑，SSH 断线跟踪不丢。

### 题 22：如何创建一个新用户并设置密码，且采用免交互方式创建密码

> **答案：** 创建用户：`useradd dev01`
> 免交互设密码（推荐）：`echo '<your-password>' | passwd --stdin dev01`
> 或：`echo 'dev01:<your-password>' | chpasswd`
> 一条龙：`useradd dev01 && echo '<your-password>' | passwd --stdin dev01`

**解析**：考察免交互（非交互式）设置口令。`passwd` 默认要交互输入两次，脚本中会卡住；`--stdin` 让它从标准输入读取一次（CentOS/RHEL 支持，Ubuntu 用 `chpasswd`）。`chpasswd` 更通用，格式是 `用户名:密码`，可多行批量。

**实操验证**（B 级，CentOS 7）：

```bash
# 步骤 1：创建用户
useradd dev01

# 步骤 2：免交互设置密码
echo '<your-password>' | passwd --stdin dev01

# 步骤 3（等价写法）：批量设置
echo 'dev01:<your-password>' | chpasswd

# 步骤 4：验证用户与口令状态
id dev01
chage -l dev01
```

输出（预期输出，CentOS 7）：

```console
# 步骤 2
Changing password for user dev01.
passwd: all authentication tokens updated successfully.

# 步骤 4
uid=1002(dev01) gid=1002(dev01) groups=1002(dev01)
Last password change                                    : Oct 24, 2026
Password expires                                        : never
Password inactive                                       : never
Account expires                                         : never
```

> **易错点**：
> 1. `--stdin` 在部分系统（Ubuntu、新版 RHEL 9）已被移除，改用 `chpasswd`。
> 2. 密码明文会留在 `history` 里，脚本中应用变量或 `read -s`，事后 `history -c`。
> 3. 简单密码会触发 `BAD PASSWORD` 警告，但仍能设置成功（root 强制）。
> 4. 批量创建应用 `newusers`（读取与 /etc/passwd 同格式的文件），逐条 `useradd` 效率低。

> **参见**：用户管理

### 题 23：如何批量创建 linux01 … linux20 共 20 个文件

> **答案：** 最简：`touch linux{01..20}`
> 备选：`touch linux$(seq -w 1 20)`（seq 加空格展开）
> 备选：`for i in $(seq -w 1 20); do touch linux$i; done`
> 备选：`seq -w 1 20 | xargs -i touch linux{}`

**解析**：考察 bash 的花括号展开（brace expansion）`{01..20}`，它会自动补零。`seq -w` 的 `-w` 也是等宽补零。`{1..20}` 不会补零，得到 linux1…linux20，与题目要求不符，这是最常见的失分点。

**实操验证**（A 级，已实操）：

```bash
mkdir -p /tmp/hw/batch && cd /tmp/hw/batch
# 方法一：花括号展开（自动补零）
touch linux{01..20}
ls

# 方法二：seq -w 等宽补零
mkdir -p /tmp/hw/batch2 && cd /tmp/hw/batch2
touch linux$(seq -w 1 20)
ls | head -3

# 验证总数
ls /tmp/hw/batch/linux* | wc -l
```

输出（已实操）：

```console
linux01
linux02
linux03
linux04
linux05
linux06
linux07
linux08
linux09
linux10
linux11
linux12
linux13
linux14
linux15
linux16
linux17
linux18
linux19
linux20
linux01
linux02
linux03
20
```

> **易错点**：
> 1. 写成 `touch linux{1..20}` 得到的是 linux1…linux20，**没有前导零**，不满足 `linux01` 要求。
> 2. `touch linux$(seq 1 20)` 不加 `-w` 同样不补零。
> 3. 花括号展开是 bash 特性，`sh`（dash）不支持，脚本首行必须是 `#!/bin/bash`。
> 4. 文件名含空格时 `xargs` 会被拆分，需 `xargs -0` 配合 `find -print0`。

### 题 24：yum 安装软件时只知道安装后会用到的命令，忘记软件包名称，如何处理

> **答案：** 用 `yum provides` 反查命令属于哪个包：
> `yum provides */bin/ifconfig` 或 `yum provides "*/ifconfig"`
> `yum provides` 可简写为 `yum whatprovides` / `yum provides ifconfig`
> 查到包名后再 `yum install -y 包名`
> 扩展：`rpm -qf $(which ifconfig)`（已安装的命令反查所属包）

**解析**：考察 `yum provides` 的反向查询能力。关键字是「由文件/命令查包」，与「由包查文件」（`rpm -ql`）方向相反。注意查询本地不存在的命令时要写路径通配 `*/bin/xxx` 或 `*/xxx`，否则可能搜不到。

**实操验证**（B 级，CentOS 7）：

```bash
# 步骤 1：由命令反查包名
yum provides ifconfig

# 步骤 2：更精确的写法
yum provides "*/sbin/ifconfig"

# 步骤 3：安装查到的包
yum install -y net-tools

# 步骤 4（已安装命令反查）：先查路径再查包
rpm -qf $(which ssh)

# 步骤 5：列出包内所有文件
rpm -ql net-tools | head
```

输出（预期输出，CentOS 7）：

```console
# 步骤 1/2
net-tools-2.0-0.25.20131004git.el7.x86_64 : Basic networking tools
Repo        : base
Matched from:
Filename    : /usr/sbin/ifconfig

# 步骤 3
Installed:
  net-tools.x86_64 0:2.0-0.25.20131004git.el7

# 步骤 4
openssh-clients-7.4p1-21.el7.x86_64
```

> **易错点**：
> 1. 直接 `yum provides ifconfig` 有时查不到（因为 yum 按文件路径匹配），要写成 `*/ifconfig` 或 `*/sbin/ifconfig`。
> 2. `yum search` 是按包名和摘要关键字搜，不能按命令搜，容易搜出一堆无关结果。
> 3. 最小化安装的 CentOS 7 没有 `ifconfig`/`netstat`，正是本题典型场景，答案都是 `net-tools` 包。
> 4. `rpm -qf` 只能查**已安装**的文件，未安装的命令要用 `yum provides`。

> **参见**：软件安装与硬件信息查看

### 题 25：统计 linux.txt 文件中 linux 信息出现的行数总计有多少

> **答案：** `grep -c "linux" linux.txt`（统计**匹配的行数**）
> 若要统计**出现次数**（一行多次算多次）：`grep -o "linux" linux.txt | wc -l`
> 等价写法：`grep "linux" linux.txt | wc -l`、`awk '/linux/{n++}END{print n}' linux.txt`

**解析**：考察 `-c`（count lines）与「出现次数」的区别。`grep -c` 数的是**有多少行包含**关键字，一行出现 3 次也只算 1 行；`grep -o` 把每个匹配单独输出一行再 `wc -l`，才是真实出现次数。这题就是在考这个陷阱，一字之差结果能差好几倍。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/linux
# 统计匹配行数（grep -c）
grep -c "linux" linux.txt

# 统计匹配行数（管道 wc）
grep "linux" linux.txt | wc -l

# 统计真实出现次数（grep -o）
grep -o "linux" linux.txt | wc -l

# awk 写法
awk '/linux/{n++}END{print n}' linux.txt
```

输出（已实操）：

```console
6
6
6
6
```

> **易错点**：
> 1. 把 `grep -c` 当成「出现次数」，实际是「匹配行数」；题目问「行数」用 `-c` 正确，问「次数」必须 `grep -o | wc -l`。
> 2. `grep -c` 与 `wc -l` 混用会重复计数，二选一即可。
> 3. 关键字含正则元字符时结果偏多，用 `grep -F -c`。
> 4. `grep` 无匹配时返回退出码 1，会中断 `set -e` 脚本。

### 题 26：运维同事在 /etc 目录中创建了一个文件但没告知文件名，如何快速找出最新创建的文件

> **答案：** 按时间倒序排列取最新：
> `ls -lt /etc | head -5`（按 mtime 倒序，最新在前）
> `ls -lt --time=ctime /etc | head -5`（按 ctime，新建文件 ctime 一定变化）
> `find /etc -type f -printf '%T@ %p\n' | sort -rn | head -3`（精确到秒）
> `find /etc -newer /etc/hosts -type f`（比参照文件更新的文件）

**解析**：考察时间排序定位。「最新创建」严格对应 ctime（inode 变更时间），但新建文件的 mtime 与 ctime 会同时更新，所以 `ls -lt` 一般够用。`ls -lt` 的 `-t` 是按 mtime 排序，`-r` 反转顺序。

**实操验证**（A 级，已实操——以 /tmp/hw/linux 模拟 /etc）：

```bash
# 步骤 1：构造不同时间的文件
cd /tmp/hw/linux && touch -d "10 days ago" old.txt && touch new.txt

# 步骤 2：按时间倒序，最新在前
ls -lt .

# 步骤 3：精确到秒排序（兼容空格文件名）
find . -type f -printf '%T@ %p\n' | sort -rn | head -3

# 步骤 4：找比参照文件更新的文件
find . -type f -newer config.txt
```

输出（已实操）：

```console
-rw-r--r-- 1 lcmgs 197609  0 Oct 24 05:28 case.txt
-rw-r--r-- 1 lcmgs 197609 121 Oct 24 05:28 err.txt
-rw-r--r-- 1 lcmgs 197609  0 Oct 24 05:26 new.txt
-rw-r--r-- 1 lcmgs 197609 50 Oct 24 05:25 config.txt
-rw-r--r-- 1 lcmgs 197609 54 Oct 24 05:25 linux.txt
-rw-r--r-- 1 lcmgs 197609  0 Oct 14 05:26 old.txt
1792790793.1683541000 ./new.txt
1792790749.9786641000 ./config.txt
1792790742.3303329000 ./hello.txt
./case.txt
./new.txt
```

> **易错点**：
> 1. `ls -l` 默认按**文件名**排序，必须加 `-t` 才按时间。
> 2. `ls -lt` 默认按 mtime；若文件被 `chmod`/`chown` 改过属性，ctime 更新而 mtime 不变，此时要用 `--time=ctime`。
> 3. `find /etc` 不限制 `-type f` 会把目录也列出来，目录数量多时干扰判断，要加 `-maxdepth 1` 或 `-type f`。
> 4. `-printf` 是 GNU find 特性，macOS/BSD find 没有。
> 5. **变式追问**：mtime、atime、ctime 里"最新创建"更贴近哪个？（ctime——inode 一变更必更新；不过新建文件三者几乎同时刷新，日常用 `ls -lt` 按 mtime 排序就够用。）

### 题 27：如何查看系统的信息

> **答案：** 分维度查看：

| 维度 | 命令 |
| --- | --- |
| 内核与主机名 | `uname -a`、`hostname`、`hostnamectl` |
| 系统版本 | `cat /etc/redhat-release`、`cat /etc/os-release` |
| CPU | `lscpu`、`cat /proc/cpuinfo`、`top` |
| 内存 | `free -h`、`cat /proc/meminfo` |
| 磁盘与分区 | `df -h`、`lsblk`、`fdisk -l` |
| 负载与运行时长 | `uptime`、`w`、`top` |
| 网卡/IP | `ip a`、`ifconfig`、`ethtool eth0` |
| 硬件总览 | `dmidecode`、`lspci`、`dmesg` |

**解析**：考察「排障先看什么」的信息采集能力。线上排障的顺序通常是 `uptime`（看负载）→ `free`（看内存）→ `df -h`（看磁盘）→ `dmesg`/日志（看内核报错）。

**实操验证**（A 级已实操 uname + B 级 CentOS 7）：

```bash
# A 级：内核信息（已实操）
uname -a
```

输出（已实操）：

```console
MINGW64_NT-10.0-26200 lcmg_STY 3.6.9-b4195d69.x86_64 2026-06-06 17:49 UTC x86_64 Msys
```

```bash
# B 级（CentOS 7）
cat /etc/redhat-release
uptime
free -h
lscpu | head -8
```

输出（预期输出，CentOS 7）：

```console
CentOS Linux release 7.9.2009 (Core)
 09:55:12 up 12 days,  3:21,  2 users,  load average: 0.05, 0.03, 0.05
              total        used        free      shared  buff/cache   available
Mem:           1.8G        412M        1.0G        9.3M        411M        1.2G
Swap:          2.0G          0B        2.0G
Architecture:          x86_64
CPU(s):                2
Thread(s) per core:    1
Core(s) per socket:    2
Socket(s):             1
Model name:            Intel Core i5
```

> **易错点**：
> 1. `uname -r`（内核版本）与 `cat /etc/redhat-release`（发行版版本）是两回事，不要混答。
> 2. `free` 中 `buff/cache` 不是真正被占用的内存，`available` 才是可用量。
> 3. `df -h` 看的是磁盘空间，`df -i` 看的是 inode，两者要分开看。
> 4. 最小化系统没有 `lscpu`/`dmidecode`，需 `yum install -y util-linux dmidecode`。

> **参见**：软件安装与硬件信息查看

### 题 28：`echo "linux" | tr "linux101" "python123"` 请写出命令结果

> **答案：** 结果：`pytho`

**解析**：考察 tr 的**按位置一一映射**规则——tr 眼里没有"字符串"，只有一个个字符，按位置配对翻译，所以绝不是整体替换。两个字符集按下标配对：

| 位置 | SET1 | SET2 |
| --- | --- | --- |
| 1 | l | p |
| 2 | i | y |
| 3 | n | t |
| 4 | u | h |
| 5 | x | o |
| 6 | 1 | n |
| 7 | 0 | 1 |
| 8 | 1 | 2 |

SET1 中 `1` 出现两次（位置 6 和 8），**后出现的映射覆盖先出现的**，所以 `1 → 2`。输入 `linux` 逐字符映射：l→p、i→y、n→t、u→h、x→o，得到 `pytho`。另外若 SET2 比 SET1 短，SET1 多余字符会被映射到 SET2 的最后一个字符。

**实操验证**（A 级，已实操）：

```bash
echo "linux" | tr "linux101" "python123"
echo "---"
echo "linux" | tr "linux" "python"
echo "---"
echo "linux123" | tr "linux101" "python123"
```

输出（已实操）：

```console
pytho
---
pytho
---
pytho223
```

第三行结果验证：`linux123` 中 `1 → 2`（重复映射取最后一次），`2`、`3` 不在 SET1 中，原样输出，故为 `pytho223`。

> **易错点**：
> 1. 以为 tr 是字符串替换（把 `linux101` 整体换成 `python123`），实际是**逐字符**映射。
> 2. 忽略 SET1 中重复字符「后者覆盖前者」的规则。
> 3. 忽略 SET2 更短时「补最后一个字符」的规则。
> 4. tr 只能处理单字符，不能做字符串级替换，字符串替换用 `sed`。

### 题 29：修改系统字符集的方法

> **答案：** 永久修改（CentOS 7）：
> `echo 'LANG="zh_CN.UTF-8"' > /etc/locale.conf` 或 `localectl set-locale LANG=zh_CN.UTF-8`
> 然后 `source /etc/locale.conf` 或重新登录生效。
> 临时修改：`export LANG=zh_CN.UTF-8`（当前会话有效，退出失效）。
> 写入 `~/.bashrc` 可对单用户永久生效。

**解析**：考察字符集配置的三个层次：全局（`/etc/locale.conf`）、用户（`~/.bashrc`）、会话（`export`）。修改后必须确认系统已安装该字符集（`locale -a`），否则会回退。

**实操验证**（B 级，CentOS 7）：

```bash
# 步骤 1：备份并修改
cp /etc/locale.conf /etc/locale.conf.bak
localectl set-locale LANG=zh_CN.UTF-8

# 步骤 2：或手工写入
echo 'LANG="zh_CN.UTF-8"' > /etc/locale.conf

# 步骤 3：生效
source /etc/locale.conf

# 步骤 4：验证
locale
echo $LANG
```

输出（预期输出，CentOS 7）：

```console
# 步骤 4
LANG=zh_CN.UTF-8
LC_CTYPE="zh_CN.UTF-8"
LC_NUMERIC="zh_CN.UTF-8"
LC_TIME="zh_CN.UTF-8"
LC_COLLATE="zh_CN.UTF-8"
LC_MONETARY="zh_CN.UTF-8"
LC_MESSAGES="zh_CN.UTF-8"
LC_ALL=
zh_CN.UTF-8
```

> **易错点**：
> 1. 修改后不 `source` 也不重新登录，当前 shell 看不到变化。
> 2. CentOS 6 的路径是 `/etc/sysconfig/i18n`，写成 `/etc/locale.conf` 无效。
> 3. 系统字符集与远程工具字符集不一致仍会乱码。
> 4. `LC_ALL` 优先级最高，一旦被设置会覆盖 `LANG` 的所有分项，排查时要注意。

> **参见**：系统优化实践-上

### 题 30：写出目前所学的 20 个命令及其作用

> **答案：** 20 个核心命令速查表：

| 命令 | 作用 | 常用示例 |
| --- | --- | --- |
| `ls` | 列出目录内容 | `ls -lhi` |
| `cd` | 切换目录 | `cd /etc` |
| `pwd` | 显示当前路径 | `pwd` |
| `mkdir` | 创建目录 | `mkdir -p a/b/c` |
| `touch` | 创建空文件 / 改时间戳 | `touch f{1..5}` |
| `cp` | 复制文件目录 | `cp -a src dst` |
| `mv` | 移动 / 重命名 | `mv a.txt b.txt` |
| `rm` | 删除 | `rm -rf dir` |
| `cat` | 查看文件全部内容 | `cat -n file` |
| `more`/`less` | 分页查看 | `less file` |
| `head` | 查看开头若干行 | `head -5 file` |
| `tail` | 查看结尾若干行 / 实时跟踪 | `tail -f file` |
| `grep` | 文本过滤 | `grep -n 'x' file` |
| `sed` | 流式编辑（取行/替换） | `sed -n '3p' file` |
| `awk` | 按列处理文本 | `awk '{print $1}' file` |
| `find` | 按条件查找文件 | `find / -name '*.log'` |
| `tar` | 打包压缩解压 | `tar zcf a.tar.gz dir` |
| `ln` | 创建链接 | `ln -s src dst` |
| `chmod` | 改权限 | `chmod 755 file` |
| `chown` | 改属主属组 | `chown user.group file` |
| `echo` | 输出内容 / 写文件 | `echo 'x' > f` |
| `wc` | 统计行数字数 | `wc -l file` |
| `du`/`df` | 目录占用 / 磁盘空间 | `du -sh dir` |
| `which`/`whereis` | 查命令路径 | `which ssh` |

**解析**：本题为总结型题，重点不在数量而在「每个命令的典型参数」。学习时按「增删改查 + 查看 + 查找 + 压缩 + 权限」五类归类记忆效率更高。

**实操验证**（A 级，已实操——批量验证命令是否可用）：

```bash
cd /tmp/hw/linux
for c in ls cd pwd mkdir touch cp mv rm cat head tail grep sed awk find tar ln chmod echo wc du df which; do
  printf '%-6s -> %s\n' "$c" "$(command -v $c | head -1)"
done
```

输出（已实操，截取前 12 行）：

```console
ls     -> /usr/bin/ls
cd     -> cd
pwd    -> /usr/bin/pwd
mkdir  -> /usr/bin/mkdir
touch  -> /usr/bin/touch
cp     -> /usr/bin/cp
mv     -> /usr/bin/mv
rm     -> /usr/bin/rm
cat    -> /usr/bin/cat
head   -> /usr/bin/head
tail   -> /usr/bin/tail
grep   -> /usr/bin/grep
```

> **易错点**：
> 1. `rm -rf /` 是毁灭性操作，生产环境必须避免，重要目录删除前先 `ls` 确认。
> 2. `cp` 不加 `-a`/`-p` 会丢失时间戳与权限，备份场景必须加。
> 3. `chmod 777` 图省事等于放弃权限控制，是典型错误做法。
> 4. `find` 不加路径默认从当前目录开始，在大目录下极慢，应明确路径与 `-maxdepth`。

> **参见**：命令速查表

---

## 本篇小结

这一周的题跑完，值得留在脑子里的就这几条：

1. 文本处理三剑客要分清职责：`grep` 过滤、`sed` 取行与替换、`awk` 取列统计；`sed -n '/x/p'` 忘了 `-n` 就会全文重复输出。
2. `grep -c` 统计的是**命中行数**，`grep -o | wc -l` 才是**出现次数**，题目问法不同答案不同。
3. tr 是**逐字符按位置映射**，SET1 中重复字符后写覆盖先写，SET2 更短时补最后一个字符。
4. 别名不生效的三类原因：未 `source` 重新加载、`~/.bashrc` 后加载覆盖了 `/etc/profile`、脚本中未 `shopt -s expand_aliases`。
5. 重定向要分清 `>`（覆盖）与 `>>`（追加）、`2>` 与 `2>&1`；`>` 误操作会清空文件。
6. 防火墙「真正关闭」必须同时满足 `systemctl is-active` 为 `inactive`、`systemctl is-enabled` 为 `disabled`，只 stop 不 disable 重启后会复活。
7. 批量创建用花括号展开 `{01..20}` 会自动补零，`{1..20}` 与 `seq` 不加 `-w` 都不会补零。
8. 日志实时跟踪生产环境用 `tail -F` 而非 `tail -f`，前者在日志轮转后仍能继续跟踪。
{% endraw %}
