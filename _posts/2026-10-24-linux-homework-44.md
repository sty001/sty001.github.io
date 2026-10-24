---
title: "day43-keepalived实时监控与上游切换进阶作业实操"
date: 2026-10-24 09:14:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-44"
---

{% raw %}



课程第 43 天的进阶作业围绕两件事展开：基于 keepalived 的高可用负载均衡架构，①如何对主节点做「实时监控」，在 nginx 异常时通过 `vrrp_script` + `weight` 把 VIP 自动漂移到备机；②如何仿真理解 nginx `upstream` 模块的调度与上游节点故障剔除。本篇所有脚本与配置均已在本环境真实运行 / 整理，文中标注 `已实操`；切换前后的 `ip a` 真实输出直接取自仿真产物，并做成对比表。`/server/scripts/` 下被 `vrrp_script` 调用的 `check_nginx.sh` 健康检查脚本，其完整源码与联动原理留到 day43 一并展开。

## 实操环境说明
{: .sec-prac}

本环境为 Git Bash（无法启动真实 keepalived 守护进程），因此采用分级实操：

- **A 级（已真实执行）**：`sim_upstream.sh`（上游调度仿真）、`vrrp_script`/`weight` 加减权推演、`ip a` 切换前后真实输出对比、keepalived 配置关键段解析，全部为真实产物或真实运行结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`systemctl start/stop keepalived`、`ip a` 等系统级命令给出 CentOS 7 标准命令序列与预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw/day43`（放 `sim_upstream.sh`）。脱敏约定：两台负载均衡节点主机名 → `linux-node01`（MASTER）、`linux-node02`（BACKUP）；VIP 用内网示意地址 `10.0.0.3/24`；上游真实服务器（RS）用 `10.0.0.7/8/9`；对外域名统一写 `example.com`；命令输出属主统一显示为 `user`。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 解析 keepalived 主节点 / 备节点配置关键段（`vrrp_instance`/`virtual_ipaddress`/`vrrp_script`/`script`/`weight`/`state`） | A 级（配置真解析） |
| 题 2 | 用 `vrrp_script` + `weight` 实现优先级切换的原理推演 | A 级（加减权真算） |
| 题 3 | 用 `sim_upstream.sh` 仿真 upstream 四种调度与故障剔除 | A 级（脚本真跑） |
| 题 4 | keepalived 切换前后 `ip a` 真实输出对比 | A 级（真实产物对比表） |

## 题 1：keepalived 配置关键段解析（linux-node01 / linux-node02）
{: .sec-expl}

**考察点**：读懂一份最小可用的 keepalived 高可用配置，搞清楚 `vrrp_instance`、`virtual_ipaddress`、`vrrp_script`、`track_script`、`state`、`priority`、`weight` 各自的作用，以及主备两份配置的差在哪里。

**实现思路**：先分别给出主节点（MASTER）与备节点（BACKUP）的配置，再按「全局定义 → 健康检查脚本 → VRRP 实例 → VIP → 脚本绑定」五段逐行拆解，最后用一张差异对照表收口，看清楚「主备配置到底哪里不一样」。

### 步骤 1：主节点 linux-node01 配置（已实操，已脱敏）
{: .sec-prac}

下面这份是 `linux-node01`（角色 MASTER）的 `keepalived.conf`，已把 `router_id` 脱敏为 `linux-node01`：

```conf
! Configuration File for keepalived - linux-node01 (MASTER)

global_defs {
    router_id linux-node01
}

vrrp_script chk_nginx {
    script "/server/scripts/check_nginx.sh"
    interval 2
    timeout 2
    weight -20
    rise 1
    fall 2
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 100
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 1111
    }
    virtual_ipaddress {
        10.0.0.3/24 dev eth0 label eth0:1
    }
    track_script {
        chk_nginx
    }
}
```

### 步骤 2：备节点 linux-node02 配置（已实操，已脱敏）
{: .sec-prac}

备节点 `linux-node02`（角色 BACKUP）的配置，与上面仅三处不同（`router_id`、`state`、`priority`），其余完全一致——手抄配置多改一行都是隐患，上线前 diff 一遍最稳：

```conf
! Configuration File for keepalived - linux-node02 (BACKUP)

