---
title: "周测-第04周-测验精讲"
date: 2026-10-24 09:05:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-53"
---

{% raw %}



## 本篇说明
{: .sec-expl}

- **题量**：40 题。每题 3 分、总分 120 分，**及格分 75 分**，约答对 25 题
- **覆盖章节**：文件查找与处理（find/xargs）、文本替换（sed）、打包压缩（tar）、链接文件（软/硬链接）、权限与属性、inode/block、磁盘空间排查、日期处理、正则表达式、用户与别名、开机自启等进阶主题
- **内容形式**：每道题 = 参考答案 + 考点解析 + 实操验证 + 易错点；概念题给答案与解析，命令题给出可复制的实操验证
- **实操分级**
  - A 级（标注 `已实操`）：`find` / `sed` / `tar` / `grep` / `date` / `du` / `alias` / `export` / `chmod` / `stat` 等，已在 Git Bash 真实执行（属主统一显示为 `user`）
  - B 级（标注 `预期输出，CentOS 7`）：`useradd` / `yum provides` / `ln -s`（本沙箱无软链接权限）/ 涉及 POSIX 权限精确匹配等，给出标准命令与 CentOS 7 预期输出
- **脱敏说明**：原题中的机构名、联系方式等敏感信息一律删除，域名统一 `example.com`，示例中的历史业务路径统一改写为 `/data/linux`，主机名统一 `linux-node01`，示例用户名统一 `linuxuser`
- **实操根目录**：A 级示例统一在 `/tmp/hw/quiz/w4` 沙箱内演示

---

## 测验题目精讲
{: .sec-prac}

### 题 01：查找 7 天以前的 log 文件并删除（至少三种方法）

> **答案**：
> - 方法一：`find /data/logs -type f -name '*.log' -mtime +7 -delete`
> - 方法二：`find /data/logs -type f -name '*.log' -mtime +7 -exec rm -f {} \;`
> - 方法三：`find /data/logs -type f -name '*.log' -mtime +7 | xargs rm -f`

**解析**：`-mtime +7` 表示"修改时间距今天数 > 7"，即 7 天以前；`+7` 是严格大于，`7` 是 7–8 天之间，`-7` 是 7 天以内。`-delete` 最直接，`-exec` 逐个执行，`xargs` 批量拼接。为什么大批量时 `xargs` 最快？`-exec ... \;` 每个文件都要 fork 一次进程，一万个小文件就是一万次 fork；`xargs` 会把尽量多的文件拼进一条命令，进程数骤减。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
mkdir -p logs
touch -d '2024-01-01' logs/old1.log logs/old2.log
touch logs/new1.log
echo "--- 查找 7 天前 .log ---"
find logs -type f -name '*.log' -mtime +7
echo "--- 删除(演示用 -print,真实加 -delete) ---"
find logs -type f -name '*.log' -mtime +7 -print
```

```text
--- 查找 7 天前 .log ---
logs/old1.log
logs/old2.log
--- 删除(演示用 -print,真实加 -delete) ---
logs/old1.log
logs/old2.log
```

> **易错点**：`-mtime +7` 与 `-mtime 7` 含义不同，误用会漏删或误删；`xargs rm` 文件名含空格要加 `-print0 | xargs -0`。

---

### 题 02：将 /etc 下大于 100k 的文件移至 /tmp

> **答案**：`find /etc -type f -size +100k -exec mv {} /tmp/ \;`

**解析**：`-size +100k` 表示大小 > 100KB（`k` 小写，`M`/`G` 同理）。`-exec mv {} /tmp/ \;` 把每个匹配文件移走。`{}` 是占位符，`\;` 结束。生产上移系统目录文件要谨慎，建议先 `-print` 确认。

**实操验证**（A 级，已实操，沙箱替代 /etc）：

```bash
cd /tmp/hw/quiz/w4
mkdir -p etcbig mvtarget
head -c 200000 /dev/zero > etcbig/bigfile.bin
head -c 10 /dev/zero > etcbig/small.txt
find etcbig -type f -size +100k -exec mv {} mvtarget/ \;
echo "--- 移动后目标目录 ---"
ls -l mvtarget
```

```text
total 196
-rw-r--r-- 1 user user 200000 Oct 24 07:49 bigfile.bin
```

> **易错点**：`+100k` 的 `k` 必须小写；直接对真机 `/etc` 移动可能造成服务异常，务必先 `-print` 预览。

---

### 题 03：查看 /var/log 目录下的文件数

> **答案**：
> - `ls /var/log | wc -l`（含子目录，只看条目数）
> - `find /var/log -type f | wc -l`（只统计普通文件）
> - `ls -l /var/log | grep '^-' | wc -l`（只数文件）

**解析**：`wc -l` 统计行数即条目数。`ls` 把目录本身也当一个条目，`find -type f` 更精确只数文件。是否含子目录内容，按需选择。

**实操验证**（A 级，已实操，沙箱替代）：

```bash
cd /tmp/hw/quiz/w4
echo "--- 条目数 ---"; ls etcbig | wc -l
echo "--- 普通文件数 ---"; find etcbig -type f | wc -l
```

```text
--- 条目数 ---
1
--- 普通文件数 ---
1
```

> **易错点**：`ls | wc -l` 会把子目录当 1 个，不会展开其内容；要递归统计文件用 `find -type f`。

---

### 题 04：内核引导时读取文件系统信息的文件；普通文件标识

> **答案**：
> - 内核引导从 `/etc/fstab` 读取要加载的文件系统信息
> - 文件属性中，普通文件用 `-`（横杠）标识，目录用 `d`

**解析**：开机时内核 init 进程根据 `/etc/fstab` 挂载文件系统。在 `ls -l` 首字符里，`-` 普通文件、`d` 目录、`l` 软链接、`b/c` 设备、`s` 套接字、`p` 管道。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
ls -ld /etc/fstab /data
head -1 /etc/fstab
```

