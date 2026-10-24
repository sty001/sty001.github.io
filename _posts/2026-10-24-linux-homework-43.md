---
title: "day42 作业实操：反向代理与负载均衡"
date: 2026-10-24 09:43:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 42 天的作业进入综合架构的核心环节，共三题：①总结 Nginx 反向代理模块 `ngx_http_proxy_module`；②总结负载均衡模块 `ngx_http_upstream_module`；③预习高可用服务 keepalived，提前克隆好一台新的 lb02，让 lb01 + lb02 组成高可用集群（HA）。作业原文只给了「总结两个模块 + 搭 HA」的方向，本篇把两个模块的高频指令与调度算法系统梳理，并用一个最小 Python 反向代理在 Git Bash 真实演示「轮询（rr）把请求均匀分到 3 个后端」；keepalived 双机热备部分给出可直接落地的配置文件与预期 VIP 漂移结果（B 级，CentOS 7 标准命令 + 预期输出）。

## 实操环境说明

本环境无法启动真实 Nginx（安全策略禁用），因此采用分级实操：

- **A 级（已真实执行）**：用 Python 写了一个最小反向代理（上游 3 个后端、轮询调度），通过 `curl` 连续请求 6 次，真实看到请求按 1→2→3 循环分发，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`ngx_http_proxy_module` / `ngx_http_upstream_module` 的配置写法、`nginx -t` 校验、keepalived 双机热备部署给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明真机执行方式。

实操目录统一用 `/tmp/hw/day42`。环境实测：GNU bash 5.3.15、curl 8.x、Python 3.13。本环境 `nginx` 与 `keepalived` 命令均不可用（已用 `command -v` 验证），因此这两者的 `-t` 校验与启动只能给 B 级命令。文中演示域名统一使用 `example.com`，两台负载均衡节点主机名分别记为 `linux-node01`（MASTER）与 `linux-node02`（BACKUP），内网网段使用 `10.0.0.0/24` 作为示例。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 总结 Module ngx_http_proxy_module | A 级（指令梳理 + 演示） |
| 题 2 | 总结 Module ngx_http_upstream_module | A 级（算法梳理 + rr 演示） |
| 题 3 | keepalived 高可用：克隆 lb02，lb01+lb02 组成 HA | B 级（双机热备部署 + 预期漂移） |

## 题 1：总结 ngx_http_proxy_module（反向代理模块）

**考察点**：理解反向代理在负载均衡中的角色、`proxy_pass` 的转发写法、`proxy_set_header` 解决的两个经典面试题（站点识别、真实客户端 IP 记录）、`proxy_next_upstream` 的故障切换作用，以及常用超时参数。

**实现思路**：反向代理就是「Nginx 以客户端身份，把请求转发给后端真实服务器，再把响应回传给用户」。`ngx_http_proxy_module` 干的就是这件事，最核心的指令是 `proxy_pass`（往哪转）和 `proxy_set_header`（转发时补什么头）。梳理时抓住「一转三头一兜底」：一转 = `proxy_pass`；三头 = Host、X-Forwarded-For、X-Real-IP；一兜底 = `proxy_next_upstream`（后端挂了换一台）。

### 高频指令速查

| 指令 | 作用 | 解决的痛点（面试题） |
| --- | --- | --- |
| `proxy_pass http://upstream名;` | 把请求转发给后端服务器组或单台 | 反向代理的核心，没有它就没有转发 |
| `proxy_set_header Host $host;` | 向后端传递真实 Host | 访问不同域名却显示同一个页面（虚拟主机识别错乱） |
| `proxy_set_header X-Forwarded-For $remote_addr;` | 向后端传递真实客户端 IP | 后端 access 日志里统计到的全是 LB 的 IP |
| `proxy_set_header X-Real-IP $remote_addr;` | 同上，另一种传递真实 IP 的写法 | 同 X-Forwarded-For |
| `proxy_next_upstream error timeout http_502 http_503 http_504;` | 出现指定错误时换后端重试 | 某台后端故障导致用户看到错误页 |
| `proxy_connect_timeout 5s;` | 与后端建连超时（默认 60s） | 后端宕机时连接长时间挂起 |
| `proxy_read_timeout 60s;` | 读取后端响应超时 | 慢接口把 LB 连接拖死 |
| `proxy_buffering on;` | 响应缓冲，慢客户端不拖累后端 | 慢客户端占满后端连接 |

### 关键易错点：`proxy_pass` 后面加不加斜杠

`proxy_pass` 带不带 URI 决定 Nginx 是否改写请求路径，这是面试与实战最高频的坑：

