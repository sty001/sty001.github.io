---
title: "day32-secure日志安全分析进阶作业实操"
date: 2026-10-24 09:25:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-33"
---

{% raw %}



整套课程最经典的一道综合实战题就是它：课程第 32 天的作业给了一份约 51MB、近 50 万行的 SSH 认证日志 `secure-20161219`，要求用 grep、awk、sort、uniq 三剑客组合找出 SSH 爆破的来源 IP、被爆破的用户名，核对成功登录的 IP 是否藏在爆破名单里，最后给出防护建议。正则、三剑客、排序统计、日志分析全串在一条「安全分析流水线」上，面试和工作中出场率都极高。

## 实操环境说明
{: .sec-prac}

- **A 级（已真实执行）**：本篇所有分析命令（wc/head/grep/awk/sort/uniq/du）都在真实日志上实际运行，文中输出为真实结果，标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：fail2ban 等防护软件的安装配置属系统级操作，给出真实可用的配置片段与预期效果，标注 `预期输出`。

待分析日志为课程提供的 `secure-20161219`（51053780 字节，约 51MB），是某台暴露在公网上的 Linux 服务器 2016 年 12 月 11 日至 19 日的 SSH 认证日志。日志里的攻击源均为公网 IP，按脱敏规则原样保留；本机主机名为 `localhost`，无内网信息。实操目录统一用 `/tmp/hw/day32`。环境实测：GNU bash、GNU awk，`head` 截取 20 万行样本耗时约 0.2 秒，整文件分析单条命令秒级完成。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 认识日志：统计总行数、查看格式 | A 级 |
| 题 2 | 统计 Failed / Accepted password 条数 | A 级 |
| 题 3 | 统计爆破失败次数最多的前 10 个 IP | A 级 |
| 题 4 | 统计被爆破最多的前 10 个用户名 | A 级 |
| 题 5 | 对比成功登录 IP 是否在爆破名单里 | A 级 |
| 题 6 | 大文件处理技巧与按天统计 | A 级 |
| 题 7 | 给出防护建议（fail2ban / 密钥登录 / 改端口） | B 级 |

## 题 1：认识日志——总行数与格式

**考察点**：拿到陌生大日志的第一反应不是马上 grep，而是「先看量级、再看格式」。行数决定策略（是否需要采样），格式决定 awk 取列的写法。

### 步骤 1：统计总行数与文件大小（已实操）
{: .sec-prac}

```bash
mkdir -p /tmp/hw/day32 && cd /tmp/hw/day32
LOG=/path/to/secure-20161219        # 换成你的日志实际路径
wc -l "$LOG" && du -h "$LOG"
```

输出：

```console
$ wc -l "$LOG" && du -h "$LOG"
494732 /path/to/secure-20161219
49M	/path/to/secure-20161219
```

49 万行、49MB，grep/awk 单遍扫描毫无压力；如果日志是几个 GB，就要考虑先采样（见题 6）。

### 步骤 2：看头尾确认格式（已实操）
{: .sec-ver}

```bash
head -5 "$LOG"
echo '--- tail ---'
tail -3 "$LOG"
```

输出：

```console
$ head -5 "$LOG"
Dec 11 03:49:23 localhost sshd[27086]: Did not receive identification string from 123.31.34.190 port 55390
Dec 11 03:49:24 localhost sshd[27087]: Invalid user support from 123.31.34.190 port 55493
Dec 11 03:49:24 localhost sshd[27087]: input_userauth_request: invalid user support [preauth]
Dec 11 03:49:25 localhost sshd[27087]: error: Could not get shadow information for NOUSER
Dec 11 03:49:25 localhost sshd[27087]: Failed password for invalid user support from 123.31.34.190 port 55493 ssh2
--- tail ---
Dec 19 03:42:00 localhost sshd[9030]: Failed password for root from 59.63.166.84 port 65111 ssh2
Dec 19 03:42:00 localhost sshd[9030]: Failed password for root from 59.63.166.84 port 65111 ssh2
Dec 19 03:42:01 localhost sshd[9030]: Failed password for root from 59.63.166.84 port 65111 ssh2
```

从这 8 行就能读出三个关键信息：

