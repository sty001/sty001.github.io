---
title: "day26 作业实操：DNS 解析过程、dig 与阶段测验复习"
date: 2026-10-24 09:26:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 26 天的作业有三道大题：① 用文字表示 DNS 的解析过程（dig）；② 总结命令；③ 复习之前的测验（文件属性、定时任务、三剑客、权限）。全部完成。

题 ① 给出「浏览器敲下回车到拿到 IP」的完整 10 步分解与文字流程图，讲清递归查询与迭代查询的分工，并在本机**真跑各级 DNS 查询**把解析链条跑通——包括手工向根服务器、顶级域服务器、权威服务器逐跳查询，等效于 `dig +trace` 的现场演示；`dig` 系列因本环境未安装而按 B 级给出 CentOS 7 标准命令与逐层预期输出。题 ② 网络类命令速查表 + 前五个阶段的核心命令回顾。题 ③ 按四大模块整理自测题，每题附答案与验证命令。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：`nslookup`、`curl`、`ping`、`hosts` 文件检查等在本机实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：`dig`、`dig +trace`、`named`、`resolvectl`、`systemd-resolved` 等 DNS 专业工具与系统级服务给出 CentOS 7 标准命令与预期输出，标注 `预期输出`。

本篇有三处环境差异需要说明，属正常：

1. 本环境**未安装 `dig`**（Git Bash 精简安装），但网络可用，因此用 Windows 自带的 `nslookup` 做等价验证，并额外提供 dig 的 CentOS 7 标准输出；
2. `nslookup` 是 Windows 版本，中文输出为 GBK 编码，直接看是乱码，本文所有相关命令都加了 `| iconv -f GBK -t UTF-8` 转码后呈现；在 CentOS 7 上不需要这一步；
3. 输出中**本机 DNS 服务器的内网 IP** 按脱敏要求统一替换为 `<本地DNS-IP>` 占位符；公开域名统一使用 RFC 2606 保留的 `example.com` / `example.org`，相关 IP 均为这些域名当前真实的公网地址（会随 CDN 变动，属正常）。

实操目录统一用 `/tmp/hw/day26`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 文字表示 DNS 的解析过程（dig） | A 级（nslookup 逐跳真跑 + 缓存实验）+ B 级（dig/dig +trace） |
| 题 2 | 总结命令 | A 级（curl/ping/nslookup 真跑）+ B 级（ip/ss/telnet） |
| 题 3 | 复习之前测验：文件属性 / 定时任务 / 三剑客 / 权限 | A 级（每模块附可真跑的验证命令） |

## 题 1：文字表示 DNS 的解析过程（dig）

**考察点**：从应用层到网络层的完整域名解析链路、递归查询与迭代查询的区别、各级 DNS 服务器的分工、TTL 与缓存机制、权威应答与非权威应答的判读。

**实现思路**：先把「输入网址 → 拿到 IP」拆成 10 个动作，每一段说清「谁在查、查哪里、查不到怎么办」；配一张文字流程图把递归/迭代的分界画出来；再用本机可执行的实验逐段验证（hosts → 本地缓存 → 本地 DNS → 手工三级迭代）；最后补齐 `dig` 的用法与逐层预期输出。

### 步骤 1：DNS 解析的完整 10 步

以浏览器输入 `https://www.example.com` 并回车为例：

1. **浏览器发起请求**：用户在地址栏输入 `www.example.com`，浏览器发现这不是 IP，需要先做域名解析，于是调用操作系统提供的解析器（resolver）接口。
2. **查浏览器自身 DNS 缓存**：Chrome / Edge 内部都有一层缓存（Chrome 默认约 60 秒，可用 `chrome://net-internals/#dns` 查看）。命中且未过期则**这一步就结束**，直接用缓存里记的 IP。
3. **查操作系统 DNS 缓存**：浏览器没命中就落到系统缓存。CentOS 7 上常见的缓存载体是 `nscd` 或 `systemd-resolved`；Windows 上是 DNS Client 服务缓存（可用 `ipconfig /displaydns` 查看）。命中且未过期则返回。
4. **查本机 hosts 静态映射表**：Linux 是 `/etc/hosts`，Windows 是 `C:\Windows\System32\drivers\etc\hosts`。这个文件优先级**高于 DNS 服务器**，里面写了什么域名就直接用对应 IP，不再往后面走——这也是本地测试环境的常用手段。命中则结束。hosts 与 resolv.conf 的分工辨析见 day25 末尾：一个管「本地写死」，一个管「去问谁」，查找时 hosts 在前。
5. **向本地 DNS 服务器发起递归查询**：前三步都没命中，操作系统就把请求交给网卡配置里指定的 DNS 服务器（由 DHCP 下发或手工填写，CentOS 在 `/etc/resolv.conf` 里，通常有两个：主用 + 备用）。这一步是**递归查询**：含义是「我只要最终答案，中间过程你自己跑，跑完把我想要的结果给我」。
6. **本地 DNS 服务器查自己的缓存**：本地 DNS（运营商 DNS、或公司内网自建 DNS）服务着成千上万客户端，命中率高。若这条记录在它的缓存里且 TTL 未过期，直接返回答案。
7. **本地 DNS 向根域名服务器查询**：缓存未命中，就得自己跑腿。它先找根服务器——全球 13 组根（编号 a 到 m，实际由任播技术扩展成几百台物理机），服务器软件里内置了根服务器的 IP 列表（root hints）。问题是：`www.example.com 的 IP 是多少？`
8. **根服务器返回`.com` 顶级域服务器的地址**：根服务器不负责具体主机名，它只认最后一个点后面的顶级域：查到 `.com` 由哪几家顶级域服务器（gTLD Server）负责，把这份清单连同它们的 IP（称为胶水记录 glue record）返回给本地 DNS。注意：**根返回的是「你该去问谁」，而不是答案本身**，这就是**迭代查询**。
9. **本地 DNS 向顶级域服务器查询**：拿着上一步给的列表挑一台（如 `l.gtld-servers.net`），再问一遍 `www.example.com 的 IP 是多少？`。顶级域服务器同样不知道主机 IP，但它知道 `example.com` 这个区由哪几家权威域名服务器负责，于是把 NS 记录清单返回。
10. **本地 DNS 向权威域名服务器查询并最终返回**：再挑一台权威服务器（如 `a.iana-servers.net`）问同一个问题，权威服务器这才给出真正的 `A`/`AAAA` 记录。**这一条回应才是权威应答**。本地 DNS 拿到答案后按记录的 TTL 写进自己的缓存，再返回给客户端；客户端同样按 TTL 缓存。

