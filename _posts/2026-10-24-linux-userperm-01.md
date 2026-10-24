---
title: "01-用户管理"
date: 2026-10-24 10:24:00 +0800
categories: [软件, Linux, 05-用户与权限管理]
tags: [Linux, 05-用户与权限管理, Linux基础]
slug: "linux-userperm-01"
---

{% raw %}

先补一道高频面试题（CentOS 6 / CentOS 7 系统启动流程），然后按顺序过：用户的分类、rwx 权限在文件与目录上的真实含义、读写数据的 inode / block 原理、权限修改方法（chmod）、默认权限与 umask、用户家目录的"样板房" `/etc/skel`、用户相关文件、`/etc/passwd` 七字段、用户管理命令（useradd / usermod / userdel / passwd / chage）、批量创建用户脚本、登录日志查看与 sudo 授权配置。读完应该能自己建账号、给同事配权限。

## 一、上节回顾：awk 的统计分析

```bash
awk -F ":" 'BEGIN{print "第一次总额","第三次总额"};/.*/{print $2,$4}'  awk_test.txt
```

```bash
[root@linux-node1 ~]# awk -F ":" 'BEGIN{print "第一次总额","第三次总额"}{a=a+$2;b=b+$4}END{print a,b}' awk_test.txt|column -t
第一次总额  第三次总额
2130        1661
```

## 二、常见面试题：系统启动流程

### 2.1 CentOS 6 启动流程

| 步骤 | 说明 |
| --- | --- |
| 01. 加电自检 | 检查服务器硬件是否正常 |
| 02. MBR 引导 | 读取磁盘的 MBR 存储记录信息，引导系统启动 |
| 03. grub 菜单 | 选择启动的内核 / 进入单用户模式重置密码 |
| 04. 加载系统内核信息 | 可以更好地使用内核控制硬件 |
| 05. 运行系统第一个进程 init | **串行**启动，init 进程控制后续各种服务的启动顺序，如网络服务、sshd |
| 06. 加载系统运行级别文件 | `/etc/inittab` |
| 07. 初始化脚本运行 | 初始化系统主机名称和网卡信息 |
| 08. 运行系统特殊的脚本 | 服务运行的脚本 |
| 09. 运行 mingetty 进程 | 显示开机登录信息界面 |

### 2.2 CentOS 7 启动流程

| 步骤 | 说明 |
| --- | --- |
| 01. 加电自检 | 检查服务器硬件是否正常 |
| 02. MBR 引导 | 读取磁盘的 MBR 存储记录信息，引导系统启动 |
| 03. grub 菜单 | 选择启动的内核 / 进入单用户模式重置密码 |
| 04. 加载系统内核信息 | 可以更好地使用内核控制硬件 |
| 05. 运行系统第一个进程 systemd | **并行**启动，服务启动的时候一起启动 |
| 06. 读取系统启动文件 | `/etc/systemd/system/default.target` |
| 07. 读取系统初始化文件 | `/usr/lib/systemd/system/sysinit.target` |
| 08. 使服务可以开机自启动 | 加载 `/etc/systemd/system` 目录中的信息，实现服务开机自动启动 |
| 09. 运行 mingetty 进程 | 显示开机登录信息界面 |

> **注意：** CentOS 6 与 CentOS 7 的核心差异在第 5 步：6 用 init（串行，一个一个启动服务），7 用 systemd（并行，同时启动服务）。CentOS 6 已于 2020 年 EOL、CentOS 7 已于 2024 年 6 月 EOL，新系统（Rocky Linux / AlmaLinux / CentOS Stream）全面使用 systemd，这套流程依然适用，只是服务管理命令统一为 `systemctl`。

## 三、用户的分类

### 3.1 四类用户

| 用户类型 | 示例 | UID 范围 | 特点 |
| --- | --- | --- | --- |
| 管理员用户 | root | 0 | 权利至高无上 |
| 虚拟用户 | nobody | 1-999 | 管理进程使用，没有家目录，不能登录系统 |
| 普通用户 | ops | 1000+ | 权利有限 |

上表是课堂速记的粗略分类，从账号实际用途出发可以拆得更细：

| 用户类型 | 典型用户 | UID 范围 | 用途与特点 |
| --- | --- | --- | --- |
| 超级管理员 | root | 0 | 拥有系统最高权限，可执行任何操作 |
| 系统用户 | bin、daemon、adm、lp | 1-999 | 由系统与软件包创建，供系统服务以低权限身份运行，默认 shell 是 `/sbin/nologin`，不能交互登录 |
| 虚拟用户 | www、mysql、nobody、nginx | 通常落在 1-999 | 安装软件时自动创建，专供某个服务使用（如 nginx 用 nobody 身份对外服务），即使服务被攻破也拿不到高权限 |
| 普通用户 | ops、dev、alex | 1000 起 | 日常运维登录使用，权利有限，通过 sudo 按需提权 |

> **注意：** "系统用户"与"虚拟用户"的边界并不严格，二者 UID 都落在 1-999 区间，区别只在来源：系统用户来自操作系统本身，虚拟用户来自第三方软件包。具体范围以 `/etc/login.defs` 为准：RHEL/CentOS 7 及以后 `UID_MIN=1000`、系统用户区间 201-999；CentOS 6 及更早版本普通用户从 500 开始。

把 UID 分段规则单独拎出来记，判断一个账号的来路就不需要查资料了：

| UID 区段 | 归属 | 说明 |
| --- | --- | --- |
| 0 | 超级管理员 | 内核只认数字，任何 UID 为 0 的账号都是 root 权限——巡检时 `awk -F: '$3==0' /etc/passwd` 应该只返回 root 一行，多出来就要警惕后门 |
| 1-999 | 系统用户 / 虚拟用户 | 供服务进程降权使用，`SYS_UID_MIN`/`SYS_UID_MAX` 控制（RHEL 系默认 201-999），1-200 基本被发行版核心包占满 |
| 1000+ | 普通用户 | `UID_MIN`（默认 1000）起分配，useradd 自动取最大值 +1 |

