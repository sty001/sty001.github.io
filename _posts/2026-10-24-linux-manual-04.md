---
title: "04-排错手册"
date: 2026-10-24 10:45:00 +0800
categories: [软件, Linux, 00-知识手册]
tags: [Linux, 00-知识手册, 知识手册]
slug: "linux-manual-04"
---

{% raw %}

本手册按「症状 → 原因 → 排查 → 解决 → 验证 → 预防」组织，覆盖系统启动与登录、磁盘与文件系统、网络、权限与用户、服务与应用、性能六大类，共 60 余张故障卡，供实战查阅。文中示例 IP 均为私有网段占位地址，口令以 `<your-password>` 占位，请按实际环境替换。

## 排错方法论

排错不是碰运气，而是一条可复用的闭环流程：**先复现 → 看日志 → 缩小范围 → 验证假设 → 修复 → 复盘**。每一步都有明确的产出，跳过任何一步都容易误判。

| 阶段 | 要回答的问题 | 关键动作与命令 |
| --- | --- | --- |
| 先复现 | 故障是否稳定出现？什么条件下触发？ | 记录时间点、操作路径、报错原文；用 `date` 对齐日志时间线 |
| 看日志 | 系统当时说了什么？ | `journalctl -xe`、`journalctl -u 服务名`、`tail -f /var/log/messages`、`/var/log/secure`、应用自身日志 |
| 缩小范围 | 是哪一层、哪个组件的问题？ | 自底向上：硬件 → 网络 → 系统 → 服务 → 应用；每层确认无误再进下一层 |
| 验证假设 | 我猜的原因是否成立？ | 构造最小测试：本机 `curl 127.0.0.1:端口`、对端 `nc -zv IP 端口`、`dig 域名` |
| 修复 | 改动是否可控、可回滚？ | 先备份配置（`cp file file.bak`）；一次只改一处；改完重载服务 |
| 复盘 | 下次如何更早发现、不再发生？ | 补监控项与告警阈值；写进运维手册；评估是否需容量或架构调整 |

三条贯穿全流程的原则：

1. **保留现场**：不要急于重启。重启会丢失内存中的进程状态、网络连接与部分内核日志，先抓 `ps`、`ss`、`dmesg`、`free` 的快照。
2. **一次只改一处**：同时改多个配置，即使修好了也不知道是哪一处生效，下次仍会踩坑；改坏了更难回滚。
3. **区分现象与原因**：`502` 是现象，`php-fpm` 挂了才是原因；`Permission denied` 是现象，父目录缺 `x` 权限才是原因。502 与 504 都是 nginx 报的，指向完全不同：502 是后端连不上（进程挂了、地址端口不对），504 是连上了但后端太慢（超时）。说白了，502 找后端进程，504 找慢逻辑，误判 502 去调超时参数，白忙一场。

快速定位的四条主干链路：

- **服务访问异常**：本机 `curl` → 端口 `ss -lntp` → 后端进程 `systemctl status` → 错误日志 `tail`
- **网络不通**：先分清物理层还是配置层——`ip link` 看 `state UP` 与 `NO-CARRIER`，链路没起，后面全是白忙；链路正常再按 `ping 网关`（二层）→ `ping 外网 IP`（路由）→ `dig 域名`（DNS）走
- **磁盘满**：block 满不一定真满，先 `df -i` 确认 inode 再 du——海量小文件场景 du 逐层查什么都看不出；确认是 block 后走 `df -h` → `du -sh`（定位目录）→ `lsof +L1`（未释放句柄）
- **系统卡顿**：`w`（负载）→ `top`（CPU / 内存）→ `vmstat 1`（swap / IO）→ `iostat -x 1`（磁盘）

---

## 一、系统启动与登录

### 系统启动卡住无法进入登录界面

**现象**：开机后停在进度条、`A start job is running for ...` 提示、或直接进入 `emergency mode` / `Give root password for maintenance`。

**可能原因**：

1. `/etc/fstab` 中有错误的挂载项，系统等待超时（按概率最高）；
2. 根文件系统损坏，或磁盘未被识别（盘序变化、RAID 卡未初始化）；
3. 关键服务启动失败，如 `systemd` unit 语法错误；
4. 内核升级后 `initramfs` 未重建，找不到根设备；
5. 文件系统存在不一致，开机 `fsck` 卡住或需要手动确认。

**排查步骤**：

1. 看屏幕提示的具体挂载点或 unit 名称：

```bash
journalctl -xb | grep -iE "fail|error|timeout|mount"
```

服务启动失败类的报错，`journalctl -xe` 末尾几行往往直接写着原因，只 grep 关键词会漏掉上下文。常见误判：把 fstab 超时当成系统坏了，其实只是某块盘没到，补 `nofail` 就能起来。

2. 进入 emergency 后根分区通常是只读的，先确认挂载状态：

```bash
mount | grep ' / '
```

3. 检查 fstab 中每一列的设备是否存在：

```bash
blkid
ls -l /dev/disk/by-uuid/
cat /etc/fstab
```

4. 若怀疑文件系统损坏，先只读检查（卸载状态或救援环境下）：

```bash
xfs_repair -n /dev/sdb1       # xfs 先用 -n 只检查
fsck -n /dev/sdb1             # ext 系列
```

**解决方式**：重新挂载根为可写后修正 fstab，把不存在的项注释掉，非系统盘补 `nofail`：

```bash
mount -o remount,rw /
cp /etc/fstab /etc/fstab.bak
vim /etc/fstab                # 注释错误行，或改为 UUID=xxx ... defaults,nofail 0 0
mount -a                      # 验证无报错
```

文件系统确有损坏时，在救援环境下修复（**先备份重要数据**）：

```bash
xfs_repair /dev/sdb1
fsck -y /dev/sdb1
```

**验证**：`mount -a` 无输出；`findmnt` 能看到预期挂载点；`reboot` 后能正常进入登录界面。

**预防**：fstab 中设备列一律用 UUID；非系统盘加 `nofail` 挂载选项；改 fstab 前先 `cp` 备份并 `mount -a` 验证；接新盘后先 `lsblk -f` 核对。

---

### GRUB 引导损坏进入 grub rescue

**现象**：开机进入 `grub rescue>` 提示符，或报 `error: no such partition`、`error: file '/grub2/i386-pc/normal.mod' not found`。

常见误判：grub rescue 不一定是引导坏了，先检查 BIOS 里的启动盘顺序是否被改动、硬盘有没有被识别，盘序漂移同样会进 rescue，别急着重装引导。

**可能原因**：

1. 引导记录被覆盖（如重装 Windows、误写磁盘前 512 字节）；
2. `/boot` 分区被误删或文件系统损坏；
3. 磁盘顺序变化导致 GRUB 找不到原分区；
4. `grub.cfg` 配置文件丢失或路径错误；
5. 在 UEFI 机器上误装了 BIOS 模式引导（或反之）。

**排查步骤**：

1. 在 `grub rescue>` 下列出可用分区：

```bash
ls
ls (hd0,msdos1)/boot/grub2
```

2. 用光盘 / U 盘进入救援模式，确认原系统分区：

```bash
lsblk -f
blkid
```

3. 挂载原系统根分区并 chroot：

```bash
mkdir -p /mnt/sysroot
mount /dev/mapper/rl-root /mnt/sysroot
mount /dev/sda1 /mnt/sysroot/boot
mount --bind /dev  /mnt/sysroot/dev
mount --bind /proc /mnt/sysroot/proc
mount --bind /sys  /mnt/sysroot/sys
chroot /mnt/sysroot
```

4. 确认 grub 包与配置是否存在：

```bash
rpm -q grub2 grub2-efi 2>/dev/null
ls /boot/grub2/grub.cfg /boot/efi/EFI/*/grub.cfg 2>/dev/null
```

**解决方式**：区分 BIOS 与 UEFI 两种引导方式重装引导。

BIOS（Legacy）模式：

```bash
grub2-install /dev/sda
grub2-mkconfig -o /boot/grub2/grub.cfg
```

UEFI 模式：

```bash
dnf reinstall -y grub2-efi shim
grub2-mkconfig -o /boot/efi/EFI/rocky/grub.cfg
```

**验证**：`exit` 退出 chroot，`reboot` 拔掉救援介质后能正常进入 GRUB 菜单并启动系统。

**预防**：保留一份系统救援镜像；`/boot` 单独分区时不要随意调整；做磁盘操作前用 `dd` 备份 MBR（`dd if=/dev/sda of=/root/mbr.bak bs=512 count=1`）。

---

### 忘记 root 密码需要重置

**现象**：无法用 root 登录，物理控制台或远程管理卡（BMC / iDRAC / IPMI）可用，但没有可用口令。

**可能原因**：

1. root 口令遗失或交接文档缺失；
2. root 账号被 `passwd -l` 锁定；
3. `/etc/shadow` 中密码字段异常；
4. PAM / `securetty` 限制导致 root 无法从当前终端登录；
5. SELinux 上下文不匹配导致改密后仍无法登录。

**排查步骤**：

1. 重启系统，在 GRUB 菜单按 `e` 进入编辑界面。
2. 找到以 `linux` / `linuxefi` 开头的行，在行尾追加 `rd.break`（RHEL 系推荐）或 `init=/bin/bash`。
3. 按 `Ctrl + x` 启动，进入 `switch_root` 提示符。
4. 确认根分区当前是只读挂载：

```bash
mount | grep sysroot
```

**解决方式**：以 `rd.break` 为例的完整流程：

```bash
mount -o remount,rw /sysroot
chroot /sysroot
passwd root                   # 输入两次新口令
touch /.autorelabel           # SELinux 开启时必须执行，否则重启后无法登录
exit
reboot
```

若系统未启用 SELinux（`/etc/selinux/config` 中 `SELINUX=disabled`），可省略 `touch /.autorelabel`。

**验证**：重启后用新口令登录成功；`passwd -S root` 显示为已设置口令且未锁定。

常见误判：改完密码登录失败，先确认输的确实是 root 口令、键盘布局没切错；再确认改的是 root 而不是同名前缀的普通账号。

**预防**：口令统一存入受控的密码库；保留一个具备 `sudo` 权限的普通运维账号；定期验证备份口令有效性。

---

### SSH 登录提示 Connection refused

**现象**：`ssh: connect to host 10.0.0.7 port 22: Connection refused`。

refused 与 timed out 是两种病，一步就能分诊：refused 说明包到了对端、对方明确拒绝（服务没起或防火墙 REJECT），timed out 说明包被中途丢弃（DROP、安全组、链路断）。报 refused 还去查网络链路，方向就错了。

**可能原因**：

1. 目标主机 `sshd` 服务未启动或已崩溃；
2. SSH 端口被修改，客户端仍连默认 22；
3. `sshd` 只监听了特定地址，来源 IP 不在其中；
4. 防火墙（firewalld / iptables）以 `REJECT` 动作拦截；
5. `sshd` 配置语法错误导致服务启动失败。

**排查步骤**：

1. 在服务端确认监听端口与进程：

```bash
ss -lntp | grep sshd
systemctl status sshd
```

2. 检查配置语法与端口设置：

```bash
sshd -t
grep -E "^(Port|ListenAddress|PermitRootLogin)" /etc/ssh/sshd_config
```

3. 确认防火墙放行：

```bash
firewall-cmd --list-all
```

4. 看服务启动失败的具体原因：

```bash
journalctl -u sshd -n 50 --no-pager
```

**解决方式**：启动服务并放行端口：

```bash
systemctl enable --now sshd
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload
```

若端口已改为 52113：

```bash
firewall-cmd --permanent --add-port=52113/tcp
firewall-cmd --reload
ssh -p 52113 user@10.0.0.7
```

**验证**：服务端 `ss -lntp | grep sshd` 有输出；从客户端 `nc -zv 10.0.0.7 22` 返回 `succeeded`；能正常登录。

**预防**：把 `sshd` 设为开机自启；改 SSH 端口时保留当前会话不退出，先放行新端口再测试；用配置管理工具统一下发 `sshd_config`。

---

### SSH 连接超时无响应

**现象**：`ssh: connect to host 10.0.0.7 port 22: Connection timed out`，无任何提示后卡住几十秒。注意 ssh 客户端默认没有超时，卡住时先 `Ctrl+c`，用 `ssh -o ConnectTimeout=5` 复测，把「慢」和「不通」分开。

一步验证：从中间节点分段 `ping`、`nc -zv`，先定位是哪一段丢包再谈放行策略；两端各抓一次包（对端 `tcpdump` 看请求到没到）是最快的分界手段。

**可能原因**：

1. 中间网络安全设备（安全组、交换机 ACL）丢弃了数据包；
2. 目标主机未开机、网卡未接、IP 不存在；
3. 服务端防火墙以 `DROP` 动作丢包（与 `REJECT` 的区别是不回任何响应）；
4. 路由不可达，本机没有到目标网段的路径；
5. 目标主机开启了网络隔离策略或 `hosts.deny` 限制。

**排查步骤**：

1. 从近到远逐段测试连通性：

```bash
ping -c 4 10.0.0.7
ping -c 4 10.0.0.1              # 网关
ip route get 10.0.0.7           # 看系统选路结果
```

2. 用 `mtr` 定位卡在哪一跳：

```bash
mtr -n 10.0.0.7
```

3. 探测端口是否可达：

```bash
nc -zv 10.0.0.7 22
curl -v telnet://10.0.0.7:22
```

4. 服务端抓包确认请求是否到达：

```bash
tcpdump -i eth0 host 10.0.0.100 and port 22
```

**解决方式**：根据断点位置处理。安全组问题需放通策略；防火墙 `DROP` 改为放行：

```bash
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.100" service name="ssh" accept'
firewall-cmd --reload
```

若确认是服务端未收到包（抓包无输出），问题在网络链路或上级安全策略，需联系网络侧放通。

**验证**：`nc -zv 10.0.0.7 22` 成功；`ssh user@10.0.0.7` 能进入密码提示。

**预防**：新机器交付时同步申请安全组规则；在跳板机上保留常用测试脚本；关键链路部署拨测告警。

---

### SSH 登录特别慢

**现象**：连接后要等十几秒甚至半分钟才出现密码提示或进入 shell；输入命令有卡顿感。

一次真实排错：新装机 SSH 登录固定等 30 秒，`ssh -vvv` 卡在 `gssapi-with-mic` 阶段，内网又没有 Kerberos 环境，关掉 `GSSAPIAuthentication` 后秒连。卡顿阶段不同，病因不同，`-vvv` 的输出别跳过。

**可能原因**：

1. `UseDNS yes` 让 `sshd` 对客户端 IP 做反向解析，DNS 不可达时超时；
2. `GSSAPIAuthentication yes` 触发 Kerberos 认证等待；
3. 服务端 `/etc/resolv.conf` 中配置了不可达的 DNS；
4. 客户端密钥过多，逐个尝试认证耗时；
5. 服务端 PAM 模块（如 `pam_systemd`、`sssd`）响应慢。

**排查步骤**：

1. 量化到底慢在哪一段：

```bash
time ssh user@10.0.0.7 exit
ssh -vvv user@10.0.0.7         # 观察卡在哪个阶段
```

2. 检查相关配置：

```bash
grep -E "UseDNS|GSSAPIAuthentication" /etc/ssh/sshd_config
cat /etc/resolv.conf
```

3. 测试 DNS 响应：

```bash
time dig @223.5.5.5 example.com
```

**解决方式**：关闭 DNS 反解与 GSSAPI 认证：

```bash
sed -i 's/^#\?UseDNS.*/UseDNS no/' /etc/ssh/sshd_config
sed -i 's/^#\?GSSAPIAuthentication.*/GSSAPIAuthentication no/' /etc/ssh/sshd_config
sshd -t && systemctl reload sshd
```

客户端密钥过多时使用：

```bash
ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 user@10.0.0.7
```

**验证**：`time ssh user@10.0.0.7 exit` 耗时降到 1 秒以内。

**预防**：把 `UseDNS no`、`GSSAPIAuthentication no` 写进初始化模板；`resolv.conf` 加 `options timeout:2 attempts:2`；客户端在 `~/.ssh/config` 中用 `IdentityFile` 明确指定密钥。

---

### su 切换用户失败或环境变量异常

**现象**：`su: Authentication failure`；或切换成功后命令找不到、`echo $HOME` 仍是原用户家目录。

**可能原因**：

1. 口令输入错误（概率最高）；
2. 目标账号被锁定（`passwd -l`）或 shell 为 `/sbin/nologin`；
3. 使用了 `su 用户` 而非 `su - 用户`，环境变量未完整切换；
4. `/etc/pam.d/su` 中限制了 `wheel` 组；
5. `/bin/su` 权限被改动，缺少 SUID 位。

**排查步骤**：

1. 确认账号状态与 shell：

```bash
passwd -S 目标用户
grep 目标用户 /etc/passwd
```

2. 对比两种写法的环境差异：

```bash
su  用户 -c 'echo $PATH; echo $HOME'
su - 用户 -c 'echo $PATH; echo $HOME'
```

3. 检查 su 的 PAM 限制与文件权限：

