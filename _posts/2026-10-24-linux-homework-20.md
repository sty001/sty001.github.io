---
title: "day20-chmod权限总结作业实操"
date: 2026-10-24 09:38:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-20"
---

{% raw %}



课程第 20 天要求总结 chmod 命令的使用方法，是典型的「总结型」题目，按规范转化为「知识讲解 + 速查表 + 可直接运行的示例及真实输出 + 自测」。内容覆盖：数字法与字母法完整语法、八进制换算表、递归 `-R`、参考 `--reference`、常见场景（755/644/600/700 怎么选）、权限位与 umask 的关系、特殊权限位（SUID/SGID/Sticky）简述。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级/依赖真实文件系统的命令给出 CentOS 7 标准预期输出，标注 `预期输出`。

**本篇有一处必须说明的环境限制**：本环境的磁盘是 Windows NTFS，Git Bash 以 `noacl` 方式挂载，因此 `chmod` **不是真正的 POSIX 权限操作**。实测诊断如下（已实操）：

```console
$ mount | grep -E '^C:|^D:'
C: on /c type ntfs (binary,noacl,posix=0,user,noumount,auto)
D: on /d type ntfs (binary,noacl,posix=0,user,noumount,auto)
C:/Users/user/AppData/Local/Temp on /tmp type ntfs (binary,noacl,posix=0,usertemp)

$ touch demo.txt; chmod 600 demo.txt
$ echo "chmod 返回码: $?"; stat -c '%a' demo.txt
chmod 返回码: 0
644
```

`chmod` 退出码是 0（命令执行成功），但权限位没变——挂载选项里的 `noacl` 表示 NTFS 未启用 POSIX ACL，`chmod` 只能切换 DOS 的「只读」属性位。因此：

- **chmod 的生效演示列为 B 级**（给 CentOS 7 预期输出），并附上本环境的诊断方法；
- **本环境可真跑的部分**（A 级）：权限位读取（`ls -l` / `stat -c %a`）、权限位解析、umask 与新建文件权限的关系、八进制换算计算，以及一个**权限模拟器脚本**——它能真实执行并算出任意 chmod 表达式的结果，用来验证你对 chmod 算法的理解是否到位。

实操目录为 `/tmp/hw/day20`。输出中的本地用户名已按脱敏要求统一替换为 `user`。

## 题目总览
{: .sec-prac}

| 题号 | 内容（精简复述） | 分级 |
| --- | --- | --- |
| 1 | 权限位基础：rwx 对文件与目录的不同含义 | A 级（真跑解析） |
| 2 | 数字法（八进制）与换算表 | A 级（换算表脚本真跑）+ B 级（chmod 生效） |
| 3 | 字母法 u/g/o/a 与 `+` `-` `=` | A 级（模拟器真跑）+ B 级（chmod 生效） |
| 4 | 递归 `-R` 与参考 `--reference` | B 级（附本地可跑的替代验证） |
| 5 | 常见场景选型 755/644/600/700 | 讲解 + B 级命令 |
| 6 | 权限位与 umask 的关系 | A 级（真跑） |
| 7 | 特殊权限位 SUID/SGID/Sticky | B 级简述 |

## 1. 权限位基础：rwx 到底管什么
{: .sec-expl}

**考察点**：9 个权限位分成属主（u）、属组（g）、其他（o）三组，每组 r/w/x 三位；以及同一个权限字母作用在**文件**和**目录**上含义完全不同。

### 步骤 1：解析真实的 ls -l 输出（已实操）
{: .sec-prac}

```bash
mkdir -p /tmp/hw/day20/demo && cd /tmp/hw/day20/demo
touch a.conf && mkdir sub
cd /tmp/hw/day20 && ls -l demo
```

输出：

```console
$ ls -l demo
total 0
-rw-r--r-- 1 user 197609 0 Oct 24 04:51 a.conf
drwxr-xr-x 1 user 197609 0 Oct 24 04:51 sub
```

用 awk 把权限串拆开看（已实操）：