内核本身不区分这些区段，分段只是发行版的约定；权限的差异完全来自 UID 数值与配置文件。所以用 `useradd -u 0 xxx` 可以造出第二个"root"，这也是为什么 UID 0 巡检是安全基线动作。

### 3.2 用户与组的关系

每个用户有且只有一个**主要组**（primary group，记录在 `/etc/passwd` 第四字段），同时可以加入多个**附属组**（supplementary groups，记录在 `/etc/group`）。用户新建的文件默认属主要组；能否访问某个文件，要看文件属组是否在用户的主要组或附属组里。

```bash
[root@linux-node1 ~]# id ops
uid=1000(ops) gid=1000(ops) groups=1000(ops),10(wheel)
# uid：用户 id；gid：主要组；groups：所属全部组（主要组 + 附属组）
```

### 3.3 原理解析：用户登录时系统做了什么

一次登录在内核与用户态之间大致经历以下步骤：

1. `getty` / `sshd` 等登录服务提供账号密码输入界面；
2. 输入用户名后，系统在 `/etc/passwd` 中查找该用户条目（找不到则直接拒绝）；
3. 读取条目中第二列的密码占位符 `x`，知道真实加密密码在 `/etc/shadow` 中；
4. 用输入的密码按 shadow 中记录的哈希算法（如 SHA-512）加密后与 shadow 中的密文比对；
5. 检查 `/etc/shadow` 中的密码与账号有效期字段，确认账号未过期、密码未过期；
6. 加载该用户的登录 shell（`/etc/passwd` 第七字段）与家目录中的环境变量文件；
7. 把本次登录写入 `/var/log/wtmp` 与 `/var/log/lastlog`，供 `last` / `lastlog` 查询。

理解这条链路就理解了绝大多数登录类故障：shell 是 `/sbin/nologin` 登录不了，shadow 中密码字段是 `!` 被锁登录不了，`/etc/passwd` 损坏则所有用户都登录不了。

链条之外还有一层要交代：第 4 步的密码校验并不是 sshd / login 自己算的，而是统一交给 **PAM**（Pluggable Authentication Modules，`/etc/pam.d/` 下的配置）调度。密码复杂度、`pam_faillock` 防爆破、`pam_umask` 这些策略都挂在 PAM 上；前面 umask 一节提到的 `pam_umask` 模块就是这里的成员之一。排查"密码明明正确却登不上"的问题时，除了查 shadow，还要看 PAM 配置与 `secure` 日志里 PAM 模块的拒绝记录。

## 四、rwx 权限的含义

```bash
r  read      读
w  write     写
x  execute   执行
```

### 4.1 文件权限

| 权限 | 含义 |
| --- | --- |
| r | 可以读文件的内容 |
| w | 可以编辑文件的内容 |
| x | 可以执行这个文件（脚本文件） |

准备测试环境：

```bash
touch test_root.txt   # 属主是 root
touch test.txt        # 属主是 ops
                      # 其他用户：dev
```

```bash
[root@linux-node1 ~]# touch test_root.txt
[root@linux-node1 ~]# ll test_root.txt
-rw-r--r--. 1 root root 0 Apr 23 10:02 test_root.txt
[root@linux-node1 ~]# touch test.txt
[root@linux-node1 ~]# ll test.txt
-rw-r--r--. 1 root root 51 Apr 23 10:02 test.txt
[root@linux-node1 ~]# chown ops test.txt
[root@linux-node1 ~]# ll test.txt
-rw-r--r--. 1 ops root 51 Apr 23 10:02 test.txt
[root@linux-node1 ~]# chmod 000 test_root.txt
[root@linux-node1 ~]# chmod 000 test.txt
[root@linux-node1 ~]# ll test_root.txt
----------. 1 root root 0 Apr 23 10:02 test_root.txt
[root@linux-node1 ~]# ll test.txt
----------. 1 ops root 51 Apr 23 10:02 test.txt
```

**文件权限配置的结论：**

1. root 用户对所有文件有绝对的权限，只要有了执行权限，root 用户可以无敌存在；
2. 对于文件来说，写的权限和执行的权限，都需要有读权限配合；
3. 如果想对文件进行操作，必须对文件赋予读的权限。

> **注意：** root 对普通文件的读与写是绕过权限位直接生效的（内核特权），但**执行**文件时仍要求文件至少带一个 x 位，这与上面的结论并不矛盾：结论中的"绝对权限"针对的是查看和编辑内容。

### 4.2 目录权限

| 权限 | 含义 |
| --- | --- |
| r | 读目录中的文件属性信息 |
| w | 可以在目录中添加或删除文件数据信息 |
| x | 是否可以进入到目录中 |

只给目录读权限时的现象：

```bash
[ops@linux-node1 ~]$ ll /home/ops/test_dir/文件
ls: cannot access test_dir/test.txt: Permission denied
total 0
-????????? ? ? ? ?            ? test.txt
```

为什么会显示 `???`，用 inode / block 的查找过程解释：

```bash
/           inode (5 r_x) -- block (home)
home        inode (5 r_x) -- block (ops)
ops         inode (7 rwx) -- block (test_dir)
test_dir    inode (4 r--) -- block (目录中文件名称)
无法进入目录
test.txt    inode 目录中的文件 inode 信息无法获取，会显示文件属性信息为 ???
```

**目录权限配置的结论：**

1. root 用户对目录信息有绝对权限；
2. 对于目录来说，写的权限和读的权限，都需要有执行权限配合；
3. 如果想对目录进行操作，必须对目录赋予执行的权限。

**默认权限的设定原则：**

