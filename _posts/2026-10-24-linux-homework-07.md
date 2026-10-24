---
title: "day7 运行级别与别名作业实操"
date: 2026-10-24 09:51:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
本篇对应课程第 7 天（操作命令与目录结构）的课后作业：光驱开机自动挂载、系统 7 个运行级别作用与 CentOS 7 设置方法、单用户模式重置密码、永久设置 rm 别名。四条作业全部完成——系统级操作给出 CentOS 7 标准命令序列与预期输出，别名部分在 Git Bash 中做了四组真实对比实验。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：alias 相关机制（定义、生效条件、脚本失效、rc 文件加载）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：fstab 配置、运行级别、单用户模式等系统级操作给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明在真机执行方式。

实操目录统一用 `/tmp/hw` 下的子目录。本文 A 级输出均在 Git Bash（bash 5.3）中真实执行，本地用户名已按脱敏要求替换为 `user`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 如何实现光驱开机自动挂载 | B 级（fstab 配置 + 预期输出） |
| 题 2 | 总结系统 7 个运行级别作用，CentOS 7 查看与永久设置方法 | B 级（预期输出） |
| 题 3 | 利用单用户模式重置密码（CentOS 7） | B 级（预期输出） |
| 题 4 | 如何永久设置别名（如 rm 别名） | A 级（alias 机制全链路真跑） |

## 题 1：如何实现光驱开机自动挂载

**考察点**：`/etc/fstab` 的作用与六列格式；光驱设备文件系统类型 `iso9660`；配置后不重启的验证方法；现代桌面环境自动挂载的实现者（udisks）。

**实现思路**：开机自动挂载靠 `/etc/fstab`——系统启动时按这个文件的内容自动挂载存储设备。光驱的配置行与普通磁盘相同，只是文件系统类型写 `iso9660`。配置后必须 `mount -a` 验证，写错时还能在系统里修复。

### 实现步骤（预期输出，CentOS 7）

```bash
ls -l /dev/cdrom                        # 第一步：确认光驱设备文件（软链接，指向 /dev/sr0）
mkdir -p /mnt                           # 第二步：准备挂载点（/mnt 默认存在，确认即可）
cp /etc/fstab /etc/fstab.bak            # 第三步：修改前先备份
vi /etc/fstab                           # 第四步：写入光驱配置行
```

```ini
/dev/cdrom  /mnt  iso9660  defaults  0 0
```

```bash
mount -a                                # 第五步：按 fstab 挂载所有未挂载设备（不重启验证）
ls /mnt                                 # 第六步：看到光盘内容即挂载成功
```

