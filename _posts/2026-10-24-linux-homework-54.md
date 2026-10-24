---
title: "日测 day4 系统管理命令 测验精讲 + 实操验证"
date: 2026-10-24 09:04:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
## 本篇说明

- **覆盖章节**：day4 运维基础章节——系统管理命令，从目录/文件的查看、创建、切换，一路到编辑写入、复制备份、目录整体复制、删除、用备份还原，最后收在关机重启类命令上。
- **题目来源**：day4 基础命令测验（共 10 题，含官方答案）。
- **实操分级**：
  - **A 级（已实操）**：`ls` / `mkdir` / `cd` / `pwd` / `touch` / `echo` 重定向 / `cp` / `mv` / `rm` 等 shell 核心命令，已在 Git Bash 中真实执行，输出为真实结果，文中标注 `已实操`。
  - **B 级（预期输出）**：`shutdown` / `reboot` 等系统级命令，本机无法安全执行，给出标准命令与 CentOS 7 预期输出。
- **路径脱敏约定**：原文中的业务目录统一改写为通用路径 `/data/app01`，文件 `app.txt` 改写为 `app.txt`，备份目录 `/tmp/app-bak` 改写为 `/tmp/app-bak`，机构域名改写为 `example.com`，主机名统一用 `linux-node01`。
- **沙箱约定**：为避免污染真机根目录，A 级实操统一在 `/tmp/hw/day4` 沙箱内完成，用相对路径演示。沙箱中的 `data/app01` 即对应真机 `/data/app01`，命令形态与真机完全一致（真机把相对路径换成绝对路径即可）。
- 真实输出中的属主/属组字段按脱敏规范统一显示为 `user`。

## 实操环境对照

| 级别 | 代表命令 | 执行方式 | 本文标注 |
| --- | --- | --- | --- |
| A 级 | ls、mkdir、cd、pwd、touch、echo、cp、mv、rm | Git Bash 真实执行，输出照抄 | 已实操 |
| B 级 | shutdown、reboot、halt、poweroff | CentOS 7 真机执行 | 预期输出 |

---

## 测验题目精讲

### 题 1：检查是否存在 /data/app01 目录？

> **答案：** `ls -d /data/app01`；更严谨的写法是 `[ -d /data/app01 ] && echo 存在 || echo 不存在`。目录不存在时提示 `No such file or directory`，退出码非 0。

**解析**：考点是"如何查看文件或目录是否存在"。这题就是在考 `-d` 的意义：`ls 目录` 列的是**内容**，`ls -d 目录` 只显示目录**本身**——不加 `-d`，目录存在时会被一堆内容刷屏。命令的退出码（`$?`）是脚本里判断存在性的依据：0 表示成功/存在，非 0 表示失败/不存在。

**实操验证**（已实操）：

```bash
cd /tmp/hw/day4

# 判断目录是否存在：ls -d 只看目录本身
ls -d data/app01
echo "退出码: $?"

# 对比：ls 一个不存在的目录
ls data
echo "退出码: $?"

# 脚本里更常用的判断方式
test -d data/app01 && echo "目录存在" || echo "目录不存在"
```

输出：

```console
ls: cannot access 'data/app01': No such file or directory
退出码: 2
ls: cannot access 'data': No such file or directory
退出码: 2
目录不存在
```

**验证方法**：看到 `No such file or directory` 且 `echo $?` 输出非 0（此处为 2），即证明目录不存在；若目录存在，`ls -d` 会原样打印目录名且退出码为 0。

> **易错点**：用 `ls /data/app01` 判断存在性时，目录存在会列出内容而不是只回显目录名，容易误判；目录**不存在**时两者报错一致，无法区分"目录不存在"和"目录存在但为空"。判断存在性优先用 `ls -d` 或 `[ -d ]`。
>
> **参见**：常用文件操作命令

---

### 题 2：若目录不存在，需要创建 /data/app01 目录？

> **答案：** `mkdir -p /data/app01`。`-p` 可以递归创建多级目录，并且目录已存在时**不报错**（幂等）。

**解析**：`mkdir` = make directory，默认只能创建**一级**目录，`mkdir /data/app01` 在 `/data` 不存在时会报 `No such file or directory`；加上 `-p`（parents）会连同父目录一起创建。生产环境写脚本时一律建议带 `-p`，因为重复执行不会中断脚本。

**实操验证**（已实操）：

```bash
cd /tmp/hw/day4

# 先创建一级父目录
mkdir data
ls -d data

# 再创建子目录（多级一步到位用 -p）
mkdir -p data/app01
ls -d data/app01

# 查看属性确认类型（d 开头为目录）
ls -ld data data/app01
```

