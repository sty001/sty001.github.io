---
title: "day45 结课作业实操：综合架构总复习与高频面试题精讲"
date: 2026-10-24 09:09:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
本篇是整套课程的收尾篇，对应第 41 天的总复习作业：①用一张大表把「从裸机到高可用」的完整架构链路串一遍，检验每个环节是否真的掌握；②精讲 20 道高频运维面试题，每题给「标准答案 + 加分点」，可直接当面试弹药库用；③给出后续学习路线。其中软硬链接、find 删旧文件、awk 统计 IP 三题在本地环境真跑验证。

## 实操环境说明

- **A 级（已真实执行）**：shell 层面的命令（ln/ls/find/touch/awk/sort/uniq/du）在 Git Bash 环境实际运行，输出为真实结果，标注 `已实操`（属主统一显示为 `user`）；
- **B 级（标准命令 + 预期输出）**：系统服务类操作（df、rsync、NFS、systemctl、nginx 等）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

本环境无 symlink 权限（`ln -s` 实测不可用），软链接部分给 CentOS 7 预期输出；硬链接、find、awk 部分为真跑。实操目录统一用 `/tmp/hw/day45`，前一篇的日志样本 `/tmp/hw/day40/sample.log` 继续复用。

## 题目总览

| 题号 | 内容 | 分级 |
| --- | --- | --- |
| 题 1 | 全课程架构链路大回顾（一张表） | 复习（无实操） |
| 题 2 | 20 道高频运维面试题精讲 | 3 题 A 级真跑 + 其余讲解 |
| 题 3 | 后续学习路线 | 路线表（无实操） |

## 题 1：全课程架构链路大回顾

一张表从下往上把整套课程串起来。自查方法：遮住「关键技能」一列，看能否自己回忆出来；哪一行卡壳就回哪一章。

| 阶段 | 环节 | 关键技能 | 生产对应场景 |
| --- | --- | --- | --- |
| 硬件与系统 | 服务器与安装 | RAID、CentOS 7 安装、分区（/boot swap /） | 上架、装系统、raid5/raid10 选型 |
| 基础操作 | 常用命令 | ls/cd/cp/mv/rm/cat/grep/find/tar、Vim | 日常文件管理、打包备份 |
| 文本处理 | 正则与三剑客 | 基础/扩展正则、grep、sed、awk | 日志分析、批量改配置 |
| 用户与权限 | 权限体系 | chmod/chown、755/644、umask、sudo | 网站目录权限最小化 |
| 任务调度 | 定时任务 | crontab 五段、脚本化备份 | 每天凌晨打包、日志切割 |
| 磁盘管理 | 磁盘与文件系统 | fdisk/parted、mkfs、mount、df/du、inode | 扩容、磁盘满排查 |
| 网络基础 | 网络配置 | ip、ss、三次握手、常用端口 | 排查端口监听与连通性 |
| 数据同步 | rsync/NFS | rsync 参数、NFS 服务端/客户端、inotify | 备份推送、共享存储 |
| 实时同步 | sersync | inotify 事件 + rsync 推送 | 静态文件多机一致 |
| 远程管理 | SSH | sshd 加固、密钥登录、跳板 | 防爆破（见 day40 实战） |
| 批量管理 | Ansible | inventory、ad-hoc、playbook | 几十台机器批量下发 |
| Web 服务 | Nginx/LNMP | 虚拟主机、location、fastcgi、php-fpm | 部署动态站点 |
| 负载均衡 | Nginx/LVS | upstream、轮询/权重/ip_hash、四层/七层 | 多台 web 分流 |
| 高可用 | keepalived | VRRP、VIP、主备切换 | 负载均衡层防单点 |
| 监控告警 | Zabbix | agent、模板、触发器、自定义监控 | CPU/磁盘/进程阈值告警 |
| 安全分析 | 日志审计 | grep/awk 流水线、fail2ban | 爆破排查（day40 全流程） |

这条链路的骨架是：**硬件 → 单机运维 → 文本处理 → 权限与调度 → 数据同步 → 批量管理 → Web 服务 → 负载均衡 → 高可用 → 监控**。面试时能按这条线讲清「一台新机器从装系统到对外提供高可用服务要做哪些事」，就等于把课程复述了一遍。

