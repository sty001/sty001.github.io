---
title: "系统优化实践（上）：Vim 入门、用户管理与 yum 源"
date: 2026-10-24 09:06:00 +0800
categories: [软件, Linux, 系统操作]
tags: [Linux, 系统操作]
---

{% raw %}
刚装完 CentOS 7 要做的第一批优化：Vim 三种模式与常用快捷操作、查看系统版本与内核、创建与切换普通用户、定制命令提示符（PS1）的内容与颜色、把 yum 基础源与扩展源换成国内镜像，外加 SELinux、防火墙、SSH 加固、资源限制这些安全项。一台新机器照着过一遍就能交付。

## 课前回顾：挂载与目录结构

| 知识点 | 说明 |
| --- | --- |
| 什么是挂载 | 把一个目录作为存储设备的挂载点，进入该目录即可看到设备中的数据 |
| `/bin` `/sbin` `/home` `/root` | 根下常见目录，分别存放普通命令、管理命令、普通用户家目录、root 家目录 |
| `/etc` | 保存系统或服务的配置文件 |
| `/usr/local` | 保存编译安装的程序文件 |
| `/var` | 保存日志文件，如 `messages`（系统或服务运行情况、错误信息）、`secure`（用户登录情况） |
| `/proc` | 保存进程信息与硬件信息（CPU 型号等） |

> **注意：** 挂载时尽量不要使用已经有数据的目录作为挂载点，原有数据会被"遮住"。
>
> **注意：** `/proc` 目录中的数据文件不能随意修改，它反映的是内核运行时的实时状态。

## 原理解析：系统优化的整体思路

拿到一台刚装好的系统，该按什么顺序优化？业界公认的三个目标：**安全、性能、规范**，按这个顺序推进：

1. **安全**：先保证机器不丢、不被入侵——防火墙、SELinux、SSH 加固、账号管理。安全是底线，出事一次全部白干；
2. **性能**：再让机器跑得顺畅——内存与 swap、文件描述符限制、内核参数、不必要的开机服务；
3. **规范**：最后让机器可维护——提示符可辨身份、yum 源统一、字符集统一、时间同步、命名规范。规范决定团队协作效率。

> **注意：** 顺序不能反：没做安全就开放端口，等于给攻击者敞开门；没做规范就上线，三个月后没人敢动这台机器。另外，**任何优化都要可回滚**——改配置前 `cp xxx xxx.bak`，改完先用 `systemctl restart` 或 `source` 验证，确认无误再考虑重启。

## Vim 编辑器的基本用法

### 打开与保存的最小流程

```bash
[root@linux-node1 ~]# vi test.txt   # 利用 vi 命令打开一个文件
# 输入 i                             # 进入编辑状态
# 编辑文件内容
# 按 esc                             # 退出编辑状态
# 输入 :wq                           # 保存退出文件
```

### 三种模式与互相切换

Vim 有三种模式：**命令模式**、**插入模式（编辑模式）**、**底行模式**。

- 打开文件时默认处于命令模式；
- 命令模式下输入 `i`、`a`、`o` 等进入插入模式，按 `esc` 退回命令模式；
- 命令模式下输入 `:` 或 `/` 或 `?` 进入底行模式。

底行模式的常用命令：

| 命令 | 作用 |
| --- | --- |
| `:w` | 保存 |
| `:q` | 退出 |
| `:wq` | 保存并退出 |
| `:wq!` | 强制保存退出 |
| `:q!` | 强制退出（不保存） |

### 移动光标并进入编辑状态

| 快捷键 | 作用 |
| --- | --- |
| `i` | 从光标所在位置进入编辑状态 |
| `I` | 将光标移动到行首，再进入编辑状态 |
| `o` | 在光标所在行的下面新起一行进行编辑 |
| `O` | 在光标所在行的上面新起一行进行编辑 |
| `a` | 将光标移动到右边的下一个字符进行编辑 |
| `A` | 将光标移动到行尾，进入编辑状态 |
| `C` | 将光标到行尾的内容删除，并进入编辑状态 |
| `cc` | 将整行内容删除并进入编辑状态 |

### 只移动光标，不进入编辑状态

| 快捷键 | 作用 |
| --- | --- |
| `G`（大写） | 将光标快速切换到文件尾部 |
| `gg`（小写） | 将光标快速切换到文件首部 |
| `ngg` | n 表示数字，移动到第 n 行 |
| `$` | 将光标移动到当前行的行尾 |
| `0` / `^` | 将光标移动到当前行的行首 |

