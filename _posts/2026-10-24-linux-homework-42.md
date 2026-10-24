---
title: "day41-LNMP环境搭建作业实操"
date: 2026-10-24 09:16:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-42"
---

{% raw %}



先把课程第 41 天的两道作业摆出来：①利用命令取出状态页面信息中的数值（curl）；②搭建 LNMP 环境（Linux + Nginx + MySQL/MariaDB + PHP）。第一题在本地模拟一份与 nginx 真实输出逐行一致的 `stub_status` 状态页，curl 抓取后分别用 awk 与 grep/awk 提取活跃连接数、总请求数等数值，并给出一次性解析所有字段的 awk 写法；第二题给出 CentOS 7 上 yum 全家桶式部署 LNMP 的完整标准流程，涵盖 nginx 的 PHP 转发配置、php-fpm 用户修正、MariaDB 初始化与 phpinfo 验证页。

## 实操环境说明 {: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：curl 请求与文本提取命令（curl/awk/grep）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令（`yum install nginx/mariadb-server/php-fpm`、`systemctl`、`mysql_secure_installation`）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

A 级部分无法在本机跑起真实 nginx，因此用本地 HTTP 服务器提供一份与 nginx `stub_status` 输出格式完全一致的状态页文本（四行结构逐字符对齐真实输出），curl 与解析命令部分均为真跑。实操目录统一用 `/tmp/hw/day41`，状态页文件位于 `/tmp/hw/day41/www/stub_status`。文中所有口令一律以 `<your-password>` 占位，不出现明文口令。

## 题目总览 {: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1-前置 | 开启 nginx stub_status 状态页（配置） | B 级 |
| 题 1-主体 | 利用命令取出状态页面信息中的数值（curl） | A 级（真跑） |
| 题 2 | 搭建 LNMP 环境（数据库服务/php 服务） | B 级（CentOS 7 标准流程） |

## 题 1：利用命令取出状态页面信息中的数值（curl）

**考察点**：nginx 的 `stub_status` 状态页各字段含义；curl 抓取页面配合 awk/grep 提取数值——「curl 负责拿数据，awk/grep 负责算数据」这条运维取数的标准链路；awk 的模式匹配（`/^Active/`）、按行号取列（`NR==3`）与 END 汇总三种用法。

**实现思路**：状态页就是一个纯文本页面，内容固定四行。取数分两步：

1. `curl -s http://127.0.0.1/stub_status` 把页面抓成纯文本；
2. 用 awk 按行匹配提取目标数值：`/^Active/` 匹配活跃连接行、`NR==3` 取第三行的三个计数、`/^Reading/` 取最后一行的三个状态值；进阶写法是一次 awk 里同时提取全部六个数值。

### 步骤 1：认识 stub_status 状态页的结构 {: .sec-prac}

nginx 开启状态模块后，访问状态页得到的文本固定如下（本篇 A 级模拟的正是这份文本）：

```text
Active connections: 15
server accepts handled requests
 8421 8421 32768
Reading: 0 Writing: 3 Waiting: 12
```

字段含义：

| 字段 | 所在行 | 含义 |
| --- | --- | --- |
| Active connections | 第 1 行 | 当前活跃连接总数（含读、写、等待） |
| accepts | 第 3 行第 1 列 | 已接受的连接总数 |
| handled | 第 3 行第 2 列 | 已处理的连接总数（一般等于 accepts） |
| requests | 第 3 行第 3 列 | 已处理的请求总数（含长连接上的多次请求） |
| Reading | 第 4 行 | 正在读取请求头的连接数 |
| Writing | 第 4 行 | 正在向客户端返回响应的连接数 |
| Waiting | 第 4 行 | 空闲等待中的长连接数（≈ Active − Reading − Writing） |

运维价值：`Waiting` 持续偏高说明长连接空闲多，可调 `keepalive_timeout`；`Writing` 偏高说明响应慢；`requests/accepts` 比值反映长连接复用率。这几个数没有统一的「正常范围」，正确做法是记录自己业务的日常基线，偏离基线才是信号。

### 步骤 2：构造并本地提供状态页（已实操） {: .sec-prac}

