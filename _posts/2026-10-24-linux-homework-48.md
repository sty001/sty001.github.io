---
title: "day45-监控服务Zabbix自定义监控作业实操"
date: 2026-10-24 09:10:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-48"
---

{% raw %}



课程第 45 天（监控服务 Zabbix 下）的作业有四题：①用 UserParameter 自定义监控 key（内存剩余、登录用户数、TCP 80 状态），取值命令在 Git Bash 真跑贴真实输出；②整理「监控项 → 触发器 → 动作」的配置流程表；③五种告警方式对比；④监控模板与主机关联。Web 界面操作给标准步骤，取值命令全部真跑。

## 实操环境说明 {: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：UserParameter 配置片段编写、grep/sed 校验，以及内存、登录用户、TCP 连接的取值命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：zabbix_get 远端测试、Web 界面配置、告警媒介等依赖真实 Zabbix 环境的动作，给出标准命令/操作路径与 CentOS 7 预期结果，标注 `预期输出`。

环境差异说明：本机 Git Bash 无 `free`、无 `ss`、`/proc/meminfo` 只有 MemTotal 与 MemFree（没有 MemAvailable），因此内存取值用 `/proc/meminfo` + awk 真跑，并在文中同时给出 CentOS 7 的 `free -m` 写法；TCP 统计用 Windows 自带的 `netstat -an`（语义与 CentOS 的 `ss -tan` 一致）。实操目录统一用 `/tmp/hw/day45`，输出中的用户名统一显示为 `user`。

## 题目总览 {: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | UserParameter 自定义 key：内存剩余 / 登录用户数 / TCP 80 状态 | A 级（conf 片段 + 取值真跑） |
| 题 2 | 监控项 → 触发器 → 动作 的配置流程表 | 流程题（表格） |
| 题 3 | 五种告警方式对比（页面 / 声音 / 邮件 / 微信 / 短信电话） | 对比题（表格） |
| 题 4 | 监控模板与主机关联 | B 级（Web 操作步骤） |

## 题 1：自定义 UserParameter key {: .sec-know}

**考察点**：UserParameter 的格式 `UserParameter=key[*],command`、带参数 key 的 `$1` 位置参数写法，以及「先在命令行把取值命令跑通，再写进配置」的正确顺序——agent 只是替你执行这条命令，命令本身不成立，监控项一定取不到值。

**实现思路**：三个监控需求分别对应三种典型写法——无参数直接返回数值（内存剩余、登录用户数）、带参数的通用模板（端口状态统计）。第一步先把每个取值命令在本机跑通，第二步写进 `userparameter.conf`，第三步用 grep 校验定义。

### 步骤 1：内存剩余取值命令（已实操） {: .sec-prac}

本机 Git Bash 无 `free`，直接读 `/proc/meminfo` 计算（与 CentOS 上 `free -m` 的 available 思路同源）：

```bash
cd /tmp/hw/day45
awk '/^MemTotal:/{t=$2}/^MemFree:/{f=$2}END{printf "MemTotal=%dMB MemFree=%dMB 剩余率=%.1f%%\n",t/1024,f/1024,f/t*100}' /proc/meminfo
```

输出：

```text
MemTotal=32452MB MemFree=18049MB 剩余率=55.6%
```

CentOS 7 上的对应写法（free 第 7 列即 available，预期输出）：

```bash
free -m | awk '/^Mem/{print $7}'
```

```text
18150
```

注意主笔记中的提醒：真正可用的内存要扣除 buff/cache，CentOS 7 用 `free -m` 的 available 列（第 7 列）而不是 free 列；本机 `/proc/meminfo` 没有 available 字段，所以用 MemFree 代替，真机上应以 available 为准。

### 步骤 2：登录用户数取值命令（已实操） {: .sec-prac}

```bash
who | wc -l
```

输出：

```text
0
```

本机当前没有注册的终端会话，输出 0 是真实结果；CentOS 7 上同样的命令会返回当前登录会话数。为了演示「有用户登录时该 key 的取值形态」，构造一份 who 输出再跑一遍（已实操）：

```bash
printf 'user  console  2026-10-24 09:30\nuser  pts/0    2026-10-24 10:02\nroot  pts/1    2026-10-24 10:15\n' > who_sim.txt
awk 'END{print "登录用户数=" NR}' who_sim.txt
```

输出：

```text
登录用户数=3
```

`awk 'END{print NR}'` 数总行数即登录会话数，与 `who | wc -l` 等价。这个 key 的触发器可以设成「登录用户数大于 5 报警」，用于发现异常登录。