```bash
grep -E "wheel|pam_wheel" /etc/pam.d/su
ls -l /bin/su
```

**解决方式**：口令问题直接用 root 重置；需要完整环境时用 `su -`：

```bash
su - 目标用户
```

若 `pam_wheel` 要求 wheel 组，把用户加入该组（注意用 `-a` 追加）：

```bash
usermod -aG wheel 目标用户
```

`su` 缺 SUID 位时修复（正常情况下应为 `-rwsr-xr-x`）：

```bash
chmod u+s /bin/su
```

**验证**：`su - 目标用户` 成功，`echo $HOME`、`echo $PATH` 显示目标用户的环境，`whoami` 返回目标用户。

一步验证：`su - 用户 -c 'id'` 能跑通，说明账号与认证本身没问题，问题多半出在交互环境的初始化文件上。

**预防**：日常规范统一使用 `su -`；禁止直接编辑 `/etc/passwd`；关键文件权限纳入基线巡检。

---

### sudo 提权报 is not in the sudoers file

**现象**：`username is not in the sudoers file. This incident will be reported.`

**可能原因**：

1. 该用户未被加入 `sudoers` 或 `wheel` 组（概率最高）；
2. `sudoers` 规则中用户名拼写错误；
3. 改动写在 `/etc/sudoers` 之外，但目录未被 `includedir` 引入；
4. 用户属于组，但组规则写成了 `%group ALL=(ALL) NOPASSWD: ALL` 之外的形式且语法有误；
5. `/etc/sudoers` 权限或属主异常导致规则未被加载。

**排查步骤**：

1. 检查当前生效的权限（**必须用 `visudo` 修改**，切勿直接编辑）：

```bash
sudo -l -U 用户名
visudo -c
```

2. 确认 sudoers 主文件与 drop-in 目录：

```bash
ls -l /etc/sudoers
ls -l /etc/sudoers.d/
grep -E "includedir|wheel" /etc/sudoers
```

3. 看拒绝时的日志：

```bash
journalctl -n 30 | grep sudo
```

**解决方式**：用 `visudo` 添加规则（自带语法检查，避免改坏后全员无法提权）：

```bash
visudo
```

用户级规则：

```bash
用户名  ALL=(ALL)       ALL
```

组级规则：

```bash
%wheel  ALL=(ALL)       ALL
```

免密规则（仅限受控场景）：

```bash
用户名  ALL=(ALL)       NOPASSWD: ALL
```

加组方式（同样要 `-a` 追加）：

```bash
usermod -aG wheel 用户名
```

**验证**：重新登录后 `sudo -l -U 用户名` 列出规则；`sudo -i` 或 `sudo 命令` 能正常执行。

**预防**：所有 sudo 授权通过 `/etc/sudoers.d/` 下的独立文件管理，便于审计与回滚；每次改动先 `visudo -c`；在控制台保留一个 root 应急通道。

命名坑：`includedir` 默认跳过文件名带 `.` 或以 `~` 结尾的文件，`ops.conf.bak`、`ops.conf.old` 这类备份文件留在目录里不会生效也不会报错，但会误导排查——以为规则在而实际没加载。

---

### 单用户模式改完密码仍无法登录

**现象**：通过 `rd.break` 或 `init 1` 重置口令后，重启输入新口令仍提示 `Login incorrect`。

**可能原因**：

1. 未执行 `touch /.autorelabel`，SELinux 文件上下文未重建（概率最高）；
2. 重置的是其他账号或拼写错误；
3. `/etc/shadow` 被设置了 `i` 不可变属性，改动实际未写入；
4. 根分区仍是只读挂载，改动丢失；
5. PAM 配置异常或 `/etc/nologin` 文件存在。

**排查步骤**：

1. 确认根分区当时是否可写：

```bash
mount | grep ' / '
```

2. 检查关键文件属性与上下文：

```bash
lsattr /etc/passwd /etc/shadow
ls -Z /etc/shadow
getenforce
```

3. 确认口令字段是否真的写入：

```bash
grep '^root:' /etc/shadow | cut -c1-30
```

**解决方式**：重新进入救援环境，确保可写后重置并打上重打标标记：

```bash
mount -o remount,rw /sysroot
chroot /sysroot
chattr -i /etc/passwd /etc/shadow      # 若带 i 属性先解除
passwd root
touch /.autorelabel
exit
reboot
```

若 `/etc/nologin` 存在会阻止普通用户登录，删除即可：

```bash
rm -f /etc/nologin
```

**验证**：重启后（首次重启因重打标耗时较长）用新口令登录成功；`getenforce` 正常，`ls -Z /etc/shadow` 显示 `shadow_t` 上下文。

一步验证：reboot 前先 `ls -l /.autorelabel` 确认标记文件真的存在，不存在就再 touch 一次，漏标等于白改。

**预防**：把 `touch /.autorelabel` 写进密码重置操作单；日常不要给 `/etc/passwd`、`/etc/shadow` 加 `i` 属性；重打标期间不要强制断电。

---

## 二、磁盘与文件系统

### 磁盘空间满 No space left on device

**现象**：写入文件时报 `No space left on device`；`df -h` 显示 `Use%` 为 100%。

**可能原因**：

1. 业务数据或日志持续增长，未做清理与轮转（概率最高）；
2. 大文件（备份包、core dump、压缩包）遗留在数据盘；
3. 已删除文件仍被进程占用，空间未释放；
4. inode 耗尽（见下一条卡片）；
5. 分区规划不合理，如 `/var` 与 `/` 共用且容量偏小。

**排查步骤**：

1. 确认是哪个文件系统满了，同时看 block 与 inode：

```bash
df -h
df -i
```

2. 从根开始逐层定位大目录：

```bash
du -sh --max-depth=1 /  2>/dev/null | sort -hr | head -20
du -sh --max-depth=1 /var/log/* 2>/dev/null | sort -hr | head
```

3. 找出超过指定体积的大文件：

```bash
find / -type f -size +500M -exec ls -lh {} + 2>/dev/null | sort -k5 -hr | head
```

4. 检查是否有已删除但未释放的文件：

```bash
lsof +L1
lsof | grep deleted
```

**解决方式**：按定位结果清理。日志类优先用轮转而非直接删除正在写入的文件：

```bash
logrotate -f /etc/logrotate.d/nginx
```

确认无用的大文件删除：

```bash
rm -f /data/old_backup.tar.gz
```

若空间被已删除文件占用，不重启释放：

```bash
> /proc/<PID>/fd/<FD号>
```

**验证**：`df -h` 中该文件系统的 `Use%` 明显下降；业务写入恢复正常。

生产上栽过的一例：备份任务把数据盘写到 100%，`du` 逐层查只凑出几个 G，`lsof +L1` 才发现 nginx 还持有一个已删除的 300G 日志，`kill -USR1` 重开日志文件，空间立刻回落。

**预防**：为 `/var/log` 与数据目录配置 logrotate 与定期清理脚本；对磁盘使用率配置监控告警（建议 80% 预警、90% 严重）；容量规划预留 30% 余量。

---

### inode 耗尽导致无法创建文件

**现象**：`df -h` 显示仍有大量剩余空间，但创建文件报 `No space left on device`；`df -i` 显示 `IUse%` 为 100%。

常见误判：`df -h` 还剩很多空间就不信真的满了。block 与 inode 是两个独立计数器，海量小文件场景 inode 先耗尽，以 `df -i` 为准。

**可能原因**：

1. 产生了海量小文件（邮件队列、会话文件、缓存碎片）（概率最高）；
2. `postfix` 关闭后定时任务输出堆积在 `/var/spool/postfix/maildrop/`；
3. 应用日志按请求切分，未做归并；
4. 容器内临时文件未清理；
5. 文件系统格式化时 inode 数量设置过少。

**排查步骤**：

1. 确认 inode 使用率：

```bash
df -i
```

2. 统计各目录的条目数量，定位小文件聚集地：

```bash
for d in /*; do echo "$(find $d -xdev -type f 2>/dev/null | wc -l) $d"; done | sort -rn | head
```

3. 检查邮件队列目录：

```bash
ls /var/spool/postfix/maildrop/ | wc -l
du -sh /var/spool/mail/root
```

**解决方式**：清理小文件并关闭定时任务的邮件输出：

```bash
find /var/spool/postfix/maildrop/ -type f -delete
systemctl start postfix
```

在 crontab 顶部关闭邮件发送（更彻底）：

```bash
MAILTO=""
* * * * * /server/scripts/backup.sh &>/dev/null
```

**验证**：`df -i` 中 `IUse%` 下降；`touch /data/testfile` 能正常创建。

一次真实案例：邮件队列目录堆了 200 万个小文件把 inode 打满，根因是 crontab 里一条任务忘了重定向输出，每分钟产出一封邮件进 maildrop。清掉文件、补上 `MAILTO=""`，问题再没复发。

**预防**：定时任务统一加 `&>/dev/null` 或设 `MAILTO=""`；为 inode 使用率配置监控；应用侧避免"一请求一文件"的设计。

---

### 删除文件后磁盘空间没有释放

**现象**：`rm` 删除大日志文件后，`du -sh` 统计已变小，但 `df -h` 显示使用率没有变化。

**可能原因**：

1. 文件被删除但仍有进程持有其文件描述符，内核未释放 block（概率最高）；
2. 删除的是硬链接之一，还有其他链接指向同一 inode；
3. 文件位于已挂载的其他文件系统，被挂载点遮挡；
4. 快照或 LVM 快照占用了空间；
5. `df` 缓存未刷新（极少见）。

**排查步骤**：

1. 找出被删除但仍被打开的文件：

```bash
lsof +L1
lsof | grep deleted | head
```

2. 查看某进程持有的文件描述符：

```bash
ls -l /proc/<PID>/fd
```

3. 确认是否存在其他硬链接：

```bash
ls -li 文件名
```

4. 检查挂载点是否遮挡了原数据：

```bash
findmnt
```

**解决方式**：三种方式，按影响从小到大选择：

```bash
# a. 通知进程重新打开日志（推荐，影响最小）
kill -USR1 <PID>              # nginx 等支持 USR1 重开日志
logrotate -f /etc/logrotate.d/nginx

# b. 直接清空被占用的文件（保留 fd，空间立即释放）
> /proc/<PID>/fd/<FD号>

# c. 重启服务（最后手段）
systemctl restart 服务名
```

**验证**：`df -h` 使用率立即下降；`lsof +L1` 不再列出该文件。

一步验证：`ls -l /proc/<PID>/fd/<FD号>` 输出带 `(deleted)` 后缀即实锤，锁定进程后按下面三种方式处理。

**预防**：日志清理一律用 `> 文件` 或 logrotate，不直接 `rm` 正在写入的文件；logrotate 中配 `copytruncate` 或在 `postrotate` 里重载服务；监控"df 与 du 差值"。

---

### 文件系统突然变成只读

**现象**：写入文件时报 `Read-only file system`；`mount` 显示挂载参数为 `ro`。

**可能原因**：

1. 文件系统检测到错误，内核自动以只读方式重新挂载以保护数据（概率最高）；
2. 磁盘出现坏道或存储链路异常；
3. 人为执行了 `mount -o remount,ro`；
4. `/etc/fstab` 中挂载参数写了 `ro`；
5. 存储设备被意外卸载或 LUN 断开。

**排查步骤**：

1. 看内核日志中的文件系统报错：

```bash
dmesg -T | grep -iE "error|readonly|i/o|ext4|xfs" | tail -30
journalctl -k -n 50
```

2. 确认当前挂载选项：

```bash
mount | grep ' / '
findmnt -o SOURCE,FSTYPE,OPTIONS,TARGET
```

3. 检查磁盘健康状态：

```bash
smartctl -a /dev/sda | grep -iE "reallocated|pending|error"
```

**解决方式**：先备份可读取的数据，再重新挂载为可写：

常见误判：只读第一反应是 `remount,rw`，若 dmesg 里有 I/O error，先修盘再挂载，强行改写可能加重损坏——内核改只读是在保护数据。

```bash
mount -o remount,rw /
```

若重挂失败，说明文件系统已损坏，需进入救援模式修复：

```bash
umount /dev/sdb1
xfs_repair /dev/sdb1          # xfs
fsck -y  /dev/sdb1            # ext 系列
```

**验证**：`touch /test.txt` 成功；`mount | grep ' / '` 显示 `rw`；`dmesg` 无新增 I/O 错误。

**预防**：配置 `smartctl` 定期巡检与告警；重要数据做异地备份；存储链路做多路径冗余；避免在业务高峰做高风险磁盘操作。

---

### fstab 配置错误导致系统无法启动

**现象**：重启后进入 `emergency mode`，提示 `Failed to mount /xxx` 或卡在 `A start job is running for /mount01` 超过 90 秒。

**可能原因**：

1. fstab 中设备名写错，或磁盘顺序变化导致 `/dev/sdb1` 指向了别的盘（概率最高）；
2. 文件系统类型写错（如 xfs 写成 ext4）；
3. 挂载点目录已被删除；
4. 缺少 `nofail`，失败即阻断启动流程；
5. 网络存储（NFS）未加 `_netdev`，网络未就绪就尝试挂载。

**排查步骤**：

1. 输入 root 口令进入 emergency，确认根挂载状态：

```bash
mount | grep ' / '
```

2. 对比 fstab 与实际设备：

```bash
cat /etc/fstab
blkid
lsblk -f
```

3. 手动测试挂载，看具体报错：

```bash
mount -a
```

**解决方式**：重新挂载为可写后修正 fstab：

```bash
mount -o remount,rw /
cp /etc/fstab /etc/fstab.bak
vim /etc/fstab
```

正确写法示例（使用 UUID，非系统盘加 `nofail`）：

```bash
UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx /data xfs defaults,nofail 0 0
```

NFS 项要加 `_netdev`：

```bash
172.16.1.31:/data/www  /mnt/www  nfs  defaults,_netdev  0  0
```

**验证**：`mount -a` 无任何输出；`findmnt /data` 正常；`reboot` 后能进入系统。

一步验证：emergency 里改完 fstab，先 `mount -o remount,rw /`、`mount -a`、`findmnt /data` 三连全过，再 reboot；开机验证的成本比再进一次 emergency 低得多。

**预防**：fstab 设备列统一用 UUID；改动前 `cp` 备份 + `mount -a` 验证；所有非系统盘加 `nofail`；NFS 项加 `_netdev`。

---

### LVM 扩容后 df 看不到容量变化

**现象**：执行了 `lvextend` 成功，`lvs` 显示 LV 已变大，但 `df -h` 仍显示原有容量。注意 lvextend 输出末尾有一行「resize2fs/xfs_growfs 提示」时，说明它只扩了 LV，文件系统那一步没做或失败。

常见误判：把 lvextend 成功当成扩容完成。LV 只是容器，文件系统不扩，容量不会变——`lvs` 大了、`df -h` 没变，十有八九是漏了第二步。

**可能原因**：

1. 只扩展了逻辑卷，未扩展文件系统（概率最高）；
2. 使用了错误的扩容命令（xfs 用了 `resize2fs`，或 ext4 用了 `xfs_growfs`）；
3. 命令参数传的是分区而非挂载点（xfs 要求传挂载点）；
4. 文件系统不支持在线扩容（需先卸载）；
5. `lvextend` 未加 `-r` 参数且后续步骤遗漏。

**排查步骤**：

1. 对比三个层次的大小：

```bash
lvs                            # 逻辑卷层
lsblk                          # 块设备层
df -h                          # 文件系统层
```

2. 确认文件系统类型：

```bash
findmnt -no FSTYPE /data
blkid /dev/mapper/vg0-lv01
```

3. 对 xfs 查看实际块信息：

```bash
xfs_info /data
```

**解决方式**：按文件系统类型执行对应命令。推荐一步到位写法：

```bash
lvextend -r -L +20G /dev/vg0/lv01
```

xfs（**参数必须是挂载点**）：

```bash
xfs_growfs /data
```

ext4：

```bash
resize2fs /dev/vg0/lv01
```

**验证**：`df -h /data` 显示扩容后的容量；`xfs_info /data` 中 `data blocks` 与 LV 大小匹配。

**预防**：扩容统一使用 `lvextend -r`；操作前确认文件系统类型；牢记 xfs 不能缩减，规划容量时留足余量。

---

### LVM 扩容报 insufficient free space

**现象**：执行 `lvextend` 时提示 `Insufficient free space: xxx extents needed, but only 0 available`。

一步验证：`vgs` 看 `VFree` 列，为 0 说明 VG 真满了，加盘三步走 `pvcreate` → `vgextend` → `lvextend`；VFree 还有余量则多半是指定的扩容大小超过剩余容量。

**可能原因**：

1. 卷组（VG）中没有空闲 PE（概率最高）；
2. LV 已占满 VG 全部空间；
3. 新加的磁盘尚未创建为 PV；
4. 指定的扩容大小超过了 VG 实际可用容量；
5. 存在 LVM 快照占用了 VG 空间。

**排查步骤**：

1. 查看 VG 的空闲空间：

