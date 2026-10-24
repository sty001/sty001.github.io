---
title: "day37-HTTP协议原理预习作业实操"
date: 2026-10-24 09:20:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-38"
---

{% raw %}



本篇对应课程第 37 天（Nginx 网站服务）的预习作业：在下一次课部署 Nginx 之前，先把 HTTP 协议的核心概念亲手过一遍——请求/响应报文的四段结构、用 curl -v 抓取完整的请求与响应过程、常用请求方法与状态码速查、高频首部字段对照，以及无状态与 Cookie/Session 机制。报文结构部分对本地 HTTP 服务真跑实测，所有响应头均为真实输出。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：python -m http.server 启动本地 HTTP 服务 + curl 抓包在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；站点目录 `/tmp/hw/day37/site`，服务监听 127.0.0.1:8000；
- **B 级（标准命令 + 预期输出）**：涉及真实域名的访问、状态码在 Nginx 场景下的典型复现，给出命令与预期响应，标注 `预期输出`。

**关于代理的特别说明**：本机环境配置了 HTTP 代理，curl 默认会把所有请求（包括访问 127.0.0.1 的请求）都交给代理转发，导致本地请求失败或输出被代理头污染。因此本篇所有 curl 命令都加 `--noproxy '*'`，含义是「对任何主机都不使用代理，直连目标地址」——这也是排错时排除代理干扰的第一招。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 解析 HTTP 请求/响应报文的四段结构（起始行/首部/空行/主体） | A 级（真跑标注） |
| 题 2 | 用 curl -v 抓取完整请求响应过程（含 404、POST、HEAD 场景） | A 级（真跑贴真实输出） |
| 题 3 | 常用请求方法 GET/POST/PUT/DELETE 与状态码速查表 | 总结性 |
| 题 4 | 常用请求/响应首部字段对照表 | 总结性 |
| 题 5 | 无状态与 Cookie/Session 机制说明 | 总结性 |

## 题 1：HTTP 请求/响应报文结构解析

**考察点**：记住「起始行、首部、空行、主体」四段结构，并能在一串真实报文里逐行指出每行的归属；理解空行是首部结束的标志。

**实现思路**：请求与响应的报文骨架完全对称，都是「起始行 + 首部 + 空行 + 主体」：

| 段 | 请求报文 | 响应报文 |
| --- | --- | --- |
| 起始行 | 请求行：`方法 URI 协议版本`，如 `GET /index.html HTTP/1.1` | 状态行：`协议版本 状态码 原因短语`，如 `HTTP/1.1 200 OK` |
| 首部 | 请求头：Host、User-Agent、Accept 等 | 响应头：Server、Content-Type、Location 等 |
| 空行 | 首部结束的标志，**必须有** | 同左 |
| 主体 | GET 无主体，POST/PUT 才有数据 | 服务器返回的 HTML/JSON/图片等 |

记忆要点三个：

1. 起始行都是「三段式」，用空格分隔；请求行是「方法 + 资源 + 版本」，状态行是「版本 + 结果码 + 结果说明」；
2. 空行单独占一行，是解析器判断「头部到这为止」的依据——少了空行，服务器会把首部后面所有内容当头部继续解析，直接报 400；
3. 主体是否出现由方法决定：GET 的参数放在 URL 的 `?` 后面，POST 的数据放在主体里。

## 题 2：curl -v 抓取完整请求响应过程

**考察点**：curl 的 `-v` 会把「TCP 连接、发出的请求报文（`>` 开头）、收到的响应报文（`<` 开头）、连接关闭」全部打印出来，是学习 HTTP 报文结构最直观的工具；配合本地服务可控地复现 200/404/501 等状态码。

### 步骤 1：构造本地站点并启动服务（已实操）
{: .sec-prac}

用 python 自带的 SimpleHTTP 模块当「迷你 Web 服务器」，不需要安装任何东西：

```bash
mkdir -p /tmp/hw/day37/site/sub
cd /tmp/hw/day37/site
printf '<html>\n<head><title>hw index</title></head>\n<body>hello http lab</body>\n</html>\n' > index.html
printf '<html>sub page</html>\n' > sub/page.html
python -m http.server 8000
```

服务启动后终端会显示 `Serving HTTP on 0.0.0.0 port 8000` 并持续运行。

### 步骤 2：curl -v 抓取一次完整的 200 请求（已实操）
{: .sec-prac}

另开一个终端执行（`--noproxy '*'` 直连，原因见环境说明）：

```bash
curl -sv --noproxy '*' http://127.0.0.1:8000/ -o /dev/null
```

输出：

