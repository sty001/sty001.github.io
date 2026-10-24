---
title: "扩展正则表达式与 grep"
date: 2026-10-24 09:07:00 +0800
categories: [软件, Linux, 文件属性与正则]
tags: [Linux, 文件属性与正则]
---

{% raw %}
这一篇从基础正则推进到扩展正则：打开 `grep -E` / `sed -r` 的扩展开关，逐个讲透 `+`、`|`、`()`、`{}`、`?` 五类符号的用法与陷阱，用后向引用完成批量创建用户、批量改写格式的企业级操作；文末以 `ip address` 的真实输出为战场，完整演练从混杂文本中精确提取 IP 地址的思路，再补充日志统计、邮箱提取等高频实战。文中所有命令均可直接复制运行。

## 本篇知识地图

| 序号 | 主题 | 内容要点 |
| --- | --- | --- |
| 1 | 三类符号各司其职 | 系统符号、通配符号、正则符号的分工 |
| 2 | 基础正则回顾 | `^`、`$`、`^$` 与三剑客初体验 |
| 3 | 基础正则符号要点 | `.`、`*`、`.*`、`\`、`[]`、`[^]` |
| 4 | 扩展正则符号 | `+`、`\|`、`()`、`{}`、`?`，与基础正则的对照 |
| 5 | 贪婪匹配与回溯 | 量词为什么"贪吃"，如何收敛 |
| 6 | 后向引用实战 | `sed -r` 批量生成命令、批量改写格式 |
| 7 | 综合实战 | 从 `ip address` 输出中提取 IP 地址 |
| 8 | grep 实战案例 | 统计 IP Top、提取邮箱、日志关键字计数 |
| 9 | grep 与 find | `grep -r` 与 `find -exec grep` 的对比 |
| 10 | 超越 grep | pcregrep 与 ripgrep 简述 |
| 11 | 课后作业 | 排除过滤、随机密码、提取 IP 与权限值 |

## 三类符号各司其职

Shell 里的符号可以分成三大类，先分清各自的对象，再谈匹配：

| 符号类别 | 包括 | 作用 |
| --- | --- | --- |
| 系统符号 | `#` `~` `$` `.` `..` 等 | 由 Shell 解释执行，负责操作、控制与路径 |
| 通配符号 | `*` `{}` | 根据文件名称进行匹配 |
| 正则符号 | 见下文 | 根据文件内容进行匹配，grep / sed / awk 均支持 |

符号的名字不重要，重要的是"谁在解释它"。三类符号里最容易混的是后两类，判别方法很简单：写在引号里、交给工具处理的是正则；裸露在外、Shell 先处理的是通配符。

## 基础正则符号回顾

### 系统符号与通配符号速览

| 类别 | 符号 |
| --- | --- |
| 基础系列 | `#` `$` `!` `\|` |
| 引号系列 | `''`、`""`、`$()`、不加引号（反引号与 `$()` 等价） |
| 定向符号 | `>` `>>` `2>` `2>>` `<` `<<` |
| 路径符号 | `.` `..` `~` `-`（等价于 `$OLDPWD`） |
| 逻辑符号 | `&&` `\|\|` |

逻辑符号的典型用法——目录创建成功才新建文件，失败则给出提示：

```bash
mkdir /data && touch /data/test.txt || echo "目录已经存在，无须创建"
```

通配符号用于匹配文件名：`*` 做模糊匹配，`{}` 生成序列（有序序列、无序序列、组合序列），常用来快速备份和恢复文件。

### 正则符号与三剑客

基础正则符号（BRE）grep、sed、awk 默认就能识别。先准备一个测试文件：

```bash
cat >/test/test.txt<<EOF
test-linux
test-python-linux
test-linux test01
test-python-linux
test-linux
EOF
```

`^` 匹配行首，三种工具写法一致：

```console
[root@linux-node1 ~]# grep "^test" /test/test.txt
test-linux
test-python-linux
test-linux test01
test-python-linux
test-linux
[root@linux-node1 ~]# sed -n '/^test/p' /test/test.txt
test-linux
test-python-linux
test-linux test01
test-python-linux
test-linux
[root@linux-node1 ~]# awk '/^test/' /test/test.txt
test-linux
test-python-linux
test-linux test01
test-python-linux
test-linux
```

`$` 匹配行尾，`^$` 表示空行，配合 `-v` 可以过滤掉空行：

```bash
grep -v "^$" /test/test.txt
```

## 准备测试文件

后面的示例都围绕下面这个文件展开，直接复制运行即可：

```bash
cat >~/test.txt<<EOF
I am tom teacher!
I teach linux.

I like badminton ball, billiard ball and chinese chess!
my blog is http://tom.blog.example.com
our site is http://www.example.org
my id num is 123000456.

not 12300000456.
my god, i am not tam, but TOM!
my god, i am not taom, but TOM!
EOF
```

## 基础正则符号要点

### 点符号 `.`：匹配任意一个字符

`.` 匹配任意一个字符，而且只有一个字符：

注意 `.` 也能匹配空格和数字，`grep "^m.m"` 会把 m 后隔一个任意字符的行全捞出来。英文语境无所谓，中文场景下 `.` 按字节还是按字符处理与 locale 相关，UTF-8 环境下 GNU 工具能正确按字符匹配。

```console
[root@linux-node1 ~]# grep "." test.txt
I am tom teacher!
I teach linux.
I like badminton ball, billiard ball and chinese chess!
my blog is http://tom.blog.example.com
our site is http://www.example.org
my id num is 123000456.
not 12300000456.
my god, i am not tam, but TOM!
my god, i am not taom, but TOM!
```

加上 `-o` 可以看到匹配过程——每个匹配到的字符单独输出一行，空格也会被匹配出来（显示为空行）：

```console
[root@linux-node1 ~]# grep "." test.txt -o | head -8
I

a
m

t
o
m
```

### 星符号 `*`：前一个字符出现 0 次或多次

`*` 匹配前一个字符连续出现了 0 次或者多次。因为允许匹配 0 次，所以每一行都能被匹配上：

单独一个 `*` 放在模式开头并不算"非法"——它修饰"前面的字符"，开头没有东西时 POSIX 行为未定义，GNU grep 会把开头的 `*` 当普通字符处理。这也是 `grep "*abc"` 搜不到东西的原因之一。

```console
[root@linux-node1 ~]# grep "0*" test.txt
I am tom teacher!
I teach linux.

I like badminton ball, billiard ball and chinese chess!
my blog is http://tom.blog.example.com
our site is http://www.example.org
my id num is 123000456.

not 12300000456.
my god, i am not tam, but TOM!
my god, i am not taom, but TOM!
```

