---
title: "day10-系统优化与软件安装作业实操"
date: 2026-10-24 09:48:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-10"
---

{% raw %}



课程第 10 天（系统优化实践·下）的作业有五道：rpm 卸载、第一阶段总结、课程复述，外加批量建户与 yum 安装流程两个扩展题。rpm 卸载从查询、卸载到依赖处理给全命令序列；阶段总结按"硬件 → 安装 → 命令 → 目录 → 优化"串成一条链，配一组真跑的链路小实验；批量建户与 yum 流程给标准脚本、预期输出和验证命令。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令（`seq`、`for` 循环、`mkdir`、`ls`、`cat`、`grep`、`wc`、`sort`、`uniq`、`tar`、`du`、`stat`、`md5sum` 等）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令（`rpm`、`yum`、`useradd`、`chpasswd`、`userdel` 等）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明在真机执行方式。

实操目录统一用 `/tmp/hw` 下的子目录。本文 A 级输出均在 Git Bash（bash 5.3）中真实执行，本地用户名已按脱敏要求替换为 `user`。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 一个软件安装好了，如何利用 rpm 命令进行卸载 | B 级（标准命令 + 预期输出） |
| 题 2 | 总结第一个阶段课程知识 | 结构化总结 + A 级（链路小实验真跑） |
| 题 3 | 进行一天课程内容复述 | 复述提纲（知识点地图） |
| 扩展题 1 | 批量创建用户（一次创建 50 个） | A 级（序列与随机串真跑）+ B 级（useradd / chpasswd） |
| 扩展题 2 | yum 安装软件流程 | B 级（标准流程 + 预期输出） |

## 题 1：一个软件安装好了，如何利用 rpm 命令进行卸载

**题目原文**：一个软件安装好了，如何利用 rpm 命令进行卸载。

**考察点**：卸载前的查询确认（`rpm -q`、`rpm -qa`、`rpm -q --whatrequires`）；`rpm -e` 标准卸载；依赖冲突的两种处理方式（`yum remove` 与 `rpm -e --nodeps`）及其风险；卸载后的验证与残留清理。

**实现思路**：rpm 只认单个包、不管依赖，所以卸载的正确姿势是先查再卸：查装没装、查包里有什么、查谁依赖它；确认安全再 `rpm -e`。依赖报错优先交给 `yum remove` 自动解决，实在没辙才 `--nodeps`，用之前想清楚后果；卸完 `rpm -q` 验证，顺手清配置残留。

### 步骤 1：卸载前先查询确认（预期输出，CentOS 7）
{: .sec-ver}

```bash
rpm -q httpd                     # 查询单个包是否安装、装的是哪个版本
rpm -qa | grep -i httpd          # 在所有已安装包中按关键词模糊搜索
rpm -qi httpd                    # 查看详细信息（版本、厂商、安装时间）
rpm -ql httpd                    # 列出该包安装的所有文件（认清卸载会删掉什么）
rpm -q --whatrequires httpd      # 关键一步：查清谁在依赖这个包
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# rpm -q httpd
httpd-2.4.6-97.el7.centos.x86_64
[root@linux-node1 ~]# rpm -qa | grep -i httpd
httpd-2.4.6-97.el7.centos.x86_64
httpd-tools-2.4.6-97.el7.centos.x86_64
[root@linux-node1 ~]# rpm -q --whatrequires httpd
mod_ssl-1:2.4.6-97.el7.centos.x86_64
httpd-tools-2.4.6-97.el7.centos.x86_64
```

> **注意：** `rpm -q --whatrequires` 是卸载前的"安检"——输出非空说明有别的包依赖它，直接卸载会把它们一起拖垮。另外 `rpm -qa` 的输出是按字母排序的，配合 `grep`、`wc -l` 可以快速筛选与统计。
{: .sec-pit}

### 步骤 2：标准卸载与验证（预期输出，CentOS 7）
{: .sec-best}

```bash
rpm -e httpd        # -e 即 erase（卸载）；注意写的是包名，不是 rpm 文件名
rpm -q httpd        # 立即验证
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# rpm -e httpd
[root@linux-node1 ~]# rpm -q httpd
package httpd is not installed
```

`rpm -e` 执行成功时没有任何输出（Linux 命令"没消息就是好消息"）；再次 `rpm -q` 提示 `package httpd is not installed`，即卸载成功的标准凭据。

### 步骤 3：遇到依赖报错怎么办（预期输出，CentOS 7）
{: .sec-ts}

如果 httpd 正被其他包依赖，`rpm -e` 会拒绝执行并列出依赖链：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# rpm -e httpd
error: Failed dependencies:
	httpd-mmn = 20120211x8664 is needed by (installed) mod_ssl-1:2.4.6-97.el7.centos.x86_64
```

两种处理方式，优先顺序从高到低：

**方式一：yum remove（推荐）**。yum 是 rpm 之上的仓库管理层，能自动分析依赖关系，把"必须一起卸的包"一次性列清楚再执行：

```bash
yum remove httpd -y
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# yum remove httpd -y
Loaded plugins: fastestmirror
Resolving Dependencies
--> Running transaction check
---> Package httpd.x86_64 0:2.4.6-97.el7.centos will be erased
--> Finished Dependency Resolution

Dependencies Resolved

================================================================================
 Package        Arch            Version                     Repository     Size
================================================================================
Removing:
 httpd          x86_64          2.4.6-97.el7.centos         @base          10 M
Removing for dependencies:
 httpd-tools    x86_64          2.4.6-97.el7.centos         @base          1.1 M
 mod_ssl        x86_64          1:2.4.6-97.el7.centos       @base          211 k

Transaction Summary
================================================================================
Remove  1 Package (+2 Dependent packages)

