---
title: "awk 命令详解：取列、匹配与统计"
date: 2026-10-24 10:25:00 +0800
categories: [软件, Linux, 文本处理三剑客]
tags: [Linux, 文本处理三剑客]
---

{% raw %}
awk 是文本处理三剑客里最像一门语言的一个。本篇覆盖语法与模式概念、工作原理（记录与字段）、内置变量、运算符与优先级、判断循环、数组与字符串函数、printf 格式化、getline，以及按行号（NR）与按字符查询、取列的 `$` 用法、多分隔符 `-F`、排除空行与注释、`BEGIN{}` / `END{}` 特殊模式、累加计数与求和统计和报表生成。定位是：你已经会用 grep 过滤、sed 改行，接下来要对日志做统计分析。

## 一、回顾：sed 流编辑命令

| 能力 | 使用的参数与指令 |
| --- | --- |
| 文件中查询信息 | 参数 `-n`，指令 `p` |
| 文件中增加信息 | 指令 `i`、`a` |
| 文件中删除信息 | 参数 `-i`，指令 `d` |
| 文件中替换信息 | 参数 `-i.bak`，指令 `s`、`g`、`c`，配合后项引用前项与 `&` |

语法结构：

```bash
sed [参数] '条件-处理方式' 文件
```

## 二、awk 能做什么

awk 的作用特点：

1. 排除信息；
2. 查询信息；
3. 统计信息；
4. 替换信息。

awk 最擅长的两件事是**取列**和**统计**（sed 更擅长取行）。

语法格式对比：

```bash
sed [参数] '条件-处理方式'   文件
awk [参数] '模式-动作'       文件
```

## 三、awk 的语法结构

```bash
awk [参数] '模式{动作}' 文件
```

- **模式**：匹配的条件信息，如 `NR==2`、`/Xiaoming/`、`$3~/^41/`；
- **动作**：满足条件后做什么，如 `{print $1,$3}`；
- 只有模式没有动作时，默认动作是输出整行。

建立一个心智模型：awk 的程序就是一张**模式-动作对的清单**。每读入一行，awk 从上到下把每对规则都过一遍——模式为真，就执行对应的动作。它不像 C 那样"从上往下执行一遍就结束"，而是"每一行数据都要把整份规则清单重走一遍"。想通这一点，下面几个问题就不用死记了：

- 为什么统计结果放 `END{}`？因为 END 也是一对规则（模式是"所有行读完"），此时逐行变量已累加完毕；
- `next` 为什么能提速？当前行后面的规则注定不匹配时，提前跳去读下一行，省掉无效测试；
- 同一行为什么能被输出两次？两对规则的模式同时为真，两个动作就都执行。

写复杂统计脚本时先在纸上列清单：每行要测哪些条件、分别做什么、最后 END 里算什么，翻译成 awk 几乎就是照抄。

## 四、准备测试数据

```bash
[root@linux-node1 ~]# cat awk_test.txt
Zhang   Wei         41001       :250:100:175
Zhang   Xiaoming    22011       :155:90:201
Meng    Fanhua      30033       :250:60:50
Wu      Guoqing     44021       :250:80:75
Liu     Jianguo     41002       :250:100:175
Wang    Xiaolei     55065       :50:95:135
Zi      Mingxuan    66070       :250:168:200
Li      Guodong     77085       :175:75:300
Lao     Haiyang     88095       :250:100:175
Lao     Haiyang     88105       :250:100:175
```

四列含义依次为：姓、名、ID 号码、三次捐款记录（`:第一次:第二次:第三次`）。

> **注意：** 课堂演示过程中测试文件被不断追加（笔记开头的 `cat` 只列出了 9 行，后续示例输出为 10 行，多出一条重复记录），下文统一以上面这份 10 行数据为准，便于复现所有统计结果。

## 五、原理解析：awk 的工作机制

### 5.1 记录与字段

awk 把输入数据看作一张"按行组织的表"：

- **记录（record）**：默认一行就是一条记录，分隔符由 `RS` 控制；
- **字段（field）**：每条记录按 `FS` 切成若干列，`$1` 是第一列、`$2` 是第二列……`$NF` 是最后一列，`$0` 是整行原文；
- **特殊性质**：输入的数据带有"数值字符串"属性——形如数字的字段，与数值常量比较时按数值比较，与字符串常量比较时按字符串比较（这一点是很多"判断失效"的根因，见常见错误表）。

### 5.2 执行流程（文字步骤）

awk 的执行顺序是固定的，可以概括为"三段式"：

1. **BEGIN 阶段**：读入任何数据**之前**，先执行所有 `BEGIN{}` 块。此时适合打印表头、初始化计数器、用 `-v` 或 `BEGIN{FS="..."}` 设置分隔符；
2. **逐行阶段**：按顺序读入每一条记录，对每条记录依次测试所有"模式-动作"规则：模式为真（省略模式恒为真、正则模式匹配即为真）就执行动作；动作里可以用 `next` 跳过当前记录的后续规则、用 `exit` 提前结束；
3. **END 阶段**：所有记录处理完毕，执行所有 `END{}` 块。此时 `NR` 就是总记录数，适合输出统计结果。

由此可知：`FS` 用命令行 `-F` 设置或在 `BEGIN{}` 里赋值，都在第一条记录读取**之前**生效，二者等价；但在普通动作里修改 `FS`，只影响后续读取的记录。

`$0` 与字段是联动的：引用 `$n` 时 awk 才按 `FS` 切分；反过来，修改任一字段（或 `$0`）时，awk 会用 `OFS` 重新拼接 `$0`，字段数也会跟着变：

```bash
# 修改 $1 后，$0 用 OFS 重建
echo "a b c" | awk 'BEGIN{OFS="-"}{$1="X"; print $0}'
# 输出：X-b-c

# 给不存在的字段赋值，相当于追加字段（中间字段为空）
echo "a b" | awk '{$5="e"; print NF": "$0}'
# 输出：5: a b   e
```

## 六、awk 内置变量

| 变量 | 含义 | 默认值 |
| --- | --- | --- |
| `FS` | 输入字段分隔符 | 单个空格（连续的空白整体算一个分隔符） |
| `OFS` | 输出字段分隔符（`print` 用逗号拼接时生效） | 单个空格 |
| `RS` | 输入记录分隔符 | 换行符 `\n` |
| `ORS` | 输出记录分隔符 | 换行符 `\n` |
| `NR` | 已读入的记录总数（多文件时跨文件累加） | 0 |
| `FNR` | 当前文件内的记录号（换文件后重置为 1） | 0 |
| `NF` | 当前记录的字段数 | — |
| `FILENAME` | 当前正在处理的文件名（读标准输入时为 `-`） | 空 |
| `RSTART` | `match()` 匹配到的起始位置 | — |
| `RLENGTH` | `match()` 匹配到的长度（未匹配为 `-1`） | — |
| `SUBSEP` | 多维数组下标的默认分隔符 | `\034` |