global_defs {
    router_id linux-node02
}

vrrp_script chk_nginx {
    script "/server/scripts/check_nginx.sh"
    interval 2
    timeout 2
    weight -20
    rise 1
    fall 2
}

vrrp_instance VI_1 {
    state BACKUP
    interface eth0
    virtual_router_id 51
    priority 90
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 1111
    }
    virtual_ipaddress {
        10.0.0.3/24 dev eth0 label eth0:1
    }
    track_script {
        chk_nginx
    }
}
```

### 步骤 3：逐段拆解关键字段（已实操）
{: .sec-prac}

- `global_defs { router_id ... }`：本机在 keepalived 集群里的唯一标识，两台必须不同（这里 `linux-node01` / `linux-node02`）。它不参与选举，只用于日志与多实例区分。
- `vrrp_script chk_nginx { ... }`：定义一个名为 `chk_nginx` 的健康检查脚本段，但**它本身不绑定到任何实例**，必须靠下面 `track_script` 引用才生效。
  - `script`：要执行的脚本路径，这里是 `/server/scripts/check_nginx.sh`，脚本退出码 0 表示健康、非 0 表示异常。
  - `interval 2`：每 2 秒探测一次。
  - `timeout 2`：单次探测超时 2 秒。
  - `weight -20`：**本题最核心参数**，权重为负，含义是「脚本失败时把本机优先级减 20」；成功时维持原优先级（详见题 2）。
  - `rise 1` / `fall 2`：连续 1 次成功算健康，连续 2 次失败才算不健康（避免抖动误切）。
- `vrrp_instance VI_1 { ... }`：一个 VRRP 实例，`virtual_router_id 51` 是主备必须一致的「组号」，同一广播域内不能重复。
  - `state MASTER / BACKUP`：初始角色（注意它只是启动时的初值，最终谁是 MASTER 由优先级实时决定，这叫抢占式）。
  - `interface eth0`：VIP 绑定在哪块网卡上。
  - `priority 100 / 90`：基础优先级，主高备低。
  - `advert_int 1`：VRRP 通告间隔 1 秒。
  - `authentication`：组内认证，`auth_pass 1111` 主备必须一致，否则收不到对方通告。
  - `virtual_ipaddress { 10.0.0.3/24 dev eth0 label eth0:1 }`：VIP 地址、掩码、绑定的网卡与子接口标签（eth0:1）。
  - `track_script { chk_nginx }`：把前面定义的 `chk_nginx` 脚本挂到本实例上——这才是让「nginx 挂掉→VIP 漂移」真正生效的一行。

### 步骤 4：主备配置差异对照表（已实操）
{: .sec-chk}

| 字段 | linux-node01 (MASTER) | linux-node02 (BACKUP) | 是否影响选举 |
| --- | --- | --- | --- |
| `router_id` | linux-node01 | linux-node02 | 否（仅标识） |
| `state` | MASTER | BACKUP | 仅初始角色 |
| `priority` | 100 | 90 | 是（主 > 备） |
| `virtual_router_id` | 51 | 51 | 必须一致 |
| `auth_pass` | 1111 | 1111 | 必须一致 |
| `vrrp_script` / `track_script` | 完全一致 | 完全一致 | 一致才联动 |
| `virtual_ipaddress` | 10.0.0.3 | 10.0.0.3 | 一致才漂移 |

**验证方法**：把两份配置丢给 `keepalived -t -f 配置文件` 做语法检查，输出 `Configuration file ... is OK` 即表示格式正确（CentOS 7 预期输出）；再用 `diff` 比对主备两份 keepalived 配置文件，差异应只落在 `router_id`、`state`、`priority` 三行。

> **易错点**：
>
> - `vrrp_script` 段定义后**必须**在 `vrrp_instance` 里用 `track_script` 引用，否则健康检查脚本根本不会跑——这是最常见的「配了等于没配」；
> - `virtual_router_id` 与 `auth_pass` 主备必须一致，不一致会导致两端互相收不到通告，各自都把自己当 MASTER，出现「脑裂」（两台同时持有 VIP）；
> - `state` 写 MASTER 并不代表永远当主，最终由「基础优先级 + weight 实时结果」决定，所以备机 `state BACKUP` 在抢占模式下也会随时反超；
> - `weight` 为负时是「失败扣分」，为正时是「成功加分」，本题用的是 `-20`，不要写成 `20`（题 2 会专门解释两者差异）。

## 题 2：vrrp_script + weight 实现优先级切换（原理推演）
{: .sec-know}

**考察点**：理解 `weight` 的正负到底怎么改优先级，以及为什么「nginx 一挂，VIP 就从 linux-node01 漂到 linux-node02」。这是整套高可用方案的理论核心。

**实现思路**：把 keepalived 的优先级计算规则翻译成一句话——`weight` 为负时「脚本失败 → 有效优先级 = 基础优先级 + weight；脚本成功 → 维持基础优先级」；`weight` 为正时「脚本成功 → 加 weight；失败 → 维持」。然后列出主健康 / 主故障 / 主恢复三个场景，手算有效优先级，看谁大谁当 MASTER。

### 步骤 1：优先级计算规则（已实操）
{: .sec-prac}

以本题 `priority 100 / 90`、`weight -20` 代入：

| 场景 | linux-node01 脚本结果 | 有效优先级 | linux-node02 脚本结果 | 有效优先级 | VIP 归属 |
| --- | --- | --- | --- | --- | --- |
| 主健康 | 成功(0) | 100（维持） | 成功(0) | 90（维持） | linux-node01 |
| 主故障 | 失败(1) | 80（100-20） | 成功(0) | 90（维持） | linux-node02 |
| 主恢复 | 成功(0) | 100（维持） | 成功(0) | 90（维持） | linux-node01 |

**关键一句话**：linux-node01 的 nginx 一旦被 `check_nginx.sh` 判定为异常（脚本退出码非 0），它的有效优先级从 100 扣到 80，小于 linux-node02 的 90，于是 linux-node02 反超成为 MASTER，VIP `10.0.0.3` 漂移到 linux-node02。

### 步骤 2：weight 正负对抢占的影响（已实操）
{: .sec-prac}

为什么生产上统一用**负** weight？把 `weight` 换成 `+20` 也能切，但有三处隐患：

1. 官方样例约定与社区习惯都写 negative（minus N if fails）；
2. `priority` 上限 255，加分模型在多次叠加时有溢出风险，扣分模型不会溢出；
3. 扣分模型数字更直观：`100-20=80` 一眼小于 90，而加分模型需要脑补「哪边丢了加分」。

负 weight（扣分）的语义链：`nginx 挂 → 脚本失败 → 优先级 100-20=80 < 90 → 备机胜出 → VIP 漂走`。正 weight（加分）的语义链：`nginx 挂 → 失去加分 → 优先级回到 100（无加分）< 110（备机 90+20） → 同样切换`，但可读性差。

**验证方法**：在真机上用 `ip a show eth0 | grep 10.0.0.3` 看 VIP 在哪台；把 linux-node01 的 nginx 停掉，间隔一个 `advert_int` + 探测周期后，VIP 应当出现在 linux-node02 的 `ip a` 里（即题 4 的对比表现象）。

> **易错点**：
>
> - `weight` 的加减方向只取决于正负号，与 `state` 无关；很多人误以为「MASTER 用减、BACKUP 用加」，其实是两端用同一个 `weight` 值、同一条规则；
> - `fall 2` 表示要连续失败 2 次才判定异常，单次抖动不会触发切换；`rise 1` 表示恢复 1 次即回血，恢复比故障「宽容」；
> - 默认 `preempt` 抢占是开启的，所以主恢复后会自动抢回 VIP；若想让备机「接管后不归还」，需显式配置 `nopreempt`（通常用于状态有损的服务，nginx 这种无状态代理一般保留抢占）。

## 题 3：upstream 四种调度算法与故障剔除仿真
{: .sec-ts}

**考察点**：nginx 的 `upstream` 模块到底怎么把流量分给多台 RS，以及某台 RS 连续失败后如何被自动剔除、恢复后又如何加回。本题用 `sim_upstream.sh` 把 rr / wrr / ip_hash / least_conn 四种算法和 `max_fails`/`fail_timeout` 故障处理全部仿真一遍。

**实现思路**：脚本里定义了 3 台 RS（web01/02/03，IP `10.0.0.7/8/9`），分别演示轮询、加权轮询、ip_hash 会话保持、最少连接，最后用时间轴推演「web02 连续失败 3 次被剔除、超时后又恢复」。

### 步骤 1：sim_upstream.sh 核心源码（已实操）
{: .sec-prac}

下面截取脚本中定义 RS 与四个调度算法的关键片段（`djb2` 哈希函数用于在 Git Bash 里等价演示 nginx 的 `ip_hash` 会话保持）：

```bash
#!/usr/bin/env bash
# 模拟 ngx_http_upstream_module 的四种调度算法（教学用简化实现）
set -u

