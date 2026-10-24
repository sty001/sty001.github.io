---
title: "07-系统优化实践-下"
date: 2026-10-24 10:35:00 +0800
categories: [软件, Linux, 02-系统操作]
tags: [Linux, 02-系统操作, Linux基础]
slug: "linux-system-07"
---

{% raw %}



优化的下半场：用 `rpm` 检查软件安装情况、处理防火墙与 SELinux 两个安全服务、搞定字符集（LANG）、把 SSH 连接速度提上来，最后带一份服务器硬件与 Linux 发展史的回顾。前置的 yum 源优化完成后再来。

## 课前回顾与 rpm 软件包检查 {: .sec-ver}

上一节完成了 Vim 编辑、系统信息查看、用户管理、命令提示符优化（含彩色提示符）与 yum 源优化：

```bash
# 彩色提示符：用户信息红色、主机信息绿色、目录信息蓝色
export PS1='[\[\e[32;1m\]\u@\[\e[33;1m\]\h\[\e[34;1m\] \W\[\e[0m\]]\$ '
```

### 如何确认软件是否已经安装 {: .sec-ver}

**方法一：重新 yum 安装一遍**，已安装时会提示 `Nothing to do`。

**方法二：利用 rpm 命令检查**

```bash
# 查看软件是否安装（-q 表示查询，-a 表示所有）
[root@linux-node1 ~]# rpm -qa sl
sl-5.02-1.el7.x86_64

# 查看软件包中都安装了哪些文件（-l 表示列表显示）
[root@linux-node1 ~]# rpm -ql cowsay
/usr/bin/animalsay
/usr/bin/cowsay
/usr/bin/cowthink

# 查看某个文件属于哪个软件包
[root@linux-node1 ~]# which ssh
/usr/bin/ssh
[root@linux-node1 ~]# rpm -qf /usr/bin/ssh
openssh-clients-7.4p1-16.el7.x86_64

# 利用反引号一步到位
[root@linux-node1 ~]# rpm -qf `which ssh`
openssh-clients-7.4p1-16.el7.x86_64
```

> **注意：** 有些命令名称和软件包的名称并不相同（例如命令 `ssh` 属于 `openssh-clients` 软件包），所以"命令能执行"和"软件包名"不能直接划等号。
{: .sec-pit}

> **补充：** Windows 的安装程序一般是 `xxx.exe`，Linux（RedHat 系）的安装程序一般是 `xxx.rpm`。

> **补充：** `rpm -qa` 输出按字母排序，配合管道可以快速筛选与统计：

```bash
rpm -qa | wc -l                        # 统计安装了多少个包
rpm -qa | grep -i kernel               # 查看内核相关包
rpm -qi openssh-server                 # 查看包的版本、厂商、安装时间等详细信息
rpm -V openssh-server                  # 校验包内文件是否被改动（安全排查用）
```

## 安全相关优化：关闭防火墙服务

企业中为了排查方便，通常会先把防火墙服务关闭（真实生产环境请以安全策略为准）。

### CentOS 6

```bash
# 查看防火墙服务状态
/etc/init.d/iptables status

# 临时关闭防火墙服务
/etc/init.d/iptables stop
/etc/init.d/iptables status

# 永久关闭防火墙服务
chkconfig iptables off
```

### CentOS 7

```bash
# 查看防火墙服务状态
systemctl status firewalld

# 临时关闭防火墙服务
systemctl stop firewalld
systemctl status firewalld        # 操作完确认

# 永久关闭防火墙服务
systemctl disable firewalld
```

**查看服务状态的简便方法：**

```bash
systemctl is-active firewalld     # 检查服务是否正在运行
systemctl is-enabled firewalld    # 检查确认服务是否开机自启
```

> **注意：** 真实生产环境不建议"一关了之"，正确做法是保留防火墙并精确放行业务端口（`firewall-cmd --permanent --add-port=xxx/tcp && firewall-cmd --reload`），把默认策略设为 drop、按最小化原则开端口。本篇后续会讲 firewalld 的基本操作。
{: .sec-pit}

关防火墙之前先想清楚这台机器的暴露面：只对内网提供服务，就配合安全组、ACL 限制来源；全开等于把数据库裸奔到公网。关闭只是实验室动作，生产要按端口白名单来。

## 安全相关优化：关闭 SELinux 服务

SELinux 服务用于对 root 用户权限进行更细粒度的控制，很多企业中默认把它关闭。

> **注意：** CentOS 6 与 CentOS 7 的关闭方式一致。
{: .sec-pit}

### 临时关闭

```bash
[root@linux-node1 ~]# getenforce                 # 确认 SELinux 服务是开启还是关闭
[root@linux-node1 ~]# setenforce
usage:  setenforce [ Enforcing | Permissive | 1 | 0 ]
```

| 取值 | 含义 |
| --- | --- |
| `Enforcing` / `1` | 临时开启 SELinux |
| `Permissive` / `0` | 临时关闭 SELinux |

```bash
setenforce 0    # 临时关闭 SELinux 服务
```

### 永久关闭

配置文件中三种取值的含义：

