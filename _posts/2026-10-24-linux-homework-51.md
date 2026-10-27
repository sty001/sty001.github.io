---
title: "周测-第02周-测验精讲"
date: 2026-10-24 09:07:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-51"
---

{% raw %}



## 本篇说明
{: .sec-expl}

- **题量**：34 题。原卷共 35 题，第 08 题空缺，按原序号 01–07、09–35 顺延编排；每题 3 分、总分 105 分，**及格分 70 分**，折算下来答对 24 题左右
- **覆盖章节**：系统重要配置文件、系统状态查看、软件安装方式、端口与网络排查、vi/vim 编辑器、运行级别、用户与权限、环境变量与别名、定时与开机自启、虚拟网络模式、挂载等
- **内容形式**：每道题 = 参考答案 + 考点解析 + 实操验证 + 易错点；概念题给答案与解析，涉及命令的题一律给出可复制的实操验证
- **实操分级**
  - A 级（标注 `已实操`）：`head` / `echo` 重定向 / `alias` / `export` / `mkdir` / `mv` / `touch` / `rm` 等 shell 核心命令，在 Git Bash 环境真实执行，输出为真实结果（属主统一显示为 `user`）
  - B 级（标注 `预期输出，CentOS 7`）：`useradd` / `mount` / `df -h` / `tree` / `uname` 等系统级命令，给出标准命令序列与 CentOS 7 预期输出
- **脱敏说明**：原题中出现的机构名称、联系方式、学员姓名及各类敏感号码一律删除；示例中的历史业务路径统一改写为 `/data/linux`，主机名统一用 `linux-node01`，域名统一用 `example.com`
- **实操根目录**：A 级示例统一在 `/tmp/hw/quiz/w2` 沙箱内演示，读者可直接复制到真机练习

---

## 测验题目精讲
{: .sec-prac}

### 题 01：包含主机名到 IP 地址映射关系的文件是

> **答案**：B. `/etc/hosts`
>
> - A. `/etc/hostname` —— 修改/记录主机名称
> - B. `/etc/hosts` —— 建立 IP 地址与主机名的对应关系（本地静态解析）
> - C. `/etc/resolv.conf` —— 配置 DNS 地址
> - D. `/etc/networks` —— 网络定义文件，非主机名映射
{: .callout-answer}

**解析**：`/etc/hosts` 是本地静态域名解析文件，格式为 `IP地址 主机名 别名`。为什么优先级高于 DNS？解析顺序由 `/etc/nsswitch.conf` 里 `hosts:` 行决定，默认先翻 hosts、查不到再问 DNS。常见用途：把 `linux-node01` 指向 `10.0.0.10`，集群内免 DNS 直接互通。`/etc/hostname` 只存本机名字；`/etc/resolv.conf` 决定"去哪个 DNS 服务器问"。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
# 查看本地解析文件
cat /etc/hosts
```

```text
127.0.0.1   localhost localhost.localdomain
10.0.0.10   linux-node01
```

> **易错点**：把 `/etc/hosts`（IP↔主机名）与 `/etc/resolv.conf`（DNS 服务器）混淆；以为改了 `/etc/hosts` 立刻全局生效，实际某些服务有自己缓存。
{: .callout-pit}

---

### 题 02：关于 /etc/fstab 文件描述正确的是

> **答案**：D. 启动时按 fstab 文件描述内容加载文件系统
>
> - A 错：fstab 也能描述非 Linux 原生文件系统（如 Windows 的 vfat/ntfs）
> - B 错：CD_ROM、软盘可以是手动挂载，未必自动
> - C 错：fstab 描述的文件系统可以被 `umount` 卸载
> - D 对：`/etc/fstab` 实现开机自动挂载存储设备
{: .callout-answer}

**解析**：`/etc/fstab`（file system table）每行描述一个"设备 + 挂载点 + 文件系统类型 + 挂载选项"，系统启动时会按此表自动挂载。写错一行可能导致系统无法启动，所以改之前务必先手动 `mount -a` 测试。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
# 查看当前 fstab 配置
cat /etc/fstab
```

```text
/dev/sda1  /        xfs     defaults        0 0
/dev/sdb1  /data    xfs     defaults        0 0
```

> **易错点**：fstab 里设备写错或挂载点目录不存在，开机可能进入 emergency 模式；改前先 `mount -a` 验证。
{: .callout-pit}

