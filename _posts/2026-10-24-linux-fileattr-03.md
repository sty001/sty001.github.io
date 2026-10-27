---
title: "03-文件属性与inode"
date: 2026-10-24 10:31:00 +0800
categories: [软件, Linux, 03-文件属性与正则表达式]
tags: [Linux, 03-文件属性与正则表达式, Linux基础]
slug: "linux-fileattr-03"
---

{% raw %}



这一篇围绕 `ls -li` 输出的每一列展开：inode、文件类型、权限位、硬链接数、属主、属组、大小、时间。Linux 常见文件类型会逐一列出，inode 与 block 的存储寻址原理、文件三种时间的区别、硬链接与软链接的深入对比都会讲透，最后附上 `file`、`which`、`whereis`、`locate`、`find` 这几个扩展命令的用法。目标只有一个：把文件属性这一行读明白。

## 课前回顾与作业解析
{: .sec-prac}

### tail -f 与 tail -F 的区别

| 参数 | 行为 |
| --- | --- |
| `tail -f` | 追踪文件信息时，文件被删除或移动走后需要进行重新追踪 |
| `tail -F` | 文件被删除或移动走后不需要重新追踪，只要文件恢复回来会继续追踪 |

> **注意：** 日志文件数据会不断增加，历史悠久的日志文件还会被清空（切割/轮转），所以追踪日志时推荐使用 `tail -F 日志信息`。
{: .sec-pit}

### tr 命令的替换原理
{: .sec-know}

`tr` 的替换是**按字符位置一对一的替换**，不是按字符串整体替换，所以一旦想用它做"整词替换"，结果往往会出乎意料。

假设文件中已经是被 `sed` 替换过的 `python*` 内容，想把 `python` 改回 `server`，但第二个字符集写短了：

```bash
[root@linux-node1 ~]# cat /test/test.txt
python01
dev01
ops01
python02
dev02
ops02

[root@linux-node1 ~]# tr "python" "ser" < /test/test.txt
serrrr01
dev01
ops01
serrrr02
dev02
ops02
```

`python` 的 6 个字符依次映射到 `ser` 的 3 个字符，不足的部分用 `ser` 的最后一个字符 `r` 补齐，于是 `p→s`、`y→e`、`t→r`、`h→r`、`o→r`、`n→r`，结果就"乱了"。

**tr 四种替换情况：**

| 情况 | 示例 | 输出 | 说明 |
| --- | --- | --- | --- |
| 替换内容字符数 **>** 修改后内容字符数 | `echo abcd\|tr "abcd" "123"` | `1233` | 多出来的字符用 `123` 的最后一个字符 `3` 补齐 |
| 替换内容字符数 **<** 修改后内容字符数 | `echo abcd\|tr "abc" "1234"` | `123d` | `d` 没有对应映射，原样保留 |
| 替换内容字符数 **=** 修改后内容字符数 | `echo abcd\|tr "abcd" "1234"` | `1234` | 一一对应 |
| 极特殊情况（字符重复出现） | `echo abcba\|tr "abcba" "12345"` | `54345` | 同一个字符出现多次时，以最后一个映射为准：`a→5`、`b→4`、`c→3` |

```bash
[root@linux-node1 ~]# echo abcd|tr "abcd" "123"
1233
[root@linux-node1 ~]# echo abcd|tr "abc" "1234"
123d
[root@linux-node1 ~]# echo abcd|tr "abcd" "1234"
1234
[root@linux-node1 ~]# echo abcba|tr "abcba" "12345"
54345
```

**大小写转换是 tr 最典型的正确用法：**

```bash
[root@linux-node1 ~]# cat /test/test2.txt
server01
server02
[root@linux-node1 ~]# tr "a-z" "A-Z" < /test/test2.txt
SERVER01
SERVER02
```

## 卸载软件

| 方法 | 说明 |
| --- | --- |
| `yum erase cowsay -y` | Remove a package or packages from your system，**极其不建议**，容易连带删除依赖 |
| `rpm -e 软件名称 --nodeps` | **推荐使用**，`--nodeps` 表示忽略依赖关系 |