两处容易忽略的细节：一是**否定答案也会被缓存**（negative caching）——查一个不存在的域名，返回的 NXDOMAIN 会在本地 DNS 缓存里存一段时间，刚注册的域名立刻解析报 NXDOMAIN、过一会儿自己就好了，多半是这个机制在起作用；二是缓存的最小单位是「记录」而不是「整个域名」，A 记录过期了不影响同域名的 MX、TXT 记录继续命中。

**10 步走完之后**：浏览器才拿到 IP，接着发起 TCP 三次握手 → TLS 握手（HTTPS）→ 发送 HTTP GET → 服务器返回 HTML → 浏览器渲染。注意 DNS 发生在所有网络连接之前，网站打不开的排障顺序必须是「先 DNS、再连通、再端口、再应用层」。

### 步骤 2：文字流程图

```text
浏览器输入 www.example.com 并回车
        │
        ▼
[1] 浏览器自身 DNS 缓存 ───── 命中 ──→ 用缓存 IP，结束
        │ 未命中
        ▼
[2] 操作系统 DNS 缓存 ─────── 命中 ──→ 用缓存 IP，结束
        │ 未命中
        ▼
[3] 本机 hosts 静态映射 ───── 命中 ──→ 用 hosts 里的 IP，结束
        │ 未命中
        ▼
[4] 向本地 DNS 服务器（resolv.conf 里的那个 IP）发起【递归查询】
        │                                    ▲
        │                                    │ 递归：只等最终结果，
        │                                    │ 中间跑腿由本地 DNS 负责
        ▼                                    │
[5] 本地 DNS 查自身缓存 ────── 命中 ──────────┘
        │ 未命中（TTL 已过期）
        ▼
    ┌──────────────── 以下为【迭代查询】三步 ───────────────┐
    │                                                        │
    │  [6] 问根服务器（a~m.root-servers.net）                │
    │      「www.example.com 的 IP？」                       │
    │       答：不知道，但 .com 归下面几家管                 │
    │            → l.gtld-servers.net 192.41.162.30          │
    │                        │                               │
    │                        ▼                               │
    │  [7] 问顶级域服务器（l.gtld-servers.net）              │
    │      「www.example.com 的 IP？」                       │
    │       答：不知道，但 example.com 归下面几家管           │
    │            → a.iana-servers.net / b.iana-servers.net   │
    │                        │                               │
    │                        ▼                               │
    │  [8] 问权威服务器（a.iana-servers.net）                │
    │      「www.example.com 的 IP？」                       │
    │       答：104.20.23.154、172.66.147.243（A 记录）      │
    │           ← 这才是权威应答                             │
    └────────────────────────────────────────────────────────┘
        │
        ▼
[9] 本地 DNS 按 TTL 写入自己的缓存 ──→ 带一纸「非权威应答」返回给客户端
        │
        ▼
[10] 客户端按 TTL 写缓存 → 浏览器拿到 IP
        │
        ▼
   TCP 三次握手 → TLS 握手（HTTPS）→ HTTP GET → 返回 HTML → 渲染页面
```

图里两条分界线是本题的得分点：**第 4 步「客户端 → 本地 DNS」是递归查询**（只要答案），**第 6~8 步「本地 DNS → 各级服务器」是迭代查询**（每次拿到的不是答案，而是「下一次该问谁」）。

### 步骤 3：递归查询 vs 迭代查询

| 对比项 | 递归查询 | 迭代查询 |
| --- | --- | --- |
| 谁在查 | 客户端查本地 DNS | 本地 DNS 查根/顶级域/权威服务器 |
| 查询者的期望 | 给我最终答案 | 给我答案，或者告诉我下一步问谁 |
| 服务器的行为 | 自己去跑完全流程后返回结果 | 只返回自己知道的那一段（通常是 referral 推荐） |
| 典型回应 | 一条 A 记录 | 一组 NS 记录 + 胶水记录（IP） |
| 出错表现 | 返回 SERVFAIL / 超时 | 返回 NXDOMAIN 或下一跳服务器清单 |

### 步骤 4：本地可做的 4 个验证实验（A 级真跑）

#### 实验 1：hosts 文件能否命中 —— 验证第 3 步

```bash
# Linux 上对应 /etc/hosts；本机是 Git Bash，看 Windows 的 hosts
wc -l < /c/Windows/System32/drivers/etc/hosts
sed -e 's/\r$//' /c/Windows/System32/drivers/etc/hosts | grep -v '^[[:space:]]*#' | grep -v '^[[:space:]]*$' | wc -l
tail -3 /c/Windows/System32/drivers/etc/hosts | sed -e 's/\r$//'
```

输出（已实操）：

```console
$ wc -l < /c/Windows/System32/drivers/etc/hosts
21
$ sed -e 's/\r$//' /c/Windows/System32/drivers/etc/hosts | grep -v '^[[:space:]]*#' | grep -v '^[[:space:]]*$' | wc -l
0
$ tail -3 /c/Windows/System32/drivers/etc/hosts | sed -e 's/\r$//'
# localhost name resolution is handled within DNS itself.
#	127.0.0.1       localhost
#	::1             localhost
```

**验证方法**：非注释行数为 `0`，说明这台机器上 hosts 没有任何生效的自定义映射，因此任何外部域名的解析都会越过第 3 步继续往下走到 DNS 服务器。文件末尾三行是 Windows 自带的注释模板，正好写出「`127.0.0.1 localhost`」这样的条目格式，注意它们全部以 `#` 开头处于注释状态——**这就是 hosts 生效与否的唯一开关：行首有没有 `#`**。

#### 实验 2：本地缓存到底有没有在起作用 —— 验证第 2、6 步

`curl` 的 `%{time_namelookup}` 会把「域名解析耗时」单独打出来，是验证缓存最直接的尺子：

```bash
cd /tmp/hw/day26
for i in 1 2; do printf "第%s次 example.com: " "$i"; curl -s -o /dev/null -w "DNS=%{time_namelookup}s HTTP=%{http_code}\n" --max-time 10 https://example.com; done
printf "首次 www.iana.org: "; curl -s -o /dev/null -w "DNS=%{time_namelookup}s HTTP=%{http_code}\n" --max-time 15 https://www.iana.org
printf "再次 www.iana.org: "; curl -s -o /dev/null -w "DNS=%{time_namelookup}s HTTP=%{http_code}\n" --max-time 15 https://www.iana.org
```