### 命令模式到底行模式：搜索与命令

```bash
:        # 输入一些命令
/        # 进入搜索状态（向下搜索，按 n 依次向下）
?        # 进入搜索状态（向上搜索，按 n 依次向上）
```

### 删除、复制、粘贴与撤销

| 快捷键 | 作用 |
| --- | --- |
| `dd` | 删除（剪切）当前一行内容 |
| `3dd` | 删除（剪切）当前行开始的 3 行内容 |
| `p` | 粘贴内容 |
| `3p` | 粘贴多次内容 |
| `yy` | 复制一行内容 |
| `3yy` | 复制多行内容 |
| `u`（小写） | 撤销操作（undo） |

> **注意：** Vim 里的删除本质上就是剪切，删除后可以用 `p` 再粘贴回来。

快捷键是可组合的：`d2w` 删两个词、`2dd` 删两行、`y$` 复制到行尾——"数字 + 动作 + 对象"三段式，记十来个键能拼出上百种操作。`:wq` 还有不带冒号的等价写法：普通模式直接按 `ZZ` 保存退出。

> **补充：** 几个高频补充操作：`x` 删除光标处单个字符，`dw` 删除一个单词，`v` 进入可视选择模式（移动光标圈选范围后配合 `d` / `y`），`:set nu` 显示行号，`:noh` 取消搜索高亮，`gg=G` 全文自动缩进，`:s/old/new/g` 当前行全局替换、`:%s/old/new/g` 全文替换。

## 了解系统环境

两个命令确认系统版本与内核信息：

```bash
[root@linux-node1 ~]# cat /etc/redhat-release
CentOS Linux release 7.5.1804 (Core)        # 系统发行版本和具体系统版本信息

[root@linux-node1 ~]# uname -a
Linux linux-node1 3.10.0-862.el7.x86_64 #1 SMP Fri Apr 20 16:44:24 UTC 2018 x86_64 x86_64 x86_64 GNU/Linux
```

> **注意：** 面试或交接时常被问到"以前用的 Linux 系统是什么环境"，标准回答方式是：CentOS 7，具体型号 7.5，内核 3.10，64 位。建议把 CentOS 7 的内核信息记下来。

## 系统用户的创建、切换与查看

企业中管理系统时使用的身份是不同的：老员工/经理通常使用 root 用户身份管理；规范的企业中，新员工使用普通用户身份管理。

新机器上手先规划账号：root 只留给管理员，日常操作用普通用户 + sudo，每人一个账号不共用——出了事，日志才能落到具体人头上。禁用 root 直接登录后的标准流程就是：普通用户登录 → `su -` 或 `sudo -i` 提权。

```text
root     --- 皇帝（超级管理员，权限至高无上）
testuser --- 老百姓（普通用户，只管理指定数据）
```

### 创建用户并设置密码

```bash
[root@linux-node1 ~]# useradd testuser
[root@linux-node1 ~]# passwd testuser
```

`useradd` 之后、`passwd` 之前，账号处于锁定状态——shadow 里密码字段是 `!!`，这时 su 过去也登不进去。创建用户总是两步连做，中间断掉就是这个"看不见"的坑。

组相关操作顺带记一下：`useradd -g 组 用户` 指定主组，`-G 组1,组2` 指定附加组；给已有用户追加组用 `usermod -aG wheel testuser`——`-a` 是追加，漏了它，原有附加组会被整体替换掉。

### 普通用户切换身份

```bash
[testuser@linux-node1 ~]$ su - root
Password:
Last login: Mon Apr  8 09:04:09 CST 2019 from 10.0.0.1 on pts/1
[root@linux-node1 ~]#
```

### 查看用户信息

```bash
# 查看用户是否存在
[root@linux-node1 ~]# id testuser
uid=1000(testuser) gid=1000(testuser) groups=1000(testuser)
[root@linux-node1 ~]# id nosuchuser
id: nosuchuser: no such user

# 查看当前用户身份
[testuser@linux-node1 ~]$ whoami
testuser
```

