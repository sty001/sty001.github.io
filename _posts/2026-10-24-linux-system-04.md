---
title: "04-重要系统文件与运行级别"
date: 2026-10-24 10:38:00 +0800
categories: [软件, Linux, 02-系统操作]
tags: [Linux, 02-系统操作, Linux基础]
slug: "linux-system-04"
---

{% raw %}



`/etc` 下有几个文件值得单独拎出来讲：主机名配置文件、`/etc/hosts` 本地解析、`/etc/fstab` 开机挂载、`/etc/rc.local` 开机自执行；再往后是运行级别（CentOS 6 与 7 的对应关系，面试常考）和变量、别名的配置。

## 一、主机名称配置文件
{: .sec-expl}

### CentOS 7

**临时修改**（重启后失效）：

```bash
hostname linux-node-01
```

**永久修改**（需要重启系统才能加载配置文件）：

```bash
[root@linux-node-01 ~]# cat /etc/hostname
linux-node-01
```

**通过命令一步到位**：既可以临时修改，又可以永久修改，无需重启：

```bash
hostnamectl set-hostname linux-node-01
```

云平台上有另一只手：cloud-init 可能在重启时把主机名改回去。要在云主机上固定主机名，还得在 `/etc/cloud/cloud.cfg` 里设 `preserve_hostname: true`。

### CentOS 6

**临时修改**：

```bash
hostname linux-node-01
```

**永久修改**：

```bash
vi /etc/sysconfig/network
```

### 补充：如何查看系统版本
{: .sec-ext}

```bash
[root@linux-node-01 ~]# cat /etc/redhat-release
CentOS Linux release 7.5.1804 (Core)
```

### `hostnamectl` 详解
{: .sec-expl}

`hostnamectl` 是 systemd 提供的统一管理工具，一条命令同时改内核主机名并写入配置文件：

| 命令 | 作用 |
| --- | --- |
| `hostnamectl status` | 查看主机名、内核、系统版本、虚拟化类型等全部信息 |
| `hostnamectl set-hostname linux-node-01` | 设置静态主机名（写入 `/etc/hostname`，立即生效） |
| `hostnamectl set-hostname --pretty "Web Server 01"` | 设置"好看"的主机名（允许空格等特殊字符） |
| `hostnamectl --transient set-hostname temp` | 只改内核中临时的主机名，不写配置文件 |

主机名分三类：

| 类型 | 存储位置 | 说明 |
| --- | --- | --- |
| 静态主机名（static） | `/etc/hostname` | 管理员配置的正式名称 |
| 瞬态主机名（transient） | 内核维护 | DHCP 等动态分配的临时名称 |
| 灵活主机名（pretty） | 特殊格式 | 给人看的名称，如 `Web Server 01` |

生产环境主机名要带信息量：机房 + 业务 + 编号（如 `bj-nginx-01`），监控、日志、报修单全靠它定位机器——默认 localhost 才是灾难现场。

> **注意：** 修改主机名后，`/etc/hosts` 里最好同步加一条 `127.0.0.1 新主机名`，否则很多依赖主机名解析的服务（如 MySQL、部分监控 Agent）启动会变慢或报错，新手容易栽在这。
{: .sec-pit}

## 二、本地解析映射文件 `/etc/hosts`

`hosts` 文件的作用：在本地建立 IP 地址和主机名称的对应关系。

- Windows 本地解析文件位置：`C:\Windows\System32\drivers\etc\hosts`
- Linux 本地解析文件位置：

```bash
[root@linux-node1 ~]# cat /etc/hosts
127.0.0.1   localhost localhost.localdomain localhost4 localhost4.localdomain4
::1         localhost localhost.localdomain localhost6 localhost6.localdomain6
10.0.0.200  node01.example.com
```

hosts 的格式：一行一条记录，IP 在前、名称在后，一行可以跟多个名称（空格分隔）。改完立即生效，无需重启任何服务——本地解析不经过服务进程，就是读文件。

> **原理：** Linux 解析域名时按 `/etc/nsswitch.conf` 中 `hosts` 行指定的顺序查找（默认 `files dns`）——先查 `/etc/hosts`，查不到再问 DNS 服务器。所以 hosts 的优先级高于 DNS，这也是它能用来"临时劫持域名"（如内网测试、屏蔽广告域名）的原因。

为什么这么设计？内网环境常常没有 DNS 或 DNS 不稳，hosts 让小规模集群不依赖任何外部服务就能互访；DNS 出故障时，往 hosts 里加一条记录就能临时救急——运维排错的常用手段。

## 三、磁盘挂载文件 `/etc/fstab`

`/etc/fstab` 用于实现存储设备**开机自动挂载**：