| 取值 | 含义 |
| --- | --- |
| `enforcing` | SELinux security policy is enforced，SELinux 处于正常开启状态 |
| `permissive` | SELinux prints warnings instead of enforcing，SELinux 被临时关闭（只告警不拦截） |
| `disabled` | No SELinux policy is loaded，SELinux 服务彻底关闭 |

```bash
vi /etc/selinux/config
SELINUX=disabled
```

> **注意：** 修改 `/etc/selinux/config` 之后必须重启系统才能生效。
{: .sec-pit}

> **补充：** `setenforce 0` 设的是 permissive 模式——只记录不拦截，重启后回到配置文件设定的值。想查看"服务打不开到底是不是 SELinux 在拦"，就临时设 permissive 试试；确认为此原因后，规范做法是用 `ausearch -m avc` 看拦截日志，用 `semanage fcontext` + `restorecon` 修正文件上下文，而不是永久 disabled。

上下文的继承规则也提一句：新建文件的上下文继承自父目录，`mv` 保留原上下文、`cp` 按目标目录重新打标签——文件挪位置后行为怪异，先想到这里。

还有一层现实原因：disabled 切回 enforcing 是重活，文件系统要全量重打上下文标签（`touch /.autorelabel` 后重启），大磁盘上要等很久。随手 disabled，后面还回来的时候就要付利息。

## 字符编码优化

### 什么是字符编码 {: .sec-know}

字符编码用于实现对非英文字符的支持。计算机操作系统由美国人发明，天然支持英语，要显示中文就需要字符集的支持。

UTF-8 之所以成为通用选择：它是变长编码，英文仍是 1 字节（完全兼容 ASCII），中文 3 字节，全球任何文字都装得下；GBK 只覆盖中文，文件传到国外机器就是一屏问号。新环境无脑选 UTF-8。

| 编码 | 特点 |
| --- | --- |
| UTF-8 | 比较通用 |
| GBK | 中文场景下较常用 |

**出现乱码的原因：**

1. 系统字符集设置有问题；
2. 远程软件（如 Xshell）字符集设置有问题；
3. 文件编写时的字符集和系统查看时的字符集不统一。

### CentOS 6 中的字符集设置

```bash
# 查看默认编码信息（LANG 用于设置字符编码信息）
[root@linux-node1 ~]# echo $LANG
en_US.UTF-8

# 临时修改
LANG=XXX

# 永久修改方法一
[root@linux-node1 ~]# tail -5 /etc/profile
export LANG='en_US.UTF-8'

# 永久修改方法二
vi /etc/sysconfig/i18n
LANG='en_US.UTF-8'
source /etc/sysconfig/i18n
```

### CentOS 7 中的字符集设置

```bash
# 查看默认编码信息
[root@linux-node1 ~]# echo $LANG
en_US.UTF-8

# 临时修改
LANG=XXX

# 永久修改方法一（优先级更高）
[root@linux-node1 ~]# tail -5 /etc/profile
export LANG='en_US.UTF-8'

# 永久修改方法二
[root@linux-node1 ~]# cat /etc/locale.conf
LANG="zh_CN.UTF-8"
```

> **补充：** 一条命令既临时设置又永久设置：
>
> ```bash
> localectl set-locale LANG=zh_CN.GBK
> ```

### 原理解析：locale 变量体系 {: .sec-know}

Linux 的字符集不是由一个变量决定的，而是一整套 `LC_*` 变量：

| 变量 | 控制范围 | 优先级 |
| --- | --- | --- |
| `LC_ALL` | 一次性覆盖所有分类 | 最高 |
| `LANG` | 默认值，所有未单独设置的分类都用它 | 最低 |
| `LC_CTYPE` | 字符分类与编码 | 高于 LANG |
| `LC_NUMERIC` | 数字格式 | 高于 LANG |
| `LC_TIME` | 日期时间格式 | 高于 LANG |
| `LC_COLLATE` | 排序规则 | 高于 LANG |
| `LC_MESSAGES` | 程序界面语言 | 高于 LANG |

生效规则一句话：**`LC_ALL` > 具体 `LC_xxx` > `LANG`**，谁具体听谁的。所以临时测试某个分类的行为时用 `LC_TIME=en_US.UTF-8 date` 只影响这一条命令；要全部回到默认用 `LANG=C`（C  locale 是纯 ASCII，永不乱码，排错利器）。

常用查看命令：

```bash
locale                      # 查看当前所有 locale 设置
locale -a | grep -i zh      # 查看系统支持哪些中文 locale
locale -a | wc -l           # 统计可用 locale 数量
```

`locale -a` 里没有想要的 locale（比如 zh_CN.UTF-8）？装齐语言包再生成一个：`yum install -y glibc-common`，然后 `localedef -c -f UTF-8 -i zh_CN zh_CN.UTF-8`，之后 localectl 就能设置它了。精简镜像和容器里最常遇到这种情况。

> **注意：** 想让中文正常显示，系统 locale、SSH 客户端字符集、文件本身的编码三者必须一致。排查顺序：先 `locale` 看系统设置，再看 Xshell 会话属性里的编码（推荐 UTF-8），最后用 `file 文件名` 查看文件本身是什么编码。`localectl set-locale LANG=zh_CN.UTF-8` 会写入 `/etc/locale.conf`，一条命令同时完成内核态配置，无需重启。
{: .sec-pit}