> **注意：** `su - root` 中间的横杠表示"登录式切换"——连家目录、环境变量一起切成 root 的环境；不加横杠只换身份不换环境，排查环境变量问题时容易误判，新手容易栽在这。日常更推荐 `sudo`（按命令授权、有审计日志），而不是直接把 root 密码告诉所有人。`su`、`sudo` 与用户管理的完整内容见《用户权限与提权》篇。

## 命令提示符优化（PS1 环境变量）

### 默认配置与含义

```bash
[root@linux-node1 test]# echo $PS1
[\u@\h \W]\$
```

| 转义符 | 含义 |
| --- | --- |
| `\u` | 显示当前登录用户名称 |
| `\h` | 显示系统主机名称 |
| `\W` | 显示当前所在目录信息（目录结构的最后结尾信息） |

### 修改提示符内容

把 `\h` 换成 `\H`（显示完整主机名）、`\W` 换成 `\w`（显示完整路径），写入 `/etc/profile` 永久生效：

```bash
[root@linux-node1 /etc/sysconfig/network-scripts]# tail -5 /etc/profile
export PS1='[\u@\H \w]\$ '
```

### 修改提示符颜色

Linux 中给信息加颜色的通用写法：

```bash
\[\e[F;Bm] 文字内容 \e[m
```

- `F` 表示字体颜色，`B` 表示背景颜色；
- `\[\e[F;Bm]` 是开始设置颜色，`\[\e[0m]` 是结束颜色设置。

背景色代码是 40~47（如 `\[\e[41;1m\]` 红底），前景背景可以组合写 `33;41` 表示黄字红底。实际敲一遍就明白各数字对应什么颜色，比背表快。

```bash
[root@linux-node1 ~]# tail -5 /etc/profile
export PS1='\[\e[32;1m\][\u@\h \W]\$ \[\e[0m\]'
#                  设置颜色        内容          结束
```

常用颜色对照：

| 配置语句 | 效果 |
| --- | --- |
| `export PS1='\[\e[30;1m\][\u@\h \W]\$ \[\e[0m\]'` | 黑色提示符 |
| `export PS1='\[\e[31;1m\][\u@\h \W]\$ \[\e[0m\]'` | 红色提示符 |
| `export PS1='\[\e[32;1m\][\u@\h \W]\$ \[\e[0m\]'` | 绿色提示符 |
| `export PS1='\[\e[33;1m\][\u@\h \W]\$ \[\e[0m\]'` | 黄色提示符 |
| `export PS1='\[\e[34;1m\][\u@\h \W]\$ \[\e[0m\]'` | 蓝色提示符 |
| `export PS1='\[\e[35;1m\][\u@\h \W]\$ \[\e[0m\]'` | 粉色提示符 |
| `export PS1='\[\e[36;1m\][\u@\h \W]\$ \[\e[0m\]'` | 浅蓝提示符 |
| `export PS1='\[\e[37;1m\][\u@\h \W]\$ \[\e[0m\]'` | 白色提示符 |

如果想让用户名、主机名、目录显示成不同颜色，可以分段设置：

```bash
export PS1='[\[\e[32;1m\]\u@\[\e[33;1m\]\h\[\e[34;1m\] \W\[\e[0m\]]\$ '
```

> **注意：** 修改 `/etc/profile` 后需要重新登录，或执行 `source /etc/profile` 才能生效——改完没反应，九成是忘了这一步。

> **注意：** 课后练习"用户红色、主机名绿色、目录蓝色"的参考写法如下——每段用 `\[\e[0m\]` 单独收尾，避免颜色互相污染：

```bash
export PS1='[\[\e[31;1m\]\u\[\e[0m\]@\[\e[32;1m\]\h\[\e[0m\] \[\e[34;1m\]\W\[\e[0m\]]\$ '
```

> **提示：** 线上操作最怕认错机器，建议把主机名用醒目颜色标出（生产环境常用红色或黄色），做到"看一眼提示符就知道在哪台机器上"。

## yum 下载源优化

yum 软件的优势：

1. 不需要到官方网站单独下载软件包（yum 仓库）；
2. 可以自动解决软件的依赖关系。

### 优化基础 yum 源文件

```bash
curl -o /etc/yum.repos.d/CentOS-Base.repo http://mirrors.aliyun.com/repo/Centos-7.repo
```

### 优化扩展 yum 源文件

```bash
wget -O /etc/yum.repos.d/epel.repo http://mirrors.aliyun.com/repo/epel-7.repo
```

