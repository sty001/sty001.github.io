---
title: "系统符号、通配符号与基础正则表达式"
date: 2026-10-24 10:28:00 +0800
categories: [软件, Linux, 文件属性与正则]
tags: [Linux, 文件属性与正则]
---

{% raw %}
这一篇分两段：先把 Shell 里常用的系统符号（基础符号、引号、重定向、路径、逻辑符号）和通配符号（`*`、`{}`）梳理清楚，再进入正则表达式——讲清正则与通配符的本质区别，逐个过基础正则符号，最后配齐 grep 的常用参数与退出码。处理文本之前，先把这些符号的地基打牢。

## 课前回顾：文件属性章节

```bash
ll -i /etc/hosts
33584339 -rw-r--r--. 2 root root 192 Apr 15  2019 /etc/hosts
```

| 主题 | 要点 |
| --- | --- |
| inode | 索引节点，存储文件属性信息；磁盘格式化（创建文件系统）时诞生；inode 号码相同则互为硬链接 |
| block | 数据块，存储文件具体内容；同样诞生于创建文件系统时；可根据企业情况调整大小 |
| 文件类型与权限 | 普通文件 `-`、目录文件 `d`、链接文件 `l`（`file` 命令查看），配合 `find`、`tar`、`which`；权限 `r=4` 读、`w=2` 写、`x=1` 执行、`-` 为 0，分属主、属组、其他用户三段 |
| 硬链接 | 作用：读取文件的多个入口；诞生：`ln 源文件 链接文件`；特点：①inode 号码相同 ②源文件删除后链接文件依旧有效 ③目录无法创建硬链接 ④创建出的新目录硬链接数默认为 2 |
| 软链接 | 作用：文件数据的快捷方式；诞生：`ln -s 源文件 链接文件`；特点：①源文件删除后链接文件失效 ②普通文件和目录都可以创建软链接 |
| 属主与属组 | 超级管理员 `root`、虚拟用户 `nobody`、普通用户 |
| 文件时间 | 修改时间 `mtime`、访问时间 `atime`、改变时间 `ctime` |

**企业面试题：如何将数据真正删除？**

1. 确保文件的硬链接数为 0（`i_link`）；
2. 确保文件没有被进程占用（`i_count`）。

面试常追问：rm 之后数据恢复软件为什么还能救回来？因为 rm 只清目录条目、减引用计数，block 里的数据原样躺着，直到被新数据覆盖。反过来，涉密销毁才需要 shred 这类覆写工具。

**按时间查找文件：**

```bash
find /test -type f -mtime +7     # 7 天以前
find /test -type f -mtime -7     # 最近 7 天
find /test -type f -mtime 7      # 正好前面第 7 天
```

时间相关命令：`date` 的使用、`ntpdate` 进行时间同步。

## 为什么要学系统符号

1. 简化操作，例如 `..` `~` `;` `&&`；
2. 进行匹配。

说白了，符号是 Shell 的语法。命令记得再多，符号不过关，一行管道照样拼不出来。匹配这件事，通配符管文件名、正则管内容，两边符号长得像但含义不同——本篇下半段专门掰扯这件事。

## 系统特殊符号

### 基础符号系列

| 符号 | 作用 |
| --- | --- |
| `$` | 美元符号，用于取变量值 |
| `!` | 叹号符号，取反 |
| `\|` | 竖线符号，管道，把前一个命令的执行结果交给后面的命令处理 |
| `xargs` | 将信息进行分组显示，常与管道配合使用 |
| `#` | 井号符号，注释 |

```bash
命令1 | xargs 命令2
```

管道递出去的是"标准输入"，而很多命令（rm、cp、kill）只认"参数"不认标准输入，这个断层就是 xargs 存在的意义。比如清理僵尸进程：`ps aux|grep "defunct"|awk '{print $2}'|xargs kill -9`，就是把查到的 PID 拼成 kill 的参数。

**补充：如何忽略别名功能**

1. 使用命令的绝对路径；
2. 在命令执行前加撬棍（反斜杠 `\`）；
3. `xargs` 后面的命令会自动忽略别名。

别名只对交互式 shell 默认生效，脚本里不用操心；想永久取消某个别名，把定义从 `~/.bashrc` 里删掉。

**查找指定数据并进行批量复制**：查找出 `*.txt` 文件，批量复制到 `/backup` 目录

```bash
# 方式一：将找到的信息放到 cp 和最终目录中间
find /test -type f -name "*.txt"|xargs -i cp {} /backup

# 方式二：利用 cp 的 -t 参数指明谁是数据最终保存的目录
find /test -type f -name "*.txt"|xargs  cp -t /backup
```

**查找指定数据并进行批量移动**：查找出 `*.txt` 文件，批量移动到 `/backup` 目录

```bash
# 方式一
find /test -type f -name "*.txt"|xargs -i mv {} /backup

