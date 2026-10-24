---
title: "day17-三剑客与批量建用户作业实操"
date: 2026-10-24 09:41:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-17"
---

{% raw %}



对应课程第 17 天（shell 编程入门）的作业有两道：①sed/awk 命令如何进行排除过滤（对照 `grep -v`）；②批量创建用户 user01..user10，并给每个用户设置随机密码信息，其中要覆盖三个知识点——如何生成随机信息、变量设置、循环语句。两道都做完了：第一题给出三命令对照表并在 Git Bash 真跑 6 组示例；第二题拆成「随机信息 → 变量 → 循环 → 完整脚本」四步，随机生成与循环部分为真跑，涉及 `useradd`/`chpasswd` 的系统动作为 B 级预期输出。

## 实操环境说明 {: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令（sed/awk/grep/tr/head/cut/seq/date/md5sum 等）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令（`useradd`/`chpasswd`/`passwd --stdin`/`yum`）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明真机执行方式。

实操目录统一用 `/tmp/hw` 下的子目录，本文为 `/tmp/hw/day17`。环境实测：GNU bash 5.3.15、GNU sed 4.9、GNU Awk 5.4.0；`useradd`、`chpasswd` 在本环境不存在（已用 `command -v` 验证），`/etc/passwd` 也不可读，故建用户部分只能给 B 级命令。还有一个同名不同命的坑要提前说：本环境的 `mkpasswd` 是 Cygwin 自带的「导出类 passwd 文件」工具，与 CentOS 7 里 `expect` 包提供的随机密码工具 `mkpasswd` 完全不是一回事，文中已单独说明，避免误用。

## 题目总览 {: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | sed/awk 如何进行排除过滤（对照 `grep -v`） | A 级（对照表 + 6 组真跑） |
| 题 2 | 批量创建 user01..user10 并设随机密码 | 随机/循环 A 级 + 建号 B 级 |
| 题 2-知识点 1 | 如何生成随机信息 | A 级（3 种方法真跑） |
| 题 2-知识点 2 | 变量设置 | A 级（真跑） |
| 题 2-知识点 3 | 循环语句 | A 级（4 种写法真跑） |

## 题 1：sed/awk 如何进行排除过滤（对照 grep -v） {: .sec-expl}

**考察点**：同一个「把含有某内容的行剔掉」的需求，在三剑客里分别怎么表达；以及三者能力边界的差异——grep 只能整行匹配、sed 擅长行级编辑、awk 擅长按列判断。

**实现思路**：先构造一份带注释行和空行的主机清单作为统一输入，然后同一份输入分别用 `grep -v`、`sed '/pat/d'`、`awk '!/pat/'` 跑一遍，用 `diff` 证明三者输出完全一致；再分别演示各自独有的能力（grep 带行号、sed 原地改文件、awk 按列排除），最后给出选型对照表。

### 步骤 1：构造统一测试文件（已实操） {: .sec-ver}

```bash
mkdir -p /tmp/hw/day17 && cd /tmp/hw/day17
cat > test.txt <<'EOF'
web01  10.0.0.1    running
web02  10.0.0.2    stopped
db01   10.0.0.3    running
db02   10.0.0.4    stopped
# this is a comment line
lb01   10.0.0.5    running

# another comment
cache01 10.0.0.6   stopped
EOF
cat -n test.txt
```

输出：

```console
$ cat -n test.txt
     1	web01  10.0.0.1    running
     2	web02  10.0.0.2    stopped
     3	db01   10.0.0.3    running
     4	db02   10.0.0.4    stopped
     5	# this is a comment line
     6	lb01   10.0.0.5    running
     7	
     8	# another comment
     9	cache01 10.0.0.6   stopped
```

共 9 行，其中 3 行含 `stopped`（第 2、4、9 行），两个注释行（第 5、8 行），一个空行（第 7 行）——这样一次就能把「按内容排除」「按注释排除」「按空行排除」都覆盖到。

### 步骤 2：三种排除写法跑同一份输入（已实操） {: .sec-prac}

```bash
echo "===== 1) grep -v ====="
grep -v "stopped" test.txt
echo "===== 2) sed '/pat/d' ====="
sed '/stopped/d' test.txt
echo "===== 3) awk '!/pat/' ====="
awk '!/stopped/' test.txt
```

