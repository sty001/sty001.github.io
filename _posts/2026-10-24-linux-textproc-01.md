---
title: "sed 命令详解：文本处理的增、删、改、查"
date: 2026-10-24 09:01:00 +0800
categories: [软件, Linux, 文本处理三剑客]
tags: [Linux, 文本处理三剑客]
---

{% raw %}
sed 是字符流编辑器，文本处理三剑客之一。本篇从语法结构与执行原理讲起，覆盖定址方式、按行号与按内容查询、插入与追加、删除、替换（含后项引用取 IP 地址）、多行模式、`-i` 直接编辑文件与自动备份等实战用法，最后附指令与参数速查表。前提是已掌握基本正则表达式；目标是能用命令行批量修改配置文件。

## 一、预备知识：正则表达式速览

sed 的匹配能力建立在正则符号之上，先快速回顾一下。

### 1.1 基础正则符号

| 符号 | 作用 | 示例 |
| --- | --- | --- |
| `^` | 以什么开头的信息进行匹配 | `^test` |
| `$` | 以什么结尾的信息进行匹配 | `test$` |
| `^$` | 匹配空行信息 | `grep -v "^$"` |
| `.` | 匹配任意一个且只有一个字符 | `grep "."` |
| `*` | 匹配前一个字符连续出现 0 次或者多次 | `o*` |
| `.*` | 匹配所有任意信息，类似通配符 `*` | `.*` |
| `\` | 将有意义的字符转义成普通字符识别；也可以把普通字符转成有特殊含义的字符（`\n` `\r` `\t`） | `\.` |
| `[]` | 匹配多个字符信息，多个字符之间是"或者"的关系 | `[ok]` |
| `[^]` | 对匹配的字符信息进行排除 | `[^ok]` |

> **注意：** `[]` 会把一个字符串拆分成一个一个的字符进行匹配，而不是把整个字符串当整体匹配。

### 1.2 扩展正则符号

| 符号 | 作用 |
| --- | --- |
| `+` | 匹配前一个字符连续出现 1 次或者多次 |
| `\|` | 利用竖线可以匹配多个字符串信息 |
| `()` | 将多个字符信息汇总成整体进行过滤；也用于后项引用前项，如 `(test) \1` |
| `{n,m}` | 指定前一个字符连续出现的次数，至少 n 次、最多 m 次 |
| `{n}` | 匹配只连续出现 n 次的信息 |
| `{n,}` | 至少连续 n 次，最多不限 |
| `{,m}` | 至少连续 0 次，最多 m 次 |
| `?` | 匹配前一个字符连续出现 0 次或者 1 次 |

不同命令识别扩展正则的方式：

```bash
grep 命令识别扩展正则: egrep 或 grep -E
sed  命令识别扩展正则: sed -r
```

> **注意：** `sed -r` 是 GNU sed 的旧式写法，POSIX 2018 起 `sed -E` 成为标准写法，GNU sed 4.3 之后两者完全等价。写新脚本建议用 `-E`。

### 1.3 两个易错点

**问题一：文件中有 `\` 撬棍信息，如何进行过滤？**

```bash
[root@linux-node1 ~]# grep '\\' test.txt
I \teach \linux.
```

**问题二：文件中有 `$` 符号时，识别为变量还是普通符号？**

```bash
[root@linux-node1 ~]# grep '$username' test.txt
$username
[root@linux-node1 ~]# grep "\$username" test.txt
$username
```

单引号与 `\` 转义都能让 `$` 被当成普通字符处理。

## 二、sed 是什么

sed 是**字符流编辑工具**（行编辑工具），按照每行中的字符进行处理操作。与之相对的是 vi / vim 这类全屏编辑工具。

sed 的作用特点：

1. 擅长对行进行操作处理；
2. 擅长将文件的内容信息进行修改调整、删除。

具体功能可以概括为四个字：

| 能力 | 说明 |
| --- | --- |
| 增 | 文件中添加信息的能力 |
| 删 | 文件中删除信息的能力 |
| 改 | 文件中修改信息的能力 |
| 查 | 文件中查询信息的能力 |

## 三、典型应用场景：批量修改网卡地址

假设 50 台主机迁移机房，需要修改 IP 地址。手工操作三步：

```bash
第一个步骤：vi ifcfg-eth0
第二个步骤：重启网络服务
第三个步骤：检查测试
```

写成自动修改脚本后同样三步：

```bash
# 第一个步骤：修改地址
sed -i "s#10.0.0.200#10.0.0.201#g" ifcfg-eth0

# 第二个步骤：重启网络服务
systemctl restart network