> **注意：** 生产环境卸载软件前，建议先用 `rpm -ql 软件名` 查看会删掉哪些文件、用 `rpm -e --test 软件名` 做一次空跑演练。`--nodeps` 强行删除可能让依赖它的程序无法运行，仅用于清理明确的孤立包。
{: .sec-pit}

## 阶段回顾：用户信息的批量管理
{: .sec-sum}

### 查看系统信息与创建用户

```bash
uname -a
cat /etc/redhat-release
```

**批量创建用户的三种方法：**

1. 借助 Notepad++ 等编辑器（`alt + c` 可以生成数字序列）批量拼出命令；
2. 借助 `sed` 命令拼接出命令；
3. 利用 shell 脚本的循环语句：

```bash
[root@linux-node1 ~]# for num in {01..20};do useradd test$num;done
[root@linux-node1 ~]# for num in {01..20};do id test$num;done
uid=1021(test01) gid=1021(test01) groups=1021(test01)
uid=1022(test02) gid=1022(test02) groups=1022(test02)
uid=1023(test03) gid=1023(test03) groups=1023(test03)
...
uid=1040(test20) gid=1040(test20) groups=1040(test20)
```

循环里 `useradd` 遇到同名用户会报 user exists，批量脚本通常写成 `id 用户名 &>/dev/null || useradd 用户名` 先判断再创建。

### 设置用户密码

```bash
# 交互式设置密码
passwd 用户名        # 需要输入两次密码

# 免交互设置密码
[root@linux-node1 ~]# echo '<your-password>'|passwd --stdin test02
Changing password for user test02.
passwd: all authentication tokens updated successfully.

# 创建用户的同时设置密码
useradd test01 ;echo '<your-password>'|passwd --stdin test01
```

管道传密码会留在 shell 历史里，批量建完号记得 `history -c` 清理；正式环境更推荐 `chpasswd`。

## 文件属性概念
{: .sec-know}

```bash
[root@linux-node1 ~]# ls -li /etc/
total 1092
                      第一个部分：文件属性                        第二个部分：文件名称
 34141705 d rwxr-xr-x.  3 root root      101 Mar 28 10:42 abrt
 34022854 - rw-r--r--.  1 root root       16 Mar 28 10:45 adjtime
 33590855 - rw-r--r--.  1 root root     1518 Jun  7  2013 aliases
 33554501 - rw-r--r--.  1 root root     12288 Mar 28 10:48 aliases.db
 33583487 d rwxr-xr-x.  2 root root      236 Mar 28 10:42 alternatives
 34105318 - rw-------.  1 root root      541 Apr 11  2018 anacrontab
 33862777 - rw-r--r--.  1 root root       55 Apr 11  2018 asound.conf
 34193678 d rwxr-x---.  3 root root       43 Mar 28 10:42 audisp
101181822 d rwxr-x---.  3 root root       83 Mar 28 10:48 audit
```

| 序号 | 字段 | 含义 | 作用 |
| --- | --- | --- | --- |
| 01 | inode 信息 | index node，索引节点 | 快速从磁盘中找到数据信息 |
| 02 | 文件的数据类型 | 文件、目录、链接文件、设备文件 | 指明数据的文件类型 |
| 03 | 权限位信息 | `r` read 读、`w` write 写、`x` execute 执行 | 控制不同用户对文件可以有不同的权限 |
| 04 | 硬链接数 | 类似于超市的多个门 | 可以有多个路径查看数据信息 |
| 05 | 属主 | 文件的创建者或拥有者 | 数据（孩子小于 16 岁）的监护人 |
| 06 | 属组 | 文件或数据的所属用户组 | 监护人（属主）之外的亲人 |
| 07 | 大小信息 | 文件占用的空间 | — |
| 08 | 时间信息 | 文件的修改时间等 | — |

> **注意：** Linux 系统中一切皆文件，目录、设备、socket 在文件属性里都有对应的类型标识。
{: .sec-pit}

### ls -l 输出十段逐段拆解

以 `ls -li` 输出的一行为例，从左到右可以拆成 10 段：

```text
 34141705  d  rwxr-xr-x.  3  root  root  101  Mar 28 10:42  abrt
   ①       ②     ③      ④  ⑤    ⑥     ⑦       ⑧        ⑨
```

