---
title: "日测-day06-知识精讲"
date: 2026-10-24 09:02:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-56"
---

{% raw %}



## 本篇说明
{: .sec-expl}

- **覆盖章节**：day6 运维基础章节——系统目录结构与核心配置文件。前半是主机名、本地解析、磁盘挂载、运行级别（CentOS 6/7 差异）几道概念题，后半对应四类实操：改主机名、配永久环境变量、设别名、重置 root 密码。
- **题目来源**：day6 基础概念测验 + 基础练习测验（共 8 题，含官方答案）。
- **实操分级**
  - A 级（标注 `已实操`）：`export` / `alias` 等 shell 变量与别名操作，已在 Git Bash 真实执行（属主统一显示为 `user`）
  - B 级（标注 `预期输出，CentOS 7`）：`hostname` / `hostnamectl` / `systemctl` / 单用户模式救援等系统级操作，给出标准命令与 CentOS 7 预期输出
- **脱敏说明**：原题中的机构名、联系方式、学员姓名、示例域名一律删除；主机名统一 `linux-node01`，示例变量名由原题示例改为通用 `linuxvar`。
- **沙箱约定**：A 级实操统一在 `/tmp/hw/quiz/d6` 沙箱内完成。

---

## 一、基础概念部分
{: .sec-know}

### 题 1：主机名称修改文件路径

> **答案**：`/etc/hostname`
>
> 该文件存放本机的主机名，系统启动时读取它设置主机名。

**解析**：`/etc/hostname` 是 CentOS 7 以来的主机名配置文件，内容通常就是一行主机名（如 `linux-node01`）。注意它与 `/etc/hosts`（IP↔主机名映射）不是一回事：前者是"我是谁"，后者是"我怎么认别人"。

**验证方法**：`cat /etc/hostname` 输出唯一一行主机名，且与 `hostname` 命令返回一致，说明文件内容即运行中的主机名。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
cat /etc/hostname
```

```text
linux-node01
```

> **易错点**：把 `/etc/hostname`（本机名）与 `/etc/hosts`（解析表）混淆；CentOS 6 没有 `/etc/hostname`，主机名写在 `/etc/sysconfig/network` 的 `HOSTNAME=`。

---

### 题 2：本地解析文件路径

> **答案**：`/etc/hosts`
>
> 格式：`IP地址 主机名 别名`，用于本地静态域名解析，优先级通常高于 DNS。

**解析**：`/etc/hosts` 是最古老的"电话簿"——IP 与主机名的静态对应。为什么优先于 DNS？解析顺序由 `/etc/nsswitch.conf` 决定，默认 hosts 在前，先查本地表、查不到再问 DNS。集群内部常把各节点写进 hosts 实现免 DNS 互访。它只影响本机解析，不改网络拓扑。

**验证方法**：往 `/etc/hosts` 追加一行 `10.0.0.10 linux-node01`，之后 `ping linux-node01` 不经 DNS 直接解析到该 IP，即本地解析生效。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
cat /etc/hosts
```

```text
127.0.0.1   localhost localhost.localdomain
10.0.0.10  linux-node01
```

> **易错点**：改了 `/etc/hosts` 但服务有自己 DNS 缓存，需要重启服务或刷新缓存才生效；一行里 IP 在前、主机名在后，写反不生效。

---

### 题 3：本地磁盘挂载文件路径

> **答案**：`/etc/fstab`
>
> 系统启动时按此文件自动挂载存储设备，每行描述"设备 + 挂载点 + 文件系统类型 + 挂载选项"。

**解析**：`/etc/fstab`（file system table）是开机自动挂载的"清单"。配错一行可能导致系统起不来，所以改之前务必先 `mount -a` 测试配置是否正确。

