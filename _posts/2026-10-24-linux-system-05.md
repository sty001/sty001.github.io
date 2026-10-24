---
title: "05-软件安装与硬件信息查看"
date: 2026-10-24 10:37:00 +0800
categories: [软件, Linux, 02-系统操作]
tags: [Linux, 02-系统操作, Linux基础]
slug: "linux-system-05"
---

{% raw %}

系统基础的收尾篇：别名永久生效、内置命令与外置命令的区别、登录前后提示文件、`/usr/local` 目录与 yum / rpm / 编译三种安装方式、yum 排错、系统日志，最后是 CPU、内存、磁盘、负载的查看方法。学完这篇，一台新服务器的基础配置就能独立拿下了。

## 别名如何永久设置

**需求**：让 `rm` 命令等价于 `echo "command not exec"`，避免误删。

**第一个里程：编写 profile 文件**

```bash
vi /etc/profile
alias rm='echo command not exec'
```

**第二个里程：加载 profile 文件内容**

```bash
source /etc/profile
```

**第三个里程：修改用户家目录中的 `.bashrc`**

先查看隐藏数据（Linux 系统中隐藏文件都是以点开头）：

```bash
[root@linux-node1 ~]# ls -a
.  ..  anaconda-ks.cfg  .bash_history  .bash_logout  .bash_profile  .bashrc  .cshrc  .tcshrc
```

```bash
vi /root/.bashrc
#alias rm='rm -i'
```

### 补充：内置命令与外置命令

系统中将命令分为两个大类：

1. **外置命令**：需要进行安装才有的命令；
2. **内置命令**：所有系统都内置的命令。

查看命令属于内置还是外置：

```bash
[root@linux-node1 ~]# type cd
cd is a shell builtin
[root@linux-node1 ~]# type mkdir
mkdir is /usr/bin/mkdir
```

> **原理：** 内置命令（builtin）编译在 bash 程序内部，如 `cd`、`echo`、`alias`，执行时不创建新进程，因此 `cd` 才能改变当前 shell 的工作目录；外置命令是磁盘上的可执行文件，执行时通过 fork + exec 加载。内置命令随 shell 存在，换一个 shell（如 dash、zsh）可能就不存在——这也是脚本开头要写 `#!/bin/bash` 的原因之一。

### 环境变量与别名相关的配置文件

| 配置文件 | 生效范围 |
| --- | --- |
| `/etc/profile`、`/etc/bashrc` | 全局生效（对所有用户生效） |
| `~/.bashrc`、`~/.bash_profile` | 只对指定用户生效，且优先级更高 |

两个文件的作用注释本身也说明了分工：

```text
# System wide environment and startup programs, for login setup
  01. 设置环境变量信息和程序启动相关的信息，为登录之后的系统环境做准备

# Functions and aliases go in /etc/bashrc
  02. 可以配置函数和别名功能，最好配置在 /etc/bashrc
```

**变量的作用**：

1. 普通变量：简化脚本的编写；
2. 环境变量：与系统环境配置有关，如 `PATH`（可以让命令操作更简便）。

**别名的作用**：

1. 让命令操作更简单——长命令变短命令（别名）；
2. 让危险操作更安全——例如把 `rm` 别名成 `echo`。

**别名的临时设置方法**：

```bash
alias 别名='命令信息'
```

> **注意：** 三个里程的完整逻辑是——第 1、2 里程改的是全局 `/etc/profile`（对所有用户生效），第 3 里程改的是 root 自己的 `~/.bashrc`（只对 root 生效）。用户级的 `~/.bashrc` 优先级高于全局配置，所以想让设置只对某个账号起作用，就写在自己的 `~/.bashrc` 里。

## 登录之后的提示文件 `/etc/motd`

```bash
[root@linux-node1 ~]# cat /etc/motd
Connecting to 10.0.0.200:22...
Connection established.
To escape to local shell, press 'Ctrl+Alt+]'.

Last login: Thu Apr  4 09:55:53 2019 from 10.0.0.1
linux-node-01
[root@linux-node1 ~]#
```

**作用**：登录成功后显示的内容，可以对操作系统的用户进行注意事项说明（如操作规范、告警信息）。

> **说明：** motd 即 message of the day。上面示例中 `Connecting to ...` 与 `Last login ...` 部分实际是 Xshell 客户端和 sshd 的提示，`linux-node-01` 才是 `/etc/motd` 里配置的内容。`Last login` 信息由 sshd 打印，来自 `/var/log/lastlog`，与 motd 无关。

## 登录之前的提示文件 `/etc/issue`、`/etc/issue.net`

