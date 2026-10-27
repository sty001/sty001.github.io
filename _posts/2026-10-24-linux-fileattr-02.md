---
title: "02-基础知识回顾-下"
date: 2026-10-24 10:32:00 +0800
categories: [软件, Linux, 03-文件属性与正则表达式]
tags: [Linux, 03-文件属性与正则表达式, Linux基础]
slug: "linux-fileattr-02"
---

{% raw %}



这一篇继续查漏补缺：CentOS 7 网卡命名的修改方式、Vim 编辑原理与非正常退出的排错、查看文件属性与内容的各种命令（`ls` / `cat` / `less` / `more` / `head` / `tail`）、不打开编辑器直接写入文件的两种方法（`echo`、`cat` 配合 here document），以及 grep / sed / awk 三剑客入门和 `sed`、`tr` 的内容替换。重点补齐文件查找体系：`locate` / `whereis` / `which` / `type` 四种快速定位手段的对比，`find` 的参数大全与排错经验，`find` 与 `xargs` 的配合。文件操作这一块，看完这篇就齐了。

## 文件定位命令对比：locate / whereis / which / type

四个命令都能"找文件"，但原理和适用场景完全不同，先用一张表建立全局认识：

| 命令 | 数据来源 | 能否找任意文件 | 是否实时 | 典型用途 |
| --- | --- | --- | --- | --- |
| `which` | 在 `PATH` 环境变量所列目录中逐一查找 | 只能找可执行命令 | 实时 | 确认命令是否存在、用的是哪一个 |
| `whereis` | 在预置的二进制、源码、man 页目录中查找 | 只能找命令相关的文件 | 准实时 | 同时拿到命令路径与帮助手册路径 |
| `type` | shell 内建能力，判断命令的身份 | 判断命令身份 | 实时 | 区分内部命令 / 外部命令 / 别名 / 函数 |
| `locate` | 系统数据库（由 `updatedb` 定时生成） | 可以 | 非实时（数据库有延迟） | 全盘快速模糊查找文件 |

四者对比示例：

```bash
[root@linux-node1 ~]# which cat
/usr/bin/cat
[root@linux-node1 ~]# whereis cat
cat: /usr/bin/cat /usr/share/man/man1/cat.1.gz
[root@linux-node1 ~]# type cat
cat is hashed (/usr/bin/cat)
[root@linux-node1 ~]# locate ifcfg-eth0
/etc/sysconfig/network-scripts/ifcfg-eth0
```

> **注意：** `locate` 依赖数据库，刚创建的文件往往查不到，需要先执行 `updatedb` 刷新数据库；`which` 找不到命令只说明不在 `PATH` 里，不代表磁盘上没有。另外 `which` 查不到 shell 内部命令（如 `cd`、`alias`），这类命令请用 `type` 或 `help`。
{: .sec-pit}

顺带说下原理：`updatedb` 按 `/etc/updatedb.conf` 的规则全盘扫一遍文件路径写进数据库，`locate` 只查这个库——快在"不碰磁盘元数据"，慢在"数据可能过期"。配置里的 PRUNEPATHS 默认排除了 /proc、/sys 等伪文件系统，这些路径下的文件永远搜不到。CentOS 7 通过 /etc/cron.daily/mlocate 每天自动跑一次更新。

## find 命令参数大全
{: .sec-expl}

`find` 是实时遍历目录树的查找工具，语法结构为：

```bash
find [查找的路径范围] [测试条件] [动作]
```

三大类元素：

1. **路径范围**：从哪些目录开始找，可以写多个目录；
2. **测试条件**：按名称、类型、时间、大小、属主、权限等条件过滤；
3. **动作**：对找到的结果做什么，如 `-print`（默认）、`-exec`、`-delete`。

### 按名称查找

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `-name "文件名"` | 精确匹配文件名（区分大小写） | `find /etc -name "ifcfg-eth0"` |
| `-name "模式"` | 支持 `*` `?` `[]` 通配符 | `find /etc -name "*eth0"` |
| `-iname "模式"` | 同 `-name` 但忽略大小写 | `find /test -iname "test*"` |
| `-path "模式"` | 匹配整个路径（含目录部分） | `find /test -path "*/test01/*"` |
| `-regex "正则"` | 用正则表达式匹配完整路径 | `find /etc -regex ".*ifcfg.*"` |

```bash
# 精确查找
find /etc -type f -name "ifcfg-eth0"
# 模糊查找
find /etc -type f -name "*eth0"
find /etc -type f -name "if*h0"
# 忽略大小写查找
find /test -type f -iname "文件名*"
```

### 辨析：-name 与 -iname

`-name` 区分大小写，`-iname` 不区分。Linux 习惯小写命名，日常用 `-name` 就够了，但两类场景必须想到 `-iname`：一是处理 Windows 来源的文件（大小写混杂），二是排查时不确定对方怎么命名的，比如 `find / -iname "readme*"` 能同时命中 README、readme、ReadMe。容易忽略的一点：`-name` 匹配的只是文件名本身，不含路径，按路径过滤得换 `-path`。

### 按类型查找（-type）