## 题 2：20 道高频运维面试题精讲

### 第 1 题：软链接与硬链接的区别（真跑）

**标准答案**：硬链接（`ln 源 目标`）是同一个 inode 的多个目录入口，删除任意一个名字，只要 inode 的链接数不为 0，数据就还在；不能跨文件系统、不能对目录创建。软链接（`ln -s 源 目标`）是一个独立文件，内容存放的是目标路径，类似 Windows 快捷方式；源文件删除后软链接即失效（红字闪烁）；可跨文件系统、可指向目录。

硬链接实验（已实操）：

```bash
cd /tmp/hw/day45
echo "hard-link-content" > source.txt
ln source.txt hard.txt
ls -li source.txt hard.txt
rm source.txt
cat hard.txt
```

输出：

```console
$ ls -li source.txt hard.txt
5348024558048866 -rw-r--r-- 2 user 197609 18 Oct 24 09:00 hard.txt
5348024558048866 -rw-r--r-- 2 user 197609 18 Oct 24 09:00 source.txt
$ rm source.txt
$ cat hard.txt
hard-link-content
```

两个文件 inode 相同（第一列）、硬链接数为 2（第三列）；删掉源文件后 hard.txt 内容完好。

软链接在 CentOS 7 上的预期表现（预期输出，本环境无 symlink 权限）：

```console
$ ln -s source.txt soft.txt
$ ls -l soft.txt
lrwxrwxrwx 1 root root 10 Oct 24 09:00 soft.txt -> source.txt
$ rm source.txt && cat soft.txt
cat: soft.txt: No such file or directory
```

**加分点**：用 `ls -li` 看第一列 inode 即可当场验证；生产中删除被进程占用的大文件（如被 nginx 打开的日志），空间不释放，正是「文件名没了但 inode 还被进程持有」——`lsof | grep deleted` 找到后重启或清空对应进程句柄。

### 第 2 题：用 find 删除 30 天前的文件（真跑）

**标准答案**：`find /path -type f -mtime +30 -exec rm -f {} \;` 或配合 xargs：`find /path -type f -mtime +30 | xargs rm -f`。`-mtime +30` 表示修改时间在 30 天之前（不含第 30 天当天）。

实验（已实操）：

```bash
mkdir -p /tmp/hw/day45/oldlog && cd /tmp/hw/day45/oldlog
touch -d "2026-08-01" a.log b.log
touch -d "2026-10-20" c.log
touch -d "2026-09-10" d.log
find . -type f -mtime +30 | sort
find . -type f -mtime +30 -exec rm -f {} \;
ls
```

输出：

```console
$ find . -type f -mtime +30 | sort
./a.log
./b.log
./d.log
$ find . -type f -mtime +30 -exec rm -f {} \;
$ ls
c.log
```

三个旧文件被删，新文件保留。

**加分点**：先删后打？顺序应该是**先备份再删除**；`-exec rm` 之前先跑一遍不带 rm 的 find 看清单；文件名可能含空格时用 `-print0 | xargs -0`；批量删除还可以写进定时任务做日志轮转。另外 `-mtime +30` 与 `-mtime 30`（恰好第 30~31 天）含义不同，别混淆。

### 第 3 题：用 awk 统计日志中访问次数最多的前 10 个 IP（真跑）

**标准答案**：以 SSH 日志为例（access 日志同理，取 `$1`）：

```bash
awk '/Failed password/ {for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' /tmp/hw/day40/sample.log \
  | sort | uniq -c | sort -rn | head -5
```

输出（已实操）：

```console
  34512 218.65.30.25
  17164 112.85.42.99
  17163 218.87.109.150
  17163 218.65.30.61
  17163 218.65.30.126
```

Nginx access 日志的对应写法：`awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10`。

**加分点**：能讲出为什么要中间夹一个 `sort`（uniq 只合并相邻重复行）；更进阶用 awk 关联数组一步完成：`awk '{count[$1]++} END{for(ip in count) print count[ip],ip}' access.log | sort -rn | head -10`，少一次管道排序，大文件更快。

