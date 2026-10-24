---
title: "day12 作业实操：tail 追踪与 tr 替换原理"
date: 2026-10-24 09:12:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 12 天（基础知识回顾）的作业就两道：tail 参数 `-f` 与 `-F` 的区别、tr 替换信息的原理。两道都完整真跑——tail 用后台追加、mv、rm 三种场景对比两个参数的实际行为；tr 真跑复现"替换乱了"的错乱，逐字符拆原理，再给 tr 的四种正确用法。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw` 下的子目录。本文全部命令均为 A 级真跑（Git Bash 中 GNU coreutils 的 tail 与 tr，与 CentOS 7 行为一致）；输出中的用户名等已按脱敏要求处理。为让 `--follow=name` 的检测机制触发，实验脚本中每一步之间留足等待时间，读者可原样复现。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | tail 命令参数 `-f` 或 `-F` 的区别 | A 级（后台追加 + mv + rm 真跑对比） |
| 题 2 | tr 命令替换信息的原理（为什么替换乱了） | A 级（错乱现象真跑复现 + 逐字符分析） |

## 题 1：tail 命令参数 -f 或者 -F

**考察点**：`tail -f` 与 `tail -F` 跟的对象不一样——前者跟文件描述符（inode），后者跟文件名；日志切割（mv + 重建）场景两者行为差在哪，生产上追日志选哪个。

**实现思路**：先讲原理差异，再在 `/tmp/hw/day12` 造出"日志持续追加 → 被 mv 走 → 同名新文件出现"的完整场景，`-f` 和 `-F` 各跑一遍，对比捕获行数与 stderr 提示，最后补 rm 场景。

### 原理讲解：跟描述符还是跟名字

| 参数 | 等价写法 | 跟随对象 | 文件被 mv/rm 后 |
| --- | --- | --- | --- |
| `tail -f` | `--follow=descriptor --retry` | 打开文件时获得的**文件描述符**（对应 inode） | 继续跟随原 inode：追加到"被移走的旧文件"的内容仍会显示；同名新文件的内容看不到，**需要重新追踪** |
| `tail -F` | `--follow=name --retry` | **文件名** | 发现原文件不可访问后按名字重试，新文件一旦出现就自动跟随，**不需要重新追踪** |

这正是作业原文的结论：`tail -f` 追踪时文件被删除或移动走，需要重新追踪；`tail -F` 不需要重新追踪，文件恢复回来会继续追踪。日志文件数据会不断增加，历史悠久的日志还会被清空（切割/轮转），所以生产环境追日志推荐 `tail -F 日志文件`。

补充一个容易被忽略的机制：`--follow=name` 靠 `--max-unchanged-stats`（默认 5）检测文件被替换——只有当被追踪的文件**连续 5 个轮次大小都没有变化**时，tail 才会重新按名字打开文件（配合 `--sleep-interval` 默认 1 秒，即旧文件停止增长约 5~6 秒后才切换到新文件）。所以 `-F` 的切换有秒级延迟，这不是 bug。

往底层再挖一层：GNU tail 的 `-f` 与 `-F` 底层都用 inotify，不是死循环轮询。`-f` 对打开的文件描述符注册 watch，文件有写入内核主动通知，几乎实时；`-F` 除了盯文件本身，还要 watch 所在**目录**，等"按这个名字的新文件出现"的事件。目录 watch 的通知不区分新建还是重命名，tail 还得结合文件大小变化确认——这就是 `--max-unchanged-stats=5` 这套保守策略的由来：宁可晚几秒切换，也不能跟错文件。

### 步骤 1：构造演示环境（已实操）

```bash
mkdir -p /tmp/hw/day12
cd /tmp/hw/day12
rm -f *.log *.out *.err *.pid
printf 'line1\nline2\n' > d.log
ls -l d.log
```

输出：

```console
$ ls -l d.log
-rw-r--r-- 1 user 197609 12 Oct 24 03:39 d.log
```

### 步骤 2：tail -f + mv 场景（已实操）

模拟日志切割：文件被 mv 走后，旧文件仍有最后一次追加（切割瞬间的抖动），随后服务创建同名新文件并继续写入。

```bash
( tail -f d.log > d.out 2> d.err & echo $! > d.pid )
sleep 2
echo line3 >> d.log        # 正常追加
sleep 2
mv d.log d.log.1           # 日志切割：旧文件被移走
sleep 2
echo line4 >> d.log.1      # 旧文件（已被移走）仍有写入
sleep 2
printf 'line5\n' > d.log   # 服务重新创建同名日志文件
echo line6 >> d.log        # 新文件继续写入
sleep 9                    # 等待足够久，排除"还没反应过来"的可能
kill $(cat d.pid) 2>/dev/null
```

输出：

```console
$ cat d.out
line1
line2
line3
line4

