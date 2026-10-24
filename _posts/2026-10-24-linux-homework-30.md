---
title: "day30 作业实操：NFS 存储服务"
date: 2026-10-24 09:28:00 +0800
categories: [软件, Linux, 作业实操]
tags: [Linux, 作业实操]
---

{% raw %}
课程第 30 天（NFS 存储服务）的作业三道题：①实现 fstab 文件自动挂载的特殊服务是什么？②研究 user 参数作用；③NFS 服务部署过程。第①题给出答案（CentOS 7 的 `remote-fs.target` / CentOS 6 的 `netfs`）并真跑 fstab 条目校验；第②题把 fstab 第 4 列的 `user` 参数研究透，给出与默认行为的对照；第③题完整复盘 NFS 服务端部署六步与客户端挂载流程，其中输出解析部分真跑、系统服务部分给标准命令与预期输出。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker；Git Bash 自带的 `mount` 是 Cygwin 实现，不能挂 NFS），因此采用分级实操：

- **A 级（已真实执行）**：fstab 条目编写与 awk 语法校验、showmount 输出解析、`/var/lib/nfs/etab` 导出参数提取，在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；实操目录 `/tmp/hw/day30`；
- **B 级（标准命令 + 预期输出）**：`yum` 安装、`systemctl` 启动 rpcbind 与 nfs、`showmount`、`mount -t nfs` 等系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

主机名沿用 day27 的规划：nfs01（172.16.1.31）为存储服务端，web01（172.16.1.7）等为客户机，输出中的本地用户名已按脱敏要求替换为 `user`。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 实现 fstab 文件自动挂载的特殊服务是什么 | 答案解析 + fstab 条目校验 A 级真跑，systemctl 验证 B 级 |
| 题 2 | 研究 user 参数的作用 | fstab 条目对比 A 级真跑，普通用户挂载效果 B 级 |
| 题 3 | NFS 服务部署过程复盘 | 输出解析 A 级真跑，服务端部署与挂载 B 级 |

## 题 1：实现 fstab 文件自动挂载的特殊服务是什么？

**考察点**：`/etc/fstab` 的六个字段、网络型文件系统（NFS）为什么开机会挂载失败、CentOS 7 的 `remote-fs.target` 与 CentOS 6 的 `netfs` 在启动流程中的位置、`_netdev` 参数的作用。

**答案**：**CentOS 7 及以上是 `remote-fs.target` 服务，CentOS 6 是 `netfs` 服务**。fstab 在系统启动的最早期（网络还没就绪时）就被读取，本地的磁盘分区那时已经能挂，但 NFS 这类网络文件系统必须等网络与 rpcbind 就绪之后才能挂载成功——所以需要这个「专门重挂网络文件系统」的特殊服务，在系统启动的后期再把 fstab 里的 NFS 条目挂上来。fstab 条目里同时要给 NFS 加 `_netdev` 参数，声明「这是网络设备」，让系统等网络就绪后再挂。

### 步骤 1：编写 fstab NFS 条目示例（已实操）

```bash
mkdir -p /tmp/hw/day30 && cd /tmp/hw/day30
cat > fstab.example <<'EOF'
# /etc/fstab 示例（仅截取 NFS 相关行）
# 设备(服务端:目录)      挂载点   文件系统  挂载参数                     dump  pass
172.16.1.31:/data       /mnt     nfs      defaults,_netdev             0     0
172.16.1.31:/data       /mnt     nfs      defaults,_netdev,ro          0     0
EOF
cat -n fstab.example
```

输出：

```text
     1	# /etc/fstab 示例（仅截取 NFS 相关行）
     2	# 设备(服务端:目录)      挂载点   文件系统  挂载参数                     dump  pass
     3	172.16.1.31:/data       /mnt     nfs      defaults,_netdev             0     0
     4	172.16.1.31:/data       /mnt     nfs      defaults,_netdev,ro          0     0
```