```nginx
location /api/ {
    proxy_pass http://backend;        # 不带 URI：把 /api/xxx 原样转发为 /api/xxx
}
location /api/ {
    proxy_pass http://backend/;       # 带 / ：把 /api/xxx 转发为 /xxx（去掉 /api/）
}
```

带 `/` 时 Nginx 会用 `location` 匹配到的前缀（`/api/`）被替换成 `/`，常用于「访问路径」与「后端真实路径」不一致的动静分离场景。

### 辨析：正向代理与反向代理

都是「替别人收发请求」，区别在替谁干活、对谁隐藏：

- **正向代理**站在客户端一侧：客户端主动配置代理，代理替用户去访问目标服务器，服务器不知道真实客户端是谁。典型：公司上网出口、科学上网工具。
- **反向代理**站在服务端一侧：客户端直接访问它，它把请求分发给后端集群，用户不知道也不关心后面有几台服务器。典型：Nginx 入口层、CDN 边缘节点。

一个助记：正向代理藏「客户」，反向代理藏「服务器」。面试常问「为什么 Nginx 叫反向」，答出这句就够了。

## 题 2：总结 ngx_http_upstream_module（负载均衡模块）

**考察点**：`upstream` 如何定义后端服务器组、常用 server 参数（weight/backup/down/max_fails/fail_timeout）、六种调度算法（rr/wrr/ip_hash/least_conn/url_hash/fair）的适用场景，以及会话保持方案。

**实现思路**：`upstream` 块把「一组后端」抽象成一个名字，再让 `proxy_pass http://名字` 去引用它。调度的「怎么分」由算法决定，调度的「分给谁、分给多少、坏了我怎么办」由 server 参数决定。梳理时按「算法 + 参数 + 健康检查」三条线记忆。

### server 参数速查

| 参数 | 写法 | 说明 |
| --- | --- | --- |
| 默认轮询 | `server 10.0.0.7:80;` | 平均分配请求 |
| 权重 | `server 10.0.0.7:80 weight=3;` | 能力越强责任越重 |
| 热备 | `server 10.0.0.9:80 backup;` | 其他节点全故障时才启用 |
| 手动下线 | `server 10.0.0.9:80 down;` | 维护时临时摘除 |
| 最大失败次数 | `max_fails=3` | 统计窗口内的失败阈值 |
| 失败冻结时长 | `fail_timeout=30s` | 30s 内失败 3 次即冻结 30s，期满再探测 |
| 单机并发上限 | `max_conns=100` | 超出部分分给其他节点 |

### 调度算法对比

| 算法 | 配置 | 说明 | 适用场景 |
| --- | --- | --- | --- |
| 轮询 rr | 默认 | 各后端平均分 | 后端性能一致 |
| 加权轮询 wrr | `weight=N` | 按权重分配 | 后端配置不一致 |
| ip_hash | upstream 内加 `ip_hash;` | 按客户端 IP 哈希，同一 IP 固定到同一后端 | 会话保持，避免反复登录 |
| least_conn | upstream 内加 `least_conn;` | 连接数最少的后端优先 | 请求耗时差异大 |
| url_hash | `hash $request_uri consistent;` | 按 URL 哈希，同 URL 落同机 | 后端带本地缓存，提升命中率 |
| fair（第三方） | 需编译 fair 模块 | 按响应时间调度 | 后端性能波动大 |

> **注意**：`ip_hash` 与 `weight` 同时配置时 weight 不生效（转发目标由 IP 决定）；`ip_hash` 的局限是同一 NAT 出口用户都会打到同一台，且后端增减会重算哈希。更彻底的方案是把 Session 集中存到 Redis，从根上消除对「粘某台机器」的依赖。

怎么选算法，按后端与业务的两个特征定：机器性能不齐用 wrr，请求耗时差不多用 rr，耗时差异大（有的接口几毫秒、有的几秒）用 least_conn——因为轮询不管「手里还压着几个慢请求」，快机器闲着慢机器排队；需要会话保持先想 Redis，真没有才上 ip_hash；后端有本地缓存且 URL 集中，url_hash 能明显提高命中率。生产环境最常见的组合是 rr/wrr + Redis Session，ip_hash 反而用得少。

ip_hash 的副作用要心里有数：一是 NAT 出口问题——公司、校园网几百人共享一个出口 IP，全被粘到同一台，负载直接失衡；二是扩缩容重哈希——后端加减节点后大量会话换机器，用户被踢下线；三是它按「连接」粘而不按「用户」粘，手机网络切换 IP 后会话照样丢。所以会话保持的正解始终是集中式存储，ip_hash 只是无状态改造完成前的过渡手段。

### A 级实战：用 Python 最小反向代理演示 rr 轮询（已实操）

