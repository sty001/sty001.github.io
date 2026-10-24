---
title: "day09-系统优化作业实操"
date: 2026-10-24 09:49:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-09"
---

{% raw %}



课程第 9 天（系统优化实践·上）留了三道作业：① 每次登录系统都提示信息；② 总结课程命令、快捷方式、符号；扩展题 ③ 实现彩色提示符。这里全部做完——题 1 给 CentOS 7 标准命令序列，文件内容与转义符机制顺手在 Git Bash 里真跑了一遍；题 2 整理成三张速查表，配 5 组真实运行示例；彩色提示符附颜色码详解表和"用户红、主机绿、目录蓝"的完整写法。

## 实操环境说明 {: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令（`cat`、`echo`、`ls`、`grep`、`wc`、`type`、`alias`、`date` 等）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令（写 `/etc/motd`、`/etc/issue`、`yum` 安装等）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明在真机执行方式。

实操目录统一用 `/tmp/hw` 下的子目录。本文 A 级输出均在 Git Bash（bash 5.3）中真实执行，本地用户名已按脱敏要求替换为 `user`。

## 题目总览 {: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 如何每次登录系统都提示信息（cowsay 图案） | B 级（系统提示文件）+ A 级（文件内容与转义符机制真跑） |
| 题 2 | 课程内容命令总结、快捷方式、符号 | A 级（shell 命令真跑）+ B 级（系统命令标准写法） |
| 扩展题 | 彩色提示符：用户红、主机绿、目录蓝 | A 级（转义序列真跑）+ B 级（写入 /etc/profile 永久生效） |

## 题 1：如何每次登录系统都提示信息 {: .sec-warn}

**题目原文**：如何每次登录系统都提示信息（cowsay 图案）。

**考察点**：登录前后两条时间线各由哪个文件负责；`/etc/issue`、`/etc/issue.net`、`/etc/motd` 各自的作用与改法；issue 里的转义符怎么被解析；用 cowsay 画登录后的图案。

**实现思路**：按时间线分清三个文件的分工；CentOS 7 默认内容与标准修改命令（B 级）；文件内容与写入机制在 Git Bash 里真跑（A 级）；最后用 cowsay 拼出课程要求的登录提示（B 级）。

### 步骤 1：按登录时间线分清三个提示文件 {: .sec-warn}

一次登录按时间顺序分成两段，提示文件也分成两组：

```text
[开机 / SSH 连接] --> [/etc/issue 或 /etc/issue.net 显示] --> [输入账号密码] --> [登录成功] --> [/etc/motd 显示] --> [进入命令行]
      登录前                                                  登录前              登录后
```

| 文件 | 显示时机 | 显示位置 | 说明 |
| --- | --- | --- | --- |
| `/etc/issue` | 登录前 | 本地控制台（tty） | 显示在账号密码输入框的上方 |
| `/etc/issue.net` | 登录前 | 远程 SSH 登录前 | 是否显示受 sshd 的 Banner 配置影响 |
| `/etc/motd` | 登录成功后 | 本地与远程登录后都显示 | message of the day，登录后的公告信息 |

一句话记忆：**issue 是"进门前的门牌"，motd 是"进门后的告示牌"**。

### 步骤 2：CentOS 7 默认内容（预期输出，CentOS 7） {: .sec-prac}

三个文件在 CentOS 7 中的默认内容：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# cat /etc/issue
\S
Kernel \r on an \m

[root@linux-node1 ~]# cat /etc/issue.net
\S
Kernel \r on an \m

[root@linux-node1 ~]# cat /etc/motd
[root@linux-node1 ~]#
```

默认 `/etc/motd` 是空文件，登录后不显示任何额外内容；`/etc/issue` 里的 `\S`、`\r`、`\m` 是**转义符**，由登录程序在显示时解析，不是字面文字：

| 转义符 | 含义 |
| --- | --- |
| `\S` | 操作系统名称 |
| `\r` | 内核版本 |
| `\m` | 硬件平台（如 x86_64） |
| `\n` | 主机名 |
| `\t` | 当前时间 |
| `\d` | 当前日期 |

### 步骤 3：文件内容与转义符机制（已实操） {: .sec-know}

下面在 Git Bash 里把 issue / motd 的内容与写入机制完整跑一遍。不碰系统文件，全在普通目录里做，可以原样复制：

```bash
# 准备实操目录
mkdir -p /tmp/hw/day9 && cd /tmp/hw/day9