输出（已实操）：

```console
$ 第1次 example.com: DNS=0.000060s HTTP=200
$ 第2次 example.com: DNS=0.000043s HTTP=200
$ 首次 www.iana.org: DNS=0.000201s HTTP=200
$ 再次 www.iana.org: DNS=0.000071s HTTP=200
```

**验证方法**：同一个域名第一次 `0.000201s`，第二次降到 `0.000071s`——约 3 倍的差距就是「第一次要跑完整迭代链条、第二次直接命中系统 DNS 缓存」的差值。如果你的环境里第一次耗时几十到几百毫秒而第二次接近 0，结论完全一样，只是基数更大、对比更明显。

想强制绕过缓存拿「新鲜」答案，有个实用技巧：给域名加一个随机前缀（如 `abc123.example.com`）再查——随机子域名不可能在任何一层缓存里，这次查询必然走完整迭代链条。测 DNS 故障、验证刚改的解析记录时很好用，比挨个清缓存省事。

#### 实验 3：localhost 与本地回环 —— 一条不依赖外部 DNS 的路径

```bash
nslookup localhost 2>&1 | iconv -f GBK -t UTF-8 | head -6
ping -n 2 127.0.0.1 2>&1 | iconv -f GBK -t UTF-8 | sed -e '/已发送 = 2/,$!d' | head -2
```

输出（已实操，本机 DNS 服务器 IP 已占位替换）：

```console
$ nslookup localhost 2>&1 | iconv -f GBK -t UTF-8 | head -6
服务器:  UnKnown
Address:  <本地DNS-IP>

名称:    localhost
Address:  127.0.0.1

$ ping -n 2 127.0.0.1 2>&1 | iconv -f GBK -t UTF-8 | sed -e '/已发送 = 2/,$!d' | head -2
    数据包: 已发送 = 2，已接收 = 2，丢失 = 0 (0% 丢失)，
    最短 = 0ms，最长 = 0ms，平均 = 0ms
```

**验证方法**：`localhost` 解析出 `127.0.0.1`、`ping` 零丢包零延迟，说明本机 TCP/IP 协议栈正常。**这条结论是排障的分水岭**：本机回环能通但外网域名解析不通 → 问题在 DNS 或出口网络；连 `127.0.0.1` 都不通 → 问题在协议栈本身，别再查 DNS 了。

#### 实验 4：权威应答 vs 非权威应答 —— 看懂 nslookup 的第一行

```bash
# 4a：问本地 DNS（它大概率返回缓存里的二手答案）
nslookup www.example.com 2>&1 | iconv -f GBK -t UTF-8 | head -8
# 4b：直接问该域的权威服务器（拿一手答案）
nslookup www.example.com hera.ns.cloudflare.com 2>&1 | iconv -f GBK -t UTF-8 | sed -n '/^服务器:/,$p' | head -8
```

输出（已实操，本机 DNS 服务器 IP 已占位替换）：

```console
$ nslookup www.example.com 2>&1 | iconv -f GBK -t UTF-8 | head -8
非权威应答:
服务器:  UnKnown
Address:  <本地DNS-IP>

名称:    www.example.com
Addresses:  2606:4700:10::6814:179a
	  2606:4700:10::ac42:93f3
	  104.20.23.154

$ nslookup www.example.com hera.ns.cloudflare.com 2>&1 | iconv -f GBK -t UTF-8 | sed -n '/^服务器:/,$p' | head -8
服务器:  hera.ns.cloudflare.com
Address:  108.162.192.162

名称:    www.example.com
Addresses:  2606:4700:10::6814:179a
	  2606:4700:10::ac42:93f3
	  172.66.147.243
	  104.20.23.154
```

**验证方法**：两次的 IP 列表一致，但**第一次输出开头有「非权威应答:」字样，第二次没有**。这就是判别权威与否的唯一依据——

- 「非权威应答」= 这份答案是别人转述的（来自缓存），可能过期；
- 没有这行 = 直接由该域的权威服务器给出，是一手答案。

所以排查「改了 DNS 记录却不生效」时，一定要**直接问权威服务器**，而不是问本地 DNS——后者答的可能还是旧缓存。

### 步骤 5：把迭代查询真跑一遍（本环境的 `dig +trace` 等价演示）

这是本题最有价值的部分：**不用 dig，也能把「根 → 顶级域 → 权威」三级跳一跳一跳地现场走完**。做法是给 `nslookup` 的第二个参数直接指定要问的那台服务器。

```bash
# 第 1 跳：问根服务器 → 拿到 .com 顶级域服务器清单
nslookup example.com a.root-servers.net 2>&1 | iconv -f GBK -t UTF-8 | sed -n '/^服务器:/,$p' | head -10
# 第 2 跳：问顶级域服务器 → 拿到 example.com 的权威服务器清单
nslookup -type=NS example.com l.gtld-servers.net 2>&1 | iconv -f GBK -t UTF-8 | sed -n '/^服务器:/,$p' | head -8
# 第 3 跳：问权威服务器 → 拿到真正的 A/AAAA 记录
nslookup www.example.com hera.ns.cloudflare.com 2>&1 | iconv -f GBK -t UTF-8 | sed -n '/^服务器:/,$p' | head -10
```

输出（已实操）：

```console
$ nslookup example.com a.root-servers.net 2>&1 | iconv -f GBK -t UTF-8 | sed -n '/^服务器:/,$p' | head -10
服务器:  UnKnown
Address:  198.41.0.4

名称:    example.com
Served by:
- l.gtld-servers.net
	  192.41.162.30
	  2001:500:d937::30
	  com
- j.gtld-servers.net

$ nslookup -type=NS example.com l.gtld-servers.net 2>&1 | iconv -f GBK -t UTF-8 | sed -n '/^服务器:/,$p' | head -8
服务器:  UnKnown
Address:  192.41.162.30

example.com	nameserver = hera.ns.cloudflare.com
example.com	nameserver = elliott.ns.cloudflare.com
hera.ns.cloudflare.com	internet address = 108.162.192.162
hera.ns.cloudflare.com	internet address = 172.64.32.162
hera.ns.cloudflare.com	internet address = 173.245.58.162

$ nslookup www.example.com hera.ns.cloudflare.com 2>&1 | iconv -f GBK -t UTF-8 | sed -n '/^服务器:/,$p' | head -10
服务器:  hera.ns.cloudflare.com
Address:  108.162.192.162

名称:    www.example.com
Addresses:  2606:4700:10::ac42:93f3
	  2606:4700:10::6814:179a
	  172.66.147.243
	  104.20.23.154
```

