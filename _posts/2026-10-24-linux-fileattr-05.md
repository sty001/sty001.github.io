---
title: "05-文件属性实战"
date: 2026-10-24 10:29:00 +0800
categories: [软件, Linux, 03-文件属性与正则表达式]
tags: [Linux, 03-文件属性与正则表达式, Linux基础]
slug: "linux-fileattr-05"
---

{% raw %}



这一篇进入实战：inode 与 block 的概念、诞生过程与查看方法，block 大小如何按业务取舍，硬链接与软链接的创建和区别，`date` 命令的格式化显示、历史/未来时间、系统时间修改与 `ntpdate` 同步。最后四个综合案例——批量改权限、按时间备份、403 排错、inode 满——每个都配完整命令链与逐段解释，改造一下就能用到生产上。

## 课前回顾
{: .sec-sum}

### find 根据权限查找

```bash
[root@linux-node1 test]# find /test -maxdepth 1 -type f -perm 644
/test/services
/test/test.txt
/test/test.jpg
/test/test.png
/test/test.avi
/test/1.tar
```

### tar 命令三件套

```bash
# 如何压缩数据
tar zcvf /tmp/test.tar.gz  /etc/ /test/ /test/test.txt

# 如何解压数据
tar xf /tmp/test.tar.gz -C /test

# 如何查看压缩包
tar tf /tmp/test.tar.gz

# 排除参数
--exclude
--exclude-from
```

### 其他回顾
{: .sec-sum}

- 文件属性信息：权限信息；
- 文件属性信息：用户信息（超级用户、虚拟用户、普通用户）；
- 文件属性信息：时间信息（atime、mtime、ctime）。

## inode：索引节点

| 项目 | 说明 |
| --- | --- |
| 概述 | 相当于书的目录，用于存储文件属性信息 |
| 诞生出来 | 创建文件系统之后（磁盘格式化） |
| 特点 1 | inode 用于存放的是文件属性 |
| 特点 2 | inode 用于存放 block 的指针位置 |
| 特点 3 | 创建一个文件至少占用一个 inode 和一个 block |
| 特点 4 | 在同一分区中，两个文件的 inode 号码相同，则两个文件互为硬链接 |
| 查看方法 | `df -i` |

```bash
[root@linux-node1 test]# df -i
Filesystem       Inodes IUsed    IFree IUse% Mounted on
/dev/sda3      25587200 61342 25525858    1% /
```

特点 3 与特点 4 各有一个前提要说清：空文件只占 inode 不占 block；"inode 号相同即硬链接"只在同一分区内成立，跨分区的 inode 号根本没有可比性。

**磁盘操作处理过程（类比盖房子）：**

| 步骤 | 类比 |
| --- | --- |
| 磁盘 | 地皮 |
| raid | 将多块地连接起来 |
| 分区 | 将地皮进行规划 |
| 格式化 | 地皮进行打扫整理 |
| 创建文件系统 | 建房风格（决定 inode 和 block） |
| 挂载 | 安装门 |

盖房子的类比可以继续往下走：文件系统类型是户型结构，inode 是房间编号，block 是房间本身，目录块是大堂的索引牌。索引牌丢了，房间再完好也找不到门。

## block：数据块

| 项目 | 说明 |
| --- | --- |
| 概述 | 目录指向的内容，用于存储文件具体内容 |
| 诞生出来 | 创建文件系统之后 |
| 特点 1 | block 用于存放的是数据信息 |
| 特点 2 | block 默认大小为 4k，可以进行调整 |
| 特点 3 | 比较大的文件会占用多个 block |
| 特点 4 | 比较小的文件，剩余空间无法使用，会浪费磁盘空间 |
| 特点 5 | 创建一个非空文件至少占用一个 inode 和一个 block |
| 特点 6 | 磁盘读取数据按 block 为单位读取，读取一个 block 会消耗一次磁盘 I/O（input/output，磁盘读写） |
| 查看方法 | `df` |

```bash
[root@linux-node1 test]# df
Filesystem     1K-blocks    Used Available Use% Mounted on
/dev/sda3       51149416 1752080  49397336   4% /
```