`NR` 与 `FNR` 的差异只在多文件时出现，是"双文件关联"写法的根基：

```bash
printf '1\n2\n' >f1.txt
printf '3\n' >f2.txt
awk '{print FILENAME, FNR, NR, $0}' f1.txt f2.txt
# 输出：
# f1.txt 1 1 1
# f1.txt 2 2 2
# f2.txt 1 3 3      ← FNR 重置，NR 继续累加
```

什么时候会真的用到这个区别？两个典型场景：

1. **多文件分别统计**：统计每个文件各自的行数，用 `FNR`；想统计所有文件总行数，用 `NR`。`awk 'END{print FNR}' a.txt b.txt` 只会得到最后一个文件的行数，别踩这个坑。
2. **双文件关联**：`NR==FNR` 只在处理第一个文件时为真（第一个文件期间两个计数器同步增长，进入第二个文件后 FNR 归 1 而 NR 继续涨），借此把"规则只作用于第一个文件"写在一行里，完整套路见 19.5。

说白了，单文件时 `NR` 和 `FNR` 永远相等，看不出差别；一旦命令行里出现两个以上文件，两者才分道扬镳。

多维数组借助 `SUBSEP` 实现，awk 内部把 `a[i,j]` 存成 `a[i SUBSEP j]`：

```bash
awk 'BEGIN{a["x","y"]=1; for(k in a){split(k,p,SUBSEP); print p[1], p[2]}}'
# 输出：x y
```

`RS` 还有一个 POSIX 标准玩法值得知道：把 `RS` 设为空字符串（`BEGIN{RS=""}`），awk 进入**段落模式**——记录按空行分隔，一段就是一条记录，段落内的换行仍保留在 `$0` 里。解析 `ifcfg-*`、nginx 配置块这类"空行分节"的文件时，比逐行判断省事得多。注意此时 `FS` 默认仍是空白，`$1` 是段落第一个词；多字符 `RS` 是 gawk 扩展，可移植脚本别用。

## 七、按行号查询信息：NR

```bash
awk 'NR=2' awk_test.txt
```

```bash
[root@linux-node1 ~]# awk 'NR=2' awk_test.txt
Zhang   Wei         41001       :250:100:175
Zhang   Xiaoming    22011       :155:90:201
Meng    Fanhua      30033       :250:60:50
Wu      Guoqing     44021       :250:80:75
Liu     Jianguo     41002       :250:100:175
Wang    Xiaolei     55065       :50:95:135
Zi      Mingxuan    66070       :250:168:200
Li      Guodong     77085       :175:75:300
Lao     Haiyang     88095       :250:100:175
Lao     Haiyang     88105       :250:100:175
[root@linux-node1 ~]# awk 'NR==2' awk_test.txt
Zhang   Xiaoming    22011       :155:90:201
[root@linux-node1 ~]# awk 'NR==2,NR==4' awk_test.txt
Zhang   Xiaoming    22011       :155:90:201
Meng    Fanhua      30033       :250:60:50
Wu      Guoqing     44021       :250:80:75
[root@linux-node1 ~]# awk 'NR==2;NR==4' awk_test.txt
Zhang   Xiaoming    22011       :155:90:201
Wu      Guoqing     44021       :250:80:75
```

> **注意：** 一定要区分赋值与比较。`NR=2` 是赋值（条件永远为真，所以输出了整个文件），`NR==2` 才是"行号等于 2"。这与 shell 中 `变量=10` 表示赋值、`变量==2` 表示判断相等是同一个道理。

## 八、按字符（正则）查询信息

```bash
[root@linux-node1 ~]# awk '/Xiaoming/' awk_test.txt
Zhang   Xiaoming    22011       :155:90:201
[root@linux-node1 ~]# awk '/Xiaoming/,/Guoqing/' awk_test.txt
Zhang   Xiaoming    22011       :155:90:201
Meng    Fanhua      30033       :250:60:50
Wu      Guoqing     44021       :250:80:75
[root@linux-node1 ~]# awk '/Xiaoming/;/Guoqing/' awk_test.txt
Zhang   Xiaoming    22011       :155:90:201
Wu      Guoqing     44021       :250:80:75
```

逗号表示**连续范围**，分号表示**不连续的多段**。

## 九、取列：`$` 符号的用法

| 写法 | 含义 |
| --- | --- |
| `$1` `$2` `$3` | 取第几列信息 |
| `$NF` | 取最后一列 |
| `$(NF-n)` | 取倒数第 n 列 |
| `$0` | 取所有列（整行）信息 |

awk 默认以空白（空格、制表符）作为分隔符，也可以用 `-F` 指定分隔符。

空行没有字段，`NF` 为 0，`$NF` 就是 `$0`（空）：

```bash
printf 'a\n\nb\n' | awk '{print NR": NF="NF" ["$0"]"}'
# 输出：
# 1: NF=1 [a]
# 2: NF=0 []
# 3: NF=1 [b]
```

### 9.1 练习 01：显示 Xiaoming 的姓氏和 ID 号码

```bash
[root@linux-node1 ~]# awk '/Xiaoming/{print $1","$3}' awk_test.txt
Zhang,22011
[root@linux-node1 ~]# awk '/Xiaoming/{print $1,$3}' awk_test.txt
Zhang 22011
```

`print` 中写 `,` 表示输出分隔符（默认空格），写 `","` 表示原样输出逗号。

### 9.2 练习 02：姓氏是 Zhang 的人，显示他的第二次捐款金额及他们的名字

```bash
[root@linux-node1 ~]# awk '/Zhang/{print $4}' awk_test.txt
:250:100:175
:155:90:201
[root@linux-node1 ~]# awk '/Zhang/{print $NF}' awk_test.txt
:250:100:175
:155:90:201
[root@linux-node1 ~]# awk '/Zhang/{print $NF}' awk_test.txt|awk -F ":" '{print $3}'
100
90
```

上面的做法是两次 awk 管道处理，也可以一次完成：

```bash
awk '/Zhang/{print $NF}'
awk -F ":" '{print $3}'
[root@linux-node1 ~]# awk -F ":" '/^Zhang/{print $3}' awk_test.txt
100
90
```

用 `-F` 指定多个分隔符（正则形式的"一个或多个空格或冒号"）：

```bash
[root@linux-node1 ~]# awk -F "[ :]+" '/^Zhang/{print $1,$2,$5}' awk_test.txt
Zhang Wei 100
Zhang Xiaoming 90
[root@linux-node1 ~]# awk -F "[ :]+" '/^Zhang/{print $1,$2,$(NF-1)}' awk_test.txt
Zhang Wei 100
Zhang Xiaoming 90
```

> **注意：** 加了 `^`（`/^Zhang/`）表示只匹配以 Zhang 开头的行；不加 `^` 时，只要行中任意位置出现 Zhang 都会被匹配。

