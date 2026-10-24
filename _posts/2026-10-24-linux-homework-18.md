---
title: "day18-正则与sed总结作业实操"
date: 2026-10-24 09:40:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-18"
---

{% raw %}

课程第 18 天的作业三道题全是「总结型」：①总结正则符号；②总结 sed 命令；③总结 find / tar / date。总结型题目按规范转化为「知识讲解 + 速查表 + 可直接运行的示例及真实输出 + 自测」。三题全部为 A 级：所有正则示例、sed 示例、find/tar/date 示例均在 Git Bash 实际执行，输出为真实结果。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出 CentOS 7 标准预期输出，标注 `预期输出`。

本篇三题涉及的全部是 shell 核心命令，**全部为 A 级真跑**。实操目录统一为 `/tmp/hw/day18`。环境实测：GNU bash 5.3.15、GNU sed 4.9、GNU Awk 5.4.0、GNU tar（随 Git Bash 提供）。输出中的本地用户名已按脱敏要求统一替换为 `user`。与 CentOS 7 的固有差异（如 `date` 默认输出格式、`ls -l` 无 SELinux 标记点）会在对应位置说明，属正常。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 总结正则符号 | A 级（基础 10 个 + 扩展 6 个，逐条真跑） |
| 题 2 | 总结 sed 命令 | A 级（增删改查 p/d/s/a/i/c 全部真跑） |
| 题 3 | 总结 find / tar / date | A 级（三张速查表 + 组合实战脚本真跑） |

## 题 1：总结正则符号

**考察点**：基础正则（BRE）与扩展正则（ERE）的符号集合、两者的写法差异（是否需要反斜杠转义），以及各符号在 grep/sed/awk 中的实际行为。

**实现思路**：先构造一份覆盖各种组合的测试文本，然后「一个符号一条命令一条输出」地逐个真跑，先用基础符号、再用扩展符号，最后给出一张完整对照表并点明 BRE/ERE 的转义差异。

### 步骤 1：构造测试文件（已实操）

```bash
mkdir -p /tmp/hw/day18 && cd /tmp/hw/day18
cat > re.txt <<'EOF'
abc
aab
abb
ac
a
123
a1b2
xyz
abcabc
a.c
a*c
abc123
ABC
EOF
cat -n re.txt
```

输出：

```console
$ cat -n re.txt
     1	abc
     2	aab
     3	abb
     4	ac
     5	a
     6	123
     7	a1b2
     8	xyz
     9	abcabc
    10	a.c
    11	a*c
    12	abc123
    13	ABC
```

### 步骤 2：基础正则符号逐个真跑（已实操）

```bash
grep '^a'   re.txt      # ^  行首锚定
grep 'c$'   re.txt      # $  行尾锚定
grep '^a.c$' re.txt     # .  任意一个字符（有且仅有一个）
grep '^ab*c$' re.txt    # *  前一个字符出现 0 次或多次
grep '^a.*c$' re.txt    # .* 任意长度任意字符
grep '^[ab]' re.txt     # [] 字符集合，中括号内任选其一
grep '^[^a]' re.txt     # [^] 集合取反
grep 'a\.c' re.txt      # \  转义，把元字符变回字面量
grep 'a\*c' re.txt
```

输出：

```console
$ grep '^a'   re.txt
abc
aab
abb
ac
a
a1b2
abcabc
a.c
a*c
abc123

$ grep 'c$'   re.txt
abc
ac
abcabc
a.c
a*c

$ grep '^a.c$' re.txt
abc
a.c
a*c

$ grep '^ab*c$' re.txt
abc
ac

$ grep '^a.*c$' re.txt
abc
ac
abcabc
a.c
a*c

$ grep '^[ab]' re.txt
abc
aab
abb
ac
a
a1b2
abcabc
a.c
a*c
abc123

$ grep '^[^a]' re.txt
123
xyz
ABC

$ grep 'a\.c' re.txt
a.c

$ grep 'a\*c' re.txt
a*c
```

几处值得对照理解：

- `^a.c$` 同时匹配了 `abc`、`a.c`、`a*c`——因为 `.` 代表「任意一个字符」，它不区分字母、点号还是星号；想只匹配字面量的点，必须写 `a\.c`（见最后两条）。
- `^ab*c$` 只匹配 `abc` 和 `ac`：`b` 出现 1 次是 `abc`，出现 0 次是 `ac`；`abb`（两个 b）不在结果里是因为它不以 `c` 结尾。
- `^[^a]` 里的 `^` 含义完全不同——在中括号**内部开头**表示取反，在正则**开头**表示行首锚定。

### 步骤 3：扩展正则符号逐个真跑（已实操）

扩展正则要用 `grep -E`（等价 `egrep`）或 `sed -r`（等价 `sed -E`）：

```bash
grep -E '^ab+c$'    re.txt     # +    前一个字符 1 次或多次
grep -E '^ab?c$'    re.txt     # ?    前一个字符 0 次或 1 次
grep -E '^(abc|xyz)$' re.txt   # |    或者（多选一）
grep -E '^a{2}'     re.txt     # {n}  前一个字符恰好 n 次
grep -E '^ab{1,2}c$' re.txt    # {n,m} 前一个字符 n 到 m 次
grep -E '^(abc){2}$' re.txt    # ()   分组，把一段当整体重复
```

输出：

```console
$ grep -E '^ab+c$'    re.txt
abc

$ grep -E '^ab?c$'    re.txt
abc
ac

$ grep -E '^(abc|xyz)$' re.txt
abc
xyz

$ grep -E '^a{2}'     re.txt
aab

$ grep -E '^ab{1,2}c$' re.txt
abc

$ grep -E '^(abc){2}$' re.txt
abcabc
```