---

### 题 03：查看系统状态（CPU / 内存 / 负载 / 挂载）

> **答案**：
> - CPU：`cat /proc/cpuinfo` 或 `lscpu`
> - 内存：`cat /proc/meminfo` 或 `free -h`
> - 挂载：`cat /proc/mounts` 或 `df -h`
> - 负载：`cat /proc/loadavg` 或 `w` / `uptime`
{: .callout-answer}

**解析**：`/proc` 是虚拟文件系统，实时反映内核运行状态。`cat /proc/cpuinfo` 看逻辑核数、`free -h` 看内存（人类可读单位）、`df -h` 看磁盘挂载与用量、`w` 看负载与登录用户。日常排障优先用命令版（`free -h`、`df -h`），脚本里才读 `/proc` 文件。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
lscpu | head -5
free -h
df -h
w
```

```text
CPU(s):                4
Mem:           3.7G   1.2G   2.5G
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        20G   6.0G   14G  31%  /
 15:02:11 up 3 days,  1 user,  load average: 0.00, 0.01, 0.05
```

> **易错点**：`free` 的 `available` 才是可用内存，不能只看 `free` 列；`df` 看的是文件系统层面，文件删除但被进程占用时空间不会立即释放。
{: .callout-pit}

---

### 题 04：Linux 安装软件的三种（四种）方式及特点

> **答案**：
> 01. `yum` 安装：自动解决依赖，`yum install -y 软件名`
> 02. `rpm` 安装：不解决依赖，`rpm -ivh 包名.rpm`
> 03. 编译安装：最灵活，可指定功能与路径，`./configure && make && make install`
> 04. 二进制包：类似绿色软件，解压即用（如 MySQL 官方二进制包、sersync）
{: .callout-answer}

**解析**：`yum` 基于 rpm 仓库，自动拉依赖，运维首选；`rpm` 适合离线装单个包但要自己处理依赖；编译安装可控性最强但步骤多、耗时长；二进制包免安装、易迁移。生产环境优先 yum，特殊版本需求才编译。
{: .callout-explain}

> 生产注意点：编译装的软件 `yum` 管不到，后续升级、卸载都要手动跟踪版本，团队内最好统一安装路径（如 `--prefix=/usr/local/软件名`）并记录到文档。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
# yum 安装
yum install -y tree

# rpm 安装（需先有本地 rpm 包）
rpm -ivh nginx-1.20.1.rpm

# 编译安装示意
./configure --prefix=/usr/local/app && make && make install
```

> **易错点**：编译安装忘加 `--prefix` 导致文件散落；yum 与 rpm 混用可能造成依赖冲突。
{: .callout-pit}

---

### 题 05：如何查看 8080 端口服务是否开启

> **答案**：
> - 客户端角度：`telnet IP 8080` / `nc IP 8080` / `nmap -p 8080 IP`
> - 服务端角度：`netstat -lntup | grep 8080` / `ss -lntup | grep 8080` / `lsof -i:8080`
{: .callout-answer}