### 第 4 题：磁盘满了，怎么排查？

**标准答案**：第一步 `df -h` 确认哪个分区满；第二步 `du -sh /* 2>/dev/null | sort -rh | head`（CentOS 7 可用 `du -h --max-depth=1 / | sort -rh | head`）逐层下钻定位大目录；第三步看大文件（常见：大日志、core dump、/var/log、容器目录）后删除或轮转。

（预期输出，CentOS 7）

```console
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda3        98G   93G     0 100% /
$ du -h --max-depth=1 / | sort -rh | head -5
25G	/var
18G	/data
...
```

**加分点**：三种「df 显示满但 du 找不到大文件」的经典原因——①inode 耗尽（`df -i` 查看，海量小文件撑爆 inode，删掉小文件即可）；②文件已删除但进程仍持有句柄（`lsof | grep deleted`，重启服务或 `: > 文件` 清空）；③挂载点覆盖（挂载前目录里已有数据，umount 后才看得见）。

### 第 5 题：rsync 与 scp 的区别？

**标准答案**：scp 是基于 ssh 的简单远程复制，每次**全量**传输，适合一次性拷贝；rsync 默认走 ssh 通道，核心优势是**增量**——quick check 算法比对大小与 mtime，只传差异块，且支持保留属性（`-a`）、排除（`--exclude`）、限速（`--bwlimit`）、删除同步（`--delete`），适合定时备份与海量文件同步。

**加分点**：说出常用参数组合 `rsync -avz --delete --exclude="*.log" src/ dst/`（注意 src 带不带斜杠的语义差别：带斜杠同步目录内容，不带同步目录本身）；rsync 还能以 daemon（873 端口）方式跑；`-P` = `--progress --partial`，断点续传。

### 第 6 题：rsync + inotify 实时同步的原理？

**标准答案**：inotify 是内核提供的文件系统事件通知机制，监控工具（inotifywait/sersync）监听 create、modify、delete、move 等事件，一旦发生立即触发 rsync 把变化的文件推到远端，从而把「分钟级定时同步」提升到「秒级实时同步」。常见组合是 sersync（C++ 封装，自带多线程与失败重传）或自写脚本「inotifywait -m + rsync」。

**加分点**：知道局限——inotify 只监控本机事件，双向同步要用 lsyncd 或 DRBD/GlusterFS；监控队列溢出（`sysctl fs.inotify.max_queued_events`）会导致漏同步，大目录要调大 `max_user_watches`。

### 第 7 题：NFS 的作用与排错思路？

**标准答案**：NFS 让客户端把服务端的共享目录像本地目录一样挂载（mount -t nfs），多台 web 挂同一个 NFS 即可共享上传文件，解决「负载均衡后文件不一致」。服务端配 `/etc/exports`（如 `/data 10.0.0.0/24(rw,sync,all_squash)`），`exportfs -rv` 生效；客户端 `mount -t nfs server:/data /mnt`。

**加分点**：排错顺序是先 `rpcinfo -p` 看 rpcbind（111 端口）、再 `showmount -e server` 看导出清单、再看防火墙；`all_squash` 把所有用户压成匿名用户 nfsnobody，配合两端 uid 一致避免权限混乱；生产可换更现代的 GlusterFS/对象存储。

### 第 8 题：Ansible playbook 与 shell 脚本对比，各适合什么场景？

**标准答案**：shell 脚本面向**单机**，逻辑灵活但幂等性靠人肉保证，几十台机器要自己写 for 循环加 ssh；Ansible 基于 ssh 免客户端，playbook 用 YAML 声明**期望状态**，模块天然幂等（重复执行结果一致），支持模板（Jinja2）、变量、角色（roles）、失败回滚，适合批量配置下发、标准化初始化、持续变更。

**加分点**：能举例说明幂等——`copy` 模块内容没变就不会写文件也不触发 notify；handler 只在状态真正变化时重启服务；对比中提一句「临时改一台机器用 ad-hoc 命令，可重复交付的编排用 playbook，规模上千用角色化 + 动态 inventory」。

### 第 9 题：Nginx 出现 502 怎么排查？