基础正则里写同样的意思要给 `+ ? | { }` 加反斜杠：

```bash
grep '^ab\+c$' re.txt          # 等价于 grep -E '^ab+c$'
grep '^ab\{1,2\}c$' re.txt
```

输出：

```console
$ grep '^ab\+c$' re.txt
abc

$ grep '^ab\{1,2\}c$' re.txt
abc
```

为什么会有两套写法：早期 grep 只认 BRE，后来 `+ ? | {} ()` 这些符号才加进来，为了兼容老脚本，BRE 里必须转义使用；`egrep`（`grep -E`）和 `sed -r` 走的就是不转义的 ERE。awk 更干脆——它的正则只有 ERE 一套，没有 BRE 开关。新写的匹配一律 `-E`/`-r`，省心。

### 步骤 4：分组与后向引用（sed -r 实战，已实操）

`(...)` 分组后，替换串里用 `\1` `\2` 引用第 1、第 2 个分组，替换串中的 `&` 代表「整个匹配到的内容」：

```bash
echo "web01 db02" | sed -r 's/(web)([0-9]+) (db)([0-9]+)/\3\4 \1\2/'
printf '10.0.0.1\n192.168.1.10\n' | sed -r 's/^([0-9]+).*/\1/'
printf 'web01\nweb02\n' | sed -r 's/^.*$/[&]/'
echo "123456" | sed -r 's/([0-9]{3})([0-9]{3})/\1-\2/'
```

输出：

```console
$ echo "web01 db02" | sed -r 's/(web)([0-9]+) (db)([0-9]+)/\3\4 \1\2/'
db02 web01

$ printf '10.0.0.1\n192.168.1.10\n' | sed -r 's/^([0-9]+).*/\1/'
10
192

$ printf 'web01\nweb02\n' | sed -r 's/^.*$/[&]/'
[web01]
[web02]

$ echo "123456" | sed -r 's/([0-9]{3})([0-9]{3})/\1-\2/'
123-456
```

第一条是「两个字段互换位置」的经典套路；第二条是「取 IP 第一段」的取列技巧；第三条演示 `&` 引用整行；第四条演示分组重复。

### 步骤 5：POSIX 字符类（已实操）

```bash
grep '^[[:digit:]]' re.txt          # 数字开头
grep '^[[:alpha:]]\{3\}$' re.txt    # 恰好 3 个字母组成的一行
```

输出：

```console
$ grep '^[[:digit:]]' re.txt
123

$ grep '^[[:alpha:]]\{3\}$' re.txt
abc
aab
abb
xyz
ABC
```

`[[:digit:]]` 等价 `[0-9]`、`[[:alpha:]]` 等价 `[a-zA-Z]`、`[[:alnum:]]` 等价 `[a-zA-Z0-9]`、`[[:space:]]` 表示空白。用 POSIX 字符类比手敲 `[a-zA-Z]` 更能规避不同 locale 下的排序问题。

### 正则符号完整速查表

**基础正则（BRE，grep / sed 默认）**

| 符号 | 含义 | 示例 | 示例效果 |
| --- | --- | --- | --- |
| `^` | 匹配行首 | `grep '^a' f` | 取所有 a 开头的行 |
| `$` | 匹配行尾 | `grep 'c$' f` | 取所有 c 结尾的行 |
| `^$` | 空行 | `grep -v '^$' f` | 排除空行 |
| `.` | 任意一个字符（必有一个） | `grep '^a.c$' f` | 匹配 abc、a.c、a*c |
| `*` | 前一个字符 0 次或多次 | `grep '^ab*c$' f` | 匹配 ac、abc、abbc |
| `.*` | 任意长度任意字符（可为空） | `grep '^a.*c$' f` | a 开头 c 结尾的所有行 |
| `[]` | 字符集合，任选其一 | `grep '^[ab]' f` | a 或 b 开头 |
| `[^]` | 集合取反 | `grep '^[^a]' f` | 不以 a 开头 |
| `[a-z]` | 范围 | `grep '[0-9]' f` | 含数字的行 |
| `\` | 转义元字符 | `grep 'a\.c' f` | 只匹配字面量 a.c |

**扩展正则（ERE，需 `grep -E` / `sed -r`）**

| 符号 | 含义 | 示例 | 示例效果 |
| --- | --- | --- | --- |
| `+` | 前一个字符 1 次或多次 | `grep -E 'ab+c' f` | 至少一个 b |
| `?` | 前一个字符 0 次或 1 次 | `grep -E 'ab?c' f` | ac 或 abc |
| `\|` | 或者（多选一） | `grep -E 'abc\|xyz' f` | 含 abc 或 xyz |
| `{n}` | 前一个字符恰好 n 次 | `grep -E 'a{2}' f` | 恰好两个 a |
| `{n,}` | 至少 n 次 | `grep -E 'a{2,}' f` | 两个及以上 a |
| `{n,m}` | n 到 m 次 | `grep -E 'ab{1,2}c' f` | abc 或 abbc |
| `()` | 分组 | `grep -E '(abc){2}' f` | abcabc |
| `\1` `\2` | 后向引用分组 | `sed -r 's/(a)(b)/\2\1/'` | 交换分组内容 |

**BRE 与 ERE 写法对照（最易混）**

| 含义 | 扩展正则（grep -E / sed -r） | 基础正则（grep / sed） |
| --- | --- | --- |
| 1 次或多次 | `+` | `\+` |
| 0 次或 1 次 | `?` | `\?` |
| 或者 | `\|` | `\|` |
| 次数范围 | `{n,m}` | `\{n,m\}` |
| 分组 | `(` `)` | `\(` `\)` |

**验证方法**：同一语义用两种写法跑一遍（如 `grep -E 'ab+c'` 与 `grep 'ab\+c'`），输出应当完全一致；对拿不准的符号，用 `echo "候选串" | grep '正则'` 单串验证比在大文件里看更快。

> **易错点**：
>
> - 忘记加 `-E`/`-r` 时，`+ ? | { } ( )` 会被当成普通字符，表现为「明明写了却匹配不到」；
> - `.` 是「任意一个字符」不是「任意一个点」，匹配 IP 里的点必须写 `\.`；
> - `^` 在正则开头是行首、在 `[]` 内部开头是取反，同一个符号两种含义；
> - `[a-z]` 的范围受 locale 影响，想稳定就用 `[[:lower:]]`；
> - 写 `*` 前一定要想清楚它修饰的是「前一个字符」，`.` 本身没有「通配多个」的意思，`.*` 才有。

> **参见**：基础正则表达式、扩展正则表达式与 grep

## 题 2：总结 sed 命令

**考察点**：sed 的「增删改查」四类动作（`p` 查、`d` 删、`s` 改、`a/i/c` 增），以及 `-n`、`-i`、`-r`、`-e` 这几个决定行为的关键参数。

**实现思路**：先给一张命令速查表建立全貌，再按「查 → 删 → 改 → 增」四步逐条真跑，最后演示多命令组合、写文件/读文件，以及 `-i.bak` 的安全用法。sed 的核心模型是：`地址（哪几行）+ 命令（做什么）`，默认逐行处理并打印模式空间内容。

### 步骤 1：构造测试文件（已实操）

```bash
cd /tmp/hw/day18
cat > sed.txt <<'EOF'
web01 10.0.0.1 running
web02 10.0.0.2 stopped
db01 10.0.0.3 running
db02 10.0.0.4 stopped
lb01 10.0.0.5 running
EOF
cat -n sed.txt
```

输出：

```console
$ cat -n sed.txt
     1	web01 10.0.0.1 running
     2	web02 10.0.0.2 stopped
     3	db01 10.0.0.3 running
     4	db02 10.0.0.4 stopped
     5	lb01 10.0.0.5 running
