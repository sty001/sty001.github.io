---
title: "03-配置文件手册"
date: 2026-10-24 10:46:00 +0800
categories: [软件, Linux, 00-知识手册]
tags: [Linux, 00-知识手册, 知识手册]
slug: "linux-manual-03"
---

{% raw %}



## 手册使用说明 {: .sec-expl}

本手册是整套笔记的配置文件案头速查：概念手册讲「为什么」，命令手册讲「敲什么」，排错手册讲「改坏了怎么办」，本手册只回答「改哪个文件、怎么改、改完怎么生效」。

每个章节按固定结构组织：**简介段**（这组文件管什么、相互关系）→ **核心参数速查表**（改动频率最高的项）→ **最小可用模板**（可直接复制改造）→ **易错点**（实战中真实踩过的坑）。

阅读约定：

1. **环境基准**：以 CentOS 7 系列为基准，涉及其他版本差异单独标注。
2. **占位符约定**：主机名统一 `linux-node01`，域名统一 `example.com`，属主统一 `user` 或服务运行账号，内网 IP 使用 `10.0.0.0/24`、`172.16.1.0/24` 网段，所有口令一律写成 `<your-password>`，请按实际环境替换，切勿把真实口令写进任何文件或文档。
3. **改动铁律**：改任何配置前先 `cp file file.bak` 备份；一次只改一处；改完用该服务自带的语法检查命令验证后再重载（如 `nginx -t`、`sshd -t`、`php-fpm -t`、`visudo -c`、`mount -a`）。
4. **生效方式**：每章模板后注明该配置的生效命令，重载优于重启，能不重启就不重启。

## 总目录

| 章节 | 覆盖配置文件 | 典型场景 |
| --- | --- | --- |
| 一、系统基础 | hostname / hosts / resolv.conf / ifcfg / fstab / profile / motd / skel | 装机初始化、环境变量、开机挂载 |
| 二、用户与权限 | passwd / shadow / group / sudoers | 账号管理、sudo 授权 |
| 三、定时任务 | spool/cron / crontab / cron.deny / cron.d | 计划任务下发 |
| 四、rsync | rsyncd.conf | 备份服务守护进程 |
| 五、NFS | exports | 网络共享存储 |
| 六、SSH | sshd_config | 远程登录加固 |
| 七、Ansible | ansible.cfg / inventory | 批量管理主机清单 |
| 八、Nginx | nginx.conf | Web 服务与负载均衡 |
| 九、PHP-FPM | www.conf | 动态进程池调优 |
| 十、MySQL | my.cnf | 数据库基础参数 |
| 十一、keepalived | keepalived.conf | 高可用与 VIP 漂移 |
| 十二、Zabbix | zabbix_agentd.conf | 监控客户端与自定义监控项 |

---

## 一、系统基础配置文件 {: .sec-expl}

这一组文件决定「一台机器是谁、怎么上网、开机挂什么、登录看到什么」，装机脚本改的也就是它们。麻烦在于多数文件没有语法检查命令，写错不会当场报错，重启才炸。

### 1.1 核心参数速查表 {: .sec-chk}

| 文件 | 作用 | 关键内容 |
| --- | --- | --- |
| `/etc/hostname` | 永久主机名 | 一行纯文本主机名；推荐用 `hostnamectl set-hostname` 修改 |
| `/etc/hosts` | 本地域名解析 | `IP 域名 别名`，优先级高于 DNS |
| `/etc/resolv.conf` | DNS 服务器 | `nameserver IP` 与 `options timeout:2 attempts:2` |
| `/etc/sysconfig/network-scripts/ifcfg-eth0` | 网卡永久配置 | `BOOTPROTO` `ONBOOT` `IPADDR` `PREFIX` `GATEWAY` `DNS1` |
| `/etc/fstab` | 开机自动挂载 | 六列：设备 挂载点 文件系统 选项 dump fsck |
| `/etc/profile` | 全局环境变量（登录 shell） | 系统级 PATH、变量；个人放 `~/.bash_profile` |
| `/etc/bashrc` | 全局别名与函数 | 别名也可放 `~/.bashrc`；`/etc/profile.d/*.sh` 是推荐的扩展点 |
| `/etc/motd` | 登录成功后的欢迎信息 | 纯文本，常用于提示与告警 |
| `/etc/skel` | 新用户家目录模板 | `.bashrc`、`.bash_profile`、`.bash_logout` |

### 1.2 最小可用模板

```text
# /etc/hosts
127.0.0.1   localhost localhost.localdomain
10.0.0.7    linux-node01
172.16.1.31 backup.example.com
```

```text
# /etc/resolv.conf
nameserver 223.5.5.5
nameserver 114.114.114.114
options timeout:2 attempts:2 rotate
```

```ini
# /etc/sysconfig/network-scripts/ifcfg-eth0
TYPE=Ethernet
BOOTPROTO=none
NAME=eth0
DEVICE=eth0
ONBOOT=yes
IPADDR=10.0.0.7
PREFIX=24
GATEWAY=10.0.0.1
DNS1=223.5.5.5
DNS2=114.114.114.114
```

```conf
# /etc/fstab：设备列用 UUID，数据盘加 nofail，NFS 加 _netdev
UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  /data    xfs    defaults,nofail   0 0
172.16.1.31:/data/www                      /mnt/www nfs    defaults,_netdev  0 0
tmpfs                                      /dev/shm tmpfs  defaults          0 0
```

```bash
# 别名的规范位置：/etc/profile.d/alias.sh（全局）或 ~/.bashrc（个人）
cat >> /etc/profile.d/alias.sh <<'EOF'
alias grep='grep --color=auto'
alias ll='ls -l --color=auto'
export PS1='[\u@\h \W]\$ '
EOF
source /etc/profile.d/alias.sh
```

### 1.3 易错点