```bash
vgs
vgdisplay vg0 | grep -E "Free|PE"
```

2. 查看已有 PV 与新磁盘：

```bash
pvs
lsblk
```

3. 检查是否有快照占用：

```bash
lvs -a
```

**解决方式**：先加 PV 再扩 VG，最后扩 LV：

```bash
pvcreate /dev/sdb
vgextend vg0 /dev/sdb
lvextend -r -L +50G /dev/vg0/lv01
```

若想用尽 VG 全部剩余空间：

```bash
lvextend -r -l +100%FREE /dev/vg0/lv01
```

**验证**：`vgs` 中 `VFree` 归零或减少；`df -h` 显示新容量。

**预防**：VG 使用率纳入监控；新盘上线后及时加入 VG；LVM 快照用完立即删除。

---

### NFS 挂载报 Stale file handle

**现象**：访问挂载目录时报 `Stale file handle`；`ls`、`cd` 均失败。

常见误判：客户端反复 mount 报错就怀疑网络。Stale file handle 是服务端句柄失效，网络通常没问题，`umount -lf` 重挂即可恢复。

**可能原因**：

1. 服务端导出目录被删除并重建，客户端持有的文件句柄失效（概率最高）；
2. 服务端 `/etc/exports` 变更或重启后未通知客户端；
3. 服务端导出路径下文件被其他方式删除；
4. 网络长时间中断后句柄过期；
5. 服务端 NFS 版本与客户端挂载选项不匹配。

**排查步骤**：

1. 确认服务端导出列表是否仍包含该路径：

```bash
showmount -e 172.16.1.31
```

2. 看客户端内核日志：

```bash
dmesg -T | tail -20
```

3. 确认当前挂载状态：

```bash
findmnt -t nfs,nfs4
```

**解决方式**：客户端强制卸载后重新挂载：

```bash
umount -lf /mnt/www
mount -t nfs 172.16.1.31:/data/www /mnt/www
```

若服务端目录确需重建，应在业务低峰期操作，并提前卸载所有客户端挂载点。

**验证**：`findmnt /mnt/www` 正常；`ls /mnt/www` 能列出内容；`touch` 测试可写。

**预防**：服务端不要随意删除重建导出目录；调整 exports 后用 `exportfs -r` 平滑重载，避免 `restart`；生产环境可考虑 autofs 自动挂载。

---

### 卸载文件系统报 target is busy

**现象**：`umount: /mnt/www: target is busy`；有时提示 `device is busy`。

一步验证：先 `cd /` 排除自己占用，仍 busy 就 `lsof +D` 找进程，最后才考虑 `-l` 懒卸载——强卸之后句柄问题会留到下次。

**可能原因**：

1. 当前 shell 的工作目录就在挂载点内（概率最高）；
2. 有进程正在读写挂载点中的文件；
3. 挂载点上还挂着子挂载（如 `/mnt/www/sub` 单独挂载）；
4. 有进程持有该目录下文件的描述符；
5. NFS 挂载点网络异常导致卸载卡住。

**排查步骤**：

1. 找出占用挂载点的进程：

```bash
lsof +D /mnt/www
fuser -mv /mnt/www
```

2. 确认是否存在子挂载：

```bash
findmnt -R /mnt/www
```

3. 检查自己是否身处该目录：

```bash
pwd
```

**解决方式**：先正常退出目录、结束进程：

```bash
cd /
systemctl stop 相关服务
umount /mnt/www
```

确实无法结束时，用懒卸载（延迟到不再使用时真正卸载）：

```bash
umount -l /mnt/www
```

NFS 场景可加 `-f` 强制：

```bash
umount -lf /mnt/www
```

**验证**：`findmnt /mnt/www` 无输出；`df -h` 中不再出现该挂载点。

**预防**：卸载前先 `cd /`；卸载脚本中先停服务再卸载；维护窗口内操作，提前通知业务方。

---

### 挂载报 wrong fs type 或 special device does not exist

**现象**：`mount: wrong fs type, bad option, bad superblock`；或 `mount: special device /dev/sdb1 does not exist`。

常见误判：`wrong fs type` 不一定是类型写错，盘没格式化时 superblock 读不到，报的也是这个错，先 `blkid` 确认盘上有没有文件系统。

**可能原因**：

1. 磁盘未格式化，或文件系统类型写错（概率最高）；
2. fstab 中设备名与实际不符（盘序变化）；
3. 分区表未刷新，系统还没有对应设备文件；
4. 挂载点目录不存在；
5. 文件系统超级块损坏。

**排查步骤**：

1. 确认块设备与文件系统类型：

```bash
lsblk -f
blkid /dev/sdb1
file -s /dev/sdb1
```

2. 确认挂载点是否存在：

```bash
ls -ld /mnt/www
```

3. 若分区不存在，重载分区表：

```bash
partprobe /dev/sdb
lsblk
```

4. 看内核详细报错：

```bash
dmesg -T | tail -20
```

**解决方式**：缺挂载点先创建，未格式化先格式化（**格式化会清空数据，务必确认盘符**）：

```bash
mkdir -p /mnt/www
mkfs.xfs /dev/sdb1
mount /dev/sdb1 /mnt/www
```

fstab 改用 UUID：

```bash
blkid /dev/sdb1                # 取 UUID
vim /etc/fstab
mount -a
```

**验证**：`findmnt /mnt/www` 正常；`df -hT` 显示正确的文件系统类型。

**预防**：新盘上线流程固定为 `lsblk` → 分区 → `partprobe` → `mkfs` → `mount` → 写 fstab；每一步都用 `lsblk -f` 核对。

---

## 三、网络

### 同网段 ping 不通

**现象**：`ping 10.0.0.8` 无响应或提示 `Destination Host Unreachable`。

一步验证：`ip link show eth0` 看状态是 UP 还是 DOWN，`ip neigh show` 看能否学到对端 MAC——两条命令就能分清是本机配置问题还是链路/对端问题。

**可能原因**：

1. 本机或对端 IP / 子网掩码配置错误，不在同一网段（概率最高）；
2. 网卡未启用（`state DOWN`）或网线未接；
3. 对端防火墙禁用了 ICMP；
4. 交换机端口未开、VLAN 划分错误；
5. IP 地址冲突。

**排查步骤**：

1. 看本机网卡状态与地址：

```bash
ip addr show
ip link show
```

2. 看网卡错包统计（判断物理层问题）：

```bash
ip -s link show eth0
```

3. 看 ARP 表能否学到对端 MAC：

```bash
ip neigh show
arp -a
```

4. 检查是否 IP 冲突：

```bash
arping -I eth0 10.0.0.8
```

**解决方式**：修正 IP 或启用网卡：

```bash
nmcli con show
nmcli con up eth0
nmcli con mod eth0 ipv4.addresses 10.0.0.8/24 ipv4.gateway 10.0.0.1
nmcli con up eth0
```

**验证**：`ping -c 4 10.0.0.8` 有回包；`ip neigh` 能学到对端 MAC。

**预防**：IP 地址统一登记管理；交付前用 `arping` 检查冲突；网卡配置纳入配置管理。

---

### 能 ping 通但端口访问不通

**现象**：`ping` 正常，但 `curl`、`telnet` 目标端口失败，报 `Connection refused` 或 `No route to host`。

refused 与 timeout 的分诊在这里同样适用：refused 查服务是否启动与 REJECT 规则，timeout 查 DROP 规则与安全组，先看报错是哪种。

**可能原因**：

1. 目标服务未启动或未监听该端口（概率最高，表现为 `Connection refused`）；
2. 服务只监听 `127.0.0.1`，未监听业务地址；
3. 服务端防火墙拦截（DROP 表现为超时，REJECT 表现为 refused）；
4. 中间网络安全设备未放通；
5. 服务监听端口与客户端访问的端口不一致。

**排查步骤**：

1. 服务端确认监听情况（**注意看 Local Address 是 0.0.0.0 还是 127.0.0.1**）：

```bash
ss -lntp | grep 80
ss -lntp
```

2. 服务端本机自测（排除网络因素）：

```bash
curl -I 127.0.0.1:80
curl -H "Host: www.example.com" -I 127.0.0.1
```

3. 客户端探测端口：

```bash
nc -zv 10.0.0.7 80
curl -v telnet://10.0.0.7:80
```

4. 确认防火墙规则：

```bash
firewall-cmd --list-all
iptables -nL
```

**解决方式**：启动服务并放行端口：

```bash
systemctl enable --now nginx
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
```

监听地址不对时，修改服务配置中的 `listen` 为 `0.0.0.0:80` 后重载。

**验证**：`ss -lntp | grep 80` 有输出；客户端 `nc -zv 10.0.0.7 80` 成功；`curl` 返回正常响应。

**预防**：服务上线检查清单包含"监听地址"与"防火墙放行"两项；用 `ss -lntp` 做基线巡检；安全组规则随服务一起申请。

---

### DNS 解析失败

**现象**：`ping: unknown host www.example.com`；`dig` 返回 `SERVFAIL` 或 `NXDOMAIN`；IP 直连正常但域名不通。

一步验证：`dig @223.5.5.5 域名` 通而默认 DNS 不通，问题就在 resolv.conf，别去动网络配置；反过来都失败才怀疑上游或网络。

**可能原因**：

1. `/etc/resolv.conf` 中 nameserver 配置错误或不可达（概率最高）；
2. `resolv.conf` 被 NetworkManager 覆盖，改动丢失；
3. 本地 DNS 服务（dnsmasq / named / systemd-resolved）未启动；
4. `/etc/nsswitch.conf` 中 hosts 解析顺序配置不当；
5. 上级 DNS 服务故障或域名记录不存在。

**排查步骤**：

1. 看当前使用的 DNS：

```bash
cat /etc/resolv.conf
grep hosts /etc/nsswitch.conf
```

2. 用指定 DNS 直接测试，区分是"配置问题"还是"上游问题"：

```bash
dig @223.5.5.5 www.example.com
dig @114.114.114.114 www.example.com
```

3. 检查解析耗时：

```bash
dig www.example.com | grep "Query time"
```

**解决方式**：通过 NetworkManager 正确下发 DNS，避免直接改 `resolv.conf`：

```bash
nmcli con mod eth0 ipv4.dns "223.5.5.5 114.114.114.114"
nmcli con up eth0
```

若确需临时固定，可加锁防止被覆盖（**记得事后解锁**）：

```bash
chattr +i /etc/resolv.conf
```

**验证**：`dig www.example.com` 返回正确 A 记录；`getent hosts www.example.com` 正常；`ping` 域名可通。

**预防**：DNS 配置统一通过 `nmcli` 或配置管理下发；配置多条 nameserver 冗余；对 DNS 解析成功率与时延做拨测监控。

---

### DNS 解析时快时慢

**现象**：首次访问某域名要等几秒，之后变快；或同一域名解析结果时长时短。

IPv6 优先导致的 AAAA 超时值得一提：抓包里一排 AAAA 查询无响应就是它，`options single-request` 或关闭 IPv6 可解，别一条条试 nameserver。

**可能原因**：

1. `resolv.conf` 中配置了不可达的 DNS，每次都要等其超时（概率最高）；
2. DNS 服务器响应慢或丢包；
3. 未开启本地 DNS 缓存（nscd / systemd-resolved）；
4. 应用未复用连接，每次请求都重新解析；
5. IPv6 优先导致 AAAA 查询超时。

**排查步骤**：

1. 逐条测试每个 nameserver 的响应：

```bash
for ns in $(awk '/nameserver/{print $2}' /etc/resolv.conf); do
  echo "== $ns"; dig @$ns www.example.com | grep "Query time"
done
```

2. 抓包确认是否有重传：

```bash
tcpdump -i eth0 port 53 -nn
```

3. 检查本地缓存服务状态：

```bash
systemctl status systemd-resolved nscd 2>/dev/null
```

**解决方式**：删除失效 nameserver 并缩短超时：

```bash
vim /etc/resolv.conf
```

```bash
nameserver 223.5.5.5
nameserver 114.114.114.114
options timeout:2 attempts:2 rotate
```

需要缓存时启用 `systemd-resolved` 或部署 `dnsmasq`。

**验证**：连续多次 `dig` 的 `Query time` 稳定在低值；业务首次访问无卡顿。

**预防**：DNS 纳入监控（解析时延、失败率）；统一配置 `options timeout`；重要域名可写 `/etc/hosts` 兜底。

---

### 网卡没有拿到 IP 地址

**现象**：`ip addr` 中网卡只有 IPv6 链路地址，或出现 `169.254.x.x`；网络不可用。

常见误判：`dhclient -v` 拿不到地址就怪 DHCP 服务，先确认交换机端口划没划对 VLAN、物理链路通不通，DHCP 报文出不了网段什么都白搭。

**可能原因**：

1. 网卡配置文件中 `ONBOOT=no`，开机未激活（概率最高）；
2. 使用 DHCP 但网络中无 DHCP 服务器或地址池耗尽；
3. NetworkManager 与传统 network 服务冲突；
4. 网线松动、交换机端口未开；
5. 网卡驱动未加载。

**排查步骤**：

1. 看网卡与连接状态：

```bash
ip addr show
nmcli dev status
nmcli con show
```

2. 检查配置文件关键项：

```bash
cat /etc/sysconfig/network-scripts/ifcfg-eth0     # RHEL 系
grep -E "BOOTPROTO|ONBOOT|IPADDR|GATEWAY|DNS1" /etc/sysconfig/network-scripts/ifcfg-eth0
```

3. 看驱动与链路信息：

```bash
dmesg -T | grep -i eth
ethtool eth0 | head -20
```

4. 手工触发一次 DHCP：

```bash
dhclient -v eth0
```

**解决方式**：修正配置并重启连接：

```bash
nmcli con mod eth0 connection.autoconnect yes
nmcli con mod eth0 ipv4.method manual ipv4.addresses 10.0.0.7/24
nmcli con mod eth0 ipv4.gateway 10.0.0.1
nmcli con mod eth0 ipv4.dns "223.5.5.5"
nmcli con up eth0
```

**验证**：`ip addr show eth0` 中能看到预期 `inet` 地址；`ping 网关` 通。

**预防**：模板机统一配置 `ONBOOT=yes`；网络管理方式二选一（NetworkManager 或 network，不要混用）；交付前跑一遍连通性检查脚本。

---

### 缺少默认路由无法访问外网

**现象**：能 ping 通同网段和网关，但访问外网 IP 报 `Network is unreachable`。

一步验证：`ip route get 8.8.8.8` 直接显示选路结果与出接口，比通读整张路由表快；输出里有 `default` 就不是路由问题，往下查防火墙。

**可能原因**：

1. 网卡配置中未设置网关，系统没有默认路由（概率最高）；
2. 存在多条默认路由，走错了出口；
3. 多网卡环境下策略路由配置缺失；
4. 网关地址配置错误（与本机不同网段）；
5. 路由被人为删除或重启后未持久化。

**排查步骤**：

1. 看路由表：

```bash
ip route
ip route show default
```

2. 直接问系统"去这个地址走哪条路"：

```bash
ip route get 8.8.8.8
```

3. 逐跳追踪：

```bash
traceroute -n 8.8.8.8
mtr -n 8.8.8.8
```

**解决方式**：临时添加默认路由（重启失效）：

```bash
ip route add default via 10.0.0.1 dev eth0
```

持久化写入连接配置：

```bash
nmcli con mod eth0 ipv4.gateway 10.0.0.1
nmcli con up eth0
```

**验证**：`ip route` 中有 `default via 10.0.0.1`；`ping -c 4 223.5.5.5` 通。

**预防**：网关写入网卡配置文件而非临时命令；多网卡场景提前规划路由策略；路由表纳入监控。

---

### bonding 网卡绑定异常

**现象**：配置了 bonding 但网络不通、只有一个 slave 生效、或切换时业务中断。

模式坑：mode 0/2/4 需要交换机侧配置聚合，mode 1/5/6 不需要——部署前先跟网络侧对齐，这是最常见的扯皮点，两边都说自己配对了，故障却一直在。

**可能原因**：

1. bonding 模式与交换机端配置不匹配（如 mode 0 需要交换机配聚合）（概率最高）；
2. 某个 slave 网卡物理链路故障或速率协商不一致；
3. `miimon` / `arp_interval` 链路检测参数未配置；
4. bond0 与 slave 网卡的 IP 配置冲突（slave 上仍留有 IP）；
5. 配置文件中缺少 `BONDING_OPTS`。

**排查步骤**：

1. 看 bond 状态与当前活动 slave：

```bash
cat /proc/net/bonding/bond0
ip link show bond0
```

2. 确认各 slave 链路状态：

```bash
ip link show eth0
ethtool eth0 | grep -E "Speed|Link"
```

3. 看 NetworkManager 中的连接：

```bash
nmcli con show
nmcli dev status
```

**解决方式**：以常用的主备模式（mode 1）为例重建绑定：