在本机模拟与真实 nginx 输出逐行一致的状态页，用 HTTP 服务器暴露：

```bash
mkdir -p /tmp/hw/day41/www && cd /tmp/hw/day41/www
printf 'Active connections: 15\nserver accepts handled requests\n 8421 8421 32768\nReading: 0 Writing: 3 Waiting: 12\n' > stub_status
python -m http.server 8322 --bind 127.0.0.1    # 后台运行，模拟 nginx
```

### 步骤 3：curl 抓取完整状态页（已实操） {: .sec-prac}

```bash
curl --noproxy '*' -s http://127.0.0.1:8322/stub_status
```

输出：

```text
Active connections: 15
server accepts handled requests
 8421 8421 32768
Reading: 0 Writing: 3 Waiting: 12
```

`-s` 静默模式去掉进度条，输出就是纯文本，可以直接接管道交给 awk/grep。

### 步骤 4：awk 提取活跃连接数与三个计数（已实操） {: .sec-prac}

```bash
# 提取活跃连接数
curl --noproxy '*' -s http://127.0.0.1:8322/stub_status | awk '/^Active/{print "Active="$3}'
# 提取 accepts/handled/requests（第 3 行的前 3 列）
curl --noproxy '*' -s http://127.0.0.1:8322/stub_status | awk 'NR==3{print "accepts="$1, "handled="$2, "requests="$3}'
```

输出：

```text
Active=15
accepts=8421 handled=8421 requests=32768
```

拆解：`/^Active/` 匹配以 `Active` 开头的行，该行按空格切分后 `$1` 是 `Active`、`$2` 是 `connections:`、`$3` 才是数值 `15`；第 3 行是 ` 8421 8421 32768`（行首有空格），awk 默认按连续空白切分，所以 `$1`、`$2`、`$3` 直接就是三个数值，行首空格不影响。

### 步骤 5：grep/awk 提取 Reading/Writing/Waiting（已实操） {: .sec-prac}

```bash
# grep 先定位行
curl --noproxy '*' -s http://127.0.0.1:8322/stub_status | grep '^Reading'
# awk 直接取列（Reading=$2、Writing=$4、Waiting=$6，中间的 "Reading:" 等占奇数位）
curl --noproxy '*' -s http://127.0.0.1:8322/stub_status | awk '/^Reading/{print "Reading="$2, "Writing="$4, "Waiting="$6}'
```

输出：

```text
Reading: 0 Writing: 3 Waiting: 12
Reading=0 Writing=3 Waiting=12
```

### 步骤 6：一次抓取、一次解析全部数值（已实操） {: .sec-prac}

上面每取一个数就 curl 一次，状态页数据时刻在变，多次请求拿到的根本不是同一时刻的快照。正确做法是**先抓一次存进变量，再对同一份文本解析**：

```bash
page=$(curl --noproxy '*' -s http://127.0.0.1:8322/stub_status)
echo "$page" | awk '
  /^Active/{a=$3}
  NR==3{ac=$1; rq=$3}
  /^Reading/{r=$2; w=$4; wt=$6}
  END{printf "Active=%s accepts=%s requests=%s Reading=%s Writing=%s Waiting=%s\n", a, ac, rq, r, w, wt}'
```

输出：

```text
Active=15 accepts=8421 requests=32768 Reading=0 Writing=3 Waiting=12
```

这条 awk 同时用了三种语法：正则模式 `/^Active/`、行号模式 `NR==3`、END 汇总输出——把作业「取出状态页面信息中的数值」的要求一次做满。把这段存进脚本，配合 cron 每分钟采样一条，就是最朴素的连接数监控。

> **易错点**：
>
> - 多次 curl 分别取值再拼结果，数值之间不是同一时刻的快照，做监控时必须一次抓取统一解析；
> - `$3` 取到的是 `15` 还是别的列，取决于该行有没有标签词，先 `head -1` 看清行结构再定列号；
> - 第 3 行行首有一个空格，肉眼容易看漏；awk 默认切分不受影响，但如果用 `cut -d' '` 就会被切出空列；
> - 状态页属于敏感信息（暴露连接数与请求量），生产环境必须配 `allow 127.0.0.1; deny all;` 限制来源。

