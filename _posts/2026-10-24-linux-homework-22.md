---
title: "day22-定时任务作业实操"
date: 2026-10-24 09:36:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操]
slug: "linux-homework-22"
---

{% raw %}
本篇对应课程第 22 天（定时任务）的课后作业，共四题：①默写 crontab 五段时间语法规则并给出 8 个经典示例；②写一个每天凌晨 1 点打包备份 `/data/linux` 的定时任务（备份脚本 tar + date 命名真跑，crontab 行给标准写法）；③定时任务排错三板斧（日志排查、环境变量问题、重定向输出）；④说清 `crontab -e/-l/-r` 与 `/etc/crontab`、`/etc/cron.d` 的区别。备份脚本的核心动作（tar 打包、date 命名、解压验证）为 A 级真跑，crond 服务与 crontab 命令为 B 级标准写法 + 预期输出。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：备份脚本用到的 tar（GNU tar 1.35，与 CentOS 7 的 1.26 参数完全兼容）、date、find 等在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`systemctl status crond`、`crontab -e/-l`、`/var/log/cron` 日志等系统级内容给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw/day22`：`data/` 模拟被备份的业务目录，`backup/` 模拟备份存放目录，`verify/` 用于解压回读验证。本环境 `command -v crontab` 返回非 0（不存在），`crond` 服务也无法启动，故 crontab 相关均为 B 级；备份脚本先以 `/tmp/hw/day22` 沙箱路径真跑，再给出替换为 `/data/linux` 的生产版本。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | crontab 五段时间语法规则 + 8 个经典示例 | 语法规则 B 级 + date 验证 A 级 |
| 题 2 | 每天凌晨 1 点打包备份 /data/linux 的定时任务 | 脚本 tar+date A 级真跑 + crontab 行 B 级 |
| 题 3 | 定时任务排错三板斧（日志 / 环境变量 / 重定向） | 三板斧 B 级 + 极简 PATH 模拟 A 级 |
| 题 4 | `crontab -e/-l/-r` 与 `/etc/crontab`、`/etc/cron.d` 区别 | B 级（对照表） |

## 题 1：crontab 五段时间语法规则与 8 个经典示例

**考察点**：五段时间字段的顺序与取值范围（**分 时 日 月 周**，最短周期 1 分钟）、四个特殊符号（`*`、`,`、`-`、`/`）的含义，以及「日期与星期不要同时出现」「`/` 前尽量写 `*`」两条编写原则。

**实现思路**：先默写标准头注释确认五段顺序，再把 8 个经典时间写法整理成表；星期字段用 `date +%w` 真跑核对（0~6，0 与 7 都是周日），确保示例里的星期数不写错。

### 五段字段与特殊符号

crontab 文件的标准头注释本身就是最好的记忆图（B 级，`crontab -e` 打开即可看到）：

```text
# Example of job definition:
# .---------------- minute (0 - 59)
# |  .------------- hour (0 - 23)
# |  |  .---------- day of month (1 - 31)
# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...
# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7) OR sun,mon,...
# |  |  |  |  |
# *  *  *  *  * user-name  command to be executed
```

| 字段 | 含义 | 取值范围 |
| --- | --- | --- |
| 第 1 段 | 分钟 minute | 0 - 59 |
| 第 2 段 | 小时 hour | 0 - 23 |
| 第 3 段 | 日期 day of month | 1 - 31 |
| 第 4 段 | 月份 month | 1 - 12 或 jan,feb,... |
| 第 5 段 | 星期 day of week | 0 - 6（0 或 7 均为周日）或 sun,mon,... |

特殊符号四件套：

| 符号 | 含义 | 示例 |
| --- | --- | --- |
| `*` | 每一个取值都匹配（每） | `* * * * *` 每分钟 |
| `,` | 列举不连续取值 | `0 14,20 * * *` 每天 14 点与 20 点 |
| `-` | 连续范围 | `0 1-3 * * *` 每天 1 到 3 点整 |
| `/` | 步长，从起点每隔 n | `*/10 * * * *` 每 10 分钟 |

两条编写原则：①想表示「每隔多久」时，`/` 上面尽量用 `*`（`*/10`），不要写具体数值；②**日期与星期不要同时出现**——两者同时设置时是「或」的关系，任一匹配即执行，实际触发时机会超出预期。

### 星期字段用 date 核对（已实操）

```bash
date +%F
date +%F_%w
date "+%F %T"
```

输出：

```console
$ date +%F
2026-10-24
$ date +%F_%w
2026-10-24_6
$ date "+%F %T"
2026-10-24 09:19:42
```

`%w` 输出 `6`，当天是星期六，与「0~6、0 是周日」的规则吻合。写星期类任务前先跑一下 `date +%w`，能有效避免「周六写成 7 还是 6」的低级错误。

### 8 个经典示例表

| 序号 | 写法 | 含义 |
| --- | --- | --- |
| 1 | `* * * * *` | 每分钟执行一次（定时任务最短周期） |
| 2 | `0 1 * * *` | 每天凌晨 1 点整（本题备份任务的时间段） |
| 3 | `*/10 * * * *` | 每 10 分钟执行一次 |
| 4 | `0 2 * * *` | 每天凌晨 2 点整 |
| 5 | `0 14,20 * * *` | 每天 14 点与 20 点整 |
| 6 | `30 8 * * 1-5` | 周一到周五每天 08:30 |
| 7 | `0 2 */3 * *` | 每隔 3 天的凌晨 2 点 |
| 8 | `0 2 1 * *` | 每月 1 号凌晨 2 点 |

> **易错点**：
>
> - cron 不支持 `?`、`L`、`W` 等 Quartz 表达式符号，遇到「每月最后一天」类需求用脚本里 `date` 判断实现；
> - `%` 在 crontab 命令里是特殊符号（第一个未转义的 `%` 之后的内容会作为标准输入送给命令），必须写 `\%` 或放进脚本；
> - `20/10` 表示「从第 20 分钟起每隔 10 分钟」（20、30、40、50 分），不是「每 10 分钟」的等价写法。

> **参见**：定时任务与 crond

## 题 2：每天凌晨 1 点打包备份 /data/linux 的定时任务

**考察点**：定时任务落地的标准三步——写脚本（多命令封装 + 绝对路径 + 按日期命名）、手工验证脚本、再挂 crontab；以及「为什么把任务写进脚本而不是直接塞进 crontab 命令列」。

**实现思路**：备份动作拆成「tar 打包 + date 生成日期后缀 + 解压回读验证」。脚本在本环境用沙箱路径 `/tmp/hw/day22` 真跑（A 级），生产版本把路径替换为 `/data/linux` 与 `/backup`；crontab 行给标准写法（B 级）。

### 步骤 1：构造测试数据（已实操）

```bash
mkdir -p /tmp/hw/day22/data/scripts /tmp/hw/day22/backup
cd /tmp/hw/day22
printf 'app config v1\n' > data/app.conf
printf 'log line 1\n'    > data/app.log
printf 'echo hi\n'       > data/scripts/clean.sh
ls -lR data
```

输出：

```console
$ ls -lR data
data:
total 2
-rw-r--r-- 1 user 197609 14 Oct 24 09:19 app.conf
-rw-r--r-- 1 user 197609 11 Oct 24 09:19 app.log
drwxr-xr-x 1 user 197609  0 Oct 24 09:19 scripts