# 第三个步骤：过滤 ip a s eth0 网卡地址信息，存储到一个文件中（共享存储）
```

> **注意：** `systemctl restart network` 与 `ifcfg-eth0` 是 CentOS 7 时代的写法。Rocky Linux / AlmaLinux / CentOS Stream 8 之后网络配置由 NetworkManager 管理，网卡配置文件位于 `/etc/NetworkManager/system-connections/`，命令行管理用 `nmcli connection`；启停用 `systemctl restart NetworkManager` 或 `nmcli connection up <连接名>`。sed 的用法本身不变，只是操作的文件和重启方式变了。

## 四、sed 命令语法

```bash
sed [OPTION]... {script-only-if-no-other-script} [input-file]...
命令  参数        条件+处理= (指令)              处理文件信息
```

例如显示出文件中有 `test` 关键字的行：

```bash
sed  -n          '/test/p'                      test.txt
```

即：**参数 +（条件 + 处理指令）+ 处理的文件**。

## 五、sed 命令执行原理

### 5.1 逐行处理的文字步骤

sed 逐行读取文件内容到模式空间中进行处理，完整流程如下：

1. **读入一行**：从输入文件读取下一行，去掉行尾换行符，放入**模式空间**（pattern space，当前正在处理的那一行）；
2. **执行脚本指令**：对模式空间里的内容依次执行所有指令（如 `s`、`d`、`p`）；
3. **自动输出**：每行处理完，默认把模式空间的内容（加回换行符）打印到屏幕；
4. **读取下一行**：重复上述过程，直到所有行处理完毕。

因为是按行处理，所以 sed 天然擅长"对行做操作"。

> **注意：** 默认情况下 sed 会把处理过的每一行都输出到屏幕；只有加上 `-n` 参数取消默认输出后，才只显示 `p` 指令指定的行。

### 5.2 模式空间与保持空间

sed 内部有两个缓冲区，理解它们是掌握高级用法的前提：

| 空间 | 作用 |
| --- | --- |
| 模式空间（pattern space） | 当前正在处理的行，绝大多数指令操作的都是它 |
| 保持空间（hold space） | 辅助暂存区，跨行保存内容，配合 `h` `H` `g` `G` `x` 使用 |

常用保持空间指令：

| 指令 | 作用 |
| --- | --- |
| `h` | 用模式空间的内容**覆盖**保持空间 |
| `H` | 把模式空间的内容**追加**到保持空间（带换行） |
| `g` | 用保持空间的内容**覆盖**模式空间 |
| `G` | 把保持空间的内容**追加**到模式空间（带换行） |
| `x` | 交换模式空间与保持空间的内容 |

一个经典组合：`1!G;h;$p` 实现文件倒序输出（相当于 `tac`）：

```bash
printf 'a\nb\nc\n' | sed -n '1!G;h;$p'
```

执行过程：第 1 行只入保持空间；第 2 行先把保持空间的 `a` 追加到自己后面（`b\na`）再存回保持空间；第 3 行同理得到 `c\nb\na`；`$p` 只在最后一行打印，于是输出 `c`、`b`、`a`。

再如 `G` 单独使用可以把文件变成双倍行距（每行后插一个空行）：

```bash
printf 'a\nb\n' | sed G
```

## 六、准备测试环境

```bash
cat >person.txt<<EOF
101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO
104,tom,CFO
105,jerry,CIO
EOF
```

```bash
[root@linux-node1 ~]# cat person.txt
101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO
104,tom,CFO
105,jerry,CIO
```

> **注意：** 课堂演示过程中 `person.txt` 的内容会随着示例推进而变化（部分示例是在已追加、已修改过的文件上执行的），因此下文各例的输出以笔记原始记录为准。自己复现时请以当前文件内容为准。另外，笔记中后续示例输出里出现了第 6 行 `106,zhangsan,CIO`，可理解为演示过程中追加的记录。

## 七、sed 定址方式总表

定址就是告诉 sed"哪些行要处理"。sed 支持以下定址方式，可以单独使用，也可以组合（如 `1,/^$/d`）：

| 定址方式 | 写法 | 示例 | 说明 |
| --- | --- | --- | --- |
| 单一行号 | `n` | `3p` | 第 3 行 |
| 行号范围 | `n,m` | `1,3p` | 第 1 到第 3 行（含） |
| 不连续多行 | `n;m` | `1p;3p` | 第 1 行和第 3 行 |
| 最后一行 | `$` | `$a...` | 文件末尾行 |
| 正则定址 | `/re/` | `/^#/d` | 匹配正则的行 |
| 正则范围 | `/re1/,/re2/` | `/BEGIN/,/END/d` | 从匹配 re1 的行到匹配 re2 的行 |
| 行号到正则 | `n,/re/` | `1,/^$/d` | 从第 n 行到匹配正则的行为止 |
| 步进定址 | `first~step` | `0~2p` | GNU 扩展：从 first 起每 step 行（`0~2` 为偶数行，`1~2` 为奇数行） |
| 取反 | 地址后加 `!` | `/^#/!p` | 对**不**匹配的行执行指令 |
| 0 地址 | `0,/re/` | `0,/END/d` | GNU 扩展：从文件开头搜到第一次匹配 |

步进定址的实例（GNU sed）：

```bash
seq 4 | sed -n '1~2p'
# 输出：1 3（奇数行）
seq 4 | sed -n '0~2p'
# 输出：2 4（偶数行）
seq 8 | sed -n '2~3p'
# 输出：2 5 8（从第 2 行起每 3 行）
```

> **注意：** `first~step` 是 GNU sed 的扩展，BSD/macOS 的 sed 不支持。统计日志奇数行、每隔 N 行采样，用它就不用先 `awk 'NR%2'` 过滤一遍了。

## 八、查：使用 p 指令查询信息

### 8.1 根据行号进行查询

**测试 1：显示单行信息**

```bash
[root@linux-node1 ~]# sed -n '3p' person.txt
103,Alex,COO
```

**测试 2：根据行号信息，输出多行内容（连续）**

```bash
[root@linux-node1 ~]# sed -n '1,3p' person.txt
101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO
```

**测试 3：根据行号信息，输出多行内容（不连续）**

```bash
[root@linux-node1 ~]# sed -n '1p;3p' person.txt
101,zhangsan,CEO
103,Alex,COO
```

### 8.2 根据内容信息进行查询

**测试 1：根据内容信息，输出单行内容**

```bash
# 将有 zhangsan 行的信息找出来
[root@linux-node1 ~]# sed -n '/zhangsan/p' person.txt
101,zhangsan,CEO
```

**测试 2：根据内容信息，输出多行内容（连续）**

```bash
# 将 zhangsan 到 Alex 之间的行都输出出来
[root@linux-node1 ~]# sed -n '/zhangsan/,/Alex/p' person.txt
101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO
```

**测试 3：根据内容信息，输出多行内容（不连续）**

```bash
# 将 zhangsan 和 Alex 的行都输出出来
[root@linux-node1 ~]# sed -n '/zhangsan/p;/Alex/p' person.txt
101,zhangsan,CEO
103,Alex,COO
106,zhangsan,CIO
```

排查日志时经常要"行号 + 内容"一起给出来，`=` 指令配合块命令即可：

```bash
printf 'ok\nerror: disk full\nok\n' | sed -n '/error/{=;p}'
# 输出：
# 2
# error: disk full
```

`{=;p}` 表示对匹配行先输出行号再输出内容，比 grep -n 少一道管道。反过来，`/error/!{=;p}` 对不匹配的行编号，取反逻辑同样成立。

## 九、增：使用 i 与 a 指令添加信息

**在文件第一行添加信息：**

```bash
[root@linux-node1 ~]# sed  '1i100,lucy,UFO' person.txt
100,lucy,UFO
101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO
104,tom,CFO
105,jerry,CIO
106,zhangsan,CIO
```

**在文件最后一行添加信息：**

```bash
[root@linux-node1 ~]# sed  '$a108,lucy,UFO' person.txt
101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO
104,tom,CFO
105,jerry,CIO
106,zhangsan,CIO
108,lucy,UFO
```