## 题 1 前置：开启 nginx stub_status 状态页（B 级）

yum 版 nginx 已内置 `--with-http_stub_status_module`，只需在 server 配置里加一段 location：

```nginx
# /etc/nginx/conf.d/status.conf
server {
    listen       80;
    server_name  linux-node01.example.com;

    location /stub_status {
        stub_status;             # 开启状态页
        allow 127.0.0.1;         # 只允许本机访问
        allow 10.0.0.0/24;       # 允许监控网段访问
        deny  all;               # 其余全部拒绝
    }
}
```

```bash
nginx -t && systemctl reload nginx
curl -s http://127.0.0.1/stub_status
```

（预期输出，CentOS 7）

```text
Active connections: 15
server accepts handled requests
 8421 8421 32768
Reading: 0 Writing: 3 Waiting: 12
```

若担心模块未编译，先 `nginx -V 2>&1 | grep -o with-http_stub_status_module` 确认。

## 题 2：搭建 LNMP 环境（B 级，CentOS 7） {: .sec-expl}

**考察点**：Linux + Nginx + MariaDB（MySQL 的社区分支）+ PHP 四件套的 yum 部署；nginx 通过 fastcgi 把 `.php` 请求转交给 php-fpm（9000 端口）的机制；数据库初始化与 phpinfo 验证页。

**实现思路**：LNMP 各组件职责分明——nginx 管静态内容与转发，php-fpm 管 PHP 动态解析（进程方式常驻，监听 127.0.0.1:9000），MariaDB 管数据。部署顺序：一次装齐 → 全部启动并设自启 → 修正 php-fpm 运行用户 → 配置 nginx 的 PHP 转发 → 数据库初始化 → 放 phpinfo 页验证整条链路。php-fpm 用户那一步最容易被跳过，后面上传文件写不进去时，报错却指向很隐晦，坑就在这。

### 步骤 1：yum 一次装齐四件套 {: .sec-prac}

```bash
yum install -y epel-release
yum install -y nginx mariadb-server \
    php php-fpm php-mysqlnd php-gd php-xml php-mbstring
```

`php-mysqlnd` 是 PHP 连接 MySQL/MariaDB 的驱动（旧版叫 php-mysql）；`php-gd/php-xml/php-mbstring` 是常见扩展，按需增减。

### 步骤 2：启动全部服务并设置开机自启 {: .sec-prac}

```bash
systemctl start nginx mariadb php-fpm
systemctl enable nginx mariadb php-fpm
systemctl status nginx mariadb php-fpm | grep -E 'Active:'
```

（预期输出，CentOS 7）

```text
$ systemctl status nginx mariadb php-fpm | grep -E 'Active:'
   Active: active (running) since Sat 2026-10-24 09:10:01 CST; 8s ago
   Active: active (running) since Sat 2026-10-24 09:10:02 CST; 7s ago
   Active: active (running) since Sat 2026-10-24 09:10:02 CST; 7s ago
```

确认 php-fpm 在监听 9000 端口：

```bash
ss -lntup | grep 9000
```

（预期输出，CentOS 7）

```text
tcp LISTEN 0 511 127.0.0.1:9000 0.0.0.0:* users:(("php-fpm",pid=2311,fd=9),...)
```

### 步骤 3：修正 php-fpm 运行用户 {: .sec-prac}

CentOS 7 的 php-fpm 默认以 `apache` 用户运行，而 nginx 是 `nginx` 用户，用户不一致会导致 php 写文件时权限错乱。编辑 `/etc/php-fpm.d/www.conf`：

```conf
; 修改前：user = apache / group = apache
user = nginx
group = nginx
```

```bash
systemctl restart php-fpm
```

### 步骤 4：配置 nginx 的 PHP 转发 {: .sec-prac}

编辑 `/etc/nginx/conf.d/default.conf`，在 server 段加入：

```nginx
location ~ \.php$ {
    root           /usr/share/nginx/html;
    fastcgi_pass   127.0.0.1:9000;          # 转交给 php-fpm
    fastcgi_index  index.php;
    fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
    include        fastcgi_params;
}
```

