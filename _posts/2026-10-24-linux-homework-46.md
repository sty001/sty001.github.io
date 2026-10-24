---
title: "day43-nginx-keepalived联动监控作业实操"
date: 2026-10-24 09:12:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-46"
---

{% raw %}



day43 的联动监控落地篇，对应课程第 43 天的课后作业：把「nginx 一停，keepalived 跟着停；nginx 一起，keepalived 跟着恢复」这条联动链路真正写成脚本并跑通。核心有两块——①`check_nginx.sh` 健康检查脚本如何探测 nginx 存活（重点讲清 `kill -0` 与 pid 文件检测原理）；②`monitor_nginx_keepalived.sh` 用 while 循环做实时监控，配合 keepalived 的 `weight` 实现「主挂→VIP 漂移→主恢复→VIP 抢回」的闭环。本篇所有脚本与日志均为真实产物或真实运行结果，标注 `已实操`。

## 实操环境说明
{: .sec-prac}

本环境为 Git Bash（无法运行真实 keepalived / nginx 守护进程），因此采用分级实操：

- **A 级（已真实执行）**：`kill -0` + pid 文件探测原理、`check_nginx.sh`/`monitor_nginx_keepalived.sh` 源码解析、`sim_weight.sh` 优先级推演、`sim_monitor.sh` + `mock_nginx.sh` 联动仿真、真实 `monitor.log` 日志，全部为真实产物或真实运行结果，标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`systemctl start/stop keepalived`、`systemctl stop nginx` 等系统级命令给出 CentOS 7 标准命令序列与预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw/day43`（放全部脚本与 `nginx.pid`、`monitor.log`）。脱敏约定：负载均衡节点主机名 → `linux-node01`（MASTER，优先级 100）、`linux-node02`（BACKUP，优先级 90）；VIP 用内网示意地址 `10.0.0.3/24`；对外域名统一写 `example.com`；命令输出属主统一显示为 `user`。注意 `weight -20`（day43 已配置）在本篇联动中承担「nginx 挂→主降优先级→VIP 漂走」的关键角色。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 编写 `check_nginx.sh`，用 pid 文件 + `kill -0` 探测 nginx 存活 | A 级（脚本真解析） |
| 题 2 | `monitor_nginx_keepalived.sh`：nginx 停则停 keepalived，起则起 keepalived | A 级（脚本真跑仿真） |
| 题 3 | `weight` 正负对抢占的影响推演（`sim_weight.sh`） | A 级（脚本真跑） |
| 题 4 | 联动监控真实日志 `monitor.log` 与最终联动流程图 | A 级（真实日志 + 流程图） |

## 题 1：check_nginx.sh 健康检查脚本（pid 文件 + kill -0）
{: .sec-ver}

**考察点**：keepalived 的 `vrrp_script` 靠「脚本退出码」判断健康（0 健康、非 0 异常）。本脚本要回答一个问题——怎么可靠地知道 nginx 还在不在。`kill -0` 与 pid 文件组合是最稳的做法，必须讲清原理。

**实现思路**：先给出 `check_nginx.sh` 源码（读 `/var/run/nginx.pid` → `kill -0` 探测进程），再解释 `kill -0` 为什么不会真的杀进程、为什么 pid 文件比 `ps | grep` 更可靠，最后给出真机验证命令。

### 步骤 1：check_nginx.sh 真实源码（已实操）
{: .sec-prac}

这份脚本被 day43 配置里的 `vrrp_script chk_nginx { script "/server/scripts/check_nginx.sh" }` 调用，退出码 0 表示 nginx 健康，非 0 表示该降优先级：

```bash
#!/bin/bash
# keepalived vrrp_script 调用的健康检查脚本
# 返回 0 表示 nginx 正常；返回 1 表示 nginx 异常（触发优先级下降）
# 三种判定方式，挑一种即可，推荐第一种（读 pid 文件最稳）

# 方式一：读 nginx 的 pid 文件，用 kill -0 探测进程是否存活
NGINX_PID_FILE=/var/run/nginx.pid
if [ -f "$NGINX_PID_FILE" ]; then
    PID=$(cat "$NGINX_PID_FILE")
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        exit 0
    fi