### 点星结合 `.*`：匹配任意内容

`.` 和 `*` 结合在一起，`.*` 可以匹配任意所有信息，效果等同于通配符中的 `*`：

```console
[root@linux-node1 ~]# grep "^m.*m$" test.txt
my blog is http://tom.blog.example.com
```

**贪婪匹配问题**：`.*` 会尽可能多地吃掉字符：

```console
[root@linux-node1 ~]# grep "^m.*o" test.txt
my blog is http://tom.blog.example.com
my god, i am not tam, but TOM!
my god, i am not taom, but TOM!
```

在模式末尾指定具体信息，就可以阻止贪婪匹配：

另一个收敛思路是排除型字符类：`grep '^m[^ ]*o'` 用 `[^ ]` 表示"非空格"，比 `.*` 少吃很多东西。贪不贪，取决于模式写得聪明不聪明。

```console
[root@linux-node1 ~]# grep "^m.*to" test.txt
my blog is http://tom.blog.example.com
```

> **注意：** `.*` 是贪婪匹配，默认向后吃到能满足条件的最后一个位置。想让匹配精确收敛，就在结尾追加具体的文本（如 `to`），把不确定的部分夹在两个确定信息中间。

### 转义符号 `\`

反斜杠有两个作用：

1. 将有特殊意义的符号，转义成普通信息进行识别；
2. 将没有意义的信息，转义为有特殊意义的信息，例如 `\n` 换行、`\t` 制表符。

第二个作用方向容易忘：`\.` 是"把元字符变普通"，`\n` 是"把普通组合变特殊"。同一个反斜杠两个方向，具体行为由工具定义，`echo` 要加 `-e` 才认 `\n` 就是例子。

`echo` 默认不解析 `\n`，加上 `-e` 才会真正换行：

```console
[root@linux-node1 ~]# echo "tom01tom02"
tom01tom02
[root@linux-node1 ~]# echo "tom01\ntom02\ntom03"
tom01\ntom02\ntom03
[root@linux-node1 ~]# echo -e "tom01\ntom02\ntom03"
tom01
tom02
tom03
[root@linux-node1 ~]# echo -e "tom01\ntom02\ntom03" >tom.txt
[root@linux-node1 ~]# cat tom.txt
tom01
tom02
tom03
```

转义在正则中的意义——`.` 匹配任意字符，`\.` 才匹配真实的点：

```console
[root@linux-node1 ~]# grep ".$" test.txt
I am tom teacher!
I teach linux.
I like badminton ball, billiard ball and chinese chess!
my blog is http://tom.blog.example.com
our site is http://www.example.org
my id num is 123000456.
not 12300000456.
my god, i am not tam, but TOM!
my god, i am not taom, but TOM!
[root@linux-node1 ~]# grep "\.$" test.txt
I teach linux.
my id num is 123000456.
not 12300000456.
```

> **注意：** `grep ".$"` 会把所有非空行都匹配出来（行尾总有任意一个字符）；只有写成 `grep "\.$"` 才是"找出以点结尾的行"。

### 中括号 `[]` 与排除 `[^]`

`[]` 匹配方括号中的任意一个字符：

```console
[root@linux-node1 ~]# grep "t[oa]m" test.txt
I am tom teacher!
my blog is http://tom.blog.example.com
my god, i am not tam, but TOM!
[root@linux-node1 ~]# grep "^[Im]" test.txt
I am tom teacher!
I teach linux.
I like badminton ball, billiard ball and chinese chess!
my blog is http://tom.blog.example.com
my id num is 123000456.
my god, i am not tam, but TOM!
my god, i am not taom, but TOM!
```

`[]` 里还可以写范围，例如用 `[a-Z]` 匹配字母开头的行：

`[a-Z]` 是 GNU 对这类"跨段范围"的宽容处理，严格按 ASCII（a=97、Z=90）它甚至不是合法区间；可移植场景还是老老实实写 `[A-Za-z]`。

```console
[root@linux-node1 ~]# grep "^[a-Z]" /etc/selinux/config
SELINUX=enforcing
SELINUXTYPE=targeted
```

`[^]` 是排除符号，把 `[^abc]` 理解成"除 a、b、c 之外的任意一个字符"：

排除的是"一个字符"，不是整个字符串——一行里只要还有一个其他字符就能命中。想表达"整行都不含 a、b、c"，得配合 `-v` 写 `grep -v '[abc]'`。

```console
[root@linux-node1 ~]# grep "[abc]" test.txt
I am tom teacher!
I teach linux.
I like badminton ball, billiard ball and chinese chess!
my blog is http://tom.blog.example.com
our site is http://www.example.org
my god, i am not tam, but TOM!
my god, i am not taom, but TOM!
[root@linux-node1 ~]# grep "[^abc]" test.txt
I am tom teacher!
I teach linux.
I like badminton ball, billiard ball and chinese chess!
my blog is http://tom.blog.example.com
our site is http://www.example.org
my id num is 123000456.
not 12300000456.
my god, i am not tam, but TOM!
my god, i am not taom, but TOM!
```

## 扩展正则符号

### 打开扩展正则的开关

默认情况下，grep 和 sed 不能直接识别扩展正则符号，需要给命令"提升"一下：

| 工具 | 默认支持 | 启用扩展正则的方式 |
| --- | --- | --- |
| grep | BRE（基础正则） | `grep -E` 或 `egrep` |
| sed | BRE（基础正则） | `sed -r`（GNU 旧写法）或 `sed -E`（POSIX 推荐写法） |

awk 没有这个开关——POSIX awk 的模式就是 ERE，`awk '/0+/'` 直接就能用。同一段正则搬到 awk 里按 ERE 语义理解即可；grep / sed 默认是 BRE，搬的时候留意转换。

### 扩展正则符号总表：与基础正则的区别