### 检查可用的 yum 源信息

```bash
yum repolist
```

### 实际下载软件验证

```bash
[root@linux-node1 ~]# yum install sl cowsay -y    # 需要提前优化好 epel 扩展源
[root@linux-node1 ~]# sl
[root@linux-node1 ~]# cowsay hello
[root@linux-node1 ~]# animalsay hello
```

配置完源先 `yum repolist` 看仓库列表和包数量——数量是 0 说明 baseurl 配错或网络不通，别急着 install 排半天。

> **注意：** `sl`、`cowsay` 这类小工具来自 epel 扩展源，如果只配置了基础源会提示找不到软件包。

为什么基础源和扩展源都要换国内镜像？默认 mirrorlist 指向国外源站，下载动辄几十 KB/s，装个软件等半天；国内镜像（阿里云、清华、中科大）同步了同样的内容，速度能差出一个数量级。EPEL 同理——它不在 CentOS 官方源里，单独一份 repo 文件。

## SELinux 三种模式与设置

SELinux（Security-Enhanced Linux）是内核级的强制访问控制（MAC）机制，对 root 用户权限做更细粒度的管控——即使进程以 root 运行，也只能访问策略允许的资源。传统权限（DAC）管的是"谁的文件谁说了算"，root 无所不能；SELinux 的 MAC 再加一层"策略说了算"——就算 root 被攻破，进程越界访问照样被拦。这是它明明麻烦却仍被推荐的原因。

三种工作模式：

| 模式 | 行为 | 使用场景 |
| --- | --- | --- |
| `enforcing` | 违反策略的操作直接拦截并记录 | 生产环境推荐 |
| `permissive` | 只记录警告，不拦截 | 排查"SELinux 是不是在捣乱"时用 |
| `disabled` | 完全不加载策略 | 测试 / 学习环境常见 |

常用操作：

```bash
getenforce                          # 查看当前模式
sestatus                            # 查看 SELinux 完整状态
setenforce 0                        # 临时切到 permissive（重启后失效）
setenforce 1                        # 临时切回 enforcing
vi /etc/selinux/config              # 永久修改（重启后生效）
```

```ini
SELINUX=enforcing
SELINUXTYPE=targeted
```

> **注意：** 很多企业中为了图省事直接设 `SELINUX=disabled`。更规范的做法是保持 `enforcing`，遇到拦截时用 `ausearch -m avc` 查日志、`semanage fcontext` + `restorecon` 修正文件上下文——这样既保住安全又不误事。修改 `/etc/selinux/config` 后必须重启系统才能生效；enforcing 与 permissive 之间可以热切换，disabled 则必须重启。

SELinux 的上下文是长这样的：`ls -Z 文件名` 能看到 `unconfined_u:object_r:admin_home_t:s0` 这样的标签。最常踩的坑是"文件挪了家"——把网站文件从 `/home` 挪到 `/www` 后 httpd 读不了，就是上下文没跟着走，`restorecon -Rv /www` 修好。

## firewalld 与 iptables 基本操作

### firewalld（CentOS 7 默认防火墙）

```bash
systemctl status firewalld                  # 查看运行状态
firewall-cmd --state                        # 查看是否运行
firewall-cmd --get-default-zone             # 查看默认区域
firewall-cmd --list-all                     # 查看当前区域放行的全部规则
firewall-cmd --list-ports                   # 查看放行的端口

firewall-cmd --add-port=8080/tcp            # 临时放行 8080（reload 后失效）
firewall-cmd --permanent --add-port=8080/tcp # 永久放行
firewall-cmd --reload                       # 重新加载规则（临时规则失效）

firewall-cmd --permanent --add-service=http # 永久放行 http 服务
firewall-cmd --permanent --remove-port=8080/tcp  # 移除端口
```

关键概念：

| 概念 | 说明 |
| --- | --- |
| 区域（zone） | 按信任程度分组的规则集，如 public（默认，最低信任）、trusted（全信任）、drop（丢弃一切） |
| 临时规则 | `--add-xxx` 不加 `--permanent`，立即生效但 reload 后丢失 |
| 永久规则 | 加 `--permanent`，写入配置文件但**不立即生效**，必须 `--reload` |
| 服务（service） | 预置的端口组合，如 http = 80/tcp |

