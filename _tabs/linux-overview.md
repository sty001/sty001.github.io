---
layout: page
icon: fas fa-book
order: 6
title: Linux 学习笔记总览
---

> 本博客的 Linux 运维笔记共 **109 篇**，按**电脑端原始文件夹**划分为 12 个分区（含 `00-`~`10-` 前缀与 `附录`）。每篇归档在「软件 › Linux › 对应文件夹」分类下，并打上阶段标签。

## 阅读指南（配色与区块含义）

- **标题层级配色**：`H2` 蓝 · `H3` 绿 · `H4` 紫 · `H5` 琥珀 —— 一眼看清结构深浅。
- **内容区块（彩色标签条）**：🔍 辨析（蓝）/ 📌 知识卡片（绿）/ ❓ 变式追问（紫）/ 💡 原理·为什么（橙）/ ⚠️ 坑位（红）/ ✏️ 注意·提示（琥珀），与普通段落明显区分。
- **分区与标签**：每篇归属一个「文件夹分类」（如 `09-综合架构`），并打阶段标签：**知识手册 / Linux基础 / 综合架构 / 作业实操 / 附录**。

> 下方按分区列出全部篇目与一句话内容速览，点击篇目名跳转阅读。

## 00-知识手册 · 知识手册

> 阶段标签：**知识手册** ｜ 共 4 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-核心概念手册](/posts/linux-manual-01/) | 硬件/系统/文件/权限/网络/架构全链路核心概念速览与要点辨析 |
| [02-命令速查手册](/posts/linux-manual-02/) | 全部高频命令按场景分类，参数示例即查即用 |
| [03-配置文件手册](/posts/linux-manual-03/) | 12 组服务配置文件的路径/关键参数/最小可用模板/易错点 |
| [04-排错手册](/posts/linux-manual-04/) | 系统无法启动、网络不通、磁盘满、服务异常等故障排查决策树 |

## 01-基础入门 · 基础入门

> 阶段标签：**Linux基础** ｜ 共 3 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-计算机硬件组成](/posts/linux-basics-01/) | 服务器分类、机架/刀片/塔式、电源冗余、CPU 路数与核数、内存与磁盘 |
| [02-Linux系统概念](/posts/linux-basics-02/) | 操作系统概念、Linux 与 Unix 关系、内核与发行版、GNU/GPL |
| [03-系统安装部署](/posts/linux-basics-03/) | 镜像选择、VMware 安装、分区方案、最小化安装 |

## 02-系统操作 · 系统操作

> 阶段标签：**Linux基础** ｜ 共 8 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-虚拟软件与远程连接](/posts/linux-system-01/) | VMware 网络模式、XShell/CRT 连接、快照、常见排错 |
| [02-常用文件操作命令](/posts/linux-system-02/) | ls、cd、cp、mv、rm、mkdir、touch、ln 等高频命令 |
| [03-目录结构与挂载](/posts/linux-system-03/) | FHS 标准目录、路径类型、mount/umount |
| [04-重要系统文件与运行级别](/posts/linux-system-04/) | /etc 关键文件、运行级别与 systemd target |
| [05-软件安装与硬件信息查看](/posts/linux-system-05/) | 别名永久生效、登录提示、yum 源、日志、硬件信息 |
| [06-系统优化实践-上](/posts/linux-system-06/) | Vim 入门、用户管理、yum 源配置 |
| [07-系统优化实践-下](/posts/linux-system-07/) | 安全服务、字符集、远程连接优化 |
| [08-文档编辑软件使用技巧](/posts/linux-system-08/) | Word 高效编辑技巧 |

## 03-文件属性与正则表达式 · 文件属性与正则表达式

