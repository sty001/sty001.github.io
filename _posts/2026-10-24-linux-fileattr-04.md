---
title: "04-文件属性进阶"
date: 2026-10-24 10:30:00 +0800
categories: [软件, Linux, 03-文件属性与正则表达式]
tags: [Linux, 03-文件属性与正则表达式]
slug: "linux-fileattr-04"
---

{% raw %}
这一篇收尾文件属性章节：find 的进阶查找（按大小、层级、权限）、目录结构查看命令 `tree`、tar 的压缩解压与排除、文件权限的数值换算与 `chmod` / `umask` / `chown` 完整用法、SUID/SGID/Sticky 三种特殊权限、`chattr` 属性锁与 ACL 访问控制，以及系统用户的分类与 uid 规则、inode / block 概念和三种时间。把这一篇啃完，文件属性的知识就成体系了。

## 课前回顾

| 主题 | 要点 |
| --- | --- |
| 文件索引节点 | inode |
| 文件的数据类型 | `-`（纯文本文件、二进制文件、数据文件）、`d`、`l`、`b`/`c`、`s` |
| 文件的权限位 | 9 位（实际会看到 12 位，含特殊权限位） |
| 其他属性 | 硬链接数、属主、属组、大小信息、修改时间 |
| 相关命令 | `locate` + `updatedb`、`which`、`whereis`、`find 路径 -type 类型 -name "文件名*"` |

## find 命令查找信息补充

```bash
# 精确查找
find 路径信息 -type 文件类型 -name "文件名"

# 模糊查找
find 路径信息 -type 文件类型 -name "文件名*"
find 路径信息 -type 文件类型 -name "*文件名"
find 路径信息 -type 文件类型 -name "文*件名"

# 忽略大小写查找
find 路径信息 -type 文件类型 -iname "文件名*"
```

### 根据数据大小查找

```bash
find /test -type f -size +100     # 找出大于 100K 的文件
find /test -type f -size -100     # 找出小于 100K 的文件
find /test -type f -size +1M      # 找出大于 1M 的文件
```

注意这里 `+100` 不带单位时按 512 字节块算，是 find 系列最反直觉的默认值，写具体数字务必带 `c`/`k`/`M`。另外 `-maxdepth` 除了限定范围还有性能意义：全盘 find 最慢的就是深度遍历，能确定文件大致位置就先用它圈住范围。

`find -size` 支持的单位：

| 后缀 | 含义 | 是否推荐 |
| --- | --- | --- |
| `b` | 512-byte blocks（不写后缀时的默认值） | — |
| `c` | bytes 字节 | 推荐 |
| `w` | two-byte words 双字节 | — |
| `k` | Kilobytes（1024 bytes） | 推荐 |
| `M` | Megabytes（1048576 bytes） | 推荐 |
| `G` | Gigabytes（1073741824 bytes） | 推荐 |

### 根据目录层级查找

```bash
[root@linux-node1 test01]# find /test -type f -name "Test*"
/test/test01/Test.txt
/test/Test.txt

[root@linux-node1 test01]# find /test -maxdepth 1 -type f -name "Test*"
/test/Test.txt

[root@linux-node1 test01]# find /test -maxdepth 2 -type f -name "Test*"
/test/test01/Test.txt
/test/Test.txt
```

> **注意：** `-maxdepth` 这类选项必须放在 `-type`、`-name` 等其他参数**之前**，否则会收到警告：
>
> ```console
> [root@linux-node1 test01]# find /test -type f -name "Test*" -maxdepth 1
> find: warning: you have specified the -maxdepth option after a non-option argument -type, but options are not positional (-maxdepth affects tests specified before it as well as those specified after it).  Please specify options before other arguments.
> /test/Test.txt
> ```

### 根据权限查找（-perm）

```bash
find /test -maxdepth 1 -type f -perm 644     # 权限恰好等于 644
find / -type f -perm -4000                   # 带 SUID 位的文件（-4000 表示必须包含这些权限位）
find / -type f -perm -0002                   # 其他人可写的危险文件
```

安全基线检查常用一条组合：`find / -type f \( -perm -0002 -o -perm -0020 \) -user root`，找 root 拥有但组、他人可写的文件——这类文件一旦被低权限用户改写就是提权隐患。

`-perm` 的三种语义：

| 写法 | 含义 |
| --- | --- |
| `-perm 644` | 权限位恰好等于 644，一位不差 |
| `-perm -644` | 包含 644 的全部权限位（至少具备，可以更多） |
| `-perm /644` | 包含 644 中任意一位即命中 |