### 9.3 练习 03：显示所有以 41 开头的 ID 号码的人的全名和 ID 号码

```bash
[root@linux-node1 ~]# awk '$3~/^41/{print $1,$2,$3}' awk_test.txt
Zhang Wei 41001
Liu Jianguo 41002
```

`$3~/^41/` 表示"第 3 列匹配以 41 开头"。

### 9.4 练习 04：显示所有 ID 号码最后一位是 1 或 5 的人的全名

方法一：

```bash
awk '$3~/1$|5$/{print $1,$2}' awk_test.txt
```

```bash
[root@linux-node1 ~]# awk '$3~/1$|5$/{print $1,$2}' awk_test.txt|column -t
Zhang  Xiaoming
Wu     Guoqing
Wang   Xiaolei
Li     Guodong
Lao    Haiyang
Lao    Haiyang
```

方法二（用字符组）：

```bash
[root@linux-node1 ~]# awk '$3~/[15]$/{print $1,$2}' awk_test.txt|column -t
```

方法三（用分组）：

```bash
[root@linux-node1 ~]# awk '$3~/(1|5)$/{print $1,$2}' awk_test.txt|column -t
```

`column -t` 用于把输出按列对齐，方便查看。

### 9.5 练习 05：显示 Xiaoming 的捐款，每个数值前都加上 `$`，如 `$110$220$330`

```bash
[root@linux-node1 ~]# awk '$2~/Xiaoming/{print $NF}' awk_test.txt
:155:90:201
[root@linux-node1 ~]# # gsub(/需要替换的信息/,"修改成什么信息",将哪列信息进行修改)
[root@linux-node1 ~]# awk '$2~/Xiaoming/{gsub(/:/,"$",$NF);print $NF}' awk_test.txt
$155$90$201
```

`gsub()` 是 awk 的替换函数，第三个参数指定对哪一列做替换。省略第三个参数时替换 `$0`，并会按 `OFS` 重建所有字段：

```bash
echo "a b" | awk '{gsub(/ /,"-"); print $1, NF}'
# 输出：a-b 1      ← $0 变成 a-b，只剩一个字段
```

### 辨析：awk 与 cut 的取列分工

取列不止 awk 一家，`cut` 也常被拿来一起用，两者默认分隔符行为差别很大：

- awk 默认分隔符是"连续空白"，行首缩进、多个空格连排都不产生空字段，取列最稳；
- cut 默认是单个制表符，`cut -d` 指定分隔符后，连续两个分隔符中间会产生**空字段**，列号整体后移；
- cut 不支持"连续分隔符当整体"的语义，也没有 `$NF` 这类"倒数第几列"写法；awk 全都有。

经验法则：日志、`ps`、`ip a` 这类空白分隔的输出直接 awk；严格 `:` 分隔的 `/etc/passwd` 之类，cut 与 awk 都行，cut 胜在轻量（`cut -d: -f1 /etc/passwd`）。需要字段重组、条件过滤、统计的，一律 awk。还有一个细节差异：`cut` 处理不含分隔符的行时整行原样输出（`-s` 可改为丢弃），awk 的空行 `NF=0`，过滤直接写 `NF` 当条件。

## 十、排除空行与注释信息

```bash
grep -Ev "^#|^$"  文件信息
sed  -n '/^#|^$/!p' 文件信息
awk  '$0!~/^#|^$/' 文件信息
```

假设测试文件中带有一条注释行和空行：

```bash
[root@linux-node1 ~]# awk '$0~/^#|^$/'  awk_test.txt
#Liu    Jianguo 41002    :250:100:175

[root@linux-node1 ~]# awk '$0!~/^#|^$/'  awk_test.txt
Zhang  Wei       41001    :250:100:175
Zhang  Xiaoming  22011    :155:90:201
Meng   Fanhua    30033    :250:60:50
Wu     Guoqing   44021    :250:80:75
Wang   Xiaolei   55065    :50:95:135
Zi     Mingxuan  66070    :250:168:200
Li     Guodong   77085    :175:75:300
Lao    Haiyang   88095    :250:100:175
Lao    Haiyang   88105    :250:100:175
```

## 十一、awk 的模式概念

模式就是匹配的条件信息。

### 11.1 普通模式

| 类型 | 示例 |
| --- | --- |
| 正则表达式作为模式 | `awk '/^Zhang/{print $1}'` |
| 比较匹配信息 | `NR==2`、`NR>=2`、`NR<=2` |
| 范围匹配 | `NR==2,NR==10` |
| 字段匹配 | `$3~/^41/`、`$NF~/bash/` |
| 表达式模式 | `awk 'length($0)>10'`（行长度大于 10 的行） |

### 11.2 特殊模式：BEGIN{} 与 END{}

`BEGIN{}` 表示在 awk 执行命令**之前**做什么事情，`END{}` 表示在 awk 执行命令**结束之后**做什么事情。

用 BEGIN 输出表头：

```bash
[root@linux-node1 ~]# awk 'BEGIN{print "姓","名","ID号","捐款记录"}{print $0}' awk_test.txt |column -t
姓      名         ID号     捐款记录
Zhang   Wei        41001    :250:100:175
Zhang   Xiaoming   22011    :155:90:201
Meng    Fanhua     30033    :250:60:50
Wu      Guoqing    44021    :250:80:75
Liu     Jianguo    41002    :250:100:175
Wang   Xiaolei     55065    :50:95:135
Zi      Mingxuan   66070    :250:168:200
Li      Guodong    77085    :175:75:300
Lao     Haiyang    88095    :250:100:175
Lao     Haiyang    88105    :250:100:175
```

在 BEGIN 中修改内置分隔符变量：

```bash
awk -F ":" '{print $2}' awk_test.txt
[root@linux-node1 ~]# awk  'BEGIN{FS=":"}{print $2}' awk_test.txt
```

`BEGIN{FS=":"}` 与 `-F:` 完全等价——两者都在第一条记录读取前生效：

```bash
printf 'a:b\n' | awk -F: '{print $2}'
# 输出：b
printf 'a:b\n' | awk 'BEGIN{FS=":"}{print $2}'
# 输出：b
```

用 END 做收尾动作：

```bash
[root@linux-node1 ~]# awk 'BEGIN{print "姓","名","ID号","捐款记录"}{print $0}END{print "操作结束"}' awk_test.txt |column -t
姓      名         ID号     捐款记录
Zhang   Wei        41001    :250:100:175
Zhang   Xiaoming   22011    :155:90:201
Meng    Fanhua     30033    :250:60:50
Wu      Guoqing    44021    :250:80:75
Liu     Jianguo    41002    :250:100:175
Wang   Xiaolei     55065    :50:95:135
Zi      Mingxuan   66070    :250:168:200
Li      Guodong    77085    :175:75:300
Lao     Haiyang    88095    :250:100:175
Lao     Haiyang    88105    :250:100:175
操作结束
```