fstab 六个字段逐一说明：第 1 列是设备（NFS 写成 `服务端IP:导出目录`）；第 2 列是挂载点；第 3 列是文件系统类型（nfs）；第 4 列是挂载参数；第 5 列 dump 备份标记（0 即不备份）；第 6 列 fsck 开机自检顺序（0 表示不检查，网络文件系统必须写 0）。

### 步骤 2：awk 校验条目语法（已实操）

fstab 格式错误会让系统开机卡住或跳过挂载，写完必须校验——每条非注释行必须恰好 6 个字段：

```bash
cd /tmp/hw/day30
awk '!/^#/ && NF!=6 {print "第 " NR " 行字段数=" NF "，错误"; bad=1} !/^#/ && NF==6 {print "第 " NR " 行 OK: 设备="$1" 挂载点="$2" 类型="$3" 参数="$4}' fstab.example
[ -z "$bad" ] && echo "全部行校验通过"
```

输出：

```text
第 3 行 OK: 设备=172.16.1.31:/data 挂载点=/mnt 类型=nfs 参数=defaults,_netdev
第 4 行 OK: 设备=172.16.1.31:/data 挂载点=/mnt 类型=nfs 参数=defaults,_netdev,ro
全部行校验通过
```

两行都是 6 字段且关键列取值正确。这个 awk 一行式可以直接用在真机上校验 `/etc/fstab`：`awk '!/^#/ && NF!=6 {print FILENAME": 第 "NR" 行字段数="NF}' /etc/fstab`，无输出即格式合格。

### 步骤 3：真机启用并验证（预期输出，CentOS 7）

```bash
# 启用负责挂载网络文件系统的特殊服务（本题答案）
systemctl enable remote-fs.target

# 手动按 fstab 挂一次验证条目写对了没有（不重启）
mount -a

# 确认挂载生效
df -h | grep /mnt
```

输出：

```text
172.16.1.31:/data    50G  1.2G   49G   3% /mnt
```

`mount -a` 无报错且 `df -h` 能看到 NFS 设备挂在 /mnt 上，说明 fstab 条目与 remote-fs.target 配置都正确；重启后该服务会自动把这条挂上。

> **易错点**：
>
> - 忘记 `systemctl enable remote-fs.target` 是「fstab 写了 NFS 却开机会不挂」的第一大原因（CentOS 6 对应 `netfs`）；
> - 忘记 `_netdev` 会让系统在网络未就绪时就去挂 NFS，表现为开机卡住数十秒或挂载失败；
> - 第 6 列（pass）给 NFS 写 1 或 2 会导致开机对网络文件系统跑 fsck，必须写 0；
> - 改完 fstab 不要直接重启验证，先 `mount -a` 手动挂一次，条目写错当场就能发现。

## 题 2：研究 user 参数的作用

**考察点**：fstab 第 4 列挂载选项中 `user` / `nouser` / `users` 的语义与默认值、`user` 隐含的安全选项（noexec / nosuid / nodev）、它与 NFS 服务端 squash 权限体系（`anonuid` / `anongid`，参数名里也带 user 但完全是两回事）的区分。

**实现思路**：`user` 是「允许普通用户挂载/卸载该条目」的开关。默认行为是 `nouser`——只有 root 能执行 mount；加了 `user` 之后，普通用户也能对该条目执行挂载与卸载，但这会带来安全面扩大，所以内核对 `user` 隐含套上 `noexec,nosuid,nodev` 三个保险。先在沙箱里把两种条目写出来并对比校验（A 级），再给普通用户挂载的真机预期效果（B 级）。

### 步骤 1：构造 user 与 nouser 两条目并对比（已实操）

```bash
cd /tmp/hw/day30
cat > fstab.user.example <<'EOF'
# 设备                 挂载点  类型  参数                       dump pass
172.16.1.31:/data      /mnt    nfs   defaults,_netdev           0    0
172.16.1.31:/data      /mnt    nfs   defaults,_netdev,user      0    0
172.16.1.31:/data      /mnt    nfs   defaults,_netdev,nouser    0    0
EOF
echo "--- 参数列（第 4 列）对比 ---"
awk '!/^#/{print "行"NR-1": 参数="$4"  含user="($4~/user/? "是":"否")}' fstab.user.example
```