- `ifcfg` 文件改完只重启服务才生效，改错 `ONBOOT=no` 会导致重启后网卡不激活，远程机器失联前务必确认。
- `fstab` 写错是「开机进 emergency mode」的头号原因：设备列用 UUID 而非 `/dev/sdb1`，改完必须 `mount -a` 验证无输出再重启。盘序会变，设备名不靠谱；UUID 跟着盘走。生产上栽过的坑：照抄系统盘写法，把数据盘的第 5、6 列留成 `1 1`，开机 fsck 数据盘直接把启动拖死，数据盘这两列一般写 `0 0`。
- `fstab` 第六列填 0 不代表安全：nofail 才是兜底，任何非系统盘都加上，坏盘不再阻断开机。
- `resolv.conf` 常被 NetworkManager 覆盖，DNS 应通过 `nmcli con mod eth0 ipv4.dns ...` 下发，临时锁定用 `chattr +i`（事后记得解锁）。模板里的 `rotate` 让解析请求轮流发给多个 nameserver，摊薄单点压力、避开单台超时。
- `/etc/hosts` 优先级高于 DNS 不是绝对的，实际顺序由 `/etc/nsswitch.conf` 的 `hosts:` 行决定；排解析问题时两处都看。
- 环境变量放错文件：`/etc/profile` 只对登录 shell 生效，非登录 shell（如 cron、su 不带 `-`）读的是 `/etc/bashrc`， cron 任务里找不到命令多半源于此。
- 新用户家目录配置丢失（提示符变 `-bash-4.2$`）时，从 `/etc/skel` 拷回三个隐藏文件并 `chown` 回属主。
- `/etc/hostname` 直接编辑不如 `hostnamectl set-hostname`，后者同时更新三种主机名并即时生效。只改文件的话，运行中的内核主机名不变，`hostname` 与文件内容不一致，Ansible、Zabbix 注册时各种对不上号。
- `/etc/motd` 常被忽略的用法：写上环境标识（生产/测试）和负责人联系方式，登错机器的人第一眼就能看到。别放敏感信息，所有登录者可见。

---

## 二、用户与权限相关文件

用户数据分散在三个数据库文件中，由 `useradd`、`passwd` 等命令统一维护；`sudoers` 是唯一需要手工编辑的，且必须走 `visudo`。

### 2.1 核心参数速查表 {: .sec-chk}

| 文件 | 作用 | 字段说明 |
| --- | --- | --- |
| `/etc/passwd` | 用户基本信息，所有人可读 | 七列：用户名:口令占位x:uid:gid:注释:家目录:shell |
| `/etc/shadow` | 口令与 aging 策略，仅 root 可读 | 九列，含加密口令、最后修改日、最短/最长有效期、警告天数 |
| `/etc/group` | 组信息 | 四列：组名:口令占位x:gid:成员列表 |
| `/etc/sudoers` | sudo 授权规则 | 四段式：`谁 主机=(以谁身份) 命令`，可用 `NOPASSWD:` 免密 |

### 2.2 最小可用模板

```text
# /etc/passwd 每行一个用户（示例，勿手工编辑）
root:x:0:0:root:/root:/bin/bash
www:x:1002:1002:web service:/home/www:/sbin/nologin
ops:x:1000:1000:operator:/home/ops:/bin/bash
```

```text
# /etc/shadow 口令字段为加密哈希，! 或 * 表示未设口令或被锁定
root:$6$xxxxxxxx$:19800:0:99999:7:::
www:!:19800:0:99999:7:::
```

```bash
# /etc/sudoers 必须用 visudo 编辑（自带语法检查，改坏会拒绝保存）
visudo

# 推荐写法：独立授权文件放 /etc/sudoers.d/ 下
visudo -f /etc/sudoers.d/ops
```

```text
# /etc/sudoers.d/ops 内容
ops     ALL=(ALL)       NOPASSWD: ALL
%dev    ALL=(ALL)       /usr/bin/systemctl restart nginx, /usr/bin/systemctl reload nginx
```

```bash
# 保存后检查语法与权限，drop-in 文件必须是 0440
visudo -c
chmod 0440 /etc/sudoers.d/ops
```

### 2.3 易错点

- **永远不要直接 vim `/etc/sudoers`**：语法错误会让所有人无法提权，`visudo` 会在保存时拦截。
- `/etc/sudoers.d/` 下文件权限不是 0440 时规则不生效，这是「写了规则却不生效」的常见原因。sudo 对这套文件权限极其敏感，规则文件任何人可写就拒绝加载，0440 是主动防护而非玄学。
- 追加附属组必须 `usermod -aG 组 用户`，漏掉 `-a` 会覆盖原有附属组。
- 服务账号一律 `-s /sbin/nologin`，不留可登录 shell；`/sbin/nologin` 的用户无法 `su` 登录是正常现象。
- 手工编辑 `/etc/passwd` 或 `/etc/shadow` 可能造成 uid 冲突、字段错位，全部通过 `useradd`/`usermod`/`passwd` 操作。
- 排查「文件属主显示为纯数字」时，先 `id 数字` 确认该 uid 是否还有对应用户。

---

## 三、定时任务相关文件

用户级任务存放在 `/var/spool/cron/用户名`（用 `crontab -e` 管理，勿直接编辑），系统级任务在 `/etc/crontab` 与 `/etc/cron.d/`（多一个用户列）。访问控制由 `cron.allow` 与 `cron.deny` 决定。

### 3.1 核心参数速查表 {: .sec-chk}

| 文件 | 作用 | 格式差异 |
| --- | --- | --- |
| `/var/spool/cron/root` | root 的用户级任务 | 五段时间列 + 命令，无用户列 |
| `/etc/crontab` | 系统级任务 | 六列：在时间后多一个 `user` 列 |
| `/etc/cron.d/` | 系统级任务扩展目录 | 与 `/etc/crontab` 格式一致，一个应用一个文件 |
| `/etc/cron.deny` | 拒绝使用 cron 的用户名单 | 一行一个用户名；文件不存在则仅 root 可用 |
| `/etc/cron.{hourly,daily,weekly,monthly}` | 按周期执行目录 | 放可执行脚本即可，由 crond 按目录调度 |