1. 日志格式是标准 syslog：`月 日 时间 主机名 进程[pid]: 消息`，时间跨度 12 月 11 日到 19 日；
2. `Failed password for` 有**两种形态**——`for root from ...`（用户存在）和 `for invalid user support from ...`（用户不存在），写 awk 时必须同时兼容；
3. 日志开头就在被爆破（`123.31.34.190` 连续试 invalid user），说明这台机器 24 小时暴露在扫描之下。

> **易错点**：取用户名时如果直接写 `awk '{print $9}'`，对 `invalid user` 行会取到 `invalid` 而不是用户名，因为两种行的字段位置不同。解决办法见题 4。

## 题 2：统计 Failed / Accepted password 条数

**考察点**：`grep -c` 计数、以及「从成功与失败的比例里读出服务器处境」。

```bash
echo -n "Failed password 行数: "; grep -c "Failed password" "$LOG"
echo -n "Accepted password 行数: "; grep -c "Accepted password" "$LOG"
echo -n "Invalid user 行数: "; grep -c "Invalid user" "$LOG"
```

输出：

```console
$ echo -n "Failed password 行数: "; grep -c "Failed password" "$LOG"
Failed password 行数: 367490
$ echo -n "Accepted password 行数: "; grep -c "Accepted password" "$LOG"
Accepted password 行数: 1
$ echo -n "Invalid user 行数: "; grep -c "Invalid user" "$LOG"
Invalid user 行数: 1592
```

结论先摆出来：9 天内 36.7 万次密码认证失败，只有 1 次成功登录。这台机器正被高强度爆破；好在唯一一次成功登录极可能就是管理员本人，是否失陷要到题 5 才能定论。

两个伴随指标也要能看懂：`Invalid user` 出现 1592 次，表示攻击者尝试了大量**本机不存在**的用户名（如 support、ubnt），属于撒网式字典扫描的典型特征；而题 1 里那句 `Could not get shadow information for NOUSER` 是 sshd 对「无效用户查影子口令」的内部提示，属于正常伴随日志，不用当成故障处理。分析日志时分清「攻击痕迹」与「服务自身噪声」，统计结论才不会被噪声带偏。

顺手看一眼这唯一一次成功登录长什么样（已实操）：

```bash
grep "Accepted password" "$LOG"
```

输出：

```console
$ grep "Accepted password" "$LOG"
Dec 14 15:34:49 localhost sshd[18104]: Accepted password for root from 221.130.47.1 port 2872 ssh2
```

**验证方法**：`grep -c "Failed password"` 的结果加上 `grep -c "Accepted password"` 应远小于总行数（本例 367491 / 494732 ≈ 74%），剩下的行是 `Invalid user`、`input_userauth_request`、`Did not receive identification string` 等伴随日志——一次爆破请求会产生多条日志，比例对得上才说明没数错。

## 题 3：爆破失败次数最多的前 10 个 IP

**考察点**：`awk 按条件取列 + sort + uniq -c + sort -rn + head` 这条统计流水线，它是 Linux 运维里最高频的一段组合命令。

**实现思路**：`Failed password` 行里 IP 跟在 `from` 后面，与其数死第几列，不如让 awk 找到 `from` 这个词、打印它的下一列，两种行格式通吃；再交给 `sort`（uniq 只认相邻行，必须先排序）、`uniq -c` 计数、`sort -rn` 按次数倒序、`head -10` 取前 10。

```bash
awk '/Failed password/ {for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' "$LOG" \
  | sort | uniq -c | sort -rn | head -10
```

输出（真实结果）：

```console
  68652 218.65.30.25
  34326 218.65.30.53
  21201 218.87.109.154
  18065 112.85.42.103
  17164 112.85.42.99
  17163 218.87.109.151
  17163 218.87.109.150
  17163 218.65.30.61
  17163 218.65.30.126
  17163 218.65.30.124
```

结果解读三条：

1. 头号攻击源 `218.65.30.25` 单独贡献 68652 次失败，9 天平均每天 7600 多次，是典型的高频爆破源；
2. `218.65.30.0/24`、`218.87.109.0/24`、`112.85.42.0/24` 三个网段各有 3~5 台机器上榜且次数高度接近（17163 出现了 5 次），这是同一批肉鸡分摊任务的特征，建议按**网段**封禁；
3. 想知道一共有多少个攻击源，把流水线尾巴换成 `sort -u | wc -l`：

```bash
awk '/Failed password/ {for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' "$LOG" | sort -u | wc -l
```

输出：