输出：

```console
===== 1) grep -v =====
web01  10.0.0.1    running
db01   10.0.0.3    running
# this is a comment line
lb01   10.0.0.5    running

# another comment
===== 2) sed '/pat/d' =====
web01  10.0.0.1    running
db01   10.0.0.3    running
# this is a comment line
lb01   10.0.0.5    running

# another comment
===== 3) awk '!/pat/' =====
web01  10.0.0.1    running
db01   10.0.0.3    running
# this is a comment line
lb01   10.0.0.5    running

# another comment
```

三者输出逐字相同。语法记忆点：`grep -v` 是参数取反，`sed '/pat/d'` 是「匹配到就删除」，awk 是把正则前面加 `!` 写成 `!/pat/`（取反作用于整个条件表达式）。

### 步骤 3：用行数与 diff 交叉验证（已实操） {: .sec-ver}

```bash
printf "原始行数: "; grep -c '' test.txt
printf "grep -v 后: "; grep -vc "stopped" test.txt
printf "sed 删除后: "; sed '/stopped/d' test.txt | grep -c ''
printf "awk 取反后: "; awk '!/stopped/' test.txt | grep -c ''
diff <(grep -v "stopped" test.txt) <(sed '/stopped/d' test.txt) && echo "grep -v 与 sed 结果一致"
diff <(grep -v "stopped" test.txt) <(awk '!/stopped/' test.txt) && echo "grep -v 与 awk 结果一致"
```

输出：

```console
原始行数: 9
grep -v 后: 6
sed 删除后: 6
awk 取反后: 6
grep -v 与 sed 结果一致
grep -v 与 awk 结果一致
```

9 - 3 = 6，行数对得上，`diff` 无差异输出，两种手段都证明结果一致。

### 步骤 4：多条件排除（同时剔除空行与注释行，已实操） {: .sec-prac}

```bash
grep -vE '^$|^#' test.txt     # grep：-E 启用扩展正则，| 表示"或"
sed -e '/^$/d' -e '/^#/d' test.txt   # sed：两个 -e 串两条删除规则
awk '!/^$/ && !/^#/' test.txt       # awk：两个取反条件用 && 连接
```

输出（三条命令结果相同，此处展示一份）：

```console
$ awk '!/^$/ && !/^#/' test.txt
web01  10.0.0.1    running
web02  10.0.0.2    stopped
db01   10.0.0.3    running
db02   10.0.0.4    stopped
lb01   10.0.0.5    running
cache01 10.0.0.6   stopped
```

注意逻辑差异：grep 的 `-v` 是对「整条正则」取反（`-vE 'A|B'` = 排除 A 或 B），sed 用多个 `-e` 顺次删除，awk 则是「非 A 且 非 B」。想排除多种模式时，awk 的 `&&` 写法最不容易写错。多看一眼 grep 那条：`|` 要配 `-E` 才表示「或」，这是扩展正则（ERE）的符号，没有 `-E` 时 `|` 就是普通字符——day18 会把 BRE/ERE 这套差异系统讲一遍。

### 步骤 5：三者独有的能力（已实操） {: .sec-prac}

```bash
# grep 独有：带行号看保留下来的行
grep -vn "stopped" test.txt
# sed 独有：按行号范围删、删最后一行、反向保留（!d）
sed '2,4d' test.txt
sed '$d' test.txt
sed '/stopped/!d' test.txt        # 只留匹配行，等价于 grep "stopped"
# awk 独有：按"列"排除，还能顺便改输出格式
awk '$3!="stopped"' test.txt
awk '$3!="stopped" {print $1,$2}' test.txt
```

输出：

```console
$ grep -vn "stopped" test.txt
1:web01  10.0.0.1    running
3:db01   10.0.0.3    running
5:# this is a comment line
6:lb01   10.0.0.5    running
7:
8:# another comment

$ sed '2,4d' test.txt
web01  10.0.0.1    running
# this is a comment line
lb01   10.0.0.5    running

# another comment
cache01 10.0.0.6   stopped

$ sed '/stopped/!d' test.txt
web02  10.0.0.2    stopped
db02   10.0.0.4    stopped
cache01 10.0.0.6   stopped

$ awk '$3!="stopped"' test.txt
web01  10.0.0.1    running
db01   10.0.0.3    running
# this is a comment line
lb01   10.0.0.5    running

# another comment

$ awk '$3!="stopped" {print $1,$2}' test.txt
web01 10.0.0.1
db01 10.0.0.3
# this
lb01 10.0.0.5
 
# another
```