## 十二、运算符与优先级

awk 的运算符按优先级从高到低排列如下（同一行优先级相同）：

| 优先级 | 运算符 | 说明 |
| --- | --- | --- |
| 1 | `()` | 分组，改变默认顺序 |
| 2 | `$` | 字段引用 |
| 3 | `++` `--` | 自增、自减（可作前缀或后缀） |
| 4 | `^` | 幂运算，**右结合** |
| 5 | `!` 一元 `+` 一元 `-` | 逻辑非、正负号 |
| 6 | `*` `/` `%` | 乘、除、取余 |
| 7 | `+` `-` | 加、减 |
| 8 | 字符串连接 | 无运算符，表达式并排书写即连接 |
| 9 | `<` `<=` `>` `>=` `==` `!=` | 比较运算 |
| 10 | `~` `!~` | 正则匹配、不匹配 |
| 11 | `in` | 数组成员判断 |
| 12 | `&&` | 逻辑与 |
| 13 | `\|\|` | 逻辑或 |
| 14 | `?:` | 三目运算 |
| 15 | `=` `+=` `-=` `*=` `/=` `%=` `^=` | 赋值，右结合 |

三个容易踩的顺序问题：

```bash
awk 'BEGIN{print 2+3*4}'
# 输出：14（乘法优先于加法）
awk 'BEGIN{print (2+3)*4}'
# 输出：20（括号改变优先级）
awk 'BEGIN{print 1" "2+3}'
# 输出：1 5（连接比加法"松"，等价于 1" "(2+3)）
awk 'BEGIN{print 2^3^2}'
# 输出：512（幂运算右结合：2^(3^2)）
```

比较运算的隐式规则：两个操作数都是数值常量按数值比较；若涉及字符串常量，字段、输入等"数值字符串"也会退化为字符串比较：

```bash
echo 10 | awk '{print ($1==10.0), ($1=="10.0"), ($1==10)}'
# 输出：1 0 1      ← 字段 10 与数值 10.0 相等；与字符串 "10.0" 不相等
echo 10.0 | awk '{print ($1=="10.0"), ($1=="10")}'
# 输出：1 0
```

## 十三、判断与循环语法

awk 是完整的编程语言，常用控制结构如下：

```bash
# if-else 与 else if
awk 'BEGIN{x=5; if(x>3) print "big"; else print "small"}'
awk 'BEGIN{x=5; if(x>10) print "a"; else if(x>3) print "b"; else print "c"}'

# while 循环
awk 'BEGIN{i=1; while(i<=3){print i; i++}}'

# do-while 循环（先执行再判断）
awk 'BEGIN{i=0; do{print i; i++}while(i<3)}'

# for 循环
awk 'BEGIN{for(i=1;i<=3;i++) print i}'

# for-in 遍历数组（顺序不保证）
awk 'BEGIN{a["x"]=1; a["y"]=2; for(k in a) print k, a[k]}'
```

控制流程的关键字：

| 关键字 | 作用 |
| --- | --- |
| `break` | 跳出最内层循环 |
| `continue` | 跳过本次循环剩余语句，进入下一次 |
| `next` | 跳过当前记录的后续所有规则，读取下一条记录 |
| `exit` | 立即结束 awk，可带退出码（`exit 2`），END 块仍会执行 |
| `delete a[i]` | 删除数组元素（`delete a` 删整个数组为 gawk 扩展） |

`next` 与 `exit` 的实例：

```bash
# next：跳过含 skip 的行
printf 'skip\nkeep\n' | awk '/skip/{next}{print}'
# 输出：keep

# exit：打印到第 2 行就停（大文件只想要前几行时很有用）
printf '1\n2\n3\n' | awk '{print} NR==2{exit}'
# 输出：1 2
```

顺带一个 C 语言同款陷阱：判断条件里把 `==` 写成 `=`，`if(x=0)` 是赋值、值为 0 恒为假，`if(x=1)` 恒为真，awk 不报错、静默给出错误结果，排查时极其隐蔽。这和前面 `NR=2` 输出整个文件是同一种病根。

awk 还支持**自定义函数**，把常用逻辑封装起来，脚本可读性立刻上一个台阶：

```bash
awk '
function human(n) { return n/1024 >= 1 ? sprintf("%.1fM", n/1024) : n "B" }
{ print $1, human($2) }
' <<EOF
disk1 512
disk2 2048
EOF
# 输出：disk1 512B / disk2 2.0M
```

两个约定要记：函数参数是局部变量；函数体内新出现的变量默认是**全局**的——想局部化，就把"只在函数内部用"的变量也列进参数表（调用时可以不传值），这是 awk 社区沿用了几十年的手法。函数定义与 `BEGIN` / `END` 块没有顺序要求，习惯上函数放最前面。

## 十四、数组与 for-in

awk 的数组是**关联数组**（下标是字符串，不需要预先声明、无需关心大小）：

```bash
# 计数：按第一列分组计数
printf 'apple\nbanana\napple\ncherry\nbanana\napple\n' | awk '{cnt[$1]++}END{for(k in cnt) print k, cnt[k]}'
# 输出：
# apple 3
# banana 2
# cherry 1
```

常用操作一览：

| 操作 | 写法 |
| --- | --- |
| 赋值 | `cnt[$1]++`、`sum[$1]+=$2` |
| 判断存在 | `if ($1 in cnt)` |
| 遍历 | `for (k in arr) print k, arr[k]` |
| 删除元素 | `delete cnt["apple"]` |
| 多维下标 | `a[i,j]`（内部用 `SUBSEP` 连接） |
| 元素个数 | `length(arr)`（gawk 扩展，可移植写法用计数器） |

> **注意：** `for-in` 遍历顺序不保证，需要排序时把结果管道给 `sort`：`awk '{c[$1]++}END{for(k in c) print c[k], k}' | sort -rn`。gawk 还可以设置 `PROCINFO["sorted_in"]` 控制遍历顺序，但那是 gawk 专有写法。

数组统计有几个反复出现的模板，背下来能覆盖日志分析的大部分需求：

| 套路 | 模板 | 典型用途 |
| --- | --- | --- |
| 计数 | `{c[$1]++}END{for(k in c) print k,c[k]}` | 各状态码出现次数、按用户分组计数 |
| 求和 | `{s[$1]+=$2}END{for(k in s) print k,s[k]}` | 按分组累加流量、金额 |
| 记最大值 | `{if($2>m[$1]) m[$1]=$2}END{...}` | 每个分组的峰值 |
| 去重计数 | `{seen[$1]}END{print length(seen)}` | UV 统计（引用即建立下标） |
| 去重输出 | `!seen[$0]++` 作为模式 | 等价于 `sort -u`，且保序 |