```bash
nmcli con add type bond con-name bond0 ifname bond0 mode active-backup \
  ipv4.method manual ipv4.addresses 10.0.0.7/24 ipv4.gateway 10.0.0.1
nmcli con add type bond-slave ifname eth0 master bond0
nmcli con add type bond-slave ifname eth1 master bond0
nmcli con up bond0
```

确认链路检测参数：

```bash
cat /proc/net/bonding/bond0 | grep -iE "mode|miimon|status"
```

**验证**：拔掉主用网卡网线，观察 `cat /proc/net/bonding/bond0` 中活动 slave 切换，业务 ping 不中断。

**预防**：bonding 模式与网络侧提前对齐；上线前做拔线演练；bond 状态纳入监控。

---

### ARP 异常与网关不可达

**现象**：`arp -a` 中学不到网关 MAC，或学到错误的 MAC；网络时断时续；提示 `Destination Host Unreachable`。

一步验证：`arping -I eth0 网关IP`，出现两个不同 MAC 应答就是 IP 冲突或 ARP 欺骗，从这里分界再决定查资产还是查安全。

**可能原因**：

1. 网关 IP 配置错误，不在本网段（概率最高）；
2. 网络中存在 ARP 欺骗或 IP 冲突；
3. 交换机端口安全策略限制了 MAC 数量；
4. ARP 缓存条目过期或被污染；
5. 网口协商失败（速率 / 双工不匹配）。

**排查步骤**：

1. 看 ARP 与邻居表：

```bash
ip neigh show
arp -a
```

2. 用 arping 确认谁在响应这个 IP：

```bash
arping -I eth0 10.0.0.1
```

3. 抓包看 ARP 请求与响应：

```bash
tcpdump -i eth0 arp -nn
```

4. 检查协商状态：

```bash
ethtool eth0 | grep -E "Speed|Duplex|Link detected"
```

**解决方式**：清理并重新学习 ARP：

```bash
ip neigh flush dev eth0
ping -c 2 10.0.0.1
ip neigh show
```

若是 IP 冲突，按登记信息修改本机地址；若是协商问题，固定速率双工：

```bash
ethtool -s eth0 speed 1000 duplex full autoneg off
```

**验证**：`ip neigh` 中网关状态为 `REACHABLE`；`ping` 网关与外网正常。

**预防**：IP 与 MAC 绑定纳入资产管理；接入层交换机开启端口安全与 DHCP Snooping；网络质量定期巡检。

---

### 克隆虚拟机后网络不通或 IP 冲突

**现象**：从模板克隆的主机启动后互相抢 IP、远程连不上、或 `ping` 时通时断。

**可能原因**：

1. 克隆机沿用了模板机的 IP 地址，未逐台修改（概率最高）；
2. 网卡配置中 `UUID` 重复；
3. MAC 地址冲突（未重新生成）；
4. udev 网卡命名规则残留，导致网卡名与配置不符；
5. 主机名未修改，影响部分服务互调。

**排查步骤**：

1. 对比各机的 IP 与 MAC：

```bash
ip addr show
ip link show
```

2. 检查配置文件中的 UUID：

```bash
grep -E "UUID|IPADDR|HWADDR" /etc/sysconfig/network-scripts/ifcfg-eth0
```

3. 用 arping 检测地址冲突：

```bash
arping -D -I eth0 10.0.0.7
```

**解决方式**：关机状态下逐台修改，删除 UUID 后重新生成：

```bash
sed -i '/^UUID=/d' /etc/sysconfig/network-scripts/ifcfg-eth0
sed -i '/^HWADDR=/d' /etc/sysconfig/network-scripts/ifcfg-eth0
sed -i 's/^IPADDR=.*/IPADDR=10.0.0.8/' /etc/sysconfig/network-scripts/ifcfg-eth0
uuidgen                       # 如需可重新写入
hostnamectl set-hostname web02
reboot
```

**验证**：各机 `ip addr` 地址互不相同；`arping -D` 无冲突提示；互相 `ping` 正常。

**预防**：模板机在关机前清理 IP、UUID、MAC 与 SSH host key；克隆后统一用脚本批量下发差异化配置。

别漏掉 SSH host key：克隆机不重新生成（`rm -f /etc/ssh/ssh_host_* && ssh-keygen -A`），客户端连接时报指纹变更警告，看着像中间人攻击，吓人又误事。

---

### 服务监听正常但访问被拒

**现象**：`ss -lntp` 能看到端口监听，本机 `curl 127.0.0.1` 正常，但外部访问被拒或超时。

排查顺序按改动成本排：先系统防火墙（一条命令的事），再云安全组（要去控制台），最后 SELinux（`ausearch -m avc`），从便宜的开始试。

**可能原因**：

1. firewalld 未放行对应服务或端口（概率最高）；
2. 只加了 `--permanent` 未 `--reload`，或只临时放行未持久化；
3. 云环境安全组未放通；
4. 服务绑定在特定网卡地址上；
5. SELinux 限制了服务使用非标准端口。

**排查步骤**：

1. 看防火墙当前生效规则：

```bash
firewall-cmd --list-all
firewall-cmd --list-ports
```

2. 看 SELinux 状态与审计：

```bash
getenforce
ausearch -m avc -ts recent | head -20
```

3. 确认服务绑定的具体地址：

```bash
ss -lntp | grep 8080
```

**解决方式**：同时做临时与永久放行：

```bash
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --reload
firewall-cmd --list-ports
```

SELinux 场景下放行非标准端口：

```bash
semanage port -a -t http_port_t -p tcp 8080
```

**验证**：从客户端 `nc -zv 10.0.0.7 8080` 成功；`curl` 返回正常响应。

**预防**：端口放行纳入服务上线清单；`firewall-cmd --list-all` 结果纳入基线；优先使用标准端口减少 SELinux 干预。

---

## 四、权限与用户

### 执行文件或访问目录提示 Permission denied

**现象**：`bash: ./script.sh: Permission denied`；或访问某目录文件时被拒绝，`ls` 显示属性为 `???`。

常见误判：看到 denied 就 `chmod -R 777`。先 `namei -l` 逐层看，十有八九是某一级目录缺 x 权限，改动越小越容易回滚，777 还引入安全问题。

**可能原因**：

1. 文件缺少执行权限，或路径中某一级目录缺少 `x` 权限（概率最高）；
2. 文件属主 / 属组不是当前用户；
3. 上级目录被设置了不可变属性或 ACL 限制；
4. 文件系统以只读方式挂载；
5. SELinux 安全上下文不匹配。

**排查步骤**：

1. 逐级查看路径上每一层的权限（**这是定位权限问题最有效的命令**）：

```bash
namei -l /data/wwwroot/app/index.html
```

2. 确认自己的身份与所属组：

```bash
id
ls -ld /data /data/wwwroot
```

3. 检查 ACL 与特殊属性：

```bash
getfacl /data/wwwroot
lsattr /data/wwwroot/index.html
```

4. 检查 SELinux：

```bash
ls -Z /data/wwwroot/index.html
getenforce
```

**解决方式**：补齐权限。目录必须有 `x` 才能进入并获取下一层 inode：

```bash
chmod 755 /data/wwwroot
find /data/wwwroot -type f -exec chmod 644 {} +
find /data/wwwroot -type d -exec chmod 755 {} +
chown -R www.www /data/wwwroot
```

SELinux 上下文错误时修复：

```bash
restorecon -Rv /data/wwwroot
```

**验证**：`namei -l 路径` 每一层均有足够权限；目标用户能正常访问。

**预防**：批量改权限时区分文件与目录，绝不使用 `chmod -R 777`；`chmod -R 644` 会抹掉目录执行位，务必避免；权限基线纳入巡检。

---

### 用户无法通过 SSH 或本地登录

**现象**：输入正确口令后仍提示 `Login incorrect`；或登录后立即退出；`su` 到该用户报 `This account is currently not available`。

一步验证：先 `su - 用户` 本机测试，本机都不通就别怀疑 SSH 配置，问题在账号本身（shell、锁定、过期）。

**可能原因**：

1. 用户 shell 被设为 `/sbin/nologin` 或 `/bin/false`（概率最高）；
2. `/etc/shadow` 中密码字段为 `!` 或 `*`，账号未设置口令或被锁定；
3. 账号已过有效期（`chage` 设置了过期时间）；
4. `/etc/nologin` 文件存在，阻止非 root 用户登录；
5. PAM 或 `sshd_config` 中的 `AllowUsers` / `DenyUsers` 限制了账号。

**排查步骤**：

1. 查看账号的 shell 与密码状态：

```bash
grep 用户名 /etc/passwd
grep 用户名 /etc/shadow
passwd -S 用户名
chage -l 用户名
```

2. 检查 SSH 侧限制：

```bash
grep -E "AllowUsers|DenyUsers|AllowGroups|PermitRootLogin" /etc/ssh/sshd_config
```

3. 看登录失败日志：

```bash
journalctl -u sshd -n 30 --no-pager
tail -30 /var/log/secure
```

4. 确认是否存在 nologin 文件：

```bash
ls -l /etc/nologin
```

**解决方式**：按需修正 shell 与口令：

```bash
usermod -s /bin/bash 用户名
passwd 用户名
passwd -u 用户名                 # 若账号被锁定
rm -f /etc/nologin
```

**验证**：`su - 用户名` 成功；SSH 登录进入 shell；`passwd -S` 显示 `P`（可用口令）。

**预防**：创建用户时明确 shell 与用途，服务账号用 `-s /sbin/nologin`；定期清理过期账号；账号生命周期纳入管理流程。

---

### sudo 报 not in sudoers 或认证失败

**现象**：`xxx is not in the sudoers file. This incident will be reported.`；或 `Sorry, try again.` 反复提示。

口令反复失败先想一件事：sudo 要的是当前用户自己的口令，不是 root 口令，新接手机器的人常栽在这里。

**可能原因**：

1. 用户未加入授权组或未配置规则（概率最高）；
2. 输入的是 root 口令而非自己的口令；
3. `sudoers` 文件存在语法错误，规则整体未生效；
4. 用户有规则但命令不在允许列表中；
5. `/etc/sudoers.d/` 下文件权限过宽（需 0440）。

**排查步骤**：

1. 检查生效规则与语法：

```bash
sudo -l -U 用户名
visudo -c
```

2. 看拒绝记录：

```bash
journalctl -n 30 | grep sudo
tail /var/log/secure | grep sudo
```

3. 确认 drop-in 文件权限：

```bash
ls -l /etc/sudoers.d/
```

**解决方式**：用 `visudo` 添加规则（**禁止直接编辑 `/etc/sudoers`**）：

```bash
visudo -f /etc/sudoers.d/ops
```

```bash
%ops     ALL=(ALL)       ALL
用户名   ALL=(ALL)       /usr/bin/systemctl restart nginx, /usr/bin/systemctl reload nginx
chmod 0440 /etc/sudoers.d/ops
```

**验证**：`sudo -l -U 用户名` 能看到规则；执行 `sudo 命令` 输入**自己的**口令后成功。

**预防**：授权遵循最小化原则，只给必要命令；所有授权走 `/etc/sudoers.d/`；改动前 `visudo -c`。

---

### 密码过期或被强制要求修改

**现象**：登录时提示 `You are required to change your password immediately`；或 `Your password has expired`。

常见误判：提示改密就以为账号出问题，多数只是 `chage` 策略到期，`chage -l 用户` 一看便知；服务账号被强制改密反而会打断业务，记得单独豁免。

**可能原因**：

1. 密码超过 `PASS_MAX_DAYS` 设置的有效期（概率最高）；
2. 新建账号被设为首次登录强制改密（`chage -d 0`）；
3. 账号被管理员设置了具体的过期日期；
4. 密码策略要求复杂度，改密时因太简单被拒；
5. `/etc/shadow` 中口令老化字段被人为修改。

**排查步骤**：

1. 查看口令老化信息：

```bash
chage -l 用户名
grep 用户名 /etc/shadow
```

2. 查看全局密码策略：

```bash
grep -E "PASS_MAX_DAYS|PASS_MIN_DAYS|PASS_WARN_AGE" /etc/login.defs
```

**解决方式**：修改口令，或调整有效期：

```bash
passwd 用户名                    # 按提示设置新口令
chage -M 90 -W 7 用户名          # 有效期 90 天，提前 7 天告警
chage -M -1 用户名               # 设为永不过期（仅限受控服务账号）
```

批量为新账号设置首次登录强制改密：

```bash
chage -d 0 用户名
```

**验证**：`chage -l 用户名` 显示新的有效期；重新登录不再提示改密。

**预防**：统一密码有效期策略；服务账号用密钥认证并单独登记；到期前通过监控告警提醒。

---

### SUID 权限带来的提权风险

**现象**：安全扫描发现系统中存在大量 SUID 文件，或普通用户执行某些命令时能获得 root 权限。

一步验证：把 `find / -xdev -perm -4000` 的结果存成基线文件，定期 diff——新增一行就查一行，比每次肉眼比对可靠得多。

**可能原因**：

1. 系统默认自带部分 SUID 程序（如 `passwd`、`su`、`sudo`），属正常但有风险面（概率最高）；
2. 管理员为图方便给自定义脚本或 `cp` / `find` / `vim` 加了 SUID；
3. 攻击者植入带有 SUID 的后门程序；
4. 挂载的文件系统未使用 `nosuid` 选项，引入了外部 SUID 文件；
5. 缺乏定期的 SUID 文件审计机制。

**排查步骤**：

1. 全盘列出所有 SUID / SGID 文件：

```bash
find / -xdev -perm -4000 -type f 2>/dev/null
find / -xdev -perm -2000 -type f 2>/dev/null
```

2. 与系统基线对比，找出新增项：

```bash
find / -xdev -perm -4000 -type f -exec ls -l {} + 2>/dev/null | sort -k9
```

3. 确认挂载选项：

```bash
findmnt -no SOURCE,TARGET,OPTIONS | grep -E "nosuid|/data"
```

**解决方式**：移除非必要的 SUID 位：

```bash
chmod u-s /usr/local/bin/可疑文件
chmod u-s /usr/bin/vim /usr/bin/find        # 若被误加
```

外部存储挂载时加上 `nosuid`：

```bash
mount -o remount,nosuid /data
```

fstab 中持久化：

```bash
UUID=xxx  /data  xfs  defaults,nosuid,nodev  0  0
```

**验证**：重新执行 `find / -xdev -perm -4000 -type f`，确认只剩系统必需的 SUID 程序。

**预防**：建立 SUID 文件基线并定期比对；所有外来挂载点默认加 `nosuid,nodev`；禁止对脚本类文件设置 SUID。

---

### 文件属主显示为数字 UID

**现象**：`ls -l` 显示文件属主为 `1067` 这样的纯数字，而非用户名；备份恢复后权限一片混乱。

一步验证：`id 1067` 无输出就是孤儿 uid；跨机迁移前先在源机 `awk -F: '$3>=1000 {print $3, $1}' /etc/passwd` 导出 uid 清单，到目标机照单建齐，事前五分钟省掉事后半小时。

**可能原因**：

1. 原属主用户被删除，passwd 中没有对应 uid 条目（概率最高）；
2. 从其他机器拷贝 / 恢复数据，目标机无同名同 uid 用户；
3. NFS 等网络存储两端 uid 不一致；
4. 手动修改过 `/etc/passwd` 中的 uid；
5. 容器内外 uid 映射不一致。

**排查步骤**：

1. 确认该 uid 是否存在对应用户：

```bash
ls -ln 文件
id 1067
awk -F: '$3==1067' /etc/passwd
```

2. 统计系统中"孤儿"属主文件的范围：

```bash
find / -xdev -nouser -o -nogroup 2>/dev/null | head -30
```

**解决方式**：要么重建对应 uid 的用户，要么把属主改为现有有效用户：

```bash
useradd -u 1067 -M -s /sbin/nologin appuser     # 重建同 uid 用户
chown -R www.www /data/wwwroot                   # 或直接改属主
```

批量修复孤儿文件：

```bash
find /data -xdev -nouser -exec chown www {} + 2>/dev/null
```

**验证**：`ls -l` 属主列显示用户名；`find /data -nouser` 无输出。

**预防**：删除用户前先归档其文件属主；跨机迁移数据时统一 uid / gid；重要目录属主纳入基线巡检。

---

### 新用户登录后提示符显示为 -bash-4.2$

**现象**：新建用户登录后提示符是 `-bash-4.2$` 而非正常格式，且很多命令别名不可用。

常见误判：以为是 bash 版本问题去升级。`-bash-4.2$` 只是 bash 找不到初始化文件时的默认提示符（4.2 是版本号），补齐家目录文件就好，别动系统。

**可能原因**：

1. 家目录中缺少 `.bash_profile`、`.bashrc` 等初始化文件（概率最高）；
2. 创建用户时未加 `-m`，家目录未生成；
3. 家目录属主或权限错误，shell 无法读取配置；
4. `/etc/skel/` 目录内容被清空；
5. 用户被指定了错误的家目录路径。

**排查步骤**：

1. 确认家目录是否存在及内容：

```bash
ls -la /home/用户名
grep 用户名 /etc/passwd
```

2. 确认模板目录内容：

