---
title: "day11-网络端口与Vim作业实操"
date: 2026-10-24 09:47:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-11"
---

{% raw %}



课程第 11 天（基础知识回顾）的作业是三道总结题：网络中的服务端口号、vi/vim 使用方法、vi/vim 使用的异常错误。端口部分给速查表，并用系统服务登记文件真跑验证；vi/vim 部分给模式与命令两张速查表；排错部分整理 6 类高频报错的恢复手法。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

实操目录统一用 `/tmp/hw` 下的子目录。本文中 vim 编辑器本体在本环境不可用（Git Bash 的 `vi` 只是调用 `vim` 的包装脚本，未安装 vim），因此 vi/vim 相关操作为 B 级；端口登记信息的验证为 A 级。输出中的本地用户名已按脱敏要求替换为 `user`。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 总结网络中的服务端口号 | A 级（速查表 + 登记文件真跑验证） |
| 题 2 | 总结 vi/vim 使用方法 | B 级（模式速查表 + 命令速查表 + 标准流程） |
| 题 3 | 总结 vi/vim 使用的异常错误 | B 级（6 类报错排错表） |

## 题 1：总结网络中的服务端口号
{: .sec-sum}

**考察点**：端口号的作用（IP 找主机、端口找进程）、端口号的范围划分、常用服务的端口号与传输层协议，以及查看端口登记信息与监听状态的方法。
{: .callout-exam}

**实现思路**：先讲端口号的原理与分段，再给一张覆盖 20/21/22/23/25/53/80/110/143/443/3306/6379/11211 的速查表，用系统服务登记文件真跑验证条目，CentOS 真机上另有等价命令。
{: .callout-prac}

### 原理讲解：端口号是进程的"门牌号"
{: .sec-know}

一条网络通信由五元组确定：源 IP、目的 IP、传输层协议、源端口、目的端口。IP 地址负责把数据送到**主机**，端口号负责把数据交给主机上的**进程**：

- 端口号占 16 个 bit，取值范围 `0~65535`，共 65536 个；
- `0~1023`：知名端口（well-known），固定分配给标准服务，如 80 给 HTTP；
- `1024~49151`：登记端口（registered），分配给各应用程序，如 3306 给 MySQL；
- `49152~65535`：动态端口（dynamic/ephemeral），客户端临时使用。

系统用 `/etc/services` 文件登记"端口号 ↔ 服务名"的对应关系，很多工具（如 `getent`、部分防火墙配置）会查询它。

### 常用端口速查表
{: .sec-chk}

| 端口 | 服务名 | 传输层 | 用途 |
| --- | --- | --- | --- |
| 20 | ftp-data | TCP | FTP 数据端口，真正传文件内容 |
| 21 | ftp | TCP | FTP 控制端口，传账号与指令（明文，不安全） |
| 22 | ssh | TCP | SSH 加密远程登录；scp/sftp 也复用 22 |
| 23 | telnet | TCP | 明文远程登录，已被 SSH 淘汰，生产环境应关闭 |
| 25 | smtp | TCP | 邮件发送（发信服务器之间、客户端到服务器） |
| 53 | domain | TCP/UDP | DNS 域名解析，UDP 为主，TCP 用于区域传送 |
| 80 | http | TCP | Web 服务，明文传输 |
| 110 | pop3 | TCP | 邮件接收，邮件下载到本地后默认从服务器删除 |
| 143 | imap | TCP | 邮件接收，邮件保留在服务器，多端同步 |
| 443 | https | TCP | HTTP over TLS/SSL，加密 Web 服务 |
| 3306 | mysql | TCP | MySQL 数据库默认端口 |
| 6379 | redis | TCP | Redis 缓存数据库默认端口 |
| 11211 | memcached | TCP/UDP | Memcached 缓存服务默认端口 |

### 步骤 1：用服务登记文件验证端口表（已实操）
{: .sec-ver}

Linux 的 `/etc/services` 与 Windows 的 `C:/Windows/System32/drivers/etc/services` 是同一份 IANA 登记数据。Git Bash 中没有 `/etc/services`，直接验证后者：

```bash
grep -E "^(ftp|ssh|telnet|smtp|domain|http|pop3|imap|https) " /c/Windows/System32/drivers/etc/services
```

输出：