最后一个 `!seen[$0]++` 值得单独说一句：它把"是否出现过"直接写成了模式——第一次遇到某行时 `seen[$0]` 是 0（假），取反为真、动作默认打印，同时 `++` 记下它；再遇到就为假、跳过。一行代码完成保序去重，是 awk 数组最精妙的用法之一。

## 十五、内置字符串函数

| 函数 | 作用 | 示例 |
| --- | --- | --- |
| `length([s])` | 返回字符串长度；不给参数时取 `$0` 的长度 | `length($0)` |
| `substr(s,m[,n])` | 从位置 `m` 开始取 `n` 个字符（位置从 1 开始） | `substr("hello",2,3)` 返回 `ell` |
| `index(s,t)` | 子串 `t` 在 `s` 中第一次出现的位置，没有返回 0 | `index("hello","ll")` 返回 `3` |
| `split(s,a[,fs])` | 按 `fs` 分割字符串 `s` 到数组 `a`，返回元素个数 | `split("a:b:c",arr,":")` 返回 `3` |
| `sub(re,repl[,t])` | 替换**第一个**匹配，返回替换次数（0 或 1） | `sub(/o/,"0",$1)` |
| `gsub(re,repl[,t])` | 全局替换，返回替换次数 | `gsub(/o/,"0")` |
| `match(s,re)` | 返回匹配起始位置（未匹配返回 0），并设置 `RSTART` 与 `RLENGTH` | `match(s,/[0-9]+/)` |
| `sprintf(fmt,...)` | 按 printf 格式返回字符串（不输出） | `sprintf("%05d",42)` 返回 `00042` |
| `toupper(s)` / `tolower(s)` | 大小写转换 | `toupper("abc")` 返回 `ABC` |

实例：

```bash
# length / index / toupper / tolower
echo "Hello World" | awk '{print length($0), index($0,"World"), toupper($1), tolower($1)}'
# 输出：11 7 HELLO hello

# split 按冒号分割，并逐项输出
echo "a:b:c" | awk '{n=split($0,arr,":"); print n; for(i=1;i<=n;i++) print arr[i]}'
# 输出：3、a、b、c

# gsub 返回替换次数
echo "aXbXc" | awk '{print gsub(/X/,"-"); print}'
# 输出：2、a-b-c

# match + substr 提取字符串里的 IP
echo "my ip is 10.0.0.200 ok" | awk '{if(match($0,/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/)) print substr($0,RSTART,RLENGTH)}'
# 输出：10.0.0.200
```

> **注意：** `sub` / `gsub` 的替换串中 `&` 代表整个匹配（与 sed 一致），要输出普通 `&` 需写 `\&`。`toupper` / `tolower` / `match` / `length(数组)` 在部分精简 awk（如旧版 mawk、busybox awk）中不可用，跨平台脚本慎用——详见"现代环境补充"。

## 十六、printf 格式化输出

`print` 只管拼接，格式控制交给 `printf`。常用格式符：

| 格式符 | 含义 | 示例输出 |
| --- | --- | --- |
| `%d` / `%i` | 十进制整数 | `printf "%d", 42` → `42` |
| `%5d` | 宽度 5，右对齐 | `printf "%5d", 42` → `   42` |
| `%-5d` | 宽度 5，左对齐 | `printf "%-5d", 42` → `42   ` |
| `%05d` | 宽度 5，前导补零 | `printf "%05d", 42` → `00042` |
| `%s` | 字符串 | `printf "%-10s", "hi"` → `hi        ` |
| `%.2f` | 保留两位小数 | `printf "%.2f", 3.14159` → `3.14` |
| `%8.2f` | 宽度 8、两位小数 | `printf "%8.2f", 3.14159` → `    3.14` |
| `%x` / `%o` | 十六进制 / 八进制 | `printf "%x", 255` → `ff` |
| `%c` | 输出字符 | `printf "%c", 65` → `A` |
| `%%` | 输出百分号本身 | `printf "100%%"` → `100%` |

一条命令看全部效果：

```bash
awk 'BEGIN{printf "%s|%d|%-6s|%.2f|%05d\n","abc",42,"xy",3.14159,7}'
# 输出：abc|42|xy    |3.14|00007
```

`print` 与 `printf` 的关键差异：

| 对比 | `print` | `printf` |
| --- | --- | --- |
| 换行 | 自动加 `ORS` | 不自动加，要写 `\n` |
| 多参数连接 | 逗号 → `OFS` | 按格式串占位符消费参数 |
| 格式控制 | 无 | 宽度、对齐、精度、进制 |

`print` 的 `ORS` 也可以改，例如让输出不分行：

```bash
printf 'a\nb\n' | awk 'BEGIN{ORS="|"}{print}END{print "\n"}'
# 输出：a|b|
```

## 十七、getline 简述

`getline` 是 awk 读取数据的"另一条通道"，常用于按需读取文件、读取命令输出。它有六种形态：

| 形式 | 读取来源 | 写入目标 | 会影响的变量 |
| --- | --- | --- | --- |
| `getline` | 主输入的下一条记录 | `$0` | `NF`、`NR`、`FNR` |
| `getline var` | 主输入的下一条记录 | `var` | `NR`、`FNR` |
| `getline < file` | 指定文件 | `$0` | `NF` |
| `getline var < file` | 指定文件 | `var` | 无（只改 `var`） |
| `cmd \| getline` | 命令的标准输出 | `$0` | `NF` |
| `cmd \| getline var` | 命令的标准输出 | `var` | 无（只改 `var`） |

返回值：`1` 表示读取成功，`0` 表示读到文件/命令末尾，`-1` 表示出错。

最常用的两个场景：

```bash
# 场景一：BEGIN 阶段预读文件行数（此时主输入还没开始）
awk 'BEGIN{while((getline line < "/etc/services")>0) n++; print "lines="n}'

# 场景二：把命令输出读进变量
awk 'BEGIN{"echo hi" | getline x; print "cmd:",x}'
# 输出：cmd: hi
```

`getline`（不带参数）会改变主输入的读取进度，在主规则里使用要格外小心：

```bash
printf 'a\nb\nc\n' | awk '{getline; print "NR="NR" $0="$0}'
# 输出：NR=2 $0=b、NR=3 $0=c（每次循环多读一行）
```

> **注意：** 日常统计优先用"多文件参数"而不是 getline；`NR==FNR{...; next}` 的双文件关联写法就是最常见的替代方案（见实战案例）。

## 十八、awk 的统计能力

### 18.1 累加运算（计数）

先理解 shell 中的累加：

```bash
[root@linux-node1 ~]# i=0
[root@linux-node1 ~]# echo $((i=i+1))
1
[root@linux-node1 ~]# echo $((i=i+1))
2
[root@linux-node1 ~]# echo $((i=i+1))
3
```

awk 中的累加写法完全一样，只是变量无需提前定义。

