---
title: "day21-用户与权限管理作业实操"
date: 2026-10-24 09:37:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-21"
---

{% raw %}

本篇对应课程第 21 天（用户与权限管理）的课后作业，共四题：①批量创建用户 stu01..stu10 并给每个用户设置随机密码；②写出 `/etc/passwd` 与 `/etc/shadow` 每一列的含义对照；③给指定用户配置 sudo 权限；④说清 `su` 与 `su -` 的区别。第一题沿用 day17 的「随机信息 + 变量 + 循环」三要素框架，随机生成与循环部分真跑，`useradd`/`chpasswd` 建号动作为 B 级预期输出；第二、三、四题以对照表与标准命令为主，配合本环境可真跑的解析演示。

## 实操环境说明

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令（RANDOM、md5sum、tr、/dev/urandom、openssl、seq、for 循环等）在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令（`useradd`/`chpasswd`/`visudo`/`su -`）给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`，并说明真机执行方式。

实操目录统一用 `/tmp/hw/day21`。环境实测：GNU bash 5.3.15；`useradd`、`chpasswd` 在本环境不存在（已用 `command -v` 验证，返回非 0），`/etc/passwd` 在本环境不可读，故建号与账号文件部分按 B 级处理。命令输出中的属主统一显示为 `user`，所有口令要么用 `<your-password>` 占位，要么用脚本现场随机生成的示例串。

## 题目总览

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 批量创建 stu01..stu10 并给每个用户设置随机密码 | 随机/循环 A 级 + 建号 B 级 |
| 题 2 | `/etc/passwd` 与 `/etc/shadow` 每列含义对照 | awk 取列 A 级 + 字段表 B 级 |
| 题 3 | 给指定用户配置 sudo 权限（visudo 语法） | B 级 |
| 题 4 | `su` 与 `su -` 的区别（环境变量差异） | B 级 |

## 题 1：批量创建用户 stu01..stu10 并设置随机密码

**考察点**：如何生成随机信息、变量设置（含命令替换）、循环语句（for），以及三者如何串成一个幂等可重复执行的批量建号脚本。这一题与 day17 的 user01..user10 是同型题，只是用户名换成 stu 前缀、密码加长到 10 位。

**实现思路**：把大题拆成三步分别验证，再合成完整脚本——①先用三种方法真跑随机串生成，选定 `/dev/urandom` + `tr` 作为主力；②用 `seq -w` 补零生成 stu01..stu10；③循环里每次生成一个随机密码并拼成 `用户名:密码` 格式，本环境用 `[DRYRUN]` 干跑验证逻辑，真机上把干跑行换成 `useradd` + `chpasswd` 即可。

### 知识点 1：随机密码的三种生成方法（已实操）

#### 方法 1：`$RANDOM` + md5 截取

```bash
echo $RANDOM
echo $RANDOM | md5sum | cut -c 1-8
for i in 1 2 3; do echo $RANDOM | md5sum | cut -c 1-8; done
```

输出：

```console
$ echo $RANDOM
15497
$ echo $RANDOM | md5sum | cut -c 1-8
c84c9258
$ for i in 1 2 3; do echo $RANDOM | md5sum | cut -c 1-8; done
550ea5f4
512ad017
7e6a9b41
```

`$RANDOM` 是 bash 内置变量，范围 0~32767，直接当密码太短且纯数字；过一遍 `md5sum` 再 `cut -c 1-8` 截取，就得到定长十六进制串。零依赖是它的最大优点。

#### 方法 2：`/dev/urandom` + `tr` 过滤字符集（本题采用）

```bash
tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 10; echo
for i in 1 2 3; do tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 10; echo; done
```

输出：

```console
$ tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 10; echo
PK28sDqX83
$ for i in 1 2 3; do tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 10; echo; done
4hXEtsNOSe
pzR81XTDc9
RZfFDScPxg
```

拆解：`tr -dc 'a-zA-Z0-9'` 中 `-d` 是删除、`-c` 是取补集，合起来等于「只保留字母和数字」；`head -c 10` 取前 10 个字节，正好满足 10 位密码的题目要求。本题最终采用这一方法。

#### 方法 3：`openssl rand`（已实操）

```bash
openssl rand -base64 12
openssl rand -hex 8
```

输出：

```console
$ openssl rand -base64 12
/38hF8dIvrudCJz4
$ openssl rand -hex 8
5ff2162bf5fb8c78
```

命令最短、随机性最好，但 base64 输出可能含 `+` `/` `=`，给密码用建议再 `tr -d '+/='` 过滤一遍；`-hex` 输出纯十六进制，长度是字节数的 2 倍。

三种方法对比：

| 方法 | 命令 | 优点 | 缺点 |
| --- | --- | --- | --- |
| `$RANDOM` + md5 | `echo $RANDOM \| md5sum \| cut -c 1-8` | 零依赖，纯 bash 内置 | 只有十六进制字符 |
| `/dev/urandom` + tr | `tr -dc 'a-zA-Z0-9' </dev/urandom \| head -c 10` | 字符集可控、长度精确 | 命令稍长 |
| openssl rand | `openssl rand -base64 12` | 最短、随机性最好 | base64 可能含 `+/=`，需二次过滤 |

### 知识点 2：seq -w 补零生成用户名序列（已实操）

```bash
seq -w 1 10 | head -3
for n in $(seq -w 1 10); do echo "stu${n}"; done | head -3
```

输出：

```console
$ seq -w 1 10 | head -3
01
02
03
$ for n in $(seq -w 1 10); do echo "stu${n}"; done | head -3
stu01
stu02
stu03
```

`seq -w` 自动按最大值的宽度补零，10 以内就是两位。也可以用 `{01..10}` 大括号展开，但范围含变量时大括号不展开，所以脚本里统一用 `seq -w` 更通用。

### 知识点 3：循环拼接 用户名:密码（已实操）

```bash
for n in $(seq -w 1 10); do
  user="stu${n}"
  pass=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 10)
  echo "${user}:${pass}"