```text
-rw-r--r-- 1 user user  1 /etc/fstab
drwxr-xr-x 1 user user  /data
```

> **易错点**：把 `/etc/fstab` 与 `/etc/inittab`（运行级别）混淆；首字符 `d` 与 `-` 看错会误判类型。

---

### 题 05：在 /data/linux 下找 mytest 开头、只找一层目录

> **答案**：`find /data/linux -maxdepth 1 -name 'mytest*'`

**解析**：`-maxdepth 1` 限制只在指定目录这一层查找，不递归子目录。不加会一直往里翻，既慢又可能误匹配深层同名文件。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
mkdir -p search/mytest_a search/mytest_b search/sub/mytest_c
touch search/mytest_x.txt
echo "--- find -maxdepth 1 -name 'mytest*' ---"
find search -maxdepth 1 -name 'mytest*'
```

```text
search/mytest_a
search/mytest_b
search/mytest_x.txt
```

> **易错点**：忘加 `-maxdepth 1` 会把 `sub/mytest_c` 也搜出来；`-name` 大小写敏感，忽略大小写用 `-iname`。

---

### 题 06：把 config.txt 中 name 全改为 address（vim 与 sed）

> **答案**：
> - vim：`vim config.txt` → `:%s/name/address/g` → `:wq`
> - sed：`sed -i 's/name/address/g' config.txt`

**解析**：`:%s/old/new/g` 是 vim 全局替换，`g` 表示一行内全部替换。`sed -i` 原地修改（`-i` 后跟备份后缀如 `-i.bak` 可留备份）。`g` 漏写只会替换每行第一个。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
printf 'my name is tom\nname=linuxuser\ncall my name\n' > config.txt
sed -i 's/name/address/g' config.txt
echo "--- 替换后 ---"; cat config.txt
```

```text
my address is tom
address=linuxuser
call my address
```

> **易错点**：`sed -i` 直接改文件无备份，误改难恢复；vim 替换漏 `g` 只改每行的第一个 `name`。

---

### 题 07：打包压缩 /data/linux 到 /tmp/linux.tar.gz 及恢复、查看

> **答案**：
> - 打包压缩：`tar czf /tmp/linux.tar.gz -C /data/linux .`
> - 查看内容：`tar tzf /tmp/linux.tar.gz`
> - 解压恢复：`tar xzf /tmp/linux.tar.gz -C /目标目录`