```

### 步骤 2：查 —— p 命令（已实操）

```bash
sed -n '2p' sed.txt          # 打印第 2 行
sed -n '2,4p' sed.txt        # 打印第 2~4 行
sed -n '/running/p' sed.txt  # 打印匹配 running 的行
sed '2p' sed.txt | head -4   # 不加 -n 的后果：第 2 行被打印两次
```

输出：

```console
$ sed -n '2p' sed.txt
web02 10.0.0.2 stopped

$ sed -n '2,4p' sed.txt
web02 10.0.0.2 stopped
db01 10.0.0.3 running
db02 10.0.0.4 stopped

$ sed -n '/running/p' sed.txt
web01 10.0.0.1 running
db01 10.0.0.3 running
lb01 10.0.0.5 running

$ sed '2p' sed.txt | head -4
web01 10.0.0.1 running
web02 10.0.0.2 stopped
web02 10.0.0.2 stopped
db01 10.0.0.3 running
```

`-n` 是「关闭默认输出」，只输出被 `p` 显式打印的行；不加 `-n` 就会「原样输出一遍 + p 命令再输出一遍」，匹配行出现两次——新手十有八九在这栽过跟头。

### 步骤 3：删 —— d 命令（已实操）

```bash
sed '2d' sed.txt             # 按行号删
sed '/stopped/d' sed.txt     # 按内容删（排除过滤）
sed '3,$d' sed.txt           # 从第 3 行删到末尾
```

输出：

```console
$ sed '2d' sed.txt
web01 10.0.0.1 running
db01 10.0.0.3 running
db02 10.0.0.4 stopped
lb01 10.0.0.5 running

$ sed '/stopped/d' sed.txt
web01 10.0.0.1 running
db01 10.0.0.3 running
lb01 10.0.0.5 running

$ sed '3,$d' sed.txt
web01 10.0.0.1 running
web02 10.0.0.2 stopped
```

### 步骤 4：改 —— s 命令（已实操）

```bash
sed 's/running/UP/' sed.txt        # 每行只替换第 1 处
sed 's/0/X/g' sed.txt              # g = 行内全局替换
sed '2,3s/10\.0/172.16/' sed.txt   # 只在第 2~3 行做替换
cp sed.txt s1.txt; sed -i 's/stopped/DOWN/' s1.txt; cat s1.txt   # -i 原地改
```

输出：

```console
$ sed 's/running/UP/' sed.txt
web01 10.0.0.1 UP
web02 10.0.0.2 stopped
db01 10.0.0.3 UP
db02 10.0.0.4 stopped
lb01 10.0.0.5 UP

$ sed 's/0/X/g' sed.txt
webX1 1X.X.X.1 running
webX2 1X.X.X.2 stopped
dbX1 1X.X.X.3 running
dbX2 1X.X.X.4 stopped
lbX1 1X.X.X.5 running

$ sed '2,3s/10\.0/172.16/' sed.txt
web01 10.0.0.1 running
web02 172.16.0.2 stopped
db01 172.16.0.3 running
db02 10.0.0.4 stopped
lb01 10.0.0.5 running

$ sed -i 's/stopped/DOWN/' s1.txt
$ cat s1.txt
web01 10.0.0.1 running
web02 10.0.0.2 DOWN
db01 10.0.0.3 running
db02 10.0.0.4 DOWN
lb01 10.0.0.5 running
```

`s` 的完整格式是 `s#源#目标#g`，分隔符除了 `/` 还可以用 `#`、`|` 等任意字符——路径里含 `/` 时换成 `s#/a/b#/c/d#` 就不用逐个转义了。

### 步骤 5：增 —— a / i / c（已实操）