| 段 | 字段 | 示例值 | 说明 |
| --- | --- | --- | --- |
| ① | inode 号 | `34141705` | 仅加 `-i` 参数时显示；文件在分区内的唯一编号 |
| ② | 文件类型 | `d` | `-` 普通文件、`d` 目录、`l` 软链接、`b`/`c` 设备、`p` 管道、`s` socket |
| ③ | 权限位（9 位） | `rwxr-xr-x` | 前 3 位属主、中 3 位属组、后 3 位其他用户，详见下节 |
| ④ | 扩展属性标记 | `.` 或 `+` | `.` 表示带 SELinux 安全上下文；`+` 表示带 ACL；没有标记则为空 |
| ⑤ | 硬链接数 | `3` | 该 inode 被引用的次数；目录的链接数至少为 2（`.` 和子目录的 `..`） |
| ⑥ | 属主 | `root` | 文件的所有者 |
| ⑦ | 属组 | `root` | 文件所属的用户组 |
| ⑧ | 大小 | `101` | 普通文件是字节数；目录是目录项占用的块大小 |
| ⑨ | 时间 | `Mar 28 10:42` | 默认显示 mtime（内容修改时间），6 个月以上的显示年份 |
| ⑩ | 文件名 | `abrt` | 名字存在上一级目录的 block 里，不在自己的 inode 里 |

### 权限位 rwx 对文件与目录的不同含义

同样的 `r`、`w`、`x` 三个位，作用在文件和目录上含义完全不同，这是初学者最容易混淆的地方：

| 权限 | 对文件的含义 | 对目录的含义 |
| --- | --- | --- |
| `r` 读 | 读取文件内容（`cat`、`less`、编辑器打开） | 列出目录内容（`ls`） |
| `w` 写 | 修改、写入文件内容 | 在目录中创建、删除、重命名文件（控制的是目录条目） |
| `x` 执行 | 把文件当作程序运行 | 进入目录（`cd`）、访问目录内的文件（路径经过该目录） |

三条推论务必记住：

1. **删除文件看的是父目录的 `w`，不是文件本身的 `w`**——这就是为什么 `/tmp` 里的文件人人可删（`/tmp` 是 1777）；
2. **要访问 `/a/b/c.txt`，需要 `/`、`/a`、`/a/b` 每一级目录都有 `x`**，缺一级就 `Permission denied`，这就是"路径上沿途权限"问题；
3. **目录只有 `r` 没有 `x`**：能列出文件名但看不到属性详情；**只有 `x` 没有 `r`**：进得去、知道某个文件名也能访问，但列不出全部内容。

## inode 与 block 原理
{: .sec-know}

### 核心概念
{: .sec-know}

| 概念 | 存什么 | 诞生时机 |
| --- | --- | --- |
| inode（索引节点） | 文件属性：权限、属主、属组、大小、时间、block 位置指针 | 创建文件系统（格式化）时 |
| block（数据块） | 文件的实际内容 | 创建文件系统（格式化）时 |
| 目录 | 目录也是一种文件：它的 block 里存"文件名 → inode 号"的对照表 | 创建文件系统时 |

### 原理解析：数据是如何存储与寻址的
{: .sec-know}

1. 磁盘经过分区、格式化后，被划分为固定数量的 inode 和 block；
2. 新建一个文件时，系统分配一个空闲 inode，把权限、属主等属性写进去；
3. 文件内容写入若干 block，block 的编号记录到该 inode 的指针区；
4. 文件名字段则写入其所在目录的 block，形成"文件名 → inode 号"的映射；
5. 读取文件时，先在目录 block 中按名字找到 inode 号；
6. 根据 inode 号定位 inode 表，读出属性与 block 指针；
7. 按指针依次读取 block，拼出文件内容。

由此可以解释很多现象：

- **为什么同一分区内 inode 号相同的两个文件互为硬链接**——它们的映射本来指向同一个 inode；
- **为什么文件名可以随意改而内容不变**——名字只存在于目录 block 中，改名字不动 inode；
- **为什么删除正在写入的日志，磁盘空间不释放**——只要进程还持有文件描述符，inode 的引用计数不为 0，block 不会被回收；
- **为什么 df 有空间却写不进文件**——inode 分配耗尽（海量小文件场景），用 `df -i` 确认；
- **为什么空文件不占 block**——没有内容可写，只分配 inode。