Installed size: 10 M
Downloading packages:
Running transaction check
Running transaction test
Transaction test succeeded
Running transaction
  Erasing    : mod_ssl-1:2.4.6-97.el7.centos.x86_64                       1/3
  Erasing    : httpd-tools-2.4.6-97.el7.centos.x86_64                      2/3
  Erasing    : httpd-2.4.6-97.el7.centos.x86_64                            3/3
  Verifying   : httpd-2.4.6-97.el7.centos.x86_64                            1/3
  Verifying   : httpd-tools-2.4.6-97.el7.centos.x86_64                      2/3
  Verifying   : mod_ssl-1:2.4.6-97.el7.centos.x86_64                        3/3

Removed:
  httpd.x86_64 0:2.4.6-97.el7.centos

Complete!
```

关键看两行：`Removing for dependencies` 列出了会被连带卸载的包；`Transaction Summary` 的 `Remove 1 Package (+2 Dependent packages)` 给出总账。**卸之前先读这两处**，确认连带卸掉的包不会影响业务。

**方式二：rpm -e --nodeps（兜底，慎用）**。忽略依赖关系强制卸载：

```bash
rpm -e --nodeps httpd
```

`--nodeps` 是双刃剑：它能卸掉"卸不掉的钉子户"，但被依赖它的程序会立刻崩溃——比如上面的例子里 mod_ssl 还登记在案，它的文件却已被删掉，`rpm -V mod_ssl` 会报出一大片 `missing`，httpd 相关服务直接起不来，想修复只能重装。使用前必须已经用 `rpm -q --whatrequires` 确认过后果，只在"这个包就是要彻底弄掉、连带损坏也能接受"时使用。

### 辨析：yum 与 rpm 的依赖关系本质
{: .sec-know}

rpm 数据库（`/var/lib/rpm`）只登记"每个包自己声明需要谁"，不做全局决策——所以 `rpm -e` 一看有包依赖目标就拒绝，却给不出解决方案。yum 在 rpm 之上加了一层依赖求解器：装或卸之前先读所有仓库元数据，把"装 A 要拉 B、卸 C 会拖下 D"整笔账算完再动手。一句话：rpm 是执行者，yum 是带着账本算清再让 rpm 干活的管理者。

这也是"yum 装的用 yum 卸、rpm 装的用 rpm 卸"的原因——两边操作的是同一个 rpm 数据库，但 yum 会顺带维护自己的事务历史（`yum history`）与缓存，混着卸容易留下账目对不上的状态。

### 步骤 4：卸载后清理残留（预期输出，CentOS 7）
{: .sec-prac}

rpm 只删除自己登记的文件，软件运行过程中生成的配置与数据目录常常留在系统里：

```bash
rpm -qc httpd 2>/dev/null        # 卸载前先列出它产生的配置文件（先记下来再卸）
ls /etc/httpd                    # 卸载后检查残留目录
rm -rf /etc/httpd                # 确认无保留价值后手动清理
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# ls /etc/httpd
conf  conf.d  conf.modules.d  logs  modules  run
[root@linux-node1 ~]# rm -rf /etc/httpd
```

**验证方法**：

1. `rpm -q 包名` 输出 `package xxx is not installed`，这是卸载成功的直接证据；
2. `rpm -qa | grep 关键词` 里不再出现该包及其附属包；
3. 原命令执行不了（`httpd -v` 报 `command not found` 或 `which httpd` 无输出），证明可执行文件已删；
4. `ls /etc/软件目录` 确认配置残留已清理；
5. 若用了 `--nodeps`，补一次 `rpm -V 被依赖包名` 检查有没有拖累其他包。

> **易错点**：① 卸载写**包名**不是 rpm 文件名——`rpm -e httpd-2.4.6-97.el7.centos.x86_64.rpm` 是错的，正确写法是 `rpm -e httpd`（包名可省略版本号与架构，rpm 会唯一匹配）；② 看到 `error: Failed dependencies` 不要条件反射加 `--nodeps`，先用 `rpm -q --whatrequires` 看清谁在依赖，再决定用 `yum remove` 还是强制卸；③ `yum remove` 会连带卸掉依赖包，业务机器上先读 `Transaction Summary` 再回车；④ 配置与数据目录 rpm 不管，卸完记得手动检查清理；⑤ 通过 yum 装的包用 `yum remove` 卸、通过 rpm 装的包用 `rpm -e` 卸，混用容易留下"数据库里有记录、文件已删除"的不一致状态。

> **参见**：软件安装与硬件信息查看

## 题 2：总结第一个阶段课程知识
{: .sec-sum}

**题目原文**：总结第一个阶段课程知识。

**考察点**：把第一阶段的知识按"硬件 → 系统安装 → 常用命令 → 目录结构 → 系统优化"串成一条链路，做到每个知识点能说出"是什么、用什么命令、一句话原理"。

**实现思路**：先画全链路知识地图搭框架，五个阶段各整理一张表（核心知识点、关键命令、一句话原理），最后用一组链路小实验把分散在各阶段的命令（建目录、写文件、管道统计、打包）真跑一遍，总结落到真实输出上才算数。

### 知识地图
{: .sec-sum}

```text
第一阶段（day1 - day10）
├── 硬件基础（day1 - day2）
│   ├── 服务器组成：电源（冗余）/ CPU（路数与核数）/ 内存 / 磁盘 / 风扇
│   ├── 缓冲（写暂存）与缓存（读暂存）的区别
│   └── RAID 阵列卡：容量更大、更安全、效率更高（raid0 / raid1）
├── 系统安装（day2 - day3）
│   ├── 分区方案（标准分区 / LVM / RAID）与 RAID 卡配置
│   ├── 网络配置：IP / 网关 / DNS / 主机名
│   └── 排错模式重置 root 密码（init=/bin/bash）
├── 常用命令（day4 - day5）
│   ├── 文件操作：ls / cp / mv / rm / touch / cat / head / tail / echo / vi
│   ├── 数据流向：重定向（> >> 2> <）、管道（|）、逻辑符（&& ;）
│   └── 权限基础：chmod / chown / umask（文件 644、目录 755）
├── 目录结构（day5 - day6）
│   ├── FHS 标准：/etc 配置、/var 日志、/home 家目录、/proc 内存数据
│   ├── 挂载：mount / umount / /etc/fstab 六列
│   └── 运行级别与重要系统文件（/etc/issue / /etc/motd / /etc/profile）
└── 系统优化（day8 - day10）
    ├── 提示符优化：PS1 转义符与颜色（\[\e[F;Bm\]）
    ├── yum 源优化：基础源 + EPEL 扩展源
    ├── 安全服务：防火墙与 SELinux 的临时 / 永久关闭
    ├── 字符集与 SSH 连接加速
    └── 软件安装三种方式：yum（外卖）/ rpm（半成品）/ 编译（自己做饭）
```

### 分阶段速查表
{: .sec-chk}

**阶段一：硬件基础**

| 知识点 | 关键命令 / 手段 | 一句话原理 |
| --- | --- | --- |
| CPU 信息 | `lscpu`、`cat /proc/cpuinfo` | 颗数看 `physical id`，每颗核数看 `cpu cores`，逻辑核看 `processor` |
| 内存 | `free -h`、`cat /proc/meminfo` | 缓冲是写暂存、缓存是读暂存；判断够不够看 `available` 列 |
| 磁盘 | `df -h`、`lsblk`、`fdisk -l` | 磁盘是永久存储；接口性能 SAS > SCSI > SATA |
| 负载 | `w`、`cat /proc/loadavg` | 负载包含等磁盘 IO 的进程，要结合 CPU 核数判断 |
| RAID | 开机进 RAID 卡配置界面 | 作用有三：扩容量、保安全、提效率 |

**阶段二：系统安装**

| 知识点 | 关键命令 / 手段 | 一句话原理 |
| --- | --- | --- |
| 分区方案 | `fdisk` / `parted` | 三种方案：标准分区、LVM、RAID |
| 网络配置 | `vi /etc/sysconfig/network-scripts/ifcfg-eth0`、`hostnamectl` | IP / 网关 / DNS / 主机名四要素 |
| 排错重置密码 | 开机启动项加 `init=/bin/bash` | 物理可达即 root 可达，生产环境要加 GRUB 密码 |

**阶段三：常用命令**

| 知识点 | 关键命令 | 一句话原理 |
| --- | --- | --- |
| 文件操作 | `ls -l`、`cp -r`、`mv`、`rm -rf`、`touch`、`cat -n`、`tail -f` | 查看 / 复制 / 移动 / 删除 / 创建 / 查看 / 追踪 |
| 数据流向 | `>`、`>>`、`2>`、`<`、`|`、`&&`、`;` | 重定向管去向，管道管传递，逻辑符管条件 |
| 权限 | `chmod 755`、`chown`、`umask` | 文件更关注 r，目录更关注 x；默认权限 644 / 755 |
| 效率工具 | `Tab`、`history`、`Ctrl + r`、`alias` | 补全、历史、别名是命令行三大加速器 |

**阶段四：目录结构**

| 知识点 | 关键命令 | 一句话原理 |
| --- | --- | --- |
| FHS 目录职责 | `ls -d /etc /var /home /proc` | 看到路径就知道该不该动：`/etc` 配置不动、`/var` 日志轮转 |
| 挂载 | `mount`、`umount`、`vi /etc/fstab` | 目录是设备的入口；fstab 六列实现开机自动挂载 |
| 运行级别 | `systemctl get-default`、`systemctl isolate multi-user.target` | CentOS 7 用 target 替代 0-6 级别 |
| 系统文件 | `/etc/issue`、`/etc/motd`、`/etc/profile` | 登录前提示、登录后提示、全局环境配置 |

**阶段五：系统优化与软件安装**

| 知识点 | 关键命令 | 一句话原理 |
| --- | --- | --- |
| 提示符优化 | `echo $PS1`、`export PS1='\[\e[31;1m\]\u\[\e[0m\]...'` | `\u` 用户、`\h` 主机、`\W` 目录；颜色用 `\[\e[F;Bm\]` 包裹 |
| yum 源优化 | `curl -o CentOS-Base.repo ...`、`yum repolist` | 基础源 + 扩展源，统一下载环境 |
| 安全服务 | `systemctl stop/disable firewalld`、`setenforce 0` | 防火墙与 SELinux 的临时 / 永久两套做法 |
| 字符集 | `echo $LANG`、`localectl set-locale` | 乱码三查：系统、客户端、文件编码 |
| 软件安装 | `yum install`、`rpm -ivh`、`rpm -e` | 外卖 / 半成品 / 自己做饭；rpm 不解决依赖 |
| SSH 加速 | `GSSAPIAuthentication no`、`UseDNS no` | 关掉两次多余等待，登录秒进 |

### 链路小实验（已实操）
{: .sec-prac}

总结不能只停在纸上。下面这组命令把第三阶段（文件操作、管道）、第四阶段（目录）、第五阶段（打包）的知识串成一条链，在 Git Bash 里真实执行：

```bash
mkdir -p /tmp/hw/day10 && cd /tmp/hw/day10
mkdir -p stage1_demo && cd stage1_demo
for i in 1 2 3; do echo "data-line-$i" > "file$i.txt"; done    # 循环创建文件
ls -l                                                          # 查看文件属性
cat file*.txt | wc -l                                          # 管道 + 通配符统计总行数
grep -c line file*.txt                                         # 过滤统计每个文件的行数
tar czf stage1.tar.gz file*.txt                                # 打包压缩
ls -lh stage1.tar.gz                                           # 查看产物大小
du -sh stage1.tar.gz                                           # 统计实际占用
```

输出：

```console
$ ls -l
total 3
-rw-r--r-- 1 user 197609 12 Oct 24 03:35 file1.txt
-rw-r--r-- 1 user 197609 12 Oct 24 03:35 file2.txt
-rw-r--r-- 1 user 197609 12 Oct 24 03:35 file3.txt
$ cat file*.txt | wc -l
3
$ grep -c line file*.txt
file1.txt:1
file2.txt:1
file3.txt:1
$ ls -lh stage1.tar.gz
-rw-r--r-- 1 user 197609 162 Oct 24 03:35 stage1.tar.gz
$ du -sh stage1.tar.gz
1.0K	stage1.tar.gz
```

对照知识地图看这条链：`mkdir` 建目录（阶段四）→ `for` + `echo >` 循环建文件（阶段三）→ `ls -l` 看属性（阶段三）→ `cat | wc -l` 管道统计（阶段三）→ `grep -c` 过滤统计（阶段三）→ `tar czf` 打包（阶段五备份常用）→ `ls -lh` / `du -sh` 看大小（阶段一磁盘视角）。一条命令链就是半张知识地图。

### 补充示例：文件属性与统计分析（已实操）
{: .sec-ext}

```bash
stat stage1_demo/file1.txt | sed -n '1,2p;4,7p'    # 查看文件属性（含三个时间）
printf '%s\n' apple banana apple cherry banana apple > fruit.txt
sort fruit.txt | uniq -c                       # 排序后统计每项出现次数
sort fruit.txt | uniq -c | sort -rn            # 再按次数降序排列
```

输出：

```console
$ stat stage1_demo/file1.txt | sed -n '1,2p;4,7p'
  File: stage1_demo/file1.txt
  Size: 12        	Blocks: 1          IO Block: 65536  regular file
Access: (0644/-rw-r--r--)  Uid: (197609/   user)   Gid: (197609/ UNKNOWN)
Access: 2026-10-24 03:39:15.316304400 +0800
Modify: 2026-10-24 03:35:10.219557400 +0800
Change: 2026-10-24 03:35:10.219557400 +0800
$ sort fruit.txt | uniq -c
      3 apple
      2 banana
      1 cherry
$ sort fruit.txt | uniq -c | sort -rn
      3 apple
      2 banana
      1 cherry
```

`stat` 一次给出文件的三个时间：`Access`（访问时间，受 `noatime` 挂载参数影响）、`Modify`（内容修改时间）、`Change`（属性/inode 变更时间）——排错时判断"文件到底动没动"就靠它们。`sort | uniq -c | sort -rn` 是经典的统计排名组合，课程后面分析日志（如统计访问最多的页面）用的就是这条链。

**验证方法**：

1. 链路小实验的每条输出都与命令语义对应（`cat file*.txt | wc -l` 得 3，三个文件每个 1 行），证明命令链理解正确；
2. 能合上书画出知识地图的五个阶段，并每个阶段说出至少三个知识点与对应命令；
3. 对任一命令能回答"它在链路哪一环、解决什么问题"——例如被问 `umask`，能答出"决定新建文件 644、目录 755 的那道减法"。

> **易错点**：① 总结最容易写成"命令清单"——没有链路的清单记忆效率极低，务必用"硬件 → 安装 → 命令 → 目录 → 优化"的因果链串起来；② 缓冲与缓存、物理核与逻辑核、`Modify` 与 `Change` 这三对概念最易混淆，总结时重点标注；③ 命令总结要带参数（`ls -l` 不是 `ls`），只记命令名等于没记。

> **参见**：计算机硬件组成、系统安装部署、常用文件操作命令、系统目录结构与挂载、软件安装与硬件信息查看

## 题 3：进行一天课程内容复述

**题目原文**：进行一天课程内容复述，录音。

**考察点**：能否把一天的知识点脱稿讲明白——讲得出才是真学会，这是检验掌握程度的终极标准。

**实现思路**：复述是一项"说"的作业，文档里无法执行，转化为可直接照讲的复述提纲：先给复述方法与价值，再给 10 分钟版的讲述流程（时间分配 + 每环节必讲点），最后给卡点预案与自检清单。

### 复述的方法与价值

1. **判断掌握的三条标准**：作用清楚、操作熟练、原理可以绘图；
2. **终极标准**：能给不清楚的人讲明白——复述就是模拟这一步；
3. **正确步骤**：先列提纲（把知识点连成线）→ 掐表试讲 → 录音回放 → 对照清单查漏 → 重讲卡壳段。

### 复述提纲（10 分钟版）

| 时段 | 环节 | 必须讲到的点 |
| --- | --- | --- |
| 00:00 - 00:30 | 开场 | 今天主题：软件卸载 + 第一阶段总结，一句话点题 |
| 00:30 - 02:30 | rpm 查询 | `rpm -q` / `-qa` / `-qi` / `-ql` / `-qf` 各自场景；卸载前用 `--whatrequires` 安检 |
| 02:30 - 04:30 | rpm 卸载 | `rpm -e 包名`（包名不是文件名）；`Failed dependencies` 的处理：`yum remove` 优先、`--nodeps` 兜底及风险 |
| 04:30 - 06:30 | 第一阶段回顾 | 硬件 → 安装 → 命令 → 目录 → 优化，每段讲 2-3 个代表点 |
| 06:30 - 08:00 | 批量创建用户 | `for i in $(seq -w 1 50)` 生成序列；`useradd` + `chpasswd`；`id` / `wc -l` 验证 |
| 08:00 - 09:30 | yum 安装流程 | 查源 → 搜索 → 安装 → 验证；EPEL 扩展源；排错四步 |
| 09:30 - 10:00 | 收尾 | 挑三个今天最容易踩的坑回顾，收束全场 |

### 各环节要点清单（讲不出就回去翻笔记）
{: .sec-chk}

**rpm 查询与卸载**

- 查询四件套：`-q` 单包、`-qa` 全部、`-qi` 详情、`-ql` 文件清单、`-qf` 反查文件归属；
- 卸载写包名不写文件名；成功无输出，用 `rpm -q` 验证 `is not installed`；
- 依赖报错的两种解法与取舍：`yum remove` 自动处理（推荐）、`--nodeps` 强制卸载（慎用）；
- 卸完检查配置残留（`/etc/软件目录`）。

**第一阶段知识回顾（每段选 2-3 个点）**

- 硬件：CPU 颗数看 `physical id`；内存够不够看 `available`；RAID 三作用；
- 安装：分区三方案；网络四要素；排错模式重置密码的原理与隐患；
- 命令：文件操作一套；重定向与管道；权限 644 / 755 的由来（umask）；
- 目录：`/etc` / `/var` / `/home` / `/proc` 分工；fstab 六列；
- 优化：PS1 颜色公式；yum 双源；防火墙与 SELinux 的临时 / 永久两套做法。

**批量创建用户**

- 核心结构：`for i in $(seq -w 1 50); do useradd user$i; echo "user$i:密码" | chpasswd; done`；
- `seq -w` 等宽补零的意义（user01 排序稳定）；
- 验证三连：`id user01`、`grep -c '^user' /etc/passwd`、`wc -l /etc/passwd`（前后差值 = 50）；
- 安全细节：初始密码用占位符、`chage -d 0` 强制首登改密、练手完 `userdel -r` 清理。

**yum 安装流程**

- 六步：`yum repolist` 确认源 → `yum search` 搜包 → `yum info` 看版本 → `yum install -y` 安装 → `rpm -q` / `which` 验证 → `yum remove` 卸载；
- EPEL 提供官方源没有的软件（cowsay、htop 等）；
- 排错顺序：外网通不通（IP / DNS）→ 有没有残留 yum 进程 → 源文件是否被动过 → `yum clean all && yum makecache` 清缓存重建。

### 卡点预案

- 讲 rpm 与 yum 的区别卡住：用"外卖（rpm 单点手工）与应用商店（yum 自动装依赖）"类比，一句话就能捡回来；
- 讲依赖关系卡住：画一栋楼，拆一楼（被依赖的包）会让楼上（依赖它的包）塌；
- 时间不够：保"rpm 卸载流程"和"批量建户"两个主干，阶段回顾每段只讲一个点；
- 冷场开头：直接从"昨天留的问题——装好的软件怎么卸干净？"切入，带着问题讲。

**验证方法**：录音回放，对照要点清单逐项打勾；标准是——脱稿讲满 10 分钟、五个环节无长时间空白、每个命令都能说清作用、被追问"为什么"时能用一句话原理接住。全部满足，说明这一天真的学会了。

## 扩展题 1：批量创建用户（一次创建 50 个）
{: .sec-ext}

**题目原文**：如何批量创建多个用户（例如一次创建 50 个用户 user01 到 user50）。

**考察点**：`for` 循环与 `seq` 序列生成、`useradd` 建号、`chpasswd` 批量设密、`chage -d 0` 强制首登改密、批量验证与批量清理。

**实现思路**：拆成五步——生成用户名序列 → 循环创建 → 批量设密 → 批量验证 → 批量清理。序列生成与随机串在 Git Bash 真跑（A 级）；涉及系统账号的命令给出 CentOS 7 标准脚本与预期输出（B 级）；验证用"创建前后 `/etc/passwd` 行数差 = 50"这个可靠标准。

### 步骤 1：生成用户名序列（已实操）
{: .sec-prac}

批量建户的第一步是解决"用户名从哪来"——用 `seq -w` 生成等宽序列：

```bash
seq -w 1 50 | head -3                  # -w 等宽补零：01 02 03（补零让排序稳定）
seq -w 1 50 | tail -2
seq -w 1 50 | wc -l                    # 序列总数 = 50
for i in $(seq -w 1 50); do echo "user$i"; done | head -3    # 拼出目标用户名
```

输出：

```console
$ seq -w 1 50 | head -3
01
02
03
$ seq -w 1 50 | tail -2
49
50
$ seq -w 1 50 | wc -l
50
$ for i in $(seq -w 1 50); do echo "user$i"; done | head -3
user01
user02
user03
```

`seq -w 1 50` 生成 `01` 到 `50` 的等宽数字——不加 `-w` 会得到 1 到 50，`user1` 到 `user50` 长短不齐，`ls /home` 时排序混乱。`$(...)` 命令替换把序列交给 `for` 循环逐个处理，这是批量操作的标准结构。别小看这个参数，忘了它的人不少。

### 步骤 2：批量创建与设密的完整脚本（预期输出，CentOS 7）
{: .sec-prac}

```bash
cat > /tmp/batch_users.sh <<'EOF'
#!/bin/bash
# 批量创建 50 个用户并设置初始密码
for i in $(seq -w 1 50); do
    useradd "user$i"                          # 创建用户（默认建家目录、shell 为 /bin/bash）
    echo "user$i:<your-password>" | chpasswd  # 批量设置初始密码
    chage -d 0 "user$i"                       # 强制首次登录时修改密码
done
EOF
bash /tmp/batch_users.sh
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# bash /tmp/batch_users.sh
[root@linux-node1 ~]#
```

三个要点：

1. `useradd` 只建账号不设密码，不设密码的用户处于锁定状态，无法登录——所以必须配 `chpasswd`；
2. `chpasswd` 从标准输入读 `用户名:密码` 对，是批量设密最快的方式（比逐条 `passwd` 交互高效得多）；
3. `chage -d 0` 把"上次改密时间"置零，用户首次登录会被强制要求改密码——初始密码只是临时的，不长期有效，这是企业交付账号的标准做法。

脚本中的密码一律用 `<your-password>` 占位符，不要把真实密码写进脚本和笔记。

**随机密码变体**。如果希望每个用户初始密码不同，用 `$RANDOM` 生成随机串。先看随机串的生成效果（已实操）：

```bash
echo "$RANDOM" | md5sum | cut -c 1-8
for i in 01 02 03; do echo "user$i:$(echo "$RANDOM$(date +%s)" | md5sum | cut -c 1-8)"; done
```

输出：

```console
$ echo "$RANDOM" | md5sum | cut -c 1-8
02772e80
$ for i in 01 02 03; do echo "user$i:$(echo "$RANDOM$(date +%s)" | md5sum | cut -c 1-8)"; done
user01:9ce2f5b4
user02:220341ba
user03:13551199
```

`$RANDOM` 是 bash 内置的随机数变量（每次取值不同，属于正常现象），经 `md5sum` 散列后用 `cut -c 1-8` 截取 8 位，就是一段可用的随机密码。落到真机脚本里（B 级）：

```bash
for i in $(seq -w 1 50); do
    useradd "user$i"
    echo "user$i:$(echo "$RANDOM$(date +%s)" | md5sum | cut -c 1-8)" | chpasswd
    chage -d 0 "user$i"
done
```

> **注意：** 随机密码发出去之前要先落盘（如 `> /tmp/user_passwords.txt` 并设 600 权限）再分发给用户，否则随机生成后没人知道密码，只能逐条重置。生产环境更推荐密钥认证或对接统一身份源，而不是维护一张密码表。
{: .sec-pit}

### 步骤 3：创建前先体检（预期输出，CentOS 7）
{: .sec-prac}

动手前先记录基线，防止重复执行脚本时重名冲突，也方便最后算账：

```bash
wc -l /etc/passwd                        # 记录创建前的总行数
grep -c '^user' /etc/passwd              # 记录创建前已有多少个 user 开头的账号
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# wc -l /etc/passwd
39 /etc/passwd
[root@linux-node1 ~]# grep -c '^user' /etc/passwd
0
```

如果 `grep -c` 不为 0，说明已有 user 开头的账号，先确认编号是否重叠再执行，否则 `useradd` 会报 `user user01 already exists`。

### 步骤 4：批量验证（预期输出，CentOS 7）
{: .sec-ver}

```bash
id user01                                # 单用户验证：uid / gid / 所属组
passwd -S user01                         # 密码状态：PS 表示已设置
grep -c '^user' /etc/passwd              # 批量验证：应等于 50
wc -l /etc/passwd                        # 总行数：与创建前的差值应等于 50
tail -3 /etc/passwd                      # 抽查最后几个用户的条目格式
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# id user01
uid=1001(user01) gid=1001(user01) groups=1001(user01)
[root@linux-node1 ~]# passwd -S user01
user01 PS 2026-10-24 0 99999 7 -1 (Password set, SHA512 crypt.)
[root@linux-node1 ~]# grep -c '^user' /etc/passwd
50
[root@linux-node1 ~]# wc -l /etc/passwd
89 /etc/passwd
[root@linux-node1 ~]# tail -3 /etc/passwd
user48:x:1048:1048::/home/user48:/bin/bash
user49:x:1049:1049::/home/user49:/bin/bash
user50:x:1050:1050::/home/user50:/bin/bash
```

四条输出各验证一个侧面：`id` 证明账号真实存在且信息正确；`passwd -S` 的 `PS`（Password set）证明密码已设置、可登录；`grep -c` 等于 50 证明数量齐了；`tail` 证明条目格式正确（用户名:密码占位 x:uid:gid:注释:家目录:shell）。创建前的行数因系统而异（最小化安装约 39 行），**只要"创建后减创建前的差值 = 50"即为正确**，不必纠结绝对值。

### 步骤 5：批量清理（预期输出，CentOS 7）
{: .sec-prac}

练手完毕把账号和家目录一起清掉，保持系统干净：

```bash
for i in $(seq -w 1 50); do userdel -r "user$i"; done
grep -c '^user' /etc/passwd              # 验证：应回到 0
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# for i in $(seq -w 1 50); do userdel -r "user$i"; done
[root@linux-node1 ~]# grep -c '^user' /etc/passwd
0
```

`-r` 表示连同家目录一起删除；不加 `-r` 只删账号、家目录留在 `/home` 下。

> **生产注意**：批量建户脚本上线前先在测试机跑一遍，`seq` 序列与已有账号对过号再执行。批量操作没有逐条确认的机会，出问题回退成本很高。

**验证方法**：

1. `id user01` 能正确输出 uid / gid / groups，证明账号创建成功；
2. `grep -c '^user' /etc/passwd` 等于 50，且 `wc -l /etc/passwd` 前后差值等于 50，数量验证通过；
3. `passwd -S user01` 显示 `PS`（密码已设置），配合 `chage -l user01` 能看到"必须改密"标记；
4. 序列生成（已实操）：`seq -w 1 50 | wc -l` 输出 50、`head` / `tail` 首尾正确，证明序列无误后再跑建户脚本；
5. 清理后 `grep -c '^user' /etc/passwd` 回到 0，证明批量删除也成功。

> **易错点**：① 整个过程需要 root 权限，普通用户执行会报 `Permission denied`；② `useradd` 建完不设密码，账号是锁的，登不进去——`useradd` 与 `chpasswd` 必须成对出现；③ `chpasswd` 的输入格式是 `用户名:密码`，中间不能有空格，密码里若有 `:` 会被截断；④ 脚本重复执行会因用户已存在报错，重跑前先清理，或给 `useradd` 加存在性判断；⑤ 建的是"能登录的普通用户"；若要建不能登录的虚拟用户，参数是 `useradd -M -s /sbin/nologin`；⑥ `-w` 别忘——不补零的 user1 到 user50 长短不齐，排序和观感都差。

> **参见**：用户管理

## 扩展题 2：yum 安装软件的标准流程
{: .sec-best}

**题目原文**：yum 安装软件的流程（预习内容的实操整理）。

**考察点**：yum 安装六步标准流程、EPEL 扩展源的作用、安装失败的排查思路。

**实现思路**：给一张六步流程表，每步配命令与预期输出；补充 EPEL 扩展源与本地源两种场景；最后给一棵排错决策树，把"装不上"的常见原因一次理清。

### 标准六步流程（预期输出，CentOS 7）
{: .sec-best}

| 步骤 | 命令 | 目的 |
| --- | --- | --- |
| 1. 确认源 | `yum repolist` | 源可用、包数量正常 |
| 2. 搜索软件 | `yum search 关键词` | 确认准确的包名 |
| 3. 查看信息 | `yum info 包名` | 看版本、架构、来自哪个仓库 |
| 4. 安装 | `yum install -y 包名` | 自动解决依赖并安装 |
| 5. 验证 | `rpm -q 包名`、`which 命令` | 包已安装、命令可用 |
| 6. 卸载 | `yum remove 包名` | 不需要时干净移除 |

逐步演示：

```bash
yum repolist                    # 第一步：确认源可用
yum search cowsay               # 第二步：搜包（确认包名与所属仓库）
yum info cowsay                 # 第三步：看版本与来源
yum install -y cowsay           # 第四步：安装（-y 免交互确认）
rpm -q cowsay                   # 第五步：验证安装
which cowsay                    # 验证命令位置
yum remove -y cowsay            # 第六步：卸载
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# yum repolist
Loaded plugins: fastestmirror
Determining fastest mirrors
 * base: mirrors.aliyun.com
 * extras: mirrors.aliyun.com
 * updates: mirrors.aliyun.com
repo id      repo name                                       status
base         CentOS-7 - Base                                  10,072
extras       CentOS-7 - Extras                                   500
updates      CentOS-7 - Updates                                3,124
repolist: 13,696

[root@linux-node1 ~]# yum search cowsay
Loaded plugins: fastestmirror
================================================ N/S matched: cowsay =================================================
cowsay.noarch : Configurable talking cow

  Name and summary matches only, use "search all" for everything.

[root@linux-node1 ~]# yum install -y cowsay
Loaded plugins: fastestmirror
Resolving Dependencies
--> Running transaction check
---> Package cowsay.noarch 0:3.03-13.el7 will be installed
--> Finished Dependency Resolution

Dependencies Resolved

================================================================================
 Package                Arch                Version                     Repository      Size
================================================================================
Installing:
 cowsay                 noarch              3.03-13.el7                 epel             18 k

Transaction Summary
================================================================================
Install  1 Package

Total download size: 18 k
Installed size: 41 k
Downloading packages:
cowsay-3.03-13.el7.noarch.rpm                                        |  18 kB  00:00:00
Running transaction check
Running transaction test
Transaction test succeeded
Running transaction
  Installing    : cowsay-3.03-13.el7.noarch                                                1/1
  Verifying     : cowsay-3.03-13.el7.noarch                                                1/1

Installed:
  cowsay.noarch 0:3.03-13.el7

Complete!
[root@linux-node1 ~]# rpm -q cowsay
cowsay-3.03-13.el7.noarch
[root@linux-node1 ~]# which cowsay
/usr/bin/cowsay
```

注意 `yum search` 的结果里 `cowsay` 来自 epel 仓库——官方 base / extras / updates 源里没有它，这就是下一步要讲的 EPEL。

### EPEL 扩展源与本地源
{: .sec-ext}

EPEL（Extra Packages for Enterprise Linux）由 Fedora 社区维护，提供大量企业版官方源里没有的软件（`cowsay`、`htop`、`sl`、`ncdu` 等）：

顺带说下换源这件事为什么排第一步：默认源在海外，国内访问经常慢甚至超时；国内镜像站（阿里云、清华等）与官方源实时同步，内容一致但速度快得多。装机先换源，后面每次 `yum install` 都省时间。

```bash
yum install -y epel-release                    # 一条命令装上扩展源
yum install -y sl cowsay                       # 之后即可安装扩展源软件
```

服务器不能上外网时，把安装光盘做成本地 yum 源：

```bash
mount /dev/cdrom /mnt                           # 挂载光盘
vi /etc/yum.repos.d/local.repo                  # 新建本地源配置
```

```ini
[local]
name=CentOS Local
baseurl=file:///mnt
enabled=1
gpgcheck=0
```

```bash
yum clean all && yum makecache                  # 清缓存并重建元数据
yum install -y nginx                            # 之后正常使用
```

### 排错决策树（预期输出，CentOS 7）
{: .sec-ts}

`yum install` 失败时按这棵树逐项排查：

```text
yum install 报错
├── No package xxx available（找不到包）
│   ├── 包在 EPEL 源？→ yum install -y epel-release
│   └── 元数据过期？→ yum clean all && yum makecache
├── 网络错误 / timeout / Cannot find a valid baseurl
│   ├── ping 外网 IP 不通 → 网卡地址 / 网关配置有问题
│   └── ping 外网域名不通 → DNS 配置有问题（查 /etc/resolv.conf）
├── Another app is currently holding the yum lock
│   └── 上次 yum 进程没退干净：
│       ps -ef | grep yum → kill -9 残留 PID → rm -f /var/run/yum.pid
└── 源文件被改坏
    └── 检查 /etc/yum.repos.d/ 下的 .repo 文件，必要时重新下载源文件
```

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# ps -ef | grep yum
root      12345  12344  0 10:30 pts/0    00:00:00 yum install -y nginx
root      12400  12398  0 10:31 pts/1    00:00:00 grep --color=auto yum
[root@linux-node1 ~]# kill -9 12345
[root@linux-node1 ~]# rm -f /var/run/yum.pid
[root@linux-node1 ~]# yum clean all && yum makecache
```

**验证方法**：

1. `rpm -q 包名` 有版本号输出、`which 命令` 能找到可执行文件，证明安装成功；
2. 直接运行安装的命令（如 `cowsay hello`）能看到预期行为；
3. `yum repolist` 能看到目标仓库且包数量正常（base 约一万个包），证明源配置无误；
4. 卸载后 `rpm -q 包名` 提示 `is not installed`，证明移除干净。

> **易错点**：① `yum search` 搜不到不等于软件不存在，很可能在 EPEL 源；② `yum install` 不加 `-y` 会在安装前停下来交互确认，脚本里必须加 `-y`；③ yum 有锁机制，同时跑两个 yum 会报 `Another app is currently holding the yum lock`，不要强制删锁了事，先确认真没有 yum 在跑；④ 改完源文件不生效，先 `yum clean all && yum makecache` 清缓存重建元数据，再怀疑别的；⑤ 生产服务器卸载软件前同样先用 `rpm -q --whatrequires` 确认没有业务依赖。

> **参见**：软件安装与硬件信息查看

## 自测
{: .sec-prac}

1. `rpm -e` 卸载时报 `error: Failed dependencies`，有哪两种处理方式？推荐哪种，为什么？
2. 卸载前为什么要先执行 `rpm -q --whatrequires 包名`？它输出为空说明什么？
3. 写出批量创建 50 个用户 user01 到 user50 的核心命令，并说明 `seq -w` 中 `-w` 的作用。
4. 批量建户后，用哪三条命令验证"数量对、账号在、密码已设"？
5. `yum install` 报 `No package cowsay available`，按排错决策树该怎么查？

> **参考答案：** 1. 两种方式：`yum remove 包名`（自动分析并连带卸载依赖包，推荐）与 `rpm -e --nodeps 包名`（忽略依赖强制卸载，兜底）。推荐前者，因为 rpm 本身不认识依赖关系，强制卸会把依赖它的包拖成"登记在册但文件缺失"的半坏状态。2. 目的是在卸载前确认有没有别的包依赖它；输出为空说明没有任何包依赖它，可以安全卸载。3. `for i in $(seq -w 1 50); do useradd "user$i"; echo "user$i:<your-password>" | chpasswd; done`；`-w` 是等宽补零，生成 01 到 50 而不是 1 到 50，保证用户名长度一致、排序稳定。4. `id user01`（账号在）、`grep -c '^user' /etc/passwd` 等于 50 且 `wc -l /etc/passwd` 前后差值等于 50（数量对）、`passwd -S user01` 显示 `PS`（密码已设）。5. 先确认 cowsay 是否在 EPEL 扩展源（`yum install -y epel-release` 后重试）；若已装 EPEL 仍找不到，执行 `yum clean all && yum makecache` 清缓存重建元数据；再不行检查 `/etc/yum.repos.d/` 下的源文件是否被改坏。

## 本篇小结
{: .sec-sum}

五道题过完，留下这几条主干：

1. rpm 卸载四步：先查（`rpm -q` / `-qa` / `--whatrequires`）→ 再卸（`rpm -e 包名`，写包名不写文件名）→ 后验证（`package xxx is not installed`）→ 清理残留（`/etc` 下的配置与数据目录 rpm 不管）。
2. 依赖报错的处理优先级：`yum remove`（自动解决，推荐，卸前先读 Transaction Summary）> `rpm -e --nodeps`（强制卸载，会拖垮依赖它的包，慎用）。
3. 第一阶段知识按五段链路记忆：硬件（看 available、physical id）→ 安装（分区、网络四要素）→ 命令（文件操作、重定向管道、umask）→ 目录（FHS 分工、fstab 六列）→ 优化（PS1 颜色公式、yum 双源、安全服务、软件三方式）。
4. 批量建户的标准结构：`for i in $(seq -w 1 50)` 生成等宽序列，循环内 `useradd` + `chpasswd` + `chage -d 0`；验证用 `id user01`、`grep -c '^user' /etc/passwd`、`wc -l /etc/passwd`（前后差值 = 50）；练手完 `userdel -r` 清理。
5. 随机密码思路：`$RANDOM` 经 `md5sum` 散列后 `cut -c 1-8` 截取；随机密码要先落盘再分发，配合 `chage -d 0` 强制首登改密。
6. yum 安装六步：`yum repolist` 确认源 → `yum search` 搜包 → `yum info` 看版本 → `yum install -y` 安装 → `rpm -q` / `which` 验证 → `yum remove` 卸载；EPEL 提供官方源没有的软件；装不上按"外网连通性 → yum 锁 → 源文件 → 清缓存"四步排查。


{% endraw %}