### 3.2 最小可用模板

```bash
# 用户级任务：crontab -e 编辑，crontab -l 查看
# 顶部关闭邮件输出，防止 /var/spool/mail 膨胀与 inode 耗尽
MAILTO=""
# 分 时 日 月 周 命令
*/5 * * * * /usr/sbin/ntpdate ntp.example.com >/dev/null 2>&1
0 2 * * * /bin/sh /server/scripts/backup.sh &>/dev/null
0 3 * * 0 /bin/sh /server/scripts/clean_log.sh &>/dev/null
```

```text
# /etc/crontab：注意第六列是执行身份
SHELL=/bin/bash
PATH=/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=""

0 1 * * * root /usr/bin/rsync -az /data/ backup@172.16.1.31::backup
*/10 * * * * ops  /bin/sh /home/ops/check.sh
```

```text
# /etc/cron.d/app-sync：独立文件便于随应用发布与回滚
0 4 * * * user /usr/local/bin/app_sync.sh >/dev/null 2>&1
```

### 3.3 易错点

- 命令中的 `%` 在 crontab 里有特殊含义，必须转义为 `\%`，或把整条命令写进脚本再调度（推荐后者）。
- cron 的 `PATH` 极简，脚本里务必用命令的绝对路径（`/usr/sbin/ntpdate` 而非 `ntpdate`），或文件头声明 `PATH=`。
- 环境变量（如 `MYSQL_PWD`）不会从登录环境继承，需要任务自己 `source` 配置。
- 每条任务结尾加 `&>/dev/null 2>&1` 或顶部设 `MAILTO=""`，否则每次输出都进邮件队列，堆积后耗尽 inode。
- 新任务先在终端手动跑通再入库；修改后用 `crontab -l` 核对，勿直接编辑 spool 文件。spool 文件权限必须是 600；直接 vim 改完 crond 不一定重新加载，`crontab -e` 会触发重载，这就是不能绕开它的原因。
- 只想允许少数人用 cron 时，创建 `/etc/cron.allow`，其存在时 `cron.deny` 即失效。两个文件是互斥逻辑：allow 在则只看 allow，allow 不在才看 deny，都空白名单逻辑容易记反，改前先 `man cron` 确认当前发行版行为。
- 分布式环境里各机器时钟不一致，cron 会漏跑或重跑，所以时间同步任务（ntpdate / chronyd）本身必须是第一优先级的基础任务。

---

## 四、rsync 服务端：/etc/rsyncd.conf

rsync 有两种工作方式：走 SSH 的远程 shell 模式（不需要配置文件）与独立守护进程模式（需要 `/etc/rsyncd.conf`，端口 873）。备份体系通常用后者，因为支持模块化、虚拟用户与访问控制。

### 4.1 核心参数速查表 {: .sec-chk}

| 参数 | 作用 | 推荐值 |
| --- | --- | --- |
| `port` | 监听端口 | `873`（默认） |
| `uid` / `gid` | 守护进程读写文件的身份 | 专用账号，如 `rsync` |
| `use chroot` | 是否 chroot 锁定根目录 | `no`（容器或特殊路径下更灵活） |
| `fake super` | 以普通 uid 运行时保留 root 文件属性 | 非 root 运行时 `yes` |
| `max connections` | 最大并发连接数 | 按带宽定，如 `200` |
| `timeout` | 连接超时秒数 | `300` |
| `read only` | 模块是否只读 | 备份客户端要推送，必须 `false` |
| `list` | 是否允许列出模块名 | `false`，不暴露模块清单 |
| `hosts allow` / `hosts deny` | 来源 IP 白名单/黑名单 | 允许业务网段，拒绝其余 |
| `auth users` | 模块认证的虚拟用户 | `rsync_backup` 等，与系统用户无关 |
| `secrets file` | 虚拟用户口令文件 | 格式 `用户:<your-password>`，权限 600 |
| `path` | 模块对应的后端目录 | 属主改为 uid 指定账号 |

### 4.2 最小可用模板

```conf
# /etc/rsyncd.conf
uid = rsync
gid = rsync
use chroot = no
fake super = yes
max connections = 200
timeout = 300
pid file = /var/run/rsyncd.pid
lock file = /var/run/rsync.lock
log file = /var/log/rsyncd.log
ignore errors = yes
read only = false
list = false
hosts allow = 10.0.0.0/24, 172.16.1.0/24
hosts deny = 0.0.0.0/0
auth users = rsync_backup
secrets file = /etc/rsync.password

[backup]
path = /backup
comment = central backup module
```

```bash
# 配套动作：虚拟用户口令文件与目录属主
echo "rsync_backup:<your-password>" > /etc/rsync.password
chmod 600 /etc/rsync.password
mkdir -p /backup && chown -R rsync.rsync /backup
systemctl enable --now rsyncd
```

```bash
# 客户端推送（免交互：--password-file 指向仅含口令的文件）
echo "<your-password>" > /etc/rsync.client.password
chmod 600 /etc/rsync.client.password
rsync -avz /data/ rsync_backup@172.16.1.31::backup --password-file=/etc/rsync.client.password
```

### 4.3 易错点