> 阶段标签：**Linux基础** ｜ 共 7 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-基础知识回顾-上](/posts/linux-fileattr-01/) | 系统安装、远程连接、Vim 进阶 |
| [02-基础知识回顾-下](/posts/linux-fileattr-02/) | Vim 排错、文件查看、三剑客入门 |
| [03-文件属性与inode](/posts/linux-fileattr-03/) | 属性字段含义、文件类型、查找命令 |
| [04-文件属性进阶](/posts/linux-fileattr-04/) | find、tar、权限、用户与 inode |
| [05-文件属性实战](/posts/linux-fileattr-05/) | inode/block、软硬链接、时间命令 |
| [06-基础正则表达式](/posts/linux-fileattr-06/) | 基础正则符号逐项详解与实例 |
| [07-扩展正则表达式与grep](/posts/linux-fileattr-07/) | ERE、grep/egrep、组合实战 |

## 04-文本处理三剑客 · 文本处理三剑客

> 阶段标签：**Linux基础** ｜ 共 2 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-sed命令详解](/posts/linux-textproc-01/) | 增删改查、定址、替换、组合管道 |
| [02-awk命令详解](/posts/linux-textproc-02/) | 取列、条件匹配、内置变量、统计报表 |

## 05-用户与权限管理 · 用户与权限管理

> 阶段标签：**Linux基础** ｜ 共 2 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-用户管理](/posts/linux-userperm-01/) | 用户/组/家目录、useradd 参数、passwd |
| [02-用户权限与提权](/posts/linux-userperm-02/) | passwd/shadow/group 文件、su 与 sudo |

## 06-定时任务 · 定时任务

> 阶段标签：**Linux基础** ｜ 共 1 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-定时任务与crond](/posts/linux-cron-01/) | crontab 时间语法、系统级任务、日志与排错 |

## 07-磁盘管理 · 磁盘管理

> 阶段标签：**Linux基础** ｜ 共 2 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-磁盘管理基础](/posts/linux-disk-01/) | 物理结构、接口、RAID 各级别、分区概念 |
| [02-磁盘管理进阶](/posts/linux-disk-02/) | 分区、格式化、挂载、swap、磁盘满排查 |

## 08-网络基础 · 网络基础

> 阶段标签：**Linux基础** ｜ 共 2 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-运维网络基础-上](/posts/linux-network-01/) | 通信原理、路由配置、OSI/TCP 模型 |
| [02-运维网络基础-下](/posts/linux-network-02/) | TCP 状态集、DNS/ARP、子网划分、系统路由 |

## 09-综合架构 · 综合架构

> 阶段标签：**综合架构** ｜ 共 20 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-综合架构开篇与规划](/posts/linux-arch-01/) | 架构组成、环境规划、模板机优化、rsync 入门 |
| [02-备份服务rsync](/posts/linux-arch-02/) | 守护进程部署、参数详解、企业应用 |
| [03-备份项目实战](/posts/linux-arch-03/) | 需求分析、脚本编写、定时任务 |
| [04-存储服务NFS](/posts/linux-arch-04/) | 概念、部署、配置参数、客户端挂载 |
| [05-实时同步服务](/posts/linux-arch-05/) | rsync + inotify + sersync |
| [06-远程管理服务SSH](/posts/linux-arch-06/) | 连接原理、密钥认证、安全防护 |
| [07-批量管理Ansible-上](/posts/linux-arch-07/) | 概念、部署、常用模块 |
| [08-批量管理Ansible-中](/posts/linux-arch-08/) | 主机清单、模块补充、剧本入门 |
| [09-Ansible剧本扩展功能](/posts/linux-arch-09/) | 变量、判断、循环、标签、整合 |
| [10-批量管理Ansible-下](/posts/linux-arch-10/) | 一键化部署剧本、主机清单五种配法 |
| [11-Ansible剧本实战](/posts/linux-arch-11/) | 排错思路、NFS 一键部署、roles 规范 |
| [12-HTTP协议原理](/posts/linux-arch-12/) | 报文结构、请求方法、状态码、首部、无状态 |
| [13-Nginx网站服务部署](/posts/linux-arch-13/) | 安装、目录结构、主配置、虚拟主机、location |
| [14-Nginx网站服务进阶](/posts/linux-arch-14/) | 虚拟主机、访问控制、basic 认证 |
| [15-Nginx网站服务实战](/posts/linux-arch-15/) | autoindex、状态页、日志格式、rewrite |
| [16-LNMP网站架构实战](/posts/linux-arch-16/) | Nginx+PHP+MySQL 联动、站点上线、排错 |
| [17-负载均衡服务](/posts/linux-arch-17/) | upstream、调度算法、健康检查、会话保持 |
| [18-高可用服务keepalived](/posts/linux-arch-18/) | VRRP、vrrp_instance、脑裂、双主双从 |
| [19-监控服务Zabbix-上](/posts/linux-arch-19/) | 监控体系、Server/Agent 部署、Web 初始化 |
| [20-监控服务Zabbix-下](/posts/linux-arch-20/) | 自定义 key、触发器、五种告警方式 |