其余按时间（`-mtime` / `-ctime` / `-atime` / `-newer`）、按属主（`-user` / `-nouser`）的查找参数，以及与 `xargs` 的配合、`Permission denied` 的排错，已在 基础知识回顾（下） 的"find 命令参数大全"中完整展开，此处不再重复。

## 显示目录结构信息

```bash
tree /test          # 显示指定目录中的所有数据和所有结构信息
tree -L 2 /         # 查看目录结构层级信息（这里只显示 2 层）
tree -d /test       # 只显示目录结构信息
```

> **注意：** `tree` 不在最小化安装的默认软件包中，CentOS 7 用 `yum install -y tree`，Rocky Linux / AlmaLinux 9 用 `dnf install -y tree`。常用参数还有 `-h`（人类可读的大小）、`-f`（显示完整路径）、`-p`（显示权限）。

树形输出在写文档、给同事讲结构时很直观；没有 tree 的最小化环境里，`ls -R` 是粗糙替代品，层级一多输出就乱了。

## 文件的压缩与解压：tar

### 压缩命令语法

```bash
tar zcvf /test/test.tar.gz  指定要压缩的数据文件
```

| 参数 | 含义 |
| --- | --- |
| `z` | 压缩的方式为 gzip |
| `c` | 创建压缩包文件 |
| `v` | 显示压缩的过程 |
| `f` | 指定压缩包文件路径信息 |

```bash
[root@linux-node1 test]# tar zcvf /test/test.tar.gz /test/services
tar: Removing leading `/' from member names
/test/services
```

### 解压与检查

```bash
tar xvf /test/test.tar.gz          # 解压数据包
tar tf  /test/test.tar.gz          # 不解压的情况下查看压缩包里面的数据
```

确认解压后的文件和源文件是否一致：

1. 看文件的大小和时间信息；
2. 利用 `vimdiff` 或者 `diff` 比较两个文件内容是否有区别。

更严格的做法是校验 md5：打包前 `find . -type f -exec md5sum {} \; > /tmp/md5.before`，解压后同样算一遍，再 diff 两份清单。

### 压缩过程信息说明

```bash
[root@linux-node1 test]# tar zcvf test.tar.gz /test/services
tar: Removing leading `/' from member names     # 默认将压缩时绝对路径的根信息移除
/test/services                                   # 需要压缩的文件数据信息
```

使用相对路径压缩就不会有这条提示：

```bash
[root@linux-node1 test]# tar zcvf test.tar.gz ./services
./services
[root@linux-node1 test]# tar tf test.tar.gz
./services
```

> **注意：** 压缩时默认会把绝对路径最前面的 `/` 去掉，这是为了避免解压时覆盖原文件。想省掉提示就用相对路径压缩。

其他常用压缩算法参数（按压缩率与速度权衡选用）：

| 参数 | 算法 | 说明 |
| --- | --- | --- |
| `z` | gzip | 最通用，兼容性最好，`.tar.gz` |
| `j` | bzip2 | 压缩率更高、更慢，`.tar.bz2` |
| `J` | xz | 压缩率最高、最慢，`.tar.xz` |
| `--zstd` | zstd | 速度与压缩率均衡，需要 GNU tar 1.31 以上（Rocky/Alma 9 自带版本支持，CentOS 7 的 tar 1.26 不支持，需用 `-I zstd`） |

两个实战技巧值得记。一是大目录打包配合 `-C`：`tar zcf /tmp/etc.tar.gz -C / etc`，先切到 `/` 再打包 `etc`，压缩包里就是干净的相对路径，解压不带出一长串目录层级。二是真正的增量备份用快照文件：`tar czf inc.tar.gz -g /tmp/etc.snap /etc`，tar 把每个文件的 mtime 记在快照里，第二次执行只打包有变化的文件，快照本身要妥善保存。

### 压缩时排除指定数据

| 参数 | 作用 |
| --- | --- |
| `--exclude=PATTERN` | exclude files, given as a PATTERN，排除指定的单个文件数据 |
| `-X, --exclude-from=FILE` | exclude patterns listed in FILE，批量排除多个文件 |

**批量排除的第一个步骤：编写排除文件**

```bash
[root@linux-node1 test]# vim /tmp/exclude.txt
/test/test.txt
/test/test.avi
/test/test.jpg
/test/test.png
```

**第二个步骤：执行命令进行批量排除**