```console
$ awk '/Failed password/ {for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' "$LOG" | sort -u | wc -l
87
```

9 天、87 个攻击源、36.7 万次尝试——单一 IP 封禁是封不完的，防护必须上自动化（见题 7）。

### 补充步骤：按 /24 网段聚合，看清「团伙作战」（已实操）
{: .sec-ext}

单个 IP 榜只能看到点，把 IP 聚合到 C 段才能看到面。用 awk 的 `split()` 把 IP 切成四段、丢弃最后一段再拼上 `.0/24`，同样的流水线直接复用：

```bash
awk '/Failed password/ {for(i=1;i<=NF;i++) if($i=="from") {split($(i+1),a,"."); print a[1]"."a[2]"."a[3]".0/24"}}' "$LOG" \
  | sort | uniq -c | sort -rn | head -5
```

输出（真实结果）：

```console
 188793 218.65.30.0/24
  69555 112.85.42.0/24
  55527 218.87.109.0/24
  34326 182.100.67.0/24
   3289 222.186.50.0/24
```

前三个网段合计 188793 + 69555 + 55527 = 313875 次，占全部失败数 367490 的约 **85%**——攻击高度集中在三个 C 段，几乎可以断定是同一批僵尸网络的分片。这个结论直接决定防护动作：安全组里封 3 个网段比封 87 个 IP 高效得多，也是 fail2ban 之外值得立刻执行的一条规则。

> **易错点**：漏掉中间的 `sort` 直接 `uniq -c`，统计结果会碎成大量计数为 1 的行，因为 `uniq` 只对**相邻**重复行生效。`awk+sort+uniq` 三件套里，sort 是不可省略的一环。

## 题 4：被爆破最多的前 10 个用户名

**考察点**：处理「字段位置不固定」的两类行；正则分组提取与 sed 清洗。

**实现思路**：用 `awk -F'for | from'` 以「for 」和「 from」做分隔符，第 2 列就是要的用户名（invalid user 行会带上 `invalid user ` 前缀，用 sed 统一去掉）。

```bash
grep "Failed password" "$LOG" \
  | awk -F'for | from' '{print $2}' \
  | sed 's/invalid user //' \
  | sort | uniq -c | sort -rn | head -10
```

输出（真实结果）：

```console
 364610 root
    725 admin
    245 user
    119 oracle
    104 support
     79 guest
     70 test
     47 ubnt
     41 pi
     36 webadmin
```

结果解读：

1. `root` 占 364610 / 367490 ≈ **99.2%**——攻击者默认 root 远程登录是开放的，这是全网爆破的普遍假设；
2. `admin`、`oracle`、`ubnt`（Ubiquiti 设备默认账号）、`pi`（树莓派默认账号）都是字典里的常客，说明这是通用字典扫描，不是针对本机的定向攻击；
3. 用户名清单里没有出现真实人名、邮箱等敏感信息，无需额外打码。

另一种写法是在 awk 里用 `match()` + 字段回溯（结果与上面一致）：

```bash
awk '/Failed password/ {if(match($0, /for (invalid user )?[^ ]+ from/)) {u=$0; sub(/.*for (invalid user )?/,"",u); sub(/ from.*/,"",u); print u}}' "$LOG" | sort | uniq -c | sort -rn | head -3
```

输出：

```console
364610 root
   725 admin
   245 user
```

**验证方法**：把两种写法的输出并排 diff 一下，完全一致即互相印证；再抽一条 `invalid user` 原始日志人工核对用户名提取是否正确。

## 题 5：成功登录 IP 是否藏在爆破名单里

**考察点**：安全分析最关键的一步——区分「正常管理员」与「爆破得手」。判据：成功登录的 IP 若同时出现在爆破源列表中，就要按入侵处置；若不在，大概率是本人登录。

```bash
grep "Accepted password" "$LOG" | awk '{print $NF}'    # 先取出成功登录的 IP
awk '/Failed password/ {for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' "$LOG" \
  | sort -u | grep -c '^221.130.47.1$'                 # 再去爆破源名单里找它
```

输出：

```console
$ grep "Accepted password" "$LOG" | awk '{print $NF}'
221.130.47.1
$ awk '/Failed password/ {for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' "$LOG" | sort -u | grep -c '^221.130.47.1$'
0
```