```bash
ls -l demo | awk 'NR>1{
  perm=$1; type=substr(perm,1,1);
  t=(type=="d"?"目录":(type=="l"?"软链接":(type=="-"?"普通文件":"其他")));
  printf "%-11s 类型=%-4s 属主=%s 属组=%s 其他=%s  名称=%s\n", perm, t, substr(perm,2,3), substr(perm,5,3), substr(perm,8,3), $NF
}'
```

输出：

```console
$ ls -l demo | awk 'NR>1{ ... }'
-rw-r--r--  类型=普通文件 属主=rw- 属组=r-- 其他=r--  名称=a.conf
drwxr-xr-x  类型=目录   属主=rwx 属组=r-x 其他=r-x  名称=sub
```

权限串结构：`第1位类型` + `2-4位属主u` + `5-7位属组g` + `8-10位其他o`。用 `stat` 直接读八进制（已实操）：

```console
$ stat -c '%n  %a  %A' demo/a.conf demo/sub
demo/a.conf  644  -rw-r--r--
demo/sub  755  drwxr-xr-x
```

`stat -c %a` 输出八进制权限、`%A` 输出 rwx 形式——排查权限问题时用 `stat -c %a 文件` 最不容易看错。

### 步骤 2：r/w/x 在文件与目录上的语义差异
{: .sec-prac}

| 权限 | 对**文件** | 对**目录** |
| --- | --- | --- |
| `r` 读 | 可以读取文件内容（`cat`、`vim`） | 可以列出目录内容（`ls 目录`） |
| `w` 写 | 可以修改文件内容（`echo >`） | 可以在目录内**新建/删除/改名**文件 |
| `x` 执行 | 可以作为命令/脚本执行 | 可以**进入**目录（`cd`）、访问目录内文件属性 |

三条运维必记的结论：

- 目录**没有 `x`** 时，即使有 `r` 也 `ls` 不出内容、即使有 `w` 也建不了文件——`x` 是目录的「通行证」；
- 能否**删除**一个文件，取决于它**父目录**是否有 `w`，与文件自身权限无关；
- 访问 `/a/b/c.txt` 要经过 `/a`、`/a/b` 两级目录，每一级都需要 `x`。

> **参见**：[文件属性与inode](/posts/linux-fileattr-03/)、[用户权限与提权](/posts/linux-userperm-02/)

## 2. 数字法（八进制）与换算表

**考察点**：`chmod 755 file` 这类三位八进制写法，每位是 r(4) + w(2) + x(1) 的和。

### 步骤 3：生成八进制换算表（已实操）
{: .sec-prac}

下面这段脚本在本环境真实运行，输出即换算表：

```bash
printf "%-6s %-6s %-6s %s\n" "八进制" "二进制" "rwx" "含义"
for n in 0 1 2 3 4 5 6 7; do
  b=$(printf "%03d" $(( (n>>2)*100 + ((n>>1)&1)*10 + (n&1) )))
  s=""; [ $((n&4)) -ne 0 ] && s="${s}r" || s="${s}-"
  [ $((n&2)) -ne 0 ] && s="${s}w" || s="${s}-"
  [ $((n&1)) -ne 0 ] && s="${s}x" || s="${s}-"
  m=""
  case $n in
    0) m="无任何权限";; 1) m="仅执行";; 2) m="仅写";; 3) m="写+执行";;
    4) m="仅读";; 5) m="读+执行";; 6) m="读+写";; 7) m="读+写+执行";;
  esac
  printf "%-6s %-6s %-6s %s\n" "$n" "$b" "$s" "$m"
done
```

输出：

```console
八进制 二进制 rwx    含义
0      000    ---    无任何权限
1      001    --x    仅执行
2      010    -w-    仅写
3      011    -wx    写+执行
4      100    r--    仅读
5      101    r-x    读+执行
6      110    rw-    读+写
7      111    rwx    读+写+执行
```

记法：r=4、w=2、x=1，一组内做加法。`7`=4+2+1=rwx、`6`=4+2=rw-、`5`=4+1=r-x、`4`=r--、`0`=---。