```bash
[root@linux-node1 test]# tar zcvf /tmp/test05.tar.gz /test --exclude-from=/tmp/exclude.txt
tar: Removing leading `/' from member names
/test/
/test/services
/test/test01/
```

> **注意：** 排除时必须把路径写对——压缩命令用的是绝对路径，排除文件里也要用绝对路径；命令用相对路径，排除项也要写成相对路径。

排除规则支持通配符，`--exclude="*.log"` 一次排一类文件；多个排除条件就多写几个 `--exclude`，不用合并。排错时 `tar tf 包` 核对结果最直观。

```bash
# 全部采用绝对路径
[root@linux-node1 /]# tar zcvf /tmp/test03.tar.gz /test --exclude=/test/test.txt
tar: Removing leading `/' from member names
/test/
/test/services
/test/test01/

# 全部采用相对路径
[root@linux-node1 /]# tar zcvf /tmp/test04.txt.tar.gz ./test --exclude=./test/test.txt
./test/
./test/services
./test/test01/
```

## 文件权限

### 权限的数值

| 权限 | 字母 | 数值 |
| --- | --- | --- |
| 读 | `r` read | 4 |
| 写 | `w` write | 2 |
| 执行 | `x` execute | 1 |
| 无权限 | `-` | 0 |

为什么是 421 而不是 123？二进制占位设计：读=100、写=010、执行=001，三段互不冲突，任意组合相加都能唯一还原出权限组合，八进制一位正好表达 0-7 的全部组合。

### 权限赋予给谁

| 对象 | 类比 |
| --- | --- |
| 属主信息（文件所有者） | 监护人 |
| 属组信息 | 亲人 |
| 其他用户 | 其他所有人 |

以 644 权限为例：

```text
属主            属组     其他用户
r(4)w(2)-(0)=6  r(4)--=4 r(4)--=4
```

**练习：**

| 权限字符表示 | 数值表示 |
| --- | --- |
| `rwx` | 7 |
| `rw--w---x` | 621 |
| `rwx-wx---` | 730 |
| `r---wx-w-` | 432 |

### chmod：数字法

`chmod` 用三位八进制数字分别指定属主、属组、其他用户的权限，是脚本和批量处理中最常用的写法：

```bash
chmod 644 /test/test.txt          # 属主读写，属组和其他用户只读
chmod 755 /test/script.sh         # 属主读写执行，属组和其他用户读和执行
chmod 600 ~/.ssh/id_rsa           # 私钥文件必须收紧权限，否则 ssh 拒绝使用
chmod -R 755 /data/www            # -R 递归修改目录下所有内容
```

`chmod 600 ~/.ssh/id_rsa` 这一行的背后是 ssh 的硬性检查：私钥对组或其他人可读都会被拒绝使用，报错信息是 UNPROTECTED PRIVATE KEY FILE——遇到这个报错别去改 ssh 配置，先把权限收成 600。

### chmod：字母法

字母法不换算数字，直接指定"给谁、加什么、减什么"，可读性更强：

| 组成部分 | 可选值 | 说明 |
| --- | --- | --- |
| 对象 | `u`（属主）、`g`（属组）、`o`（其他人）、`a`（所有人，省略对象时默认 `a`） | 权限赋予给谁 |
| 操作 | `+`（增加）、`-`（去除）、`=`（精确设定，先清空再赋予） | 怎么改 |
| 权限 | `r`、`w`、`x`、`X`、`s`、`t` | 改哪些位 |

```bash
chmod u+x /test/script.sh                  # 只给属主加执行权限
chmod g-w,o=r /test/test.txt               # 属组去掉写，其他人精确设为只读
chmod a-x /test/test.txt                   # 去掉所有人的执行权限（等价 chmod -x）
chmod u=rwx,g=rx,o=rx /test/script.sh      # 三段精确设定，等价于 chmod 755
chmod -R u+X /data                         # 大写 X：只给目录和本来就有执行位的文件加 x
```

> **注意：** 大写 `X` 与 `x` 的区别是高频考点：`x` 无条件给执行位，`X` 只对目录、或已经具有执行位的文件生效。递归授权时用 `chmod -R u+X`，可以避免把一堆普通文件误设为可执行。

### 数字法与字母法互算

每一位权限的数值对照（背下来即可条件反射）：

| 字符 | 数值 | 字符 | 数值 |
| --- | --- | --- | --- |
| `---` | 0 | `r-x` | 5 |
| `--x` | 1 | `rw-` | 6 |
| `-w-` | 2 | `rwx` | 7 |
| `-wx` | 3 | — | — |
| `r--` | 4 | — | — |

互算示例：

```bash
chmod 750 /data        # 等价于 chmod u=rwx,g=rx,o= /data
chmod 640 /data        # 等价于 chmod u=rw,g=r,o= /data
```