输出：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# mount -a
mount: /dev/sr0 is write-protected, mounting read-only
[root@linux-node1 ~]# ls /mnt
CentOS_BuildTag  EULA  images    LiveOS  repodata              RPM-GPG-KEY-CentOS-Testing-7
EFI              GPL   isolinux  Packages  RPM-GPG-KEY-CentOS-7  TRANS.TBL
```

六列含义对照本行：设备 `/dev/cdrom`、挂载点 `/mnt`、文件系统类型 `iso9660`（光盘标准文件系统）、挂载参数 `defaults`、dump 写 `0`（不备份）、fsck 写 `0`（光驱不参与开机检查）。

> **原理：** 光驱挂载时提示 `write-protected, mounting read-only` 是正常现象——光盘是只读介质，内核自动以只读方式挂载，这正是 `iso9660` 文件系统的特性。

### 补充：udisks 是什么

课程问题"实现自动挂载的特殊服务是什么"，标准答案是 **fstab**（开机自动挂载）。在现代图形桌面环境（GNOME、KDE）中，还有另一条路径：**udisks/udisks2** 守护进程。插入 U 盘或光盘后，udisks 通过监听内核设备事件自动挂载到 `/media/用户名/卷标` 下，拔除时自动卸载。两者区别：

| 机制 | 触发方式 | 挂载点 | 适用场景 |
| --- | --- | --- | --- |
| `/etc/fstab` | 开机时由 systemd 读取 | 配置文件中指定（如 `/mnt`） | 服务器固定磁盘、光驱，重启后仍在 |
| udisks / udisks2 | 插入设备时由守护进程响应 | `/media/用户名/卷标` | 桌面环境可移动设备，即插即用 |
| autofs | 访问挂载点时按需挂载 | 任意配置目录 | NFS 等网络文件系统，闲置自动卸载 |

> **说明：** CentOS 7 最小化安装（服务器常用）不带图形桌面，也就没有 udisks，自动挂载完全依赖 fstab；这也是服务器运维以 fstab 为主的原因。

**验证方法**：`mount -a` 无报错（光驱只读提示属正常），`ls /mnt` 能看到光盘内容，`df -h` 中能看到 `/dev/sr0` 挂在 `/mnt`，即证明配置正确；重启后再次 `df -h` 仍在，证明开机自动挂载生效。

> **易错点**：一是文件系统类型漏填或填错（正确值 `iso9660`，不是 `auto` 也不是 `xfs`）；二是挂载点目录不存在；三是改完 fstab 不执行 `mount -a` 验证直接重启，配置写错可能导致系统无法启动；四是光驱行 fsck 写成 `1` 或 `2`，开机磁盘检查会卡在光驱上。

> **参见**：系统目录结构与挂载

## 题 2：总结系统 7 个运行级别作用（CentOS 7 查看与永久设置）

**考察点**：7 个运行级别各自的用途；CentOS 7 中运行级别与 target 的对应关系；查看当前级别与永久设置默认级别的命令。

**实现思路**：运行级别决定系统启动哪些服务（类比 Windows 的安全模式）。先记 7 个级别的作用表，再掌握 CentOS 7 的 target 对照，最后落到三条命令：`runlevel` 查看、`init N` 临时切换、`systemctl set-default` 永久设置。

### 7 个运行级别作用表

| 级别 | 说明 | 网络 |
| --- | --- | --- |
| 0 | 系统的关机级别，`init 0` 进入关机状态 | — |
| 1 | 系统的单用户模式，用于修复系统或重置密码 | 没有网络 |
| 2 | 系统的多用户模式 | 没有网络 |
| 3 | 系统的多用户模式，正常系统运行级别 | 有网络 |
| 4 | 预留级别 | — |
| 5 | 图形化界面级别 | — |
| 6 | 系统的重启级别 | — |

### CentOS 7 的 target 对照关系

CentOS 7 起数字级别只是 systemd 的兼容入口，实际由 target 承载：

| 级别 | 说明 | 对应 target |
| --- | --- | --- |
| 0 | 关机级别 | `poweroff.target` |
| 1 | 单用户模式，修复系统或重置密码 | `rescue.target` |
| 2 | 多用户模式，无网络 | `multi-user.target` |
| 3 | 多用户模式，正常运行级别 | `multi-user.target` |
| 4 | 预留级别 | `multi-user.target` |
| 5 | 图形化界面级别 | `graphical.target` |
| 6 | 重启级别 | `reboot.target` |

> **注意：** 2/3/4 级在 CentOS 7 中全部映射到 `multi-user.target`，这是 systemd 的简化设计，并非遗漏。`/etc/inittab` 在 CentOS 7 中已不再生效。

### 查看当前运行级别（预期输出，CentOS 7）

```bash
runlevel
```

输出：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# runlevel
N 3
```

`N` 表示"之前的运行级别未知"（启动后从未切换过），`3` 表示当前在多用户字符模式。也可以用 `systemctl get-default` 查看默认 target。

### 临时切换运行级别（预期输出，CentOS 7）

```bash
init 3                                  # 切到字符多用户模式
init 5                                  # 切到图形模式
init 0                                  # 关机
init 6                                  # 重启
```

等价的 systemd 写法是 `systemctl isolate multi-user.target`。临时切换重启后失效。

### 永久设置默认运行级别（预期输出，CentOS 7）

```bash
systemctl set-default multi-user.target
systemctl get-default
```