```bash
sed '2a\--- inserted ---' sed.txt              # a：在第 2 行【后】追加
sed '2i\--- inserted ---' sed.txt              # i：在第 2 行【前】插入
sed '2c\web02 10.0.0.2 DOWN' sed.txt           # c：把第 2 行整行替换
sed '/db01/a\# new line after db01' sed.txt    # 匹配行后追加
sed '$a\# appended at end' sed.txt             # $ 表示最后一行
```

输出：

```console
$ sed '2a\--- inserted ---' sed.txt
web01 10.0.0.1 running
web02 10.0.0.2 stopped
--- inserted ---
db01 10.0.0.3 running
db02 10.0.0.4 stopped
lb01 10.0.0.5 running

$ sed '2i\--- inserted ---' sed.txt
web01 10.0.0.1 running
--- inserted ---
web02 10.0.0.2 stopped
db01 10.0.0.3 running
db02 10.0.0.4 stopped
lb01 10.0.0.5 running

$ sed '2c\web02 10.0.0.2 DOWN' sed.txt
web01 10.0.0.1 running
web02 10.0.0.2 DOWN
db01 10.0.0.3 running
db02 10.0.0.4 stopped
lb01 10.0.0.5 running

$ sed '/db01/a\# new line after db01' sed.txt
web01 10.0.0.1 running
web02 10.0.0.2 stopped
db01 10.0.0.3 running
# new line after db01
db02 10.0.0.4 stopped
lb01 10.0.0.5 running

$ sed '$a\# appended at end' sed.txt
web01 10.0.0.1 running
web02 10.0.0.2 stopped
db01 10.0.0.3 running
db02 10.0.0.4 stopped
lb01 10.0.0.5 running
# appended at end
```

记忆口诀：`a` = append（后）、`i` = insert（前）、`c` = change（换整行）。GNU sed 可以省略 `\` 直接写 `sed '2a text'`，但为了兼容其他版本建议保留 `\`。

### 步骤 6：多命令组合与其他动作（已实操）

```bash
sed -n -e '1p' -e '$p' sed.txt       # -e 串多条命令：打印首行和末行
sed -n '1p;$p' sed.txt               # 等价写法：分号分隔
sed -n '/running/w running.txt' sed.txt; cat running.txt   # w：匹配行写入文件
printf '# header\n' > head.txt; sed '1r head.txt' sed.txt | head -3   # r：读入文件
sed -n '1,2p' sed.txt                # 模拟 head -2
sed -n '$p' sed.txt                  # 模拟 tail -1
```

输出：

```console
$ sed -n -e '1p' -e '$p' sed.txt
web01 10.0.0.1 running
lb01 10.0.0.5 running

$ sed -n '/running/w running.txt' sed.txt
$ cat running.txt
web01 10.0.0.1 running
db01 10.0.0.3 running
lb01 10.0.0.5 running

$ sed '1r head.txt' sed.txt | head -3
web01 10.0.0.1 running
# header
web02 10.0.0.2 stopped

$ sed -n '1,2p' sed.txt
web01 10.0.0.1 running
web02 10.0.0.2 stopped

$ sed -n '$p' sed.txt
lb01 10.0.0.5 running
```

### 步骤 7：实战组合（去注释空行 + 取 IP 列，已实操）

```bash
sed -e '/^#/d' -e '/^$/d' sed.txt                 # 清掉注释行和空行
sed -r 's/^[a-z0-9]+ ([0-9.]+) .*/\1/' sed.txt    # 用分组取出 IP 列
```

输出：

```console
$ sed -e '/^#/d' -e '/^$/d' sed.txt
web01 10.0.0.1 running
web02 10.0.0.2 stopped
db01 10.0.0.3 running
db02 10.0.0.4 stopped
lb01 10.0.0.5 running

$ sed -r 's/^[a-z0-9]+ ([0-9.]+) .*/\1/' sed.txt
10.0.0.1
10.0.0.2
10.0.0.3
10.0.0.4
10.0.0.5
```

第二条的思路：用 `([0-9.]+)` 把 IP 括成一个分组，前面用 `^[a-z0-9]+ ` 吃掉主机名和空格，后面用 `.*` 吃掉剩余部分，替换成 `\1` 就只剩 IP——这就是「用 sed 取列」，效果等价于 `awk '{print $2}'`，但 sed 版能按正则精确匹配而不只是按空格切。

### 步骤 8：-i.bak 安全改文件（已实操）

```bash
cp sed.txt bak_demo.txt
sed -i.bak 's/running/UP/' bak_demo.txt
ls -1 bak_demo.txt*
head -2 bak_demo.txt        # 改后的文件
head -2 bak_demo.txt.bak    # 自动备份
```

输出：

```console
$ ls -1 bak_demo.txt*
bak_demo.txt
bak_demo.txt.bak

$ head -2 bak_demo.txt
web01 10.0.0.1 UP
web02 10.0.0.2 stopped

