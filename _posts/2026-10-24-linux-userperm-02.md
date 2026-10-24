---
title: "Linux 用户权限与提权：su / sudo 深入与安全实践"
date: 2026-10-24 09:02:00 +0800
categories: [软件, Linux, 用户与权限]
tags: [Linux, 用户与权限]
---

{% raw %}
用户相关的四个配置文件（重点是 `/etc/passwd` 七列含义）、用户的增删改查命令（`useradd` / `usermod` / `userdel` / `passwd`）、用户组命令、属主属组修改（`chown`）、用户信息查看（`id` / `w`），以及普通用户获得 root 能力的三种方式。在此基础上深入权限模型的工作原理、特殊权限位（SUID / SGID / Sticky）、umask 细节、`/etc/sudoers` 完整语法、`su` 与 `sudo -i` 的差异、最小权限原则与常见提权风险点。目标：建账号、改属主、给同事配 sudo 权限时，知道每一步的安全边界在哪。

## 一、上节回顾

### 1.1 系统启动流程

```bash
1 开机自检 → 2 MBR 引导 → 3 grub 菜单（选择内核 / 进入单用户模式）→ 4 加载内核
→ 5 启动系统的第一个进程 init / systemd → 6 自动加载系统运行级别
→ 7 加载初始化脚本 → 8 运行相应的自启动服务 → 9 加载显示登录界面进程
```

### 1.2 数据文件权限（rwx）

**文件权限（更多关注：一定要有 read 权限）：**

| 权限 | 含义 |
| --- | --- |
| read | 读文件内容的能力（有了读文件 block 的能力） |
| write | 写文件内容的能力（有了读文件 block 的能力） |
| execute | 执行文件的能力（脚本文件） |

> **注意：** 文件是否可以编辑查看，和上一级或上 n 级目录有关，读取文件数据的过程是 `/ → ops/ → test_dir/ → test.txt` 逐层查找。

**目录权限（更多关注：一定要有执行权限）：**

| 权限 | 含义 |
| --- | --- |
| read | 读取目录下文件属性信息 |
| write | 可以在目录中创建或删除数据 |
| execute | 可以切换进入到目录中 |

### 1.3 权限修改方法与默认权限

```bash
chmod u/g/o  + - =  rwx   # 针对不同用户进行设置
chmod a      + - =  rwx   # 全部用户统一设置权限
chmod 644 xxx              # 全部用户统一设置权限（更加灵活）
```

```bash
文件默认是：644   666 - umask（umask 奇数位再 +1）
目录默认是：755   777 - umask
```

umask 是内置命令，可以影响系统数据的默认权限。永久设置方式：

```bash
if [ $UID -gt 199 ] && [ "`/usr/bin/id -gn`" = "`/usr/bin/id -un`" ]
        条件一                      条件二
then
    umask 002
else
    umask 022
fi
```

| 符号 | 含义 | 对应数学符号 |
| --- | --- | --- |
| `-gt` | greater than | `>` |
| `-lt` | less than | `<` |
| `-eq` | equal | `==` |
| `-ge` | greater && equal | `>=` |
| `-le` | less && equal | `<=` |
| `-ne` | not equal | `<>` |

其中：

```bash
$UID              显示当前登录系统用户的 uid 数值
/usr/bin/id -gn   显示当前用户的组名
/usr/bin/id -un   显示当前用户名称
```

即"UID 大于 199 且 组名与用户名相同"两个条件同时成立时，umask 为 002，否则为 022。

### 1.4 用户家目录中的特殊文件

```bash
-rw-------.  1 ops dev 1454 Apr 24 09:12 .bash_history   # 历史命令记录文件
-rw-------.  1 ops dev  651 Apr 23 10:16 .viminfo        # vim 样式设置
```

曾经输入的历史命令保存位置：

1. 保存在内存中：`history`（`history -c` 清空）；
2. 保存在磁盘文件中：`~/.bash_history`。

`.viminfo` 会自动加载文件样式信息，编写脚本时的常用头部模板：

```bash
#!/bin/bash
# 编写人: ops
# 编写时间: 2019
# 脚本作用:
```

## 二、权限模型原理解析

### 2.1 进程身份与权限判定流程

Linux 的权限检查对象不是"用户"，而是**进程**。每个进程持有三组身份：real uid / effective uid / saved set uid（组同理），日常访问控制只看 euid 与 egid。当进程访问一个文件时，内核按以下顺序判定：

1. 若进程的 euid 为 0（root），直接放行（读、写均不受权限位限制；执行仍要求至少一个 x 位）；
2. 若 euid 等于文件属主 uid，检查属主权限位（rwx 前三位）；
3. 若 egid 或任一附属组 gid 等于文件属组 gid，检查组权限位（中间三位）；
4. 以上都不满足，检查其他用户权限位（后三位）；
5. 权限位不满足则返回 `EACCES`，表现为 `Permission denied`。

这也解释了为什么改属主、加附属组能立刻改变访问结果：改的是文件与进程两组身份的匹配关系。

### 2.2 目录 x 与 r 权限的特殊含义

目录的 r 与 x 是最容易混淆的一组，展开为四种组合：

| 目录权限 | 能否列出文件名 | 能否查看文件属性（inode 信息） | 能否进入目录访问已知文件 |
| --- | --- | --- | --- |
| `r--` | 可以 | 不可以（显示 `???`） | 不可以 |
| `--x` | 不可以 | 不可以 | 可以（知道文件名即可访问） |
| `r-x` | 可以 | 可以 | 可以 |
| `-wx` | 不可以 | 不可以 | 可以（可增删文件项，适合投递目录） |

结论：对目录来说，**r 是"看见名字"的能力，x 是"穿过目录"的能力，w+x 才是"增删文件"的能力**。只有 r 没有 x 时，文件名能列出来但读不到 inode，属性就显示为 `???`。

### 2.3 umask 深入