### 9.1 小练习

```bash
# 01. 在第三行后面添加 test.txt 信息
sed '3atest.txt' person.txt

# 02. 在第二行前面添加 test.txt 信息
sed '2itest.txt' person.txt

# 03. 在有 zhangsan 行的前面添加 lucy，后面添加 jack 信息
sed -e '/zhangsan/ilucy' -e  '/zhangsan/ajack' person.txt
```

第 3 题的执行效果（`-e` 用于识别多个操作指令）：

```bash
[root@linux-node1 ~]# sed -e '/zhangsan/ilucy' -e  '/zhangsan/ajack' person.txt
lucy
101,zhangsan,CEO
jack
102,lisi,CTO
103,Alex,COO
104,tom,CFO
105,jerry,CIO
lucy
106,zhangsan,CIO
jack
```

### 9.2 一次添加多行信息

利用 `\n` 换行符可以一次添加多行：

```bash
sed  '$a100\n101' person.txt
```

GNU sed 也支持把多行文本用反斜杠续行的标准写法（可移植性更好）：

```bash
printf 'x\n' | sed '1a\
line1\
line2'
```

企业中编写配置文件时经常这样用：

```bash
IPaddress=10.10.10.1
mask=255.255.255.0
gateway=10.10.10.254
```

```bash
sed '$aIPaddress=10.10.10.1\nmask=255.255.255.0\ngateway=10.10.10.254' 文件名称
```

## 十、删：使用 d 指令删除信息

**01. 删除单行信息**

```bash
[root@linux-node1 ~]# # 删除文件中第三行信息
[root@linux-node1 ~]# sed '3d' person.txt
100,lucy,UFO
101,zhangsan,CEO
103,Alex,COO
104,tom,CFO
105,jerry,CIO
106,zhangsan,CIO
```

**02. 删除多行信息（连续）**

```bash
[root@linux-node1 ~]# # 删除文件中第二行到第六行内容
[root@linux-node1 ~]# sed '2,6d' person.txt
100,lucy,UFO
106,zhangsan,CIO
```

**03. 按内容删除信息**

```bash
# 删除有 zhangsan 信息的行
sed '/zhangsan/d' person.txt
```

**04. 删除不连续的多行（删除第三行和第六行）**

```bash
[root@linux-node1 ~]# sed '3d;6d' person.txt
100,lucy,UFO
101,zhangsan,CEO
103,Alex,COO
104,tom,CFO
106,zhangsan,CIO
```

**05. 按范围删除信息**

```bash
# 删除 BEGIN 到 END 之间的所有行（含首尾两行）
printf 'a\nBEGIN\nx\nEND\nb\n' | sed '/BEGIN/,/END/d'
# 输出：a b
```

### 10.1 如何取消空行显示

三种写法都可以：

```bash
# 方式一：只输出含有任意字符的行
[root@linux-node1 ~]# sed -n '/./p' person.txt
100,lucy,UFO
101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO
104,tom,CFO
105,jerry,CIO
106,zhangsan,CIO

# 方式二：删除空行
[root@linux-node1 ~]# sed '/^$/d' person.txt
100,lucy,UFO
101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO
104,tom,CFO
105,jerry,CIO
106,zhangsan,CIO

# 方式三：对空行取反输出
[root@linux-node1 ~]# sed -n '/^$/!p' person.txt
100,lucy,UFO
101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO
104,tom,CFO
105,jerry,CIO
106,zhangsan,CIO
```

## 十一、改：使用 s 与 c 指令修改信息

### 11.1 基本替换

```bash
sed 's#原有内容#修改后内容#g' 文件信息
```

分隔符可以自定义，但不要和要替换的内容冲突，否则会报错：

```bash
[root@linux-node1 ~]# sed 's##lucy#lucy-new#g' person.txt
sed: -e expression #1, char 12: unknown option to `s'
[root@linux-node1 ~]# sed 's/#lucy/lucy-new/g' person.txt
100,lucy-new,UFO

101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO

104,tom,CFO
105,jerry,CIO
106,zhangsan,CIO
```

> **注意：** 第 2 条命令能匹配上，是因为此时文件内容中带有 `#` 字符（`#lucy`）。选择分隔符时优先挑内容里不出现的符号，例如 `#`、`@`、`%`。

**分隔符与特殊字符转义细则：**

- `s` 命令默认用 `/` 作分隔符，内容里 `/` 多时（路径、URL）换成 `#`、`@`、`%`、`,` 甚至 `|`；
- 模式中的元字符要转义后才按字面匹配：`.` → `\.`、`*` → `\*`、`[` → `\[`；`/` → `\/`；
- 替换串中 `&` 代表"整个匹配到的内容"，要输出普通 `&` 必须写 `\&`；`\1` 是后向引用；`\n` 表示插入换行（GNU sed）；
- 行内第 n 次替换：`s/a/b/3` 只替换每行第 3 个匹配；`s/a/b/2g` 从第 2 个匹配起全部替换（GNU 扩展）。

```bash
# & 的用法：把匹配到的内容用方括号包起来
echo abc | sed 's/b/[&]/'
# 输出：a[b]c

# 只替换每行第 3 个匹配
echo "a a a a" | sed 's/a/b/3'
# 输出：a a b a

# 从第 2 个匹配起全部替换
echo "a a a a" | sed 's/a/b/2g'
# 输出：a b b b

# 大小写不敏感替换（GNU 扩展的 I 标志）
printf 'Hello\nHELLO\n' | sed 's/hello/hi/I'
# 输出：hi hi
```

### 11.2 后项引用前项：取出 IP 地址

语法：`sed -r 's#()#\n#g' 文件信息`

**第一个历程：取出有 IP 地址的行**

```bash
[root@linux-node1 ~]# ip a s eth0|sed -n '3p'
inet 10.0.0.200/24 brd 10.0.0.255 scope global noprefixroute eth0
```

**第二个历程：取出 IP 地址（分步）**

```bash
[root@linux-node1 ~]# ip a s eth0|sed -n '3p'|sed -r 's#^.*net (.*)#\1#g'
10.0.0.200/24 brd 10.0.0.255 scope global noprefixroute eth0
[root@linux-node1 ~]# ip a s eth0|sed -n '3p'|sed -r 's#^.*net (.*)#\1#g'|sed -r 's#(.*)/24.*#\1#g'
10.0.0.200
```