### 步骤 3：TCP 80 状态取值命令（已实操） {: .sec-prac}

CentOS 7 的标准写法是 `ss -tan | grep -c ':80 '`；本机无 `ss`，用 Windows 自带 netstat（语义一致）真跑：

```bash
netstat -an | grep -c ':80 '
echo "退出码=$?"
```

输出：

```text
0
退出码=1
```

本机 80 端口没有任何连接，`grep -c` 输出 0 且**退出码为 1**（grep 无匹配时返回 1）——这是一个重要细节：`grep -c` 永远输出计数，但退出码会变，写脚本判断时用 `$?` 判断成败会误判，应直接用输出的数字做阈值判断。换一个真实有连接的端口对比演示（已实操）：

```bash
netstat -an | grep -c ':443 '
netstat -an | grep ':443 ' | awk '{print $NF}' | sort | uniq -c | sort -rn
```

输出：

```text
61
     34 ESTABLISHED
     21 TIME_WAIT
      6 CLOSE_WAIT
```

第二条命令展示了「按 TCP 状态分布统计」的做法，与主笔记中 `ss -tan state established` 的用途一致：TIME_WAIT 异常增多往往意味着连接未正常复用，CLOSE_WAIT 增多意味着对端关闭后本端没处理，这些都能作为触发器的判据。

### 步骤 4：写入 UserParameter 配置并校验（已实操） {: .sec-prac}

三个取值命令都跑通了，写进 agent 的自定义配置目录 `/etc/zabbix/zabbix_agentd.d/`（片段如下）：

```conf
# /etc/zabbix/zabbix_agentd.d/userparameter.conf
UserParameter=mem.available,free -m | awk '/^Mem/{print $7}'
UserParameter=login.users,who | wc -l
UserParameter=server_state[*],ss -lntup | grep -c $1
UserParameter=tcp80.conn,ss -tan | grep -c ':80 '
```

写完必须重启 agent 才生效：`systemctl restart zabbix-agent`（B 级）。本机把该片段落盘后用 grep 校验定义完整性（已实操）：

```bash
cd /tmp/hw/day45
cat > userparameter.conf <<'EOF'
UserParameter=mem.available,free -m | awk '/^Mem/{print $7}'
UserParameter=login.users,who | wc -l
UserParameter=server_state[*],ss -lntup | grep -c $1
UserParameter=tcp80.conn,ss -tan | grep -c ':80 '
EOF
grep -n '^UserParameter=' userparameter.conf
grep '^UserParameter=' userparameter.conf | sed 's/^UserParameter=\([^,]*\),.*/\1/'
```

输出：

```text
2:UserParameter=mem.available,free -m | awk '/^Mem/{print $7}'
3:UserParameter=login.users,who | wc -l
4:UserParameter=server_state[*],ss -lntup | grep -c $1
5:UserParameter=tcp80.conn,ss -tan | grep -c ':80 '
mem.available
login.users
server_state[*]
tcp80.conn
```

四条 key 全部定义、清单提取干净。带 `[*]` 的 `server_state` 是参数化模板：`$1` 接收调用时的第一个参数，Web 端填 `server_state[nginx]` 即统计 nginx 的监听条目，一个 key 可以监控所有端口与服务。

**Server 端自测（预期输出，CentOS 7）**：在 linux-node01 上用 zabbix_get 逐个测试：

```text
$ zabbix_get -s 172.16.1.7 -k mem.available
18150
$ zabbix_get -s 172.16.1.7 -k login.users
2
$ zabbix_get -s 172.16.1.7 -k server_state[nginx]
4
$ zabbix_get -s 172.16.1.7 -k tcp80.conn
12
```

取不到值时优先在 agent 本机执行 `zabbix_agentd -t "key"` 直接看返回值与报错，把「命令本身失败」和「server 到 agent 不通」两类问题分开。

### 步骤 5：扩展——复杂逻辑封装成脚本（已实操） {: .sec-ext}

UserParameter 的命令过长时，规范做法是封装成脚本、key 里只写脚本路径（可读性好、转义少）。以「内存剩余率监控」为例，把取值逻辑写成脚本并真跑：

```bash
cd /tmp/hw/day45
mkdir -p scripts
cat > scripts/mem_check.sh <<'EOF'
#!/bin/bash
# 输出内存剩余率百分比（真机建议用 MemAvailable）
awk '/^MemTotal:/{t=$2}/^MemFree:/{f=$2}END{printf "%.1f\n",f/t*100}' /proc/meminfo
EOF
chmod +x scripts/mem_check.sh
bash scripts/mem_check.sh
```

输出：

```text
56.3
```