```bash
[root@linux-node1 mnt]# cat /etc/fstab
UUID=e2fc8646-2b36-47cc-a35a-8c13208f4d0b /       xfs     defaults        0 0
UUID=34fc45ba-c38c-42bc-a120-90f9d5dd2382 /boot   xfs     defaults        0 0
UUID=62100743-6f8a-4f83-a37d-e2088c4830e2 swap    swap    defaults        0 0
定义存储设备文件信息                      挂载点
/dev/cdrom                                /mnt    ？？？  defaults        0 0
```

列的含义依次是：设备（或 UUID）、挂载点、文件系统类型、挂载参数、dump 备份标志、fsck 检查顺序。

上面示例里 swap 那行的挂载点是 `swap`，不是笔误——swap 分区不挂任何目录，该列写 `swap` 占位即可。

> **注意：** fstab 六字段的逐列详解、UUID 的查询方法（`blkid`）以及配置后的验证方法（`mount -a`）详见《系统目录结构与挂载》篇。改 fstab 前务必备份，写错可能导致系统无法启动。
{: .sec-pit}

## 四、开机自动加载文件 `/etc/rc.local`

```bash
[root@linux-node1 ~]# ls -l /etc/rc.local
lrwxrwxrwx. 1 root root 13 Mar 28 10:41 /etc/rc.local -> rc.d/rc.local
[root@linux-node1 ~]# ls -l /etc/rc.d/rc.local
-rw-r--r--. 1 root root 495 Apr  3 09:39 /etc/rc.d/rc.local
[root@linux-node1 ~]# chmod +x /etc/rc.d/rc.local
[root@linux-node1 ~]# ls -l /etc/rc.d/rc.local
-rwxr-xr-x. 1 root root 495 Apr  3 09:39 /etc/rc.d/rc.local
```

在文件中写入开机要执行的命令：

```bash
vi /etc/rc.local
systemctl start sshd
```

**`rc.local` 文件的作用**：

1. 文件中的内容信息，会在系统启动之后进行加载；
2. 文件中编写的内容，一定是命令信息。

> **注意：** 使用 `/etc/rc.local` 前，记得给 `/etc/rc.d/rc.local` 加上可执行权限（`chmod +x`），否则文件里的命令不会被执行。
{: .sec-pit}

还有个时机问题：rc.local 在所有常规服务启动完之后才执行。写进去的命令如果依赖某个服务（比如依赖网络），得自己保证服务已就绪；比 rc.local 更早执行的需求，就得写 unit 文件了。

**练习**：实现开机自动创建 `/backup/backup.txt` 文件，并且文件中有 `example.com` 内容。

```bash
vi /etc/rc.local
echo "example.com" > /backup/backup.txt
```

> **注意：** 运维人员工作的宗旨是——简单、高效、稳定。
{: .sec-pit}

> **补充：** 在 CentOS 7 中 `/etc/rc.local` 由 systemd 的 `rc-local.service` 负责执行，它内部就是一个普通的 unit 文件。如果 `rc-local.service` 启动失败，用 `systemctl status rc-local` 查看原因。现代规范更推荐为每个自启任务编写独立的 systemd unit，而不是把所有命令堆在 rc.local 里——这样每个服务可以单独管理（start / stop / 开机自启 / 看日志），互不影响。

## 五、系统运行级别（重点，面试题）
{: .sec-iv}

类比 Windows：系统出现故障时会进入安全模式。Linux 启动时哪些服务程序、网络、安全服务会启动，由**运行级别**决定。

### 查看当前运行级别

```bash
[root@linux-node1 ~]# runlevel
N 3
```

### 切换运行级别（临时调整）

```bash
init 切换的运行级别
```

### 永久调整

**CentOS 6**：

```bash
vi /etc/inittab
```

**CentOS 7**：先查看所有 target 信息

```bash
[root@linux-node1 ~]# ls -l /usr/lib/systemd/system/runlevel*target
lrwxrwxrwx. 1 root root 15 Mar 28 10:41 /usr/lib/systemd/system/runlevel0.target -> poweroff.target
lrwxrwxrwx. 1 root root 13 Mar 28 10:41 /usr/lib/systemd/system/runlevel1.target -> rescue.target
lrwxrwxrwx. 1 root root 17 Mar 28 10:41 /usr/lib/systemd/system/runlevel2.target -> multi-user.target
lrwxrwxrwx. 1 root root 17 Mar 28 10:41 /usr/lib/systemd/system/runlevel3.target -> multi-user.target
lrwxrwxrwx. 1 root root 17 Mar 28 10:41 /usr/lib/systemd/system/runlevel4.target -> multi-user.target
lrwxrwxrwx. 1 root root 16 Mar 28 10:41 /usr/lib/systemd/system/runlevel5.target -> graphical.target
lrwxrwxrwx. 1 root root 13 Mar 28 10:41 /usr/lib/systemd/system/runlevel6.target -> reboot.target
```