## 时区与时间同步

服务器时间不准会引发连锁故障：证书校验失败、日志时序错乱、分布式系统选举异常。CentOS 7 默认使用 chrony 做时间同步。

### 查看与设置时区

```bash
timedatectl status                    # 查看时区、时间、NTP 同步状态
timedatectl list-timezones | grep Asia   # 列出候选时区
timedatectl set-timezone Asia/Shanghai # 设置时区为上海
date                                   # 查看当前时间
hwclock --systohc                      # 把系统时间写入硬件时钟（BIOS 时钟）
```

### chrony 时间同步服务

```bash
systemctl status chronyd               # 查看同步服务状态
chronyc sources                        # 查看正在使用的时间服务器
chronyc sources -v                     # 看每个源的同步详情
chronyc tracking                       # 查看时间偏差统计
```

`chronyc sources` 输出开头的符号有讲究：`^*` 是当前同步源、`^+` 是候选、`^?` 表示不可达——一排问号说明一个源都没连上，先查网络和防火墙。

配置文件 `/etc/chrony.conf`：

```ini
server ntp.aliyun.com iburst            # 上游时间服务器，iburst 表示快速启动时连续探测
server ntp.tencent.com iburst
driftfile /var/lib/chrony/drift        # 记录时钟漂移，重启后加速收敛
makestep 1.0 3                          # 偏差超过 1 秒且更新 3 次内时，一次性跳变纠正
rtcsync                                 # 同步系统时间到硬件时钟
```

内网机器多时不建议全部直连公网 NTP：拿一两台机器当内网时间源（chrony.conf 里 `allow 网段`），其余机器同步它——公网压力小，断外网时全场也失联不了。急着对时不用等轮询：`chronyc makestep` 手动触发一次跳变同步，虚机迁移、休眠恢复后时间跳变，这一条立刻拉回。

> **注意：** 旧的 `ntpdate`（一次性对时工具）与 `ntpd` 服务在 CentOS 7 中已分别被废弃和替换——`ntpdate` 会被 chronyd 取代，一次性对时可用 `chronyd -q`。生产服务器必须开启 NTP 同步，容器与虚拟机从宿主机继承时间，不需要各自同步。时间偏差超过 5 分钟，Kerberos 认证、HTTPS 证书会直接失效。
{: .sec-pit}

### 辨析：chronyd 与 ntpd

ntpd 是老将，逐步调整时钟、追求长期精度，但对"时间严重跑偏"的机器收敛很慢；chronyd 是新一代，偏差大时能快速跳变纠正（`makestep` 控制），间歇性断网（笔记本、虚机迁移）场景下也同步得更稳。CentOS 7 起官方默认就是 chronyd，新部署没有理由再装 ntpd。

## DNS 配置与 `/etc/resolv.conf` {: .sec-expl}

DNS 负责把域名解析成 IP。客户端的解析配置在 `/etc/resolv.conf`：

```bash
[root@linux-node1 ~]# cat /etc/resolv.conf
# Generated by NetworkManager
search example.com
nameserver 223.5.5.5
nameserver 114.114.114.114
options timeout:2 attempts:3
```

| 字段 | 含义 |
| --- | --- |
| `nameserver` | DNS 服务器地址，最多 3 个，按顺序查询，前面的不响应才问下一个 |
| `search` | 短名补全后缀列表，如访问 `db01` 会自动尝试 `db01.example.com` |
| `domain` | 本地域名 |
| `options timeout:n` | 等待单个 DNS 服务器响应的超时时间（秒） |
| `options attempts:n` | 重试轮数 |
| `options rotate` | 多个 nameserver 之间轮询，而不是固定用第一个 |

排 DNS 还有两个现代工具：`dig www.example.com` 看完整解析过程（问了哪台服务器、耗时多少），`dig @223.5.5.5 域名` 指定服务器测——比 ping 更能定位问题出在哪一层。时区的本质顺带说透：`/etc/localtime` 这个软链接指向 `/usr/share/zoneinfo/` 下的哪个文件，`timedatectl set-timezone` 做的就是换链接。

> **注意：** `/etc/resolv.conf` 常被 NetworkManager、dhclient 或云主机初始化脚本覆盖——改完重启网络丢失是正常现象。永久生效要改网卡配置文件里的 `DNS1=`（见《系统目录结构与挂载》），或用 `chattr +i /etc/resolv.conf` 防篡改。DNS 故障的经典判断法：`ping 223.5.5.5` 通但 `ping www.example.com` 不通，问题就在 DNS。
{: .sec-pit}

## 日志系统与 logrotate

### 系统日志概览 {: .sec-sum}

| 日志文件 | 内容 |
| --- | --- |
| `/var/log/messages` | 系统与服务运行的总体状态与错误信息 |
| `/var/log/secure` | 用户登录、认证、sudo 记录 |
| `/var/log/cron` | 定时任务执行记录 |
| `/var/log/boot.log` | 系统启动过程日志 |
| `/var/log/maillog` | 邮件服务日志 |
| `/var/log/dmesg` | 内核启动信息（也可用 `dmesg` 命令） |