| 参数值 | 类型 | 示例 |
| --- | --- | --- |
| `f` | 普通文件 | `find /etc -type f -name "*.conf"` |
| `d` | 目录 | `find /test -type d` |
| `l` | 符号链接（软链接） | `find /test -type l` |
| `b` | 块设备文件 | `find /dev -type b` |
| `c` | 字符设备文件 | `find /dev -type c` |
| `p` | 命名管道（FIFO） | `find /tmp -type p` |
| `s` | socket 套接字文件 | `find /var -type s` |

### 按时间查找（-mtime / -ctime / -atime）

三种时间分别对应：`-atime` 访问时间、`-mtime` 内容修改时间、`-ctime` 属性改变时间。单位是天，支持三种写法：

| 写法 | 含义 | 示例 |
| --- | --- | --- |
| `n` | 恰好第 n 天（24n 至 24(n+1) 小时之前） | `find /etc -atime 3` |
| `+n` | n 天以前（超过 24n 小时） | `find /var/log -mtime +30` |
| `-n` | n 天以内（不足 24n 小时） | `find /tmp -atime -1` |

```bash
find /var/log -name "*.log" -mtime +30       # 30 天以前修改过的日志
find /etc -mtime -7                          # 最近 7 天内容被修改过的文件
find /test -type f -ctime +30                # 30 天以前属性改变过的文件
```

> **注意：** 分钟级的时间查找用 `-mmin` / `-amin` / `-cmin`（单位是分钟），如 `find /data -mmin -60` 查找最近 1 小时内修改过的文件，比按天计算更精确。另有一个常用参数 `-newer 文件`，表示比指定文件的修改时间更新，如 `find /data -newer /tmp/mark.txt`。
{: .sec-pit}

两个补充。其一，默认按 24 小时制从当前时刻往回算，加上 `-daystart` 则从当天 00:00 起算，做"今天的日志归档"时语义更直观。其二，find 的多个测试条件默认是 AND 关系，显式 OR 用 `-o`，取反用 `-not` 或 `!`；区间查找就是连写两个条件，如 `-size +1M -size -10M`。

### 按大小查找（-size）

单位后缀对照：

| 后缀 | 含义 | 是否推荐 |
| --- | --- | --- |
| `b` | 512-byte blocks（不写后缀时的默认值） | 不推荐，默认单位反直觉 |
| `c` | bytes 字节 | 推荐 |
| `w` | two-byte words 双字节 | 不推荐 |
| `k` | Kilobytes（1024 bytes） | 推荐 |
| `M` | Megabytes（1048576 bytes） | 推荐 |
| `G` | Gigabytes（1073741824 bytes） | 推荐 |

```bash
find /test -type f -size +100     # 大于 100 个 512 字节块的文件
find /test -type f -size -100c    # 小于 100 字节的文件
find /test -type f -size +1M      # 大于 1M 的文件
find /test -type f -size 0c       # 大小为 0 的空文件
```

> **注意：** `+n` 表示大于，`-n` 表示小于，`n` 表示恰好等于。`-size +1M` 匹配的是严格大于 1M（向上取整到块），生产环境清理大文件时建议先用 `-exec ls -lh {} +` 确认再删除。
{: .sec-pit}

### 按属主与属组查找

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `-user 用户名` | 按属主查找 | `find /data -user test01` |
| `-uid 编号` | 按 uid 查找 | `find /data -uid 1000` |
| `-group 组名` | 按属组查找 | `find /data -group dev` |
| `-gid 编号` | 按 gid 查找 | `find /data -gid 1000` |
| `-nouser` | 查找没有属主的文件（属主已被删除） | `find / -nouser` |
| `-nogroup` | 查找没有属组的文件 | `find / -nogroup` |

```bash
find /home -user test01 -type f         # test01 拥有的所有文件
find / -nouser -o -nogroup              # 全盘查找孤儿文件（删除用户后常见的残留）
```

### 按权限查找（-perm）

| 写法 | 含义 | 示例 |
| --- | --- | --- |
| `-perm 644` | 权限恰好等于 644 | `find /test -perm 644` |
| `-perm -644` | 权限包含 644 的全部位（至少具备） | `find /etc -perm -644` |
| `-perm /644` | 权限包含 644 中的任意一位（任一命中） | `find / -perm /6000` |
| `-perm -4000` | 带 SUID 位的文件 | `find / -perm -4000 -type f` |

```bash
find /test -maxdepth 1 -type f -perm 644
find / -type f -perm -4000              # 查找所有 SUID 文件（安全审计常用）
find / -type f -perm -0002              # 查找所有其他人可写的文件
```

`-perm /6000` 的 `/` 写法在 find 4.2.99（2008 年）引入，替代已废弃的 `+6000`；老脚本里看到 `+` 号属于历史语法，新版 find 会直接拒绝。安全基线检查常用一条组合：`find / -type f \( -perm -0002 -o -perm -0020 \) -user root`，找 root 拥有但组、他人可写的文件——这类文件一旦被低权限用户改写就是提权隐患。

### 按层级深度查找（-maxdepth / -mindepth）