```bash
[root@linux-node1 ~]# cat /etc/issue
\S
Kernel \r on an \m

[root@linux-node1 ~]# cat /etc/issue.net
\S
Kernel \r on an \m
```

**如何清空文件内容**：

```bash
echo "" > /etc/issue      # 清空文件（实际写入一个空行）
>/etc/issue               # 清空文件
[root@linux-node1 ~]# >/etc/issue
[root@linux-node1 ~]# >/etc/issue.net
```

**在文件中添加信息**：

```bash
[root@linux-node1 ~]# echo linux-node-01 > /etc/issue
```

> **注意：** 登录前的提示文件会暴露系统版本信息，从安全角度建议清空或替换成自定义内容。

两个文件的区别：`/etc/issue` 显示在本地控制台登录前；`/etc/issue.net` 显示在远程 ssh 登录前（受 sshd 的 `Banner` 配置影响）。

文件中的转义符速查：

| 转义符 | 含义 |
| --- | --- |
| `\S` | 操作系统名称 |
| `\r` | 内核版本 |
| `\m` | 硬件平台（如 x86_64） |
| `\n` | 主机名 |
| `\t` | 当前时间 |
| `\d` | 当前日期 |

## 程序软件安装相关目录 `/usr/local`

```bash
[root@linux-node1 ~]# ll -d /usr/local/
drwxr-xr-x. 12 root root 131 Mar 28 10:40 /usr/local/
```

为什么编译安装默认放 `/usr/local`？FHS 给它的定位就是"本地管理员手动安装的软件"——包管理器（yum/rpm）的数据库不记录这里的文件，升级系统时不会被覆盖，删掉目录就等于卸载干净。反过来这也是它的软肋：没有数据库，时间久了没人记得装过什么。

### 系统中安装软件的三种方式

| 方式 | 类比 | 对应方法 | 特点 |
| --- | --- | --- | --- |
| 01 | 订餐点外卖（做好的饭 + 筷子） | **yum 安装软件** | 简单快捷（必须掌握） |
| 02 | 买半成品（速冻饺子，加工一下） | **rpm 安装软件** | 需要有软件安装包 |
| 03 | 自己做饭（买食材，自己做） | **编译安装软件** | 可以灵活调整编译参数 |

## 原理解析：rpm 与 yum 的关系 {: .sec-why}

- **rpm（RedHat Package Manager）**：直接操作 `.rpm` 包的工具。它只关心**单个包**——包里有什么文件、依赖谁，它自己不知道，也不负责帮你找。所以 `rpm -ivh` 装一个复杂软件时，经常因为缺依赖连环报错；
- **yum（Yellowdog Updater Modified）**：rpm 之上的**仓库管理层**。它从 yum 源（仓库）里读取所有软件包的元数据（含依赖关系表），你装 A 它自动算出还要装 B 和 C，一并下载安装，并校验 GPG 签名；
- 类比：rpm 是"手动装 exe"，yum 是"应用商店自动装 App"。说白了，yum 只是把"找依赖、下载、安装"这三步自动化了。

| 对比项 | rpm | yum |
| --- | --- | --- |
| 管理粒度 | 单个 rpm 包 | 软件及其依赖树 |
| 依赖处理 | 不解决，缺依赖就报错 | 自动分析并安装依赖 |
| 软件来源 | 本地 rpm 文件 | 网络或本地 yum 仓库 |
| 典型场景 | 查询、校验、离线安装单个包 | 日常装软件、批量部署 |
| 底层实现 | 读写 rpm 数据库（`/var/lib/rpm`） | 解析 repodata，最终仍调用 rpm 安装 |

> **注意：** yum 安装软件时底层仍然调用 rpm 完成安装，rpm 数据库是唯一的事实来源。所以 `rpm -qa` 能看到通过 yum 装的所有包，两种查询方式结果一致。

### rpm 常用命令表

| 命令 | 作用 |
| --- | --- |
| `rpm -q 软件名` | 查询软件是否已安装 |
| `rpm -qa` | 查询所有已安装的软件包 |
| `rpm -qa \| grep 关键词` | 在所有已安装包中按关键词过滤 |
| `rpm -qi 包名` | 查看包的详细信息（版本、厂商、简介） |
| `rpm -ql 包名` | 列出包安装的所有文件 |
| `rpm -qc 包名` | 只列出包产生的配置文件 |
| `rpm -qd 包名` | 只列出包产生的文档 |
| `rpm -qf 文件` | 反查某个文件属于哪个包 |
| `rpm -ivh 包.rpm` | 安装（i 安装、v 过程、h 进度条） |
| `rpm -Uvh 包.rpm` | 升级安装（没装过则直接装） |
| `rpm -Fvh 包.rpm` | 只升级已安装的旧版本 |
| `rpm -e 包名` | 卸载软件 |
| `rpm -e --nodeps 包名` | 忽略依赖强制卸载 |
| `rpm -V 包名` | 校验包内文件是否被改动（常用于安全排查） |