```bash
一个普通文件默认权限：644  保证属主用户对文件可以编辑，保证其他用户可以读取文件内容
一个目录文件默认权限：755  保证属主用户对目录进行编辑，保证其他用户可以读取目录中的信息，可以进入到目录中
```

把目录 r 与 x 的组合语义展开，四种情况对应的实际操作如下：

| 目录权限 | 能否列出文件名 | 能否查看文件属性（inode 信息） | 能否进入目录并访问已知文件 |
| --- | --- | --- | --- |
| `r--` | 可以 | 不可以（显示 `???`） | 不可以 |
| `--x` | 不可以 | 不可以 | 可以（知道文件名就能访问） |
| `r-x` | 可以 | 可以 | 可以 |
| `-wx` | 不可以 | 不可以 | 可以（可增删文件项，适合投递目录） |

### 4.3 两个权限思考题

以 `/ops/test.txt` 为例：文件权限为 `rwx--xr--` 时，属主如何操作这个文件？其他用户可以如何操作这个文件？

（属主有读、写、执行权限，可以随意查看与修改；其他用户只有读权限，只能查看文件内容。）

### 4.4 原理解析：读取文件时的 inode / block 查找过程

读取 `/home/ops/test.txt` 的内容，内核按以下顺序层层解析：

1. 文件系统已挂载在 `/`，从根目录的 inode 出发（根 inode 号固定，通常为 2）；
2. 读取根目录的数据块，得到 `home` 这一层目录项与其 inode 号；
3. 要进入 `home` 目录，必须对 `/` 拥有 x 权限；
4. 读取 `home` 目录数据块，得到 `ops` 的目录项与 inode 号；
5. 逐级向下直到 `ops` 目录，从其数据块中得到 `test.txt` 对应的 inode 号；
6. 读取 `test.txt` 的 inode，拿到数据块位置，最后读取数据块得到文件内容。

任何一级目录缺少 x 权限，链路就断在这一级，表现为 `Permission denied` 或属性显示 `???`。这就是"文件明明有 777 却打不开"的根本原因——问题往往出在上级目录。

## 五、文件目录权限的设置方法：chmod

### 5.1 根据用户信息进行设定

| 用户类别 | 简写 |
| --- | --- |
| 属主 - user | u |
| 属组 - group | g |
| 其他用户 - other | o |

```bash
chmod u+r/w/x u-r/w/x u=rw
chmod g+r/w/x g-r/w/x g=rw
chmod o+r/w/x o-r/w/x o=rw
```

> **注意：** 上面三条分别对应 u、g、o 三类用户，写命令时注意 `-`/`+`/`=` 后面的对象要和前面的用户类别对应。

### 5.2 批量设定

**数值设定：**

```bash
[root@linux-node1 ~]# chmod 761 test.txt
[root@linux-node1 ~]# ll test.txt
-rwxrw---x. 1 root root 0 Apr 23 11:42 test.txt
```

**字符设定（a 表示所有用户）：**

```bash
[root@linux-node1 ~]# chmod a=x test.txt
[root@linux-node1 ~]# ll test.txt
---x--x--x. 1 root root 0 Apr 23 11:42 test.txt
```

## 六、默认权限是怎么来的：umask

```bash
[root@linux-node1 ~]# umask
0022
```

**默认文件权限：**

```bash
umask 数值是偶数：666 - 022 = 644
umask 数值是奇数：666 - 033 = 633 + 11 = 644
```

**默认目录权限：**

```bash
umask 数值是偶数：777 - 022 = 755
umask 数值是奇数：777 - 033 = 744
```

> **注意：** 文件默认从 666 开始减，目录默认从 777 开始减；当 umask 的某一位是奇数时，文件对应位需要再 +1（这就是"奇数 +1"规则的由来）。

### 6.1 umask 深入

umask 是 shell 内置命令（`type umask` 可以看到），对当前 shell 及其创建的子进程生效。常用取值与效果：

| umask | 新建文件权限 | 新建目录权限 | 典型场景 |
| --- | --- | --- | --- |
| 022 | 644 | 755 | RHEL 默认，文件私有可写、他人只读 |
| 002 | 664 | 775 | 开启用户私有组（UPG）时，同组成员可协作 |
| 077 | 600 | 700 | 高安全场景，仅属主可访问 |
| 027 | 640 | 750 | 组内协作但禁止组外访问 |

两个容易忽略的细节：

1. umask 只影响 9 个普通权限位，**不影响 setuid / setgid / sticky 三个特殊权限位**，这三个位只能靠 chmod 显式设置；
2. umask 是"从理论上限里减掉"，所以文件算出来永远不会有 x 位（起点 666），这是为了防止新建文本文件默认可执行。

### 6.2 如何永久修改 umask

```bash
vim /etc/profile
```

```bash
if [ $UID -gt 199 ] && [ "`/usr/bin/id -gn`" = "`/usr/bin/id -un`" ]; then
    umask 002
else
    umask 022      # 可以永久修改 umask 数值
fi
```

含义：当 UID 大于 199 且用户的组名与用户名相同时（普通用户），umask 为 002；否则（root 等）umask 为 022。

常见永久化方式的对比：

| 方式 | 生效范围 | 特点 |
| --- | --- | --- |
| `/etc/profile` 或其 `.d` 目录 | 所有用户登录 shell | 系统级，需要重新登录生效 |
| `~/.bashrc` / `~/.bash_profile` | 单个用户 | 覆盖系统设置，注意执行顺序 |
| PAM 的 `pam_umask` 模块 | 登录会话（含非交互登录） | 由 `/etc/login.defs` 的 `UMASK` 项驱动 |

## 七、系统中的特殊目录：/etc/skel（样板房）

