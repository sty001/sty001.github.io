---
title: "day40-网站访问统计与压力测试作业实操"
date: 2026-10-24 09:17:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操]
slug: "linux-homework-41"
---

{% raw %}
课程第 40 天的作业落在两件事上：①熟悉排序和去重命令，对文件里的数值信息做统计分析——找出用户访问最多的前 10 个页面；②对网站做压力测试。第一题先拿 sort/uniq 热身，再构造一份 274 行、nginx combined 格式的 access.log 样例，用 `awk + sort + uniq -c + sort -rn + head` 组合拳真跑出访问量前 10 的 URL，顺手扩展出 IP Top5、状态码分布、响应总流量、404 明细四组统计；第二题给出 ab（ApacheBench）与 webbench 两款压测工具的标准命令、完整预期输出与关键指标解读。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：文本统计核心命令（awk/sort/uniq/head/wc/grep）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令（`ab`、`webbench`）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

环境实测：GNU bash 5.3、GNU awk 5.4、GNU sort 9.4，统计三件套与 CentOS 7 的行为完全一致。实操目录统一用 `/tmp/hw/day40`。日志中的 IP、URL、User-Agent 均为脱敏后的构造数据，属主统一显示为 `user`。`ab` 与 `webbench` 在本环境不存在，压测部分按 B 级给出。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1-基础 | 熟悉排序和去重命令（sort/uniq） | A 级（3 组真跑） |
| 题 1-主体 | 统计用户访问最多的前 10 个页面 | A 级（真跑，含 4 组扩展统计） |
| 题 2 | 如何对网站进行压力测试 | B 级（ab/webbench 标准命令 + 指标解读） |

## 题 1：排序去重命令与访问页面 Top10 统计

**考察点**：`awk` 取列、`sort` 排序、`uniq -c` 去重计数、`sort -rn` 数字倒序、`head` 取前 N 行——五条命令串成日志分析最经典的组合拳；以及「uniq 只能合并相邻重复行，必须先 sort」这条最容易踩的规则。

**实现思路**：nginx 访问日志（combined 格式）每行用空格分隔，第 7 列（`$7`）就是请求的 URL。统计「哪个页面被访问最多」就是「按 URL 分组计数再倒序取前 10」：

1. `awk '{print $7}'` 把所有 URL 单独抽出来；
2. `sort` 把相同 URL 排到一起（为 uniq 做准备）；
3. `uniq -c` 合并相邻重复行并给出次数；
4. `sort -rn` 按次数从大到小排；
5. `head -10` 取前 10 名。

### 步骤 1：sort 与 uniq 基础热身（已实操）

先在一个 6 行小文件上把「排序、去重、计数」三个动作看清楚：

```bash
mkdir -p /tmp/hw/day40 && cd /tmp/hw/day40
printf 'banana\napple\nbanana\ncherry\napple\nbanana\n' > fruit.txt
sort fruit.txt
sort fruit.txt | uniq -c
sort fruit.txt | uniq -c | sort -rn
```

输出：

```text
$ sort fruit.txt
apple
apple
banana
banana
banana
cherry
$ sort fruit.txt | uniq -c
      2 apple
      3 banana
      1 cherry
$ sort fruit.txt | uniq -c | sort -rn
      3 banana
      2 apple
      1 cherry
```

三个结论：`sort` 把相同内容排到相邻；`uniq -c` 只合并**相邻**的重复行并输出次数；`sort -rn` 中 `-n` 按数值比较（否则 `10` 会排在 `2` 前面）、`-r` 倒序。

### 步骤 2：构造 access.log 样例（已实操）

统计前先要有像样的数据。用 Python 按固定随机种子生成一份 274 行、nginx combined 格式的日志（13 个 URL、8 个来源 IP、4 种状态码），保证结果可复现：