永久设置运行级别：

```bash
[root@linux-node1 ~]# systemctl set-default rescue.target
Removed symlink /etc/systemd/system/default.target.
Created symlink from /etc/systemd/system/default.target to /usr/lib/systemd/system/rescue.target.
```

检查默认运行级别：

```bash
[root@linux-node1 ~]# systemctl get-default
rescue.target
```

### CentOS 6 的 7 个启动级别

| 级别 | 说明 | 网络 |
| --- | --- | --- |
| 0 | 系统的关机级别，`init 0` 进入到关机状态 | — |
| 1 | 系统的单用户模式，用于修复系统或重置密码信息 | 没有网络 |
| 2 | 系统的多用户模式 | 没有网络 |
| 3 | 系统的多用户模式，正常系统运行级别 | 有网络 |
| 4 | 预留级别 | — |
| 5 | 图形化界面级别 | — |
| 6 | 系统的重启级别 | — |

单用户模式为什么能重置密码？级别 1 不启动大多数服务、不走登录认证，直接给你一个 root shell。这也是 GRUB 要加密码的原因（见系统优化篇）——否则任何摸得到物理机的人都能这样把 root 拿走。

### CentOS 7 的 target 对应关系

| 级别 | 说明 | 网络 | 对应 target |
| --- | --- | --- | --- |
| 0 | 系统的关机级别 | — | `poweroff.target` |
| 1 | 系统的单用户模式，用于修复系统或重置密码信息 | — | `rescue.target` |
| 2 | 系统的多用户模式 | 没有网络 | `multi-user.target` |
| 3 | 系统的多用户模式，正常系统运行级别 | 有网络 | `multi-user.target` |
| 4 | 预留级别 | — | `multi-user.target` |
| 5 | 图形化界面级别 | — | `graphical.target` |
| 6 | 系统的重启级别 | — | `reboot.target` |

**需要掌握的三点**：

1. 每个级别有什么用；
2. 如何查看此时系统的运行级别；
3. 如何修改设置运行级别。

> **注意：** CentOS 7 起，数字运行级别只是 systemd 的兼容入口：`init 3` 实际等价于 `systemctl isolate multi-user.target`，`runlevel` 命令读的也是 systemd 记录的状态。学习重点是 target 概念本身，`/etc/inittab` 在 CentOS 7 中已不再生效。另外 2/3/4 级在 CentOS 7 中全部映射到 `multi-user.target`，这是 systemd 的简化设计，并非遗漏。
{: .sec-pit}

`/etc/inittab` 当年管的事不少：默认级别、ctrlaltdel 按键行为、电源状态响应；systemd 把这些职责全部拆散到各 target 与独立配置里，才有了"inittab 废弃"的说法。

### 辨析：runlevel、init 与 systemctl get-default

三个命令看的是同一个体系，但不是一回事：`runlevel` 报告"上一级别 当前级别"，`N` 表示开机后没切过；`init N` 是 SysV 时代的切换命令，CentOS 7 里被 systemd 转译成 `systemctl isolate`；`systemctl get-default` 看的是开机默认进入的 target，跟当前状态是两个概念。面试时能说清"当前状态"与"默认目标"的区别，就赢过一多半人。

## 六、用户身份相关文件（知识卡片）
{: .sec-know}

用户信息分散在 `/etc/passwd`、`/etc/shadow`、`/etc/group` 三个文件中，理解这三个文件是用户管理的基础（详细操作见《用户管理》篇）。

### `/etc/passwd` 逐字段详解
{: .sec-expl}

```bash
[root@linux-node1 ~]# head -3 /etc/passwd
root:x:0:0:root:/root:/bin/bash
bin:x:1:1:bin:/bin:/sbin/nologin
```

| 字段 | 含义 | 说明 |
| --- | --- | --- |
| 用户名 | 登录系统的名称 | 如 `root` |
| 密码占位符 | `x` 表示加密密码存放在 `/etc/shadow` 中 | 若为空则表示无密码可直接登录（极危险） |
| UID | 用户 ID 编号 | `0` 为 root；1~999 为系统用户；1000+ 为普通用户 |
| GID | 用户主组编号 | 对应 `/etc/group` 中的组 |
| 描述信息 | 注释字段 | 记录用户真实姓名、部门等，无实际作用 |
| 家目录 | 用户登录后的初始目录 | root 为 `/root`，普通用户为 `/home/用户名` |
| 登录 Shell | 用户登录后使用的解释器 | `/bin/bash`；`/sbin/nologin` 表示禁止登录 |