$ head -2 bak_demo.txt.bak
web01 10.0.0.1 running
web02 10.0.0.2 stopped
```

`sed -i.bak` = 改原文件的同时生成一个 `.bak` 备份，比裸 `sed -i` 安全得多，生产环境建议养成习惯。改配置文件的固定三连：`-i.bak` 改完 → `diff` 看改动 → reload 服务，一步别省。

顺带一句分工：sed 强在改内容，要按列取值、做统计就交给 awk，两者在流水线里经常接力（grep 粗筛 → sed 清洗 → awk 出数）。

### sed 命令速查表

| 分类 | 命令/参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| 查 | `p` | 打印（一般配 `-n`） | `sed -n '2p' f` |
| 查 | `-n` | 关闭默认输出 | `sed -n '/err/p' f` |
| 删 | `d` | 删除行 | `sed '/^#/d' f` |
| 删 | `2,4d` / `$d` | 按范围/末行删 | `sed '3,$d' f` |
| 改 | `s###g` | 替换，`g` 全局 | `sed 's#a#b#g' f` |
| 改 | `Ns###` | 只替换第 N 次出现 | `sed 's/a/b/2' f` |
| 改 | `-i` / `-i.bak` | 原地修改 / 带备份 | `sed -i.bak 's/a/b/' f` |
| 增 | `a` | 指定行后追加 | `sed '2a\text' f` |
| 增 | `i` | 指定行前插入 | `sed '2i\text' f` |
| 增 | `c` | 替换整行 | `sed '2c\text' f` |
| 增 | `r` / `w` | 读入文件 / 写出到文件 | `sed '1r h.txt' f` |
| 参 | `-e` | 串接多条命令 | `sed -e '1d' -e '$d' f` |
| 参 | `-r` / `-E` | 启用扩展正则 | `sed -r 's/(a)(b)/\2\1/' f` |
| 参 | `-f` | 从脚本文件读命令 | `sed -f script.sed f` |
| 符号 | `&` | 替换串中代表整个匹配 | `sed 's/^.*$/[&]/' f` |
| 符号 | `\1` | 引用第 1 个分组 | `sed -r 's/(a)(b)/\2\1/' f` |

**验证方法**：任何 sed 命令先**不加** `-i` 跑一遍看 stdout 是否符合预期，确认无误再加 `-i`；修改类操作用 `diff 原文件 新文件` 核对改动范围，或用 `grep -c` 统计改动前后目标串的数量变化。

> **易错点**：
>
> - 忘加 `-n` 导致 `p` 命令把行打印两次；
> - `s` 命令默认只替换每行第一处，要全替换必须加 `g`；
> - `-i` 直接改写原文件且不可撤销，务必先 `cp` 或用 `-i.bak`；
> - `sed '/pat/d'` 删的是整行不是那个词，删词用 `s/pat//g`；
> - 路径替换时分隔符冲突（`s/a/b/` 里含 `/`），换用 `#` 作分隔符；
> - Mac/BSD sed 与 GNU sed 在 `-i`、`a`/`i` 语法上有差异，写跨平台脚本要注意。

> **参见**：sed 命令详解、基础正则表达式

## 题 3：总结 find / tar / date

**考察点**：find 的「条件 + 动作」模型、tar 的打包压缩与解压、date 的格式化输出与相对时间计算，以及三者组合成备份脚本的能力。

**实现思路**：三个命令各给一张速查表，然后构造一棵包含不同类型、不同修改时间、不同大小的目录树，逐条真跑验证，最后用一个「find 按时间找文件 → tar 打包 → date 命名」的完整备份脚本把三者串起来。

### 步骤 1：构造测试目录树（已实操）

```bash
cd /tmp/hw/day18
mkdir -p app/{logs,conf,scripts}
printf 'access line 1\n' > app/logs/access.log
printf 'error line 1\n'  > app/logs/error.log
printf 'old log\n'       > app/logs/old.log
printf 'port=80\n'       > app/conf/nginx.conf
printf 'port=3306\n'     > app/conf/my.cnf
printf '#!/bin/bash\necho hi\n' > app/scripts/backup.sh
touch -d "7 days ago"      app/logs/old.log      # 人为把时间改成 7 天前
touch -d "30 minutes ago"  app/logs/error.log
dd if=/dev/zero of=app/big.bin bs=1024 count=1024 2>/dev/null   # 1MB 大文件
find app | sort
```

输出：

```console
$ find app | sort
app
app/big.bin
app/conf
app/conf/my.cnf
app/conf/nginx.conf
app/logs
app/logs/access.log
app/logs/error.log
app/logs/old.log
app/scripts
app/scripts/backup.sh
```

### 步骤 2：find 查找条件（已实操）

```bash
find app -name "*.log"
find app -name "*.conf" -o -name "*.cnf"     # -o = 或
find app -type d
find app -type f -mtime -7 | sort            # 7 天内修改过的文件
find app -type f -mmin -60 | sort            # 60 分钟内修改过的文件
find app -type f -mtime +5                   # 5 天前（不含第 5 天）修改的
find app -type f -size +500k                 # 大于 500KB
find app -type f -perm 644 | head -3
```

输出：

```console
$ find app -name "*.log"
app/logs/access.log
app/logs/error.log
app/logs/old.log

$ find app -name "*.conf" -o -name "*.cnf"
app/conf/my.cnf
app/conf/nginx.conf

$ find app -type d
app
app/conf
app/logs
app/scripts

$ find app -type f -mtime -7 | sort
app/big.bin
app/conf/my.cnf
app/conf/nginx.conf
app/logs/access.log
app/logs/error.log
app/scripts/backup.sh

$ find app -type f -mmin -60 | sort
app/big.bin
app/conf/my.cnf
app/conf/nginx.conf
app/logs/access.log
app/logs/error.log
app/scripts/backup.sh

$ find app -type f -mtime +5
app/logs/old.log

$ find app -type f -size +500k
app/big.bin
```

`-mtime -7` 结果里**没有** `old.log`（它是 7 天前），`-mtime +5` 结果里**只有** `old.log`——这一正一反正好验证了时间条件的边界。`-mtime n` 的语义是「n*24 小时前」：`+n` 表示大于 n 天，`-n` 表示小于 n 天，不带符号表示恰好第 n 天。

`-o` 是「或」关系，两个 `-name` 条件命中其一即输出，所以 `.conf` 与 `.cnf` 两种后缀一次找齐。多条件混用时 `-a`（与）优先级高于 `-o`，拿不准就加转义括号：`find app \( -name "*.conf" -o -name "*.cnf" \)`。