拿不准互算结果时反向验证一下：`stat -c '%a' 文件` 输出八进制权限，和预期对一眼即可。习惯上 644 配文本文件、600 配私密文件（密钥、密码文件）、755 配目录和脚本，背下这三组就能覆盖日常。

### umask：默认权限是怎么来的

新建文件和目录时，权限不是凭空来的，而是"默认最大权限减去 umask"：

1. 文件的默认最大权限是 `666`（`rw-rw-rw-`，不默认给执行位）；
2. 目录的默认最大权限是 `777`（`rwxrwxrwx`，目录需要 `x` 才能进入）；
3. 实际权限 = 默认权限 按位与上 umask 取反，即 `实际权限 = 默认权限 & ~umask`。

推导过程：

| umask | 文件权限推导 | 文件结果 | 目录权限推导 | 目录结果 |
| --- | --- | --- | --- | --- |
| `022` | `666 & ~022` = `rw- & (rwx r-x r-x)` | `644` | `777 & ~022` | `755` |
| `002` | `666 & ~002` | `664` | `777 & ~002` | `775` |
| `027` | `666 & ~027` | `640` | `777 & ~027` | `750` |
| `077` | `666 & ~077` | `600` | `777 & ~077` | `700` |

> **注意：** 千万不能按十进制减法算：`666 - 027` 会算出 `639`，这是错的。正确做法是逐段按位与：umask 第三位 `7` 的二进制是 `111`，与任何默认位相与都清零，所以其他人什么权限都没有，结果是 `640`。同理，可执行文件（如编译产物、脚本）创建时内核按 `777 & ~umask` 计算，umask 022 时得到 `755`。

普通文件默认不给执行位是刻意的安全设计：解释器脚本、下载来的数据文件，万一内容有恶意也不至于直接能跑。真需要执行时再 `chmod +x`，这一步等于人工确认过"这个东西我就是要当程序跑"。实际敲一遍就明白：`umask 022` 下 `touch a.txt && mkdir b && ls -l`，一个 644 一个 755，差异全在"目录天生要 x"这一点上。

umask 的查看与设置：

```bash
umask                 # 查看当前 umask，如 0022
umask -S              # 符号方式显示，如 u=rwx,g=rx,o=rx
umask 022             # 设置当前 shell 的 umask
umask 077             # 设置更严格的值（适合存放敏感数据的目录）
```

> **注意：** umask 是 shell 进程的属性，只影响该 shell 及其子进程新建的文件。永久生效要写入 `/etc/profile`（全局）或 `~/.bashrc`（单用户），修改后需重新登录或 `source` 才生效。root 默认 umask 通常是 `022`；采用 user private group 机制的发行版，普通用户默认是 `002`，便于同组协作。

### chown 与 chgrp：修改属主与属组

| 命令 | 作用 | 示例 |
| --- | --- | --- |
| `chown 属主 文件` | 改属主 | `chown www /data/index.html` |
| `chown 属主:属组 文件` | 同时改属主和属组 | `chown www:www /data/index.html` |
| `chown -R 属主:属组 目录` | 递归修改 | `chown -R nginx:nginx /data/wwwroot` |
| `chgrp 属组 文件` | 只改属组 | `chgrp dev /data/app.log` |

两条规则：

1. 只有 root 能改文件的属主；普通用户只能把文件属组改成自己所属的组；
2. 属组必须真实存在（`getent group 组名` 可确认），否则报 `invalid group`。

生产上改属主前先确认服务实际用哪个用户跑（`ps -eo user,cmd | grep nginx`），改错了服务立刻读不了文件，比权限位配错还难排查。

```bash
[root@web01 ~]# chown -R www:www /data/wwwroot
[root@web01 ~]# ls -ld /data/wwwroot
drwxr-xr-x. 2 www www 60 Oct 24 09:00 /data/wwwroot
```

### 特殊权限位：SUID / SGID / Sticky Bit

权限位实际有 12 位：前面的 3 位是特殊权限，后面的 9 位才是常规 rwx。

| 特殊权限 | 数字 | 字母写法 | 作用对象 | 效果 |
| --- | --- | --- | --- | --- |
| SUID | 4000 | `u+s` | 可执行文件 | 执行时以文件**属主**的身份运行 |
| SGID | 2000 | `g+s` | 可执行文件 / 目录 | 文件：以文件**属组**身份运行；目录：新建文件自动继承目录属组 |
| Sticky | 1000 | `+t` | 目录 | 目录内只有文件属主（或 root）能删除自己的文件 |

在 `ls -l` 中的显示位置与效果：

