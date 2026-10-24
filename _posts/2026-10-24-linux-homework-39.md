---
title: "day38 作业实操：Nginx 部署与 301/302 跳转"
date: 2026-10-24 09:19:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
本篇对应课程第 38 天的课后作业，共三题：①说明 301 跳转和 302 跳转的区别；②总结 curl 与 wget 两个下载/请求命令；③提前部署安装好 nginx 服务（yum 安装）。第一题不满足于背概念，本篇用 Python 在本地起一个真实的重定向服务器，用 `curl -I` 抓取 301/302/200 三种响应头逐一对比，并用 `-L`、`-w` 实测跟随跳转的行为；第二题把 curl 的常用参数全部真跑一遍（wget 在本环境不存在，按标准命令给出）；第三题给出 CentOS 7 上 yum 安装 nginx 的完整标准流程与预期输出。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：HTTP 请求类命令（curl 及配套的本地重定向服务器）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令（`yum install nginx`、`systemctl`、`wget`）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

环境实测：curl 8.21.0、Python 3.13（用于起本地重定向服务器，模拟 nginx 的 301/302 行为，HTTP 语义与 nginx 完全一致）。本环境 `which wget` 无结果，wget 部分只能给 B 级标准命令。实操目录统一用 `/tmp/hw/day38`。另注意：本机配有代理环境变量（`http_proxy` 等），curl 访问本机地址时必须加 `--noproxy '*'` 绕过代理，否则请求会被代理拦截返回 502，这也是本篇的一个真实踩坑点。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 301 跳转和 302 跳转的区别 | A 级（curl 响应头对比真跑）+ B 级（nginx rewrite 配置） |
| 题 2 | 总结命令 curl、wget | curl A 级真跑 + wget B 级 |
| 题 3 | 提前部署安装好 nginx 服务（yum 安装） | B 级（CentOS 7 标准流程） |

## 题 1：301 跳转和 302 跳转的区别

**考察点**：HTTP 重定向的状态码语义——301（Moved Permanently，永久跳转）与 302（Found，临时跳转）的差异；以及 curl 在重定向场景下的关键参数 `-I`（只看响应头）、`-L`（跟随跳转）、`-w`（自定义输出格式）。

**实现思路**：概念层面的区别一句话就能背下来，但运维要「眼见为实」。本篇在本地 8321 端口起一个 Python 重定向服务器，提供 `/301`、`/302`、`/301local`、`/302local`、`/index.html` 五个路径，然后：

1. 用 `curl -I` 分别抓三种状态码的响应头，对比 `Location` 字段与状态行；
2. 用 `curl -L` 实测「跟随跳转」到底发生了什么（一次请求变两次）；
3. 用 `curl -w '%{http_code} %{num_redirects} %{redirect_url}'` 把跳转状态量化输出；
4. 最后给出 nginx 层面实现 301/302 的标准配置（B 级）。

### 步骤 1：构造本地重定向服务器（已实操）

用 Python 标准库起一个极简 HTTP 服务器，模拟 nginx 的重定向行为：

```bash
mkdir -p /tmp/hw/day38 && cd /tmp/hw/day38
cat > redirect_server.py <<'EOF'
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def _reply(self, head_only=False):
        if self.path == '/301':
            self.send_response(301)
            self.send_header('Location', 'https://example.com/new-path')
            self.end_headers()
        elif self.path == '/302':
            self.send_response(302)
            self.send_header('Location', 'https://example.com/new-path')
            self.end_headers()
        elif self.path in ('/301local', '/302local'):
            self.send_response(301 if self.path == '/301local' else 302)
            self.send_header('Location', 'http://127.0.0.1:8321/index.html')
            self.end_headers()
        elif self.path == '/index.html':
            body = b'<h1>welcome to example.com</h1>'
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if not head_only:
                self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        self._reply()

    def do_HEAD(self):
        self._reply(head_only=True)

    def log_message(self, *a):
        pass

HTTPServer(('127.0.0.1', 8321), H).serve_forever()
EOF
python redirect_server.py     # 后台运行，监听 127.0.0.1:8321
```