**验证方法**：`mount -a` 无任何报错且 `df -h` 能看到新设备，说明 fstab 配置正确；有条件再重启一次，验证开机自动挂载。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
cat /etc/fstab
```

```text
/dev/sda1  /     xfs  defaults  0 0
/dev/sdb1  /data xfs  defaults  0 0
```

> **易错点**：挂载点目录必须先存在，否则 `mount -a` 报 "mount point does not exist"；最后两列（dump/pass）一般写 `0 0`。

---

### 题 4：系统运行级别及查看/配置方法
{: .sec-expl}

> **答案**：系统运行级别共 7 种：
> - 0：关机
> - 1：单用户级别（重置密码/修复系统，无网络）
> - 2：多用户级别（无网络，NFS 不可用）
> - 3：多用户级别（有网络，命令行，默认级别）
> - 4：预留，未使用
> - 5：图形界面级别
> - 6：系统重启级别
>
> 查看与配置（面试题）：
> - CentOS 6：`runlevel` 查看；临时 `init 级别`；永久 `vi /etc/inittab`
> - CentOS 7（target）：`systemctl get-default` 查看；`systemctl set-default multi-user.target` 设默认（对应 3），`graphical.target` 对应 5

**解析**：运行级别决定系统启动后进入什么状态。CentOS 7 用 `target` 取代了数字级别：`multi-user.target` ≈ 级别 3，`graphical.target` ≈ 级别 5。这题就是在考两套体系的对应关系，面试高频。记忆技巧：0 和 6 是两个"危险"级别（关机/重启），1 是救援级别，3 是服务器标配，5 是桌面。

**验证方法**：`systemctl get-default` 输出与预期 target 一致；CentOS 6 的 `runlevel` 输出形如 `N 3`，第一个字段 N 表示开机后未切换过级别。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
systemctl get-default
systemctl set-default multi-user.target
```

```text
multi-user.target
Removed symlink /etc/systemd/system/default.target.
Created symlink /etc/systemd/system/default.target -> /usr/lib/systemd/system/multi-user.target.
```

> **易错点**：CentOS 7 还兼容 `init 3`/`init 5`，但标准做法是用 `systemctl`；把 0（关机）与 6（重启）搞反会误操作。

---

## 二、基础练习部分
{: .sec-prac}

### 题 1（练习）：如何修改主机名称
{: .sec-prac}

> **答案**：
> - 临时修改：`hostname linux-node01`（立即生效，重启丢失）
> - 永久修改：`hostnamectl set-hostname linux-node01`（写入 `/etc/hostname`，重启仍生效）
>
> 建议两者都执行，保证立即生效且持久。

**解析**：`hostname 新名` 只改当前运行中的内核主机名，不落盘；`hostnamectl set-hostname` 会同时写 `/etc/hostname` 并即时生效，是 CentOS 7 推荐做法。要彻底生效，还需在 `/etc/hosts` 里把新主机名与回环/本机 IP 对应好。提示符里的主机名要重新登录或 `exec bash` 才刷新，未刷新不代表修改失败。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
hostname linux-node01
hostnamectl set-hostname linux-node01
hostname
cat /etc/hostname
```

```text
linux-node01
linux-node01
```

> **易错点**：只 `hostname` 不改 `/etc/hostname`，重启后主机名还原；改完忘了同步 `/etc/hosts`，某些服务按主机名解析会告警。

---

### 题 2（练习）：让 linuxvar=123456 永久生效并调取
{: .sec-prac}

> **答案**：
> 1. 编辑 `/etc/profile`（全局）或 `~/.bashrc`（用户级）：写入 `linuxvar=123456`
> 2. 立即加载：`source /etc/profile`
> 3. 调取查看：`echo $linuxvar`

**解析**：变量 `名=值` 直接赋值只在当前 shell 有效；写进 profile 再 `source` 才能"永久 + 立即生效"。`export` 前缀可让子进程继承，设置环境变量时建议加上。

**验证方法**：`source /etc/profile` 后执行 `echo $linuxvar` 输出设置值，重新登录后仍能取到，才算永久生效。

**实操验证**（A 级，已实操，会话级演示）：

```bash
cd /tmp/hw/quiz/d6
export linuxvar=123456
echo "设置后: linuxvar=$linuxvar"
echo "--- 永久写法(标准命令) ---"
echo "echo 'export linuxvar=123456' >> /etc/profile && source /etc/profile"
```

```text
设置后: linuxvar=123456
```

> **易错点**：`=` 两边不要留空格（`linuxvar = 123456` 会被当成命令）；临时变量重启即丢，必须写进 profile 才算永久。
>
> **变式追问**：加不加 `export` 差在哪？（不加是 shell 局部变量，子进程取不到；加了才随环境传给子进程，脚本里才读得到。）

---

### 题 3（练习）：设置别名 net 等价于 cat 网卡配置
{: .sec-prac}

> **答案**：
> - 临时：`alias net='cat /etc/sysconfig/network-scripts/ifcfg-eth0'`
> - 永久：把上面一行写入 `/etc/profile` 或 `~/.bashrc`，再 `source`
> - 检查：`alias`（不加参数查看全部别名）

**解析**：别名是"命令的小名"，把又长又常用的命令缩短。`net` 这种别名在排障时很方便——敲 `net` 就能看网卡配置。注意 CentOS 7 网卡文件多为 `ifcfg-ens33`。

**验证方法**：`alias | grep net` 能列出该别名，执行 `net` 输出网卡配置内容；`unalias net` 取消后再执行则提示 command not found，说明别名只存在于已加载的 shell 会话中。

**实操验证**（A 级，已实操）：

```bash
alias net='cat /etc/hosts'
alias | grep "alias net"
```

```text
alias net='cat /etc/hosts'
```

> **易错点**：只 `alias` 不复载，新开终端就没有；写进 `~/.bashrc` 只对当前用户生效，全体用户要写 `/etc/profile`。
>
> 生产注意点：别把别名带进脚本——非交互 shell 默认不展开别名，脚本里老老实实写全命令更可靠。

---

### 题 4（练习）：系统密码忘记如何重置（CentOS 7）
{: .sec-prac}

> **答案**：利用单用户模式（救援模式）重置，步骤如下：
> 1. 启动到引导菜单，按 `e` 编辑启动项，在含 `UTF-8` 的内核行末追加 `init=/bin/bash`
> 2. `Ctrl + X` 真正进入单用户 shell
> 3. 重新挂载根目录为可读写：`mount -o remount,rw /`
> 4. 重置密码：`passwd root`，输入两遍新密码
> 5. 保留改动并退出：`touch /.autorelabel`（让 SELinux 重打标签），`exec /sbin/init`（等同于重启）

**解析**：单用户模式绕过登录认证直接拿到 root shell，是机房/控制台层面的"后门式"救援手段。为什么必须物理/控制台权限？因为整套流程发生在登录认证之前，等价于"绕过一切密码"——要是 SSH 也能做，服务器就没有安全可言了。云服务器需在云平台控制台的 VNC/串口操作，无法用普通 SSH。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
mount -o remount,rw /
passwd root
touch /.autorelabel
exec /sbin/init
```