```bash
[root@linux-node1 ~]# ll /etc/skel/ -a
total 24
drwxr-xr-x.  2 root root   62 Apr 11  2018 .
drwxr-xr-x. 81 root root 8192 Apr 23 12:11 ..
-rw-r--r--.  1 root root   18 Apr 11  2018 .bash_logout   当系统退出登录状态会执行的命令
-rw-r--r--.  1 root root  193 Apr 11  2018 .bash_profile  别名和环境变量(只针对某个用户)  家规
-rw-r--r--.  1 root root  231 Apr 11  2018 .bashrc        别名和环境变量(只针对某个用户)  家规
```

创建用户时，家目录中的数据内容会参考 `/etc/skel` 目录中的信息：

```bash
useradd dev  -->  /home/dev/  -->  目录中的数据内容会参考 /etc/skel 目录中的信息
```

### 7.1 /etc/skel 的工作机制

useradd 创建用户并建家目录时，会按以下顺序动作：

1. 按 `/etc/login.defs` 分配 uid 与主要组 gid；
2. 把用户条目写入 `/etc/passwd`，密码占位写入 `/etc/shadow`；
3. 读取 `/etc/default/useradd` 中的 `SKEL` 项（默认 `/etc/skel`）；
4. 把 `/etc/skel` 下的所有文件（含隐藏文件）复制到新家目录；
5. 按 umask 设置家目录权限（默认 700 或 755，各发行版略有差异），并把属主改为新用户。

因此往 `/etc/skel` 里放文件，之后创建的每个用户都会自带一份；用 `useradd -k 目录` 可以临时指定别的模板目录。注意方向是单向的：模板更新只影响**之后**新建的用户，存量家目录不会回填，全员下发新配置时要自己写同步脚本。

### 7.2 /etc/skel 的作用

1. 目录中可以存储运维操作规范说明文件；
2. 调整命令提示符信息。

**典型故障：命令提示符变成 `-bash-4.2$`**

原因是家目录中的环境变量文件丢失：

```bash
-bash-4.2$ ll /etc/hosts
-rw-r--r--. 2 root root 192 Apr 15 12:19 /etc/hosts
-bash-4.2$ cp /etc/skel/.b* /home/new01/
-bash-4.2$ exit
logout
[root@linux-node1 ~]#
[root@linux-node1 ~]# su - new01
Last login: Tue Apr 23 12:23:36 CST 2019 on pts/2
```

把 `/etc/skel/.b*` 拷回用户家目录后重新登录，提示符即可恢复正常。

## 八、用户相关文件清单

| 文件 | 作用 |
| --- | --- |
| `/etc/passwd` | 记录系统用户信息文件（最重要） |
| `/etc/shadow` | 系统用户密码文件 |
| `/etc/group` | 组用户记录文件 |
| `/etc/gshadow` | 组用户密码信息 |
| `/etc/default/useradd` | useradd 的默认值（组、家目录、shell、模板目录等） |
| `/etc/login.defs` | 登录与 uid/gid 分配策略、密码 aging 策略、umask 策略 |
| `/etc/skel` | 新用户家目录的模板目录 |

> **注意：** `/etc/passwd` 与 `/etc/group` 对所有用户可读（任何进程都要靠它把 uid 翻译成用户名），所以密码绝不能放里面，统一放仅 root 可读的 `/etc/shadow` 与 `/etc/gshadow`，passwd 第二列只留占位符 `x`。

## 九、/etc/passwd 七字段详解

```bash
[root@linux-node1 test]# head /etc/passwd
root    :x  :0  :0  :root    :/root          :/bin/bash
bin     :x  :1  :1  :bin     :/bin           :/sbin/nologin
daemon  :x  :2  :2  :daemon  :/sbin          :/sbin/nologin
adm     :x  :3  :4  :adm     :/var/adm       :/sbin/nologin
lp      :x  :4  :7  :lp      :/var/spool/lpd :/sbin/nologin
01      02  03  04  05       06              07
```

| 列 | 含义 |
| --- | --- |
| 第一列 | 用户名 |
| 第二列 | 用户密码信息（占位符 `x`，真实密码在 `/etc/shadow`） |
| 第三列 | 用户的 uid 信息 |
| 第四列 | 用户的 gid 信息 |
| 第五列 | 用户的注释信息，如 `mysql(manager database user)`、`www(manager web server)` |
| 第六列 | 用户家目录信息 |
| 第七列 | 用户登录系统方式 |

第七列常见的登录方式：

```bash
/bin/bash          # 通用的解释器
/usr/bin/sh        # 等价于 /bin/bash
/usr/bin/bash
/sbin/nologin      # 无法登录系统
/usr/sbin/nologin
```

配套的 `/etc/shadow` 每行 9 个字段，记录了密码本身与有效期：

| 字段 | 含义 |
| --- | --- |
| 1 | 用户名 |
| 2 | 加密后的密码（`*` 或 `!` 开头表示锁定，`!!` 表示未设置密码） |
| 3 | 最后一次修改密码距 1970-01-01 的天数 |
| 4 | 两次修改密码的最少间隔天数 |
| 5 | 密码有效天数 |
| 6 | 密码到期前多少天开始警告 |
| 7 | 密码过期后宽限天数，超过则禁用账号 |
| 8 | 账号过期天数，超过则禁用账号 |
| 9 | 保留字段 |

`/etc/group` 每行 4 个字段，与 passwd 的"第四列 gid"形成呼应：

```bash
wheel:x:10:ops,dev
  01  02 03  04
```

| 列 | 含义 |
| --- | --- |
| 第一列 | 组名 |
| 第二列 | 组密码占位符 `x`（真实信息在 `/etc/gshadow`） |
| 第三列 | 组 gid（passwd 第四列写的就是它） |
| 第四列 | 附属组成员列表，逗号分隔；主要组成员**不**出现在这里 |