最后一条最能体现区别：`awk` 可以先按列排除、再重排输出列，这是 grep 和 sed 都做不到的。但副作用也要看清——注释行 `# this is a comment line` 被按空格切成多列后，`$3` 是 `a`，所以它被当作「非 stopped」保留下来了；真实脚本里判断列之前通常要先把注释行排除掉（见步骤 4 的 `&&` 写法）。这个坑踩一次就记住了。

### 步骤 6：sed 原地修改文件（已实操，注意备份） {: .sec-warn}

```bash
cp test.txt sed_demo.txt
cp sed_demo.txt sed_demo.txt.bak      # 先备份，sed -i 不可逆
sed -i '/stopped/d' sed_demo.txt
cat -n sed_demo.txt
grep -c stopped sed_demo.txt.bak      # 备份文件未被改动
```

输出：

```console
$ cat -n sed_demo.txt
     1	web01  10.0.0.1    running
     2	db01   10.0.0.3    running
     3	# this is a comment line
     4	lb01   10.0.0.5    running
     5	
     6	# another comment

$ grep -c stopped sed_demo.txt.bak
3
```

这说明 `sed -i` 直接写回原文件（不打印到屏幕），备份文件仍是 9 行含 3 个 `stopped`。`grep -v` 与 `awk` 默认只输出到标准输出，要落盘得重定向（`grep -v pat f > f.new`），**不能**直接 `> f` 覆盖正在读的文件。

### 三命令排除过滤对照表 {: .sec-chk}

| 维度 | `grep -v "pat"` | `sed '/pat/d'` | `awk '!/pat/'` |
| --- | --- | --- | --- |
| 基本写法 | `grep -v "stopped" f` | `sed '/stopped/d' f` | `awk '!/stopped/' f` |
| 语义 | 反向选择保留行 | 匹配到就删除该行 | 条件取反才执行默认动作（打印） |
| 排除多个模式 | `grep -vE 'A|B'` | `sed -e '/A/d' -e '/B/d'` | `awk '!/A/ && !/B/'` |
| 忽略大小写 | `grep -vi pat` | `sed '/pat/Id'`（GNU 扩展） | `awk 'BEGIN{IGNORECASE=1} !/pat/'` |
| 按列判断 | 不支持 | 不支持（只能写很绕的正则） | 支持，`awk '$3!="stopped"'` |
| 按行号排除 | 不支持 | 支持，`sed '2,4d'`、`sed '$d'` | 支持，`awk 'NR<2 \|\| NR>4'` |
| 原地改文件 | 不支持（需重定向） | 支持，`sed -i`（建议 `-i.bak`） | 不支持（需重定向） |
| 顺带改输出 | 不支持 | 弱（配合 s 命令） | 强，`{print $1,$2}` |
| 典型用途 | 快速查看/过滤日志 | 批量清理文件中的行 | 过滤 + 取列 + 计算一条龙 |

**验证方法**：三种写法对同一输入跑完后，用 `diff <(命令A) <(命令B)` 比对输出为空、并用 `grep -c ''` 核对行数（9 行输入剔掉 3 行 = 6 行），即可证明过滤逻辑正确且三者等价。

> **易错点**：
>
> - `awk '!/pat/'` 的 `!` 必须写在正则前面、整个条件表达式开头；写成 `awk '/pat/!'` 是错误语法；
> - `sed '/pat/d'` 删的是「整行」，不是「行里的那个词」——只想删词要用 `sed 's/pat//g'`；
> - `sed -i` 会直接改写原文件且无回收站，生产环境一律先 `cp` 备份或用 `sed -i.bak` 留备份；
> - `grep -v` 与 `awk` 输出重定向回原文件会先截断文件导致内容丢失，必须先写临时文件再 `mv`；
> - 想排除的是「某一列等于某值」时，别用正则硬凑（`awk '!/stopped/'` 会把注释行里出现 stopped 的也排除掉），用 `awk '$3!="stopped"'` 最精确。