登录 Shell 那一行多说一句：给 MySQL、nginx 这类服务账号配 `/sbin/nologin` 是标准做法——账号能跑服务却登不进系统，攻击面直接收窄。反过来，要给人用的账号千万别配成 nologin，否则 ssh 连上就掉线。

### `/etc/shadow` 逐字段详解
{: .sec-expl}

```bash
[root@linux-node1 ~]# head -2 /etc/shadow
root:$6$xyz123...:18000:0:99999:7:::
```

| 字段 | 含义 | 说明 |
| --- | --- | --- |
| 用户名 | 与 passwd 对应 | — |
| 加密密码 | 哈希值 | `$6$` 表示 SHA-512 加密；`!` 或 `*` 表示锁定，禁止登录 |
| 最近修改密码日期 | 1970-01-01 起的天数 | 如 `18000` |
| 最小修改间隔 | 两次改密码的最少间隔天数 | `0` 表示不限制 |
| 密码有效期 | 密码最长使用天数 | `99999` 表示基本不过期 |
| 警告天数 | 到期前多少天开始提醒 | 常用 `7` |
| 不活跃天数 | 过期后多少天锁定账号 | 留空表示不启用 |
| 账号过期时间 | 账号整体失效日期 | 留空表示永不过期 |
| 保留字段 | 预留未用 | — |

> **注意：** `/etc/shadow` 只有 root 能读，因为里面是密码哈希。`!` 开头的密码表示账号被 `passwd -l` 或 `usermod -L` 锁定；忘记 root 密码可以通过单用户模式或 `passwd` 重置。密码字段的格式是 `$算法$盐值$哈希`，如 `$6$` 为 SHA-512、`$1$` 为 MD5。
{: .sec-pit}

shadow 里的密码策略不必手改文件：`chage -l 用户名` 查看、`chage -M 90 用户名` 设置 90 天有效期、`chage -d 0 用户名` 强制下次登录改密。批量管密码策略，比 vi 改文件快得多也安全得多。

密码哈希为什么不直接放 passwd？历史原因是早年确实放在 passwd 里，后来发现 passwd 必须全局可读（很多程序要查用户信息），哈希跟着暴露，于是把密码字段挪进只有 root 可读的 shadow——passwd 里的 `x` 占位符就是那次分离留下的痕迹。

### `/etc/group` 逐字段详解
{: .sec-expl}

```bash
[root@linux-node1 ~]# tail -3 /etc/group
wheel:x:10:
testuser:x:1000:
devgroup:x:1001:testuser,alice
```

| 字段 | 含义 | 说明 |
| --- | --- | --- |
| 组名 | 用户组名称 | 如 `wheel` |
| 组密码占位符 | `x` 表示密码在 `/etc/gshadow` | 基本不用 |
| GID | 组 ID 编号 | 系统组 0~999，普通组 1000+ |
| 成员列表 | 属于该组的附加成员 | 多个用逗号分隔；注意只列"附加成员"，主组为该组的用户不在此列 |

把用户加进组不建议手改 `/etc/group`：用 `gpasswd -a 用户 组名` 添加、`gpasswd -d 用户 组名` 移除。手改文件一个逗号写错，整个成员列表就坏了。

> **注意：** `wheel` 组有特殊意义——`su` 命令和 sudo 配置（`%wheel ALL=(ALL) ALL`）默认信任该组成员，把普通用户加进 wheel 组等价于授予完整 root 权限，操作前务必确认。
{: .sec-pit}

## 七、变量与别名配置文件 `/etc/profile`
{: .sec-expl}

### 什么是变量
{: .sec-know}

两种理解方式：

1. **看书**：目录 → 内容，变量 → 变量值。
2. **小学算术题**：`x + 1 = 5`，则 `x = 4`；`x = 4` 时 `x + y = 5`，则 `y = 1`。已知变量 = 数值，变量 = 变量值。

**设置变量方法**：

```bash
[root@linux-node1 ~]# X=1234
```

命名习惯：环境变量几乎全大写（`PATH`、`LANG`），自己定义变量也用大写并避开系统已有名称——覆盖了系统变量是要出事的。

**调取变量方法**：

```bash
[root@linux-node1 ~]# echo $X
1234
```

取变量时单引号与双引号行为不同：双引号会展开变量、单引号原样输出——`echo '$X'` 打出来的是字面 `$X`。新手容易栽在这。

### 脚本的概念
{: .sec-know}

1. 将多个命令整合在一个文件；
2. 通过执行加载一个文件可以完成多件事。

脚本文件示例：

```bash
[root@linux-node1 ~]# vi test.sh
dir=data
mkdir /$dir/test01
mkdir /$dir/test02
mkdir /$dir/test03
```

### `/etc/profile` 与变量永久生效