### 常用三位组合速查
{: .sec-chk}

| 八进制 | rwx 串 | 典型用途 |
| --- | --- | --- |
| `777` | rwxrwxrwx | 所有人可读写执行（**生产禁用**，临时排错用） |
| `755` | rwxr-xr-x | 目录/可执行程序/脚本的标准权限 |
| `750` | rwxr-x--- | 属主全权、同组可读执行、其他无权限 |
| `700` | rwx------ | 属主私有的目录（如 `/root`、家目录） |
| `644` | rw-r--r-- | 普通文件/配置文件的标准权限 |
| `640` | rw-r----- | 配置文件只给属主与同组读 |
| `600` | rw------- | 私钥、密码文件等敏感文件 |
| `400` | r-------- | 只读的密钥文件 |
| `000` | --------- | 完全锁死（仅 root 可改） |

**验证方法**：`stat -c %a 文件` 读回八进制、`stat -c %A 文件` 读回 rwx 串，两者与你的换算结果对照；心里算一遍 `755` = 属主 rwx + 属组 r-x + 其他 r-x，再与 `ls -l` 显示的 9 位逐位核对。

## 3. 字母法：u/g/o/a 与 + - =

**考察点**：字母法的三段结构 `给谁(who) 怎么做(op) 什么权限(perm)`，以及 `+`（追加）、`-`（移除）、`=`（精确赋值）三种运算符的区别。

### 语法速查
{: .sec-chk}

| 组成部分 | 取值 | 说明 |
| --- | --- | --- |
| 给谁 who | `u` 属主、`g` 属组、`o` 其他、`a` 全部（等价 ugo） | 省略时默认是 `a` |
| 怎么做 op | `+` 增加、`-` 移除、`=` 精确赋值 | `=` 会清掉未列出的位 |
| 什么权限 perm | `r` 读、`w` 写、`x` 执行、`X` 仅对目录/已有 x 的文件加执行 | 可组合如 `rwx`、`rw` |
| 多条表达式 | 用逗号分隔 | `chmod u+x,g+w file` |

### 步骤 4：用模拟器真跑验证算法（已实操）
{: .sec-ver}

因为本环境 `chmod` 不生效，这里用一个真实可执行的**权限模拟器**来验证算法——它复刻了 chmod 的运算规则（数字法直接覆盖，字母法按位或/与/赋值），输入起始权限和 chmod 表达式，算出结果：

```bash
cat > /tmp/hw/day20/chmod_sim.sh <<'EOF'
#!/bin/bash
# chmod 权限模拟器：输入「起始权限」+「chmod 表达式」，算出结果权限与 rwx 串
# 用途：本环境（NTFS noacl 挂载）chmod 不可靠，用此脚本验证对 chmod 算法的理解
apply() {   # $1=当前值 $2=运算符(+/-/=) $3=权限值
  case "$2" in
    +) echo $(( $1 | $3 )) ;;
    -) echo $(( ($1 & ~$3) & 7 )) ;;
    =) echo $3 ;;
  esac
}
rip() {     # $1=一位八进制 -> rwx 三字符
  local n=$1 s=""
  [ $((n & 4)) -ne 0 ] && s="${s}r" || s="${s}-"
  [ $((n & 2)) -ne 0 ] && s="${s}w" || s="${s}-"
  [ $((n & 1)) -ne 0 ] && s="${s}x" || s="${s}-"
  echo "$s"
}
rval() {    # $1="rwx" 片段 -> 数值
  local v=0
  case "$1" in *r*) v=$((v+4));; esac
  case "$1" in *w*) v=$((v+2));; esac
  case "$1" in *x*) v=$((v+1));; esac
  echo $v
}
sim() {
  local start=$1 expr=$2
  local u=$((start/100)) g=$(((start/10)%10)) o=$((start%10))
  local sb="$(rip $u)$(rip $g)$(rip $o)"
  if [[ "$expr" =~ ^[0-7][0-7][0-7]$ ]]; then        # 数字法：直接覆盖
    u=${expr:0:1}; g=${expr:1:1}; o=${expr:2:1}
  else                                                # 字母法：逐条解析
    local IFS=','
    for e in $expr; do
      local who op bits bv
      who="$(echo "$e"  | sed -r 's/^([ugoa]*).*/\1/')"
      op="$(echo "$e"   | sed -r 's/^[ugoa]*([+-=]).*/\1/')"
      bits="$(echo "$e" | sed -r 's/^[ugoa]*[+-=]//')"
      bv=$(rval "$bits")
      [ -z "$who" ] && who="a"
      case "$who" in *a*|*u*) u=$(apply $u "$op" $bv);; esac
      case "$who" in *a*|*g*) g=$(apply $g "$op" $bv);; esac
      case "$who" in *a*|*o*) o=$(apply $o "$op" $bv);; esac
    done
  fi
  printf "起始 %s  chmod %-16s => %d%d%d  %s%s%s\n" \
    "$sb" "$expr" "$u" "$g" "$o" "$(rip $u)" "$(rip $g)" "$(rip $o)"
}
sim 644 "u+x"
sim 644 "g+w"
sim 644 "o-r"
sim 644 "a+x"
sim 644 "u=rwx,g=rx,o="
sim 600 "a+r"
sim 755 "o-w"
sim 777 "go-w"
sim 644 "755"
sim 000 "u+rwx,g+rx,o+rx"
sim 777 "644"
sim 640 "u+x,g+x"
EOF
bash /tmp/hw/day20/chmod_sim.sh
```