**第三个历程：整合两个 sed 命令**

```bash
sed -r 's#^.*net (.*)#\1#g'|sed -r 's#(.*)/24.*#\1#g'   进行整合
ip a s eth0|sed -n '3p'|sed -r 's#^.*net (.*)/24.*#\1#g'
```

再把 `-n '3p'` 和替换指令整合到一起：

```bash
sed -n '3                        p'
sed -r 's#^.*net (.*)/24.*#\1#g'
sed -rn '3s#^.*net (.*)/24.*#\1#gp'
```

**最终取 IP 地址的方法：**

```bash
[root@linux-node1 ~]# ip a s eth0|sed -rn '3s#^.*net (.*)/24.*#\1#gp'
10.0.0.200
```

补一条边界说明，`&` 与 `\1` 经常被混用，其实分工不同：

- `&` 代表**整个匹配**，写起来最短，但只能引用全部内容，不能拆分；
- `\1` 引用第一个 `()` 分组，`\2` 引用第二个，能对匹配内容做**拆分与重组**；
- 注意位置语义：`()` 在**模式**里出现时，`\1`（POSIX 规范下要写成 `\(\)` 配对）表示"反向引用"，即匹配与第一个分组**相同的文本**，比如 `\(ab\)\1` 匹配 `abab`；而替换串里的 `\1` 才是"取出分组内容"。同一个符号在两侧含义不一样，读别人的脚本时别绕晕。

什么时候用哪个：只需要在匹配内容外面包一层（加注释符、加引号），用 `&`；需要交换两个字段、截取其中一段（如取 IP），必须用 `()` 加 `\1`。敲一遍就明白：

```bash
# & 只能整体引用
echo "hello world" | sed 's/hello.*/[&]/'
# 输出：[hello world]

# \1 可以拆出字段并交换顺序
echo "hello world" | sed -E 's/(hello) (world)/\2 \1/'
# 输出：world hello
```

### 11.3 补充一：修改文件时自动备份

```bash
[root@linux-node1 ~]# sed -i.bak  's#zhangsan#zhangsan-new#g' person.txt
[root@linux-node1 ~]# ll person.txt.bak
-rw-r--r--. 1 root root 104 Oct 10 11:40 person.txt.bak
[root@linux-node1 ~]# cat person.txt.bak
100,#lucy,UFO

101,zhangsan,CEO
102,lisi,CTO
103,Alex,COO

104,tom,CFO
105,jerry,CIO
106,zhangsan,CIO
```

`-i.bak` 会先把原文件备份为 `文件名.bak`，再修改原文件。

这里有个坑：**后缀是 `-i` 参数的一部分，必须紧贴着写**。GNU sed 的 `-i` 是"可选参数带值"的形式，写成 `sed -i .bak 's#a#b#g' file`（中间有空格）时，`.bak` 会被当成输入文件名，sed 报"找不到文件 .bak"，甚至可能把空后缀当作备份选项直接覆盖原文件——不留任何备份。macOS 的 BSD sed 更干脆，`-i` 后面强制要求跟后缀（不要备份就写 `sed -i ''`），带空格写法的行为也与 GNU 不同。

另一个容易忽略的点：`-i` 会新建文件再替换原文件，如果原文件是**符号链接**，替换后链接会变成普通文件，链接关系丢失。GNU sed 提供 `--follow-symlinks` 选项让 `-i` 编辑链接指向的目标文件；跨平台脚本也可以退一步，先用 `-i.bak` 输出到新文件再 `mv` 回去。

说白了，`-i` 是 sed 里最"危险"的参数：它没有确认机会，错了就是错了。所以生产上养成两个习惯——重要文件永远带 `.bak`，动手前先去掉 `-i` 在屏幕上看一遍输出。

### 11.4 补充二：`-n` 和 `-i` 不要同时使用

```bash
[root@linux-node1 ~]# sed -ni 's#Alex#aaaa#gp' person.txt
103,aaaa,COO
[root@linux-node1 ~]# cat person.txt
103,aaaa,COO
```

> **注意：** `-n` 和 `-i` 参数同时使用会把文件内容清空，只留下 `p` 输出的内容，真实替换文件时一定不能这样写。

### 11.5 批量修改文件扩展名

测试环境：

```bash
-rw-r--r--. 1 root root      0 Oct 10 02:10 test01.txt
-rw-r--r--. 1 root root      0 Oct 10 02:10 test02.txt
-rw-r--r--. 1 root root      0 Oct 10 02:10 test03.txt
-rw-r--r--. 1 root root      0 Oct 10 02:10 test04.txt
-rw-r--r--. 1 root root      0 Oct 10 02:10 test05.txt
-rw-r--r--. 1 root root      0 Oct 10 02:10 test06.txt
-rw-r--r--. 1 root root      0 Oct 10 02:10 test07.txt
-rw-r--r--. 1 root root      0 Oct 10 02:10 test08.txt
-rw-r--r--. 1 root root      0 Oct 10 02:10 test09.txt
-rw-r--r--. 1 root root      0 Oct 10 02:10 test10.txt
```

需求：把 `testxx.txt` 扩展名修改为 `testxx.jpg`。先用 sed 拼接出 `mv` 命令确认无误，再交给 `bash` 执行：

```bash
[root@linux-node1 test]# ls test*.txt|sed -r 's#(.*)txt#mv & \1jpg#g'
mv test01.txt test01.jpg
mv test02.txt test02.jpg
mv test03.txt test03.jpg
mv test04.txt test04.jpg
mv test05.txt test05.jpg
mv test06.txt test06.jpg
mv test07.txt test07.jpg
mv test08.txt test08.jpg
mv test09.txt test09.jpg
mv test10.txt test10.jpg
mv test.txt test.jpg
[root@linux-node1 test]# ls test*.txt|sed -r 's#(.*)txt#mv & \1jpg#g'|bash
```

其中 `&` 表示前面匹配到的全部内容，`\1` 表示第一个 `()` 中引用到的内容。

批量重命名还有专门命令 `rename`：

```bash
rename  .txt                           .jpg                 test*.txt
命令    文件名称需要修改的部分信息    修改成什么信息        将什么样的文件进行修改
```