### 辨析：sed 与 awk 怎么分工

排除过滤只是三剑客能力的一小块，往深了说三者是三种工具：

- grep 是「筛选器」，只管整行匹配，筛完就交出去，不做修改；
- sed 是「流编辑器」，一行一行过，强在**改**——删行、替换、增插，还带 `-i` 原地落盘；
- awk 是「按列解析的小型语言」，强在**算**——取列、判断、累加、统计都能做。

一条流水线里经常三个都出现：grep 粗筛、sed 清洗格式、awk 出报表。经验法则是：要改文件内容找 sed，要按列判断或统计找 awk，单纯看有没有就 grep。

> **参见**：sed 命令详解、awk 命令详解、扩展正则表达式与 grep

## 题 2：批量创建用户 user01..user10 并给每个用户设置随机密码

**考察点**：三个 shell 基础知识点如何串成一个可用脚本——①如何生成随机信息；②变量设置（含命令替换赋值）；③循环语句（for）。最终落地为 `useradd` + 非交互式设密码。

**实现思路**：把大题拆成三步知识点分别真跑，再合成完整脚本。随机信息与循环部分在本环境可真跑（A 级）；`useradd`/`chpasswd` 属系统级命令，本环境不存在，给 B 级命令 + 预期输出，并额外提供一个把系统命令换成 `echo` 的「干跑版」在本环境真跑，用来验证循环与变量拼接逻辑确实正确。

### 知识点 1：如何生成随机信息（已实操） {: .sec-prac}

Linux 下生成随机字符串有四条常用路子，下面全部真跑。

#### 方法 1：`$RANDOM` 环境变量 + md5 截取 {: .sec-expl}

```bash
echo $RANDOM          # bash 内置变量，范围 0~32767
echo $RANDOM
echo $RANDOM | md5sum | cut -c 1-8
for i in 1 2 3; do echo $RANDOM | md5sum | cut -c 1-8; done
```

输出：

```console
$ echo $RANDOM
11900
$ echo $RANDOM
25655
$ echo $RANDOM | md5sum | cut -c 1-8
d3220d9e
$ for i in 1 2 3; do echo $RANDOM | md5sum | cut -c 1-8; done
7e8c0ffc
dda67bca
2c86f22b
```

`$RANDOM` 只给 0~32767 的整数，直接用当密码太短且只有数字；过一遍 `md5sum` 再 `cut -c` 截取，就得到定长的十六进制串。想要字符更丰富可加盐：`echo "$(date +%s)$RANDOM" | md5sum | cut -c 1-10`（真跑输出 `9f10b37e46`）。

#### 方法 2：`/dev/urandom` + `tr` 过滤字符集（最常用）

```bash
tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 8; echo
for i in 1 2 3; do tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 8; echo; done
```

输出：

```console
$ tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 8; echo
NUrzHNXv
$ for i in 1 2 3; do tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 8; echo; done
05yOkkv1
wIBV5ZaJ
H6KWOyIf
```

拆解：`tr -dc 'a-zA-Z0-9'` 中 `-d` 是删除、`-c` 是取补集，合起来 = 「只保留字母和数字」；`/dev/urandom` 是永不阻塞的随机字符设备；`head -c 8` 取前 8 个字节。这是运维脚本里最常见的一行式随机串。想加特殊符号就把字符集写成 `'a-zA-Z0-9_@#%'`。为什么用 `urandom` 而不是 `random`：前者熵不足时用安全算法补齐、永不阻塞，后者熵池见底会卡住整个脚本；密码学上除首次播种外两者等价，日常一律 `urandom`。

#### 方法 3：`openssl rand`（最短命令）

```bash
openssl rand -base64 9
openssl rand -hex 6
for n in 6 9 12; do printf "len=%s -> %s\n" "$n" "$(openssl rand -base64 $n)"; done
```

输出：