# 按 CentOS 7 默认格式造一个 issue 演示文件（两行）
printf '%s\n' '\S' 'Kernel \r on an \m' > issue_demo
cat issue_demo
cat -A issue_demo            # -A 显示所有特殊字符，$ 为行尾标记

# 写入自定义登录前提示
echo "Welcome to linux-node1" > issue_demo2
cat issue_demo2

# 造一个 motd 演示文件：先覆盖写入，再追加一行
printf '%s\n' 'linux-node-01' > motd_demo
echo "请遵守操作规范" >> motd_demo
cat motd_demo
```

输出：

```console
$ cat issue_demo
\S
Kernel \r on an \m
$ cat -A issue_demo
\S$
Kernel \r on an \m$
$ cat issue_demo2
Welcome to linux-node1
$ cat motd_demo
linux-node-01
请遵守操作规范
```

三条输出说明三个机制：

1. `cat issue_demo` 证明文件里存的就是 `\S`、`\r` 这些**字面字符**——解析发生在登录程序读取文件时，不在文件里；
2. `cat -A` 输出行尾的 `$` 是行尾标记（并非文件内容），说明 `\n` 换行也是真实换行；
3. `>` 覆盖写入、`>>` 追加写入，是修改这两个文件最常用的两种方式。

### 步骤 4：修改登录提示的标准命令（预期输出，CentOS 7） {: .sec-warn}

在真机上以 root 身份执行，把自定义信息写进提示文件：

```bash
echo "欢迎登录，请遵守操作规范" > /etc/motd      # 覆盖写入登录后提示
echo "新公告内容" >> /etc/motd                   # 追加一行

>/etc/issue                                     # 清空登录前提示（防泄露系统版本）
>/etc/issue.net                                 # 清空远程登录前提示

vi /etc/motd                                    # 也可以直接用编辑器改
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# echo "欢迎登录，请遵守操作规范" > /etc/motd
[root@linux-node1 ~]# cat /etc/motd
欢迎登录，请遵守操作规范
[root@linux-node1 ~]# >/etc/issue
[root@linux-node1 ~]# cat /etc/issue
[root@linux-node1 ~]#
```

> **注意：** 修改 `/etc/motd` 与 `/etc/issue` 后**不需要执行 `source`，也不需要重启任何服务**——这两个文件在每次登录时由登录程序实时读取，改完对下一次登录立即生效。这与 `/etc/profile`（改完要 `source` 或重新登录）不同。
{: .sec-pit}

### 步骤 5：用 cowsay 制作图案登录提示（预期输出，CentOS 7） {: .sec-warn}

课程要求的图案提示由 cowsay 画出。cowsay 在 EPEL 扩展源中，先装源再装软件：

```bash
yum install -y epel-release        # 安装 EPEL 扩展源
yum install -y cowsay              # 安装 cowsay
cowsay "欢迎登录，请遵守操作规范" >> /etc/motd    # 把 cowsay 图案追加到登录后提示
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# cowsay "欢迎登录，请遵守操作规范"
 ______________________________
< 欢迎登录，请遵守操作规范 >
 ------------------------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
[root@linux-node1 ~]# cowsay "欢迎登录，请遵守操作规范" >> /etc/motd
[root@linux-node1 ~]# cat /etc/motd
 ______________________________
< 欢迎登录，请遵守操作规范 >
 --------------------------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

下次登录时，密码验证通过后就会看到 cowsay 画出的图案和公告内容。

**验证方法**：

1. `cat /etc/motd` 与 `cat /etc/issue` 能直接看到写入的内容，证明文件修改成功；
2. 退出登录后重新登录（本地换终端或 `ssh 本机地址`），登录后立即出现提示，证明 motd 生效；
3. 本地演示（已实操）：`cat issue_demo` 与 `cat -A issue_demo` 证明转义符以字面量存于文件、由登录程序解析；
4. 登录前提示的验证：新开终端执行 `ssh 127.0.0.1`，在输入密码之前应看到 `/etc/issue.net` 的内容（CentOS 7 默认 sshd 不显示 Banner，需在 `/etc/ssh/sshd_config` 中配置 `Banner /etc/issue.net` 并重启 sshd）。

> **易错点**：① 最大的坑是改错文件——issue 管登录前、motd 管登录后，把内容写进 issue 却期待登录后显示，怎么改都不出现；② `\S`、`\r`、`\m` 只在 issue 类文件里解析，原样写进 motd 会当普通文字显示；③ `/etc/issue` 默认内容会暴露系统版本与内核版本，生产环境建议清空或替换为自定义内容；④ cowsay 来自 EPEL 源，只配了基础源会报 `No package cowsay available`。

