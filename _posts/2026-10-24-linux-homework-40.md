---
title: "day39-Nginx上传限制与图片存储作业实操"
date: 2026-10-24 09:18:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-40"
---

{% raw %}



本篇对应课程第 39 天的课后作业，围绕 LNMP 网站上线后的两个真实痛点展开：①上传主题/图片时浏览器报 `413 Request Entity Too Large`，Nginx 需要加什么指令来放行大文件；②图片默认保存在 Web 服务器本地，一旦网站迁移到多台 Web 集群，图片应该集中存放到存储服务器（NFS）上。作业原文只有两句话的疑问，本篇把排查链路补全，并用一个最小 HTTP 服务在 Git Bash 真实复现 413、对比「限制太小」与「限制放大」两种响应；图片存储部分给出可直接落地的 NFS 架构与配置（B 级，CentOS 7 标准命令 + 预期输出）。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Nginx（安全策略禁用），因此采用分级实操：

- **A 级（已真实执行）**：用 Python 起一个最小 HTTP 服务模拟 Nginx 的请求体大小限制，配合 `curl -F` 真跑上传，完整复现并对比 413 与 200 两种响应，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：Nginx 配置（client_max_body_size）、PHP 配置（upload_max_filesize / post_max_size）、NFS 存储对接给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明真机执行方式。

实操目录统一用 `/tmp/hw/day39`。环境实测：GNU bash 5.3.15、curl 8.x、Python 3.13。本环境的 `nginx` 命令不可用（已用 `command -v` 验证），故 Nginx 配置校验 `nginx -t` 只能给 B 级命令。文中命令输出里的文件属主已按脱敏要求统一显示为 `user`，演示域名统一使用 `example.com`，存储/数据库服务器地址使用内网网段 `172.16.1.0/24` 作为示例。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 上传主题提示主题比较大，报 413 Request Entity Too Large，Nginx 需要添加什么指令 | A 级（复现 413 + 对比） |
| 题 2 | 图片保存在服务器什么位置，如何把图片保存到存储服务器中 | B 级（NFS 存储架构 + 配置） |

## 题 1：上传报 413，Nginx 需要加什么指令

**考察点**：理解 413 错误的成因（请求体超过服务端限制）、定位是 Nginx 层还是后端（PHP）层拦截、掌握 `client_max_body_size` 指令的用法与作用域，以及「前端报 413 往往要同步改后端」这一运维常识。

**实现思路**：413 的本质是「客户端发来的请求体（上传文件）体积，大于服务端允许的最大值」。在 LNMP 架构里，这条请求会先经过 Nginx，再交给 PHP。Nginx 默认只允许 1M 的请求体，超过就直接返回 413，根本到不了 PHP。所以解题分两步：

1. 先确认是哪一层在拦——看返回 413 的响应头/日志，Nginx 层的 413 会体现在 `error.log` 的 `client intended to send too large body`；
2. 在 Nginx 加 `client_max_body_size` 放大限制，同时别忘了 PHP 的 `upload_max_filesize` 与 `post_max_size` 也要同步放大，否则只改 Nginx 仍会在 PHP 层报错。

`client_max_body_size` 可以写在 `http`、`server`、`location` 三个作用域：写在 `http` 全局生效，写在某个 `server` 只对该虚拟主机生效，写在 `location /upload` 只对该上传路径生效——精细化控制时写在 `location` 最合适。

### 步骤 1：复现 413（已实操）
{: .sec-prac}

为了在没有真实 Nginx 的环境里也能真实看到 413，我写了一个最小 HTTP 服务 `srv_413.py`，它读取请求的 `Content-Length`，超过给定上限就返回 413，完全模拟 Nginx `client_max_body_size` 的行为。先造一个小文件和一个大文件：

```bash
mkdir -p /tmp/hw/day39 && cd /tmp/hw/day39
dd if=/dev/urandom of=big.jpg bs=1M count=3 2>/dev/null
printf 'small pic' > small.jpg
ls -l big.jpg small.jpg | awk '{print $5, $9}'
```

输出：

```text
3145728 big.jpg
9 small.jpg
```

big.jpg 约 3MB，small.jpg 仅 9 字节。接着启动「限制 2000 字节」的服务（相当于 Nginx 里 `client_max_body_size 2k` 太小），用 `curl -F` 模拟表单上传：

```bash
python3 srv_413.py 2000 >/dev/null 2>&1 &
SRV=$!
sleep 1
echo "--- 上传小文件 small.jpg ---"
curl -s -o /dev/null -w "HTTP 状态码: %{http_code}\n" -F "file=@small.jpg" http://127.0.0.1:8099/upload
echo "--- 上传大文件 big.jpg (~3MB) ---"
curl -s -w "\nHTTP 状态码: %{http_code}\n" -F "file=@big.jpg" http://127.0.0.1:8099/upload
kill $SRV 2>/dev/null
```

输出：