最后一列最容易误解：某用户以该组为主要组时，不会列在成员列表里——所以判断用户属于哪个组，`id 用户名` 永远比看 `/etc/group` 可靠。

配套的校验命令也要认识：`pwck` 检查 `/etc/passwd` 与 `/etc/shadow` 的一致性（字段数不对、uid 重复、家目录不存在都会报出来），`grpck` 检查组文件，两者报 `duplicate` 之类的告警都要人工确认。原则上不要直接 vim 改这些文件，要改也用 `vipw` / `vigr`（编辑期间自动加锁防并发写坏），改完跑一遍校验是收尾的好习惯。

## 十、用户管理命令详解

### 10.1 创建用户：useradd

```bash
useradd ops                              # 普通用户被创建出来
useradd ops01 -M -s /sbin/nologin        # 虚拟用户被创建出来
```

常用参数：

| 参数 | 作用 |
| --- | --- |
| `-M` | 不创建家目录 |
| `-s` | 指定使用的 shell 方式 |
| `-u` | 指定用户 uid 数值信息 |
| `-g` | 指定用户所属的主要组信息 |
| `-G` | 指定用户所属的附属组信息 |
| `-c` | 添加指定用户注释说明信息 |
| `-d` | 指定家目录路径（默认 `/home/用户名`） |
| `-m` | 强制创建家目录（默认行为由 `/etc/login.defs` 的 `CREATE_HOME` 决定） |
| `-e` | 指定账号过期日期，格式 `YYYY-MM-DD`，过期后无法登录 |
| `-r` | 创建系统用户：不建家目录、uid 取自系统区间、不设置密码 aging |

```bash
[root@linux-node1 test]# useradd Alex01 -M -s /sbin/nologin
[root@linux-node1 test]# id Alex01
uid=1067(Alex01) gid=1067(Alex01) groups=1067(Alex01)
[root@linux-node1 test]# grep Alex01 /etc/passwd
Alex01:x:1067:1067::/home/Alex01:/sbin/nologin
[root@linux-node1 test]# ll /home/Alex01 -d
ls: cannot access /home/Alex01: No such file or directory
```

指定 uid：

```bash
useradd Alex03 -u 2000
[root@linux-node1 test]# id Alex03
uid=2000(Alex03) gid=2000(Alex03) groups=2000(Alex03)
```

指定主要组（可以用组名，也可以用 gid）：

```bash
useradd Alex04 -u 2001 -g Alex02
[root@linux-node1 test]# id Alex04
uid=2001(Alex04) gid=1068(Alex02) groups=1068(Alex02)
[root@linux-node1 test]# useradd Alex05 -u 2002 -g 1068
[root@linux-node1 test]# id Alex05
uid=2002(Alex05) gid=1068(Alex02) groups=1068(Alex02)
```

指定附属组：

```bash
[root@linux-node1 test]# useradd Alex07 -u 2004 -g Alex02 -G Alex03
[root@linux-node1 test]# id Alex07
uid=2004(Alex07) gid=1068(Alex02) groups=1068(Alex02),2000(Alex03)
```

添加注释说明：

```bash
useradd mysql -s /sbin/nologin -M -c "manager database"
[root@linux-node1 test]# grep mysql /etc/passwd
mysql:x:2005:2005:manager database:/home/mysql:/sbin/nologin
```

> **注意：** `-u` 指定的 uid 不能与现有用户重复，否则 useradd 直接报错；`-r` 创建的系统用户 uid 落在 `/etc/login.defs` 的 `SYS_UID_MIN`～`SYS_UID_MAX` 区间内。

顺带回答一个常见疑问：`useradd` 什么都不带时，家目录位置、默认组、shell、有效期是从哪来的？答案在两个文件里：

```bash
/etc/default/useradd   # 家目录位置、模板目录、默认 shell 等直观默认值
/etc/login.defs        # uid/gid 分配区间、密码 aging、加密算法等策略类默认值
```

说白了，`useradd` 的"默认行为"没有一点是拍脑袋来的，全部写死在这两个文件里。`/etc/default/useradd` 里的关键项与 useradd 参数一一对应：`HOME=/home` 对应 `-d` 的默认基目录、`SKEL=/etc/skel` 对应家目录模板（见第七节）、`SHELL=/sbin/nologin` 对应 `-s` 的默认值、`INACTIVE=-1` 对应密码过期后的宽限策略。`/etc/login.defs` 则控制更底层的策略：`UID_MIN`/`UID_MAX`、`PASS_MAX_DAYS`、`ENCRYPT_METHOD`（决定 chpasswd 用 SHA-512 还是别的算法）。

默认家目录不建，多数发行版的真实原因是 `/etc/login.defs` 里 `CREATE_HOME no`（RHEL 系默认 yes），而不是缺参数。想看某个默认值的最终来源，`useradd -D` 列出的就是 `/etc/default/useradd` 的内容。

### 10.2 修改用户：usermod

| 参数 | 作用 |
| --- | --- |
| `-s` | 修改用户的登录方式 |
| `-g` | 修改用户的主要的组信息 |
| `-G` | 修改用户的附属组信息 |
| `-c` | 修改用户的注释信息 |
| `-u` | 修改用户的 uid 信息 |
| `-d` | 修改家目录路径（常与 `-m` 连用，把旧家目录内容一起搬过去） |
| `-l` | 修改登录用户名 |
| `-L` / `-U` | 锁定 / 解锁用户密码 |

```bash
# 修改用户 shell 信息
[root@linux-node1 test]# usermod Alex02 -s /sbin/nologin
[root@linux-node1 test]# grep Alex02 /etc/passwd
Alex02:x:1068:1068::/home/Alex02:/sbin/nologin

# 修改用户 uid 信息
[root@linux-node1 test]# usermod Alex02 -u 3000
[root@linux-node1 test]# id Alex02
uid=3000(Alex02) gid=1068(Alex02) groups=1068(Alex02)
```