装本地 rpm 同时自动补依赖：`yum localinstall 包.rpm`（或 `yum install ./包.rpm`），比裸 `rpm -ivh` 省心得多。

> **注意：** `rpm -e --nodeps` 是双刃剑：能卸掉卸不掉的"钉子户"，但被依赖它的程序会立刻崩溃。卸载前先用 `rpm -q --whatrequires 包名` 看看谁在依赖它。

### rpm -U 与 -F 的差别

`-Uvh` 是"没装过就装、装过就升级"；`-Fvh` 是"装过才升级、没装过直接跳过"。批量刷新一整批包时用 `-F` 只更新系统里已有的，不会把新软件意外带进来——灰度更新时这个差别很关键。

### yum 常用命令表

| 命令 | 作用 |
| --- | --- |
| `yum install 软件名` | 安装软件（自动装依赖） |
| `yum install -y 软件名` | 安装时不询问，直接确认 |
| `yum remove 软件名` | 卸载软件 |
| `yum update` | 升级所有可升级的软件 |
| `yum update 软件名` | 升级指定软件 |
| `yum list installed` | 列出已安装的软件 |
| `yum provides 文件路径` | 反查文件属于哪个软件包（相当于 `rpm -qf` 的在线版） |
| `yum search 关键词` | 按关键词搜索软件 |
| `yum info 软件名` | 查看软件概要信息 |
| `yum clean all` | 清空所有缓存（源出问题时的第一步） |
| `yum makecache` | 重新生成缓存元数据 |
| `yum repolist` | 查看可用的仓库及软件包数量 |
| `yum grouplist` | 查看软件组（如"开发工具"组） |
| `yum groupinstall "Development Tools"` | 安装软件组，编译环境一键搞定 |

yum 还带"后悔药"：`yum history` 列出每次安装/升级事务，`yum history undo 编号` 能整体回滚一次操作——升级出问题时的第一救援手段。查"最近装了什么把系统搞坏"用 `rpm -qa --last`，按安装时间倒序一击即中。

### 辨析：yum install 与 yum update {: .sec-bianxi}

`yum install 软件名` 只动指定的软件及其依赖；`yum update`（不带包名）会把全系统所有可升级的包一口气升到最新——内核、glibc 全在里面。生产服务器跑 `yum update` 前必须想清楚：升完内核要重启，老依赖可能失效，回滚很麻烦。惯例是平时只 `yum update 指定包`（打安全补丁），系统级升级安排在维护窗口统一做。

## 用 yum 方式下载安装软件

**第一个里程：本地配置 yum 源文件**

```bash
[root@linux-node1 ~]# cd /etc/yum.repos.d/
[root@linux-node1 yum.repos.d]# ll
total 32
-rw-r--r--. 1 root root 1664 Apr 29  2018 CentOS-Base.repo
```

源文件中的典型配置段：

```ini
[base]
name=CentOS-$releasever - Base
mirrorlist=http://mirrorlist.centos.org/?release=$releasever&arch=$basearch&repo=os&infra=$infra
```

统一 yum 安装环境（把默认源替换为阿里云源）：

```bash
curl -o /etc/yum.repos.d/CentOS-Base.repo http://mirrors.aliyun.com/repo/Centos-7.repo
```

**命令作用**：从镜像站下载一个 yum 源文件，更新默认的 `/etc/yum.repos.d/CentOS-Base.repo`，使下载环境统一。

想把 yum 下载的 rpm 留下来离线复用：`/etc/yum.conf` 里加 `keepcache=1`，包会存到 `/var/cache/yum/` 下；或用 `yumdownloader 软件名`（来自 yum-utils 包）只下载不安装——内网机器迁移软件包常这么干。

**第二个里程：安装软件**

```bash
yum install 软件名称
yum install -y vim tree wget net-tools nmap bash-completion
```

> **注意：** `bash-completion` 用于补全 CentOS 7 中的部分命令参数，装完之后命令行补齐体验会好很多。

### 本地 yum 源与 EPEL

**本地 yum 源**：机房服务器不能上外网时，可以把系统安装光盘做成本地仓库：

```bash
mount /dev/cdrom /mnt                                   # 挂载光盘
vi /etc/yum.repos.d/local.repo                           # 新建本地源配置
```

```ini
[local]
name=CentOS Local
baseurl=file:///mnt
enabled=1
gpgcheck=0
```