防火墙管"端口开不开"，SELinux 管"进程能不能动这个文件"，两者管的不是一层事——别以为关了一个，另一个也跟着没事了。排错时逐个放行验证，别一次全关，出了问题分不清是谁的锅。端口转发也是高频需求：`firewall-cmd --permanent --add-forward-port=port=80:proto=tcp:toport=8080` 让 80 进来的流量转到 8080，改完记得 `--reload`。

> **注意：** "改了不生效"是 firewalld 最高频的问题——`--permanent` 只写配置不激活，`--add-xxx` 激活但不持久，正确姿势是两条都执行（或永久改完 `--reload`）。另外远程改防火墙有把自己关在门外的风险，先用 `timeout` 兜底：`timeout 60 firewall-cmd --add-port=22/tcp`，改错了 60 秒后自动恢复。

### iptables（底层包过滤，CentOS 6 默认）

```bash
iptables -L -n                             # 查看规则（-n 不解析域名，速度快）
iptables -A INPUT -p tcp --dport 22 -j ACCEPT        # 追加放行 22 端口
iptables -I INPUT 1 -s 10.0.0.0/24 -p tcp --dport 3306 -j ACCEPT   # 插入到第一条：仅允许网段访问数据库
iptables -D INPUT 3                        # 删除第 3 条规则
iptables -F                                # 清空所有规则（慎用）
iptables -P INPUT DROP                     # 设置默认策略为丢弃（先放行 22 再执行，否则自断连接）

iptables-save > /etc/sysconfig/iptables    # 保存规则，重启后生效
service iptables save                      # 等价的保存命令
```

> **注意：** CentOS 7 起 firewalld 才是官方推荐前端，iptables 命令实际由 `nftables` 后端兼容提供。两套前端不要同时用，规则会互相覆盖。企业级网络边界（专业防火墙、安全组）承担主要过滤职责，服务器本机的防火墙是第二道防线，规则宜少不宜滥。

## systemd 服务管理

| 命令 | 作用 |
| --- | --- |
| `systemctl start nginx` | 启动服务 |
| `systemctl stop nginx` | 停止服务 |
| `systemctl restart nginx` | 重启服务 |
| `systemctl reload nginx` | 重载配置（不中断服务，需要服务支持） |
| `systemctl status nginx` | 查看详细状态（是否运行、最近日志、PID） |

`status` 的输出里三段最有用：Loaded（自启状态）、Active（运行状态）、末尾几行最近日志——`Active: failed` 后面直接跟着失败原因，多数小问题不用去翻日志文件。
| `systemctl enable nginx` | 设置开机自启 |
| `systemctl enable --now nginx` | 立即启动并设置开机自启 |
| `systemctl disable nginx` | 取消开机自启 |
| `systemctl mask nginx` | 彻底屏蔽服务（连手动 start 都被拒绝） |
| `systemctl unmask nginx` | 解除屏蔽 |
| `systemctl is-active nginx` | 只看是否正在运行 |
| `systemctl is-enabled nginx` | 只看是否开机自启 |
| `systemctl list-unit-files` | 列出所有 unit 及其自启状态 |
| `systemctl list-dependencies nginx` | 查看服务的依赖树 |
| `systemctl daemon-reload` | 修改 unit 文件后重载配置 |

> **注意：** `disable` 只是取消开机自启，服务还能手动启动；`mask` 是把 unit 文件软链接到 `/dev/null`，任何方式都启动不了——用于防止服务被其他单元依赖意外拉起（如 mask 掉 `avahi-daemon`）。装了新的 unit 文件（如自己写的 `/etc/systemd/system/myapp.service`）后，必须先 `systemctl daemon-reload` 再 `enable --now`，否则 systemd 不认新文件。

### 辨析：service 与 systemctl

`service xxx start` 在 CentOS 7 里还能用，但它只是个兼容壳——内部转手就调 `systemctl`。真正的差别在能力面：systemctl 能看状态详情（`status` 带最近日志）、管理开机自启（enable / disable）、屏蔽服务（mask），service 都做不到。新写的文档、脚本一律用 systemctl，service 只在维护 CentOS 6 老脚本时才会出现。

## 开机自启优化

```bash
systemctl list-unit-files --state=enabled    # 列出所有开机自启的服务
systemctl list-unit-files --state=disabled   # 列出被禁用的服务
```

逐一评估已启用项，生产服务器上通常可以关掉：