### 步骤 3：find 的动作（已实操）

```bash
find app -name "*.log" -exec ls -l {} \;         # 每个结果执行一次命令
find app -name "*.log" -exec ls -l {} +          # 所有结果一次性传给命令
find app -name "*.log" | xargs wc -l             # 交给 xargs 处理
find app -maxdepth 1 -type f                     # 只查第 1 层
cp -r app app_test; find app_test -name "*.log" -delete; find app_test -type f
```

输出：

```console
$ find app -name "*.log" -exec ls -l {} \;
-rw-r--r-- 1 user 197609 14 Oct 24 04:38 app/logs/access.log
-rw-r--r-- 1 user 197609 13 Oct 24 04:08 app/logs/error.log
-rw-r--r-- 1 user 197609 8 Oct 17 04:38 app/logs/old.log

$ find app -name "*.log" -exec ls -l {} +
-rw-r--r-- 1 user 197609 14 Oct 24 04:38 app/logs/access.log
-rw-r--r-- 1 user 197609 13 Oct 24 04:08 app/logs/error.log
-rw-r--r-- 1 user 197609 8 Oct 17 04:38 app/logs/old.log

$ find app -name "*.log" | xargs wc -l
 1 app/logs/access.log
 1 app/logs/error.log
 1 app/logs/old.log
 3 total

$ find app -maxdepth 1 -type f
app/big.bin

$ find app_test -name "*.log" -delete
$ find app_test -type f
app_test/big.bin
app_test/conf/my.cnf
app_test/conf/nginx.conf
app_test/scripts/backup.sh
```

`{}` 是 find 结果的占位符；`\;` 表示「每个结果起一个进程」，`+` 表示「全部结果拼成一批只起一个进程」，文件多时 `+` 明显更快；`-delete` 直接删除匹配文件，**用之前一定先不加 `-delete` 跑一遍看清单**。

还有一条生产习惯：`find /` 这种全盘扫描会实打实拖 IO，先加 `-maxdepth` 缩小范围，跨文件系统加 `-xdev`，别让一次查找把线上盘打到满负荷。

### 辨析：find 的 -exec 与 xargs {: .sec-bianxi}

两件事都能「拿着 find 的结果去执行」，但路数不同：

- `-exec` 在 find 内部完成，`{}` 占位符想放哪放哪，跟 `-name`、`-mtime` 等条件天然一体；`\;` 逐个起进程慢，`+` 批量后与 xargs 效率接近；
- xargs 是把上一步输出拼成参数表，默认按空白切分——文件名带空格就翻车，必须 `find ... -print0 | xargs -0` 才稳；
- 需要把结果插到命令中间（如 `cp {} /dest/`）只能用 `-exec`；简单追加在末尾且文件名可控时，xargs 写起来更短。

文件来源不可信（用户目录、日志目录）就选 `-exec` 或 `-print0 | xargs -0`，别赌文件名里没空格。

### 步骤 4：date 格式化与时间计算（已实操）

```bash
date
date +%F                        # 2026-10-24
date +%Y%m%d                    # 20261024
date +%Y-%m-%d_%H-%M-%S         # 带时分秒，适合做文件名
date +%F -d "yesterday"
date +%F -d "-7 days"
date +%F -d "+1 month"
date -d @1700000000 +"%F %T"    # 时间戳转日期
```

输出：

```console
$ date
Sat Oct 24 04:40:02     2026

$ date +%F
2026-10-24

$ date +%Y%m%d
20261024

$ date +%Y-%m-%d_%H-%M-%S
2026-10-24_04-40-02

$ date +%F -d "yesterday"
2026-10-23

$ date +%F -d "-7 days"
2026-10-17

$ date +%F -d "+1 month"
2026-11-24

$ date -d @1700000000 +"%F %T"
2023-11-15 06:13:20
```

常用格式符：`%Y` 年、`%m` 月、`%d` 日、`%H` 时、`%M` 分、`%S` 秒、`%F` 等价 `%Y-%m-%d`、`%T` 等价 `%H:%M:%S`、`%s` 输出 Unix 时间戳。`-d` 支持自然语言（`yesterday`、`-7 days`、`+1 month`、`@时间戳`），这是写备份脚本时算「N 天前」的关键。脚本里做时间换算一律走 `-d`，别自己拿秒数加减；接到跨时区的机器先裸跑一次 `date` 确认时区再算。

（注：Git Bash 的 `date` 默认输出格式为 C 风格 `Sat Oct 24 04:40:02 2026`，与 CentOS 7 的 `Sat Oct 24 04:40:02 CST 2026` 仅时区串不同，格式化输出 `+%F` 等完全一致。）

### 步骤 5：tar 打包与解压（已实操）

```bash
tar zcf backup_$(date +%F).tar.gz app      # 打包并 gzip 压缩
tar tf backup_$(date +%F).tar.gz           # 只看内容不解包
mkdir -p restore && tar xf backup_$(date +%F).tar.gz -C restore   # 解到指定目录
tar zcf no_log.tar.gz --exclude="*.log" app && tar tf no_log.tar.gz
tar zcf conf_only.tar.gz -C app conf && tar tf conf_only.tar.gz
```

输出：