| 权限位 | 有执行位时 | 无执行位时 |
| --- | --- | --- |
| 属主位上的 SUID | `s`（如 `-rwsr-xr-x`） | `S`（异常状态，SUID 未生效） |
| 属组位上的 SGID | `s`（如 `-rwxrwsr-x`） | `S`（异常状态） |
| 其他位上的 Sticky | `t`（如 `drwxrwxrwt`） | `T`（异常状态） |

设置与查看：

```bash
chmod 4755 /usr/bin/myapp        # SUID + 755，ls -l 显示 -rwsr-xr-x
chmod 2755 /data/project         # SGID 目录：drwxr-sr-x，组内共享协作
chmod 1777 /tmp                  # Sticky：drwxrwxrwt，人人可写但只能删自己的
chmod u+s /usr/bin/myapp         # 等价的字母写法
chmod g+s /data/project
chmod +t /data/public

find / -type f -perm -4000       # 审计全系统 SUID 文件
find / -type d -perm -2000       # 审计 SGID 目录
find / -type d -perm -1000       # 审计 Sticky 目录
```

SUID 的典型用例是 `passwd`：`/usr/bin/passwd` 属主是 root 且带 SUID，普通用户执行它时就以 root 身份改写 `/etc/shadow`，从而完成改密码。SGID 目录的典型用例是项目共享目录：`/data/project` 设为 2775 且属组为 `dev`，任何人在里面新建的文件都自动属于 `dev` 组，组员彼此可读写。Sticky 的典型用例是 `/tmp`：人人可写，但谁也不能删别人的文件。

SUID 加在目录上没有意义（会被忽略），SGID 要加在目录上才实现继承属组，Sticky 只对目录有效——记不住就看"作用对象"那一列。

### 辨析：SUID 与 sudo

两者都涉及"以别人身份执行"，机制完全不同。SUID 是文件属性，任何能执行该文件的人都固定以属主身份运行，控制粒度只有"能/不能执行"，程序内部不再做身份判断；sudo 是授权框架，按 `/etc/sudoers` 的规则逐条校验谁可以以谁的身份执行哪些命令，全程留审计日志，还能要求输密码。说白了，SUID 是"文件说了算"，sudo 是"规则说了算"。原则很明确：能用 sudo 解决的场景就不要自制 SUID 程序，SUID 面越少，攻击面越小。审计发现多余的 SUID 文件，先 `rpm -qf 路径` 查归属包，确认不是系统自带再处理。

**安全风险表：**

| 风险点 | 原理 | 防范措施 |
| --- | --- | --- |
| SUID shell | 给 `/bin/bash` 等加 SUID 后，任何人执行它直接获得 root 权限，等于送出演权 | 永远不要给 shell、编辑器、解释器加 SUID |
| SUID 程序漏洞 | SUID 程序以 root 运行，一旦有命令注入、路径劫持漏洞即被利用提权 | 最小化 SUID 程序数量，关注安全更新 |
| 来历不明的 SUID 文件 | 入侵者常留后门：给某程序加 SUID 方便再次提权 | 定期 `find / -perm -4000 -type f` 审计，与基线比对 |
| SGID 目录属组漂移 | 目录属组被改成错误组后，新文件继承错误权限 | 定期检查共享目录属组 |
| Sticky 缺失的公共目录 | 公共可写目录没有 `t`，任何人都能删他人的文件 | `/tmp` 类目录保持 1777 |

### chattr 与 lsattr：给文件上锁

`chattr` 修改的是文件在文件系统中的扩展属性，比权限位更底层、更硬：

| 属性 | 效果 | 典型场景 |
| --- | --- | --- |
| `+i` | 不可变：不能修改、删除、重命名、建链接（root 也不行，需先解锁） | 保护关键配置，防误删防篡改 |
| `+a` | 只能追加：只能往文件末尾写，不能覆盖修改 | 只增不减的日志文件 |
| `+A` | 不更新 atime | 减少不必要的磁盘写入 |
| `+j` | 数据写入前先记日志（ext3/ext4） | 提高崩溃一致性 |
| `+S` | 同步写入，立即落盘 | 数据库类关键数据 |

```bash
chattr +i /etc/important.conf      # 上锁
lsattr /etc/important.conf         # 查看属性，输出第二列即为属性列表
chattr -i /etc/important.conf      # 解锁后才能删除

rm /etc/important.conf             # 未解锁时删除会报错：
rm: cannot remove 'important.conf': Operation not permitted
```

> **注意：** `chattr +i` 是一把双刃剑：被锁的文件连 root 都无法直接修改，忘记解锁会导致软件升级、密码修改等运维操作失败。生产环境对配置文件加锁前，务必在变更流程里登记解锁步骤。