**解析**：`c` 创建、`z` 用 gzip、`f` 指定文件名、`x` 解压、`t` 列出。`-C` 切换目录再打包，避免把绝对路径带进包里。`tar tf` 不解压先看内容，恢复前必做。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
mkdir -p pkg && echo "data1" > pkg/a.txt && echo "data2" > pkg/b.txt
tar czf linux.tar.gz -C pkg .
echo "--- 压缩包内容 ---"; tar tzf linux.tar.gz
mkdir -p restore && tar xzf linux.tar.gz -C restore
echo "--- 解压后 ---"; ls -l restore
```

```text
--- 压缩包内容 ---
./
./a.txt
./b.txt
--- 解压后 ---
total 2
-rw-r--r-- 1 user user 6 restore/a.txt
-rw-r--r-- 1 user user 6 restore/b.txt
```

> **易错点**：直接 `tar czf x.tgz /data/linux` 会把 `/data/linux` 绝对路径压进去，解压时易覆盖；加 `-C` 更稳妥。

---

### 题 08：设置别名 net 显示网卡配置并永久生效
{: .sec-expl}

> **答案**：
> 1. `echo "alias net='cat /etc/sysconfig/network-scripts/ifcfg-eth0'" >> /etc/profile`
> 2. `source /etc/profile`
> 3. `alias` 检查

**解析**：与第 02 周题 27 同理，长命令变短靠 `alias`，写进 `/etc/profile` 并 `source` 才永久。

**实操验证**（A 级，已实操，演示别名定义）：

```bash
alias net='cat /etc/hosts'
alias | grep "alias net"
```

```text
alias net='cat /etc/hosts'
```

> **易错点**：CentOS 7 网卡文件多为 `ifcfg-ens33`，照搬 `ifcfg-eth0` 会 cat 到空文件。

---

### 题 09：目录默认硬链接数；若为 10 的原因

> **答案**：
> - 新建空目录默认硬链接数为 **2**（自身 `.` 与父目录里的条目）
> - 若硬链接数为 10，说明该目录下有 **8 个子目录**（每个子目录贡献一个 `..` 链接，2 + 8 = 10）

**解析**：目录的硬链接数 = 2（自身 + 父目录引用）+ 子目录个数（每个子目录的 `..` 指向它）。所以数子目录 = 链接数 − 2。根源在于目录里的 `.` 和 `..` 本身就是硬链接：`.` 指向自己占一个，父目录里的目录项再占一个。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
mkdir /data/testdir
ls -ld /data/testdir          # 显示 2
mkdir /data/testdir/d1 /data/testdir/d2
ls -ld /data/testdir          # 显示 4 (2+2)
```

```text
drwxr-xr-x 2 user user 4096 testdir
drwxr-xr-x 4 user user 4096 testdir
```

> **易错点**：误以为空目录硬链接数是 1（那是文件）；链接数 − 2 才是子目录数，不是文件数。

---

### 题 10：硬链接可作备份，为何还要 cp

> **答案**：硬链接与原文件共享同一 inode，删除任一不影响数据，但**无法跨文件系统、不能对目录建硬链接、源文件被真正删除（链接数归零）后数据即丢失**；`cp` 是复制出独立副本，修改互不影响，更安全灵活。

**解析**：硬链接本质是同一数据的多个名字，不是"备份"——改一处全改；真正备份要内容独立，所以用 `cp`。硬链接价值在于节省空间与防误删。

> **易错点**：以为硬链接是备份就能随便改；源文件改了，所有硬链接同步变。
>
> **变式追问**：怎么验证两个文件互为硬链接？（`ls -li` 对比 inode 号，相同就是同一份数据的两个名字。）

---

### 题 11：为 /data/linux/linux.txt 创建软链接 /tmp/linux_link.txt，源删是否失效

> **答案**：`ln -s /data/linux/linux.txt /tmp/linux_link.txt`；源文件删除后**软链接失效**（变成"断链"，访问报错 No such file or directory）

**解析**：软链接存的是"路径指针"，源没了指针就悬空。硬链接删源仍可用，软链接删源即废——这是二者最直观区别。

**实操验证**（B 级，预期输出，CentOS 7，本沙箱无软链接权限）：

```bash
ln -s /data/linux/linux.txt /tmp/linux_link.txt
ls -l /tmp/linux_link.txt
cat /tmp/linux_link.txt
rm -f /data/linux/linux.txt
cat /tmp/linux_link.txt
```

```text
lrwxrwxrwx 1 user user 22 /tmp/linux_link.txt -> /data/linux/linux.txt
hello softlink
cat: /tmp/linux_link.txt: No such file or directory
```

> **易错点**：软链接用相对路径时，指向的是"相对于链接所在目录"的路径，移动链接会断；删源不断链但访问即报错。

---

### 题 12：No space left on device 但 df 未满的原因与解决
{: .sec-ts}

> **答案**：
> - 原因一：**inode 耗尽**（`df -i` 查看），小文件过多占满 inode
> - 原因二：**文件被进程占用未释放**（删除后空间不回收，`lsof | grep deleted` 查）
> - 解决：删无用小文件释放 inode；重启或重载占用已删文件的进程释放空间

**解析**：`df -h` 看 block（空间），`df -i` 看 inode（文件数配额）；大量小文件会先耗尽 inode。删除后仍被进程打开的文件，需进程关闭才真正释放。