求和还有一个健壮性细节：`sum+=$n` 遇到非数值字段按 0 处理，不报错；但混入空行、脏数据时，`n++` 的计数会和 `sum` 的累加对象对不上，平均值直接失真。求平均前要么加条件 `($2+0)>0` 过滤，要么把计数与累加放进同一个条件块。

**01. 统计 `/etc/services` 文件中的空行数量**

```bash
awk '/^$/' /etc/services
```

把每一次累加过程打印出来：

```bash
[root@linux-node1 ~]# awk '/^$/{i=i+1;print i}' /etc/services
空行 i=i+1 0+1  i=1
空行 i=i+1 1+1  i=2
空行 3
空行 4
空行 5
空行 6
空行 7
空行 8
空行 9
空行 10
空行 11
空行 12
空行 13
空行 14
空行 15
空行 16
空行 i=i+1 16+1 i=17
```

只输出最终结果：

```bash
[root@linux-node1 ~]# awk '/^$/{i=i+1}END{print i}' /etc/services
17
```

> **注意：** `/etc/services` 的空行数量随系统与软件安装情况而变，你机器上的结果不一定是 17，方法本身才是重点。

**02. 统计 `/etc/services` 文件中以井号开头的行**

```bash
awk '/^#/{i++}END{print i}' /etc/services
```

**03. 统计系统中有多少个虚拟用户、普通用户**

第一个历程：用户信息都保存在什么文件中 —— `/etc/passwd`。

第二个历程：从文件中匹配出虚拟用户与普通用户：

```bash
awk '$NF~/bash/' /etc/passwd
awk '$NF~/\/bin\/bash/' /etc/passwd
```

第三个历程：进行统计。

```bash
# 普通用户数量
[root@linux-node1 ~]# awk '$NF~/bash/{i=i+1}END{print i}' /etc/passwd
63
# 虚拟用户数量
[root@linux-node1 ~]# awk '$NF!~/bash/{i=i+1}END{print i}' /etc/passwd
22
```

### 18.2 求和运算

公式：`sum=sum+$n`（`$n` 是需要进行数值求和的列）。

```bash
[root@linux-node1 ~]# seq 10|awk '{sum=sum+$1;print sum}'
1  sum=sum+$1  0+1 sum=1
2  sum=sum+$1  1+2 sum=3
3  sum=sum+$1  3+3 sum=6
4              6+4 sum=10
5             10+5 sum=15
6             15+6 sum=21
7      28
8      36
9      45
10           45+10 sum=55
```

### 18.3 综合练习：统计所有人的第一次和第三次捐款总额

需求：显示表头，并统计第一次捐款总额与第三次捐款总额。

```bash
[root@linux-node1 ~]# awk -F ":" 'BEGIN{print "第一次总额","第三次总额"}{a=a+$2;b=b+$4}END{print a,b}' awk_test.txt|column -t
第一次总额  第三次总额
2130        1661
```

思路：用 `BEGIN` 打印表头，用两个变量分别累加第 2 列和第 4 列，在 `END` 中输出。

## 十九、awk 实战案例

### 19.1 统计求和：总额、平均值、最大值

```bash
# 第三次捐款的总额、平均值、最大值（-F ":" 时 $4 是第三次捐款）
awk -F ":" '{s+=$4; if($4>max) max=$4; n++}END{printf "总额=%d 平均=%.1f 最大=%d\n", s, s/n, max}' awk_test.txt
# 输出：总额=1661 平均=166.1 最大=300

# 不指定分隔符时默认按空白切分，这里对 ID 号码求和
awk '{s+=$3}END{print "ID总和="s}' awk_test.txt
```

### 19.2 分组计数：按姓氏统计人次与总额

```bash
awk -F "[ :]+" '{sum[$1]+=$4+$5+$6; n[$1]++} END{for(s in sum) printf "%-6s %d 人次, 合计 %d\n", s, n[s], sum[s]}' awk_test.txt
# 输出（for-in 顺序不固定，可再接 | sort -k2 -nr 排序）：
# Zi     1 人次, 合计 618
# Wang   1 人次, 合计 280
# Zhang  2 人次, 合计 971
# Lao    2 人次, 合计 1050
# Liu    1 人次, 合计 525
# Meng   1 人次, 合计 360
# Wu     1 人次, 合计 405
# Li     1 人次, 合计 550
```

配合 `sort` 输出 Top N（把计数值放前面便于数值排序）：

```bash
awk -F "[ :]+" '{c[$1]+=$4+$5+$6}END{for(k in c) print c[k], k}' awk_test.txt | sort -rn | head -3
```

### 19.3 字段切割：split 与多分隔符

```bash
# split 把捐款记录按 : 切开（默认空白分隔时 $4 就是整段 :250:100:175），逐段累加
awk '{n=split($4,d,":"); for(i=2;i<=n;i++) s[i]+=d[i]}END{print "第一次="s[2], "第二次="s[3], "第三次="s[4]}' awk_test.txt
# 输出：第一次=2130 第二次=968 第三次=1661

# 也可以直接用 -F ":" 按冒号切分后按列累加
awk -F ":" '{t1+=$2; t2+=$3; t3+=$4}END{print t1, t2, t3}' awk_test.txt
# 输出：2130 968 1661

# 提取 IP 地址：先用默认空白切分取 inet 行，再用 / 切掉子网后缀
ip a s eth0 | awk 'NR==3{print $2}' | cut -d/ -f1
# 输出：10.0.0.200
```

> **注意：** `ip a s eth0` 的第 3 行是 `inet 10.0.0.200/24 brd ...`，默认空白分隔时 `$1=inet`、`$2=10.0.0.200/24`，再用 `cut -d/ -f1` 去掉 `/24`。这种"默认切分 + 管道二次处理"的写法比硬写正则分隔符更稳，也不受前导空格影响。

### 19.4 报表生成：表头、对齐、汇总三件套

```bash
awk -F "[ :]+" 'BEGIN{printf "%-10s %-10s %8s\n","姓","名","ID"}{printf "%-10s %-10s %8d\n",$1,$2,$3}END{printf "共 %d 条记录\n", NR}' awk_test.txt
```

输出效果：表头与数据列都用 `%-10s` 对齐，`END` 里输出合计行。生成 HTML/CSV 报表也是同一套路，把 `printf` 的格式串换成对应结构即可。

### 19.5 双文件关联：NR==FNR 经典写法

把"键-值"文件与"键列表"文件关联输出：

```bash
printf 'k1 v1\nk2 v2\n' >map.txt
printf 'k1\nk2\n' >keys.txt
awk 'NR==FNR{m[$1]=$2; next}{print $1, m[$1]}' map.txt keys.txt
# 输出：
# k1 v1
# k2 v2
```

原理：第一个文件读完后 `FNR` 重置而 `NR` 不重置，所以 `NR==FNR` 只在处理**第一个文件**时为真；`next` 跳过后续规则，第二个文件走第二条规则查表输出。