结论：唯一一次成功登录来自 `221.130.47.1`，它在 87 个爆破源名单里**出现 0 次**，且登录时间是 12 月 14 日 15:34（白天工作时段），可初步判定为管理员本人登录，服务器未因爆破失陷。若结果非 0，处置动作是：立即 `w` / `last` 核对在线会话、锁定账号、封禁该 IP、排查 crontab 与历史命令。

再补一个按天的失败分布，看攻击的「作息」（已实操）：

```bash
grep "Failed password" "$LOG" | awk '{print $1" "$2}' | sort | uniq -c | sort -k2.1M
```

输出：

```console
   3255 Dec 19
  18264 Dec 11
  21570 Dec 15
  40233 Dec 12
  45358 Dec 17
  50990 Dec 14
  57281 Dec 13
  60704 Dec 18
  69835 Dec 16
```

注意排序尾巴的 `-k2.1M`：`M` 是按月份名排序（Dec < Jan < Feb…），比按字典序硬排时间列稳得多。每天 1.8 万~7 万次、全天无休，说明是 7x24 挂机爆破，人工盯日志不现实，必须自动化防护。

## 题 6：大文件处理技巧——先采样再分析

**考察点**：生产日志动辄几个 GB，直接全量分析会很慢；`head -N` 截取样本先行验证命令正确性，再对全量执行，是标准作业流程。

```bash
mkdir -p /tmp/hw/day32
time head -200000 "$LOG" > /tmp/hw/day32/sample.log
wc -l /tmp/hw/day32/sample.log && du -h /tmp/hw/day32/sample.log
```

输出：

```console
$ time head -200000 "$LOG" > /tmp/hw/day32/sample.log
real	0m0.215s
user	0m0.061s
sys	0m0.108s
$ wc -l /tmp/hw/day32/sample.log && du -h /tmp/hw/day32/sample.log
200000 /tmp/hw/day32/sample.log
20M	/tmp/hw/day32/sample.log
```

20 万行样本截取只花 0.2 秒。在样本上把题 3、题 4 的命令调通：

这个「样本先行」的习惯有两层价值：一是**省时间**——命令写错时秒级重跑，不用反复扫几百 MB 的大文件；二是**保安全**——如果后续要把分析结果转成封禁脚本（比如把 Top IP 写进防火墙规则），先在样本上验证名单格式正确，能避免把错误规则批量推上生产。中间产物（sample.log、统计结果）统一放在 `/tmp/hw/day32`，分析完即可清理，不留在业务机磁盘上。

```bash
awk '/Failed password/ {for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' /tmp/hw/day32/sample.log \
  | sort | uniq -c | sort -rn | head -10
```

输出：

```console
  34512 218.65.30.25
  17164 112.85.42.99
  17163 218.87.109.150
  17163 218.65.30.61
  17163 218.65.30.126
  17163 182.100.67.120
  17163 112.85.42.107
   3289 222.186.50.206
   3265 219.133.29.16
   3206 111.73.46.156
```

样本前 10 与全量前 10 主体重合（前几名一致、后几名因截断略有出入），证明命令正确，再换回 `$LOG` 跑全量得出最终结论。注意：**采样只能用来调试命令，最终数字必须以全量统计为准**。

### 辨析：/var/log/secure 与 /var/log/auth.log

SSH 认证日志的存放路径按发行版分家：CentOS/RHEL 系是 `/var/log/secure`，Ubuntu/Debian 系是 `/var/log/auth.log`。fail2ban 的 `logpath`、监控脚本的 grep 目标都要跟着发行版走，拿 CentOS 的教程直接套 Ubuntu 会一无所获。拿不准就 `ls /var/log/` 看一眼，有哪个是哪个。

## 题 7：防护建议（B 级）
{: .sec-best}

分析完了要能落地，按「见效快慢」给三档建议：

### 第一档：立即生效——禁用 root 密码登录 + 改端口

题 4 显示 99.2% 的爆破目标是 root，题 5 显示管理员用密码登录。配合 day32 主篇的「SSH 爆破防护三板斧」（改端口、密钥登录、fail2ban），这一档就是第一板斧的落地。两步收紧：

```bash
# /etc/ssh/sshd_config
Port 52222                              # 改掉默认 22 端口，规避绝大多数扫描器
PermitRootLogin no                      # 禁止 root 远程登录（先建好普通用户+sudo）
PasswordAuthentication no               # 只允许密钥登录（确认密钥能登录后再改）
MaxAuthTries 3                          # 每连接最多试 3 次密码
systemctl restart sshd
```