生产注意点：inode 耗尽的高发区是邮件队列、会话临时文件、容器镜像层这类小文件大户，巡检时优先排查 `/var/spool`、`/tmp`。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
df -i /
lsof | grep deleted
```

> **易错点**：只 `df -h` 不 `df -i`，找不到 inode 满的根因；`rm` 了大文件空间不降，是因为进程还攥着句柄。

---

### 题 13：每次按时间备份 linux.txt 并开机自动备份

> **答案**：
> - 按时间备份：`cp /data/linux/linux.txt /data/linux/linux.txt.$(date +%F_%H%M%S)`
> - 开机自动：把该命令写入 `/etc/rc.local` 并 `chmod +x /etc/rc.d/rc.local`

**解析**：用 `date +%F_%H%M%S` 做后缀，每次备份文件名不同。`rc.local` 开机执行（见第 02 周题 31）。

**实操验证**（A 级，已实操，会话级演示）：

```bash
cd /tmp/hw/quiz/w4/linktest
echo "config content" > app.cnf
cp app.cnf app.cnf.$(date +%F_%H%M%S)
echo "--- 备份结果 ---"; ls -1 | grep app.cnf
```

```text
--- 备份结果 ---
app.cnf
app.cnf.2026-10-24_075015
```

> **易错点**：后缀忘了加时间会变成覆盖而非多版本；`rc.local` 在 CentOS 7 需手动加执行权限。

---

### 题 14：改了 /etc/profile 里 rm 别名还是不能直接删除

> **答案**：原因——修改后未 `source /etc/profile` 或未重开终端，别名只在加载该文件的 shell 生效；相关别名配置文件还有 `~/.bashrc`、`/etc/bashrc`。

**解析**：`alias rm='rm -i'` 之类若仍删不掉，常见是：① 没 `source`；② 当前是子 shell/其他终端；③ 命令用了绝对路径 `/bin/rm` 绕过别名。检查用 `alias rm`。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
grep -n 'alias rm' /etc/profile ~/.bashrc
alias rm
source /etc/profile
```

> **易错点**：`source` 只对当前 shell 有效，其他已开终端要各自重开或 source。

---

### 题 15：date 命令格式

> **答案**：
> 1. 显示 2011-02-26 格式：`date -d '2011-02-26' +%Y-%m-%d`
> 2. 打印三天前：`date -d '2011-03-01 -3 days' +%Y-%m-%d`

**解析**：`+%Y-%m-%d` 控制输出格式（`%Y` 年、`%m` 月、`%d` 日）；`-d` 指定显示哪个时间点，`-3 days` 往前推三天。脚本里生成日志名、计算过期时间极常用。

**实操验证**（A 级，已实操）：

```bash
echo "1) 2011-02-26 格式: $(date -d '2011-02-26' +%Y-%m-%d)"
echo "2) 三天前: $(date -d '2011-03-01 -3 days' +%Y-%m-%d)"
```

```text
1) 2011-02-26 格式: 2011-02-26
2) 三天前: 2011-02-26
```

> **易错点**：`%y` 是两位年、`%Y` 是四位年，写错变成 `11`；`-d` 在不同系统写法略有差异，CentOS/Git Bash 均支持。

---

### 题 16：特殊符号含义

> **答案**：
> - `>` 标准输出覆盖重定向；`>>` 标准输出追加重定向
> - `2>` 标准错误覆盖；`2>>` 标准错误追加
> - `#` 注释符；`.` 当前目录；`..` 上级目录；`~` 当前用户家目录
> - `*` 通配任意字符；`$` 引用变量；`|` 管道；`&&` 前成功才执行后；`||` 前失败才执行后

**解析**：`2>` 把报错也重定向（如 `命令 2>/dev/null` 屏蔽错误）；`&&`/`||` 是命令间逻辑控制，脚本判断成败必备。

> **易错点**：`>` 误伤覆盖；`2>` 与 `>` 是两条流，要全屏蔽得 `> /dev/null 2>&1`。

---

### 题 17：文件属性信息包含什么

> **答案**：`ls -l` 显示的属性含——文件类型、权限（rwx）、硬链接数、属主、属组、大小、修改时间、文件名。

**解析**：完整属性还隐含 inode 号（`ls -i`）、占用 block 数（`du`）。权限分属主/属组/其他三类，各三类 r/w/x。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
ls -l config.txt
```

```text
-rw-r--r-- 1 user user 45 config.txt
```

> **易错点**：把"硬链接数"当"引用计数"误解；`ls -l` 第 5 列是字节数不是块数。

---

### 题 18：权限有哪些；可读可写 与 可写可执行 数值求和

> **答案**：权限有 r（读，4）、w（写，2）、x（执行，1）。
> - 可读可写 = rw = 4+2 = **6**
> - 可写可执行 = wx = 2+1 = **3**
> - 两者数值求和 = 6 + 3 = **9**

**解析**：数字权限三位八进制，每位由 r/w/x 按 4/2/1 相加。rw=6、wx=3，求和即 6+3=9（不是合并权限位）。

> **易错点**：把"数值求和"理解成合并权限（wx 与 rw 合并是 rwx=7）；审题要看清是"求和"还是"合并"。

---

### 题 19：rwx-w-r-- 对各类用户的权限

> **答案**：
> - 属主（u）：rwx（读、写、执行全有）
> - 属组（g）：-w-（只有写）
> - 其他（o）：r--（只有读）

**解析**：权限串 9 位分三段：属主/属组/其他。本题属主 rwx、属组 `--w`（即 `-w-`）、其他 `r--`。属组那段是 `-w-` 表示无读无执行仅有写。

> **易错点**：把中间的 `-w-` 看成 `rw-`；组只有写权限很罕见但合法。

---

### 题 20：创建用户默认主目录位置

> **答案**：`/home/`（如 `/home/linuxuser`）

**解析**：同第 02 周题 20，`useradd` 默认在 `/home` 建同名目录，`/etc/passwd` 第 6 字段记录家目录。

> **易错点**：root 家目录是 `/root`，不在此列。

---

### 题 21：下列文件作用

> **答案**：
> - `/var/log/messages`：综合系统/服务日志
> - `/var/log/secure`：登录认证日志
> - `/etc/hosts`：IP↔主机名本地解析
> - `/etc/fstab`：开机自动挂载
> - `/etc/rc.local`：开机最后执行的脚本

**解析**：这些都是运维高频文件，Messages 看系统异常、secure 看谁登录、hosts 做本地解析、fstab 管挂载、rc.local 放启动任务。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
ls -l /etc/hosts /etc/fstab /etc/rc.local /var/log/messages /var/log/secure
```