### 19.6 日志统计：状态码、PV/UV

```bash
# 统计 HTTP 状态码分布（combined 日志格式中状态码是第 9 列）
awk '{print $9}' access.log | sort | uniq -c | sort -rn

# 纯 awk 实现同样的统计
awk '{c[$9]++}END{for(s in c) print c[s], s}' access.log | sort -rn

# PV（总行数）与 UV（去重 IP 数）
awk '{ip[$1]++} END{print "PV="NR, "UV="length(ip)}' access.log
```

按请求方法细分也顺手：combined 格式里请求行在 `$6`（带引号），`split($6, m, "\"")` 后取 `m[2]` 就是 `GET /path HTTP/1.1` 整段，再按需要拆词即可，套路与上面的状态码统计一致。

### 19.7 外部变量：用 -v 把 shell 变量传进 awk

shell 变量传进 awk 有两条路，推荐走 `-v`：

```bash
# 推荐：-v 变量名=值，可多次使用
THRESH=90
awk -v t="$THRESH" '$1=="cpu" && $2+0 > t {print "over threshold:", $2}' metrics.txt

# 不推荐：把 shell 变量直接拼进单引号脚本，遇到空格和引号就碎
awk '$2 > '"$THRESH"' {print}' metrics.txt
```

`-v` 的三个要点：

1. 赋值发生在 `BEGIN` 之前，所以 `BEGIN{}` 里能用；但 `FS` 用 `-v` 设要注意——`-v FS=:` 在 POSIX 规范下对第一条记录的生效时机没有保证，设分隔符仍优先用 `-F` 或 `BEGIN{FS=...}`；
2. 命令行 `-v` 与 `BEGIN{VAR=...}` 都行，参数顺序上 `-v` 写在脚本之前；
3. 变量值会经过一定的转义处理（`\n` `\t` 会被展开成真实字符），传路径、正则时留意这一点。调试场景也常用 `-v`：`-v debug=1` 当开关，脚本里写 `if(debug) print "..."`。

sed 篇里那个 `&` 转义问题，到这里有了更优雅的解法：`awk -v old="$OLD" -v new="$NEW" '{gsub(old,new);print}'`，两个变量都走 `-v`，谁也不用再转义。

### 19.8 awk -f 脚本与管道输出排序

脚本超过十几行还塞在单引号里就没法维护了，标准做法是写成文件、用 `-f` 加载：

```bash
cat > stat.awk <<'EOF'
# 用法: awk -f stat.awk access.log
{ c[$9]++ }
END {
    for (s in c)
        printf "%8d  %s\n", c[s], s | "sort -rn"
    close("sort -rn")
}
EOF
awk -f stat.awk access.log
```

两个要点：

1. `print` / `printf` 后面接 `| "命令"`，输出直接交给该命令处理，等效于管道，但要自己 `close("命令")`（同一个命令字符串只开一个管道，close 后才能保证排序结果完整落盘）；
2. shebang 写 `#!/usr/bin/awk -f` 就能把 `.awk` 文件当独立脚本执行，gawk 环境可写 `#!/usr/bin/gawk -f` 以便用上扩展函数。

能记住的套路就一句话：统计逻辑留在 awk，排序交给 `sort`，两者通过输出管道衔接，比在 awk 里手写排序算法划算得多。

## 二十、awk 高级功能与常用写法

| 场景 | 说明 |
| --- | --- |
| 对日志信息进行统计（计数） | 配合 `i++` 与 `END{print i}` |
| 对日志信息数值进行求和 | 客户端下载、服务端上传、消耗的网络流量统计 |
| 排序分析 | 利用数组进行排序分析（进阶内容） |
| 编写脚本 | awk 支持循环语句与判断语句，可写成 `awk -f` 脚本处理日志 |

用 awk 取出 IP 地址：

```bash
ip a s eth0|awk -F "[ /]+" 'NR==3{print $3}'
hostname -i
```

> **注意：** 原笔记在此处写的是 `awk -F "[ /]+" 'NR==3{print $5}'`，实测输出是 `brd` 而不是 IP 地址，属于字段编号错误。原因：用正则作 `FS` 时，行首的分隔符会产生一个**空的 `$1`**，字段整体后移一位（`$2=inet`、`$3=10.0.0.200`、`$4=24`、`$5=brd`）。正确写法是取 `$3`，或者干脆用默认空白分隔（`awk 'NR==3{print $2}'` 得到 `10.0.0.200/24`，再 `cut -d/ -f1`）。默认空白分隔会忽略行首空白，是最不容易出错的写法。

> **注意：** `hostname -i` 输出的是主机名解析到的地址，部分系统会返回 `127.0.0.1`；`hostname -I`（大写）输出本机所有网卡的 IP 地址，更适合脚本获取本机 IP。

## 二十一、知识卡片

**概念卡**

| 概念 | 一句话解释 |
| --- | --- |
| 记录 / 字段 | 默认一行一条记录，按 `FS` 切成字段，`$0` 是整行、`$NF` 是最后一列 |
| 执行流程 | BEGIN → 逐行执行"模式-动作" → END，统计结果放 END |
| 模式 | 省略恒真；可为正则、比较、范围、字段匹配、表达式 |
| 数值字符串 | 输入字段与数值常量比较按数值、与字符串常量比较按字符串 |
| 关联数组 | 下标是字符串，`a[i,j]` 内部用 `SUBSEP` 连接 |

**函数卡**

| 目的 | 写法 |
| --- | --- |
| 取子串 | `substr(s,m,n)` |
| 找位置 | `index(s,t)`、`match(s,re)` + `RSTART`/`RLENGTH` |
| 切割 | `split(s,a,fs)` |
| 替换 | `gsub(re,repl,t)`（全局）、`sub`（第一个） |
| 格式化 | `sprintf(fmt,...)` |
| 长度 | `length(s)` / `length($0)` / `length(arr)`（gawk） |

**统计卡**

| 目的 | 写法 |
| --- | --- |
| 计数 | `{i++}END{print i}` |
| 求和 | `{s+=$2}END{print s}` |
| 分组计数 | `{c[$1]++}END{for(k in c) print k,c[k]}` |
| 分组求和 | `{s[$1]+=$2}END{for(k in s) print k,s[k]}` |
| 排序 Top N | `... END{for(k in c) print c[k],k}' \| sort -rn \| head` |
| 去重计数 | `{seen[$1]++}END{print length(seen)}` |