两类正则的分界可以概括成一句话：**在 BRE 里，`+`、`?`、`|`、`()`、`{}` 都是普通字符，加 `\` 之后才变成元字符；在 ERE 里恰好相反，它们直接就是元字符，加 `\` 反而被转义成普通字符。**

| 扩展符号 | ERE 中的含义 | BRE 中的等价写法 | 示例 |
| --- | --- | --- | --- |
| `+` | 前一个字符出现 1 次或多次 | `\+` | `grep -E 'o+'` ≡ `grep 'o\+'` |
| `?` | 前一个字符出现 0 次或 1 次 | `\?` | `grep -E 'colou?r'` 匹配 color 和 colour |
| `\|` | "或者"，二选一 | `\|`（GNU 扩展，POSIX BRE 未定义） | `grep -E 'java\|mysql'` |
| `()` | 分组，把多个字符作为整体 | `\(` `\)` | `grep -E '(ab)+'` 匹配 ab、abab |
| `{n,m}` | 指定前一个字符重复次数 | `\{n,m\}` | `grep -E 'o{2,3}'` |
| `^` `$` `.` `*` `[]` | 与 BRE 相同（两类中都是元字符） | 相同 | `grep -E '^a.*z$'` |

> **注意：** 正因为"谁是谁的转义"完全相反，把一条正则从 BRE 搬到 ERE（或反过来）时不能照抄，必须逐个符号核对。最稳的做法是：先确定用哪种模式（`grep -E` 还是默认），再按上表写模式串。

### 辨析：BRE 与 ERE 怎么选、怎么迁移

选择上给个简单原则：模式里只要用到一个 `+`、`?`、`|` 或分组，就统一走 `grep -E` / `sed -E`，全篇风格一致；纯字面或只用 `^$.*[]` 的简单匹配，BRE 就够。说白了，别在一行管道里 BRE、ERE 混着写，那是排错时的噩梦。

迁移旧正则时按符号逐个核对：`+` → 去掉 `\`，`\(` `\)` → `()`，`\{n,m\}` → `{n,m}`，`\|` → `|`。反方向迁移（ERE 改 BRE）则全部加回转义，其中 `\|` 要特别小心——POSIX BRE 里它根本未定义，只是 GNU 的扩展，跨平台脚本不要依赖。复杂模式迁移后务必用几条样例数据回归测试，别凭感觉认为等价。

### 加号 `+`：前一个字符出现 1 次或多次

不加 `-E` 时，`+` 只是一个普通字符，什么都匹配不到；加上 `-E` 后，表示前一个字符连续出现 1 次或多次：

```console
[root@linux-node1 ~]# grep "0+" test.txt
[root@linux-node1 ~]# egrep "0+" test.txt
my id num is 123000456.
not 12300000456.
[root@linux-node1 ~]# egrep "0+" test.txt -o
000
00000
```

再看一个"找出身份证信息输入错误内容"的例子。测试文件 id.txt 内容如下：

```bash
cat >id.txt<<EOF
张三   110105********7631
李四   104105********7631
赵六   unknown
王五   104105********7631
EOF
```

```console
[root@linux-node1 ~]# grep "[0-9]" id.txt
张三   110105********7631
李四   104105********7631
王五   104105********7631
[root@linux-node1 ~]# grep -E "[0-9]+" id.txt
张三   110105********7631
李四   104105********7631
王五   104105********7631
[root@linux-node1 ~]# grep -E "[0-9]+" id.txt -o
110105********7631
104105********7631
104105********7631
[root@linux-node1 ~]# grep -Ev "[0-9]+" id.txt
赵六   unknown
```

> **注意：** `[0-9]` 只能匹配一位数字，`[0-9]+` 才能匹配一整串连续数字；加上 `-v` 反选，就能把"该填数字却填了文字"的行揪出来。

注意 `-Ev` 的语义边界：`[0-9]+` 匹配整串数字，一行里只要含数字就会被 `-v` 排除掉，赵六那行因为没有数字而被留下——逻辑是"没有数字的行"，不是"不是纯数字的行"。要校验"必须全是数字"得锚定：`grep -Ev '^[0-9]+$'`。

### 竖线 `|`：二选一

`|` 是"或者"符号，用于匹配多个候选信息，效果等价于把候选字符塞进 `[]`：

```console
[root@linux-node1 ~]# grep -E "tom|tam" test.txt
I am tom teacher!
my blog is http://tom.blog.example.com
my god, i am not tam, but TOM!
[root@linux-node1 ~]# grep "t[oa]m" test.txt
I am tom teacher!
my blog is http://tom.blog.example.com
my god, i am not tam, but TOM!
```

### 圆括号 `()`：整体匹配与分组

圆括号的第一个作用是把若干信息作为一个整体来匹配。注意不加 `-E` 时，圆括号就是普通字符：

```console
[root@linux-node1 ~]# grep "taom" test.txt
my god, i am not taom, but TOM!
[root@linux-node1 ~]# grep "t(ao)m" test.txt
[root@linux-node1 ~]# grep -E "t(ao)m" test.txt
my god, i am not taom, but TOM!
```

圆括号里还可以用 `|` 做组内多选：

```console
[root@linux-node1 ~]# grep -E "t(o|a)m" test.txt
I am tom teacher!
my blog is http://tom.blog.example.com
my god, i am not tam, but TOM!
```

`|` 两侧要写成完整候选：`tom|tam` 等价于 `t[oa]m`，但候选是"词"而非"字符"时只能用 `|`——`java|mysql` 没法用字符类表达。`[]` 管单字符二选一，`|` 管任意长度二选一，边界要分清。

### 后向引用：`sed -r` 的杀手锏

圆括号的第二个作用是**后向引用**——前面分组捕获到的内容，在替换位用 `\1`、`\2`、`\3` 按顺序引用。说白了，后向引用解决的是"输出里要重复输入内容"的问题：生成命令、补全配对、格式改写，凡是要"原样搬一遍"的场景都用得上。先看批量生成命令，`xargs -n1` 让每个参数单独占一行：

```console
[root@linux-node1 ~]# echo tom{01..10}|xargs -n1
tom01
tom02
tom03
tom04
tom05
tom06
tom07
tom08
tom09
tom10
```

不加 `-r` 直接替换，sed 会报错：

```console
[root@linux-node1 ~]# echo tom{01..10}|xargs -n1|sed 's#(.*)#useradd \1#g'
sed: -e expression #1, char 19: invalid reference \1 on `s' command's RHS
xargs: echo: terminated by signal 13
```

加上 `-r` 之后，圆括号成为分组、`\1` 成功引用整行内容：

```console
[root@linux-node1 ~]# echo tom{01..10}|xargs -n1|sed -r 's#(.*)#useradd \1#g'
useradd tom01
useradd tom02
useradd tom03
useradd tom04
useradd tom05
useradd tom06
useradd tom07
useradd tom08
useradd tom09
useradd tom10
```

末尾接上 `|bash`，这些命令就会被真正执行。

`xargs -n1` 在这里的作用是"每行一个参数"：echo 输出默认全在一行，不拆行的话 sed 只处理一次，生成的也是一行 useradd。

> **注意：** 不加 `-r` 时圆括号是普通字符，`\1` 找不到可引用的分组，sed 直接报 invalid reference 错误。另外批量执行创建用户的命令时，重复创建已存在的用户会提示 user already exists。

**企业面试题：批量创建用户 tom01 到 tom10，并给每个用户设置初始密码。**

这道题综合了六个知识点：

1. 如何创建用户、给用户设置密码；
2. 基础命令：`echo {}` 与 `seq -w 10` 生成序列；
3. sed 命令替换信息的方法；
4. 正则符号 `.*` 与 `()`；
5. 基础符号 `;` 与 `|`；
6. bash 内置命令。

参考解法（`seq -w 10` 生成 01 到 10 的等宽序号，密码用占位符表示，实际执行时换成真实密码）：

```console
[root@linux-node1 ~]# seq -w 10|sed -r 's#(.*)#useradd tom\1;echo "<your-password>"|passwd --stdin tom\1#g'
useradd tom01;echo "<your-password>"|passwd --stdin tom01
useradd tom02;echo "<your-password>"|passwd --stdin tom02
useradd tom03;echo "<your-password>"|passwd --stdin tom03
useradd tom04;echo "<your-password>"|passwd --stdin tom04
useradd tom05;echo "<your-password>"|passwd --stdin tom05
useradd tom06;echo "<your-password>"|passwd --stdin tom06
useradd tom07;echo "<your-password>"|passwd --stdin tom07
useradd tom08;echo "<your-password>"|passwd --stdin tom08
useradd tom09;echo "<your-password>"|passwd --stdin tom09
useradd tom10;echo "<your-password>"|passwd --stdin tom10
```

> **注意：** `passwd --stdin` 是 RHEL / CentOS / Rocky / AlmaLinux 特有的用法；Debian / Ubuntu 的 `passwd` 没有 `--stdin` 参数，批量设密要用 `echo 'user:password' | chpasswd`，或使用 `usermod -p` 写入加密后的密码串。

面试题的六步拆法比答案本身更有价值：拿到综合题先拆知识点，每一步找到对应工具，再按数据流顺序拼管道——这个解题套路适用于所有"批量生成命令"类需求。生成的命令先输出检查一遍再接 `|bash`，永远别让没看过的命令直接进 bash。顺带一提，`seq -w` 的 `-w` 是等宽补零，与 `{01..10}` 效果相同，两个工具会一个即可，管道里 seq 更常见。

再来一组格式转换练习，体会多分组与多次引用：

```console
[root@linux-node1 ~]# echo 123456
123456
[root@linux-node1 ~]# echo 123456|sed -r 's#([1-6]+)#\1#g'
123456
[root@linux-node1 ~]# echo 123456|sed -r 's#([1-6]+)#<\1>#g'
<123456>
[root@linux-node1 ~]# echo 123456|sed -r 's#(.*)#<\1>#g'
<123456>
[root@linux-node1 ~]# echo 123456|sed -r "s#(12)(34)(56)#<\1><\2><\3>#g"
<12><34><56>
[root@linux-node1 ~]# echo 123456|sed -r "s#(12)(34)(56)#<\1><><\3>#g"
<12><><56>
[root@linux-node1 ~]# echo 123456|sed -r "s#(12)(34)(56)#<\1><\3><\3>#g"
<12><56><56>
[root@linux-node1 ~]# echo 123456|sed -r "s#(..)(..)(..)#<\1><\2><\3>#g"
<12><34><56>
```

同一个分组可以被引用多次（如 `<\1><\3><\3>`）；`(..)` 表示任意两个字符，是更通用的写法。

这组练习里 `s#(12)(34)(56)#...#g` 的分组是按位置硬编码的，数据变了分组也得跟着改——正则不是万能模板，脱离数据谈模式没有意义。