- 口令文件有两个且内容不同：服务端 `用户:口令`，客户端仅口令；权限都必须 600，否则报 `password file must not be other-accessible`。这是 rsync 的主动检查，others 可读直接拒用，改权限就行，别绕。
- `read only = false` 忘记改，客户端推送报 `permission denied`；这是模板默认值最常见的坑。默认只读是安全姿态——备份服务端原则上只收数据，模块一旦开放写就要靠 `hosts allow` 和口令把门。
- `path` 目录属主必须是 `uid` 指定的账号，属主不对时写入报错；用 `chown rsync.rsync /backup` 修正。
- `hosts allow` 写错网段会静默拒绝连接，客户端表现为超时或 `auth failed`，先 `telnet 服务端 873` 测端口。
- 修改配置后 `systemctl restart rsyncd` 生效；排错先看 `log file` 指定的日志。
- Linux 间同步一般不需要 `fake super`，仅当 `uid` 非 root 又想完整保留属主属性时开启。

---

## 五、NFS 服务端：/etc/exports

NFS 通过 `/etc/exports` 把目录共享给指定网段，客户端挂载后当作本地目录使用。核心是理解 `squash` 系列：把客户端身份压缩成什么用户，直接决定读写权限。

### 5.1 核心参数速查表 {: .sec-chk}

| 参数 | 作用 | 推荐值 |
| --- | --- | --- |
| `rw` / `ro` | 共享目录可读可写 / 只读 | 数据共享 `rw`，发布目录 `ro` |
| `sync` | 数据落盘后再响应 | `sync`，牺牲少量性能换安全 |
| `all_squash` | 把所有客户端用户压成匿名用户 | 配合 anonuid/anongid 使用，权限最可控 |
| `root_squash` | 仅压缩 root 为匿名用户 | 默认行为，普通用户身份原样透传 |
| `anonuid` / `anongid` | 匿名用户映射的 uid/gid | 专用虚拟账号，如 `1002` |
| `insecure` | 允许客户端使用大于 1024 的端口 | 部分客户端（macOS、Windows）需要 |

### 5.2 最小可用模板

```text
# /etc/exports
/data/www 10.0.0.0/24(rw,sync,all_squash,anonuid=1002,anongid=1002)
/data/blog 172.16.1.0/24(rw,sync,all_squash,anonuid=1002,anongid=1002)
/data/pub *(ro,sync)
```

```bash
# 服务端配套动作
groupadd -g 1002 www && useradd -u 1002 -g www -M -s /sbin/nologin www
mkdir -p /data/www && chown -R www.www /data/www
systemctl enable --now rpcbind nfs-server
exportfs -rv        # 改配置后平滑生效，无需重启
showmount -e localhost
```

```bash
# 客户端挂载（fstab 持久化时加 _netdev）
yum install -y nfs-utils
mount -t nfs 172.16.1.31:/data/www /mnt/www
echo "172.16.1.31:/data/www /mnt/www nfs defaults,_netdev 0 0" >> /etc/fstab
mount -a
```

### 5.3 易错点

- 括号必须紧跟网段，`10.0.0.0/24 (rw)` 中间的空格会让 `rw` 变成第二台主机的参数，导致共享意外变成只读。
- 客户端写入报 `Permission denied` 时按三层查：exports 是否 `rw` → 共享目录属主是否 anonuid 账号 → 客户端挂载点权限；多数是目录属主没改。
- 服务端依赖 `rpcbind`，启动顺序为先 rpcbind 后 nfs-server，且两台机器都要装 `nfs-utils`。
- 客户端 uid 与 anonuid 不一致时，文件属主会显示成数字；统一用虚拟账号映射（`all_squash` + `anonuid`）最省心。
- `all_squash` 是最可控的选择，原因很简单：客户端用户身份五花八门，压成统一虚拟账号后，服务端只需要管好一个属主；`root_squash` 只压 root，普通用户身份原样透传，uid 对不上就出乱子。
- 改 exports 用 `exportfs -rv` 平滑生效；直接重启服务可能造成客户端 `Stale file handle`，NFS 句柄跟着导出目录走，目录一重建就全失效。

---

## 六、SSH 服务端：/etc/ssh/sshd_config

sshd_config 是远程管理的第一道闸门。加固三板斧：改端口、禁 root 直登、仅密钥登录；性能优化两件套：关 DNS 反解、关 GSSAPI。改完必须 `sshd -t` 验证再重载，且保留当前会话不断开。

### 6.1 核心参数速查表 {: .sec-chk}

| 参数 | 作用 | 推荐值 |
| --- | --- | --- |
| `Port` | 监听端口 | 改为高位如 `52113`，需同步放行防火墙 |
| `ListenAddress` | 监听地址 | 多网卡时绑定内网地址 |
| `PermitRootLogin` | 是否允许 root 直接登录 | `no`（用普通账号 + sudo 提权） |
| `PasswordAuthentication` | 是否允许口令登录 | 密钥就绪后改 `no` |
| `PubkeyAuthentication` | 是否允许密钥登录 | `yes` |
| `UseDNS` | 对客户端 IP 做反向解析 | `no`，否则登录卡十几秒 |
| `GSSAPIAuthentication` | Kerberos 认证 | `no`，内网环境关闭提速 |
| `MaxAuthTries` | 单连接最大认证尝试 | `3` |
| `AllowUsers` | 登录白名单 | 按需配置 |

### 6.2 最小可用模板

```conf
# /etc/ssh/sshd_config 有效行
Port 52113
ListenAddress 0.0.0.0
Protocol 2

PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

UseDNS no
GSSAPIAuthentication no
MaxAuthTries 3
LoginGraceTime 30

AllowUsers user
```

```bash
# 加固上线流程：先发密钥，再收紧配置，全程不断开当前会话
ssh-keygen -t rsa -b 4096 -N '' -f ~/.ssh/id_rsa
ssh-copy-id -i ~/.ssh/id_rsa.pub -p 22 user@10.0.0.7
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
vim /etc/ssh/sshd_config
sshd -t && systemctl reload sshd
# 新开终端验证新端口能登录后，旧会话才算可以退出
ssh -p 52113 user@10.0.0.7
```