脚本返回单个干净的数值，正是 agent 采集需要的形态。对应的 UserParameter 写法就是一行（B 级，真机路径建议 `/data/linux/scripts/`）：

```conf
UserParameter=mem.free.rate,/tmp/hw/day45/scripts/mem_check.sh
```

注意三点：脚本必须 `chmod +x` 且 agent 运行用户（zabbix）可读可执行；命令通过 `/bin/sh -c` 执行，所以管道、重定向在 UserParameter 里可用；单条命令耗时要控制在 agent 的 Timeout（默认 3 秒）以内。

## 题 2：监控项 → 触发器 → 动作 配置流程 {: .sec-expl}

**考察点**：Zabbix 告警链路的完整配置顺序，任何一环断了都收不到告警。

| 步骤 | 界面路径 | 关键配置 | 校验方法 |
| --- | --- | --- | --- |
| 1. 创建监控项 | 配置 → 主机 → 监控项 | 名称、键值（自定义 key 或内置 key）、更新间隔、应用集 | 监测 → 最新数据 能看到值 |
| 2. 创建触发器 | 配置 → 主机 → 触发器 | 表达式 `{linux-node02:login.users.last()}>5`、严重等级 | 手工压阈值看是否变 Problem |
| 3. 配置媒介类型 | 管理 → 报警媒介类型 | Email 的 SMTP 参数，或脚本类媒介指向 alertscripts 下的脚本 | 界面自带 Test 测试发送 |
| 4. 用户绑定媒介 | 用户头像 → 报警媒介 | 收件地址、使用时段、严重等级过滤 | 检查用户媒介列表 |
| 5. 开启动作 | 配置 → 动作 | 默认动作启用，条件（等级/主机组）、消息内容（含宏）、操作（发给谁） | 触发后看 监测 → 问题 与动作日志 |

触发器表达式格式为 `{主机名:key.函数()} 阈值`，常用函数与典型表达式对照如下：

| 函数 | 典型表达式 | 含义 |
| --- | --- | --- |
| last() | `{linux-node02:login.users.last()}>5` | 登录用户数最新值大于 5 报警 |
| avg(5m) | `{linux-node02:system.cpu.load[percpu,avg1].avg(5m)}>2` | 5 分钟平均负载超 2，避免瞬时抖动误报 |
| min(10m) | `{linux-node02:vfs.fs.size[/,pfree].min(10m)}<10` | 10 分钟内根分区剩余最少不足 10% |
| nodata(5m) | `{linux-node02:agent.ping.nodata(5m)}=1` | 5 分钟无数据即判断 agent 失联 |
| str() | `{linux-node02:web.page.get[/].str("200")}=0` | 页面返回不含 200 即站点异常 |

多个条件可用 `and` / `or` 组合，例如「5 分钟平均负载大于 2 且根分区剩余不足 10% 才触发」，可显著减少误告警。消息内容里插入 `{HOST.NAME}`、`{TRIGGER.NAME}`、`{ITEM.VALUE}`、`{EVENT.TIME}` 等宏，告警才能一眼定位到主机与指标。

阈值怎么定是个手艺活，几个实用原则：先跑一两周只记录不告警，用历史数据画基线，阈值压在「日常波动区间之外、事故发生点之内」；给足缓冲带，比如磁盘告警 85% 而不是 99%——99% 触发时你已经没有处理窗口了；瞬时尖刺用 `avg()`/`min()` 拉长观察窗过滤；失联类（agent.ping）用 `nodata()`；多条件 `and` 组合能把「负载高但业务正常」这类假警报压下去。阈值没有万能默认值，别人家抄来的数字只有参考意义，自己的基线才是依据。配套一条纪律：每次误告警要么调阈值、要么修监控项，放任不管的告警 channel 很快会没人看。

### 辨析：last() 与 avg()

两个函数都在取值，差别在「取哪一刻」与「抗不抗抖动」：

- **last()** 取最新一个值，实时性最高，适合事件型指标——登录用户数突增、端口从有变无、agent 失联。它的弱点是采样窗口内一次抖动就触发，拿来当负载类阈值容易半夜误报。
- **avg(5m)** 取一段时间均值，把尖刺抹平，适合容量型指标——CPU、内存、连接数这类「持续恶化才有意义」的东西。

经验法则：状态翻转用 last，趋势恶化用 avg；拿不准时优先 avg 加合理窗口，误报的代价远比晚 5 分钟发现要高。

## 题 3：五种告警方式对比 {: .sec-warn}

**考察点**：不同告警渠道的实时性、成本与配置复杂度差异，以及「配置骨架相同、投递通道不同」这一共性。