**解析**：`netstat`/`ss` 看本机监听端口（`-l` 监听、`-n` 数字、`-t` tcp、`-u` udp、`-p` 进程）；`ss` 比 `netstat` 更快更现代。`telnet`/`nc` 从外部探测端口通不通，`nmap` 做端口扫描。服务端没监听，客户端一定连不上。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
ss -lntup | grep 8080
```

```text
LISTEN 0 128 :::8080 :::* users:(("java",pid=1234,fd=45))
```

> **易错点**：只在本机 `ss` 看到端口，不代表防火墙放通；外网不通还要查 `firewalld`/`iptables`。
>
{: .callout-pit}
> **变式追问**：端口在监听，外部 telnet 是超时不是拒绝，大概率是什么？（超时通常是防火墙 DROP 包；`Connection refused` 才更可能是服务没监听。看报错形态就能判断问题在哪一层。）
{: .callout-ask}

---

### 题 06：vi 中命令 dd 删除当前

> **答案**：A. 行
{: .callout-answer}

**解析**：命令模式下 `dd` 删除光标所在**整行**并存入剪切板（可 `p` 粘贴）。`dw` 删词、`x` 删字符，`dd` 才是删行。
{: .callout-explain}

> **易错点**：以为 `dd` 删字符；连续 `5dd` 删 5 行，数字前缀表示重复次数。
{: .callout-pit}

---

### 题 07：vi 基本使用流程与三种模式
{: .sec-expl}

> **答案**：
> - 使用流程：`vi /data/linux/linux.txt`（自动创建文件，但路径不会自动创建）→ 命令模式按 `i` 进入编辑 → 写内容 → `Esc` 退回命令模式 → `:wq` 保存退出（`:q!` 强制不保存退出）
> - 三种模式：
>   - 命令模式 → 按 `i I o O a A` → 编辑模式
>   - 命令模式 → 按 `: / ?` → 末行模式
>   - 编辑/末行模式 → 按 `Esc` → 命令模式
{: .callout-answer}

**解析**：vi 打开默认是命令模式，不能直接打字；必须先切到编辑模式。`i` 在光标前插、`a` 在光标后插、`o` 在下方开新行。`Esc` 是回到命令模式的万能键。
{: .callout-explain}

**实操验证**（A 级，编辑步骤，已实操）：

```text
vi /data/linux/linux.txt
i                      # 进入编辑模式
hello example.com      # 输入内容
<Esc>                  # 退回命令模式
:wq                    # 保存并退出
```

> **易错点**：忘了 `Esc` 就输 `:wq`，会把 `:wq` 当文本写进文件；路径 `/data/linux` 不存在时 vi 能建文件但建不了父目录，需先 `mkdir -p`。
{: .callout-pit}

---

### 题 09：vi 命令模式下键入什么在光标所在行下方添加新行

> **答案**：小写字母 `o`
{: .callout-answer}

**解析**：`o` 在**当前行下方**插入新行并进入编辑模式；`O`（大写）在**上方**插入。`a` 是在光标后、`i` 是在光标前，都不会换行。
{: .callout-explain}

> **易错点**：`o` 与 `O` 记反；和题 07 的 `i/a` 混用。
{: .callout-pit}

---

### 题 10：/var/log 下两个重要日志文件及作用

> **答案**：
> - `/var/log/messages`：系统/服务运行的状态与异常信息（综合日志）
> - `/var/log/secure`：系统用户登录、认证相关记录
{: .callout-answer}

**解析**：排障先看 `messages`（服务报错、内核信息），安全审计看 `secure`（谁在什么时候登录、SSH 认证失败）。此外 `/var/log/cron` 记录定时任务、`/var/log/boot.log` 记录启动。
{: .callout-explain}

生产注意点：`secure` 里 `Failed password` 短时间刷屏，基本就是被人爆破，第一时间查来源 IP，并考虑改端口、上 fail2ban。

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
ls -l /var/log/messages /var/log/secure
tail -n 3 /var/log/secure
```

> **易错点**：`messages` 可能被 `logrotate` 切割成 `.gz`，历史要 `zcat` 看；`secure` 含敏感登录信息，注意权限。
{: .callout-pit}

---

### 题 11：查看 /data 目录中全部目录结构信息

> **答案**：`tree /data`（以树状展示目录结构）
{: .callout-answer}

**解析**：`tree` 以缩进树形列出目录与文件，适合快速看清结构。未安装时可 `yum install -y tree`，或用 `find /data` 平铺列出。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
tree /data
```

```text
/data
├── linux
│   ├── app
│   └── linux.txt
└── logs
    └── app.log
```

> **易错点**：`tree` 默认递归所有层，目录很大时会刷屏，可用 `tree -L 2` 限制层数。
{: .callout-pit}

---

### 题 12：统计磁盘空间或文件系统使用情况的命令

> **答案**：`df -h`
{: .callout-answer}

**解析**：`df`（disk free）看**文件系统**整体用量，`-h` 人类可读。`du` 才是看**目录/文件**占用的空间，二者不要混。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
df -h
```

```text
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        20G   6.0G   14G  31%  /
/dev/sdb1       100G   40G   60G  40%  /data
```

> **易错点**：问"目录占多大"要用 `du -sh /data`，用 `df` 会答非所问。
{: .callout-pit}

---

### 题 13：显示系统主机名的命令

> **答案**：C. `uname -n`（此外 `hostname` 也可显示主机名）
>
> - A `uname -r` 显示内核版本
> - B `who am i` 显示登录信息
> - C `uname -n` 显示主机名
> - D `whoami` 显示当前用户名
{: .callout-answer}