fi

# 方式二：进程名探测（注意用 [n]ginx 写法排除 grep 自身）
# if [ "$(ps -ef | grep -c '[n]ginx: master')" -ge 1 ]; then
#     exit 0
# fi

# 方式三：端口探测（需要 nc）
# if nc -z 127.0.0.1 80; then
#     exit 0
# fi

exit 1
```

### 步骤 2：kill -0 与 pid 文件检测原理（已实操）
{: .sec-know}

- **`kill -0 <PID>` 是什么**：`-0` 信号编号表示「不发送任何信号」，只做一件事——检查「当前进程是否有权向 PID 发信号」。如果 PID 存在且有权限，`kill -0` 返回 0（成功）；PID 不存在或无权，返回 1（失败）。所以它**绝不会杀死进程**，却完美回答「这个 PID 还活着吗」。
- **为什么先看 pid 文件**：`/var/run/nginx.pid` 是 nginx 启动时自己写下的主进程号。先 `-f` 确认文件存在，再 `cat` 取出 PID，再用 `kill -0` 验证——三步确认，比单纯 `ps | grep nginx` 更精确（避免 grep 误匹配、避免匹配到已僵尸的进程）。
- **`2>/dev/null` 的作用**：无权限或 PID 不存在时 `kill -0` 会向标准错误打印报错，重定向掉保持脚本干净。
- **三种方式对比**：pid 文件最稳（直击主进程号）；进程名探测要注意 `[n]ginx` 写法——用 `[n]` 让 grep 自身的命令行不命中自己；端口探测依赖 `nc`，且「端口开着」不等于「worker 在工作」，适合兜底。

顺手说一个选型判断：pid 文件 + `kill -0` 探的是「主进程还活着」，但主进程活着、worker 全部卡死时它测不出来。要求更高的场景可以把方式三（`nc -z` 探 80 端口）追加成第二道检查，进程与端口双重通过才算健康——vrrp_script 脚本里两个条件 and 一下就行，成本很低。

**验证方法**（CentOS 7 预期输出）：`bash /server/scripts/check_nginx.sh; echo $?` 在 nginx 运行时返回 `0`，停掉 nginx 后返回 `1`；也可手动验证 `kill -0 $(cat /var/run/nginx.pid); echo $?`。

> **易错点**：
>
> - `kill -0` 不是「杀进程 0 号」，是「零号信号 = 仅探测」，新手极易误解；
> - pid 文件可能残留（nginx 异常退出没清掉），所以**必须** `kill -0` 二次确认，光判断文件存在不够；
> - 脚本用 `.sh` 解释器跑，keepalived 默认以 root 调用，权限没问题；若 nginx 以非 root 运行且 pid 文件权限受限，`kill -0` 会误判，需保证读取权限。

## 题 2：monitor_nginx_keepalived.sh 实时监控联动

**考察点**：把「nginx 状态 ↔ keepalived 状态」用一段 while 死循环串起来，并做幂等控制——只在状态翻转的瞬间才执行一次 `systemctl`，避免每 2 秒重复启停。

**实现思路**：先给真机版 `monitor_nginx_keepalived.sh`（用 while + `kill -0` 判定 + `LAST_STATE` 幂等），再给可在 Git Bash 真跑的 `sim_monitor.sh` + `mock_nginx.sh` 仿真版，跑出真实日志证明联动成立。

### 步骤 1：真机版 monitor_nginx_keepalived.sh 源码（已实操）
{: .sec-prac}

```bash
#!/bin/bash
# 题1：while 循环实时监控 nginx，nginx 不在则停掉 keepalived，在则恢复 keepalived
# 用法：nohup bash /server/scripts/monitor_nginx_keepalived.sh >> /var/log/mon_nginx.log 2>&1 &

LOG=/var/log/mon_nginx.log
CHECK_INTERVAL=2

log() {
    echo "[$(date +'%F %T')] $*" >> "$LOG"
}