**作用**：让变量信息永久生效。

**让文件立刻生效的方法**：

```bash
source /etc/profile
```

**系统中变量的类型**：

- **普通变量**：需要人为设置；
- **环境变量**：系统默认就有的变量。

### 原理解析：环境变量的加载顺序
{: .sec-know}

不同的 shell 场景加载的配置文件完全不同，这是"改了 profile 不生效"的根源所在。

1. **登录 shell**（ssh 远程登录、`su -`、虚拟机控制台登录）依次加载：`/etc/profile` → `/etc/profile.d/*.sh` → `~/.bash_profile`（没有则找 `~/.bash_login`，再没有找 `~/.profile`）；
2. `/etc/profile` 中有一段循环，负责把 `/etc/profile.d/` 目录下所有 `.sh` 文件 source 一遍——第三方软件（如 JDK、Python）通常把环境变量脚本放在这里，避免直接改 profile；

profile.d 的好处正是"一个软件一个文件"：装卸干净、互不干扰，发行版升级时 profile 本身可能被覆盖，profile.d 下的自建文件安然无恙。
3. `~/.bash_profile` 默认会再 source 一次 `~/.bashrc`，保证登录后别名也生效；
4. **非登录交互 shell**（在桌面里新开一个终端窗口、直接执行 `bash`）只加载：`/etc/bashrc` → `~/.bashrc`；
5. **非交互 shell**（执行脚本）不加载上述任何文件，脚本开头缺什么变量就自己 export。

> **注意：** 由此得出两条配置规范：环境变量（如 `PATH`、`LANG`）写在 `/etc/profile` 或 `/etc/profile.d/` 下；别名与函数写在 `~/.bashrc`（用户级）或 `/etc/bashrc`（全局）。改完后执行 `source 文件名` 立即在当前终端生效；`echo $变量名` 验证。
{: .sec-pit}

### 环境变量 PATH 的作用
{: .sec-expl}

先说清普通变量和环境变量的差别，差别在"能不能被子进程继承"：`X=1234` 是普通变量，只活在当前 shell；`export X=1234` 导出后成为环境变量，fork 出的子进程（脚本、子 shell）都能读到。这也是脚本里读不到父 shell 变量的原因——父 shell 忘了 export。

```bash
[root@linux-node1 ~]# echo $PATH
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/root/bin
[root@linux-node1 ~]# which cat
/usr/bin/cat
[root@linux-node1 ~]# cat /etc/hosts
127.0.0.1   localhost localhost.localdomain localhost4 localhost4.localdomain4
::1         localhost localhost.localdomain localhost6 localhost6.localdomain6
10.0.0.200  node01.example.com
```

把 `cat` 命令移出 PATH 中的目录，命令就找不到了：

```bash
[root@linux-node1 ~]# ls /data
test01  test02  test03
[root@linux-node1 ~]# mv /usr/bin/cat /data
[root@linux-node1 ~]# ls /usr/bin/cat
ls: cannot access /usr/bin/cat: No such file or directory
[root@linux-node1 ~]# cat /etc/hosts
-bash: /usr/bin/cat: No such file or directory
```

**修改 PATH 环境变量的方法**：

- 临时修改：

```bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/root/bin:/data
```

- 永久设置：

```bash
vi /etc/profile
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/root/bin:/data
```

> **注意：** PATH 决定了敲命令时系统在哪些目录里查找可执行文件。命令明明装了却提示 `command not found`，多半是 PATH 配置有问题——说白了，PATH 就是 shell 找命令的购物清单，清单上没有的店它不去。
{: .sec-pit}

> **补充：** 修改 PATH 时建议用追加而不是覆盖，例如 `export PATH=$PATH:/data`——直接写全量路径容易漏掉原有目录，导致 `ls`、`vi` 都找不到，整个终端瘫痪。PATH 中各目录用冒号分隔，按从左到右的顺序查找，同名命令只有第一个会被执行。

### PS1 提示符变量详解
{: .sec-warn}

提示符内容由 `PS1` 环境变量控制，默认值为：

```bash
[root@linux-node1 test]# echo $PS1
[\u@\h \W]\$
```

| 转义符 | 含义 |
| --- | --- |
| `\u` | 显示当前登录用户名称 |
| `\h` | 显示主机名（只显示第一个点之前的部分） |
| `\H` | 显示完整主机名 |
| `\w` | 显示当前所在的完整路径 |
| `\W` | 显示当前所在目录信息（目录结构的最后结尾信息） |
| `\$` | root 用户显示 `#`，普通用户显示 `$` |
| `\d` | 显示日期，格式为"星期 月份 日" |
| `\t` | 显示 24 小时制当前时间 `HH:MM:SS` |
| `\T` | 显示 12 小时制当前时间 |
| `\@` | 显示 am/pm 格式时间 |
| `\n` | 换行 |
| `\#` | 显示当前命令的编号（每执行一条命令加 1） |
| `\!` | 显示历史命令编号 |
| `\[` 与 `\]` | 包裹不可打印字符（如颜色控制序列），防止光标位置错乱 |