```console
$ openssl rand -base64 9
0iYjJrGnSNUp
$ openssl rand -hex 6
a8a9e3a69b3c
$ for n in 6 9 12; do printf "len=%s -> %s\n" "$n" "$(openssl rand -base64 $n)"; done
len=6 -> 5GfcAggf
len=9 -> pCMpUsecOjsC
len=12 -> EncCRzzLiIanP7rV
```

注意 base64 的输出长度约为输入字节数的 4/3（6 字节 → 8 字符，9 字节 → 12 字符），且可能含 `+` `/` `=`；`-hex` 输出纯十六进制，长度是字节数的 2 倍。要给密码用建议 `-base64` 后再 `tr -d '+/='` 过滤掉特殊字符。

#### 方法 4：`mkpasswd`（B 级，本环境不可用真跑） {: .sec-expl}

CentOS 7 里 `mkpasswd` 由 `expect` 包提供，专为生成可发音的随机口令设计：

```bash
yum install -y expect
mkpasswd -l 10 -d 3 -C 2 -s 1      # 长度10、至少3个数字、2个大写、1个特殊符号
```

（预期输出，CentOS 7）

```console
$ mkpasswd -l 10 -d 3 -C 2 -s 1
K9m$xP2vQa
```

> **重要提醒**：经 `command -v` 实测，本 Git Bash 环境的 `mkpasswd` 是 Cygwin 自带的「打印类 /etc/passwd 条目」工具（`mkpasswd -l` 会列出本机 Windows 账号，输出形如 `SYSTEM:*:18:18:U-NT AUTHORITY\SYSTEM,S-1-5-18:...`），与 CentOS 7 `expect` 包的随机口令工具**同名但完全不同**。在本环境执行 `mkpasswd -l 8` 得到的是账号清单而非密码，切勿混用。判断方法：`mkpasswd --help` 里出现 `-p,--password` 之类参数才是口令生成版。

#### 四种方法对比

| 方法 | 命令 | 优点 | 缺点 |
| --- | --- | --- | --- |
| `$RANDOM` + md5 | `echo $RANDOM \| md5sum \| cut -c 1-8` | 纯 bash 内置，无任何依赖 | 只有十六进制字符，随机性一般 |
| `/dev/urandom` + tr | `tr -dc 'a-zA-Z0-9' </dev/urandom \| head -c 8` | 字符集可控、随机性好、通用 | 命令略长 |
| openssl rand | `openssl rand -base64 9` | 最短，随机性最好 | base64 可能含 `+/=`，需二次过滤 |
| mkpasswd | `mkpasswd -l 10 -d 3 -C 2` | 可指定数字/大写/符号个数，符合口令策略 | 需额外装 expect |

**验证方法**：把任一方法放进 `for i in 1 2 3; do ...; done` 连跑三次，每次输出都不同即说明随机生效；再用 `... | wc -c` 核对长度确实等于设定值（注意 `echo` 会多一个换行，用 `printf` 或 `head -c` 更准）。

### 知识点 2：变量设置（已实操） {: .sec-prac}

```bash
name="user01"; echo "name=$name"
NUM=10; echo "NUM=$NUM"
DATE=$(date +%F); echo "DATE=$DATE"                       # 命令替换赋值
COUNT=$(grep -c "running" test.txt); echo "running 行数=$COUNT"
echo "双引号: 用户是 $name"                                # 双引号会解析变量
echo '单引号: 用户是 $name'                                # 单引号原样输出
```

输出：

```console
name=user01
NUM=10
DATE=2026-10-24
running 行数=3
双引号: 用户是 user01
单引号: 用户是 $name
```

要点：`=` 两边**不能有空格**；引用加 `$`；把命令结果存进变量用 `$(命令)`（等价反引号 `` `命令` ``，推荐前者可嵌套）；单引号原样输出、双引号解析变量——这条在写 `awk` 时尤其关键，awk 程序体通常用单引号包起来，就是为了防止 shell 把 `$1`、`$2` 当成 shell 变量吃掉。生产脚本里引用变量一律套双引号（`"$user"`），值里带空格才不会被拆成两个词。

### 知识点 3：循环语句（已实操） {: .sec-prac}

for 循环四种常见写法：