> **注意：** `rename` 有两大流派：Perl 版（Debian/Ubuntu 默认，`rename 's/\.txt/.jpg/' *.txt` 用正则）和 util-linux 版（RHEL 系，`rename .txt .jpg *.txt` 纯字符串替换），参数完全不同，用错会静默不改名或报错。跨平台脚本建议坚持用 `sed` 拼 `mv` 或 `find` 方案。

### 11.6 `-i` 不能直接处理管道数据

```bash
[root@linux-node1 ~]# cat person.txt|sed -i 's#COO#CEO#g'
sed: no input files
[root@linux-node1 ~]# sed -i 's#COO#CEO#g' person.txt
```

> **注意：** `-i` 必须作用在具体的文件上，不能跟在管道后面，否则会报 `sed: no input files`。

### 11.7 整行替换：c 指令

```bash
[root@linux-node1 ~]# sed '2clinux-node-01' person.txt
103,aaaa,CEO
linux-node-01
```

## 十二、sed 常用参数详解

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `-n` | 取消默认输出，只显示 `p` 等指令显式打印的内容 | `sed -n '3p' person.txt` |
| `-e` | 指定一条编辑指令，可多次使用实现多条指令 | `sed -e 's/a/b/' -e 's/c/d/' file` |
| `-r` / `-E` | 识别扩展正则（`-E` 为 POSIX 推荐，GNU sed 4.3+ 支持） | `sed -E 's#(a+)#<\1>#' file` |
| `-i` | 真实编辑文件，把结果写回磁盘 | `sed -i 's/a/b/g' file` |
| `-i.bak` | 编辑前先把原文件备份为 `file.bak` | `sed -i.bak 's/a/b/g' file` |
| `-f` | 从脚本文件读取编辑指令，适合长脚本 | `sed -f edit.sed file` |
| `-s` | 把多个文件当作独立输入（行号、`$` 各自重新计算） | `sed -s '=' f1 f2` |
| `-z` | 用 NUL 字符而不是换行分隔"行"（GNU 扩展，配合 `grep -z` 处理含特殊字符的文件名） | `sed -z 's/\n/,/g' file` |

`-f` 脚本文件的用法：把多条指令写进文件，一行一条，`#` 开头为注释：

```bash
printf 's/zhangsan/lucy/g\ns/lisi/jack/g\n' >edit.sed
sed -f edit.sed person.txt
# 输出：
# 101,lucy,CEO
# 102,jack,CTO
# 103,Alex,COO
# 104,tom,CFO
# 105,jerry,CIO
```

`-s` 的效果（对比 `=` 行号在两个文件中的编号方式）：

```bash
printf '1\n2\n' >m1.txt
printf '3\n4\n' >m2.txt
sed -s '=' m1.txt m2.txt
# 输出：1 1 2 2 1 3 2 4（每个文件的行号都从 1 重新开始）
# 若不加 -s，第二个文件的行号会接着第一个文件继续编号（3 4 5 6）
```

## 十三、sed 编辑命令总表

| 指令 | 全称 | 作用 |
| --- | --- | --- |
| `p` | print | 输出模式空间的内容（常配合 `-n`） |
| `i` | insert | 在指定行**前面**插入文本 |
| `a` | append | 在指定行**后面**追加文本 |
| `d` | delete | 删除模式空间，立即开始下一行 |
| `s` | substitute | 替换，`s#旧#新#g`，`g` 表示全局替换 |
| `c` | change | 整行替换指定行 |
| `y` | transliterate | 逐字符转换，`y/abc/ABC/`，两个集合长度必须相同 |
| `r` | read file | 读取指定文件的内容，输出到当前行之后 |
| `R` | read line | 读取指定文件的**一行**，输出到当前行之后 |
| `w` | write file | 把模式空间内容写入指定文件（可追加） |
| `W` | write line | 只把模式空间的第一行写入文件 |
| `n` | next | 读取下一行进模式空间（不打印当前行剩余处理） |
| `N` | next append | 读取下一行**追加**进模式空间（中间插 `\n`） |
| `P` | print first | 只打印模式空间的第一行 |
| `D` | delete first | 删除模式空间第一行，若仍有内容则不读新行、重新执行脚本 |
| `q` | quit | 退出 sed，`n q` 表示处理到第 n 行就停 |
| `=` | line number | 输出当前行号 |
| `l` | list | 以可见形式打印（不可见字符显示为转义序列，行尾显示 `$`） |
| `x` | exchange | 交换模式空间与保持空间 |
| `g` `G` `h` `H` | get / append / hold | 保持空间的读取与写入（见 5.2） |

几个补充指令的实例：

```bash
# y：逐字符转换
echo "hello" | sed 'y/helo/Helo/'
# 输出：Hello

# l：查看不可见字符（制表符显示为 \t）
printf 'abc\tdef\n' | sed -n 'l'
# 输出：abc\tdef$

# =：显示行号
printf 'x\ny\n' | sed -n '='
# 输出：1 2

# r：把另一个文件的内容插入到匹配行之后
echo "hello" | sed 'r /tmp/person.txt'
# 输出：hello 后接 person.txt 的全部内容

# q：匹配到就退出，不再读取后续行（大文件加速）
seq 5 | sed '2q'
# 输出：1 2
```

`w` 指令适合"边处理边分流"：匹配行单独存档，正常输出不受影响。日志巡检时常用——一条命令既在屏幕上看全量内容，又把告警行落到单独文件：

```bash
# 含 error 的行写入 err.log，屏幕上仍输出全部内容
printf 'ok\nerror: disk full\nok\n' | sed '/error/w /tmp/err.log'
cat /tmp/err.log
# err.log 内容：error: disk full
```

注意 `w` 每次运行是**覆盖**写文件，多条 `w` 指向同一文件时后面覆盖前面；同一 sed 进程内多次写入同一文件则是追加累积。GNU sed 4.x 之后带小写 `w` 在脚本退出时会关闭文件，管道接其他命令读该文件不会丢数据。

## 十四、多行模式：N、D、P

默认情况 sed 一次只处理一行，但借助 `N`、`D`、`P` 可以跨行操作：

| 指令 | 行为 |
| --- | --- |
| `N` | 把下一行读入模式空间，与当前行用 `\n` 连接，继续执行后续指令 |
| `P` | 只打印模式空间的**第一行** |
| `D` | 删除模式空间的**第一行**；若还有剩余内容，不读新行，直接从头重新执行脚本 |

典型用法一：两行合并成一行（`N` + `s/\n/ /`）