如果不想加 `-r`，基础 sed 里要把圆括号写成转义形式，效果相同：

```console
[root@linux-node1 ~]# echo 123456|sed "s#\(..\)\(..\)\(..\)#<\1><\2><\3>#g"
<12><34><56>
```

两点边界要清楚：其一，后向引用在 `s` 命令的替换串里写 `\1`，在模式部分匹配重复内容是 `\(xx\)\1`，两处用法别混；其二，POSIX awk 与 grep 的 `-o` 都拿不到"分组"，只有 sed 替换和 PCRE 系工具能玩 `\1`。需要更复杂的结构化处理时别硬扛正则，该上 awk 字段切分就上 awk。

动手练习：把 `123456` 转换成 `<12>34<56>`。

参考答案（用第二个分组但不加尖括号）：

```console
[root@linux-node1 ~]# echo 123456|sed -r 's#(..)(..)(..)#<\1>\2<\3>#g'
<12>34<56>
```

### 花括号 `{}`：指定重复次数

`{}` 可以指定前一个字符连续匹配的次数，共有四种写法：

| 写法 | 含义 |
| --- | --- |
| `x{n,m}` | 前一个字符至少连续出现 n 次，最多出现 m 次 |
| `x{n}` | 前一个字符正好连续出现 n 次 |
| `x{n,}` | 前一个字符至少连续出现 n 次，上限不限 |
| `x{,m}` | 前一个字符至少连续出现 0 次，最多出现 m 次 |

```console
[root@linux-node1 ~]# grep -E "0{2,3}" test.txt
my id num is 123000456.
not 12300000456.
[root@linux-node1 ~]# grep -E "0{2,3}" test.txt -o
000
000
00
[root@linux-node1 ~]# grep -E "0{2,4}" test.txt
my id num is 123000456.
not 12300000456.
[root@linux-node1 ~]# grep -E "0{2,4}" test.txt -o
000
0000
[root@linux-node1 ~]# grep -E "0{2}" test.txt
my id num is 123000456.
not 12300000456.
[root@linux-node1 ~]# grep -E "0{2}" test.txt -o
00
00
00
[root@linux-node1 ~]# grep -E "0{2,}" test.txt
my id num is 123000456.
not 12300000456.
[root@linux-node1 ~]# grep -E "0{2,}" test.txt -o
000
00000
[root@linux-node1 ~]# grep -E "0{,2}" test.txt
I am tom teacher!
I teach linux.

I like badminton ball, billiard ball and chinese chess!
my blog is http://tom.blog.example.com
our site is http://www.example.org
my id num is 123000456.

not 12300000456.
my god, i am not tam, but TOM!
my god, i am not taom, but TOM!
[root@linux-node1 ~]# grep -E "0{,2}" test.txt -o
00
0
00
00
0
```

> **注意：** `x{,m}` 因为允许匹配 0 次，所以每一行都能匹配上；`x{n,m}` 默认贪婪，在连续多个 0 的行里会优先吃掉能匹配的最多次数（例如 5 个连续 0 遇到 `0{2,3}` 时先匹配 3 个，剩余的 2 个再匹配一次）。

花括号写法里 `{,m}` 是 GNU 扩展，POSIX ERE 只认 `{n}`、`{n,}`、`{n,m}` 三种；BusyBox 环境下用 `{,m}` 可能直接报错。