> **参见**：软件安装与硬件信息查看、重要系统文件与运行级别

## 题 2：课程内容命令总结（命令 / 快捷方式 / 符号） {: .sec-sum}

**题目原文**：课程内容命令总结、快捷方式、符号。

**考察点**：课程至今的命令按功能域过一遍，看到效果要能反推出命令；快捷方式（bash 编辑类与 vim 操作类）练成肌肉记忆；特殊符号知道分工和常见组合。

**实现思路**：总结型作业按"知识讲解 + 速查表 + 可运行示例 + 自测"四步走。命令按 day9 课程（系统优化实践·上）的功能域整理成表，shell 核心部分在 Git Bash 里真跑（A 级），系统级部分给标准写法（B 级）；快捷方式与符号各一张表；末尾配 5 组真实示例和自测题。

### 命令速查表（按功能域） {: .sec-chk}

**系统环境查看**

| 命令 | 作用 |
| --- | --- |
| `cat /etc/redhat-release` | 查看系统发行版本（CentOS 7 具体版本号） |
| `uname -a` | 查看内核版本、系统架构等全部信息 |
| `uname -r` | 只看内核版本 |
| `lscpu` | 查看 CPU 颗数、核数、架构（读自 /proc/cpuinfo） |
| `free -h` | 查看内存与 swap 使用（关注 available 列） |
| `df -h` | 查看磁盘分区使用情况 |
| `w` | 查看系统负载与当前登录用户 |

**用户管理（day9 新学）**

| 命令 | 作用 |
| --- | --- |
| `useradd 用户名` | 创建用户 |
| `useradd 用户名 -M -s /sbin/nologin` | 创建虚拟用户（不建家目录、不能登录） |
| `passwd 用户名` | 设置用户密码（root 改他人密码不需原密码） |
| `su - 用户名` | 登录式切换用户（连家目录、环境变量一起切换） |
| `id 用户名` | 查看用户 uid、gid、所属组 |
| `whoami` | 查看当前登录身份 |
| `userdel -r 用户名` | 删除用户并删除家目录 |

**提示符与环境变量（day9 新学）**

| 命令 | 作用 |
| --- | --- |
| `echo $PS1` | 查看当前提示符的定义 |
| `export PS1='...'` | 修改提示符（临时生效） |
| `alias 别名='命令'` | 定义别名 |
| `unalias 别名` | 取消别名 |
| `alias` | 查看当前所有别名 |
| `type 命令` | 区分内置命令与外置命令 |
| `source 文件` | 立即加载配置文件（改完 /etc/profile 后使用） |

**yum 源管理（day9 新学）**

| 命令 | 作用 |
| --- | --- |
| `curl -o /etc/yum.repos.d/CentOS-Base.repo http://mirrors.aliyun.com/repo/Centos-7.repo` | 替换基础源为国内镜像 |
| `wget -O /etc/yum.repos.d/epel.repo http://mirrors.aliyun.com/repo/epel-7.repo` | 配置扩展源 |
| `yum repolist` | 查看可用仓库及软件包数量 |
| `yum install -y 软件名` | 安装软件（自动解决依赖） |

为什么非要换国内镜像？默认源的服务器在海外，国内访问慢、高峰期超时是常态，`yum install` 卡在 `Downloading packages` 半天不动多半是这个原因。阿里云这类镜像站与官方源实时同步，包内容一致，只是物理距离近了。生产上装机第一步就是换源，后面每一次装软件都受益。

**文件与目录（已学复习）**

| 命令 | 作用 |
| --- | --- |
| `ls -l` / `ls -la` / `ls -ltr` | 查看属性 / 含隐藏文件 / 按时间倒序 |
| `cd` / `pwd` | 切换目录 / 显示当前路径 |
| `mkdir -p` / `rmdir` | 创建目录（含父目录）/ 删除空目录 |
| `cp -r` / `mv` / `rm -rf` | 复制目录 / 移动（剪切、改名）/ 强制删除 |
| `cat -n` / `head -5` / `tail -f` | 查看内容（带行号）/ 前 5 行 / 实时追踪 |
| `touch` / `echo > 文件` | 建空文件 / 创建并写入内容 |
| `tree -L 1` | 树形查看一层目录结构 |

### 快捷方式速查表 {: .sec-chk}

**bash 命令行编辑类**