```bash
cat > gen_log.py <<'EOF'
import random
random.seed(20261024)

urls = [
    ('/index.html', 62), ('/login', 45), ('/api/goods/list', 38),
    ('/static/js/app.js', 30), ('/api/user/info', 24), ('/category/it.html', 18),
    ('/article/1024.html', 14), ('/static/css/style.css', 11),
    ('/api/order/create', 9), ('/images/logo.png', 8),
    ('/about.html', 6), ('/api/comment/list', 5), ('/favicon.ico', 4),
]
ips = ['10.0.0.%d' % n for n in (7, 15, 23, 31, 47, 88, 129, 203)]
statuses = [200] * 82 + [304] * 10 + [404] * 5 + [500] * 3
refs = ['https://example.com/', 'https://www.example.com/index.html', '-']
uas = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'curl/7.29.0',
       'Mozilla/5.0 (Linux; Android 13)']

pool = []
for u, n in urls:
    pool += [u] * n
random.shuffle(pool)

lines = []
for u in pool:
    ip = random.choice(ips)
    st = random.choice(statuses)
    size = random.randint(120, 45000) if st == 200 else 0
    method = 'POST' if u.startswith('/api/order') else 'GET'
    lines.append(
        '%s - - [%s/Oct/2026:%02d:%02d:%02d +0800] "%s %s HTTP/1.1" %d %d "%s" "%s"'
        % (ip, random.choice(['23', '24']), random.randint(8, 22),
           random.randint(0, 59), random.randint(0, 59),
           method, u, st, size, random.choice(refs), random.choice(uas))
    )
open('access.log', 'w').write('\n'.join(lines) + '\n')
EOF
python gen_log.py && wc -l access.log
```

输出：

```text
274 access.log
```

先看 5 行真实样例，确认字段位置（第 1 列 IP、第 7 列 URL、第 9 列状态码、第 10 列字节数）：

```bash
head -5 access.log
```

输出：

```text
10.0.0.31 - - [23/Oct/2026:10:16:12 +0800] "GET /index.html HTTP/1.1" 200 33786 "https://www.example.com/index.html" "curl/7.29.0"
10.0.0.203 - - [23/Oct/2026:16:39:34 +0800] "GET /category/it.html HTTP/1.1" 200 28134 "https://example.com/" "Mozilla/5.0 (Linux; Android 13)"
10.0.0.23 - - [24/Oct/2026:21:21:58 +0800] "GET /index.html HTTP/1.1" 200 37880 "https://example.com/" "Mozilla/5.0 (Linux; Android 13)"
10.0.0.88 - - [23/Oct/2026:20:12:34 +0800] "GET /index.html HTTP/1.1" 404 0 "https://www.example.com/index.html" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
10.0.0.88 - - [23/Oct/2026:18:14:07 +0800] "GET /article/1024.html HTTP/1.1" 200 36920 "https://www.example.com/index.html" "curl/7.29.0"
```

### 步骤 3：统计访问次数前 10 的页面（已实操，作业主体）

```bash
awk '{print $7}' access.log | sort | uniq -c | sort -rn | head -10
```

输出：

```text
     62 /index.html
     45 /login
     38 /api/goods/list
     30 /static/js/app.js
     24 /api/user/info
     18 /category/it.html
     14 /article/1024.html
     11 /static/css/style.css
      9 /api/order/create
      8 /images/logo.png
```

首页 `/index.html` 以 62 次居首，`/login` 与商品列表接口次之——与构造数据的设计一致，统计链路正确。这一条命令就是本题的标准答案写法。

### 步骤 4：四组扩展统计（已实操）

同一套组合拳换一列就能统计别的维度，这是本题真正的价值所在：

```bash
# 4.1 访问次数前 5 的客户端 IP
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -5
# 4.2 HTTP 状态码分布
awk '{print $9}' access.log | sort | uniq -c | sort -rn
# 4.3 响应字节总数（awk 累加）
awk '{s+=$10} END{printf "total_bytes=%d\n", s}' access.log
# 4.4 产生 404 的 URL 明细
awk '$9==404 {print $7}' access.log | sort | uniq -c | sort -rn | head -5
```

输出：

```text
     48 10.0.0.31
     35 10.0.0.88
     35 10.0.0.203
     34 10.0.0.129
     33 10.0.0.7
------
    222 200
     30 304
     15 404
      7 500
------
total_bytes=5079836
------
      8 /index.html
      3 /category/it.html
      1 /static/js/app.js
      1 /static/css/style.css
      1 /api/user/info
```

（为省篇幅，四段输出以 `------` 分隔；真实执行时是四条命令分别输出。）