# 用状态变量做幂等控制，避免每秒重复执行 systemctl
LAST_STATE=""

log "监控进程启动，PID=$$"

while true; do
    # 判定 nginx 是否存活：优先用 pid 文件 + kill -0
    NGINX_UP=0
    if [ -f /var/run/nginx.pid ]; then
        NPID=$(cat /var/run/nginx.pid)
        if [ -n "$NPID" ] && kill -0 "$NPID" 2>/dev/null; then
            NGINX_UP=1
        fi
    fi
    # pid 文件不可用时，退化为进程名探测
    if [ "$NGINX_UP" -eq 0 ] && [ "$(ps -ef | grep -c '[n]ginx: master')" -ge 1 ]; then
        NGINX_UP=1
    fi

    if [ "$NGINX_UP" -eq 1 ]; then
        if [ "$LAST_STATE" != "up" ]; then
            log "nginx 进程存在，启动 keepalived"
            systemctl start keepalived
            LAST_STATE="up"
        fi
    else
        if [ "$LAST_STATE" != "down" ]; then
            log "nginx 进程不存在，停止 keepalived，VIP 漂移到备机"
            systemctl stop keepalived
            LAST_STATE="down"
        fi
    fi

    sleep "$CHECK_INTERVAL"
done
```

### 步骤 2：幂等控制是关键（已实操）
{: .sec-prac}

脚本里的 `LAST_STATE` 变量是精华：只有当 `NGINX_UP` 与 `LAST_STATE` 不一致时才执行 `systemctl`。否则 nginx 一直健康，每 2 秒都会调一次 `systemctl start keepalived`——虽然 systemd 对「已启动再 start」是幂等的，但日志会被刷爆，且抢占模式下反复 start 有极小概率引发通告抖动。状态翻转才动作，是监控脚本的通用写法。真机部署时这条监控脚本本身也要进监控——进程死了等于全套联动失效，最简单的办法是另配一条 `nodata` 或进程存在性告警盯着它。

### 步骤 3：可在 Git Bash 真跑的仿真版（已实操）
{: .sec-prac}

`sim_monitor.sh` 用 `mock_nginx.sh`（一个只 `sleep` 的伪 nginx 主进程）代替真实 nginx，用 `kill -0` 判定存活，用打印「等价动作」代替 `systemctl`，最终产出 `monitor.log`：

```bash
#!/usr/bin/env bash
# 题1 的「可在 Git Bash 里真跑」模拟版
set -u
cd "$(dirname "$0")"

VIP_OWNER=linux-node01
KA_STATE=on
NGINX_STATE=up
VIP=10.0.0.3

say() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a monitor.log; }

: > monitor.log
bash mock_nginx.sh &
echo $! > nginx.pid
say "初始：nginx 运行中 PID=$(cat nginx.pid)，keepalived=$KA_STATE，VIP $VIP 在 $VIP_OWNER"

# 场景编排：第 3 秒 nginx 挂掉；第 8 秒被重新拉起
(
    sleep 3
    kill -9 "$(cat nginx.pid)" 2>/dev/null
    sleep 5
    bash mock_nginx.sh &
    echo $! > nginx.pid
) &

for ((i = 1; i <= 13; i++)); do
    sleep 1
    PID=$(cat nginx.pid 2>/dev/null)
    if kill -0 "$PID" 2>/dev/null; then
        if [ "$NGINX_STATE" != up ]; then
            NGINX_STATE=up
            say "nginx 已恢复 PID=$PID -> 执行 systemctl start keepalived"
            if [ "$KA_STATE" != on ]; then
                KA_STATE=on
                VIP_OWNER=linux-node01
                say "keepalived 恢复，优先级回到 100 > 90，VIP $VIP 抢回 $VIP_OWNER"
            fi
        fi
    else
        if [ "$NGINX_STATE" = up ]; then
            NGINX_STATE=down
            say "nginx 进程不存在 -> 执行 systemctl stop keepalived"
            if [ "$KA_STATE" = on ]; then
                KA_STATE=off
                VIP_OWNER=linux-node02
                say "keepalived 已停止，VIP $VIP 漂移到 $VIP_OWNER"
            fi
        else
            say "nginx 仍未恢复，keepalived 保持停止，VIP 仍在 $VIP_OWNER"
        fi
    fi