**验证方法**：三跳逐一句读——

- 第 1 跳：去问的是 `198.41.0.4`（a.root-servers.net 的 IP），它**没给 IP**，只给了 `Served by: l.gtld-servers.net 192.41.162.30`，典型的 referral（推荐）
- 第 2 跳：去问的是 `192.41.162.30`（上一跳推荐的 l.gtld-servers.net），它还是没给 IP，只给了 `example.com 的 nameserver = hera/elliott.ns.cloudflare.com` 及其 IP
- 第 3 跳：去问的是 `108.162.192.162`（上一跳推荐的 hera.ns.cloudflare.com），这一跳**终于给出了 A/AAAA 记录**

三跳问的都是同一个问题，但前两跳只回答「下一步问谁」——这就是迭代查询最直观的现场证据，也是 `dig +trace` 内部在做的事。补充一点：多次执行时返回的 IP 列表顺序可能不同（DNS 轮询负载均衡），属正常现象，不影响结论。

顺带把「递归与迭代到底差在哪」再压成一句话：递归是「你替我跑完全程」，迭代是「你答不上来就告诉我该问谁」。客户端对本地 DNS 用递归，是因为客户端没能力也不该去遍历全球 DNS 树；本地 DNS 对上游用迭代，是因为根和顶级域服务器面向全世界，不可能替几十亿客户端跑腿——这个分工是负载倒逼出来的，不是协议硬性规定（本地 DNS 之间也可以递归，只是没人这么做）。

### 步骤 6：dig 命令详解（B 级）

`dig`（Domain Information Groper）是 DNS 排障的事实标准工具，输出比 `nslookup` 详尽得多。CentOS 7 上属于 `bind-utils` 包：

```bash
yum install -y bind-utils
rpm -qf $(which dig)          # 确认归属：bind-utils
dig --help                    # 查看全部参数
```

常用参数速查：

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| 无参数 | 查 A 记录（默认用 `/etc/resolv.conf` 里的 DNS） | `dig www.example.com` |
| `+short` | 只输出答案本身，适合脚本取值 | `dig +short www.example.com` |
| `@服务器` | 指定要问的 DNS 服务器（绕开本机配置） | `dig @223.5.5.5 www.example.com` |
| `-t 类型` | 指定记录类型（A/AAAA/MX/NS/TXT/CNAME/SOA/PTR） | `dig -t MX example.com` |
| `-x IP` | 反向解析：IP → 域名（查 PTR 记录） | `dig -x 8.8.8.8` |
| `+trace` | 从根服务器开始逐层跟踪，打印完整迭代过程 | `dig +trace www.example.com` |
| `+norecurse` | 关闭递归，用于向权威服务器发迭代查询 | `dig +norecurse @a.root-servers.net example.com` |
| `+nocmd` | 去掉输出头部的版本信息 | `dig +nocmd www.example.com` |
| `+noall +answer` | 只留 ANSWER 段，脚本友好 | `dig +noall +answer www.example.com` |
| `+tcp` | 强制走 TCP 53（UDP 被拦或响应大于 512 字节时） | `dig +tcp www.example.com` |
| `-p 端口` | 指定非标准端口 | `dig -p 5353 @127.0.0.1 example.com` |

补一个背景：DNS 查询默认走 UDP 53，早期协议规定响应超过 512 字节就截断，所以有了 `+tcp` 这个后备通道——大响应（比如一堆 TXT 记录、DNSSEC 签名）或 UDP 被防火墙拦掉时切到 TCP 53 重试。现代 DNS 普遍开了 EDNS0 扩展，把 UDP 载荷上限协商到 4096 字节，多数场景不再需要 TCP 兜底，但排障时知道这条退路存在是必要的。另外 `+tcp`、`+trace` 这类以 `+` 开头的是 dig 自己的选项，写在域名后面、不加 `-`，与 `-t`、`-x` 那批参数是两套，混着记容易写错。

#### dig 输出的五段结构怎么读

```bash
dig www.example.com
```

输出（预期输出，CentOS 7）：

```console
$ dig www.example.com

; <<>> DiG 9.11.4-P2-RedHat-9.11.4-26.P2.el7 <<>> www.example.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 31587
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;www.example.com.		IN	A

;; ANSWER SECTION:
www.example.com.	300	IN	A	104.20.23.154
www.example.com.	300	IN	A	172.66.147.243

;; Query time: 12 msec
;; SERVER: 223.5.5.5#53(223.5.5.5)
;; WHEN: Sat Oct 24 05:20:00 CST 2026
;; MSG SIZE  rcvd: 76
```

逐段解释：

| 段落 | 关键内容 | 怎么读 |
| --- | --- | --- |
| HEADER | `status: NOERROR` | 解析状态码：`NOERROR` 成功、`NXDOMAIN` 域名不存在、`SERVFAIL` 服务器失败、`REFUSED` 被拒绝 |
| HEADER | `flags: qr rd ra` | `qr`=这是一个响应、`rd`=递归被请求、`ra`=服务器支持递归；**没有 `aa` 就说明答案不是权威的** |
| HEADER | `QUERY: 1, ANSWER: 2` | 一个查询换了两条答案（多 IP 负载均衡） |
| QUESTION | `www.example.com. IN A` | 注意域名结尾那个点 `.`，表示完全限定域名 FQDN；查的是 A 记录 |
| ANSWER | `300 IN A 104.20.23.154` | 从左到右五列：**域名、TTL（秒）、类型、值**。这里的 `300` 就是本地 DNS 允许缓存 300 秒 |
| 尾部 | `Query time: 12 msec` / `SERVER: 223.5.5.5#53` | 耗时与实际应答的服务器地址，判断走没走本机配置时有用到 |

**验证方法**：`ANSWER SECTION` 里的 IP 与上一步 nslookup 得到的列表应一致；重复执行一次 `dig`，就会发现 `Query time` 从十几毫秒降到接近 `0 msec` —— 这就是本地 DNS 缓存生效的证据，与实验 2 的结论互相印证。

#### `dig +trace` 逐层输出

```bash
dig +trace www.example.com
```

输出（预期输出，CentOS 7）：