解读：`4.1` 找出访问最频繁的来源（结合日志时间还能定位采集器或爬虫）；`4.2` 中 304 表示客户端缓存命中，占比高是好事；`4.3` 的 `s+=$10` 是 awk 最常用的累加模式；`4.4` 里 `/index.html` 出现 8 次 404 值得排查——很可能是热链或配置错误。这类统计在真实机器上建议落成定时任务，每天出一份 Top 榜，流量异动时才有基线可比。

### 步骤 5：按小时统计访问量分布（已实操）

访问量分析还有一个常用维度——时间。日志第 4 列是 `[23/Oct/2026:10:16:12` 这样的时间戳（带方括号），用 awk 的 `substr($4,2,14)` 从第 2 个字符起截 14 位，正好得到「日期:小时」：

```bash
# 5.1 每小时访问量分布
awk '{print substr($4,2,14)}' access.log | sort | uniq -c
# 5.2 访问量最高的三个小时
awk '{print substr($4,2,14)}' access.log | sort | uniq -c | sort -rn | head -3
```

输出（5.1 共 30 行，此处为完整结果）：

```text
     10 23/Oct/2026:08
      8 23/Oct/2026:09
     16 23/Oct/2026:10
      5 23/Oct/2026:11
     10 23/Oct/2026:12
      9 23/Oct/2026:13
     12 23/Oct/2026:14
      9 23/Oct/2026:15
      7 23/Oct/2026:16
     11 23/Oct/2026:17
     13 23/Oct/2026:18
     12 23/Oct/2026:19
      8 23/Oct/2026:20
      4 23/Oct/2026:21
      7 23/Oct/2026:22
     11 24/Oct/2026:08
     13 24/Oct/2026:09
      5 24/Oct/2026:10
     15 24/Oct/2026:11
      7 24/Oct/2026:12
     11 24/Oct/2026:13
      6 24/Oct/2026:14
     12 24/Oct/2026:15
      7 24/Oct/2026:16
     13 24/Oct/2026:17
      6 24/Oct/2026:18
      4 24/Oct/2026:19
     10 24/Oct/2026:20
      9 24/Oct/2026:21
      4 24/Oct/2026:22
```

输出（5.2）：

```text
     16 23/Oct/2026:10
     15 24/Oct/2026:11
     13 24/Oct/2026:17
```

`substr($4,2,14)` 三个参数别写错：从第 2 位开始是为了跳过行首的 `[`，截 14 位才能把小时取全——只截 13 位会得到 `23/Oct/2026:1`，把 10 点、11 点混成一组。这个「日期+小时」聚合在做容量规划（几点扩容、几点跑批）时最常用。

### 步骤 6：命令逐段拆解

| 片段 | 作用 | 关键点 |
| --- | --- | --- |
| `awk '{print $7}'` | 抽出第 7 列 URL | `$0` 是整行，`$NF` 是最后一列 |
| `sort` | 排序使相同 URL 相邻 | uniq 只认相邻重复，此步不可省 |
| `uniq -c` | 去重并在行首加次数 | `-c` = count；不加 sort 直接 uniq 只合并紧邻行 |
| `sort -rn` | 按次数数值倒序 | 不加 `-n` 会按字典序把 10 排到 2 前 |
| `head -10` | 取前 10 行 | `-n 10` 的简写 |

> **易错点**：
>
> - `uniq` 不加 `sort` 直接用只去重「紧邻」的重复行，统计结果必然偏小，口诀是「**先 sort 后 uniq**」；
> - `sort -rn` 的 `-n` 别漏：默认字典序下 `62 < 8` 是「假排序」；
> - 列号不是死的：nginx 改过 `log_format`（如加了 `$request_time`、`$http_x_forwarded_for`）后 `$7` 可能不再是 URL，先 `head -1` 确认字段再取列；
> - URL 带查询串时（`/list?page=2`）会被当成不同页面，必要时先用 `awk -F'?' '{print $1}'` 切掉查询串再统计；
> - awk 程序体务必用**单引号**包裹，防止 shell 把 `$7`、`$9` 当自己的位置参数吃掉。

## 题 2：如何对网站进行压力测试

**考察点**：ab（ApacheBench）与 webbench 两款压测工具的基本用法，以及压测报告里 QPS、平均耗时、百分位耗时等关键指标的读法。

**实现思路**：压测说白了就是用受控的并发请求去量服务的吞吐上限。流程四步：装工具 → 选一个轻量目标页（首页或一个静态小文件）→ 以指定并发数发指定总数请求 → 读报告调优。**只允许对自己有权限的测试环境压测**，对生产环境或他人网站压测属于攻击行为，这是底线。