umask 是 shell 内置命令，作用于当前 shell 及其子进程。要点：

1. 文件从 666 起减、目录从 777 起减，所以文件永远不会因为 umask 获得 x 位；
2. umask 只影响 9 个普通权限位，**不影响 SUID / SGID / Sticky 三个特殊位**；
3. umask 某位为奇数时，文件对应位要再 +1，这是"奇数 +1"规则的由来；
4. 常见取值：022（RHEL 默认，644/755）、002（用户私有组，664/775）、077（600/700）、027（640/750）；
5. 永久化方式对比：`/etc/profile`（系统级、需重新登录）、`~/.bashrc`（单用户）、PAM `pam_umask`（按 `/etc/login.defs` 的 `UMASK` 项生效，覆盖面最广）。

## 三、特殊权限位：SUID / SGID / Sticky

系统文件数据除了常见的 9 个权限位（`rwx -w- --x`），实际还有 3 个特殊权限位，共 12 个。

### 3.1 setuid：4

```bash
chmod u+s  文件信息
chmod 4755 文件信息
[root@linux-node1 ~]# ll /bin/cat
-rwsr-xr-x. 1 root root 54080 Apr 11  2018 /bin/cat
```

在属主权限位多出 `s` 信息。

**总结：** setuid 权限位设置，将文件属主拥有的能力，分配给所有人。一般赋予二进制的命令文件或一些可执行的脚本文件。

> **注意：** 脚本有两种执行方式：① 借助解释器执行，如 `sh /server/scripts/xxx.sh`、`python /server/scripts/xxx.py`；② 当成命令直接执行，需要给脚本加执行权限（`/server/scripts/xxx.sh`），或把目录加入 `PATH` 后直接敲脚本名。

深入一点：属主权限位显示 `s` 时说明该位同时带 x，显示 `S`（大写）则表示只有 suid 没有 x。典型应用是 `passwd`：普通用户改密码本质是写 `/etc/shadow`，而该文件仅 root 可写，于是给 `passwd` 置 suid，让进程以 root 身份运行、只完成改密这一件事。同理 `ping`、`su`、`sudo`、`mount` 都依赖这个机制。

还有一条硬限制值得单独立牌：**内核对脚本文件的 suid 位直接忽略**。给 `test.sh` 加 `chmod u+s` 不会生效——shebang 解释执行的场景里，内核 suid 跟随的是解释器（`/bin/bash`）而不是脚本本身，出于安全考虑这条路径整个被关掉了。所以"用 suid 脚本给普通用户开临时权限"这条路是走不通的，替代方案是 sudo 授权具体命令，或者给编译出的二进制置位。安全巡检时看到某个"脚本"带 suid 位也基本可以断定是摆设或误操作。

### 3.2 setgid：2

```bash
[root@linux-node1 ~]# chmod g+s /bin/cat
[root@linux-node1 ~]# ll /bin/cat
-rwsr-sr-x. 1 root root 54080 Apr 11  2018 /bin/cat
[root@linux-node1 ~]# chmod 2755 /bin/cat
[root@linux-node1 ~]# ll /bin/cat
-rwxr-sr-x. 1 root root 54080 Apr 11  2018 /bin/cat
[root@linux-node1 ~]# chmod 6755 /bin/cat
[root@linux-node1 ~]# ll /bin/cat
-rwsr-sr-x. 1 root root 54080 Apr 11  2018 /bin/cat
```

**总结：** setgid 权限位设置，将文件属组拥有的能力，分配给所有用户组。

sgid 用于**文件**时，进程以文件的属组身份运行；用于**目录**时更常用：该目录下新建的文件自动继承目录的属组，适合同组成员协作的目录（如 `/server/project`），省掉每次 `chgrp`。

### 3.3 sticky bit：粘滞位 1

作用：可以将不同用户信息放置到一个共享目录中，实现不同用户数据可以互相查看，但不可以互相随意修改。

```bash
chmod o+t  目录信息
chmod 1777 目录信息
```

系统中已经准备好了一个共享目录，权限位为 1777：

```bash
[root@linux-node1 ~]# ll -d /tmp/
drwxrwxrwt. 10 root root 4096 Apr 25 09:35 /tmp/
```

深入一点：目录带粘滞位后，任何用户都能在目录里建文件（rwx 全开），但只能删除**自己的**文件（root 除外），`/tmp` 的 `t` 位正是这个用途。三个特殊位的速查：

| 特殊位 | 八进制 | 作用对象 | 效果 |
| --- | --- | --- | --- |
| SUID | 4xxx | 可执行文件 | 进程以文件属主身份运行 |
| SGID | 2xxx | 可执行文件 / 目录 | 以属组身份运行 / 新文件继承属组 |
| Sticky | 1xxx | 目录 | 仅文件属主可删除自己的文件 |

### 3.4 四种提权方式的对比

| 方式 | 优势 | 劣势 |
| --- | --- | --- |
| 01 直接切换用户 `su -` | 简单快捷 | 风险太高（root 权限泛滥） |
| 02 修改数据文件权限（9 位权限位、属主信息） | 只针对某个数据文件进行修改，只针对某个用户进行授权 | 需要了解权限位功能 |
| 03 采用 sudo 提权方式 | 可以利用文件编辑指定用户有哪些指定权限（sa 运维部门、dev 开发人员） | 配置规划复杂 |
| 04 修改数据文件权限（3 位特殊权限位） | 设置权限简单方便 | 设置好的权限所有用户都拥有 |

### 3.5 查找系统中的特殊权限位文件

安全巡检的常规动作，两条命令分别找 suid 与 sgid 文件：

```bash
find / -perm -4000 -type f -ls 2>/dev/null   # 所有 SUID 文件
find / -perm -2000 -type f -ls 2>/dev/null   # 所有 SGID 文件
```

结果应当与软件包清单吻合，出现陌生的 suid 二进制文件要高度警惕（可能是后门）。