```bash
printf 'a\nb\nc\nd\n' | sed 'N;s/\n/ /'
# 输出：a b / c d（每两行合并为一行）
```

典型用法二：压缩连续空行（`N` + `D` 组合）

```bash
printf 'a\n\n\n\nb\n' | sed '/^$/{N;/^\n$/D}'
# 输出：a、一个空行、b（多个连续空行被压成一个）
```

执行逻辑：遇到空行就用 `N` 再读一行；如果读进来还是空行（模式空间变成 `\n\n`），`D` 删掉第一行并**不读新行**重新执行脚本，直到空行被压成一个。

典型用法三：只打印每对行的第一行（`N` + `P`）

```bash
printf 'a\nb\nc\nd\n' | sed -n 'N;P'
# 输出：a c
```

> **注意：** `N` 在最后一行后会读到文件末尾，GNU sed 此时直接结束（不报错）；`D` 与 `P` 只对模式空间的第一行生效，是多行处理的"微操"工具。

实战里最出名的一行式是"整个文件合并成一行"：

```bash
printf 'a\nb\nc\n' | sed ':a;N;$!ba;s/\n/ /g'
# 输出：a b c
```

拆开看就四步：`:a` 打一个叫 a 的标签；`N` 把下一行拼进模式空间；`$!ba` 表示"只要不是最后一行（`$!`），就跳回标签 a 继续拼"；循环结束后整个文件都在模式空间里，`s/\n/ /g` 一次把所有换行换成空格。

它顺带引出了两个总表之外的指令：`b`（无条件跳转到标签）与 `t`（上一条 `s` 替换成功才跳转）。配合标签可以写循环，这也是 sed 被称为"图灵完备"的原因——但日常用到 `:a;N;$!ba` 这一层就够了，更复杂的跨行逻辑交给 awk 更清楚，别为了炫技把 sed 脚本写成天书。

### 辨析：n 与 N

小写 `n` 和大写 `N` 一字之差，行为完全不同：

| 指令 | 行为 | 模式空间的变化 |
| --- | --- | --- |
| `n` | **丢掉**当前模式空间内容，读取下一行覆盖进来，从脚本头重新执行 | 内容被替换，永远是"一行" |
| `N` | **保留**当前内容，读取下一行**追加**进来（中间插 `\n`），继续执行后续指令 | 内容累积，可能有多行 |

记法：小写 n 是"换个行处理"，大写 N 是"再来一行拼一起"。`n` 之后的指令处理的是新行，`N` 之后的指令处理的是"旧行+新行"拼成的整体。想跨行替换（合并行、处理成对记录）用 `N`；只想跳过某些行不输出，用 `n`（配 `-n`）或 `d`。

一个直观对比：

```bash
# n：每次循环跳过一行，只剩隔行
printf 'a\nb\nc\nd\n' | sed -n 'n;p'
# 输出：b d

# N：两行拼一起再处理
printf 'a\nb\nc\nd\n' | sed -n 'N;s/\n/-/p'
# 输出：a-b c-d
```

## 十五、sed 实战：四大高频场景

### 15.1 批量注释与取消注释

```bash
# 给文件所有行加 # 注释（危险操作，慎用）
sed -i 's/^/#/' file.conf

# 只给"尚未注释"的行加 #（已是注释行、空行不动）
sed -i '/^[[:space:]]*#/!s/^/#/' file.conf

# 取消所有 # 开头的注释
sed -i 's/^#//' file.conf

# 只处理第 5 到第 10 行（范围 + 替换）
sed -i '5,10s/^/#/' file.conf
```

以 nginx.conf 为例：

```bash
printf '# comment\nserver=1\n# another\nport=80\n' >nginx.conf
sed '/^[[:space:]]*#/!s/^/#/' nginx.conf
# 输出：
# # comment
# #server=1
# # another
# #port=80
```

### 15.2 删除空行与空白行

```bash
# 删除纯空行
sed -i '/^$/d' file.conf

# 删除"只有空格/制表符"的空白行（更彻底，生产环境推荐）
sed -i '/^[[:space:]]*$/d' file.conf

# 删除文件开头的连续空行
printf '\n\na\nb\n' | sed '/./,$!d'
# 输出：a b
```

顺带处理另一头的"文件末尾多余换行"。平时 `\n` 是行分隔符，sed 碰不到它；换成 `-z` 按 NUL 分行后，整个文件变成"一行"，`\n` 降级为普通字符，就能一口气清掉末尾所有空行：

```bash
printf 'a\n\n\n' | sed -z 's/\n*$//'
# 输出：a（末尾空行全部清掉）
```

这个用法只适合小文件——`-z` 会把整个文件装进模式空间，大文件直接撑爆内存。

### 15.3 行首、行尾批量添加内容

```bash
# 每行行首加前缀
sed -i 's/^/PRE /' file.txt

# 每行行尾加后缀
sed -i 's/$/ SUFFIX/' file.txt

# 一条命令同时加前后缀
echo hello | sed 's/^/PRE /;s/$/ SUFFIX/'
# 输出：PRE hello SUFFIX

# 给 CSV 每行行首加序号
seq 3 | sed 's/^/ID,/'
# 输出：ID,1 / ID,2 / ID,3
```

### 15.4 变量替换（Shell 变量进 sed）

sed 脚本用双引号包裹，Shell 变量就能被展开：

```bash
OLD=zhangsan
NEW=zhangsan-new
sed -i "s/$OLD/$NEW/g" person.txt
```

变量值与分隔符冲突时的处理：

```bash
# 变量里含 / 时，换用 # 或 | 作分隔符
OLD=10.0.0.200
NEW=10.0.0.201
sed -i "s#$OLD#$NEW#g" ifcfg-eth0

# 变量里可能含 & 或 \ 时，先转义更安全（也可改用 awk -v）
esc() { printf '%s' "$1" | sed 's/[&/\]/\\&/g'; }
sed -i "s/$(esc "$OLD")/$(esc "$NEW")/g" file
```

> **注意：** 替换串里的 `&` 会被展开成"整个匹配内容"，如果 `$NEW` 中恰好含 `&`，替换结果会不符合预期。涉及用户输入、配置值的替换，更稳妥的方案是 `awk -v old="$OLD" -v new="$NEW" '{gsub(old,new);print}'`（awk 的 `-v` 传值不涉及正则转义问题）。

## 十六、指令与参数速查