生产上 `+a` 比 `+i` 更常用于日志防篡改：日志服务还能继续追加写入，历史记录又改不掉。注意 Filebeat 这类轮转工具靠重命名文件轮转，会被 `+a` 拦住——上锁前先确认日志的轮转方式。

把文件的几层保护排一下：权限位（DAC，最外层）→ ACL（细粒度 DAC）→ chattr 扩展属性（文件系统层）→ SELinux（强制访问控制）。排错按这个顺序由外向内：先 `ls -l`、再 `getfacl`、然后 `lsattr`、最后 `ls -Z`，一层有嫌疑就先解决一层。

### ACL：更细粒度的权限授权

传统权限只有"属主 / 属组 / 其他人"三档，当需要单独给某个用户授权时（如让 `audit` 用户读 `/data/app.log`，但不想让它进 `app` 组），就要用 ACL：

```bash
setfacl -m u:audit:r /data/app.log          # 给用户 audit 加读权限
setfacl -m g:dev:rx /data/wwwroot           # 给 dev 组加读和执行（进入目录）权限
setfacl -m u:audit:rwx,g:dev:rx /data/dir   # 多条规则一次写
setfacl -R -m u:audit:rx /data/dir          # 递归授权
getfacl /data/app.log                       # 查看 ACL
setfacl -x u:audit /data/app.log            # 删除单条规则
setfacl -b /data/app.log                    # 清空所有 ACL
```

设置了 ACL 后，`ls -l` 的权限位末尾会出现 `+`：

```bash
[root@web01 ~]# ls -l /data/app.log
-rw-rw----+ 1 root app 120 Oct 24 09:00 /data/app.log
```

`getfacl` 的输出中，`mask` 条目是 ACL 的"总闸"——它限定了所有 ACL 条目（属主条目除外）的最大有效权限。例如 mask 为 `r-x`，即使给某用户授了 `rwx`，实际生效也只有 `r-x`：

```text
# file: data/app.log
# owner: root
# group: app
user::rw-
user:audit:r--
group::rwx          #effective:r--
mask::r-x
other::---
```

> **注意：** 修改 ACL 后 mask 会被自动重算；而用 `chmod` 修改属组权限时，mask 会被同步改写，可能"意外"削弱已授的 ACL 权限。排查"权限明明给了却访问不了"的问题时，用 `getfacl` 看 effective 权限是标准动作。

权限的判定顺序是：先看属主，匹配即生效；不匹配再看 ACL 具名条目；再属组与组条目；最后 other。一旦在属主或具名条目上匹配成功，后面的检查直接跳过——这里有个坑：给某个用户单独授 ACL 后，他不再按属组权限走，"授了 ACL 行为反而变了"多半是这个原因。

## 用户信息：属主与属组

### 系统中用户的作用

1. 利用用户登录系统；
2. 利用用户管理数据；
3. 利用用户管理进程。

### 系统如何识别不同的用户

利用用户的数值编号进行识别，即 **uid**：

```bash
[root@linux-node1 ~]# id root
uid=0(root) gid=0(root) groups=0(root)
[root@linux-node1 ~]# id test
uid=1000(test) gid=1000(test) groups=1000(test)
```

### 用户组的概念

```text
运维组 sa（system admin）：user01 user02 user03     /sa   --rwx
开发组 dev（Development）：dev01 dev02             /dev  --rwx
数据库组 dba（database admin）：dba01              /dba  --rwx
```

用户和用户组的关系有四种：1 对 1、多对 1、1 对多、多对多。系统识别用户组同样是根据编号识别，即 **gid**。

```bash
[root@linux-node1 ~]# id root
uid=0(root) gid=0(root) groups=0(root)
   01          02           03
```

| 序号 | 含义 |
| --- | --- |
| 01 | 显示用户名和 uid 对应关系 |
| 02 | 显示属于的用户组，以及组名和 gid 对应关系 |
| 03 | 用户可能属于哪些组 |

### 用户的分类

| 类型 | 类比 | uid 区分（CentOS 7） | 权限区分 |
| --- | --- | --- | --- |
| 超级管理员用户 | 皇帝 `root` | 0 | 至高无上 |
| 虚拟用户 | 傀儡 `nobody` | 1-999 | 用于管理进程，不能登录系统 / 没有家目录 |
| 普通用户 | 平民 | 1000+ | 管理指定数据、可以管理指定进程、可以登录系统 / 有家目录 |

> **注意：** CentOS 6 的虚拟用户 uid 范围是 1-499，普通用户从 500 开始；CentOS 7 起调整为 1-999 与 1000+。Rocky Linux / AlmaLinux 9 沿用 1-999 / 1000+ 的划分。