为什么说 inode 是文件的身份标识？内核对文件的几乎所有操作都围绕 inode 号进行：open、stat、unlink 这些系统调用最终拿到的都是 inode，权限检查、配额统计、文件锁也都挂在 inode 上。名字只是目录里的一条映射，换名字、换个目录，inode 都不变；反过来，`mv` 跨分区时"改名"其实是复制数据再删原件，inode 就换了一个。判断两个文件是不是同一份数据，最可靠的依据是比对 inode 号，而不是比对名字或内容。

**目录也是文件**，这是理解 inode/block 模型的关键一环：目录的 inode 与其他文件没有区别，但它的 block 里存的不是普通数据，而是一张"文件名 → inode 号"的条目表。由此推出两个常见现象：

1. `ls -ld` 看到的目录大小通常是 4096（一个 block），因为条目表刚开始只占一个 block；条目太多时目录会扩展到多个 block，大小随之变大；
2. 新建子目录会在父目录的条目表里加一条记录，同时子目录的 `..` 反向引用父目录，所以每多一个子目录，父目录的硬链接数就加一——这就是空目录硬链接数至少为 2 的原因。

顺带回答一个常见疑问：为什么不把文件名直接放进 inode？一个重要原因是"一个文件可以有多个名字"——硬链接机制要求多个目录条目指向同一个 inode，名字与 inode 必须解耦。解耦还带来另一个效果：重命名、移动文件只是在目录块里改条目，完全不用碰文件数据，同一分区内的 mv 因此是瞬时完成的。

### 辨析：inode 用尽与 block 用尽

两种"磁盘满了"症状一样（`No space left on device`），根因和处理完全不同。先 `df -h`、`df -i` 各看一眼：block 用完说明大文件或文件总量太多，`du -sh /*` 层层下钻找大块头；inode 用完说明小文件太多，block 还有大量剩余却建不了新文件，要按目录统计文件数找小文件聚集地。海量小文件是生产环境的常见病——邮件队列、PHP session、每分钟落一个文件的 crontab 脚本，都能制造几百万个 inode 占用。预防上除了监控 `df -i`，格式化时对已知小文件场景还可以用 `mkfs.ext4 -N` 或 `-T small` 调整 inode 数量。

### 特殊设备文件实战：用 /dev/urandom 生成随机密码
{: .sec-prac}

本篇课后练习问过"如何利用 `/dev/urandom` 产生随机字符信息"（例如新员工批量建账号时生成初始密码），标准做法是用 `tr` 从随机流中过滤出可见字符：

```bash
# 生成一个 12 位随机密码（大小写字母 + 数字）
tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 12; echo

# 批量生成 10 个初始密码，一行一个
for i in {1..10}; do tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 12; echo; done
```

逐段解释：

1. `/dev/urandom` 是内核维护的伪随机数发生器，持续输出随机字节流，读取不会枯竭；
2. `tr -dc 'A-Za-z0-9'` 中 `-d` 是删除、`-c` 是取反，合起来即"删掉所有不在集合里的字符"，只保留字母和数字；
3. `head -c 12` 取前 12 个字符；末尾补一个 `echo` 是给输出加换行，否则 shell 提示符会粘在密码后面。

> **注意：** `/dev/random` 与 `/dev/urandom` 都能产生随机数，区别是 `/dev/random` 在熵不足时会阻塞等待，`/dev/urandom` 永不阻塞。生成密码、盐值、令牌这类场景一律用 `/dev/urandom`。更严格的做法是用 `openssl rand -base64 12`，且初始密码应强制用户首次登录时修改。
{: .sec-pit}

## 文件类型详解
{: .sec-expl}

### 区分文件类型的方法

- **Windows**：用扩展名区分文件类型；
- **Linux**：不用扩展名区分文件类型。

Linux 中区分文件类型有三种办法：

Linux 判断文件类型不看扩展名的根源在于：类型信息写在 inode 里（文件模式位的高位），扩展名只是名字的一部分。Windows 的 FAT 家族没有类似机制，只能靠名字约定，这是两个系统设计哲学差异的一个缩影。