现代系统还有一套比 suid 更细的授权机制：**capabilities**（文件能力位）。它把 root 的全能拆成几十个独立能力，只给程序需要的那一个。典型例子是 `ping`——老版本靠 suid 全量提权，新版本改用 `cap_net_raw` 一个能力位，即便程序被攻破，泄露的也只有"发原始网络包"这一点权限，远小于完整 root。巡检命令：

```bash
getcap -r / 2>/dev/null        # 全盘扫描带 capability 的文件
setcap cap_net_raw=eip 程序    # 示例：给程序授予原始套接字能力
getcap 程序                    # 查看单个文件已授予的能力位
```

两个提权通道要一起查：`find -perm -4000` 找 suid，`getcap -r /` 找 capability，后者是新后门更偏爱的藏身处，因为多数老巡检脚本还没扫它。另有一个细节：文件被修改后 `setcap` 设置的能力位会自动失效（内核防止"偷换二进制保留能力"），程序升级后要重新 `setcap`——排查"程序换了版本后忽然没权限"时先看这里。

## 四、如何防范系统中的重要文件不被修改

目的：使 root 用户也不能直接修改相应文件。给文件加上"锁头"：

```bash
# 加锁方法
chattr +i /etc/passwd
ll /etc/passwd
-rw-r--r--. 1 root root 4820 Apr 25 11:01 /etc/passwd

# 解锁方法
chattr -i /etc/passwd

# 检查方法
[root@linux-node1 ~]# lsattr /etc/passwd
---------------- /etc/passwd
```

> **注意：** 加锁后连 root 都无法修改/删除该文件，排查"文件明明有权限却改不动"时，记得用 `lsattr` 看一眼是否有 `i` 属性。常用属性还有 `+a`（只能追加，适合日志文件）和 `+j`（写入先记 journal，ext3/4 支持）。

## 五、系统中和用户相关的文件

| 文件 | 作用 |
| --- | --- |
| `/etc/passwd` | 记录系统用户信息文件（最重要） |
| `/etc/shadow` | 系统用户密码文件 |
| `/etc/group` | 组用户记录文件 |
| `/etc/gshadow` | 组用户密码信息 |

### 5.1 /etc/passwd 七列含义

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

### 5.2 /etc/shadow 字段速查

配套的 `/etc/shadow` 每行 9 个字段，记录密码本身与有效期：

| 字段 | 含义 |
| --- | --- |
| 1 | 用户名 |
| 2 | 加密密码（`!` / `*` 开头表示锁定，空表示无密码可登录） |
| 3 | 距 1970-01-01 最后一次改密的天数 |
| 4 | 两次改密的最小间隔天数 |
| 5 | 密码有效天数 |
| 6 | 到期前警告天数 |
| 7 | 过期后宽限天数，超过禁用账号 |
| 8 | 账号过期天数，超过禁用账号 |
| 9 | 保留字段 |

密码字段以 `$id$` 标识哈希算法：`$1$` 为 MD5，`$5$` 为 SHA-256，`$6$` 为 SHA-512（现代系统默认），`$y$` 为 yescrypt，`$2b$` 为 bcrypt。

## 六、用户相关命令

### 6.1 创建用户：useradd

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
| `-d` | 指定家目录路径 |
| `-m` | 强制创建家目录 |
| `-e` | 指定账号过期日期（YYYY-MM-DD） |
| `-r` | 创建系统用户（不建家目录，uid 取系统区间） |

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

### 6.2 修改用户：usermod

| 参数 | 作用 |
| --- | --- |
| `-s` | 修改用户的登录方式 |
| `-g` | 修改用户的主要的组信息 |
| `-G` | 修改用户的附属组信息 |
| `-c` | 修改用户的注释信息 |
| `-u` | 修改用户的 uid 信息 |

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

> **注意：** `usermod -G` 是覆盖式写法，会把用户原有附属组全部替换；只追加一个组必须写 `usermod -aG 组名 用户名`。改 uid / 家目录后，用户已打开会话中的环境变量不会自动更新，需要重新登录。

### 6.3 删除用户：userdel

```bash
userdel -r Alex04     # -r 彻底删除用户以及用户的家目录
[root@linux-node1 test]# ll /home/Alex04 -d
ls: cannot access /home/Alex04: No such file or directory
[root@linux-node1 test]# useradd Alex04
```

### 6.4 用户密码设置：passwd

```bash
# 交互式设置密码
passwd ops

# 非交互设置密码（示例密码一律用占位符表示）
echo '<your-password>' | passwd --stdin ops
```

> **注意：** `passwd --stdin` 会在命令历史中留下明文密码，生产环境谨慎使用；该参数是 RHEL 系特有选项，Debian / Ubuntu 请改用 `chpasswd`。批量设密示例：`echo "ops:<your-password>" | chpasswd`。

### 6.5 企业中密码管理的方式

1. 密码要复杂，12 位以上，包含字母、数字及特殊符号；
2. 保存好密码信息：
   - `keepass`：密码保险柜，本地存储密码；
   - `lastpass`：密码保险柜，在线存储密码；
3. 大企业用户和密码统一管理（相当于活动目录 AD）：
   - `openldap` 域：用户信息统一保存在一个用户管理服务器中，包括用户家目录中的文件、用户密码、用户名称；
4. 动态密码：动态口令，第三方提供，自己开发也很简单。

## 七、用户组相关命令

```bash
# groupadd 创建用户组
[root@linux-node1 test]# groupadd python
[root@linux-node1 test]# useradd python -g python
[root@linux-node1 test]# id python
uid=3003(python) gid=3003(python) groups=3003(python)

# groupmod 修改用户组信息
# groupdel 删除用户组信息
```

补充：