```bash
find /test -type f -name "Test*"
find /test -maxdepth 1 -type f -name "Test*"    # 只找当前目录，不进入子目录
find /test -maxdepth 2 -type f -name "Test*"    # 最多下探 2 层
```

> **注意：** `-maxdepth` 是全局选项，必须放在 `-type`、`-name` 等测试条件**之前**，否则会收到警告：
>
> ```console
> [root@linux-node1 test01]# find /test -type f -name "Test*" -maxdepth 1
> find: warning: you have specified the -maxdepth option after a non-option argument -type, but options are not positional (-maxdepth affects tests specified before it as well as those specified after it).  Please specify options before other arguments.
> /test/Test.txt
> ```
{: .sec-pit}

`-mindepth` 作用相反，表示至少下探几层才开始匹配，两者组合可以精确限定搜索范围。

### 动作参数：-exec / -ok / -delete
{: .sec-expl}

| 参数 | 作用 | 语义 |
| --- | --- | --- |
| `-print` | 打印结果（默认动作） | `find /etc -name "*.conf" -print` |
| `-exec 命令 {} \;` | 对每个结果逐个执行命令 | `find /test -name "*.txt" -exec rm {} \;` |
| `-exec 命令 {} +` | 把多个结果合并成一条命令批量执行，效率更高 | `find /test -name "*.txt" -exec rm {} +` |
| `-ok 命令 {} \;` | 同 `-exec` 但每步都交互确认（ safer ） | `find /test -ok rm {} \;` |
| `-delete` | 直接删除查找结果 | `find /test -name "*.tmp" -delete` |

三个易错点：

1. `{}` 是占位符，代表 find 找到的每个文件；结尾必须写 `\;`（转义分号）或 `+`，漏掉会报错；
2. `\;` 是每找到一个文件就执行一次命令，`+` 是把所有找到的文件一次性传给命令，文件数量大时 `+` 明显更快；
3. `-delete` 隐含 `-depth`，不能与 `-prune` 同时用；删除前建议先用不带 `-delete` 的同样条件核对一遍。

生产事故里相当一部分批量误删就是通配符惹的祸。经典翻车：想删 `/app/logs/*`，多敲一个空格写成 `rm -rf /app/logs/ *`；更狠的是变量为空时 `rm -rf $dir/*` 展开成 `rm -rf /*`。防范三招：删除前先 `ls` 同样条件的列表核对；路径变量加引号并判空；高危操作前 `pwd` 确认自己在哪。`-delete` 的好处是只删 find 匹配到的结果，不容易被空格拆歪。

```bash
# 删除 /test 下所有 .txt 文件：先核对，再删除
find /test -type f -name "*.txt"                 # 第一步：确认范围
find /test -type f -name "*.txt" -delete         # 第二步：确认无误再删

# 把找到的文件复制到 /tmp
find /test -name "*.txt" -exec cp {} /tmp/ \;

# 对每个结果执行多条命令时，写成 sh -c
find /test -name "*.txt" -exec sh -c 'echo "$1" >> /tmp/list.txt' _ {} \;
```

## find 与 xargs 配合

`-exec` 已经能对查找结果执行命令，为什么还要 `xargs`？因为 `xargs` 的定位是"把标准输入转换成命令行参数"，它服务的对象是所有命令，不只是 find。说白了，管道递出去的是"标准输入"，而很多命令（rm、cp、kill）只认"参数"不认标准输入，这个断层就靠 xargs 来填：

```bash
echo "/tmp/a.txt /tmp/b.txt" | xargs rm -f       # rm 不能直接吃标准输入，xargs 来拼参数
find /test -name "*.txt" | xargs ls -lh          # 效果类似 -exec ls -lh {} +
```

`xargs` 与 `find` 的经典组合是处理"文件名带空格"的场景。xargs 默认按空白字符（空格、换行）分割输入，遇到 `my file.txt` 会被拆成两个参数，导致误操作：

```bash
# 错误示范：文件名含空格时会被拆错
find /data -name "*.txt" | xargs rm -f

# 正确做法：-print0 用空字符（\0）分隔，xargs -0 用空字符解析
find /data -name "*.txt" -print0 | xargs -0 rm -f
```

`xargs` 常用参数：

| 参数 | 作用 |
| --- | --- |
| `-0` | 以空字符作为输入分隔符，配合 `find -print0` 使用 |
| `-d 分隔符` | 自定义输入分隔符 |
| `-n 数量` | 每条命令最多带几个参数 |
| `-I {}` | 指定替换字符串，适合参数要插在命令中间的场景 |
| `-t` | 打印实际执行的命令（调试用） |
| `-p` | 每步执行前交互确认 |
| `-P 数量` | 并行执行多个进程，加速批量处理 |

```bash
find /test -name "*.txt" -print0 | xargs -0 -I{} cp {} /tmp/backup/
find /test -name "*.log" -print0 | xargs -0 -P 4 gzip          # 4 进程并行压缩
find /test -name "*.txt" | xargs -t rm -f                      # 先打印将执行的命令，确认无误再回车
```