```bash
yum clean all && yum makecache                          # 清缓存并重建
yum install -y nginx                                     # 之后正常使用
```

**EPEL（Extra Packages for Enterprise Linux）**：由 Fedora 社区维护的扩展软件仓库，提供大量企业版官方源里没有的软件（如 `htop`、`sl`、`cowsay`、`ncdu`）。CentOS 7 装 EPEL：

```bash
yum install -y epel-release
```

> **注意：** 只有 base 源没有的软件才需要 EPEL，装了 EPEL 之后 `yum install` 同名软件可能优先从 EPEL 装，版本号可能与官方源不同。生产环境要评估这个风险，必要时在源配置里调 `priority`。新手容易栽在这：明明 `yum install` 成功了，跑起来行为却和文档对不上，查一下才发现装的是 EPEL 的版本。

### yum 安装软件的排错流程

**01. 能不能访问外网**

- a. 访问外网 IP 地址不通 → 网卡地址配置有问题；
- b. 访问外网名称不通 → DNS 配置有问题。

**02. 检查是否已经有正在下载的进程**

```bash
ps -ef        # 相当于 Windows 任务管理器中的进程列表，PID 为进程编号
kill -9 PID
```

`ps -ef` 与 `ps aux` 是两套常用姿势：前者全格式列进程，后者按资源展示；两者都常配合 grep 用，`ps -ef | grep nginx` 是找进程的老三样。

**03. yum 源文件被修改调整**，检查 `/etc/yum.repos.d/` 下的源是否正常。

> **补充：** 第四步是清缓存重建——源内容更新后本地元数据过期，会导致"找不到明明存在的包"：

```bash
yum clean all && yum makecache
```

出现 `Another app is currently holding the yum lock` 时，说明上一次 yum 进程没退干净，用 `ps -ef | grep yum` 找到后 `kill -9`，再删掉 `/var/run/yum.pid` 即可。

## 源码编译安装

当官方源里没有需要的软件、或需要定制功能时，用源码编译安装。典型三步：

```bash
tar -xf nginx-1.24.0.tar.gz        # 第一步：解压源码包
cd nginx-1.24.0
./configure --prefix=/usr/local/nginx --with-http_ssl_module   # 检查环境、生成 Makefile、指定安装位置与功能模块
make                               # 第二步：按 Makefile 编译
make install                       # 第三步：复制文件到 --prefix 指定目录
```

编译前先装好编译工具链：

```bash
yum groupinstall -y "Development Tools"
```

> **注意：** `./configure` 报错 `not found` 通常是缺依赖开发库，缺什么装什么，如 `yum install -y zlib-devel pcre-devel openssl-devel`。卸载编译安装的软件直接删除安装目录（`rm -rf /usr/local/nginx`），这也是编译安装最大的软肋——没有统一的注册表，时间久了谁也说不清系统里装过什么。

三种安装方式对比：

| 对比项 | yum | rpm | 源码编译 |
| --- | --- | --- | --- |
| 依赖处理 | 自动解决 | 不解决 | 编译时检查，需手动装齐 |
| 版本灵活性 | 源里有什么装什么 | 同上 | 任意版本，最新 |
| 定制能力 | 无 | 无 | 完全可定制编译参数 |
| 安装速度 | 快 | 快 | 慢（编译耗时） |
| 卸载 | `yum remove` | `rpm -e` | 删目录，无记录 |
| 升级维护 | 一条命令 | 一条命令 | 需重新编译 |
| 适用场景 | 日常软件首选 | 离线单包 | 定制化、新版本软件 |

## 日志文件保存目录 `/var/log/`

```bash
ll /var/log/
```

两个重要的系统日志文件：

| 日志文件 | 作用 |
| --- | --- |
| `messages` | 记录系统或服务程序运行的状态信息和错误信息 |
| `secure` | 记录用户登录信息，可用于监控文件、检查是否有过多失败记录 |

两份日志按来源分开不是随意安排：rsyslog 按 facility（来源类别）分发，`messages` 收内核与大多数服务的通用记录，`secure` 专收认证类（sshd、su、sudo）。追登录问题只看 secure，追服务异常先看 messages，排查范围直接缩小一半。

```bash
[root@linux-node1 ~]# cat /var/log/secure
Apr  4 11:35:29 linux-node1 sshd[3568]: Accepted password for root from 10.0.0.1 port 54913 ssh2
Apr  4 11:35:29 linux-node1 sshd[3568]: pam_unix(sshd:session): session opened for user root by (uid=0)
    01             02        03               04
```

各字段含义：