### 6.3 易错点

- 改端口或禁口令登录前，**必须先完成密钥分发并另开终端验证**，否则直接失联；当前已建立的会话不会因 reload 断开，是最后的后悔药。这里有个坑：改 `Port` 的正确顺序是先在防火墙与安全组放行新端口、reload 后另开终端连新端口验证成功，再去关旧端口，顺序反了就是失联现场。
- `UseDNS no` 的原因：sshd 会对客户端 IP 做反向解析，内网没有 PTR 记录时每次登录都等 DNS 超时，说白了就是白等十几秒。
- `PasswordAuthentication no` 但公钥没配好时，报 `Permission denied (publickey)`；用 `ssh -vvv` 看卡在哪一步。
- 系统默认还有 `ssh_config`（客户端配置），别改错文件；服务端是 `sshd_config`。
- `PermitRootLogin no` 后 root 仍可 `su`/`sudo` 提权，只是不能直接 SSH，符合最小暴露面原则。
- 防火墙与安全组要同步放行新端口，`ss` 看到监听不代表外部可达。监听地址、防火墙、安全组是三层独立的门，`nc -zv` 从外部探一遍才算数。
- 改完用 `sshd -t` 检查语法，`reload` 生效；`restart` 会断开所有会话。

---

## 七、Ansible 配置与主机清单 {: .sec-chk}

Ansible 的全局配置在 `/etc/ansible/ansible.cfg`，主机清单默认在 `/etc/ansible/hosts`。清单有五种常用写法，覆盖从单机变量到分组嵌套的场景。

### 7.1 核心参数速查表 {: .sec-chk}

| 配置项 | 作用 | 推荐值 |
| --- | --- | --- |
| `inventory` | 主机清单路径 | `/etc/ansible/hosts` |
| `host_key_checking` | 首次连接是否确认指纹 | `False`，批量管理必关 |
| `roles_path` | 角色搜索路径 | `/etc/ansible/roles` |
| `remote_user` | 默认连接用户 | 专用运维账号 |
| `forks` | 并发进程数 | `10` 或 CPU 核数倍数 |
| `log_path` | 执行日志 | `/var/log/ansible.log` |
| `library` | 自定义模块目录 | 按需 |

### 7.2 最小可用模板

```ini
# /etc/ansible/ansible.cfg [defaults] 段
[defaults]
inventory      = /etc/ansible/hosts
host_key_checking = False
roles_path     = /etc/ansible/roles
remote_user    = user
forks          = 10
log_path       = /var/log/ansible.log
```

```text
# /etc/ansible/hosts：inventory 五种写法

# 写法一：单行主机 + 连接变量
web01 ansible_host=10.0.0.7 ansible_port=52113 ansible_user=user

# 写法二：普通分组
[web]
10.0.0.7
10.0.0.8

# 写法三：主机名连续范围展开
[web2]
web0[1:5].example.com

# 写法四：分组嵌套（子组集合）
[webserver:children]
web
web2

# 写法五：组变量（对整组生效）
[web:vars]
ansible_user=user
ansible_port=52113
http_port=80
```

```bash
# 前置：控制机与被控端免密，再验证清单
ssh-copy-id -i ~/.ssh/id_rsa.pub -p 52113 user@10.0.0.7
ansible all -m ping
ansible web --list-hosts
```

### 7.3 易错点

- 忘记 `ssh-copy-id` 免密或密钥口令交互，`ping` 模块报 `Failed to connect`；批量分发公钥是 Ansible 使用的前置条件。
- `host_key_checking` 不关时，首次连接卡在 yes/no 确认，脚本里表现为假死。
- 清单写主机名时该名字必须在 `/etc/hosts` 或 DNS 中可解析，否则报 `Could not resolve`。
- 主机同时在多个组出现是正常的（嵌套组依赖这一点），不要重复维护两套 IP。
- 变量优先级：命令行 `-e` 最高，其次是 playbook 变量，组变量与主机变量较低；排查变量覆盖问题时从高向低找。
- 验证清单永远先 `--list-hosts` 再执行，防止 `all` 打到不该动的机器。
- `forks = 10` 的含义是同时并发 10 台，几百台规模时调到 20-50 能明显缩短执行时间；代价是控制机 CPU 与网络占用变高，量力调整。
- `host_key_checking = False` 关掉的是首次连接的指纹确认，省了交互但也放弃了中间人检测，批量内网机器可接受，跨公网管理别开。

---

## 八、Nginx：/etc/nginx/nginx.conf

nginx.conf 由 main、events、http 三层骨架与若干 `server` 虚拟主机组成。生产习惯是主配置保持精简，`include` 引入 `conf.d/*.conf`，一个业务一个文件。核心记忆：`server` 定虚拟主机，`location` 定路由，`upstream` 定后端池。

### 8.1 核心参数速查表 {: .sec-chk}

| 参数 | 位置 | 作用 |
| --- | --- | --- |
| `worker_processes auto` | main | worker 数随 CPU 核数 |
| `worker_connections` | events | 单 worker 最大连接数 |
| `include conf.d/*.conf` | http | 虚拟主机拆分入口 |
| `server_name` | server | 域名匹配，多个 server 靠它分流 |
| `root` / `index` | server/location | 站点根目录与默认首页 |
| `upstream` | http | 后端池；`weight` 加权，`ip_hash` 会话保持 |
| `proxy_pass` | location | 反向代理到 upstream 或地址 |
| `fastcgi_pass` | location | PHP 动态请求转交 php-fpm |
| `expires` | location | 静态资源浏览器缓存 |

### 8.2 最小可用模板

```nginx
# /etc/nginx/nginx.conf 主配置骨架
user  www;
worker_processes  auto;
error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
    worker_connections  10240;
    use epoll;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" "$http_user_agent"';
    access_log  /var/log/nginx/access.log  main;
    sendfile        on;
    keepalive_timeout  65;
    server_tokens off;
    gzip  on;
    include /etc/nginx/conf.d/*.conf;
}
```