看 messages 有个套路：`tail -200 /var/log/messages` 先看最近的，故障排查先确认"从什么时间开始"，定位到时间点再回溯，比通读全文高效得多。

CentOS 7 起部分日志由 systemd-journald 收集，用 `journalctl` 查询：

```bash
journalctl                       # 查看全部日志
journalctl -u nginx              # 只看 nginx 服务的日志
journalctl -f                    # 实时跟踪（相当于 tail -f）
journalctl --since "2026-10-24 08:00" --until "2026-10-24 10:00"
journalctl -p err                # 只看 err 及以上级别
journalctl --disk-usage          # 查看日志占用空间
```

还有一个按"开机次数"查的维度：`journalctl -b` 看本次开机以来的日志，`-b -1` 看上一次开机——服务重启后现场没了，就从上一次启动的日志里找。

一个默认行为要知道：journalctl 默认只看本次开机以来的日志（存在 /run/log/journal，内存文件系统里）。想让重启后还能翻旧账，`mkdir /var/log/journal && systemctl restart systemd-journald` 打开持久化，再在 `/etc/systemd/journald.conf` 里设 `SystemMaxUse=1G` 给它限个上限——不限的话它自己能长到几个 G。

### logrotate 日志轮转

日志无限增长会撑爆磁盘，logrotate 负责按策略切割、压缩、清理旧日志。全局配置在 `/etc/logrotate.conf`，每个服务的配置放在 `/etc/logrotate.d/` 下。

典型配置 `/etc/logrotate.d/nginx`：

```ini
/var/log/nginx/*.log {
    daily                    # 每天轮转一次
    rotate 30                # 保留 30 份旧日志
    compress                 # 轮转后压缩
    delaycompress            # 延迟一轮再压缩（防止正在写的文件被压）
    missingok                # 日志文件不存在也不报错
    notifempty               # 空文件不轮转
    create 640 nginx nginx   # 轮转后创建新文件并指定属主属组
    sharedscripts            # 多个日志文件只执行一次脚本
    postrotate
        /bin/kill -USR1 $(cat /run/nginx.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
```

常用指令速查：

| 指令 | 作用 |
| --- | --- |
| `daily` / `weekly` / `monthly` | 轮转周期 |
| `rotate N` | 保留 N 份旧日志 |
| `size 100M` | 超过 100M 才轮转（与周期二选一） |
| `compress` | 压缩旧日志 |
| `dateext` | 旧日志文件名带日期后缀 |
| `create 属主 属组` | 轮转后新建日志文件的属性 |
| `postrotate` ... `endscript` | 轮转后执行的脚本（通知服务重开文件句柄） |

`size` 与周期同时写时按先到者触发；很多发行版靠 cron.daily 每天调一次 logrotate，改完配置想立刻看效果就 `logrotate -f`，用 `-d` 先演练一遍更稳。

调试与手动执行：

```bash
logrotate -d /etc/logrotate.conf    # 演练模式，只打印会做什么，不实际执行
logrotate -f /etc/logrotate.conf    # 强制执行一轮（测试配置是否生效）
```

> **注意：** 轮转后必须让服务重新打开日志文件（`postrotate` 里的 `kill -USR1` 或 `systemctl reload 服务`），否则服务还往旧文件写，表现为"日志轮转了但新文件一直是空的"。磁盘空间莫名被日志吃掉时，先 `du -sh /var/log/*` 定位，再检查对应服务的 logrotate 配置是否缺失。
{: .sec-pit}

## `/etc/fstab` 挂载优化参数 {: .sec-expl}

`/etc/fstab` 的第四列（挂载参数）不止 `defaults` 一个选择，数据盘常用 `noatime` / `nodiratime` 做性能优化：

```ini
UUID=12345678-1234-1234-1234-123456789abc /data xfs defaults,noatime,nodiratime 0 2
```

| 参数 | 作用 | 适用场景 |
| --- | --- | --- |
| `defaults` | `rw,suid,dev,exec,auto,nouser,async` 的集合 | 常规场景 |
| `noatime` | 不更新文件访问时间（atime） | 读多写少的数据盘、日志盘、Web 静态资源盘 |
| `nodiratime` | 不更新目录访问时间 | 同上，减少目录元数据写入 |
| `noexec` | 禁止执行该分区上的可执行文件 | `/tmp`、`/home` 等不运行程序的分区 |
| `nosuid` | 忽略 setuid / setgid 位 | 数据分区，防止越权提权 |
| `nodev` | 忽略设备文件 | 数据分区 |

> **注意：** 开启 `noatime` 后，依赖"访问时间"判断的程序会受影响（如部分邮件投递程序、某些备份工具的增量判断），`mutt` 等软件也曾依赖 atime。**只对数据盘开，根分区保持默认**。细看 `mount` 输出还会发现根分区其实已经带着 `relatime`——内核的折中方案：访问时间只在它比修改时间旧、或超过 24 小时时才更新，兼容与性能兼顾，不必手动干预。效果验证：`mount | grep /data` 输出中应能看到 `noatime`。修改 fstab 后一律 `mount -a` 验证再重启。
{: .sec-pit}