1. 用户是什么时间登录的；
2. 登录的主机名称；
3. 使用什么方式进行远程登录；
4. 登录情况说明：
   - a. 正确登录情况说明；
   - b. 错误登录情况说明。

排查暴力破解别只靠肉眼翻：`lastb | head` 看最近的失败登录，`grep 'Failed password' /var/log/secure` 配合 `awk` 能统计出来源 IP 排行，失败次数异常多的 IP 直接交给防火墙封掉。

### 如何查看日志信息

```bash
head -5 /etc/profile       # 查看前面几行信息（默认查看前面 10 行内容）
tail -6 /etc/profile       # 查看倒数几行信息（默认查看倒数 10 行内容）
tail -f /var/log/secure    # 一直追踪查看文件内容的变化，查看日志常用
```

> **补充：** 更多日志排查技巧：`grep -i error /var/log/messages` 过滤错误；`tail -f` 配合 `Ctrl + s` 暂停刷新、`Ctrl + q` 恢复（终端被锁定时不是卡死）；`last` 命令查看登录历史（读自 `/var/log/wtmp`），`lastb` 查看登录失败记录（读自 `/var/log/btmp`）——排查"服务器有没有被暴力破解"就用这两条。CentOS 7 起部分日志由 systemd-journald 管理，可用 `journalctl` 查询，日志轮转由 logrotate 负责（详见系统优化篇）。

## 系统硬件信息查看方法

先建立一个整体认知：`/proc` 与 `sysfs`（`/sys`）都是内核暴露状态的窗口，前者偏进程与系统信息，后者偏设备与驱动。`lscpu`、`free`、`df` 这些命令本质都是读这些文件后做格式化输出——理解了这一点，命令不存在时你知道直接去 cat 哪个文件。

### CPU 信息

**a. 利用文件进行查看**

```bash
cat /proc/cpuinfo
model name: Intel(R) Core(TM) i5-8400 CPU @ 2.80GHz   -- CPU 品牌型号
physical id	: 0                                       -- 表示 CPU 颗数，这里是 1 颗
processor	: 0                                       -- 表示 CPU 核数，这里是 1 核
cpu cores	: 1
```

判断有几颗 CPU、几个核心：

```text
physical id	: 0   第一段   physical id	: 0      -- 有两颗 CPU
physical id	: 0   第二段
physical id	: 1   第三段   physical id	: 1
physical id	: 1   第四段

physical id	: 0   processor	: 0                  -- 一颗 CPU 有两个核心
physical id	: 0   processor	: 1
cpu cores	: 2

physical id	: 1   processor	: 0                  -- 一颗 CPU 有两个核心
physical id	: 1   processor	: 1
cpu cores	: 2
```

结论：这台服务器有两颗 CPU（2 路服务器），共 4 核心。

**b. 利用命令进行查看**

```bash
lscpu        # 调取 cpuinfo 文件中的内容
Socket(s):(插槽)             2    --- 显示服务器 CPU 颗数
Core(s) per socket:          2    --- 每颗 CPU 有几核
CPU(s):                      4    --- 整个服务器有几核
```

`/proc/cpuinfo` 关键字段速查：

| 字段 | 含义 |
| --- | --- |
| `model name` | CPU 品牌型号 |
| `physical id` | 物理 CPU 的编号，不同值代表不同颗 CPU |
| `cpu cores` | 每颗 CPU 的核心数 |
| `processor` | 逻辑 CPU（线程）编号 |
| `siblings` | 每颗 CPU 的逻辑线程数 |
| `flags` | 支持的特性（如 `vmx` 支持虚拟化、` aes` 支持 AES 加速） |
| `cache size` | CPU 缓存大小 |
| `MHz` | 当前运行频率（随节能策略浮动） |

> **注意：** `processor` 条目数是**逻辑核**数，开了超线程后是物理核数的两倍；判断物理颗数看 `physical id` 有几个不同值，判断每颗几个核看 `cpu cores`。云服务器的 `/proc/cpuinfo` 看到的是虚拟 CPU，颗数与核数是宿主机抽象出来的，不代表物理硬件。

### 负载（CPU 处理任务过多）

**a. 利用文件进行查看（监控）**

```bash
cat /proc/loadavg
0.00        0.01              0.05             负载值和 CPU 核数有关
1 分钟平均   5 分钟平均负载     15 分钟平均负载
```

例子：

- 4 核服务器：负载值到 3 左右，就要开始关注；
- 128 核服务器（如数据库服务器）：负载值到 100 才需要关注。

负载该除以核数判断：`lscpu` 里的 `CPU(s)` 就是分母，负载除以它持续超过 1 就该查了。