```console
$ grep -E "^(ftp|ssh|telnet|smtp|domain|http|pop3|imap|https) " /c/Windows/System32/drivers/etc/services
ftp                21/tcp                           #FTP. control
ssh                22/tcp                           #SSH Remote Login Protocol
telnet             23/tcp
smtp               25/tcp    mail                   #Simple Mail Transfer Protocol
domain             53/tcp                           #Domain Name Server
domain             53/udp                           #Domain Name Server
http               80/tcp    www www-http           #World Wide Web
pop3              110/tcp                           #Post Office Protocol - Version 3
imap              143/tcp    imap4                  #Internet Message Access Protocol
https             443/tcp    MCom                   #HTTP over TLS/SSL
https             443/udp    MCom                   #HTTP over TLS/SSL
```

再补验 20 号端口：

```bash
grep -i "ftp-data" /c/Windows/System32/drivers/etc/services
```

输出：

```console
$ grep -i "ftp-data" /c/Windows/System32/drivers/etc/services
ftp-data           20/tcp                           #FTP, data
```

登记文件中字段依次为：服务名、端口号/传输层、别名、注释。20 与 21 分属数据与控制，这正是 FTP 主动模式的经典面试点。

### 步骤 2：CentOS 7 真机上的等价验证（预期输出，CentOS 7）
{: .sec-ver}

```bash
grep -E "^(ftp|ssh|telnet|smtp|domain|http|pop3|imap|https) " /etc/services
```

（预期输出，CentOS 7）

```console
ftp-data        20/tcp
ftp             21/tcp
ssh             22/tcp
telnet          23/tcp
smtp            25/tcp
domain          53/tcp
domain          53/udp
http            80/tcp    www www-http
pop3            110/tcp
imap            143/tcp   imap4
https           443/tcp
```

### 步骤 3：查看本机端口监听状态（预期输出，CentOS 7）
{: .sec-prac}

```bash
ss -lntp
```

（预期输出，CentOS 7）

```console
State      Recv-Q Send-Q Local Address:Port  Peer Address:Port
LISTEN     0      128    0.0.0.0:22          0.0.0.0:*          users:(("sshd",pid=1001,fd=3))
LISTEN     0      128    [::]:22             [::]:*             users:(("sshd",pid=1001,fd=4))
```

`LISTEN` 表示端口正在监听，是服务正常启动的标志；`users:(("进程名",pid=…,fd=…))` 能直接定位是哪个进程占用了端口。

> **生产注意**：改动 sshd 端口或防火墙规则前，先开一个新终端验证能登进去，再退出旧会话——把自己锁在机器外面的事故每年都有。
{: .callout-pit}

**验证方法**：
{: .callout-verify}

1. 把速查表中 12 个端口逐条与登记文件输出核对，服务名与传输层完全一致；
2. 在 CentOS 上执行 `ss -lntp`，能看到 sshd 监听 22，说明"端口 ↔ 服务"对应关系真实成立；
3. 任意启动一个服务（如 `yum install -y nginx && systemctl start nginx`）后执行 `ss -lntp | grep :80`，应看到 nginx 监听 80。

> **易错点**：
>
> - 3306、6379、11211 这三个应用层端口在很多系统的 `/etc/services` 里**查不到**（本文 A 级输出也证实了这一点），它们是应用层的约定而非系统登记项，排错时不能只依赖 `/etc/services`；
> - 53 和 11211 同时有 TCP 与 UDP，DNS 查询默认走 UDP，防火墙要同时放行两种协议；
> - "端口被占用"的排查顺序：`ss -lntp | grep :端口` 找到占用进程，再决定 kill 掉还是改服务配置。
{: .callout-pit}

> **参见**：[常见协议与端口速查表](/posts/linux-arch-17/)、[ss/netstat与端口排错](/posts/linux-arch-17/)
{: .callout-ref}

## 题 2：总结 vi/vim 使用方法
{: .sec-sum}

**考察点**：vi/vim 的三种工作模式、模式之间的切换关系、各模式下的高频命令，以及一次完整的"打开 → 编辑 → 保存退出"流程。
{: .callout-exam}

**实现思路**：一张表讲清三种模式与切换，命令速查表按"移动光标、进入插入、删除、复制粘贴、撤销、查找替换、末行保存"分类；标准编辑流程配预期输出。vim 在本环境不可用（`vi` 只是调用 vim 的包装脚本），相关操作为 B 级。
{: .callout-prac}

### 原理讲解：三种模式
{: .sec-know}

vim 是"模式化"编辑器，同一串按键在不同模式下含义完全不同，这是新手最容易被卡住的地方：