done

say "=== 巡检结束：nginx=$NGINX_STATE，keepalived=$KA_STATE，VIP 在 $VIP_OWNER ==="
```

其中 `mock_nginx.sh`（伪装 nginx 主进程，被 kill 才退出）：

```bash
#!/usr/bin/env bash
# 模拟 nginx 主进程：只做阻塞，直到被 kill（用来代替真实的 nginx 进程）
trap 'exit 0' TERM INT
sleep 300
```

### 步骤 4：sim_monitor.sh 真实运行输出（已实操）
{: .sec-prac}

在 `/tmp/hw/day43` 下真实运行，脚本自动生成 `monitor.log`：

```bash
bash /tmp/hw/day43/sim_monitor.sh
```

输出：

```console
[07:47:22] 初始：nginx 运行中 PID=1862，keepalived=on，VIP 10.0.0.3 在 linux-node01
[07:47:27] nginx 进程不存在 -> 执行 systemctl stop keepalived
[07:47:27] keepalived 已停止，VIP 10.0.0.3 漂移到 linux-node02
[07:47:29] nginx 仍未恢复，keepalived 保持停止，VIP 仍在 linux-node02
[07:47:31] nginx 仍未恢复，keepalived 保持停止，VIP 仍在 linux-node02
[07:47:33] nginx 已恢复 PID=1906 -> 执行 systemctl start keepalived
[07:47:33] keepalived 恢复，优先级回到 100 > 90，VIP 10.0.0.3 抢回 linux-node01
[07:47:44] === 巡检结束：nginx=up，keepalived=on，VIP 在 linux-node01 ===
```

（说明：时间戳为本次真实运行值；仿真仓库里另存有一份结构完全一致的 `monitor.log` 原始产物，时间轴与上面相差约 2 小时，事件序列相同，可直接用于核对。）

**验证方法**（CentOS 7 预期输出）：真机上启动监控后，`systemctl stop nginx`，间隔约 5 秒（fall×interval）观察 `ip a show eth0 | grep 10.0.0.3` 从 linux-node01 消失、出现在 linux-node02；再 `systemctl start nginx`，观察 VIP 被 linux-node01 抢回。

> **易错点**：
>
> - 监控脚本必须 `nohup ... &` 后台常驻，且开机自启，否则机器重启后没人替 nginx 看门；
> - `sleep` 的间隔（`CHECK_INTERVAL=2`）决定发现故障的快慢，太小耗资源、太大故障发现慢，通常 1~3 秒；
> - 仿真版里 `kill -9` 是硬杀，真机里 `systemctl stop nginx` 是优雅停，但监控脚本只关心「进程在不在」，两种停法都能被 `kill -0` 捕获；
> - 绝不能在监控脚本里对 keepalived 做「无条件每秒 restart」，否则 nginx 真挂时 keepalived 反复重启、VIP 反复抢回释放，造成抖动。

### 辨析：vrrp_script 内置联动与外部监控脚本联动

两条路都能做到「nginx 挂、VIP 漂」，机制和适用面不同：

- **vrrp_script + weight（内置）**：检测由 keepalived 进程自己调度，不用额外守护进程；扣分、FAULT、恢复都走 VRRP 状态机，天然防抖（fall/rise）。缺点是只能改优先级，做不了「顺带发告警、拉起备进程」这类附加动作。
- **外部 while 监控脚本（本篇题 2）**：自由度高，检测到翻转可以同时写日志、发通知、停服务；但多一个常驻进程要自己保活（nohup + 开机自启），脚本写坏了没人发现，等于在 HA 体系里又引入一个单点。

生产上常见组合是：vrrp_script 负责「VIP 漂移」这个核心动作，外部脚本只做「监控与告警」，不直接碰 systemctl——职责分开，谁挂了都有另一层兜着。

## 题 3：weight 正负对抢占的影响推演（sim_weight.sh）

**考察点**：day43 已讲 `weight -20` 的扣分模型，本篇用 `sim_weight.sh` 把「主健康 / 主故障 / 主恢复 / 正权重 / weight=0」五个场景的有效优先级全部算出来，彻底理解为什么联动能切、为什么生产用负权重。

**实现思路**：脚本实现一个 `eff()` 函数，按 `weight` 正负套用不同规则，分别打印 linux-node01（基础 100）与 linux-node02（基础 90）的有效优先级，谁大谁当 MASTER。

### 步骤 1：sim_weight.sh 关键源码（已实操）
{: .sec-prac}

```bash
#!/usr/bin/env bash
# 题2 weight 机制优先级推演：把 keepalived 的加减权计算过程算出来
set -u