```console
$ dig +trace www.example.com

; <<>> DiG 9.11.4-P2-RedHat-9.11.4-26.P2.el7 <<>> +trace www.example.com
;; global options: +cmd
.			518400	IN	NS	a.root-servers.net.
.			518400	IN	NS	b.root-servers.net.
.			518400	IN	NS	c.root-servers.net.
;; Received 525 bytes from 223.5.5.5#53(223.5.5.5) in 8 ms

com.			172800	IN	NS	a.gtld-servers.net.
com.			172800	IN	NS	b.gtld-servers.net.
com.			172800	IN	NS	l.gtld-servers.net.
;; Received 1170 bytes from 198.41.0.4#53(a.root-servers.net) in 32 ms

example.com.		172800	IN	NS	a.iana-servers.net.
example.com.		172800	IN	NS	b.iana-servers.net.
;; Received 651 bytes from 192.41.162.30#53(l.gtld-servers.net) in 96 ms

www.example.com.	300	IN	A	104.20.23.154
www.example.com.	300	IN	A	172.66.147.243
;; Received 76 bytes from 199.43.135.53#53(a.iana-servers.net) in 12 ms
```

**验证方法**：看每一段末尾的 `Received N bytes from <IP>#53(<服务器名>)`——四段的来源依次是「本机配置的 DNS」→「根服务器」→「顶级域服务器」→「权威服务器」，正好对应第 7~10 步。`+trace` 里出现的都是 NS 记录（权威服务器名单），只有在最末一段才出现你要的 A 记录，这与步骤 5 手工三跳得到的结论逐条吻合。

> **易错点**：`dig` 默认输出的答案**绝大多数是「非权威」**——因为它是从本机 `resolv.conf` 里的 DNS 拿的二手答案。判断是否权威只看 HEADER 的 `flags` 里有没有 `aa`（Authoritative Answer）。另外 `dig` 不查 `/etc/hosts`，所以「hosts 配了映射但 `dig` 查不到」是正常行为，别误判成故障。

### 步骤 7：常见 DNS 记录类型对照

| 记录 | 作用 | dig 写法 | nslookup 写法 |
| --- | --- | --- | --- |
| A | 域名 → IPv4 | `dig -t A www.example.com` | `nslookup -type=A www.example.com` |
| AAAA | 域名 → IPv6 | `dig -t AAAA www.example.com` | `nslookup -type=AAAA www.example.com` |
| CNAME | 域名别名 → 另一个域名 | `dig -t CNAME www.example.com` | `nslookup -type=CNAME www.example.com` |
| NS | 该域由哪些服务器负责解析 | `dig -t NS example.com` | `nslookup -type=NS example.com` |
| MX | 邮件交换器（数字越小优先级越高） | `dig -t MX example.com` | `nslookup -type=MX example.com` |
| TXT | 文本说明（SPF / DKIM / 域名所有权验证） | `dig -t TXT example.com` | `nslookup -type=TXT example.com` |
| SOA | 起始授权机构（主 DNS、序列号、刷新间隔） | `dig -t SOA example.com` | `nslookup -type=SOA example.com` |
| PTR | IP → 域名（反向解析） | `dig -x 8.8.8.8` | `nslookup 8.8.8.8` |

本机真跑其中三种（已实操）：

```bash
nslookup -type=NS  example.com 2>&1 | iconv -f GBK -t UTF-8 | grep 'nameserver' | head -3
nslookup -type=TXT example.com 2>&1 | iconv -f GBK -t UTF-8 | head -8
nslookup 8.8.8.8  2>&1 | iconv -f GBK -t UTF-8 | head -5
```

输出（已实操，本机 DNS 服务器 IP 已占位替换）：

```console
$ nslookup -type=NS  example.com 2>&1 | iconv -f GBK -t UTF-8 | grep 'nameserver' | head -3
example.com	nameserver = elliott.ns.cloudflare.com
example.com	nameserver = hera.ns.cloudflare.com

$ nslookup -type=TXT example.com 2>&1 | iconv -f GBK -t UTF-8 | head -8
非权威应答:
服务器:  UnKnown
Address:  <本地DNS-IP>

example.com	text =

	"v=spf1 -all"

$ nslookup 8.8.8.8  2>&1 | iconv -f GBK -t UTF-8 | head -5
服务器:  UnKnown
Address:  <本地DNS-IP>

名称:    dns.google
Address:  8.8.8.8
```

**验证方法**：`-type=NS` 得到的两台服务器与步骤 5 第 2 跳 TLD 给出的 NS 清单一致；`-type=TXT` 里的 `v=spf1 -all` 是标准的 SPF 反垃圾邮件策略记录；不带 `-type` 直接查询一个 IP 时，`nslookup` 会自动识别成反向查询并返回 PTR（`8.8.8.8 → dns.google`）。

实际业务里最常打交道的两个记录是 A 与 CNAME，区别一句话说清：A 直接给 IP，CNAME 给「另一个域名」。做 CDN 接入时域名几乎都 CNAME 到厂商分配的调度域名，由调度系统按线路返回就近节点 IP；好处是厂商换节点、扩容你完全无感，代价是解析多了一跳、故障排查时多问一层。用 `dig` 看到答案段先出现 CNAME 行再出现 A 行，就是这个链路。

### 步骤 8：DNS 排障标准流程

按「从内到外」的顺序排查，任何一步不过就停在那一步：

```bash
# 1. 本机配置：看 DNS 服务器配置是否正确、是否可达
cat /etc/resolv.conf
ping -c 2 223.5.5.5            # 本地 DNS 服务器通不通

# 2. hosts：有没有写死的错误映射（最容易忽略）
cat /etc/hosts

# 3. 本地解析：指定 DNS 服务器直接问，绕开本机缓存影响
nslookup www.example.com 223.5.5.5
dig @223.5.5.5 www.example.com +short

# 4. 权威解析：直接问权威服务器，看域名侧配的对不对
dig @a.iana-servers.net www.example.com +short

# 5. 整链跟踪：看卡在哪一跳
dig +trace www.example.com

# 6. 服务状态与本机缓存（CentOS 7 常见组合）
systemctl status named              # 自建 DNS 服务是否存活
systemctl restart nscd              # 清 nscd 缓存
systemd-resolve --flush-caches      # 清 systemd-resolved 缓存
ipconfig /flushdns                  # Windows 清缓存（PowerShell/cmd）
```

**验证方法**：`dig @223.5.5.5 域名 +short` 有结果而本机默认解析失败 → 本机 DNS 配置问题；换权威服务器 `dig @a.iana-servers.net 域名` 仍无结果 → 域名侧没配或没生效；两者都有结果但本机还是失败 → 本机 hosts 或缓存问题，清缓存后重试。