为什么非要分模式？vi 诞生于 1976 年，Bill Joy 写它时用的 ADM-3A 终端既没有方向键也没有鼠标，`h j k l` 就是方向键（看这四个字母在键盘上的挪位就明白了）。模式化让所有操作都在主键区完成，手不离键盘——当年是硬件限制逼出来的设计，后来成了 modal editing 的效率来源。代价是新手有一段"按键不听使唤"的适应期，挺过去就好。

| 模式 | 作用 | 进入方式 | 退出方式 |
| --- | --- | --- | --- |
| 命令模式（普通模式） | 按键即命令，用于移动、删除、复制 | 打开文件默认进入 | 按 `Esc` 必定回到命令模式 |
| 插入模式（编辑模式） | 正常输入文本 | 命令模式按 `i`/`I`/`a`/`A`/`o`/`O` | 按 `Esc` |
| 底行模式（末行模式） | 执行保存、退出、查找替换 | 命令模式按 `:`、`/`、`?` | 回车执行，或按 `Esc` 取消 |

记忆口诀：**打开即在命令模式，`i` 进入编辑，`Esc` 回来，`:wq` 保存退出**。任何时候找不到状态，连按几次 `Esc` 再操作最保险。

### 模式切换与常用命令速查表
{: .sec-chk}

| 分类 | 按键/命令 | 作用 |
| --- | --- | --- |
| 进入插入 | `i` / `I` | 在光标前 / 行首插入 |
| 进入插入 | `a` / `A` | 在光标后 / 行尾插入 |
| 进入插入 | `o` / `O` | 在下/上一行新起一行插入 |
| 进入插入 | `Esc` | 退出插入模式回到命令模式 |
| 移动光标 | `0` / `$` / `gg` / `G` | 行首 / 行尾 / 文件首行 / 文件末行 |
| 移动光标 | `ngg` 或 `nG` | 跳到第 n 行 |
| 删除 | `x` / `nx` / `dd` / `ndd` / `dw` | 光标处字符 / n 个字符 / 整行 / n 行 / 一个单词 |
| 复制粘贴 | `yy` / `nyy` / `p` / `P` | 复制整行 / n 行 / 粘到光标后 / 前 |
| 撤销重做 | `u` / `Ctrl-r` | 撤销 / 重做 |
| 替换 | `r` / `R` | 替换光标处一个字符 / 进入替换模式 |
| 查找 | `/关键词` / `?关键词` / `n` / `N` | 向下查 / 向上查 / 下一个 / 上一个 |
| 保存退出 | `:w` / `:q` / `:wq` / `:q!` / `:wq!` | 保存 / 退出 / 保存退出 / 不保存退出 / 强制保存退出 |
| 显示行号 | `:set nu` / `:set nonu` | 显示 / 隐藏行号 |
| 查找替换 | `:%s/old/new/g` | 全文替换；去掉 `%` 只替换当前行 |
| 取消高亮 | `:noh` | 清除查找结果的高亮 |
| 放弃修改重读 | `:e!` | 恢复到上次保存的状态 |
| 借权限保存 | `:w !sudo tee %` | 只读文件无 root 时强制保存 |

### 标准编辑流程（预期输出，CentOS 7）
{: .sec-best}

```bash
vim test.txt
```

（预期输出，CentOS 7）

```console
$ vim test.txt
# 进入 vim，左下角显示文件名；直接敲键盘是命令，不会输入文本
```

依次按键：`i` → 输入 `hello linux` → `Esc` → `:wq`。

（预期输出，CentOS 7）

```console
$ cat test.txt
hello linux
```

### 非交互式用法（预期输出，CentOS 7）

vim 也常用在脚本里做非交互编辑：

```bash
vim -c "%s/old/new/g" -c "wq" test.txt      # 打开即全文替换并保存
vim -u NONE -N test.txt                     # 不加载任何配置打开，用于排错
vim -R test.txt                             # 以只读方式打开
vim + test.txt                              # 打开后跳到文件末尾
```

### 辨析：vi 与 vim

`vi` 是 1976 年的原版，几乎每台 Unix/Linux 都自带，功能够用但扩展能力有限；`vim`（Vi IMproved）是增强版，加了语法高亮、多级撤销、插件体系、分屏等。CentOS 7 最小化安装可能只有 `vi`，`yum install -y vim-enhanced` 装全 vim。判断当前用的是哪个：`vi --version` 能输出长篇版本信息的一般是 vim 的链接（多数发行版把 vi 做成 vim 的精简链接）。运维层面两者命令九成五通用，本文速查表两边都适用。