$ cat d.err
（空，无任何提示）
```

等了 9 秒，`line5`、`line6` 依然没有出现——`-f` 跟的是描述符，新文件与它无关，想继续追踪必须重新执行 `tail -f d.log`。

### 步骤 3：tail -F + mv 场景（已实操）

同样的流程换成 `-F`：

```bash
printf 'line1\nline2\n' > c.log
( tail -F c.log > c.out 2> c.err & echo $! > c.pid )
sleep 2
echo line3 >> c.log
sleep 2
mv c.log c.log.1
sleep 2
echo line4 >> c.log.1
sleep 2
printf 'line5\n' > c.log
echo line6 >> c.log
sleep 9
kill $(cat c.pid) 2>/dev/null
```

输出：

```console
$ cat c.out
line1
line2
line3
line4
line5
line6

$ cat c.err
tail: 'c.log' has been replaced;  following new file
```

`line5`、`line6` 被自动捕获，stderr 明确提示 `has been replaced; following new file`——`-F` 检测到文件被替换后跟随了新文件，无需人工干预。

### 步骤 4：tail -F + rm 场景（已实操）

作业原文说的是"文件被删除或移动走，只要文件恢复回来会继续追踪"，再验证 rm 场景：

```bash
printf 'line1\nline2\n' > e.log
( tail -F e.log > e.out 2> e.err & echo $! > e.pid )
sleep 2
echo line3 >> e.log
sleep 2
rm e.log                   # 文件被删除
sleep 2
printf 'line5\n' > e.log   # 文件恢复（重建）
echo line6 >> e.log
sleep 9
kill $(cat e.pid) 2>/dev/null
```

输出：

```console
$ cat e.out
line1
line2
line3
line5
line6

$ cat e.err
tail: 'e.log' has been replaced;  following new file
```

文件被删除后重建，`-F` 自动跟随恢复后的新文件，`line5`、`line6` 全部捕获。

### 步骤 5：tail -f + rm 对照（已实操）

```bash
printf 'line1\nline2\n' > a.log
( tail -f a.log > a.out 2> a.err & echo $! > a.pid )
sleep 1
echo line3 >> a.log
sleep 1
rm a.log
sleep 1
printf 'line5\n' > a.log
echo line6 >> a.log
sleep 1
kill $(cat a.pid) 2>/dev/null
```

输出：

```console
$ cat a.out
line1
line2
line3