输出：

```text
--- 参数列（第 4 列）对比 ---
行1: 参数=defaults,_netdev  含user=否
行2: 参数=defaults,_netdev,user  含user=是
行3: 参数=defaults,_netdev,nouser  含user=是
```

注意第 3 行的 `nouser` 用正则 `~ /user/` 同样会命中「含 user」，说明**做关键字匹配时要用精确字段比较**（如 `$4 ~ /(,|^)user(,|$)/`）而不是子串匹配——这本身就是研究参数时容易踩的正则坑。

### 步骤 2：三种写法的行为对照表

| 写法 | 普通用户能 mount 吗 | 普通用户能 umount 吗 | 备注 |
| --- | --- | --- | --- |
| 默认（等价 nouser） | 否 | 否 | 只有 root 可挂卸 |
| `user` | 是 | 是（限本人挂载的那次） | 隐含 noexec,nosuid,nodev |
| `users` | 是 | 是（任何人可卸任何人挂的） | 多人共用挂载点时用 |
| `owner` | 是（限文件属主） | 是 | 少用 |

### 步骤 3：普通用户实际挂载效果（预期输出，CentOS 7）

fstab 中该条目带 `user` 时：

```text
[ops@web01 ~]$ mount /mnt
[ops@web01 ~]$ touch /mnt/ops_file.txt && ls -l /mnt/ops_file.txt
-rw-r--r-- 1 nfsnobody nfsnobody 0 Oct 24 10:00 /mnt/ops_file.txt
[ops@web01 ~]$ umount /mnt
[ops@web01 ~]$ echo 卸载成功
```

同样的条目去掉 `user`（默认 nouser）时：

```text
[ops@web01 ~]$ mount /mnt
mount: only root can do that
[root@web01 ~]# umount /mnt
umount: /mnt: umount failed: Operation not permitted   # 普通用户在挂载点内卸载被拒
```

普通用户挂载成功后创建的文件属主显示为 `nfsnobody`，这是服务端 exports 默认 `root_squash` / `no_all_squash` 把身份映射的结果，与 `user` 参数无关——`user` 管「谁能挂」，squash 管「挂上后你是谁」，两层权限体系不要混淆。

> **易错点**：
>
> - `user` 隐含 `noexec,nosuid,nodev`：如果挂载点上要跑脚本或二进制，会莫名「Permission denied」，需要显式补回 `exec`；
> - `user` 只对「写进 fstab 的条目」生效，手动 `mount -t nfs ...` 不受它管；
> - 别把 fstab 的 `user` 参数与服务端 exports 的 `anonuid` / `anongid`（指定匿名映射用户）搞混，后者才是服务端的「用户映射」配置；
> - 生产环境挂载点应保持默认 nouser，普通用户需要共享目录时用 ACL 或组权限解决，而不是放开挂载权。

## 题 3：NFS 服务部署过程复盘

**考察点**：NFS 依赖 RPC 的原理（rpcbind 注册随机端口）、服务端部署六步的顺序约束（先 rpcbind 后 nfs）、`/etc/exports` 格式与生效方式、客户端挂载全流程（showmount → mount → 写 fstab）、squash 系列与 `anonuid` / `anongid` 用户映射。

**实现思路**：按「服务端部署 → 检查注册 → 客户端挂载 → 权限验证」的链路复盘。每一步都给出真机标准命令与预期输出；输出内容（showmount 导出清单、etab 生效参数）在沙箱里还原并真跑解析，把「部署完应该看到什么」变成可逐项核对的清单。

### 步骤 1：服务端部署六步（预期输出，CentOS 7）