`-I{}` 用起来方便，但这里有个坑：指定 `-I` 后 xargs 隐含每次只处理一行输入（等价于 `-L 1`），批量效率下降；参数需要插在命令中间时，`sh -c` 的写法有时更灵活。

### 原理解析：find 与 xargs 的数据流
{: .sec-know}

1. `find` 实时遍历目录树，把符合条件的结果逐行写入标准输出；
2. 管道把 find 的输出接到 `xargs` 的标准输入；
3. `xargs` 把收到的内容按分隔符切分成一个个参数，拼在指定命令后面执行；
4. 如果一行都没有，`xargs` 默认仍会执行一次命令（GNU xargs 可用 `-r` 禁止空执行，建议习惯性加上）；
5. `-print0` 与 `-0` 把分隔符从换行换成空字符，从而免疫文件名中的空格、换行等特殊字符。

## find 排错：Permission denied
{: .sec-ts}

`find /` 全盘查找时最常见的烦恼是刷屏的权限错误：

```console
[root@linux-node1 ~]# find / -name "*.log"
find: '/proc/1/task/1/fd': Permission denied
find: '/root/.ssh': Permission denied
...
```

处理办法有三种，按场景选用：

1. **丢弃错误输出**：只关心结果时，把标准错误写到 `/dev/null`：

```bash
find / -name "*.log" 2>/dev/null
```

顺带一提，`2>/dev/null` 把错误一并扔掉的同时也会掩盖真实问题——权限错误有时意味着路径真的配错了，先看一眼再静音不丢人。

2. **用 root 执行**：很多 `Permission denied` 只是因为当前用户没有进入目录的权限，`sudo find ...` 或以 root 登录即可解决；
3. **排除伪文件系统**：`/proc`、`/sys`、`/dev` 是内核虚拟文件系统，遍历它们既慢又无意义，用 `-prune` 剪掉：

```bash
find / \( -path /proc -o -path /sys -o -path /dev \) -prune -o -name "*.log" -print
```

此外还要能读懂 find 的另外两类报错：

| 报错 | 原因 | 处理方式 |
| --- | --- | --- |
| `find: paths must precede expression` | 路径写在了表达式后面，或表达式语法错误 | 检查路径与条件顺序、`-exec` 结尾补 `\;` |
| `find: warning: you have specified the -maxdepth option after a non-option argument` | 全局选项位置太靠后 | 把 `-maxdepth` / `-mindepth` 移到路径之后、其他条件之前 |

### 常见错误与排错
{: .sec-ts}

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| find 刷屏 `Permission denied` | 当前用户对部分目录无读权限 | 不用排查，先 `2>/dev/null` 静音 | `find / ... 2>/dev/null`，或用 root 执行 |
| 遍历 `/proc` 时 find 卡住或输出混乱 | 遍历了内核伪文件系统 | 观察输出中是否有 `/proc` 路径 | 用 `-prune` 排除 `/proc`、`/sys`、`/dev` |
| `locate` 找不到刚建的文件 | 数据库未更新 | `locate 文件名` 与 `ls` 对比 | 执行 `updatedb` 刷新数据库 |
| `xargs rm` 删错文件 | 文件名含空格被拆成多个参数 | `ls -l` 查看文件名 | 改用 `find -print0 \| xargs -0` |
| `-exec` 报 `missing argument to -exec` | 漏写转义分号 | 检查命令末尾 | 补上 `\;` 或改成 `+` |
| `-delete` 提示 `cannot delete` | 对目录无写权限或目录非空策略限制 | `ls -ld` 查看父目录权限 | 确认对父目录有 `w` 权限后重试 |

## 阶段回顾与网卡命名修改
{: .sec-sum}

### CentOS 7 网卡命名方式

| 命名 | 含义 |
| --- | --- |
| `ensxx` | 以太网（en）+ 槽位（sxx） |
| `eth0` / `eth1` | 传统以太网命名方式 |

**修改方式一：安装系统时**

在菜单界面选中 `Install CentOS 7` 后按 `Tab`，在启动参数后追加：

```bash
net.ifnames=0 biosdevname=0
```

**修改方式二：在系统中进行修改**

```bash
# ① 编辑网卡配置文件中的网卡名称信息
vim /etc/sysconfig/network-scripts/ifcfg-ens33
NAME=eth0        # net.ifnames=0
DEVICE=eth0      # biosdevname=0

# ② 重命名网卡配置文件名称
mv ifcfg-ens33 ifcfg-eth0

# ③ 修改网卡名称规则内核文件：把 net.ifnames=0 biosdevname=0 追加到 GRUB_CMDLINE_LINUX 变量后
/etc/default/grub

# ④ 使系统重新加载 grub 配置文件
grub2-mkconfig -o /boot/grub2/grub.cfg
```

> **注意：** 以上四步同样适用于 Rocky Linux / AlmaLinux 9（它们的网卡命名规则与 CentOS 7 一脉相承）。新版系统还可以通过 `nmcli connection modify "ens160" connection.id eth0` 配合 NetworkManager 管理连接名，但内核网卡名（`ip link` 看到的接口名）仍由 `net.ifnames=0` 决定。改完后建议用 `ip link` 确认接口名，`ifconfig` 在最小化安装中默认不存在。
{: .sec-pit}