> **注意：** `usermod -G` 是**覆盖式**的，会把用户原有的附属组全部替换掉；只想追加一个附属组时，必须写 `usermod -aG 组名 用户名`（`-a` 表示 append）。这是运维最高频的手滑点之一。

改 uid（`usermod -u 新uid 用户`）也要留意：家目录里的文件属主会一并更新，但家目录**之外**的文件（比如挂到 `/data` 的项目目录）不会自动跟随，残留的旧 uid 会变成纯数字属主。彻底迁移用 `find / -uid 旧uid -exec chown 新uid {} +`，改前先停掉该用户的进程。

### 10.3 删除用户：userdel

```bash
userdel -r Alex04     # -r 彻底删除用户以及用户的家目录
[root@linux-node1 test]# ll /home/Alex04 -d
ls: cannot access /home/Alex04: No such file or directory
[root@linux-node1 test]# useradd Alex04
```

> **注意：** 不带 `-r` 时只删账号、保留家目录与邮件池；如果用户的进程还在运行，删除后其已打开文件的属主会变成纯数字 uid。生产服务器删除离职账号前，先 `pkill -u 用户名` 确认没有残留进程。

### 10.4 用户密码设置：passwd

```bash
# 交互式设置密码
passwd ops

# 非交互设置密码（示例密码一律用占位符表示）
echo '<your-password>' | passwd --stdin ops
```

`passwd -S 用户名` 输出的一行状态值得会读：`PS` 表示已设密码、`NP` 表示无密码、`LK` 表示已锁定，后面跟着改密日期与 aging 五个数值。用 `usermod -L` / `passwd -l` 锁定的用户，shadow 密码字段前会多一个 `!`——`grep 用户 /etc/shadow` 一眼就能核实。

> **注意：** `passwd --stdin` 会在命令历史中留下明文密码，生产环境谨慎使用；`--stdin` 是 RHEL 系特有的选项，Debian / Ubuntu 没有，跨发行版统一用 `chpasswd`。真实密码一律用占位符代替，不要写进笔记和脚本。

常用参数：

| 参数 | 作用 |
| --- | --- |
| 无参数 | 交互式修改当前登录用户自己的密码 |
| `用户名` | root 修改指定用户的密码，不需要知道原密码 |
| `--stdin` | 从标准输入读取密码（RHEL 系特有，适合脚本） |
| `-l` | 锁定用户（在 shadow 密码前加 `!`），禁止密码登录 |
| `-u` | 解锁用户 |
| `-S` | 查看密码状态（是否设置、锁定情况） |
| `-d` | 清空密码，变为空密码登录（高危，禁止在生产使用） |
| `-e` | 强制用户下次登录时修改密码 |
| `-n` / `-x` / `-w` | 两次修改的最小间隔 / 密码有效期 / 到期前警告天数 |

### 10.5 密码有效期管理：chage

`passwd` 的 aging 参数设置一次即可，长期策略用 `chage` 管理：

```bash
chage -l ops                     # 查看用户密码与账号有效期详情
chage -M 90 ops                  # 密码最多 90 天有效
chage -W 7 ops                   # 到期前 7 天开始警告
chage -I 7 ops                   # 密码过期后 7 天不登录就禁用账号
chage -E 2027-12-31 ops          # 账号 2027-12-31 过期
chage -d 0 ops                   # 强制下次登录必须改密（新建账号常用）
```

### 10.6 用户组相关命令

```bash
# groupadd 创建用户组
[root@linux-node1 test]# groupadd python
[root@linux-node1 test]# useradd python -g python
[root@linux-node1 test]# id python
uid=3003(python) gid=3003(python) groups=3003(python)

# groupmod 修改用户组信息
# groupdel 删除用户组信息
```

补充两个常用命令：

| 命令 | 作用 |
| --- | --- |
| `gpasswd -a 用户 组` / `gpasswd -d 用户 组` | 把用户加入 / 移出附属组（等价于 `usermod -aG` / `gpasswd -d`） |
| `gpasswd -A 用户 组` | 设置组管理员，让普通用户能管理本组成员 |
| `newgrp 组名` | 临时切换主要组（当前会话内生效） |

### 10.7 批量创建用户脚本

需要一次性创建一批账号时，用循环加 `chpasswd` 是最稳的组合：

```bash
# 准备用户清单
cat > users.txt <<'EOF'
alex01
alex02
alex03
EOF

# for 循环批量创建用户并设置初始密码
for user in $(cat users.txt); do
    useradd -m "$user"
    echo "${user}:<your-password>" | chpasswd
done

# 批量强制首次登录改密
for user in $(cat users.txt); do
    chage -d 0 "$user"
done

# 验证结果
for user in $(cat users.txt); do id "$user"; done
```

要点说明：

1. `chpasswd` 从标准输入读 `用户名:密码` 对，默认按 `/etc/login.defs` 的 `ENCRYPT_METHOD` 加密，各发行版通用；
2. 初始密码不要硬编码在脚本里长期流传，交付后应第一时间改掉或用 `chage -d 0` 强制首登改密；
3. 用户清单可以用 `seq` 生成规则账号，如 `for i in $(seq -w 1 10); do useradd "user$i"; done`。

批量建户前先想三件事，脚本只是最后一步：

1. **命名与 UID 规划**：账号名要有规律（如 `部门-序号`），并预留 UID 区段——用 `-u` 指定起始 UID 连续分配，避免后续人员转正时 uid 插到服务账号中间；
2. **初始密码的下发路径**：chpasswd 只解决"怎么设"，还要决定"怎么告诉用户"——批量贴群里等于裸奔，规范做法是首登强制改密（`chage -d 0`）加有效期；
3. **回收方案**：建户脚本旁边放一个对称的删户脚本（先 `pkill -u` 再 `userdel -r`），离职清理时才不会手忙脚乱。