补充一个常被问到的细节：inode 本身也占磁盘空间（ext4 每个 256 字节），inode 表的空间在格式化时就划走了，`df -h` 看到的 block 容量并不包含它。所以 inode 数量在创建文件系统时基本定死，用完了只能扩容或重建文件系统——这和"删几个文件就能腾空间"的 block 完全不同。说白了，`df` 与 `df -i` 是两本独立的账：一个管内容空间，一个管文件数量，互不通用，监控告警两个指标都要配阈值，只盯一半，另一半风险就是盲区。

> **补充：**
>
> 01. 文件属性信息存储在 inode 中；
> 02. 文件的名称信息存储在上一级目录的 block 中。

### block 大小的查看与调整

课堂练习中问过"如何查看默认 block 大小、如何调整"，标准做法如下：

```bash
dumpe2fs -h /dev/sda3 | grep "Block size"     # ext2/3/4 查看块大小
stat -f /test                                  # 任何文件系统都可查看块大小等信息
xfs_info /mnt/point                            # xfs 文件系统用 xfs_info
```

block 大小在**创建文件系统（格式化）时**决定，创建后无法在线调整，只能备份数据、重新格式化、再恢复：

```bash
mkfs.ext4 -b 2048 /dev/sdb1                    # 创建 2K 块大小的 ext4 文件系统
mkfs.xfs -b size=2048 /dev/sdb1                # xfs 指定块大小
```

### 企业面试题：block 默认大小可以调整，是大点好还是小点好？
{: .sec-iv}

| 场景 | 设置 | 原因 |
| --- | --- | --- |
| 视频公司、图片公司（大文件多） | 设置大一点，例如 10k | 20K 的文件用 4k 的 block 需要 2 个 block、2 次 I/O；大 block 可以减少 I/O 消耗 |
| 互联网公司（小文件多） | 设置小一点，例如 2k | 1k 的小文件用小 block 只占 1 个 block，可以提高磁盘利用率 |

表里的结论反过来也成立：block 调大，小文件的浪费就多，1 字节的文件也要吃掉一整个 block——典型的空间换 I/O。文件系统类型本身也影响小文件表现，xfs 在海量小文件并发场景比 ext4 更从容。

## 综合实战案例
{: .sec-ex}

以下四个案例覆盖运维日常最高频的文件属性场景，每个案例都给出完整命令链与逐段解释。所有示例中的路径、用户名均为通用命名，使用时替换为实际值即可。

### 案例一：批量整理目录权限
{: .sec-ex}

**场景**：`/data/wwwroot` 目录经过多人手工维护，权限混乱，有的文件被误加了执行位，有的目录丢了执行位导致网站 403。要求：目录统一 755、文件统一 644，属主属组统一为 `www`。

```bash
# 第一步：先核对，看清楚当前都有什么
find /data/wwwroot -type d | head -20
find /data/wwwroot -type f | head -20

# 第二步：目录统一 755（必须有 x，否则进不去）
find /data/wwwroot -type d -exec chmod 755 {} +

# 第三步：文件统一 644（普通文件不需要执行位）
find /data/wwwroot -type f -exec chmod 644 {} +

# 第四步：统一属主与属组
chown -R www:www /data/wwwroot

# 第五步：抽查验证
find /data/wwwroot -type f -perm /111        # 不应再有多余执行位的文件
ls -ld /data/wwwroot
```

逐段解释：

1. `find -type d` / `-type f` 把目录和文件分成两条线处理，这是批量权限管理的核心手法；
2. `-exec chmod 755 {} +` 比 `\;` 效率高，`+` 会把一批路径合并成一条 chmod 命令执行；
3. **为什么不直接 `chmod -R 755 /data/wwwroot`**：递归 755 会给所有普通文件也加上执行位；而 `chmod -R 644` 更糟，会把目录的执行位抹掉，导致任何人都进不去。按类型分流是唯一正确姿势；
4. `find -type f -perm /111` 是验证手段，`/111` 表示匹配任意一个执行位，正常应无输出。

第五步的验证很重要，批量改完别只看目录顶层，抽几个深层子目录确认。曾有团队改完权限忘了验证，上线才发现某个二级目录的属组还是旧的，服务照样 403。

### 案例二：按时间查找文件并自动备份
{: .sec-ex}

**场景**：每天需要备份 `/data` 目录下最近 24 小时内修改过的文件，排除日志和大文件（超过 100M 的不入包），备份包按日期命名。