```bash
for i in 1 2 3; do echo "第 $i 次"; done                 # 列表式
for i in $(seq 1 3); do echo "seq i=$i"; done            # seq 生成序列
for i in {01..10}; do echo "user$i"; done                # 大括号展开，自动补零
for ((i=1;i<=3;i++)); do echo "C i=$i"; done             # C 语言风格
```

输出：

```console
$ for i in 1 2 3; do echo "第 $i 次"; done
第 1 次
第 2 次
第 3 次

$ for i in $(seq 1 3); do echo "seq i=$i"; done
seq i=1
seq i=2
seq i=3

$ for i in {01..10}; do echo "user$i"; done
user01
user02
user03
user04
user05
user06
user07
user08
user09
user10

$ for ((i=1;i<=3;i++)); do echo "C i=$i"; done
C i=1
C i=2
C i=3
```

本题要的是 user01..user10（两位补零），三种可用：`{01..10}` 最直观；`$(seq -w 1 10)` 用 `-w` 参数自动等宽补零，在 `$(...)` 里配合变量范围更灵活；`{01..$N}` 里的变量**不会**被展开，所以范围要用变量时必须改用 `seq`。

把三个知识点合起来先跑一遍（把随机串拼到用户名后面，已实操）：

```bash
for n in $(seq -w 1 10); do
  pass=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 8)
  echo "user$n:$pass"
done
```

输出：

```console
user01:hyhJkXN3
user02:dwPfzvFP
user03:YGTje36X
user04:GpdfEaGT
user05:VSP7VMma
user06:s0eiYYEG
user07:KMXHbwQv
user08:8NDJswSj
user09:4aq9ByVU
user10:uu1D32QR
```

每行输出都是 `chpasswd` 认的 `用户名:密码` 格式，直接喂给它就能设密码。

### 完整脚本（B 级：含 useradd/chpasswd）

```bash
cat > /tmp/hw/day17/batch_user.sh <<'EOF'
#!/bin/bash
# 批量创建用户 user01..user10 并设置随机密码
PASS_FILE=/tmp/hw/day17/user_pass.txt
: > "$PASS_FILE"                      # 清空（或新建）密码记录文件

for n in $(seq -w 1 10); do
    user="user${n}"
    if id "$user" &>/dev/null; then   # 已存在则跳过，保证脚本可重复执行
        echo "$user 已存在，跳过"
        continue
    fi
    useradd "$user"                   # 创建用户
    pass=$(tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 8)
    echo "${user}:${pass}" | chpasswd # 非交互式设密码
    echo "${user}:${pass}" >> "$PASS_FILE"
    echo "$user 创建完成"
done
chmod 600 "$PASS_FILE"
EOF
chmod +x /tmp/hw/day17/batch_user.sh
bash -n /tmp/hw/day17/batch_user.sh && echo "语法 OK"   # 先做语法检查
sh /tmp/hw/day17/batch_user.sh                          # 必须以 root 执行
```

脚本中三个知识点各就各位：随机信息用 `tr -dc ... </dev/urandom | head -c 8`；变量设置用 `user="user${n}"` 拼接与 `pass=$(...)` 命令替换；循环语句用 `for n in $(seq -w 1 10)`。真机上再讲究一点，建号时可以带 `-s /sbin/nologin`（只跑服务不登录的账号）或 `-M`（不建家目录）；大批量、要长期维护的账号交给 ansible 这类工具更稳，shell 脚本适合一次性场景。

先做语法检查（本环境已实操）：

```console
$ bash -n /tmp/hw/day17/batch_user.sh && echo "语法 OK"
语法 OK
```

CentOS 7 上以 root 执行的（预期输出，CentOS 7）：

```console
# sh /tmp/hw/day17/batch_user.sh
user01 创建完成
user02 创建完成
user03 创建完成
user04 创建完成
user05 创建完成
user06 创建完成
user07 创建完成
user08 创建完成
user09 创建完成
user10 创建完成
```

### 干跑版验证循环与变量拼接（已实操） {: .sec-ver}

为了在本环境证明脚本逻辑没问题，把两条系统命令换成 `echo` 做一次干跑（`[DRYRUN]` 前缀的是本该真实执行的动作）：