> **易错点**：`/var/log/secure` 含登录信息，注意权限（一般 600）；rc.local 需执行权限。

---

### 题 22：去除注释信息显示（至少三种）

> **答案**：
> - `grep -v '^[[:space:]]*#' 文件`（去以 # 开头的行）
> - `sed '/^[[:space:]]*#/d' 文件`
> - `awk '!/^[[:space:]]*#/ && NF' 文件`（同时去空行）

**解析**：`^#` 匹配行首 #，`[[:space:]]*` 兼容前置空格注释；连空行一起去掉加 `grep -v '^$'` 或 `awk NF`。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
printf 'lineA\n# comment1\nlineB\n   # spaced\nlineC\n' > conf.cfg
echo "--- grep -v ---"; grep -v '^[[:space:]]*#' conf.cfg
echo "--- sed ---"; sed '/^[[:space:]]*#/d' conf.cfg
echo "--- grep 去空行 ---"; grep -vE '^[[:space:]]*#|^[[:space:]]*$' conf.cfg
```

```text
--- grep -v ---
lineA
lineB
lineC
--- sed ---
lineA
lineB
lineC
--- grep 去空行 ---
lineA
lineB
lineC
```

> **易错点**：只写 `grep -v '^#'` 会漏掉前面带空格的注释行；想彻底干净要兼容 `[[:space:]]*`。

---

### 题 23：查看文件详细时间，三种时间如何变化

> **答案**：用 `stat 文件` 查看。三种时间：
> - Access（atime）：读取文件时更新
> - Modify（mtime）：内容修改时更新（最常用，`ls -l` 显示的就是它）
> - Change（ctime）：属性（权限/属主/大小等）变更或内容修改时更新

**解析**：`stat` 给出精确到纳秒的三时间。`cat` 改 atime；`echo` 写内容改 mtime+ctime；`chmod` 只改 ctime——为什么？mtime 记录的是内容变化，chmod 碰不到内容，只能动 inode 里的元数据，所以 ctime 更新而 mtime 不动。备份、增量同步常以 mtime 为判据。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
echo hi > a.txt
stat a.txt | head -8
```

```text
  File: a.txt
  Size: 3          Blocks: 1          IO Block: 65536  regular file
Device: 66bb8f8bh  Inode: 5348024557792333  Links: 1
Access: (0644/-rw-r--r--)  Uid: (0/ user)   Gid: (0/ user)
Access: 2026-10-24 07:50:32
Modify: 2026-10-24 07:50:32
Change: 2026-10-24 07:50:32
```

> **易错点**：以为 `ls -l` 显示的是 ctime；`touch` 可人为改 atime/mtime（`touch -a`/`-m`）。

---

### 题 24：grep 识别扩展正则（至少两种）
{: .sec-ext}

> **答案**：
> - `grep -E '正则'`（`-E` 启用扩展正则）
> - `egrep '正则'`（等同 `grep -E`）
> - `grep '正则'` 再用 `\{n\}` 等转义写法（基本正则）