```nginx
# /etc/nginx/conf.d/www.example.conf：upstream + 完整 server
upstream web_pool {
    server 10.0.0.7:8080 weight=3;
    server 10.0.0.8:8080 weight=1;
    # server 10.0.0.9:8080 down;      # 标记暂不可用
    # ip_hash;                        # 会话保持，按需开启
}

server {
    listen       80;
    server_name  www.example.com;
    root   /data/www/blog;
    index  index.php index.html;

    location / {
        proxy_pass http://web_pool;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    location ~ \.php$ {
        fastcgi_pass  127.0.0.1:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include       fastcgi_params;
    }

    location ~* \.(jpg|png|css|js)$ {
        expires 7d;
    }

    location ~ /\.ht {
        deny all;
    }
}
```

```bash
# 生效流程：语法检查通过再重载
nginx -t && systemctl reload nginx
curl -I -H "Host: www.example.com" http://10.0.0.7/
```

### 8.3 易错点

- 改配置先 `nginx -t`，报错会精确给出行号；不带 `-t` 直接 reload 会沿用旧配置且报错只在日志里。
- `fastcgi_param SCRIPT_FILENAME` 少写 `$document_root` 前缀时，PHP 页面直接 404 或下载裸文件。
- `proxy_pass` 末尾带不带 `/` 语义不同：`http://web_pool/` 会替换 location 前缀，不带则原样拼接，混用导致路径 404。
- `server_name` 不匹配时请求落在默认 server，多虚拟主机环境务必给每个 server 显式域名。nginx 的匹配顺序是精确值 → 前缀通配 → 后缀通配 → 正则 → 默认 server，排查「请求进了别的站点」时按这个顺序看。
- 反代后端拿到的来源 IP 全是 nginx 时，确认已传 `X-Real-IP` 与 `X-Forwarded-For` 头。
- worker 数与 `worker_connections` 的乘积是理论并发上限，调大时同步检查系统 `ulimit -n`。
- bind 80/443 这类低端口是 root 身份的 master 进程干的，`user www` 只决定 worker 身份，nginx 本身不存在「worker 读不了低端口」的问题；真正读不了低端口的是非 root 直跑的服务（如 Tomcat），要么换高位端口，要么给二进制 `setcap cap_net_bind_service=+ep`。
- 站点目录属主必须与 `user www` 一致，worker 以 www 身份读文件，属主错了就是 403；排查时 `ps aux | grep nginx` 看实际运行用户，别只看配置。

---

## 九、PHP-FPM：www.conf

php-fpm 用「主进程 + worker 池」处理动态请求，进程池参数全部在 `www.conf`（路径通常为 `/etc/php-fpm.d/www.conf`）。调优核心是 `pm` 系列四件套，直接影响内存占用与并发能力。

### 9.1 核心参数速查表 {: .sec-chk}

| 参数 | 作用 | 推荐值 |
| --- | --- | --- |
| `listen` | fpm 监听地址或 socket | `127.0.0.1:9000` 或 `/run/php-fpm/www.sock` |
| `user` / `group` | worker 运行身份 | 与 nginx 站点目录属主一致，如 `www` |
| `pm` | 进程管理模式 | `dynamic`（通用），内存敏感用 `ondemand` |
| `pm.max_children` | 最大 worker 数 | 可用内存 ÷ 单进程峰值内存 |
| `pm.start_servers` | 启动时预热进程数 | 5 左右 |
| `pm.min_spare_servers` | 最小空闲进程 | 2 到 5 |
| `pm.max_spare_servers` | 最大空闲进程 | 8 到 10 |
| `pm.max_requests` | 每个 worker 处理多少请求后重启 | 1000，防内存泄漏累积 |
| `request_slowlog_timeout` | 慢请求阈值 | `3s`，配合 slowlog 定位慢代码 |

### 9.2 最小可用模板

```ini
# /etc/php-fpm.d/www.conf 有效行
[www]
listen = 127.0.0.1:9000
;listen = /run/php-fpm/www.sock
;listen.owner = www
;listen.group = www

user = www
group = www

pm = dynamic
pm.max_children = 50
pm.start_servers = 5
pm.min_spare_servers = 5
pm.max_spare_servers = 10
pm.max_requests = 1000

pm.status_path = /fpm_status
slowlog = /var/log/php-fpm/www-slow.log
request_slowlog_timeout = 3s
php_admin_value[error_log] = /var/log/php-fpm/www-error.log
php_admin_flag[log_errors] = on
```

```bash
# 生效与验证
php-fpm -t
systemctl reload php-fpm
ss -lntp | grep 9000
```

### 9.3 易错点

- nginx 报 `502 Bad Gateway` 时先查 fpm 是否存活、`listen` 与 nginx `fastcgi_pass` 的地址端口是否一致，socket 与 TCP 混写是高发错误。
- 用 unix socket 时，socket 文件属主必须是 nginx 用户（`listen.owner/listen.group`），否则报 `Permission denied`。
- `pm.max_children` 盲目调大导致内存打爆触发 OOM；按「单进程峰值内存 × children ≤ 可分配内存」估算。
- `pm.max_requests` 设为 0（永不重启）会让第三方库的内存泄漏无限累积，建议 500 到 1000。这个参数本质是给 worker 定期「换班」，用重启进程的方式兜住泄漏，属于运维手段而非代码修复。
- nginx 的站点目录属主与 fpm 的 `user` 不一致时，会出现「能读不能写」的诡异权限问题，两边统一为同一个 `www` 账号。
- 改完 `php-fpm -t` 检查语法，`reload` 平滑生效；`restart` 会中断进行中的请求。
- `pm = dynamic` 与 `ondemand` 怎么选：dynamic 常驻一批进程扛住日常流量，响应稳定；ondemand 空闲时不留进程，省内存但第一个请求要等 fork。内存紧张的低流量机器用 ondemand，正经业务用 dynamic。`pm.max_children` 的公式反过来用也行：先压测出单进程峰值内存，再除可用内存，留两成余量。