```text
*   Trying 127.0.0.1:8000...
* Established connection to 127.0.0.1 (127.0.0.1 port 8000) from 127.0.0.1 port 61472
* using HTTP/1.x
> GET / HTTP/1.1
> Host: 127.0.0.1:8000
> User-Agent: curl/8.21.0
> Accept: */*
>
* Request completely sent off
* HTTP 1.0, assume close after body
< HTTP/1.0 200 OK
< Server: SimpleHTTP/0.6 Python/3.13.14
< Date: Sat, 24 Oct 2026 01:20:01 GMT
< Content-type: text/html
< Content-Length: 80
< Last-Modified: Sat, 24 Oct 2026 01:19:52 GMT
<
{ [80 bytes data]
* shutting down connection #0
```

逐段对应题 1 的四段结构：

- `> GET / HTTP/1.1` 是**请求行**（方法 GET、资源 /、协议 HTTP/1.1）；
- `> Host`、`> User-Agent`、`> Accept` 三行是**请求首部**，curl 默认只发这三个头；
- `>` 后面那行空白就是**空行**，之后 GET 没有主体；
- `<` 开头的 `HTTP/1.0 200 OK` 是**状态行**，Server、Date、Content-type 等是**响应首部**，空行之后返回的 80 字节 HTML 就是**响应主体**（这里用 `-o /dev/null` 丢弃了主体，所以只显示字节数）。

这个真实抓包还揭示了两个协议细节：服务器是 HTTP/1.0 实现，响应完就关闭连接（`assume close after body`），而生产 Nginx 是 HTTP/1.1 长连接；`Content-Length: 80` 与主体字节数一致，客户端靠它判断「读没读完」。

### 步骤 3：复现 404（已实操）
{: .sec-prac}

请求一个不存在的文件：

```bash
curl -sv --noproxy '*' http://127.0.0.1:8000/missing.html -o /dev/null
```

输出：

```text
> GET /missing.html HTTP/1.1
> Host: 127.0.0.1:8000
< HTTP/1.0 404 File not found
< Server: SimpleHTTP/0.6 Python/3.13.14
< Date: Sat, 24 Oct 2026 01:20:39 GMT
< Connection: close
< Content-Type: text/html;charset=utf-8
< Content-Length: 335
```

404 表示「资源不存在」——服务器收到了请求（连接正常、报文合法），但磁盘上没有 missing.html。运维排错时 404 优先查两处：URL 写没写对、站点 root 目录里有没有这个文件。

### 步骤 4：复现 POST 与 501（已实操）
{: .sec-prac}

向只支持 GET 的迷你服务器发 POST：

```bash
curl -sv --noproxy '*' -X POST -d 'user=test' http://127.0.0.1:8000/ -o /dev/null
```

输出：

```text
> POST / HTTP/1.1
> Content-Length: 9
> Content-Type: application/x-www-form-urlencoded
< HTTP/1.0 501 Unsupported method ('POST')
< Server: SimpleHTTP/0.6 Python/3.13.14
< Date: Sat, 24 Oct 2026 01:20:40 GMT
< Connection: close
< Content-Type: text/html;charset=utf-8
< Content-Length: 357
```

对照请求行可见：POST 把数据放进**主体**发送，所以请求头里多了 `Content-Length: 9`（数据 user=test 恰好 9 字节）和声明数据格式的 `Content-Type`——这就是「GET 参数在 URL、POST 数据在主体」的实证。501 表示「服务器不支持该方法」，与 405（方法被明确禁止）的区别：405 是「我知道这个方法但这里不允许」，501 是「我根本没实现这个方法」。

### 步骤 5：HEAD 请求与 -i 查看完整报文（已实操）
{: .sec-prac}

`-I` 发 HEAD 请求（只要响应头不要主体），适合探测资源是否存在而不下载内容：

```bash
curl -sI --noproxy '*' http://127.0.0.1:8000/sub/page.html
```

输出：

```text
HTTP/1.0 200 OK
Server: SimpleHTTP/0.6 Python/3.13.14
Date: Sat, 24 Oct 2026 01:20:47 GMT
Content-type: text/html
Content-Length: 22
Last-Modified: Sat, 24 Oct 2026 01:19:52 GMT
```

注意 HEAD 的响应同样带 `Content-Length: 22`——它描述的是「如果发 GET 主体会有多大」，但本次没有主体。`-i`（小写）则是「正常 GET 但把响应头和主体一起打印」，能亲眼看到首部与主体之间的空行：

```bash
curl -s --noproxy '*' -i http://127.0.0.1:8000/
```

输出：