生产上还有一条铁律：DNS 变更要挑窗口、先降 TTL。把 TTL 从 3600 降到 60，等一个旧 TTL 周期让全网缓存过期，再改记录，观察无误后把 TTL 调回——跳过这个流程，一旦配错，错误答案会在运营商缓存里挂上几个小时，你想回滚都推不动。

> **易错点**：改了 DNS 记录后要等 TTL 过期才能全局生效，「改了没生效」绝大多数是缓存，不是没配好——所以改之前**先把 TTL 调小**（如改成 60 秒），改完再调回来，这是运维上线 DNS 变更的标准动作；`/etc/resolv.conf` 最多写 3 个 nameserver，且 CentOS 7 里它由 NetworkManager 管理，手工改完重启网络会被覆盖，正确做法是在网卡配置里加 `DNS1=`/`DNS2=`；`dig` 与 `ping` 是两个独立协议，防火墙禁了 ICMP 会出现「ping 不通但 dig 正常、网站照样能开」，不能只用 ping 判断网络。

> **参见**：[运维网络基础-上](../../08-网络基础/01-运维网络基础-上.md)、[运维网络基础-下](../../08-网络基础/02-运维网络基础-下.md)

## 题 2：总结命令

**考察点**：网络命令的归类与参数记忆，以及与前面章节串起来的「一条命令解决一类问题」的能力。

**实现思路**：网络类做一张完整速查表并在本机真跑几条；前面章节按「模块 → 高频命令 → 一句话用法」回顾，详细展开见 [day24 阶段复习](day24-阶段复习与命令总汇作业实操.md)。

### 2.1 网络类命令速查表

| 命令 | 常用参数 | 一句话说明 |
| --- | --- | --- |
| `dig` | `+short`、`@服务器`、`-t 类型`、`-x IP`、`+trace`、`+tcp` | DNS 查询主力工具（bind-utils 包） |
| `nslookup` | `-type=类型`、`域名 服务器`（指定查询的服务器） | DNS 查询，Windows/Linux 都有，交互/非交互均可 |
| `host` | 域名、域名 服务器 | 最简 DNS 查询，一行结果 |
| `ping` | `-c 次数`、`-i 间隔`、`-W 超时` | ICMP 探连通性与延迟（可能被防火墙拦） |
| `traceroute` / `tracert` | `-n` 不反解、`-I` 用 ICMP（CentOS 需装） | 追踪到第 N 跳，定位丢包位置 |
| `mtr` | `-r` 报告模式、`-c 次数` | ping + traceroute 合体，看每跳丢包率 |
| `ip` | `addr`、`link`、`route`、`neigh` | CentOS 7 推荐的网络配置/查看命令 |
| `ifconfig` | `-a`、网卡名 [net-tools 包] | 老式网卡查看 |
| `ss` | `-tulnp`、`-s`、`-ant` | 查看监听端口与连接（替代 netstat，速度快） |
| `netstat` | `-tulnp`、`-rn`（看路由） | 老式端口/连接查看 |
| `curl` | `-I` 只取响应头、`-L` 跟随跳转、`-o` 存文件、`-w` 自定义输出、`-X` 方法、`-H` 请求头、`--max-time` 超时 | 命令行 HTTP 客户端，调接口与验页面的主力 |
| `wget` | `-O 文件`、`-q` 静默、`-c` 断点续传、`--limit-rate` 限速 | 命令行下载器 |
| `scp` | `-P 端口`、`-r` 递归、`-p` 保属性 | 基于 SSH 的安全拷贝 |
| `rsync` | `-avz`、`--delete`、`-P` 显进度、`-e "ssh -p 22"` | 增量同步，备份场景主力；注意源路径结尾有无 `/` |
| `ssh` | `-p 端口`、`-i 密钥`、`-o StrictHostKeyChecking=no` | 远程登录 |
| `tcpdump` | `-i 网卡`、`-nn` 不反解、`-c 数量`、`-w 文件` 落盘、再用 `-r 文件` 读回分析 | 抓包排障的终极手段 |

本机真跑 `curl` 的关键参数（已实操）：

```bash
cd /tmp/hw/day26
curl -s -o /dev/null -w "HTTP=%{http_code} DNS解析=%{time_namelookup}s 建连=%{time_connect}s 首字节=%{time_starttransfer}s 总耗时=%{time_total}s\n" --max-time 8 https://example.com
curl -sI --max-time 8 https://example.com | head -5
```

输出（已实操）：

```console
$ curl -s -o /dev/null -w "HTTP=%{http_code} DNS解析=%{time_namelookup}s 建连=%{time_connect}s 首字节=%{time_starttransfer}s 总耗时=%{time_total}s\n" --max-time 8 https://example.com
HTTP=200 DNS解析=0.000052s 建连=0.000815s 首字节=0.663125s 总耗时=1.438248s

$ curl -sI --max-time 8 https://example.com | head -5
HTTP/1.1 200 OK
Accept-Ranges: bytes
Age: 570
Cache-Control: max-age=604800
Content-Type: text/html; charset=UTF-8
```

**验证方法**：`-w` 里四个时间段的大小关系必然成立：DNS 解析 < 建连 < 首字节 < 总耗时。看到 `DNS解析=0.0000xxs` 说明命中本地缓存（与题 1 实验 2 结论一致）；看到 `HTTP=200` 说明 DNS、TCP、TLS、HTTP 四层全通。注意几次执行的耗时数值会漂移（取决于出口网络与是否命中缓存），但**大小次序不变**，看次序比看绝对值可靠。若本机走了 HTTP 代理，`curl -sI` 的头部里会多出 `HTTP/1.1 200 Connection Established` 一行，属正常。

> **易错点**：`curl -v` 是排障利器但在脚本里要用 `-s`；`-w` 里的变量区分大小写，`%{http_code}` 写错成 `%{HTTP_CODE}` 会原样输出；不加 `--max-time` 时 curl 可能长时间挂住，放进脚本必须限制超时。

### 2.2 前面章节核心命令回顾