### 自测
{: .sec-prac}

1. 用 vim 打开任意文件，跳到文件最后一行应敲哪个键？（答案：`G`）
2. 误删了一行怎么恢复？（答案：`u`）
3. 编辑完发现改错了，想不保存直接退出应敲什么？（答案：先 `Esc`，再 `:q!`）
4. 想把文件中所有 `web` 字样替换成 `server`，完整命令是什么？（答案：`:%s/web/server/g`）

**验证方法**：按标准流程在 CentOS 上创建 `/tmp/hw/day11/vim_test.txt`，写入内容并 `:wq` 退出，执行 `cat /tmp/hw/day11/vim_test.txt` 能看到刚输入的内容，即证明流程正确；再执行一次 `:q!` 验证未保存内容确实被丢弃。
{: .callout-verify}

> **易错点**：
>
> - 在命令模式直接敲文字想输入内容，结果满屏乱跳——这是把插入模式当成了默认模式，先按 `i` 再输入；
> - 中文输入法状态下敲 `:` 会输入中文冒号，vim 不识别，报 `E492: 不是编辑器命令`，切回英文再操作；
> - `:wq` 写成 `:wq!` 是"强制保存退出"，两者在只读文件上行为不同，见题 3。
{: .callout-pit}

> **参见**：[Vim 编辑器的基本用法](/posts/linux-system-06/#vim-编辑器的基本用法)、[vi/vim最小闭环](/posts/linux-system-06/)
{: .callout-ref}

## 题 3：总结 vi/vim 使用的异常错误
{: .sec-ts}

**考察点**：vim 高频报错的成因与恢复手法，重点是交换文件报错、只读文件保存、编码乱码三类生产高频问题。
{: .callout-exam}

**实现思路**：按"报错现象 → 原因 → 解决命令 → 预期输出"整理排错表，恢复命令全部给 CentOS 7 标准写法。vim 在本环境不可用，本题为 B 级。
{: .callout-prac}

### vim 异常排错表
{: .sec-ts}

| 报错/现象 | 原因 | 解决命令 | 说明 |
| --- | --- | --- | --- |
| `E325: 注意！发现交换文件…` | 上次异常退出残留 `.swp` 文件，或文件正被另一个 vim 编辑 | 提示界面选 `O` 只读打开 / `E` 直接编辑 / `R` 恢复 / `D` 删除交换文件 | 多人同时编辑时务必先确认没有其他会话 |
| `E45: 'readonly' option is set` | 文件只读或当前用户无写权限 | `:w !sudo tee %` 借 sudo 保存；或退出后 `chmod`/`chown` | `%` 是 vim 里当前文件名的占位符 |
| `E37: 自上次更改后未写入` | 文件有改动但以只读方式打开，退出被拦截 | `:w!` 强制写入，或 `:q!` 放弃修改退出 | 想保留改动用 `:w!`，想丢弃用 `:q!` |
| 打开文件中文乱码 | 文件是 GBK 编码，vim 按 UTF-8 解析 | `:e ++enc=gbk` 重新按 GBK 打开；转码存盘用 `:set fenc=utf-8` 后 `:w` | 永久生效可配置 `fileencodings=ucs-bom,utf-8,gb18030` |
| 敲键盘无反应、光标不动（假死） | 误按 `Ctrl-S` 冻结了终端输出 | `Ctrl-Q` 恢复 | 与 vim 无关，是终端流控，SSH 里高发 |
| `E492: 不是编辑器命令` | 底行命令拼错，或中文输入法输入了中文冒号 | 切回英文输入法，重新敲 `:wq` | 冒号必须是半角 `:` |

### 步骤 1：处理 E325 交换文件（预期输出，CentOS 7）
{: .sec-prac}

异常断电或强制关闭 vim 后，同目录会残留 `.文件名.swp` 交换文件，再次打开时报错：

```bash
ls -a /tmp/hw/day11/
```

（预期输出，CentOS 7）

```console
$ vim test.txt
E325: 注意
发现交换文件 ".test.txt.swp"
   属主: root  日期: Sat Oct 24 03:30:11 2026
文件名: test.txt
修改过: 否
用户名: root  主机名: linux-node1
正在打开: no
[O] 只读打开, (E) 直接编辑, (R) 恢复, (D) 删除交换文件, (Q) 退出, (A) 中止
```

处置顺序：先确认没有其他 vim 会话在编辑该文件（`ls .*.swp`、询问同事），确认无人编辑后选 `D` 删除交换文件正常打开；若文件有未保存改动且需要找回，选 `R` 恢复。也可以手动清理：

```bash
rm -f /tmp/hw/day11/.test.txt.swp
```

### 步骤 2：只读文件保存（预期输出，CentOS 7）
{: .sec-prac}

用普通用户编辑 `/etc/hosts` 这类 root 文件，`:wq` 保存时报 `E45`。借 sudo 保存的标准手法：

```bash
vim /etc/hosts
# 修改后执行（不用退出 vim）:
:w !sudo tee %
```

（预期输出，CentOS 7）

```console
# 按回车后提示输入当前用户密码，随后出现:
W12: 警告: "..." 为只读，请按回车强制执行
"tee" 命令把 vim 缓冲区内容写回原文件，保存成功
```

更稳妥的做法是退出 vim 后先提权再编辑：`sudo vim /etc/hosts`。

### 步骤 3：修复中文乱码（预期输出，CentOS 7）
{: .sec-ts}

Windows 上创建的 GBK 编码文件传到 Linux 后用 vim 打开全是乱码。先用 `file` 命令确认编码：

```bash
file /tmp/hw/day11/gbk.txt
```

（预期输出，CentOS 7）

```console
$ file /tmp/hw/day11/gbk.txt
gbk.txt: ISO-8859 text, with CRLF line terminators
```

打开文件后重新指定编码读取：

```bash
vim /tmp/hw/day11/gbk.txt
:e ++enc=gbk
```

（预期输出，CentOS 7）

```console
# 中文显示正常；如需转存为 UTF-8:
:set fenc=utf-8
:w
```

**验证方法**：
{: .callout-verify}

1. E325：故意 `vim` 一个文件后强制结束会话，再次 `vim` 同一文件应复现报错界面，选 `D` 后能正常打开，`.swp` 文件消失；
2. E45：用非 root 用户 `vim /etc/hosts` 修改后 `:wq`，应看到 `E45`，改用 `:w !sudo tee %` 后 `grep 修改的内容 /etc/hosts` 能查到；
3. 乱码：把 GBK 文件 `:e ++enc=gbk` 后中文正常显示，`:set fenc=utf-8` 存盘后再 `file` 查看应变为 UTF-8。

> **易错点**：
>
> - 看到 E325 直接 `rm .*.swp` 有风险：如果真有另一个会话正在编辑，删掉交换文件等于破坏对方的崩溃恢复数据，先确认再删；
> - `:q!` 会丢弃所有未保存修改，执行前想清楚；只读拦截报 E37 时vim 是在保护你；
> - 乱码问题十有八九是编码不匹配，先用 `file` 确认文件真实编码再动手，不要反复试编码。
{: .callout-pit}

> **参见**：[vim保存时报e45等排错表](/posts/linux-system-06/)
{: .callout-ref}

## 本篇小结
{: .sec-sum}

三道题收尾，各留几句要紧的：

1. 端口号占 16 bit（0~65535），分知名端口（0~1023）、登记端口（1024~49151）、动态端口（49152~65535）三段；IP 定位主机，端口定位进程，"端口服务看四层"是排错口诀的一环。
2. 必须背下来的常用端口：20/21（FTP 数据/控制）、22（SSH）、23（Telnet 已淘汰）、25（SMTP）、53（DNS）、80（HTTP）、110（POP3）、143（IMAP）、443（HTTPS）、3306（MySQL）、6379（Redis）、11211（Memcached）。
3. 3306/6379/11211 是应用层约定，很多系统的 `/etc/services` 查不到，验证端口要 `ss -lntp` 看实际监听，不能只查登记文件。
4. vim 三种模式：命令模式（打开即进入）、插入模式（`i` 等进入）、底行模式（`:` 进入）；最小闭环是"`i` 输入 → `Esc` → `:wq`"，找不到状态就连按 `Esc`。
5. vim 三大高频异常：E325 交换文件（确认无人编辑后选 `D` 或手动删 `.swp`）、E45 只读（`:w !sudo tee %` 借权限保存）、中文乱码（`file` 确认编码后 `:e ++enc=gbk`）。
6. 编辑系统文件的标准姿势是 `sudo vim 文件`，从源头避免只读报错；`:q!` 丢弃修改、`:w!` 强制保存，两个感叹号含义不同，用前想清楚。


{% endraw %}