$ cat a.err
（空，无任何提示）
```

`-f` 既没提示也没跟随新文件，需要重新执行命令才能追踪。

### 行为对比结论

| 场景 | `tail -f` | `tail -F` |
| --- | --- | --- |
| 文件被 mv 走，旧文件仍有追加 | 照常显示（跟的是 inode） | 检测窗口内照常显示，切换后不再显示旧文件 |
| 同名新文件出现并写入 | 不显示，需重新执行 `tail -f` | 自动跟随，stderr 提示 `has been replaced; following new file` |
| 文件被 rm 后重建 | 不显示，需重新执行 | 自动跟随重建后的文件 |
| 适用场景 | 临时看一眼文件 | 追日志（日志会切割轮转），生产环境一律用 `-F` |

**验证方法**：按步骤 2 与步骤 3 的脚本各跑一遍，对比 `d.out`（4 行，无 line5/line6）与 `c.out`（6 行，有 line5/line6）以及 `c.err` 中的 `has been replaced` 提示，即可证明两个参数的行为差异；把 `sleep 9` 缩短为 `sleep 1` 重跑 `-F` 还能观察到切换延迟，印证 `--max-unchanged-stats=5` 的检测机制。

> **生产注意**：追日志一律 `tail -F`。排查"日志突然不刷了"时先确认文件有没有被切割（`ls 日志名*`），很多时候不是服务出问题，是 `-f` 跟丢了 inode。

> **易错点**：
>
> - `-F` 切换新文件有约 5~6 秒延迟（旧文件需连续 5 个轮次无增长），不是立即切换，脚本演示时别急着杀进程；
> - `-f` 对"被 mv 走的旧文件"的后续追加仍会显示（`line4`），容易误以为它还在追原文件——其实追的是 inode，文件已经换了；
> - 面试标准答案：追日志用 `tail -F`，因为它按名追踪、能扛住日志轮转；临时看静态文件两者皆可。

> **参见**：tail -f 与 tail -F 的区别

## 题 2：tr 命令替换信息的原理

**考察点**：tr 的两个字符集是**按字符位置一对一映射**，不是按字符串整体替换；SET1 与 SET2 长度不等时的补齐/保留规则；同一字符在 SET1 中重复出现时的覆盖规则。作业原文的现象是"替换结果乱了"，得讲清乱在哪、为什么乱。

**实现思路**：先用最小示例归纳四种映射规则，再真跑复现作业原题的错乱，逐字符画映射表定位根因，最后给 tr 真正好用的四类场景（大小写转换、删除、压缩、补集）。

### 原理讲解：按位映射，不是按词替换

`tr 字符集1 字符集2` 把输入中属于字符集 1 的字符，按**位置一一对应**替换为字符集 2 中同位置的字符：

| 情况 | 示例 | 输出 | 规则 |
| --- | --- | --- | --- |
| SET1 比 SET2 长 | `echo abcd \| tr "abcd" "123"` | `1233` | SET1 多出来的字符，用 SET2 的**最后一个字符**补齐 |
| SET1 比 SET2 短 | `echo abcd \| tr "abc" "1234"` | `123d` | SET2 多出来的字符被忽略，无映射的字符原样保留 |
| 两者等长 | `echo abcd \| tr "abcd" "1234"` | `1234` | 一一对应，最理想的情况 |
| SET1 中有重复字符 | `echo abcba \| tr "abcba" "12345"` | `54345` | 同一字符多次出现时，**以最后一次映射为准** |

`tr` 眼里只有"字符"，没有"单词"。想替换整个单词或字符串，要用 `sed 's/old/new/g'`，这正是 tr 做"整词替换"会翻车的根本原因。

这个设计不是缺陷。tr 处理的是**字节流**，逐字节过一张 256 项的映射表，与上下文无关，所以能处理任意大的文件（内存占用恒定），也能安全用在 `/dev/urandom` 这类没有"词"概念的流上（day13 题 4 会用到）。代价是它天生做不了需要上下文的替换——那是 sed 这类按行正则引擎的活。

### 步骤 1：真跑复现错乱现象（已实操）

作业原文用 `tr "oldgirl" "新词" < test.txt` 做替换，结果文件信息替换乱了。原题中第二个字符集为机构名，按脱敏要求替换为 `newman`，错乱现象与原理完全一致。构造文件并真跑：

```bash
cd /tmp/hw/day12
printf 'oldgirl01\noldgirl02\noldgirl03\n' > test.txt
cat test.txt
tr "oldgirl" "newman" < test.txt
```

输出：

```console
$ cat test.txt
oldgirl01
oldgirl02
oldgirl03