data/scripts:
total 1
-rw-r--r-- 1 user 197609 8 Oct 24 09:19 clean.sh
```

### 步骤 2：编写备份脚本（已实操，沙箱路径）

```bash
cat > /tmp/hw/day22/backup.sh <<'EOF'
#!/bin/bash
# 每日凌晨 1 点打包备份 /data/linux -> /backup，按日期命名
SRC=/data/linux
DEST=/backup
DATE=$(date +%F)
tar -czf "${DEST}/data_${DATE}.tar.gz" -C / data
EOF
```

生产脚本要点逐行说明：

1. `DATE=$(date +%F)` 命令替换取当天日期，备份文件名形如 `data_2026-10-24.tar.gz`，天然按天区分、不互相覆盖；
2. `tar -C / data` 先切到 `/` 再用相对路径打包，归档内成员是 `data/...` 而不是绝对路径——避免解压时覆盖真实系统路径，也避免 tar「剥掉开头 `/`」的警告；
3. 用 `tar -czf` 而不是 `tar -czvf`：定时任务里不要产生屏幕输出（`-v` 的输出会触发邮件），需要排错时再临时加回 `-v`。

### 步骤 3：真跑验证（已实操）

本环境把路径替换成沙箱目录后真跑（`sed` 只替换路径三处，逻辑不动）：

```bash
sed 's|/data/linux|/tmp/hw/day22/data|; s|DEST=/backup|DEST=/tmp/hw/day22/backup|; s|-C / data|-C /tmp/hw/day22 data|' /tmp/hw/day22/backup.sh > /tmp/hw/day22/backup_local.sh
bash /tmp/hw/day22/backup_local.sh
ls -l /tmp/hw/day22/backup/data_*.tar.gz
tar -tzf /tmp/hw/day22/backup/data_$(date +%F).tar.gz
```

输出：

```console
$ ls -l /tmp/hw/day22/backup/data_*.tar.gz
-rw-r--r-- 1 user 197609 242 Oct 24 09:19 /tmp/hw/day22/backup/data_2026-10-24.tar.gz
$ tar -tzf /tmp/hw/day22/backup/data_2026-10-24.tar.gz
data/
data/app.conf
data/app.log
data/scripts/
data/scripts/clean.sh
```

同一包连续执行两次也不会报错（`-czf` 每次重建归档，静默覆盖），第二次执行退出码为 0。

### 步骤 4：解压回读验证（已实操）

备份做完必须抽样回读，这是备份类操作的底线动作：

```bash
cd /tmp/hw/day22
rm -rf verify && mkdir verify
tar -xzf backup/data_$(date +%F).tar.gz -C verify
find verify -type f | sort
cat verify/data/app.conf
```

输出：

```console
$ find verify -type f | sort
verify/data/app.conf
verify/data/app.log
verify/data/scripts/clean.sh
$ cat verify/data/app.conf
app config v1
```

文件清单与源目录一一对应，内容一致，备份正确。

### 步骤 5：挂上 crontab（B 级）

```bash
crontab -e
```

写入（CentOS 7 标准写法，含环境变量与注释）：

```conf
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=""