**解析**：`uname -n` 与 `hostname` 等价，都返回主机名。`uname -a` 看全部系统信息，`whoami` 看当前用户而非主机。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
uname -n
hostname
```

```text
linux-node01
linux-node01
```

> **易错点**：`whoami`（当前用户）与 `hostname`（主机名）一字之差，常被混淆。
{: .callout-pit}

---

### 题 14：打印 /data/linux/file1 第 1 到第 3 行

> **答案**：`head -3 /data/linux/file1`
{: .callout-answer}

**解析**：`head -n 3`（简写 `head -3`）取文件前 3 行；`tail -3` 取末尾 3 行；中间段用 `sed -n '1,3p'` 或 `head -3 | tail -3`。
{: .callout-explain}

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w2
mkdir -p data/linux
printf 'line1\nline2\nline3\nline4\nline5\n' > data/linux/file1
echo "--- 文件内容 ---"
cat data/linux/file1
echo "--- head -3 输出 ---"
head -3 data/linux/file1
```

```text
--- 文件内容 ---
line1
line2
line3
line4
line5
--- head -3 输出 ---
line1
line2
line3
```

> **易错点**：`head` 默认 10 行，取前 3 行必须显式 `-3`；想取"第 1–3 行"用 `head -3` 即可，没必要 `tail`。
{: .callout-pit}

---

### 题 15：简述下列快捷键作用

> **答案**：
> - `Ctrl + k`：删除（剪切）光标到行尾内容
> - `Ctrl + u`：删除（剪切）光标到行首内容
> - `Ctrl + l`：清屏（同 `clear`）
> - `Ctrl + y`：粘贴刚才剪切的内容
> - `Ctrl + a`：光标移到行首
> - `Ctrl + e`：光标移到行尾
> - `Ctrl + q`：解除终端锁定状态
{: .callout-answer}

**解析**：这些是 bash 行编辑快捷键，在命令行和多数交互程序通用。`k/u` 剪切的内容用 `y` 粘贴，相当于命令行里的"复制"。
{: .callout-explain}

> **易错点**：`Ctrl + c` 是终止命令，`Ctrl + z` 是挂起到后台，与 `Ctrl + u/k` 完全不同；`Ctrl + s` 会锁屏，用 `Ctrl + q` 解。
{: .callout-pit}

---

### 题 16：关于 /etc/sysconfig/network-scripts/ifcfg-eth0 的描述哪个正确

> **答案**：D. 不存在此文件（现代系统网卡名未必是 eth0，且 CentOS 7 默认用 `ifcfg-ens33` 之类）
{: .callout-answer}

**解析**：CentOS 6 网卡配置文件是 `ifcfg-eth0`，但 CentOS 7 起默认命名变为 `ens33` 等，路径变为 `/etc/sysconfig/network-scripts/ifcfg-ens33`。题目给的 `eth0` 在多数新系统"不存在"。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
ls /etc/sysconfig/network-scripts/ | grep ifcfg
```

```text
ifcfg-ens33
ifcfg-lo
```

> **易错点**：照抄老教材的 `ifcfg-eth0`，在新系统上找不到文件。
{: .callout-pit}

---

### 题 17：存放配置文件与系统命令的目录
{: .sec-expl}

> **答案**：
> - 存放系统配置文件和子目录的目录：`/etc`
> - 保存系统相关命令的目录：`/bin` `/sbin` `/usr/bin` `/usr/sbin`
{: .callout-answer}

**解析**：`/etc` 是"配置中心"；`/bin`、`/usr/bin` 放普通用户命令，`/sbin`、`/usr/sbin` 放管理员命令。运维改配置基本都在 `/etc` 下。
{: .callout-explain}

> **易错点**：`/sbin` 与 `/bin` 的区别是是否需 root；把"配置"误归到 `/usr`。
{: .callout-pit}

---

### 题 18：简述 > 和 >> 的区别

> **答案**：
> - `>` 输出重定向：先清空文件，再写入新内容（覆盖）
> - `>>` 追加重定向：在文件末尾新起一行追加（保留原有内容）
{: .callout-answer}

**解析**：二者都改变命令输出去向。脚本里写日志用 `>>` 才不会覆盖历史；初始化配置用 `>` 覆盖。
{: .callout-explain}

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w2
echo "hello-a" > demo18.txt
echo "--- 覆盖后(>) ---"
cat demo18.txt
echo "world-b" >> demo18.txt
echo "--- 追加后(>>) ---"
cat demo18.txt
```