**解析**：扩展正则支持 `+` `?` `|` `()` 无需转义；基本正则要写成 `\+` `\|` `\(\)`。日常推荐 `grep -E`。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
printf 'cat\ncaat\ndog\n' > g.txt
echo "--- grep -E ---"; grep -E 'c+a+t' g.txt
echo "--- egrep ---"; egrep 'c+a+t' g.txt
```

```text
--- grep -E ---
cat
caat
--- egrep ---
cat
caat
```

> **易错点**：在基本正则里直接写 `|` 会被当普通字符，必须 `-E` 或转义 `\|`。

---

### 题 25：找出权限 r-x------ 的目录并复制到 /tmp（至少三种）

> **答案**：
> - `find /data -type d -perm 500`
> - `find /data -type d -perm u=rx,g=,o=`
> - 配合复制：`find /data -type d -perm 500 -exec cp -r {} /tmp/ \;`

**解析**：`500` 即 `r-x------`（属主 rx=5，组 0，其他 0）。`cp -r` 复制目录。注意精确匹配用 `-perm 500`，模糊包含用 `-perm -500`。

**实操验证**（B 级，预期输出，CentOS 7，本沙箱 Windows 权限无法精确模拟）：

```bash
mkdir -p /data/rxdir && chmod 500 /data/rxdir
find /data -type d -perm 500
cp -r /data/rxdir /tmp/
```

```text
/data/rxdir
```

> **易错点**：`-perm 500`（精确）与 `-perm -500`（至少含这些位）混淆；复制目录忘 `-r`。

---

### 题 26：管道+xargs 与 find -exec 的执行原理
{: .sec-know}

> **答案**：
> - 管道 + xargs：前命令输出逐行/逐块作为后命令的**参数**传入，`xargs` 批量拼接到一行执行，效率高；文件名含空格需用 `-print0 | xargs -0`
> - find -exec：对 find 匹配的**每一个**结果，启动一次命令（`{}` 占位、`\;` 结束）；`+` 结尾可一批多个，类似 xargs

**解析**：二者都能"对查到的文件执行操作"。xargs 适合大量文件（减少进程数）；`-exec ... \;` 每文件一进程，简单直观；`-exec ... +` 折中。

**实操验证**（A 级，已实操，对比）：

```bash
cd /tmp/hw/quiz/w4
echo "--- xargs 批量 ---"; find etcbig -type f -name '*.bin' | xargs ls -l
echo "--- exec 逐个 ---"; find etcbig -type f -name '*.bin' -exec ls -l {} \;
```

> **易错点**：xargs 默认按空白分割，文件名带空格会断裂；`find -exec` 结尾忘写 `\;` 或 `+` 报错。

---

### 题 27：实时监控日志文件变化

> **答案**：`tail -F /var/log/messages`（`-F` 比 `-f` 更稳，文件被轮转重建也能继续跟踪）

**解析**：`tail -f` 跟随文件末尾新增；`-F` 额外监控文件是否被移动/重建（logrotate 切割后仍能跟踪新文件）。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
tail -F /var/log/messages
```

```text
Oct 24 08:00:01 linux-node01 systemd: Started Session 12 of user root.
```

> **易错点**：用 `-f` 遇到 logrotate 切割后跟踪中断；`-F` 才是生产推荐。

---

### 题 28：创建 linuxuser 用户并免交互设密码

> **答案**：
> ```bash
> useradd linuxuser
> echo "$PASS" | passwd --stdin linuxuser
> ```

**解析**：`passwd --stdin` 从标准输入读密码，适合脚本。CentOS 7 可用；更安全的做法是 `chpasswd`（读 `用户:密码` 格式）。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
useradd linuxuser
echo "$PASS" | passwd --stdin linuxuser
id linuxuser
```

```text
passwd: all authentication tokens updated successfully.
uid=1001(linuxuser) gid=1001(linuxuser) groups=1001(linuxuser)
```

> **易错点**：明文口令进命令行历史，生产改用 `chpasswd` 或交互设密；`--stdin` 部分发行版不支持。

---

### 题 29：目录存在才创建 xxoo.avi，成功/失败均有提示且不显示错误
{: .sec-ts}

> **答案**：
> ```bash
> d=/data/linux/alex
> if [ -d "$d" ]; then
>   touch "$d/xxoo.avi" && echo "成功: 文件已创建"
> else
>   echo "失败: 目录不存在"
> fi 2>/dev/null
> ```

**解析**：这题就是在考条件判断的固定套路。`[ -d 目录 ]` 判断目录是否存在；整个 `if` 末尾 `2>/dev/null` 屏蔽可能的报错，只保留自定义提示。`&&` 保证 touch 成功才提示成功。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
d=/tmp/hw/quiz/w4/alexdir
rm -rf "$d"
if [ -d "$d" ]; then touch "$d/xxoo.avi" && echo "成功: 文件已创建"; else echo "失败: 目录不存在"; fi 2>/dev/null
mkdir -p "$d"
if [ -d "$d" ]; then touch "$d/xxoo.avi" && echo "成功: 文件已创建"; else echo "失败: 目录不存在"; fi 2>/dev/null
ls -l "$d"
```

```text
失败: 目录不存在
成功: 文件已创建
total 0
-rw-r--r-- 1 user user 0 xxoo.avi
```

> **易错点**：`[ -d ]` 写成 `[ -f ]` 会判成文件不存在；变量未加引号，目录名含空格会语法错。