账号量更大时（一次几十上百个），可以把 `用户:密码` 清单直接灌给 `newusers`，它按 `/etc/passwd` 格式逐行建号，比循环调用 useradd 快；缺点是密码字段明文过一遍文件，用完即删。再往上一档就是 Ansible 的 `user` 模块：声明式、幂等、可版本化，账号管理常态化的团队值得直接上。

### 辨析：useradd 与 adduser {: .sec-bianxi}

两个命令在 RHEL 系上是同一个程序的别名（`adduser` 是指向 `useradd` 的软链接，参数完全一致），但在 Debian / Ubuntu 上是**两个不同的程序**：

- Debian 的 `adduser` 是 Perl 脚本，交互式询问密码、全名等信息，默认创建家目录、按 1000 起分配 uid，对人工建号友好；
- Debian 的 `useradd` 是底层工具，默认**不建家目录**（除非加 `-m`），适合脚本；
- 写跨发行版脚本时统一用 `useradd` 并显式带上 `-m -s`，人工操作时再按发行版习惯选 `adduser`。

这里有个坑：在 Debian 机器上习惯 `adduser` 的人，到 RHEL 机器上敲 `adduser` 会发现"怎么全是 useradd 的参数"，而 RHEL 的人到 Debian 上敲 `adduser` 会发现"怎么是交互式的"。知道这层差异，换机器就不会懵。

## 十一、登录日志与在线用户查看

| 命令 | 数据来源 | 作用 |
| --- | --- | --- |
| `last` | `/var/log/wtmp` | 查看成功登录记录（用户、终端、来源 IP、登录与退出时间） |
| `lastb` | `/var/log/btmp` | 查看登录失败记录，排查暴力破解 |
| `lastlog` | `/var/log/lastlog` | 查看每个用户最近一次登录时间，`lastlog -u 用户` 查单人 |
| `w` | 当前会话 | 查看当前在线用户及其正在执行的命令 |
| `who` | 当前会话 | 查看登录会话（用户、终端、来源、登录时间） |
| `users` | 当前会话 | 只看当前登录的用户名列表 |

> **注意：** `/var/log/wtmp` 与 `/var/log/btmp` 是二进制文件，不能用 `cat` 查看，必须用 `last` / `lastb`；`lastb` 需要 root 权限。`last` 默认只显示"月 日"，查跨年记录时加 `-F` 输出完整年月日时分秒，避免歧义。发现 `lastb` 中有大量同一 IP 的失败记录时，应结合防火墙与 `fail2ban` 类工具封禁来源 IP。

## 十二、sudo 授权配置基础

普通用户获得 root 能力最规范的方式是 sudo：不交出 root 密码，按命令粒度授权，全程有日志。上手只要四步：

```bash
# 1) 用 visudo 编辑（自带语法检查，等价于 vi /etc/sudoers）
visudo

# 2) 常见授权写法
ops    ALL=(ALL)       /usr/sbin/useradd, /usr/bin/rm    # 授权单条命令
%wheel ALL=(ALL)       ALL                              # 授权 wheel 组全部权限（RHEL 默认）
ops    ALL=(ALL)       NOPASSWD: /usr/sbin/useradd       # 免密执行授权命令

# 3) 切到被授权用户验证
[ops@linux-node1 ~]$ sudo -l

# 4) 使用
[ops@linux-node1 ~]$ sudo useradd Alex06
```

`/etc/sudoers` 还支持别名，便于批量管理：

```bash
User_Alias  OPSGRP  = ops, dev
Cmnd_Alias  SOFTADM = /usr/sbin/useradd, /usr/sbin/usermod, /usr/bin/passwd
OPSGRP      ALL=(ALL) SOFTADM
```

> **注意：** sudo 只授权明确列出的命令，用 `sudo -l` 可以查看当前用户被授予了哪些命令。**永远不要授权 shell 类命令**（如 `/bin/bash`、`/bin/su`、`vi`、`find`），否则等于送了完整 root。sudo 的完整语法、工作原理与安全细则见《用户权限与提权》。

## 常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `useradd: UID xxx is not unique` | 指定 uid 已被占用 | `id 用户名`；`awk -F: '$3==uid' /etc/passwd` | 更换 uid，或先清理废弃账号 |
| 新建用户没有家目录 | 未加 `-m`，且 `CREATE_HOME=no` | `grep CREATE_HOME /etc/login.defs` | 改用 `useradd -m`，或修改 login.defs |
| 新用户登录提示符是 `-bash-4.2$` | 家目录缺少 `.bash_profile` / `.bashrc` | `ll -a ~` | `cp /etc/skel/.b* /home/用户名/` 后重新登录 |
| 文件属主显示为纯数字（如 1067） | 对应用户被删除，uid 没有对应条目 | `ls -l 文件`；`id 1067` | 重建用户或用 `chown` 改为有效属主 |
| `passwd: Authentication token manipulation error` | `/etc/passwd` 或 `/etc/shadow` 被加 `i` 属性、分区只读或文件损坏 | `lsattr /etc/passwd /etc/shadow`；`mount | grep ' ro,'` | `chattr -i` 解锁；修复文件系统 |
| 新用户无法登录 | shell 是 `/sbin/nologin`，或 shadow 密码字段为 `!` | `grep 用户 /etc/passwd`；`grep 用户 /etc/shadow` | `usermod -s /bin/bash 用户`；`passwd 用户` 设密 |
| 普通用户执行 sudo 提示不在 sudoers | 未授权或授权语法错误 | `visudo -c` 检查语法；确认用户名拼写 | 在 sudoers 中添加规则后用 `sudo -l` 验证 |

## 知识卡片 {: .sec-card}

**用户分类卡**

