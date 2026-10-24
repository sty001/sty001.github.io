---
title: "附录-运维英文词汇表"
date: 2026-10-24 09:00:00 +0800
categories: [软件, Linux, 附录]
tags: [Linux, 附录, 附录]
slug: "linux-appendix-02"
---

{% raw %}

本篇整理 Linux 学习过程中最常遇到的英文单词、界面提示与报错信息，按出现场景分为「系统安装与基础配置」「设备与服务状态」「常见报错与提示信息」「查询与方位描述」四类。

刚接触 Linux、对英文界面和报错信息不熟悉时用得上它：安装系统看不懂选项、服务起不来读不懂提示、查日志被单词卡住，都可以来这里对照。

> **说明：**「中文」列给出简短释义，「说明」列保留原文中对该词条的补充解释；原文未补充说明的词条以 `—` 表示。

## 一、系统安装与基础配置

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| `default` | 默认 | — |
| `style` | 风格 | — |
| `unit` | 单元 | — |
| `install` | 安装 | — |
| `enabled` | 启动，启用 | — |
| `disable` | 关闭 | — |
| `test` | 测试 | — |
| `media` | 介质 | 也指光盘介质 |
| `troubleshooting` | 排错 | — |
| `system` | 系统 | — |
| `network` | 网络 | — |
| `hostname` | 主机名称 | — |
| `configure` / `config` | 配置 | 两种写法均可表示"配置" |
| `general` | 通用配置 | — |
| `setting` | 设置 | — |
| `manual` | 手动 | — |
| `save` | 保存 | — |
| `apply` | 应用 | — |
| `destination` | 目标 | — |
| `standard partition` | 标准分区 | — |
| `boot` | 启动 / 引导 | — |
| `cancel` | 取消 | — |
| `accept changes` | 接受改变 | — |
| `security policy` | 安全策略 | — |
| `begin` | 开始 | — |
| `complete` | 完成 | — |
| `reboot` | 重启 | — |
| `login` | 登录 | — |
| `edit a connection` | 编辑一个连接 | 即编辑网络配置信息 |
| `back` | 返回 | — |
| `quit` | 退出 | — |
| `start` | 开启 | 服务操作动词之一 |
| `restart` | 重启 | 服务操作动词之一 |
| `stop` | 停止 | 服务操作动词之一 |
| `status` | 检查服务状态 | 服务操作动词之一 |

## 二、设备、连接与服务状态

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| `device` | 设备 | — |
| `Connection failed` | 连接失败 | — |
| `Connection established` | 连接成功 | — |
| `active` | 激活 | 表示服务激活状态 |
| `running` | 运行中 | 表示服务运行状态 |
| `inactive` | 未激活 | 表示服务未激活状态 |

## 三、常见报错与提示信息

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| `command not found` | 命令不能找到 | — |
| `Failed` | 失败 | — |
| `Permission denied` | 权限阻止 | — |
| `halt` | 系统关闭 | — |
| `No such file or directory` | 没有这个文件或目录 | — |
| `File exists` | 文件已经存在 | — |
| `insert` | 插入 | — |
| `omitting directory` | 忽略目录 | — |
| `force` | 强制 | — |
| `/dev/sr0 is write-protected, mounting read-only` | 写保护设备，以只读方式挂载 | `/dev/sr0` 是一个写保护的设备，挂载之后目录是一个只读状态 |
| `give root password for maintenance` | 请输入 root 用户密码进入维修模式 | 需要你输入一个 root 用户密码，并且会进入到维修模式 |
| `Memory` | 内存 | — |
| `info` | 信息 | — |
| `Average` | 平均 | — |
| `load` | 负载 | — |
| `Warning: Changing a readonly file` | 警告：正在修改只读文件 | 警告：你正在修改的文件是一个只读文件 |
| `'readonly' option is set (add ! to override)` | 文件为只读，需加 `!` 强制保存 | 只读文件，如果想进行保存需要加上一个参数 `!`（强制） |
| `Permission denied` | 权限不足，权限阻止 | — |

> **注意：** `Permission denied` 在原文中出现了两次（一次释为"权限阻止"，一次释为"权限不足，权限阻止"），含义相同，均为权限被拒绝。

## 四、查询与方位描述词汇

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| `query` | 查询 | — |
| `reverse` | 反向、逆向 | — |
| `before` | 在……之前 | — |
| `after` | 在……之后 | — |
| `center` | 中心 | — |
| `count` | 计数 / 计算 | 常用于统计行数、出现次数 |
| `exclude` | 排除 | — |
| `include` | 包含 | — |
{% endraw %}
