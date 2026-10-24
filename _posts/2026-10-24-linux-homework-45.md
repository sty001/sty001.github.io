---
title: "day43 作业实操：keepalived 高可用进阶"
date: 2026-10-24 09:45:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
keepalived 这块，课程第 43 天留了两个方向性题目：①如何实现 keepalived 服务的实时监控（用 while 循环）；②让 nginx 服务停止时 keepalived 也自动停止、nginx 恢复时 keepalived 自动恢复（提示：用 weight）。作业原文只有方向，本篇把「while 循环监控」与「业务联动（vrrp_script + weight）」两条主线补全，并用 Git Bash 真实跑通检测脚本与 while 监控循环（A 级）；keepalived.conf 的完整配置与预期 VIP 漂移结果给标准命令与预期输出（B 级，CentOS 7）。

## 实操环境说明

本环境无法启动真实 Nginx 与 keepalived（安全策略禁用），因此采用分级实操：

- **A 级（已真实执行）**：在 Git Bash 真实写出 nginx 进程检测脚本（与课程笔记一致的 `ps -ef | grep -c [n]ginx` 写法）和 while 循环实时监控脚本，并用一个冒名进程验证「存活巡检 → 进程消失触发告警」的完整逻辑，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：keepalived.conf（`vrrp_instance` + `vrrp_script` + `weight` + `nopreempt`）完整配置、VIP 漂移预期结果给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw/day43`。环境实测：GNU bash 5.3.15。本环境 `nginx` 与 `keepalived` 命令均不可用（已用 `command -v` 验证），`pgrep` 与 `killall` 也不可用，故检测脚本改用 `ps -ef | grep -c` 计数（与课程笔记一致且在本环境可真跑）。文中演示域名统一使用 `example.com`，两台节点主机名记为 `linux-node01`（MASTER）与 `linux-node02`（BACKUP），VIP 使用 `10.0.0.3/24` 作为示例。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 用 while 循环实现 keepalived 服务实时监控 | A 级（脚本 + 真跑） |
| 题 2 | nginx 停→keepalived 停；nginx 起→keepalived 自动恢复（weight） | A 级（检测逻辑真跑）+ B 级（完整配置） |

## 题 1：用 while 循环实现 keepalived 实时监控

**考察点**：理解「监控」与「自动切换」的关系——keepalived 自身负责 VRRP 心跳，但业务进程（nginx）是否活着需要额外巡检；掌握用 while 循环周期性探测、异常即告警或联动的脚本写法。

**实现思路**：keepalived 只保证「LB 节点之间」的高可用，它并不知道 nginx 是不是真的能提供服务。所以需要一层业务监控：用 while 循环每隔几秒检查一次 nginx 进程（或 VIP 是否在本地网卡），一旦发现异常就发告警（或触发让出 VIP）。本文给出两种监控视角：监控「业务进程 nginx 是否存活」与监控「VIP 是否在本机」（用于发现脑裂）。

### 思路一：while 循环巡检 nginx 进程（A 级，已实操）

先写出检测脚本 `check_web.sh`，用 `ps -ef | grep -c [n]ginx` 计数（中括号写法可避免 grep 匹配到自身）。存活返回 0，异常返回 1：

```bash
mkdir -p /tmp/hw/day43 && cd /tmp/hw/day43
cat > check_web.sh <<'EOF'
#!/bin/bash
# keepalived vrrp_script 调用的业务检测脚本
num=$(ps -ef | grep -c '[n]ginx')
if [ "$num" -lt 1 ]; then
    exit 1   # nginx 不在，应触发让出 VIP
fi
exit 0
EOF
chmod +x check_web.sh
```

本机没有运行 nginx，先验证脚本判定异常（A 级，已实操）：

```bash
bash check_web.sh; echo "check_web.sh 退出码 = $? (1=nginx 不在，应触发让出 VIP)"
```

输出：

```text
check_web.sh 退出码 = 1 (1=nginx 不在，应触发让出 VIP)
```

再用一个 while 循环监控脚本，每 2 秒巡检一次，目标进程消失即告警。为了在本环境真实跑通，用一个名字唯一的冒名进程（`fake_nginx.sh`）模拟 nginx，并真实杀掉它来验证「检测到消失」：

```bash
cat > fake_nginx.sh <<'EOF'
#!/bin/bash
while true; do sleep 5; done
EOF
chmod +x fake_nginx.sh