---

## 十、MySQL / MariaDB：/etc/my.cnf

my.cnf 按 `[段名]` 组织：`[mysqld]` 管服务端，`[client]` 管客户端默认值，`[mysqldump]` 管备份行为。基础场景记住数据目录、端口、字符集三件即可，性能参数按内存规格逐步加。

### 10.1 核心参数速查表 {: .sec-chk}

| 参数 | 作用 | 推荐值 |
| --- | --- | --- |
| `datadir` | 数据目录 | `/var/lib/mysql`，迁移时改此项 |
| `socket` | 本地 socket 路径 | `/var/lib/mysql/mysql.sock` |
| `port` | 监听端口 | `3306` |
| `bind-address` | 监听地址 | 内网地址，禁止 `0.0.0.0` 暴露公网 |
| `character-set-server` | 服务端默认字符集 | `utf8mb4`（完整 emoji 支持） |
| `collation-server` | 默认排序规则 | `utf8mb4_general_ci` |
| `max_connections` | 最大连接数 | 500 起，按应用调整 |
| `innodb_buffer_pool_size` | InnoDB 缓冲池 | 物理内存的 50% 到 70% |
| `log-bin` | 开启 binlog | 主从与恢复的基石 |
| `server-id` | 复制唯一标识 | 主从架构内全局唯一 |

### 10.2 最小可用模板

```ini
# /etc/my.cnf
[mysqld]
datadir=/var/lib/mysql
socket=/var/lib/mysql/mysql.sock
port=3306
bind-address=172.16.1.31

character-set-server=utf8mb4
collation-server=utf8mb4_general_ci

max_connections=500
innodb_buffer_pool_size=1G
innodb_flush_log_at_trx_commit=1

log-bin=mysql-bin
server-id=31
expire_logs_days=7

[client]
default-character-set=utf8mb4
socket=/var/lib/mysql/mysql.sock

[mysqldump]
default-character-set=utf8mb4
quick
max_allowed_packet=64M
```

```bash
# 生效与验证（改 datadir 等目录类参数需要重启并迁移数据）
systemctl restart mariadb
mysql -uroot -p'<your-password>' -e "show variables like 'character%';"
mysql -uroot -p'<your-password>' -e "show variables like 'max_connections';"
```

### 10.3 易错点

- `datadir` 迁移后只改配置不改属主，服务起不来；新目录必须 `chown -R mysql.mysql` 且确认 SELinux 上下文。
- 字符集不统一造成中文乱码，服务端、库、表、连接四层都要是 utf8mb4，用 `show variables like 'character%'` 逐层核对。
- `bind-address=0.0.0.0` 加弱口令等于裸奔；监听内网地址，账号授权限定来源网段。
- 主从架构里 `server-id` 重复会导致复制异常，规划时登记分配。
- 改配置前 `mysqldump` 备份；`restart` 会中断业务连接，尽量安排在窗口期。
- `innodb_buffer_pool_size` 沿用默认 128M 是小内存机器的值，生产机器必须显式配置。
- my.cnf 不止一份：按 `/etc/my.cnf` → `/etc/my.cnf.d/*.cnf` 顺序读取，同名参数后者覆盖前者；改了没生效，先确认改的是最后被读的那份。
- `character-set-server` 用 utf8mb4 还有个理由：utf8 最多 3 字节，存不了 emoji 和部分生僻字，写入报错才发现就晚了。

---

## 十一、keepalived：keepalived.conf

keepalived 通过 VRRP 协议在多台机器间漂移 VIP，实现服务高可用。配置分两层：`vrrp_script` 定义健康检查，`vrrp_instance` 定义 VIP 与优先级，二者通过 `track_script` 关联。主备靠 `priority` 差值与 `weight` 联动降级。

### 11.1 核心参数速查表 {: .sec-chk}

| 参数 | 作用 | 说明 |
| --- | --- | --- |
| `vrrp_script` | 健康检查脚本定义 | `interval` 检查间隔，`weight` 检测失败时的优先级调整量 |
| `state` | 初始角色 | MASTER / BACKUP（配 `nopreempt` 时两边都写 BACKUP） |
| `interface` | VRRP 通告走哪块网卡 | 业务网卡，如 `eth0` |
| `virtual_router_id` | VRID，同一组主备必须一致 | 0 到 255，同网段不与其他集群冲突 |
| `priority` | 初始优先级 | 主高备低，如 100 与 80 |
| `advert_int` | 通告间隔秒数 | `1` |
| `authentication` | VRRP 报文认证 | auth_type PASS + auth_pass 八字符 |
| `virtual_ipaddress` | 漂移的 VIP | 带掩码与 dev，如 `10.0.0.100/24 dev eth0` |
| `track_script` | 实例关联的检查脚本 | 检查失败按 weight 降优先级触发切换 |
| `nopreempt` | 不抢占 | 故障恢复后不夺回 MASTER，减少二次切换 |

### 11.2 最小可用模板

```bash
# 健康检查脚本：chmod 755 /etc/keepalived/check_nginx.sh
cat > /etc/keepalived/check_nginx.sh <<'EOF'
#!/bin/sh
if ! killall -0 nginx >/dev/null 2>&1; then
    systemctl restart nginx
    sleep 2
    killall -0 nginx >/dev/null 2>&1 || exit 1
fi
exit 0
EOF
chmod 755 /etc/keepalived/check_nginx.sh
```