输出：

```console
$ bash /tmp/hw/day20/chmod_sim.sh
起始 rw-r--r--  chmod u+x              => 744  rwxr--r--
起始 rw-r--r--  chmod g+w              => 664  rw-rw-r--
起始 rw-r--r--  chmod o-r              => 640  rw-r-----
起始 rw-r--r--  chmod a+x              => 755  rwxr-xr-x
起始 rw-r--r--  chmod u=rwx,g=rx,o=    => 750  rwxr-x---
起始 rw-------  chmod a+r              => 644  rw-r--r--
起始 rwxr-xr-x  chmod o-w              => 755  rwxr-xr-x
起始 rwxrwxrwx  chmod go-w             => 755  rwxr-xr-x
起始 rw-r--r--  chmod 755              => 755  rwxr-xr-x
起始 ---------  chmod u+rwx,g+rx,o+rx  => 755  rwxr-xr-x
起始 rwxrwxrwx  chmod 644              => 644  rw-r--r--
起始 rw-r-----  chmod u+x,g+x          => 750  rwxr-x---
```

逐条对照理解：

- `u+x`：只给属主加执行，644 → 744；
- `a+x`：给 u/g/o 都加执行，644 → 755（这是「把普通文件变成可执行」的常用写法）；
- `u=rwx,g=rx,o=`：用 `=` 精确赋值，644 → 750，等价于数字法 `750`；
- `go-w`：一次去掉属组和其他的写权限，777 → 755；
- `755`（数字法）是**整体覆盖**，不管原来是什么；`u+x` 这类字母法是**增量修改**，只动指定的位——这是两套写法最本质的区别。

### 步骤 5：真机上的 chmod 生效演示（B 级）
{: .sec-ex}

（预期输出，CentOS 7）

```bash
cd /tmp/hw/day20 && rm -f f1.txt f2.txt f3.txt && mkdir -p dir1
touch f1.txt f2.txt f3.txt
ls -l                                  # 看默认权限
chmod 755 f1.txt; chmod 644 f2.txt; chmod 600 f3.txt; chmod 700 dir1
ls -l; ls -ld dir1                     # 验证
```