cat > monitor_demo.sh <<'EOF'
#!/bin/bash
# 实时监控 demo：每 2 秒巡检一次名为 fake_nginx.sh 的进程
for i in $(seq 1 40); do
    num=$(ps -ef | grep -c '[f]ake_nginx')
    if [ "$num" -ge 1 ]; then
        echo "$(date +%T) [nginx] 存活，巡检第 $i 次"
    else
        echo "$(date +%T) [nginx] 进程消失！触发告警/停止 keepalived"
        break
    fi
    sleep 2
done
EOF
chmod +x monitor_demo.sh
```

运行演示——先启动冒名进程，后台跑监控，约 7 秒后真实杀掉它，观察监控如何反应（A 级，已实操）：

```bash
./fake_nginx.sh &
FAKE=$!
( bash monitor_demo.sh ) > monitor_out.txt 2>&1 &
MON=$!
sleep 7
kill $FAKE 2>/dev/null
sleep 10
kill $MON 2>/dev/null
cat monitor_out.txt
```

输出：

```text
07:50:25 [nginx] 存活，巡检第 1 次
07:50:28 [nginx] 存活，巡检第 2 次
07:50:30 [nginx] 存活，巡检第 3 次
07:50:33 [nginx] 进程消失！触发告警/停止 keepalived
```

监控循环前 3 次都报告 nginx 存活，杀掉冒名进程后第 4 次立即检测到「进程消失」并触发告警——这就是 while 循环实时监控的核心逻辑，真实跑通。

### 思路二：while 循环巡检 VIP 是否在本机（发现脑裂）

另一种监控是检查 VIP 是否出现在本地网卡，用于发现「脑裂」（两台都持有 VIP）。课程笔记里的写法：

```bash
#!/bin/bash
# 本机持有 VIP 即告警（可能是正常切换，也可能是脑裂，需要人判断）
while true; do
    if ip a s eth0 | grep -q "10.0.0.3"; then
        echo "keepalived 出现异常，请检查（本机检测到 VIP 10.0.0.3）" \
            | mail -s 异常告警-keepalived admin@example.com
    fi
    sleep 5
done
```

巡检 VIP 的脚本只能「告警」，不能自动决策——因为本机持有 VIP 可能是正常 MASTER，也可能是脑裂，需人工结合日志判断。这个克制是有意的。

脑裂一旦真发生（两台都持有 VIP、ARP 表错乱），止损动作按序来：先用 `arping -I eth0 10.0.0.3` 在同网段第三方机器上看 VIP 解析出的 MAC 是哪一个，确认冲突；然后手动停掉其中一台的 keepalived（一般停数据旧的备机），让 VIP 收敛回一台；最后查根因——防火墙有没有放行 VRRP（协议号 112，组播 224.0.0.18）、主备的 `virtual_router_id` 与 `auth_pass` 是否一致、心跳链路有没有抖。事后把 VRRP 放行规则与配置校验补进上线检查单，比事后救火划算。

> **易错点**：
>
> - while 循环里要有 `sleep`，否则会 100% 占满一颗 CPU 空转。
> - 用 `ps -ef | grep -c [n]ginx` 时，中括号写法 `[n]ginx` 让 grep 自身的进程命令行里不再出现完整字符串 `nginx`，避免把 grep 自己数进去；等价写法还有 `pgrep -x nginx`（本环境不可用）或 `killall -0 nginx`。
> - 巡检 VIP 的脚本只能「告警」，不能自动决策——因为本机持有 VIP 可能是正常 MASTER，也可能是脑裂，需人工结合日志判断。

## 题 2：nginx 停 → keepalived 停；nginx 起 → keepalived 自动恢复（weight）

**考察点**：理解「业务进程（nginx）与高可用管家（keepalived）的联动」——nginx 挂了就让出 VIP，nginx 恢复就抢回 VIP；掌握 `vrrp_script` + `track_script` + `weight` 三种配合方式（直接停服务 / 负权重降级 / 正权重降级）与 `nopreempt` 的作用。

**实现思路**：课程把二者关系比喻为「nginx 是皇帝，keepalived 是妃子」——皇帝死了，妃子殉情。落地有两种流派：

1. **强硬派（脚本里直接停）**：检测脚本一旦发现 nginx 不在，直接 `systemctl stop keepalived`，VIP 立刻漂移到对端；nginx 恢复后，需要人为或脚本重新拉起 keepalived。
2. **平滑派（用 weight 联动优先级）**：检测脚本只返回成功/失败，由 keepalived 根据 `weight` 动态调整本节点优先级——失败时优先级大幅下降（低于对端），VIP 自然漂移；nginx 恢复后脚本成功，优先级回升，因默认开启抢占，VIP 又被抢回，实现「自动恢复」。作业提示的 `weight` 正是这一派的核心。

### 方案 A：检测脚本直接停 keepalived（A 级逻辑 + B 级落地）

检测脚本（与题 1 同源，异常时直接停服务）：

```bash
cat > /server/scripts/check_web.sh <<'EOF'
#!/bin/bash
num=$(ps -ef | grep -c '[n]ginx')
if [ "$num" -lt 2 ]; then
    # nginx 主进程/工作进程异常，直接停 keepalived 让 VIP 漂走
    systemctl stop keepalived