```text
HTTP/1.0 200 OK
Server: SimpleHTTP/0.6 Python/3.13.14
Date: Sat, 24 Oct 2026 01:20:47 GMT
Content-type: text/html
Content-Length: 80
Last-Modified: Sat, 24 Oct 2026 01:19:52 GMT

<html>
<head><title>hw index</title></head>
<body>hello http lab</body>
</html>
```

响应头与 HTML 之间那一行空白就是**空行**——题 1 说的「首部结束标志」在真实报文里的样子。

### 题 2 验证方法
{: .sec-ver}

1. 每次请求后查看服务端日志（启动服务的那个终端），能看到 `GET / HTTP/1.1 200`、`GET /missing.html HTTP/1.1 404`、`POST / HTTP/1.1 501` 等记录——同一事件在服务端日志里的另一面；
2. 去掉 `--noproxy '*'` 再请求一次，观察请求被代理接管后的报错或输出差异，体会代理对排错的干扰；
3. `curl -s -o /dev/null -w '%{http_code}\n' URL` 只打印状态码，是写监控脚本的标准姿势。

## 题 3：常用请求方法与状态码速查表
{: .sec-chk}

**考察点**：GET/POST/PUT/DELETE 的语义与「安全性、幂等性」，以及 200/301/302/403/404/500/502 的准确含义与典型场景。

### 常用请求方法

| 方法 | 语义 | 请求主体 | 安全性 | 幂等性 |
| --- | --- | --- | --- | --- |
| GET | 获取资源 | 无 | 安全 | 幂等 |
| POST | 提交数据，常用于新建或触发处理 | 有 | 不安全 | 不幂等 |
| PUT | 用请求体全量替换目标资源 | 有 | 不安全 | 幂等 |
| DELETE | 删除指定资源 | 一般无 | 不安全 | 幂等 |

- **安全性**：方法不改变服务器上的资源状态（只读即安全）；
- **幂等性**：同一请求执行一次与执行多次，服务器状态相同。GET/PUT/DELETE 幂等，网络超时重试无害；POST 不幂等，重复提交可能产生重复记录，下单、支付场景必须做防重。

### 常用状态码速查
{: .sec-chk}

| 状态码 | 含义 | 典型场景 | 排错方向 |
| --- | --- | --- | --- |
| 200 | 成功 | 服务器正常返回资源 | 无需排错 |
| 301 | 永久重定向 | 域名更换、HTTP 跳 HTTPS | 浏览器会缓存 301，误配后难清 |
| 302 | 临时重定向 | 活动页临时跳转，之后仍访问原地址 | 检查跳转条件是否会成环 |
| 403 | 禁止访问 | 权限不足、目录索引未配置、SELinux 拦截 | 查文件属主权限与 SELinux |
| 404 | 资源不存在 | URL 写错、文件被删、root 路径配错 | 核对 URL 与站点根目录 |
| 500 | 服务器内部错误 | 后端程序异常、配置错误 | 查后端应用日志 |
| 502 | 错误网关 | 反向代理后面的服务挂了 | `systemctl status php-fpm` 等上游服务 |

记忆框架：2xx 成功、3xx 重定向（要再跳一次）、4xx 客户端的错（请求本身有问题）、5xx 服务端的错（服务器处理出错）。502 与 504 都出现在反向代理架构：502 是上游返回了无效响应（挂了），504 是上游响应太慢（等超时了）。

## 题 4：常用请求/响应首部对照表
{: .sec-chk}

**考察点**：分清首部的方向（请求头由客户端发出、响应头由服务器返回）与作用；这几个字段正是 Nginx 日志格式的常客。

| 首部 | 方向 | 作用 | 典型值示例 |
| --- | --- | --- | --- |
| Host | 请求 | 目标主机与端口，一台服务器托管多个站点时靠它区分站点 | `www.example.com` |
| User-Agent | 请求 | 客户端身份（浏览器/爬虫/curl 的类型与版本） | `curl/8.21.0` |
| Content-Type | 双向（实体头） | 主体内容的类型与字符集，浏览器据此决定如何解析 | `text/html; charset=UTF-8`、`application/json` |
| Content-Length | 双向（实体头） | 主体字节数，客户端/服务端据此判断接收完整性 | `80` |
| Location | 响应 | 配合 301/302 使用，告诉客户端跳转到哪里 | `https://www.example.com/new` |

补充两个高频关联首部：请求头 `Cookie` 携带客户端保存的会话数据，响应头 `Set-Cookie` 是服务端下发 Cookie 的通道——两者的配合正是题 5 的机制基础。此外 `Referer`（来源页面，用于统计与防盗链）、`X-Forwarded-For`（经过代理后的真实客户端 IP）也经常出现在 Nginx 日志格式中。