| 命令 | 作用 |
| --- | --- |
| `gpasswd -a 用户 组` | 把用户加入附属组 |
| `gpasswd -d 用户 组` | 把用户移出附属组 |
| `gpasswd -A 用户 组` | 设置组管理员 |
| `newgrp 组名` | 当前会话临时切换主要组 |
| `vigr` | 安全编辑 `/etc/group` 与 `/etc/gshadow`（编辑时自动加锁，防止并发写坏） |

## 八、属主属组设置：chown

```bash
[root@linux-node1 test]# ll /etc/hosts
-rw-r--r--. 2 root root 192 Apr 15 12:19 /etc/hosts
[root@linux-node1 test]# chown ops.root /etc/hosts
[root@linux-node1 test]# ll /etc/hosts
-rw-r--r--. 2 ops root 192 Apr 15 12:19 /etc/hosts
```

`-R` 递归修改目录及其内容的属主和属组：

```bash
[root@linux-node1 test]# ll test_dir -d
dr-xr-xr-x. 2 ops dev 24 Apr 23 10:36 test_dir
[root@linux-node1 test]# touch test_dir/root.txt
[root@linux-node1 test]# ll test_dir/root.txt
-rw-r--r--. 1 root root 0 Apr 24 11:29 test_dir/root.txt
[root@linux-node1 test]# id Alex01
uid=1067(Alex01) gid=1067(Alex01) groups=1067(Alex01)
[root@linux-node1 test]# chown Alex01.Alex01 test_dir
[root@linux-node1 test]# ll test_dir -d
dr-xr-xr-x. 2 Alex01 Alex01 40 Apr 24 11:29 test_dir
[root@linux-node1 test]# ll test_dir/
total 0
-rw-r--r--. 1 root root 0 Apr 23 10:36 test.txt
-rw-r--r--. 1 root root 0 Apr 24 11:29 root.txt
[root@linux-node1 test]# chown -R Alex01.Alex01 test_dir
[root@linux-node1 test]# ll test_dir -d
dr-xr-xr-x. 2 Alex01 Alex01 40 Apr 24 11:29 test_dir
[root@linux-node1 test]# ll test_dir/
total 0
-rw-r--r--. 1 Alex01 Alex01 0 Apr 23 10:36 test.txt
-rw-r--r--. 1 Alex01 Alex01 0 Apr 24 11:29 root.txt
```

> **注意：** 不加 `-R` 只改目录本身的属主属组，目录里面的文件不变；加 `-R` 才会连同目录内的所有数据一起修改。`chown` 只改属主（`chown 用户 文件`）或属主加属组（`chown 用户.组`）；只改组用 `chgrp`。符号链接默认不被跟随，加 `-h` 可改链接本身。

## 九、用户信息查看：id 与 w

### 9.1 id

显示用户信息（uid、gid、所属组）。

```bash
id 用户名          # 查看指定用户的 uid、gid 与全部所属组
id -u 用户名       # 只看 uid
id -nG 用户名      # 只看所属组名列表
```

### 9.2 w

显示正在登录系统的用户信息：

```bash
[root@linux-node1 test]# w
 11:33:31 up  6:33,  1 user,  load average: 0.00, 0.01, 0.05
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
root     pts/0    10.0.0.1         08:55    3.00s  0.20s  0.00s w
01       02       03               04       05     06     07
```

| 列 | 含义 |
| --- | --- |
| 01 | 什么用户登录到了系统中 |
| 02 | 登录的方式：`pts/x` 远程登录系统，`tty1` 本地登录 |
| 03 | 从哪连接的服务器 |
| 04 | 登录时间 |
| 05 | IDLE 空闲时间 |
| 06 | 用户操作系统消耗的 CPU 资源时间 |
| 07 | 用户在干什么 |

可以直接向对方的终端写消息：

```bash
[root@linux-node1 test]# echo "请不要修改恢复 hosts 文件配置" >/dev/pts/1
```

> **注意：** 向 `/dev/pts/N` 写消息要求同一用户或 root，且对方终端未关闭消息接收（`mesg n` 会拒绝）；生产环境更规范的广播方式是 `wall 消息`。配套命令：`who` 看会话明细，`users` 只看登录用户名。

## 十、普通用户如何像 root 一样管理系统

三种方式：

| 方式 | 说明 |
| --- | --- |
| 01 | 直接切换到 root 账户下管理系统（篡权夺位） |
| 02 | 直接修改要操作的数据文件权限 |
| 03 | root 用户把部分能力赋予普通用户（sudo 提权） |

### 10.1 su 与 su - 的区别

```bash
su      部分环境变量切换用户有变化
su -    全部环境变量切换用户有变化
```

当前登录用户为 ops 时的环境变量：

```bash
[ops@linux-node1 ~]$ env|grep ops
HOSTNAME=linux-node1
USER=ops
MAIL=/var/spool/mail/ops
PATH=/usr/local/bin:/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/home/ops/.local/bin:/home/ops/bin
PWD=/home/ops
HOME=/home/ops
LOGNAME=ops
```

说明：默认当前登录系统用户为 ops 时，环境变量中会体现出 ops 用户信息。

使用 `su` 切换（部分切换）：

```bash
[ops@linux-node1 ~]$ su root
Password:
[root@linux-node1 ops]# env|grep root
HOME=/root
[root@linux-node1 ops]# env|grep ops
HOSTNAME=linux-node1
USER=ops
PATH=/usr/local/bin:/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/home/ops/.local/bin:/home/ops/bin
MAIL=/var/spool/mail/ops
PWD=/home/ops
LOGNAME=ops
```

说明：用 `su` 命令切换用户时，系统中环境变量信息部分会变为 root，但更多信息仍保留原有 ops 用户信息。

使用 `su -` 切换（完全切换）：

```bash
[ops@linux-node1 ~]$ su - root
Password:
Last login: Thu Apr 25 08:51:40 CST 2019 on pts/0
[root@linux-node1 ~]# env|grep root
USER=root
MAIL=/var/spool/mail/root
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin:/root/bin
PWD=/root
HOME=/root
LOGNAME=root
```