改 PS1 前先 `echo $PS1` 记下当前值，改坏了用它一条还原。脚本里批量设密码用 `echo '新密码' | passwd --stdin 用户名`（RHEL 系支持），Debian 系用 chpasswd。

> **注意：** `\$`（美元符号）与 `\#`（井号）含义不同：`\$` 按用户身份智能显示 `#` 或 `$`，写死在脚本外的提示符里最省心；`\#` 纯粹是命令计数器。彩色提示符的写法是 `\[\e[32;1m\]内容\[\e[0m\]`，其中 `\[` 和 `\]` 必须成对出现，包裹住颜色控制序列，否则 shell 计算行长会出错，表现为长命令折行混乱。
{: .sec-pit}

### history 历史命令机制
{: .sec-know}

```bash
[root@linux-node1 ~]# history            # 查看历史命令，带编号
[root@linux-node1 ~]# history 10         # 查看最近 10 条
[root@linux-node1 ~]# !100               # 直接重新执行第 100 条命令
[root@linux-node1 ~]# !!                 # 重新执行上一条命令
```

history 的工作机制：

1. 命令执行后先存入**内存**中的历史缓冲区，**退出登录时**才写入 `~/.bash_history` 文件；
2. 缓冲区大小由 `HISTSIZE` 控制（默认 1000 条），文件大小由 `HISTFILESIZE` 控制；
3. `HISTTIMEFORMAT` 变量控制是否显示时间戳，为空则不显示。

先存内存、退出才落盘，是性能与并发的折中：多个终端各自缓冲，避免每敲一条命令就写一次磁盘。代价也有两条——直接断开连接时最后的命令可能丢失；两个会话的历史互不可见，退出时还会互相覆盖。

```bash
export HISTTIMEFORMAT='%F %T '           # 显示 2026-10-24 10:30:00 格式的时间
export HISTSIZE=5000                     # 内存中保存 5000 条
export HISTFILESIZE=10000                # 文件中保存 10000 条
export HISTCONTROL=ignoredups            # 连续重复的命令只记一次
```

`HISTCONTROL` 的常用取值：

| 取值 | 作用 |
| --- | --- |
| `ignoredups` | 忽略连续的重复命令 |
| `ignorespace` | 忽略以空格开头的命令（不想被记录的命令前面加个空格） |
| `ignoreboth` | 前两个都生效 |
| `erasedups` | 清除整个历史中所有重复的旧条目 |

`history -c` 清空当前内存缓冲区，想连文件一起清再 `history -w` 覆盖写入——交接机器、演示环境前常这么干。

召回历史命令还有一个比 `!n` 更顺手的方式：`Ctrl + r` 输入关键字实时匹配最近命令，回车执行、按方向键取出编辑；匹配不到继续按 `Ctrl + r` 跳上一条。配合 `HISTTIMEFORMAT` 用，翻旧账很快。

> **注意：** 历史命令是双刃剑：好处是 `!n` 快速复用、`Ctrl + r` 搜索；风险是**凡是敲过的密码都会明文留在 `~/.bash_history` 里**。生产规范中，涉及密码的命令要么用 `ignorespace` + 前置空格屏蔽，要么定期清理。另外未正常退出（直接关终端）时，最后若干条命令不会写入文件。
{: .sec-pit}

### 系统别名的概念
{: .sec-know}

```bash
[root@linux-node1 ~]# ls -l /etc/hosts
-rw-r--r--. 1 root root 184 Apr  3 09:09 /etc/hosts
[root@linux-node1 ~]# ll /etc/hosts
-rw-r--r--. 1 root root 184 Apr  3 09:09 /etc/hosts
```

说明：`ll` 命令就是 `ls -l` 命令的别名。**作用**：别名可以使命令操作更加简单。

**需求 01：让下面这条长命令变简单**

```text
cat /etc/sysconfig/network-scripts/ifcfg-eth0   =>   catnet
```

先查看系统默认的别名设置：

```bash
[root@linux-node1 ~]# alias
alias cp='cp -i'
alias egrep='egrep --color=auto'
alias fgrep='fgrep --color=auto'
alias grep='grep --color=auto'
alias l.='ls -d .* --color=auto'
alias ll='ls -l --color=auto'
alias ls='ls --color=auto'
alias mv='mv -i'
alias rm='rm -i'
alias which='alias | /usr/bin/which --tty-only --read-alias --show-dot --show-tilde'
```