---

### 题 30：yum 装软件只知命令不知包名

> **答案**：`yum provides */命令名` 或 `yum whatprovides 命令名`（CentOS 8+ 用 `dnf provides`）

**解析**：`provides` 反向查询"哪个包提供了这个命令/文件"，如 `yum provides */ifconfig` 提示安装 `net-tools`。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
yum provides */ifconfig
```

```text
net-tools-2.0-0.25.20131004git.el7.x86_64 : Basic networking tools
```

> **易错点**：忘了先 `yum makecache` 或网络不通会查不到；命令要写全路径形式 `*/命令`。

---

### 题 31：软链接与硬链接的区别

> **答案**：
> - 硬链接：同 inode，不能跨文件系统、不能链目录、删源仍可访问
> - 软链接：独立 inode 存路径，可跨文件系统、可链目录、删源即失效

**解析**：`ln 源 链`（硬）vs `ln -s 源 链`（软）。硬链接像"多个名字指向同一数据"，软链接像"快捷方式"。

**实操验证**（综合，见题 09/11）。

> **易错点**：误以为软链接占空间小就当备份；硬链接不能链目录，这是与软链最关键差异之一。
>
> **变式追问**：软链接自己"多大"？（它保存的是目标路径字符串，大小就是路径的字符数，比如 22 字节，跟源文件体积无关。）

---

### 题 32：磁盘空间不够的原因与处理

> **答案**：
> - 原因：block 满（大文件）、inode 满（海量小文件）、删除文件被进程占用未释放、分区规划不合理
> - 处理：`du -sh /*` 定位大目录；`df -i` 查 inode；`lsof | grep deleted` 释放句柄；清理或扩容

**解析**：先 `df -h` 确认是否真满，再 `du` 定位元凶。inode 满常被忽视。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
df -h /
du -sh /var/* 2>/dev/null | sort -rh | head
```

> **易错点**：只看 `df` 不看 `df -i`；删了大文件空间不降，要先处理占用进程。

---

### 题 33：inode 和 block 是什么
{: .sec-know}

> **答案**：
> - inode：索引节点，存文件的元信息（权限、属主、大小、时间戳、数据块指针），不含文件名
> - block：数据块，真正存放文件内容的磁盘单元，大小通常 4K

**解析**：文件 = inode（属性） + 若干 block（内容）。文件名存在目录项里，指向 inode 号。硬链接就是多个目录项指向同一 inode。

> **易错点**：inode 满 vs block 满症状不同（前者建不了新文件但可能还有空间）；小文件多会先耗 inode。

---

### 题 34：双引号、单引号、反引号、不加引号的区别

> **答案**：
> - 双引号 `""`：弱引用，变量 `$`、反引号、`\` 仍生效
> - 单引号 `''`：强引用，所有字符原样，变量不展开
> - 反引号 ``` ` ``：命令替换，执行其中命令并把输出作为值（推荐 `$(命令)`）
> - 不加引号：变量展开且受分词/通配影响，含空格易出错

**解析**：写脚本优先 `$(命令)` 而非反引号（可读性好、可嵌套）。要原样字符串用单引号，要展开变量用双引号。

**实操验证**（A 级，已实操）：

```bash
var=linux
echo "双引号展开: $var"
echo '单引号原样: $var'
echo "反引号执行: $(echo backtick)"
echo "不加引号: $var"
```

```text
双引号展开: linux
单引号原样: $var
反引号执行: backtick
不加引号: linux
```

> **易错点**：在单引号里写 `$var` 永远不展开；反引号内嵌套反引号要用 `$( )` 替代。

---

### 题 35：找出占用磁盘过大的文件

> **答案**：
> - `du -sh /data/* 2>/dev/null | sort -rh | head` 看哪些目录/文件最大
> - `find /data -type f -size +100M -exec ls -lh {} \;` 直接找大于 100M 的文件

**解析**：`du -sh` 汇总大小，`sort -rh` 倒序排，`head` 取前几；`find -size +100M` 精确筛大文件。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
du -sh /data/* 2>/dev/null | sort -rh | head
find /data -type f -size +100M -exec ls -lh {} \;
```

```text
500M    /data/bigfile.bin
-rw-r--r-- 1 user user 500M /data/bigfile.bin
```

> **易错点**：`du` 默认递归累加，看单文件要 `du -sh 文件`；`-size +100M` 的 `M` 大写。

---

### 题 36：什么情况下数据文件真正被删除

> **答案**：当文件的**硬链接数降为 0** 且**没有任何进程占用该文件句柄**时，数据块才被真正释放回收。

**解析**：`rm` 只是减少链接数；只要还有一个硬链接或进程占用，数据就还在（见题 12）。

> **易错点**：以为 `rm` 立刻清空磁盘；实际要"链接数 0 + 无进程占用"才真正回收。

---

### 题 37：检查 linuxuser 用户并显示 id；按 id 分类用户
{: .sec-ver}

> **答案**：
> - 检查并看 id：`id linuxuser`
> - 用户分类（CentOS 7）：
>   - 0：root 超级用户
>   - 1–999：系统/伪用户（服务账户）
>   - 1000+：普通用户

**解析**：`id 用户名` 显示 uid/gid/所属组。uid 决定身份，0 是 root，系统服务用 1–999 的伪用户，新建普通用户从 1000 起。

**实操验证**（A 级，已实操，当前用户演示）：

```bash
id
echo "--- 当前用户 uid ---"; id -u
```

```text
uid=1000(user) gid=1000(user) groups=1000(user)
--- 当前用户 uid ---
1000
```

> **易错点**：uid 范围 1–999 是系统用户（不是 1–500，老教材 outdated）；误把 gid 当 uid。

---

### 题 38：给 /data/linux 创建 /tmp/linux 硬链接目录

> **答案**：D. 无法进行创建——**目录不能创建硬链接**（硬链接仅限普通文件）

**解析**：Linux 不允许对目录建硬链接，否则会破坏文件系统树的有向无环结构（造成环路）。要给目录"链接"只能用软链接：`ln -s /data/linux /tmp/linux`。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
ln /data/linux /tmp/linux
```

```text
ln: '/data/linux': hard link not allowed for directory
```

> **易错点**：硬链接目录不被允许；想链目录用 `ln -s` 软链接。

---

### 题 39：sed 的 -n 与 -r 参数含义
{: .sec-expl}

> **答案**：
> - `-n`：抑制默认输出，只打印被 `p` 命令显式指定的行（常与 `p` 配合）
> - `-r`：启用扩展正则（同 `-E`），`+` `|` `()` 无需转义

**解析**：默认 sed 会打印每一行，`-n` 关掉这行为，只输出匹配行，避免重复。`-r` 让正则更简洁。

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w4
printf 'abc123\nxyz\nfoo456\n' > s.txt
sed -n -r '/(abc|foo)[0-9]+/p' s.txt
```

```text
abc123
foo456
```

> **易错点**：忘加 `-n` 导致匹配行被打印两次（一次默认、一次 `p`）；扩展正则符号在基本模式要转义。

---

### 题 40：新硬盘到手需哪些处理才能使用

> **答案**：
> 1. 分区：`fdisk /dev/sdb`（MBR）或 `parted`/`gdisk`（GPT）
> 2. 格式化：`mkfs.xfs /dev/sdb1`（或 ext4）
> 3. 挂载：`mount /dev/sdb1 /data`
> 4. 持久化：写 `/etc/fstab` 实现开机自动挂载

**解析**：裸盘不能直接用，必须"分区→格式化→挂载"三步，最后进 fstab 保证重启仍在。生产建议 XFS 或 ext4。

生产注意点：fstab 里建议写 UUID 而不是设备名——盘位顺序变化时 `/dev/sdb` 可能变成 `/dev/sdc`，UUID 不会变，用 `blkid` 查。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
fdisk -l /dev/sdb
mkfs.xfs /dev/sdb1
mount /dev/sdb1 /data
echo '/dev/sdb1 /data xfs defaults 0 0' >> /etc/fstab
```

> **易错点**：格式化会清空数据，确认设备名再下手；fstab 写错可能导致无法开机。

---

## 本篇小结
{: .sec-sum}

第 4 周开始上强度，下面这些点错了最容易扣分：

1. 查找处理：`find` 配 `-mtime`/`-size`/`-maxdepth`/`-perm`，删除三法 `-delete`/`-exec`/`xargs`；`xargs -0` 防空格断裂。
2. 文本替换：`sed -i 's/old/new/g'` 原地改；`-n` 抑默认输出、`-r` 扩展正则；vim `:%s///g` 等价。
3. 打包：`tar czf/xzf/tzf`，加 `-C` 避免压入绝对路径；恢复前必 `tar tzf` 先看。
4. 链接：硬链接同 inode（限文件、不跨盘），软链接存路径（可跨盘、可链目录、删源即废）；目录不可硬链接。
5. 权限数字：r=4 w=2 x=1；目录默认硬链接数 2，子目录数 = 链接数 − 2。
6. 磁盘：`df -h` 看空间、`df -i` 看 inode；删了不释放多是进程占用；`du -sh | sort -rh` 定位大文件。
7. 时间三件套：atime/mtime/ctime，`stat` 查看，`ls -l` 显示 mtime。
8. 引号：`''` 强引用、`""` 弱引用、`` ` ` ``/`` $( ) `` 命令替换；新盘四步：分区→格式化→挂载→fstab。


{% endraw %}