## swap 使用与调整

### 查看 swap 状态

```bash
free -h                          # 看 Mem 与 Swap 两行
swapon --show                    # 列出所有 swap 设备/文件
cat /proc/swaps                  # 等价的文件方式
```

### 创建与调整 swap 文件

内存不够又不能加内存条时，可以扩 swap：

```bash
dd if=/dev/zero of=/swapfile bs=1M count=2048   # 创建 2G 的空文件
chmod 600 /swapfile                             # 权限必须为 600，否则 swapon 报警
mkswap /swapfile                                # 格式化为 swap
swapon /swapfile                                # 立即启用
```

写入 `/etc/fstab` 实现开机生效：

```ini
/swapfile none swap sw 0 0
```

顺带解释上面 `chmod 600` 那步：swap 文件里存的是内存内容，权限不收紧等于人人可读——里面可能有密码、密钥明文，600 是底线。

调整积极程度（swappiness）：`vm.swappiness` 取值 0~100，越大越倾向使用 swap：

```bash
sysctl vm.swappiness               # 查看当前值，默认 60
sysctl -w vm.swappiness=10         # 临时调整
```

| 服务器类型 | 建议值 | 理由 |
| --- | --- | --- |
| 数据库服务器 | 1~10 | 尽量用物理内存，避免查询走 swap 拖慢整体 |
| Web 应用服务器 | 10~30 | 兼顾突发流量 |
| 桌面 / 通用 | 60（默认） | 平衡响应速度 |

> **注意：** swap 是"救命"不是"提速"——一旦进程大量换入换出，磁盘 IO 打满，系统会肉眼可见地卡顿。生产服务器内存不足时的正确做法是扩容内存或优化程序，而不是堆 swap。RedHat 官方建议：内存小于 2G 时 swap 设为内存 2 倍，2~8G 时与内存相等，大于 8G 时至少 4G。关闭 swap 前先 `swapoff /swapfile`，正在使用中的 swap 需要先把内存中的数据换回来，内存不足时 swapoff 可能失败。
{: .sec-pit}

内存耗尽的最终结局是 OOM Killer：内核按 badness 评分杀掉占用最大的进程，`dmesg | grep -i "out of memory"` 能找到记录。swap 调得再大也改变不了这个结局，只是延后——扩内存才是治本。

swap 分区与 swap 文件各有取舍：分区性能略好、扩容要动磁盘；文件方案灵活，随时加减（就是上面 dd 那套做法），生产大多数场景文件方案足够。

## `/etc/security/limits.d` 现代写法

调整资源限制时，现代做法是往 `/etc/security/limits.d/` 目录扔一个 drop-in 配置文件，而不是直接改 `/etc/security/limits.conf`——系统升级时 limits.conf 可能被覆盖，drop-in 文件不会。

```bash
vi /etc/security/limits.d/90-nofile.conf
```

```ini
*               soft    nofile          65535
*               hard    nofile          65535
*               soft    nproc           65535
*               hard    nproc           65535
webuser         soft    nofile          100000
@webgroup       hard    nproc           20000
```

写法说明：

| 列 | 含义 |
| --- | --- |
| 第一列 | 用户（`*` 所有用户、`用户名`、`@组名`） |
| 第二列 | `soft`（软限制，可自行调高）或 `hard`（硬限制，天花板） |
| 第三列 | 限制项（`nofile` 文件描述符、`nproc` 进程数、`core` core 文件大小等） |
| 第四列 | 数值，`unlimited` 表示不限制 |

> **注意：** 文件名以数字开头决定加载顺序（90- 会覆盖 50- 的内容）。该机制由 PAM 的 `pam_limits.so` 在登录时加载，因此**只对 ssh、su、控制台等 PAM 会话生效，对 systemd 服务不生效**——服务要限制资源，在 unit 文件里用 `LimitNOFILE=65535`。改完后重新登录（不是新开终端子进程）才会生效，新手容易栽在这——改完随手开个新终端测，怎么测都是旧值。
{: .sec-pit}

还有一处容易漏：系统给了额度，应用还要"领"——nginx.conf 里的 `worker_rlimit_nofile` 也要对齐 nofile 的值，两边一致才真正生效。

## sysctl 内核参数优化 {: .sec-expl}

内核参数在系统运行时可以动态调整，用于优化文件描述符、网络协议栈、内存行为。查看与临时修改：

```bash
sysctl fs.file-max                 # 查看系统级文件描述符上限
sysctl net.core.somaxconn          # 查看连接队列上限
sysctl -a | grep tcp_tw            # 批量查看 tcp 相关参数
sysctl -w vm.swappiness=10         # 临时修改（重启失效）
```

永久修改写配置文件（推荐 `/etc/sysctl.d/` 下的自定义文件，避免直接改 `/etc/sysctl.conf`）：

```bash
vi /etc/sysctl.d/99-custom.conf
```

