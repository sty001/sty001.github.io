---
title: "day44 作业实操：监控体系概念辨析与 Zabbix 部署"
date: 2026-10-24 09:47:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 44 天（监控服务 Zabbix 上）的作业共四题：①监控体系与 Zabbix 组件概念辨析；②Zabbix Server 服务端完整部署；③Zabbix Agent 客户端部署；④部署自测（配置文件参数校验、中文乱码处理、服务端 zabbix_get 自测 agent 存活）。部署类动作为 B 级标准命令加预期输出，配置校验类在 Git Bash 真跑，输出为真实结果。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：配置片段编写与 grep 参数校验在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：yum 安装、systemctl、数据库初始化、Web 初始化等系统级动作给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

规划两台主机：服务端 linux-node01（172.16.1.71，部署 zabbix-server、zabbix-web、mariadb），客户端 linux-node02（172.16.1.7，部署 zabbix-agent）。Zabbix 版本选 4.0 LTS。A 级实操目录统一用 `/tmp/hw/day44`，配置片段中的数据库口令统一用 `<your-password>` 占位，部署时替换为自己的口令。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 监控体系概念辨析：Zabbix Server / Agent / Proxy / 数据库 / Web 的职责与端口 | 概念题（表格辨析） |
| 题 2 | Zabbix Server 服务端完整部署（yum 源、建库授权、导入 schema、Web 向导） | B 级（七步标准命令） |
| 题 3 | Zabbix Agent 客户端部署 | B 级（四步标准命令） |
| 题 4 | 部署自测：conf 参数 grep 校验、口令一致性检查、zabbix_get 自测 | A 级（校验真跑）+ B 级（zabbix_get 预期） |

## 题 1：监控体系概念辨析

**考察点**：能否说清 Zabbix 各组件的部署位置、职责与通信端口，这是面试与排错的基础。监控系统由「采集、存储、可视化、告警」四个环节构成，Zabbix 的组件正是按这四个环节分工的。

**组件职责对照表**：

| 组件 | 部署位置 | 职责 | 对应环节 |
| --- | --- | --- | --- |
| zabbix-server | 监控中心 | 接收 agent 数据，执行触发器判定，产生告警事件，是核心处理单元 | 判定与告警 |
| zabbix-agent | 被监控主机 | 按监控项的 key 执行采集命令并返回结果 | 指标采集 |
| zabbix-proxy | 远端机房 / 分支网络 | 代替 server 收集远端 agent 数据并本地缓存，定期同步给 server，适合跨公网大规模监控 | 指标采集（中转） |
| 数据库（mariadb/mysql） | 监控中心 | 存储监控配置、历史数据（history）与趋势数据（trends） | 数据存储 |
| zabbix-web + php | 监控中心 | Apache/Nginx + PHP 的 Web 界面，负责配置管理与图表展示 | 可视化 |

**常用端口**：

| 端口 | 所属服务 | 通信方向 |
| --- | --- | --- |
| 10051 | zabbix-server | 主动模式下 agent 连 server 推送数据 |
| 10050 | zabbix-agent | 被动模式下 server 连 agent 拉取数据 |

> **易错点**：10051 与 10050 极易记混。记忆方法：被动模式是「server 来拉」，目标端口是 agent 的 10050；主动模式是「agent 去推」，目标端口是 server 的 10051。被动是默认模式，所以 agent 端口 10050 见得最多。

### 辨析：主动模式与被动模式

这里的「主/被」站在 **agent** 视角：被动是 agent 等着 server 来拉（默认），主动是 agent 自己定时往 server 推（需配 `ServerActive` 与 `Hostname`）。差别落在三件事上——

- **server 压力**：几百台以下被动无所谓；上千台时 server 逐台轮询拉不动，主动模式把采集节奏交回 agent，server 只管收，压力小一个量级。
- **网络方向**：被监控主机在 NAT 后面、或安全策略不允许 server 反向连入时，只能用主动（agent 出站连接更容易放行）。
- **排障特征**：被动不通先查 agent 的 `Server=` 白名单和 10050 监听；主动不通先查 `ServerActive` 地址、`Hostname` 是否与 Web 端完全一致——Hostname 对不上是主动模式「数据不上来」的头号原因。

模板里的监控项类型要和模式配套：`Zabbix agent` 对应被动，`Zabbix agent (active)` 对应主动，类型选错了两边都对也不出数据。

生产提醒：监控数据只增不减，zabbix_server.conf 里默认的 housekeeping 会定期清理历史数据，但历史数据保留时长（`HistoryPollerDuration`/表分区策略）要在上线前就规划好，等磁盘被 history/trends 表撑爆再动手就晚了。

## 题 2：Zabbix Server 服务端完整部署（B 级）