备份前先 `mkdir -p /backup`，别让 tar 因为目标目录不存在而失败——`&& touch marker` 的顺序救不了没建目录的低级错误。

```bash
# 全量按天备份：备份最近 1 天修改过的文件
find /data -type f -mtime -1 -size -100M ! -name "*.log" -print0 \
  | tar czf /backup/data-$(date +%F).tar.gz --null -T -
```

逐段解释：

1. `-mtime -1`：最近 1 天（24 小时）内修改过的文件；
2. `-size -100M`：小于 100M，大文件单独处理；
3. `! -name "*.log"`：感叹号取反，排除日志文件；
4. `-print0`：用空字符分隔输出，配合 tar 的 `--null -T -` 从标准输入读取文件列表，整条链路对文件名中的空格、换行完全免疫；
5. `$(date +%F)`：命令替换，生成 `2024-10-24` 形式的日期串做备份包名，同一天重复执行会覆盖前一个包。

**增量备份的标准写法**（配合标记文件）：

```bash
# 只备份比标记文件新的文件，备份成功后更新标记
find /data -type f -newer /backup/last.marker -print0 \
  | tar czf /backup/incr-$(date +%F).tar.gz --null -T - \
  && touch /backup/last.marker
```

1. `-newer /backup/last.marker`：只找比标记文件修改时间更新的文件，天然实现增量；
2. `&& touch`：只有 tar 成功后才更新标记，否则下次还会重打这批文件——这个顺序不能反；
3. 该方案与 `rsync` 的增量相比更轻量，适合没有 rsync 的环境。

标记文件的 mtime 就是增量基准，千万别顺手 `touch` 别的文件代替它，也别用 `mv` 挪动它——改了 mtime 就丢了基准。备份前 `stat /backup/last.marker` 看一眼，能确认上一次成功时间。

### 案例三：权限问题排错（网站 403）
{: .sec-ts}

**场景**：Nginx 访问 `/data/wwwroot/app/index.html` 返回 403 Forbidden，文件确定存在、Nginx 配置确认无误，从权限角度系统排查。

```bash
# 第一步：逐级查看路径上每一段的权限，一眼定位断点
namei -l /data/wwwroot/app/index.html

# 第二步：查看文件自身属性与属主
ls -l /data/wwwroot/app/index.html
id nginx                                   # 确认 Nginx 实际以哪个用户运行

# 第三步：确认有没有 ACL 在作怪
getfacl /data/wwwroot/app/index.html

# 第四步：确认 SELinux 上下文是否被打破
ls -Z /data/wwwroot/app/index.html

# 第五步：常见修复手段
chmod o+rx /data/wwwroot/app               # 补齐其他人读和进入的权限
chown -R www:www /data/wwwroot             # 属主交给 Nginx 用户
restorecon -Rv /data/wwwroot               # 修复 SELinux 上下文
```

排错逻辑与 `namei -l` 输出解读：

```console
[root@web01 ~]# namei -l /data/wwwroot/app/index.html
drwxr-xr-x root root /data
drwx--x--- root www  /data/wwwroot        # 缺少 r：nginx 列不出目录，直接 403
drwxr-xr-x www www  /data/wwwroot/app
-rw-r--r-- www www  /data/wwwroot/index.html
```

1. `namei -l` 把路径按层级拆开，每行显示该级的权限、属主、属组——这是排查"沿途权限"最快的命令，比一层层 `ls -ld` 高效得多；
2. 访问一个深层文件，需要**路径上每一级目录都有 `x`**，最终文件有 `r`；任何一级缺失都会 403；
3. Nginx 的工作进程通常以 `nginx` 或 `www` 用户运行，文件属主不是它、其他人又没有 `r`，就会 403；
4. 权限全部正确仍被拒，查 SELinux：`ls -Z` 看上下文是否为 `httpd_sys_content_t`，不对则 `restorecon` 或 `chcon`；
5. 文件被 `chattr +i` 锁过、软链接断链、`getfacl` 中 mask 过严，也都在这条排查链的覆盖范围内。

`namei -l` 一条命令能替代手工逐级 `ls -ld`，路径里夹着软链接时尤其有用——它会把每一段链接也展开显示，肉眼就能看出断在哪一层。