输出：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# systemctl set-default multi-user.target
Removed symlink /etc/systemd/system/default.target.
Created symlink from /etc/systemd/system/default.target to /usr/lib/systemd/system/multi-user.target.
[root@linux-node1 ~]# systemctl get-default
multi-user.target
```

原理：`set-default` 修改的是 `/etc/systemd/system/default.target` 这个软链接指向，`get-default` 读取该链接验证。想恢复图形界面设为 `graphical.target` 即可。

**验证方法**：`systemctl get-default` 输出与设置的目标一致；重启后执行 `runlevel` 第二个数字为 3（或对应 target 行为），证明永久设置生效。

> **易错点**：一是把 CentOS 6 的习惯带到 CentOS 7——改 `/etc/inittab` 在 CentOS 7 上完全无效；二是分不清临时（`init N`，重启失效）与永久（`set-default`，重启仍在）；三是忘记 `rescue.target` 就是单用户模式，排查系统故障时不知从哪进。

> **参见**：重要系统文件与运行级别

## 题 3：利用单用户模式重置密码（CentOS 7）

**考察点**：单用户模式（运行级别 1，`rescue.target`）不需要密码即可获得 root 权限，是忘记 root 密码时的标准修复手段。

**实现思路**：CentOS 7 开机引导界面按 `e` 编辑内核启动参数，在 `linux16` 行末尾追加 `init=/bin/sh`，直接以单用户 shell 启动；此时根文件系统默认只读，先 `remount` 为读写，再 `passwd` 重置，最后处理 SELinux 重打标签并重启。

### 实现步骤（预期输出，CentOS 7）

```bash
# 第一步：重启系统，在 grub 引导菜单界面（倒计时内）按 e 进入编辑模式
# 第二步：找到以 linux16 开头（或 linux 开头）的内核引导行，光标移到行尾
# 第三步：行尾追加 init=/bin/sh（空格分隔）
# 第四步：按 Ctrl + x 启动，系统直接进入单用户 shell（无登录验证）
```

```bash
mount -o remount,rw /                   # 第五步：根文件系统默认只读，重新挂载为读写
passwd                                  # 第六步：输入两次新密码
touch /.autorelabel                     # 第七步：通知 SELinux 重启时重打文件标签
exec /sbin/init                         # 第八步：重新初始化系统（等价重启）
```

输出：

```console
（预期输出，CentOS 7）
sh-4.2# mount -o remount,rw /
sh-4.2# passwd
Changing password for user root.
New password:
Retype new password:
passwd: all authentication tokens updated successfully.
sh-4.2# touch /.autorelabel
sh-4.2# exec /sbin/init
```

> **说明：** 第七步 `touch /.autorelabel` 不能省——SELinux 开启时，跳过正常启动流程会导致 `/etc/shadow` 等文件的安全上下文异常，重启后可能无法登录；创建该文件让系统重启时自动重打标签（耗时几分钟，属正常现象）。

### 三种进入单用户 / 救援模式的方式对比

| 方式 | 操作 | 特点 |
| --- | --- | --- |
| `init=/bin/sh` | grub 界面按 `e`，内核行尾追加 | 最直接，拿到的是裸 shell，需手动 remount |
| `rd.break` | grab 界面按 `e`，内核行尾追加 | 进入 initramfs 阶段中断，改完需 `chroot /sysroot` |
| `rescue.target` | grub 界面选 rescue 启动项 | 图形化问答流程，自动挂载根为 rw，最省事 |

**验证方法**：重启后用新密码能以 root 登录；若做过 `touch /.autorelabel`，首次重启后等待标签重建完成再登录，`ls -Z /etc/shadow` 安全上下文正常，即证明修复完整。

> **易错点**：一是忘记 `mount -o remount,rw /`，只读文件系统下 `passwd` 报错；二是忘记 `touch /.autorelabel`，SELinux 上下文异常导致登录故障；三是 `init=/bin/sh` 加错了行（必须加在内核引导行 `linux16` 行尾，不能加在 `initrd` 行）。物理机能接触到的机器均可此法重置，因此机房物理安全与 grub 密码也是生产规范的一部分。

> **参见**：重要系统文件与运行级别、系统安装部署

## 题 4：如何永久设置别名（如 rm 别名）

**考察点**：`alias` 的定义与查看；别名生效的条件（交互式 shell、定义之后读取的行）；让别名每次登录都生效的完整做法（写入 `~/.bashrc`）；别名失效的三种方法。

**实现思路**：先用真跑实验讲清"别名什么时候生效、什么时候不生效"，再给出写入 `~/.bashrc` 的标准做法，最后演示 rm 别名防误删的经典案例。

### alias 定义与查看（已实操）

语法：`alias 别名名称='命令信息'`。查看当前所有别名用 `alias`。

```bash
cd /tmp/hw/day7
echo "NET-TYPE=Ethernet" > net.txt
alias
```

输出：

```console
$ alias
$
```

Git Bash 默认没有预定义别名，输出为空。CentOS 7 默认预定义了一批（预期输出，CentOS 7）：

```console
（预期输出，CentOS 7）
[root@linux-node1 ~]# alias
alias cp='cp -i'
alias grep='grep --color=auto'
alias ll='ls -l --color=auto'
alias ls='ls --color=auto'
alias mv='mv -i'
alias rm='rm -i'
```

定义一个简化查询网卡配置的别名并立即使用：

```bash
alias catnet="cat net.txt"
catnet
```

在交互式 shell 中的真实输出：

```console
（已实操，交互式 shell）
$ alias catnet="cat net.txt"
$ catnet
NET-TYPE=Ethernet
```

### 实验一：别名在交互式 shell 中定义即生效（已实操）

```bash
cd /tmp/hw/day7
alias catnet="cat net.txt"
catnet
```

输出：

```console
（已实操）
NET-TYPE=Ethernet
```

### 实验二：别名在脚本中默认不生效（已实操）

把同样的三行写进脚本执行：

```bash
printf '#!/bin/bash\nalias catnet="cat net.txt"\ncatnet\n' > demo-script.sh
chmod +x demo-script.sh
./demo-script.sh
```

输出：

```console
（已实操）
$ ./demo-script.sh
./demo-script.sh: line 3: catnet: command not found
```

> **原理：** 脚本是非交互 shell，不加载 `/etc/bashrc` 与 `~/.bashrc`，且默认关闭别名展开（`expand_aliases` 为 off）。这就是"ssh 登录定义了别名，脚本里却用不了"的原因。

### 实验三：脚本中开启 expand_aliases 后生效（已实操）

```bash
printf '#!/bin/bash\nshopt -s expand_aliases\nalias catnet="cat net.txt"\ncatnet\n' > demo-script2.sh
chmod +x demo-script2.sh
./demo-script2.sh
```

输出：

```console
（已实操）
$ ./demo-script2.sh
NET-TYPE=Ethernet
```

### 实验四：rm 别名防误删（已实操）

把 `rm` 别名成一句提醒，危险命令就被"截胡"：

```bash
alias rm='echo rm command is weixian,not use'
rm -rf /tmp/hw/day7/
```

输出：

```console
（已实操）
$ rm -rf /tmp/hw/day7/
rm command is weixian,not use -rf /tmp/hw/day7/
```

真实删除被阻止。取消别名后恢复真实 `rm`：

```bash
unalias rm
touch keep.txt
rm keep.txt
ls keep.txt
```

输出：

```console
（已实操）
$ unalias rm
$ touch keep.txt
$ rm keep.txt
$ ls keep.txt 2>&1
ls: cannot access 'keep.txt': No such file or directory
```

别名失效的三种方法：

| 方法 | 示例 | 说明 |
| --- | --- | --- |
| 取消别名 | `unalias rm` | 当前会话内永久取消 |
| 反斜杠（撬棍） | `\rm -rf /data` | 只绕过这一次 |
| 绝对路径 | `/usr/bin/rm -rf /backup` | 绕开别名与 PATH 顺序 |

### 永久生效：写入 ~/.bashrc（已实操演示机制）

临时定义的别名退出登录即失效。永久做法是写入用户家目录的 `~/.bashrc`（别名与函数放 bashrc 系，环境变量放 profile 系），写入后 `source` 立即在当前终端生效，新开终端自动加载。

真机标准操作（B 级）：

```bash
echo "alias rm='echo rm command is weixian,not use'" >> ~/.bashrc
source ~/.bashrc                        # 当前终端立即生效
alias | grep rm                         # 验证别名已在列表中
```

本环境用演示文件完整复现这套机制（已实操）：

```bash
echo 'alias catnet="cat /tmp/hw/day7/net.txt"' > bashrc.demo
cat bashrc.demo
```

输出：

```console
（已实操）
$ cat bashrc.demo
alias catnet="cat /tmp/hw/day7/net.txt"
```

加载后别名生效（相当于真机上 `source ~/.bashrc`）：

```bash
source bashrc.demo
catnet
```

输出：

```console
（已实操）
$ source bashrc.demo
$ catnet
NET-TYPE=Ethernet
```

新开一个交互 shell 时自动加载该 rc 文件，不 source 也生效（相当于真机上重新登录）：

```bash
bash --rcfile /tmp/hw/day7/bashrc.demo -i
```

输出：

```console
（已实操）
$ catnet
NET-TYPE=Ethernet
```

**验证方法**：`alias | grep 别名名` 能看到定义；`type 别名名` 显示 `aliased to`；退出重新登录后别名仍在。真机上执行 `grep alias ~/.bashrc` 能查到写入的行，即证明永久配置到位。

> **易错点**：一是别名写在 `/etc/profile` 里——环境变量该放 profile，别名函数该放 bashrc，混写会因 shell 类型（登录 / 非登录）不同而"有时生效有时不生效"；二是期望别名在脚本里生效——非交互 shell 不展开别名，脚本里要么写全命令，要么 `shopt -s expand_aliases`；三是给 `rm` 配了防误删别名后，自己做批量删除时也被拦住，记得用 `\rm` 或 `unalias rm` 临时绕过。

> **参见**：重要系统文件与运行级别

## 自测

1. 光驱开机自动挂载的 fstab 配置行怎么写？文件系统类型一列填什么？
2. CentOS 7 中运行级别 3 对应哪个 target？永久设置为字符界面用什么命令？
3. 单用户模式重置密码有哪三个容易漏的步骤？
4. 为什么 `alias ll='ls -l'` 在交互终端有效，写进脚本却报 `command not found`？怎么让脚本里也生效？

> **参考答案：** 1. `/dev/cdrom /mnt iso9660 defaults 0 0`，类型填 `iso9660`。2. `multi-user.target`，`systemctl set-default multi-user.target`。3. `mount -o remount,rw /`、`touch /.autorelabel`、`init=/bin/sh` 要加在内核引导行行尾。4. 脚本是非交互 shell，默认不展开别名；加 `shopt -s expand_aliases` 可开启。

## 本篇小结

1. 开机自动挂载靠 `/etc/fstab`，光驱配置行为 `/dev/cdrom /mnt iso9660 defaults 0 0`，类型必须是 `iso9660`，fsck 写 `0`；配完 `mount -a` 验证再重启。
2. 现代桌面环境的即插即用自动挂载由 udisks 守护进程完成（挂到 `/media/用户名/卷标`）；服务器最小化安装没有 udisks，以 fstab 为准。
3. 7 个运行级别：0 关机、1 单用户（修复 / 重置密码）、2 多用户无网络、3 多用户有网络（正常级别）、4 预留、5 图形、6 重启；CentOS 7 用 target 承载，2/3/4 都映射到 `multi-user.target`。
4. 查看级别 `runlevel` / `systemctl get-default`，临时切换 `init N`，永久设置 `systemctl set-default`；`/etc/inittab` 在 CentOS 7 已废弃。
5. 单用户模式重置密码：grub 按 `e` → 内核行尾加 `init=/bin/sh` → `Ctrl+x` → `remount,rw /` → `passwd` → `touch /.autorelabel` → 重启。
6. 别名在交互式 shell 中定义即生效、脚本中默认不生效（`shopt -s expand_aliases` 可补救）；永久生效写入 `~/.bashrc` 并 `source`；失效三法：`unalias`、反斜杠、绝对路径。
{% endraw %}