```bash
cat > /tmp/hw/day17/dryrun.sh <<'EOF'
#!/bin/bash
PASS_FILE=/tmp/hw/day17/user_pass_dryrun.txt
: > "$PASS_FILE"
for n in $(seq -w 1 10); do
    user="user${n}"
    pass=$(tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 8)
    echo "[DRYRUN] useradd ${user}"
    echo "[DRYRUN] echo ${user}:${pass} | chpasswd"
    echo "${user}:${pass}" >> "$PASS_FILE"
    echo "$user 创建完成"
done
EOF
bash /tmp/hw/day17/dryrun.sh
cat /tmp/hw/day17/user_pass_dryrun.txt
```

输出：

```console
$ bash /tmp/hw/day17/dryrun.sh
[DRYRUN] useradd user01
[DRYRUN] echo user01:TE0AobCL | chpasswd
user01 创建完成
[DRYRUN] useradd user02
[DRYRUN] echo user02:ArFbqdX7 | chpasswd
user02 创建完成
[DRYRUN] useradd user03
[DRYRUN] echo user03:ME1dg7L1 | chpasswd
user03 创建完成
[DRYRUN] useradd user04
[DRYRUN] echo user04:I3vac20S | chpasswd
user04 创建完成
[DRYRUN] useradd user05
[DRYRUN] echo user05:ikwNzcmq | chpasswd
user05 创建完成
[DRYRUN] useradd user06
[DRYRUN] echo user06:FiD4JNCY | chpasswd
user06 创建完成
[DRYRUN] useradd user07
[DRYRUN] echo user07:sOsCKeED | chpasswd
user07 创建完成
[DRYRUN] useradd user08
[DRYRUN] echo user08:Pl3uEiKD | chpasswd
user08 创建完成
[DRYRUN] useradd user09
[DRYRUN] echo user09:flrS3Jql | chpasswd
user09 创建完成
[DRYRUN] useradd user10
[DRYRUN] echo user10:sQTmPTMZ | chpasswd
user10 创建完成

$ cat /tmp/hw/day17/user_pass_dryrun.txt
user01:TE0AobCL
user02:ArFbqdX7
user03:ME1dg7L1
user04:I3vac20S
user05:ikwNzcmq
user06:FiD4JNCY
user07:sOsCKeED
user08:Pl3uEiKD
user09:flrS3Jql
user10:sQTmPTMZ
```

用户名 01..10 补零正确、密码两两不同、密码文件格式就是 `chpasswd` 的输入格式——把 `[DRYRUN]` 两行换成真命令即可在 CentOS 7 上落地。

> **说明**：本环境 `command -v useradd` 与 `command -v chpasswd` 均返回 NOT FOUND，`id user01` 报 `id: 'user01': no such user`，`/etc/passwd` 不可读，因此建号部分无法真跑，按规范列为 B 级。
{: .sec-note}

### 验证方法（真机执行后） {: .sec-ver}

```bash
id user01                       # 看单个用户是否建成
id user01 user05 user10         # 一次核对多个
tail -10 /etc/passwd            # 看是否新增 10 条 user 开头的记录
grep -c "^user" /etc/passwd     # 数一下新增用户数量
wc -l < /tmp/hw/day17/user_pass.txt   # 密码清单行数应为 10
su - user01                     # 用清单里的密码实际登录验证一次
```

（预期输出，CentOS 7）

```console
$ id user01
uid=1001(user01) gid=1001(user01) groups=1001(user01)

$ id user01 user05 user10
uid=1001(user01) gid=1001(user01) groups=1001(user01)
uid=1005(user05) gid=1005(user05) groups=1005(user05)
uid=1010(user10) gid=1010(user10) groups=1010(user10)

$ tail -10 /etc/passwd
user01:x:1001:1001::/home/user01:/bin/bash
user02:x:1002:1002::/home/user02:/bin/bash
user03:x:1003:1003::/home/user03:/bin/bash
user04:x:1004:1004::/home/user04:/bin/bash
user05:x:1005:1005::/home/user05:/bin/bash
user06:x:1006:1006::/home/user06:/bin/bash
user07:x:1007:1007::/home/user07:/bin/bash
user08:x:1008:1008::/home/user08:/bin/bash
user09:x:1009:1009::/home/user09:/bin/bash
user10:x:1010:1010::/home/user10:/bin/bash

$ grep -c "^user" /etc/passwd
10

$ wc -l < /tmp/hw/day17/user_pass.txt
10
```