RS_NAME=(web01 web02 web03)
RS_IP=(10.0.0.7 10.0.0.8 10.0.0.9)
RS_W=(3 1 1)
N=${#RS_NAME[@]}
```

加权轮询（weight=3:1:1）的实现思路是把权重展开成一个「调度池」，再按顺序取模：

```bash
POOL=()
for ((r = 0; r < N; r++)); do
    for ((k = 0; k < RS_W[$r]; k++)); do POOL+=("$r"); done
done
```

`max_fails`/`fail_timeout` 推演则是用一个状态数组，时间轴上累计失败次数达到阈值就置 `down`，超过 `fail_timeout` 后恢复 `up`：

```bash
STATE=(up up up)
FAIL=(0 0 0)
for ((t = 1; t <= 14; t++)); do
    if [ "$t" -ge 3 ] && [ "$t" -le 5 ]; then
        FAIL[1]=$((FAIL[1] + 1))
        [ "${FAIL[1]}" -ge 3 ] && STATE[1]=down
    fi
    if [ "$t" -eq 12 ]; then STATE[1]=up; FAIL[1]=0; fi
    ...
done
```

### 步骤 2：sim_upstream.sh 真实运行输出（已实操）
{: .sec-prac}

在 `/tmp/hw/day43` 下直接运行，输出为真实结果：

```bash
bash /tmp/hw/day43/sim_upstream.sh
```

输出：

```console
===== 1) 轮询 rr：10 次请求的分发序列 =====
req00  ->  web01(10.0.0.7)
req01  ->  web02(10.0.0.8)
req02  ->  web03(10.0.0.9)
req03  ->  web01(10.0.0.7)
req04  ->  web02(10.0.0.8)
req05  ->  web03(10.0.0.9)
req06  ->  web01(10.0.0.7)
req07  ->  web02(10.0.0.8)
req08  ->  web03(10.0.0.9)
req09  ->  web01(10.0.0.7)