### 问号 `?`：前一个字符出现 0 次或 1 次

`?` 匹配前一个字符出现 0 次或者 1 次。准备第三个测试文件：

```bash
cat >go.txt<<EOF
gd
god
good
goood
gooood
EOF
```

```console
[root@linux-node1 ~]# grep "o*" go.txt
gd
god
good
goood
gooood
[root@linux-node1 ~]# egrep "o+" go.txt
god
good
goood
gooood
[root@linux-node1 ~]# egrep "o?" go.txt
gd
god
good
goood
gooood
[root@linux-node1 ~]# egrep "o?" go.txt -o
o
o
o
o
o
o
o
o
o
o
[root@linux-node1 ~]# egrep "o+" go.txt -o
o
oo
ooo
oooo
```

对比输出可以看出：`o*` 连没有 o 的 `gd` 行也能匹配（允许 0 次），`o+` 要求至少出现一个 o；`o?` 同样能匹配所有行，但配合 `-o` 时每个位置最多只抓一个 o（共 10 个），而 `o+` 会把连续的 o 合成一段（o、oo、ooo、oooo）。

如果不想加 `-E`，基础 grep 里可以把 `+` 写成转义形式 `\+`，效果一样：

```console
[root@linux-node1 ~]# grep "o\+" go.txt
god
good
goood
gooood
```

### 数量符号对比速查

| 符号 | 重复次数 | 示例 |
| --- | --- | --- |
| `*` | 0 次或多次 | `o*` |
| `+` | 1 次或多次 | `o+` |
| `?` | 0 次或 1 次 | `o?` |
| `{n,m}` | 至少 n 次，最多 m 次 | `o{2,3}` |
| `{n}` | 正好 n 次 | `o{2}` |
| `{n,}` | 至少 n 次 | `o{2,}` |
| `{,m}` | 最多 m 次 | `o{,2}` |

这七个量词可以组合出绝大多数数量需求，拿不准的写法先 `echo` 一段样例文本本地验证，再上真实文件。

## 原理解析：贪婪匹配与回溯

量词符号（`*`、`+`、`?`、`{n,m}`）的匹配过程并不是"数好次数再交卷"，而是按下面的步骤进行的：

1. **优先多吃**：遇到 `*`、`+`、`{n,m}` 时，引擎先把能吃的字符全部吃掉，这就是"贪婪"。
2. **向后交付**：吃掉之后如果后续模式还能继续匹配，就直接交付结果。
3. **回溯（backtracking）**：如果后续模式匹配不上（例如 `.*o` 要求末尾还有一个 o），引擎就从刚吃掉的字符里"吐"出一个，再试后续模式；还不成就再吐一个，直到吐无可吐或匹配成功。
4. **最左最长**：POSIX 规定正则匹配取"最左边开始、且最长"的那一个。所以 `echo "00000" | grep -oE "0{2,3}"` 先吐出 3 个 0，剩下的 2 个 0 再独立匹配一次，输出两段 `000` 和 `00`。这个规则还有个副作用：`echo "abcabc" | grep -oE "a[bc]*c"` 输出的是整段 `abcabc` 而不是两段 `abc`——DFA 找到的是最长匹配。

由此可以推出三条实战结论：

- **贪婪是默认的**：想让匹配"短一点"，不能靠改量词，而要靠模式末尾追加确定文本来收敛（`^m.*o` 与 `^m.*to` 的对比就是例子）。
- **非贪婪量词不属于 POSIX**：`*?`、`+?` 这类"懒惰匹配"写法只有 Perl 系引擎支持（`grep -P`、`pcregrep`），`grep -E` 用不了。
- **小心嵌套量词的性能陷阱**：像 `(a+)+b` 这样"量词套量词"的模式，在回溯引擎（PCRE）上可能触发指数级回溯，一行文本就能让 CPU 打满；POSIX 引擎（`grep -E` 内部用 DFA）通常没有这个问题。写复杂模式时尽量把分支写开，避免无界量词层层嵌套。

回溯的代价在实践中经常被低估：日志量大的场景，一个写坏的嵌套正则能把 grep 跑成 CPU 杀手，而且日志越长越慢。先把模式在样例数据上用 `grep -o` 验证匹配范围，再上生产管道，是省 CPU 的好习惯。

## 综合实战：从 ip address 输出中提取 IP 地址

需求：利用 `ip address show eth0` 只把 IP 地址信息显示出来。先看原始输出：

提取 IP 这个需求本身不重要，重要的是它演示了"从混杂文本里抠目标"的通用流程：先粗筛行，再精化模式，最后用 `-o` 抠片段。日志提取、配置解析都是这条路。

```console
[root@linux-node1 ~]# ip a s eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 00:0c:29:81:57:66 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.200/24 brd 10.0.0.255 scope global noprefixroute eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::31af:a93d:2d09:e293/64 scope link noprefixroute
       valid_lft forever preferred_lft forever
```

第一步，用 `.` 匹配任意字符，先把"长得像 IP"的行捞出来：

```console
[root@linux-node1 ~]# ip a s eth0|grep "[0-9].[0-9].[0-9].[0-9]"
    inet 10.0.0.200/24 brd 10.0.0.255 scope global noprefixroute eth0
```

第二步，想把每段数字写成"一位或多位"，直接加 `+` 却没有任何输出——基础正则不认识 `+`：

```console
[root@linux-node1 ~]# ip a s eth0|grep "[0-9]+.[0-9]+.[0-9]+.[0-9]+"
```

第三步，换成 `egrep` 有输出了，但把 MAC 地址行也匹配了进来——因为 `.` 匹配任意字符，冒号也能被匹配：

```console
[root@linux-node1 ~]# ip a s eth0|egrep "[0-9]+.[0-9]+.[0-9]+.[0-9]+"
    link/ether 00:0c:29:81:57:66 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.200/24 brd 10.0.0.255 scope global noprefixroute eth0
```

第四步，把点转义成 `\.`，只匹配真实的小数点，输出立刻精确：

```console
[root@linux-node1 ~]# ip a s eth0|egrep "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+"
    inet 10.0.0.200/24 brd 10.0.0.255 scope global noprefixroute eth0
```

第五步，加 `-o` 只输出匹配到的片段，配合 `head` 取本机 IP：

```console
[root@linux-node1 ~]# ip a s eth0|egrep "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" -o
10.0.0.200
10.0.0.255
[root@linux-node1 ~]# ip a s eth0|egrep "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" -o|head -1
10.0.0.200
```

第六步，用分组观察 IP 的段结构，`([0-9]+\.)` 一次只抓一个"数字加点"：

```console
[root@linux-node1 ~]# ip a s eth0|egrep "([0-9]+\.)" -o
10.
0.
0.
10.
0.
0.
```