```ini
fs.file-max = 1000000                      # 系统级文件描述符上限，高并发服务必调
fs.nr_open = 1000000                       # 单进程可打开的文件描述符硬上限（需配合 limits）
net.core.somaxconn = 1024                  # 监听队列最大长度，配合 Nginx backlog 使用
net.ipv4.tcp_tw_reuse = 1                  # 复用 TIME_WAIT 连接，高并发短连接场景有效
net.ipv4.ip_local_port_range = 10000 65000 # 本机可作为客户端使用的端口范围
vm.swappiness = 10                         # 降低 swap 使用倾向
net.ipv4.tcp_keepalive_time = 600          # TCP keepalive 探测间隔（秒）
```

```bash
sysctl -p /etc/sysctl.d/99-custom.conf     # 立即加载配置
sysctl --system                             # 加载 /etc/sysctl.d 下所有配置
```

常用参数速查：

| 参数 | 作用 | 调整场景 |
| --- | --- | --- |
| `fs.file-max` | 系统级文件描述符总数上限 | 高并发服务 |
| `net.core.somaxconn` | 已完成连接队列上限 | 高并发接入 |
| `net.ipv4.tcp_tw_reuse` | 复用 TIME_WAIT socket | 大量短连接的代理 / 网关 |
| `net.ipv4.ip_local_port_range` | 客户端可用端口范围 | 反向代理、爬虫 |
| `vm.swappiness` | swap 倾向 | 数据库 / 缓存服务器 |
| `net.ipv4.tcp_max_syn_backlog` | 半连接队列上限 | 抗 SYN 攻击、高并发 |

> **注意：** 内核参数是全局生效的"大招"，改错了影响面极大——改前先记录原值（`sysctl -a > /tmp/sysctl.bak`），一次只改一个并观察。`fs.file-max` 与 `ulimit` 是两个层级：前者是整机天花板，后者是单进程限制，两个都要调，只调一个没用。参数名在不同内核版本间可能有增减，`sysctl -a` 里没有的参数说明当前内核不支持，不要硬写。
{: .sec-pit}

`sysctl --system` 的加载顺序也值得知道：/run/sysctl.d → /etc/sysctl.d → /usr/lib/sysctl.d，同名的配置后面的赢——把自定义文件放 /etc/sysctl.d 正是为了覆盖发行版默认值。

## 加快 SSH 远程连接速度

远程工具连接 Linux 时如果卡顿，通常是 SSH 服务端在做 GSSAPI 认证和 DNS 反解，按下面三个步骤处理。

**第一个步骤：修改 ssh 服务配置文件**

```bash
vi /etc/ssh/sshd_config
79   GSSAPIAuthentication no
115  UseDNS no
```

**第二个步骤：修改 hosts 文件，让本机主机名能被解析**

```bash
[root@linux-node1 ~]# vi /etc/hosts
10.0.0.200  linux-node1
```

**第三个步骤：重启 ssh 远程服务**

```bash
systemctl restart sshd
```

> **原理：** 连接慢的根源是 sshd 的两次"多余动作"：`GSSAPIAuthentication` 会向 KDC 询问票据（没有 Kerberos 环境纯属空等）；`UseDNS yes` 会用客户端 IP 反查域名（DNS 不可达时干等到超时）。两项关掉后，登录几乎是秒进。如果还慢，检查 `/etc/resolv.conf` 里是否配了不可达的 nameserver——`options timeout:2` 可以把单次等待压到 2 秒。

服务端优化完还慢，就查客户端一侧：远程工具版本过老导致算法协商耗时、本地 DNS 解析慢、代理软件劫持 22 端口。用 `ssh -v IP` 看卡在哪一步——输出停在哪一行，问题就在哪个环节，这是 SSH 排错最有效的手段。多网卡机器还能进一步收口：sshd_config 里 `ListenAddress 10.0.0.200` 只在内网网卡监听，公网网卡直接扫不到。

## 系统基础优化总结 {: .sec-sum}

| 优化项 | 内容 |
| --- | --- |
| 命令提示符优化 | 修改 `PS1` 环境变量，包括格式与颜色 |
| 下载 yum 源优化 | 基础源 + 扩展源替换为国内镜像 |
| 安全相关优化 | 防火墙优化、SELinux 优化 |
| 字符集优化 | 可以显示中文，避免出现乱码 |
| SSH 远程连接优化 | 关闭 GSSAPI 认证与 DNS 反解 |

结合本篇新增内容，一台新服务器的完整优化清单：

| 优化项 | 关键动作 |
| --- | --- |
| 安全 | 防火墙精确放行、SSH 加固（端口 / 禁 root / 密钥）、GRUB 密码 |
| 时区与时间 | `timedatectl set-timezone` + chrony 同步 |
| DNS | resolv.conf 配可达的 nameserver |
| 日志 | 确认 logrotate 覆盖所有日志目录 |
| 磁盘 | 数据盘 `noatime/nodiratime`，swap 按服务器角色调整 |
| 资源限制 | `/etc/security/limits.d/` drop-in 文件 |
| 内核参数 | `/etc/sysctl.d/99-custom.conf` 按需调整 |

## 阶段回顾：服务器硬件与系统发展 {: .sec-sum}

### 如何才算把知识掌握了

1. 不会的东西要先记下来；
2. 判断掌握的标准：作用清楚、操作熟练、知识原理可以绘图；
3. 检验的终极标准：能给不清楚的人讲明白。

### 服务器硬件组成 {: .sec-expl}