这套 uid 分段不是拍脑袋定的：0-999 留给系统，保证服务账号永远排在普通用户前面，也不会被 `useradd` 自动分配占用。起始 uid 由 `/etc/login.defs` 的 UID_MIN 控制，改这个文件就能调整普通用户的起始编号。

### 如何保护 root 用户

1. 修改远程连接端口（例如 52113）——修改 `/etc/ssh/sshd_config`；
2. 禁止 root 用户远程登录——修改 `/etc/ssh/sshd_config`。

> **注意：** 攻击者拿到 root 的思路通常是：先找系统中有哪些普通用户 → 破解普通用户密码 → `su - root` 再破 root 密码。所以改端口 + 禁止 root 直接远程登录是最 cheap 且有效的两招。

现代做法再加一层 fail2ban 或 sshd 的 `MaxAuthTries` 限速，把爆破脚本挡在门外；密钥登录普及后甚至可以直接关掉 PasswordAuthentication，密码爆破这条路就彻底没了。

## 文件的 inode 与 block

| 概念 | 含义 |
| --- | --- |
| inode（索引节点） | 文件或数据在磁盘中的保存位置 |
| block（数据块） | 索引节点指向的位置，文件或数据的具体内容 |

**读取数据的原理：**

1. 找到指定数据；
2. 读取数据内容，先获取文件数据的 inode 信息；
3. 根据 inode 信息在磁盘上找到对应的 block；
4. 根据 block 信息获取文件的真正内容。

这一节的读取链路在 文件属性与 inode 里已有详细版，这里只强调一句常考结论：文件名不在 inode 里，在目录的 block 里；删除文件改的是目录条目，所以看父目录权限。

## 文件的时间信息

| 时间类型 | 含义 |
| --- | --- |
| 访问时间 `atime`（Access time） | 文件内容被访问/读取的时间 |
| 修改时间 `mtime`（Modify time） | 文件内容被修改的时间 |
| 改变时间 `ctime`（Change time） | 数据属性信息发生改变的时间 |

> **注意：** 三种时间的详细区别、`stat` 输出逐行解读、`touch` 精确修改时间的参数，已在 文件属性与 inode 中展开，此处不再重复。记住一句口诀：读内容变 atime、改内容变 mtime、改属性（含 chmod、chown、重命名）变 ctime。

口诀之外补一句：`cp` 默认会把 mtime 更新为当前时间（复制即新建），想连时间一起搬用 `cp -p` 或 `rsync -a`——比对文件新旧时这个细节经常坑人。

## 常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| chmod 755 了服务仍 403 | SELinux 上下文不对 | `ls -Z 文件`、`journalctl \| grep avc` | `restorecon -Rv 目录`，或调整策略 |
| 网站目录能进却看不到文件 | 目录有 `x` 无 `r` | `ls -ld 目录` | `chmod u+rx` 补齐 |
| 删除文件提示 `Operation not permitted` | 文件带 `i` 属性或父目录有 Sticky 且非属主 | `lsattr 文件`、`ls -ld 父目录` | `chattr -i`；Sticky 目录找属主处理 |
| `find -perm 644` 查不到预期文件 | 644 是"恰好等于"，带 SUID 等位的文件不匹配 | `find -perm -644` | 按需改用 `-644` / `/644` |
| umask 设置后新建文件权限没变 | 改在了子 shell 或未重新登录 | `umask` 查看当前值 | 写入 `/etc/profile` 后重新登录 |
| ACL 授权了却访问不了 | mask 限制了有效权限 | `getfacl 文件` 看 effective | `setfacl -m m::rwx 文件` 调整 mask |
| `chown` 报 `invalid user` | 用户不存在 | `id 用户名` | 先建用户再改属主 |

## 现代环境补充

- Rocky Linux / AlmaLinux 9 上安装 tree：`dnf install -y tree`；root 默认 umask 仍为 `022`，普通用户 `002`。
- tar 的 `--zstd` 需要 GNU tar 1.31+，Rocky/Alma 9 满足；CentOS 7 自带 tar 1.26 不支持，可用 `-I zstd` 指定压缩器。
- SELinux 在 Rocky/Alma 9 上默认 enforcing，权限正确仍被拒绝时优先怀疑 SELinux（`ls -Z`、`ausearch -m avc`），不要习惯性 `setenforce 0`。
- 传统 `chattr` 在 xfs 文件系统上同样支持 `+i` / `+a`，行为与 ext4 一致。

## 自测题