第七步，`{3}` 指定前三段重复三次，再接一段纯数字，就是一个完整的 IPv4：

```console
[root@linux-node1 ~]# ip a s eth0|egrep "([0-9]+\.){3}[0-9]+" -o
10.0.0.200
10.0.0.255
```

第八步，如果写成 `([0-9]+\.?){4}`（最后的点可选），就会把 mtu 1500、qlen 1000 也抓出来：

```console
[root@linux-node1 ~]# ip a s eth0|egrep "([0-9]+\.?){4}" -o
1500
1000
10.0.0.200
10.0.0.255
```

此时配合 `head -3|tail -1` 即可拿到目标 IP：

`head -3|tail -1` 这种定位写法依赖输出顺序，`ip` 版本升级导致行序变化时要重新验证，别把它当一劳永逸的写法。

```console
[root@linux-node1 ~]# ip a s eth0|egrep "([0-9]+\.?){4}" -o|head -3|tail -1
10.0.0.200
```

> **注意：** 这条链路集中了三个坑：正则里的 `.` 匹配任意字符，匹配真实点必须转义；`+`、`{}`、`()` 都属于扩展正则，必须加 `-E` 或使用 `egrep`；`-o` 只打印匹配到的片段，是从整行里"抠"信息的关键参数。

回头看这条进化链：从 `[0-9].[0-9].[0-9].[0-9]` 到 `([0-9]+\.){3}[0-9]+`，模式可读性和精确度同步上升。写正则的过程就是这样——先粗匹配拿到东西，再逐步加约束排除噪声，一步到位反而是少数。实际敲一遍就明白每一步改动的意义。

## grep 实战案例

下面三个案例覆盖运维最高频的 grep 用法，先准备两份测试数据：

```bash
cat >access.log<<EOF
192.168.1.10 - - [24/Oct/2026:10:00:01 +0800] "GET /index.html HTTP/1.1" 200 512 "-" "Mozilla/5.0"
10.0.0.5 - - [24/Oct/2026:10:00:02 +0800] "GET /api/data HTTP/1.1" 404 128 "-" "curl/7.8"
192.168.1.10 - - [24/Oct/2026:10:00:03 +0800] "POST /login HTTP/1.1" 200 89 "-" "Mozilla/5.0"
172.16.0.8 - - [24/Oct/2026:10:00:04 +0800] "GET /static/logo.png HTTP/1.1" 200 2048 "-" "Mozilla/5.0"
EOF
```

### 案例一：统计访问来源 IP Top N

思路：`-o` 把 IP 从整行里抠出来，`sort | uniq -c` 统计次数，`sort -rn` 按次数倒序，`head` 取前几名。这是"提取 + 计数"的标准管道：

```console
[root@linux-node1 ~]# grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' access.log | sort | uniq -c | sort -rn | head
      2 192.168.1.10
      1 172.16.0.8
      1 10.0.0.5
```

> **注意：** `[0-9]{1,3}` 是"够用就好"的写法，严格校验 IPv4 每段 0-255 的正则非常长，日常统计没必要；如果是安全场景要做精确校验，建议交给专业工具。

这条管道值得存成脚本或别名，日志分析的高频动作没必要每次现敲。管道里的 `sort` 默认按字典序排数字，`sort -rn` 才是数值倒序；数字带单位（如 `du -h` 输出的 4.0K、10M）时要用 `sort -rh`。`uniq -c` 合并的只是相邻重复行，所以 sort 必须在它前面——这里有个坑：顺序错了统计结果就是错的，而且不报错，只能靠肉眼发现。

### 案例二：提取文本中的邮箱地址

```bash
cat >contact.txt<<EOF
admin@example.com
test.user@mail.example.org
无效邮箱：no-at-sign
someone+tag@example.com
EOF
```

```console
[root@linux-node1 ~]# grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' contact.txt
admin@example.com
test.user@mail.example.org
someone+tag@example.com
```

模式拆解：`[A-Za-z0-9._%+-]+` 是用户名部分（字母数字加点号、下划线、百分号、加号、减号），`@` 是分隔符，`[A-Za-z0-9.-]+` 是域名部分，`\.[A-Za-z]{2,}` 是顶级域名（至少两个字母）。没有 `@` 或没有顶级域名的行自然被过滤掉。

这个模式覆盖了日常九成场景，但"邮箱正则"本质上是无底洞：RFC 5322 规范里的合法地址可以带引号、注释、嵌套结构，完整的校验正则长到没法维护。做输入校验时，正则粗筛 + 发确认邮件验证才是靠谱路径；做日志统计就更没必要较真，抓得住常见格式即可。

### 案例三：日志关键字计数

```console
# 含 ERROR 的行有多少行
[root@linux-node1 ~]# grep -c 'ERROR' app.log

# GET 请求出现了多少次（-o + wc -l 统计"出现次数"而非行数）
[root@linux-node1 ~]# grep -oE 'GET|POST' access.log | sort | uniq -c
      3 GET
      1 POST

# 只想看某个时间段之后的日志，先按时间过滤再统计
[root@linux-node1 ~]# grep -E '10:00:0[2-4]' access.log | grep -c '200'
```

配合 awk 可以做更完整的统计（HTTP 状态码在第 9 列）：

```console
[root@linux-node1 ~]# awk '{print $9}' access.log | sort | uniq -c | sort -rn
      3 200
      1 404
```

状态码分布用 awk 按列统计比正则抠取更稳，日志字段没有引号包住空格时尤其如此。grep 与 awk 在统计场景是搭档不是对手：正则负责"选行"，awk 负责"取列、聚合"。管道每一环都值得单独跑一遍看输出，组合问题拆开全是小问题。

## grep 与 find -exec grep 的对比

递归搜索内容有两条路线：`grep -r` 一把梭，或者 `find` 先筛文件、再用 `-exec grep` 搜内容。二者能力互补：

| 维度 | `grep -r` | `find ... -exec grep` |
| --- | --- | --- |
| 递归能力 | 自带递归 | 由 find 的匹配条件决定 |
| 文件筛选 | `--include` / `--exclude` 按文件名 | `-name` `-mtime` `-size` `-perm` 等任意条件 |
| 符号链接 | `-r` 不跟随，`-R` 跟随 | 由 find 的 `-L` / `-P` 决定 |
| 输出文件名 | 多文件时默认带文件名前缀 | `grep -H` 显式指定，单文件时要手动加 |
| 参数传递 | 无文件数限制 | `+` 批量传参（推荐）；`\;` 每个文件起一次进程 |
| 典型场景 | 纯内容搜索 | 先按文件属性（时间、大小、属主）筛选，再搜内容 |