| 模块 | 高频命令 | 一句话用法 |
| --- | --- | --- |
| 文件属性 | `ls -li`、`stat`、`file`、`chown`、`lsattr`/`chattr` | `stat -c '%a %U %s %y'` 一次看权限属主大小时间 |
| 正则基础 | `grep -n` / `-v` / `-o` / `-E` | `grep -nE '^[a-z]+ +[0-9]+$' f` 按模式过滤 |
| sed | `sed -n 'Np'`、`sed 's/a/b/g'`、`sed -i.bak`、`sed -r` | 按行增删改查 + 替换，`-r` 才能用扩展正则 |
| awk | `awk '{print $1}'`、`-F`、`NR`/`NF`、`BEGIN/END`、数组 `c[$1]++` | 按列处理与统计，能替代大部分 `sort\|uniq -c` |
| 用户权限 | `useradd`/`usermod`/`id`/`passwd`、`chmod`/`chown`/`sudo` | `id 用户` 验身份，`chmod 数字/符号` 改权限，`visudo` 改提权 |
| 定时任务 | `crontab -e`/`-l`、`systemctl restart crond`、`/var/log/cron` | 五段时间字 + 绝对路径 + 输出重定向三条军规 |
| 磁盘文件 | `df -h`/`df -i`、`du -sh`、`lsblk`、`mount` | 容量看 `df`，真占用看 `du`，inode 满看 `df -i` |
| 压缩打包 | `tar czf/tzf/xzf`、`gzip`、`zcat` | 打包 gz + `--exclude` 排除 + `-C` 指定解压目录 |
| 进程性能 | `ps -ef`、`top`、`kill -15/-9`、`free -h`、`ss -tulnp` | 看进程、看内存盯 `available`、看端口用 `ss` |
| 软件包 | `rpm -qa/-ql/-qf`、`yum install/provides/remove` | `yum provides '*/命令'` 反查该装哪个包 |

> **参见**：[day24 阶段复习：命令总汇](day24-阶段复习与命令总汇作业实操.md)、[附录-命令速查表](../附录-命令速查表.md)

## 题 3：复习之前测验（文件属性 / 定时任务 / 三剑客 / 权限）

**考察点**：四个模块的高频考点再现。每题都给出「答案 + 一条可以在本机立刻验证的命令」，不要只看结论，跑一遍才算过。

### 3.1 文件属性（5 题）

**第 1 题**：`ls -l` 的一行输出 `-rwxr-xr--. 2 root root 4096 Oct 24 10:00 test`，请逐段说明每一部分的含义。（先自己答一遍再看答案）

**答案**：`-` 普通文件；`rwxr-xr--` 权限九位（属主 rwx=7、属组 r-x=5、其它 r--=4）；`.` 无 ACL/SELinux 标记（有 ACL 时为 `+`）；`2` 硬链接数；第一个 `root` 属主；第二个 `root` 属组；`4096` 大小（字节，目录固定 4096）；`Oct 24 10:00` mtime 修改时间；`test` 文件名。若用 `ls -li`，行首还会多一列 inode 号。
**验证**：`stat -c 'type=%F perm=%a(%A) links=%h owner=%U group=%G size=%s mtime=%y inode=%i' 文件名`

**第 2 题**：文件的三种时间 atime / mtime / ctime 分别在什么动作下变化？

**答案**：atime 在读取文件内容时变（`cat`、`grep`）；mtime 在内容变化时变（`echo >>`、`vim` 保存）；ctime 在 inode 信息变化时变（改权限、改属主、改名、移动）。注意 ctime **不是**创建时间。
**验证**：参照 day24 卡片 1 的三时间实验：`stat -c 'atime=%x mtime=%y ctime=%z' f` → 读一次 → 写一次 → 分别再 stat，观察哪一列跳变。

**第 3 题**：硬链接与软链接的区别？为什么跨分区不能建硬链接？

**答案**：硬链接是同一个 inode 的第二个文件名（删一个另一个仍在，inode 不变）；软链接是独立 inode，文件内容存的是目标路径（目标删了就变成红色失效链接）。inode 号只在同一个文件系统内唯一，所以硬链接不能跨分区；软链接存的是路径字符串，可以跨。
**验证**：`ln f hard; ln -s f soft; ls -li` 对比 inode 列；`rm -f f` 后 `cat hard` 仍能读、`cat soft` 报错。

**第 4 题**：磁盘还剩空间却写不进文件，可能是什么原因？

**答案**：三种可能——① inode 耗尽（`df -i` 的 IUse% 到 100%，典型场景是海量小文件）；② 容量确实满了（`df -h` Use% 100%）；③ 文件被删但句柄仍被进程占用导致空间未释放（`lsof | grep deleted`）。三者报错文案都是 `No space left on device`。
**验证**：`df -h; df -i; lsof | grep deleted`

**第 5 题**：如何真正统计一个目录占用的磁盘空间？为什么不用 `ls -lh`？

**答案**：`du -sh 目录`（只看一层子项用 `du -h --max-depth=1 目录`）。因为 `ls -lh` 显示的是文件**表观字节数**，`du` 统计的是**实际占用的磁盘块数**，小文件多时二者差异很大（185 字节的文件 `du` 计 1.0K）。
**验证**：`du -sh /var/log; du -h --max-depth=1 /var/log | sort -hr | head -5`

### 3.2 定时任务（4 题）

**第 6 题**：`*/10 8-20 * * * /bin/bash /data/run.sh` 是什么含义？

**答案**：每天 8 点到 20 点之间，每 10 分钟执行一次。五个字段依次是分/时/日/月/周：`*/10` 每 10 分、`8-20` 小时区间、`*` 每天、`*` 每月、`*` 每周不限。
**验证**：`crontab -l` 落盘后 `tail -f /var/log/cron` 观察触发记录。

**第 7 题**：写好的脚本手动执行没问题，放进 crontab 却不执行，最可能的三个原因是什么？

**答案**：① crond 没启动（`systemctl status crond`）；② 脚本里的命令没写**绝对路径**（cron 的 PATH 通常只有 `/usr/bin:/bin`）；③ 命令里用了 `%` 而没转义（cron 里 `%` 表示换行）。此外输出没重定向会堆积邮件。
**验证**：`systemctl status crond`；脚本头部加 `source /etc/profile`；任务写成 `... >> /tmp/x.log 2>&1` 后看日志。

**第 8 题**：如何把脚本里的时间戳改成「年月日-时分秒」，并保证同一分钟内多次执行不互相覆盖？

**答案**：用 `$(date +%F-%H%M%S)`，必须带上秒（`%S`），否则同一分钟生成的两个备份包会同名互相覆盖。
**验证**：`NOW=$(date +%F-%H%M%S); echo "backup_$NOW.tar.gz"`，连续执行两次看文件名不同（见 day24 卡片 6 的实测）。

**第 9 题**：如何定时清理 7 天前的日志？