输出：

```console
data
data/app01
drwxr-xr-x 1 user user 0 Oct 24 05:28 data
drwxr-xr-x 1 user user 0 Oct 24 05:28 data/app01
```

**验证方法**：`ls -d` 能打印出目录名，且 `ls -ld` 首列以 `d` 开头，说明创建成功且类型是目录。

> **易错点**：不加 `-p` 创建多级目录会失败（`mkdir: cannot create directory 'data/app01': No such file or directory`）；加了 `-p` 但路径写错，会静默创建出一堆空目录，事后很难发现。创建前先 `ls -d` 确认、创建后立刻 `ls -ld` 复核是好习惯。

---

### 题 3：切换到 /data/app01 目录中，并检查当前所在路径？

> **答案：** `cd /data/app01` 切换目录，`pwd` 查看当前所在绝对路径。

**解析**：`cd` = change directory，`pwd` = print working directory，输出的是**绝对路径**。相对路径与绝对路径都能用于 `cd`；运维排障时第一步通常就是 `pwd`，确认自己"站在哪里"，避免误操作到别的目录。`cd -` 可以回到上一次所在目录，`cd ..` 回到上级目录。

**实操验证**（已实操）：

```bash
# 切换到目标目录（此处用沙箱相对路径，真机用 cd /data/app01）
cd data/app01

# 确认当前所在路径
pwd
```

输出：

```console
/tmp/hw/day4/data/app01
```

**验证方法**：`pwd` 输出的路径末段必须是 `data/app01`，说明确实进入了目标目录而不是同名目录。

> **易错点**：`cd` 后不 `pwd` 确认就执行 `rm -rf` 是最危险的习惯。另外 `pwd` 在遇到软链接目录时显示的是链接路径，要看物理路径需 `pwd -P`。

---

### 题 4：在当前目录创建一个新的 app.txt 空文件，并检查确认？

> **答案：** `touch app.txt`（相对路径）或 `touch /data/app01/app.txt`（绝对路径）。

**解析**：`touch` 的本意是"摸一下"文件——文件不存在时创建**空文件**，文件已存在时只更新其时间戳（atime/mtime），**不会清空原有内容**。这是它与 `>` 重定向最大的区别。为什么不清空？touch 的设计目标就是更新时间戳，压根不往文件里写数据，自然碰不到内容。

**实操验证**（已实操）：

```bash
cd /tmp/hw/day4/data/app01

# 创建空文件
touch app.txt

# 单个文件确认
ls -l app.txt

# 整个目录确认
ls -l
```

输出：

```console
-rw-r--r-- 1 user user 0 Oct 24 05:28 app.txt
total 0
-rw-r--r-- 1 user user 0 Oct 24 05:28 app.txt
```

**验证方法**：`ls -l` 第 5 列（文件大小）为 `0`，且首列是 `-`（普通文件），即空文件创建成功。

> **易错点**：以为 `touch` 会清空文件内容——不会，重复 `touch` 只改时间戳。真正清空文件要用 `> app.txt` 或 `: > app.txt`。另外 `touch` 与 `mkdir` 不要混用：建文件用 `touch`，建目录用 `mkdir`。

---

### 题 5：在 app.txt 文件中生成 `www.example.com-linux` 信息，用两种方法？

> **答案：**
> - 方法 a（打开文件编辑）：`vi app.txt` → 按 `i` 进入编辑模式 → 写入内容 → `Esc` → `:wq` 保存退出。
> - 方法 b（不打开文件）：`echo "www.example.com-linux" > app.txt`（覆盖）或 `>>`（追加）。

**解析**：考点是"生成文件内容的两种途径"以及 `>` 与 `>>` 的区别。
- `>` 是**覆盖重定向**：先清空文件再写入。
- `>>` 是**追加重定向**：在文件末尾追加，保留原有内容。
vim 三步曲是运维基本功：`vi 文件` → `i` → 编辑 → `Esc` → `:wq`（保存退出）/ `:q!`（强制不保存退出）。

**实操验证**（已实操，方法 b；方法 a 见下方 vim 步骤）：

```bash
cd /tmp/hw/day4/data/app01

# 方法 b-1：覆盖写入（>）
echo "www.example.com-linux" > app.txt
cat app.txt

# 方法 b-2：追加写入（>>），原内容保留，变成两行
echo "www.example.com-linux" >> app.txt
cat app.txt

# 再用覆盖写回单行，保证后续题目内容一致
echo "www.example.com-linux" > app.txt
cat app.txt
```