说明：用 `su -` 命令切换用户时，系统中环境变量信息会全部切换为 root。

顺带认识 `su - 用户 -c '命令'`：一次性以目标用户身份执行单条命令，执行完自动回到当前会话，不进交互 shell。临时以某用户身份跑个脚本、cron 里代替完整切换场景，都比"切进去再退出来"干净利落。

三种切换方式放在一起对比：

| 命令 | 环境变量 | 工作目录 | 密码 | 审计 |
| --- | --- | --- | --- | --- |
| `su 用户` | 部分切换（PATH、USER 等保留原用户） | 不变 | 需要目标用户密码 | 无（安全日志仅记录 su 调用） |
| `su - 用户` | 完整加载目标用户环境 | 切换为目标用户家目录 | 需要目标用户密码 | 同上 |
| `sudo -i` | 接近登录 shell，环境更干净 | root 家目录 | **输入自己的密码** | 有（记录执行人、命令、时间） |
| `sudo -s` | 保留当前大部分环境变量 | 不变 | 输入自己的密码 | 有 |
| `sudo su -` | 同 `su -` | root 家目录 | 输入自己的密码 | 有，但审计粒度粗 |

运维实践中的选择：日常管理优先 `sudo -i`（密码是自己的、操作有审计、不用把 root 密码告诉所有人）；需要完全模拟某用户登录场景时用 `su - 用户`。

两点补充让这张表更完整。其一，严格说 `su` 也不是零审计：`/var/log/secure` 里 pam_unix 会留下 `session opened for user root by ops(uid=1000)` 这类记录，"谁切过去了"有迹可循；但切进去之后每条命令都不落日志，与 sudo 的逐命令审计不是一个量级——所以表格里写"审计弱"而非"无"。其二，`/etc/pam.d/su` 里有一行默认被注释的 `#auth required pam_wheel.so use_uid`，取消注释后只有 wheel 组成员才能 `su` 到 root，其余用户即使知道 root 密码也切不进去。这行和 sudoers 的 `%wheel` 授权一起，构成"能不能切、能做什么"的两道门。脚本里还能用 `$SUDO_USER` 判断自己是否正被 sudo 执行并拿到原始用户名，做审计记录或限制提权来源时有用。

再补一层根因：`su` 与 `su -` 的分水岭是**登录 shell**。`su -` 会以 login shell 启动目标用户的 shell，完整走一遍 `/etc/profile` → `~/.bash_profile` 的加载链，所以 USER、MAIL、PATH、家目录全部换成目标用户的；不带 `-` 的 `su` 是非登录 shell，只读 `~/.bashrc` 一层，大部分继承自当前会话。这也解释了两个高频故障：用 `su` 切过去后 `ifconfig` 找不到命令（sbin 不在继承来的 PATH 里），或者环境变量"改了不生效"（改的是 profile，而当前会话没按 login shell 加载）。排查切换类环境问题，先问自己一句：这个 shell 是不是登录 shell。

### 10.2 sudo 工作原理与 /etc/sudoers 语法详解

**原理解析：sudo 一次授权背后发生了什么**

1. 用户在 shell 输入 `sudo 命令`，`sudo` 是带 suid 的程序，进程以 root 身份启动；
2. sudo 读取 `/etc/sudoers`（以及 `/etc/sudoers.d/` 下的文件），逐条匹配"当前用户、当前主机、目标身份、命令"；
3. 命中规则后，检查是否带 `NOPASSWD`；没有则向用户索要**自己的**密码（不是 root 密码）；
4. 校验通过，sudo 以 root（或规则指定的 runas 用户）身份 fork 执行目标命令；
5. 执行记录写入系统日志（RHEL 系为 `/var/log/secure`，Debian 系为 `/var/log/auth.log`），管理员可回溯"谁在什么时间以 root 身份做了什么"；
6. 校验通过后默认 5 分钟内免密（时间戳缓存，目录 `/run/sudo/ts/`），`sudo -k` 可立即失效。

第 5 条的审计价值值得单独展开，这是 sudo 区别于 su 的核心竞争力：

1. **责任到人**：su 切过去之后所有操作都是 root 干的，事后无法区分是谁执行；sudo 每条命令都带着原始用户名落日志，"谁在什么时候以 root 身份执行了什么"可以精确回溯；
2. **合规要求**：等保、审计检查中"特权操作可追溯"是硬指标，靠的就是 sudo 日志；
3. **事后取证**：被入侵或误操作后，`grep sudo /var/log/secure`（Debian 系看 `/var/log/auth.log`）能还原操作时间线；配置了 `Defaults logfile` 的还能看到完整的命令行与环境变量。

审计这层对团队的意义说白了就一句话：root 密码可以不给任何人，但任何人都能在授权范围内干活，且干过的每一步都有据可查。

sudoers 每行的基本格式为：

```text
用户/组  主机=(可切换的身份[:组])  授权的命令
```

| 元素 | 写法 | 说明 |
| --- | --- | --- |
| 用户 | `ops` | 单个用户；`%wheel` 表示组；`#uid` 表示 uid |
| 主机 | `ALL` | 规则生效的主机名，多环境可精确限定 |
| 身份 | `(ALL)` 或 `(root)` | 可切换到的目标用户，可加 `:组` 限定组 |
| 命令 | `/usr/sbin/useradd` | 必须用绝对路径；`ALL` 表示全部；`!命令` 表示排除 |
| 标签 | `NOPASSWD:` / `PASSWD:` / `NOEXEC:` / `SETENV:` | 控制是否免密、是否禁止子进程、是否允许传环境变量 |

表中 `%wheel` 单独说两句。wheel 是 Unix 时代传下来的"管理员组"，名字取自 big wheel（大人物）。现代发行版的默认策略不同：