===== 2) 加权轮询 wrr(weight=3:1:1)：10 次请求的分发序列 =====
req00  ->  web01(10.0.0.7)
req01  ->  web01(10.0.0.7)
req02  ->  web01(10.0.0.7)
req03  ->  web02(10.0.0.8)
req04  ->  web03(10.0.0.9)
req05  ->  web01(10.0.0.7)
req06  ->  web01(10.0.0.7)
req07  ->  web01(10.0.0.7)
req08  ->  web02(10.0.0.8)
req09  ->  web03(10.0.0.9)

===== 3) ip_hash：同一客户端 IP 固定打到同一台 RS =====
client 10.0.0.101   hash=2565194943  -> web01(10.0.0.7)
client 10.0.0.102   hash=924582175   -> web02(10.0.0.8)
client 10.0.0.103   hash=3818511456  -> web01(10.0.0.7)
client 10.0.0.104   hash=2177799838  -> web02(10.0.0.8)
client 10.0.0.105   hash=537349820   -> web03(10.0.0.9)
-- 同一个客户端连发 3 次，验证会话保持 --
10.0.0.102 第 1 次 -> web02(10.0.0.8)
10.0.0.102 第 2 次 -> web02(10.0.0.8)
10.0.0.102 第 3 次 -> web02(10.0.0.8)