设置别名的语法：

```bash
alias 别名名称='命令信息'
alias catnet='cat /etc/sysconfig/network-scripts/ifcfg-eth0'
[root@linux-node1 ~]# alias
alias catnet='cat /etc/sysconfig/network-scripts/ifcfg-eth0'
```

**需求 02：让 `rm` 命令变成一句提醒**

```bash
alias rm='echo rm command is weixian,not use'
[root@linux-node1 ~]# rm -rf /data/
rm command is weixian,not use -rf /data/
```

**使别名功能失效的三种方法**：

| 方法 | 示例 |
| --- | --- |
| 取消别名 | `unalias rm` |
| 利用反斜杠（撬棍） | `\rm -rf /data` |
| 用绝对路径执行命令 | `/usr/bin/rm -rf /backup` |

**`/etc/profile` 文件的作用**：

1. 永久设置变量信息；
2. 设置别名信息。

### 辨析：临时别名与永久别名

命令行里敲 `alias catnet='...'` 只在当前会话有效，关掉终端就没了——适合临时验证。想永久生效必须写进配置文件：用户级写 `~/.bashrc`，全局写 `/etc/bashrc`（别名按惯例放 bashrc，不放 profile）。写完 `source` 一下立即生效，不用重新登录。还有一点容易忽略：脚本里别名默认全部失效，因为脚本是"非交互 shell"，根本不加载这些文件——脚本里要写完整命令。

### 全局配置与用户配置谁优先
{: .sec-expl}

配置加载顺序是"先全局、后用户"，后加载的覆盖先加载的——`~/.bash_profile` 里的同名变量会盖掉 `/etc/profile` 的设置。团队统一环境写全局，个人偏好写用户级；排查"我的变量怎么跟别人不一样"时，先查用户级文件里有没有覆盖。

## 八、`/etc/bashrc` 与相关配置文件的区别
{: .sec-expl}

| 配置文件 | 加载时机 | 适用场景 |
| --- | --- | --- |
| `/etc/profile` | 登录 shell 启动时 | 全局环境变量（PATH、LANG），会加载 profile.d |
| `/etc/profile.d/*.sh` | 被 `/etc/profile` 自动加载 | 第三方软件的环境变量（JDK、Python 等） |
| `/etc/bashrc` | 交互式非登录 shell 启动时 | 全局别名与函数 |
| `~/.bash_profile` | 对应用户登录时 | 用户私有环境变量，优先级高于全局 |
| `~/.bashrc` | 交互式 shell（登录或非登录） | 用户私有别名与函数 |
| `/etc/motd` | 登录成功后展示 | 登录后的提示信息 |

> **注意：** 两份文件开头的英文注释本身就写明了分工：`/etc/profile` 注释是 "System wide environment and startup programs, for login setup"（登录时设置全局环境），`/etc/bashrc` 注释是 "Functions and aliases go in /etc/bashrc"（函数和别名放这里）。实践建议：环境变量放 profile 系，别名函数放 bashrc 系，不要混着写。
{: .sec-pit}

## 常见错误与排错
{: .sec-ts}

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| 改了 `/etc/profile` 不生效 | 没重连或没 source；配错了文件类型 | `echo $变量名` | `source /etc/profile` 或重新登录 |
| 别名在脚本里无效 | 脚本是非交互 shell，不加载 bashrc | `type 命令` | 在脚本里显式写全命令或加 `shopt -s expand_aliases` |
| `command not found` | PATH 不含命令所在目录 | `echo $PATH` | 用绝对路径，或把目录追加进 PATH |
| 覆盖写 PATH 后 `ls` 都找不到 | PATH 被整体替换，丢了原目录 | `echo $PATH` | 用 `export PATH=$PATH:/新目录` 追加写法 |
| 单用户模式忘了 root 密码 | 无法登录系统 | 开机进救援模式 | 以 `init 1` / `rd.break` 进单用户后 `passwd` 重置 |
| fstab 错误导致无法开机 | 开机挂载失败陷入 emergency | 开机看 emergency 提示 | 用 `mount -o remount,rw /` 后修正 fstab |
| hostnamectl 改了名服务报错 | hosts 里没有新主机名解析 | `grep 主机名 /etc/hosts` | 补一条 `127.0.0.1 新主机名` |

## 现代环境补充
{: .sec-ext}

| 旧做法 | 现代做法 | 说明 |
| --- | --- | --- |
| `/etc/inittab` 配运行级别 | `systemctl set-default multi-user.target` | CentOS 7 起 inittab 已废弃 |
| `init 3` 切级别 | `systemctl isolate multi-user.target` | init 仍可用，只是 systemd 的兼容入口 |
| `vi /etc/sysconfig/network` 改主机名 | `hostnamectl set-hostname` | 一条命令同时改内核与配置文件 |
| `chkconfig` 管开机自启 | `systemctl enable/disable` | systemd 统一管理 |
| `service xxx start` | `systemctl start xxx` | service 命令只是兼容壳 |
| `/etc/rc.local` 堆命令 | 独立的 systemd unit 文件 | 每个服务可独立管理与查日志 |