```console
$ ls -l
total 0
drwxr-xr-x 2 root root 6 Oct 24 04:46 dir1
-rw-r--r-- 1 root root 0 Oct 24 04:46 f1.txt
-rw-r--r-- 1 root root 0 Oct 24 04:46 f2.txt
-rw-r--r-- 1 root root 0 Oct 24 04:46 f3.txt

$ chmod 755 f1.txt; chmod 644 f2.txt; chmod 600 f3.txt; chmod 700 dir1
$ ls -l; ls -ld dir1
-rwxr-xr-x 1 root root 0 Oct 24 04:46 f1.txt
-rw-r--r-- 1 root root 0 Oct 24 04:46 f2.txt
-rw------- 1 root root 0 Oct 24 04:46 f3.txt
drwx------ 2 root root 6 Oct 24 04:46 dir1

$ stat -c '%a %n' f1.txt f2.txt f3.txt dir1
755 f1.txt
644 f2.txt
600 f3.txt
700 dir1
```

> 上面这份是**预期输出**的示意（按 umask 022 的默认 644 推算）。在本 Git Bash 环境实际执行会得到「命令返回 0 但权限不变」的结果，原因见文首环境说明；在 CentOS 7 / 任何 ext4、xfs 文件系统上执行则会正常生效。

字母法在真机上的验证（预期输出，CentOS 7）：

```console
$ chmod u+x f2.txt && ls -l f2.txt
-rwxr--r-- 1 root root 0 Oct 24 04:46 f2.txt

$ chmod g+w f2.txt && ls -l f2.txt
-rwxrw-r-- 1 root root 0 Oct 24 04:46 f2.txt

$ chmod o-r f2.txt && ls -l f2.txt
-rwxrw---- 1 root root 0 Oct 24 04:46 f2.txt

$ chmod u=rwx,g=rx,o= f2.txt && ls -l f2.txt
-rwxr-x--- 1 root root 0 Oct 24 04:46 f2.txt
```

**验证方法**：真机上每次 `chmod` 后立刻 `ls -l 文件` 或 `stat -c %a 文件` 读回权限，与预期值比对；本环境则用 `bash /tmp/hw/day20/chmod_sim.sh` 模拟器核验算法结果。

> **易错点**：
>
> - 数字法是**覆盖**、字母法是**增量**——想「只加执行位」用 `chmod +x`，别用 `chmod 755`（会把原来的 664 之类冲掉）；
> - `=` 是精确赋值，会清掉没写到的位：`chmod u=r file` 之后属主只剩 r，原来的 w 没了；
> - 省略 who 时默认是 `a`（`chmod +x file` = `chmod a+x file`），不是只给属主；
> - `chmod -R 777` 会把目录下所有文件都变成可执行，非常危险——递归改目录权限通常用 `X`（大写）或配合 `find` 分别处理；
> - 改权限只对**文件属主或 root** 生效，普通用户改别人的文件会报 `Operation not permitted`。

## 4. 递归 -R 与参考 --reference（B 级）

**递归 `-R`**：把目录及其下所有子目录和文件一并改权限。

```bash
chmod -R 755 /data/www          # 目录树整体改成 755（会连文件一起变成可执行，慎用）
chmod -R u+rwX,g+rX,o+rX /data/www   # 推荐：X 表示"只对目录和已有执行位的文件加 x"
```

更安全的做法是「目录和文件分开处理」（用 find 分别指定）：

```bash
find /data/www -type d -exec chmod 755 {} \;    # 目录 755
find /data/www -type f -exec chmod 644 {} \;    # 文件 644
```

（预期输出，CentOS 7）

```console
$ find /data/www -type d -exec chmod 755 {} \;
$ find /data/www -type f -exec chmod 644 {} \;
$ ls -ld /data/www; ls -l /data/www/index.html
drwxr-xr-x 3 root root 4096 Oct 24 04:50 /data/www
-rw-r--r-- 1 root root 1024 Oct 24 04:50 /data/www/index.html
```

**参考 `--reference`**：把目标文件的权限设成与参考文件完全一致，不用自己算八进制。

```bash
chmod --reference=/etc/shadow /tmp/new_secret.conf
```

（预期输出，CentOS 7）

```console
$ stat -c '%a %n' /etc/shadow /tmp/new_secret.conf
000 /etc/shadow
644 /tmp/new_secret.conf
$ chmod --reference=/etc/shadow /tmp/new_secret.conf
$ stat -c '%a %n' /tmp/new_secret.conf
000 /tmp/new_secret.conf
```