```bash
# 场景一：全目录搜内容，一行搞定
grep -rn --include="*.log" "ERROR" /var/log

# 场景二：只搜最近 7 天修改过的日志，find 更擅长
find /var/log -name "*.log" -mtime -7 -exec grep -H "ERROR" {} +

# 场景三：对找到的每个文件执行带行号的搜索（\; 形式逐个执行）
find /etc -name "*.conf" -exec grep -Hn "Listen" {} \;
```

> **注意：** `-exec ... {} +` 把多个文件名合并成一次命令执行，效率远高于 `-exec ... {} \;`（每个文件起一个进程）。能用 `+` 的场合就不要用 `\;`。另外 `find -exec grep` 不会自动加文件名，记得显式写 `-H`。

两条路线选哪个，判据就一条：筛选条件能不能用 `--include` 表达？能，`grep -r`；不能（要按时间、大小、属主筛），find。

## 超越 grep：pcregrep 与 ripgrep

### pcregrep：Perl 兼容正则的命令行版

标准 grep 的正则是 POSIX 流派，想要 Perl 风格的高级特性（环视、非贪婪、`\d` `\w`、后向引用写在模式里），可以用 pcregrep：

```bash
# 匹配"user=" 后面的单词（正向环视，标准 grep -E 写不了）
pcregrep '(?<=user=)\w+' config.txt

# 非贪婪匹配：一行里取最短的引号内容
pcregrep -o '"[^"]*?"' log.txt
```

pcregrep 来自 PCRE 库，多数发行版仓库都有（Debian/Ubuntu 包名为 `pcregrep`，RHEL 系在 `pcre-tools` / `pcre2-tools` 中，注意 PCRE2 的命令是 `pcre2grep`）。它更适合一次性提取任务；写可移植脚本仍建议用 POSIX 语法。环视（lookaround）是正则进阶的分水岭：`(?<=user=)\w+` 表示"匹配 user= 后面的单词但不带上 user="，POSIX 引擎不支持环视——这也解释了为什么很多提取任务最后都流向了 PCRE 系工具。

### ripgrep：面向现代代码库的搜索工具

ripgrep（`rg`）是近年最流行的 grep 替代品，特点：

- **默认递归**：不用加 `-r`，自动跳过 `.gitignore` 里的文件和二进制文件；
- **速度快**：Rust 实现，多线程，利用内存映射；
- **语法兼容**：默认使用类似 PCRE 的正则方言，`-F` 固定字符串、`-i` 忽略大小写、`-w` 整词等参数与 grep 一致。

```bash
# 在当前目录递归搜索（自动跳过 .gitignore 与隐藏文件）
rg 'TODO' .

# 只搜 Python 文件
rg -t py 'import os'

# 查看统计信息
rg --stats 'password' .

# 强制搜索所有文件（包括被 .gitignore 忽略的）
rg -uu 'secret' .
```

> **注意：** ripgrep 默认尊重 `.gitignore`，做安全审计、日志全量搜索时要加 `-uu`（或 `--no-ignore`）才能覆盖被忽略的文件。安装：Debian/Ubuntu `apt install ripgrep`，RHEL/Rocky/AlmaLinux `dnf install ripgrep`，也可以直接从 GitHub Releases 下载静态二进制。

rg 的一个细节：它对 UTF-8 与常见编码感知更好，中文日志搜索的命中率通常优于 grep；性能之外，这也是日志团队迁移的理由之一。

## 知识卡片

**扩展正则符号卡**

| 符号 | 含义 | BRE 等价写法 |
| --- | --- | --- |
| `+` | 1 次或多次 | `\+` |
| `?` | 0 次或 1 次 | `\?` |
| `\|` | 或者 | `\|` |
| `()` | 分组 | `\(` `\)` |
| `{n,m}` | n 到 m 次 | `\{n,m\}` |

**开关卡**

| 需求 | 写法 |
| --- | --- |
| grep 用扩展正则 | `grep -E 'pattern'`（`egrep` 已废弃） |
| sed 用扩展正则 | `sed -E 'script'`（`sed -r` 为 GNU 旧写法） |
| grep 用 Perl 正则 | `grep -P 'pattern'`（依赖编译支持） |
| grep 固定字符串 | `grep -F 'pattern'` |

**实战管道卡**

| 目的 | 管道 |
| --- | --- |
| 提取片段并计数 | `grep -oE 'pattern' file \| sort \| uniq -c \| sort -rn \| head` |
| 取整行并计数 | `grep -c 'pattern' file` |
| 只判断有没有 | `grep -q 'pattern' file` |
| 带上下文查看 | `grep -n -C3 'pattern' file` |

## 常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `grep -E "a\|b"` 被 Shell 拆成两条命令 | 模式没加引号，`\|` 成了管道符 | 看命令颜色/回显是否被截断 | 模式一律加单引号：`grep -E 'a\|b'` |
| `grep -E "0{2,3}"` 报错或行为怪异 | 花括号被 Shell 展开（`{2,3}` 不是合法序列时保留原样，但引号缺失仍可能出问题） | `echo 0{2,3}` 观察展开结果 | 模式加单引号 |
| 提取 IP 时把 MAC 地址也匹配进来 | 正则里的 `.` 匹配了冒号 | 去掉 `\.` 的转义对比输出 | 匹配小数点必须写 `\.` |
| `grep -P '\d'` 报 `support for the -P option has not been compiled` | 当前 grep 编译时未链接 PCRE 库 | `echo 1 \| grep -P '\d'` | 改用 `[[:digit:]]`，或安装支持 PCRE 的 grep / 用 `rg` |
| 复杂模式一跑 CPU 就 100% | PCRE 回溯引擎遇到嵌套量词（如 `(a+)+b`） | `top` 看进程状态，Ctrl+C 中断 | 改写模式避免无界量词嵌套；或用 DFA 引擎的 `grep -E` |
| `egrep` 调用时告警 | egrep 已被 POSIX 废弃 | `type egrep` | 全部换成 `grep -E` |
| `uniq -c` 统计结果不对 | 输入未排序，`uniq` 只合并相邻重复行 | 检查管道里有没有 `sort` | `grep -o ... \| sort \| uniq -c` |

## 现代环境补充