网卡名由内核的命名规则决定，装系统时改内核参数最省事；系统装完再改要同时动配置文件、GRUB 和连接名，少一步重启后名字就可能弹回去。所以能赶在装系统那一步改，就别拖到后面。

## Vim 常见错误与编辑原理
{: .sec-ts}

### 两类常见错误
{: .sec-ts}

1. `vim` 命令后面一定要接文件，例如 `vim /etc/hosts`；
2. `vim` 只能编辑存在的目录中的文件（目录不存在会报错）。

### 编辑文件非正常退出的处理

**复现方法**：编辑一个文件，在没有退出前直接断开远程连接。

**Vim 编辑文件的原理：**

1. 开始利用 vim 编辑一个文件；
2. 判断编辑的文件所在目录中是否有隐藏文件（`.xxx.swp`）：
   - 有：会出现报错提示信息；
   - 没有：进入到命令模式；
3. 在命令模式下会产生临时文件；
4. 进入编辑模式对文件进行编辑；
5. 编辑完成之后确定是否正常保存退出：
   - 正常退出：编辑状态 → `esc` → 命令模式 → `:wq` 保存退出（临时文件被重命名/清理）；
   - 非正常退出：临时文件会永久保留。

**解决问题的方法：**

1. 第一个步骤：查看文件内容，按大写字母 `O`；
2. 第二个步骤：确认文件是否需要恢复：
   - 需要恢复：按大写字母 `R`，恢复文件内容；
   - 不用恢复：按大写字母 `E`，进行重新编辑；
3. 第三个步骤：将临时文件删除：
   - 按大写字母 `D` 删除文件；
   - 或者利用 `rm` 命令删除临时文件：

```bash
rm -f /test/.test.txt.swp
```

> **注意：** 只要目录中存在 `.文件名.swp` 临时文件，下次编辑该文件就会弹出恢复提示，务必在确认内容后清理掉。如果 vim 界面无响应，多数情况是误按了 `Ctrl + S`（终端流控，屏幕像卡死），按 `Ctrl + Q` 即可恢复。
{: .sec-pit}

## 查看文件属性信息

```bash
[root@linux-node1 ~]# ls /test                  # 查看目录中有什么数据信息
test01  test.txt  test2.txt

[root@linux-node1 ~]# ls /test/test.txt         # 查看目录中文件信息是否存在
/test/test.txt

[root@linux-node1 ~]# ls -l /test/test.txt      # 查看文件属性信息
-rw-r--r--. 1 root root 50 Apr  1 10:24 /test/test.txt

[root@linux-node1 ~]# ls -ld /test/             # 查看目录属性信息
drwxr-xr-x. 3 root root 59 Apr 11 10:23 /test/

[root@linux-node1 ~]# ls -la /test/             # 查看目录中所有数据信息，包含隐藏文件
total 8
drwxr-xr-x.  3 root root  59 Apr 11 10:23 .
dr-xr-xr-x. 21 root root 282 Mar 29 16:21 ..
drwxr-xr-x.  3 root root 100 Apr  1 11:00 test01
-rw-r--r--.  1 root root  50 Apr  1 10:24 test.txt
-rw-r--r--.  1 root root  18 Apr 11 10:23 test2.txt
```

**企业中的一个实际问题**：多个运维人员共同维护服务器，下班前交代"把 `/test` 目录中最新的数据文件继续编辑好"——此时按时间排序找出最新文件：

```bash
ls -ltr /etc/      # 按照时间进行排序显示数据信息，并且是反向排序（最新的在最后）
```

`-t` 按时间排序、`-r` 反向，组合起来最新的文件永远在最后一行——排在眼睛最好找的位置，这就是它成为运维口头禅的原因。

## 查看文件内容信息

### cat

```bash
[root@linux-node1 ~]# cat /test/test.txt              # 查看单个文件
hello world
test data 01
test data 02

[root@linux-node1 ~]# cat /test/test.txt /test/test2.txt   # 查看多个文件
hello world
test data 01
test data 02
test01
test02

[root@linux-node1 ~]# cat -n /test/test.txt           # 查看文件时显示每行的行号
     1	hello world
     2	test data 01
     3	test data 02
```

`cat` 的常用参数：

| 参数 | 作用 |
| --- | --- |
| `-n` | 对所有行输出行号 |
| `-b` | 类似 `-n`，但空白行不编号 |
| `-A` | 显示不可见字符（行尾 `$`、制表符 `^I` 等），排查格式问题很有用 |

`cat` 的名字来自 concatenate（拼接），本职是把多个文件串起来输出，所以能接多个参数。顺带认识三个相似命令：`tac` 按行倒序输出，`rev` 把每行字符倒序，`nl` 相当于 `cat -n`。

### less / more

```bash
less /etc/services     # 类似于看书，一点点查看文件内容
```