```bash
# 第一个历程：下载安装（服务端 nfs-utils + rpcbind 两个都要）
yum install -y nfs-utils rpcbind

# 第二个历程：编写配置文件 /etc/exports，格式：共享目录 客户端(参数)
echo '/data   172.16.1.0/24(rw,sync)' >/etc/exports

# 第三个历程：创建存储目录并改属主为 nfsnobody（匿名映射用户）
mkdir /data
chown nfsnobody.nfsnobody /data

# 第四个历程：先启动 rpcbind，再启动 nfs（顺序不能颠倒）
systemctl start rpcbind && systemctl enable rpcbind
systemctl start nfs && systemctl enable nfs

# 第五个历程：修改 exports 后让它生效（不必重启服务）
exportfs -r

# 第六个历程：检查注册信息
rpcinfo -p 172.16.1.31
```

输出（节选）：

```text
program vers proto   port  service
 100000    4   tcp    111  portmapper
 100000    3   tcp    111  portmapper
 100024    1   tcp  49863  status
 100005    1   tcp  20048  mountd
 100005    2   tcp  20048  mountd
 100005    3   tcp  20048  mountd
```

看到 `mountd` 与 `status` 出现在注册表里，说明 NFS 的随机端口已成功注册到 rpcbind（111 端口）；如果输出里只有 `portmapper` 一族，就是先启动了 nfs、后启动 rpcbind，顺序错了——把 nfs 重启一次即可完成注册。

这里顺便交代一下版本差异，理解了它才能理解「为什么要有 rpcbind」：CentOS 7 默认跑的 NFSv3 除了 2049 主端口外还要 mountd、statd、lockd 等一堆随机端口，全靠 rpcbind 注册查询，防火墙因此很难配。NFSv4 把这些功能全部收编进 2049 一个端口，不再依赖 rpcbind——如果条件允许直接上 v4，挂载时 `-t nfs4`，防火墙策略能简化一大截。

### 步骤 2：客户端查询导出清单（解析已实操，命令 B 级）

真机在 web01 上执行：

```bash
showmount -e 172.16.1.31
```

输出：

```text
Export list for 172.16.1.31:
/data            172.16.1.0/24
/backup_ro       172.16.1.0/24
```

把这份输出落盘后用 awk 解析成「可挂载目录 + 允许网段」清单（已实操）：

```bash
cd /tmp/hw/day30
cat > showmount-e.txt <<'EOF'
Export list for 172.16.1.31:
/data            172.16.1.0/24
/backup_ro       172.16.1.0/24
EOF
awk 'NR>1 && NF>=2 {printf "可挂载目录: %-12s 允许网段: %s\n", $1, $2}' showmount-e.txt
```

输出：

```text
可挂载目录: /data        允许网段: 172.16.1.0/24
可挂载目录: /backup_ro   允许网段: 172.16.1.0/24
```

挂载前先 `showmount -e` 确认「服务端到底导出了什么、我的 IP 在不在允许网段里」，能提前拦下大半的 `access denied by server` 类报错。

### 步骤 3 之前：客户端一次 NFS 挂载的全过程（文字复盘）

理解挂载命令背后发生了什么，排错才有方向。一次 `mount -t nfs 172.16.1.31:/data /mnt` 的完整过程：

```text
1. 客户端内核连接服务端 111 端口（rpcbind），询问：mountd 在哪个端口？
2. rpcbind 返回 mountd 的端口号（如 20048）。
3. 客户端连接 mountd，告知要挂载的路径 /data。
4. 服务端 mountd 检查 /etc/exports：确认客户端 IP 在允许网段，读取导出参数。
5. mountd 返回文件句柄（file handle），客户端把它与本地挂载点 /mnt 关联。
6. 之后对 /mnt 的每次读写，都经 NFS 协议（程序号 100003）发给服务端 nfsd 处理。
7. 卸载时同样经 mountd 通知服务端，解除挂载关系。
```

由此可以反推三类故障的位置：连不上 111 端口是 rpcbind 未启动或被防火墙拦截；showmount 查不到是 exports 没写对或没 exportfs -r；挂上了但读写报错是 squash 映射后的权限问题。