典型场景：新建的密钥文件要比照系统已有的同类文件设权限（比如 SSH 私钥照抄 `600`），用 `--reference` 既准确又不会因为记错数字出岔子。

**本地可跑的替代验证**（A 级）：本环境 `chmod` 不生效，但可以用 `stat` 观察目录树当前权限，理解 `-R` 要作用的范围（已实操）：

```bash
mkdir -p demo/sub/deep && touch demo/sub/deep/x.sh demo/sub/y.sh
find demo -exec stat -c '%a %n' {} \; | sort -k2
```

输出：

```console
$ find demo -exec stat -c '%a %n' {} \; | sort -k2
755 demo
644 demo/a.conf
755 demo/sub
755 demo/sub/deep
644 demo/sub/deep/x.sh
644 demo/sub/y.sh
```

`-R` 的作用对象就是 `find` 列出的这一整棵树——目录是 755、文件是 644，如果直接 `chmod -R 755`，那两个 `.sh` 之外的文件也会被加上执行位。

## 5. 常见场景：755 / 644 / 600 / 700 该怎么选
{: .sec-ex}

**考察点**：不是背数字，而是理解「最小权限原则」——给完成工作所必需的最小权限。

| 场景 | 推荐权限 | 命令 | 理由 |
| --- | --- | --- | --- |
| 网站根目录、程序目录 | `755` | `chmod 755 /data/www` | 属主可写，其他人能进能读（`x` 是目录通行证） |
| 可执行脚本/命令 | `755` | `chmod +x deploy.sh` | 需要 `x` 才能执行，其他人只读执行 |
| 普通配置文件 | `644` | `chmod 644 app.conf` | 属主可改，其他人只读，不需要执行位 |
| 含口令的配置文件 | `640` 或 `600` | `chmod 640 db.conf` | 只给属主与必要同组读，堵住 `others` |
| SSH 私钥、证书密钥 | `600` | `chmod 600 id_rsa` | 仅属主读写；权限过松 SSH 会拒绝使用该密钥 |
| 家目录、`/root`、私有数据目录 | `700` | `chmod 700 /home/user` | 仅属主可进可读写，其他人完全看不到 |
| 需要公开下载的静态文件 | `644` | `chmod 644 *.html` | Web 服务进程以其他用户身份读取，需要 `o+r` |
| 上传目录（需被程序写入） | `755` 且属主设为服务账号 | `chown www /upload && chmod 755 /upload` | 不要把上传目录设成 `777`，改属主更安全 |

关键原则：**能用属主/属组解决就不要放开 `o`（其他用户）**；**能用 `chown` 解决就不要用 `777`**；给脚本加执行位用 `chmod +x` 而不是 `chmod 777`。

一个真实的高频坑：SSH 私钥权限太松会被拒绝连接（预期输出，CentOS 7）：

```console
$ ssh -i ~/.ssh/id_rsa user@10.0.0.1
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Permissions 0644 for '/root/.ssh/id_rsa' are too open.
It is required that your private key files are NOT accessible by others.
This private key will be ignored.
Load key "/root/.ssh/id_rsa": bad permissions

$ chmod 600 ~/.ssh/id_rsa
$ ssh -i ~/.ssh/id_rsa user@10.0.0.1    # 修复后正常连接
```

## 6. 权限位与 umask 的关系（A 级，已实操）
{: .sec-prac}

**考察点**：新建文件/目录的默认权限 = 基准权限减去 umask。目录基准 `777`，文件基准 `666`（文件默认不给执行位，这是安全设计）。

### 步骤 6：真跑 umask 对照实验
{: .sec-prac}

```bash
cd /tmp/hw/day20
for m in 022 077 002 027 000; do
  umask $m
  rm -f u_test.txt; rm -rf u_testdir
  touch u_test.txt; mkdir u_testdir
  printf "umask=%s  新建文件=%s  新建目录=%s\n" "$m" "$(stat -c %a u_test.txt)" "$(stat -c %a u_testdir)"
done
umask 022
```