```bash
ls -la /etc/skel/
```

**解决方式**：从模板目录补齐初始化文件并修正属主：

```bash
cp -a /etc/skel/.bash* /home/用户名/
chown -R 用户名.用户名 /home/用户名
chmod 700 /home/用户名
```

退出重新登录后生效。

**验证**：重新登录后提示符正常；`alias` 能看到 `ll` 等别名。

**预防**：创建用户统一使用 `useradd -m -s /bin/bash 用户名`；不要改动 `/etc/skel/`；批量创建时检查家目录生成情况。

---

### 文件权限为 777 却无法修改

**现象**：`ls -l` 显示文件权限为 `rwxrwxrwx`，但修改或删除时报 `Operation not permitted` 或 `Read-only file system`。

一步验证：`lsattr 文件` 一个命令的事，比反复试 chmod 快得多；`i` 属性不动它，权限位怎么改都是 Operation not permitted。

**可能原因**：

1. 文件被设置了 `i`（immutable）不可变属性（概率最高）；
2. 文件所在文件系统以只读方式挂载；
3. 文件位于 Sticky 位目录且当前用户非文件属主；
4. 文件被 `chattr +a` 设置了只追加属性；
5. SELinux 策略拒绝（通常表现为 `Permission denied` 而非 `not permitted`）。

**排查步骤**：

1. 查看文件的特殊属性：

```bash
lsattr 文件
```

2. 确认挂载选项：

```bash
mount | grep ' 挂载点 '
findmnt -no OPTIONS 挂载点
```

3. 检查父目录是否有 Sticky 位：

```bash
ls -ld 父目录
```

**解决方式**：解除不可变属性后重试：

```bash
chattr -i 文件
chattr -a 文件
```

文件系统只读时重新挂载：

```bash
mount -o remount,rw 挂载点
```

**验证**：修改文件成功；`lsattr` 不再显示 `i` / `a`。

**预防**：仅在明确需要时设置 `i` 属性，并在文档中登记；避免在挂载点内放置需要频繁变动的文件；只读挂载变更走变更流程。

---

### ACL 授权后仍然无法访问

**现象**：用 `setfacl` 给某用户授权后，该用户访问文件仍提示 `Permission denied`；`getfacl` 显示权限存在但带 `effective` 限制。

常见误判：以为 ACL 设了就生效。mask 是 ACL 的天花板，条目权限再高也会被 mask 压住；`getfacl` 输出里出现 `#effective:---` 就是 mask 在拦，补一条 `setfacl -m m::rwx` 即可。

**可能原因**：

1. ACL 的 mask 值限制了有效权限（概率最高）；
2. 只有目录加了 ACL，未加 `-d` 默认项，新建文件不继承；
3. 文件系统挂载时未开启 ACL 支持；
4. 授权路径与实际访问路径不一致；
5. 属主 / 属组的传统权限位与 ACL 冲突。

**排查步骤**：

1. 查看完整 ACL（**关注 mask 行与 effective 提示**）：

```bash
getfacl /data/wwwroot
```

2. 确认挂载选项：

```bash
findmnt -no OPTIONS /data
```

3. 验证用户实际身份：

```bash
id 用户名
```

**解决方式**：调整 mask 值，并为目录设置默认 ACL：

```bash
setfacl -m u:用户名:rwx /data/wwwroot
setfacl -m m::rwx /data/wwwroot
setfacl -d -m u:用户名:rwx /data/wwwroot          # 新建文件继承
```

删除无效规则：

```bash
setfacl -x u:用户名 /data/wwwroot
```

**验证**：`getfacl 路径` 中不再出现 `#effective:---`；目标用户访问成功。

**预防**：授权后统一设置 mask；目录授权时同时加默认项；ACL 变更记入变更记录。

---

### usermod 加组后原有组丢失

**现象**：执行 `usermod -G docker 用户名` 后，用户原有的附加组全部消失，导致部分目录无法访问。

这里有个坑：`-G` 是覆盖式赋值，`-aG` 才是追加；写运维脚本时尤其危险，批量跑一遍能把一群用户的组权限抹掉，改动前先 `id 用户` 留底。

**可能原因**：

1. `usermod -G` 是覆盖式赋值，未使用 `-a` 追加（概率最高）；
2. 误以为 `-G` 会自动保留原组；
3. 脚本中批量改组未读取原有组列表；
4. 主组与附加组概念混淆，错误使用 `-g`；
5. 改动后未重新登录，实际生效的是旧组信息。

**排查步骤**：

1. 查看用户当前与原有的组信息：

```bash
id 用户名
groups 用户名
grep 用户名 /etc/group
```

2. 从备份或配置管理中确认原组列表：

```bash
grep 用户名 /etc/group.bak 2>/dev/null
```

**解决方式**：用 `-a` 追加，或一次性写全所有附加组：

```bash
usermod -aG docker 用户名
usermod -aG wheel,docker 用户名
```

若已丢失，按原列表恢复：

```bash
usermod -G 原组1,原组2,docker 用户名
```

**验证**：`id 用户名` 中同时包含原有组与新组；重新登录后权限恢复正常。

**预防**：加组统一使用 `usermod -aG`；改组前先 `id 用户名` 记录原值；批量操作通过配置管理下发。

---

## 五、服务与应用

### Nginx 返回 502 Bad Gateway

**现象**：浏览器报 `502 Bad Gateway`；error.log 中出现 `connect() failed (111: Connection refused) while connecting to upstream`。

**可能原因**：

1. 后端服务（php-fpm / Tomcat / 业务进程）未启动或已崩溃（概率最高）；
2. `fastcgi_pass` / `proxy_pass` 的地址或端口与实际监听不一致（TCP 9000 与 Unix Socket 混淆）；
3. `SCRIPT_FILENAME` 拼接错误，error.log 报 `Primary script unknown`；
4. 后端进程数打满，无法接受新连接；
5. SELinux 拦截了到后端的连接。

**排查步骤**：

1. 确认后端进程与监听：

```bash
systemctl status php-fpm
ss -lntp | grep 9000
ls -l /run/php-fpm/www.sock
```

2. 看 Nginx 错误日志：

```bash
tail -50 /var/log/nginx/error.log
```

3. 从 Nginx 本机直连后端，排除网络因素：

```bash
curl -I 127.0.0.1:9000
curl -H "Host: www.example.com" -I 127.0.0.1
```

4. 确认配置中的转发地址：

```bash
nginx -T | grep -E "fastcgi_pass|proxy_pass|root"
```

**解决方式**：启动后端并核对转发地址：

```bash
systemctl enable --now php-fpm
```

Unix Socket 写法：

```nginx
location ~ \.php$ {
    root           /html/www;
    fastcgi_pass   unix:/run/php-fpm/www.sock;
    fastcgi_index  index.php;
    fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
    include        fastcgi_params;
}
```

若 error.log 报 `Primary script unknown`，说明 `root` 缺失，在 `location` 内补上即可。

**验证**：`curl -I http://127.0.0.1/index.php` 返回 200；浏览器访问正常。

**预防**：后端服务设为开机自启；用进程守护或 systemd `Restart=on-failure`；对 502 状态码配置告警；统一配置模板中的 socket 路径。

排查顺序别搞反：502 先查后端进程，再查地址端口，最后才看 nginx 配置。有一次 502 反复重启 nginx 毫无效果，`dmesg -T | grep -i oom` 发现 php-fpm 被 OOM 杀掉，`pm.max_children` 调小后恢复——根因在内存，不在 nginx。

---

### Nginx 返回 504 Gateway Timeout

**现象**：请求长时间无响应后返回 `504 Gateway Time-out`；error.log 报 `upstream timed out (110: Connection timed out)`。

常见误判：把 504 当成 nginx 性能问题去调 worker 数，方向错了——后端活着但太慢才会 504，先看后端耗时分布与慢查询。

**可能原因**：

1. 后端处理太慢（慢 SQL、慢接口、死循环）（概率最高）；
2. 代理超时参数设置过短；
3. 后端节点负载过高或线程 / 进程池耗尽；
4. 后端依赖的外部服务超时传导；
5. 网络抖动或丢包导致响应未及时返回。

**排查步骤**：

1. 定位超时请求规律：

```bash
tail -50 /var/log/nginx/error.log | grep "upstream timed out"
awk '$request_time > 5 {print}' /var/log/nginx/access.log | tail -20
```

2. 查看后端机器负载：

```bash
top
vmstat 1
iostat -x 1
```

3. 数据库场景查慢查询：

```bash
mysqladmin processlist
```

4. 确认当前超时配置：

```bash
nginx -T | grep -E "proxy_read_timeout|proxy_connect_timeout|fastcgi_read_timeout"
```

**解决方式**：先优化后端慢逻辑；确需等待时适度调大超时：

```nginx
location / {
    proxy_pass         http://backend;
    proxy_connect_timeout 5s;
    proxy_send_timeout    30s;
    proxy_read_timeout    60s;
}
```

PHP 场景同步调整 `fastcgi_read_timeout` 与 `php.ini` 中的 `max_execution_time`。

**验证**：重复触发原慢请求，`curl -w "%{time_total}\n"` 显示耗时下降，不再返回 504。

**预防**：慢查询与慢接口接入 APM；为上游响应时间设置 P99 告警；合理设置超时阶梯，避免无限等待。

---

### Nginx 返回 403 Forbidden

**现象**：访问站点返回 `403 Forbidden`；error.log 报 `Permission denied` 或 `directory index of "xxx" is forbidden`。

常见误判：403 就 chown 整个目录。nginx 读文件需要整条路径每一级都有 x 权限，缺哪级补哪级，`namei -l` 一次看全，别整目录递归改权限。

**可能原因**：

1. 站点目录或文件的属主 / 权限不足，worker 用户读不到（概率最高）；
2. 目录下没有 index 文件且未开启 `autoindex`；
3. `allow` / `deny` 规则顺序错误导致全部拒绝；
4. SELinux 安全上下文不正确；
5. `location` 中配置了防盗链（Referer）规则被误判。

**排查步骤**：

1. 逐级查看路径权限：

```bash
namei -l /html/www/index.html
ls -ld /html /html/www
```

2. 确认 Nginx 与 php-fpm 的运行用户：

```bash
ps aux | grep -E "nginx|php-fpm"
grep -E "^user" /etc/nginx/nginx.conf
```

3. 检查 SELinux：

```bash
getenforce
ls -Z /html/www/index.html
ausearch -m avc -ts recent | head
```

4. 看错误日志与访问控制配置：

```bash
tail -30 /var/log/nginx/error.log
nginx -T | grep -E "allow|deny|autoindex|valid_referers"
```

**解决方式**：统一运行用户并修正权限：

```bash
chown -R www.www /html/www
find /html/www -type d -exec chmod 755 {} +
find /html/www -type f -exec chmod 644 {} +
```

SELinux 上下文错误：

```bash
semanage fcontext -a -t httpd_sys_content_t "/html/www(/.*)?"
restorecon -Rv /html/www
```

**验证**：`curl -I http://127.0.0.1/` 返回 200；浏览器访问正常。

**预防**：站点目录属主统一为服务运行用户；批量改权限时区分文件与目录；部署脚本中固化正确的权限设置。

---

### Nginx 返回 404 Not Found

**现象**：访问页面返回 `404 Not Found`；error.log 报 `open() "xxx" failed (2: No such file or directory)`。

一步验证：`curl -I http://127.0.0.1/index.html` 直接请求具体文件，把「路由/rewrite 问题」和「文件缺失」分开，两者的修法完全不同。

**可能原因**：

1. `root` 指向的目录与实际文件位置不一致（概率最高）；
2. `location` 匹配规则写错，请求落到了错误的块；
3. 站点文件未推送或部署失败；
4. `proxy_pass` 结尾斜杠改变了转发路径；
5. 伪静态（rewrite）规则未生效或错误。

**排查步骤**：

1. 确认最终生效的 root 与 location 配置：

```bash
nginx -T | grep -E "root|location|try_files|rewrite"
```

2. 对照实际文件是否存在：

```bash
ls -l /html/www/index.html
ls -lR /html/www | head -30
```

3. 直接请求具体文件排除索引问题：

```bash
curl -I http://127.0.0.1/index.html
curl -H "Host: www.example.com" -I 127.0.0.1/index.html
```

**解决方式**：修正 `root` 与 `location`，补齐缺失文件：

```nginx
server {
    listen       80;
    server_name  www.example.com;
    root         /html/www;
    index        index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }
}
```

反向代理 404 时，确认 `proxy_pass` 结尾斜杠语义：

```nginx
location /api/ {
    proxy_pass http://backend/;      # 带斜杠：/api/x -> /x
}
```

**验证**：`curl -I` 返回 200；日志中不再出现 `open() ... failed`。

**预防**：部署后自动跑健康检查（访问首页与关键接口）；配置中 root 路径用变量统一定义；rewrite 规则做单元测试。

---

### 上传文件报 413 Request Entity Too Large

**现象**：上传主题或附件时提示 `413 Request Entity Too Large`。

常见误判：只改 nginx 不改 PHP，或只改 `upload_max_filesize` 不改 `post_max_size`，都会继续报 413。各层限制要对齐，`post_max_size` 还得略大于 `upload_max_filesize`（表单里还有其他字段）。

**可能原因**：

1. Nginx 的 `client_max_body_size` 小于上传文件体积（默认 1m）（概率最高）；
2. PHP 的 `upload_max_filesize` 过小（默认 2M）；
3. PHP 的 `post_max_size` 限制了整个表单 POST 大小（默认 8M）；
4. 反向代理层（负载均衡）也有一份同样的限制；
5. 应用框架自身配置了上传上限。

**排查步骤**：

1. 查看当前限制：

```bash
nginx -T | grep client_max_body_size
php -i | grep -E "upload_max_filesize|post_max_size"
```

2. 复现上传并观察响应码与日志：

```bash
tail -20 /var/log/nginx/error.log
```

**解决方式**：**必须同时修改 Nginx 与 PHP 两处**，只改一处仍会报错：

```nginx
server {
    client_max_body_size 50m;
}
```

```ini
upload_max_filesize = 50M
post_max_size       = 60M
max_execution_time  = 300
```

重载服务：

```bash
nginx -t && systemctl reload nginx
systemctl restart php-fpm
```

**验证**：重新上传原文件成功；`curl -F` 模拟上传返回 200。

**预防**：新站点部署时按业务需要预设上传限制；文档记录各层限制值；前端做体积预检并给出友好提示。

---

### Nginx 无法启动或端口被占用

**现象**：`systemctl start nginx` 失败；报 `bind() to 0.0.0.0:80 failed (98: Address already in use)` 或配置语法错误。

一步验证：`nginx -t` 先跑，语法问题 30 秒定位到行号；语法过了再看 `ss -lntp | grep :80` 查端口占用，顺序别反。

**可能原因**：

1. 80 / 443 端口已被其他 Web 服务占用（概率最高）；
2. 配置文件语法错误（缺分号、括号不匹配）；
3. 前一次进程未正常退出，PID 文件残留；
4. 监听了非本机地址且未开启 `ip_nonlocal_bind`；
5. SELinux 限制了非标准端口。

**排查步骤**：

1. 检查配置语法：

```bash
nginx -t
```

2. 找出占用端口的进程：

```bash
ss -lntp | grep :80
lsof -i :80
```

3. 看详细启动日志：

```bash
journalctl -u nginx -n 30 --no-pager
tail -30 /var/log/nginx/error.log
```

**解决方式**：语法错误按 `nginx -t` 提示的行号修正；端口冲突则释放或换端口：

```bash
systemctl stop httpd
systemctl disable httpd
systemctl start nginx
```

监听 VIP 场景需开启非本地绑定：

```bash
sysctl -w net.ipv4.ip_nonlocal_bind=1
echo "net.ipv4.ip_nonlocal_bind = 1" > /etc/sysctl.d/99-keepalived.conf
sysctl --system
```

**验证**：`systemctl status nginx` 为 `active (running)`；`ss -lntp | grep :80` 能看到 nginx 进程。

**预防**：每次改配置先 `nginx -t`；上线前确认端口无冲突；非标准端口同步放通 SELinux 与防火墙。

---

### php-fpm 与 Nginx 不通

**现象**：动态页面 502 或空白；php-fpm 进程存在但 Nginx 连不上。

常见误判：动态页 502 就重启 php-fpm。先对比 `grep ^listen /etc/php-fpm.d/www.conf` 与 `nginx -T | grep fastcgi_pass`，两边一个写 TCP 一个写 socket 的占大头，重启解决不了配置不一致。

**可能原因**：

1. `fastcgi_pass` 与 php-fpm 实际监听方式不一致（TCP 与 Unix Socket 混淆）（概率最高）；
2. php-fpm 监听地址写成了 `127.0.0.1:9000` 而 Nginx 连的是 socket 路径（或反之）；
3. socket 文件权限不对，Nginx 用户无读写权限；
4. php-fpm 进程池耗尽（`pm.max_children` 太小）；
5. Nginx 与 php-fpm 运行用户不一致导致权限错误。

**排查步骤**：