### 步骤 3：客户端挂载与 fstab 落盘（命令 B 级 + 校验 A 级）

```bash
# 手动挂载
mount -t nfs 172.16.1.31:/data /mnt
df -h | grep /mnt

# 卸载不掉（有进程占用）时强制卸载
umount -lf /mnt
```

输出：

```text
172.16.1.31:/data    50G  1.2G   49G   3% /mnt
```

写入 fstab 开机自动挂载（条目见题 1，`_netdev` + `remote-fs.target` 缺一不可）；mount 常用参数速查：

| 参数 | 含义 |
| --- | --- |
| `rw` / `ro` | 挂载点可读写 / 只读 |
| `nosuid` | setuid 位失效，提升共享目录安全性 |
| `noexec` | 挂载点内不可执行文件 |
| `_netdev` | 标记为网络设备，等网络就绪再挂 |
| `noatime` | 不更新访问时间，减少服务端写入 |
| `hard` / `soft` | 服务端失联时无限重试 / 超时报错（关键业务禁 soft） |

### 步骤 4：检查服务端实际生效的导出参数（解析已实操）

服务端查看「编译默认值 + 配置值合并后的最终参数」：

```bash
cat /var/lib/nfs/etab
```

输出（一行，已还原到沙箱）：

```text
/data	172.16.1.0/24(rw,sync,wdelay,hide,nocrossmnt,secure,root_squash,no_all_squash,no_subtree_check,secure_locks,acl,no_pnfs,anonuid=65534,anongid=65534,sec=sys)
```

把关键参数提取出来（已实操）：

```bash
cd /tmp/hw/day30
echo '/data	172.16.1.0/24(rw,sync,wdelay,hide,nocrossmnt,secure,root_squash,no_all_squash,no_subtree_check,secure_locks,acl,no_pnfs,anonuid=65534,anongid=65534,sec=sys)' > etab.example
tr ',' '\n' < etab.example | grep -E 'squash|anonuid|anongid|^rw|sync'
```

输出：

```text
sync
root_squash
no_all_squash
anonuid=65534
anongid=65534
```

即使 exports 里只写了 `(rw,sync)`，实际生效的参数里也带着默认的 `root_squash`、`no_all_squash`、`anonuid=65534,anongid=65534`——这正是「root 客户端写文件属主变 nfsnobody」的原因。想指定映射到别的用户（如 www，uid/gid 假设为 1002）：

```conf
/data   172.16.1.0/24(rw,sync,anonuid=1002,anongid=1002)
```

squash 系列行为速查：

| 参数 | 行为 |
| --- | --- |
| `root_squash`（默认） | 客户端 root → 映射为 anonuid 指定的匿名用户 |
| `no_root_squash` | 保留 root 身份（危险，客户端沦陷即服务端沦陷） |
| `all_squash` | 所有用户（含普通用户）都映射为匿名用户 |
| `no_all_squash`（默认） | 普通用户保留自身身份（要求两端 UID 一致） |

`root_squash` 为什么要默认开启，值得多想一层：NFS 是信任客户端的协议，客户端声称「我是 UID 0」服务端无法验证真伪。如果保留 root 身份，任何一台客户端的 root 都能对共享目录为所欲为——改属主、读任意文件、往 `authorized_keys` 里塞公钥，等于把存储服务端的 root 间接开放给全网段。压成匿名用户后，客户端 root 的破坏半径被限制在「匿名用户有权限的那点范围」。这也是为什么生产上严禁 `no_root_squash` 除非有极其明确的理由，且范围必须用具体 IP 而不是网段收窄。

### 验证方法

1. 服务端 `rpcinfo -p` 能看到 mountd / status（注册成功）；`showmount -e 本机` 能列出导出清单；
2. 客户端 `showmount -e 服务端` 查到导出目录且本机在允许网段内；
3. `mount -t nfs` 后 `df -h` 出现对应条目，`touch /mnt/测试文件` 成功且属主符合 squash 预期；
4. `mount -a` 无报错 + `systemctl is-enabled remote-fs.target` 为 enabled，开机自动挂载链路完整。