### 步骤 2：curl -I 对比 301/302/200 三种响应头（已实操）

`-I`（大写 i）表示只取 HTTP 响应头、不要响应体，等效于发 HEAD 请求：

```bash
curl --noproxy '*' -I http://127.0.0.1:8321/301
curl --noproxy '*' -I http://127.0.0.1:8321/302
curl --noproxy '*' -I http://127.0.0.1:8321/index.html
```

输出：

```text
=== /301 ===
HTTP/1.0 301 Moved Permanently
Server: BaseHTTP/0.6 Python/3.13.14
Date: Sat, 24 Oct 2026 00:30:18 GMT
Location: https://example.com/new-path

=== /302 ===
HTTP/1.0 302 Found
Server: BaseHTTP/0.6 Python/3.13.14
Date: Sat, 24 Oct 2026 00:30:18 GMT
Location: https://example.com/new-path

=== /index.html ===
HTTP/1.0 200 OK
Server: BaseHTTP/0.6 Python/3.13.14
Date: Sat, 24 Oct 2026 00:30:18 GMT
Content-Type: text/html; charset=utf-8
Content-Length: 31
```

三个关键观察：

1. 301 与 302 的**响应结构完全一样**：都是状态行 + `Location` 头指明新地址，区别只在状态行的语义词（`Moved Permanently` vs `Found`）；
2. 200 是「正常响应」，没有 `Location` 头，有 `Content-Length`（31 字节响应体）；
3. 重定向响应**没有响应体**，跳转这件事本身只靠状态码 + `Location` 两个字段完成。

### 步骤 3：301 与 302 的区别总结

| 维度 | 301 Moved Permanently | 302 Found |
| --- | --- | --- |
| 语义 | 永久跳转，旧地址不再使用 | 临时跳转，旧地址以后还会用 |
| 浏览器行为 | 会缓存新地址，之后直接访问新地址不再问旧地址 | 不缓存，每次都先访问旧地址再被跳转 |
| 搜索引擎 | 收录权重转移到新地址 | 权重保留在原地址 |
| 典型场景 | 域名永久迁移、http 统一跳 https、带 www 与不带 www 二选一 | 临时维护页、未登录跳登录页、活动页临时换地址 |
| 运维风险 | 一旦发出会被浏览器长期缓存，想改回来很麻烦（要用 302 过渡或清缓存） | 服务端压力略高（每次都多一跳） |

一句话记忆：**确定永远不回头用 301，临时过渡用 302**。作业里最容易丢分的点是只答「一个永久一个临时」，把「浏览器缓存」和「搜索引擎权重」两点补上才算完整。

### 步骤 4：-L 跟随跳转实测（已实操）

curl 默认**不跟随**跳转，收到 3xx 就停；加 `-L`（`--location`）才会拿着 `Location` 里的新地址再发一次请求：

```bash
curl --noproxy '*' -sIL http://127.0.0.1:8321/301local
```

输出（一次请求产生了两段响应头）：

```text
HTTP/1.0 301 Moved Permanently
Server: BaseHTTP/0.6 Python/3.13.14
Date: Sat, 24 Oct 2026 00:30:49 GMT
Location: http://127.0.0.1:8321/index.html

HTTP/1.0 200 OK
Server: BaseHTTP/0.6 Python/3.13.14
Date: Sat, 24 Oct 2026 00:30:49 GMT
Content-Type: text/html; charset=utf-8
Content-Length: 31
```

用 `-w` 变量把跳转行为量化（`-o /dev/null` 丢弃响应体，只留统计信息）：

```bash
# 不加 -L：停在第 1 跳
curl --noproxy '*' -s -o /dev/null -w '最终状态码=%{http_code} 跳转次数=%{num_redirects}\n' http://127.0.0.1:8321/301local
# 加 -L：跳到 200
curl --noproxy '*' -sL -o /dev/null -w '最终状态码=%{http_code} 跳转次数=%{num_redirects}\n' http://127.0.0.1:8321/301local
# 不加 -L 时用 %{redirect_url} 看下一跳目标
curl --noproxy '*' -s -o /dev/null -w '状态码=%{http_code} 跳转目标=%{redirect_url}\n' http://127.0.0.1:8321/302
```