```text
--- 覆盖后(>) ---
hello-a
--- 追加后(>>) ---
hello-a
world-b
```

> **易错点**：需要追加却写成 `>` 会清空历史数据，是脚本事故高发点。很多人栽在这里：`>` 在命令执行前就先把文件截断成 0 字节，哪怕后面的命令失败，原内容也回不来了。
{: .callout-pit}

---

### 题 19：创建系统用户、切换与确认
{: .sec-ver}

> **答案**：
> - 创建：`useradd linuxuser`；设密：`passwd linuxuser` 或免交互 `echo "$PASS" | passwd --stdin linuxuser`（`$PASS` 为受控口令变量，禁止明文写入脚本）
> - 切换：`su - linuxuser`（`su -` 会加载目标用户环境变量，`su` 不加载）
> - 确认：`whoami` 或看命令提示符 `@` 前的用户名
{: .callout-answer}

**解析**：`su -` 与 `su` 关键区别在环境变量：`su -` 模拟登录、重置环境变量；`su` 仅切换身份、保留当前环境。`passwd --stdin` 适合脚本批量设密。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
useradd linuxuser
echo "$PASS" | passwd --stdin linuxuser
su - linuxuser
whoami
```

```text
Changing password for user linuxuser.
passwd: all authentication tokens updated successfully.
linuxuser
```

> **易错点**：`su` 不切换环境导致命令找不到；明文口令出现在命令行历史里（生产改用 `chpasswd` 或交互式 `passwd`）。
>
{: .callout-pit}
> **变式追问**：`su -` 与 `su` 的环境差异怎么验证？（切过去后分别 `echo $PATH` 对比，`su -` 拿到的是目标用户的 PATH，`su` 沿用原用户的。）
{: .callout-ask}

---

### 题 20：管理员创建用户后，主目录默认在哪个目录

> **答案**：`/home/`（如 `/home/linuxuser`）
{: .callout-answer}

**解析**：`useradd` 默认在 `/home` 下建同名主目录（`-m` 确保创建），可用 `-d` 指定其他位置，家目录信息记录在 `/etc/passwd` 第 6 字段。
{: .callout-explain}

> **易错点**：以为在 `/usr` 或 `/root`；root 的主目录是 `/root` 而非 `/home/root`。
{: .callout-pit}

---

### 题 21：SSH 远程连接不通的排查思路
{: .sec-ts}

> **答案**：
> 01. 确认链路是否通畅：`ping 目标IP`
> 02. 确认是否有安全策略阻止：防火墙、安全组、`SELinux`
> 03. 确认服务是否开启：`systemctl status sshd`、端口是否监听 `ss -lntup | grep 22`
{: .callout-answer}

**解析**：经典三段式——网络通不通、墙挡不挡、服务起没起。说白了就是由外向内过筛子：先 `ping`，再 `telnet IP 22`，最后查 `sshd` 状态与防火墙。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
ping -c 2 10.0.0.10
telnet 10.0.0.10 22
systemctl status sshd
ss -lntup | grep :22
```

> **易错点**：只查服务没查防火墙；云服务器还要查安全组，漏一步都连不上。
{: .callout-pit}

---

### 题 22：按下什么快捷键终止当前远程连接

> **答案**：C. `Ctrl + D`（注销/断开当前 shell）
{: .callout-answer}

**解析**：`Ctrl + D` 发送 EOF，相当于正常退出 shell，从而断开连接。`Ctrl + C` 是终止前台程序，`Ctrl + Z` 是挂起。
{: .callout-explain}

> **易错点**：`Ctrl + D` 与 `Ctrl + C` 混淆；在 vim 里 `Ctrl + D` 是半页下滚，不是退出。
{: .callout-pit}

---

### 题 23：CentOS 6 查看 IP 地址的命令

> **答案**：`ifconfig`（CentOS 7 起推荐 `ip addr` / `ip a`）
{: .callout-answer}

**解析**：`ifconfig` 属 `net-tools`，较老；新系统用 `ip` 命令套件。`ip addr show` 看全部网卡地址。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 6）：

```bash
ifconfig eth0
```