| 服务 | 作用 | 处理建议 |
| --- | --- | --- |
| `postfix` | 邮件发送服务 | 非邮件服务器就 disable |
| `libvirtd` | KVM 虚拟化管理 | 不用虚拟机就 disable |
| `kdump` | 内核崩溃转储 | 小内存机器可 disable，故障定位场景保留 |
| `bluetooth` / `bluez` | 蓝牙 | 服务器无用，disable |
| `NetworkManager` | 动态网络管理 | 传统运维习惯用 network 服务时可 disable |

> **注意：** 关服务的原则是"关掉用不到的，不熟的不碰"——拿不准的服务先 `systemctl status 服务名` 看它是干什么的，再决定。生产变更前把 `list-unit-files` 的输出留档，方便对比与回滚。

开机慢先量化再动手：`systemd-analyze` 看总耗时，`systemd-analyze blame | head` 看每个服务的耗时排行，谁拖后腿一目了然，比逐个关服务试错快得多。想给自己的程序做开机自启，也写个最小 unit：`/etc/systemd/system/myapp.service` 三段（`[Unit]` 描述、`[Service]` 的 ExecStart 命令、`[Install]` 的 WantedBy=multi-user.target），然后 daemon-reload + enable——比往 rc.local 堆命令干净得多。

## SSH 安全优化

SSH 是远程管理的大门，也是最容易被扫描爆破的目标。加固配置在 `/etc/ssh/sshd_config`。

公钥认证比密码强在哪：私钥从不离开本机，链路上传的只有公钥推导出的签名；密码则每次登录都要发到服务端比对，爆破工具可以无限试。密钥加上 `PasswordAuthentication no`，爆破就从"撞库"变成"无门可撞"。

```bash
vi /etc/ssh/sshd_config
```

改之前先备份：`cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak`——一个拼写错误让 sshd 起不来时，有备份才能秒回滚。

```ini
Port 22222                        # 修改默认端口，避开大量自动化扫描
PermitRootLogin no                # 禁止 root 直接登录（先建好普通用户并授权 sudo）
PasswordAuthentication no         # 禁用密码认证，改用密钥
PubkeyAuthentication yes          # 启用密钥认证
MaxAuthTries 3                    # 每次连接最多尝试 3 次认证
AllowUsers opsuser web01user      # 白名单：只有这些用户可以登录
ClientAliveInterval 60            # 服务端 60 秒无数据则探测
ClientAliveCountMax 3             # 连续 3 次无响应则断开，防止僵尸连接
```

```bash
systemctl restart sshd            # 重启 sshd 使配置生效
```

换端口选 1024~65535 且避开常用服务端口。云服务器还有第二道门：平台侧的安全组——sshd 配置对了、firewalld 放行了，安全组没放行照样连不上。三层（sshd 配置、系统防火墙、云安全组）都要核对，这是云上机器连不上最常见的原因。

> **注意：** 改 SSH 配置有把自己锁在门外的风险，务必遵守三条军规：① 改 `Port` 和 `PermitRootLogin` 前，先确认普通用户能通过 sudo 提权；② 改 `PasswordAuthentication no` 前，先把公钥装上并测试密钥登录成功；③ 保留一个已登录的终端窗口不断开，改完先测试新连接、确认能进再关旧窗口。企业环境还常配合 fail2ban（自动封禁暴力破解 IP）和安全组白名单使用。fail2ban 值得多看一眼：它盯着 secure 日志里的失败记录，超过阈值自动封 IP，配合密钥认证是防爆破的黄金组合。

## ulimit 与 limits.conf

`ulimit` 控制当前 shell 及其子进程的资源上限：

```bash
ulimit -a                          # 查看当前所有限制
ulimit -n                          # 查看文件描述符上限
ulimit -n 65535                    # 临时调整文件描述符上限（当前 shell 有效）
ulimit -u                          # 查看进程数上限
```

永久生效写 `/etc/security/limits.conf`：

```bash
vi /etc/security/limits.conf
```

```ini
*               soft    nofile          65535
*               hard    nofile          65535
*               soft    nproc           65535
*               hard    nproc           65535
root            soft    nproc           unlimited
```

四列含义：`用户/组 类型（soft/hard） 项目 值`。

| 项目 | 含义 |
| --- | --- |
| `nofile` | 单进程可打开的文件描述符数量（高并发服务必调） |
| `nproc` | 单用户可启动的进程数 |
| `soft` | 软限制，用户可自行调高 |
| `hard` | 硬限制，软限制的天花板 |