电源、CPU、内存、磁盘、风扇。

**电源**：供电，具备冗余能力（双路电源、UPS、发电机）。

**CPU**：两个作用——处理任务、控制硬件；关注路数与核数。

**内存**：存储设备，用于临时存储。

- 缓冲（写）：将数据先写入到内存；
- 缓存（读）：读取内存中的数据；
- 程序：开发人员编写的代码；
- 进程：运行起来的程序；
- 守护进程：一直运行的进程。

**磁盘（机械硬盘）**：存储设备，用于永久存储。

- 磁盘的接口类型：SAS > SCSI > SATA；
- RAID（阵列卡）的作用：① 让一块磁盘容量更大；② 数据存储更安全；③ 数据存储效率更高；常见级别 raid0、raid1。

**远程管理卡**：① 可以远程开机；② 可以远程安装系统。

RAID 级别补一张速记：raid0 两块盘合一块，快但坏一块全丢；raid1 两块盘互为镜像，坏一块照常跑，容量减半。生产常用的是 raid10（先镜像再条带，数据库首选）和 raid5（三块起步，校验占一块的容量，允许坏一块）。

### 操作系统组成与发展过程 {: .sec-prac}

操作系统由**内核、解释器、应用程序**三部分组成。以聊天软件为例：人操作软件（输入"你好"）→ 解释器 → 内核 → 计算机硬件（二进制，最终由网卡发出）。

系统发展过程：

1. 教学用的 Unix 系统被发明出来；
2. 有人希望做出类似 Unix 但更好的系统，于是建立了**自由软件基金会（FSF）**，发起 **GNU** 项目（目标是做出内核、解释器与软件程序），并制定 **GPL** 通用许可协议；
3. Linux 早期内核雏形被发明出来；

```text
GNU 项目 + Linux 内核雏形 == Linux
```

**常见系统发行版本：**

| 发行版 | 特点 |
| --- | --- |
| RedHat | 收费 |
| CentOS | 免费 |

严格说 GNU + Linux 的组合叫 GNU/Linux——内核是 Linux，bash、gcc、coreutils 这些外围工具来自 GNU。顺带认识另一半世界：Debian 系（Debian、Ubuntu）用 .deb 包和 apt 管理器，目录结构同样遵循 FHS，只是包管理命令不同——会了 yum，apt 半小时上手。

> **现代环境补充：** CentOS 已于 2024 年 6 月对 7.x 停止维护，CentOS Linux 项目转型为 CentOS Stream。当前企业级替代方案：Rocky Linux（CentOS 创始人新立，二进制兼容 RHEL）、AlmaLinux（CloudLinux 支持，二进制兼容 RHEL）、Oracle Linux。选型上，追求长期稳定的生产环境用 Rocky / AlmaLinux 的 LTS 版本。

## 常见错误与排错 {: .sec-ts}

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| 中文显示为方块或问号 | 系统 / 客户端 / 文件三者编码不一致 | `locale`、`file 文件名` | 统一为 UTF-8：`localectl set-locale LANG=zh_CN.UTF-8` |
| 时间比真实时间慢几分钟 | 没开 NTP 同步 | `timedatectl status`、`chronyc sources` | 启动 chronyd，`timedatectl set-ntp true` |
| 证书报无效 / Kerberos 认证失败 | 服务器时间偏差过大 | `date` 对比标准时间 | 同步 NTP，`hwclock --systohc` |
| 域名能解析但时快时慢 | resolv.conf 里有不可达的 DNS | `cat /etc/resolv.conf` | 删掉失效 nameserver，加 `options timeout:2` |
| 日志把磁盘写满了 | 轮转配置缺失或服务未重开文件 | `du -sh /var/log/*` | 补 logrotate 配置，`postrotate` 里 reload 服务 |
| 日志轮转了但新文件为空 | 服务仍持有旧文件句柄 | `lsof 服务名` | `systemctl reload 服务` 或补 `kill -USR1` |
| 高并发报 `too many open files` | `fs.file-max` 或 limits 太小 | `ulimit -n`、`sysctl fs.file-max` | 调 `limits.d` drop-in 与 sysctl 参数 |
| `sysctl -w` 改的参数重启失效 | 只做了临时修改 | `sysctl 参数名` 验证 | 写入 `/etc/sysctl.d/` 并 `sysctl --system` |
| 数据盘 IO 很高但业务很闲 | atime 频繁更新 | `mount | grep atime` | fstab 加 `noatime,nodiratime` 后 `mount -a` |
| 数据库服务器卡顿 | swap 使用频繁 | `free -h`、`vmstat 1` | `vm.swappiness=10`，必要时扩内存 |

改完 swappiness 验证一下：`cat /proc/sys/vm/swappiness` 直接读内核当前值，与 `sysctl vm.swappiness` 等价——数值没变说明加载没成功，回头查配置文件路径。数据库导出文件乱码同理要先查源头：导出时客户端的字符集错了，导入端怎么改都没用。

## 现代环境补充 {: .sec-ext}