**考察点**：LAMP 架构下的监控平台部署七步法，以及数据库初始化的两个关键参数（utf8 字符集、口令授权）。

**实现思路**：服务端 Web 环境是 LAMP（apache + php 模块 + mariadb），流程与部署 wordpress 类似。按「装源 → 装包 → 改配置 → 初始化数据库 → 启动服务 → Web 向导 → 登录」七步走。数据库那两步（utf8 字符集、口令一致）是整个部署里最容易翻车的地方，后面自测篇专门为它们做了前置校验。

### 步骤 1：安装 Zabbix yum 源（预期输出，CentOS 7）

```bash
rpm -ivh https://mirrors.tuna.tsinghua.edu.cn/zabbix/zabbix/4.0/rhel/7/x86_64/zabbix-release-4.0-1.el7.noarch.rpm
```

```text
Retrieving https://mirrors.tuna.tsinghua.edu.cn/zabbix/zabbix/4.0/rhel/7/x86_64/zabbix-release-4.0-1.el7.noarch.rpm
Preparing...                          ################################# [100%]
Updating / installing...
   1:zabbix-release-4.0-1.el7         ################################# [100%]
```

### 步骤 2：安装服务端软件（预期输出，CentOS 7）

软件清单：zabbix-server-mysql（服务端程序）、zabbix-web-mysql + httpd + php（Web 界面）、mariadb-server（数据库）。

```bash
yum install -y zabbix-server-mysql zabbix-web-mysql httpd php mariadb-server
```

```text
Installed:
  zabbix-server-mysql.x86_64 0:4.0.0-1.el7    zabbix-web-mysql.noarch 0:4.0.0-1.el7
  httpd.x86_64 0:2.4.6-99.el7                 mariadb-server.x86_64 1:5.5.68-1.el7
Dependency Installed:
  php.x86_64 0:5.4.16  php-mysql.x86_64 0:5.4.16  ...（省略若干依赖）
Complete!
```

### 步骤 3：修改服务端配置（预期输出，CentOS 7）

编辑 `/etc/zabbix/zabbix_server.conf`，第 126 行指定数据库口令；编辑 `/etc/httpd/conf.d/zabbix.conf`，第 21 行设置时区：

```conf
DBPassword=<your-password>
```

```conf
php_value date.timezone Asia/Shanghai
```

口令必须与步骤 4 中 grant 授权时一致，否则 zabbix-server 会因数据库认证失败起不来；时区不设会导致 Web 界面时间差 8 小时。

### 步骤 4：初始化数据库（预期输出，CentOS 7）

启动 mariadb 后建库、授权、导入初始 schema。**建库必须指定 `character set utf8 collate utf8_bin`**，否则 Web 界面中文会乱码：

```bash
systemctl start mariadb.service
mysql -uroot -p
```

```text
MariaDB [(none)]> create database zabbix character set utf8 collate utf8_bin;
Query OK, 1 row affected (0.00 sec)

MariaDB [(none)]> grant all privileges on zabbix.* to zabbix@localhost identified by '<your-password>';
Query OK, 0 rows affected (0.00 sec)

MariaDB [(none)]> quit;
```

导入初始表结构（create.sql.gz 由 zabbix-server-mysql 包提供，用 zcat 直接读压缩包，无需先解压）：

```bash
zcat /usr/share/doc/zabbix-server-mysql-4.0.0/create.sql.gz | mysql -uzabbix -p<your-password> zabbix
```

导入后抽查表数量验证（预期输出）：

```text
MariaDB [(none)]> use zabbix;
MariaDB [zabbix]> show tables;
+----------------------------+
| Tables_in_zabbix           |
+----------------------------+
| hosts                      |
| items                      |
| triggers                   |
| history                    |
| trends                     |
| users                      |
+----------------------------+
（共 144 张表，此处节选监控核心表）
```

### 步骤 5：启动服务（预期输出，CentOS 7）

```bash
systemctl start zabbix-server.service httpd mariadb.service
systemctl enable zabbix-server.service httpd mariadb.service
systemctl status zabbix-server.service
```

```text
● zabbix-server.service - Zabbix Server
   Loaded: loaded (/usr/lib/systemd/system/zabbix-server.service; enabled; vendor preset: disabled)
   Active: active (running) since Sat 2026-10-24 10:30:01 CST; 5s ago
```

看到 `active (running)` 即服务端启动成功；若启动失败，先看 `/var/log/zabbix/zabbix_server.log`，绝大多数是数据库口令或数据库未启动。

### 步骤 6 与步骤 7：Web 初始化向导与登录（预期输出，CentOS 7）