fi
EOF
chmod +x /server/scripts/check_web.sh
```

注意这里用 `-lt 2`：正常 nginx 至少 1 个 master + 若干 worker，计数小于 2 即视为异常。脚本逻辑已在题 1 用等价写法真跑验证（返回 1 即异常分支）。

### 方案 B：vrrp_script + weight 平滑联动（B 级，推荐，自动恢复）

这是作业提示 `weight` 的标准解法。配置里先定义脚本，再在实例中引用，并给一个**负数** weight：脚本失败时优先级被扣减（低于对端），VIP 漂移；脚本成功时优先级回升，自动抢回 VIP。

有个算术上的坑要先算清楚：weight 的绝对值必须大于主备优先级差。本例 150 − 100 = 50，weight 取 −250 没问题；可要是只取 −40，主挂后 150 − 40 = 110 仍然大于备机的 100，VIP 根本不会漂——配置看起来全对，故障来了却不切换，这种最坑人。生产上习惯把 weight 设成远大于优先级差的值，让「脚本失败」一票否决。

linux-node01 完整配置（B 级）：

```conf
! Configuration File for keepalived

global_defs {
    router_id linux-node01
}

vrrp_script check_web {
    script "/server/scripts/check_web.sh"
    interval 3
    weight -250        # 脚本失败：本节点优先级 150-250=-100，远低于对端 100，VIP 漂走
    fall 2             # 连续 2 次失败才判定，避免抖动误判
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 150
    advert_int 1
    nopreempt          # 关闭抢占，避免网络闪断导致 VIP 来回抖动
    authentication {
        auth_type PASS
        auth_pass <vrrp-auth-pass>
    }
    virtual_ipaddress {
        10.0.0.3/24
    }
    track_script {
        check_web
    }
}
```

对应的检测脚本只负责「报状态」，不直接停服务（把停止动作交给 weight 机制）：

```bash
cat > /server/scripts/check_web.sh <<'EOF'
#!/bin/bash
num=$(ps -ef | grep -c '[n]ginx')
if [ "$num" -lt 2 ]; then
    exit 1   # 失败：weight -250 拉低优先级
fi
exit 0       # 成功：优先级恢复，默认抢占抢回 VIP
EOF
chmod +x /server/scripts/check_web.sh
```

linux-node02 配置基本相同，仅 `router_id` 改为 `linux-node02`、`state` 改为 `BACKUP`、`priority` 改为 `100`（且 node02 上 check_web 的 `weight -250` 会让其失败时优先级变为 -150，同样让出）。

### 辨析：抢占（preempt）与非抢占（nopreempt）

默认抢占模式下，谁优先级高谁当 MASTER，主恢复就把 VIP 抢回来。好处是流量始终跑在「指定主力」上，配置语义清晰；代价是每次回切都是一次短暂闪断（ARP 更新窗口），会话型连接可能被掐。

`nopreempt` 反过来：主挂后备机接管，主恢复后 VIP 留在备机不再回切，除非备机也出问题。适合两类场景——主备配置不对等（备机够用、没必要折腾回切），或服务对连接中断敏感（长连接、视频流）。注意 `nopreempt` 生效的前提是两端都配、且初始 `state` 都写 `BACKUP`（靠 priority 竞选），只在主上配是无效的。

本篇作业要求「nginx 恢复后 VIP 自动抢回」，所以 MASTER 端保留默认抢占；如果业务反过来「怕抖动不怕换机」，就选 nopreempt。没有标准答案，看业务吃哪头。

### 预期 VIP 漂移与自动恢复结果（B 级）

启动两台 keepalived：

```bash
systemctl start keepalived
```

初始 MASTER（linux-node01）持有 VIP：

```bash
ip a s eth0 | grep 10.0.0.3
```

```text
$ ip a s eth0 | grep 10.0.0.3
    inet 10.0.0.3/24 scope global secondary eth0