删用户的命令也一并记住：`userdel -r 用户名`，`-r` 连家目录一起删；不带 `-r` 会留下一堆无主的目录。

> **注意：** `limits.conf` 只对通过 PAM 登录的会话（ssh、su、控制台）生效，**对 systemd 启动的服务不生效**——服务的限制要在 unit 文件里加 `LimitNOFILE=65535`，或用 `systemctl edit` 追加覆盖配置。调完 nproc 后如果太小，可能出现 `fork: retry: Resource temporarily unavailable`，用户连命令都执行不了。

验证限制是否真的生效：登录后 `ulimit -n` 直接看当前值；验证某个服务的限制，`cat /proc/服务PID/limits`——它显示该进程真实的限制值，比猜靠谱。

## GRUB 加密与单用户模式密码

单用户模式（`init 1` / `rescue.target`）可以免密码拿到 root 权限——服务器物理上谁都能摸到时，这是重大隐患。给 GRUB 引导菜单加密码：

```bash
grub2-setpassword                     # 交互式设置 GRUB 菜单密码
grub2-mkconfig -o /boot/grub2/grub.cfg   # 重新生成引导配置使其生效
```

效果：

1. 开机进入 GRUB 菜单需要输入密码，不知道密码无法按 `e` 编辑内核参数；
2. 因此也无法通过在启动参数里加 `init=/bin/bash`、`single` 之类的方式绕过认证直接进单用户；
3. 需要进单用户维护时，输入 GRUB 密码即可正常操作。

> **注意：** 密码的哈希值保存在 `/boot/grub2/grub.cfg` 和 `/etc/grub.d/40_custom` 中，设置前先确认 `/boot` 分区权限正常。物理安全（机房门禁、锁机柜）始终是第一道防线，GRUB 密码是它的延伸。云服务器（ECS）还应关闭控制台的"救援模式"直通，改走带审计的运维通道。GRUB 密码忘了的恢复路径：物理接触机器用救援盘，或云平台走带审计的控制台重置——最后又绕回物理安全这道题。

## 常见错误与排错

| 现象 | 可能原因 | 排查命令 | 解决方式 |
| --- | --- | --- | --- |
| 改了 firewalld 端口不通 | 只加了 `--permanent` 没 reload，或反之 | `firewall-cmd --list-ports` | 临时 + 永久都执行，或 `--reload` |
| 远程改 SSH 端口后掉线 | 新端口没放行 / 没生效 | 保留旧终端操作 | 提前放行端口并测试，用 `timeout` 兜底 |
| 服务 `enable` 了重启又不启动 | unit 文件有语法错误 | `systemctl status`、`journalctl -u 服务名` | 修正 unit，`daemon-reload` 后重新 enable |
| `enable --now` 没反应 | 新增 unit 文件未 daemon-reload | `systemctl list-unit-files` 看不到 | `systemctl daemon-reload` 再试 |
| 高并发服务报 `too many open files` | 文件描述符上限太低 | `ulimit -n` | 调 limits.conf（PAM 会话）或 unit 的 `LimitNOFILE` |
| `fork: retry: Resource temporarily unavailable` | nproc 限制太小 | `ulimit -u` | 调大 `nproc` 限制 |
| Vim 保存时报 `E45: 'readonly' option is set` | 文件只读或用户无写权限 | `ls -l 文件` | `:w !sudo tee %` 借 sudo 保存 |
| SELinux 导致服务读不了文件 | 文件安全上下文不对 | `ausearch -m avc`、`ls -Z` | `semanage fcontext` + `restorecon` 修正 |

## 现代环境补充

| 旧做法 | 现代做法 | 说明 |
| --- | --- | --- |
| `service xxx start` | `systemctl start xxx` | CentOS 7 起 systemd 统一管理 |
| `chkconfig xxx on` | `systemctl enable xxx` | 开机自启的两种写法 |
| `iptables` 直接配规则 | `firewall-cmd` / `nftables` | firewalld 是官方前端，nftables 是新内核后端 |
| `/etc/inittab` 配启动级别 | `systemctl set-default multi-user.target` | inittab 已废弃 |
| 密码登录 SSH | 密钥登录 + fail2ban | 暴力破解拦截，安全基线要求 |