| 类型 | UID | 能否登录 | 典型代表 |
| --- | --- | --- | --- |
| 超级管理员 | 0 | 能 | root |
| 系统用户 | 1-999 | 否（nologin） | bin、daemon、adm |
| 虚拟用户 | 通常 1-999 | 否（nologin） | www、mysql、nobody |
| 普通用户 | 1000 起 | 能 | ops、dev |

**用户命令卡**

| 命令 | 一句话记忆 |
| --- | --- |
| `useradd 用户 [参数]` | 建账号，`-M -s /sbin/nologin` 出虚拟用户 |
| `usermod -aG 组 用户` | 追加附属组（别忘 `-a`） |
| `userdel -r 用户` | 删账号连家目录 |
| `passwd 用户` / `chpasswd` | 单条设密 / 批量设密 |
| `chage -l/-d 0/-M 90/-E 日期 用户` | 密码 aging 管理 |
| `groupadd/gpasswd/groupdel` | 组的增删与成员管理 |
| `last/lastb/w` | 登录历史与在线用户 |
| `visudo` + `sudo -l` | 授权与验证 |

**用户文件卡**

| 文件 | 关键点 |
| --- | --- |
| `/etc/passwd` | 七字段，全局可读，密码只放 `x` |
| `/etc/shadow` | 九字段，仅 root 可读 |
| `/etc/group` / `/etc/gshadow` | 组信息 / 组密码与管理 |
| `/etc/default/useradd` | useradd 默认值 |
| `/etc/login.defs` | uid 区间、密码策略、umask |
| `/etc/skel` | 家目录模板 |

## 现代环境补充

CentOS 7 已于 2024 年 6 月 EOL，新系统请使用 Rocky Linux / AlmaLinux / CentOS Stream。用户管理领域的新旧对照：

| 旧习惯 | 现代做法 | 说明 |
| --- | --- | --- |
| CentOS 6 / 7 手动改 `/etc/login.defs` | 同样有效，但可用 `authselect` 统一管理认证配置 | CentOS 8 起 `authconfig` 已废弃，改用 `authselect` |
| `ntpdate` 同步时间 | `chronyd`（`chronyc sources`） | `ntpdate` 已废弃，RHEL 8 起默认 chrony |
| `service crond restart` | `systemctl restart crond` | `service` 只是兼容壳，本质转发 systemctl |
| RHEL 系专用 `passwd --stdin` | 各发行版通用 `chpasswd` | `--stdin` 在 Debian 家族不存在 |
| Debian / Ubuntu 直接 `useradd` | 交互式 `adduser` | Debian 家族 `useradd` 默认不建家目录，`adduser` 更友好 |
| 只认 `/dev/sdX` | NVMe 固态硬盘为 `/dev/nvme0n1`，分区为 `nvme0n1p1` | 查看用 `lsblk` 最直观 |

## 自测题

1. `/etc/passwd` 每行第三、第四字段分别是什么？真实密码保存在哪个文件？

> **答案：** 第三字段是 uid，第四字段是主要组 gid；真实加密密码保存在 `/etc/shadow`，passwd 中只留占位符 `x`。

2. 创建用户 `alex`，要求不建家目录、不能登录系统，命令怎么写？

> **答案：** `useradd -M -s /sbin/nologin alex`。

3. 需要给 ops 用户追加一个附属组 `dev`，正确的是哪条命令？为什么？

> **答案：** `usermod -aG dev ops`。`usermod -G dev ops` 是覆盖式写法，会把 ops 原有的其他附属组全部删掉，必须加 `-a`（append）。

4. umask 为 022 时，新建文件与新建目录的默认权限分别是多少？

> **答案：** 文件 666-022=644，目录 777-022=755。

5. 用户家目录的提示符显示为 `-bash-4.2$`，如何恢复？

> **答案：** 家目录中 `.bash_profile` / `.bashrc` 等环境变量文件丢失，从 `/etc/skel` 拷回：`cp /etc/skel/.b* /home/用户名/`，然后重新登录。

## 相关阅读

- 用户权限与提权（su / sudo 深入）
- 文件属性与 inode
- 重要系统文件与运行级别
- 定时任务与 crond
- 附录-命令速查表

## 小结

1. 用户分三类：管理员 root（UID 0）、虚拟用户（1-999，不能登录）、普通用户（1000+）。
2. 文件权限更关注 **r**：w 与 x 都需要 r 配合；目录权限更关注 **x**：r 与 w 都需要 x 配合。
3. 读取数据时会从 `/` 开始逐层查找 inode 与 block，任何一层目录没有 x 权限，就无法获取下一层文件的 inode，表现为 `Permission denied` 或属性显示 `???`。
4. `chmod` 可以按 u / g / o 分别设置，也可以用 `a` 或三位数字批量设置；默认权限由 umask 决定（文件 666-umask，目录 777-umask，umask 奇数位文件再 +1）。
5. `/etc/skel` 是用户家目录的样板房，家目录中丢失 `.bash*` 文件时会出现 `-bash-4.2$` 提示符，拷贝回来即可恢复。
6. 启动流程面试要答出 CentOS 6（init，串行）与 CentOS 7（systemd，并行）的差异。
7. 用户信息集中在 `/etc/passwd`（七字段）、`/etc/shadow`（九字段）、`/etc/group`、`/etc/gshadow`，默认值在 `/etc/default/useradd` 与 `/etc/login.defs`。
8. `useradd` 建号、`usermod -aG` 加组、`userdel -r` 删号、`passwd` / `chpasswd` 设密、`chage` 管有效期，是账号管理五件套；批量建号用 for 循环 + chpasswd。
9. 登录排查用 `last` / `lastb` / `w`，分别对应历史成功、历史失败、当前在线。
10. sudo 授权遵循最小权限：`visudo` 编辑、精确到命令、验证用 `sudo -l`，绝不授权 shell 类命令。
{% endraw %}