> **易错点**：
>
> - 启动顺序：先 rpcbind 后 nfs，颠倒了随机端口注册不上，客户端挂载报 Connection timed out；
> - 改 `/etc/exports` 后必须 `exportfs -r` 生效；生产环境用 `exportfs -r` 平滑生效，`systemctl restart nfs` 会断开所有客户端连接；
> - 挂载成功但写文件 Permission denied：先查三层权限——目录本身权限（属主是否 nfsnobody）、exports 参数（rw 还是 ro、squash 映射成谁）、客户端 mount 参数（ro 会盖过服务端 rw）；
> - exports 里 `客户端(参数)` 的括号前后**不能有空格**，写成 `/data 172.16.1.0/24 (rw,sync)` 会被解析成两个客户端条目；
> - 服务端重启后客户端报 Stale file handle：`umount -lf` 强制卸载后重新挂载即可。

### 辨析：sync 与 async

exports 里的 `(rw,sync)` 之 `sync` 管的是**服务端什么时候落盘**，与客户端 mount 参数里的同名选项（管客户端缓存行为）不是一回事，别弄混：

- `sync`：服务端把数据写进磁盘之后才回复客户端「写成功」。慢一点，但服务端哪怕下一秒断电，客户端已经收到确认的数据都在盘上；
- `async`：服务端先把数据放内存缓冲就回复成功，攒一批再落盘。快不少，代价是断电或服务崩溃时，缓冲里没落盘的那一段——客户端以为写成功了——会凭空消失。

文件系统默认导出参数就是 `sync`（`/var/lib/nfs/etab` 里能看到），这个默认别随手改成 async 图性能。共享存储上放的是业务数据，丢了就是事故，async 省下的那点延迟买不回这个风险；真要追求写入性能，正规路线是上 SSD 或调 NFS 线程数，而不是在落盘语义上动手脚。

## 小结

1. fstab 自动挂载网络文件系统的特殊服务：CentOS 7+ 是 `remote-fs.target`，CentOS 6 是 `netfs`；NFS 条目必须带 `_netdev`，改完 fstab 先 `mount -a` 验证再谈重启。
2. fstab 六字段里 NFS 的三个特殊点：设备写成 `IP:目录`、类型为 nfs、第 6 列 pass 必须为 0；awk `NF!=6` 一行式可随时校验 fstab 格式。
3. `user` 参数让普通用户可挂载/卸载该 fstab 条目（默认 nouser 仅 root 可操作），代价是隐含 `noexec,nosuid,nodev`；它管「谁能挂」，服务端 squash 管「挂上后你是谁」，两层体系别混淆。
4. NFS 部署六步：装 nfs-utils + rpcbind → 写 exports（`目录 网段(参数)`，括号内不留空格）→ 建目录改属主 nfsnobody → 先 rpcbind 后 nfs → `exportfs -r` 生效 → `rpcinfo -p` 验证注册。NFSv4 收编了随机端口，可以不依赖 rpcbind。
5. 客户端挂载三步走：`showmount -e` 确认导出清单与允许网段 → `mount -t nfs` 手动验证 → 落 fstab（`_netdev`）并启用 `remote-fs.target` 实现开机自动挂载。
6. `/var/lib/nfs/etab` 记录实际生效参数：即使只写 `(rw,sync)`，默认也带 `root_squash,no_all_squash,anonuid=65534,anongid=65534`，这就是 root 身份被转换成 nfsnobody 的出处；`root_squash` 是 NFS 信任模型下唯一的安全垫，生产上别关。`sync` 管服务端落盘时机，保持默认。
7. 共享目录最终权限由三处共同决定：目录自身权限、exports 导出参数、客户端 mount 参数，排查权限问题时按这三层自上而下过一遍。

> **参见**：存储服务 NFS · 备份服务 rsync · day29 全网备份项目作业实操
{% endraw %}