> **注意：** CentOS 7 已于 2024 年 6 月停止维护，Rocky Linux、AlmaLinux 上本篇所有命令与配置路径完全一致；firewalld、sshd_config、systemd 的行为也无差异。systemd 的 `systemctl edit --full` 是现代管理 unit 文件的推荐方式（自动生成覆盖配置，不用直接改 `/usr/lib` 下的系统文件）。

## 课后练习

**基础练习**

1. 如何做到每次登录系统都提示小牛信息（`cowsay`）；
2. 总结本篇涉及的所有命令、快捷方式与符号。

**扩展练习**

1. 如何实现彩色提示符：用户信息显示为红色、主机名信息显示为绿色、目录信息显示为蓝色。

## 小结

1. Vim 有三种模式（命令模式、插入模式、底行模式），掌握 `i/I/o/O/a/A/C/cc` 进入编辑、`G/gg/ngg/$/0` 移动光标、`dd/yy/p/u` 编辑文本就够了。
2. 查看系统环境用 `cat /etc/redhat-release` 和 `uname -a`，要能说出系统版本、内核版本与位数。
3. 用户管理三件套：`useradd` + `passwd` 创建用户，`su - 用户名` 切换用户，`id` / `whoami` 查看用户信息。
4. 命令提示符由 `PS1` 环境变量控制，`\u` `\h` `\W` 分别代表用户、主机、目录，颜色用 `\[\e[F;Bm\] ... \[\e[0m\]` 包裹。
5. yum 优化分两步：基础源（CentOS-Base.repo）与扩展源（epel.repo），配置完用 `yum repolist` 确认。
6. 所有写入 `/etc/profile` 的修改都需要重新登录或 `source` 之后才会生效。
7. 系统优化按"安全 → 性能 → 规范"推进：SELinux 三种模式（enforcing / permissive / disabled）、firewalld 临时与永久规则要成对操作、systemd 服务管理掌握 enable/disable/mask、SSH 加固改端口禁 root 用密钥。
8. 资源限制用 `ulimit`（临时）与 `/etc/security/limits.conf`（永久，仅 PAM 会话生效）；GRUB 密码守住单用户模式这个后门。

## 自测题

1. `systemctl disable nginx` 和 `systemctl mask nginx` 有什么区别？
2. `firewall-cmd --permanent --add-port=8080/tcp` 执行后端口立刻通了吗？正确的完整操作是什么？
3. SELinux 三种模式各自的行为是什么？永久修改用哪个文件、是否需要重启？
4. SSH 加固通常改哪几项？改之前必须完成的两个保险动作是什么？
5. `/etc/security/limits.conf` 能限制 systemd 启动的服务吗？应该怎么做？

> **答案：**
> 1. `disable` 只是取消开机自启，服务仍可手动 `systemctl start nginx` 启动；`mask` 把 unit 链接到 `/dev/null`，任何方式都无法启动，用于彻底屏蔽。
> 2. 不通。`--permanent` 只写入配置不激活。正确做法：先 `firewall-cmd --permanent --add-port=8080/tcp` 再 `firewall-cmd --reload`，或临时规则 `firewall-cmd --add-port=8080/tcp` 立即生效（重启失效）。
> 3. enforcing 违规直接拦截并记录；permissive 只记录不拦截；disabled 完全不加载策略。永久修改 `/etc/selinux/config`，必须重启系统才生效；enforcing 与 permissive 之间可用 `setenforce` 热切换。
> 4. 常改项：`Port`（改端口）、`PermitRootLogin no`（禁 root 登录）、`PasswordAuthentication no` + `PubkeyAuthentication yes`（密钥认证）、`AllowUsers`（白名单）、`MaxAuthTries 3`。保险动作：① 确保有一个可用 sudo 的普通用户；② 先把公钥装好并验证密钥登录成功，再关密码认证；另外保留一个旧窗口不断开。
> 5. 不能。limits.conf 只对 PAM 登录的会话生效，systemd 服务不走 PAM。要用 `systemctl edit 服务名` 添加 `LimitNOFILE=65535` 覆盖配置，再 `daemon-reload` 并重启服务。

## 相关阅读

- 用户管理
- 用户权限与提权
- 远程管理服务 SSH
- 系统优化实践（下）：字符集与远程连接优化
- 运维网络基础（下）
{% endraw %}