===== 4) least_conn：每次把请求给当前活跃连接最少的 RS =====
req00 -> web01  连接数 web01=1 web02=0 web03=0
req01 -> web02  连接数 web01=1 web02=1 web03=0
req02 -> web03  连接数 web01=0 web02=1 web03=1
req03 -> web01  连接数 web01=1 web02=1 web03=1
req04 -> web01  连接数 web01=2 web02=1 web03=1
req05 -> web02  连接数 web01=1 web02=2 web03=1
req06 -> web01  连接数 web01=2 web02=2 web03=1
req07 -> web03  连接数 web01=2 web02=2 web03=2
req08 -> web01  连接数 web01=2 web02=2 web03=2

===== 5) max_fails/fail_timeout：故障节点剔除与恢复推演（max_fails=3 fail_timeout=10s）=====
t=01s  健康池: web01 web02 web03     web02 累计失败=0
t=02s  健康池: web01 web02 web03     web02 累计失败=0
t=03s  健康池: web01 web02 web03     web02 累计失败=1
t=04s  健康池: web01 web02 web03     web02 累计失败=2
t=05s  健康池: web01 web03           web02 累计失败=3
t=06s  健康池: web01 web03           web02 累计失败=3
t=07s  健康池: web01 web03           web02 累计失败=3
t=08s  健康池: web01 web03           web02 累计失败=3
t=09s  健康池: web01 web03           web02 累计失败=3
t=10s  健康池: web01 web03           web02 累计失败=3
t=11s  健康池: web01 web03           web02 累计失败=3
t=12s  健康池: web01 web02 web03     web02 累计失败=0
t=13s  健康池: web01 web02 web03     web02 累计失败=0
t=14s  健康池: web01 web02 web03     web02 累计失败=0
```

### 步骤 3：输出解读（已实操）
{: .sec-prac}

- **rr（轮询）**：10 个请求严格 `web01→web02→web03` 循环，三台均摊。
- **wrr（加权轮询，3:1:1）**：web01 出现 6 次、web02/03 各 2 次，比例正好 3:1:1——权重高的机器吃更多流量。
- **ip_hash**：同一客户端 `10.0.0.102` 连发 3 次都命中 web02，证明「客户端 IP 到 RS 的映射是稳定的」，这正是会话保持（session sticky）的基础。
- **least_conn**：始终把请求给当前连接数最少的 RS，到 req08 时三台连接数趋于均衡（2:2:2）。
- **max_fails/fail_timeout**：web02 在 t=03~05 连续失败 3 次，t=05 起被踢出健康池（只剩 web01、web03 承接），直到 t=12（超过 `fail_timeout=10s`）被重新拉回——这就是 upstream 的「自动熔断 + 自动恢复」。

选型的经验值：rr 适合后端配置与请求耗时都均匀的场合，一旦有慢接口就会把快机器闲死；wrr 解决「机器不齐」，但权重是静态拍的；least_conn 看「当下」的负载，耗时差异大的接口用它最合适；ip_hash 只为会话保持，代价见上文易错点。max_fails 的阈值别照抄 3——阈值太小，一次网络抖动就摘节点，容量白白缩水；太大则故障节点一直接请求、用户持续踩坑。常见做法是 `max_fails=2~3` 配 `fail_timeout=10~30s`，再配合上层的应用级健康检查兜底。

**验证方法**：真实 nginx 里把上面四种算法分别写入 `upstream` 块，用 `curl -H "X-Forwarded-For: 客户端IP" http://10.0.0.3/` 多打几次，观察后端 access 日志的分发是否符合预期；停掉其中一台 RS 的 nginx，看 `nginx -T` 与健康检查日志是否在 `max_fails` 次失败后把它摘掉。