# 方式二
find /test -type f -name "*.txt"|xargs mv -t /backup
```

### 引号符号系列

| 引号 | 作用 |
| --- | --- |
| `''` | 输出的信息所见即所得，不做任何解析 |
| `""` | 和单引号功能类似，但对特殊信息（变量等）会做解析 |
| `` `` `` / `$()` | 将引号中的命令先执行，把执行结果交给引号外面的命令处理 |
| 没有引号 | 和双引号功能类似，但是可以直接识别通配符信息 |

```bash
[root@linux-node1 test]# echo 'test $LANG $var'
test $LANG $var
[root@linux-node1 test]# echo "test $LANG $var"
test en_US.UTF-8 123        # $var 此前已被赋值为 123
```

引号的另一个价值在变量含空格时：`rm $file` 里 file 是 `my note.txt`，会被拆成两个参数；写成 `rm "$file"` 才安全。原则就一条——变量展开后可能带空格的地方，双引号必须跟上。另外反引号是老写法，与 `$()` 等价但不易嵌套、和引号容易看混，新脚本统一用 `$()`。

### 重定向符号

| 符号 | 作用 |
| --- | --- |
| `>` / `1>` | 标准输出重定向符号 |
| `2>` | 错误输出重定向符号 |
| `>>` / `1>>` | 标准输出追加重定向符号 |
| `2>>` | 错误输出追加重定向符号 |
| `<` | 标准输入重定向符号（`tr <`、`xargs <`） |
| `<<` | 标准输入追加重定向符号 |

`<<EOF` 结束符必须顶格这个坑上篇已提；再补一句：想输出"既上屏又落盘"，重定向做不到分流，要用 tee（见上篇"管道与 tee"）。

```bash
[root@linux-node1 test]# cho test >/test/ok.txt 2>/test/error.txt
[root@linux-node1 test]# cat /test/error.txt
-bash: cho: command not found

[root@linux-node1 test]# echo test >/test/ok.txt 2>/test/error.txt
[root@linux-node1 test]# cat /test/ok.txt
test
```

**把正确信息和错误信息同时保留到一个文件的三种方法：**

```bash
# 方法一：分别追加到同一个文件
[root@linux-node1 test]# echo test >>/test/info.log 2>>/test/info.log
[root@linux-node1 test]# cho test >>/test/info.log 2>>/test/info.log
[root@linux-node1 test]# cat /test/info.log
test
-bash: cho: command not found

# 方法二：&>
[root@linux-node1 test]# echo test &>/test/info.log
[root@linux-node1 test]# cat /test/info.log
test
[root@linux-node1 test]# cho test &>/test/info.log
[root@linux-node1 test]# cat /test/info.log
-bash: cho: command not found

# 方法三：2>&1
[root@linux-node1 test]# echo test >/test/info.log 2>&1
[root@linux-node1 test]# cat /test/info.log
test
[root@linux-node1 test]# cho test >/test/info.log 2>&1
[root@linux-node1 test]# cat /test/info.log
-bash: cho: command not found
```

**标准输入追加重定向（`<<`）的典型用法：**

```bash
cat >>/test.txt<<EOF
XXX
XXX
EOF
```

### 路径信息系列

| 符号 | 作用 |
| --- | --- |
| `../` | 上一级目录 |
| `./` | 当前路径 |
| `~` | 返回到家目录 |
| `-` | 两个目录之间进行快速切换，等价于 `$OLDPWD` 环境变量 |

`cd -` 只在最近两个目录间来回切；多次切换的历史可以用 `pushd` / `popd` 管理一个目录栈，`dirs -v` 查看栈内容。

```bash
[root@linux-node1 tmp]# cd $OLDPWD
[root@linux-node1 test]# cd $OLDPWD
[root@linux-node1 tmp]# cd $OLDPWD
[root@linux-node1 test]# echo $OLDPWD
/tmp
[root@linux-node1 test]# cd /tmp/
[root@linux-node1 tmp]# echo $OLDPWD
/test
```

### 逻辑符号系列

| 符号 | 作用 |
| --- | --- |
| `&&` | 与逻辑符号，前一个命令执行成功，再执行后面的命令 |
| `\|\|` | 或逻辑符号，前一个命令执行失败，再执行后面的命令 |

```bash
[root@linux-node1 tmp]# # 需求：创建一个 /alex 目录，并在目录中创建 test.txt，一条命令搞定
[root@linux-node1 tmp]# mkdi /alex ; touch /alex/test.txt
-bash: mkdi: command not found
touch: cannot touch '/alex/test.txt': No such file or directory

[root@linux-node1 tmp]# mkdi /alex && touch /alex/test.txt
-bash: mkdi: command not found

[root@linux-node1 tmp]# mkdir /alex && touch /alex/test.txt
[root@linux-node1 tmp]# ll /alex/test.txt
-rw-r--r--. 1 root root 0 Oct 10 03:00 /alex/test.txt
```

```bash
[root@linux-node1 tmp]# # 需求：删除 /alex/test.txt 失败时，在 /alex/error.txt 中生成失败信息
[root@linux-node1 tmp]# rmx /alex/test.txt || echo "failed" >>/alex/error.txt
-bash: rmx: command not found
[root@linux-node1 tmp]# cat /alex/error.txt
failed