输出：

```console
www.example.com-linux
www.example.com-linux
www.example.com-linux
www.example.com-linux
```

（第 1 行是覆盖写后的内容；第 2、3 行是追加后的两行内容；第 4 行是恢复为单行后的内容。）

方法 a 的 vim 操作步骤（B 级，需交互终端）：

```bash
vi app.txt
```

```text
进入后的按键序列：
i                          # 进入编辑模式
www.example.com-linux      # 输入内容
<Esc>                      # 退回命令模式
:wq                        # 保存并退出
```

**验证方法**：`cat app.txt` 能看到目标内容即成功；用 `cat -A app.txt` 可额外确认行尾没有多余字符（正常输出应为 `www.example.com-linux$`，`$` 代表换行符）。

> **易错点**：把 `>` 写成 `>>` 导致内容被重复追加（脚本里尤其致命）；反之需要追加时用了 `>` 会清空历史数据。vim 里忘了 `Esc` 就输入 `:wq`，会变成把 `:wq` 当作文本写进文件。
>
> **参见**：文档编辑软件使用技巧

---

### 题 6：把编辑好的文件复制保存到 /tmp 目录下的 app-bak 目录中？

> **答案：** 先 `ls -d /tmp/app-bak` 检查备份目录是否存在，不存在则 `mkdir -p /tmp/app-bak`，再 `cp app.txt /tmp/app-bak/`。

**解析**：`cp` 的行为取决于**目标是否存在**：
1. 目标是**已存在的目录** → 把文件保存到该目录内（文件名不变）。
2. 目标**不存在** → 把源文件复制一份并**重命名**为目标名。
所以复制前必须先确认目标目录存在，否则会得到一个名字奇怪的文件而不是目录里的副本。写备份目录时结尾加 `/` 可以明确表达"这是目录"，目标不存在时会直接报错而不是悄悄改名。

**实操验证**（已实操）：

```bash
cd /tmp/hw/day4/data/app01

# 步骤 1：检查备份目录是否存在
ls -d /tmp/hw/day4/app-bak
echo "退出码: $?"

# 步骤 2：不存在则创建（创建目录一律加 -p）
mkdir -p /tmp/hw/day4/app-bak
ls -d /tmp/hw/day4/app-bak

# 步骤 3：复制文件到备份目录
cp app.txt /tmp/hw/day4/app-bak/

# 步骤 4：确认结果
ls -l /tmp/hw/day4/app-bak/
```

输出：

```console
ls: cannot access '/tmp/hw/day4/app-bak': No such file or directory
退出码: 2
/tmp/hw/day4/app-bak
total 1
-rw-r--r-- 1 user user 22 Oct 24 05:28 app.txt
```

**验证方法**：`ls -l /tmp/hw/day4/app-bak/` 能看到 `app.txt` 且大小与源文件一致（22 字节），说明复制成功；再用 `diff app.txt /tmp/hw/day4/app-bak/app.txt` 无输出即内容完全一致。

> **易错点**：忘记先建目录，导致 `cp` 把文件"复制并改名"成了 `/tmp/app-bak` 这个文件；或漏写目标结尾的 `/`，一旦目录不存在就会静默改名。备份目录建议统一用 `mkdir -p` 兜底。
>
> **变式追问**：`cp` 复制出的文件保留源文件的时间戳吗？（不保留，默认是复制时刻；要连属性一起保留得用 `cp -a` 或 `cp -p`。）

---

### 题 7：把编辑好的 app01 目录整体保存到 /tmp 目录中？

> **答案：** `cp -r /data/app01 /tmp/`。复制目录必须加 `-r`（递归）。目标已存在同名文件时，默认会逐个询问是否覆盖，回答 `y` 确认。

**解析**：`cp` 默认只复制文件，遇到目录会报 `omitting directory`；`-r`（recursive）才会连目录内的内容一起复制。`-a` = `-dpr` 的合集，能保留属性、保留链接，做备份时比 `-r` 更推荐。root 用户的 `cp` 通常被别名成 `cp -i`，因此覆盖前会询问。

**实操验证**（已实操）：

```bash
cd /tmp/hw/day4

# 步骤 1：递归复制整个目录
cp -r data/app01 /tmp/hw/day4/
ls -l /tmp/hw/day4/app01

# 步骤 2：再次复制，复现"覆盖询问"场景（用 -i 显式触发）
cp -ri data/app01 /tmp/hw/day4/
ls -l /tmp/hw/day4/app01

# 步骤 3：确认目录与内容
ls -ld /tmp/hw/day4/app01
ls /tmp/hw/day4/app01
```