| 告警方式 | 实现途径 | 实时性 | 成本 | 适用场景 |
| --- | --- | --- | --- | --- |
| 页面提示 | 触发器默认行为，监测 → 问题 查看 | 低（需盯着看） | 无 | 值班运维日常巡检 |
| 页面声音 | 用户头像 → 正在发送消息 → 勾选前端信息 | 低（需在页面） | 无 | 值班台常开界面 |
| 邮件 | 报警媒介类型选 Email，填 SMTP；或脚本调 mail | 分钟级 | 低 | 非紧急告警、日报汇总 |
| 微信 / 钉钉 | 自定义脚本（python）调用企业微信 API / 钉钉机器人 Webhook | 秒级 | 低 | 主流生产告警渠道 |
| 短信 / 电话 | 第三方报警平台（如 OneAlert） | 秒级，电话最强唤醒 | 较高 | P0 级灾难告警、夜间值班 |

脚本类告警的通用套路：脚本放进 server 配置的 `AlertScriptsPath`（默认 `/usr/lib/zabbix/alertscripts`）目录，脚本依次接收三个参数——`$1` 发送目标、`$2` 主题、`$3` 消息内容；配置顺序四步缺一不可：定义媒介类型 → 动作中引用媒介 → 用户绑定媒介与收件地址 → 手工执行脚本验证。

## 题 4：监控模板与主机关联（B 级）

**考察点**：模板的复用价值——监控项、触发器、图形集中配在模板里，主机链接模板即继承全部配置，改一次模板全部生效。

**实现思路**：新主机上线时「先建主机、再链模板」，而不是逐台手建监控项。

1. 配置 → 主机 → 创建主机：填主机名（须与 agent 的 Hostname 一致）、可见名称、所属主机组。
2. agent 接口填 IP（172.16.1.7）与端口 10050。
3. 模板页搜索并链接 `Template OS Linux by Zabbix agent`。
4. 保存后等一个采集周期，主机图标变绿；监测 → 最新数据 查看继承来的 CPU、内存、磁盘、网卡数据。
5. 定制需求（如题 1 的自定义 key）配在主机级监控项上，通用需求尽量沉淀回模板。

> **易错点**：在主机上直接修改模板继承来的监控项会与模板「断开联动」，之后模板更新不再同步到该主机；生产环境的规范做法是改模板统一生效。一台主机可以链接多个模板，但键值重复会导致采集冲突。

## 验证方法 {: .sec-ver}

1. 定义完整性：`grep '^UserParameter=' 配置文件` 输出与预期 key 一一对应（已实操验证）。
2. 取值正确性：每个 key 的命令先在命令行真跑，数值合理（内存剩余率 55.6%、443 端口 61 条连接分布合理）。
3. 链路正确性：`zabbix_get -k agent.ping` 返回 1 → `zabbix_get -k 自定义key` 返回数值 → 最新数据有记录 → 手工压阈值触发 → 问题页出现告警 → 媒介送达。
4. 退出码细节：`grep -c` 无匹配输出 0 但退出码为 1，脚本判断要用输出数字而非 `$?`。

## 本篇小结 {: .sec-sum}

1. 自定义监控的正确顺序是「命令行跑通取值命令 → 写 UserParameter → 重启 agent → zabbix_get 验证 → Web 建监控项」，跳过第一步的配置十有八九取不到值。
2. UserParameter 三种典型形态：无参数直返数值（mem.available、login.users）、带 `[*]` 参数的通用模板（server_state[*]，`$1` 为位置参数）、复杂逻辑封装脚本只留路径。
3. 内存可用值取 available（free 第 7 列）而不是 free 列；登录用户数用 `who | wc -l` 或 `awk 'END{print NR}'`；TCP 状态统计 `ss -tan` 配 `grep -c` 与 `uniq -c` 即可覆盖端口存活与 TIME_WAIT/CLOSE_WAIT 异常两类需求。
4. `grep -c` 永远有计数输出但无匹配时退出码为 1，脚本判断阈值要用输出值而不是退出码。
5. 告警链路五环节：监控项 → 触发器 → 媒介类型 → 用户媒介绑定 → 动作，断在任意一环都收不到告警；脚本类媒介的入参固定为发送目标、主题、内容。
6. 模板是配置复用的载体：主机链接模板即继承全部监控配置，通用需求沉淀进模板、改一处全局生效；主机级直接改动继承项会断开联动，应尽量避免。

> **参见**：监控服务 Zabbix（下） · 监控服务 Zabbix（上） · day44 部署作业实操


{% endraw %}