[root@linux-node1 tmp]# rm /alex/test.txt || echo "failed" >>/alex/error.txt
[root@linux-node1 tmp]# cat /alex/error.txt
failed
```

> **注意：** `;` 只是顺序执行多条命令，不关心成败；`&&` 要求前一步成功，`||` 要求前一步失败。

还有一个不起眼但实用的 `&`：命令尾部加上它立即返回 shell 提示符，配合 `jobs`、`fg` 构成最朴素的后台任务方案；注意后台任务结束前拿不到它的退出码。

## 系统通配符号

通配符号用于**根据文件名称进行匹配**。

| 符号 | 作用 | 示例 |
| --- | --- | --- |
| `*` | 模糊匹配所有内容 | `find -name "*.txt"`、`ll /test/*.txt` |
| `{}` | 生成序列信息（生成一行序列） | 见下 |

通配符由 Shell 负责展开，命令本身根本看不到 `*`——拿到手时已经是一串文件名了。理解这一点，很多"为什么命令收到的参数变了"的问题就通了。

### 生成序列信息

```bash
# 生成连续序列
echo {1..10}
echo {01..100}
echo {a..z}
echo {A..Z}

# 生成不连续序列
echo {1..10..2}          # 奇数序列
echo {2..10..2}          # 偶数序列
echo {www,bbs,blog}      # 无规律序列
```

序列还可以倒着生成，`echo {5..1}` 输出 5 4 3 2 1。

### 生成组合序列

```bash
[root@linux-node1 tmp]# echo {A,B}{01,02}
A01 A02 B01 B02
[root@linux-node1 tmp]# echo A{01,02}
A01 A02
[root@linux-node1 tmp]# echo A{,02}
A A02
```

> **注意：** 原笔记把 `echo {2..10..2}` 也标注成了"奇数序列"，实际输出 `02 04 06 08 10` 是偶数序列。

### 利用 `{}` 快速备份与还原文件

```bash
[root@linux-node1 tmp]# # cp /test/test.txt /test/test.txt.bak
[root@linux-node1 tmp]# echo test.txt{,bak}
test.txt test.txtbak
[root@linux-node1 tmp]# echo test.txt{,.bak}
test.txt test.txt.bak
[root@linux-node1 tmp]# echo /test/test.txt{,.bak}
/test/test.txt /test/test.txt.bak
[root@linux-node1 tmp]# cp /test/test.txt{,.bak}      # 最终命令
```

这个技巧在改配置文件前几乎是肌肉记忆：`cp /etc/fstab{,.bak}` 一步完成备份，比敲两遍完整路径省事且不易错。

**测试题 01**：在 `/test` 目录中创建 `alex.txt` 文件，并在 `/test` 目录中生成 `alex.txt.ori` 备份文件

```bash
mkdir /test
touch alex.txt
cp /test/alex.txt{,.ori}
```

**测试题 02**：如何将备份文件快速还原

```bash
rm /test/alex.txt -f
mv /test/alex.txt{.ori,}      # 快速还原，等价于 mv /test/alex.txt.ori /test/alex.txt
```

通配符相关的事故值得单独记一条。生产环境最经典的误删：本想执行 `rm -rf /tmp/logs/*.log`，多敲一个空格变成 `rm -rf /tmp/logs/ *.log`，当前目录的日志全部遭殃；更狠的是变量为空时 `rm -rf $DIR/*` 展开成 `rm -rf /*`。防范办法：高危命令前先 `echo` 展开一遍看结果（`echo rm -rf $DIR/*`）；变量加引号并判空；`rm` 前用 `ls` 同条件预演；root 身份下更要慢一拍。

顺带说下展开失败的行为：当 `*` 匹配不到任何文件时，bash 默认把字面量 `*.txt` 原样传给命令，于是 `rm *.txt` 可能试图删除一个叫 "*.txt" 的文件——好在 rm 会报 No such file。想改变这种行为可以 `shopt -s nullglob`，让匹配不到时直接展开为空，但要清楚这对脚本里所有 glob 都生效，用前想清楚。

## 正则表达式与 Shell 通配符的区别

这是初学者最容易混淆的一组概念：`*`、`?`、`[]` 在通配符和正则里"长得一样、含义不同"。先把分工看清楚，再逐个对比。

| 对比 | 通配符号（glob） | 正则符号（regex） |
| --- | --- | --- |
| 匹配对象 | 根据**文件名称**进行匹配 | 根据**文件内容**（一行行文本）进行匹配 |
| 使用者 | Shell（`ls`、`cp`）、`find -name` | grep / sed / awk，以及各种开发语言（Python、Java、PHP） |
| 生效时机 | Shell 在敲下回车时展开 | grep 等工具读取每一行时匹配 |

### 同名符号，两种含义

| 符号 | Shell 通配符中的含义 | 正则表达式中的含义 |
| --- | --- | --- |
| `*` | 匹配任意长度的任意字符（如 `*.txt` 匹配所有 txt 文件） | 表示**前一个字符**重复 0 次或多次，单独一个 `*` 没有"匹配一切"的本领 |
| `?` | 匹配任意**单个**字符（如 `?.txt` 匹配 a.txt、b.txt） | 表示前一个字符出现 0 次或 1 次（扩展正则直接写 `?`，基础正则写 `\?`） |
| `[]` | 匹配方括号中的任意一个字符（如 `[ab].txt`） | 含义相同：匹配方括号中的任意一个字符（如 `grep '[Tt]om'`） |
| `.` | 没有特殊含义，就是普通的点 | 匹配**任意一个字符** |
| `^` `$` | 没有特殊含义 | 行首 / 行尾锚点 |

### 对照示例

```bash
# 通配符：Shell 在展开，操作的是文件名
ls *.txt                 # 列出所有 txt 文件
ls ?.txt                 # 列出文件名只有 1 个字符的 txt 文件
ls [ab].txt              # 列出 a.txt 或 b.txt

# 正则：grep 在匹配，操作的是文件内容
grep 'a*c' test.txt      # 匹配 ac、abc、aabc……（c 前面有 0 个或多个 a）
grep -E 'colou?r' test.txt   # 匹配 color 和 colour
grep '[Tt]om' test.txt   # 匹配 Tom 或 tom
```

> **注意：** 三条实操准则——①通配符通常**不能加引号**（`ls "*.txt"` 会把 `*` 当字面量，反而列不出文件）；②正则**必须加引号**（防止 Shell 先把 `$`、`*` 解释掉）；③`find -name '*.txt'` 用的是通配符，而 `find -regex '.*\.txt'` 用的是正则（GNU find），别混为一谈。

### 辨析：通配符 `*` 与正则 `.*`

这是新手翻车率最高的一组。通配符里 `*` 本身就能匹配"任意长度的任意字符"，所以 `ls *.txt` 直接可用；正则里 `*` 只修饰前一个字符，想表达"任意内容"必须写成 `.*`（`.` 任意一个字符 + `*` 重复 0 次以上）。两句话验证：`ls te*t` 里的 `*` 是通配符，能匹配 test；`grep "te*t"` 里的 `*` 是正则量词，匹配的是 tet、test、tesst……（e 重复 0 次或多次）。另一个坑是 Shell 展开：不加引号时 grep 参数里的 `*` 会被 Shell 先当通配符展开成当前目录的文件名列表，实际传给 grep 的模式面目全非——所以正则模式必须加引号。实际敲一遍就明白：在有个 a.txt 的目录里跑 `grep te*t`，看它到底把哪些文件名当成了参数。

## 原理解析：grep 是如何匹配一行文本的

理解 grep 的内部流程，很多"为什么搜不到"的问题就能自解释：

1. **解析命令行**：grep 先读取参数（`-i`、`-v`、`-E` 等）和模式，把模式编译成内部的状态机；同时确定要处理的文件列表。
2. **逐行读取输入**：以换行符 `\n` 为界，把输入切分成一行行文本；最后一行没有换行符也能正常处理。
3. **对每一行执行匹配**：用编译好的正则去扫描这一行。GNU grep 内部会先用一个高效的 DFA 判断"这行是否可能匹配"，快速跳过绝大多数不相关的行，再对候选行精确认匹配位置。
4. **命中后按参数处理**：默认打印整行；`-o` 只打印匹配到的片段；`-c` 只累加计数；`-n` 附加行号；`-v` 把命中的行"反转"成不输出。
5. **处理完所有行，返回退出码**：0 表示至少命中一行，1 表示一次都没命中，2 表示命令本身出错（详见下文"退出码"）。
6. **多文件行为**：处理多个文件时默认在每行前加 `文件名:` 前缀；`-r` 递归目录，默认跳过二进制文件（可用 `-a` 强制按文本处理）。

因为 grep 是"逐行、无状态"地匹配，所以它天然适合做过滤，但不适合做跨行计算——跨行统计是 awk 的强项。

第 3 步提到的 DFA 与回溯引擎的差异，在下一篇《扩展正则表达式与 grep》的"贪婪匹配与回溯"一节还会展开：DFA 没有回溯，性能稳定可预期，这是 grep 在海量日志场景能扛住的关键。

## 正则表达式入门

| 对比 | 通配符号 | 正则符号 |
| --- | --- | --- |
| 匹配对象 | 根据**文件名称**进行匹配 | 根据**文件内容**进行匹配 |
| 使用者 | Shell | grep / sed / awk，以及各种开发语言（Python、Java、PHP） |

正则符号分为两类：

- **基础正则符号**：basic regular expression（BRE），grep、sed、awk 默认支持；
- **扩展正则符号**：extended regular expression（ERE），grep 需要 `-E` 或 `egrep`、sed 需要 `-r` 才支持。

同一串字符，位置不同解释者也不同：`grep "a|b"` 里 `|` 落在引号内、交给 grep 处理；`grep a|b file` 里 `|` 落在引号外、被 Shell 当管道。引号决定边界，这是理解本篇所有符号问题的底层规则。

为什么 grep 默认不认 `+`？这是历史包袱。正则诞生于 1970 年代的 ed 编辑器，当年实现只支持一套很小的元字符集，这就是后来的 BRE；后来标准制定者把 `+`、`?`、`|`、`()`、`{}` 这批增强语法单独归成了 ERE。为了不破坏老脚本，grep 默认停留在 BRE，想用增强语法就得显式加 `-E`。sed 同理，用 `-E`（老写法 `-r`）开启。所以"要不要转义"完全取决于工具工作在哪种模式下，跟符号本身没有关系。

### 基础正则符号：`^` 与 `$`

| 符号 | 作用 | 示例 |
| --- | --- | --- |
| `^` | 匹配以什么开头的信息 | `ll /test \| grep "^d"` |
| `$` | 匹配以什么结尾的信息 | `ll -F /etc/ \| grep /$` |
| `^$` | 空行符号 | `grep -v "^$" 文件` 表示过滤掉空行 |

**创建测试环境：**

```bash
cat >>/test/test.txt<<EOF
# test-group-01
test-linux
test-python-linux

# test-group-02
test-linux
test-python-linux

# test-group-03
test-linux
java
mysql
go
python
EOF
```

```bash
[root@linux-node1 tmp]# cat /test/test.txt
# test-group-01
test-linux
test-python-linux

# test-group-02
test-linux
test-python-linux

# test-group-03
test-linux
java
mysql
go
python
```

**需求 01：将以 `test` 开头的行找出来**

```bash
grep "^test" /test/test.txt
```

> **注意：** 直接 `grep "内容" 文件` 即可，写成 `cat 文件 | grep "内容"` 属于多此一举（多一次无用进程）。

**需求 02：将以 `linux` 结尾的行找出来**

```bash
grep "linux$" /test/test.txt
```

**需求 03：显示全部内容，但不显示空行**

```bash
grep -v "^$" /test/test.txt
```

### 基础正则符号总表

下面的示例基于 `/test/test.txt` 与一份模拟的 `/test/passwd.txt`（演示词边界时用）：

```bash
cat >/test/passwd.txt<<EOF
root:x:0:0:root:/root:/bin/bash
operator:x:11:0:operator:/root:/sbin/nologin
roots:x:0:0::/home/roots:/bin/bash
EOF
```

| 符号 | 含义 | 示例 |
| --- | --- | --- |
| `^` | 行首锚点，匹配行的开头 | `grep '^test' test.txt` 找出以 test 开头的行 |
| `$` | 行尾锚点，匹配行的结尾 | `grep 'linux$' test.txt` 找出以 linux 结尾的行 |
| `.` | 匹配任意一个字符（且只有一个） | `grep 'test.linux'` 可匹配 `test-linux`、`testXlinux` |
| `*` | 前一个字符出现 0 次或多次 | `grep 'tes*'` 可匹配 `te`、`tes`、`tess` |
| `[]` | 字符集合，匹配其中任意一个字符 | `grep 'test-[pjl]' test.txt` 命中 `test-linux`、`test-python-linux` 等行 |
| `[^]` | 排除集合，匹配不在其中的任意一个字符 | `grep '^[^#]' test.txt` 找出不以 `#` 开头的行 |
| `\<` | 词首锚点（GNU 扩展） | `grep '\<root' passwd.txt` 三行都命中（roots 的词首也是 root） |
| `\>` | 词尾锚点（GNU 扩展） | `grep 'root\>' passwd.txt` 只命中前两行（roots 中 root 不在词尾） |
| `\(` `\)` | 分组，把若干字符当作整体（BRE 中必须转义） | `grep '\(test\)-\(linux\)'` 把整行按两组捕获 |
| `\{n,m\}` | 指定前一个字符重复次数（BRE 中必须转义） | `echo gooood \| grep 'o\{2,\}'` 匹配连续 2 个以上的 o |
| `\|` | "或者"，二选一（GNU 扩展，POSIX BRE 未定义） | `grep 'java\|mysql' test.txt` 一次匹配两类行 |
| `\` | 转义：把有特殊含义的符号变回普通字符 | `grep '\.'` 匹配真实的点，而不是任意字符 |

补充说明：

- `\(...\)` 捕获到的内容可以用 `\1`、`\2` **向后引用**，例如 `echo "ha ha" | grep '\(ha\) \1'` 能匹配到重复出现的 "ha ha"；
- `\?` 是 BRE 中"0 次或 1 次"的写法（GNU 扩展），与扩展正则的 `?` 等价；
- `\<`、`\>`、`\|`、`\+`、`\?` 都是 GNU 的实用扩展，POSIX 标准的 BRE 并不包含它们。写追求可移植性的脚本时，扩展语义优先用 `grep -E`。
- `\<` 与 `\b` 在 GNU 工具里等价（都是词边界），但 `\b` 属于 PCRE 风格、未被 POSIX BRE 定义，跨平台仍建议 `\<`。

### POSIX 字符类速查表

字符类必须写在方括号内部使用，如 `[[:digit:]]`。它的最大好处是不受键盘符号顺序影响，且语义自解释：

| 字符类 | 匹配内容 | 常见等价写法 |
| --- | --- | --- |
| `[[:digit:]]` | 数字 0-9 | `[0-9]` |
| `[[:alpha:]]` | 字母 | `[A-Za-z]`（受 locale 影响） |
| `[[:alnum:]]` | 字母与数字 | `[0-9A-Za-z]` |
| `[[:upper:]]` | 大写字母 | `[A-Z]` |
| `[[:lower:]]` | 小写字母 | `[a-z]` |
| `[[:space:]]` | 空白字符（空格、制表符、换行、回车等） | 无简洁等价写法 |
| `[[:blank:]]` | 空格与制表符 | `[ \t]` |
| `[[:punct:]]` | 标点符号 | 无简洁等价写法 |
| `[[:xdigit:]]` | 十六进制数字 | `[0-9A-Fa-f]` |
| `[[:print:]]` | 可打印字符（含空格） | — |
| `[[:graph:]]` | 可打印字符（不含空格） | — |
| `[[:cntrl:]]` | 控制字符 | — |

准备一份混合内容的测试文件：

```bash
cat >/test/mix.txt<<EOF
ID:1001 name:zhangsan score:95
ID:1002 name:lisi score:88
ID:1003 name:wangwu score:76
EOF
```

```bash
# 把文件里的数字片段逐个抠出来
grep -o '[[:digit:]]\+' /test/mix.txt
# 输出：1001 95 1002 88 1003 76

# 找出含有大写字母的行
grep '[[:upper:]]' /test/mix.txt
# 输出：三行都命中（ID 中含有大写字母）

# 找出只含字母和数字的行（alnum 的典型用法：过滤掉带标点的异常行）
grep '^[[:alnum:][:space:]:]\+$' /test/mix.txt
```

> **注意：** 字符类的实际范围受 locale 影响。`C` locale 下 `[[:alpha:]]` 只包含 ASCII 字母；中文环境下 `[[:alpha:]]` 可能包含汉字（取决于 locale 定义）。需要严格按 ASCII 判断时，用 `LC_ALL=C grep ...`。

字符类与简单范围 `[0-9]` 的另一个差别：`[0-9]` 在某些 locale 下可能因排序规则包含意想不到的字符，`[[:digit:]]` 永远精确指十个 ASCII 数字。国际化环境写正则，优先用字符类。

## grep 常用参数

grep 的参数非常多，先把运维最高频的一组记住：

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `-i` | 忽略大小写 | `grep -i 'error' app.log` |
| `-v` | 反选，输出**不**匹配的行 | `grep -v '^#' nginx.conf` |
| `-n` | 输出行号 | `grep -n 'root' passwd.txt` |
| `-c` | 只输出匹配的行数（不打印内容） | `grep -c 'ERROR' app.log` |
| `-o` | 只输出匹配到的片段 | `grep -o '[[:digit:]]\+' mix.txt` |
| `-w` | 整词匹配（单词边界才算） | `grep -w 'linux' test.txt` |
| `-x` | 整行匹配 | `grep -x 'go' test.txt` |
| `-r` / `-R` | 递归处理目录（`-R` 会跟随符号链接） | `grep -rn 'ERROR' /var/log` |
| `-l` | 只列出含有匹配的**文件名** | `grep -rl 'ERROR' /var/log` |
| `-L` | 只列出**不含**匹配的文件名 | `grep -rL 'ERROR' /var/log` |
| `-E` | 启用扩展正则表达式 | `grep -E 'java\|mysql'`（见注） |
| `-F` | 固定字符串模式，不解释正则符号 | `grep -F 'a*b' file` |
| `-A n` | 同时输出匹配行**之后**的 n 行 | `grep -A2 'ERROR' app.log` |
| `-B n` | 同时输出匹配行**之前**的 n 行 | `grep -B2 'ERROR' app.log` |
| `-C n` | 前后各输出 n 行（`-A` 与 `-B` 的合体） | `grep -C2 'ERROR' app.log` |
| `-q` | 静默模式，只设置退出码，不打印任何内容 | `grep -q 'ERROR' app.log` |
| `-m n` | 匹配 n 次后停止读取 | `grep -m1 'ERROR' app.log` |
| `-e` | 指定多个模式（与 `-e` 连用表示"或"） | `grep -e 'java' -e 'mysql' file` |
| `-a` | 把二进制文件当文本处理 | `grep -a 'pattern' core` |

`-F` 常被低估：模式里全是普通字符时加上它，既避免转义烦恼又更快（跳过正则编译），搜固定字符串如版本号、哈希值时第一反应就该是它。`-r` 与 `-R` 只差在是否跟随符号链接，日常排查用哪个都行，写进脚本要固定一个。`-A/-B/-C` 三兄弟查日志时天天用：先 grep 到报错行，再看上下文定位现场，`grep -C 5 'segfault' /var/log/messages` 是应急标配。

> **注意：** 含竖线的命令写在 Markdown 表格里时，竖线要写成 `\|` 才不会被当成列分隔符；你实际敲的命令是 `grep -E 'java|mysql'`。从文档复制命令到终端前，先把这类转义去掉。

参数组合的几个典型场景：

```bash
# 统计文件里有多少行以 # 开头（注释行）
grep -c '^#' /test/test.txt
# 输出：3

# 显示非空行的数量
grep -c -v '^$' /test/test.txt
# 输出：12

# 显示 python 结尾的行，并带行号
grep -n 'python$' /test/test.txt
# 输出：14:python

# 整词匹配：test-linux 出现 3 次；linux 作为独立单词出现 5 次
grep -w 'test-linux' /test/test.txt | wc -l
# 输出：3
grep -w 'linux' /test/test.txt | wc -l
# 输出：5（test-linux、test-python-linux 中的 linux 都算独立单词）

# 递归找出 /var/log 下所有含 ERROR 的日志文件名
grep -rl 'ERROR' /var/log
```

## grep 退出码与脚本中的使用

grep 是与 Shell 脚本配合最紧密的命令之一，核心原因就是它的**退出码语义**：

| 退出码 | 含义 | 常见场景 |
| --- | --- | --- |
| 0 | 至少匹配到一行 | 判断"文件里有没有某关键字" |
| 1 | 一行都没匹配到 | 注意：这不是命令出错，是正常的"没找到" |
| 2 | 命令本身出错 | 文件不存在、没有读权限、正则语法错误等 |

最典型的用法是 `-q`（quiet）：只关心"有没有"，不关心内容：

```bash
if grep -q "ERROR" /var/log/app.log; then
    echo "发现错误，发送告警"
else
    echo "一切正常"
fi
```

脚本里有两个必须知道的坑：

```bash
# 坑一：set -e 脚本中，grep 没匹配到（退出码 1）会让整个脚本直接退出
set -euo pipefail
grep -q "ERROR" /var/log/app.log    # 没匹配到 → 脚本在这里就终止了
# 解决：明确允许"没找到"这种情况
grep -q "ERROR" /var/log/app.log || true

# 坑二：grep -q 一旦命中就会立刻退出，大文件效率高
# 配合 -m1 更直观：匹配一次就停
grep -qm1 "ERROR" /var/log/app.log && echo "有错误"
```

另外，判断命令"是否成功"不要只看 `$?` 是不是 0，要结合语义：

```bash
grep "pattern" file
echo $?     # 0=找到了；1=没找到；2=出错了
```

0/1/2 之外有些实现还定义了其他值，但脚本里牢记 0 与非 0 的分界就够用。与 grep 的退出码联动的还有 find：find 本身"找到与否"不影响退出码（只报自身错误），`find ... | grep -q` 判断的是 grep 的结果，写条件时别搞混对象。

## 知识卡片

**概念卡**

| 概念 | 一句话解释 |
| --- | --- |
| BRE | 基础正则，grep / sed / awk 默认模式，`+` `?` `\|` `()` `{}` 均需转义 |
| ERE | 扩展正则，`grep -E` / `sed -r`（或 `sed -E`）模式下 `+` `?` `\|` `()` `{}` 直接可用 |
| 锚点 | `^` 行首、`$` 行尾、`\<` `\>` 词首词尾（GNU 扩展） |
| 字符类 | POSIX  `[[:digit:]]` 等，必须写在 `[]` 内使用 |
| 贪婪匹配 | `*`、`+` 默认尽可能多吃，用模式末尾的具体文本收敛 |

**命令卡**

| 目的 | 命令 |
| --- | --- |
| 文件中找关键字 | `grep 'pattern' file` |
| 忽略大小写 | `grep -i 'pattern' file` |
| 反选（排除行） | `grep -v 'pattern' file` |
| 只看匹配片段 | `grep -o 'pattern' file` |
| 递归目录 + 文件名 | `grep -rn 'pattern' dir/` |
| 只判断有没有 | `grep -q 'pattern' file` |
| 统计行数 | `grep -c 'pattern' file` |
| 统计出现次数 | `grep -o 'pattern' file \| wc -l` |

**退出码卡**

| 退出码 | 含义 |
| --- | --- |
| 0 | 匹配到 |
| 1 | 未匹配到 |
| 2 | 命令出错 |

## 常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `grep "a+b" file` 什么都搜不到 | BRE 中 `+` 是普通字符，匹配的是字面 "a+b" | `echo "aab" \| grep -E "a+b"` | 改用 `grep -E 'a+b'`，或 `grep 'a\+b'` |
| `grep "*abc"` 报错或无结果 | 正则量词放在开头没有意义；且裸 `*` 可能先被 Shell 展开成文件名 | `ls` 看当前目录是否被展开 | 加引号并改写为 `grep 'a.*bc'` |
| `grep "10.0.0.1"` 把 `10x0y0z1` 也匹配出来了 | `.` 匹配任意字符 | `echo '10x0y0z1' \| grep '10.0.0.1'` | 匹配真实小数点要转义：`grep '10\.0\.0\.1'` |
| 脚本中 grep 没报错却中断了后续逻辑 | `set -e` 环境下"没匹配到"的退出码 1 被当成失败 | `bash -x script.sh` 单步跟踪 | 用 `grep -q ... \|\| true` 或 `if grep -q ...; then` 结构 |
| `grep -c` 数出来的次数比肉眼少 | `-c` 统计的是**行数**，一行出现 3 次只算 1 | `grep -o 'pattern' file \| wc -l` 对比 | 要统计"出现总次数"用 `grep -o ... \| wc -l` |
| 匹配中文关键字失败 | 文件编码不是 UTF-8，或 locale 不匹配 | `locale`、`file 文件名` | 统一 `LANG=C.UTF-8`，确认文件编码 |
| 二进制文件提示 `Binary file ... matches` | 文件中含 NUL 等控制字符，grep 判定为二进制 | `file 文件名` | 强制按文本处理加 `-a`；想跳过二进制文件加 `-I` |

## 现代环境补充

- **`egrep` / `fgrep` 已废弃**：POSIX 已将其标记为 deprecated，GNU grep 出于兼容仍保留，但调用时会有警告。新脚本一律写 `grep -E`（扩展正则）和 `grep -F`（固定字符串）。
- **`-P`（PCRE）不可移植**：GNU grep 的 `-P` 支持 `\d`、环视等 Perl 风格语法，但取决于编译时是否链接 PCRE 库，BusyBox 等精简实现没有。跨平台脚本优先用 POSIX 字符类 `[[:digit:]]` 替代 `\d`。
- **容器与嵌入式环境**：Alpine、OpenWrt 等镜像里的 grep 多来自 BusyBox，参数是子集（通常没有 `-P`、`--include`、`-z`）。编写进容器镜像的脚本要先确认实现。
- **性能场景**：在超大代码库或海量日志里做递归搜索，推荐使用 ripgrep（`rg`）等现代工具，默认递归、自动读取 `.gitignore`、多线程，速度通常快一个数量级。语法与 grep -E 基本一致，详见下一篇《扩展正则表达式与 grep》的"现代环境补充"。

## 课后练习

1. 利用 Linux 什么命令真正统计目录的大小？（`du -xxx`）

## 自测题

1. `grep '^$' file` 和 `grep -v '^$' file` 分别会输出什么？

> **答案：** `grep '^$'` 输出文件中的空行；`grep -v '^$'` 输出除空行以外的所有行。二者正好互补。

2. 为什么 `grep '2024-01-01'` 可能漏掉某些内容，而 `grep '2024.01.01'` 反而匹配更全？哪个写法才是"精确匹配这个日期"？

> **答案：** 正则里的 `.` 匹配任意字符，所以 `2024.01.01` 连 `2024x01x01` 都能匹配，覆盖更全但不精确；`2024-01-01` 里的 `-` 是普通字符，只能匹配真实的连字符。要精确匹配日期应写 `grep '2024-01-01'`（如果数据里可能混有全角横线等变体，才考虑用 `.` 或字符类）。

3. 基础正则（BRE）中如何表达"至少连续出现 2 个 o"？

> **答案：** 花括号在 BRE 中必须转义：`grep 'o\{2,\}'`。或者改用扩展正则：`grep -E 'o{2,}'`。

4. `grep -c 'root' file` 和 `grep -o 'root' file | wc -l` 的结果一定相同吗？为什么？

> **答案：** 不一定。`-c` 统计的是"包含匹配的行数"，一行里出现 3 次只算 1；`-o ... | wc -l` 统计的是"匹配出现的总次数"。只有当每行最多出现一次时两者才相等。

5. Shell 脚本里如何判断一个文件是否包含 "ERROR"，且不在屏幕上打印任何内容？

> **答案：** 用 `grep -q 'ERROR' 文件`，`-q` 静默匹配，只设置退出码。配合 `if grep -q 'ERROR' file; then ...; fi` 即可；在 `set -e` 脚本中若允许"没匹配到"，需写成 `grep -q 'ERROR' file || true`。

6. `grep 'a\|b' file` 在 GNU grep 里能用，为什么标准却不推荐？

> **答案：** `\|` 是 GNU 对 BRE 的私有扩展，POSIX BRE 根本没定义这个符号，换到 BusyBox 或某些 Unix 的 grep 上就失效。要"或"就老实加 `-E` 写 `a|b`，可移植性有保证。

## 相关阅读

- 扩展正则表达式与 grep
- sed 命令详解：文本处理的增、删、改、查
- awk 命令详解：取列、匹配与统计
- 附录-命令速查表

## 小结

1. 系统符号的价值在于"简化操作"和"进行匹配"，其中管道 `|` + `xargs` 是把查找结果交给下一条命令的标配。
2. 引号的区别：单引号所见即所得，双引号解析变量，反引号/`$()` 先执行命令。
3. 重定向中 `>` `2>` 分别管正确与错误输出，合并写同一个文件有 `>>file 2>>file`、`&>`、`>file 2>&1` 三种写法。
4. `&&` 前一步成功才继续，`||` 前一步失败才继续，比 `;` 更适合做条件化的脚本逻辑。
5. 通配符号 `*` 与 `{}` 面向**文件名**：`*` 模糊匹配，`{}` 生成序列/组合序列，可用来快速备份（`cp file{,.bak}`）与还原（`mv file{.ori,}`）。
6. 正则符号面向**文件内容**：`^` 匹配行首、`$` 匹配行尾、`^$` 表示空行，配合 `-v` 可以过滤空行；基础正则 grep / sed / awk 都直接支持。
7. 通配符与正则**同名不同义**：`*` 在通配符里是"任意长度"，在正则里是"前一字符重复 0 次或多次"；`?`、`[]`、`.` 的含义也各有差异，用时先想清楚当前语境。
8. 基础正则符号成体系：锚点（`^` `$` `\<` `\>`）、单字符（`.` `[]` `[^]`）、重复（`*` `\{n,m\}`）、分组与引用（`\(\)` `\1`）、选择（`\|`），加上 POSIX 字符类 `[[:digit:]]` 等，足以覆盖日常九成的匹配需求。
9. grep 的高频参数按场景记忆：忽略大小写 `-i`、反选 `-v`、行号 `-n`、计数 `-c`、片段 `-o`、递归 `-r`、文件名 `-l`、上下文 `-A/-B/-C`、静默 `-q`；扩展正则一律 `grep -E`。
10. grep 退出码是脚本化的关键：0 匹配到、1 没匹配到、2 命令出错；`set -e` 脚本里要对"没匹配到"显式放行。
{% endraw %}