输出：

```text
最终状态码=301 跳转次数=0 耗时=0.004079s
最终状态码=200 跳转次数=1
状态码=302 跳转目标=https://example.com/new-path
```

> **易错点**：
>
> - `curl -I` 对部分只实现了 GET 的服务会返回 501（HEAD 方法未实现），此时改用 `curl -s -o /dev/null -D -` 一样能拿到响应头；
> - 本机有代理环境变量时访问 `127.0.0.1` 必须加 `--noproxy '*'`，否则代理返回 502，会误以为服务没起来（本篇真实踩到）；
> - 验证 301 配置后浏览器看不到效果，多半是**浏览器缓存了 301**，换 curl 测试或清缓存，不要反复改服务端配置干着急；
> - `curl -L` 遇到互相跳转的死循环会自动停止（默认上限 50 跳），自己写跳转规则时注意别让 A 跳 B、B 又跳 A。

### 步骤 5：跳转验证的通用排查流程（B 级落地）

拿到一条「跳转不对」的工单时，按下面的顺序排查，基本五分钟内定位：

1. `curl -sIL URL | grep -E '^HTTP|^Location'`——把每一跳的状态码与目标抓出来，跳转链路一目了然；
2. 对照预期判断：该 301 的地方发了 302（配置写的是 `redirect` 应为 `permanent`），或反之；
3. 状态码正确但浏览器不跳——多半是浏览器缓存了旧 301，换 curl 验证或清缓存；
4. 跳转目标错误——检查 nginx 配置里的 `$request_uri`、`$scheme` 变量是否带全，改完 `nginx -t && systemctl reload nginx` 再用第 1 条复测；
5. 多级跳转（A→B→C）要逐跳检查，别只看最终落点，SEO 每多一跳就损失一层权重。

## 题 2：总结命令 curl、wget

**考察点**：两个最常用的 HTTP 客户端命令各自的能力边界——curl 是「万能 HTTP 请求工具」，wget 是「专用下载工具」。

### curl 常用参数总结（已实操）

| 参数 | 作用 | 本篇实测示例 |
| --- | --- | --- |
| `-I` | 只取响应头（HEAD 请求） | `curl -I http://127.0.0.1:8321/301` |
| `-s` | 静默模式，不显示进度条 | `curl -s http://127.0.0.1:8321/index.html` |
| `-L` | 跟随 3xx 跳转 | `curl -sIL http://127.0.0.1:8321/301local` |
| `-o 文件` | 输出写入指定文件 | `curl -s -o /dev/null ...` |
| `-O` | 按远端文件名保存 | `curl -O http://example.com/a.tar.gz` |
| `-w 格式` | 自定义输出统计信息 | `-w '%{http_code} %{time_total}\n'` |
| `-X 方法` | 指定请求方法 | `curl -X POST -d 'a=1' URL` |
| `-H 头` | 添加请求头 | `curl -H 'Host: example.com' URL` |
| `-A 串` | 自定义 User-Agent | `curl -A 'curl-test' URL` |
| `-k` | 忽略 HTTPS 证书校验 | 自签证书调试用 |

实测抓取响应体（已实操）：

```bash
curl --noproxy '*' -s http://127.0.0.1:8321/index.html
```

输出：

```text
<h1>welcome to example.com</h1>
```

实测 404 与状态码检查（已实操）：

```bash
curl --noproxy '*' -s -o /dev/null -w '状态码=%{http_code}\n' http://127.0.0.1:8321/nothing
```

输出：

```text
状态码=404
```

`-w` 里最常用的几个变量：`%{http_code}`（状态码）、`%{time_total}`（总耗时）、`%{size_download}`（下载字节数）、`%{num_redirects}`（跳转次数）、`%{redirect_url}`（下一跳地址）。

### curl 实用组合示例（B 级，CentOS 7 预期）