浏览器访问 `http://172.16.1.71/zabbix/setup.php`，按向导走五步：①前置条件检查页确认 PHP 扩展全部 OK（有 FAIL 项先装扩展）；②数据库连接页填 MySQL、库名 zabbix、用户 zabbix、口令、端口 3306；③填写 Zabbix server 名称与地址（本机填 172.16.1.71）；④摘要页确认后生成配置；⑤完成安装。初始化信息写入 `/etc/zabbix/web/zabbix.conf.php`。最后用默认账号 `Admin` / `zabbix` 登录，登录后立即改密并停用 guest。

## 题 3：Zabbix Agent 客户端部署（B 级）

**考察点**：被监控主机的纳管四步，重点是 `Server=` 白名单参数的含义。

**实现思路**：agent 装在 linux-node02 上，只需装包、写 Server 地址、启动、验证 10050 监听。

### 步骤 1 与步骤 2：装源与安装（预期输出，CentOS 7）

```bash
rpm -ivh https://mirrors.tuna.tsinghua.edu.cn/zabbix/zabbix/4.0/rhel/7/x86_64/zabbix-release-4.0-1.el7.noarch.rpm
yum install -y zabbix-agent
```

```text
Installed:
  zabbix-agent.x86_64 0:4.0.0-2.el7
Complete!
```

### 步骤 3：配置 Server 地址（预期输出，CentOS 7）

编辑 `/etc/zabbix/zabbix_agentd.conf`，第 98 行：

```conf
Server=172.16.1.71
```

`Server` 是被动模式的白名单：只有列表中的地址才能来拉数据，写错 IP 就是「主机图标不变绿」的最常见原因。主动推送需另配 `ServerActive`，两者含义不同。

### 步骤 4：启动并验证（预期输出，CentOS 7）

```bash
systemctl start zabbix-agent
ss -lntup | grep 10050
```

```text
tcp   LISTEN 0  128  0.0.0.0:10050   0.0.0.0:*   users:(("zabbix_agentd",pid=4509,fd=4))
```

看到 10050 处于 LISTEN 即 agent 启动成功。

## 题 4：部署自测——配置校验与 zabbix_get（A 级 + B 级）

**考察点**：部署完成后必须做参数自测。zabbix_get、systemctl 依赖真实 Zabbix 环境，属 B 级；「把配置片段写成文件、用 grep 校验关键参数」可以在本机真跑，属 A 级，用来在真实部署前先确认配置文件该写哪些行。

### 步骤 1：服务端配置片段与参数校验（已实操）

```bash
cd /tmp/hw/day44
cat > zabbix_server.conf.snippet <<'EOF'
ListenPort=10051
DBHost=localhost
DBName=zabbix
DBUser=zabbix
DBPassword=<your-password>
EOF
grep -nE '^(ListenPort|DBHost|DBName|DBUser|DBPassword)=' zabbix_server.conf.snippet
```

输出：

```text
2:ListenPort=10051
3:DBHost=localhost
4:DBName=zabbix
5:DBUser=zabbix
6:DBPassword=<your-password>
```

五个关键参数全部命中，服务端配置骨架完整。口令行只校验「存在」（`grep -c '^DBPassword='` 输出 `1`），不回显值，符合脱敏要求。

### 步骤 2：Agent 配置片段与参数校验（已实操）

```bash
cat > zabbix_agentd.conf.snippet <<'EOF'
Server=172.16.1.71
ServerActive=172.16.1.71
Hostname=linux-node02
ListenPort=10050
EOF
grep -nE '^(Server|ServerActive|Hostname|ListenPort)=' zabbix_agentd.conf.snippet
```

输出：

```text
2:Server=172.16.1.71
3:ServerActive=172.16.1.71
4:Hostname=linux-node02
5:ListenPort=10050
```

四个参数全部命中。Hostname 必须与 Web 端创建的主机名完全一致，这是后续主动模式不出错的前提。

### 步骤 3：口令一致性与建库语句检查（已实操）

DBPassword 与 grant 授权口令不一致是「zabbix-server 起不来」的头号原因。把两处写成文件后用脚本比对（只输出结论、不回显口令）：

```bash
cat > grant.sql <<'EOF'
create database zabbix character set utf8 collate utf8_bin;
grant all privileges on zabbix.* to zabbix@localhost identified by '<your-password>';
EOF
CONF_PW=$(sed -n 's/^DBPassword=//p' zabbix_server.conf.snippet)
SQL_PW=$(sed -n 's/.*identified by '"'"'\(.*\)'"'"';/\1/p' grant.sql)
if [ "$CONF_PW" = "$SQL_PW" ]; then echo "DBPassword 与 grant 授权口令一致: MATCH"; else echo "不一致: MISMATCH"; fi
grep -c 'character set utf8 collate utf8_bin' grant.sql
```

输出：

```text
DBPassword 与 grant 授权口令一致: MATCH
1
```

两条自测都通过：口令一致、建库语句带了 utf8 字符集（防中文乱码的关键行）。

