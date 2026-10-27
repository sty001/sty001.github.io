---
layout: page
icon: fas fa-book
order: 6
title: Linux 运维学习笔记总览
---

> 本博客的 Linux 运维笔记共 **109 篇**，按**电脑端原始文件夹**划分为 12 个分区（含 `00-`~`10-` 前缀与 `附录`）。每篇归档在「软件 › Linux › 对应文件夹」分类下，并打上阶段标签。

## 阅读指南（配色与区块含义）

- **标题层级配色**：`H2` 蓝 · `H3` 绿 · `H4` 紫 · `H5` 琥珀 —— 一眼看清结构深浅。
- **内容区块（彩色标签条）**：🔍 辨析（蓝）/ 📌 知识卡片（绿）/ ❓ 变式追问（紫）/ 💡 原理·为什么（橙）/ ⚠️ 坑位（红）/ ✏️ 注意·提示（琥珀），与普通段落明显区分。
- **分区与标签**：每篇归属一个「文件夹分类」（如 `09-综合架构`），并打阶段标签：**知识手册 / Linux基础 / 综合架构 / 作业实操 / 附录**。

> 下方按分区列出全部篇目与一句话内容速览，点击篇目名跳转阅读。

**分区直达**：[00 知识手册](#00-知识手册) · [01 基础入门](#01-基础入门) · [09 综合架构](#09-综合架构) · [10 作业实操](#10-作业实操) · [附录](#附录)

## 00-知识手册

> 阶段标签：**知识手册** ｜ 共 4 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-核心概念手册](/posts/linux-manual-01/) | 硬件/系统/文件/权限/网络/架构全链路核心概念速览与要点辨析 |
| [02-命令速查手册](/posts/linux-manual-02/) | 全部高频命令按场景分类，参数示例即查即用 |
| [03-配置文件手册](/posts/linux-manual-03/) | 12 组服务配置文件的路径/关键参数/最小可用模板/易错点 |
| [04-排错手册](/posts/linux-manual-04/) | 系统无法启动、网络不通、磁盘满、服务异常等故障排查决策树 |

## 01-基础入门

> 阶段标签：**Linux基础** ｜ 共 3 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-计算机硬件组成](/posts/linux-basics-01/) | 服务器分类、机架/刀片/塔式、电源冗余、CPU 路数与核数、内存与磁盘 |
| [02-Linux系统概念](/posts/linux-basics-02/) | 操作系统概念、Linux 与 Unix 关系、内核与发行版、GNU/GPL |
| [03-系统安装部署](/posts/linux-basics-03/) | 镜像选择、VMware 安装、分区方案、最小化安装 |

## 02-系统操作

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

## 03-文件属性与正则表达式

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

## 04-文本处理三剑客

> 阶段标签：**Linux基础** ｜ 共 2 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-sed命令详解](/posts/linux-textproc-01/) | 增删改查、定址、替换、组合管道 |
| [02-awk命令详解](/posts/linux-textproc-02/) | 取列、条件匹配、内置变量、统计报表 |

## 05-用户与权限管理

> 阶段标签：**Linux基础** ｜ 共 2 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-用户管理](/posts/linux-userperm-01/) | 用户/组/家目录、useradd 参数、passwd |
| [02-用户权限与提权](/posts/linux-userperm-02/) | passwd/shadow/group 文件、su 与 sudo |

## 06-定时任务

> 阶段标签：**Linux基础** ｜ 共 1 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-定时任务与crond](/posts/linux-cron-01/) | crontab 时间语法、系统级任务、日志与排错 |

## 07-磁盘管理

> 阶段标签：**Linux基础** ｜ 共 2 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-磁盘管理基础](/posts/linux-disk-01/) | 物理结构、接口、RAID 各级别、分区概念 |
| [02-磁盘管理进阶](/posts/linux-disk-02/) | 分区、格式化、挂载、swap、磁盘满排查 |

## 08-网络基础

> 阶段标签：**Linux基础** ｜ 共 2 篇

| 篇目 | 内容速览 |
| --- | --- |
| [01-运维网络基础-上](/posts/linux-network-01/) | 通信原理、路由配置、OSI/TCP 模型 |
| [02-运维网络基础-下](/posts/linux-network-02/) | TCP 状态集、DNS/ARP、子网划分、系统路由 |

## 09-综合架构

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

## 10-作业实操

> 阶段标签：**作业实操** ｜ 共 56 篇，与课程 day01~day45 逐天对齐，另含周测/日测精讲