### 案例四：磁盘 inode 满的处理
{: .sec-ex}

**场景**：服务器报 `No space left on device`，但 `df -h` 显示 block 还剩很多——典型的 inode 耗尽。

```bash
# 第一步：确认是不是 inode 问题（IUse% 接近 100% 即实锤）
df -i
df -h                                       # 对照：block 明明还有剩余

# 第二步：定位小文件重灾区（按目录统计文件数，找最大的）
for d in /var/spool /var/lib /tmp /data; do
    echo "$d: $(find $d -type f | wc -l)"
done

# 第三步：缩小范围，找出具体目录
find /var/spool -type f -printf '%h\n' | sort | uniq -c | sort -rn | head

# 第四步：先核对再清理（不带 -delete 跑一遍，人工确认列表）
find /var/spool/postfix/maildrop -type f -mtime +3
find /var/spool/postfix/maildrop -type f -mtime +3 -delete

# 第五步：清理后确认恢复
df -i
```

逐段解释：

1. `df -i` 的 `IUse%` 到 100% 时，即使 block 有空间也无法创建新文件，因为每个文件必须占用一个 inode；
2. `find 目录 -type f -printf '%h\n'` 输出每个文件所在的目录名，配合 `sort | uniq -c | sort -rn` 就是一张"小文件数量排行榜"，直接定位元凶目录；
3. 邮件队列（`/var/spool/postfix/maildrop`）、PHP 会话目录（`/var/lib/php/session`）、`/tmp` 是小文件泛滥的三大高发地；
4. Postfix 队列也可以用 `postsuper -d ALL` 一键清理（需停 postfix 或确认无待发邮件）；
5. 清理永远分两步：先不带 `-delete` 核对范围，确认无误再执行删除；
6. 长期方案：监控 `df -i`（与 `df -h` 同等重要）、格式化时为小文件场景选小块大小、治理疯狂产生小文件的应用。

反向场景同样要会：手滑 `rm` 掉了不该删的文件，第一动作不是到处找恢复软件，而是立刻停掉往该分区写数据的一切进程，最好直接 `umount`——被覆盖过的数据神仙也救不回来。ext 系可以试 extundelete，xfs 看 xfs_undelete，但它们都只是碰运气的手段，真正的保障是备份。

## 硬链接

**概念说明**：在一个分区中，inode 号码相同的文件互为硬链接，相当于超市的多个门（读取数据的多个入口）。
{: .callout-card}

```bash
[root@linux-node1 test]# ln /test/test.txt /test/test_hard_link.txt
[root@linux-node1 test]# ll
total 8
-rw-r--r--. 2 root root 13 Apr 16 10:49 test_hard_link.txt
-rw-r--r--. 2 root root 13 Apr 16 10:49 test.txt
```

利用 `find` 命令找到所有硬链接文件（按 inode 号码查找）：

```bash
[root@linux-node1 test]# find / -type f -inum 33584339
/etc/hosts
/tmp/hosts
```

> **注意：** 系统中的目录不能创建硬链接。
{: .sec-pit}

另一个高频报错：`ln /test/a.txt /tmp/b.txt` 在 /tmp 是独立挂载点时直接报 Invalid cross-device link。硬链接要求两个目录条目在同一个文件系统里，跨分区只能用软链接。反之 `mv` 不会报这个错——它检测到跨设备时会自动走"复制再删除"的路径，代价是 inode 变了、耗时也变长。这里有个坑：mv 跨分区后硬链接关系就断了，依赖硬链接做备份去重的脚本要留意。

统计 `/etc` 目录中有多少个目录文件：

```bash
[root@linux-node1 ~]# ll /etc/|grep -c "^d"
78
[root@linux-node1 ~]# ll /etc/|grep  "^d"|wc -l
78
```

## 软链接

**概念说明**：文件的快捷方式。
{: .callout-card}

```bash
[root@linux-node1 test]# ln -s /test/test.txt /test/test_soft_link.txt
[root@linux-node1 test]# ll
total 8
lrwxrwxrwx. 1 root root 18 Apr 16 10:50 test_soft_link.txt -> /test/test.txt
-rw-r--r--. 2 root root 13 Apr 16 10:49 test.txt
```