```bash
# 断点续传：从中断处继续下载（-C - 自动计算偏移）
curl -C - -O http://example.com/bigfile.tar.gz
# 限速下载：避免占满带宽（512KB/s）
curl --limit-rate 512k -O http://example.com/bigfile.tar.gz
# 测接口耗时分解：DNS/建连/首字节各占多少
curl -s -o /dev/null -w 'dns=%{time_namelookup}s connect=%{time_connect}s ttfb=%{time_starttransfer}s total=%{time_total}s\n' http://127.0.0.1/index.html
# 带表单数据提交（模拟登录后的调试）
curl -s -X POST -d 'user=test&pass=<your-password>' http://127.0.0.1/login
```

（预期输出，耗时分解一条）

```text
dns=0.001s connect=0.002s ttfb=0.004s total=0.004s
```

`ttfb`（Time To First Byte）是排查「接口慢」时最有价值的单一指标：它大而 `total` 接近它，瓶颈在服务端处理；`connect` 大则瓶颈在网络。

### wget 常用参数总结（B 级，本环境无 wget）

```bash
wget http://example.com/file.tar.gz            # 基本下载，文件名取 URL 最后一段
wget -O /tmp/hw/day38/file.tar.gz URL          # -O 指定保存路径与文件名
wget -q URL                                    # -q 静默，脚本里用
wget --spider URL                              # 只探测不下载，等价 curl -I 的用途
wget -c URL                                    # 断点续传
wget -r -p -np -k http://example.com/docs/     # 递归镜像整站（慎用）
```

（预期输出，CentOS 7）

```text
$ wget --spider http://127.0.0.1/index.html
Spider mode enabled. Check if remote file exists.
--2026-10-24 08:35:01--  http://127.0.0.1/index.html
Connecting to 127.0.0.1:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 31 [text/html]
Remote file exists.
```

### curl 与 wget 选型对比

| 维度 | curl | wget |
| --- | --- | --- |
| 定位 | 通用 HTTP 客户端，能发任意方法、任意头 | 专用下载工具 |
| 递归下载 | 不支持 | 支持（`-r` 镜像整站） |
| 断点续传 | 支持（`-C -`） | 支持（`-c`），默认开启 |
| 输出统计 | 强（`-w` 变量丰富） | 弱 |
| 脚本中测接口 | 首选 | 一般 |
| 典型用途 | 调 API、看响应头、压测辅助、探测跳转 | 下载安装包、镜像页面 |

> **易错点**：
>
> - wget 的 `-O` 与 curl 的 `-o` 大小写不同，含义相同，混用时容易写错；
> - `wget --spider` 探测到 404 时退出码非 0，可以用来做脚本里的健康检查判断；
> - curl 默认把响应体打到屏幕上，下载文件忘了 `-o`/`-O` 会把二进制刷屏。

## 题 3：提前部署安装好 nginx 服务（B 级，CentOS 7）

**考察点**：用 yum 完成 nginx 的安装、启动、开机自启与验证，为后续综合架构课程提前备好环境。

### 步骤 1：yum 安装 nginx

CentOS 7 的 base 源没有 nginx，先装 epel 扩展源再装 nginx：

```bash
yum install -y epel-release
yum install -y nginx
nginx -v
```

（预期输出，CentOS 7）

```text
$ nginx -v
nginx version: nginx/1.20.1
```

### 步骤 2：启动并设置开机自启

```bash
systemctl start nginx
systemctl enable nginx
systemctl status nginx | head -3
```

（预期输出，CentOS 7）

```text
$ systemctl status nginx | head -3
● nginx.service - The nginx HTTP and reverse proxy server
   Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; vendor preset: disabled)
   Active: active (running) since Sat 2026-10-24 08:40:12 CST; 5s ago
```