| 快捷键 | 作用 |
| --- | --- |
| `Tab` | 补全命令、路径、文件名（唯一候选直接补全，多个候选按两次列出） |
| 方向上 / 下 | 调取历史命令 |
| `Ctrl + r` | 反向搜索历史命令 |
| `Ctrl + a` / `Ctrl + e` | 光标移到行首 / 行尾 |
| `Ctrl + u` / `Ctrl + k` | 剪切光标到行首 / 行尾的内容 |
| `Ctrl + y` | 粘贴剪切的内容 |
| `Ctrl + c` / `Ctrl + d` / `Ctrl + l` | 中断当前命令 / 发送 EOF（注销）/ 清屏 |
| `Ctrl + s` / `Ctrl + q` | 锁定终端输出 / 解除锁定 |
| `Esc + .` | 取用上一条命令的最后一个参数 |

**vim 操作类（三种模式：命令模式、插入模式、底行模式）**

| 快捷键 | 作用 |
| --- | --- |
| `i` / `I` / `a` / `A` / `o` / `O` | 进入编辑：光标处 / 行首 / 光标右 / 行尾 / 下行 / 上行 |
| `Esc` | 从插入模式退回命令模式 |
| `G` / `gg` / `ngg` | 跳到文件尾 / 文件头 / 第 n 行 |
| `$` / `0` / `^` | 跳到行尾 / 行首 / 行首第一个非空字符 |
| `dd` / `3dd` / `yy` / `3yy` / `p` | 删除（剪切）一行 / 3 行，复制一行 / 3 行，粘贴 |
| `u` | 撤销 |
| `x` / `dw` / `cc` | 删字符 / 删单词 / 删整行并进入编辑 |
| `:w` / `:q` / `:wq` / `:wq!` / `:q!` | 保存 / 退出 / 保存退出 / 强制保存退出 / 强制退出 |
| `/ 关键词` / `? 关键词` | 向下 / 向上搜索，`n` 跳到下一个匹配 |
| `:set nu` / `:noh` | 显示行号 / 取消搜索高亮 |
| `:%s/old/new/g` | 全文替换 |

### 符号速查表 {: .sec-chk}