> **补充：** `/proc/loadavg` 斜杠后的两个数字含义是 `当前运行进程数/总进程数` 和 `最近一秒内核调度实体数`。负载是"包括等磁盘 IO 的进程数"，所以磁盘 IO 打满时 CPU 闲着负载也会飙高——高负载先看是 CPU 型还是 IO 型。

**b. 利用命令进行查看**

```bash
[root@linux-node1 ~]# w
 12:41:06 up 38 min,  2 users,  load average: 0.00, 0.01, 0.05
```

`top` 里先记三个键：`q` 退出、`P`/`M` 按 CPU/内存排序、数字 `1` 展开每颗逻辑核。

负载和使用率不是一回事：使用率看 CPU 时间片占用比例，负载看"正在跑 + 排队等（含等磁盘 IO）"的任务数。CPU 使用率 100% 但负载只有 1，说明单核跑满但没有积压；使用率 20% 负载却高达 50，多半是磁盘 IO 卡住了大量进程。两个指标对照着看，才能判断瓶颈在哪。

顺带分清三个命令：`w` 与 `uptime` 第一行相同（时间、运行时长、登录数、负载），`w` 额外列出每个登录用户的终端与正在执行的命令；`top` 是实时进程视图（默认 3 秒刷新，按 `P`/`M` 排序 CPU/内存）。快速看负载用 `w`，定位谁吃资源用 `top`。

### 内存使用情况

**a. 利用文件进行查看**

```bash
[root@linux-node1 ~]# cat /proc/meminfo
MemTotal:        2030172 kB      --- 内存总的容量
MemFree:         1738164 kB      --- 内存的空闲容量
MemAvailable:    1714096 kB      --- 内存的可用容量
Buffers:            2076 kB      --- buffer 空间
Cached:            90616 kB      --- cache 空间
SwapCached:            0 kB      --- 交换分区使用情况
```

**b. 利用命令进行查看**

```bash
[root@linux-node1 ~]# free -h      # 以人类可读方式显示内存容量信息
              total        used        free      shared  buff/cache   available(*)
Mem:           1.9G        137M        1.7G        9.5M        148M        1.6G
Swap:          1.0G        0B(*)       1.0G
```

`/proc/meminfo` 关键字段速查：

| 字段 | 含义 |
| --- | --- |
| `MemTotal` | 内存总容量 |
| `MemFree` | 完全空闲的内存 |
| `MemAvailable` | 可用内存（估算值，含可回收的缓存） |
| `Buffers` | 块设备缓冲（写数据暂存） |
| `Cached` | 文件缓存（读数据暂存） |
| `SwapCached` | 被换出又频繁读回的内存量 |
| `Active` / `Inactive` | 活跃 / 不活跃内存 |
| `SwapTotal` / `SwapFree` | swap 分区总量与空闲量 |
| `Dirty` / `Writeback` | 待写回磁盘的数据量 |
| `Slab` | 内核数据结构占用的内存 |
| `CommitLimit` | 允许的超额承诺内存上限 |

> **注意：** `free` 看到的 `free` 很小不用慌——Linux 的设计是"内存闲着也是闲着，不如拿来做缓存"，`buff/cache` 会在应用程序需要时立刻释放。**判断内存够不够要看 `available` 列**——老版本 free（CentOS 6 及更早）没有这一列，那时只能拿 free 加 buff/cache 手工估算，新版本是内核直接给的估算值，它才是应用程序实际可用量。当 `available` 持续走低、`SwapCached` 增大时，才需要关注内存压力。

内存真耗尽时内核会启动 OOM Killer：按评分挑一个占用最大的进程直接杀掉，`dmesg | grep -i "out of memory"` 能找到"被害人"记录。swap 只能延缓不能避免这一刻——这也是数据库服务器宁可加内存也不依赖 swap 的原因。

### 辨析：Buffers 与 Cached {: .sec-bianxi}

两者都是拿内存当缓存，方向不同：`Buffers` 对应写——块设备的元数据、还没落盘的数据块先放这里攒一批再写，减少碎片化的小写入；`Cached` 对应读——读过的文件内容留在内存，下次命中就不用碰磁盘。`free -h` 把它们合并显示成 `buff/cache`，日常不用分太细，记住"都可在内存紧张时回收"就行。

### 磁盘信息 / 挂载信息

**a. 利用文件进行查看**

```bash
cat /proc/mounts
/dev/sda1 /boot xfs rw,seclabel,relatime,attr2,inode64,noquota 0 0
```

**b. 利用命令进行查看**