| 操作 | 快捷键 |
| --- | --- |
| 向下逐行显示 | 回车 |
| 向下逐页显示 | 空格 |
| 向上逐行显示 | 方向键上 |
| 向上逐页显示 | 字母 `b` |
| 搜索信息 | `/搜索的字符串信息` |
| 结束查看 | 按 `q` |

```bash
[root@linux-node1 ~]# less -N /etc/services      # -N 显示行号
      1 # /etc/services:
      2 # $Id: services,v 1.55 2013/04/14 ovasik Exp $
      3 #
      4 # Network services, Internet style
      5 # IANA services version: last updated 2013-04-10
```

```bash
more /etc/services     # 同样是一点点查看文件内容
```

| 操作 | 快捷键 |
| --- | --- |
| 向下逐行显示 | 回车 |
| 向下逐页显示 | 空格 |
| 向前 / 向后翻页 | 字母 `f` / `b` |

> **注意：** `less` 支持上下翻页、向前搜索，功能是 `more` 的超集；`more` 的优点是读完即退出，适合管道结尾。查看大文件务必用 `less`，不要用 `vim`（会把整个文件读进内存）。
{: .sec-pit}

less 还有个省心特性：打开文件只加载当前屏幕附近的内容，几个 G 的日志也能秒开。`G` 跳到末尾、`F` 进入实时追踪（类似 tail -f，按 Ctrl+C 退回）。排查大日志时先 less"翻"后 grep"搜"，比一上来就全文 grep 更快定位。

### head / tail

```bash
head    # 查看前几行
tail    # 查看后几行
```

| 参数 | 作用 |
| --- | --- |
| `head -n 20 文件` | 查看前 20 行 |
| `tail -n 20 文件` | 查看后 20 行 |
| `tail -f 文件` | 持续追踪文件新增内容（文件被删除/移动后需重新追踪） |
| `tail -F 文件` | 追踪文件，即使被重建也继续追踪（日志轮转场景首选） |
| `tail -n +5 文件` | 从第 5 行开始看到结尾 |

`-f` 与 `-F` 的差异来自实现方式：`-f` 是对文件描述符持续读取，文件被日志轮转 `mv` 走后，fd 指向的还是那个被改名的旧文件，新日志一行也看不到；`-F`（等价于 `-f --follow=name --retry`）改为周期性检查文件名，目标被重建后能自动跟上。所以追踪会轮转的日志一律用 `-F`。顺带记两个易混写法：`-n +K` 表示"从第 K 行开始"，`-n K` 是"取最后 K 行"；`head -n 100 | tail -n 20` 可以取出第 81-100 行。

## 不打开编辑器直接写入文件

### 添加单行内容

```bash
echo "test" >> /test/test.txt
```

实际操作中还有个高频困惑：`sudo echo "内容" > /etc/sysctl.conf` 依然报 Permission denied。原因很简单，`sudo` 只提升了 `echo`，重定向 `>` 是当前 shell 在执行，用的还是普通用户身份。解决办法是借道 tee：`echo "内容" | sudo tee /etc/sysctl.conf >/dev/null`，或者干脆 `sudo -i` 切过去再写。

**echo 命令用法说明：**

1. 在屏幕上输出一段文本信息；

2. 在屏幕上输出 1 2 3 …… 100 的数字信息。

**输出连续序列：**

```bash
[root@linux-node1 ~]# echo {1..100}
1 2 3 4 5 6 7 8 9 10 ... 98 99 100

[root@linux-node1 ~]# echo {01..100}
001 002 003 004 005 006 007 008 009 010 ... 098 099 100
```

`echo` 输出默认自带换行，不要换行用 `-n`；解析 `\n`、`\t` 转义要加 `-e`。花括号展开发生在变量展开之前，所以 `{}` 里不能直接放变量，`echo {$a..$b}` 不会按预期展开，这种场景用 `seq $a $b` 代替。

**输出不连续序列：**

```bash
# 不连续但有规律：显示 1..10 的奇数 / 偶数
[root@linux-node1 ~]# echo {01..10..2}
01 03 05 07 09
[root@linux-node1 ~]# echo {02..10..2}
02 04 06 08 10

# 不连续且无规律
mkdir -p /test/test01/test02/{www,bbs,blog}
```

**练习题**：在 `/test` 目录下面创建 20 个文件，文件名为 `test01`、`test02` …… `test20`（提示：`touch` 配合 `{}` 序列）。

### 添加多行内容

```bash
[root@linux-node1 ~]# cat /test/test.txt
hello world
test data 01
test data 02

[root@linux-node1 ~]# cat >> /test/test.txt <<EOF
> test01
> test02
> test03
> EOF

[root@linux-node1 ~]# cat /test/test.txt
hello world
test data 01
test data 02
test01
test02
test03
```

结束符可以换成任意字符串，只要前后一致：

```bash
[root@linux-node1 ~]# cat >> /test/test.txt <<end
> test04
> test05
> end

[root@linux-node1 ~]# cat /test/test.txt
hello world
test data 01
test data 02
test01
test02
test03
test04
test05
```