**标准答案**：502 = nginx 作为代理收到了后端（php-fpm/tomcat）的**无效响应或连接失败**。排查路径：①后端进程活着吗——`ps -ef | grep php-fpm`、`ss -lntup | grep 9000`；②连接参数对吗——`fastcgi_pass 127.0.0.1:9000` 的 IP 端口、sock 文件路径与权限；③资源耗尽了吗——php-fpm 的 pm.max_children 打满、内存 OOM（`dmesg | tail`）；④看错误日志 `/var/log/nginx/error.log` 里的 `connect() failed` 或 `Connection refused` 字样定位。

**加分点**：区分 502 与 504——504 是 nginx 在 `proxy_read_timeout`（默认 60s）内**等不到后端响应**，慢查询/后端卡死居多，调大超时或优化后端；502 是**连不上或被拒**，进程挂了居多。一句话：502 找「死」，504 找「慢」。

### 第 10 题：Nginx 504 与 502 的区别及处理（与第 9 题成对出现）

**标准答案**：见第 9 题加分点。504 处理三板斧：查后端慢在哪（MySQL 慢查询日志、php 慢日志 slowlog）、nginx 侧按需调 `proxy_connect_timeout/proxy_send_timeout/proxy_read_timeout`、根治靠优化 SQL 或加缓存。

**加分点**：补充常见状态码速记——200 正常、301/302 重定向、403 权限（目录无 index 且未开 autoindex、文件权限不足）、404 资源不存在、413 请求体超限（client_max_body_size）、502/504 后端问题、503 后端全部 down 或限流。

### 第 11 题：keepalived 脑裂是什么？怎么防？

**标准答案**：主备两台都持有 VIP、同时对外响应即为脑裂。根因几乎都是**心跳断了但双方都活着**：心跳线/交换链路故障、防火墙拦了 VRRP 组播（224.0.0.18）、vrrp 报文超时（notify 太重）。防法：双心跳线冗余、放行组播、备用机太弱时设 `nopreempt`、监控侧检测「同一 VIP 出现在两台机器上」即告警，必要时用 arping 巡检。

**加分点**：能主动提「仲裁第三方」——用外部脚本/监控判断对端是否真的存活再决定接管；以及 keepalived 与 nginx 的联动：`track_script` 检测 nginx 进程，nginx 挂了主动降权让 VIP 漂走，而不是让 VIP 留在一台「活着但服务已死」的机器上。

### 第 12 题：Nginx 负载均衡与 LVS 的区别（四层 vs 七层）？

**标准答案**：LVS 工作在**四层**（传输层），只做 IP+端口的转发，性能极高（内核态，DR 模式响应不经过调度器），但不理解 URL/Cookie；Nginx 工作在**七层**（应用层），能按域名、URL、Cookie 分流，支持健康检查、动静分离、缓存、限流，性能低于 LVS 但功能丰富。常见架构：LVS 在前扛量（四层），Nginx 在后做七层分发与业务路由。

**加分点**：说出调度算法——轮询、weight、ip_hash（会话保持）、least_conn；LVS 三种模式 DR/TUN/NAT 的差别（DR 性能最好要求同网段、NAT 跨网段但调度器易成瓶颈）；keepalived 最初就是为 LVS 的高可用而生。

### 第 13 题：Nginx 平滑重载的原理？

**标准答案**：`nginx -s reload`（等价 `systemctl reload nginx`）向 master 发 HUP 信号：master 读取新配置、语法检查通过后 fork 新 worker，再通知旧 worker 优雅退出——旧 worker 停止接收新连接，把手头请求处理完再退出。整个过程端口不关、连接不断，即「平滑」。

**加分点**：改完配置先 `nginx -t` 再 reload 是铁律；知道常见信号——QUIT 优雅退出、USR2 平滑升级二进制、WINCH 让 worker 优雅退出；reload 不生效多半是配置文件没被 include 或改错了 server 块。

### 第 14 题：crontab 的五个字段是什么？定时任务不执行怎么查？