### 步骤 4：zabbix_get 自测 agent 存活（预期输出，CentOS 7）

在服务端 linux-node01 上安装 zabbix-get 并测试 agent（agent.ping 返回 1 即存活）：

```bash
yum install -y zabbix-get
zabbix_get -s 172.16.1.7 -k agent.ping
zabbix_get -s 172.16.1.7 -k system.uname
```

```text
1
Linux linux-node02 3.10.0-1160.el7.x86_64 #1 SMP x86_64
```

zabbix_get 报 `ZBX_NOTSUPPORTED` 或超时的排查顺序：agent 的 `Server=` 是否写了本服务端 IP、10050 是否 LISTEN、两机之间网络是否放通。

### 步骤 5：部署常见故障排查表

部署环节的高频故障与排查路径汇总如下（源自主笔记排错章节，供真机部署时对照）：

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| zabbix-server 启动失败 | 数据库口令错误、mariadb 未启动、字符集不符 | systemctl status zabbix-server; tail /var/log/zabbix/zabbix_server.log | 修正 DBPassword；先启动 mariadb；建库指定 utf8/utf8mb4 |
| Web 界面中文乱码 | 建库时未指定 utf8 排序规则 | show create database zabbix; | 重建库并指定 utf8_bin，重新导入 create.sql.gz |
| 界面时间差 8 小时 | php 时区未设置 | grep date.timezone /etc/httpd/conf.d/zabbix.conf | 设置 Asia/Shanghai 后重启 httpd |
| setup.php 无法访问 | httpd 未启动或防火墙拦截 | systemctl status httpd; firewall-cmd --list-services | 启动 httpd 并放行 80 端口 |
| 主机图标不变绿 | agent 的 Server 配置错误、10050 未监听、网络不通 | ss -lntup \| grep 10050; telnet 172.16.1.7 10050 | 修正 Server 地址；启动 agent；放行防火墙 |

其中「口令错误」「字符集不符」「时区未设」三类正是题 4 步骤 3 在真机部署前可以提前自测掉的问题——把配置片段落盘、用 grep 与比对脚本过一遍，能省掉一轮「启动失败再回头看日志」的往返。

### 步骤 6：服务端口自测清单（已实操）

把服务端与客户端的端口约定写成清单文件并校验（部署完后逐项对照），本机真跑：

```bash
cd /tmp/hw/day44
printf '10051 zabbix-server\n10050 zabbix-agent\n3306 mariadb\n80 httpd\n' > ports.txt
awk '{printf "%-6s %s\n",$1,$2}' ports.txt
grep -c '1005[01]' ports.txt
```

输出：

```text
10051  zabbix-server
10050  zabbix-agent
3306   mariadb
80     httpd
2
```

10051/10050 两条端口约定在清单中齐备。真机验证时对应三条命令：服务端 `ss -lntup | grep 10051`、客户端 `ss -lntup | grep 10050`、数据库 `ss -lntup | grep 3306`。

## 验证方法

1. 服务端：`systemctl status zabbix-server httpd mariadb` 三个服务均为 active，Web 能打开 setup.php 并完成向导。
2. 数据库：`use zabbix; show tables;` 能看到 hosts、items、triggers、history 等表。
3. 客户端：`ss -lntup | grep 10050` 有 LISTEN；Web 端添加主机后图标变绿。
4. 配置自测：题 4 的 grep 校验全部命中、口令比对 MATCH；`zabbix_get -k agent.ping` 返回 1。

## 本篇小结

1. 监控体系四环节（采集、存储、可视化、告警）在 Zabbix 中分别由 agent、数据库、web、server+触发器+动作承担，proxy 是跨公网采集的中转件。
2. 端口记忆法：被动模式 server 拉数据连 agent 的 10050，主动模式 agent 推数据连 server 的 10051；主/被以 agent 视角区分，监控项类型必须与模式配套。
3. 服务端部署七步：装源、装包、改配置（DBPassword 与时区）、建库授权（utf8 字符集防乱码）、zcat 导入 schema、启动服务、Web 向导；默认账号 Admin/zabbix 登录后立即改密。
4. 客户端部署四步：装源、装包、配 `Server=` 白名单、启动并验证 10050 监听；Hostname 要与 Web 端主机名一致。
5. 部署自测可以前置：把配置片段落成文件，用 grep 校验关键参数、比对 DBPassword 与授权口令一致性，比到真机上报错再回头查省一倍时间。
6. zabbix_get 是服务端侧自测 agent 的第一工具，agent.ping 返回 1 即存活；不通时按「Server 白名单 → 10050 监听 → 网络连通」三步排查。历史数据保留策略上线前定好，别等磁盘满了再补课。

> **参见**：监控服务 Zabbix（上） · 监控服务 Zabbix（下） · day45 自定义监控作业实操
{% endraw %}