### 工具 1：ab（ApacheBench，B 级）

ab 由 `httpd-tools` 包提供，CentOS 7 直接 yum 安装：

```bash
yum install -y httpd-tools
ulimit -n 65535          # 并发高时先放大文件描述符限制
ab -n 1000 -c 100 http://127.0.0.1/index.html
```

参数含义：`-n 1000` 总请求数 1000，`-c 100` 并发数 100，URL 结尾必须带路径（压首页写 `/`）。

（预期输出，CentOS 7）

```text
Server Software:        nginx/1.20.1
Server Hostname:        127.0.0.1
Server Port:            80

Document Path:          /index.html
Document Length:        4057 bytes

Concurrency Level:      100
Time taken for tests:   1.234 seconds
Complete requests:      1000
Failed requests:        0
Write errors:           0
Total transferred:      4325000 bytes
Requests per second:    810.37 [#/sec] (mean)
Time per request:       123.400 [ms] (mean)
Time per request:       1.234 [ms] (mean, across all concurrent requests)
Transfer rate:          3423.21 [Kbytes/sec] received

Percentage of the requests served within a certain time (ms)
  50%    118
  66%    124
  75%    129
  80%    133
  90%    141
  95%    152
  98%    170
  99%    188
 100%    220 (longest request)
```

关键指标解读：

| 指标 | 含义 | 关注点 |
| --- | --- | --- |
| Complete requests / Failed requests | 完成/失败的请求数 | Failed 必须为 0，否则结果不可信 |
| Requests per second | 每秒请求数（QPS），最重要的吞吐指标 | 对比调优前后的核心数值 |
| Time per request（mean） | 用户视角平均等待时间 = 并发数 ÷ QPS | 终端用户体感 |
| Time per request（across all concurrent requests） | 服务器处理单个请求的平均耗时 = 1 ÷ QPS | 服务端真实性能 |
| Percentage ... within a certain time | 百分位耗时分布 | 看 95%/99% 长尾，平均数好看不代表没拖后腿的 |
| Transfer rate | 吞吐带宽 | 判断瓶颈在网络还是应用 |

读报告的顺序有讲究：先看 `Failed requests`，非 0 直接作废重测（常见原因是压测机自己文件描述符耗尽，或目标页返回了非 2xx）；再看 `Requests per second` 拿到吞吐基准；最后盯 95%/99% 百分位——平均值会被大量快请求拉低，长尾才是用户投诉的来源。另外 `Time per request` 有两行，第一行（123.400 ms）是用户视角等待时间，第二行（1.234 ms）才是服务端单请求耗时，两者差 100 倍是因为中间乘了并发数，别看混。

生产上还有一条：压测报告只对「当时的页面、当时的参数」负责，上线前压的数字会随数据量增长慢慢失真，容量评估要定期重压。

### 辨析：并发数、QPS 与 RT

三者有一条恒等式：**QPS = 并发数 ÷ 平均 RT**（RT 用秒）。用上面的报告验证：100 ÷ 0.1234 ≈ 810，正好等于报告里的 810.37。这条式子反过来用更有价值——

- RT 不变时，加并发 QPS 线性上涨；某次加压后 QPS 不再涨甚至掉，说明系统到了拐点（CPU 饱和、连接排队或锁竞争），再压只会堆积错误；
- 并发不变时 RT 突然翻倍，QPS 必然腰斩，先查后端慢在哪个环节（数据库慢查询、外部接口超时），而不是急着加机器；
- `Failed requests` 上涨而 QPS 仍在涨，多数是压测端先扛不住了（ulimit、端口耗尽），别急着给服务端定罪。

面试里问「压测怎么判断瓶颈」，答这条恒等式加拐点观察，比背一堆参数名有说服力。

### 工具 2：webbench（B 级）

webbench 需从官网下载源码编译安装（体积只有几十 KB）：

```bash
tar -xzf webbench-1.5.tar.gz && cd webbench-1.5
make && make install
webbench -c 200 -t 30 http://127.0.0.1/index.html
```

参数：`-c 200` 并发 200 个客户端，`-t 30` 持续压 30 秒。

（预期输出，CentOS 7）