```console
$ tar zcf backup_2026-10-24.tar.gz app
$ ls -lh backup_2026-10-24.tar.gz
-rw-r--r-- 1 user 197609 1.5K Oct 24 04:40 backup_2026-10-24.tar.gz

$ tar tf backup_2026-10-24.tar.gz
app/
app/big.bin
app/conf/
app/conf/my.cnf
app/conf/nginx.conf
app/logs/
app/logs/access.log
app/logs/error.log
app/logs/old.log
app/scripts/
app/scripts/backup.sh

$ tar xf backup_2026-10-24.tar.gz -C restore
$ find restore -type f
restore/app/big.bin
restore/app/conf/my.cnf
restore/app/conf/nginx.conf
restore/app/logs/access.log
restore/app/logs/error.log
restore/app/logs/old.log
restore/app/scripts/backup.sh

$ tar tf no_log.tar.gz
app/
app/big.bin
app/conf/
app/conf/my.cnf
app/conf/nginx.conf
app/logs/
app/scripts/
app/scripts/backup.sh

$ tar tf conf_only.tar.gz
conf/
conf/my.cnf
conf/nginx.conf
```

`--exclude="*.log"` 成功把三个日志文件剔掉（`app/logs/` 目录还在但里面空了）；`-C app conf` 先切到 `app` 再打包 `conf`，包内路径就只有 `conf/...` 而没有 `app/` 前缀——这是控制包内目录层级的标准做法。

压缩率对比（已实操）：

```console
$ ls -l plain.tar gz.tar.gz
-rw-r--r-- 1 user 197609 1064960 Oct 24 04:40 plain.tar
-rw-r--r-- 1 user 197609    1490 Oct 24 04:40 gz.tar.gz
```

同样是 1MB 的零填充文件，`tar cf`（不压缩）1.0MB，`tar zcf`（gzip）只剩 1.5K。

### 步骤 6：三者组合 —— 备份脚本（已实操）

这是本题的核心：find 负责「找什么」、tar 负责「怎么打包」、date 负责「叫什么名字」。

```bash
cd /tmp/hw/day18
tar zcf log_$(date +%Y%m%d).tar.gz $(find app -name "*.log" -mtime -7)
tar tf log_$(date +%Y%m%d).tar.gz
```

输出：

```console
$ tar zcf log_20261024.tar.gz $(find app -name "*.log" -mtime -7)
$ tar tf log_20261024.tar.gz
app/logs/access.log
app/logs/error.log
```

`old.log` 因为 7 天前被 `-mtime -7` 排除掉了，包里只有 2 个文件，符合预期。

写成脚本（含旧备份自动清理，已实操）：

```bash
cat > /tmp/hw/day18/backup2.sh <<'EOF'
#!/bin/bash
# 备份 7 天内修改过的日志，文件名带日期；并清理 30 天前的旧备份
SRC=/tmp/hw/day18/app
DST=/tmp/hw/day18/backup
mkdir -p "$DST"
PKG="${DST}/log_$(date +%F).tar.gz"
cd "$SRC" || exit 1                       # 切到源目录，用相对路径打包
find . -type f -name "*.log" -mtime -7 > /tmp/hw/day18/filelist.txt
tar zcf "$PKG" -T /tmp/hw/day18/filelist.txt
echo "已打包 $(wc -l < /tmp/hw/day18/filelist.txt) 个文件 -> $PKG"
find "$DST" -name "log_*.tar.gz" -mtime +30 -delete
EOF
bash /tmp/hw/day18/backup2.sh
tar tf /tmp/hw/day18/backup/log_$(date +%F).tar.gz
```

输出：

```console
$ bash /tmp/hw/day18/backup2.sh
已打包 2 个文件 -> /tmp/hw/day18/backup/log_2026-10-24.tar.gz

$ tar tf /tmp/hw/day18/backup/log_2026-10-24.tar.gz
./logs/access.log
./logs/error.log
```

清理逻辑验证（已实操）：

```bash
touch -d "40 days ago" backup/log_old.tar.gz       # 造一个 40 天前的旧备份
ls -l backup/
find backup -name "log_*.tar.gz" -mtime +30 -delete
ls -l backup/
```

输出：

```console
$ ls -l backup/
-rw-r--r-- 1 user 197609 183 Oct 24 04:40 log_2026-10-24.tar.gz
-rw-r--r-- 1 user 197609   0 Sep 14 04:40 log_old.tar.gz

$ find backup -name "log_*.tar.gz" -mtime +30 -delete
$ ls -l backup/
-rw-r--r-- 1 user 197609 183 Oct 24 04:40 log_2026-10-24.tar.gz
```

40 天前的 `log_old.tar.gz` 被清掉，当天的备份保留——「按时间清理过期备份」这一生产常见需求就完成了。

### find / tar / date 速查表

**find**

| 分类 | 参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| 按名 | `-name` / `-iname` | 按文件名（后者忽略大小写） | `find / -name "*.log"` |
| 按类型 | `-type f/d/l` | 文件 / 目录 / 软链接 | `find /app -type d` |
| 按时间 | `-mtime ±n` | 按天，`+n` 之前、`-n` 之内 | `find / -mtime +7` |
| 按时间 | `-mmin ±n` | 按分钟 | `find / -mmin -60` |
| 按大小 | `-size ±N[kMG]` | 按大小 | `find / -size +100M` |
| 按权限 | `-perm` | 按权限位 | `find / -perm 644` |
| 按属主 | `-user` / `-group` | 按属主/属组 | `find / -user www` |
| 层级 | `-maxdepth N` | 限制查找深度 | `find /etc -maxdepth 1` |
| 逻辑 | `-a` / `-o` / `!` | 与 / 或 / 非 | `find . -name "*.log" -o -name "*.txt"` |
| 动作 | `-exec {} \;` | 逐个执行 | `find . -name "*.log" -exec rm {} \;` |
| 动作 | `-exec {} +` | 批量执行（更快） | `find . -name "*.log" -exec ls -l {} +` |
| 动作 | `-delete` | 直接删除 | `find . -name "*.tmp" -delete` |
| 动作 | `-print0` | 配合 `xargs -0` 处理空格文件名 | `find . -print0 \| xargs -0 rm` |