为在没有真实 Nginx 的环境里真实看到轮询效果，我写了 3 个后端（各自返回自己的身份）和 1 个负载均衡器（轮询转发）。先准备脚本：

```bash
mkdir -p /tmp/hw/day42 && cd /tmp/hw/day42
cat > backend.py <<'PYEOF'
import http.server, socketserver, sys
who = sys.argv[1]; port = int(sys.argv[2])
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type','text/plain'); self.end_headers()
        self.wfile.write(("backend-%s (port %d)" % (who, port)).encode())
    def log_message(self,*a): pass
socketserver.TCPServer(('127.0.0.1', port), H).serve_forever()
PYEOF

cat > lb.py <<'PYEOF'
import http.server, socketserver, urllib.request
BACKENDS = [('127.0.0.1',9001),('127.0.0.1',9002),('127.0.0.1',9003)]
idx = 0
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global idx
        host,port = BACKENDS[idx % len(BACKENDS)]; idx += 1
        with urllib.request.urlopen("http://%s:%d%s" % (host,port,self.path)) as r:
            body = r.read()
        self.send_response(200)
        self.send_header('Content-Type','text/plain'); self.end_headers()
        self.wfile.write(body)
    def log_message(self,*a): pass
socketserver.TCPServer(('127.0.0.1', 8080), H).serve_forever()
PYEOF
```

启动 3 后端 + 1 负载均衡器，再用 curl 连续打 6 次：

```bash
python3 backend.py 1 9001 >/dev/null 2>&1 &
python3 backend.py 2 9002 >/dev/null 2>&1 &
python3 backend.py 3 9003 >/dev/null 2>&1 &
python3 lb.py >/dev/null 2>&1 &
sleep 1
for i in $(seq 1 6); do
  printf "第 %s 次: " "$i"
  curl -s http://127.0.0.1:8080/
  echo
done
pkill -f backend.py 2>/dev/null; pkill -f lb.py 2>/dev/null
```

输出：

```text
第 1 次: backend-1 (port 9001)
第 2 次: backend-2 (port 9002)
第 3 次: backend-3 (port 9003)
第 4 次: backend-1 (port 9001)
第 5 次: backend-2 (port 9002)
第 6 次: backend-3 (port 9003)
```

请求严格按 1→2→3→1→2→3 循环分发，正是 Nginx `upstream` 默认 `rr`（轮询）算法的真实行为——本文用最小实现把它跑通了。换成带权重的 `weight`，只需在分发时按权重比例取值，逻辑完全一致。

### 真实 Nginx 配置范本（B 级，A 级演示的对等写法）

把上面的 Python 逻辑翻译成标准 Nginx 配置就是：

```nginx
upstream webcluster {
    server 10.0.0.7:80 weight=3 max_fails=2 fail_timeout=30s;
    server 10.0.0.8:80 weight=2 max_fails=2 fail_timeout=30s;
    server 10.0.0.9:80 backup;
}

server {
    listen       80;
    server_name  www.example.com;
    location / {
        proxy_pass http://webcluster;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_connect_timeout 5s;
        proxy_read_timeout    60s;
    }
}
```

校验与重载（CentOS 7，预期输出）：

```bash
nginx -t
systemctl reload nginx
```

```text
$ nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
$ systemctl reload nginx
```

## 题 3：keepalived 双机热备（lb01 + lb02 组成 HA）

**考察点**：理解高可用要解决「负载均衡器单点故障」的问题、VRRP 协议与 VIP 漂移原理、主备节点的配置差异（state/priority/router_id）、以及「提前克隆 lb02」这一准备动作。

**实现思路**：单台负载均衡器一旦宕机，整个网站入口就断了。keepalived 基于 VRRP 协议，让 `linux-node01`（MASTER）与 `linux-node02`（BACKUP）共享一个虚拟 IP（VIP）。平时 VIP 漂在 MASTER 上对外服务；MASTER 宕机，BACKUP 在约 3 个通告周期（3 秒）内收不到心跳，自动把 VIP 抢过来，用户几乎无感知。作业要求「提前克隆好 lb02」，正是为了省去重复部署 Nginx 负载均衡配置的时间。

### 准备架构（B 级）

| 主机 | 角色 | 地址 | 优先级 |
| --- | --- | --- | --- |
| linux-node01 | MASTER | 10.0.0.5 | priority 150 |
| linux-node02 | BACKUP | 10.0.0.6 | priority 100 |
| VIP | 虚拟地址 | 10.0.0.3/24 | 对外服务入口 |

克隆 lb02 后，修改主机名与 IP 即可（CentOS 7，预期输出）：