- **`egrep` / `fgrep` 已废弃**：POSIX 标记为 deprecated，GNU grep 调用时会打印警告。新脚本统一用 `grep -E` / `grep -F`。
- 老版本工具的行为差异别忽视：CentOS 7 EOL 后遗留环境里的 grep 2.20、sed 4.2 对某些参数组合的处理与新版不同，从老机器迁移脚本到 Rocky/Alma 9 时，先在新环境用样例数据跑一遍回归。
- **`sed -r` → `sed -E`**：`-r` 是 GNU sed 的旧式选项，POSIX 2018 起 `-E` 成为标准写法，GNU sed 4.3（2017）之后两者等价。追求兼容性时优先 `-E`。
- **CentOS 7 已于 2024 年 6 月 EOL**：其自带 grep 2.20、sed 4.2 都不支持 `sed -E`，升级 Rocky Linux 9 / AlmaLinux 9 / CentOS Stream 9 后可获得 grep 3.x、sed 4.8，`-E` 与 `-P`（PCRE2）支持更完整。
- **`passwd --stdin` 的兼容性**：这是 RHEL 系特有的批量设密方式，Debian/Ubuntu 请使用 `chpasswd`；跨平台脚本建议用 `chpasswd` 或配置管理工具（Ansible `user` 模块）处理。
- **现代替代**：交互式搜索与大代码库检索推荐 ripgrep（`rg`）；需要更强兼容性与 Unicode 处理时可关注 ugrep。生产脚本中 grep 仍是 POSIX 保底选择。

## 课后作业

1. sed / awk 命令如何进行排除过滤（提示：参考 `grep -v` 的思路）。
2. 批量创建用户 tom01 到 tom10，并给每个用户设置随机密码（提示：如何生成随机信息、变量设置、循环语句）。
3. 取 IP 地址、取权限数值：利用 grep / sed / awk 加正则符号完成。
4. sed 命令综合练习。

## 自测题

1. `grep 'a+b'`、`grep -E 'a+b'`、`grep 'a\+b'` 三个命令等价吗？各自匹配什么？

> **答案：** `grep -E 'a+b'` 和 `grep 'a\+b'` 等价，都匹配"一个或多个 a 后接 b"（如 ab、aab）；`grep 'a+b'` 在基础正则里匹配的是字面字符串 `a+b`。

2. 为什么 `echo "00000" | grep -oE "0{2,3}"` 会输出两段（`000` 和 `00`）？

> **答案：** 量词默认贪婪，且 POSIX 规定"最左最长"匹配：第一段尽可能吃满 3 个 0，剩余 2 个 0 再独立匹配一次 `0{2,3}`，于是得到 `000` 和 `00` 两段输出。

3. 从 `ip address` 输出中提取 IP 地址时，正则里哪个符号必须转义？不转义会发生什么？

> **答案：** 小数点必须转义成 `\.`。`.` 匹配任意字符，不转义时 MAC 地址（用冒号分隔）也会被 `[0-9]+.[0-9]+...` 这样的模式匹配进来，导致结果混入非 IP 行。

4. `grep -rn 'ERROR' /var/log` 和 `find /var/log -name "*.log" -mtime -7 -exec grep -H 'ERROR' {} +` 分别适合什么场景？

> **答案：** 前者适合纯内容递归搜索，简单直接；后者适合先按文件属性（文件名、修改时间、大小等）筛选出目标文件，再搜内容。当筛选条件超出 `--include` 表达能力时（如时间、大小），必须用 `find -exec grep`。

5. 非贪婪匹配（尽量少匹配）在 `grep -E` 里怎么写？

> **答案：** 写不了。`*?`、`+?` 这类非贪婪量词属于 Perl 系语法，`grep -E`（POSIX ERE）不支持。要么用 `grep -P` / `pcregrep` / `rg`，要么把模式改写成"两端锚定具体文本"的 POSIX 写法。

6. `sed 's#(..)(..)(..)#<\1><\2><\3>#g'` 不加 `-r` 会怎样？

> **答案：** 基础 sed 里圆括号是普通字符，模式会去匹配字面的 `(..)`，同时 `\1` 找不到分组，直接报 invalid reference 错误。要写成转义形式 `\(..\)\(..\)\(..\)`，或加 `-r`/`-E`。

7. 从 `ip a` 输出提取 IP，为什么最终模式是 `([0-9]+\.){3}[0-9]+` 而不是 `([0-9]+\.?){4}`？

> **答案：** 前者强制前三段以点结尾、最后一段纯数字，结构上就是 IPv4；后者的 `\.?` 让点可有可无，mtu 1500、qlen 1000 这类纯数字也被凑成"四段"匹配进来，噪声太多。

## 相关阅读

- 系统符号、通配符号与基础正则表达式
- sed 命令详解：文本处理的增、删、改、查
- awk 命令详解：取列、匹配与统计
- 附录-命令速查表

## 小结

1. 三类符号分工明确：系统符号由 Shell 解释执行，通配符号匹配文件名，正则符号匹配文件内容，三者不可混用；判断"谁在解释"的依据是引号内外。
2. 基础正则六件套：`.` 匹配单个字符、`*` 重复零次或多次、`.*` 贪婪匹配任意内容、`\` 转义、`[]` 字符集合、`[^]` 排除，grep / sed / awk 默认支持。
3. 扩展正则需要"开关"：grep 加 `-E` 或改用 `egrep`，sed 加 `-r`；`+`、`|`、`()`、`{}`、`?` 五个符号全部依赖它，否则只是普通字符。
4. BRE 与 ERE 的转义方向正好相反：BRE 里给元字符加 `\` 才生效，ERE 里元字符直接生效、加 `\` 反而变普通字符，两种模式间移植正则要逐个核对。
5. 圆括号两大用途：把多个信息作为整体匹配（支持组内 `|` 多选），以及后向引用 `\1`、`\2`，配合 `sed -r` 可批量生成命令、批量改写格式。
6. 数量符号速记：`*` 零或多、`+` 一或多、`?` 零或一、`{n,m}` 指定区间；贪婪匹配靠模式末尾的具体文本收敛。
7. 提取 IP 的完整思路：`[0-9]` 抓数字，`+` 抓连续数字，`\.` 锁定小数点，`-o` 抠出片段，`{3}` 限定段数，最后用 `head` / `tail` 取目标结果。
8. "提取 + 计数"的标准管道：`grep -oE 'pattern' file | sort | uniq -c | sort -rn | head`，统计 IP Top、请求方法、状态码都靠它。
9. `grep -r` 与 `find -exec grep` 互补：纯内容搜索用前者；按文件属性（时间、大小、权限）筛选后再搜内容用后者，`-exec ... {} +` 效率高于 `\;`。
10. 进阶工具按需选用：`grep -P` / `pcregrep` 提供 Perl 风格正则（环视、非贪婪），ripgrep 提供更快的递归搜索体验；可移植脚本仍以 POSIX 语法保底。
11. "提取 + 计数"管道的两个铁律：`sort` 必须在 `uniq -c` 之前；数值排序用 `sort -rn`，带单位用 `sort -rh`。
{% endraw %}