输出：

```console
$ for m in 022 077 002 027 000; do ...; done
umask=022  新建文件=644  新建目录=755
umask=077  新建文件=600  新建目录=700
umask=002  新建文件=644  新建目录=755
umask=027  新建文件=640  新建目录=750
umask=000  新建文件=644  新建目录=755
```

前四组符合公式：

| umask | 文件 666-umask | 目录 777-umask | 实测文件 | 实测目录 |
| --- | --- | --- | --- | --- |
| `022` | 644 | 755 | 644 | 755 |
| `027` | 640 | 750 | 640 | 750 |
| `077` | 600 | 700 | 600 | 700 |
| `002` | 664 | 775 | 644 | 755（受本环境限制） |
| `000` | 666 | 777 | 644 | 755（受本环境限制） |

> `umask=002` 与 `umask=000` 两组实测未达理论值（664/775、666/777），原因是本环境 NTFS `noacl` 挂载下无法赋予超出 `644/755` 的权限位，属环境限制；在 CentOS 7 上会得到表中的理论值。去掉权限的操作（022/027/077）三组在本环境完全正常，公式成立。

### umask 速查
{: .sec-chk}

| umask | 文件默认 | 目录默认 | 适用场景 |
| --- | --- | --- | --- |
| `022`（系统默认） | 644 | 755 | 通用，其他用户可读 |
| `077` | 600 | 700 | 严格私有，其他用户无任何权限 |
| `027` | 640 | 750 | 同组可协作，其他用户无权限 |
| `002` | 664 | 775 | 同组可共同编辑（共享目录常用） |

查看与临时设置（已实操）：

```console
$ umask
0022

$ umask 077
$ umask
0077
```

永久生效要写进 shell 配置文件（B 级）：`/etc/profile`（全局）或 `~/.bashrc`（单用户）里加一行 `umask 027`，重新登录或 `source` 后生效。

**验证方法**：`umask` 查看当前值 → `touch` 新建文件 → `stat -c %a` 看实际权限 → 用 `666-umask`（文件）、`777-umask`（目录）手工核对；改 umask 后重做一遍，结果应同步变化。

> **易错点**：umask 是「掩码」不是「默认权限」，做的是**减法**（实际是按位与非运算），umask 越大权限越小；文件的基准是 `666` 不是 `777`，所以新建文件永远不会自带执行位。

## 7. 特殊权限位简述（B 级）

三位八进制之外还有第 4 位（最高位），用来表示三个特殊位：

| 值 | 符号位表现 | 名称 | 作用 |
| --- | --- | --- | --- |
| `4000` | 属主 x 位变 `s`（`--s--`） | SUID | 执行该文件时以**文件属主**身份运行（典型：`/usr/bin/passwd`） |
| `2000` | 属组 x 位变 `s` | SGID | 目录中新建文件自动继承目录的**属组**；可执行文件以属组身份运行 |
| `1000` | 其他 x 位变 `t` | Sticky | 目录下只有**文件属主**（和 root）能删自己的文件（典型：`/tmp`） |

设置方式（四位八进制或字母法）：

```bash
chmod 4755 /usr/bin/xxx     # 设置 SUID + 755
chmod 2755 /data/share      # 设置 SGID + 755（共享目录常用）
chmod 1777 /tmp             # 设置 Sticky + 777（临时目录标准配置）
chmod u+s file              # 字母法加 SUID
chmod g+s dir               # 字母法加 SGID
chmod o+t dir               # 字母法加 Sticky
```

（预期输出，CentOS 7）

```console
$ ls -ld /tmp; ls -l /usr/bin/passwd
drwxrwxrwt. 12 root root 4096 Oct 24 04:50 /tmp
-rwsr-xr-x. 1 root root 27832 Jun 10  2014 /usr/bin/passwd

$ mkdir /data/share && chmod 2775 /data/share && ls -ld /data/share
drwxrwsr-x 2 root root 6 Oct 24 04:50 /data/share
```