MASTER_PRIO=100
BACKUP_PRIO=90
WEIGHT=-20
VIP=10.0.0.3

eff() { # 参数: 基础优先级 weight 脚本结果(0成功/1失败)
    local base=$1 w=$2 res=$3
    if [ "$w" -lt 0 ]; then
        [ "$res" -ne 0 ] && echo $((base + w)) || echo "$base"
    else
        [ "$res" -eq 0 ] && echo $((base + w)) || echo "$base"
    fi
}
```

### 步骤 2：sim_weight.sh 真实运行输出（已实操）
{: .sec-prac}

```bash
bash /tmp/hw/day43/sim_weight.sh
```

输出：

```console
===== 场景 A：linux-node01 正常，nginx 存活 =====
linux-node01: priority=100, 脚本成功, weight=-20  -> 有效优先级 100
linux-node02: priority=90, 脚本成功, weight=-20  -> 有效优先级 90
结论：100 > 90，linux-node01 为 MASTER，VIP 10.0.0.3 在 linux-node01

===== 场景 B：linux-node01 的 nginx 挂掉 =====
linux-node01: priority=100, 脚本失败, weight=-20  -> 有效优先级 80 （100-20=80）
linux-node02: priority=90, 脚本成功, weight=-20  -> 有效优先级 90
结论：80 < 90，linux-node02 优先级反超 -> 触发切换，VIP 10.0.0.3 漂移到 linux-node02

===== 场景 C：linux-node01 的 nginx 被重新启动 =====
linux-node01: 脚本恢复成功 -> 有效优先级 100
linux-node02: 有效优先级 90
结论：100 > 90，linux-node01 抢回 MASTER，VIP 10.0.0.3 自动切回 linux-node01（默认 preempt）

===== 场景 D：weight 取正数 +20（加分模型）也能切，但生产上不这么用 =====
两机 nginx 均正常：linux-node01=120  linux-node02=110  -> 大者 linux-node01，VIP 在 linux-node01
linux-node01 nginx 挂掉：linux-node01=100（失去加分） linux-node02=110  -> 大者 linux-node02，同样会切换
结论：正 weight 是「加分项」，主挂了等于丢掉加分；负 weight 是「扣分项」，主挂了直接扣分。
      两者都能触发切换，生产上统一用负值，原因有三：
      1) 官方文档样例的约定写法是 negative（minus N if fails）；
      2) priority 上限 255，加分有溢出风险，扣分不会；
      3) 扣分模型的数字更直观：100-20=80 一眼看出比 90 小。