**① 用颜色区分**（终端中目录、普通文件、压缩文件等颜色不同）。

**② 利用属性信息区分**

```bash
ls -l
d rwxr-xr-x. 3 root root 100 Apr  1 11:00 test01
d rwxr-xr-x. 2 root root   6 Apr 12 11:19 test.jpg
- rw-r--r--. 1 root root  35 Apr 12 08:52 test.txt
- rw-r--r--. 1 root root  18 Apr 11 10:23 test2.txt
- rw-r--r--. 1 root root   4 Apr 11 12:29 test01.txt
- rw-r--r--. 1 root root  65 Apr 11 12:21 test.txt
```

**③ 利用特殊命令区分**

```bash
[root@linux-node1 ~]# file /test/test.jpg
/test/test.jpg: directory
[root@linux-node1 ~]# file /test/test.txt
/test/test.txt: ASCII text
```

> **注意：** 扩展名在 Linux 中只是文件名的一部分，`test.jpg` 完全可能是一个目录，判断类型请用 `file` 命令。
{: .sec-pit}

### 常见文件类型

| 标识 | 类型 | 说明 |
| --- | --- | --- |
| `d` | 目录文件 | directory |
| `-` | 普通文件 | ① 纯文本文件 `text`，如 `/etc/hosts`，可以直接编辑查看；② 二进制文件 `binary`，如 `/bin/ls`，命令文件不可以编辑；③ 数据型文件 `data`，如 `/tmp/etc.tar.gz` 这类压缩文件 |
| `l` | 链接文件 | 快捷方式，创建方法：`ln -s /test/test.txt /test/test_link.txt`（前一个是源文件，后一个是软链接文件） |
| `b` / `c` | 块设备文件 / 字符设备文件 | 块文件：存储类设备文件，如磁盘 `/dev/sda`、光驱设备文件；字符文件：持续输出或接收字符流，如随机数设备 `/dev/urandom`、零设备 `/dev/zero`（持续输出空字符）、空设备 `/dev/null`（写入即被丢弃的黑洞，定时任务中常用于屏蔽输出） |
| `p` | 管道文件（FIFO） | 命名管道，进程间通信的"文件形态"，写入端与读取端通过它收发数据，`mkfifo` 创建 |
| `s` | socket 文件 | 网络编程中进程间通信使用，如 MySQL 的 `mysql.sock` |

`s` 类型的文件在本机进程间通信里很常见：MySQL 默认走 `/var/lib/mysql/mysql.sock`，同机连接可以不经过 TCP 端口，速度也更快。

> **注意：** 原笔记中 `/dev/zero` 与 `/dev/null` 的中文说明相互矛盾（原文都标注了 `???`），此处按标准语义描述：`/dev/zero` 是"取之不尽"的 0 字节源，`/dev/null` 是丢弃一切写入的黑洞。
{: .sec-pit}

### 文件时间与 stat 命令

文件有三种时间，含义完全不同：

| 时间 | 英文全称 | 触发场景 | 查看 |
| --- | --- | --- | --- |
| 访问时间 | Access time（atime） | 文件内容被读取（`cat`、`less`） | `stat` 的 Access 行 |
| 修改时间 | Modify time（mtime） | 文件内容被修改 | `stat` 的 Modify 行，`ls -l` 默认显示它 |
| 改变时间 | Change time（ctime） | 文件属性发生变化（权限、属主、重命名、硬链接数变化） | `stat` 的 Change 行 |

```bash
[root@linux-node1 ~]# stat /test/test.txt
  File: '/test/test.txt'
  Size: 50          Blocks: 8          IO Block: 4096   regular file
Device: 803h/2051d  Inode: 34141705    Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2024-04-01 10:24:00.000000000 +0800
Modify: 2024-04-01 10:24:00.000000000 +0800
Change: 2024-04-01 10:24:00.000000000 +0800
 Birth: -
```

`stat` 输出是文件属性的完整快照：类型（regular file）、大小、占用块数、inode 号、硬链接数（Links）、权限及其八进制数值、属主与属组的编号和名字、三种时间（ext4/xfs 还支持 Birth 创建时间）。