## 二十二、常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `awk 'NR=2'` 输出了整个文件 | 把赋值 `=` 当成比较 `==` | 检查程序里的等号数量 | 行号判断写 `NR==2` |
| 改了 `-F` 字段数还是不对 | 数据里分隔符不一致；或行首有前导分隔符 | `awk '{print NF}'` 逐行看字段数 | 用 `[ :]+` 这类正则分隔符吞掉连续分隔符 |
| 正则 `FS` 下 `$1` 是空的 | 正则分隔符不会忽略行首空白，产生空前导字段 | `for(i=1;i<=NF;i++) print i,$i` | 改用默认空白分隔，或从 `$2` 开始数 |
| `$1=="10.0"` 判断失效 | 字段与**字符串常量**比较走字符串比较 | `echo 10 \| awk '{print ($1=="10.0")}'` | 与数值比较写 `$1==10.0`，或先 `$1+0` 转数值 |
| `for-in` 输出顺序每次都不一样 | 关联数组本身无序 | 多次运行对比 | 管道接 `sort`；或 gawk 设 `PROCINFO["sorted_in"]` |
| `match`/`toupper` 报函数未定义 | 当前 awk 是 mawk/busybox 的精简实现 | `awk --version`（或 `readlink -f $(which awk)`） | 安装 gawk 后调用 `gawk` |
| gsub 替换后取字段值不对 | 替换 `$0` 会重建所有字段 | 替换后打印 `NF` 与各字段 | 只改指定列：`gsub(re,repl,$2)` |
| 处理大文件很慢 | 每条记录都执行全部规则 | 用 `next` 提前跳过不关心的行 | 把最常用的过滤条件放最前面并配 `next` |

## 二十三、现代环境补充

- **确认你的 awk 是哪个实现**：Debian / Ubuntu 默认 `awk` 指向 mawk（体积小、速度快，但函数是子集）；RHEL / Rocky / AlmaLinux / openSUSE 默认 gawk（功能全）。用 `readlink -f "$(which awk)"` 或 `awk -W version` 查看。
- **mawk 的缺口**：`match()`、`toupper()`、`tolower()`、`length(数组)`、`asort()`、`gensub()`、`strftime()` 等函数在 mawk 中不可用或行为不同（取决于版本）。脚本要在 Debian 系运行，`apt install gawk` 后调用 `gawk`，shebang 写 `#!/usr/bin/gawk -f`。
- **busybox awk**：Alpine 等精简镜像中的 awk 参数和函数进一步缩减（无 `-v` 的部分行为差异、无 `asort` 等），容器镜像里写脚本前先实测。
- **可移植写法建议**：跨发行版脚本坚持 POSIX 子集——不用 `length(arr)`、`asort`、`gensub`、`systime`、`ENVIRON`、多字符 `FS`/`RS`（多字符分隔符是 gawk 扩展）；需要排序就管道 `sort`。
- **GoAWK**：近年出现的 Go 实现，单一二进制、无依赖，适合在无法安装 gawk 的环境里运行兼容脚本。
- **结构化数据**：处理 CSV / TSV / JSON 时，正则切字段容易在引号、转义上翻车，建议使用专用的 `mlr`（Miller）、`csvkit`、`jq` 等工具。

## 二十四、自测题

1. `awk '{print $NF}' file` 遇到空行时会输出什么？为什么？

> **答案：** 输出一个空行。空行没有任何字段，`NF=0`，`$NF` 即 `$0`，也就是空字符串本身。

2. `NR` 和 `FNR` 有什么区别？处理单个文件时它们有区别吗？

> **答案：** `NR` 是跨所有输入文件累计的记录总数，`FNR` 是当前文件内的记录号、换文件后重置为 1。处理单个文件时两者始终相等；只有多文件时才会分叉，`NR==FNR` 也因此成为"只处理第一个文件"的经典判据。

3. `awk 'BEGIN{FS=":"}{print $2}'` 和 `awk -F: '{print $2}'` 等价吗？在普通动作里改 `FS` 又有什么区别？

> **答案：** 前两者等价，都在第一条记录读取前生效。若在普通动作里改 `FS`（如 `{FS=":"; print $2}`），当前这条记录仍按旧 `FS` 切分，从下一条记录起才生效——因为切分发生在读取记录时。

4. 如何用一条 awk 命令统计某一列数值的总和与平均值？

> **答案：** `awk '{s+=$2; n++}END{printf "总和=%d 平均=%.2f\n", s, s/n}' file`。累加放逐行动作，输出放 `END`，`NR` 可直接当记录数用，无需单独计数。

5. `print $1, $2` 和 `print $1 $2` 的输出有什么区别？

> **答案：** `print $1, $2` 用 `OFS`（默认空格）连接两个字段；`print $1 $2` 是字符串直接拼接，中间没有任何分隔符。前者输出 `a b`，后者输出 `ab`。

## 二十五、相关阅读

- sed 命令详解：文本处理的增、删、改、查
- 系统符号、通配符号与基础正则表达式
- 扩展正则表达式与 grep
- 用户管理
- 附录-命令速查表

## 小结

1. awk 擅长**取列与统计**，语法是 `awk [参数] '模式{动作}' 文件`，模式决定处理哪些行，动作决定怎么处理。
2. 执行流程是三段式：`BEGIN`（读数据前，设变量、印表头）→ 逐行执行"模式-动作"（可用 `next` / `exit` 控制流程）→ `END`（读完后，输出统计结果）。
3. 数据模型是"记录 + 字段"：默认一行一条记录、空白切字段；`$0` 是整行、`$NF` 是最后一列、`$(NF-n)` 是倒数第 n 列；`-F` 可指定分隔符，多个分隔符写成 `awk -F "[ :]+"`。
4. 条件写法要区分赋值与比较：`NR=2` 是赋值（会输出整个文件），`NR==2` 才是比较；指定列匹配用 `$3~/正则/` 或 `$3!~/正则/`。
5. `BEGIN{}` 常用于打印表头、设置 `FS`；`END{}` 常用于输出统计结果，二者是 awk 做报表的核心。
6. 计数公式是 `i=i+1`（或 `i++`），求和公式是 `sum=sum+$n`，结果统一放在 `END{}` 中输出；分组统计用关联数组 `c[$1]++`，遍历用 `for (k in c)`。
7. 常用字符串函数：`length`、`substr`、`index`、`split`、`sub`、`gsub`、`match`（配 `RSTART`/`RLENGTH`）、`sprintf`、`toupper`、`tolower`。
8. `printf` 管格式（宽度、对齐、精度、进制），`print` 管拼接（逗号出 `OFS`）；`printf` 不自动换行，记得写 `\n`。
9. `getline` 提供按需读取的通道（文件、命令输出、主输入下一条），返回 1 / 0 / -1；日常关联两个文件优先用 `NR==FNR{...; next}` 写法。
10. `gsub(/原内容/,"新内容",第几列)` 用于替换指定列；排查日志时常用 `awk '$0!~/^#|^$/'` 先剔除注释与空行。
11. 跨发行版注意 awk 实现差异：Debian/Ubuntu 默认 mawk（函数是子集），统计脚本建议装 gawk；可移植脚本坚持 POSIX 子集，排序交给 `sort`，结构化数据用 `mlr` / `jq`。
{% endraw %}