- RHEL / Rocky / AlmaLinux：sudoers 里 `%wheel ALL=(ALL) ALL` 默认开启，装系统时勾选"管理员"的用户就是被加进了 wheel 组；
- Debian / Ubuntu：对应的是 `sudo` 组（`%sudo ALL=(ALL:ALL) ALL`），wheel 组存在但默认不授权；
- 给用户开全量 sudo 的规范动作：`usermod -aG wheel 用户名`（Debian 系换成 `sudo` 组），不要直接往 sudoers 主文件里加个人条目。

用组而不是逐个用户授权的好处：收权就是 `gpasswd -d` 移出组，一行命令，不用碰 sudoers。

别名机制（别名必须在使用前定义，一行写不下用 `\` 续行）：

```bash
# 用户别名
User_Alias  OPSGRP  = ops, dev, test

# 主机别名
Host_Alias  DBSRV   = db01, db02

# 命令别名
Cmnd_Alias  SOFTADM = /usr/sbin/useradd, /usr/sbin/usermod, /usr/bin/passwd

# 身份别名
Runas_Alias DBADM   = oracle, mysql

OPSGRP  ALL=(root) SOFTADM
```

常用 `Defaults` 全局选项：

```text
Defaults    env_reset                 # 重置环境变量，防止恶意 PATH 注入
Defaults    secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Defaults    timestamp_timeout=5       # 免密时间窗改为 5 分钟
Defaults    logfile="/var/log/sudo.log"   # 单独记录 sudo 日志
Defaults    requiretty                # 已废弃，现代系统不再使用
```

审计要求严格的团队还能开**会话录制**：`Defaults log_input, log_output` 会把提权会话的输入输出完整录到 `/var/log/sudo-io/`，事后用 `sudoreplay -l` 列出会话、`sudoreplay 会话ID` 像放录像一样逐屏回放。代价是日志体积涨得快，只对高特权账号开启比较现实。再配 `Defaults badpass_message="密码错误，该行为已记录"` 与 `Defaults passwd_tries=3`，安全性与提示友好度都能兼顾。

`sudoers` 文件本身还能导出成机器可读格式：`visudo -x /tmp/sudoers.json`（老版本用 `cvtsudoers`），巡检脚本解析 sudoers 规则时比正则硬拆稳妥。

**a. 怎么进行授权：**

```bash
visudo
93 ops  ALL=(ALL)       /usr/sbin/useradd, /usr/bin/rm
```

即在 `/etc/sudoers` 第 93 行附近，按 `用户 主机=(可切换的身份) 授权的命令` 的格式书写。

```bash
visudo                 # 推荐使用，自带语法检查功能，等价于 vi /etc/sudoers
[root@linux-node1 ~]# visudo -c   # 配置好的文件语法检查
/etc/sudoers: parsed OK
```

扩展配置方法：

```bash
# 1) 授权单个命令或多个命令
/usr/sbin/useradd, /usr/bin/rm, ,