输出里 `Blocks: 8` 有个口径问题：stat 的 Blocks 单位恒为 512 字节，8 表示 4KB，不是 8 个 4K block——和 df 的口径不一样，对比时注意。

三种时间里 ctime 最特殊：它由内核维护，`touch` 改不了。因为 ctime 记录的是 inode 元数据的变更（权限、属主、链接数、大小），允许用户随意改 ctime，文件系统的一致性检查和取证工作就没了抓手。改时间戳这个动作本身也会更新 ctime——`touch -a` 改的是 atime，但 ctime 跟着变。想在输出里只看时间，用 `stat -c '%x %y %z'` 分别对应 atime、mtime、ctime。

还有一个容易被忽略的内核行为：现代发行版默认以 relatime 方式挂载文件系统，只有当 atime 比 mtime 旧、或距上次更新超过 24 小时，读取才会真正更新 atime。这是性能折中——每次读文件都写一次 inode 太亏。这里有个坑：别指望 cat 一下 atime 就刷新，观察 atime 前先 `stat` 确认。实际敲一遍就明白：连续两次 `cat` 同一文件，第二次之后 atime 往往不再变化。

`touch` 命令默认同时更新 atime 和 mtime，可精确控制：

| 参数 | 作用 |
| --- | --- |
| `touch -a 文件` | 只改访问时间 |
| `touch -m 文件` | 只改修改时间 |
| `touch -d "2024-01-01 10:00" 文件` | 改成指定时间 |
| `touch -t 202401011000 文件` | 用紧凑时间戳格式指定 |
| `touch -r 参考文件 目标文件` | 把时间改成与参考文件一致 |
| `touch -c 文件` | 文件不存在时不创建（默认会创建空文件） |

## 硬链接与软链接深入对比
{: .sec-ext}

### 基本创建

```bash
ln  /test/test.txt /test/test_hard_link.txt      # 硬链接
ln -s /test/test.txt /test/test_soft_link.txt    # 软链接
```

### 深入对比表
{: .sec-ext}

| 对比项 | 硬链接 | 软链接 |
| --- | --- | --- |
| 本质 | 同一 inode 的另一个目录条目 | 一个内容为"目标路径字符串"的独立小文件 |
| inode 号 | 与源文件相同 | 与源文件不同（自己新建 inode） |
| 文件类型标识 | 与源文件一致（普通文件就是 `-`） | `l`（`ls -l` 中显示为 `lrwxrwxrwx`） |
| 文件大小 | 与源文件一致 | 等于目标路径字符串的长度（与源文件大小无关） |
| 跨文件系统/分区 | 不允许，只能在同一分区内创建 | 允许，可指向其他分区、其他机器的路径 |
| 对目录 | 不允许给目录建硬链接 | 允许指向目录 |
| 源文件删除后 | 硬链接依然有效（引用计数归零才真正释放数据） | 立即失效，成为断链（dangling link） |
| 权限 | 与源文件完全一致（本质是同一个文件） | 链接文件自身恒为 `rwxrwxrwx`，实际访问权限取决于目标文件 |
| 路径写法 | 无所谓 | 建议用绝对路径；用相对路径时按"链接文件所在目录"解析 |
| 查找方式 | `find / -inum <inode号>` | `find / -type l`；查断链用 `find / -xtype l` |

几个容易混淆的结论：

1. 软链接文件的权限恒为 `lrwxrwxrwx`，这个权限没有意义，真正生效的是目标文件的权限；
2. 软链接指向的相对路径按"链接文件所在目录"解析，所以生产环境写绝对路径最稳妥；
3. 删除源文件后硬链接仍可用，是因为文件数据的释放条件是引用计数变为 0，这正是 `ls -l` 第二列数字（Links）的含义；
4. 目录的硬链接被系统禁止，是因为它会让目录树形成环，破坏文件系统的一致性检查。

把链接计数 nlink 的变化时机列全：创建硬链接时目标 inode 计数加一；删除任一名字时减一；减到零且没有进程占用，数据块才真正释放。目录文件的 nlink 有自己的算法：新建目录时初始为 2（目录自身的 `.` 加父目录里的一条条目），之后每增加一个子目录再加一（子目录的 `..` 指回来）。所以 `ls -ld 目录` 看到的第二列数字减 2，就是该目录下的子目录数量。