```bash
[root@linux-node1 ~]# df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda3        49G  1.6G   48G   4% /
devtmpfs        981M     0  981M   0% /dev
tmpfs           992M     0  992M   0% /dev/shm
tmpfs           992M  9.6M  982M   1% /run
tmpfs           992M     0  992M   0% /sys/fs/cgroup
/dev/sda1       197M  102M   95M  52% /boot
tmpfs           199M     0  199M   0% /run/user/0
```

> **补充：** `df -h` 的 `tmpfs` 行都是内存文件系统，不占磁盘；查"目录里谁占空间大"用 `du -sh /var/log/* | sort -rh | head`。磁盘使用率超过 80% 就要开始关注，90% 以上很多服务（数据库、日志）会直接异常。这里有个坑：文件删了空间不释放，多半是进程还握着文件句柄，`lsof | grep deleted` 一查便知。

df 与 du 对不上时别慌，通常两个原因：一是进程握着已删除文件的句柄（du 查不到但空间没释放，重启对应进程即恢复）；二是挂载点下又挂了别的设备（du 只算目录里的，df 把挂载进来的也算上）。先用 `lsof | grep deleted` 和 `mount` 排这两项。

### 硬件信息查看命令速查表

| 命令 | 作用 | 备注 |
| --- | --- | --- |
| `lscpu` | 查看 CPU 架构、颗数、核数、线程 | 读自 `/proc/cpuinfo` 与 sysfs |
| `lsmem` | 以内存条 / 地址区间维度查看内存 | 识别插槽与热插拔内存块 |
| `free -h` | 查看内存与 swap 使用 | 关注 `available` 列 |
| `lspci` | 列出 PCI 设备（网卡、RAID 卡、显卡） | `lspci -v` 看详情，需 pciutils 包 |
| `lsusb` | 列出 USB 设备 | 需 usbutils 包 |
| `dmidecode` | 读取 SMBIOS/DMI 硬件信息 | 内存型号、序列号、硬件配置；需 root |
| `uname -a` | 查看内核版本与系统架构 | `uname -r` 只看内核版本 |
| `lsblk` | 树形查看块设备与分区 | `lsblk -f` 同时显示 UUID 与文件系统 |
| `lsmod` | 查看已加载的内核模块 | 排查驱动是否生效 |
| `dmesg` | 查看内核环形缓冲区日志 | 硬件报错、启动信息，`dmesg -T` 转本地时间 |

常用组合：

```bash
dmidecode -t memory                  # 查看内存条数量、单条容量、频率
dmidecode -s system-serial-number    # 查看机器序列号（报修、资产登记必备）
lspci | grep -i eth                  # 查看网卡型号
uname -r                             # 3.10.0-862.el7.x86_64
```

> **注意：** `dmidecode` 读的是主板 BIOS 信息，真实物理机信息准确；虚拟机里看到的是虚拟硬件信息。`lscpu` 输出的 `Architecture: x86_64` 表示 64 位系统，如果显示 `i686` 则是 32 位——装软件时下错架构的包就是从这里看出来的。另外 dmidecode 的输出含序列号等资产信息，截图发群前注意脱敏。

内存容量还有个换算的坑：`free` 显示的 G 是 GiB（1024 进制），内存条标的 G 是 GB（1000 进制），32G 的机器 free 显示 30G 出头是正常的，不是内存条少装了。想看磁盘 IO 详情用 `iostat -x 1`（sysstat 包），`%util` 接近 100% 就是这块盘打满了。

## 常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| `rpm -ivh` 报 `Failed dependencies` | 缺依赖包 | 看报错里缺的包名 | 改用 `yum install` 自动解决，或先装依赖 |
| `yum install` 找不到包 | 没配 EPEL、源没缓存 | `yum repolist` | 装 `epel-release`、`yum clean all && makecache` |
| `Another app is currently holding the yum lock` | 上次 yum 进程未退 | `ps -ef | grep yum` | `kill -9` 残留进程，删 `/var/run/yum.pid` |
| `command not found` 但文件存在 | 没加可执行权限或不在 PATH | `ls -l 文件`、`echo $PATH` | `chmod +x`，或用绝对路径 / 加入 PATH |
| `./configure` 报缺少依赖 | 缺开发库 | 看报错缺的头文件 | `yum groupinstall "Development Tools"`，按提示装 `xxx-devel` |
| 登录后 `ll` 命令不存在 | 新用户没有别名配置 | `alias` | 在 `~/.bashrc` 或 `/etc/bashrc` 中补 `alias ll='ls -l'` |
| `free` 显示 free 很小 | 被缓存占用 | `free -h` 看 available | 正常现象，关注 available 列即可 |
| CPU 核数对不上 | 开了超线程（逻辑核）或虚拟化 | `lscpu` 对比 socket / core / CPU(s) | 理解逻辑核与物理核的区别 |