软链接的典型生产用法是版本切换：`/opt/app` 是指向 `/opt/app-1.2.0` 的软链接，升级时解压新目录、把链接一改即完成切换，回滚也是一秒的事。数据库、Java 应用的部署目录常用这招。

## 软链接与硬链接的区别

| 区别 | 硬链接 | 软链接 |
| --- | --- | --- |
| 01. 链接后的文件大小 | 与源文件一致 | 与源文件不一致 |
| 02. 链接后的文件类型和权限（颜色） | 一致 | 不一致 |
| 03. 链接后的 inode 信息 | inode 号码一致 | inode 号码不一样 |
| 04. 源文件被删除之后 | 硬链接文件依然有效 | 软链接文件失效 |
| 05. 创建过程 | `ln 源文件 链接文件` | `ln -s 源文件 链接文件` |

更完整的对比（含跨分区、目录限制、路径写法等维度）见 文件属性与 inode 中的"硬链接与软链接深入对比"一节。

表里第 01 条"大小与源文件一致"只对硬链接成立——硬链接本质是同一份数据的另一个名字，大小当然一样；软链接的大小是目标路径字符串的长度，与源文件无关。实际敲一遍就明白：同一目录下各建一个硬链接和软链接，`ll` 对比大小、inode 和类型三列。

## 时间相关命令：date

### 查看时间信息与调整显示格式

```bash
[root@linux-node1 ~]# date
Tue Apr 16 11:49:51 CST 2019

[root@linux-node1 ~]# date +%F
2019-04-16

[root@linux-node1 ~]# date "+%F %T"
2019-04-16 11:52:54

[root@linux-node1 ~]# date "+%y-%m-%d %H:%M:%S"
19-04-16 11:53:58
```

常用格式化占位符：

| 占位符 | 含义 | 示例 |
| --- | --- | --- |
| `%F` | 完整日期，等价 `%Y-%m-%d` | `2024-10-24` |
| `%T` | 完整时间，等价 `%H:%M:%S` | `11:52:54` |
| `%y` / `%Y` | 两位年 / 四位年 | `24` / `2024` |
| `%m` / `%d` | 月 / 日 | `10` / `24` |
| `%H` / `%M` / `%S` | 时 / 分 / 秒 | `11` / `52` / `54` |
| `%s` | Unix 时间戳（秒） | `1729755174` |
| `%w` / `%u` | 星期几（0-6 / 1-7） | `4` / `4` |

`%F` 与 `%T` 是最常用的两个符号，多机房脚本里再配一个 `%z`（时区偏移），排查跨时区问题时能救命。

时间戳与日期的互转（脚本里常用）：

```bash
date +%s                            # 当前时间戳
date -d @1729755174 "+%F %T"        # 时间戳转日期
date -d "2024-10-24 11:52:54" +%s   # 日期转时间戳
```

**利用日期给备份文件命名：**

```bash
cp app.log app.log-$(date "+%F_%T")
```

命令替换里 `$()` 比反引号更推荐：可嵌套、可读性好，脚本里一律用 `$()`。

### 显示历史时间信息与未来时间信息

```bash
# 显示历史时间信息
# date +%F -d "-2day"
# date +%F -d "1 day ago"

# 显示未来时间信息
# date -d "+2day"
# date -d "2day"
```

支持的单位很灵活：`-d "2 hours ago"`、`-d "next monday"`、`-d "3 days"` 都合法，凑不出来的复杂计算交给 `date -d` 试一试，比手算可靠。看不同时区的时间也不必改系统配置，环境变量临时套一层：`TZ=UTC date` 看标准时间，`TZ=Asia/Shanghai date` 看北京时间。写多机房脚本时这个技巧很省事，比 `timedatectl set-timezone` 来回切安全得多——后者影响全机，忘了改回来定时任务全乱。

**实际场景**：系统每天 00:00 自动备份数据，4 月 16 日 00:00 执行时备份的其实是 4 月 15 日的数据，所以要往前推一天：

```bash
# 原写法
cp /test/app.log /log/app.log.$(date +%F)

# 调整后
cp /test/app.log /log/app.log.$(date +%F -d "-1day")
```

### 实际修改系统时间