关键行是 `fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;`——它告诉 php-fpm「要执行的 PHP 文件在磁盘上的绝对路径」，漏写或写错会报 File not found。

### 步骤 5：初始化数据库 {: .sec-prac}

```bash
mysql_secure_installation    # 交互式：设 root 口令、移除匿名用户、禁远程 root、删测试库
mysql -u root -p -e "select version();"
```

（预期输出，CentOS 7）

```text
$ mysql -u root -p -e "select version();"
Enter password:
+----------------+
| version()      |
+----------------+
| 5.5.68-MariaDB |
+----------------+
```

创建业务库与账号（口令用占位符，实际执行时替换为自己的强口令）：

```bash
mysql -u root -p <<'EOF'
CREATE DATABASE blog DEFAULT CHARACTER SET utf8;
CREATE USER 'blog'@'localhost' IDENTIFIED BY '<your-password>';
GRANT ALL ON blog.* TO 'blog'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### 步骤 6：放 phpinfo 验证页，验证整条链路 {: .sec-ver}

```bash
printf '<?php\nphpinfo();\n' > /usr/share/nginx/html/test.php
curl -s http://127.0.0.1/test.php | head -8
```

（预期输出，CentOS 7）

```text
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head>
<style type="text/css">
body {background-color: #fff; color: #222; font-family: sans-serif;}
pre {margin: 0; font-family: monospace;}
a:link {color: #009; text-decoration: none; background-color: #fff;}
</style>
<title>phpinfo()</title>
```

看到 phpinfo 页面输出，说明「nginx 收到请求 → fastcgi 转发 → php-fpm 执行 → 结果回传」整条链路打通。再核对响应头确认是 nginx 服务的：

```bash
curl -sI http://127.0.0.1/test.php | head -3
```

（预期输出，CentOS 7）

```text
HTTP/1.1 200 OK
Server: nginx/1.20.1
Content-Type: text/html; charset=UTF-8
```

### 步骤 7：PHP 连接数据库验证页（B 级） {: .sec-ver}

phpinfo 只验证了「nginx → php-fpm」半条链路，完整的 LNMP 还要验证「PHP → MariaDB」。放一个连接测试页：

```bash
cat > /usr/share/nginx/html/db.php <<'EOF'
<?php
$conn = mysqli_connect('127.0.0.1', 'blog', '<your-password>', 'blog');
if (!$conn) {
    die('Connect Error: ' . mysqli_connect_error());
}
echo 'DB Connect OK, server version: ' . mysqli_get_server_info($conn);
EOF
curl -s http://127.0.0.1/db.php
```

（预期输出，CentOS 7）

```text
DB Connect OK, server version: 5.5.68-MariaDB
```

先确认 mysqli 扩展已加载（`php -m | grep -i mysqli` 应有输出），连不上时按报错分类：`Access denied` 是账号/口令问题，`Connection refused` 是 MariaDB 没启动，`Unknown database` 是库名写错。验证完成后 `test.php` 与 `db.php` 都要删除。

### LNMP 组件与常见故障速查 {: .sec-ts}

| 组件 | 端口/进程 | 配置文件 | 常见故障与排查 |
| --- | --- | --- | --- |
| nginx | 80/tcp | /etc/nginx/nginx.conf | `nginx -t` 看语法；403 查目录权限与 index 配置 |
| php-fpm | 127.0.0.1:9000 | /etc/php-fpm.d/www.conf | 页面 502 = php-fpm 未启动或 9000 未监听；File not found = SCRIPT_FILENAME 配错 |
| MariaDB | 3306/tcp | /etc/my.cnf | 起不来先看 /var/log/mariadb/mariadb.log；密码找回用 mysqld_safe 跳过授权表 |
| PHP | 随 php-fpm | /etc/php.ini | `php -v` 看版本；缺扩展查 `php -m` 已加载模块列表 |

### 辨析：502 与 504

两个都是「nginx 与后端之间出了问题」，但病根不同，分诊方向也不同：

- **502 Bad Gateway**：nginx 连不上后端，或后端回了无效响应。进程死了（php-fpm 崩了、9000 没监听）、socket 权限不对、`pm.max_children` 打满后直接拒绝连接，都是这一类。一句话：502 找「死」。
- **504 Gateway Timeout**：连接是通的，但后端在超时窗口（默认 60s）内没吐完响应。慢查询、外部接口卡死、php 脚本死循环，都表现成 504。一句话：504 找「慢」。

排障时先看 nginx error.log 里的关键字：`connect() failed` / `Connection refused` 走 502 路线查进程与端口；`upstream timed out` 走 504 路线查慢在哪。把 504 靠调大超时「治好」只是掩盖问题，根治要落到 SQL 优化或加缓存上。

生产提醒：php-fpm 的 `pm.max_children` 要按单进程平均内存反推（可分配内存 ÷ 单进程峰值），拍脑袋设小了高峰期就是一波 502。

> **易错点**：
>
> - 502 Bad Gateway 十有八九是 php-fpm 没起或 9000 端口没监听，先 `ss -lntup | grep 9000` 再查 nginx 配置；
> - php-fpm 运行用户忘改，php 上传/写日志时会出现「nginx 用户写不进去」的权限问题，且报错指向很隐晦；
> - `fastcgi_pass` 写成 nginx 自己的 80 端口会形成转发环，必须指向 php-fpm 的 9000；
> - 数据库口令绝不出现在命令历史与文档里，交互式输入或用 `mysql_config_editor`；脚本中一律用 `<your-password>` 占位并在执行时替换；
> - `mysql_secure_installation` 的每一步都答 y（设口令、删匿名用户、禁远程 root、删 test 库），这是裸机数据库的第一道安全底线。

## 验证方法 {: .sec-ver}

1. 状态页取数：curl 抓到的文本与真实 nginx 输出四行结构一致，`awk '/^Active/{print $3}'` 输出的数字随连接变化而变化，即证明取数正确；
2. 一次性解析：步骤 6 的单条 awk 能同时输出 Active/accepts/requests/Reading/Writing/Waiting 六个值，与页面逐行人工核对一致；
3. LNMP 四件套：`systemctl is-active nginx mariadb php-fpm` 三个都返回 `active`；
4. 动态链路：`curl -s http://127.0.0.1/test.php | head -1` 出现 phpinfo 的 DOCTYPE，且 `curl -sI` 的 Server 头是 nginx；
5. 数据库：`mysql -u blog -p blog -e 'show tables;'` 用新建的业务账号能登录（远程 root 已禁用，root 仅限本机）。

## 本篇小结 {: .sec-sum}

1. stub_status 页面结构固定四行：第 1 行活跃连接数、第 3 行 accepts/handled/requests 三个累计计数、第 4 行 Reading/Writing/Waiting 三个瞬时状态值；Waiting ≈ Active − Reading − Writing。各指标没有统一「正常值」，跟自己的基线比才有意义。
2. 状态页取数的标准姿势：`curl -s` 抓一次存变量，再交给 awk 统一解析；awk 一段程序可同时用正则匹配（`/^Active/`）、行号匹配（`NR==3`）与 END 汇总，一次取齐六个数值。
3. 列号看行结构定：`Active connections: 15` 的数值在第 3 列（前两列是标签词），第 4 行的 Reading/Writing/Waiting 在第 2/4/6 列；取数前先看一眼原始文本再写 awk，别凭感觉猜列。
4. 状态页是敏感信息，配置里必须 `allow` 白名单 + `deny all`；做监控采样要「同一时刻一次抓取」，否则数据之间对不上。
5. LNMP 部署四关：yum 装齐并启动自启 → php-fpm 用户改成 nginx → nginx 配 `fastcgi_pass 127.0.0.1:9000` 与 SCRIPT_FILENAME → `mysql_secure_installation` 初始化。
6. 排障口诀：502 查 php-fpm 与 9000 端口（找「死」），504 查超时与慢查询（找「慢」），File not found 查 SCRIPT_FILENAME，403 查权限与 index，数据库起不来查 /var/log/mariadb/；phpinfo 验证页打通后尽快删除，免得暴露服务器敏感配置。

> **参见**：LNMP 网站架构实战 · Nginx 网站服务部署 · day38 Nginx 部署与 301/302 跳转


{% endraw %}