输出：

```console
total 1
-rw-r--r-- 1 user user 22 Oct 24 05:28 app.txt
cp: overwrite '/tmp/hw/day4/app01/app.txt'? total 1
-rw-r--r-- 1 user user 22 Oct 24 05:28 app.txt
drwxr-xr-x 1 user user 0 Oct 24 05:28 /tmp/hw/day4/app01
app.txt
```

（`cp: overwrite ...?` 是覆盖询问提示，输入 `y` 回车即覆盖；批量复制时可加 `\cp` 或 `/bin/cp` 跳过别名以避免交互卡住脚本。）

**验证方法**：`ls -ld /tmp/app01` 显示是目录，且 `ls /tmp/app01` 里面有 `app.txt`，说明目录整体复制成功；对比 `ls -l` 的文件大小与源文件一致。

> **易错点**：复制目录漏 `-r`，报 `cp: omitting directory 'data/app01'`；脚本里被 `-i` 别名卡住等待输入。另外 `cp -r /data/app01 /tmp/` 与 `cp -r /data/app01/ /tmp/` 在部分场景下行为不同，统一写成不带尾部斜杠最稳妥。
>
> **参见**：常用文件操作命令

---

### 题 8：把原文件 app.txt 和 app01 目录一并删除，并检查确认？

> **答案：** `rm -rf /data/app01`（`-r` 递归删除目录，`-f` 强制不询问）；确认用 `ls -d /data/app01`。

**解析**：`rm` = remove。删文件直接 `rm 文件`；删目录必须 `-r`；`-f`（force）跳过逐个确认提示。`rm -rf` 是最危险的组合之一，因为它不进回收站、不询问、不可恢复，所以删除前必须`ls -d` 复核路径，删除后必须 `ls -d` 确认结果。

**实操验证**（已实操）：

```bash
cd /tmp/hw/day4

# 步骤 1：删除目录（含内部文件）
rm -rf /tmp/hw/day4/data/app01

# 步骤 2：检查确认（应报错，退出码非 0）
ls -d /tmp/hw/day4/data/app01
echo "退出码: $?"

# 步骤 3：确认父目录已空
ls -l /tmp/hw/day4/data
```

输出：

```console
ls: cannot access '/tmp/hw/day4/data/app01': No such file or directory
退出码: 2
total 0
```

**验证方法**：再次 `ls -d` 报 `No such file or directory` 且退出码为 2，父目录 `ls -l` 的 total 为 0，说明删除干净。

> **易错点**：`rm -rf /data/app01 /` 这种手滑多打一个空格会造成灾难性后果；变量未赋值时 `rm -rf $DIR/*` 会变成 `rm -rf /*`。铁律：删除前 `pwd` + `ls -d` 双重复核，生产环境尽量用 `mv` 到回收目录代替直接 `rm`。变量为空之所以这么危险，是因为 shell 先做变量展开再做单词拆分，`$DIR` 展开成空串后 `$DIR/*` 就只剩 `/*`——所以脚本里引用变量要加双引号 `"$DIR"/*`，并在删除前先判空。

---

### 题 9：删除后利用 /tmp 中的备份还原，并使 /tmp 中不再保存原文件？

> **答案：** `mv /tmp/app01 /data/`。用 `mv`（移动）而不是 `cp`，移动后 `/tmp` 里自然就不再有该文件。

**解析**：`mv` = move，既用于**移动**也用于**重命名**。题目要求"还原且 /tmp 中不再保存"，说白了只能用 `mv`——用 `cp` 还原还得再删一次 /tmp 的副本。同一分区内 `mv` 只修改目录项，不搬数据，速度极快；跨分区 `mv` 则等价于"复制 + 删除"。

**实操验证**（已实操）：

```bash
cd /tmp/hw/day4

# 步骤 1：确认备份还在
ls -d /tmp/hw/day4/app01

# 步骤 2：移动回原位（/tmp 中的副本随之消失）
mv /tmp/hw/day4/app01 /tmp/hw/day4/data/

# 步骤 3：确认已还原
ls -d /tmp/hw/day4/data/app01/
ls /tmp/hw/day4/data/app01/

# 步骤 4：确认 /tmp 下已无残留，且文件级备份仍在
ls -R /tmp/hw/day4/data
ls -l /tmp/hw/day4/app-bak
```

输出：