```bash
[root@linux-node1 test]# date -s "2020-04-17"
Fri Apr 17 00:00:00 CST 2020
[root@linux-node1 test]# date
Fri Apr 17 00:00:17 CST 2020
[root@linux-node1 test]# date -s "2020/04/17 14:00"
Fri Apr 17 14:00:00 CST 2020
```

> **注意：** 手工 `date -s` 是应急手段，会造成时间跳变（依赖时间戳签名的证书、令牌、日志序列会出问题）。改完系统时间应执行 `hwclock -w`（`--systohc`）把时间写回硬件时钟，否则重启后可能被硬件时钟覆盖。
{: .sec-pit}

服务器装了 NTP 后硬件时钟一般设为 UTC，`hwclock --show` 显示硬件时钟时间，与 `date` 对不上时先查时区，再怀疑时钟。

### 时间同步方法

```bash
yum install -y ntpdate
ntpdate

[root@linux-node1 test]# ntpdate ntp1.aliyun.com
16 Apr 12:22:33 ntpdate[25718]: step time server 120.25.115.20 offset 268748517.381960 sec
[root@linux-node1 test]# date
Tue Apr 16 12:22:48 CST 2019
```

> **注意：** `ntpdate` 已被废弃，在 Rocky Linux / AlmaLinux 9 及 CentOS 8 之后的源中已移除。现代系统的时间同步标准做法是用 chrony：
>
> ```bash
> dnf install -y chrony
> systemctl enable --now chronyd
> chronyc sources -v                 # 查看同步源与同步状态
> timedatectl status                 # 查看时间、时区、NTP 同步状态
> timedatectl set-timezone Asia/Shanghai   # 修改时区
> timedatectl set-ntp true           # 开启 NTP 同步
> ```
>
> 容器内（Docker/Kubernetes）看到的时间是宿主机的映射，`date -s` 通常不被允许也没有意义，时间统一由宿主机的 chronyd 维护。
{: .sec-pit}

chrony 与 ntpdate 的根本区别：ntpdate 是"一次对表"，时间差大就直接跳变；chronyd 是"持续微调"，慢慢把时钟拨正，对依赖时间连续性的服务（数据库、证书校验）友好得多。

## 常见错误与排错
{: .sec-ts}

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| 报 `No space left on device` 但 `df -h` 有余量 | inode 耗尽 | `df -i` | 清理小文件，见案例四 |
| `rm` 删除文件后 `df` 不降 | 进程仍持有已删文件的句柄 | `lsof \| grep deleted` | 重启进程或 `truncate -s 0 文件` 释放句柄 |
| 备份包名字混乱或互相覆盖 | 没用日期命名或重复执行 | `ls -l /backup` | 用 `$(date +%F_%T)` 命名，脚本加锁 |
| 增量备份每次都打成全量 | 标记文件没更新或 `&&` 顺序写反 | `ls -l /backup/last.marker` | 确认 `tar ... && touch marker` 顺序 |
| 备份包含一堆不需要的文件 | 没写排除条件 | `tar tf 备份包` 核对 | `--exclude` / `--exclude-from` |
| 修改文件提示 `Operation not permitted` | 文件带 `i` 属性 | `lsattr 文件` | `chattr -i` 后重试 |
| 改了系统时间重启后还原 | 只改了系统时间没写硬件时钟 | `hwclock` 对比 | `hwclock -w`，并部署 chronyd |
| 批量 chmod 后网站 403 | 用 `chmod -R 644` 把目录执行位抹了 | `namei -l 路径` | `find -type d -exec chmod 755 {} +` 修复 |

## 自测题
{: .sec-prac}

1. 为什么批量设置权限时推荐 `find /data -type d -exec chmod 755 {} +`，而不是 `chmod -R 755 /data`？
2. `find ... -print0 | tar czf x.tar.gz --null -T -` 这条链路中，`-print0`、`--null`、`-T -` 各自解决什么问题？
3. 增量备份脚本里 `tar ... && touch /backup/last.marker`，为什么 `&&` 的顺序不能反？
4. 报 `No space left on device`，`df -h` 显示还有一半空间，第一步应该执行什么命令？最可能的原因是什么？
5. `rm` 掉一个文件后，数据是否立即从磁盘上消失了？怎样才算"彻底删除"？
6. `date +%F -d "-1day"` 与 `date -d yesterday +%F` 等价吗？