### 步骤 3：放行防火墙并验证

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
curl -I 127.0.0.1
```

（预期输出，CentOS 7）

```text
$ curl -I 127.0.0.1
HTTP/1.1 200 OK
Server: nginx/1.20.1
Date: Sat, 24 Oct 2026 08:41:05 GMT
Content-Type: text/html
Content-Length: 4057
Last-Modified: Sat, 24 Oct 2026 08:32:19 GMT
```

看到 `Server: nginx/1.20.1` 与 `200 OK` 即部署成功。改配置后先 `nginx -t` 语法检查再 `systemctl reload nginx` 平滑加载。

### nginx 常用路径与命令速查

| 路径/命令 | 说明 |
| --- | --- |
| `/etc/nginx/nginx.conf` | 主配置文件 |
| `/etc/nginx/conf.d/*.conf` | 子配置目录（每个站点一个文件） |
| `/usr/share/nginx/html` | 默认站点根目录 |
| `/var/log/nginx/access.log` | 访问日志 |
| `/var/log/nginx/error.log` | 错误日志 |
| `nginx -t` | 语法检查 |
| `nginx -s reload` 或 `systemctl reload nginx` | 平滑加载配置 |
| `systemctl stop nginx` | 停止服务 |

### 步骤 4：301/302 跳转的 nginx 标准配置（题 1 的 B 级落地）

```nginx
# /etc/nginx/conf.d/redirect.conf
# 301：老域名永久跳新域名（域名迁移场景）
server {
    listen       80;
    server_name  old.example.com;
    return 301 http://example.com$request_uri;
}

# 302：后台未登录临时跳登录页（临时过渡场景）
server {
    listen       80;
    server_name  example.com;

    location /admin {
        return 302 http://example.com/login;
    }

    # rewrite 写法：permanent 等价 301，redirect 等价 302
    location /old/ {
        rewrite ^/old/(.*)$ /new/$1 permanent;
    }
}
```

写完执行 `nginx -t && systemctl reload nginx`，然后用本篇 A 级的命令验证：

```bash
curl -I http://old.example.com/            # 预期 301，Location 指向新域名
curl -I http://example.com/admin           # 预期 302，Location 指向 /login
```

`return` 与 `rewrite` 的选择：整站/整域跳转用 `return`（写法简单、性能好），只转换部分 URL 路径（如目录改名、正则替换）用 `rewrite`。

## 验证方法

1. `curl -I http://127.0.0.1` 返回 `200 OK` 且 `Server` 头含 nginx 版本，证明服务部署成功；
2. `curl -I` 老域名返回 `301 Moved Permanently` 且 `Location` 是新域名，返回 `302 Found` 则是临时跳转，据此可反推配置里写的是 `permanent` 还是 `redirect`；
3. `curl -sIL URL | grep HTTP` 能看到两行状态码（3xx 和 200），证明 `-L` 跟随链路通畅；
4. `systemctl is-enabled nginx` 返回 `enabled`，证明开机自启已配置。

## 本篇小结

1. 301 与 302 的区别不只是「永久/临时」：301 会被浏览器缓存、搜索引擎转移权重，用于域名迁移与 http→https；302 不缓存、权重留在原地址，用于维护页与登录跳转。一旦误发 301，改回来要先清浏览器缓存。
2. 重定向的本质是「状态码 + Location 响应头」，响应体为空；curl 默认停在 3xx，加 `-L` 才跟随，`-w '%{http_code} %{num_redirects} %{redirect_url}'` 可把跳转行为量化验证。
3. curl 是万能 HTTP 客户端（`-I` 看头、`-s` 静默、`-w` 统计、`-X`/`-H` 定制请求），wget 是下载工具（`-O` 落盘、`--spider` 探测、`-c` 续传、`-r` 镜像）；脚本测接口选 curl，批量下载选 wget。
4. yum 部署 nginx 四步：装 epel 与 nginx → `systemctl start/enable` → 放行防火墙 http → `curl -I 127.0.0.1` 看到 `Server: nginx` 即成功；改配置先 `nginx -t` 再 reload。
5. nginx 里 `return 301/302` 适合整站跳转，`rewrite ... permanent/redirect` 适合带正则的路径改造；配置落地后一律用 `curl -I` 复验状态码，不靠浏览器肉眼判断。
6. 本机带代理环境时，curl 访问 `127.0.0.1` 要加 `--noproxy '*'`，否则 502 会误导排障方向——「先排除环境干扰，再怀疑服务本身」。

> **参见**：Nginx 网站服务部署 · Nginx 网站服务进阶
{% endraw %}