```conf
# /etc/keepalived/keepalived.conf（主机 linux-node01，备机改 priority 为 80）
global_defs {
    router_id linux-node01
}

vrrp_script chk_nginx {
    script "/etc/keepalived/check_nginx.sh"
    interval 2
    weight -30
    fall 2
    rise 2
}

vrrp_instance VI_1 {
    state BACKUP
    interface eth0
    virtual_router_id 51
    priority 100
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 11111111
    }
    virtual_ipaddress {
        10.0.0.100/24 dev eth0
    }
    track_script {
        chk_nginx
    }
    nopreempt
}
```

```bash
# 生效与验证
systemctl enable --now keepalived
ip addr | grep 10.0.0.100          # 主机上能看到 VIP
journalctl -u keepalived -f        # 观察切换日志
```

### 11.3 易错点

- `nopreempt` 只在 `state BACKUP` 时有效，主备都写 MASTER 会导致双主抢 VIP；推荐两边都写 BACKUP，靠 priority 分高低。
- `virtual_router_id` 与网段内其他 keepalived 集群冲突时，VIP 来回漂移、日志刷 `bogus VRRP packet`；换一个 VRID。
- 防火墙必须放行 VRRP 协议（`firewall-cmd --add-protocol=vrrp`），否则两边互收不到通告，同时持有 VIP。
- `weight` 为负数表示检查失败时减掉相应优先级，降幅要足够让主备优先级反转；正数逻辑相反，混用易出诡异切换。为什么主 100 备 80 配 `weight -30` 能切：100-30=70 < 80，优先级反转，备机接管。降幅设计错了（比如只减 10），检查失败也切不过去，这是最隐蔽的一类配置错误。
- 检查脚本必须可执行且以 exit 码报告结果，脚本里自带重启服务可显著减少误切换。
- VIP 只出现在持有方网卡上，验证时先 `ip addr` 再 curl，不要凭「ping 不通 VIP 就说挂了」下结论。
- VRRP 有 v2 / v3 两个版本，同一集群两边必须一致（`vrrp_version`），v3 已不再支持 PASS 认证；`auth_pass` 只取前 8 个字符，主备写不一致时互不认通告、双双持 VIP，表现和脑裂一模一样。
- 还有版本兼容坑：主备 keepalived 版本一大一小，通告格式不兼容，直接脑裂。升级时两边一起升，先在测试环境演练切换。

---

## 十二、Zabbix 客户端：zabbix_agentd.conf

agent 的核心是三个地址类参数与 `UserParameter` 自定义监控。被动模式由服务端来取（`Server`），主动模式由 agent 上报（`ServerActive`），生产建议两种都配。

### 12.1 核心参数速查表 {: .sec-chk}

| 参数 | 作用 | 推荐值 |
| --- | --- | --- |
| `Server` | 被动模式：允许哪些 IP 来取数据 | Zabbix 服务端 IP |
| `ServerActive` | 主动模式：向哪台上报数据 | 服务端 IP（可带端口） |
| `Hostname` | 主机名，必须与服务端界面一致 | 如 `linux-node01` |
| `LogFile` | agent 日志 | `/var/log/zabbix/zabbix_agentd.log` |
| `EnableRemoteCommands` | 允许服务端下发远程命令 | `1`（按需，注意安全面） |
| `UnsafeUserParameters` | 允许自定义参数使用特殊字符 | 用到通配传参时设 `1` |
| `UserParameter` | 自定义监控键 | `键名[,参数],命令` 三段式 |
| `Include` | 额外配置目录 | `/etc/zabbix/zabbix_agentd.d/*.conf`，推荐把自定义项放这里 |

### 12.2 最小可用模板

```conf
# /etc/zabbix/zabbix_agentd.conf 有效行
Server=172.16.1.71
ServerActive=172.16.1.71
Hostname=linux-node01

LogFile=/var/log/zabbix/zabbix_agentd.log
LogFileSize=10
EnableRemoteCommands=1
UnsafeUserParameters=1
Include=/etc/zabbix/zabbix_agentd.d/*.conf
```

```conf
# /etc/zabbix/zabbix_agentd.d/custom.conf：UserParameter 自定义监控
UserParameter=web_state,ps -ef | grep -c [n]ginx
UserParameter=port_check[*],ss -lnt | grep -c ":$2 "
UserParameter=disk_root_used,df / | awk '/\/$/{gsub(/%/,"");print $5}'
```

```bash
# 生效与排错：服务端用 zabbix_get 远程取值验证
systemctl restart zabbix-agent
ss -lntp | grep 10050
zabbix_agentd -t web_state
zabbix_get -s 10.0.0.7 -k 'web_state'
zabbix_get -s 10.0.0.7 -k 'port_check[80]'
tail -20 /var/log/zabbix/zabbix_agentd.log
```

### 12.3 易错点

- `Hostname` 与服务端 Web 界面配置的主机名**必须逐字符一致**（含大小写），不一致时主动模式拿不到模板、数据不上报。
- `Server` 未包含服务端 IP 时被动检查报 `Connection refused`，agent 日志里能看到被拒记录。
- 自定义键先 `zabbix_agentd -t 键名` 本地验证，再 `zabbix_get` 从服务端验证，最后才去界面建监控项，三层逐级定位。
- `UserParameter` 命令中的管道、引号按 shell 解析，特殊字符传参需开 `UnsafeUserParameters=1`。
- 自定义项推荐放 `zabbix_agentd.d/` 独立文件，主配置保持干净、便于 Ansible 批量下发。主动模式的好处也说一句：数据由 agent 定时上报，服务端轮询压力小，服务端短暂不可达时 agent 还能攒着数据补传。
- 排障习惯：先看 agent 日志，再比对本机手动执行命令的结果与 `zabbix_get` 结果，差异即线索。手动能跑、zabbix_get 取不到，多半是 cron PATH 那个老问题的翻版——agent 的执行环境同样不带你的登录变量。


{% endraw %}