done
```

输出：

```console
stu01:GAdgYafawM
stu02:v8gcGFUwyA
stu03:jkLrk5EKad
stu04:zWCP2ZW8ug
stu05:zIPOmIazhf
stu06:1p3mdkbTeR
stu07:v4HgGRV5Q7
stu08:ebBwZWw7O3
stu09:wt4pxg6xRF
stu10:gDJb4aIwlg
```

每行输出都是 `chpasswd` 认的 `用户名:密码` 输入格式，10 个密码两两不同、长度都是 10。变量赋值两个要点：`=` 两边不能有空格；把命令结果存变量用 `$(命令)`。

### 完整脚本：干跑验证 + 真机落地

先在本环境用 `[DRYRUN]` 干跑版验证循环与变量拼接逻辑（已实操）：

```bash
cat > /tmp/hw/day21/batch_stu.sh <<'EOF'
#!/bin/bash
# 批量创建用户 stu01..stu10 并设置 10 位随机密码
PASS_FILE=/tmp/hw/day21/stu_pass.txt
: > "$PASS_FILE"

for n in $(seq -w 1 10); do
    user="stu${n}"
    if id "$user" &>/dev/null; then    # 已存在则跳过，保证脚本幂等
        echo "$user 已存在，跳过"
        continue
    fi
    useradd "$user"                    # 创建用户
    pass=$(tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 10)
    echo "${user}:${pass}" | chpasswd  # 非交互式设密码
    echo "${user}:${pass}" >> "$PASS_FILE"
    echo "$user 创建完成"