改端口后建议保留 22 端口观察一段时间（`Port 22` 与 `Port 52222` 并存），确认新端口可登录再删掉 22，防止把自己锁在门外。

### 第二档：自动化封禁——fail2ban

```bash
yum install -y epel-release && yum install -y fail2ban
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/secure
maxretry = 5
findtime = 600
bantime  = 86400
EOF
systemctl enable --now fail2ban
fail2ban-client status sshd
```

（预期输出，CentOS 7）

```console
$ fail2ban-client status sshd
Status for the jail: sshd
|- Filter
|  |- Currently failed: 12
|  |- Total failed:     367490
|- Actions
   |- Currently banned: 23
   |- Total banned:     23
```

以本日志的量级，5 分钟内错 5 次就封 1 天，87 个攻击源会被陆续封掉；`bantime` 可调到 `-1`（永久）。注意 CentOS 7 的 fail2ban 依赖 epel 源，且日志路径是 `/var/log/secure` 而非 Ubuntu 的 `/var/log/auth.log`。

### 第三档：架构级——密钥登录 + 跳板机 + 云安全组
{: .sec-expl}

| 措施 | 做法 | 效果 |
| --- | --- | --- |
| SSH 密钥登录 | `ssh-keygen` 生成密钥对，公钥写入 `~/.ssh/authorized_keys`，关闭密码认证 | 密码爆破彻底失效 |
| 云安全组/防火墙 | 只对办公网出口 IP 放行 22 端口，其余全部拒绝 | 攻击面从全网缩到几个 IP |
| 跳板机 | 生产机不暴露公网，统一经跳板机登录并审计 | 攻击面为零，操作可审计 |
| 监控告警 | Zabbix 监控 secure 日志中 Failed password 增速，超阈值告警 | 被爆破时第一时间知道 |

## 验证方法
{: .sec-ver}

按四条自查，全部满足即完成本作业：

1. 行数、Failed/Accepted/Invalid user 四个计数用 `grep -c` 各跑一遍，比例逻辑自洽；
2. 前 10 攻击 IP 与前 10 用户名用两种写法各算一遍，结果一致；
3. 成功登录 IP 在爆破名单中的计数为 0（或非 0 时给出处置结论）；
4. 至少给出改端口/禁 root/密钥/fail2ban 中的两项可执行配置。

## 本篇小结
{: .sec-sum}

1. 日志分析的标准开局是「`wc -l` 看量级、`head` 看格式」，先弄清数据长什么样再写过滤条件；日志量大时先 `head -N` 截样本调命令，结论以全量统计为准。
2. 统计流水线 `awk 取列 | sort | uniq -c | sort -rn | head` 是本题核心：awk 按条件取列，sort 让相同值相邻（uniq 只认相邻行），uniq -c 计数，sort -rn 倒序，head 取榜。四个环节少一个，结果就废。
3. `Failed password for X from` 有「用户存在」和 `for invalid user X` 两种形态，字段位置不固定，用 `awk -F'for | from'` + `sed 's/invalid user //'` 或 awk 内 `match()` 均可通吃。
4. 本次日志结论：9 天 49.4 万行日志、36.7 万次密码失败、87 个攻击源、99.2% 打 root，成功登录 IP `221.130.47.1` 不在爆破名单中，判定为管理员本人；未失陷但必须立即加固。
5. 防护三档：改端口 + 禁 root 密码登录立竿见影；fail2ban 自动封禁解决「封不完」；密钥登录 + 安全组 + 跳板机把攻击面收敛到零。按网段聚合（/24）能把 87 个攻击源压缩成 3 条封禁规则，这是「从点看面」的分析功力。
6. 这道题的通用价值：同一套流水线换个 `awk` 匹配条件，就能统计 Nginx access 日志的 PV/UV、Top IP、Top URL——面试里的「awk 统计访问日志」与本题同源。
7. 生产上把这条流水线做成 cron 脚本加阈值告警，比出事后翻日志靠谱得多；日志本身记得配 logrotate，别让分析对象膨胀到 GB 级。

> **参见**：awk 命令详解 · 扩展正则表达式与 grep · SSH 服务与密钥登录


{% endraw %}