```text
Enter new UNIX password:
Retype new UNIX password:
passwd: password updated successfully
```

> **易错点**：忘做 `mount -o remount,rw /`，根只读导致密码写不进；忘 `touch /.autorelabel` 可能在开启了 SELinux 的机器上无法登录；此操作需物理/控制台权限，SSH 不可用。

**验证方法**：`exec /sbin/init` 重启后用新口令能正常登录 root，即为重置成功；登录后 `getenforce` 确认 SELinux 状态，必要时检查 `/.autorelabel` 是否已生效清理。

---

## 本篇小结
{: .sec-sum}

这几道题串起来就是"服务器的身份信息怎么管"：

1. 三个核心配置文件：`/etc/hostname`（本机名）、`/etc/hosts`（IP↔主机名解析）、`/etc/fstab`（开机挂载），改动后都要有对应验证动作。
2. 运行级别 0–6：0 关机、1 单用户、3 多用户联网（默认）、5 图形、6 重启；CentOS 7 用 `multi-user.target`/`graphical.target`。
3. 改主机名：临时 `hostname` + 永久 `hostnamectl set-hostname`，并同步 `/etc/hosts`；`hostnamectl status` 可查看静态/瞬态/灵活三种主机名。
4. 永久变量：写 `/etc/profile` 或 `~/.bashrc` 再 `source`；`=` 两边无空格，`export` 才被子进程继承，调取用 `echo $变量名`。
5. 别名：`alias 名='命令'`，永久写 profile/`bashrc`；查看用 `alias`，取消用 `unalias`。
6. 忘密码：单用户模式（`init=/bin/bash` → `remount,rw /` → `passwd root` → `touch /.autorelabel`），须控制台权限。

---

## 知识点速记
{: .sec-chk}

考前扫一眼这张表就够了：

| 考点 | 关键文件/命令 | 一句话要点 |
| --- | --- | --- |
| 主机名 | /etc/hostname、hostnamectl set-hostname | 临时用 hostname，永久用 hostnamectl，改完同步 /etc/hosts |
| 本地解析 | /etc/hosts | IP 在前、主机名在后，优先级高于 DNS |
| 开机挂载 | /etc/fstab | 改完先 mount -a 验证，防止系统起不来 |
| 运行级别 | runlevel / systemctl get-default | 0 关机、1 单用户、3 默认、5 图形、6 重启 |
| 永久变量 | /etc/profile + source | 加 export 子进程才继承，等号两边不留空格 |
| 别名 | alias / unalias | 写 profile 才永久，查看用 alias，取消用 unalias |
| 忘记密码 | 单用户模式 | init=/bin/bash → remount,rw → passwd → autorelabel |


{% endraw %}