```text
--- 上传小文件 small.jpg ---
HTTP 状态码: 200
--- 上传大文件 big.jpg (~3MB) ---
413 Request Entity Too Large
HTTP 状态码: 413
```

小文件（9 字节，加上 multipart 边界也远小于 2000）正常返回 200；大文件（约 3MB）被服务端以 413 拒绝——和浏览器上传大主题时看到的 `413 Request Entity Too Large` 完全一致。

### 步骤 2：放大限制后对比（已实操）
{: .sec-prac}

同一个大文件，把服务端上限调到 20MB（相当于 Nginx 里 `client_max_body_size 20m`），再上传一次：

```bash
python3 srv_413.py 20000000 >/dev/null 2>&1 &
SRV=$!
sleep 1
echo "--- 同一大文件 big.jpg (~3MB) 再次上传 ---"
curl -s -w "\nHTTP 状态码: %{http_code}\n" -F "file=@big.jpg" http://127.0.0.1:8099/upload
kill $SRV 2>/dev/null
```

输出：

```text
--- 同一大文件 big.jpg (~3MB) 再次上传 ---
ok, received 3145925 bytes
HTTP 状态码: 200
```

放大限制后，原本被拒的 3MB 文件顺利上传成功（received 3145925 字节，多出来的几十字节是 multipart 表单的边界开销）。这就直观证明了：413 只差「一行 `client_max_body_size`」的事。

### 步骤 3：Nginx 侧的正确配置（B 级）
{: .sec-prac}

回到真实 Nginx，针对上传场景在 `location /upload` 或对应 `server` 块里加上指令：

```nginx
server {
    listen       80;
    server_name  blog.example.com;

    # 仅对上传路径放大限制，避免全局放开带来风险
    location /wp-content/uploads {
        client_max_body_size 50m;     # 允许上传最大 50M，默认仅 1M
        client_body_buffer_size 256k; # 请求体内存缓冲，过大文件走磁盘临时文件
        root  /html/blog;
    }
}
```

执行配置校验与重载（CentOS 7，预期输出）：

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

`nginx -t` 通过说明语法没问题，`reload` 平滑重载不中断现有连接。

### 步骤 4：别忘了同步改 PHP（B 级，关键易错点）
{: .sec-prac}

只改 Nginx 还不够。LNMP 里请求到 PHP 后，PHP 自身还有两道限制，不放大一样会在上传大文件时报错（PHP 层通常表现为上传失败、文件大小为 0 或 `post_max_size` 超限）：

```ini
; /etc/php.ini
upload_max_filesize = 50M     ; 单文件上传上限，默认 2M
post_max_size     = 60M       ; 整个 POST 表单上限，需 >= upload_max_filesize，默认 8M
```

改完重载 PHP-FPM：

```bash
systemctl reload php-fpm
```

（预期输出，CentOS 7）

```text
$ systemctl reload php-fpm
```

> **易错点**：
>
> - 413 必须 Nginx 与 PHP 两处一起改：Nginx 的 `client_max_body_size` 和 PHP 的 `upload_max_filesize`、`post_max_size`。只改 Nginx，请求体虽然能进来，到了 PHP 仍会被 `post_max_size` 拦下；只改 PHP，请求体在 Nginx 层就被 413 拒绝，根本到不了 PHP。
> - `post_max_size` 必须大于等于 `upload_max_filesize`，否则大文件在 PHP 解析表单阶段就被丢弃。
> - 限制尽量写在具体的 `location`（如 `/upload`）而不是全局 `http`，既满足业务又不过度放开攻击面。
> - `client_body_buffer_size` 与 `client_max_body_size` 不是一回事：前者是内存缓冲，超过部分会写入磁盘临时目录，受其影响的是性能而非能否上传。

> **参见**：Nginx 网站服务实战、负载均衡服务

## 题 2：图片存在哪里，如何集中存到存储服务器

**考察点**：确认 Web 服务器上用户上传图片的真实落盘路径、理解单台 Web 存储的局限性（多台 Web 集群时图片不一致）、掌握用 NFS 把图片统一收敛到存储服务器的完整链路（找目录、迁数据、挂 NFS、解决权限 squash 问题）。

**实现思路**：图片默认就在 Web 站点的上传目录下（如 WordPress 的 `/wp-content/uploads/`）。当网站从单台 Web 扩展到多台 Web 集群后，用户上传的图片只落在一台机器上，其他机器访问不到，就会出现「图片时有时无」。解决办法是把图片目录挂载到一台统一的 NFS 存储服务器，所有 Web 节点读写同一份数据。流程分四步：找到本地上传目录 → 把已有数据迁到存储服务器 → Web 节点挂载 NFS → 解决 NFS 权限映射（root_squash / all_squash）导致写不进去的问题。

### 步骤 1：定位图片存储目录（B 级）
{: .sec-prac}

方法一，从图片访问链接反推 URI：

```text
http://blog.example.com/wp-content/uploads/2019/05/example-1024x1024.jpg
```