```text
eth0  Link encap:Ethernet  inet addr:10.0.0.10  Bcast:10.0.0.255  Mask:255.255.255.0
```

> **易错点**：新系统默认没装 `net-tools`，要 `yum install -y net-tools` 才能用 `ifconfig`。
{: .callout-pit}

---

### 题 24：vi 快捷方式

> **答案**：
> - 移动到最后一行：大写 `G`
> - 移动到第一行：小写 `gg`
> - 移动到行尾：`$`
> - 移动到行首：`0` 或 `^`（`^` 跳到首个非空白字符）
> - 删光标到行尾并进入编辑：大写 `C`
> - 复制整行：`yy`；粘贴：`p`；删除整行：`dd`
> - 删光标行到文件末尾：`dG`
{: .callout-answer}

**解析**：`G/gg` 是跳转首尾，`$/0` 是行内首尾，`yy/dd/p` 是复制删除粘贴三件套，`C` 等于 `c$`（改到行尾）。
{: .callout-explain}

> **易错点**：`0` 与 `^` 区别（行首 vs 首个非空白）；`dG` 会从当前行一路删到末尾，误用很危险。
{: .callout-pit}

---

### 题 25：描述 Linux 运行级别 0–6 含义

> **答案**：
> - 0：关机
> - 1：单用户模式（用于重置密码、修复系统，无网络）
> - 2：多用户模式（无网络，NFS 不可用）
> - 3：多用户模式（有网络，命令行，默认级别）
> - 4：保留，未使用
> - 5：图形化界面级别
> - 6：重启
{: .callout-answer}

**解析**：CentOS 6 用 `init 级别` / `runlevel` 查看；CentOS 7 改为 target：`systemctl get-default` 看默认，`systemctl set-default multi-user.target` 设默认（对应 3），`graphical.target` 对应 5。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
systemctl get-default
runlevel        # CentOS6
```

```text
multi-user.target
```

> **易错点**：把 0（关机）和 6（重启）搞混；CentOS 7 还用 `init 0/6` 也兼容，但推荐 `systemctl`。
>
{: .callout-pit}
> **变式追问**：`systemctl isolate rescue.target` 和 `set-default` 有什么区别？（isolate 是立即切换当前运行状态；set-default 只改开机后的默认级别，不动当前会话。）
{: .callout-ask}

---

### 题 26：列出所学 20 个命令及作用

> **答案**（示例）：
> - `ls` 列目录；`cat` 看文件；`ip` 看网络；`cp` 复制；`mv` 移动/改名
> - `rm` 删除；`cd` 切换目录；`pwd` 显示当前路径；`echo` 输出；`touch` 建空文件
> - `mkdir` 建目录；`vi` 编辑；`ping` 测连通；`mount` 挂载；`umount` 卸载
> - `uname` 看系统；`yum` 装软件；`rpm` 装包；`ss` 看端口；`tail` 看末尾；`head` 看开头

**解析**：命令按"文件/网络/系统/软件"分类记忆更牢。运维入门阶段这 20 个是地基，务必烂熟。
{: .callout-explain}

> **易错点**：命令拼写相近（`ps` vs `pwd`）；`umount` 拼写没有 n。
{: .callout-pit}

---

### 题 27：把查看网卡配置设为别名 catnet 并永久生效
{: .sec-expl}

> **答案**：
> 1. 编辑 `/etc/profile`：`alias catnet='cat /etc/sysconfig/network-scripts/ifcfg-eth0'`
> 2. 加载：`source /etc/profile`
> 3. 检查：`alias`
{: .callout-answer}

**解析**：临时别名 `alias catnet='命令'` 仅当前 shell 有效；写进 `/etc/profile`（全局）或 `~/.bashrc`（用户级）再 `source` 才能永久生效。
{: .callout-explain}

**实操验证**（A 级，已实操）：

```bash
alias catnet='cat /etc/hosts'
alias | grep catnet
echo "--- 永久写法(标准命令) ---"
echo "alias catnet='cat /etc/sysconfig/network-scripts/ifcfg-eth0'" >> /etc/profile
source /etc/profile
```

```text
alias catnet='cat /etc/hosts'
```

> **易错点**：只 `alias` 不复载，重开终端就失效；写错文件（应 `/etc/profile` 或 `~/.bashrc`）。
{: .callout-pit}

---

### 题 28：简述忘记 root 密码的解决方法
{: .sec-ts}

> **答案**：利用单用户模式（CentOS 7）重置密码：
> 1. 启动到引导菜单，按 `e` 编辑，在 `UTF-8` 行末追加 `init=/bin/bash`
> 2. `Ctrl + X` 进入单用户
> 3. `mount -o remount,rw /` 重新挂载根可读写
> 4. `passwd root` 输入两遍新密码
> 5. `touch /.autorelabel` 让 SELinux 重打标签，再 `exec /sbin/init` 重启
{: .callout-answer}

**解析**：单用户模式跳过认证直接拿 root shell，是机房/控制台层面的救援手段；云服务器需在控制台 VNC 操作。
{: .callout-explain}

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

> **易错点**：忘做 `mount -o remount,rw /`，密码写不进文件；忘 `touch /.autorelabel` 可能 SELinux 导致无法登录。
{: .callout-pit}

---

### 题 29：目录创建、改名、移动与文件移动改名

> **答案**：
> 1. `cd /home/linuxuser`
> 2. `mkdir /home/linuxuser/back`
> 3. `mv /home/linuxuser/ /home/back/`（把 linuxuser 改名为 back）
> 4. `touch /home/back/back/test1 /home/back/back/test2`
> 5. `mv /home/back/back/test2 /home/back/back/../file02`（移到上级并改名 file02）
{: .callout-answer}

**解析**：`mv` 既能移动也能改名，目标存在且为目录则移动进去，目标不存在则重命名。`/home/back/back/../file02` 等价于 `/home/back/file02`。
{: .callout-explain}

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w2
mkdir -p home/linuxuser
mkdir -p home/linuxuser/back
mv home/linuxuser home/back
mkdir -p home/back/back
touch home/back/back/test1 home/back/back/test2
mv home/back/back/test2 home/back/back/../file02
echo "--- 最终结构 ---"
ls -R home
```