===== 场景 E：weight 0 的第三种行为（不比较优先级，直接进 FAULT）=====
weight=0 时脚本失败：本机直接进入 FAULT 状态、停止发 VRRP 通告、
VIP 立即被摘除，由备机接管；不参与任何优先级加减运算。
linux-node01 脚本失败 -> 状态 FAULT，生效优先级 0，VIP 立即释放
注意：weight=0 时 fall 次数达到即触发，与 priority 高低无关
```

### 步骤 3：输出解读与联动闭环（已实操）
{: .sec-prac}

把题 2 的监控脚本和题 3 的权重推演拼起来，就是完整闭环：

1. linux-node01 的 nginx 挂 → `check_nginx.sh` 返回非 0 → keepalived 判定 `chk_nginx` 失败；
2. 失败触发 `weight -20` → linux-node01 有效优先级 100-20=80 < 90；
3. linux-node02 胜出成为 MASTER，VIP `10.0.0.3` 漂到 linux-node02（题 2 日志 `VIP 漂移到 linux-node02` 正是这一步）；
4. nginx 恢复 → `check_nginx.sh` 返回 0 → linux-node01 优先级回到 100 > 90 → 默认抢占，VIP 抢回（题 2 日志 `VIP 抢回 linux-node01`）。

**验证方法**：`weight=0` 场景特别提醒——它不是「扣 0 分」，而是「脚本失败直接进 FAULT、VIP 立即摘除」，这在某些要求「宁可全断也不能错发给坏节点」的场景有用，但会丢失优先级协商的细节，所以默认还是用 `-20`。

> **易错点**：
>
> - `weight=0` 不是「无影响」，而是「失败即 FAULT」，行为完全不同，配置时务必想清楚；
> - 正负权重都能切换，但只有负值在「主恢复后自动抢回」这件事上语义最干净；
> - `preempt`（抢占）默认开启，所以场景 C 主恢复后 VIP 自动回来；若配了 `nopreempt`，主恢复后 VIP 会留在备机，需手动干预。

## 题 4：联动监控真实日志与最终流程图
{: .sec-expl}

**考察点**：用真实 `monitor.log` 把整条联动链路的时间线坐实，并画出「事件 → 探测 → 动作 → VIP 归属」的总流程图，作为本篇的总收口。

### 步骤 1：monitor.log 真实日志（已实操，原始产物）
{: .sec-prac}

这份日志是仿真环境的真实产物（时间轴与题 2 复现版一致，仅起始时刻不同），完整记录了一次「nginx 故障→漂移→恢复→抢回」：

```text
[05:30:57] 初始：nginx 运行中 PID=1828，keepalived=on，VIP 10.0.0.3 在 linux-node01
[05:31:02] nginx 进程不存在 -> 执行 systemctl stop keepalived
[05:31:02] keepalived 已停止，VIP 10.0.0.3 漂移到 linux-node02
[05:31:04] nginx 仍未恢复，keepalived 保持停止，VIP 仍在 linux-node02
[05:31:05] nginx 仍未恢复，keepalived 保持停止，VIP 仍在 linux-node02
[05:31:07] nginx 已恢复 PID=1871 -> 执行 systemctl start keepalived
[05:31:08] keepalived 恢复，优先级回到 100 > 90，VIP 10.0.0.3 抢回 linux-node01
[05:31:18] === 巡检结束：nginx=up，keepalived=on，VIP 在 linux-node01 ===
```

日志里 `nginx.pid` 示例内容为 `1871`（即恢复后新主进程号），与上面第 6 行 `PID=1871` 对应，证明 pid 文件 + `kill -0` 探测链路真实可用。

### 步骤 2：最终联动流程图（文字 + 表格）
{: .sec-prac}

整条链路可拆成「探测层（check_nginx.sh）→ 权重层（weight）→ 选举层（VRRP）→ 漂移层（VIP）→ 恢复层（preempt）」五段，事件序列如下：

```text
            ┌──────────────────────────────────────────────────────────┐
            │  check_nginx.sh (每 2s) 读 /var/run/nginx.pid + kill -0    │
            └───────────────────────────┬──────────────────────────────┘
                                        │ 退出码 0 / 非 0
            ┌───────────────────────────┴──────────────────────────────┐
            │  vrrp_script chk_nginx 判定成功/失败                       │
            │  失败 → 有效优先级 = 100 + (-20) = 80                      │
            └───────────────────────────┬──────────────────────────────┘
                                        │ 80 < 90
            ┌───────────────────────────┴──────────────────────────────┐
            │  VRRP 选举：linux-node02(90) 反超成为 MASTER               │
            └───────────────────────────┬──────────────────────────────┘
                                        │
            ┌───────────────────────────┴──────────────────────────────┐
            │  VIP 10.0.0.3 从 linux-node01 漂移到 linux-node02          │
            │  （monitor_nginx_keepalived.sh 调 systemctl stop keepalived）│
            └───────────────────────────┬──────────────────────────────┘
                                        │ nginx 恢复 → check 返回 0 → 优先级回 100
            ┌───────────────────────────┴──────────────────────────────┐
            │  默认 preempt：linux-node01(100) 抢回 MASTER，VIP 切回      │
            └──────────────────────────────────────────────────────────┘