> **注意：** here document 的结束符（如 `EOF`）必须顶格写在行首，前面不能有任何空格，否则会被当作普通内容继续读入。如果内容里含 `$变量`、反引号等会被 shell 展开，把起始定界符写成带引号的 `<<"EOF"` 即可禁止展开。`<<-EOF` 只会去除行首的制表符（不是空格），适合缩进的脚本场景；普通场景直接顶格写结束符即可。
{: .sec-pit}

## 过滤筛选文件内容：三剑客

| 命令 | 定位 | 擅长 |
| --- | --- | --- |
| `grep` | 老三 | 过滤筛选信息 |
| `sed` | 老二 | 修改替换文件内容，擅长对文件中的行进行操作 |
| `awk` | 老大 | 统计分析文件内容，擅长对文件中的列进行操作 |

### grep 过滤

先准备一个测试文件：

```bash
[root@linux-node1 ~]# cat >> /test/test.txt <<EOF
> server01
> dev01
> ops01
> server02
> dev02
> ops02
> EOF

[root@linux-node1 ~]# cat /test/test.txt
server01
dev01
ops01
server02
dev02
ops02
```

| 需求 | 命令 | 说明 |
| --- | --- | --- |
| 筛选出含有 `server` 的信息 | `grep "server" /test/test.txt` | 基础过滤 |
| 筛选 `dev` 并同时显示上一行 | `grep -B 1 "dev" /test/test.txt` | `-B` before |
| 筛选 `dev` 并同时显示下一行 | `grep -A 1 "dev" /test/test.txt` | `-A` after |
| 筛选 `dev` 并同时显示上下各一行 | `grep -C 1 "dev" /test/test.txt` | `-C` context |
| 统计 `dev` 在文件中出现了几次 | `grep -c "dev" /test/test.txt` | `-c` count |

```bash
[root@linux-node1 ~]# grep "server" /test/test.txt
server01
server02

[root@linux-node1 ~]# grep -B 1 "dev" /test/test.txt
server01
dev01
--
server02
dev02

[root@linux-node1 ~]# grep -A 1 "dev" /test/test.txt
dev01
ops01
--
server02
dev02

[root@linux-node1 ~]# grep -C 1 "dev" /test/test.txt
server01
dev01
ops01
server02
dev02
ops02
```

grep 的其他高频参数：`-i` 忽略大小写、`-v` 反向匹配、`-n` 显示行号、`-o` 只输出匹配部分、`-r` 递归查找目录、`-E` 使用扩展正则。

### sed / awk 过滤

```bash
[root@linux-node1 ~]# sed -n "/server/p" /test/test.txt
server01
server02
```

- `p`：print，将过滤信息输出；
- `-n`：取消原文件的所有内容输出（取消默认输出）。

```bash
[root@linux-node1 ~]# awk "/server/" /test/test.txt
server01
server02
```

awk 括号里的模式省略 action 时默认打印整行，相当于 grep，`awk "/server/"` 就是最简形式。awk 默认按连续空白切列，`$1`、`$2`……依次取列，这是"列找 awk"的原因。

## 修改文件内容

### sed：真正修改文件内容

需求：将 `test.txt` 中所有 `server` 替换为 `python`。

Vim 中的等价写法是 `:%s#server#python#g`，命令行中用 sed：

```bash
sed 's#server#python#g' /test/test.txt
```

```bash
[root@linux-node1 ~]# sed 's#server#python#g' /test/test.txt
python01
dev01
ops01
python02
dev02
ops02

[root@linux-node1 ~]# cat /test/test.txt        # 不加 -i 时，原文件内容并没有变化
server01
dev01
ops01
server02
dev02
ops02

[root@linux-node1 ~]# sed -i 's#server#python#g' /test/test.txt

[root@linux-node1 ~]# cat /test/test.txt
python01
dev01
ops01
python02
dev02
ops02
```

> **注意：** sed 默认只把替换结果输出到屏幕，加上 `-i` 才会真正写回文件。批量处理前建议先加 `-i.bak` 生成备份，确认无误再清理备份文件。
{: .sec-pit}

`-i` 的实现原理是读入文件、处理后写到临时文件、再替换原文件——所以大文件注意内存占用，且替换后文件的 inode 会变（旧文件被新文件顶替），原本指向该 inode 的硬链接关系随之失效。想确认的话，前后各执行一次 `ls -i` 对比。

### tr：假装修改文件内容

需求：把 `test.txt` 中所有 `python` 修改替换为 `server`。

```bash
[root@linux-node1 ~]# tr "python" "server" </test/test.txt
server01
dev01
ops01
server02
dev02
ops02

[root@linux-node1 ~]# cat /test/test.txt        # 原文件内容并没有变化
python01
dev01
ops01
python02
dev02
ops02
```

**tr 用法：**

```bash
[root@linux-node1 ~]# echo 123|tr "123" "abc"
abc
```

`tr` 处理的是字节流，只能接在管道或重定向后面，不能把文件名当参数——这也是它总写 `< 文件` 的原因。顺带记两个常用选项：`-s` 把连续重复字符压缩成一个，`-d` 删除指定字符。

配合标准输入重定向：