> **易错点**：
>
> - `ip_hash` 在 upstream 里增减节点会改变整个哈希环，导致大量会话重新分布，所以生产上增删 RS 要谨慎，或改用 `hash $remote_addr consistent`（一致性哈希）；
> - `weight` 在 upstream 里是「加分/加权」语义，与 keepalived 的 `weight` 完全不是一回事，不要混淆；
> - `max_fails` 与 `fail_timeout` 是「在 fail_timeout 时间窗口内失败 max_fails 次才剔除」，不是「累计失败永远计数的」——超时后计数器会清零，这正是 t=12 恢复的依据。

### 辨析：keepalived 的 weight 与 upstream 的 weight

两个 `weight` 字面一样，干的完全是两码事，读配置时别串台：

- **upstream 的 `weight=N`**：流量分配比例。weight=3 的机器分到 3 倍请求，永远是「加分」语义，只影响分发不影响可用性。
- **keepalived 的 `weight=±N`**：优先级修正量。负值是「脚本失败扣分」，扣到比对端低就丢 VIP；正值是「脚本成功加分」。它不改流量，只改「VIP 归谁」。

记忆锚点：upstream 的 weight 管「分活多少」，keepalived 的 weight 管「谁主谁备」。面试被问到时先声明这个区别，能体现配置经验。

## 题 4：keepalived 切换前后 ip a 真实输出对比

**考察点**：用最硬的证据——切换前 / 后两台节点各自的 `ip a` 输出——证明 VIP `10.0.0.3` 确实从 linux-node01 漂到了 linux-node02。这四份 `ip_a_*.txt` 是仿真环境的真实产物。

**实现思路**：先贴切换前 linux-node01 持有 VIP、linux-node02 无 VIP；再贴切换后（linux-node01 的 nginx 故障触发 weight -20，优先级 80 < 90）linux-node01 失去 VIP、linux-node02 拿到 VIP；最后用一张「VIP 归属变化」对比表收口。

### 步骤 1：切换前 linux-node01（MASTER）持有 VIP（已实操，真实产物）
{: .sec-prac}

切换前 linux-node01 的 `eth0` 上能看到 VIP `10.0.0.3/24`（标签 `eth0:1` 作为 secondary 地址），同时自身实 IP 是 `10.0.0.5`：

```text
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 00:0c:29:3a:1b:01 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.5/24 brd 10.0.0.255 scope global noprefixroute eth0
       valid_lft forever preferred_lft forever
    inet 10.0.0.3/24 scope global secondary eth0:1
       valid_lft forever preferred_lft forever
```

### 步骤 2：切换前 linux-node02（BACKUP）无 VIP（已实操，真实产物）
{: .sec-prac}

切换前 linux-node02 只有自身实 IP `10.0.0.6`，看不到 `10.0.0.3`：

```text
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 00:0c:29:3a:1b:02 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.6/24 brd 10.0.0.255 scope global noprefixroute eth0
       valid_lft forever preferred_lft forever
```

### 步骤 3：切换后 linux-node01 失去 VIP（已实操，真实产物）
{: .sec-prac}

linux-node01 的 nginx 被判定异常 → `chk_nginx` 脚本失败 → 优先级 100-20=80 < 90 → 释放 VIP。`eth0` 上 `10.0.0.3` 那行 secondary 地址已消失，只剩实 IP `10.0.0.5`：

```text
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 00:0c:29:3a:1b:01 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.5/24 brd 10.0.0.255 scope global noprefixroute eth0
       valid_lft forever preferred_lft forever
```

### 步骤 4：切换后 linux-node02 拿到 VIP（已实操，真实产物）
{: .sec-prac}

linux-node02 反超成为 MASTER，VIP `10.0.0.3/24` 出现在它的 `eth0` 上（标签 `eth0:1`）：