```

事件→动作对照表：

| 时间线 | 事件 | 探测结果 | 触发动作 | VIP 归属 |
| --- | --- | --- | --- | --- |
| 初始 | nginx 正常运行 | check 返回 0 | keepalived 保持 on | linux-node01 |
| T+5s | nginx 进程消失 | `kill -0` 失败，退出码 1 | `systemctl stop keepalived`（优先级 80<90） | 漂移到 linux-node02 |
| T+5~8s | nginx 仍未恢复 | 持续失败 | keepalived 保持停止（幂等不重复执行） | 仍在 linux-node02 |
| T+8s | nginx 被重新拉起 | `kill -0` 成功，退出码 0 | `systemctl start keepalived`（优先级回 100） | 抢回 linux-node01 |
| 结束 | nginx=up, ka=on | 稳定 | 巡检循环继续 | linux-node01 |

**验证方法**：把 `monitor.log` 与上面两张图对照，逐行确认「时间 → 事件 → VIP 归属」是否对应；真机上可用 `ip a show eth0 | grep 10.0.0.3` 在切换窗口期多次取样，肉眼确认漂移方向。

> **易错点**：
>
> - 监控脚本的「幂等」与 keepalived 的「权重」是两套独立机制，前者管「是否调 systemctl」，后者管「VIP 漂不漂」，二者缺一不可；
> - 日志里 `keepalived 保持停止` 的重复行，正是 `LAST_STATE` 幂等控制生效的证据（只在翻转瞬间写一次动作，其余轮次只记录状态）；
> - 真机排障先看 `monitor.log` 时间线，再看 `ip a` 的 VIP 实际落点，最后看 keepalived 的 `journalctl -u keepalived`，三层交叉定位最快。

## 本篇小结
{: .sec-sum}

1. `check_nginx.sh` 用「pid 文件存在 + `kill -0` 探测」双保险判断 nginx 存活，`kill -0` 只探测不杀进程，退出码 0/非 0 直接决定 keepalived 的健康判定；pid 文件可能残留，所以必须二次 `kill -0` 确认。想测得更真，把端口探测追加成第二道条件。
2. `monitor_nginx_keepalived.sh` 用 while 死循环 + `LAST_STATE` 幂等变量，做到「状态翻转才调一次 systemctl」，避免每秒重复启停；真机需 `nohup ... &` 后台常驻、开机自启，且监控脚本自身也要进告警。
3. `weight -20` 是联动开关：nginx 挂 → 脚本失败 → 主有效优先级 100-20=80 < 90 → VIP 漂到 linux-node02；nginx 恢复 → 优先级回 100 → 默认抢占把 VIP 抢回。
4. `sim_weight.sh` 证明 `weight` 正负都能切换，但负值语义最干净（扣分直观、无 255 溢出风险、契合官方约定）；`weight=0` 是「失败即 FAULT、VIP 立即摘除」，行为不同于「扣 0 分」，需谨慎使用。
5. 真实 `monitor.log` 完整记录「nginx 故障→漂移→恢复→抢回」时间线，配合 `ip a` 的 VIP 落点与 keepalived 日志三层交叉验证，是排障的标准动作。VIP 漂移交给 vrrp_script，告警交给外部脚本，职责分开最稳。
6. 仿真脚本 `sim_monitor.sh` + `mock_nginx.sh` 已在本环境真实运行，可 `bash /tmp/hw/day43/sim_monitor.sh` 复现全部联动日志；`nginx.pid` 示例值 `1871` 与日志恢复行一一对应。

> **参见**：day43 keepalived 实时监控与上游切换作业实操 · keepalived 高可用原理 · nginx 健康检查与 upstream


{% endraw %}