### 16.1 sed 指令信息

| 指令 | 全称 | 作用 |
| --- | --- | --- |
| `p` | print | 输出信息 |
| `i` | insert | 插入信息，在指定信息**前面**插入新的信息 |
| `a` | append | 附加信息，在指定信息**后面**附加新的信息 |
| `d` | delete | 删除指定信息 |
| `s` | substitute | 替换信息，`s###g` 表示全局替换 |
| `c` | — | 替换修改指定的一整行信息 |

### 16.2 sed 参数信息

| 参数 | 作用 |
| --- | --- |
| `-n` | 取消默认输出 |
| `-r` | 识别扩展正则 |
| `-i` | 真实编辑文件（将内存中的信息覆盖到磁盘中） |
| `-e` | 识别 sed 命令多个操作指令 |

## 十七、往文件中添加内容的几种方式

```bash
01. vim / vi
02. cat >>xxx<<EOF .. EOF
03. echo -e "xxx\nxxx"
04. sed 'na/i xxxx\nxxxx\nsxxxx'
```

这几种方式的分工：临时追加一两行用 `echo` / `sed` 最快；成块配置用 heredoc；要反复核对格式的用 vim。另外 heredoc 有个必会细节——起始标记写成 `<<'EOF'`（加引号）可以禁止变量展开，写含 `$` 的配置时必须用它，否则 `$VAR` 会在写入前就被 shell 提前替换掉。不加引号的 `<<EOF` 则保留变量展开，两种写法按需选择。

## 十八、知识卡片

**概念卡**

| 概念 | 一句话解释 |
| --- | --- |
| 模式空间 | sed 当前正在处理的那一行，几乎所有指令都作用在它上面 |
| 保持空间 | 跨行暂存区，配合 `h` `H` `g` `G` `x` 实现跨行处理 |
| 定址 | 指定指令作用于哪些行：行号、正则、范围、步进、取反 |
| `-n` | 取消自动输出，只显示 `p` 显式打印的内容 |
| `-i` | 就地编辑，把处理结果写回文件（`-i.bak` 先备份） |

**命令卡**

| 目的 | 命令 |
| --- | --- |
| 显示第 3 行 | `sed -n '3p' file` |
| 显示 2-5 行 | `sed -n '2,5p' file` |
| 删除空行 | `sed '/^$/d' file` |
| 全局替换 | `sed -i 's#old#new#g' file` |
| 行首加注释 | `sed -i 's/^/#/' file` |
| 取命令输出中的字段 | `cmd \| sed -rn '3s#^.*net (.*)/24.*#\1#gp'` |
| 文件倒序 | `sed -n '1!G;h;$p' file` |
| 偶数行 | `sed -n '0~2p' file` |

**参数卡**

| 参数 | 记忆点 |
| --- | --- |
| `-n` | 安静模式，配 `p` |
| `-e` | 多条指令 |
| `-r` / `-E` | 扩展正则 |
| `-i` | 就地编辑（可带备份后缀） |
| `-f` | 脚本文件 |
| `-s` | 多文件独立处理 |

## 十九、常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `sed: no input files` | `-i` 用在了管道后面，没有文件可编辑 | 检查命令里 `-i` 的位置 | `-i` 必须作用于真实文件；管道场景用临时文件或 `sponge` |
| 文件内容被清空只剩几行 | `-n` 与 `-i` 同时使用 | 检查命令是否同时含 `-n` 和 `-i` | 二者绝不共用；先去掉 `-n` 确认输出，再加 `-i` |
| `unknown option to 's'` | `s` 的分隔符与模式或替换内容冲突 | 数一下命令里出现了几个分隔符 | 换用 `#` `@` `%` 等内容中不出现的分隔符 |
| `invalid reference \1` | 基础正则里 `()` 未转义，或没有分组就引用 | 检查是否漏了 `-E`/`-r` | 加 `-E`，或把 `()` 写成 `\(\)` |
| 替换结果里出现意外的重复内容 | 替换串含 `&`，被展开成整个匹配 | `echo "$NEW"` 检查变量值 | 把 `&` 转义为 `\&`，或改用 `awk -v` |
| macOS 上 `sed -i` 报错 | BSD sed 的 `-i` 必须带备份参数（`-i ''`） | 看报错信息 | macOS 写 `sed -i ''`；Linux 直接 `sed -i`；跨平台用 `perl -pi -e` |
| `first~step` 不生效 | 非 GNU sed 不支持步进定址 | `sed --version` | 用 `awk 'NR%step==first'` 替代 |
| 中文替换后乱码 | 文件编码与 locale 不一致 | `locale`、`file 文件名` | 统一 UTF-8，必要时 `LC_ALL=C.UTF-8 sed ...` |

## 二十、现代环境补充

表格之外再补一个高频坑：Windows 编辑过的文件是 `\r\n`（CRLF）换行，Linux 上 `grep` 能正常匹配，但 sed 的 `$` 锚定会失效——行尾实际排着一个 `\r`，`s/xxx$/yyy/` 看上去"匹配不上"。先用 `file 文件名` 确认（会提示 `with CRLF line terminators`），处理方式二选一：

```bash
sed -i 's/\r$//' file        # 去掉行尾 \r，转成 Unix 格式
dos2unix file                # 专用工具，效果相同
```

还有两个小坑值得记录。其一，`a`、`i`、`c` 的文本参数在 POSIX 语义下不能与后续指令用 `;` 同行连接，`sed '1a xxx;d'` 在 GNU sed 能跑，换到 BSD sed 直接报错，稳妥写法是用 `-e` 分开。其二，GNU sed 的替换串里支持大小写转换标记：`\L` 转小写、`\U` 转大写、`\E` 结束转换，比如 `sed 's/.*/\U&/' file` 整行转大写——同样是 GNU 扩展，跨平台脚本别依赖。