**标准答案**：五段 = 分 时 日 月 周，例 `0 2 * * * /scripts/backup.sh`（每天 02:00）。不执行排查五连：①`systemctl status crond` 服务在不在；②`grep 脚本 /var/log/cron` 有没有调度记录；③手动用 **crontab 同款环境**跑：环境变量（PATH 很精简）、没有终端，脚本里用相对路径/依赖交互的都会翻车；④输出重定向排查：`>> /tmp/backup.log 2>&1` 看报错；⑤脚本有执行权限吗、文件是 DOS 格式吗（`dos2unix`）。

**加分点**：说得出「写定时任务三原则」——命令写绝对路径、输出必须重定向（否则邮件堆积 /var/spool/postfix）、脚本先手动跑通再进 crontab；`/etc/cron.deny` 与 `/var/log/cron` 的作用；秒级需求用 systemd timer 或循环 sleep。

### 第 15 题：权限 755、644 分别是什么？umask 干嘛的？

**标准答案**：权限三段 = 属主/属组/其他，各段 rwx 对应 4/2/1。755 = rwxr-xr-x，常用于**目录**与可执行脚本；644 = rw-r--r--，常用于普通文件与网站静态文件。umask 是新建文件/目录时要「减掉」的权限：umask 022 时，目录 777-022=755，文件 666-022=644（文件默认不继承 x 位）。

**加分点**：网站目录安全惯例——目录 755、文件 644、属主是运行用户，上传目录单独给写权限且禁执行 php；`chattr +i` 给关键文件上不可修改锁；SUID/SGID/粘滞位各举一例（passwd、/tmp）。

### 第 16 题：buff/cache 是什么？swap 什么时候用？

**标准答案**：buff/cache 是内核用空闲内存做磁盘读写缓存，属于「可回收」内存，`free -h` 判断内存够不够要看 **available** 列而不是 free 列。swap 是内存不足时把冷页换出到磁盘——磁盘比内存慢几个数量级，频繁 si/so（`vmstat` 里的 si、so 持续非 0）就是内存瓶颈信号。

**加分点**：`echo 3 > /proc/sys/vm/drop_caches` 只能清缓存不能「省内存」（缓存本来就会自动让位）；生产一般保留少量 swap 兜底，`swappiness` 调低（如 10）让内核尽量用真内存；OOM 时看 `dmesg` 里 `Out of memory: Kill process` 确认谁被杀。

### 第 17 题：Linux 开机启动流程？

**标准答案**（CentOS 7）：BIOS/UEFI 自检 → 读取 MBR/GRUB2 → 加载内核与 initramfs → 启动 PID 1 的 systemd → 按 target（multi-user.target/graphical.target）拉起各服务（并行）→ 启动 getty/登录。排错锚点：卡 GRUB 修引导、卡服务用 systemd 单用户模式（`rd.break` 或编辑启动项加 `systemd.unit=rescue.target`）。

**加分点**：对比 CentOS 6 的 SysV 串行启动说明 7 并行的优势；`systemctl get-default` 看默认目标；服务排障三板斧 `systemctl status/ journalctl -u 服务名 / systemctl list-dependencies`。

### 第 18 题：grep、sed、awk 各自适合什么场景？

**标准答案**：grep 是**过滤器**——按正则/固定串筛行，快、简单，配合 `-v/-c/-n/-E` 覆盖 90% 的「找出我要的行」；sed 是**流编辑器**——对行做增删改替换，强项是 `-i` 批量改文件（如改配置）与按行号操作；awk 是**列处理器**——按空白切列取 `$1/$NF`，还能算术、条件、关联数组，统计类需求（Top IP、求和、格式化报表）首选。一句话：找行用 grep、改行用 sed、取列算数用 awk。

**加分点**：能举「同一需求三种写法」的例子（如排除注释行：`grep -v '^#'` / `sed '/^#/d'` / `awk '!/^#/'`）；提一句 awk 的 `BEGIN{}/END{}` 块与 `-F` 自定义分隔符是统计题的关键参数。

### 第 19 题：TCP 三次握手与常见端口？

**标准答案**：三次握手 = 客户端 SYN → 服务端 SYN+ACK → 客户端 ACK，建立双向可靠连接；挥手四次（FIN/ACK/FIN/ACK）。常见端口：ssh 22、http 80、https 443、rsync 873、NFS 2049、rpcbind 111、mysql 3306、redis 6379、zabbix 10050/10051、php-fpm 9000。排查工具：`ss -lntup` 看监听、`telnet host port` / `curl -v` 验通、`tcpdump` 抓包。