`/tmp` 的最后一位是 `t`（Sticky），`/usr/bin/passwd` 的属主执行位是 `s`（SUID）——这正是普通用户能改自己密码、却改不了别人密码的原因。

> **安全提醒**：SUID/SGID 会让程序以属主/属组身份运行，给不可信的程序设 SUID 等于提权漏洞。定期排查：`find / -type f -perm -4000 2>/dev/null`（找出所有带 SUID 的文件）。

## chmod 命令速查表
{: .sec-chk}

| 分类 | 写法 | 作用 | 示例 |
| --- | --- | --- | --- |
| 数字法 | `chmod NNN 文件` | 三位八进制整体覆盖 | `chmod 644 f` |
| 数字法（四位） | `chmod NNNN 文件` | 首位是特殊位 | `chmod 1777 /tmp` |
| 字母法-加 | `chmod who+perm` | 追加权限 | `chmod u+x f` |
| 字母法-减 | `chmod who-perm` | 移除权限 | `chmod go-w f` |
| 字母法-赋值 | `chmod who=perm` | 精确赋值（清其他位） | `chmod u=rwx,go= f` |
| 省略 who | `chmod +x f` | 等价 `a+x` | `chmod +x script.sh` |
| 大写 X | `chmod -R u+rwX` | 只对目录/已有 x 的文件加执行 | `chmod -R a+X dir` |
| 递归 | `chmod -R` | 目录树全部生效 | `chmod -R 755 dir` |
| 参考 | `chmod --reference=参考文件 目标` | 复制参考文件的权限 | `chmod --reference=/etc/shadow f` |
| 静默 | `chmod -f` | 忽略错误信息 | `chmod -f 644 f` |
| 详细 | `chmod -v` / `-c` | 显示变更（`-c` 只显示有变化的） | `chmod -c 644 f` |
| 查看结果 | `stat -c %a 文件` | 读回八进制权限 | `stat -c '%a %n' f` |

## 本篇小结
{: .sec-sum}

1. 权限串结构是「1 位类型 + 3 位属主 + 3 位属组 + 3 位其他」；同一个字母对文件和目录含义不同——目录的 `x` 是「通行证」（没 `x` 就 `ls` 不出也建不了），删文件看的是**父目录**的 `w` 而不是文件自身权限。
2. 数字法：r=4、w=2、x=1 按组求和，`755`=rwxr-xr-x、`644`=rw-r--r--、`600`=rw-------、`700`=rwx------；数字法是**整体覆盖**，不管原来是什么权限。
3. 字母法：`chmod [ugoa][+-=][rwx] 文件`，`+` 追加、`-` 移除、`=` 精确赋值（会清掉未列出的位）；省略 who 时默认是 `a`；多条表达式用逗号分隔。想「只加执行位」就用 `chmod +x`，别用 `chmod 755`。
4. 常见选型遵循最小权限：目录与脚本 `755`、普通配置文件 `644`、含口令的配置 `640`/`600`、SSH 私钥 `600`（权限过松会被 SSH 拒绝）、私有目录 `700`；能用 `chown` 解决就别用 `777`。
5. umask 决定新建文件的默认权限：文件 `666-umask`、目录 `777-umask`；`022`→644/755、`027`→640/750、`077`→600/700。umask 是掩码做减法，值越大权限越小。
6. 特殊权限位：SUID(4000) 让程序以属主身份运行、SGID(2000) 让目录内新文件继承属组、Sticky(1000) 让目录内只有属主能删自己的文件（`/tmp` 就是 `1777`）；带 SUID 的程序等于提权入口，要定期用 `find / -perm -4000` 排查。
7. 本环境（NTFS `noacl` 挂载）的 `chmod` 是空操作：命令返回 0 但权限不变，用 `mount | grep noacl` 可诊断；验证 chmod 算法请改用本文的 `chmod_sim.sh` 模拟器，或到 CentOS 7 真机上用 `chmod` + `stat -c %a` 验证。


{% endraw %}