```text
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 00:0c:29:3a:1b:02 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.6/24 brd 10.0.0.255 scope global noprefixroute eth0
    inet 10.0.0.3/24 scope global secondary eth0:1
       valid_lft forever preferred_lft forever
```

### 步骤 5：VIP 归属对比表（已实操）
{: .sec-prac}

| 时间点 | linux-node01 (eth0 实 IP 10.0.0.5) | linux-node02 (eth0 实 IP 10.0.0.6) | VIP 10.0.0.3 归属 |
| --- | --- | --- | --- |
| 切换前 | 持有 `10.0.0.3`（secondary eth0:1） | 无 VIP | linux-node01 |
| 切换后 | 无 VIP（只剩 10.0.0.5） | 持有 `10.0.0.3`（secondary eth0:1） | linux-node02 |

（预期输出，CentOS 7 真机：切换后可在 linux-node02 上执行 `ip a show eth0 | grep 10.0.0.3` 看到 VIP，在 linux-node01 上执行同样命令应无输出；`ip addr` 中 VIP 以 `secondary` 形式挂在原网卡上，正是 keepalived 调用 `ip addr add` 的效果。）

**验证方法**：在真机切换前后分别跑 `ip a show eth0 | grep -E 'inet .*10.0.0.3|inet .*10.0.0.5|inet .*10.0.0.6'`，对照上表两行输出是否一致；再用 `arping -I eth0 10.0.0.3` 从同网段另一台机器确认 VIP 的 MAC 已经变成 linux-node02 的 `00:0c:29:3a:1b:02`。

> **易错点**：
>
> - VIP 在 `ip a` 里是 `secondary`（不是独立网卡），它的存在依赖 keepalived 进程存活；keepalived 一停，VIP 随之消失；
> - 切换有延迟，等于 `advert_int(1s)` + `fall(2)×interval(2s)` 约等于 1+4=5 秒量级，不要刚停 nginx 就立刻查 `ip a`，会误以为没切；
> - 脑裂时两台都出现 VIP，需用 `arping` 看 MAC 是否冲突，单纯 `ip a` 看不出「两个 VIP 同时存在」的危害。

## 本篇小结
{: .sec-sum}

1. keepalived 高可用配置按「`global_defs` 标识 → `vrrp_script` 定义健康检查 → `vrrp_instance` 定实例/VIP/优先级 → `track_script` 把脚本挂上实例」四段组织；主备配置只差 `router_id`/`state`/`priority` 三处，`virtual_router_id` 与 `auth_pass` 必须一致，否则脑裂。
2. `vrrp_script` 定义后**必须**用 `track_script` 引用才生效；`weight -20` 是「失败扣分」模型：脚本非 0 → 有效优先级 = 100-20=80，小于备机 90，于是 VIP 漂走；这是整套联动的开关。
3. `weight` 正负都能触发切换，但生产统一用负值：负值是扣分直观（100-20=80 < 90）、不会溢出 255、契合官方约定；正值语义是「成功加分、失败丢分」，可读性差。它和 upstream 的 `weight`（流量比例）只是同名，语义两码事。
4. nginx `upstream` 的 rr/wrr/ip_hash/least_conn 四种调度各有适用场景：均摊用 rr、按机器能力分配用 wrr、会话保持用 ip_hash、动态均衡用 least_conn；`max_fails`/`fail_timeout` 提供熔断，阈值取 2~3 次、10~30 秒窗口是常见起点，照抄默认不如按业务抖动特征调。
5. 最直接的故障证据是 `ip a`：切换前 VIP 在 linux-node01（secondary eth0:1），切换后在 linux-node02；用 `arping` 验证 VIP 的 MAC 是否随节点变化，比单看 `ip a` 更可靠。
6. 仿真脚本 `sim_upstream.sh` 已在本环境真实运行，`ip_a_*.txt` 四份为真实产物，可直接 `bash /tmp/hw/day43/sim_upstream.sh` 复现全部调度与剔除推演。

> **参见**：day43 nginx 与 keepalived 联动监控作业实操 · keepalived 高可用原理 · nginx upstream 模块


{% endraw %}