1. 确认 php-fpm 实际监听方式：

```bash
grep -E "^listen" /etc/php-fpm.d/www.conf
ss -lntp | grep 9000
ls -l /run/php-fpm/www.sock
```

2. 对比 Nginx 配置：

```bash
nginx -T | grep fastcgi_pass
```

3. 检查运行用户与 socket 权限：

```bash
grep -E "^user|^group|listen.owner|listen.mode" /etc/php-fpm.d/www.conf
ps aux | grep -E "nginx|php-fpm"
```

4. 看 php-fpm 慢日志与错误日志：

```bash
tail -30 /var/log/php-fpm/error.log
tail -30 /var/log/php-fpm/www-slow.log
```

**解决方式**：统一监听方式。Unix Socket 方式（推荐同机部署）：

```ini
listen = /run/php-fpm/www.sock
listen.owner = www
listen.group = www
listen.mode = 0660
```

对应 Nginx：

```nginx
fastcgi_pass unix:/run/php-fpm/www.sock;
```

重载：

```bash
php-fpm -t && systemctl restart php-fpm
nginx -t && systemctl reload nginx
```

**验证**：`curl -I http://127.0.0.1/index.php` 返回 200；php 页面正常渲染。

**预防**：监听方式写进配置模板并统一；`pm.max_children` 按内存容量计算后配置；慢日志开启并定期分析。

---

### MySQL 远程连接被拒

**现象**：程序报 `Error establishing a database connection`；客户端报 `ERROR 1130 (HY000): Host 'xxx' is not allowed to connect`。

常见误判：ERROR 1130 去改 my.cnf。授权和监听是两回事，先 `select user,host from mysql.user` 看 host 字段匹配不匹配，再动其他。

**可能原因**：

1. 用户未被授权从来源主机连接（host 字段不匹配）（概率最高）；
2. `bind-address` 只监听 `127.0.0.1`；
3. 防火墙未放行 3306 端口；
4. 数据库服务未启动或端口未监听；
5. 用户名或口令错误。

**排查步骤**：

1. 确认服务与端口：

```bash
systemctl status mariadb
ss -lntp | grep 3306
```

2. 在数据库本机确认授权情况：

```sql
select user, host from mysql.user;
show grants for 'wordpress'@'172.16.1.%';
```

3. 确认监听地址：

```bash
grep -E "bind-address|skip-networking" /etc/my.cnf /etc/my.cnf.d/*
```

4. 从应用服务器探测端口：

```bash
nc -zv 172.16.1.51 3306
```

**解决方式**：补授权并放开监听与防火墙：

```sql
grant all on wordpress.* to 'wordpress'@'172.16.1.%' identified by '<your-password>';
flush privileges;
```

```ini
bind-address = 0.0.0.0
```

```bash
firewall-cmd --permanent --add-port=3306/tcp
firewall-cmd --reload
systemctl restart mariadb
```

**验证**：从应用服务器 `mysql -h 172.16.1.51 -u wordpress -p` 能登录；站点恢复正常。

**预防**：授权按"最小权限 + 最小来源网段"原则；口令不写命令行（避免进历史），改用受权限保护的配置文件；数据库连接纳入拨测。

---

### MySQL 查询变慢

**现象**：页面加载缓慢，数据库 CPU 或 IO 升高；应用日志出现慢查询告警。

一步验证：`show full processlist` 先看有没有堆积的查询和锁等待，再对单条 SQL 跑 `explain`，全局和单点的顺序别反。

**可能原因**：

1. 缺少合适索引，导致全表扫描（概率最高）；
2. 慢查询堆积，连接池被占满；
3. 缓冲池（`innodb_buffer_pool_size`）配置过小，磁盘 IO 升高；
4. 锁等待或事务长时间未提交；
5. 表碎片过多或统计信息过期。

**排查步骤**：

1. 看当前正在执行的会话：

```bash
mysqladmin processlist
```

```sql
show full processlist;
show engine innodb status\G
```

2. 开启并查看慢日志：

```sql
show variables like 'slow_query_log%';
show variables like 'long_query_time';
```

3. 分析单条 SQL 的执行计划：

```sql
explain select * from wp_posts where post_date > '2026-01-01';
```

4. 看系统层面的资源瓶颈：

```bash
top
iostat -x 1
```

**解决方式**：按执行计划补索引，或改写 SQL：

```sql
alter table wp_posts add index idx_post_date (post_date);
```

调整缓冲池（一般为物理内存的 50% 至 70%）：

```ini
innodb_buffer_pool_size = 4G
```

**验证**：再次 `explain` 显示走索引、扫描行数下降；`mysqladmin processlist` 无长时间运行的查询；页面响应恢复。

**预防**：慢日志常态化开启并定期分析；新 SQL 上线前必须 `explain`；定期巡检索引与表碎片；关键查询纳入 APM。

---

### MySQL 无法启动

**现象**：`systemctl start mariadb` 失败；日志报 `Can't create/write to file` 或 `Permission denied`。

**可能原因**：

1. 数据目录属主不是 mysql 用户，或权限不对（概率最高）；
2. `/tmp` 目录权限异常（如被改成 1777 之外的宽松值或不可写）；
3. 磁盘空间或 inode 耗尽；
4. 配置文件语法错误或端口被占用；
5. 异常关机导致表空间损坏。

**排查步骤**：

1. 看详细报错：

```bash
journalctl -u mariadb -n 50 --no-pager
tail -50 /var/log/mariadb/mariadb.log
```

2. 确认数据目录与 /tmp 权限：

```bash
ls -ld /var/lib/mysql /tmp
```

3. 检查磁盘与 inode：

```bash
df -h
df -i
```

**解决方式**：修正属主与权限：

```bash
chown -R mysql.mysql /var/lib/mysql
chmod 700 /var/lib/mysql
chmod 755 /tmp
systemctl start mariadb
```

**验证**：`systemctl status mariadb` 为 active；`mysql -uroot -p -e "select 1;"` 返回 1。

常见误判：日志报 `Permission denied` 就上 `chmod 777`，别。先 `ls -ld /var/lib/mysql` 看属主，多数是没 chown 给 mysql；SELinux 机器上还要 `restorecon -Rv /var/lib/mysql` 重建上下文，权限改对了 SELinux 拦着照样起不来。

**预防**：不要随意修改 `/var/lib/mysql` 与 `/tmp` 权限；数据盘容量与 inode 纳入监控；使用规范的关闭流程，避免强杀数据库进程。

---

### rsync 认证失败

**现象**：`@ERROR: auth failed on module backup`；或 `password file must not be other-accessible`。

常见误判：auth failed 就反复改口令。先把两端文件 `cat` 出来对比格式——服务端 `用户:口令`、客户端只有口令，写反了怎么改都没用。

**可能原因**：

1. 服务端与客户端的口令不一致（概率最高）；
2. 密码文件权限不是 600；
3. 服务端 secrets file 格式写错（应为 `用户名:口令`，客户端只写口令）；
4. 模块名大小写或拼写错误；
5. rsync 服务端与客户端版本不兼容。

**排查步骤**：

1. 查看服务端配置：

```bash
cat /etc/rsyncd.conf
cat /etc/rsync.password
```

2. 核对密码文件权限：

```bash
ls -l /etc/rsync.password
ls -l /etc/rsync.pas
```

3. 手动执行推送复现：

```bash
rsync -avz /data/ rsync_backup@172.16.1.41::backup --password-file=/etc/rsync.password
```

**解决方式**：统一两端口令并修正权限：

```bash
echo "rsync_backup:<your-password>" > /etc/rsync.password      # 服务端：用户:口令
echo "<your-password>" > /etc/rsync.pas                        # 客户端：仅口令
chmod 600 /etc/rsync.password /etc/rsync.pas
```

**验证**：再次执行 rsync 命令成功，无 `@ERROR` 提示；服务端目录出现推送的文件。

**预防**：口令统一由配置管理下发；密码文件权限固化在部署脚本中；备份任务留日志便于回溯。

---

### rsync 连接被拒或超时

**现象**：`rsync: failed to connect to 172.16.1.41: Connection refused`；或连接长时间无响应后超时。

refused 先查服务端 rsyncd 起没起，timeout 查防火墙与链路，一张卡里的两种报错对应两个方向，别混着查。

**可能原因**：

1. rsyncd 服务未启动或 873 端口未监听（概率最高）；
2. 防火墙未放行 873 端口；
3. IP 地址或模块名写错；
4. SELinux 拦截；
5. 网络链路中断或安全组未放通。

**排查步骤**：

1. 服务端确认监听：

```bash
ss -lntp | grep 873
systemctl status rsyncd
```

2. 客户端探测端口：

```bash
nc -zv 172.16.1.41 873
```

3. 确认防火墙：

```bash
firewall-cmd --list-ports
```

**解决方式**：启动服务并放行端口：

```bash
systemctl enable --now rsyncd
firewall-cmd --permanent --add-port=873/tcp
firewall-cmd --reload
```

**验证**：`nc -zv 172.16.1.41 873` 成功；rsync 推送正常。

**预防**：rsyncd 设为开机自启；端口放行纳入服务上线清单；备份链路配置定时拨测。

---

### NFS 挂载超时

**现象**：`mount.nfs: Connection timed out`；或挂载命令长时间卡住无输出。

一步验证：先 `rpcinfo -p 服务端`，rpcbind 没起来时 111 端口直接不通，NFS 端口再多也没用；rpcinfo 有输出再查 2049 与 exports。

**可能原因**：

1. 服务端 `rpcbind` / `nfs-server` 未启动（概率最高）；
2. 防火墙未放通 111 / 2049 等端口；
3. 服务端 IP 写错，或网络不通；
4. 服务端 `/etc/exports` 未配置或格式错误；
5. NFS 版本协商失败（服务端与客户端版本不一致）。

**排查步骤**：

1. 从客户端测试基础连通：

```bash
ping -c 4 172.16.1.31
nc -zv 172.16.1.31 111
nc -zv 172.16.1.31 2049
```

2. 查看服务端 RPC 注册情况：

```bash
rpcinfo -p 172.16.1.31
showmount -e 172.16.1.31
```

3. 服务端确认服务状态：

```bash
systemctl status rpcbind nfs-server
firewall-cmd --list-services
```

**解决方式**：按顺序启动服务并放通防火墙：

```bash
systemctl enable --now rpcbind
systemctl enable --now nfs-server
firewall-cmd --permanent --add-service=nfs
firewall-cmd --permanent --add-service=rpc-bind
firewall-cmd --permanent --add-service=mountd
firewall-cmd --reload
```

客户端重新挂载：

```bash
mount -t nfs 172.16.1.31:/data/www /mnt/www
```

**验证**：`showmount -e` 能看到导出列表；`findmnt -t nfs` 显示挂载成功。

**预防**：服务端设置开机自启；防火墙规则随服务一起下发；挂载项加 `_netdev` 避免开机阻塞。

---

### NFS 挂载成功但无法写入

**现象**：挂载正常，但 `touch` 报 `Permission denied`；`id` 显示身份为 `nfsnobody`。

一步验证：`id` 看自己被压成了谁，`exportfs -v` 看服务端的 squash 选项，两条输出一对，映射关系就清楚了。

**可能原因**：

1. `root_squash` 将客户端 root 映射为 `nfsnobody`，而目录属主不是该用户（概率最高）；
2. 服务端导出目录权限不足（缺少 `w`）；
3. `anonuid` / `anongid` 映射的用户在服务端无写权限；
4. 导出选项只给了 `ro`；
5. 客户端与服务端的 uid 不一致。

**排查步骤**：

1. 看服务端导出选项：

```bash
cat /etc/exports
exportfs -v
```

2. 检查目录权限与身份：

```bash
ls -ld /data/www
id
id nfsnobody
```

**解决方式**：统一映射身份并授权目录：

```bash
useradd www -u 1002
chown -R www.www /data
```

在 exports 中指定映射 uid / gid：

```bash
sed -ri.bak 's#(sync)#\1,anonuid=1002,anongid=1002#g' /etc/exports
exportfs -r
```

确需保留 root 权限时使用 `no_root_squash`（**仅限内网可信环境**）：

```bash
/data/www 172.16.1.0/24(rw,sync,no_root_squash)
```

**验证**：在客户端挂载点执行 `touch test.txt && rm -f test.txt` 成功；服务端能看到文件属主为 www。

**预防**：集群内统一 www 用户的 uid / gid；谨慎使用 `no_root_squash`；目录权限在部署阶段一次性固化。

---

### keepalived 脑裂两台机器都有 VIP

**现象**：主备节点 `ip a` 都能看到 VIP；对外同时提供服务，数据出现错乱。

常见误判：备机出现 VIP 不一定是脑裂，先看主节点 keepalived 是不是停了或被 OOM 杀掉。VRRP 还有版本坑：v2 与 v3 不互通（`vrrp_version` 要一致），v3 不再支持 PASS 认证，主备版本配置不一致也会表现成脑裂。这里有个坑：云环境多数虚拟交换机默认拦组播，vrrp 通告到不了对端，改单播比反复查防火墙省事。

**可能原因**：

1. 心跳链路中断，备机收不到 VRRP 组播通告（概率最高）；
2. 防火墙或交换机安全策略拦截了 VRRP 组播；
3. 主备配置不一致，互相不认可对方的通告；
4. 网络闪断引发误判；
5. 虚拟机环境虚拟交换机限制组播。

**排查步骤**：

1. 两台机器分别确认 VIP 持有情况：

```bash
ip a | grep 10.0.0.3
```

2. 测试心跳链路：

```bash
ping -c 4 对端真实IP
```

3. 抓包看能否收到 VRRP 通告：

```bash
tcpdump -i eth0 vrrp -nn
```

4. 看切换日志：

```bash
journalctl -u keepalived -n 50 --no-pager
```

**解决方式**：先按预案快速恢复业务——关闭其中一台的 keepalived：

```bash
systemctl stop keepalived
```

再从机制上加固：

```bash
firewall-cmd --permanent --add-rich-rule='rule protocol value="vrrp" accept'
firewall-cmd --reload
```

云环境改用单播：

```conf
unicast_src_ip 10.0.0.5
unicast_peer {
    10.0.0.6
}
```

**验证**：`ip a | grep 10.0.0.3` 只在主节点出现；VIP 可正常访问。

**预防**：部署多链路心跳与仲裁机制；配置 `nopreempt` 与 `preempt_delay` 防止抖动；编写"备机出现 VIP 即告警"的监控脚本。

---

### keepalived 主节点故障 VIP 不漂移

**现象**：主节点服务已停止或机器宕机，VIP 仍停留在主节点，备节点没有接管。

一步验证：备机上 `journalctl -u keepalived -f` 实时盯着，主节点停服务的瞬间看备机有没有收发通告，日志不会说谎；没通告就查链路与防火墙，有通告不切换就查配置一致性。

**可能原因**：

1. 主备 `virtual_router_id` / `auth_pass` / `advert_int` 三项不一致（概率最高）；
2. `interface` 网卡名写错，VRRP 报文发不出去；
3. 防火墙拦截了 vrrp 协议；
4. 未配置 `vrrp_script`，服务故障时优先级不下降；
5. 备节点 keepalived 未运行或配置语法错误。

**排查步骤**：

1. 确认配置一致性：

```bash
grep -E "virtual_router_id|auth_pass|advert_int|interface|priority|state" /etc/keepalived/keepalived.conf
```

2. 检查服务状态与语法：

```bash
systemctl status keepalived
keepalived -t -f /etc/keepalived/keepalived.conf
```

3. 抓包确认通告收发：

```bash
tcpdump -i eth0 vrrp -nn
```

**解决方式**：统一主备三项参数，并加入服务健康检测：

```conf
vrrp_script chk_nginx {
    script       "/server/scripts/check_nginx.sh"
    interval     2
    weight      -20
    fall         3
    rise         2
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 150
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 1111
    }
    virtual_ipaddress {
        10.0.0.3/24 dev eth0
    }
    track_script {
        chk_nginx
    }
}
```

**验证**：手动停止主节点 nginx，观察 VIP 在数秒内漂移到备节点；`ip a` 与日志均能确认。

**预防**：主备配置通过模板生成，确保参数一致；切换演练常态化；VIP 归属纳入监控。

---

### 定时任务没有按预期执行

**现象**：脚本手工执行正常，放进 crontab 后不执行或执行结果与手工不一致。

**可能原因**：

1. cron 的 PATH 只有 `/usr/bin:/bin`，命令未写绝对路径（概率最高）；
2. crond 服务未启动，或时间字段的五段写法有误；
3. 脚本缺少可执行权限或 shebang 行；
4. cron 环境不加载用户 profile，自定义变量不可用；
5. `%` 未转义，被 cron 当作命令分隔符。

**排查步骤**：

1. 确认服务与任务内容：

```bash
systemctl status crond
crontab -l
cat /var/spool/cron/root
```

2. 看执行记录：

```bash
grep CMD /var/log/cron | tail -20
journalctl -u crond -n 30 --no-pager
```

3. 在任务中打印环境进行对比：