| 篇目 | 内容速览 |
| --- | --- |
| [day01-硬件与存储作业实操](/posts/linux-homework-01/) | 计算机硬件组成，3 题按「题目 + 完整过程 + 可验证结果 + 易错点」逐题真跑 |
| [day02-硬件与系统概念作业实操](/posts/linux-homework-02/) | Linux 系统概念，基础 3 题 + 扩展 1 题，过程与易错点一个不少 |
| [day03-系统安装作业实操](/posts/linux-homework-03/) | 系统安装部署，基础 3 题 + 扩展 1 题逐题实做 |
| [day04-远程连接与命令作业实操](/posts/linux-homework-04/) | 虚拟机克隆、已学命令总结，两道题留可复现步骤与真实结果 |
| [day05-命令与重定向作业实操](/posts/linux-homework-05/) | 命令参数逐条配真实运行示例，重定向符号全真跑，目录结构整理 FHS 速查表 |
| [day06-目录结构作业实操](/posts/linux-homework-06/) | 命令快捷方式、挂载步骤、目录结构作用三条总结，Git Bash 真跑对照 |
| [day07-运行级别与别名作业实操](/posts/linux-homework-07/) | 光驱自动挂载、7 个运行级别、单用户重置密码、rm 别名四题全做 |
| [day08-命令回顾作业实操](/posts/linux-homework-08/) | 课程回顾做成知识卡片，命令汇成总表，vim 模式体系与命令行替换真跑 |
| [day09-系统优化作业实操](/posts/linux-homework-09/) | 登录提示信息、命令/快捷方式/符号三张速查表、彩色提示符扩展题 |
| [day10-系统优化与软件安装作业实操](/posts/linux-homework-10/) | rpm 卸载全命令序列、阶段总结串成链、批量建户与 yum 安装流程 |
| [day11-网络端口与Vim作业实操](/posts/linux-homework-11/) | 服务端口速查表、vi/vim 模式与命令两张表、6 类高频报错恢复手法 |
| [day12-tail与tr作业实操](/posts/linux-homework-12/) | tail -f 与 -F 三场景对比真跑，tr 替换乱错复现与四种正确用法 |
| [day13-文件属性与find作业实操](/posts/linux-homework-13/) | find 按名/类型/时间/大小/-exec 真跑，文件属性总结与批量建号扩展 |
| [day14-文件批量压缩作业实操](/posts/linux-homework-14/) | 三种做法压缩 .txt：find -exec、find \| xargs、tar --exclude，含边界情况 |
| [day15-磁盘block与存储原理作业实操](/posts/linux-homework-15/) | block 大小查看修改、数据存储读取原理、磁盘满的三种原因 |
| [day16-目录大小统计作业实操](/posts/linux-homework-16/) | du 统计目录的三层原理：ls 假象、块占用、du 与 df 为何对不上 |
| [day17-三剑客与批量建用户作业实操](/posts/linux-homework-17/) | sed/awk 排除过滤对照 grep -v，批量建户设随机密码覆盖三知识点 |
| [day18-正则与sed总结作业实操](/posts/linux-homework-18/) | 正则符号、sed、find/tar/date 三题总结，A 级示例全部真跑 |
| [day19-awk捐款统计作业实操](/posts/linux-homework-19/) | awk 累加求和 + BEGIN/END 典型实战，扩展总额/平均值/最大值与数组 |
| [day20-chmod权限总结作业实操](/posts/linux-homework-20/) | 数字法与字母法语法、八进制换算、递归、755/644/600 场景怎么选 |
| [day21-用户与权限管理作业实操](/posts/linux-homework-21/) | 批量建户随机密码、passwd/shadow 列义对照、sudo 配置、su 与 su - 区别 |
| [day22-定时任务作业实操](/posts/linux-homework-22/) | crontab 五段语法 8 个经典示例、凌晨备份任务真跑、排错三板斧 |
| [day23-磁盘管理作业实操](/posts/linux-homework-23/) | 新盘分区挂载写 fstab、两种扩容 swap、df -h 与 df -i、RAID 0/1/5/10 对比 |
| [day24-阶段复习与命令总汇作业实操](/posts/linux-homework-24/) | 假期大复习：所有命令总汇 + 文件属性/正则/三剑客/权限/定时任务章节总结 |
| [day25-网络基础作业实操](/posts/linux-homework-25/) | 手工配静态 IP、ip/ping/traceroute/ss 排查命令、子网划分、OSI/TCP 对照 |
| [day26-DNS解析与命令复制作业实操](/posts/linux-homework-26/) | dig 文字表示 DNS 解析过程、命令总结、旧测验复习三部分 |
| [day27-综合架构规划与主机克隆作业实操](/posts/linux-homework-27/) | 3 层架构规划落成对照表、全集群 hosts 映射、模板机克隆改网络配置 |
| [day28-rsync备份服务部署作业实操](/posts/linux-homework-28/) | 守护进程完整部署、七大参数差异、密码文件与环境变量两种免密推送 |
| [day29-全网备份项目作业实操](/posts/linux-homework-29/) | 全网备份七步链路：需求→打包→清理→指纹→推送→校验→定时任务 |
| [day30-NFS存储服务作业实操](/posts/linux-homework-30/) | fstab 自动挂载靠什么服务、user 参数作用、NFS 部署全过程 |
| [day31-实时同步服务作业实操](/posts/linux-homework-31/) | inotify + rsync 事件驱动真跑，扩展数据库与 Windows 到 Windows 同步 |
| [day32-SSH密钥连接作业实操](/posts/linux-homework-32/) | while 轮询式同步与 inotify 的差别、ssh-keygen/copy-id 密钥认证真跑 |
| [day32-secure日志安全分析进阶作业实操](/posts/linux-homework-33/) | 51MB、50 万行 secure 日志，三剑客揪出 SSH 爆破源 IP 与防护建议 |
| [day33-Ansible模块与剧本预习作业实操](/posts/linux-homework-34/) | yum/service/cron/mount 等八个新模块对比表、playbook 最小化实例 |
| [day34-Ansible剧本部署rsync-nfs作业实操](/posts/linux-homework-35/) | 两个完整可跑剧本：rsync 一体化、NFS「装软件→配服务端→挂载」三段式 |
| [day35-Ansible扩展与roles作业实操](/posts/linux-homework-36/) | loop/when/tags/register 扩展功能、roles 规范、HTTP 与 Nginx 预习 |
| [day36-Ansible一键部署作业实操](/posts/linux-homework-37/) | 全网备份/NFS/实时同步三套服务整合进一个 import_playbook 一键剧本 |
| [day37-HTTP协议原理预习作业实操](/posts/linux-homework-38/) | 报文四段结构、curl -v 抓完整请求响应、方法状态码与首部字段速查 |
| [day38-Nginx部署与301-302跳转作业实操](/posts/linux-homework-39/) | 301/302 区别用本地真实重定向服务器抓包验证、curl 与 wget 对比 |
| [day39-Nginx上传限制与图片存储作业实操](/posts/linux-homework-40/) | 413 报错放行大文件的指令、图片从本地盘集中迁移到 NFS 的方案 |
| [day40-网站访问统计与压力测试作业实操](/posts/linux-homework-41/) | 构造 nginx 格式 access.log，awk+sort+uniq 统计访问 Top10 与压测 |
| [day41-LNMP环境搭建作业实操](/posts/linux-homework-42/) | curl 抓 stub_status 状态页取数值、LNMP 四层环境完整搭建 |
| [day42-反向代理与负载均衡作业实操](/posts/linux-homework-43/) | proxy 与 upstream 模块总结、keepalived 预习、lb02 克隆组高可用集群 |
| [day43-keepalived实时监控与上游切换进阶作业实操](/posts/linux-homework-44/) | vrrp_script + weight 实现 VIP 自动漂移，upstream 故障剔除仿真 |
| [day43-keepalived高可用作业实操](/posts/linux-homework-45/) | while 实时监控、nginx 停 keepalived 跟着停的 weight 联动实现 |
| [day43-nginx-keepalived联动监控作业实操](/posts/linux-homework-46/) | check_nginx.sh 健康检查、nginx 与 keepalived 联动链路写成脚本跑通 |
| [day44-监控服务Zabbix部署作业实操](/posts/linux-homework-47/) | 监控体系与组件辨析、Server/Agent 部署、中文乱码处理与服务端自测 |
| [day45-监控服务Zabbix自定义监控作业实操](/posts/linux-homework-48/) | UserParameter 自定义 key、「监控项→触发器→动作」流程、五种告警方式 |
| [day45-结课总复习与面试题精讲作业实操](/posts/linux-homework-49/) | 「裸机到高可用」架构大表、20 道高频面试题精讲、后续学习路线 |
| [周测-第01周-测验精讲](/posts/linux-homework-50/) | 30 题精讲：标准答案 + 考点解析 + 可复现实操 + 高频易错点 |
| [周测-第02周-测验精讲](/posts/linux-homework-51/) | 34 题精讲（原卷第 08 题空缺，按原序号顺延编排），折算答对 24 题左右 |
| [周测-第03周-测验精讲](/posts/linux-homework-52/) | 30 题精讲，每题配标准答案、考点解析与可复现的实操命令 |
| [周测-第04周-测验精讲](/posts/linux-homework-53/) | 40 题精讲，满分 120、及格 75，约答对 25 题，覆盖前四周考点 |
| [日测-day04-系统管理命令精讲](/posts/linux-homework-54/) | 系统管理命令全系列：查看创建切换、编辑写入、复制备份、目录整体复制 |
| [日测-day05-目录结构知识精讲](/posts/linux-homework-55/) | 挂载概念、一级目录作用、网卡配置文件、快捷键、光驱挂载与改 IP |
| [日测-day06-知识精讲](/posts/linux-homework-56/) | 系统目录与核心配置：主机名、本地解析、磁盘挂载、运行级别详解 |

## 附录

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