- **`sed -r` → `sed -E`**：`-r` 是 GNU sed 的旧选项，GNU sed 4.3（2017）起 `-E` 成为 POSIX 标准写法。Rocky Linux 9 / AlmaLinux 9 / Debian 12 / Ubuntu 22.04 自带的 sed 均已支持 `-E`，新脚本统一用 `-E`。
- **CentOS 7 已于 2024 年 6 月 EOL**：其自带 sed 4.2 不支持 `-E`；若仍在维护 CentOS 7 旧脚本，`sed -r` 可以继续工作，但建议规划升级到 Rocky Linux / AlmaLinux / CentOS Stream。
- **GNU sed 与 BSD sed 的差异**：macOS 的 sed 源自 BSD，`-i` 必须提供备份参数（`sed -i '' 's/a/b/' file`，原地编辑；`sed -i .bak` 带备份），且不支持 `-r`（用 `-E`）、步进定址、`I` 标志等 GNU 扩展。跨平台脚本要么写 POSIX 子集，要么直接用 `perl -pi -e`。
- **网卡配置的今夕**：`ifcfg-eth0` + `systemctl restart network` 是 CentOS 7 及以前的写法；Rocky/AlmaLinux 8+ 由 NetworkManager 接管，用 `nmcli` 或 `/etc/NetworkManager/system-connections/*.nmconnection` 文件，sed 的替换思路不变。
- **busybox sed**：Alpine 等精简镜像中的 sed 参数是子集（无 `-r`/`-E`/`-z`，`-i` 行为也可能不同），容器镜像里写脚本前先 `sed --help` 确认。
- **更现代的选择**：一次性复杂文本改写可考虑 `perl -pi -e`；结构化配置（YAML/JSON）建议用 `yq` / `jq`，不要用正则硬改。

## 二十一、自测题

1. `sed -n 'p' file` 与 `sed 'p' file` 的输出有什么区别？

> **答案：** `sed -n 'p'` 因为取消了默认自动输出，而 `p` 指令又会打印每一行，所以输出与 `cat file` 相同（每行一次）；`sed 'p' file` 则是"自动输出一次 + `p` 再输出一次"，每行显示两遍。这个对比正是为了记住：`-n` 关掉的是自动输出，`p` 是显式输出，两者叠加才精确可控。

2. 为什么 `-n` 和 `-i` 绝对不能同时使用？安全的原地修改应该怎么写？

> **答案：** `-n` 取消默认输出后，只有 `p` 打印的内容会进入输出流；`-i` 把输出流写回文件，于是文件里只剩 `p` 打印的那几行，其余内容全部丢失。安全写法是：先不加 `-i` 在屏幕上确认输出正确，再加 `-i` 执行；涉及重要文件用 `-i.bak` 先备份。

3. `printf 'a\nb\nc\nd\n' | sed 'N;s/\n/ /'` 做了什么？如果把 `N` 换成 `n` 会怎样？

> **答案：** `N` 把下一行读进模式空间与当前行合并（中间是 `\n`），`s/\n/ /` 再把合并处的换行替换成空格，效果是"每两行合并成一行"，输出 `a b` 和 `c d`。若换成 `n`：`n` 是读取下一行并继续脚本（不合并），`s/\n/ /` 匹配不到换行符，输出仍是原来的四行。

4. 如何用 sed 把文件第 5 到第 10 行注释掉，同时不影响已有注释和空行？

> **答案：** `sed -i '5,10{/^[[:space:]]*#/!s/^/#/}' file.conf`。`5,10` 限定范围，块内再用 `/^[[:space:]]*#/!` 排除已是注释的行；空行加 `#` 通常无意义，可再追加 `/^[[:space:]]*$/!s/^/#/`。也可以分两步：先 `sed -i '5,10s/^/#/'` 再检查。

5. GNU sed 中 `-r` 与 `-E` 是什么关系？写新脚本该用哪个？

> **答案：** 两者作用完全相同，都是启用扩展正则（`+` `?` `\|` `()` `{}` 无需转义）。`-r` 是 GNU 早期私有选项，`-E` 从 GNU sed 4.3 起支持并成为 POSIX 标准写法。写新脚本用 `-E`，兼容性更好；仅在维护很老的、只用 GNU sed 的环境时才继续用 `-r`。

## 二十二、相关阅读

- [awk 命令详解：取列、匹配与统计](./02-awk命令详解.md)
- [系统符号、通配符号与基础正则表达式](../03-文件属性与正则表达式/06-基础正则表达式.md)
- [扩展正则表达式与 grep](../03-文件属性与正则表达式/07-扩展正则表达式与grep.md)
- [用户管理](../05-用户与权限管理/01-用户管理.md)
- [附录-命令速查表](../附录-命令速查表.md)

## 小结

1. sed 是字符流（行）编辑工具，核心能力就是对文件做**增（i / a）、删（d）、改（s / c）、查（p）**四类操作。
2. 语法结构是 `sed 参数 '条件+处理指令' 文件`；条件可以是行号（`3`、`1,3`、`1p;3p`），也可以是内容正则（`/zhangsan/`、`/zhangsan/,/Alex/`），还可以是步进（`0~2`）与取反（`!`）。
3. 执行原理是"读一行进模式空间 → 执行指令 → 自动输出 → 读下一行"；`-n` 关闭自动输出，只保留 `p` 的显式输出。保持空间（`h` `H` `g` `G` `x`）用于跨行处理。
4. `-n` 取消默认输出，通常和 `p` 搭配使用；`-r`（或 `-E`）识别扩展正则，是后项引用 `()` 与 `\1` 的前提；`-e` 用于一次执行多条指令；`-f` 从脚本文件读指令。
5. `-i` 会真实修改文件，`-i.bak` 会先备份再修改；**`-n` 与 `-i` 绝对不能同时出现**，否则文件内容会被清空。
6. 后项引用前项（`s#^.*net (.*)/24.*#\1#g` + `&`）是从命令输出中截取字段的利器，取 IP 地址、批量改文件名都会用到。
7. `-i` 只能作用于文件，不能接在管道后面；分隔符要和替换内容避开，冲突时报 `unknown option to 's'`；替换串中的 `&` 代表整个匹配，需要时记得转义。
8. `N` `D` `P` 三条指令打开多行处理的大门：两行合并、压缩连续空行、删除成块内容，都靠它们组合完成。
9. 四大高频实战：批量注释（`/^[[:space:]]*#/!s/^/#/`）、删空行（`/^[[:space:]]*$/d`）、行首尾添加（`s/^/PRE /`、`s/$/ SUFFIX/`）、变量替换（双引号包裹 + 分隔符避让）。
10. 现代环境用 `-E` 替代 `-r`；macOS 的 BSD sed 与 GNU sed 在 `-i`、扩展正则上差异明显，跨平台脚本优先 POSIX 子集或 `perl -pi -e`。
{% endraw %}