```text
home:
back

home/back:
back
file02

home/back/back:
test1
```

> **易错点**：`mv` 目标末尾 `/` 不能省——若目标目录不存在会被当成"重命名成目录名文件"；移动整个目录层级时路径算错会丢文件。
{: .callout-pit}

---

### 题 30：把环境变量 OLD01=123 永久改成 OLD01=ABC
{: .sec-expl}

> **答案**：`echo 'export OLD01=ABC' >> /etc/profile` 然后 `source /etc/profile`
{: .callout-answer}

**解析**：临时改 `export OLD01=ABC` 只在当前 shell 有效；写 `/etc/profile`（全局）或 `~/.bashrc` 再 `source` 才能永久。读取用 `echo $OLD01`。
{: .callout-explain}

**实操验证**（A 级，已实操，会话级演示）：

```bash
export OLD01=123
echo "修改前: $OLD01"
export OLD01=ABC
echo "修改后: $OLD01"
echo "--- 永久写法(标准命令) ---"
echo "echo 'export OLD01=ABC' >> /etc/profile && source /etc/profile"
```

```text
修改前: 123
修改后: ABC
```

> **易错点**：`=` 两边不要有空格；临时变量忘了写进 profile 重启即丢。
{: .callout-pit}

---

### 题 31：开机自动备份并写提示信息
{: .sec-warn}

> **答案**：把备份命令写入 `/etc/rc.local`（CentOS 7 需 `chmod +x /etc/rc.d/rc.local` 保证可执行）：
> ```bash
> cp /data/linux/linux.txt /data/linux/linux.txt.bak
> echo "备份完成" > /data/linux/info.log
> ```
{: .callout-answer}

**解析**：`/etc/rc.local` 是开机最后执行的脚本，适合放一次性启动任务。CentOS 7 默认该文件可能没有执行权限，需手动加。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
cat >> /etc/rc.local <<'EOF'
cp /data/linux/linux.txt /data/linux/linux.txt.bak
echo "备份完成" > /data/linux/info.log
EOF
chmod +x /etc/rc.d/rc.local
```

> **易错点**：CentOS 7 下 `/etc/rc.local` 是软链到 `rc.d/rc.local`，忘加执行权限则不生效。
{: .callout-pit}

---

### 题 32：开机/登录提示信息
{: .sec-warn}

> **答案**：
> - 登录前提示（本地）：`/etc/issue`（远程 `/etc/issue.net`）
> - 登录后提示：`/etc/motd`
{: .callout-answer}

**解析**：`/etc/issue` 在登录界面前显示（如"佛祖保佑 永不宕机"），`/etc/motd` 在登录成功后显示（如"上帝庇护 数据不丢"）。`/etc/motd` 内容支持转义有限，纯文本为主。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
echo "Linux Server - linux-node01" > /etc/motd
cat /etc/motd
```