```bash
[root@linux-node1 ~]# tr "123" "abc" < /test/test01.txt
abc
[root@linux-node1 ~]# cat /test/test01.txt
123
```

## 自测题
{: .sec-prac}

1. `find /var/log -name "*.log" -mtime +30` 查找的是什么文件？`+30` 与 `-30` 的区别是什么？
2. 为什么 `find /data -name "*.txt" | xargs rm -f` 对文件名带空格的文件会出错？正确写法是什么？
3. `find /test -name "*.txt" -exec rm {} \;` 与 `find /test -name "*.txt" -exec rm {} +` 有什么区别？
4. `locate` 查找不到刚刚创建的文件，可能是什么原因？如何解决？
5. `which cat`、`whereis cat`、`type cat` 三条命令的输出有什么不同？
6. `find /data -name "*.txt" -exec rm {} \;` 与 `find /data -name "*.txt" -delete`，哪个更容易被文件名里的空格坑到？为什么？

> **答案：** 1. 查找 30 天以前内容被修改过的 `.log` 文件；`+30` 表示"超过 30 天"（更早），`-30` 表示"30 天以内"（更近），不带符号表示恰好第 30 天。2. `xargs` 默认按空白字符分割输入，`my file.txt` 会被拆成 `my` 和 `file.txt` 两个参数；正确写法是 `find /data -name "*.txt" -print0 | xargs -0 rm -f`。3. `\;` 对每个文件执行一次 `rm`，文件多时进程开销大；`+` 把所有文件合并成一条 `rm` 命令执行，效率更高（超出参数长度上限时会自动分批）。4. `locate` 查询的是 `updatedb` 生成的数据库，存在延迟；执行 `updatedb` 刷新后再查。5. `which` 只给 `PATH` 中第一个匹配的可执行文件路径；`whereis` 额外给出 man 页等路径；`type` 判断命令身份（内部命令 / 外部命令 / 别名 / 函数）。6. 前者。xargs 不加 `-0` 时按空白拆分输入，带空格的文件名会被拆成多个参数导致误删；`-delete` 由 find 自己删除匹配结果，天然不受文件名里的空白影响。

## 课后练习
{: .sec-prac}

1. `tail` 命令参数 `-f` 与 `-F` 的区别；
2. 思考 `tr` 命令替换信息的原理：为什么替换后内容会"乱"。

## 小结
{: .sec-sum}

1. CentOS 7 想把 `ensxx` 改回 `eth0`，需要同时改网卡配置文件名、配置文件内的 `NAME`/`DEVICE`、grub 启动参数，并执行 `grub2-mkconfig` 重新生成配置。
2. Vim 非正常退出会留下 `.文件名.swp` 临时文件，下次打开时可按 `O` 查看、`R` 恢复、`E` 重新编辑、`D` 删除临时文件，也可以直接 `rm -f .xxx.swp`。
3. 看属性用 `ls -l` / `ls -ld` / `ls -la`，找最新文件用 `ls -ltr`；看内容用 `cat`、`cat -n`、`less -N`、`more`、`head`、`tail`。
4. 不打开编辑器写文件：单行用 `echo "内容" >> 文件`，多行用 `cat >> 文件 <<EOF ... EOF`；`{}` 序列可以快速生成连续/不连续的字符串。
5. 三剑客定位不同：grep 负责过滤筛选，sed 擅长按行处理与替换，awk 擅长按列统计；sed 与 awk 做过滤时分别是 `sed -n "/内容/p"` 与 `awk "/内容/"`。
6. `sed -i` 才会真正写回文件，`tr` 只把替换结果输出到屏幕且不改变原文件。
7. 定位文件有四个层次：`type` 判断命令身份，`which` 查 `PATH` 中的可执行文件，`whereis` 连手册一起给，`locate` 靠数据库全盘秒搜但不实时，`find` 实时精确遍历。
8. `find` 的条件体系覆盖名称（`-name` / `-iname`）、类型（`-type`）、时间（`-mtime` / `-ctime` / `-atime` / `-newer`）、大小（`-size`）、属主（`-user` / `-nouser`）、权限（`-perm`）、层级（`-maxdepth` / `-mindepth`），动作有 `-exec` / `-ok` / `-delete`。
9. `find -print0 | xargs -0` 是处理特殊文件名（含空格、换行）的标准姿势；`-exec {} +` 是提升批量执行效率的首选。
10. find 遇到 `Permission denied` 时：`2>/dev/null` 静音、root 执行、`-prune` 排除 `/proc`、`/sys`、`/dev` 三件套按需选用；静音之前先看一眼错误，别把真问题也丢了。
11. 批量误删多数源于通配符或空变量：删除前 `ls` 预演、变量加引号判空、root 下慢一拍，比事后恢复便宜得多。

## 相关阅读

- [基础知识回顾（上）](/posts/linux-fileattr-01/)

- [文件属性与 inode](/posts/linux-fileattr-03/)

- [文件属性进阶](/posts/linux-fileattr-04/)

- [sed 命令详解](/posts/linux-textproc-01/)

- [awk 命令详解](/posts/linux-textproc-02/)



{% endraw %}