```console
/tmp/hw/day4/app01
/tmp/hw/day4/data/app01/
app.txt
/tmp/hw/day4/data:
app01

/tmp/hw/day4/data/app01:
app.txt
total 1
-rw-r--r-- 1 user user 22 Oct 24 05:28 app.txt
```

**验证方法**：`ls -d /data/app01/` 成功打印且里面能看到 `app.txt`；同时 `ls -d /tmp/app01` 应报不存在（因为已被 `mv` 走）。

> **易错点**：`mv /tmp/app01 /data/` 中 `/data/` 结尾的斜杠不能少——若 `/data` 不存在，会被当成"重命名成 /data 文件"。另外 `mv` 覆盖同名目录时默认不询问（root 下 `mv` 别名是 `mv -i` 会询问），还原前先 `ls` 目标目录确认没有同名文件被覆盖。

---

### 题 10：所有操作结束后，设置 5 分钟之后关闭服务器操作系统？

> **答案：** `shutdown -h 5`（5 分钟后关机）；5 分钟后重启是 `shutdown -r 5`；取消计划用 `shutdown -c`。

**解析**：`shutdown` 是与系统运行相关的命令，常用组合：

| 命令 | 含义 |
| --- | --- |
| `shutdown -h 5` | 5 分钟后关机（halt/power-off） |
| `shutdown -r 5` | 5 分钟后重启 |
| `shutdown -h now` | 立即关机 |
| `shutdown -r +10` | 10 分钟后重启 |
| `shutdown -h 20:30` | 指定时间点关机 |
| `shutdown -c` | 取消已设定的关机计划 |

**实操验证**（B 级，预期输出）：本机 Git Bash 环境中 `shutdown` 解析到的是 Windows 的 `shutdown.exe`，参数与 Linux 完全不同，**不能用于验证**，误执行会关机，请务必在 CentOS 7 真机/虚拟机上演练。

```bash
# 设定 5 分钟后关机
shutdown -h 5

# 反悔时取消
shutdown -c
```

（预期输出，CentOS 7）

```console
[root@linux-node01 ~]# shutdown -h 5
Shutdown scheduled for Sat 2026-10-24 05:34:17 CST, use 'shutdown -c' to cancel.
[root@linux-node01 ~]#
Broadcast message from root@linux-node01 (Sat 2026-10-24 05:29:16 CST):

        The system is going down for power-off at Sat 2026-10-24 05:34:17 CST!
```

对应的时间点可以这样提前算出来（已实操，安全命令）：

```bash
echo "当前时间: $(date '+%F %T')"
echo "5分钟后: $(date -d '+5 minutes' '+%F %T')"
```

输出：

```console
当前时间: 2026-10-24 05:29:16
5分钟后: 2026-10-24 05:34:17
```

**验证方法**：执行 `shutdown -h 5` 后系统会广播一条 `The system is going down for power-off at ...` 的提示，时间点应为当前时间 +5 分钟；再执行 `shutdown -c` 应看到 `Shutdown cancelled`，即计划已取消。远程维护时一定要先 `shutdown -c` 确认环境安全。

> **易错点**：`-h`（halt，关机）与 `-r`（reboot，重启）记混；远程连接时执行立即关机把自己踢下线；忘记用 `shutdown -c` 取消导致业务中断。生产环境关机前必须 `who` 确认是否有其他用户在线。
>
> 生产注意点：真要关机，用 `shutdown -h +5 "系统维护"` 带上附言，广播会一起发出去，给在线用户留出保存工作的时间。

---

## 本篇小结

10 道题连着做下来，核心就一句话：每步操作都要"先确认、后执行、再复核"。拆开看：

1. 判断存在性用 `ls -d` 或 `[ -d ]`，判断"内容"用 `ls`；退出码 `$?` 是脚本判断的依据。
2. `mkdir -p` 递归且幂等，创建目录统一加 `-p`；创建后立刻 `ls -ld` 复核。
3. `touch` 建空文件或更新时间戳，**不清空内容**；清空用 `> 文件`。
4. `>` 覆盖、`>>` 追加，一字之差决定历史数据是否丢失；vim 三步曲是 `i` → 编辑 → `Esc` → `:wq`。
5. `cp` 复制文件、`cp -r` 复制目录；目标目录必须先存在，否则会变成"复制并改名"；`mv` 移动兼重命名，同分区移动不搬数据。
6. `rm -rf` 不可恢复，删除前 `pwd` + `ls -d` 双重复核，删除后再 `ls -d` 验证；能用 `mv` 归档就不要直接删。
7. `shutdown -h/-r` 设定关机重启计划，务必记住 `shutdown -c` 是后悔药。
{% endraw %}