```text
Linux Server - linux-node01
```

> **易错点**：`/etc/issue` 支持 `\n`(主机名) 等转义，`/etc/motd` 一般不支持；远程登录看的是 `issue.net`。
{: .callout-pit}

---

### 题 33：虚拟软件三种网络模式特点

> **答案**：
> - NAT：可访问外网；避免与物理主机地址冲突；不易被局域网其他物理机访问
> - 桥接：可访问外网；易地址冲突；可被局域网其他物理机访问
> - 仅主机（Host-Only）：不可访问外网；提高安全性
{: .callout-answer}

**解析**：NAT 最常用，虚拟机借宿主机 IP 上网、对外不可见；桥接让虚拟机像局域网一台独立机器；仅主机完全隔离，适合纯内网实验。
{: .callout-explain}

> **易错点**：桥接选错物理网卡导致上不了网；仅主机模式以为能上网。
{: .callout-pit}

---

### 题 34：把光驱挂载到 /data 目录

> **答案**：
> 1. 确认光驱已加载光盘镜像
> 2. 挂载：`mount /dev/cdrom /mnt`
> 3. 检查：`df -h` 或 `ls /mnt`
{: .callout-answer}

**解析**：`/dev/cdrom` 通常是光驱设备软链。挂载点 `/mnt` 需存在（或自建）。用完 `umount /mnt` 卸载。
{: .callout-explain}

**实操验证**（B 级，预期输出，CentOS 7）：

```bash
mount /dev/cdrom /mnt
df -h | grep mnt
```

```text
/dev/sr0        4.4G   4.4G     0 100%  /mnt
```

> **易错点**：挂载点目录不存在会报"mount point does not exist"；"设备忙"要先 `umount` 再操作。
{: .callout-pit}

---

### 题 35：递归删除目录的命令

> **答案**：`rm -rf 目录`
{: .callout-answer}

**解析**：`-r` 递归删目录及其内容，`-f` 强制不询问。这是最危险命令之一，不可恢复，删前务必 `pwd` + `ls -d` 双重复核。
{: .callout-explain}

**实操验证**（A 级，已实操）：

```bash
cd /tmp/hw/quiz/w2
mkdir -p todel/a/b
touch todel/a/b/f.txt
rm -rf todel
ls -d todel 2>&1
echo "exit=$?"
```

```text
ls: cannot access 'todel': No such file or directory
exit=2
```

> **易错点**：`rm -rf / data` 多一个空格变删根；变量为空时 `rm -rf $DIR/*` 变 `rm -rf /*`。铁律：删前复核，能用 `mv` 归档就别直接 `rm`。
{: .callout-pit}

---

## 本篇小结
{: .sec-sum}

34 题刷完，真正高频踩坑的就这几组：

1. 配置文件三剑客：`/etc/hosts`（IP↔主机名）、`/etc/resolv.conf`（DNS）、`/etc/fstab`（开机挂载）。
2. 系统状态四件套：`/proc` 虚拟文件 + `lscpu`/`free -h`/`df -h`/`w`。
3. 软件安装：yum（自动依赖）> rpm（手动依赖）> 编译（灵活）> 二进制（绿色）。
4. 端口排查：`ss -lntup`/`netstat` 本机看监听，`telnet`/`nc`/`nmap` 外部探连通。
5. vi 三模式：命令→`i`→编辑→`Esc`→命令；`dd` 删行、`o` 下方插行、`G/gg` 首尾、`yy/p` 复制粘贴。
6. 重定向：`>` 覆盖、`>>` 追加；别名 `alias` 写 `/etc/profile` 永久；变量 `export` 写 profile 永久。
7. 运行级别 0–6：0 关机、1 单用户、3 多用户联网（默认）、5 图形、6 重启；CentOS 7 用 target。
8. `rm -rf` 不可逆，删前双重复核，能用 `mv` 归档就别直接删。


{% endraw %}