## 现代环境补充

| 旧做法 | 现代做法 | 说明 |
| --- | --- | --- |
| `yum` | `dnf` | Rocky / AlmaLinux / Fedora 的默认包管理器，用法与 yum 一致 |
| `netstat -lnt` | `ss -lnt` | net-tools 已废弃 |
| `ifconfig` | `ip addr` | 同上 |
| `cat /var/log/messages` 看一切 | `journalctl` | systemd 时代日志统一入口 |
| `rpm -ivh` 装本地包 | `dnf install ./pkg.rpm` | 本地 rpm 也能自动补依赖 |
| `dmidecode` 看硬件 | `lscpu` / `lsmem` / `lsblk` | 优先用标准化工具，dmidecode 需 root |

> **注意：** CentOS 7 已于 2024 年 6 月停止维护，Rocky Linux、AlmaLinux 上 `yum` 命令仍可用（兼容符号链接），底层实际是 `dnf`，本篇所有命令在这些系统上原样可用。`/proc` 文件系统在所有 Linux 上行为一致，`lscpu`、`free` 等来自 util-linux 与 procps-ng 包，任何发行版都有。

## 课后练习

1. 将之前的课程进行回顾总结。
2. 总结命令 / 参数。
3. 预习系统优化方法。
4. 练习 vim 使用技巧。

## 小结

1. 别名永久生效要改 `/etc/profile`（全局）和用户家目录的 `~/.bashrc`（单用户），改完用 `source` 加载；`type` 命令可区分内置命令与外置命令。
2. `/etc/motd` 是登录后的提示文件，`/etc/issue` 与 `/etc/issue.net` 是登录前的提示文件，后者建议清空以避免泄露系统版本。
3. 装软件有三种方式：yum（自动解决依赖，首选）、rpm（单包安装，不解决依赖）、编译安装（最灵活但无依赖管理）；`/usr/local` 常用于编译安装的软件。
4. yum 装不上时按步骤排查：能否访问外网（IP 通不通、DNS 通不通）、是否有残留下载进程（`ps -ef` + `kill -9`）、yum 源文件是否被改动、清缓存重建（`yum clean all && makecache`）。
5. 日志看 `/var/log/messages`（系统与服务运行状态）和 `/var/log/secure`（用户登录情况），实时追踪用 `tail -f`；登录历史用 `last` / `lastb`。
6. 硬件信息查看口诀：CPU 用 `lscpu`、内存用 `free -h`、磁盘用 `df -h`、负载用 `w`；对应文件分别是 `/proc/cpuinfo`、`/proc/meminfo`、`/proc/mounts`、`/proc/loadavg`。
7. 判断内存够不够看 `free` 的 `available` 列；判断 CPU 颗数看 `physical id`，核数看 `cpu cores`；物理机硬件信息用 `dmidecode`。

## 自测题

1. `rpm -ivh` 和 `yum install` 有什么区别？为什么装复杂软件推荐用 yum？
2. 服务器不能上外网，如何用安装光盘做一个本地 yum 源？
3. `rpm -qf /usr/sbin/sshd` 的作用是什么？`rpm -ql openssh-server` 呢？
4. `free -h` 显示 `free` 只有 100M，`buff/cache` 占了 7G，内存是否紧张？
5. 编译安装三步是什么？与 yum 安装相比最大的劣势是什么？

> **答案：**
> 1. `rpm -ivh` 只安装单个包，不解决依赖；`yum install` 从仓库读取依赖关系，自动安装所有依赖包并做签名校验。复杂软件依赖多，用 rpm 会连环报错，所以推荐 yum。
> 2. 挂载光盘到 `/mnt`，在 `/etc/yum.repos.d/` 下写一个 `baseurl=file:///mnt`、`gpgcheck=0`、`enabled=1` 的 repo 文件，然后 `yum clean all && yum makecache`。
> 3. `rpm -qf /usr/sbin/sshd` 反查 `sshd` 这个文件属于哪个软件包；`rpm -ql openssh-server` 列出该包安装的所有文件。
> 4. 不紧张。`free` 小是因为内存被用作文件缓存，需要时自动释放；判断标准是 `available` 列，只要 available 充足就没问题。
> 5. 三步：`./configure --prefix=...` 检查环境生成 Makefile、`make` 编译、`make install` 安装。最大劣势是没有统一注册与卸载机制，卸载只能删目录，升级要重新编译，维护成本高。

## 相关阅读

- 计算机硬件组成
- 系统安装部署
- 重要系统文件与运行级别
- 系统优化实践（上）：yum 源优化
- 附录-命令速查表
{% endraw %}