1. umask 为 `022` 时，新建文件和新建目录的权限分别是多少？请写出推导过程。
2. 为什么 `666 - 027` 不等于文件的实际权限？`umask 027` 时文件的正确权限是多少？
3. 要把 `/data` 目录整体交给 `www` 用户，并让其中所有子目录为 755、所有文件为 644，如何用一条 find 命令链完成？
4. SUID 的作用是什么？如何审计系统中所有带 SUID 的程序？
5. 一个文件被 `chattr +i` 保护，连 root 都无法删除，正确的删除步骤是什么？
6. SGID 目录里新建的文件，属组是创建者自己的组还是目录的属组？Sticky 目录下能否删除别人的文件？

> **答案：** 1. 文件 `666 & ~022 = 644`，目录 `777 & ~022 = 755`。2. umask 是"按位屏蔽"不是十进制减法：027 的二进制各位分别屏蔽属组的 `w` 与其他用户的全部权限，正确结果是 `666 & ~027 = 640`；而 `666-027=639` 中的 `9` 根本不是合法权限段。3. `find /data -type d -exec chmod 755 {} +` 再 `find /data -type f -exec chmod 644 {} +`，属主用 `chown -R www:www /data`。4. SUID 让可执行文件在执行期间以文件属主身份运行（如 `passwd` 以 root 写 `/etc/shadow`）；审计用 `find / -type f -perm -4000`。5. 先 `chattr -i 文件` 去掉不可变属性，确认无其他保护（如 Sticky 目录）后再正常删除。6. SGID 目录里新建文件的属组自动继承目录的属组——这正是 2775 共享目录的设计意图；Sticky 目录里普通用户只能删除属主是自己的文件，root 例外。

## 课后练习

1. 如何将一个目录中以 `.txt` 结尾的文件统一进行压缩处理？
   - 思路：① 把以 `.txt` 结尾的文件找出来；② 再利用 `tar` 命令打包。
2. 如何找出 `/test` 目录中 `.txt` 结尾的文件，并将找出的文件统一删除？
3. 如何找出 `/test` 目录中 `.txt` 结尾的文件，并将找出的文件批量复制 / 移动到 `/tmp` 目录中？
4. CentOS 6 里面如何用 uid 区分不同的用户类型？
5. 总结 Linux 系统中常用的压缩和解压命令：`tar`、`zip`、`rar`。

## 小结

1. `find` 可以按名称（`-name` / `-iname`）、大小（`-size`，注意 `c` `k` `M` `G` 单位）、层级（`-maxdepth`）查找，且 `-maxdepth` 必须写在其他参数之前。
2. `find -perm 644` 是恰好等于，`-perm -644` 是包含全部位，`-perm /644` 是包含任意一位；审计 SUID 用 `find / -type f -perm -4000`。
3. `tar zcvf` 打包、`tar xvf` 解压、`tar tf` 查看，压缩时默认移除绝对路径的 `/`，用相对路径可避免提示；排除用 `--exclude` 和 `--exclude-from`，且排除路径写法必须与压缩路径一致。
4. `chmod` 数字法（`644`/`755`）适合脚本，字母法（`u+x`/`g-w`/`a-x`）适合可读性；大写 `X` 只对目录和已有执行位的文件生效，是递归授权的正确姿势。
5. umask 决定默认权限：文件按 `666 & ~umask`、目录按 `777 & ~umask` 计算，是"按位屏蔽"而非十进制减法；022 得 644/755，002 得 664/775，027 得 640/750，077 得 600/700。
6. `chown 属主:属组`（`-R` 递归）改归属，只有 root 能改属主。
7. 特殊权限三兄弟：SUID（4000，以属主身份执行）、SGID（2000，以属组身份执行 / 目录继承属组）、Sticky（1000，目录内只能删自己的文件，`/tmp` 即 1777）；SUID 是提权审计的重点对象。
8. `chattr +i` 给文件上不可变锁（root 也删不掉，需先 `-i`），`+a` 只允许追加；`lsattr` 查看。
9. ACL 解决三档权限不够用的问题：`setfacl -m u:用户:权限` 授权，`getfacl` 查看，注意 mask 是有效权限的总闸，`ls -l` 出现 `+` 即表示有 ACL。
10. 用户分类看 uid：root 为 0，虚拟用户 1-999（不能登录、无家目录），普通用户 1000+；保护 root 的有效手段是改 SSH 端口与禁止 root 远程登录。
11. 读取数据的链路是"文件名 → inode → block → 真正内容"；文件有三种时间：atime、mtime、ctime。

## 相关阅读

- 基础知识回顾（下）
- 文件属性与 inode
- 文件属性实战
- 用户管理
- 用户权限与提权
{% endraw %}