## 文件相关扩展命令
{: .sec-ext}

| 命令 | 作用 | 示例 |
| --- | --- | --- |
| `file` | 显示文件信息类型 | `file /test/test.txt` |
| `which` | 显示命令的绝对路径信息 | `which cat` → `/usr/bin/cat` |
| `whereis` | 显示命令路径以及命令相关的帮助手册文件路径 | `whereis cat` |
| `locate` | 快速定位文件路径信息 | `locate 文件名称` |
| `updatedb` | 建立文件和目录结构的对应关系，便于检索 | `updatedb` |
| `find` | 快速查找数据信息 | 见下 |

> **注意：** 默认 CentOS 7 最小化安装没有 `locate` / `updatedb` 命令，需要先 `yum install -y mlocate`。Rocky Linux / AlmaLinux 9 同样默认不预装，用 `dnf install -y mlocate`；装好后 `updatedb` 由系统自带的 `mlocate-updatedb.timer` 每天自动执行，无需手工维护。
{: .sec-pit}

`updatedb` 全盘扫描比较吃 I/O，机械盘上可能跑几分钟，建议放业务低峰执行；`locate` 查询本身极快，百万级文件也是毫秒级返回。

### find 命令语法

```bash
find 找寻的路径范围 -type 类型信息 -name "文件名称"
```

```bash
[root@linux-node1 etc]# find /etc -type f -name "ifcfg-eth0"
/etc/sysconfig/network-scripts/ifcfg-eth0

# 文件名称没有记全时，配合通配符号模糊查找
[root@linux-node1 etc]# find /etc -type f -name "*eth0"
/etc/sysconfig/network-scripts/ifcfg-eth0
[root@linux-node1 etc]# find /etc -type f -name "if*h0"
/etc/sysconfig/network-scripts/ifcfg-eth0
```

> **注意：** `find` 的完整参数体系（时间、大小、属主、权限、`-exec`、`-delete`、与 `xargs` 的配合、Permission denied 排错）已在 基础知识回顾（下） 展开，本篇不再重复。
{: .sec-pit}

按 inode 反查文件用 `find / -inum 号码`，删那些名字打不出来的文件（文件名里混了控制字符）也可以走这条路：先 `ls -i` 拿到 inode 号，再 `find . -inum 号码 -delete`。

## 常见错误与排错
{: .sec-ts}

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `df` 显示有空间但写不进文件 | inode 耗尽（海量小文件） | `df -i` | 清理小文件，详见实战篇的 inode 满案例 |
| 文件删了磁盘空间不降 | 有进程仍持有已删除文件的句柄 | `lsof \| grep deleted` | 重启或通知进程重开日志句柄 |
| 软链接点击/访问提示 `No such file or directory` | 源文件被移动或删除，成为断链 | `ls -l 链接名` 看 `->` 后的目标 | 修正目标或删除断链：`find / -xtype l` |
| 修改文件提示 `Operation not permitted` | 文件被设置了 `i` 不可变属性 | `lsattr 文件名` | `chattr -i 文件名` 后重试 |
| `file` 判断的类型与扩展名不符 | 扩展名在 Linux 中不决定类型 | `file 文件名` | 以 `file` 输出为准，勿以扩展名推断 |
| 新文件 `locate` 不到 | 数据库未更新 | `locate 文件名` 与 `ls` 对照 | 执行 `updatedb` 刷新 |

## 现代环境补充
{: .sec-ext}

- `mlocate` 在 Rocky Linux / AlmaLinux 9 上用 `dnf install -y mlocate` 安装；`updatedb` 由 `mlocate-updatedb.timer` 每天自动执行，可用 `systemctl status mlocate-updatedb.timer` 确认。
- `stat` 在 ext4 / xfs 文件系统上均可输出 `Birth`（创建时间），老版本的 ext3 不支持。
- 查看块设备属性可用 `lsblk -f`（文件系统类型、UUID、挂载点），`blkid` 按 UUID 定位分区，二者比早期直接读 `/etc/fstab` 更直观。

## 自测题
{: .sec-prac}