| 旧做法 | 现代做法 | 说明 |
| --- | --- | --- |
| `ntpdate` 对时 | `chronyd` + `chronyc` | CentOS 7 起 chrony 是默认实现 |
| `vi /etc/sysconfig/i18n` 设字符集 | `/etc/locale.conf` + `localectl` | CentOS 7 统一了 locale 配置文件 |
| `vi /etc/security/limits.conf` | `/etc/security/limits.d/*.conf` | drop-in 方式，升级不丢配置 |
| `vi /etc/sysctl.conf` | `/etc/sysctl.d/*.conf` | 同上，避免与系统配置冲突 |
| `tail -f /var/log/messages` 看一切 | `journalctl -f` | systemd 日志，可按服务、时间、级别过滤 |
| `iptables` 直接配规则 | `firewall-cmd` / `nftables` | firewalld 是官方前端 |
| CentOS Linux 7 | Rocky / AlmaLinux / CentOS Stream | CentOS 7 已于 2024-06 EOL |
| `netstat` / `ifconfig` | `ss` / `ip` | net-tools 已停止维护 |

> **注意：** Rocky Linux、AlmaLinux 上本篇所有命令（`timedatectl`、`chronyc`、`journalctl`、`sysctl`、`logrotate`）行为完全一致；firewalld 仍是默认防火墙。区别主要在内核版本（新内核 sysctl 参数名可能有增减）与默认服务集。
{: .sec-pit}

## 课后练习 {: .sec-prac}

**基础练习**

1. 一个软件安装好了，如何利用 `rpm` 命令进行卸载；
2. 总结第一阶段（服务器硬件与系统概念）的课程知识；
3. 对一天的课程内容进行复述。

**扩展练习**

1. 如何批量创建多个用户（例如一次创建 50 个用户）。

## 小结 {: .sec-sum}

1. `rpm -qa` 查是否安装、`rpm -ql` 查包内文件、`rpm -qf` 查文件属于哪个包，配合反引号可以一步定位。
2. CentOS 7 用 `systemctl stop/disable` 关闭防火墙，`is-active` / `is-enabled` 可以快速确认服务状态；生产环境应精确放行而不是一关了之。
3. SELinux 用 `setenforce 0` 临时关闭（permissive，只告警），改 `/etc/selinux/config` 为 `SELINUX=disabled` 永久关闭，且必须重启系统才生效。
4. 字符集由 `LANG` 控制，乱码要从"系统字符集、远程工具字符集、文件编写字符集"三处排查；`localectl set-locale` 可一条命令同时完成临时与永久设置。
5. SSH 连接慢的解决思路：关闭 `GSSAPIAuthentication` 与 `UseDNS`、在 `/etc/hosts` 中补上主机名解析、重启 `sshd`。
6. 系统基础优化五件事：命令提示符、yum 源、安全服务（防火墙 + SELinux）、字符集、SSH 远程连接；再往上一层还要做时区与 chrony 同步、DNS 优化、日志轮转、fstab 挂载参数、swap 策略、limits.d 资源限制、sysctl 内核参数。
7. 时间不同步会引发证书与认证故障；日志不轮转会写满磁盘；文件描述符不调高并发服务就起不来——这三项是生产事故的高发区。

## 自测题 {: .sec-prac}

1. `LC_ALL` 和 `LANG` 同时设置时，哪个优先生效？临时把某条命令的输出切成英文界面，用什么写法？
2. CentOS 7 中用什么命令设置时区？用什么命令查看 chrony 的同步源？
3. 日志轮转后新文件一直是空的，可能是什么原因？怎么修？
4. `/etc/security/limits.conf` 与 `/etc/security/limits.d/90-nofile.conf` 有什么区别？为什么推荐后者？
5. 想让数据盘减少 atime 写入，同时降低 swap 倾向，分别改哪里？

> **答案：**
> 1. `LC_ALL` 优先级最高，`LANG` 最低，完整优先级是 `LC_ALL` > 具体 `LC_xxx` > `LANG`。临时切换用前缀写法：`LC_MESSAGES=en_US.UTF-8 命令`，只影响这一条命令。
> 2. `timedatectl set-timezone Asia/Shanghai` 设时区；`chronyc sources` 或 `chronyc sources -v` 查看同步源。
> 3. 服务轮转后还持有旧文件的句柄，新文件没人写。修复：在 logrotate 配置的 `postrotate`/`endscript` 里通知服务重开日志（如 Nginx 用 `kill -USR1`，或用 `systemctl reload 服务名`）。
> 4. 两者格式相同，区别在于：limits.conf 是系统主文件，升级时可能被覆盖；limits.d 目录下的 drop-in 文件是补充配置，按文件名顺序加载、升级不丢。推荐把自定义限制放 limits.d，便于管理也不破坏系统文件。
> 5. 数据盘 atime：改 `/etc/fstab` 中该分区的挂载参数，加 `noatime,nodiratime`，然后 `mount -a` 验证；swap 倾向：`vm.swappiness` 写入 `/etc/sysctl.d/99-custom.conf`（如数据库设 10），执行 `sysctl --system` 加载。

## 相关阅读

- 系统优化实践（上）：Vim 入门与 yum 源
- 磁盘管理基础
- 运维网络基础（下）
- 远程管理服务 SSH
- 附录-命令速查表


{% endraw %}