$ tr "oldgirl" "newman" < test.txt
nnwmann01
nnwmann02
nnwmann03
```

结果确实"乱了"：既不是 `oldgirl`，也不是 `newman`。逐字符拆开映射表，根因立刻现形：

| SET1 位置 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SET1 字符 | o | l | d | g | i | r | l |
| SET2 对应 | n | e | w | m | a | n | （超出，取末字符 n） |
| 生效映射 | o→n | l→n | d→w | g→m | i→a | r→n | l→n |

`oldgirl01` 逐字符翻译：`o→n`、`l→n`、`d→w`、`g→m`、`i→a`、`r→n`、`l→n`、`0→0`、`1→1`，得到 `nnwmann01`，与真实输出完全吻合。这里踩了两个坑：

1. SET1 有 7 个字符而 SET2 只有 6 个，第 7 个字符 `l` 被 SET2 的末字符 `n` 补齐；
2. 更关键的是 `l` 在 SET1 的第 2 位和第 7 位**重复出现**，按"以最后一次映射为准"规则，第 2 位的 `l` 也映射为 `n`（而不是 `e`）——所以第 2 个字符输出的是 `n` 而不是 `e`，错乱被进一步放大。

原题输出 `oydboyy01` 形式的错乱同理：SET1 中 `l` 重复 + SET1 更长末位补齐，两个坑叠在一起，输出自然面目全非。

### 步骤 2：四种映射规则真跑验证（已实操）

```bash
echo abcd | tr "abcd" "123"
echo abcd | tr "abc" "1234"
echo abcd | tr "abcd" "1234"
echo abcba | tr "abcba" "12345"
```

输出：

```console
$ echo abcd | tr "abcd" "123"
1233
$ echo abcd | tr "abc" "1234"
123d
$ echo abcd | tr "abcd" "1234"
1234
$ echo abcba | tr "abcba" "12345"
54345
```

四行输出与原理讲解中的表格逐条对应：`1233` 验证末位补齐，`123d` 验证无映射原样保留，`1234` 验证等长一一对应，`54345` 验证重复字符以最后映射为准（`a→5`、`b→4`、`c→3`，`a`、`b` 的旧映射被覆盖）。

### 步骤 3：tr 的正确用法（已实操）

大小写转换是 tr 最典型的正确用法，再加上删除、压缩、补集三类高频场景：

```bash
printf 'Hello Linux\n' | tr "a-z" "A-Z"
printf 'Hello Linux\n' | tr "A-Z" "a-z"
printf 'abc123def456\n' | tr -d "0-9"
printf 'aaaabbbbcccc\n' | tr -s "abc"
printf 'abc123def456\n' | tr -dc "0-9"
```

输出：

```console
$ printf 'Hello Linux\n' | tr "a-z" "A-Z"
HELLO LINUX
$ printf 'Hello Linux\n' | tr "A-Z" "a-z"
hello linux
$ printf 'abc123def456\n' | tr -d "0-9"
abcdef
$ printf 'aaaabbbbcccc\n' | tr -s "abc"
abc
$ printf 'abc123def456\n' | tr -dc "0-9"
123456
```

### tr 常用参数速查表

| 参数 | 作用 | 典型场景 |
| --- | --- | --- |
| `-d` | 删除字符集中指定的字符 | `tr -d "0-9"` 删除所有数字 |
| `-s` | 把连续重复的指定字符压缩成一个 | `tr -s "\n"` 压缩连续空行 |
| `-c` | 取字符集的补集（配合 `-d` 即"只保留"） | `tr -dc "0-9"` 只保留数字 |
| `-t` | 截断 SET1 到 SET2 等长（默认行为，一般省略） | 与 SET2 更短时的默认规则相关 |

tr 没有文件参数，始终从标准输入读、向标准输出写，因此总是以 `tr ... < 文件` 或 `命令 | tr ...` 的形式出现。

### 辨析：tr 与 sed 的适用边界

两者都能改字符，分界线在"有没有上下文"：tr 只看当前字节，干大小写转换、删字符、压缩重复、取补集这类逐字符的活，天然二进制安全；sed 按行读入、支持正则与反向引用，干整词替换、格式改写、按行增删。经验法则：替换不涉及位置和上下文用 tr，涉及就用 sed。硬拿 tr 替换单词（本题的坑），或者拿 sed 去做 `tr -s` 的压缩，都是用错工具。

**验证方法**：

1. 复现步骤 1，确认 `tr "oldgirl" "newman" < test.txt` 输出为 `nnwmann01/02/03`，并与逐步映射表逐字符核对；
2. 复现步骤 2，四条输出分别为 `1233`、`123d`、`1234`、`54345`，与四种规则一一对应；
3. 想验证"以最后一次映射为准"，单独跑 `echo abcba | tr "abcba" "12345"`，第二个字符输出 `4` 而不是 `2`，即证明 `b` 的旧映射被覆盖。

> **易错点**：
>
> - tr 做不了字符串/整词替换（那是 sed 的领域），拿它替换单词必然错乱；
> - `-c` 单独用（不配合 `-d`）是"把补集字符替换成 SET2"，只有 `-dc` 组合才是日常说的"只保留某类字符"；
> - `tr -s` 不指定字符集时压缩的是所有重复字符，指定字符集（如 `-s "abc"`）只压缩集合内的字符；
> - 管道中使用 `head -c` 提前结束读取时，tr 可能收到 SIGPIPE 静默退出，脚本里要注意退出码。

> **参见**：tr 命令的替换原理

## 本篇小结

两道题，各留最要紧的几条：

1. `tail -f` 跟随文件描述符（inode），文件被 mv/rm 后仍追旧 inode，同名新文件看不到，需重新执行命令；`tail -F` 跟随文件名，文件被替换或删除重建后自动跟随新文件，stderr 提示 `has been replaced; following new file`。
2. `-F` 切换新文件有秒级延迟：靠 `--max-unchanged-stats=5`（旧文件连续 5 个轮次无增长）触发，配合默认 `--sleep-interval=1` 约 5~6 秒，演示时别急着杀进程。
3. 生产环境追日志一律用 `tail -F`，日志切割轮转（mv + 重建）不需要人工重新追踪；临时看静态文件 `-f` 即可。
4. tr 的两个字符集是按字符位置一对一映射，不是字符串替换：SET1 更长用 SET2 末字符补齐，SET1 更短则无映射字符原样保留，SET1 中重复字符以最后一次映射为准。
5. "替换乱了"的根因是长度不等的补齐规则与重复字符覆盖规则叠加，想替换单词请用 `sed 's/old/new/g'`。
6. tr 的四类正确用法：`tr "a-z" "A-Z"` 大小写转换、`tr -d` 删除字符、`tr -s` 压缩连续重复字符、`tr -dc` 配合补集实现"只保留"。
{% endraw %}