```text
Webbench - Simple Web Benchmark 1.5
Copyright (c) Radim Kolar 1997-2004, GPL Open Source Software.

Benchmarking: GET http://127.0.0.1/index.html
200 clients, running 30 sec.

Speed=118560 pages/min, 2198754 bytes/sec.
Requests: 59280 susceed, 0 failed.
```

两个指标：`Speed`（折算每分钟页面数，除以 60 即 QPS）与 `Requests`（成功/失败数）。

### ab 与 webbench 对比及压测注意事项

| 维度 | ab | webbench |
| --- | --- | --- |
| 安装 | yum 装 httpd-tools 即可 | 需源码编译 |
| 压测模式 | 固定总请求数（`-n`） | 固定时长（`-t`） |
| 输出详细度 | 高（百分位分布、耗时细分） | 低（只有速度与成败数） |
| 高并发支持 | 千级并发稳定 | 轻量，万级并发不易崩 |
| 选型建议 | 常规压测、要看指标细节 | 极限并发摸顶 |

### ab 常用扩展参数（B 级）

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `-H` | 添加请求头 | `ab -n 100 -c 10 -H 'Accept-Encoding: gzip' URL` |
| `-C` | 携带 Cookie（测登录后页面） | `ab -n 100 -c 10 -C 'uid=1001' URL` |
| `-p` / `-T` | POST 文件与 Content-Type | `ab -n 100 -c 10 -p data.txt -T 'text/plain' URL` |
| `-t` | 限定压测总时长（秒） | `ab -t 30 -c 50 URL`（此时 `-n` 可省） |
| `-k` | 启用 HTTP KeepAlive | `ab -n 1000 -c 100 -k URL` |

压测注意事项：

1. 压测机与服务端分开部署更准，同机压测会互相抢 CPU 与内存；
2. 从低并发起步（如 `-c 10`）逐级加压，观察 QPS 拐点与错误率，找到服务容量上限；
3. 压测前记录 `ulimit -n`，报 `Too many open files` 就先放大文件描述符限制；
4. 每次 `ab` 结束看一眼服务端日志与负载（`uptime`、`free -m`），确定瓶颈在 CPU、内存还是磁盘 IO；
5. 结果受环境影响大，对比实验要控制「同一台机、同一个页面、同一参数」才有效。

## 验证方法

1. 统计结果自检：Top10 URL 的次数加总应等于日志总行数中前 10 个 URL 的行数，`awk '{print $7}' access.log | wc -l` 应等于 `wc -l access.log` 的行数（274）；
2. 把「先 sort 后 uniq」做反例验证：`awk '{print $7}' access.log | uniq -c | wc -l` 的结果远大于真实 URL 个数（13），证明跳过 sort 会得到错误结果；
3. 压测自检：`ab -n 100 -c 10` 的 Complete requests 必须等于 100、Failed requests 为 0，且耗时随 `-c` 增大而 QPS 先升后平（或错误率上升），符合并发-吞吐曲线的基本规律；
4. 压测前后 `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/` 均返回 200，确认服务未被压垮。

## 本篇小结

1. 日志统计标准组合拳：`awk '{print $7}' | sort | uniq -c | sort -rn | head -10`，五段各司其职——取列、排序、计数、倒序、截取，换一列就能统计 IP、状态码等任意维度。
2. 两条铁律：**先 sort 后 uniq**（uniq 只合并相邻重复行）、**sort 要加 `-n`**（数字比较而非字典序），漏掉任何一条结果都会错。
3. awk 除了取列还能做条件过滤（`$9==404`）与数值累加（`s+=$10; END{print s}`），大部分日志分析不写一行脚本就能搞定。
4. 列号取决于日志格式，改过 `log_format` 的日志先 `head -1` 确认字段位置；URL 统计前考虑是否切掉查询串。
5. 压测两板斧：ab 用 `-n 总数 -c 并发`，重点读 QPS、平均耗时与 95%/99% 百分位长尾；webbench 用 `-c 并发 -t 秒数`，适合极限并发摸顶。
6. 压测纪律：只压自己的测试环境，从低并发逐级加压；Failed requests 不为 0 的报告直接作废；调优前后用相同参数对比才有意义，压测数字要定期重刷。

> **参见**：Nginx 网站服务实战 · awk 命令详解 · day17 三剑客与批量建用户
{% endraw %}