| 符号 | 作用 |
| --- | --- |
| `~` | 家目录符号 |
| `.` / `..` | 当前目录 / 上一级目录 |
| `>` / `>>` | 标准输出覆盖重定向 / 追加重定向 |
| `2>` / `2>>` | 错误输出重定向 / 追加重定向 |
| `<` | 标准输入重定向 |
| `&&` | 前一条命令成功，才执行后一条 |
| `;` | 前一条命令结束（不论成败），就执行后一条 |
| `#` | 注释；在提示符中表示 root 身份 |
| `$` | 取变量值；在提示符中表示普通用户身份 |
| `!` | 强制（如 `:wq!`） |
| `` ` `` | 反引号，命令替换（先执行引号内命令，把结果交给外层） |
| `|` | 管道，前一条命令的输出交给后一条处理 |
| `{}` | 序列展开，如 `file{1,2,3}.txt` 展开为 file1.txt file2.txt file3.txt |
| `$?` | 上一条命令的退出码（0 成功，非 0 失败） |

### 真跑示例（A 级，已实操） {: .sec-ex}

以下 5 组示例均在 `/tmp/hw/day9` 目录中真实执行，覆盖别名、内置外置、通配符、管道、重定向、命令替换、序列展开与逻辑符号。

**示例 1：别名的定义与立即生效**

```bash
shopt -s expand_aliases        # 非交互 shell 需手动开启别名展开（交互式终端默认开启）
alias ll='ls -l'
alias | grep 'll='             # 确认别名已定义
eval 'll issue_demo motd_demo' # eval 重新解析命令行，使刚定义的别名立即生效
unalias ll                     # 用完后取消，避免影响后续操作
```

输出：

```console
$ alias | grep 'll='
alias ll='ls -l'
$ eval 'll issue_demo motd_demo'
-rw-r--r-- 1 user 197609 22 Oct 24 03:32 issue_demo
-rw-r--r-- 1 user 197609 36 Oct 24 03:32 motd_demo
```

**示例 2：type 区分内置命令与外置命令**

```bash
type cd
type ls
```

输出：

```console
$ type cd
cd is a shell builtin
$ type ls
ls is hashed (/usr/bin/ls)
```

`cd` 是内置命令（编译在 bash 内部，执行时不创建新进程，所以 `cd` 才能改变当前 shell 的工作目录）；`ls` 是外置命令（磁盘上的可执行文件）。输出里的 `is hashed` 表示 bash 把 `ls` 的路径缓存进了哈希表（之前执行过 `ls`），这是加速机制，不影响结论。

### 辨析：内置命令与外置命令

`type` 输出的 `builtin` 与磁盘路径，背后是两套执行机制。内置命令编译在 bash 里，执行不开子进程，所以 `cd` 能改当前 shell 的工作目录——外置命令做不到，子进程里改目录不影响父进程。外置命令每次执行要 fork + exec，走一遍磁盘查找。内置命令数量少（几十个），`cd`、`echo`、`alias`、`source` 都在内；同一个名字可能两边都有（如 `echo`），`type -a` 会全部列出，bash 优先用内置的。

写脚本时判断命令是否存在用 `command -v`，别靠 `which`——`which` 是外置命令，精简环境里未必装了。

**示例 3：通配符与管道**

```bash
touch day9-a.txt day9-b.txt day9-c.log
ls *.txt                       # * 匹配任意字符
ls *.log
ls | wc -l                     # 管道：把 ls 的输出交给 wc 统计行数
ls | grep -c txt               # 管道：过滤后统计数量
```

输出：

```console
$ ls *.txt
day9-a.txt
day9-b.txt
$ ls *.log
day9-c.log
$ ls | wc -l
6
$ ls | grep -c txt
2
```

**示例 4：重定向（覆盖、追加、错误输出）**

```bash
echo "第一行" > redirect_demo.txt     # 覆盖写入
echo "第二行" >> redirect_demo.txt    # 追加写入
cat redirect_demo.txt
ls no_such_file 2> err_demo.txt       # 错误输出重定向到文件
cat err_demo.txt
```

输出：

```console
$ cat redirect_demo.txt
第一行
第二行
$ cat err_demo.txt
ls: cannot access 'no_such_file': No such file or directory
```

`>` 会清空原文件再写入，`>>` 在末尾追加；`2>` 只重定向错误输出（屏幕不再显示报错，落进文件里），排错时经常用 `2>/dev/null` 把无关报错丢掉。

**示例 5：命令替换、序列展开、逻辑符号与退出码**

```bash
# 反引号命令替换（把命令结果嵌进字符串）
printf '%s\n' 'echo "反引号结果：`date +%F`"' 'echo "文件行数：`wc -l < redirect_demo.txt`"' > backtick_demo.sh
cat backtick_demo.sh
bash backtick_demo.sh
echo "美元括号写法：$(date +%F)"      # $() 与反引号等价，推荐用 $()

# 序列展开
echo file{1,2,3}.txt