> **注意：** CentOS 7 已于 2024 年 6 月停止维护，Rocky Linux、AlmaLinux 等系统上本篇所有文件路径与命令行为一致；`runlevel`、`init N` 这些旧命令仍被保留以兼容旧脚本，但内部全部转为对 target 的操作。
{: .sec-pit}

## 课后练习
{: .sec-prac}

**基础作业**

1. 如何实现光驱开机自动挂载？
2. 总结系统 7 个运行级别的作用，以及 CentOS 7 中查看运行级别、永久设置运行级别的方法。
3. 利用单用户模式重置密码的方法（CentOS 7）。
4. 如何永久设置别名（如 `rm` 别名）？

**扩展作业**

1. 安装部署一个 CentOS 6 的系统。

## 小结
{: .sec-sum}

1. 主机名：CentOS 7 用 `/etc/hostname`，`hostnamectl set-hostname` 可临时 + 永久同时生效；CentOS 6 用 `/etc/sysconfig/network`。
2. `/etc/hosts` 用于本地建立 IP 与主机名的对应关系，优先级高于 DNS，是排查域名解析问题的第一站。
3. `/etc/fstab` 负责开机自动挂载存储设备，列顺序为：设备 / UUID、挂载点、文件系统、参数、dump、fsck。
4. `/etc/rc.local` 中的命令会在系统启动后自动执行，用前需给 `/etc/rc.d/rc.local` 加可执行权限；现代做法是写独立 systemd unit。
5. 运行级别：CentOS 6 用 0~6 数字级别，CentOS 7 用 target 表示；查看用 `runlevel` / `systemctl get-default`，永久设置用 `systemctl set-default xxx.target`。
6. 环境变量加载顺序：登录 shell 走 `/etc/profile` → `/etc/profile.d` → `~/.bash_profile` → `~/.bashrc`；非登录交互 shell 走 `/etc/bashrc` → `~/.bashrc`；脚本两者都不加载。
7. PATH 决定命令搜索路径，修改用追加写法 `PATH=$PATH:新目录`；别名可让长命令变短、让危险命令变安全，失效三法：`unalias`、反斜杠、绝对路径。
8. `PS1` 控制提示符，`\u` `\h` `\W` 分别代表用户、主机、目录，颜色用 `\[\e[F;Bm\] ... \[\e[0m\]` 包裹；`history` 机制配合 `HISTTIMEFORMAT` 可以给历史命令加时间戳，但注意密码会留在历史文件里。

## 自测题
{: .sec-prac}

1. ssh 登录一台机器后执行 `alias ll='ls -l'`，再新开一个终端窗口，`ll` 还有效果吗？把这条别名写进哪个文件能保证每次登录都生效？
2. 登录 shell 和非登录交互 shell 分别会加载哪些配置文件？
3. `/etc/passwd` 中密码字段是 `x` 是什么意思？如果某用户这一字段为空会怎样？
4. CentOS 7 中要把默认运行级别设为字符界面多用户模式，用什么命令？对应的运行级别数字是几？
5. `HISTTIMEFORMAT` 的作用是什么？为什么说 history 机制存在泄露密码的风险？

> **答案：**
> 1. 还有效果——新开的终端窗口是非登录交互 shell，会加载 `~/.bashrc`；而 `alias` 是在当前会话定义的。要保证每次登录生效，应写入 `~/.bashrc`（用户级）或 `/etc/bashrc`（全局）。
> 2. 登录 shell：`/etc/profile` → `/etc/profile.d/*.sh` → `~/.bash_profile`（其内部通常会 source `~/.bashrc`）。非登录交互 shell：`/etc/bashrc` → `~/.bashrc`。
> 3. `x` 表示真实加密密码存放在 `/etc/shadow` 中；若为空，表示该用户无需密码即可直接登录，极其危险，应立即用 `passwd` 设置密码。
> 4. `systemctl set-default multi-user.target`，对应运行级别 3。
> 5. `HISTTIMEFORMAT` 让 `history` 输出时给每条命令加上执行时间，便于审计。风险在于所有敲过的命令（包括明文出现的密码）都会记录到 `~/.bash_history`，文件被读取即泄露。

## 相关阅读

- 用户管理
- 用户权限与提权
- 系统目录结构与挂载
- 软件安装与硬件信息查看
- 附录-命令速查表


{% endraw %}