```bash
* * * * * /usr/bin/env > /tmp/cron_env.txt
```

**解决方式**：命令与路径全部写绝对路径，并显式定义 PATH：

```bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=""

# 每天 00:00 执行备份
00 00 * * * /bin/sh /server/scripts/backup.sh &>/dev/null

# 带日期的命令，% 必须转义
00 01 * * * /bin/tar zcf /backup/data_$(date +\%F).tar.gz /data
```

**验证**：等待一个执行周期，或临时改为每分钟执行；`grep CMD /var/log/cron` 能看到记录，产出文件符合预期。

一步验证的标准动作：先手动 `sh 脚本` 跑通，再把时间字段临时改成 `* * * * *`，等一分钟看 `/var/log/cron` 有没有 CMD 记录，通了再改回正式时间。

**预防**：所有 cron 任务统一使用绝对路径；脚本自带 PATH 定义；输出重定向到日志文件便于追踪；重要任务加监控（如文件时间戳检查）。

---

### Zabbix 监控数据不上报

**现象**：Web 界面主机图标不变绿；最新数据长时间未刷新；无告警产生。

常见误判：数据不上报就重启 agent。用 `zabbix_get -s IP -k agent.ping` 三段定位：agent 端口通不通、key 取值通不通、界面配置对不对，重启解决不了配置错误。

**可能原因**：

1. Agent 端 `Server` 参数未包含 Zabbix Server 地址，请求被拒（概率最高）；
2. Agent 服务未启动或 10050 端口未监听；
3. 防火墙未放行 10050 / 10051 端口；
4. 主机接口 IP 或模板宏地址配置错误；
5. 监控项未启用，或触发器表达式写错。

**排查步骤**：

Agent 端确认监听与配置：

```bash
systemctl status zabbix-agent
ss -lntup | grep 10050
grep -E "^Server|^Hostname" /etc/zabbix/zabbix_agentd.conf
```

在 Server 端主动取值测试：

```bash
zabbix_get -s 172.16.1.7 -k agent.ping
zabbix_get -s 172.16.1.7 -k system.uptime
```

查看两端日志：

```bash
tail -50 /var/log/zabbix/zabbix_agentd.log
tail -50 /var/log/zabbix/zabbix_server.log
```

**解决方式**：修正 Agent 配置并放行端口：

```bash
sed -i 's/^Server=.*/Server=172.16.1.71/' /etc/zabbix/zabbix_agentd.conf
systemctl restart zabbix-agent
firewall-cmd --permanent --add-port=10050/tcp
firewall-cmd --reload
```

自定义 key 取不到值时，确认 `UserParameter` 语法、脚本执行权限与 `Include` 目录：

```bash
grep -E "^Include" /etc/zabbix/zabbix_agentd.conf
ls -l /etc/zabbix/zabbix_agentd.d/
chmod +x /server/scripts/check.sh
```

**验证**：`zabbix_get -s IP -k agent.ping` 返回 1；Web 界面最新数据时间戳开始刷新；主机图标变绿。

**预防**：Agent 配置通过自动化下发；监控采集纳入自检（如定时检查最新数据时间）；模板变更先在测试机验证。

---

### yum 安装软件失败

**现象**：`Cannot find a valid baseurl for repo`；`Another app is currently holding the yum lock`；依赖报错。内网机器装不上包，九成是源的问题而不是包的问题。

常见误判：锁残留就 `kill -9`。先 `ps -ef | grep yum` 确认真的没有 yum 在跑，别把别人正在执行的安装任务杀掉。

**可能原因**：

1. yum 源配置失效或不可达（概率最高）；
2. 上一次 yum 进程未退出，锁文件残留；
3. 本机无法访问外网或 DNS 解析失败；
4. 缺少 EPEL 源，部分包找不到；
5. 源元数据缓存过期。

**排查步骤**：

1. 检查源列表与网络：

```bash
yum repolist
ping -c 4 223.5.5.5
dig mirrors.example.com
```

2. 检查残留进程：

```bash
ps -ef | grep yum
ls -l /var/run/yum.pid
```

**解决方式**：清理锁并重建缓存：

```bash
kill -9 <残留PID>
rm -f /var/run/yum.pid
yum clean all && yum makecache
yum install -y epel-release
yum provides 命令名                 # 定位命令属于哪个包
```

**验证**：`yum repolist` 正常输出；安装命令成功返回 `Complete!`。

**预防**：统一配置内网镜像源；批量安装通过脚本固化；定期校验源可用性。

---

### Ansible 剧本执行报错

**现象**：`ERROR! Syntax Error while loading YAML`；`'Data_dir' is undefined`；任务执行后未生效。

一步验证：`--syntax-check` 过了还报错，用 `--list-tasks` 看任务展开结果，再把可疑任务降级成 ad-hoc 单独跑，逐层缩小。

**可能原因**：

1. YAML 缩进错误（用了 tab、冒号后缺空格、列表项未对齐）（概率最高）；
2. 一个 `- name` 下挂了多个模块任务；
3. 变量未定义或作用域不对；
4. `notify` 与 handler 的 `name` 不一致，配置改了但服务没重载；
5. 被管端 Python 解释器路径不对。

**排查步骤**：

1. 语法检查定位行号：

```bash
ansible-playbook site.yml --syntax-check
ansible-playbook site.yml --list-tasks
```

2. 打印变量确认作用域：

```bash
ansible all -m debug -a "var=Data_dir"
ansible all -m setup -a "filter=ansible_all_ipv4_addresses"
```

3. 把剧本任务降级为 ad-hoc 命令单独测试：

```bash
ansible web -m yum -a "name=rsync state=installed" --check
```

4. 确认解释器：

```bash
ansible web -m ping
```

**解决方式**：修正缩进与结构，一个 `- name` 只挂一个模块：

```yaml
- name: 01-install rsync
  yum:
    name: ['rsync', 'tree', 'wget']
    state: installed

- name: 02-push config
  template:
    src: rsyncd.conf.j2
    dest: /etc/rsyncd.conf
  notify: restart rsyncd
```

指定 Python 解释器：

```ini
[web]
172.16.1.7 ansible_python_interpreter=/usr/bin/python3
```

**验证**：`ansible-playbook site.yml` 全部任务 `ok` 或 `changed`，无 `failed`；目标机配置与目标状态一致。

**预防**：剧本提交前跑 `--syntax-check`；变量统一放在 `group_vars`；优先使用幂等模块，减少 `shell`；复杂剧本先在测试环境跑一遍。

---

### 负载均衡后端节点收不到请求

**现象**：访问 LB 地址正常，但某台 Web 节点日志中始终没有请求；或访问返回 502。

常见误判：某节点没流量就以为挂了。先看 upstream 里有没有 `backup` / `down` 标记、有没有 `ip_hash` 把请求固定走，配置问题占多数，节点本身往往好好的。

**可能原因**：

1. 该节点在 `upstream` 中被标记了 `backup` 或 `down`（概率最高）；
2. `upstream` 定义写在了 `server` 块内（只允许在 `http` 块）；
3. 节点健康检查失败被自动摘除；
4. 使用 `ip_hash` 时请求被固定到某台节点；
5. 后端服务端口与 `proxy_pass` 中写的不一致。

**排查步骤**：

1. 在 LB 上逐个直连后端，确认节点本身可用：

```bash
curl -H "host: www.example.com" 10.0.0.7/test.html
curl -H "host: www.example.com" 10.0.0.8/test.html
```

2. 查看最终生效配置：

```bash
nginx -T | grep -A5 "upstream"
```

3. 确认后端端口监听：

```bash
ss -lntp | grep :80
```

4. 验证域名解析：

```bash
ping -c 2 www.example.com
dig www.example.com
```

**解决方式**：修正 upstream 配置，移除误加的标记：

```nginx
http {
    upstream web_pools {
        server 10.0.0.7:80 weight=1 max_fails=3 fail_timeout=10s;
        server 10.0.0.8:80 weight=1 max_fails=3 fail_timeout=10s;
    }

    server {
        listen 80;
        server_name www.example.com;

        location / {
            proxy_pass http://web_pools;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $remote_addr;
        }
    }
}
```

**验证**：多次 `curl` LB 地址，各后端 access.log 均能记录到请求；无 502。

**预防**：`upstream` 统一放在 `http` 块；节点上下线通过注释与 `down` 标记规范管理；后端健康状态纳入监控。

---

## 六、性能

### CPU 使用率过高

**现象**：`top` 中某个进程 `%CPU` 接近或超过 100%；系统响应变慢。

常见误判：CPU 100% 直接 kill 进程。先看 `top` 里 `us` 高还是 `wa` 高——`wa` 高实为磁盘瓶颈，杀进程解决不了，方向先定对。

**可能原因**：

1. 业务进程存在死循环或密集计算（概率最高）；
2. 流量突增，进程数 / 线程数不足导致排队；
3. 大量系统调用或上下文切换（`sy` 高）；
4. 频繁 I/O 等待表现为 CPU 占用（`wa` 高，实为磁盘问题）；
5. 被植入挖矿等恶意程序。

**排查步骤**：

1. 整体看 CPU 分布：

```bash
top
vmstat 1
mpstat -P ALL 1
```

2. 找出占用最高的进程与线程：

```bash
ps -eo pid,ppid,user,%cpu,%mem,comm --sort=-%cpu | head -15
top -H -p <PID>
```

3. 对 Java 等进程定位热点代码：

```bash
jstack <PID> > /tmp/jstack.txt
```

4. 看上下文切换与中断：

```bash
vmstat 1
cat /proc/interrupts | head -20
```

**解决方式**：确认是异常进程则先止损，再优化：

```bash
kill -15 <PID>                   # 优雅退出，无效再 kill -9
```

正常业务则按需扩容或调参（如增加 php-fpm 的 `pm.max_children`、nginx 的 `worker_processes`）。

**验证**：`top` 中 CPU 使用率回落；`vmstat` 中 `us`、`sy`、`wa` 回到基线；业务延迟恢复正常。

**预防**：CPU 使用率与 load 纳入监控告警；进程 CPU 占用设置阈值自动告警；定期进行代码性能剖析；主机安装基线安全加固与异常进程检测。

---

### 内存使用率过高

**现象**：`free -h` 中 `free` 很小；业务变慢甚至发生 OOM 杀进程。

常见误判：`free` 列小就喊内存不够。看 `available` 列才算数，buff/cache 高是内核在合理利用内存，可回收，不算问题。

**可能原因**：

1. buff/cache 被大量占用，属于正常可回收内存，不算真实紧张（概率最高，属误判）；
2. 应用内存泄漏，进程 RSS 持续增长；
3. 缓存类服务（Redis / Java 堆）配置过大；
4. swap 使用频繁导致整体卡顿；
5. 共享内存 / tmpfs 占用未纳入统计。

**排查步骤**：

1. 看整体概况（**判断内存是否紧张要看 available 列，而不是 free 列**）：

```bash
free -h
cat /proc/meminfo | grep -E "MemTotal|MemAvailable|Buffers|Cached"
```

2. 找出占用最高的进程：

```bash
ps -eo pid,user,%mem,rss,comm --sort=-rss | head -15
```

3. 观察 swap 与换页情况：

```bash
vmstat 1
sar -r 1
```

4. 查 OOM 记录：

```bash
dmesg -T | grep -i "out of memory"
journalctl -k | grep -i oom
```

**解决方式**：`buff/cache` 高不需处理；真实内存不足时降低服务内存上限或扩内存；swap 频繁时调整倾向：

```bash
sysctl -w vm.swappiness=10
echo "vm.swappiness = 10" > /etc/sysctl.d/99-vm.conf
sysctl --system
```

内存泄漏的应用需重启止血并排查代码。

**验证**：`free -h` 中 `available` 回升；`vmstat` 中 `si` / `so` 接近 0；无新增 OOM 记录。

**预防**：内存使用率与 swap 换页纳入监控；应用设置内存上限（如 Java `-Xmx`）；关键服务内存增长趋势定期巡检。

---

### 系统负载过高

**现象**：`w` / `uptime` 中 load average 远超 CPU 核数；操作卡顿但 CPU 使用率不一定高。

一步验证：`ps -eo pid,stat,comm | awk '$2 ~ /D/'` 找 D 状态进程，一堆 D 说明是 I/O 卡住而非 CPU 不够，扩 CPU 没用，去查存储链路。

**可能原因**：

1. 大量进程处于不可中断睡眠（D 状态），通常由磁盘或网络存储 I/O 引起（概率最高）；
2. 运行队列过长，CPU 真的不够用；
3. 大量短生命周期进程频繁创建销毁；
4. 存储（NFS / iSCSI）链路异常导致 I/O 挂起；
5. 内存不足引发换页，进一步推高负载。

**排查步骤**：

1. 看负载与 CPU 核数的关系：

```bash
w
nproc
cat /proc/loadavg
```

2. 区分是 CPU 还是 I/O 造成的：

```bash
top                        # 看 us / sy / wa
vmstat 1                   # 看 r、b 列与 wa
```

3. 找出 D 状态进程：

```bash
ps -eo pid,stat,comm | awk '$2 ~ /D/'
```

4. 定位 I/O 来源：

```bash
iostat -x 1
iotop -oPa
```

**解决方式**：`wa` 高与 D 状态进程多说明是 I/O 瓶颈，需优化磁盘或排查存储链路；`r` 列持续大于核数说明 CPU 不足，需扩容或优化热点逻辑。若是 NFS 挂起，先恢复服务端再重试：`umount -lf` 后重挂。

**验证**：`w` 中 load average 回落到核数以下；`vmstat` 中 `b` 列为 0，`wa` 接近 0。

**预防**：负载与 CPU 核数建立对应关系基线；I/O 与网络存储延迟纳入监控；容量规划定期进行。

---

### 磁盘 I/O 压力过高

**现象**：系统卡顿，命令执行缓慢；`iostat -x 1` 中 `%util` 接近 100%，`await` 明显升高。

常见误判：`%util` 高就申请换 SSD。先用 `iotop -oPa` 找到写入大户，业务侧限速、错峰往往当天就能解决，换盘是排后面的选项。

**可能原因**：

1. 大量随机小 I/O 写入（日志、数据库刷盘）（概率最高）；
2. 备份、同步任务在业务高峰期运行；
3. 内存不足引发换页；
4. 文件系统未开启 `noatime`，访问时间戳频繁更新；
5. 磁盘硬件性能不足或存在坏道。

**排查步骤**：

1. 设备级观测：

```bash
iostat -x 1
sar -d 1 10
```

2. 找出是哪个进程在写：

```bash
iotop -oPa
```

3. 看是否有换页：

```bash
vmstat 1
free -h
```

4. 回溯历史数据：

```bash
sar -d -f /var/log/sa/sa24
```

**解决方式**：短期止损（错峰或限速）：

```bash
ionice -c2 -n7 rsync -avz /data/ backup_host::backup
rsync -avz --bwlimit=20000 /data/ backup_host::backup
```

长期优化：fstab 加 `noatime,nodiratime`：

```bash
UUID=xxx  /data  xfs  defaults,noatime,nodiratime  0  0
mount -o remount /data
```

**验证**：`iostat -x 1` 中 `%util` 与 `await` 回落；业务延迟恢复。

**预防**：磁盘 `%util` / `await` 纳入监控；备份任务固定错峰并限速；机械盘随机小 I/O 场景考虑换 SSD 或做 I/O 合并。

---

### 连接数过高导致新建连接失败

**现象**：`ss -s` 显示连接数暴涨；无法建立新连接；日志报 `Cannot assign requested address`。

误判提示：客户端端口耗尽和服务端队列满（somaxconn）是两回事，先看报错出现在哪一端；`Cannot assign requested address` 多半是端口耗尽，连接被静默丢弃才查 somaxconn。

**可能原因**：

1. 大量短连接导致客户端端口耗尽（`ip_local_port_range` 太小）（概率最高）；
2. 监听队列满（`net.core.somaxconn` 过小），新连接被丢弃；
3. 连接泄漏，程序未正常关闭；
4. 遭受 SYN Flood 等攻击；
5. 文件描述符上限太低。

**排查步骤**：

1. 看连接总数与状态分布：

```bash
ss -s
ss -ant | awk 'NR>1 {print $1}' | sort | uniq -c | sort -rn
```

2. 按来源 IP 统计：

```bash
ss -ant | awk '{print $NF}' | sort | uniq -c | sort -rn | head
```

3. 确认端口范围与队列上限：

```bash
sysctl net.ipv4.ip_local_port_range
sysctl net.core.somaxconn
ulimit -n
```

**解决方式**：按需调整内核参数（写入 `/etc/sysctl.d/` 持久化）：

```bash
cat > /etc/sysctl.d/99-net.conf <<'EOF'
net.ipv4.ip_local_port_range = 10000 65000
net.core.somaxconn = 1024
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_syncookies = 1
EOF
sysctl --system
```

**验证**：`ss -s` 中连接数回落；新建连接恢复正常；无 `Cannot assign requested address` 报错。