1. `ls -l` 输出中第一位字符为 `d`、`-`、`l` 各代表什么？权限位后面的 `.` 和 `+` 分别表示什么？
2. 为什么删除一个文件不需要文件本身的写权限？真正需要什么权限？
3. inode 中存储了哪些信息？文件名存储在哪里？
4. 硬链接为什么不能跨分区创建？软链接为什么可以？
5. `stat` 输出中 Modify 与 Change 有什么区别？给文件重命名会更新哪个时间？
6. `cp /etc/hosts /tmp/` 和 `mv /etc/hosts /tmp/`，对 inode 的影响有什么不同？

> **答案：** 1. `d` 目录、`-` 普通文件、`l` 软链接；`.` 表示带 SELinux 安全上下文，`+` 表示带 ACL。2. 删除文件改的是父目录的目录条目，需要的是父目录的 `w` 权限；文件本身权限不影响删除。3. inode 存权限、属主、属组、大小、三种时间、block 指针，不存文件名；文件名存在上一级目录的 block 里。4. inode 号只在同一文件系统内唯一，硬链接要求两个目录条目指向同一 inode，跨分区 inode 编号空间不同；软链接只保存目标路径字符串，不引用目标 inode，因此可以跨分区。5. Modify 是内容修改时间，Change 是属性（含 inode 信息）改变时间；重命名只改目录项，会更新 Change，不改 Modify。6. `cp` 新建一个 inode 并复制内容；同一分区内的 `mv` 只改目录条目里的名字映射，inode 与数据都不动，跨分区 `mv` 则等价于"复制 + 删除"、inode 会换。判断"是不是同一份文件"看 inode 号，不看名字。

## 课后练习
{: .sec-prac}

**基础练习**

1. 总结 `find` 命令；
2. 总结文件属性信息。

**扩展练习**

1. 如何产生随机字符信息（利用 `/dev/urandom` 文件生成随机数），例如新来 10 个运维、需要 10 个账号时批量生成初始密码。

## 小结
{: .sec-sum}

1. `ls -li` 输出从左到右依次是：inode、文件类型、权限位、硬链接数、属主、属组、大小、时间、文件名；权限位后的 `.` 是 SELinux 标记，`+` 是 ACL 标记。
2. `r`/`w`/`x` 对文件与目录含义不同：目录的 `w` 控制增删条目，`x` 控制能否进入；删除文件看父目录权限，访问深层路径需要沿途每一级目录都有 `x`。
3. inode 存属性与 block 指针，block 存内容，目录的 block 存"文件名 → inode 号"映射；寻址链路是"名字 → inode → block → 内容"。
4. Linux 不靠扩展名区分文件类型，靠的是属性位首字符（`-` `d` `l` `b`/`c` `p` `s`）以及 `file` 命令；类型信息写在 inode 里，扩展名只是名字的一部分。
5. 文件三种时间：atime 读内容时更新，mtime 改内容时更新，ctime 改属性时更新；`ls -l` 默认显示 mtime，`stat` 一次看全。现代内核默认 relatime 挂载，atime 不一定每次读取都刷新。
6. `tr` 是按字符位置一对一映射，字符集长度不等时按规则补齐或原样保留，同一字符重复出现时以最后一个映射为准——它只适合做大小写转换这类逐字符操作。
7. 卸载软件推荐 `rpm -e 软件名 --nodeps`，尽量不用 `yum erase`。
8. 批量建用户可用 shell 循环 `for num in {01..20};do useradd test$num;done`，免交互设置密码用 `echo 密码|passwd --stdin 用户名`。
9. 硬链接是同一 inode 的多个入口（同分区、不能用于目录、删源文件仍有效）；软链接是路径字符串（可跨分区、可指向目录、删源文件即断链）。
10. 找文件用 `find 路径 -type 类型 -name "名称"`，名称记不全时用 `*`，配合 `locate` + `updatedb` 检索会更快（需装 `mlocate`）。

## 相关阅读

- [基础知识回顾（上）](/posts/linux-fileattr-01/)

- [基础知识回顾（下）](/posts/linux-fileattr-02/)

- [文件属性进阶](/posts/linux-fileattr-04/)

- [文件属性实战](/posts/linux-fileattr-05/)

- [磁盘管理基础](/posts/linux-disk-01/)



{% endraw %}