验证方法：题 2 步骤 2 的真实抓包里能同时找到 Host、User-Agent（请求方向）与 Server、Content-Type、Content-Length（响应方向），把表格与真实报文逐行对照一遍即完成自查。

## 题 5：无状态与 Cookie/Session 机制说明
{: .sec-know}

**考察点**：理解「无状态」的含义与代价，以及 Cookie 与 Session 如何配合维持登录态。

**无状态**：HTTP 协议规定服务器不记录「这个请求是谁之前发来的」，每个请求都被独立处理。好处是服务器实现简单、易于水平扩展（任何一个后端都能处理任何一个请求）；代价是「登录态」这类上下文必须靠额外机制维持——这就是 Cookie/Session 存在的原因。注意区分：无状态说的是「不记上下文」，与 HTTP/1.1 的长连接（keep-alive，复用 TCP 连接省握手开销）是两回事。

**Cookie 与 Session 的分工**：Cookie 保存在**客户端**（浏览器），Session 保存在**服务端**（内存或 Redis），两者靠 Session ID 关联。

典型登录流程：

1. 用户提交账号密码登录；
2. 服务端验证通过后生成 Session，并分配唯一 Session ID；
3. 服务端通过响应头 `Set-Cookie` 把 Session ID 写入客户端；
4. 客户端后续请求自动带上请求头 `Cookie: sessionid=xxx`；
5. 服务端凭 Session ID 找到对应 Session，识别用户身份；
6. 退出登录时销毁服务端 Session 并清空 Cookie。

| 对比项 | Cookie | Session |
| --- | --- | --- |
| 存放位置 | 客户端（浏览器） | 服务端 |
| 内容 | 键值对，体积小（约 4KB） | 任意会话数据，体积不受限 |
| 安全性 | 暴露在客户端，敏感信息须加密 | 存在服务端，相对安全 |
| 跨请求传递 | 随请求头自动携带 | 通过 Cookie 中的 Session ID 关联 |
| 过期方式 | 可设 Max-Age/Expires | 服务端超时销毁 |

> **易错点**：Session ID 是通过 Cookie 传递的，所以「关掉 Cookie 就等于关掉 Session」——客户端禁用 Cookie 后，纯 Session 方案失效，需要改用 URL 重写或 token 方案。生产加固三件套：`HttpOnly`（禁止 JS 读取，防 XSS 窃取）、`Secure`（仅 HTTPS 传输）、`SameSite`（限制跨站发送，防 CSRF）。

## 验证方法
{: .sec-ver}

1. 题 2 的全部输出为本地真实抓包，四段结构（起始行/首部/空行/主体）能在其中逐行指认；
2. 同一请求在服务端日志中有对应记录，状态码 200/404/501 三种场景双向对得上；
3. 状态码与方法表能脱离文档复述，并各举一个「自己真跑出来」的例子（404 来自步骤 3、501 来自步骤 4）；
4. 首部表中的每个字段都能在步骤 2 或步骤 5 的真实响应头里找到至少一个实例。

## 小结
{: .sec-sum}

1. 请求与响应报文都是「起始行 + 首部 + 空行 + 主体」四段结构，空行是首部结束的标志；请求起始行是「方法 URI 版本」，响应起始行是「版本 状态码 短语」。
2. `curl -v` 是学习 HTTP 的第一工具：`>` 开头是发出的请求、`<` 开头是收到的响应，配合本地 python -m http.server 可以零成本复现 200/404/501 等状态码——本篇全部真实抓包。
3. 本机有代理时 curl 必须加 `--noproxy '*'` 直连，否则本地请求会被代理接管；排错时先排除代理干扰是基本功。
4. GET 参数在 URL、POST 数据在主体（真实抓包里 POST 请求头多了 Content-Length 与 Content-Type 两行）；GET/PUT/DELETE 幂等、POST 不幂等。
5. 状态码记框架：2xx 成功、3xx 重定向、4xx 客户端错、5xx 服务端错；重点掌握 200/301/302/403/404/500/502，其中 502 是上游挂了、504 是上游太慢。
6. Host 区分站点、User-Agent 标识客户端、Content-Type/Length 描述主体、Location 配合重定向——这几个首部是 Nginx 日志与排错的常客。
7. HTTP 无状态，Cookie 存客户端、Session 存服务端，靠 Set-Cookie 下发的 Session ID 关联；禁用 Cookie 即禁用 Session，加固用 HttpOnly/Secure/SameSite 三件套。

> **参见**：HTTP 协议原理 · Nginx 网站服务部署 · day14 文件批量压缩作业实操


{% endraw %}