# 每天凌晨 1 点打包备份 /data/linux 到 /backup
00 01 * * * /bin/sh /server/scripts/backup.sh &>/dev/null
```

查看确认落盘：

```bash
crontab -l
```

预期输出（CentOS 7）：

```console
$ crontab -l
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=""

# 每天凌晨 1 点打包备份 /data/linux 到 /backup
00 01 * * * /bin/sh /server/scripts/backup.sh &>/dev/null
```

到点后从日志确认执行（B 级）：

```console
$ grep "backup" /var/log/cron
Oct 25 01:00:01 linux-node1 CROND[4021]: (root) CMD (/bin/sh /server/scripts/backup.sh &>/dev/null)
```

> **易错点**：
>
> - 备份文件名必须带 `$(date +%F)`，否则每天都覆盖同一个包，只留得到最近一天；反过来说，没有轮转清理的话包会无限堆积，生产上应再加一条「保留最近 N 天」的清理任务；
> - crontab 命令列里写 `$(date +%F)` 要写成 `$\(date +\%F\)`（`%` 必须转义），不如直接放进脚本省心——这正是「多命令需求一律写脚本」的理由之一；
> - 脚本路径、命令一律绝对路径（`/bin/sh /server/scripts/backup.sh`），脚本内部变量也用绝对路径；
> - 上线前先手工跑一遍脚本并解压回读，确认无误再挂 crontab。

> **参见**：定时任务与 crond · day14 tar 打包真跑

## 题 3：定时任务排错三板斧

**考察点**：任务到点没跑/跑出意外的三种最高频原因——①crond 日志里到底执行没有；②cron 的极简环境（PATH 只有 `/usr/bin:/bin`）导致「手工能跑、定时不跑」；③输出没重定向，邮件把磁盘撑爆。三板斧各对应一组固定排查命令。

### 第一板斧：日志排查（B 级）

两步固定动作：先确认配置落盘，再确认 crond 执行过。

```bash
cat /var/spool/cron/root        # 第一步：配置是否真的写进去了
tail -100 /var/log/cron         # 第二步：crond 是否到点执行
systemctl status crond          # 顺带确认服务活着
journalctl -u crond --since today   # systemd 系统也可按单元看日志
```

预期输出（CentOS 7）：

```console
$ tail -5 /var/log/cron
Oct 25 00:55:01 linux-node1 crond[905]: (root) RELOAD (/var/spool/cron/root)
Oct 25 01:00:01 linux-node1 CROND[4021]: (root) CMD (/bin/sh /server/scripts/backup.sh &>/dev/null)
Oct 25 01:00:02 linux-node1 CROND[4020]: (root) MAIL (mailed 55 bytes of output but got status 0x004b#012)
```

日志关键字速查：

| 日志内容 | 含义 |
| --- | --- |
| `BEGIN EDIT` / `REPLACE` / `END EDIT` | 有人编辑并保存了 crontab |
| `RELOAD (/var/spool/cron/root)` | crond 重新加载了任务文件 |
| `CMD (命令)` | 到点执行了某条命令 |
| `MAIL (mailed ... bytes)` | 命令有输出、已尝试发邮件（配合排查磁盘问题） |

日志里连 `CMD` 都没有，说明任务没匹配上时间或 crond 没运行；有 `CMD` 但结果不对，问题在命令与环境，看第二板斧。

### 第二板斧：环境变量问题（PATH 陷阱）

cron 执行命令时的 PATH 只有 `/usr/bin:/bin`，没有交互 shell 里的 `/usr/local/sbin`、`/usr/sbin`、`/sbin`。`useradd`、`userdel`、`crontab` 等 sbin 命令在定时任务里直接写名字就会 `command not found`——而手工执行一切正常，这是定时任务第一名场面。

在本环境用 `env -i` 模拟 cron 的极简环境真跑对比（已实操）：

```bash
command -v tar
env -i PATH=/usr/bin:/bin /bin/sh /tmp/hw/day22/backup_local.sh && echo "极简 PATH 下执行成功"
env -i PATH=/usr/bin:/bin /bin/sh -c 'useradd stu99' 2>&1; echo "退出码=$?"
```

输出：

```console
$ command -v tar
/usr/bin/tar
$ env -i PATH=/usr/bin:/bin /bin/sh /tmp/hw/day22/backup_local.sh && echo "极简 PATH 下执行成功"
极简 PATH 下执行成功
$ env -i PATH=/usr/bin:/bin /bin/sh -c 'useradd stu99' 2>&1; echo "退出码=$?"
/bin/sh: useradd: command not found
退出码=127
```

备份脚本全用绝对路径、tar 又在 `/usr/bin`，所以极简 PATH 下依然成功；而 `useradd` 在 `/usr/sbin` 下，极简环境直接 127。解决方式二选一：

1. 命令全部写绝对路径（`/usr/sbin/useradd`），这是笔记规范推荐；
2. 在 crontab 文件开头显式定义 `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`。

### 第三板斧：重定向输出（B 级）

cron 的规则：任务有任何标准输出/标准错误，就以邮件发给对应用户。于是出现两种磁盘事故：

| 场景 | 后果 | 占用资源 |
| --- | --- | --- |
| postfix 开着 | `/var/spool/mail/root` 不断变大 | block 空间 |
| postfix 关着 | `/var/spool/postfix/maildrop/` 堆积小文件 | inode 空间 |

标准解法（三选一，推荐 1+3 组合）：

```bash
# 1) 任务末尾统一丢弃输出（最常用）
00 01 * * * /bin/sh /server/scripts/backup.sh &>/dev/null

# 2) 只想保留错误信息、丢弃正常输出
00 01 * * * /bin/sh /server/scripts/backup.sh >/dev/null 2>&1

# 3) crontab 顶部直接关闭邮件发送
MAILTO=""
```

验证磁盘有没有中招（B 级）：

```bash
du -sh /var/spool/mail/*                              # 查 block 膨胀
ls /var/spool/postfix/maildrop/ | wc -l               # 查 inode 堆积
grep "MAIL" /var/log/cron | tail                      # 看哪些任务在发邮件
```

> **易错点**：
>
> - `>/dev/null 2>&1` 不能写成 `2>&1 >/dev/null`——顺序反了，标准错误仍会打到屏幕（触发邮件）；
> - 日志里出现 `MAIL (mailed ... but got status 0x004b...)` 说明 postfix 有问题，先按第三板斧清理，再统一 `MAILTO=""`；
> - 排错时可在 crontab 里临时加一条每分钟任务把变量打印到文件（`* * * * * echo $PATH > /tmp/cron_env.txt`），两分钟后对比手工环境的 `echo $PATH`，差异一目了然。

> **参见**：定时任务与 crond

## 题 4：crontab -e/-l/-r 与 /etc/crontab、/etc/cron.d 的区别

**考察点**：用户级与系统级两套定时任务入口的格式差异（6 段 vs 7 段）、存放位置、执行身份，以及 `crontab -r` 的危险性。

**实现思路**：先把 crontab 命令参数过一遍，再用一张对照表把三个入口的差异说全，最后给出选型建议。以下命令均为 B 级（CentOS 7 真机可用）。

### crontab 命令参数

| 参数 | 作用 |
| --- | --- |
| `-e` | 编辑当前用户的定时任务（存到 `/var/spool/cron/用户名`） |
| `-l` | 列出当前用户的定时任务 |
| `-r` | 删除当前用户**全部**定时任务（危险，删前先 `-l`） |
| `-r -i` | 删除前交互确认，比裸 `-r` 稳 |
| `-u 用户` | root 代其他用户查看/编辑/删除任务 |

`crontab -r` 一执行就把该用户所有任务清空且无法恢复，没有回收站——这是定时任务领域最容易造成事故的命令，习惯上先 `crontab -l > /tmp/crontab.bak` 留份快照再操作。

### 三个入口对照表

| 维度 | `crontab -e`（用户级） | `/etc/crontab` | `/etc/cron.d/*` |
| --- | --- | --- | --- |
| 时间字段格式 | 五段 + 命令（共 6 段） | 五段 + **用户** + 命令（共 7 段） | 同 `/etc/crontab`（7 段） |
| 执行身份 | 编辑者本人 | 第六段指定的用户 | 第六段指定的用户 |
| 存放位置 | `/var/spool/cron/用户名` | 固定单文件 | 独立片段文件（文件名不含点） |
| 编辑方式 | `crontab -e` | vi 直接编辑 | vi 直接编辑 |
| 典型使用者 | 普通用户、运维日常任务 | 系统管理员手工维护 | 软件包自动投放（如 `0hourly`、`sysstat`） |
| 黑白名单 | 受 `/etc/cron.allow` / `/etc/cron.deny` 控制 | 不受限（root） | 不受限（root） |

写法差异示例（B 级）：

```conf
# 用户级（crontab -e，root 用户），6 段：没有用户列
00 01 * * * /bin/sh /server/scripts/backup.sh &>/dev/null

# 系统级（/etc/crontab 或 /etc/cron.d/xxx），7 段：多一个用户列
00 01 * * * root /bin/sh /server/scripts/backup.sh &>/dev/null
```

用户级任务写成了 7 段（或反之），多出来的段会被当成命令的一部分，任务静默不执行——格式写错是「任务不跑」的隐藏原因之一，`cat /var/log/cron` 里连 `CMD` 记录都没有时先回头数段数。

选型建议：单机日常任务用 `crontab -e`；需要指定执行用户（如让 nginx 用户跑任务）或做软件包分发时用 `/etc/cron.d/` 独立文件；`/etc/crontab` 尽量少动，留给发行版与系统维护。另有四个周期脚本目录 `/etc/cron.hourly|daily|weekly|monthly`，只放可执行脚本、不写时间字段，由 run-parts 与 anacron 触发，适合关机补跑场景。

> **易错点**：
>
> - `/etc/cron.d/` 下的文件名不能含点（`.`），否则 crond 直接忽略；属主必须 root，权限不能组可写；
> - `crontab -r` 没有 `-u` 时删的是**当前用户**的任务，root 执行就是删 root 的全部任务；
> - 用户级任务文件（`/var/spool/cron/用户名`）不要用 vi 直接改，一律走 `crontab -e`，否则 crond 可能不重载。

> **参见**：定时任务与 crond

## 小结

1. 五段时间字段是**分 时 日 月 周**，最短周期 1 分钟；四个符号 `*`（每）、`,`（枚举）、`-`（范围）、`/`（步长）覆盖全部写法，`/` 前尽量写 `*`，日期与星期不要同时出现（两者是「或」关系）。
2. 备份任务标准三步：写脚本（tar + `$(date +%F)` 按天命名 + 全绝对路径 + 无输出）、手工跑通并解压回读、再挂 `crontab -e`；crontab 行末尾统一 `&>/dev/null`，文件开头定义 PATH 与 `MAILTO=""`。
3. tar 打包用 `-C` 切目录 + 相对路径，避免绝对路径被剥 `/` 与解压覆盖系统文件；`%` 在 crontab 命令列是特殊符号，date 类命令放进脚本最省心。
4. 排错三板斧顺序固定：`cat /var/spool/cron/用户名` 确认落盘 → `grep CMD /var/log/cron` 确认执行 → 有 `CMD` 但结果不对就查环境变量（cron 的 PATH 只有 `/usr/bin:/bin`，命令写绝对路径或 crontab 定义 PATH）。
5. 输出不重定向的两种磁盘事故：postfix 开着撑爆 `/var/spool/mail/root`（block），关着堆爆 `/var/spool/postfix/maildrop/`（inode），统一 `&>/dev/null` + `MAILTO=""` 根治。
6. 用户级 crontab 是 6 段（五段时间 + 命令，以编辑者身份执行），`/etc/crontab` 与 `/etc/cron.d/*` 是 7 段（多一个用户列）；`/etc/cron.d` 文件名不能含点；`crontab -r` 先 `-l` 备份快照再动手。
{% endraw %}