链接里的 `/wp-content/uploads/2019/05/example-1024x1024.jpg` 就是图片在站点目录下的相对路径，完整路径即 `/html/blog/wp-content/uploads/2019/05/`。

方法二，上传后用 `find` 按最近修改时间定位：

```bash
find /html/blog -type f -mmin -5
```

（预期输出，CentOS 7）

```text
/html/blog/wp-content/uploads/2019/05/example-1024x1024.jpg
```

### 步骤 2：在存储服务器上建目录并暴露 NFS 共享（B 级）
{: .sec-prac}

存储服务器（内网 `172.16.1.31`）上创建共享目录并写好 `/etc/exports`：

```bash
mkdir -p /data/blog
chown -R www /data/blog

cat > /etc/exports <<'EOF'
/data/blog 172.16.1.0/24(rw,sync,all_squash,anonuid=1002,anongid=1002)
EOF
systemctl enable --now nfs-server
exportfs -rv
```

查看共享是否就绪：

```bash
showmount -e 172.16.1.31
```

（预期输出，CentOS 7）

```text
Export list for 172.16.1.31:
/data/blog 172.16.1.0/24
```

### 步骤 3：Web 节点挂载 NFS 并迁移旧数据（B 级）
{: .sec-prac}

在每台 Web 节点上把存储目录挂到本地上传路径：

```bash
yum install -y nfs-utils
mkdir -p /html/blog/wp-content/uploads
mount 172.16.1.31:/data/blog /html/blog/wp-content/uploads
# 写入 /etc/fstab 实现开机自动挂载
echo '172.16.1.31:/data/blog /html/blog/wp-content/uploads nfs defaults 0 0' >> /etc/fstab
```

把迁移前本地已存在的旧图片搬到存储服务器（首次迁移）：

```bash
mv /tmp/2019/ /html/blog/wp-content/uploads/
```

（预期输出，CentOS 7）

```text
$ showmount -e 172.16.1.31
Export list for 172.16.1.31:
/data/blog 172.16.1.0/24
$ mount | grep uploads
172.16.1.31:/data/blog on /html/blog/wp-content/uploads type nfs4 (rw,relatime,vers=4.1)
```

### 步骤 4：解决「默认无法写入」的权限问题（B 级，核心坑）
{: .sec-ts}

这是 NFS 存储图片最常见的坑。NFS 默认 `root_squash` 会把客户端的 root 映射成服务端的 `nfsnobody`，导致用 root 身份上传写不进去；若配置成 `all_squash`，所有用户也都会被映射成 `nfsnobody`。解决办法是显式指定匿名映射用户为 Web 的运行用户 `www`（uid/gid 1002），让服务端用同一个身份读写：

```bash
# 存储服务器上：统一映射用户为 www
useradd www -u 1002
chown -R www /data
# /etc/exports 中用 anonuid/anongid 锁定映射身份
sed -ri.bak 's#(sync)#\1,anonuid=1002,anongid=1002#g' /etc/exports
exportfs -rv
```

（预期输出，CentOS 7）

```text
$ exportfs -rv
exporting 172.16.1.0/24:/data/blog
```

> **易错点**：
>
> - 多台 Web 集群不做统一存储，图片会「各存各的」，用户刷新到不同节点就看不到图——这是引入 NFS 的根本动机。
> - 挂载点必须和站点原来的上传目录路径一致，否则代码里写死的路径会找不到文件。
> - NFS 权限问题九成出在 squash 映射：记住 `root_squash` → root 变 nobody、`all_squash` → 所有人变 nobody；用 `anonuid/anongid` 把身份锁成 Web 运行用户才能正常写。
> - 生产建议 NFS 之上有备份与高可用（如 DRBD 或对象存储），单台存储服务器本身也可能成为单点。

## 本篇小结
{: .sec-sum}

1. 413 `Request Entity Too Large` 是请求体超过服务端上限所致；本文用最小 HTTP 服务真实复现了它，并证明「放大限制（client_max_body_size）后同一文件即可上传成功」。
2. 解决 413 要改两处：Nginx 的 `client_max_body_size` 与 PHP 的 `upload_max_filesize`、`post_max_size`，只改一处必然仍报错；`post_max_size` 须大于等于 `upload_max_filesize`。
3. `client_max_body_size` 可作用于 http/server/location，精细化控制时写在具体 `location` 最合适；改完务必 `nginx -t` 校验再 `reload`。
4. 图片默认落在 Web 站点的上传目录（如 `/html/blog/wp-content/uploads/`），可从访问链接反推，也可用 `find -mmin` 按最近修改定位。
5. 多台 Web 集群必须把图片收敛到统一的 NFS 存储服务器，流程为：找目录 → 迁旧数据 → 挂 NFS（写 fstab 开机挂载）→ 处理权限。
6. NFS 写入失败几乎都源于 squash 映射，用 `anonuid/anongid` 把匿名身份锁成 Web 运行用户（如 www，uid 1002）即可正常读写。


{% endraw %}