# 2) 授权单个命令目录或多个命令目录（需要排除部分特权命令）
/usr/sbin/*, !/usr/sbin/visudo , /usr/bin/*

# 3) 不需要输入用户密码，可以直接 sudo 方式执行命令
NOPASSWD: /usr/sbin/*, !/usr/sbin/visudo , /usr/bin/*
```

> **注意：** 授权命令目录时用 `!命令` 排除特权命令（尤其是 `visudo`），否则被授权用户可能反向提权到完整 root。更细粒度的规则建议放到 `/etc/sudoers.d/` 目录下的独立文件管理（文件名不带点，权限 0440），不要直接改主文件，便于版本化管理。

NOPASSWD 的风险边界要划清楚。它省掉的只是"输自己密码"这一步，代价是：**拿到该账号 shell 的任何人都直接拥有对应 root 能力**，身份校验环节整个失效。场景分三类看：

- **交互式人工账号**：尽量不用 NOPASSWD。密码这一步本来就是防"别人用你的终端"的；
- **自动化脚本 / CI**：合理场景，但必须把授权范围压到具体命令（如 `NOPASSWD: /usr/bin/systemctl restart nginx`），绝不能 `NOPASSWD: ALL`；
- **授权了可写目录里的脚本**：NOPASSWD 加上脚本可写等于后门，脚本放 root 属主的固定路径并确保目录不可写。

还有一个隐蔽点：NOPASSWD 授权的命令如果本身能执行任意子命令（`find`、`vim`、`less`、`awk` 等），免密会放大逃逸风险——这些命令要配 `NOEXEC:`，或者干脆不给。

**b. 如何验证已经获取了 root 用户的能力：**

```bash
[ops@linux-node1 ~]$ sudo -l
We trust you have received the usual lecture from the local System
Administrator. It usually boils down to these three things:

    #1) Respect the privacy of others.
    #2) Think before you type.
    #3) With great power comes great responsibility.
[sudo] password for ops:
User ops may run the following commands on linux-node1:
    (ALL) /usr/sbin/useradd, /usr/bin/rm
```

**c. 执行 root 用户可以执行的命令：**

```bash
[ops@linux-node1 ~]$ sudo useradd Alex06
useradd: user 'Alex06' already exists
[ops@linux-node1 ~]$ sudo useradd Alex07
useradd: user 'Alex07' already exists
[ops@linux-node1 ~]$ sudo useradd Alex08
[ops@linux-node1 ~]$ sudo rm -f /etc/hosts
```

> **注意：** sudo 只授权明确列出的命令，用 `sudo -l` 可以查看当前用户被授予了哪些命令。

sudo 常用子命令与参数：

| 命令 | 作用 |
| --- | --- |
| `sudo -l` | 列出当前用户被授权的命令 |
| `sudo -i` | 以 root 身份打开登录 shell（类似 `su -`） |
| `sudo -s` | 以 root 打开 shell，保留当前环境变量 |
| `sudo -u 用户 命令` | 以指定用户身份执行（runas） |
| `sudo -k` | 立即作废时间戳缓存，下次重新输密码 |
| `sudo 命令` | 提权执行单条命令 |

表里没列但很实用的是 `sudo -e 文件`（或 `sudoedit 文件`）：以普通用户身份调用编辑器、以 root 身份保存结果。它比 `sudo vim 文件` 安全得多——编辑器本身运行在你的权限下，`!sh` 这类编辑器内逃逸拿到的只是你自己的 shell，root 权限只在最后写文件的瞬间生效。需要频繁改配置文件的场景，优先把 `sudoedit` 授权出去而不是整个 vim。同类的小众选项还有 `sudo -g 组 命令`，以指定**组**身份执行命令，不需要是该组成员，适合"临时借用某个服务组权限查日志"的场景。

### 10.3 最小权限原则

给同事配权限时，按以下顺序收敛：

1. **能不授就不授**：能用普通用户完成的工作不开 sudo；
2. **授命令不授 shell**：授权 `/usr/sbin/nginx -s reload`，而不是 `/bin/bash`——后者等于送完整 root；
3. **写绝对路径**：命令必须绝对路径，防止用户在自己的目录放假命令顶替；
4. **排除危险命令**：授权目录时用 `!` 排除 `visudo`、`su`、`passwd root`、`mount` 等；
5. **按角色分组授权**：用 `User_Alias` / 组把开发、运维、DBA 分开，不要图省事 `ALL=(ALL) ALL`；
6. **加 `NOEXEC:`**：防止被授权程序（如某些编辑器、`find`）再 fork shell 逃逸；
7. **定期审计**：`grep sudo /var/log/secure` 回顾执行记录，离职人员权限及时回收。

这些原则落到执行层面可以压缩成一句话：sudoers 里每一行都应该能回答"谁、在哪台机器、以什么身份、能跑哪条命令"四个问题——答不全的行就是过宽的授权，迟早要收回来。

### 10.4 常见提权风险点

| 风险点 | 原理 | 排查命令 | 防护建议 |
| --- | --- | --- | --- |
| 陌生 SUID 文件 | 任何人执行都以属主（root）身份运行 | `find / -perm -4000 -type f 2>/dev/null` | 与软件包清单比对，删除多余 suid |
| sudo 授权了 shell / 编辑器 | 授权 `vi`、`find`、`awk` 后可在其内部 `!sh` 拿到 root shell | `sudo -l` 逐条审查规则 | 只授权具体命令，加 `NOEXEC:` |
| 计划任务被篡改 | root 的 crontab 或 `/etc/cron.d` 文件被非 root 可写 | `ls -l /var/spool/cron/ /etc/cron.d/` | 确保仅 root 可写，巡检文件权限 |
| 服务配置可写 | nginx、mysql 等配置被低权用户修改，进而以服务身份执行任意命令 | `ls -l /etc/nginx/nginx.conf` | 配置属主 root，权限 644 |
| 家目录与 `.ssh` 权限过松 | 他人可改 `~/.ssh/authorized_keys` 或历史命令文件 | `ls -la ~/.ssh` | 家目录 700，`authorized_keys` 600 |
| `NOPASSWD: ALL` | 免密全量授权，任何拿到该账号的人直接是 root | `grep -r NOPASSWD /etc/sudoers /etc/sudoers.d/` | 精确到命令，仅自动化场景使用 |

## 常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `xxx is not in the sudoers file` | 未授权或规则未生效 | `sudo -l`；`visudo -c` 检查语法 | 补规则后重新登录再验证 |
| 输对自己密码仍被拒 | 记成 root 密码；或账号被 `passwd -l` 锁定 | `passwd -S 用户名`；`grep 用户 /etc/shadow` | sudo 要的是**自己的**密码；解锁账号 |
| sudo 能跑但命令还是 Permission denied | 命令的输出文件在无权限目录 | `namei -l 目标路径` 逐级看权限 | 修目标目录权限或授权写入命令 |
| 属主显示为数字 | 对应用户已删除 | `ls -l 文件`；`id 数字uid` | 重建账号或 `chown` 到有效用户 |
| `usermod -G` 之后组全丢了 | 覆盖式写法没加 `-a` | `id 用户名` | `usermod -aG` 重新追加 |
| 文件改不动但权限是 777 | `chattr +i` 加锁或只读挂载 | `lsattr 文件`；`mount | grep ro` | `chattr -i` 解锁；重新挂载为 rw |
| su 切换后找不到命令 | `su` 未完整切换 PATH | `echo $PATH` | 用 `su -` 完整加载环境变量 |

## 知识卡片

**特殊权限位卡**

| 位 | 八进制 | 显示 | 作用 |
| --- | --- | --- | --- |
| SUID | 4 | `rwsr-xr-x` / `rwSr-xr-x` | 以文件属主身份执行 |
| SGID | 2 | `rwxr-sr-x` / 目录 `drwxrwsr-x` | 以属组执行 / 新文件继承属组 |
| Sticky | 1 | `drwxrwxrwt` | 共享目录里只能删自己的文件 |

**提权方式卡**

| 方式 | 命令 | 密码 | 审计 | 适用 |
| --- | --- | --- | --- | --- |
| 完全切换 | `su - 用户` | 目标用户密码 | 弱 | 模拟目标用户环境 |
| 登录式提权 | `sudo -i` | 自己密码 | 强 | 日常运维管理 |
| 单命令提权 | `sudo 命令` | 自己密码 | 强 | 例行操作、自动化 |
| 权限位提权 | SUID / SGID | 无 | 无 | 特定程序（passwd 等） |

**sudoers 语法卡**

| 片段 | 含义 |
| --- | --- |
| `ops ALL=(ALL) ALL` | ops 在所有主机上可执行任何命令 |
| `%wheel ALL=(ALL) ALL` | wheel 组成员获得全部权限（RHEL 默认） |
| `ops ALL=(root) NOPASSWD: /usr/sbin/useradd` | 免密执行单条命令 |
| `Cmnd_Alias X = /a, /b` | 命令别名 |
| `Defaults timestamp_timeout=5` | 免密时间窗 5 分钟 |

## 现代环境补充

CentOS 7 已于 2024 年 6 月 EOL，新系统（Rocky Linux / AlmaLinux / CentOS Stream）在用户与权限领域的变化：

| 旧做法 | 现代做法 | 说明 |
| --- | --- | --- |
| `authconfig --passalgo=sha512` | `authselect` 管理 PAM / NSS 配置 | CentOS 8 起 `authconfig` 已废弃 |
| `sssd` 手动写配置接入 LDAP | `authselect select sssd with-...` | 统一入口，减少手写配置错误 |
| `ntpdate` 校时 | `chronyd` + `chronyc` | `ntpdate` 已废弃 |
| sudoers 全靠手改主文件 | `/etc/sudoers.d/*.drop-in` 分文件管理 | 便于 Ansible 等工具下发与版本控制 |
| `chage` / `passwd -x` 管密码 | 同样有效；配合 `pwquality` 模块加强复杂度 | `pam_pwquality` 强制密码长度与字符种类 |
| `/etc/shadow` 加密算法 MD5 | SHA-512（`$6$`）或 yescrypt（`$y$`） | `$1$`（MD5）已不安全，新系统不再默认使用 |

## 自测题

1. 一个进程访问文件时，内核按什么顺序判定权限？

> **答案：** 先看 euid 是否为 0（root 直接放行）；再看 euid 是否等于文件属主，匹配则用属主位；再看 egid 或附属组是否等于文件属组，匹配则用属组位；都不匹配用 other 位；权限位不足返回 `EACCES`。

2. 目录权限 `r--` 与 `--x` 分别能做什么？为什么只有 `r` 时文件属性显示 `???`？

> **答案：** `r--` 只能列出文件名，读不到 inode，因此属性显示 `???` 且无法进入；`--x` 不能列目录，但知道文件名就能进入并访问该文件。`???` 是因为获取文件属性（stat）需要沿目录项读到 inode，而这只在目录有 x 时才被允许。

3. `su` 与 `su -`、`sudo -i` 的核心区别是什么？

> **答案：** `su` 只部分切换环境变量（HOME 会变，USER、PATH 等保留原用户），`su -` 完整加载目标用户环境；`sudo -i` 提供接近登录 shell 的环境，但验证的是**自己的**密码，并且全程有审计日志。

4. 给用户授权 `/usr/sbin/*` 但不允许其编辑 sudoers，sudoers 里怎么写？

> **答案：** `用户 ALL=(ALL) /usr/sbin/*, !/usr/sbin/visudo`。授权目录必须用 `!` 排除特权命令，否则被授权者可通过 `visudo` 反向拿到完整 root。

5. 排查一台机器是否被植入 SUID 后门，用什么命令？还应检查哪些提权风险点？

> **答案：** `find / -perm -4000 -type f 2>/dev/null` 找出全部 SUID 文件并与软件包清单比对。同时检查：sudoers 是否授权了 shell / 编辑器类命令（`sudo -l`）、root 计划任务与 `/etc/cron.d` 是否被非 root 可写、服务配置文件权限、用户家目录与 `.ssh` 权限。

## 相关阅读

- [用户管理：分类、账号文件与常用命令](01-用户管理.md)
- [文件属性与 inode](../03-文件属性与正则表达式/03-文件属性与inode.md)
- [文件属性进阶](../03-文件属性与正则表达式/04-文件属性进阶.md)
- [定时任务与 crond](../06-定时任务/01-定时任务与crond.md)
- [附录-命令速查表](../附录-命令速查表.md)

## 小结

1. 用户信息集中在 `/etc/passwd`（七列：用户名、密码占位、uid、gid、注释、家目录、登录 shell）、`/etc/shadow`、`/etc/group`、`/etc/gshadow`。
2. `useradd` 的 `-M -s /sbin/nologin` 创建虚拟用户，`-u` / `-g` / `-G` / `-c` 分别指定 uid、主要组、附属组与注释；`usermod` 参数与之对应（`-G` 是覆盖式，追加必须加 `-a`），`userdel -r` 连家目录一起删除。
3. `chown 用户.组 文件` 改属主属组，改目录内容一定要加 `-R`；`id` 看 uid/gid，`w` 看谁在线、从哪来、在干什么。
4. 普通用户获得 root 能力有三条路：直接 `su -` 切过去、改数据文件权限、用 sudo 精确授权。
5. `su` 只切换部分环境变量（HOME 变了、USER/PATH 没变），`su -` 会完整加载目标用户的环境变量，运维操作推荐 `su -`；日常管理更推荐 `sudo -i`（自己的密码 + 全程审计）。
6. sudo 用 `visudo` 编辑（自带语法检查），配置后用 `sudo -l` 验证、用 `sudo 命令` 执行；sudoers 支持别名与 `Defaults`，命令必须绝对路径，授权目录要用 `!` 排除特权命令。
7. 三个特殊权限位：SUID（4，以属主身份执行）、SGID（2，以属组执行 / 目录内新文件继承属组）、Sticky（1，共享目录仅能删自己的文件）。
8. 权限判定的本质是进程身份与文件属主属组的匹配：文件重 r（w、x 都需 r 配合），目录重 x（r、w 都需 x 配合）。
9. 最小权限原则：能不授就不授、授命令不授 shell、绝对路径、排除特权命令、按角色分组、加 `NOEXEC`、定期审计日志。
10. 常见提权风险点：陌生 SUID 文件、sudo 授权 shell / 编辑器、计划任务与服务配置被低权可写、家目录权限过松，全部有对应排查命令，应纳入日常巡检。
{% endraw %}