## 10-作业实操 · 作业实操

> 阶段标签：**作业实操** ｜ 共 56 篇

| 篇目 | 内容速览 |
| --- | --- |
| [day01-硬件与存储作业实操](/posts/linux-homework-01/) | day1 讲的是计算机硬件组成。作业一共 3 题，每题都按"题目 + 完整过程 + 可验证结果 + 易错点"的结构亲手过一遍。 |
| [day02-硬件与系统概念作业实操](/posts/linux-homework-02/) | day2 的主题是 Linux 系统概念。作业分基础 3 题、扩展 1 题，每一题都实际做一遍，过程、结果、易错点一个不少。 |
| [day03-系统安装作业实操](/posts/linux-homework-03/) | 课程第 3 天讲系统安装部署。基础作业 3 题、扩展 1 题，照旧逐题实做，过程和验证结果都留在本篇里。 |
| [day04-远程连接与命令作业实操](/posts/linux-homework-04/) | 课程第 4 天讲远程连接与系统管理，作业两道：虚拟机克隆、已学命令总结。下面是在实操环境里的完整过程，每道题都留了可复现的步骤和… |
| [day05-命令与重定向作业实操](/posts/linux-homework-05/) | 课程第 5 天是系统管理与操作命令，作业两条：总结已学命令及参数、预习系统目录结构。命令部分每条至少配一个真实运行的示例，重定向… |
| [day06-目录结构作业实操](/posts/linux-homework-06/) | 本篇对应课程第 6 天（操作命令与目录结构）的课后作业：总结命令快捷方式、总结存储设备挂载步骤、总结目录结构作用。三条作业全部完… |
| [day07-运行级别与别名作业实操](/posts/linux-homework-07/) | 本篇对应课程第 7 天（操作命令与目录结构）的课后作业：光驱开机自动挂载、系统 7 个运行级别作用与 CentOS 7 设置方法… |
| [day08-命令回顾作业实操](/posts/linux-homework-08/) | 本篇对应课程第 8 天（操作命令与目录结构）的课后作业：将之前的课程进行回顾总结、总结命令与参数、预习并掌握 vim 使用技巧。… |
| [day09-系统优化作业实操](/posts/linux-homework-09/) | 课程第 9 天（系统优化实践·上）留了三道作业：① 每次登录系统都提示信息；② 总结课程命令、快捷方式、符号；扩展题 ③ 实现彩… |
| [day10-系统优化与软件安装作业实操](/posts/linux-homework-10/) | 课程第 10 天（系统优化实践·下）的作业有五道：rpm 卸载、第一阶段总结、课程复述，外加批量建户与 yum 安装流程两个扩展… |
| [day11-网络端口与Vim作业实操](/posts/linux-homework-11/) | 课程第 11 天（基础知识回顾）的作业是三道总结题：网络中的服务端口号、vi/vim 使用方法、vi/vim 使用的异常错误。端… |
| [day12-tail与tr作业实操](/posts/linux-homework-12/) | 课程第 12 天（基础知识回顾）的作业就两道：tail 参数 -f 与 -F 的区别、tr 替换信息的原理。两道都完整真跑——t… |
| [day13-文件属性与find作业实操](/posts/linux-homework-13/) | 课程第 13 天（文件属性知识）的作业分三段：作业题目（tail 参数 -f/-F）、基础作业（总结 find 命令、总结文件属… |
| [day14-文件批量压缩作业实操](/posts/linux-homework-14/) | 课程第 14 天的作业：目录里混着 .jpg、.png 等其它文件，要把其中所有以 .txt 结尾的文件统一压缩处理。作业原文只… |
| [day15-磁盘block与存储原理作业实操](/posts/linux-homework-15/) | 课程第 15 天的作业三道：① 修改磁盘中 block 大小、查看默认 block 大小；② 总结数据存储与读取原理；③ 磁盘满… |
| [day16-目录大小统计作业实操](/posts/linux-homework-16/) | 课程第 16 天的作业只考一条命令：利用什么命令真正统计目录的大小（答案 du -xxx）。别小看这一条，背后有三层东西要掰开—… |
| [day17-三剑客与批量建用户作业实操](/posts/linux-homework-17/) | 对应课程第 17 天（shell 编程入门）的作业有两道：①sed/awk 命令如何进行排除过滤（对照 grep -v）；②批量… |
| [day18-正则与sed总结作业实操](/posts/linux-homework-18/) | 课程第 18 天的作业三道题全是「总结型」：①总结正则符号；②总结 sed 命令；③总结 find / tar / date。总… |
| [day19-awk捐款统计作业实操](/posts/linux-homework-19/) | 课程第 19 天的作业原题就一句话：求出测试文件中所有人第一次捐款的总额和第三次捐款总额，显示表头「第一总额 第三次总额」。题目… |
| [day20-chmod权限总结作业实操](/posts/linux-homework-20/) | 课程第 20 天要求总结 chmod 命令的使用方法，是典型的「总结型」题目，按规范转化为「知识讲解 + 速查表 + 可直接运行… |
| [day21-用户与权限管理作业实操](/posts/linux-homework-21/) | 本篇对应课程第 21 天（用户与权限管理）的课后作业，共四题：①批量创建用户 stu01..stu10 并给每个用户设置随机密码… |
| [day22-定时任务作业实操](/posts/linux-homework-22/) | 本篇对应课程第 22 天（定时任务）的课后作业，共四题：①默写 crontab 五段时间语法规则并给出 8 个经典示例；②写一个… |
| [day23-磁盘管理作业实操](/posts/linux-homework-23/) | 本篇对应课程第 23 天（磁盘管理）的课后作业，共四题：①新增一块磁盘，分区后格式化并挂载到 /data，写入 /etc/fst… |
| [day24-阶段复习与命令总汇作业实操](/posts/linux-homework-24/) | 本篇对应课程的假期作业（阶段性大复习），共两道大题：① 总结所有命令；② 总结重要章节（文件属性、正则表达式、sed/awk、用… |
| [day25-网络基础作业实操](/posts/linux-homework-25/) | 课程第 25 天（网络基础）留的作业共四题：①手工给 Linux 配静态 IP；②ip / ping / traceroute … |
| [day26-DNS解析与命令复制作业实操](/posts/linux-homework-26/) | 课程第 26 天的作业有三道大题：① 用文字表示 DNS 的解析过程（dig）；② 总结命令；③ 复习之前的测验（文件属性、定时… |
| [day27-综合架构规划与主机克隆作业实操](/posts/linux-homework-27/) | 课程第 27 天（综合架构开篇）的作业任务是：把一套中小规模网站的 3 层架构规划出来，落成「角色 / 主机名 / IP / 用… |
| [day28-rsync备份服务部署作业实操](/posts/linux-homework-28/) | 课程第 28 天（备份服务 rsync）的作业：完成 rsync 守护进程服务端的完整部署，掌握七大常用参数的差异，并分别用「密… |
| [day29-全网备份项目作业实操](/posts/linux-homework-29/) | 课程第 29 天（rsync 备份服务）的作业两道题：①自己试着完成全网备份数据项目；②总结每个服务的部署过程。第①题按「需求拆… |
| [day30-NFS存储服务作业实操](/posts/linux-homework-30/) | 课程第 30 天（NFS 存储服务）的作业三道题：①实现 fstab 文件自动挂载的特殊服务是什么？②研究 user 参数作用；… |
| [day31-实时同步服务作业实操](/posts/linux-homework-31/) | 课程第 31 天的作业原题只有一句话：「扩展实时同步软件：数据库需要实时同步、Windows 到 Windows 的实时同步」。… |
| [day32-SSH秘钥连接作业实操](/posts/linux-homework-32/) | 课程第 32 天留了两道作业：①用脚本实现实时同步（while 循环）；②让 Xshell 这类终端工具也走密钥连接，另外要提前… |
| [day32-secure日志安全分析进阶作业实操](/posts/linux-homework-33/) | 整套课程最经典的一道综合实战题就是它：课程第 32 天的作业给了一份约 51MB、近 50 万行的 SSH 认证日志 secur… |
| [day33-Ansible模块与剧本预习作业实操](/posts/linux-homework-34/) | 这份预习作业对应课程第 33 天：①把八个新模块——yum、service、cron、mount、user、group、unar… |
| [day34-Ansible剧本部署rsync-nfs作业实操](/posts/linux-homework-35/) | 课程第 34 天的作业就两道题：用剧本部署 rsync 服务，再用剧本部署 nfs 服务。原题只给方向，思路得自己补全——下面给… |
| [day35-Ansible扩展与roles作业实操](/posts/linux-homework-36/) | 本篇对应课程第 35 天的课后作业，共三题：① 对 ansible 剧本扩展功能进行总结；②（选做）总结 ansible 剧本 … |
| [day36-Ansible一键部署作业实操](/posts/linux-homework-37/) | 本篇对应课程第 36 天的课后作业，共三题：① 一键化部署全网备份项目；② 一键化部署 NFS 服务；③ 一键化部署实时同步服务… |
| [day37-HTTP协议原理预习作业实操](/posts/linux-homework-38/) | 本篇对应课程第 37 天（Nginx 网站服务）的预习作业：在下一次课部署 Nginx 之前，先把 HTTP 协议的核心概念亲手… |
| [day38-Nginx部署与301-302跳转作业实操](/posts/linux-homework-39/) | 本篇对应课程第 38 天的课后作业，共三题：①说明 301 跳转和 302 跳转的区别；②总结 curl 与 wget 两个下载… |
| [day39-Nginx上传限制与图片存储作业实操](/posts/linux-homework-40/) | 本篇对应课程第 39 天的课后作业，围绕 LNMP 网站上线后的两个真实痛点展开：①上传主题/图片时浏览器报 413 Reque… |
| [day40-网站访问统计与压力测试作业实操](/posts/linux-homework-41/) | 课程第 40 天的作业落在两件事上：①熟悉排序和去重命令，对文件里的数值信息做统计分析——找出用户访问最多的前 10 个页面；②… |
| [day41-LNMP环境搭建作业实操](/posts/linux-homework-42/) | 先把课程第 41 天的两道作业摆出来：①利用命令取出状态页面信息中的数值（curl）；②搭建 LNMP 环境（Linux + N… |
| [day42-反向代理与负载均衡作业实操](/posts/linux-homework-43/) | 课程第 42 天的作业进入综合架构的核心环节，共三题：①总结 Nginx 反向代理模块 ngxhttpproxymodule；②… |
| [day43-keepalived实时监控与上游切换进阶作业实操](/posts/linux-homework-44/) | 课程第 43 天的进阶作业围绕两件事展开：基于 keepalived 的高可用负载均衡架构，①如何对主节点做「实时监控」，在 n… |
| [day43-keepalived高可用作业实操](/posts/linux-homework-45/) | keepalived 这块，课程第 43 天留了两个方向性题目：①如何实现 keepalived 服务的实时监控（用 while… |
| [day43-nginx-keepalived联动监控作业实操](/posts/linux-homework-46/) | day43 的联动监控落地篇，对应课程第 43 天的课后作业：把「nginx 一停，keepalived 跟着停；nginx 一… |
| [day44-监控服务Zabbix部署作业实操](/posts/linux-homework-47/) | 课程第 44 天（监控服务 Zabbix 上）的作业共四题：①监控体系与 Zabbix 组件概念辨析；②Zabbix Serve… |
| [day45-监控服务Zabbix自定义监控作业实操](/posts/linux-homework-48/) | 课程第 45 天（监控服务 Zabbix 下）的作业有四题：①用 UserParameter 自定义监控 key（内存剩余、登录… |
| [day45-结课总复习与面试题精讲作业实操](/posts/linux-homework-49/) | 本篇是整套课程的收尾篇，对应第 41 天的总复习作业：①用一张大表把「从裸机到高可用」的完整架构链路串一遍，检验每个环节是否真的… |
| [周测-第01周-测验精讲](/posts/linux-homework-50/) | - 题量：30 题。每题 3 分、满分 90 分，及格分 70 分——按 3 分一题折算，答对 24 题上下才稳 |
| [周测-第02周-测验精讲](/posts/linux-homework-51/) | - 题量：34 题。原卷共 35 题，第 08 题空缺，按原序号 01–07、09–35 顺延编排；每题 3 分、总分 105 … |
| [周测-第03周-测验精讲](/posts/linux-homework-52/) | 这一篇整理第 03 周测验的 30 道题（原始题头标了 35 题，实际题面只有 30 道），每题配标准答案、考点解析、可复现的实… |
| [周测-第04周-测验精讲](/posts/linux-homework-53/) | - 题量：40 题。每题 3 分、总分 120 分，及格分 75 分，约答对 25 题 |
| [日测-day04-系统管理命令精讲](/posts/linux-homework-54/) | - 覆盖章节：day4 运维基础章节——系统管理命令，从目录/文件的查看、创建、切换，一路到编辑写入、复制备份、目录整体复制、删… |
| [日测-day05-目录结构知识精讲](/posts/linux-homework-55/) | - 覆盖章节：day5 目录结构相关知识：挂载概念、系统一级目录作用、网卡配置文件详解、常用键盘快捷键，外加光驱挂载和改 IP … |
| [日测-day06-知识精讲](/posts/linux-homework-56/) | - 覆盖章节：day6 运维基础章节——系统目录结构与核心配置文件。前半是主机名、本地解析、磁盘挂载、运行级别（CentOS 6… |

## 附录 · 附录

> 阶段标签：**附录** ｜ 共 2 篇

| 篇目 | 内容速览 |
| --- | --- |
| [附录-命令速查表](/posts/linux-appendix-01/) | 按功能分类的全部命令速查 |
| [附录-运维英文词汇表](/posts/linux-appendix-02/) | 运维常用英文单词对照 |

## 标签总览（分区对应）

- `知识手册`：4 部案头工具书（核心概念 / 命令速查 / 配置文件 / 排错）。
- `Linux基础`：01 基础入门 ~ 08 网络基础，共 27 篇，打地基。
- `综合架构`：09 综合架构 20 篇，企业级实战（rsync/NFS/SSH/Ansible/Nginx/LNMP/负载均衡/keepalived/Zabbix）。
- `作业实操`：10 作业实操 56 篇，与课程 day01~day45 逐天对齐 + 周测/日测精讲。
- `附录`：命令速查表、运维英文词汇表。