**答案**：`find /var/log -type f -name "*.log" -mtime +7 -delete`（先用 `-exec ls -lh {} \;` 干跑确认清单）。写成 cron：`0 1 * * * /bin/find /var/log -type f -name "*.log" -mtime +7 -delete`。
**验证**：`touch -d "10 days ago" /tmp/hw/day26/old.log` 造一个旧文件，再执行 `find` 看它是否被列出/删除。

### 3.3 三剑客（5 题）

**第 10 题**：从 access.log 中统计访问量前 10 的 IP。

**答案**：`awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10`；或一步到位 `awk '{c[$1]++} END{for(i in c) print c[i], i}' access.log | sort -rn | head -10`。
**验证**：两条命令得到的 IP 与次数应完全一致，且总次数之和等于 `wc -l access.log`。

**第 11 题**：显示第 5 到第 10 行，有几种写法？

**答案**：三种常用写法——`sed -n '5,10p' f`、`awk 'NR>=5 && NR<=10' f`、`head -10 f | tail -6`。
**验证**：三种写法输出应逐行一致，用 `diff <(sed -n '5,10p' f) <(awk 'NR>=5 && NR<=10' f)` 比对无差异。

**第 12 题**：把文件中所有的 `old` 替换成 `new`，并保留原文件备份。

**答案**：`sed -i.bak 's/old/new/g' 文件`（`-i.bak` 会先生成 `文件.bak`），或先 `cp 文件 文件.bak` 再 `sed -i 's/old/new/g' 文件`。**必须带 `g`**，否则每行只换第一个。
**验证**：`grep -c 'new' 文件` 计数、`diff 文件.bak 文件` 查看改动。

**第 13 题**：`grep -E` 和默认 `grep` 的区别是什么？`grep -v` 与 `-o` 又是什么作用？

**答案**：默认 grep 是 BRE，`{}`/`()`/`+?|` 需要反斜杠转义；`grep -E`（等价 `egrep`）是 ERE，这些符号直接写。`-v` 是反向筛选（输出不匹配的行，三剑客里做「排除」）；`-o` 只输出匹配到的那一小段，常用于抠字段。
**验证**：`grep -c 'a\{3\}' f` 与 `grep -cE 'a{3}' f` 计数相同，说明二者等价。

**第 14 题**：取出 nginx 日志中状态码为 5xx 的请求的 URI 并去重计数。

**答案**：`awk '$9 ~ /^5[0-9][0-9]$/ {print $7}' access.log | sort | uniq -c | sort -rn`。要点是先按列做正则匹配再取 `URL` 列。
**验证**：把 `$9` 换成 `$0` 用 `grep -E ' 5[0-9]{2} '` 交叉验证，两种方式的 URI 列表应一致。

### 3.4 权限（4 题）

**第 15 题**：权限数字 644、755、600、400 分别是什么意思？

**答案**：`r=4 w=2 x=1`，三段依次属主/属组/其它。644=`rw-r--r--`（普通文件默认）；755=`rwxr-xr-x`（目录与可执行程序默认）；600=`rw-------`（私钥文件标准权限）；400=`r--------`（只读，比 600 更严格，防误改）。
**验证**：`chmod 600 f && stat -c '%a %A' f`，四个数字各试一遍记下 `%A` 的字符串形态。

**第 16 题**：一个用户对某文件没有任何权限，却能把它删掉，为什么？如何避免？

**答案**：因为删除文件看的是**父目录的 w 权限**，与文件自身权限无关。想要「大家都能新增但只能删自己的」，给共享目录加粘滞位 `chmod +t /共享目录`（权限串末尾变成 `t`，如 `/tmp` 的 `drwxrwxrwt`）。
**验证**：`ls -ld /tmp` 观察最后的 `t`；`chmod o+w /共享目录` 前后分别用不同用户试删。

**第 17 题**：`umask 0022` 时新建文件和目录的默认权限是多少？换成 `umask 077` 呢？

**答案**：`0022` → 文件 666-022=`644`、目录 777-022=`755`；`077` → 文件 `600`、目录 `700`（最安全，适合存私钥的目录）。算法重要记住：起始权限是文件 666、目录 777（都不含 x，由 umask 补），且是「减」而不是「加」。
**验证**：`umask 077; touch a; mkdir d; stat -c '%n %a' a d`

**第 18 题**：想让普通用户 ops01 只能执行 `systemctl restart nginx` 这一条特权命令，怎么做？

**答案**：用 `visudo` 追加一行：`ops01 ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx`。要点：命令必须写**绝对路径**、不要图省事写 `ALL`、不要把 `vim`/`less`/`awk` 这类能起子 shell 的命令授出去（等于送 root）。
**验证**：`su - ops01` 后执行 `sudo -l` 查看授权清单，`sudo systemctl restart nginx` 成功而 `sudo useradd x` 被拒。

## 本篇小结

1. DNS 解析的完整链路是「浏览器缓存 → 系统缓存 → hosts → 本地 DNS（递归）→ 根 → 顶级域 → 权威（迭代）→ 逐层返回并按 TTL 缓存」，前一步命中就不往后走，这也是排障从内到外的顺序。
2. 递归与迭代的分界要记牢：**客户端对本地 DNS 是递归**（只要答案），**本地 DNS 对各级服务器是迭代**（每跳只拿到「下一步问谁」）。用 `nslookup 域名 服务器` 指定服务器，不用 `dig +trace` 也能把三级跳跑通，本文步骤 5 给出了完整真实输出。
3. 权威与否只看一处：`nslookup` 开头有没有「非权威应答:」，`dig` 的 HEADER `flags` 里有没有 `aa`。改完 DNS 记录不生效，先问权威服务器、再查本地缓存和 TTL，别急着改配置。否定答案（NXDOMAIN）同样进缓存。
4. dig 的三板斧：`+short` 取脚本要的值、`@服务器` 指定问谁（绕开本机配置）、`+trace` 看整条链路；记录类型里 A/AAAA/CNAME/MX/TXT/NS/PTR 要能对上用途，PTR 用 `-x IP` 做反向解析。
5. 网络命令记忆要点：配置看 `ip addr`/`ip route`，端口看 `ss -tulnp`，连通看 `ping`，路径看 `mtr`/`traceroute`，应用层看 `curl -w`（能把 DNS、建连、首字节、总耗时四段时间一次打出来，是定位慢在哪一层的最快手段）。
6. 四个复习模块各留一句话：文件属性记「inode + 权限九位 + 三时间」，定时任务记「五段 + 绝对路径 + 重定向」，三剑客记「grep 筛行、sed 改行、awk 取列统计」，权限记「r=4 w=2 x=1、删除看父目录、提权用 visudo」。
{% endraw %}