**加分点**：知道 SYN 洪水与 `sync cookies`、TIME_WAIT 过多与 `net.ipv4.tcp_tw_reuse`；「端口通但服务不响应」用 curl -v 看卡在 TCP 还是 HTTP 阶段——这句在排查 502/504 时非常实用。

### 第 20 题：一台新服务器上线，你的标准化初始化清单是什么？

**标准答案**（把前 19 题串起来）：①改主机名、配 IP/DNS、时间同步（chrony）；②最小化安装 + 关闭 SELinux/firewalld 按需放行；③创建运维用户 + sudo、禁 root 密码登录、改 SSH 端口、配密钥；④配 yum 源、装基础工具包；⑤文件句柄数/内核参数（ulimit、sysctl）；⑥rsync 定时备份 + 日志轮转（logrotate）；⑦fail2ban 防爆破；⑧接入 Zabbix 监控与告警；⑨Ansible 把以上动作写成 playbook，新机器一条命令初始化完毕。

**加分点**：强调「幂等 + 可重复」——初始化必须脚本化/playbook 化而不是手工敲命令；再补一句基线安全：审计（auditd）、堡垒机、备份可用性定期演练。面试官听到「备份要演练恢复」基本就是加分项。

## 题 3：后续学习路线

| 阶段 | 目标 | 关键内容 |
| --- | --- | --- |
| 巩固期 | 把课程骨架变成肌肉记忆 | 重做 day40 日志分析；写 3 个定时备份/日志切割脚本；CentOS 虚拟机把 LNMP + NFS + rsync 全链路搭两遍 |
| 深化期 | 补齐原理与网络 | TCP/IP 详解（握手挥手、抓包）、shell 进阶（函数/数组/调试）、MySQL 主从与备份恢复 |
| 规模化期 | 面向中大型架构 | Ansible 深入（role、vault）、LVS+keepalived 实战、Kubernetes 与容器化（Docker → K8s） |
| 可观测性 | 从「会监控」到「会排障」 | Prometheus + Grafana、ELK/Loki 日志集中化、链路追踪 |
| 安全与自动化 | 长期方向 | CI/CD（GitLab CI/Jenkins）、IaC（Terraform）、云平台（阿里云/AWS 认证可作路标） |

选路原则：先把「单机能扛」练扎实（巩固期 + 深化期），再谈「规模化与自动化」；每一阶段都用「能讲给别人听 + 有可复现的实验环境」作为通过标准。

## 验证方法

本篇的三个 A 级实验自查：

1. 硬链接：`ls -li` 两文件 inode 相同、链接数为 2，删源后 `cat` 内容仍在；
2. find：造一新一旧三个文件，`-mtime +30` 只列出旧文件，删除后只剩新文件；
3. awk 统计：样本日志 Top IP 与 day40 全量统计的前几名一致。

## 本篇小结

1. 全课程是一条「单机 → 数据 → 批量 → 集群 → 高可用 → 监控」的链路，复习时遮表自查，哪行卡壳回哪章；面试自我介绍也按这条线组织最清晰。
2. 20 道面试题里最高频的三个引擎是：**三剑客统计流水线**（Top IP）、**磁盘/日志排查三板斧**（df/du/df -i/lsof deleted）、**负载均衡高可用链路**（Nginx/LVS/keepalived/502/504/脑裂），务必能脱稿讲。
3. 软硬链接的本质差异在 inode：硬链接同 inode 多入口，软链接是独立文件存路径；「文件删了空间不释放」就是 inode 被进程持有的现实版。
4. 面试答题套路：先给一句结论（标准答案），再给验证命令或实验，最后补一个生产案例或原理细节（加分点）——比背概念更有说服力。
5. 后续路线按「巩固 → 深化 → 规模化 → 可观测 → 安全自动化」推进，每阶段以「能讲清 + 有实验」为过关标准，不贪快。

> **参见**：day40 secure 日志安全分析实操 · awk 命令详解 · find、tar、权限与 inode
{% endraw %}