done
chmod 600 "$PASS_FILE"
EOF
bash -n /tmp/hw/day21/batch_stu.sh && echo "语法 OK"
sed 's/^    useradd /    echo "[DRYRUN] useradd "/; s/^    echo "\${user}:${pass}" | chpasswd/    echo "[DRYRUN] chpasswd ${user}"/' /tmp/hw/day21/batch_stu.sh > /tmp/hw/day21/dryrun.sh
bash /tmp/hw/day21/dryrun.sh
```

输出（语法检查与干跑均为真实结果）：

```console
$ bash -n /tmp/hw/day21/batch_stu.sh && echo "语法 OK"
语法 OK
$ bash /tmp/hw/day21/dryrun.sh
[DRYRUN] useradd stu01
[DRYRUN] chpasswd stu01
stu01 创建完成
[DRYRUN] useradd stu02
[DRYRUN] chpasswd stu02
stu02 创建完成
（中略，stu03..stu09 格式相同）
[DRYRUN] useradd stu10
[DRYRUN] chpasswd stu10
stu10 创建完成
```

密码清单文件内容格式如下（`cat /tmp/hw/day21/stu_pass.txt`，每次运行内容不同）：

```text
stu01:MB10qLx8Ol
stu02:4GqdhgMwVs
stu03:dzeg0Zsvsb
stu04:oTheAgOpX5
stu05:cng0A9SmL8
stu06:9rt8kgcVae
stu07:PeUlhkR7WA
stu08:ddzfiLj6kc
stu09:0WtoBkvXrk
stu10:bjd9zP0OhR
```

> **说明**：以上密码串是脚本运行时随机生成的示例，仅作格式演示；真机执行后请以实际生成的清单为准，并立即 `chmod 600` 保管、交付后删除。本环境 `command -v useradd` 与 `command -v chpasswd` 均返回非 0（不存在），`id stu01` 报 `no such user`，故建号动作为 B 级。

CentOS 7 上以 root 执行的预期输出：

```console
# sh /tmp/hw/day21/batch_stu.sh
stu01 创建完成
stu02 创建完成
（中略）
stu10 创建完成
```

### 验证方法（真机执行后）

```bash
id stu01                        # 单个用户是否建成
tail -10 /etc/passwd            # 是否新增 10 条 stu 开头记录
grep -c "^stu" /etc/passwd      # 新增用户数量应为 10
wc -l < /tmp/hw/day21/stu_pass.txt   # 密码清单行数应为 10
su - stu01                      # 用清单里的密码实际登录验证一次
```

预期输出（CentOS 7）：

```console
$ id stu01
uid=1001(stu01) gid=1001(stu01) groups=1001(stu01)
$ tail -3 /etc/passwd
stu08:x:1008:1008::/home/stu08:/bin/bash
stu09:x:1009:1009::/home/stu09:/bin/bash
stu10:x:1010:1010::/home/stu10:/bin/bash
$ grep -c "^stu" /etc/passwd
10
$ wc -l < /tmp/hw/day21/stu_pass.txt
10
```

> **易错点**：
>
> - 建用户必须 root 执行，普通用户跑 `useradd` 报 `Permission denied`；
> - `passwd --stdin` 是 RHEL 系专有，跨平台一律用 `chpasswd`；
> - 脚本重复执行会报「用户已存在」，靠 `id "$user" &>/dev/null && continue` 做幂等保护；
> - 密码清单含口令，必须 `chmod 600` 且交付后删除，绝不入库、不贴群；
> - `tr ... < /dev/urandom | head -c 10` 在部分系统上 `head` 提前退出会让 `tr` 收到 SIGPIPE（`tr: write error: Broken pipe`），属正常现象可忽略；用 `/dev/urandom`，别用会阻塞的 `/dev/random`。

> **参见**：用户管理 · day17 批量建用户真跑

## 题 2：/etc/passwd 与 /etc/shadow 每列含义对照

**考察点**：账号体系两大核心文件的结构。`/etc/passwd` 全局可读（任何进程都要靠它把 uid 翻译成用户名），所以密码只留占位符 `x`，真实密文放在仅 root 可读的 `/etc/shadow`——这是「为什么要有两个文件」的标准答案。

**实现思路**：先用 awk 对一行标准 passwd 记录做按列解析，直观看到 7 列的分界（A 级），再给出两份逐列对照表（B 级，真机用 `head /etc/passwd` 与 `head /etc/shadow` 核对）。

### awk 按列解析演示（已实操）

本环境 `/etc/passwd` 不可读，用一条标准记录演示按 `:` 分列：

```bash
echo 'root:x:0:0:root:/root:/bin/bash' | awk -F: '{print NF" 列"} {print "第1列="$1; print "第3列="$3; print "第6列="$6; print "第7列="$7}'
```

输出：

```console
7 列
第1列=root
第3列=0
第6列=/root
第7列=/bin/bash
```

真机上核对用：

```bash
head -5 /etc/passwd
head -5 /etc/shadow        # 需要 root
grep "^stu01" /etc/passwd /etc/shadow
```

预期输出（CentOS 7）：

```console
$ head -5 /etc/passwd
root:x:0:0:root:/root:/bin/bash
bin:x:1:1:bin:/bin:/sbin/nologin
daemon:x:2:2:daemon:/sbin:/sbin/nologin
adm:x:3:4:adm:/var/adm:/sbin/nologin
lp:x:4:7:lp:/var/spool/lpd:/sbin/nologin
```

### /etc/passwd 七列对照表

以 `stu01:x:1001:1001::/home/stu01:/bin/bash` 为例：

| 列 | 示例值 | 含义 |
| --- | --- | --- |
| 1 | `stu01` | 用户名 |
| 2 | `x` | 密码占位符，真实密文在 `/etc/shadow` |
| 3 | `1001` | uid（0 为 root，1-999 系统/虚拟用户，1000+ 普通用户） |
| 4 | `1001` | 主要组 gid |
| 5 | （空） | 注释说明，如 `manager database` |
| 6 | `/home/stu01` | 家目录 |
| 7 | `/bin/bash` | 登录 shell；`/sbin/nologin` 表示不能交互登录 |

### /etc/shadow 九列对照表

以 `stu01:$6$xxxx...:19900:0:99999:7:::` 为例：

| 列 | 示例值 | 含义 |
| --- | --- | --- |
| 1 | `stu01` | 用户名（与 passwd 第一列对应） |
| 2 | `$6$...` | 加密密码；`!` 或 `*` 开头表示锁定，`!!` 表示未设密码 |
| 3 | `19900` | 最后一次改密距 1970-01-01 的天数 |
| 4 | `0` | 两次改密的最小间隔天数 |
| 5 | `99999` | 密码有效天数 |
| 6 | `7` | 到期前警告天数 |
| 7 | （空） | 过期后宽限天数，超过禁用账号 |
| 8 | （空） | 账号过期天数，超过禁用账号 |
| 9 | （空） | 保留字段 |

第二列密文的 `$id$` 前缀标识哈希算法：`$1$` MD5（已不安全）、`$5$` SHA-256、`$6$` SHA-512（现代系统默认）、`$y$` yescrypt。

> **易错点**：
>
> - `/etc/passwd` 与 `/etc/group` 全局可读、`/etc/shadow` 与 `/etc/gshadow` 仅 root 可读——密码绝不能出现在全局可读文件里；
> - 登录不了先查两处：第七列是不是 `/sbin/nologin`、shadow 第二列是不是 `!`（被锁）；
> - 属主显示为纯数字 uid，说明对应账号被删了（`userdel` 不带 `-r` 的常见后遗症）。

> **参见**：用户管理 · 用户权限与提权

## 题 3：给指定用户配置 sudo 权限

**考察点**：`visudo` 的语法检查价值、sudoers 行的「用户 主机=(身份) 命令」四段结构、`sudo -l` 验证方式，以及最小权限原则。

**实现思路**：以给 ops 用户授权「建用户、删文件」两条命令为例，走「visudo 编辑 → 语法检查 → sudo -l 验证 → 实际执行」四步；再给一份常见写法对照表。真机操作流程如下（B 级）。

### 步骤 1：visudo 编辑授权（B 级）

```bash
visudo                     # 必须用 visudo 而不是 vi /etc/sudoers，前者保存时自动做语法检查
```

在文件中按格式添加（第 90 行附近）：

```conf
ops  ALL=(ALL)  /usr/sbin/useradd, /usr/bin/rm
```

sudoers 每行的四段结构：

| 段 | 写法 | 说明 |
| --- | --- | --- |
| 用户/组 | `ops` / `%wheel` | 单个用户或组（组加 `%`） |
| 主机 | `ALL` | 规则生效的主机，多环境可精确限定 |
| 身份 | `(ALL)` 或 `(root)` | 允许切换到的目标用户 |
| 命令 | `/usr/sbin/useradd` | 必须绝对路径，多个命令逗号分隔 |

常见写法对照：

```conf
ops    ALL=(ALL)       /usr/sbin/useradd, /usr/bin/rm     # 授权指定命令
%wheel ALL=(ALL)       ALL                                # wheel 组全部权限（RHEL 默认）
ops    ALL=(ALL)       NOPASSWD: /usr/sbin/useradd        # 免密执行指定命令
ops    ALL=(ALL)       /usr/sbin/*, !/usr/sbin/visudo     # 授权目录并排除特权命令
```

### 步骤 2：语法检查（B 级）

```bash
visudo -c
```

预期输出（CentOS 7）：

```console
# visudo -c
/etc/sudoers: parsed OK
```

### 步骤 3：验证与使用（B 级）

```bash
su - ops
sudo -l                        # 查看自己被授权了哪些命令（输自己的密码）
sudo useradd stu11             # 实际提权执行
```

预期输出（CentOS 7）：

```console
[ops@linux-node1 ~]$ sudo -l
User ops may run the following commands on linux-node1:
    (ALL) /usr/sbin/useradd, /usr/bin/rm
[ops@linux-node1 ~]$ sudo useradd stu11
[ops@linux-node1 ~]$ id stu11
uid=1011(stu11) gid=1011(stu11) groups=1011(stu11)
```

> **易错点**：
>
> - 直接 `vi /etc/sudoers` 写错语法会导致所有用户无法 sudo，且 sudoers 不可再编辑，只能单用户模式救回——永远用 `visudo`；
> - 授权目录时必须用 `!` 排除 `visudo`、`su`、`passwd root` 等特权命令，否则等于送出完整 root；
> - 永远不要授权 shell 类命令（`/bin/bash`、`vi`、`find`），在它们内部都能逃逸出 root shell；
> - sudo 校验的是**用户自己的密码**，不是 root 密码；校验通过后默认 5 分钟内免密，`sudo -k` 立即作废。

> **参见**：用户权限与提权

## 题 4：su 与 su - 的区别

**考察点**：两者唯一的差别在**环境变量的加载程度**——`su` 只部分切换（HOME 变了，USER、PATH、MAIL 等仍保留原用户），`su -` 完整加载目标用户的登录环境（PATH、USER、MAIL、PWD、HOME 全部切换，工作目录也切到家目录）。日常运维一律用 `su -`。

**实现思路**：对比两段 `env` 输出就能说清。以普通用户 ops 切换到 root 为例（B 级）。

### 使用 su 切换（部分切换，B 级）

```bash
su root
env | egrep 'USER=|MAIL=|PATH=|PWD=|HOME='
```

预期输出（CentOS 7）：

```console
[ops@linux-node1 ~]$ su root
Password:
[root@linux-node1 ops]# env | egrep 'USER=|MAIL=|PATH=|PWD=|HOME='
USER=ops
MAIL=/var/spool/mail/ops
PATH=/usr/local/bin:/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/home/ops/.local/bin:/home/ops/bin
PWD=/home/ops
HOME=/root
```

注意现象：HOME 变成了 `/root`，但 `USER`、`MAIL`、`PATH`、`PWD` 仍然是 ops 的。最致命的是 **PATH 里没有 `/sbin` 与 `/usr/sbin`**，切换后执行 `useradd` 这类 sbin 命令会报 `command not found`。

### 使用 su - 切换（完全切换，B 级）

```bash
su - root
env | egrep 'USER=|MAIL=|PATH=|PWD=|HOME='
```

预期输出（CentOS 7）：

```console
[ops@linux-node1 ~]$ su - root
Password:
Last login: Sat Oct 24 08:51:40 CST 2026 on pts/0
[root@linux-node1 ~]# env | egrep 'USER=|MAIL=|PATH=|PWD=|HOME='
USER=root
MAIL=/var/spool/mail/root
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin:/root/bin
PWD=/root
HOME=/root
```

全部字段切换为 root，PATH 包含 sbin 目录，工作目录切到 `/root`。

### 两种写法与 sudo 的三方对比

| 维度 | `su 用户` | `su - 用户` | `sudo -i` |
| --- | --- | --- | --- |
| 环境变量 | 部分切换（USER/MAIL/PATH 保留原用户） | 完整加载目标用户环境 | 接近登录 shell，环境干净 |
| 工作目录 | 不变 | 目标用户家目录 | root 家目录 |
| 需要的密码 | 目标用户密码 | 目标用户密码 | **自己的密码** |
| 审计日志 | 弱（仅记录 su 调用） | 弱 | 强（记录执行人、命令、时间） |
| 典型风险 | PATH 不全导致命令找不到 | root 权限泛滥、密码扩散 | 需先配置 sudoers |

运维实践的选择：需要完全模拟某用户登录场景时用 `su - 用户`；日常管理优先 `sudo -i`——密码是自己的、操作有审计、不用把 root 密码告诉所有人。

> **易错点**：
>
> - `su` 切换后找不到 `useradd` 等命令，不是命令没装，是 PATH 里没有 `/usr/sbin`，改用 `su -` 即可；
> - `su` 与 `su -` 之间不加用户名默认切 root，但生产环境强烈建议显式写清目标用户；
> - 排查「su 之后环境不对」统一用 `env | egrep 'USER=|PATH=|PWD='` 对照检查。

> **参见**：用户权限与提权

## 小结

1. 批量建号 = 三要素合体：随机信息用 `tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 10`，序列用 `seq -w 1 10` 自动补零，循环里变量拼接 `user="stu${n}"` 后喂给 `useradd` + `chpasswd`；脚本加 `id` 判断做幂等，密码清单 `chmod 600` 用完即删。
2. 随机串三法各有取舍：`$RANDOM`+md5 零依赖但字符集窄，`/dev/urandom`+tr 字符集与长度最可控（本题主力），`openssl rand` 最短但 base64 需二次过滤。
3. `/etc/passwd` 七列 = 用户名、密码占位 `x`、uid、gid、注释、家目录、登录 shell；`/etc/shadow` 九列 = 用户名、密文（`!`/`*` 为锁定）、改密天数与一组有效期字段。前者全局可读所以密码只放 `x`，后者仅 root 可读。
4. sudo 授权四步走：`visudo` 编辑（自带语法检查）、`visudo -c` 复核、`sudo -l` 验证、`sudo 命令` 执行；命令必须绝对路径，授权目录必须 `!` 排除特权命令，绝不授权 shell 类命令。
5. `su` 部分切换环境变量（PATH 缺 sbin 目录是最大坑），`su -` 完整切换；日常管理首选 `sudo -i`（自己的密码 + 全程审计），需要完全模拟登录场景时才用 `su - 用户`。
6. 登录类故障的排查链路固定：`grep 用户 /etc/passwd` 看第七列 shell → `grep 用户 /etc/shadow` 看是否锁定 → `id 用户` 看账号是否存在 → `lastb` 看是否有暴力破解。
{% endraw %}