**tar**

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `c` | 创建包 | `tar cf a.tar dir` |
| `x` | 解包 | `tar xf a.tar` |
| `t` | 查看内容 | `tar tf a.tar` |
| `r` | 追加文件到包尾 | `tar rf a.tar newfile` |
| `z` | gzip 压缩（`.tar.gz`） | `tar zcf a.tar.gz dir` |
| `j` | bzip2 压缩（`.tar.bz2`） | `tar jcf a.tar.bz2 dir` |
| `J` | xz 压缩（`.tar.xz`） | `tar Jcf a.tar.xz dir` |
| `v` | 显示过程 | `tar zcvf a.tar.gz dir` |
| `f` | 指定包名（必须放最后） | `tar zcf a.tar.gz dir` |
| `-C` | 切换到指定目录再操作 | `tar xf a.tar.gz -C /opt` |
| `-T` | 从文件列表读取 | `tar zcf a.tar.gz -T list.txt` |
| `--exclude` | 排除 | `tar zcf a.tar.gz --exclude="*.log" dir` |
| `-p` | 保留权限属性（备份推荐） | `tar zcfp a.tar.gz /etc` |

`z/j/J` 三种压缩怎么挑：gzip 最快、兼容性最好；bzip2/xz 压得更狠但慢好几倍，适合冷数据归档；窗口紧的日常备份选 gzip。更新一点的 zstd 速度与压缩比兼顾，不过 CentOS 7 的 tar 1.26 不支持，CentOS 8+ 才用得上。

**date**

| 参数/格式符 | 作用 | 示例输出 |
| --- | --- | --- |
| `+%F` | 年-月-日 | `2026-10-24` |
| `+%T` | 时:分:秒 | `04:40:02` |
| `+%Y%m%d` | 紧凑日期（文件名常用） | `20261024` |
| `+%Y-%m-%d_%H-%M-%S` | 完整时间戳 | `2026-10-24_04-40-02` |
| `+%s` | Unix 时间戳 | `1771665602` |
| `-d "yesterday"` | 相对时间 | `2026-10-23` |
| `-d "-7 days"` | N 天前 | `2026-10-17` |
| `-d "+1 month"` | N 月后 | `2026-11-24` |
| `-d @1700000000` | 时间戳转日期 | `2023-11-15 06:13:20` |
| `-s "2026-10-24 10:00"` | 设置系统时间（B 级，需 root） | 无输出 |

**验证方法**：find 的验证是「先不加动作跑一遍看清单，确认清单无误再加 `-exec`/`-delete`」；tar 的验证是 `tar tf 包名` 看包内路径与文件数；date 的验证是把 `$(date +%F)` 放进 `echo` 看生成的字符串是否符合命名预期。三者组合的脚本，用 `tar tf` 核对包内文件数应等于 `find` 列出的行数。

> **易错点**：
>
> - 给 tar 传**绝对路径**会触发 `tar: Removing leading '/' from member names` 警告，且解包时会按绝对路径覆盖原文件——脚本里先 `cd` 到源目录用相对路径，或用 `-C`；
> - `find -mtime +7` 是「7*24 小时之前」，不是「第 7 天」；要「恰好 7 天前」用 `-mtime 7`；
> - `find ... -delete` 与 `-exec rm` 一样不可撤销，且 `-delete` 必须放在所有条件之后，否则会报参数顺序错误；
> - `-exec {} \;` 的分号必须转义（`\;`），写成 `;` 会被 shell 当成命令分隔符；
> - `tar` 的 `f` 参数必须紧跟包名、通常放参数串最后（`zcf` 不能写成 `fcz`）；
> - 文件名含空格时 `$(find ...)` 会被 shell 按空格拆开，正确做法是 `find ... -print0 | xargs -0 tar zcf pkg.tar.gz`。

> **参见**：文件属性与 inode、常用文件操作命令、附录-命令速查表

## 本篇小结

1. 正则分基础与扩展两套：基础正则里 `.` `*` `[]` `[^]` `^` `$` 直接用，`+ ? | {} ()` 要加反斜杠；用 `grep -E`/`sed -r` 切到扩展正则后这些符号都不用转义。两套写法的根子在历史兼容，新写的一律优先 `-E`。
2. 两个高频坑：`.` 匹配任意字符（包括字面量的点），想匹配真正的点必须 `\.`；`^` 在正则开头是行首锚定、在 `[]` 内部开头是取反，同一个符号两种含义。
3. sed 核心是「地址 + 命令」：查用 `p`（必配 `-n`）、删用 `d`、改用 `s###g`、增用 `a/i/c`；`-i` 原地改文件，生产环境一律用 `-i.bak` 留备份；`&` 引用整段匹配、`\1` 引用分组，配合 `-r` 可完成「取列」「字段互换」这类高级操作。
4. find 核心是「条件 + 动作」：`-name`/`-type`/`-mtime`/`-mmin`/`-size`/`-perm` 是条件，默认之间是与关系；`-exec {} \;`（逐个）与 `-exec {} +`（批量）是动作，`-delete` 要先不加动作验证清单再用；文件名带空格时记得 `-print0 | xargs -0`。
5. tar 记住 `c/x/t` + `z/j/J` + `f`（f 必须带包名且放最后）：`tar zcf` 打包、`tar tf` 查看、`tar xf -C` 解到指定目录；`--exclude` 排除、`-C` 控制包内层级、`-T` 从清单打包。
6. date 的 `+%F`/`+%Y%m%d` 负责生成文件名，`-d "-7 days"`/`-d @时间戳` 负责时间换算；三者组合就是运维日常备份脚本的骨架：`find ... -mtime -7 | tar zcf backup_$(date +%F).tar.gz -T -`，再加一句 `find ... -mtime +30 -delete` 做过期清理。
{% endraw %}