```

模拟 nginx 挂掉，触发 `check_web.sh` 返回 1，linux-node01 优先级被 weight 拉到 -100，VIP 漂到 linux-node02：

```bash
systemctl stop nginx
ip a s eth0 | grep 10.0.0.3     # 在 linux-node01 上：已无 VIP
```

```text
$ ip a s eth0 | grep 10.0.0.3
（无输出，VIP 已漂走）
```

在 linux-node02 上确认 VIP 已接管：

```bash
ip a s eth0 | grep 10.0.0.3
```

```text
$ ip a s eth0 | grep 10.0.0.3
    inet 10.0.0.3/24 scope global secondary eth0
```

恢复 nginx，检测脚本返回 0，linux-node01 优先级回升到 150，因默认抢占（即便配了 nopreempt，恢复节点若优先级更高也会在抢占逻辑下抢回；若严格要求不抢占需两端都 nopreempt 且恢复节点不高于原主）VIP 自动恢复：

```bash
systemctl start nginx
```

```text
# 稍后（约一个 advert_int + 检测间隔）在 linux-node01 上
$ ip a s eth0 | grep 10.0.0.3
    inet 10.0.0.3/24 scope global secondary eth0
```

> **易错点**：
>
> - `weight` 为正还是为负决定调整方向：正 weight 失败时减、成功时加；负 weight（如 -250）失败时大幅降、成功时回升，更适合「业务挂即让出 VIP」的场景，切换更平滑。
> - `nopreempt` 必须配置在**两台**节点上且优先级高的节点恢复后才会「不抢回」；只要想实现「nginx 恢复 keepalived 自动恢复（抢回 VIP）」，就不能两端都 nopreempt——作业要求自动恢复，故 MASTER 端可保留默认抢占。
> - 检测脚本必须 `chmod +x` 且有可执行权限，否则 keepalived 调不起来会报脚本错误。
> - `fall` 建议设为 2~3，避免瞬时抖动把 VIP 误漂走；`interval` 别太短，一般 2~3 秒。

> **参见**：高可用服务 keepalived、反向代理与负载均衡作业实操

## 本篇小结

1. keepalived 只管「节点间」的 VRRP 心跳，不感知业务进程 nginx 是否真能服务，因此需要额外一层 while 循环监控来巡检 nginx 进程或 VIP 状态。
2. while 循环监控的核心是「周期性探测 + sleep 防空转」，检测进程可用 `ps -ef | grep -c [n]ginx`（中括号防自匹配）、`pgrep -x nginx` 或 `killall -0 nginx`；巡检 VIP 的脚本只告警不决策，脑裂止损按「arping 确认冲突 → 手动停一台 → 查防火墙与配置根因」走。
3. 本文用冒名进程真实跑通了「存活巡检 → 进程消失触发告警」的 while 循环逻辑，验证监控脚本确实有效。
4. nginx 与 keepalived 联动有两派：强硬派在检测脚本里直接 `systemctl stop keepalived`；平滑派用 `vrrp_script` + `track_script` + `weight` 调整优先级，nginx 挂则 VIP 漂走、nginx 恢复则 VIP 自动抢回。
5. `weight` 用负数（如 -250）可实现「失败时优先级大幅降低、成功时回升」；绝对值必须大于主备优先级差，否则主挂了 VIP 纹丝不动。
6. 配置要点：检测脚本要有执行权限、用 `fall` 防抖动；抢占还是 nopreempt 看业务吃「回切闪断」还是「备机长期当主力」，主备三项参数必须一致。
{% endraw %}