三项都对得上（单个 `id` 有输出、/etc/passwd 新增 10 行、密码清单 10 行），才算真正做完。

### 补充：一行式写法与非交互式设密码的三种方式 {: .sec-ext}

```bash
# 一行式：seq 拼出命令交给 bash 执行（简单场景应急用）
seq -w 10 | sed 's/^/useradd user/' | bash

# 非交互式设密码三种方式（CentOS 7）
echo "<your-password>" | passwd --stdin user01      # RHEL/CentOS 专有，最直观
echo "user01:<your-password>" | chpasswd            # 跨平台通用，推荐
usermod -p "$(openssl passwd -1 <your-password>)" user01   # 直接写密文，适合脚本预生成
```

（预期输出，CentOS 7）

```console
$ echo "<your-password>" | passwd --stdin user01
Changing password for user user01.
passwd: all authentication tokens updated successfully.
```

> **易错点**：
>
> - 建用户必须以 root 执行，普通用户跑 `useradd` 会报 `Permission denied`；
> - `passwd --stdin` 是 RHEL/CentOS 系专有，Debian/Ubuntu 上不存在，跨平台脚本一律用 `chpasswd`；
> - `for i in {01..$N}` 里的大括号展开不支持变量，范围要动态就用 `$(seq -w 1 $N)`；
> - 密码记录文件含明文口令（本文统一用 `<your-password>` 占位），必须 `chmod 600` 且交付后立即删除，绝不入库、不贴群；
> - `tr -dc ... < /dev/urandom | head -c 8` 在某些系统上 `head` 提前退出会让 `tr` 收到 SIGPIPE，属正常现象（错误信息 `tr: write error: Broken pipe` 可忽略）；日常用 `/dev/urandom`，别用会阻塞的 `/dev/random`；
> - 脚本重复执行时 `useradd` 会报「用户已存在」而中断，加 `id "$user" &>/dev/null && continue` 做幂等保护。

> **参见**：用户管理、sed 命令详解、awk 命令详解

## 本篇小结 {: .sec-sum}

1. 排除过滤三选一：`grep -v "pat"`（反向选择查看）、`sed '/pat/d'`（删除行，配合 `-i` 可原地改）、`awk '!/pat/'`（取反条件，还能顺带取列与计算）；对同一输入三者输出逐字一致，可用 `diff <(A) <(B)` 验证。
2. 排除多个模式时写法不同：grep 用 `-vE 'A|B'` 对整条正则取反，sed 用多个 `-e '/A/d'`，awk 用 `!/A/ && !/B/`——awk 的「且」语义最不容易踩坑。
3. 能力边界决定选型：要带行号看结果用 `grep -vn`；要按行号删（`sed '2,4d'`、`sed '$d'`）或原地改文件只能用 sed；要按列判断（`$3!="stopped"`）或过滤后重排输出，只能用 awk。
4. 随机信息有四条路子：`tr -dc 'a-zA-Z0-9' </dev/urandom | head -c N`（字符集可控，最常用）、`echo $RANDOM | md5sum | cut -c 1-N`（零依赖）、`openssl rand -base64 N`（最短，注意 base64 会产出 `+/=`）、`mkpasswd`（需装 expect，可指定复杂度）。本环境 mkpasswd 是 Cygwin 同名不同义命令，切勿混淆。
5. 变量与循环三要点：`=` 两边无空格、`$(命令)` 做命令替换赋值、单引号不解析变量（awk 程序体必须用单引号）；for 循环四种写法中 `{01..10}` 最直观地补零，但范围含变量时必须换成 `$(seq -w 1 $N)`。
6. 批量建号脚本 = 三要素合体：`for n in $(seq -w 1 10); do user="user$n"; pass=$(...); echo "$user:$pass" | chpasswd; done`，跑完用 `id user01`、`tail -10 /etc/passwd`、`wc -l < 密码清单` 三关验证；密码清单 `chmod 600` 且用完即删，这一步省不得。


{% endraw %}