```bash
# 在克隆出来的节点上
hostnamectl set-hostname linux-node02
sed -i 's#\.5#.6#g' /etc/sysconfig/network-scripts/ifcfg-eth0
systemctl restart network
```

### linux-node01 的 keepalived.conf（B 级）

```conf
! Configuration File for keepalived

global_defs {
    router_id linux-node01
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 150
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass <vrrp-auth-pass>
    }
    virtual_ipaddress {
        10.0.0.3/24
    }
}
```

### linux-node02 的 keepalived.conf（B 级）

```conf
! Configuration File for keepalived

global_defs {
    router_id linux-node02
}

vrrp_instance VI_1 {
    state BACKUP
    interface eth0
    virtual_router_id 51
    priority 100
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass <vrrp-auth-pass>
    }
    virtual_ipaddress {
        10.0.0.3/24
    }
}
```

### 启动与预期 VIP 漂移结果（B 级）

两台都安装并启动：

```bash
yum install -y keepalived
systemctl enable --now keepalived
```

（预期输出，CentOS 7）

```text
$ systemctl enable --now keepalived
Created symlink from /etc/systemd/system/multi-user.target.wants/keepalived.service to /usr/lib/systemd/system/keepalived.service.
```

验证 MASTER 上 VIP 已生成：

```bash
ip a s eth0 | grep 10.0.0.3
```

```text
$ ip a s eth0 | grep 10.0.0.3
    inet 10.0.0.3/24 scope global secondary eth0
```

模拟 MASTER 故障，停止 linux-node01 的 keepalived：

```bash
systemctl stop keepalived
```

此时在 linux-node02 上确认 VIP 已漂过来：

```bash
ip a s eth0 | grep 10.0.0.3
```

```text
$ ip a s eth0 | grep 10.0.0.3
    inet 10.0.0.3/24 scope global secondary eth0
```

恢复 linux-node01 后，因其 priority 更高（150 > 100）会重新抢占回 VIP（默认开启抢占）。这就是 VIP 漂移的完整闭环。要不要保留抢占看业务：抢占回切让「高配机器」尽快回到主位，但会多一次切换闪断；对状态敏感的服务可以配 `nopreempt` 让 VIP 留在备机，代价是长期让备机当主力。

> **易错点**：
>
> - 同一实例里主备的 `virtual_router_id`、`advert_int`、`auth_pass` 必须完全一致，否则主备无法通信、VIP 不会漂移；`router_id` 两台不能重复。
> - `state` 只是初始期望值，最终谁当 MASTER 由 `priority` 竞选决定，不要被 `state MASTER` 字面误导。
> - VIP 漂移依赖组播心跳（目的地址 224.0.0.18），防火墙要放行 VRRP 协议，否则会「脑裂」（两台都持有 VIP）。
> - 云环境（如公有云）通常不转发 VRRP 组播，需用 `unicast_src_ip` / `unicast_peer` 改成单播模式，或改用云厂商自带高可用产品。

> **参见**：[负载均衡服务](../09-综合架构/17-负载均衡服务.md)、[高可用服务 keepalived](../09-综合架构/18-高可用服务keepalived.md)

## 本篇小结

1. 反向代理由 `ngx_http_proxy_module` 实现，核心是 `proxy_pass`（往哪转）配合 `proxy_set_header Host` 与 `X-Forwarded-For`（补头），再用 `proxy_next_upstream` 做后端故障自动换机；正向代理藏客户、反向代理藏服务器。
2. `proxy_pass` 是否带 `/` 决定路径是否改写：不带 URI 原样转发，带 `/` 会去掉 location 匹配到的前缀——这是最高频的坑。
3. 负载均衡由 `ngx_http_upstream_module` 的 `upstream` 块实现，server 参数（weight/backup/down/max_fails/fail_timeout）控制「分给谁、分多少、坏了我怎么办」。
4. 调度算法按场景挑：均摊用 rr、按机器能力用 wrr、耗时差异大用 least_conn、缓存命中用 url_hash；ip_hash 能粘会话但有 NAT 出口失衡与扩缩容重哈希两个副作用，会话保持的正解是 Redis 集中存储。
5. 本文用最小 Python 反向代理真实跑通了 rr 轮询（1→2→3 循环），等价于 Nginx `upstream` 默认算法。
6. keepalived 基于 VRRP 让 linux-node01（MASTER）+ linux-node02（BACKUP）共享 VIP，MASTER 宕机后 BACKUP 约 3 秒接管；部署前「克隆 lb02」可省去重复配置，主备三项参数（`virtual_router_id`/`advert_int`/`auth_pass`）必须一致；要不要抢回 VIP，取决于业务吃不吃得起回切那一下闪断。
{% endraw %}