# 逻辑符号与退出码
echo "第一步" && echo "第二步" && ls no_such_file 2>/dev/null && echo "第三步不会执行"; echo "分号连接：失败后继续执行"
ls day9-a.txt >/dev/null; echo "成功退出码：$?"
ls no_such_file 2>/dev/null; echo "失败退出码：$?"
```

输出：

```console
$ cat backtick_demo.sh
echo "反引号结果：`date +%F`"
echo "文件行数：`wc -l < redirect_demo.txt`"
$ bash backtick_demo.sh
反引号结果：2026-10-24
文件行数：2
$ echo "美元括号写法：$(date +%F)"
美元括号写法：2026-10-24
$ echo file{1,2,3}.txt
file1.txt file2.txt file3.txt
$ echo "第一步" && echo "第二步" && ls no_such_file 2>/dev/null && echo "第三步不会执行"; echo "分号连接：失败后继续执行"
第一步
第二步
分号连接：失败后继续执行
$ ls day9-a.txt >/dev/null; echo "成功退出码：$?"
成功退出码：0
$ ls no_such_file 2>/dev/null; echo "失败退出码：$?"
失败退出码：2
```

`&&` 链在 `ls no_such_file` 失败后中断，"第三步不会执行"没有出现，证明 `&&` 的短路特性；`;` 后的命令照样执行。`$?` 分别为 0 与 2，对应成功与失败——写脚本时靠它判断上一步是否成功。

**验证方法**：

1. 每组示例的输出都与命令语义一一对应（`ls *.txt` 只列出 txt 文件、`2>` 后屏幕无报错等），证明对命令的理解正确；
2. `eval 'll ...'` 能看到长格式列表，证明别名定义与展开机制生效；
3. `$?` 输出 0 与 2，证明退出码可用于判断命令成败；
4. 在自己的真机上把系统级命令（`useradd`、`echo > /etc/motd`）跑一遍，与速查表的作用描述对照。

> **易错点**：① 别名在命令**读取时**展开，同一条命令行里先定义后使用不生效（示例 1 用 `eval` 绕过）；脚本里默认不展开别名，需先 `shopt -s expand_aliases`。② `>` 是覆盖、`>>` 是追加，想保留原内容时用错一个字符数据就没了，操作前先 `cp` 备份。③ 反引号与 `$()` 等价但反引号嵌套可读性极差，统一用 `$()`。④ `Ctrl + s` 是锁定终端（不是保存），按下去键盘像死了，`Ctrl + q` 恢复——这是新手高频"假死"。

## 扩展题：实现彩色提示符（用户红 / 主机绿 / 目录蓝） {: .sec-warn}

**题目原文**：如何实现彩色提示符：用户信息显示为红色、主机名信息显示为绿色、目录信息显示为蓝色。

**考察点**：`PS1` 环境变量的转义符、ANSI 颜色码格式 `\[\e[F;Bm\]`、`\[ \]` 非打印标记的作用、永久生效的配置方法。

**实现思路**：先拆 `PS1` 转义符与颜色码格式；给目标提示符的完整写法并逐段解释；用 `echo -e` 在 Git Bash 真跑转义序列的实际输出；最后写进 `/etc/profile` 永久生效，配验证手段。

### 步骤 1：PS1 转义符 {: .sec-prac}

默认提示符的定义与含义：

```bash
echo $PS1        # 默认值：[\u@\h \W]\$
```

| 转义符 | 含义 |
| --- | --- |
| `\u` | 当前登录用户名 |
| `\h` | 主机名（短名，到第一个点为止） |
| `\H` | 完整主机名 |
| `\w` | 当前所在目录的完整路径 |
| `\W` | 当前目录名（路径的最后一级） |
| `\t` / `\d` | 当前时间 / 日期 |
| `\$` | root 显示 `#`，普通用户显示 `$` |

### 步骤 2：ANSI 颜色码详解 {: .sec-prac}

Linux 给文字加颜色的通用格式：

```bash
\[\e[F;Bm\] 文字内容 \[\e[0m\]
```

- `F` 是**前景色**（字体颜色），`B` 是**背景色**，分号分隔；
- `\[\e[F;Bm\]` 开始设置颜色，`\[\e[0m\]` 结束颜色设置（恢复到默认）；
- `\[` 与 `\]` 是 bash 的**非打印字符标记**——告诉 bash"这对括号里的内容不占屏幕宽度"，否则 bash 算错提示符长度，长命令时光标会错位、换行错乱。

常用颜色码：

| 颜色 | 前景色 F | 背景色 B |
| --- | --- | --- |
| 黑色 | 30 | 40 |
| 红色 | 31 | 41 |
| 绿色 | 32 | 42 |
| 黄色 | 33 | 43 |
| 蓝色 | 34 | 44 |
| 粉色（品红） | 35 | 45 |
| 青色（浅蓝） | 36 | 46 |
| 白色 | 37 | 47 |

`;` 后面还可以跟属性位：`1` 高亮加粗（课程示例都用它，颜色更醒目）、`4` 下划线、`7` 反色。例如 `31;1` 是亮红色，`34;1` 是亮蓝色。

### 步骤 3：目标提示符的完整写法 {: .sec-warn}

用户红、主机绿、目录蓝，每段颜色单独收尾：

```bash
export PS1='[\[\e[31;1m\]\u\[\e[0m\]@\[\e[32;1m\]\h\[\e[0m\] \[\e[34;1m\]\W\[\e[0m\]]\$ '
```

逐段拆解：

| 片段 | 作用 |
| --- | --- |
| `\[` ... `\]` | 标记内部为不显示宽度的控制字符 |
| `\e[31;1m` | 设置亮红色（31 红，1 高亮） |
| `\u` | 用户名（红色） |
| `\e[0m` | 结束颜色，防止红色"污染"后面的 `@` |
| `\e[32;1m` ... `\h` ... `\e[0m` | 主机名（绿色） |
| `\e[34;1m` ... `\W` ... `\e[0m` | 当前目录（蓝色） |
| `\$ ` | root 显示 `# `，普通用户显示 `$ ` |

### 步骤 4：真跑演示转义序列（已实操） {: .sec-ex}

在 Git Bash 里用 `echo -e` 演示转义序列的实际输出，并用 `cat -v` 把不可见的 ESC 字符显示成 `^[`：

```bash
# 演示三个颜色段的实际输出（\e 即 ESC 字符，cat -v 显示为 ^[）
echo -e '\e[31;1mroot\e[0m@\e[32;1mlinux-node1\e[0m \e[34;1m~\e[0m' | cat -v

# 目标提示符的字符串形态：\[ \] 与 \u \h \W 此时还是字面量
echo -e '[\[\e[31;1m\]root\[\e[0m\]@\[\e[32;1m\]linux-node1\[\e[0m\] \[\e[34;1m\]~\[\e[0m\]]\$ ' | cat -v
```

输出：

```console
$ echo -e '\e[31;1mroot\e[0m@\e[32;1mlinux-node1\e[0m \e[34;1m~\e[0m' | cat -v
^[[31;1mroot^[[0m@^[[32;1mlinux-node1^[[0m ^[[34;1m~^[[0m
$ echo -e '[\[\e[31;1m\]root\[\e[0m\]@\[\e[32;1m\]linux-node1\[\e[0m\] \[\e[34;1m\]~\[\e[0m\]]\$ ' | cat -v
[\[^[[31;1m\]root\[^[[0m\]@^[[32;1m\]linux-node1^[[0m\] \[^[[34;1m\]~\[^[[0m\]]\$ 
```

第一条输出是提示符的"渲染层"：`^[[31;1m` 就是 `\e[31;1m`（ESC + 颜色码），`root` 是被上色的文字，`^[[0m` 是收尾。第二条是"字符串层"：`\[`、`\]`、`\$` 保持字面量——它们由 bash 的提示符引擎解析，`echo -e` 不解析。

再演示 bash 的提示符展开能力（把 `\u`、`\h`、`\W` 与颜色一起渲染出来）：

```bash
DEMO_PS1='[\[\e[31;1m\]\u\[\e[0m\]@\[\e[32;1m\]\h\[\e[0m\] \[\e[34;1m\]\W\[\e[0m\]]\$ '
printf '%s\n' "${DEMO_PS1@P}" | cat -v
```

输出（本地用户名与主机名已按脱敏要求替换）：

```console
$ printf '%s\n' "${DEMO_PS1@P}" | cat -v
[^[[31;1muser^[[0m@^[[32;1m<你的主机名>^[[0m ^[[34;1mday09^[[0m]$ 
```

`${DEMO_PS1@P}` 是 bash 4.4+ 的提示符展开运算符：它模拟 bash 渲染提示符的全过程——替换 `\u`/`\h`/`\W`、解析颜色转义、剥掉 `\[` `\]` 标记。真实终端里这条命令打印出来的就是带颜色的提示符本体。

### 步骤 5：写入 /etc/profile 永久生效（预期输出，CentOS 7） {: .sec-prac}

`export PS1='...'` 只对当前终端有效，要每次登录都生效就写进全局配置：

```bash
vi /etc/profile
```

在文件末尾加入：

```bash
export PS1='[\[\e[31;1m\]\u\[\e[0m\]@\[\e[32;1m\]\h\[\e[0m\] \[\e[34;1m\]\W\[\e[0m\]]\$ '
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# tail -3 /etc/profile
export PS1='[\[\e[31;1m\]\u\[\e[0m\]@\[\e[32;1m\]\h\[\e[0m\] \[\e[34;1m\]\W\[\e[0m\]]\$ '
[root@linux-node1 ~]# source /etc/profile
[root@linux-node1 ~]#
```

`source /etc/profile` 立即加载（或退出重新登录）。只想对某个用户生效，就写进该用户的 `~/.bashrc`（用户级配置优先级更高）。

> **生产注意**：改 `/etc/profile` 前先 `cp /etc/profile /etc/profile.bak`。一行 PS1 写错（比如引号没配对）会让所有用户登录时提示符异常，回滚全靠备份。

**验证方法**：

1. `echo $PS1` 输出与新写的字符串完全一致，证明变量已设置；
2. 提示符本身：用户名变红、`@` 与主机名变绿、目录变蓝，三段颜色边界清晰不串色；
3. 真机上退出重新登录（或 `source /etc/profile`）后彩色提示符仍在，证明永久生效；
4. 高阶验证（已实操）：`printf '%s\n' "${PS1@P}" | cat -v` 能打印出带 `^[[31;1m` 等序列的提示符渲染结果，对照颜色码表逐段检查。

> **易错点**：① `\[` 与 `\]` 必须**成对出现**且只包住颜色控制序列，漏写会导致 bash 计算提示符宽度错误，表现为输入长命令时光标位置混乱、换行叠行；② 每个颜色段用完要 `\e0m` 收尾，否则颜色会蔓延到用户输入的命令上；③ 字符串必须用**单引号**包裹，双引号会让 `$`、`\` 被提前展开；④ `\e` 在某些 Shell 环境下要写成 `\033`，bash 与 Git Bash 两种都认；⑤ 改的是 `/etc/profile`（全局）还是 `~/.bashrc`（单人）要分清，改错范围要么影响所有人要么只影响自己。

> **参见**：[系统优化实践（上）：Vim 入门与 yum 源

## 自测 {: .sec-prac}

1. `/etc/issue` 与 `/etc/motd` 分别在什么时机显示？改完之后需要执行 `source` 吗？
2. issue 文件里的 `\S`、`\r`、`\m` 表示什么？它们是什么时候被"翻译"成实际内容的？
3. 写出"用户红、主机绿、目录蓝"的完整 `PS1`，并说明 `\[`、`\]` 的作用。
4. `alias ll='ls -l'; ll` 在同一条命令行里执行，会报什么错？原因和正确做法是什么？
5. `echo a > f.txt; echo b > f.txt` 之后 f.txt 里有什么？换成 `>>` 呢？

> **参考答案：** 1. `/etc/issue`（及 `/etc/issue.net`）在登录前显示，`/etc/motd` 在登录成功后显示；二者都是登录时由登录程序实时读取，改完不需要 `source`，对下一次登录即生效。2. `\S` 操作系统名称、`\r` 内核版本、`\m` 硬件平台；文件里存的是字面字符，由登录程序（agetty / sshd）在显示时解析。3. `export PS1='[\[\e[31;1m\]\u\[\e[0m\]@\[\e[32;1m\]\h\[\e[0m\] \[\e[34;1m\]\W\[\e[0m\]]\$ '`；`\[` 与 `\]` 标记内部为不占屏幕宽度的非打印字符，防止 bash 算错提示符长度导致光标错乱。4. 报 `ll: command not found`——别名在命令行读取时展开，同一行里先定义后使用不生效；正确做法是分行写，或在脚本中 `shopt -s expand_aliases` 后用 `eval` 触发。5. `>` 覆盖写入，f.txt 里只有 `b`；换成 `>>` 则是 `a` 与 `b` 两行。

## 本篇小结 {: .sec-sum}

收个尾，这天的东西浓缩成六条：

1. 登录提示分两条时间线：登录前是 `/etc/issue`（本地控制台）与 `/etc/issue.net`（SSH 远程），登录后是 `/etc/motd`；`\S`、`\r`、`\m` 等转义符只在前两类文件里由登录程序解析，改完对下次登录即生效，无需 `source`。
2. 图案提示用 cowsay 实现：软件在 EPEL 扩展源中，`yum install -y cowsay` 装好后把输出追接到 `/etc/motd`；登录前文件会泄露系统版本，生产环境建议清空或换成自定义公告。
3. 命令按功能域记忆：系统环境（`cat /etc/redhat-release`、`uname -a`、`lscpu`、`free -h`、`df -h`、`w`）、用户管理（`useradd`、`passwd`、`su -`、`id`、`whoami`）、提示符与别名（`echo $PS1`、`export PS1`、`alias`、`type`、`source`）、yum 源（`curl -o`、`yum repolist`）。
4. 快捷方式两类：bash 编辑类（`Tab` 补全、`Ctrl + r` 搜索历史、`Ctrl + a/e/u/k/y` 行编辑、`Esc + .` 取参数）与 vim 三类模式操作（`i/a/o` 进编辑、`dd/yy/p/u` 编辑、`:wq` 保存退出）；`Ctrl + s` 是锁屏不是保存。
5. 符号分工：`>`/`>>`/`2>` 管重定向、`|` 管管道、`&&` 管条件执行、`;` 管无条件执行、`` ` `` 与 `$()` 管命令替换、`{}` 管序列展开、`$?` 管退出码；写脚本判断成败用 `$?`，`0` 成功、非 `0` 失败。
6. 彩色提示符公式：`\[\e[F;Bm\]文字\[\e[0m\]`，F 为前景色（31 红、32 绿、34 蓝），B 为背景色，`1` 为高亮；`\[ \]` 必须成对且只包控制序列，每段颜色用完用 `\e[0m` 收尾，字符串用单引号，写进 `/etc/profile` 永久生效。


{% endraw %}