> **答案：** 1. `chmod -R 755` 会给所有普通文件也加上执行位，`chmod -R 644` 又会抹掉目录的执行位导致无法进入；按 `-type d` / `-type f` 分流才能目录 755、文件 644 各得其所。2. `-print0` 让 find 用空字符分隔输出，`--null` 让 tar 按空字符解析文件列表，`-T -` 让 tar 从标准输入读列表——三者配合可免疫文件名中的空格、换行等特殊字符。3. `&&` 保证只有 tar 打包成功后才更新标记文件；若顺序写反，打包失败时标记已更新，这批文件下次增量就再也备份不到了。4. 执行 `df -i`；最可能是 inode 耗尽（海量小文件占满 inode 表），block 仍有剩余但无法新建文件。5. 不是。`rm` 只删除目录项并把 inode 引用计数减一，数据仍在 block 中，直到被新数据覆盖；彻底删除可用 `shred -u -n 3 -z 文件` 多次覆写后删除（SSD 上受磨损均衡影响效果打折，涉密场景需按数据销毁标准处理）。6. 等价，GNU date 对相对时间的写法很宽容，`-1day`、`1 day ago`、`yesterday` 都能解析；格式化符号 `%F` 放在 `-d` 前后都可以。

## 课后练习
{: .sec-prac}

1. 如何修改磁盘中 block 大小，如何进行查看默认的 block 大小；
2. 总结数据存储与读取原理；
3. 磁盘满无法存储数据的原因；
4. Linux 系统中读取数据的原理（数据无法读取——权限阻止），例如读取 `/test/test01/test.txt` 需要沿途每一级目录都具备相应权限；
5. 总结英文月份信息、星期信息；
6. 如何将文件彻底删除。

## 小结
{: .sec-sum}

1. inode 存文件属性、block 存文件内容，二者都在创建文件系统（格式化）时诞生，`df -i` 看 inode、`df` 看 block。
2. 文件名存在上一级目录的 block 里，属性存在自己的 inode 里；block 大小用 `dumpe2fs -h`（ext）或 `stat -f` / `xfs_info` 查看，只能在格式化时用 `mkfs -b` 调整。
3. block 大小的取舍本质是 I/O 次数与磁盘利用率的权衡：大文件场景调大，小文件场景调小；block 大小只能在格式化时定，创建后无法在线调整。
4. 硬链接 = 同一 inode 的多个入口（`ln`，不能用于目录，删除源文件仍有效）；软链接 = 快捷方式（`ln -s`，删除源文件即失效）。
5. 批量权限的标准姿势是 `find -type d` / `-type f` 分流后分别 `chmod`，不要用 `chmod -R` 一把梭；属主属组用 `chown -R 属主:属组`。
6. 按时间备份用 `find -mtime -1` / `-newer 标记文件`，配合 `-print0` 与 `tar --null -T -` 实现特殊文件名安全的打包；增量备份务必 `tar ... && touch marker` 保证标记最后更新。
7. 权限排错首选 `namei -l` 逐级看路径权限，再查属主、ACL（`getfacl`）、SELinux（`ls -Z`），最后才是改权限。
8. `No space left on device` 但 `df -h` 有余量时，立刻 `df -i`——inode 满是小文件泛滥的信号，用 `find -printf '%h\n' | sort | uniq -c | sort -rn` 定位重灾区，先核对再 `-delete`。
9. `date` 用 `+%F`（日期）、`+%T`（时间）定制格式，`-d "-1day"` / `-d "+2day"` 取相对时间，`-s` 修改系统时间，`+%s` 与 `-d @` 做时间戳互转。
10. 生产环境请用 chronyd（`systemctl enable --now chronyd`）同步时间，`ntpdate` 已废弃；容器内时间由宿主机统一维护，无需也不应手工修改。
11. `df -h` 与 `df -i` 是两本独立的账，监控要同时配阈值；误删文件的第一反应是停写入、`umount`，再谈恢复。

## 相关阅读

- [基础知识回顾（下）](/posts/linux-fileattr-02/)

- [文件属性与 inode](/posts/linux-fileattr-03/)

- [文件属性进阶](/posts/linux-fileattr-04/)

- [磁盘管理基础](/posts/linux-disk-01/)

- [备份服务 rsync](/posts/linux-arch-02/)



{% endraw %}