**预防**：连接数与端口使用率纳入监控；应用侧使用连接池并正确关闭连接；接入层配置合理的限流与防攻击策略。

---

### TIME_WAIT 连接过多

**现象**：`ss -ant state time-wait | wc -l` 数值巨大；高并发下新建连接变慢。

常见误判：TIME_WAIT 多就乱清内核参数。它是本端主动关闭后的正常状态，量大自然出现；根治靠长连接与连接复用，调参数只是缓解。

**可能原因**：

1. 高并发短连接场景，本端主动关闭连接后进入 TIME_WAIT 并等待 2MSL（概率最高）；
2. 反向代理 / 网关类服务与后端之间频繁建连断连；
3. 未开启连接复用或长连接；
4. `tcp_max_tw_buckets` 配置过小导致主动丢弃；
5. 应用未使用 keepalive。

**排查步骤**：

1. 统计各状态数量：

```bash
ss -s
ss -ant | awk 'NR>1 {print $1}' | sort | uniq -c | sort -rn
```

2. 看具体是哪些连接：

```bash
ss -ant state time-wait | head -20
```

3. 确认相关参数：

```bash
sysctl net.ipv4.tcp_tw_reuse
sysctl net.ipv4.tcp_max_tw_buckets
```

**解决方式**：开启 TIME_WAIT 复用，并让上游使用长连接：

```bash
cat >> /etc/sysctl.d/99-net.conf <<'EOF'
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_timestamps = 1
net.ipv4.tcp_fin_timeout = 30
EOF
sysctl --system
```

Nginx  upstream 开启 keepalive：

```nginx
upstream web_pools {
    server 10.0.0.7:80;
    keepalive 32;
}

location / {
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_pass http://web_pools;
}
```

**验证**：`ss -ant state time-wait | wc -l` 明显下降；压测下新建连接成功率提升。

**预防**：代理类服务默认开启长连接；内核参数纳入初始化模板；TIME_WAIT 数量纳入监控。

---

### CLOSE_WAIT 连接堆积

**现象**：`ss -antp | grep CLOSE-WAIT` 数量持续增长且不释放；最终耗尽文件描述符。

**可能原因**：

1. 应用程序收到对端 FIN 后未调用 `close()`，连接停留在 CLOSE_WAIT（概率最高）；
2. 代码异常分支未释放连接（如 try 块外抛异常）；
3. 连接池配置不当，连接未归还；
4. 依赖服务主动断开，本端未感知；
5. 程序版本存在已知的连接泄漏缺陷。

这里有个坑：CLOSE_WAIT 堆积是应用没调 `close()`，内核参数救不了，重启只是止血，别在内核侧浪费时间。

**排查步骤**：

1. 统计 CLOSE_WAIT 数量与归属进程：

```bash
ss -antp | grep -c CLOSE-WAIT
ss -antp | grep CLOSE-WAIT | head -20
```

2. 看进程打开的文件描述符数：

```bash
ls /proc/<PID>/fd | wc -l
lsof -p <PID> | wc -l
```

3. 对比历史趋势确认是否持续泄漏：

```bash
sar -n SOCK 1 10
```

**解决方式**：CLOSE_WAIT 是**应用侧问题**，内核参数无法根治。先重启服务止血，再由开发修复代码中未关闭连接的地方（确保 `finally` 块中关闭、连接池正确归还）。

**验证**：重启后 CLOSE_WAIT 归零；观察一个业务周期，数量不再持续增长。

**预防**：代码 review 关注资源释放；文件描述符使用率纳入监控；连接池配置最大空闲与超时回收；升级到修复了泄漏的版本。

---

### 高并发报 too many open files

**现象**：服务日志中出现 `too many open files`；或 `fork: retry: Resource temporarily unavailable`。

一步验证：改完 `systemctl restart` 后 `cat /proc/<PID>/limits | grep "open files"` 确认生效——limits.conf 对 systemd 服务不生效是最大的坑，unit 里必须写 `LimitNOFILE`。

**可能原因**：

1. 进程的文件描述符限制（`ulimit -n`）过小（概率最高）；
2. 系统级 `fs.file-max` 上限不足；
3. systemd service 未设置 `LimitNOFILE`，沿用默认值；
4. 连接 / 文件句柄泄漏，未及时关闭；
5. `nproc` 限制太小，无法创建新进程。

**排查步骤**：

1. 查看当前限制：

```bash
ulimit -n
ulimit -u
sysctl fs.file-max
```

2. 查看某进程的硬限制与实际用量：

```bash
cat /proc/<PID>/limits | grep "open files"
ls /proc/<PID>/fd | wc -l
```

3. 看系统级已分配句柄数：

```bash
cat /proc/sys/fs/file-nr
```

**解决方式**：推荐为服务单独设置（不影响全局）：

```bash
systemctl edit nginx
```

```ini
[Service]
LimitNOFILE=65535
```

```bash
systemctl daemon-reload
systemctl restart nginx
```

全局调整：

```bash
cat > /etc/security/limits.d/99-nofile.conf <<'EOF'
*       soft    nofile  65535
*       hard    nofile  65535
EOF
```

重新登录后生效，用 `ulimit -n` 验证。

**验证**：`cat /proc/<PID>/limits | grep "open files"` 显示新值；高并发压测不再报 `too many open files`。

**预防**：服务 unit 中固化 `LimitNOFILE`；句柄使用率纳入监控；应用侧确保连接与文件及时关闭。

---

### swap 使用频繁导致卡顿

**现象**：`free -h` 中 swap 使用量持续上升；`vmstat` 中 `si` / `so` 不为 0；系统响应时快时慢。

误判提示：swap 用了一点就紧张没必要，关键是 `si` / `so` 持续不为 0 才是真在频繁换页；偶有占用且数值稳定，属正常缓冲。

**可能原因**：

1. 物理内存不足，内核持续换页（概率最高）；
2. `vm.swappiness` 默认值偏高（60）；
3. 数据库 / 缓存服务内存配置过大；
4. 内存泄漏导致 RSS 持续增长；
5. 内存容量规划未考虑业务增长。

**排查步骤**：

1. 看 swap 概况：

```bash
free -h
swapon --show
cat /proc/sys/vm/swappiness
```

2. 观察换页速率：

```bash
vmstat 1
sar -r 1
```

3. 找出吃内存的进程：

```bash
ps -eo pid,user,%mem,rss,comm --sort=-rss | head -15
```

**解决方式**：降低 swap 倾向，优先从内存与配置层面解决：

```bash
sysctl -w vm.swappiness=10
echo "vm.swappiness = 10" > /etc/sysctl.d/99-vm.conf
sysctl --system
```

临时应急可扩 swap（仅为缓冲，不能替代加内存）：

```bash
dd if=/dev/zero of=/tmp/1G bs=100M count=10
chmod 600 /tmp/1G
mkswap /tmp/1G
swapon /tmp/1G
```

**验证**：`vmstat 1` 中 `si` / `so` 回到 0；`free -h` 中 swap 使用量稳定。

**预防**：内存与 swap 换页纳入监控；数据库、缓存服务按物理内存合理分配；容量不足及时扩容而非依赖 swap。

---

### 日志增长把磁盘写满

**现象**：磁盘使用率快速上涨；`du -sh /var/log/*` 显示某个日志巨大；服务写入失败。

常见误判：直接 `rm` 正在写入的日志。rm 之后空间不释放（进程还占着 fd），要用 `> 文件` 清空或走轮转，这张卡和「删除文件后空间未释放」是同一根源。

**可能原因**：

1. 日志级别调得过低（debug / info），输出量剧增（概率最高）；
2. logrotate 配置缺失或轮转周期过长；
3. 服务轮转后未重新打开日志文件，仍写旧 fd；
4. 异常循环导致同一错误反复刷屏；
5. 访问量突增带动访问日志暴涨。

**排查步骤**：

1. 定位大日志：

```bash
du -sh /var/log/* 2>/dev/null | sort -hr | head -10
```

2. 看高频报错来源：

```bash
tail -1000 /var/log/messages | awk '{print $5}' | sort | uniq -c | sort -rn | head
```

3. 检查轮转配置与状态：

```bash
cat /etc/logrotate.d/nginx
cat /var/lib/logrotate/logrotate.status
```

**解决方式**：先止血——**不要直接 `rm` 正在写入的日志**，用清空方式释放空间：

```bash
> /var/log/nginx/access.log
```

再补轮转配置并让服务重开文件：

```bash
logrotate -f /etc/logrotate.d/nginx
systemctl reload nginx
```

**验证**：`df -h` 使用率下降；日志按周期正常轮转，无超大文件残留。

**预防**：所有服务统一配置 logrotate；`postrotate` 中重载服务；日志级别按环境区分；对 `/var/log` 单独分区或设容量告警。

---

## 排错速查索引

按症状关键词检索对应故障卡。「类别」列对应本文的六个大类简称：启动、磁盘、网络、权限、服务、性能。

### 启动与登录类

| 症状关键词 | 故障卡 | 类别 |
| --- | --- | --- |
| 开不了机、卡在启动界面、emergency mode | 系统启动卡住无法进入登录界面 | 启动 |
| `grub rescue`、`no such partition` | GRUB 引导损坏进入 grub rescue | 启动 |
| 忘记密码、重置 root 口令 | 忘记 root 密码需要重置 | 启动 |
| `Connection refused`、SSH 连不上 | SSH 登录提示 Connection refused | 启动 |
| 连接超时、卡住无响应 | SSH 连接超时无响应 | 启动 |
| 登录慢、等十几秒 | SSH 登录特别慢 | 启动 |
| `su: Authentication failure`、切换后命令找不到 | su 切换用户失败或环境变量异常 | 启动 |
| `not in the sudoers file` | sudo 提权报 is not in the sudoers file | 启动 |
| 改完密码仍无法登录 | 单用户模式改完密码仍无法登录 | 启动 |

### 磁盘与文件系统类

| 症状关键词 | 故障卡 | 类别 |
| --- | --- | --- |
| `No space left on device`、`Use%` 100% | 磁盘空间满 No space left on device | 磁盘 |
| `IUse%` 100%、小文件太多 | inode 耗尽导致无法创建文件 | 磁盘 |
| 删了文件空间不降、df 与 du 不符 | 删除文件后磁盘空间没有释放 | 磁盘 |
| `Read-only file system` | 文件系统突然变成只读 | 磁盘 |
| fstab 写错、开机卡 mount | fstab 配置错误导致系统无法启动 | 磁盘 |
| `lvextend` 后 df 不变 | LVM 扩容后 df 看不到容量变化 | 磁盘 |
| `Insufficient free space` | LVM 扩容报 insufficient free space | 磁盘 |
| `Stale file handle` | NFS 挂载报 Stale file handle | 磁盘 |
| `target is busy`、卸载失败 | 卸载文件系统报 target is busy | 磁盘 |
| `wrong fs type`、`special device does not exist` | 挂载报 wrong fs type 或 special device does not exist | 磁盘 |

### 网络类

| 症状关键词 | 故障卡 | 类别 |
| --- | --- | --- |
| ping 不通、同网段不通 | 同网段 ping 不通 | 网络 |
| 能 ping 但端口不通 | 能 ping 通但端口访问不通 | 网络 |
| `unknown host`、域名解析失败 | DNS 解析失败 | 网络 |
| 解析慢、时快时慢 | DNS 解析时快时慢 | 网络 |
| 没有 IP、169.254 | 网卡没有拿到 IP 地址 | 网络 |
| 无法访问外网、无默认路由 | 缺少默认路由无法访问外网 | 网络 |
| bonding 不生效、网卡绑定异常 | bonding 网卡绑定异常 | 网络 |
| ARP、网关不可达 | ARP 异常与网关不可达 | 网络 |
| IP 冲突、克隆机 | 克隆虚拟机后网络不通或 IP 冲突 | 网络 |
| 监听正常但外部访问不了 | 服务监听正常但访问被拒 | 网络 |

### 权限与用户类

| 症状关键词 | 故障卡 | 类别 |
| --- | --- | --- |
| `Permission denied`、属性显示 `???` | 执行文件或访问目录提示 Permission denied | 权限 |
| 用户无法登录、账号不可用 | 用户无法通过 SSH 或本地登录 | 权限 |
| sudo 认证失败、不在 sudoers | sudo 报 not in sudoers 或认证失败 | 权限 |
| 密码过期、强制改密 | 密码过期或被强制要求修改 | 权限 |
| SUID、提权风险 | SUID 权限带来的提权风险 | 权限 |
| 属主显示数字 | 文件属主显示为数字 UID | 权限 |
| `-bash-4.2$` 提示符 | 新用户登录后提示符显示为 -bash-4.2$ | 权限 |
| 777 却改不动 | 文件权限为 777 却无法修改 | 权限 |
| ACL 不生效、`effective` | ACL 授权后仍然无法访问 | 权限 |
| 加组后原组丢失 | usermod 加组后原有组丢失 | 权限 |

### 服务与应用类

| 症状关键词 | 故障卡 | 类别 |
| --- | --- | --- |
| 502 Bad Gateway | Nginx 返回 502 Bad Gateway | 服务 |
| 504 Gateway Timeout | Nginx 返回 504 Gateway Timeout | 服务 |
| 403 Forbidden | Nginx 返回 403 Forbidden | 服务 |
| 404 Not Found | Nginx 返回 404 Not Found | 服务 |
| 413、上传失败 | 上传文件报 413 Request Entity Too Large | 服务 |
| nginx 起不来、端口占用 | Nginx 无法启动或端口被占用 | 服务 |
| php-fpm、动态页面异常 | php-fpm 与 Nginx 不通 | 服务 |
| 数据库连不上、Error establishing | MySQL 远程连接被拒 | 服务 |
| 慢查询、数据库慢 | MySQL 查询变慢 | 服务 |
| 数据库起不来 | MySQL 无法启动 | 服务 |
| `@ERROR: auth failed` | rsync 认证失败 | 服务 |
| rsync 连接被拒 | rsync 连接被拒或超时 | 服务 |
| NFS 挂载超时、`Connection timed out` | NFS 挂载超时 | 服务 |
| NFS 不能写 | NFS 挂载成功但无法写入 | 服务 |
| 脑裂、两台都有 VIP | keepalived 脑裂两台机器都有 VIP | 服务 |
| VIP 不漂移 | keepalived 主节点故障 VIP 不漂移 | 服务 |
| cron 不执行 | 定时任务没有按预期执行 | 服务 |
| Zabbix 无数据、图标不变绿 | Zabbix 监控数据不上报 | 服务 |
| yum 报错、装不上包 | yum 安装软件失败 | 服务 |
| Ansible 剧本报错 | Ansible 剧本执行报错 | 服务 |
| 后端收不到请求 | 负载均衡后端节点收不到请求 | 服务 |

### 性能类

| 症状关键词 | 故障卡 | 类别 |
| --- | --- | --- |
| CPU 高、`%CPU` | CPU 使用率过高 | 性能 |
| 内存高、`free` 小 | 内存使用率过高 | 性能 |
| load average 高 | 系统负载过高 | 性能 |
| IO 高、`%util` 满 | 磁盘 I/O 压力过高 | 性能 |
| 连接数高、端口耗尽 | 连接数过高导致新建连接失败 | 性能 |
| `TIME_WAIT` 多 | TIME_WAIT 连接过多 | 性能 |
| `CLOSE_WAIT` 多 | CLOSE_WAIT 连接堆积 | 性能 |
| `too many open files` | 高并发报 too many open files | 性能 |
| swap 频繁 | swap 使用频繁导致卡顿 | 性能 |
| 日志暴涨 | 日志增长把磁盘写满 | 性能 |

---

## 附：通用排错命令速查

| 场景 | 命令 |
| --- | --- |
| 看系统日志（本次启动） | `journalctl -xb` |
| 看某服务日志 | `journalctl -u 服务名 -n 50 --no-pager` |
| 实时跟踪日志 | `tail -f /var/log/messages` |
| 看登录审计 | `tail -50 /var/log/secure` |
| 看内核环缓冲 | `dmesg -T \| tail -50` |
| 综合性能视图 | `vmstat 1`、`top`、`w` |
| 磁盘 I/O 设备级 | `iostat -x 1` |
| 磁盘 I/O 进程级 | `iotop -oPa` |
| 历史性能回溯 | `sar -d -f /var/log/sa/saXX` |
| 端口与连接 | `ss -lntp`、`ss -s`、`ss -ant` |
| 网卡与地址 | `ip addr`、`ip link`、`ip -s link` |
| 路由与选路 | `ip route`、`ip route get 目标IP` |
| DNS 解析 | `dig 域名`、`dig @DNS服务器 域名` |
| 端口连通性探测 | `nc -zv IP 端口` |
| 抓包 | `tcpdump -i 网卡 [过滤条件] -nn` |
| 找占用文件的进程 | `lsof +D 目录`、`fuser -mv 目录` |
| 找已删除未释放的文件 | `lsof +L1`、`lsof \| grep deleted` |
| 逐级看路径权限 | `namei -l 完整路径` |
| 看文件特殊属性 | `lsattr 文件` |
{% endraw %}
