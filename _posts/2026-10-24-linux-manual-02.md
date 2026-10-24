---
title: "02-命令速查手册"
date: 2026-10-24 10:47:00 +0800
categories: [软件, Linux, 00-知识手册]
tags: [Linux, 00-知识手册, 知识手册]
slug: "linux-manual-02"
---

{% raw %}



## 使用说明
{: .sec-expl}

这套笔记的「命令字典」：按功能域分章，一章几张「命令卡」表格，配一组可直接复制的示例。日常排障、写脚本、备考复习时当案头工具书翻，不必从头读到尾。

阅读与使用的约定如下：

1. **表格列含义**：`命令` 列是可直接执行的命令本体；`常用参数` 列列的是最高频的 2 到 4 个参数；`作用` 列用一句话说明用途，末尾的「替代 ·」标记说明该命令的现状——若已被取代，会给出推荐替代命令；`示例` 列是可直接复制到终端运行的单行命令。
2. **示例块**：每章表格后面附一个 `bash` 代码块，把该章的典型组合用法成组展示，注释以 `#` 开头，方便整段复制改造。
3. **环境基准**：命令以 CentOS 7 系列发行版为基准，涉及 CentOS 6 与 CentOS 8 及以上版本的差异在 `作用` 列或示例中单独标注。
4. **占位符约定**：示例中的 IP 使用 `10.0.0.7`、`172.16.1.31` 这类内网保留地址；域名使用 `www.example.com`；所有口令一律写成 `你的密码`，请按实际环境替换，不要把真实口令写进脚本。
5. **危险提示**：凡涉及 `rm -rf`、`mkfs`、`fdisk`、`dd`、`shutdown`、LVM 缩容一类不可逆操作，示例一律给出「先确认 / 先备份」的前置动作，请务必照做。
6. **记忆主线**：整套笔记里把 `find`、`grep`、`sed`、`awk` 称为「四剑客」，按处理能力强弱排序为：`awk` 最强、`sed` 次之、`grep` 再次、`find` 殿后。查不到命令时，先想属于哪个功能域，再来对应章节检索。

## 目录

- 第一章 文件与目录操作
- 第二章 查看与检索
- 第三章 文本处理
- 第四章 权限与属性
- 第五章 用户与组
- 第六章 磁盘与文件系统
- 第七章 软件包管理
- 第八章 进程与性能
- 第九章 网络管理
- 第十章 系统与服务
- 第十一章 压缩打包
- 第十二章 服务专用命令
- 附录 易混淆命令对比

## 第一章 文件与目录操作
{: .sec-prac}

核心思路：Linux 中一切皆文件，目录也是文件。所有操作都从根 `/` 开始定位，路径分绝对路径（以 `/` 开头）与相对路径（以当前目录为基准）。

### 1.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `ls` | `-l` `-a` `-h` | 列出目录内容；`-l` 看详细属性，`-a` 含隐藏文件，`-h` 人类可读大小。组合 `-t` 按时间排序、`-r` 反向、`-d` 只看目录本身。替代 · 无，属于基础命令 | `ls -lah /etc` |
| `cd` | `-` `~` `..` | 切换工作目录；`cd -` 返回上一次所在路径，`cd ~` 或 `cd` 回家目录，`cd ..` 上一级。替代 · 无 | `cd /var/log` |
| `pwd` | `-P` `-L` | 显示当前所在路径；`-P` 显示物理路径（穿透软链接），`-L` 显示逻辑路径（默认）。替代 · 无 | `pwd -P` |
| `mkdir` | `-p` `-m` `-v` | 创建目录；`-p` 递归创建多级目录且已存在不报错，`-m` 创建时直接指定权限。替代 · 无 | `mkdir -p /data/{www,bbs,blog}` |
| `rmdir` | `-p` `-v` | 只能删除空目录；`-p` 连同上层的空目录一起删除。替代 · 无，实际排障多用 `rm -rf` | `rmdir -p /data/a/b/c` |
| `cp` | `-r` `-a` `-p` | 复制文件或目录；`-r` 递归复制目录，`-a` 归档复制并保留全部属性（等价 `-dpr`），`-p` 保留属性。别名拦截时前面加反斜线写成 `\cp`。替代 · 无 | `cp -a /etc /tmp/etc.bak` |
| `mv` | `-f` `-i` `-n` | 移动或重命名数据；同分区 `mv` 只改目录项、速度极快，`-n` 不覆盖已有文件。替代 · 无 | `mv access.log access_$(date +%F).log` |
| `rm` | `-r` `-f` `-i` | 删除数据；`-r` 递归删除目录，`-f` 强制不确认，`-i` 逐个确认。别名拦截时写成 `\rm`。替代 · 无，但属于高危命令 | `rm -rf /tmp/olddata` |
| `touch` | `-a` `-m` `-d` | 创建空文件，或修改时间戳；`-d` 指定时间，`-c` 文件不存在时不创建，`-r` 参照其他文件的时间。替代 · 无 | `touch -d "2026-01-01" file.txt` |
| `ln` | `-s` `-f` `-n` | 创建链接文件；默认创建硬链接，加 `-s` 创建软链接，`-f` 强制覆盖已有链接。替代 · 无 | `ln -s /data/app /app` |
| `tree` | `-L` `-d` `-a` | 以树状结构显示目录；`-L 1` 只看下一级，`-d` 只显示目录，`-a` 含隐藏文件。替代 · 无，需 `yum install -y tree` | `tree -L 2 -d /data` |
| `file` | `-b` `-i` `-L` | 判断文件类型（不依赖扩展名）；`-b` 只输出结果不输出文件名，`-i` 显示 MIME 类型，`-L` 跟随软链接。替代 · 无 | `file /bin/ls` |
| `install` | `-d` `-m` `-o` | 复制文件并同时设定权限属主，常用于脚本与 RPM 打包；`-d` 创建目录。替代 · 无 | `install -m 600 file.txt /etc/file.txt` |

### 1.2 示例
{: .sec-ex}

```bash
# 按时间倒序列出目录内容，最新修改的排在最上面
ls -lhrt /var/log

# 只看目录本身的属性，不看目录里的内容
ls -ld /data

# 递归创建多级目录，已存在也不会报错
mkdir -p /data/www/{html,logs}

# 生成连续序列目录与文件，配合花括号展开
mkdir -p /data/{a..c}
touch /data/{a..c}/{1..3}.txt

# 归档复制，保留属主属组权限与时间属性
cp -a /etc /tmp/etc_$(date +%F)

# 强制覆盖，绕过 cp -i 的别名提示
\cp /etc/hosts /tmp/hosts

# 为应用创建软链接，方便版本切换
ln -sfn /data/app-v2.1 /data/app

# 查看链接指向与文件类型
file /data/app
ls -l /data/app

# 批量修改时间戳，配合 find 使用
find /data -type f -exec touch {} \;

# 安全删除：先确认清单，再执行删除
ls -l /tmp/olddata
rm -rf /tmp/olddata
```

**坑位提示**

- 说白了，`rm` 没有回收站，且通配符在命令执行前就由 Shell 展开完毕。`rm -rf $dir/*` 里 `$dir` 一旦为空，展开结果就是 `rm -rf /*`。
- `rm -rf /data/*` 删不到隐藏文件；要连隐藏文件一起清，用 `find /data -mindepth 1 -delete`。
- 变量拼进删除命令前先 `[ -n "$dir" ]` 判空，路径写全，不给通配符留空转的机会。

```bash
# 生成带日期的备份文件名，一天一个不覆盖
cp /etc/hosts /tmp/hosts_$(date +%F_%H%M).bak

# 清理目录时连隐藏文件一起删，先列后删
find /tmp/olddata -mindepth 1 -delete
```

## 第二章 查看与检索

核心思路：查看类命令解决「文件里有什么」，检索类命令解决「东西在哪里」。大文件禁止用 `cat` 一把梭，优先 `less` 或 `head`、`tail`。

### 2.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `cat` | `-n` `-A` `-b` | 查看文件全部内容；`-n` 显示行号，`-A` 显示不可见符号（含行尾 `$`），`-b` 只对非空行编号。替代 · 无，但大文件慎用 | `cat -n /etc/hosts` |
| `tac` | 无常用参数 | 反向查看文件，从最后一行显示到第一行。替代 · 无，属于 `cat` 的反向补充 | `tac /var/log/messages` |
| `more` | `-N` `+行号` | 分页显示文件内容，空格翻页、回车换行，看完自动退出。替代 · 功能弱于 `less`，建议用 `less` | `more +100 /var/log/messages` |
| `less` | `-N` `-i` `-S` | 分页查看大文件，支持上下键与搜索；`-N` 显示行号，`-i` 搜索忽略大小写，`-S` 不折行；进入后按 `/` 搜索、`n` 下一个、`q` 退出。替代 · 无，是查看大文件的首选 | `less -N /var/log/messages` |
| `head` | `-n` `-c` `-q` | 查看文件开头内容，默认前 10 行；`-n 5` 前 5 行，`-c 100` 前 100 字节。替代 · 无 | `head -5 /etc/passwd` |
| `tail` | `-n` `-f` `-F` | 查看文件结尾内容，默认后 10 行；`-f` 实时追踪文件变化，`-F` 在文件被切割重建后仍持续追踪（等于 `--follow=name --retry`）。替代 · `tailf` 已废弃，用 `tail -f` | `tail -F /var/log/nginx/access.log` |
| `grep` | `-n` `-i` `-v` | 按行过滤文本；`-n` 显示行号，`-i` 忽略大小写，`-v` 取反排除，`-E` 扩展正则，`-o` 只输出匹配部分，`-c` 统计行数，`-A` `-B` `-C` 显示上下文，`-r` 递归目录，`-w` 整词匹配，`-l` 只列出文件名。替代 · 无，是过滤主力 | `grep -nE "error\|fail" app.log` |
| `egrep` | `-v` `-n` `-o` | 等价于 `grep -E`，直接识别扩展正则符号。替代 · **已废弃**，请改用 `grep -E` | `grep -E "^(root\|ops)" /etc/passwd` |
| `fgrep` | `-v` `-n` | 等价于 `grep -F`，不解析正则、按字面匹配，速度最快。替代 · **已废弃**，请改用 `grep -F` | `grep -F "192.168.1.1" access.log` |
| `find` | `-type` `-name` | 实时遍历目录查找文件；`-type f|d|l` 按类型，`-name` 按名称（支持通配），`-iname` 忽略大小写，`-mtime +7` 按修改时间，`-size +100M` 按大小，`-maxdepth 2` 限制层级，`-perm` 按权限，`-user` 按属主，`-inum` 按 inode，`-exec` 对结果再处理，`-delete` 直接删除。替代 · 无 | `find /data -type f -mtime +10 -delete` |
| `locate` | `-i` `-r` `-n` | 基于索引数据库快速查找路径，速度极快但不实时；`-i` 忽略大小写，`-r` 支持正则，`-n` 限制输出条数。需先执行 `updatedb`。替代 · 实时性要求高时用 `find` | `locate -i nginx.conf` |
| `updatedb` | 无常用参数 | 重建 `locate` 的索引数据库，新建的文件要先更新索引才能被查到。替代 · 无 | `updatedb` |
| `which` | `-a` | 在 `PATH` 中查找命令的可执行文件路径；`-a` 列出所有匹配。替代 · 无 | `which -a python3` |
| `whereis` | `-b` `-m` `-s` | 查找命令的二进制、源码与手册页路径；`-b` 只看二进制，`-m` 只看手册。替代 · 无 | `whereis -b nginx` |
| `type` | `-a` `-t` `-p` | 判断命令是内部命令、外部命令还是别名；`-a` 列出全部来源，`-t` 只输出类型。替代 · 无，用于排查别名干扰 | `type -a rm` |

### 2.2 示例
{: .sec-ex}

```bash
# 显示文件内容并标出行号
cat -n /etc/hosts

# 只查看前 5 行与后 5 行
head -5 /etc/passwd
tail -5 /etc/passwd

# 实时追踪日志，且日志被切割后仍能继续追踪
tail -F /var/log/nginx/access.log

# 过滤含有关键字的行并显示行号，忽略大小写
grep -ni "error" /var/log/messages

# 排除注释行与空行，查看配置文件有效配置
grep -vE "^#|^$" /etc/nginx/nginx.conf

# 显示匹配行及其前后各 3 行上下文
grep -C 3 "OutOfMemory" /var/log/messages

# 统计某个关键字出现的行数
grep -c "404" /var/log/nginx/access.log

# 递归在目录中搜索，只列出包含关键字的文件名
grep -rl "DB_PASSWORD" /data/www

# 查找 7 天前修改过的普通文件并删除（先 -ls 确认再 -delete）
find /data -type f -mtime +7 -ls
find /data -type f -mtime +7 -delete

# 查找大于 100M 的文件，按大小排序
find / -type f -size +100M -exec ls -lh {} \; | sort -k5 -h

# 查找指定权限的文件（如 777 高危权限）
find /data -type f -perm 0777

# 按 inode 查找并删除文件名乱码的文件
ls -li /data
find /data -inum 33574996 -delete

# 查找后的批量处理：-exec 与 xargs 两种写法
find /data -type f -name "*.log" -exec gzip {} \;
find /data -type f -name "*.log" | xargs gzip

# 确认命令的真实身份，排除别名干扰
type -a rm
which -a nginx
whereis -b nginx
```

**坑位提示**

- `find -mtime +30` 的语义：修改时间超过 30×24 小时，即第 31 天之前的文件；第 30 天当天的文件不包含。想圈「最近 30 天内」用 `-mtime -30`。
- `locate` 查不到新建文件不是故障，索引没更新而已，先跑 `updatedb`。
- grep 的模式里有空格必须加引号，否则会被拆成两个参数，`grep a b file` 实际在 file 里搜的是 `b`。
- `grep -r` 在大目录上很慢，已知文件类型时加 `--include="*.conf"` 限定范围，能快一个量级。
- find 的多个条件默认是「与」；`-name "a" -o -name "b"` 后面直接接动作时，要用 `\( \)` 把条件括起来分组，否则动作只作用于最后一个条件。

```bash
# 全盘定位最大的 10 个目录，一层一层往下钻
du -h --max-depth=1 /var 2>/dev/null | sort -rh | head -10

# 找出最近 1 天内被改过的配置文件，排查「谁动了配置」
find /etc -type f -mtime -1 -name "*.conf" -ls
```

## 第三章 文本处理

核心思路：运维日常的「三板斧」是 取行（`grep`）、取列（`awk`）、替换（`sed`）。一行搞不定时，用管道 `|` 把多个命令串起来，前一个命令的输出就是后一个命令的输入。

### 3.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `sed` | `-n` `-i` `-e` | 流编辑器，擅长增删改查指定行与替换文本；`-n` 只输出处理的行（常配 `p`），`-i` 直接修改文件（`-i.bak` 先备份），`-e` 串联多个动作，`-r` 支持扩展正则。替代 · 无，是文本替换主力 | `sed -i 's#old#new#g' file.txt` |
| `awk` | `-F` `-v` `NR` | 按列处理文本并支持运算与统计；`-F` 指定分隔符，`{print $1}` 取第 1 列，`NR` 行号，`NF` 列数，`BEGIN` 与 `END` 做首尾处理。替代 · 无，是取列与统计主力 | `awk -F ":" '{print $1,$3}' /etc/passwd` |
| `sort` | `-n` `-r` `-k` | 对文本行排序；`-n` 按数值排序，`-r` 反向，`-k 2` 按第 2 列，`-t` 指定列分隔符，`-u` 去重，`-h` 识别人类可读数值。替代 · 无 | `sort -rn -k2 data.txt` |
| `uniq` | `-c` `-d` `-u` | 统计或去除相邻重复行，使用前必须先 `sort`；`-c` 统计次数，`-d` 只显示重复行，`-u` 只显示唯一行。替代 · 无 | `sort file \| uniq -c \| sort -rn` |
| `cut` | `-d` `-f` `-c` | 按列或按字符截取；`-d` 指定分隔符，`-f 1,3` 取第 1 与第 3 列，`-c 1-5` 取第 1 到 5 个字符。替代 · 复杂取列用 `awk` | `cut -d ":" -f 1,3 /etc/passwd` |
| `tr` | `-d` `-s` `a-z` | 字符级替换、删除与压缩；`tr 'a-z' 'A-Z'` 大小写转换，`-d` 删除字符，`-s` 压缩重复字符。注意 `tr` 不支持直接读文件，需用 `<`。替代 · 无 | `tr -d "\r" < win.txt > unix.txt` |
| `wc` | `-l` `-w` `-c` | 统计行数、单词数与字节数；`-l` 行数最常用，`-m` 统计字符数。替代 · 无 | `wc -l /etc/services` |
| `split` | `-l` `-b` `-d` | 按行或按大小切割大文件；`-l 1000` 每 1000 行一份，`-b 100M` 每 100M 一份，`-d` 用数字后缀。替代 · 无 | `split -l 10000 big.log part_` |
| `paste` | `-d` `-s` | 按列把多个文件横向合并；`-d` 指定连接符，`-s` 把一个文件的所有行转成一行。替代 · 无 | `paste -d ":" user.txt pass.txt` |
| `comm` | `-1` `-2` `-3` | 对比两个已排序文件的差异，输出三列：仅在文件 1、仅在文件 2、两者共有；`-12` 只显示共有部分。替代 · 简单对比也可用 `diff` | `comm -12 a.txt b.txt` |
| `diff` | `-u` `-r` `-q` | 逐行比较两个文件的差异；`-u` 输出统一格式（便于生成补丁），`-r` 递归比较目录，`-q` 只报是否不同。替代 · 无 | `diff -u old.conf new.conf` |
| `tee` | `-a` 无其他 | 把标准输出同时写入文件并显示在屏幕，常用于「既看结果又留痕」；`-a` 追加写入。替代 · 无 | `echo "x" \| tee -a note.txt` |
| `xargs` | `-n` `-I` `-0` | 把管道传来的文本转换成后续命令的参数；`-n1` 每次传 1 个参数，`-I{}` 指定替换占位符，`-0` 配合 `find -print0` 处理含空格文件名，`-P` 并行执行。替代 · 无 | `find . -name "*.log" \| xargs rm -f` |
| `column` | `-t` `-s` | 把文本按列对齐成表格，常配合 `awk` 输出；`-t` 自动对齐，`-s` 指定分隔符。替代 · 无 | `awk '{print $1,$3}' a.txt \| column -t` |

### 3.2 示例
{: .sec-ex}

```bash
# 取第 1 列与第 3 列，指定冒号为分隔符
awk -F ":" '{print $1,$3}' /etc/passwd

# 取某一列的数值求和，并加上表头
awk -F ":" 'BEGIN{print "第一次总额","第三次总额"}{a=a+$2;b=b+$4}END{print a,b}' awk_test.txt | column -t

# 输出行号与列数，做条件过滤
awk -F ":" 'NR>=2 && $3>=1000 {print NR, $1, $3}' /etc/passwd

# 统计访问日志中来源 IP 的前 10 名
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

# 统计被访问页面次数的前 10 名
awk '{print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

# 删除空行与注释行后统计有效配置行数
grep -vE "^#|^$" /etc/nginx/nginx.conf | wc -l

# 全局替换，先用备份方式测试再落地
sed -n 's#/old/path#/new/path#gp' file.txt
sed -i.bak 's#/old/path#/new/path#g' file.txt

# 只打印第 10 行、第 10 到 20 行
sed -n '10p' file.txt
sed -n '10,20p' file.txt

# 在指定行后追加一行内容
sed -i '2a\new_line_content' file.txt

# 删除包含关键字的行
sed -i '/^#/d' file.txt

# 大小写转换与删除 Windows 换行符
tr 'a-z' 'A-Z' < file.txt
tr -d "\r" < win.txt > unix.txt

# 压缩重复空格，便于后续取列
tr -s " " < file.txt | cut -d " " -f 2

# 每行一个分组显示，把文件内容转成命令参数
xargs -n1 < ip.txt

# 批量创建用户：把用户名文件转成 useradd 参数
cat user.txt | xargs -n1 -I{} useradd {}

# 处理含空格的文件名，必须加 -print0 与 -0
find /data -type f -name "*.log" -print0 | xargs -0 rm -f

# 既在屏幕看到结果，又写入文件留痕
df -h | tee -a /tmp/disk_check.log
```

**坑位提示**

- `xargs` 默认按空白切分输入，文件名带空格会被拆成多个参数、各当各的文件处理；一律 `find -print0` 配 `xargs -0`。
- `sed -i` 直接改原文件，没有撤销；改之前先 `-i.bak` 留备份，或先跑一遍不带 `-i` 的版本看输出。
- `sed -i` 的动作顺序就是执行顺序，`-i` 放哪儿都行，但替换表达式里的分隔符如果和路径里的 `/` 撞了，换 `#` 或 `@` 做分隔符。
- `awk -F` 的分隔符是正则，多空格对齐的文本先用 `tr -s` 压缩，或写成 `-F "[ ]+"`，否则取出来的列全带空尾巴。
- `sort` 不加 `-n` 时按字典序排，`9` 会排在 `10` 后面；数字列忘加 `-n` 是各类 Top 榜单错乱的常见原因。

```bash
# 统计访问日志中各状态码出现的次数
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# 切割后的压缩日志一样能分析，不用先解压
zcat /var/log/nginx/access.log-20261020.gz | awk '{print $1}' | sort | uniq -c | sort -rn | head -10
```

## 第四章 权限与属性

核心思路：权限分三层——属主（u）、属组（g）、其他用户（o），每层三种权限——读（r=4）、写（w=2）、执行（x=1）。对目录而言，`r` 是能列出目录内容，`x` 是能进入目录，`w` 是能在目录里增删文件。

### 4.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `chmod` | `-R` `u+x` `755` | 修改文件或目录权限；支持数字法（`755`=`rwxr-xr-x`）与符号法（`u+x`、`g-w`、`o=r`、`a=x`），`-R` 递归修改。替代 · 无 | `chmod -R 750 /data/www` |
| `chown` | `-R` `属主:属组` | 修改文件属主与属组；`chown ops file` 只改属主，`chown ops.ops` 或 `chown ops:ops` 同时改属主属组，`-R` 递归。替代 · 无 | `chown -R www.www /data/www` |
| `chgrp` | `-R` `-v` | 只修改文件属组，功能被 `chown` 覆盖但语义更清晰；`-R` 递归。替代 · 可直接用 `chown :组名` | `chgrp -R ops /data` |
| `umask` | `-S` 数值 | 查看或设置默认权限掩码；root 默认 `0022`，普通用户默认 `0002`。文件默认 `666-umask`，目录默认 `777-umask`。临时设置只在当前 shell 生效，永久修改要改 `/etc/profile`。替代 · 无 | `umask 0022` |
| `chattr` | `+i` `-i` `+a` | 修改文件隐藏属性；`+i` 锁定文件（禁止增删改，root 也受限），`+a` 只允许追加（常用于日志文件）。替代 · 无 | `chattr +i /etc/passwd` |
| `lsattr` | `-a` `-d` `-R` | 查看文件隐藏属性，配合 `chattr` 使用；`-d` 查看目录本身，`-R` 递归。替代 · 无 | `lsattr /etc/passwd` |
| `setfacl` | `-m` `-x` `-b` | 设置文件访问控制列表，实现「给某个用户单独授权」；`-m u:ops:rwx` 授权，`-x u:ops` 收回，`-b` 清空所有 ACL，`-R` 递归，`-d` 设置默认继承。替代 · 无 | `setfacl -m u:ops:rw file.txt` |
| `getfacl` | `-p` `-R` | 查看文件的 ACL 授权详情，权限位末尾出现 `+` 号即表示存在 ACL。替代 · 无 | `getfacl file.txt` |
| `stat` | `-c` `-f` `-t` | 查看文件详细属性，包含三个时间：Access（访问）、Modify（内容修改）、Change（属性修改）；`-c %a` 取八进制权限，`-f` 看所在文件系统。替代 · 无 | `stat -c "%n %a %U:%G" file.txt` |
| `getenforce` | 无常用参数 | 查看 SELinux 运行模式（Enforcing、Permissive、Disabled），排障时「权限看起来没问题却报错」的必查项。替代 · 无 | `getenforce` |
| `setenforce` | `0` `1` | 临时切换 SELinux 模式；`0` 为宽容模式，`1` 为强制模式，重启失效。永久修改需编辑 `/etc/selinux/config`。替代 · 无 | `setenforce 0` |

### 4.2 示例
{: .sec-ex}

```bash
# 数字法与符号法互转练习
chmod 761 test.txt
chmod a=x test.txt
chmod u+r,g-w,o=r file.txt

# 递归修改网站目录属主与权限
chown -R www.www /data/www
chmod -R 750 /data/www

# 查看并显示八进制权限、属主属组
stat -c "%n %a %U:%G" /etc/hosts

# 查看文件的三个时间：访问、内容修改、属性修改
stat file.txt

# 锁定关键配置文件，防止误改（排障时常见「改了不生效」的原因之一）
chattr +i /etc/passwd
lsattr /etc/passwd
chattr -i /etc/passwd

# 给日志文件设置只允许追加，防止被清空
chattr +a /var/log/secure

# 给单个用户单独授权，不影响其他用户
setfacl -m u:ops:rw /data/report.txt
getfacl /data/report.txt

# 设置目录的默认 ACL，让新建文件自动继承
setfacl -m d:u:ops:rwx /data/share

# 收回授权与清空全部 ACL
setfacl -x u:ops /data/report.txt
setfacl -b /data/report.txt

# 查看与临时关闭 SELinux
getenforce
setenforce 0
sed -i 's#^SELINUX=.*#SELINUX=disabled#g' /etc/selinux/config

# umask 计算：文件 666-022=644，目录 777-022=755
umask
umask 0022
touch new.txt && mkdir newdir && ls -l new.txt && ls -ld newdir
```

**坑位提示**

- `chmod -R 777 /data` 是最省事也最危险的修法：所有文件都被撒上执行位，权限再也收不回来。先想清楚谁需要什么权限，用属组和 ACL 解决。
- 这里有个坑：755 与 umask 是一回事的两面——新建目录 777-022=755、文件 666-022=644。`chmod 755` 只是事后把权限掰回默认值，改 umask 才是治本。
- `chattr +i` 锁过的文件，`chown`、`chmod`、`rm` 全部失败且报错不看权限大小，排障时先 `lsattr` 再下结论。
- ACL 设过一次后，`ls -l` 的组权限位显示的是 mask 而不是属组权限；组权限「看着变了」别慌，`getfacl` 看真相。

## 第五章 用户与组

核心思路：用户分三类——超级管理员 root（uid 0）、普通用户（CentOS 7 从 uid 1000 起）、虚拟用户（uid 1 到 999，不能登录，用于运行服务）。用户相关的数据分布在 `/etc/passwd`、`/etc/shadow`、`/etc/group`、`/etc/gshadow` 四个文件中。

### 5.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `useradd` | `-u` `-g` `-G` | 创建用户；`-u` 指定 uid，`-g` 指定主要组，`-G` 指定附属组，`-M` 不创建家目录，`-s /sbin/nologin` 指定不可登录的 shell（创建虚拟用户的标准写法），`-c` 添加注释说明，`-d` 指定家目录，`-r` 创建系统用户。替代 · 无 | `useradd www -u 1002 -M -s /sbin/nologin` |
| `usermod` | `-s` `-u` `-G` | 修改已存在用户的属性；参数与 `useradd` 一致，另加 `-L` 锁定账号、`-U` 解锁、`-aG` 追加附属组（漏掉 `-a` 会覆盖原有附属组）。替代 · 无 | `usermod -aG wheel ops` |
| `userdel` | `-r` `-f` | 删除用户；`-r` 连同家目录与邮件池一起删除（常用），`-f` 强制删除（含已登录用户）。替代 · 无 | `userdel -r ops` |
| `passwd` | `--stdin` `-l` | 设置或修改用户密码；不加用户名改自己的，`--stdin` 从标准输入读取（用于脚本非交互设置），`-l` 锁定、`-u` 解锁、`-e` 强制下次登录改密。替代 · 无 | `echo '你的密码' \| passwd --stdin ops` |
| `chage` | `-l` `-M` `-E` | 查看与修改密码有效期策略；`-l` 查看详情，`-M 90` 密码最长有效 90 天，`-W 7` 提前 7 天警告，`-I 7` 过期后 7 天禁用，`-E` 设置账号到期日，`-d 0` 强制下次登录改密。替代 · 无 | `chage -M 90 -W 7 ops` |
| `groupadd` | `-g` `-r` | 创建用户组；`-g` 指定 gid，`-r` 创建系统组。替代 · 无 | `groupadd -g 1005 devops` |
| `groupmod` | `-g` `-n` | 修改组的 gid 或组名。替代 · 无 | `groupmod -n opsdev ops` |
| `groupdel` | 无常用参数 | 删除用户组，组内还有用户以它为主要组时无法删除。替代 · 无 | `groupdel devops` |
| `gpasswd` | `-a` `-d` `-M` | 管理组成员；`-a` 把用户加入组，`-d` 从组中移除，`-M` 批量设置组成员（会覆盖原成员）。替代 · 无 | `gpasswd -a ops wheel` |
| `id` | `-u` `-g` `-G` | 查看用户的 uid、gid 与所属全部组，是「检查用户是否存在」的标准动作；`-n` 配合前面参数显示名称而非数字。替代 · 无 | `id ops` |
| `w` | `-h` `-f` | 查看系统负载与当前登录用户的详细信息（含登录来源 IP 与正在执行的命令）。替代 · 无 | `w` |
| `who` | `-a` `-b` | 查看当前登录系统的用户，比 `w` 更简洁；`-b` 显示上次系统启动时间。替代 · 无 | `who` |
| `whoami` | 无常用参数 | 确认当前身份的用户名，脚本中常用于权限判断。替代 · 无 | `whoami` |
| `last` | `-n` `-a` `-f` | 查看用户登录历史，读取 `/var/log/wtmp`；`-n 10` 只看最近 10 条，`-a` 把来源 IP 显示在末尾。替代 · 无 | `last -n 10` |
| `lastlog` | `-u` `-b` | 查看所有用户最近一次登录的时间，排查僵尸账号很有用。替代 · 无 | `lastlog` |
| `su` | `-` `-c` | 切换用户；`su - ops` 带 `-` 表示完全切换（加载目标用户的环境变量，推荐），不带 `-` 只切换身份不换环境；`-c` 只执行一条命令。替代 · 日常提权建议用 `sudo` | `su - ops` |
| `sudo` | `-u` `-l` `-i` | 以其他用户身份执行命令，默认提权到 root；`-l` 查看自己被授予的权限，`-u ops` 以指定用户执行，`-i` 切换到 root 的登录环境。授权配置写在 `/etc/sudoers`，必须用 `visudo` 编辑。替代 · 无，是替代 `su` 的标准做法 | `sudo -u www ls /data/www` |

### 5.2 示例
{: .sec-ex}

```bash
# 创建普通用户与虚拟用户
useradd ops
useradd www -u 1002 -M -s /sbin/nologin

# 创建带注释、指定 uid 与所属组的用户
useradd mysql -s /sbin/nologin -M -c "manager database"
useradd dev -u 2001 -g devops -G wheel

# 检查用户是否创建成功
id ops
grep ops /etc/passwd

# 交互式与非交互式设置密码
passwd ops
echo '你的密码' | passwd --stdin ops

# 查看与设置密码策略
chage -l ops
chage -M 90 -W 7 -I 7 ops
chage -d 0 ops

# 把用户追加到 wheel 组以获得 sudo 权限（注意 -a 不能漏）
usermod -aG wheel ops
gpasswd -a ops wheel

# 锁定与解锁账号
passwd -l ops
passwd -u ops

# 彻底删除用户及家目录
userdel -r ops

# 家目录配置文件丢失导致提示符变成 -bash-4.2$ 时的修复
cp /etc/skel/.b* /home/new01/
chown -R new01.new01 /home/new01

# 查看登录情况与历史
w
who
last -n 10
lastlog

# 配置 sudo 授权（必须用 visudo 检查语法）
visudo
ops     ALL=(ALL)       NOPASSWD: /usr/bin/systemctl, /usr/bin/yum

# 以其他用户身份执行命令
sudo -u www ls /data/www
sudo -i
```

**坑位提示**

- `usermod -G` 少了 `-a` 会清掉原有全部附属组。动手前先 `id 用户` 留底，改完再 `id` 核对一遍。
- `passwd --stdin` 会把密码留在命令行历史里，脚本里用完记得清 `~/.bash_history`，交互场景老老实实 `passwd 用户`。
- `chage -d 0` 会让用户下次登录必须改密。批量建完服务账号忘了这条，服务拿该账号认证会直接被拒。

```bash
# 批量创建带序号的测试用户并设初始密码
for i in $(seq -w 1 20); do useradd -m test$i; echo "test$i:你的密码" | chpasswd; done
```

## 第六章 磁盘与文件系统

核心思路：磁盘使用的标准流程是「分区 → 创建文件系统 → 挂载 → 写入 fstab 永久生效」。容量问题排查时，`df` 看文件系统整体、`du` 看目录明细、`df -i` 查 inode 是否耗尽。

### 6.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `df` | `-h` `-i` `-T` | 查看已挂载文件系统的磁盘使用情况；`-h` 人类可读，`-i` 查看 inode 使用，`-T` 显示文件系统类型。替代 · 无 | `df -hT` |
| `du` | `-s` `-h` `--max-depth` | 统计目录或文件占用的磁盘空间；`-s` 只给汇总值，`-h` 人类可读，`--max-depth=1` 只看一级子目录，`-a` 含文件。替代 · 无 | `du -sh --max-depth=1 /var` |
| `mount` | `-t` `-o` `-a` | 挂载存储设备到目录；`-t` 指定文件系统类型，`-o` 指定挂载参数（如 `ro`、`noatime`、`loop`），`-a` 挂载 fstab 中的所有条目。替代 · 无，`findmnt` 可辅助查看挂载关系 | `mount /dev/sdb1 /mount01` |
| `umount` | `-f` `-l` 挂载点 | 卸载设备，可用挂载点或设备名作参数；设备繁忙时用 `-l` 延迟卸载或 `-f` 强制卸载。替代 · 无 | `umount /mount01` |
| `fdisk` | `-l` 交互命令 | 对小于 2T 的磁盘做 MBR 分区；`-l` 查看分区表，进入交互后 `n` 新建、`d` 删除、`p` 打印、`w` 保存、`q` 不保存退出。替代 · 大于 2T 的磁盘请改用 `parted` | `fdisk -l /dev/sdb` |
| `parted` | `-l` `mklabel` | 对大于 2T 的磁盘做 GPT 分区，支持交互与命令行两种模式；`-l` 查看，`mklabel gpt` 建 GPT 分区表，`mkpart` 建分区。替代 · 无，是大于 2T 磁盘的标准工具 | `parted /dev/sdb mklabel gpt` |
| `mkfs` | `-t` `-L` `-f` | 创建文件系统（格式化）；`mkfs.xfs`、`mkfs.ext4` 是常用写法，`-t` 指定类型，`-L` 设卷标。注意格式化会清空数据。替代 · 无 | `mkfs.xfs /dev/sdb1` |
| `fsck` | `-y` `-f` `-n` | 检查并修复文件系统，必须在卸载状态下执行；xfs 文件系统请用 `xfs_repair` 而非 `fsck`。替代 · 无 | `fsck -y /dev/sdb2` |
| `lsblk` | `-f` `-a` `-m` | 以树状列出所有块设备及挂载关系，`-f` 同时显示文件系统类型与 UUID。替代 · 无，比 `fdisk -l` 更直观 | `lsblk -f` |
| `blkid` | `-s` `-o` | 查看块设备的 UUID 与文件系统类型，写 fstab 时用来取 UUID。替代 · 无 | `blkid /dev/sdb1` |
| `findmnt` | `-T` `--fstab` | 查看挂载点与挂载参数，或查询某路径所属的文件系统；`--fstab` 只显示 fstab 中的配置。替代 · 无，比直接读 `/etc/mtab` 更规范 | `findmnt -T /home/ops` |
| `pvcreate` | `-f` 设备 | LVM 第一步：把物理分区创建为物理卷。替代 · 无 | `pvcreate /dev/sdb1` |
| `vgcreate` | `-s` 卷组名 | LVM 第二步：把物理卷组成卷组；`-s` 指定 PE 大小。替代 · 无 | `vgcreate vg_data /dev/sdb1` |
| `lvcreate` | `-L` `-n` `-l` | LVM 第三步：从卷组中划分逻辑卷；`-L 10G` 指定大小，`-n` 指定名称，`-l +100%FREE` 用尽剩余空间。替代 · 无 | `lvcreate -L 10G -n lv_data vg_data` |
| `lvextend` | `-L` `-l` `-r` | 扩容逻辑卷；`-L +5G` 增加 5G，`-l +100%FREE` 用尽剩余空间，`-r` 同步扩容文件系统。扩容后还需 `xfs_growfs` 或 `resize2fs`。替代 · 无 | `lvextend -r -L +5G /dev/vg_data/lv_data` |
| `vgextend` | 卷组名 设备 | 把新的物理卷加入已有卷组，用于卷组扩容。替代 · 无 | `vgextend vg_data /dev/sdc1` |
| `mkswap` | `-L` 设备 | 把分区或文件初始化为 swap 交换空间。替代 · 无 | `mkswap /dev/sdb2` |
| `swapon` | `-a` `-s` `-p` | 启用 swap；`-a` 启用 fstab 中全部 swap，`-s` 查看 swap 使用明细。替代 · 查看也可用 `free -h` | `swapon -a` |
| `swapoff` | `-a` 设备 | 关闭 swap；调整 swap 大小时先 `swapoff` 再重建。替代 · 无 | `swapoff -a` |
| `dd` | `if=` `of=` `bs=` | 按块复制数据，常用于创建测试文件、备份 MBR、测磁盘写入速度；`if` 输入、`of` 输出、`bs` 块大小、`count` 块数量。替代 · 无，但被称为「磁盘粉碎机」，参数写错后果严重 | `dd if=/dev/zero of=/tmp/test.txt bs=10M count=100` |

### 6.2 示例
{: .sec-ex}

```bash
# 查看磁盘挂载与使用情况（block 视角与 inode 视角）
df -h
df -i
df -hT

# 一层层定位大目录
du -sh --max-depth=1 /var
du -sh /var/log/*

# 查看块设备与 UUID
lsblk -f
blkid /dev/sdb1

# 对小于 2T 的磁盘分区（MBR）
fdisk /dev/sdb
# 交互过程依次为：n → p → 1 → 回车 → +1G → p → w

# 让内核重读分区表，无需重启
partprobe /dev/sdb

# 创建文件系统
mkfs.xfs /dev/sdb1
mkfs -t xfs /dev/sdb2
mkfs.ext4 /dev/sdb3

# 挂载并验证
mkdir -p /mount01
mount /dev/sdb1 /mount01
df -h
findmnt /dev/sdb1

# 写入 fstab 实现开机自动挂载（推荐用 UUID）
blkid /dev/sdb1
# UUID=xxxx-xxxx  /mount01  xfs  defaults  0 0
mount -a

# 卸载设备（设备繁忙时先查占用进程）
lsof /mount01
fuser -mv /mount01
umount /mount01
umount -l /mount01

# LVM 标准扩容流程
pvcreate /dev/sdb1
vgcreate vg_data /dev/sdb1
lvcreate -L 10G -n lv_data vg_data
mkfs.xfs /dev/vg_data/lv_data
mount /dev/vg_data/lv_data /data

# 卷组不够时先扩卷组，再扩逻辑卷与文件系统
pvcreate /dev/sdc1
vgextend vg_data /dev/sdc1
lvextend -L +5G /dev/vg_data/lv_data
xfs_growfs /data            # xfs 文件系统扩容
resize2fs /dev/vg_data/lv_data   # ext4 文件系统扩容

# 一条命令完成扩容并同步文件系统
lvextend -r -l +100%FREE /dev/vg_data/lv_data

# 用文件方式增加 swap（临时应急）
dd if=/dev/zero of=/swapfile bs=1M count=1024
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
swapon -s
swapoff /swapfile

# 用 dd 测试磁盘写入性能
dd if=/dev/zero of=/tmp/test.txt bs=10M count=100 oflag=direct
```

**坑位提示**

- `dd` 的 `if=`、`of=` 写反，就是「磁盘粉碎机」的标准引爆方式：用零覆盖了源盘。回车前逐字核对这两个参数。
- fstab 写错后重启会直接进紧急模式。改完先 `mount -a` 验证，过了再重启，别赌运气。
- `umount` 报 busy 时别急着 `-f`，先 `lsof +D 挂载点` 找到占用进程，NFS 才轮到 `-lf`。
- `df` 与 `du` 数字对不上不一定是 bug：被删除仍被进程占用的文件、挂载点下的隐藏数据都会造成差异，`lsof | grep deleted` 先查。

```bash
# 一行找出使用率超过 80% 的分区，常放进巡检脚本
df -h | awk 'NR>1 && $5+0>=80 {print $6, $5}'

# 定位某目录下占空间最大的 10 个文件
find /data -type f -exec du -h {} + 2>/dev/null | sort -rh | head -10
```

## 第七章 软件包管理

核心思路：软件安装三种方式——RPM 包（手工装，需自己解决依赖）、YUM 或 DNF（自动解决依赖，推荐）、源码编译（可定制功能与路径，用于有特殊模块需求的场景）。装完务必确认版本号与运行状态。

### 7.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `rpm` | `-qa` `-ql` `-qf` | RPM 包管理；`-qa` 列出全部已安装包（配合 `grep` 查是否安装），`-ql` 列出包内文件清单，`-qf 绝对路径` 查文件属于哪个包，`-ivh` 安装并显示进度，`-Uvh` 升级，`-e` 卸载，`-qc` 只看配置文件，`-qR` 查依赖关系。替代 · 日常安装请用 `yum` 或 `dnf` | `rpm -qa \| grep rsync` |
| `yum` | `install` `-y` | 自动解决依赖的软件包管理器（CentOS 6 与 7 主力）；`-y` 自动确认，`install` 安装，`remove` 卸载，`update` 更新，`list` 列出，`repolist` 查看源，`provides` 反查命令属于哪个包，`groupinstall` 安装包组，`history` 查看操作历史，`clean all` 清缓存，`makecache` 建缓存。替代 · CentOS 8 及以上请用 `dnf` | `yum install -y rsync` |
| `dnf` | `install` `-y` | 新一代 RPM 系包管理器，语法与 `yum` 完全兼容，依赖解析更快；`dnf module list`、`dnf module enable` 用于管理模块流。替代 · 无，是 `yum` 的升级替代 | `dnf install -y nginx` |
| `yum-config-manager` | `--add-repo` | 添加或启用软件源，来自 `yum-utils` 包。替代 · 也可手工在 `/etc/yum.repos.d/` 下写 repo 文件 | `yum-config-manager --add-repo http://example.com/repo` |
| `yumdownloader` | `--destdir` | 只下载 RPM 包不安装，用于离线环境打包。来自 `yum-utils`。替代 · 也可用 `dnf download` | `yumdownloader --destdir=/tmp nginx` |
| `./configure` | `--prefix` `--user` | 源码编译第一步：检查环境并生成 Makefile；`--prefix` 指定安装路径，`--user` 与 `--group` 指定运行用户，`--with-xxx_module` 开启模块。替代 · 无 | `./configure --prefix=/usr/local/nginx --user=www` |
| `make` | `-j` `&&` | 源码编译第二步：按 Makefile 编译；`-j 4` 用 4 核并行加速。常用 `make && make install`。替代 · 无 | `make -j $(nproc) && make install` |
| `make install` | 无常用参数 | 源码编译第三步：把编译产物复制到安装目录。替代 · 卸载通常执行 `make uninstall` 或直接删除安装目录 | `make install` |
| `ldconfig` | `-p` `-v` | 刷新动态链接库缓存，源码安装后若报「找不到共享库」需执行；`-p` 查看已缓存的库。替代 · 无 | `ldconfig` |
| `alternatives` | `--config` `--set` | 管理多版本命令的默认指向，如切换 python 或 java 版本。替代 · 无 | `alternatives --config python` |

### 7.2 示例
{: .sec-ex}

```bash
# 查看软件是否安装、包内有哪些文件、某文件属于哪个包
rpm -qa | grep rsync
rpm -ql nginx
rpm -qf /etc/nginx/nginx.conf
rpm -qc nginx

# 反查某个命令属于哪个软件包
yum provides locate
yum provides */ifconfig

# 安装、卸载与重装
yum install -y rsync
yum reinstall -y nginx
yum remove -y nginx

# 安装包组（如开发工具组）
yum grouplist
yum groupinstall -y "Development Tools"

# 查看源信息并重建缓存
yum repolist
yum clean all
yum makecache

# 查看与回滚 yum 操作历史
yum history list
yum history undo 12

# 只下载不安装（离线部署常用）
yum install -y yum-utils
yumdownloader --destdir=/tmp/packages nginx

# 配置软件源
vim /etc/yum.repos.d/nginx.repo
# [nginx-stable]
# name=nginx stable repo
# baseurl=http://nginx.org/packages/centos/$releasever/$basearch/
# gpgcheck=1
# enabled=1

# 手动安装本地或远程 RPM 包
rpm -ivh /tmp/zabbix-agent-4.0.0-2.el7.x86_64.rpm
rpm -ivh http://example.com/packages/zabbix-release-4.0-1.el7.noarch.rpm

# 源码编译标准三步曲
yum install -y gcc gcc-c++ make pcre-devel zlib-devel openssl-devel
wget http://nginx.org/download/nginx-1.16.0.tar.gz
tar xf nginx-1.16.0.tar.gz
cd nginx-1.16.0
./configure --prefix=/usr/local/nginx --user=www --group=www \
--with-http_ssl_module --with-http_stub_status_module \
--with-http_gzip_static_module --with-pcre-jit
make -j $(nproc)
make install

# 编译安装后刷新动态库缓存
echo "/usr/local/lib" > /etc/ld.so.conf.d/local.conf
ldconfig

# dnf 与 yum 语法一致，模块流管理是它的特色
dnf module list
dnf module enable nginx:1.20
dnf install -y nginx
```

**坑位提示**

- `rpm -e` 卸载被依赖的包会连环报错，先 `rpm -q --whatrequires 包名` 查清楚谁在依赖它，再决定卸载顺序。
- 源码编译报错十有八九缺 devel 包，把报错里的第一个 `xxx.h` 拿去 `yum provides */xxx.h` 反查。
- `yum clean all` 之后第一次安装要重建缓存，明显变慢属正常现象，别误判成源故障。

```bash
# 离线部署三件套：连依赖一起下载、传过去、本地安装
yumdownloader --resolve --destdir=/tmp/pkg nginx
scp -r /tmp/pkg 10.0.0.7:/tmp
yum localinstall -y /tmp/pkg/*.rpm
```

## 第八章 进程与性能

核心思路：性能排查有固定套路——`uptime` 看负载、`top` 看谁在吃资源、`vmstat` 看是否内存或 IO 瓶颈、`iostat` 看磁盘、`free` 看内存与缓存。进程管理上，`ps` 查进程、`kill` 发信号、`nice` 调优先级。

### 8.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `ps` | `-ef` `aux` | 查看进程快照；`ps -ef` 是标准风格（含 PPID），`ps aux` 是 BSD 风格（含 CPU 与内存占用），常用 `ps -ef \| grep` 配合过滤。替代 · 无 | `ps -ef \| grep nginx` |
| `top` | `-p` `-d` `-c` | 实时查看系统整体负载与进程资源占用；进入后按 `P` 按 CPU 排序、`M` 按内存排序、`1` 展开每个 CPU 核心、`c` 显示完整命令行。替代 · 交互体验更好可选 `htop` | `top -p 1234` |
| `htop` | `-p` `-d` | 彩色交互式进程查看器，支持鼠标与树状视图，比 `top` 直观；需 `yum install -y htop`。替代 · 无，是 `top` 的增强替代品 | `htop` |
| `kill` | `-9` `-15` | 向进程发送信号；默认 `-15` 是优雅退出（TERM），`-9` 是强制杀掉（KILL，可能丢数据），`-1` 是重载配置（HUP，常用于 nginx 与 sshd）。替代 · 按名杀进程用 `pkill` | `kill -9 1234` |
| `killall` | `-9` `-u` | 按进程名批量杀进程，来自 `psmisc` 包。替代 · 无 | `killall -9 nginx` |
| `pkill` | `-9` `-f` | 按进程名（支持模式匹配）杀进程；`-f` 匹配完整命令行，`-u` 指定用户。替代 · 无，比 `kill` 更省事 | `pkill -9 -f "python app.py"` |
| `pgrep` | `-l` `-f` | 按名查找进程 PID，常与 `pkill` 配对使用；`-l` 同时显示进程名。替代 · 无 | `pgrep -l nginx` |
| `nice` | `-n` 命令 | 以指定优先级启动进程，值越小优先级越高，范围 -20 到 19，普通用户只能调低优先级。替代 · 无 | `nice -n 10 tar zcf /tmp/bak.tgz /data` |
| `renice` | `-n` `-p` | 调整已运行进程的优先级；`-p` 指定 PID，`-u` 指定用户。替代 · 无 | `renice -n 5 -p 1234` |
| `free` | `-h` `-m` | 查看内存与 swap 使用情况；`-h` 人类可读，`-m` 以 MB 显示。注意 `buff/cache` 是被内核借走的缓存，可用内存看 `available` 列。替代 · 无 | `free -h` |
| `vmstat` | `1` `5` `-S` | 综合查看进程、内存、swap、IO、系统与 CPU；`vmstat 1 5` 表示每秒采样一次共 5 次，重点看 `r`（运行队列）、`si` 与 `so`（swap 换入换出）、`wa`（IO 等待）。替代 · 无 | `vmstat 1 5` |
| `iostat` | `-x` `-d` `1` | 查看磁盘 IO 性能，来自 `sysstat` 包；`-x` 显示扩展指标，重点看 `%util`（设备繁忙度，接近 100% 说明磁盘饱和）与 `await`（IO 等待时间）。替代 · 无 | `iostat -x 1 5` |
| `mpstat` | `-P` `ALL` | 查看每个 CPU 核心的使用明细，判断是否存在单核跑满。来自 `sysstat`。替代 · 无 | `mpstat -P ALL 1` |
| `sar` | `-u` `-r` `-n` | 系统活动报告，可查看历史性能数据；`-u` CPU、`-r` 内存、`-n DEV` 网卡流量、`-d` 磁盘，加 `-f /var/log/sa/saXX` 回看历史某天。替代 · 无 | `sar -n DEV 1 5` |
| `uptime` | `-p` `-s` | 查看系统运行时长与 1、5、15 分钟平均负载；负载高于 CPU 核数说明系统承压，`-s` 显示开机时间。替代 · 无 | `uptime` |
| `lsof` | `-i` `-p` `文件` | 列出被进程打开的文件，是「文件删了空间没释放」与「端口被谁占用」的排查神器；`-i :80` 查端口占用，`-p PID` 查进程打开的文件，`+D 目录` 查目录占用，删除后未释放的文件标记为 `deleted`。替代 · 无 | `lsof -i :80` |
| `fuser` | `-mv` `-k` | 查看正在使用某文件或挂载点的进程；`-mv` 详细显示，`-k` 直接杀掉占用进程（卸载设备繁忙时用）。来自 `psmisc`。替代 · 无 | `fuser -mv /mount01` |
| `dstat` | `-cdnm` | 综合性能查看工具，把 CPU、磁盘、网络、内存放在一屏输出。需额外安装。替代 · 无，可视为 `vmstat` 与 `iostat` 的合体 | `dstat -cdnm 1` |

### 8.2 示例
{: .sec-ex}

```bash
# 查看系统负载与运行时长
uptime

# 查看进程树与指定服务进程
ps -ef | grep nginx
ps -ef | grep -c [n]ginx
pstree -p | head -20

# 实时查看资源占用，按 P 排 CPU、按 M 排内存、按 1 展开核心
top
top -p $(pgrep nginx | head -1)

# 查看内存，重点关注 available 与 buff/cache
free -h

# 综合性能采样：每秒 1 次共 5 次
vmstat 1 5

# 查看磁盘 IO 瓶颈，重点看 %util 与 await
iostat -x 1 5

# 查看每个 CPU 核心的使用率
mpstat -P ALL 1

# 查看网卡流量与历史数据
sar -n DEV 1 5
sar -u -f /var/log/sa/sa20

# 查端口占用与查进程打开了哪些文件
lsof -i :80
lsof -i :22
lsof -p 1234
lsof +D /data

# 查文件被谁占用导致无法卸载
lsof /mount01
fuser -mv /mount01

# 找出已删除但仍被进程占用、导致空间未释放的文件
lsof | grep deleted

# 优雅终止与强制终止
kill -15 1234
kill -9 1234
pkill -9 -f "python app.py"
killall -9 nginx

# 让 nginx 重新加载配置文件（HUP 信号）
kill -1 $(cat /var/run/nginx.pid)

# 备份任务降优先级运行，避免拖垮业务
nice -n 10 tar zcf /tmp/bak.tgz /data
renice -n 5 -p 1234

# 一键找出占用 CPU 最高的 10 个进程
ps aux --sort=-%cpu | head -10
ps aux --sort=-%mem | head -10
```

**坑位提示**

- `kill -9` 是最后手段：不给进程收尾机会，数据库类进程可能留下脏数据。先发 `-15`，等几秒没反应再升级。
- 敲一遍就明白：杀进程的正确姿势是先 `pgrep -l` 确认命中谁，再决定用 `kill` 还是 `pkill`；`pkill -f` 模式写宽了会误杀。
- `lsof | grep deleted` 找到的「已删除未释放」文件，把对应进程重启才是释放空间的正解，`rm` 解决不了。
- `top` 里 `%wa` 高说明瓶颈在磁盘不在 CPU，这时候加核没用，先看 `iostat -x`。

```bash
# 连续观察内存走势，判断是否存在持续泄漏
free -h -s 5 -c 6

# 排查单核打满：看哪个核心利用率异常
mpstat -P ALL 1 3
```

## 第九章 网络管理

核心思路：网络排障自上而下——先 `ping` 通不通，再 `ss` 看端口有没有监听，然后 `curl` 验服务，最后抓路由与 DNS。`ifconfig`、`netstat`、`route`、`arp` 这一批老命令已被 `ip` 与 `ss` 全面取代，新脚本不要再使用。

### 9.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `ip` | `addr` `route` | 新一代网络配置工具，统一取代旧的网络命令；`ip a` 查看网卡地址，`ip r` 查看路由表，`ip link set eth0 up` 启停网卡，`ip neigh` 查看 ARP 表，`ip addr add 10.0.0.7/24 dev eth0` 临时配地址。替代 · 无，是 `ifconfig` 与 `route` 的官方替代 | `ip a` |
| `ifconfig` | `-a` 网卡名 | 查看或临时配置网卡地址信息，来自 `net-tools` 包。替代 · **已废弃**，请一律改用 `ip addr` | `ip addr show eth0` |
| `ss` | `-lntup` `-tan` | 查看 socket 与网络连接，速度远快于 `netstat`；`-l` 只看监听、`-n` 不解析服务名、`-t` TCP、`-u` UDP、`-p` 显示进程、`-a` 全部、`-s` 汇总统计。替代 · 无，是 `netstat` 的官方替代 | `ss -lntup \| grep 80` |
| `netstat` | `-lntup` `-an` | 查看网络连接、路由表与接口统计，来自 `net-tools` 包。替代 · **已废弃**，请一律改用 `ss` | `ss -lntup \| grep 10050` |
| `ping` | `-c` `-i` `-W` | 测试网络连通性与延迟；`-c 4` 发 4 个包，`-i` 间隔，`-W` 超时秒数。替代 · 无 | `ping -c 4 223.5.5.5` |
| `traceroute` | `-n` `-T` | 追踪数据包到目标主机经过的每一跳，定位链路中断点；`-n` 不做反向解析，`-T` 用 TCP 探测（UDP 被禁时可用）。替代 · 也可用 `tracepath` 或 `mtr` | `traceroute -n www.example.com` |
| `mtr` | `-n` `-r` `-c` | `ping` 与 `traceroute` 的结合体，持续显示每一跳的丢包率与延迟，是定位网络抖动的首选。需 `yum install -y mtr`。替代 · 无 | `mtr -n -r -c 10 223.5.5.5` |
| `dig` | `+short` `@` | DNS 解析查询工具，排障 DNS 的标准工具；`dig 域名` 看完整解析过程，`dig +short 域名` 只要结果，`dig @8.8.8.8 域名` 指定 DNS 服务器，`dig -x IP` 反查。替代 · 无，功能强于 `nslookup` | `dig +short www.example.com` |
| `nslookup` | 域名 `-type` | 交互式 DNS 查询工具，输出简单但信息少于 `dig`。替代 · 建议改用 `dig` | `nslookup www.example.com` |
| `host` | `-a` `-t` | 精简的 DNS 查询命令，一行出结果。替代 · 无 | `host www.example.com` |
| `curl` | `-I` `-L` `-o` | 命令行 HTTP 客户端，验证 Web 服务的第一工具；`-I` 只取响应头，`-L` 跟随跳转，`-o` 保存到文件，`-H` 自定义请求头，`-X` 指定方法，`-w` 输出耗时指标，`-k` 忽略证书校验。替代 · 无 | `curl -I -H "host:www.example.com" 10.0.0.7` |
| `wget` | `-O` `-c` `-q` | 命令行下载工具；`-O` 指定保存文件名，`-c` 断点续传，`-q` 静默模式，`--spider` 只探测不下载。替代 · 无 | `wget -O /tmp/nginx.tar.gz http://example.com/nginx.tar.gz` |
| `nc` | `-l` `-z` `-v` | 网络瑞士军刀，用于端口探测、临时传输数据、搭建简易监听；`nc -z -v 主机 端口` 探测端口是否通，`nc -l 1234` 监听端口。需 `yum install -y nc`。替代 · 无 | `nc -z -v 10.0.0.7 80` |
| `telnet` | 主机 端口 | 远程登录与端口连通性测试，明文传输不安全。替代 · **已废弃**为远程登录用途，端口探测请用 `nc` 或 `ssh` | `nc -z -v 10.0.0.7 22` |
| `ssh` | `-p` `-i` `-o` | 安全远程登录；`-p` 指定端口，`-i` 指定私钥，`-o StrictHostKeyChecking=no` 跳过首次确认（批量场景常用），`-C` 压缩，`-L` 与 `-R` 做端口转发。替代 · 无 | `ssh -p 52113 ops@10.0.0.7` |
| `ssh-keygen` | `-t` `-b` `-N` | 生成 SSH 密钥对；`-t rsa` 指定类型（rsa、ed25519），`-b 4096` 指定长度，`-N ''` 设置空口令，`-f` 指定文件名。替代 · 无 | `ssh-keygen -t rsa -b 4096` |
| `ssh-copy-id` | `-i` `-p` | 把公钥分发到远程主机，实现免密登录；`-i` 指定公钥文件，`-p` 指定端口。替代 · 无 | `ssh-copy-id -i ~/.ssh/id_rsa.pub ops@10.0.0.7` |
| `scp` | `-r` `-P` `-p` | 基于 SSH 的安全复制；`-r` 递归复制目录，`-P` 指定端口（大写），`-p` 保留属性。替代 · 大批量或增量同步请用 `rsync` | `scp -rp /tmp/web_back.sql 10.0.0.7:/tmp` |
| `rsync` | `-avz` `--delete` | 远程与本地数据同步，只传差异部分；`-a` 归档模式，`-v` 显示过程，`-z` 传输压缩，`--delete` 保持与源完全一致（危险参数，需先 `--dry-run` 预演），`--exclude` 排除，`--exclude-from` 从文件读排除列表，`--password-file` 免密认证，`-e ssh` 走 SSH 通道。替代 · 无 | `rsync -avz /data/ rsync_backup@172.16.1.31::backup --password-file=/etc/rsync.password` |
| `nmtui` | 无常用参数 | 图形化（字符界面）修改网卡地址信息，交互式配置 IP、网关与 DNS，配置自动持久化。替代 · 无 | `nmtui` |
| `ethtool` | `eth0` `-i` | 查看与调整网卡参数，如速率、双工模式、驱动版本，排查物理层问题常用。替代 · 无 | `ethtool eth0` |

### 9.2 示例
{: .sec-ex}

```bash
# 查看网卡地址与路由（新方式）
ip address show
ip addr show eth0
ip route show
ip neigh show

# 查看端口监听与连接状态（新方式，替代 netstat）
ss -lntup
ss -lntup | grep 80
ss -tan | grep -c ':80 '

# 统计各种状态的 TCP 连接数
ss -ant | awk 'NR>1{print $1}' | sort | uniq -c | sort -rn

# 连通性测试
ping -c 4 223.5.5.5
ping -c 4 -W 1 10.0.0.7

# 追踪链路与持续观察丢包
traceroute -n www.example.com
mtr -n -r -c 10 223.5.5.5

# DNS 解析排查
dig www.example.com
dig +short www.example.com
dig @223.5.5.5 www.example.com
nslookup www.example.com

# 验证 Web 服务：指定 Host 头访问后端
curl -I -H "host:www.example.com" 10.0.0.7/test.html
curl -L -o /tmp/page.html http://www.example.com
curl -w "状态码:%{http_code} 总耗时:%{time_total}\n" -o /dev/null -s http://www.example.com

# 下载文件与断点续传
wget -O /tmp/nginx.tar.gz http://nginx.org/download/nginx-1.16.0.tar.gz
wget -c http://example.com/bigfile.iso

# 端口连通性探测（telnet 的现代替代）
nc -z -v 10.0.0.7 80
nc -z -v 10.0.0.7 22
ssh -v -p 22 ops@10.0.0.7

# 配置 SSH 免密登录
ssh-keygen -t rsa -b 4096 -N '' -f ~/.ssh/id_rsa
ssh-copy-id -i ~/.ssh/id_rsa.pub ops@10.0.0.7
ssh-copy-id -i ~/.ssh/id_rsa.pub root@172.16.1.31 "-o StrictHostKeyChecking=no"

# 批量分发公钥（无 ssh-copy-id 时）
sshpass -p'你的密码' ssh-copy-id -i ~/.ssh/id_rsa.pub root@172.16.1.31 "-o StrictHostKeyChecking=no"

# 远程复制文件与目录
scp /tmp/web_back.sql 10.0.0.7:/tmp
scp -rp /data/www 10.0.0.7:/data/
scp -P 52113 -rp /data ops@10.0.0.7:/data

# rsync 本地与远程同步
rsync -av /data/ /backup/data/
rsync -avz /data/ rsync_backup@172.16.1.31::backup --password-file=/etc/rsync.password
rsync -avz rsync_backup@172.16.1.31::backup/10.0.0.7/ /backup/ --password-file=/etc/rsync.password
rsync -avz -e ssh /data/ root@172.16.1.31:/backup/

# 排除指定文件同步（先预演再执行）
rsync -avz --dry-run /data --exclude=b/1.txt --exclude=c/ rsync_backup@172.16.1.31::backup
rsync -avz /data --exclude-from=/data/exclude.txt rsync_backup@172.16.1.31::backup

# 查看备份服务器的模块列表
rsync rsync_backup@172.16.1.31::
```

**坑位提示**

- `scp` 的端口是大写 `-P`，`ssh` 是小写 `-p`，写反了 scp 会把小写 `-p` 当成「保留属性」静默生效，端口根本没换。
- `-o StrictHostKeyChecking=no` 只适合内网批量机器，公网主机别用——等于放弃中间人校验。
- rsync 源路径结尾带不带 `/` 结果差一倍：带 `/` 同步目录内容，不带 `/` 连目录本身一起搬。`--delete` 上生产前先 `--dry-run`。
- `ss -lntup` 看不到进程名多因权限不足：普通用户只能看到自己的 socket，加 `sudo` 再看。
- `curl -I` 发的是 HEAD 请求，部分服务对 HEAD 与 GET 的返回不同；验业务用 `curl -s -o /dev/null -w "%{http_code}" URL` 更接近真实。

```bash
# 统计当前 ESTABLISHED 并发连接数
ss -tan | awk '/ESTAB/{c++} END{print c+0}'

# 找出连到本机 80 端口连接数最多的前 10 个来源 IP
ss -tan | awk '$4 ~ /:80$/ {print $5}' | cut -d: -f1-4 | sort | uniq -c | sort -rn | head -10

# 验证解析结果是否一致，排查 DNS 劫持
dig +short www.example.com @223.5.5.5
dig +short www.example.com @119.29.29.29
```

## 第十章 系统与服务

核心思路：CentOS 7 之后，服务统一由 systemd 管理，`systemctl` 取代了 `service` 与 `chkconfig`，日志统一由 `journalctl` 管理。系统级的主机名、时区、语言也都有对应的 `xxxctl` 命令。

### 10.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `systemctl` | `start` `enable` | systemd 服务总控；`start` 启动、`stop` 停止、`restart` 重启、`reload` 重载配置、`status` 看详细状态、`enable` 设开机自启、`disable` 取消自启、`is-active` 查是否运行、`is-enabled` 查是否开机自启、`daemon-reload` 重载 unit 文件、`list-unit-files` 列出全部服务。替代 · 无，是 `service` 与 `chkconfig` 的替代 | `systemctl enable --now nginx` |
| `service` | `start` `status` | SysVinit 服务管理脚本，CentOS 7 上作为兼容层存在。替代 · **已废弃**，请一律改用 `systemctl` | `systemctl restart nginx` |
| `chkconfig` | `--list` `--add` | 管理 SysVinit 服务的开机自启。替代 · **已废弃**，请改用 `systemctl enable` | `systemctl enable nginx` |
| `hostnamectl` | `set-hostname` `status` | 查看与永久修改主机名，同时管理静态、瞬态与灵活主机名，改完直接写 `/etc/hostname`。替代 · 无，取代了直接编辑 `/etc/sysconfig/network` | `hostnamectl set-hostname web02` |
| `timedatectl` | `set-timezone` `status` | 查看与设置系统时间、时区与 NTP 同步；`set-timezone Asia/Shanghai` 设时区，`set-ntp true` 开启自动校时。替代 · 无，取代了手工改 `/etc/localtime` | `timedatectl set-timezone Asia/Shanghai` |
| `localectl` | `set-locale` `status` | 查看与设置系统字符集；`set-locale LANG=zh_CN.UTF-8` 设中文字符集。替代 · 无，取代了编辑 `/etc/sysconfig/i18n` | `localectl set-locale LANG=en_US.UTF-8` |
| `journalctl` | `-u` `-f` `-n` | 查看 systemd 统一收集的日志；`-u nginx` 只看某服务，`-f` 实时追踪，`-n 50` 最近 50 行，`--since "1 hour ago"` 按时间过滤，`-p err` 只看错误级别，`-b` 只看本次启动，`--disk-usage` 看日志占用。替代 · 无，逐渐取代分散的 `/var/log/messages` | `journalctl -u nginx -f` |
| `crontab` | `-e` `-l` `-r` | 定时任务管理；`-e` 编辑当前用户的任务，`-l` 查看，`-r` 删除全部，`-u ops` 管理其他用户。任务格式为「分 时 日 月 周 命令」，符号支持 `*`、`,`、`-`、`/`。替代 · 无 | `crontab -e` |
| `at` | `-l` `-d` `-f` | 一次性定时任务，与 `crontab` 的周期性任务互补；`at 14:00` 指定时间，`at now +1 hour` 相对时间，`-l` 查看队列（等价 `atq`），`-d` 删除任务（等价 `atrm`）。替代 · 周期任务请用 `crontab` | `at now +10 minutes` |
| `shutdown` | `-h` `-r` `-c` | 计划关机或重启（推荐方式，会通知在线用户）；`-h 5` 5 分钟后关机，`-h now` 立即关机，`-r 5` 5 分钟后重启，`-c` 取消计划。替代 · 无 | `shutdown -r 5` |
| `reboot` | `-f` 无其他 | 直接重启系统。替代 · 生产环境建议用 `shutdown -r 5` 留出缓冲时间 | `reboot` |
| `poweroff` | `-f` 无其他 | 直接关闭电源。替代 · 生产环境建议用 `shutdown -h` | `poweroff` |
| `halt` | `-p` 无其他 | 停止系统运行，不一定切断电源。替代 · 通常用 `poweroff` 或 `shutdown -h` | `halt` |
| `exit` | 无常用参数 | 注销当前登录会话，也可用 `logout` 或快捷键 `ctrl+d`。替代 · 无 | `exit` |
| `uname` | `-a` `-r` `-m` | 查看内核与系统信息；`-a` 显示全部，`-r` 内核版本，`-m` 硬件架构，`-n` 主机名。替代 · 无 | `uname -a` |
| `date` | `+格式` `-s` `-d` | 查看与设置系统时间；`date "+%F_%T"` 显示格式化时间，`-s` 设置时间，`-d "-1 day"` 显示相对时间。替代 · 时区与校时请用 `timedatectl` | `date "+%F_%T"` |
| `nproc` | `--all` | 查看 CPU 核心数，脚本中常用来决定编译并行度。替代 · 也可用 `lscpu` | `nproc` |
| `lscpu` | `-e` `-p` | 查看 CPU 架构、核心数、线程数与缓存信息。替代 · 无 | `lscpu` |
| `runlevel` | 无常用参数 | 查看当前与上一次的运行级别（CentOS 6 概念）。替代 · **已过时**，CentOS 7 用 `systemctl get-default` 与 `systemctl set-default` | `systemctl get-default` |

### 10.2 示例
{: .sec-ex}

```bash
# 服务启停与开机自启
systemctl start nginx
systemctl stop nginx
systemctl restart nginx
systemctl reload nginx
systemctl enable nginx
systemctl enable --now nginx
systemctl disable nginx

# 检查服务状态
systemctl status nginx
systemctl is-active nginx
systemctl is-enabled nginx
systemctl list-unit-files | grep nginx

# 修改了 unit 文件后必须重载
systemctl daemon-reload

# 查看系统默认运行级别（取代 runlevel）
systemctl get-default
systemctl set-default multi-user.target

# 主机名管理
hostnamectl status
hostnamectl set-hostname web02

# 时区与字符集
timedatectl status
timedatectl set-timezone Asia/Shanghai
timedatectl set-ntp true
localectl set-locale LANG=en_US.UTF-8

# 日志查看
journalctl -u nginx -f
journalctl -u nginx -n 50
journalctl -u nginx --since "1 hour ago"
journalctl -p err -b
journalctl --disk-usage
journalctl --vacuum-size=500M

# 定时任务：先确认命令能跑通，再写进 crontab
crontab -l
crontab -e
# 分 时 日 月 周 命令
# 0  0  *  *  *  /bin/sh /server/scripts/backup.sh &>/dev/null
# */5 * * * *  /usr/sbin/ntpdate ntp1.example.com >/dev/null 2>&1
# 0  2  *  *  0  /bin/sh /server/scripts/clear_log.sh &>/dev/null
crontab -u www -e

# crontab 中 % 需要转义，或把命令写进脚本
* * * * * /bin/date "+\%F \%T" >/tmp/time.txt
* * * * * /bin/sh /server/scripts/date.sh &>/dev/null

# 一次性任务
at now +10 minutes
at 14:00 tomorrow
at -l
at -d 3

# 计划关机与重启（推荐，可取消）
shutdown -h 5
shutdown -r 5
shutdown -c
shutdown -h now
shutdown -r now

# 系统信息查看
uname -a
uname -r
cat /etc/redhat-release
lscpu
nproc
free -h

# 时间查看与设置
date
date "+%F_%T"
date -s "2026-10-24 12:00:00"
date -d "-1 day" "+%F"
```

**坑位提示**

- `crontab -r` 一敲下去整个用户的任务全没了，没有确认也没有回收站。动之前先 `crontab -l > ~/cron.bak` 留底。
- crontab 行里的 `%` 会被当成换行、截断其后的内容，命令里要用百分号就转义 `\%`，或者干脆写进脚本再调度。
- `systemctl status` 显示的日志只有最后 10 行，深挖要用 `journalctl -u 服务`，别只看 status 就下结论。
- `reboot` 直接断会跳过服务的正常停止流程，生产机一律走 `shutdown -r now`，给 systemd 逐个收尾的机会。
- 改完 unit 文件只 `systemctl restart` 是不够的，先 `daemon-reload` 再重启，否则跑的还是旧配置。
- `crontab -e` 报「没有安装编辑器」时，`export EDITOR=vim` 再进。

```bash
# 服务起不来时按顺序查三处：状态、日志、端口
systemctl status nginx
journalctl -u nginx -n 50 --no-pager
ss -lntp | grep nginx
```

## 第十一章 压缩打包

核心思路：Linux 里「打包」与「压缩」是两件事——`tar` 负责把多个文件打成一个包，压缩算法（gzip、bzip2、xz）负责减小体积。日常最常用的是 `tar zcf` 打包压缩与 `tar xf` 解包。

### 11.1 命令卡

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `tar` | `-c` `-x` | 打包与解包工具；`-c` 创建包、`-x` 解包、`-t` 查看包内容、`-f` 指定包文件名（必须且放最后）、`-v` 显示过程、`-z` 用 gzip 压缩、`-j` 用 bzip2 压缩、`-J` 用 xz 压缩、`-C` 指定解压目录、`-p` 保留权限、`--exclude` 排除文件、`--exclude-from` 从文件读排除列表。替代 · 无 | `tar zcf /tmp/web_$(date +%F).tar.gz /data/www` |
| `gzip` | `-d` `-k` `-9` | gzip 压缩与解压，压缩后原文件消失（加 `-k` 可保留）；`-d` 解压（等价 `gunzip`），`-1` 到 `-9` 调节压缩比（`-9` 最慢最小），`-r` 递归目录。替代 · 传多文件请先用 `tar` 打包 | `gzip -9 access.log` |
| `gunzip` | `-c` `-k` | 解压 `.gz` 文件，等价 `gzip -d`；`-c` 输出到屏幕不落盘（配合重定向）。替代 · 也可用 `gzip -d` | `gunzip access.log.gz` |
| `zcat` | 无常用参数 | 不解压直接查看 `.gz` 文件内容，查压缩日志省去先解压的步骤。替代 · 无 | `zcat access.log.gz \| head` |
| `bzip2` | `-d` `-k` `-9` | bzip2 压缩，压缩率高于 gzip 但速度更慢，对应 `tar -j`。替代 · 追求速度请用 `gzip` | `bzip2 -k bigfile.log` |
| `xz` | `-d` `-k` `-9` | xz 压缩，压缩率最高、速度最慢，对应 `tar -J`。替代 · 无 | `xz -k bigfile.log` |
| `zip` | `-r` `-q` `-P` | 创建 zip 压缩包，与 Windows 通用；`-r` 递归目录，`-q` 静默，`-P` 设置密码（不推荐，明文可见）。需 `yum install -y zip`。替代 · Linux 内部传递优先用 `tar` | `zip -r www.zip /data/www` |
| `unzip` | `-d` `-l` `-o` | 解压 zip 包；`-d` 指定解压目录，`-l` 只看内容不解压，`-o` 不询问直接覆盖。需 `yum install -y unzip`。替代 · 无 | `unzip -d /data www.zip` |

### 11.2 示例
{: .sec-ex}

```bash
# 打包压缩与解包（gzip 方式，最常用）
tar zcf /tmp/web_$(date +%F).tar.gz /data/www
tar zcf /tmp/etc.tar.gz /etc
tar xf /tmp/web_2026-10-24.tar.gz
tar xf /tmp/web_2026-10-24.tar.gz -C /data/

# 不解压查看压缩包内容
tar tf /tmp/web_2026-10-24.tar.gz

# 排除指定文件或目录再打包
tar zcf /tmp/data.tar.gz /data --exclude=/data/logs --exclude=/data/cache
tar zcf /tmp/data.tar.gz /data --exclude-from=/data/exclude.txt

# 打包时使用相对路径，避免解压时层级过深
cd /data && tar zcf /tmp/www.tar.gz ./www

# bzip2 与 xz 方式
tar jcf /tmp/data.tar.bz2 /data
tar Jcf /tmp/data.tar.xz /data

# 单文件压缩与解压，保留原文件
gzip -9 -k access.log
gunzip access.log.gz
gzip -d access.log.gz

# 不解压直接查看压缩日志
zcat access.log.gz | head -20
zcat /usr/share/doc/zabbix-server-mysql-4.0.0/create.sql.gz | mysql -uzabbix -p'你的密码' zabbix

# zip 与 unzip（与 Windows 交互时使用）
yum install -y zip unzip
zip -r www.zip /data/www
unzip -l www.zip
unzip -d /data www.zip
unzip -o -d /data www.zip

# 批量压缩查找到的日志文件
find /data -type f -name "*.log" -mtime +7 -exec gzip {} \;

# 分割大压缩包，便于邮件或网盘传输
tar zcf - /data | split -b 500M -d - /tmp/data_part.tar.gz.
cat /tmp/data_part.tar.gz.* | tar zxf -
```

**坑位提示**

- `tar xf` 解包前先 `tar tf` 看一眼包内路径：带绝对路径或 `..` 的包解下去会覆盖系统文件，来路不明的包尤其要防。
- `gzip` 不加 `-k` 压缩完原文件就没了，批量操作前想清楚要不要保留原文件。
- `zip -P` 的密码明文嵌在命令里，会原样留在 history，真要加密走别的路。

```bash
# 每日备份并保留最近 7 天的滚动清理
tar zcf /backup/etc_$(date +%F).tar.gz /etc
find /backup -name "etc_*.tar.gz" -mtime +7 -delete
```

## 第十二章 服务专用命令

核心思路：这一章收录服务自带的管理命令，日常最高频、也最容易忘。每个服务记住两条就够用：配置文件语法检查命令与重载配置命令，敲一遍就明白。

### 12.1 Nginx

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `nginx` | `-t` `-s` | Nginx 主程序；`-t` 检查配置文件语法（改配置前必做），`-s reload` 重载配置、`-s stop` 立即停止、`-s quit` 优雅退出，`-v` 看版本、`-V` 看编译参数，`-c` 指定配置文件。替代 · 无 | `nginx -t && nginx -s reload` |
| `nginx -s reload` | 无常用参数 | 平滑重载配置，不中断现有连接，等价于 `systemctl reload nginx`。替代 · 无 | `nginx -s reload` |
| `logrotate` | `-f` `-d` | 日志切割工具，Nginx 与系统日志都由它轮转；`-f` 强制执行一次，`-d` 调试模式不真执行。配置文件在 `/etc/logrotate.d/`。替代 · 无 | `logrotate -f /etc/logrotate.d/nginx` |
| `ab` | `-n` `-c` | ApacheBench 压测工具，测试网站并发能力；`-n 1000` 总请求数，`-c 100` 并发数。来自 `httpd-tools`。替代 · 无 | `ab -n 1000 -c 100 http://www.example.com/` |

### 12.2 PHP-FPM 与数据库

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `php-fpm` | `-t` `-y` | PHP-FPM 主程序；`-t` 检查配置文件语法，`-y` 指定配置文件，`-R` 允许 root 运行。替代 · 服务启停请用 `systemctl` | `php-fpm -t` |
| `php` | `-v` `-m` `-i` | PHP 命令行解释器；`-v` 看版本，`-m` 列出已加载模块，`-i` 输出 `phpinfo` 信息，`-f` 执行脚本。替代 · 无 | `php -v` |
| `mysqld` | `--initialize` `--defaults-file` | MySQL 或 MariaDB 主程序；`--initialize` 初始化数据目录，通常由 systemd 拉起。替代 · 服务启停请用 `systemctl` | `systemctl start mariadb` |
| `mysql` | `-u` `-p` `-e` | MySQL 客户端；`-u` 指定用户，`-p` 提示输入密码，`-e` 直接执行 SQL 并退出（脚本常用），`-h` 指定主机，`-P` 指定端口。替代 · 无 | `mysql -uroot -p'你的密码' -e "show databases;"` |
| `mysqldump` | `-u` `-p` `--all-databases` | 数据库逻辑备份工具；`--all-databases` 备份全部库，`--single-transaction` 热备 InnoDB 不锁表，`-B` 指定库，`--databases` 多库。替代 · 无 | `mysqldump -uroot -p'你的密码' --all-databases >/tmp/web_back.sql` |
| `mysqladmin` | `-u` `status` | MySQL 管理客户端，可查状态、改密码、ping 检测存活。替代 · 简单查询也可用 `mysql -e` | `mysqladmin -uroot -p'你的密码' status` |
| `redis-cli` | `-h` `-p` `-a` | Redis 命令行客户端；`ping` 探活，`info` 看服务器信息，`dbsize` 看键数量，`get` 与 `set` 取值设值，`keys` 匹配键（生产慎用），`-a` 指定密码。替代 · 无 | `redis-cli -h 10.0.0.7 -p 6379 ping` |
| `redis-server` | `/path/redis.conf` | 启动 Redis 服务，后面跟配置文件路径。替代 · 服务启停请用 `systemctl` | `systemctl start redis` |

### 12.3 Ansible 与 Zabbix

| 命令 | 常用参数 | 作用 | 示例 |
| --- | --- | --- | --- |
| `ansible` | `-m` `-a` | 批量管理主机的临时命令工具；`-m` 指定模块（command、shell、copy、file、yum、service、cron、user、fetch、script），`-a` 指定模块动作，目标可写主机名、主机组或 `all`，`--list-hosts` 先确认目标，`--check` 预演，`-i` 指定主机清单，`-u` 指定连接用户，`-b` 提权。替代 · 无 | `ansible all -m command -a "hostname"` |
| `ansible-playbook` | `-C` `--syntax-check` | 执行剧本；`-C` 或 `--check` 预演不真执行，`--syntax-check` 只检查语法，`--tags` 只执行指定标签，`-e` 传额外变量，`-i` 指定主机清单。替代 · 无 | `ansible-playbook --syntax-check site.yml` |
| `ansible-doc` | `-l` `-s` | 查看模块文档；`-l` 列出全部模块，`-s 模块名` 看参数摘要。替代 · 无 | `ansible-doc -s copy` |
| `ansible-galaxy` | `init` `install` | 初始化角色目录结构或安装社区角色。替代 · 无 | `ansible-galaxy init nginx` |
| `ansible-vault` | `create` `encrypt` | 加密剧本中的敏感变量。替代 · 无 | `ansible-vault create secret.yml` |
| `zabbix_server` | `-c` `-R` | Zabbix 服务端主程序，`-c` 指定配置文件，`-R config_cache_reload` 重载配置缓存。替代 · 启停请用 `systemctl` | `systemctl restart zabbix-server` |
| `zabbix_agentd` | `-t` `-p` | Zabbix 客户端主程序；`-p` 打印支持的全部监控键，`-t 键名` 本地测试某个键的取值。替代 · 启停请用 `systemctl` | `zabbix_agentd -t agent.ping` |
| `zabbix_get` | `-s` `-k` | 从服务端远程测试被监控主机的某个键值，是自定义监控项排障的利器；`-s` 指定目标主机，`-k` 指定键名。替代 · 无 | `zabbix_get -s 10.0.0.7 -k 'web_state'` |
| `zabbix_sender` | `-z` `-s` `-k` | 主动向服务端推送数据，用于被动采集不到的场景。替代 · 无 | `zabbix_sender -z 172.16.1.71 -s web01 -k web_state -o 3` |
| `showmount` | `-e` `-a` | 查看 NFS 服务器共享出来的目录列表；`-e 主机` 看远程，不加参数看本机。替代 · 无 | `showmount -e 172.16.1.31` |
| `exportfs` | `-rv` `-a` | 重新导出 NFS 共享目录，修改 `/etc/exports` 后不用重启服务就生效；`-rv` 重新导出并显示，`-a` 全部。替代 · 无 | `exportfs -rv` |
| `inotifywait` | `-mrq` `-e` | 实时监控目录变化，是实时同步方案的基础；`-mrq` 持续递归静默监控，`-e` 指定监听事件（create、delete、modify、close_write）。来自 `inotify-tools`。替代 · 无 | `inotifywait -mrq /data/blog` |

### 12.4 示例
{: .sec-ex}

```bash
# --- Nginx ---
nginx -t                       # 改配置前必做语法检查
nginx -s reload                # 平滑重载
nginx -v && nginx -V           # 版本与编译参数
ab -n 1000 -c 100 http://www.example.com/
logrotate -f /etc/logrotate.d/nginx

# 日志切割脚本的典型写法
mv /var/log/nginx/access.log /var/log/nginx/access_$(date +%F).log
systemctl reload nginx

# --- PHP-FPM ---
php-fpm -t
systemctl restart php-fpm
php -v
php -m | grep -i mysql

# --- MySQL / MariaDB ---
systemctl start mariadb
mysql -uroot -p'你的密码' -e "show databases;"
mysql -uroot -p'你的密码' -e "select user,host from mysql.user;"
mysql -uroot -p'你的密码' < /tmp/web_back.sql

# 备份与恢复
mysqldump -uroot -p'你的密码' --all-databases >/tmp/web_back.sql
mysqldump -uroot -p'你的密码' --single-transaction -B wordpress >/tmp/wp.sql
mysqladmin -uroot -p'你的密码' status

# 授权与清理空用户
# MariaDB [(none)]> delete from mysql.user where user="" and host="localhost";
# MariaDB [(none)]> grant all on wordpress.* to 'wordpress'@'172.16.1.%' identified by '你的密码';
# MariaDB [(none)]> flush privileges;

# --- Redis ---
redis-cli ping
redis-cli -h 10.0.0.7 -p 6379 -a '你的密码' info
redis-cli dbsize
redis-cli set site_status ok

# --- Ansible ---
ansible all -a "hostname"
ansible web -i /etc/ansible/hosts --list-hosts
ansible all -m yum -a "name=iotop state=installed" --check
ansible 172.16.1.31 -m command -a "chdir=/tmp touch test.txt"
ansible 172.16.1.31 -m shell -a "creates=/tmp/hosts touch test.txt"
ansible 172.16.1.31 -m copy -a "src=/etc/hosts dest=/etc/ backup=yes"
ansible 172.16.1.31 -m copy -a "src=/data/ dest=/data"
ansible 172.16.1.31 -m file -a "dest=/data/ state=directory"
ansible 172.16.1.31 -m file -a "src=/data/test.txt dest=/data/test_link.txt state=link"
ansible 172.16.1.31 -m service -a "name=nfs state=started enabled=yes"
ansible 172.16.1.31 -m cron -a "name='time sync' minute=0 hour=2 job='/usr/sbin/ntpdate ntp1.example.com >/dev/null 2>&1'"
ansible 172.16.1.31 -m user -a "name=user02 uid=6666"
ansible all -u deploy -b -m service -a "name=nginx state=restarted"
ansible-doc -l
ansible-doc -s fetch

# 剧本执行：先检查语法，再预演，最后真跑
ansible-playbook --syntax-check site.yml
ansible-playbook -C site.yml
ansible-playbook site.yml --tags deploy

# --- Zabbix ---
systemctl restart zabbix-agent
zabbix_agentd -p | head -20
zabbix_agentd -t agent.ping
zabbix_get -s 10.0.0.7 -k 'web_state'
zabbix_get -s 10.0.0.7 -k 'server_state[22]'
ss -lntup | grep 10050

# 自定义监控项写法（/etc/zabbix/zabbix_agentd.d/）
# UserParameter=web_state,ps -ef|grep -c [n]ginx
# UserParameter=port_check[*],ss -lnt | grep -c "$1:$2"
# UserParameter=disk_root_used,df / | awk '/\/$/{gsub(/%/,"");print $5}'

# --- NFS 与实时同步 ---
showmount -e 172.16.1.31
exportfs -rv
inotifywait -mrq --timefmt '%F %T' --format '%T %w%f %e' -e create,delete,modify /data/blog
```

**坑位提示**

- `nginx -t` 通过不代表 reload 一定成功：reload 走的是运行中进程的权限与路径，证书文件权限、日志目录属主这类问题要到 reload 时才爆。
- `mysqldump` 大库备份必须加 `--single-transaction`，否则默认锁表，备份期间业务写入全部卡住。
- `zabbix_get` 测不通先确认三件事：agent 在运行、Server 地址写在 agent 配置里、防火墙放行 10050。
- `nginx -s reload` 只处理 nginx 自己的配置，改了 PHP-FPM、MySQL 的参数跟它没关系，各服务各 reload 各的。

## 附录：易混淆命令对比

### A1 软链接与硬链接

| 对比项 | 软链接 `ln -s` | 硬链接 `ln` |
| --- | --- | --- |
| 本质 | 存的是目标文件路径，是独立的新文件 | 与目标文件共用同一个 inode，是同一个文件的另一个名字 |
| inode | 与源文件不同 | 与源文件相同 |
| 跨文件系统 | 支持 | 不支持，只能在同一分区内创建 |
| 链接目录 | 支持 | 不支持 |
| 删除源文件 | 链接失效，显示红色闪烁 | 不影响，文件仍可通过硬链接访问 |
| 典型用途 | 版本切换、短路径指向 | 防止重要文件被误删、节省 inode |

### A2 `>` 与 `>>`

| 对比项 | `>` 覆盖重定向 | `>>` 追加重定向 |
| --- | --- | --- |
| 行为 | 清空原文件后再写入 | 在文件末尾继续写入 |
| 文件不存在时 | 自动创建 | 自动创建 |
| 风险 | 会丢失原有内容，高危 | 只增不减，日志会越来越大 |
| 典型场景 | 生成新的配置文件 | 记录日志、追加 hosts 条目 |

### A3 `2>`、`&>` 与 `/dev/null 2>&1`

| 写法 | 含义 | 说明 |
| --- | --- | --- |
| `> file` | 只重定向标准输出 | 错误信息仍打印到屏幕 |
| `2> file` | 只重定向错误输出 | 正常输出仍打印到屏幕 |
| `> file 2>&1` | 正确与错误都写入同一文件 | 写法固定，`2>&1` 必须放最后 |
| `&> file` | 正确与错误都写入同一文件 | 与上一行等价，是 bash 的简写 |
| `&>/dev/null` | 全部丢弃 | 定时任务中的标准写法，避免产生垃圾邮件 |

### A4 `find` 与 `locate`

| 对比项 | `find` | `locate` |
| --- | --- | --- |
| 查找方式 | 实时遍历磁盘目录 | 查询事先建好的索引数据库 |
| 速度 | 慢，目录越大越慢 | 快，几乎是瞬间返回 |
| 实时性 | 实时准确 | 新建文件需先 `updatedb` 才能查到 |
| 条件能力 | 极强，可按名称、类型、大小、时间、权限、属主组合 | 只能按名称或正则匹配 |
| 适用建议 | 需要精确条件与后续处理时用 | 只想快速知道文件在哪时用 |

### A5 `du` 与 `df`

| 对比项 | `du` | `df` |
| --- | --- | --- |
| 视角 | 从文件出发，统计目录占用了多少 | 从文件系统出发，看分区还剩多少 |
| 统计对象 | 目录或文件 | 已挂载的文件系统 |
| 常见差异原因 | 文件被删除但仍被进程占用时，`du` 统计不到而 `df` 仍显示占用 | 用 `lsof \| grep deleted` 找出这些文件并重启进程 |
| 排障顺序 | 先 `df -h` 定位哪个分区满，再 `du -sh --max-depth=1` 逐层找大目录 | 另有 `df -i` 查 inode 是否耗尽 |

### A6 `cp` 与 `mv`

| 对比项 | `cp` | `mv` |
| --- | --- | --- |
| 数据动作 | 复制一份，磁盘上多一份数据 | 改目录项，数据本身没搬动 |
| 跨分区行为 | 与同分区一致，真正复制数据 | 跨分区时会退化成复制加删除，耗时明显 |
| 速度 | 取决于数据量 | 同分区瞬间完成，与大小无关 |
| 风险 | 源数据保留，较安全 | 源路径消失，覆盖同名文件要小心 |

### A7 `rm` 与 `rmdir`

| 对比项 | `rm` | `rmdir` |
| --- | --- | --- |
| 可删对象 | 文件与目录（加 `-r`） | 只能是空目录 |
| 安全性 | 危险，不可逆 | 安全，非空就拒绝执行 |
| 典型参数 | `-rf` 强制递归 | `-p` 连带上层空目录 |
| 使用建议 | 删除前先用 `ls` 确认清单 | 清理空目录结构时用它更保险 |

### A8 `grep`、`grep -E` 与 `egrep`

| 对比项 | `grep` | `grep -E`（原 `egrep`） | `grep -F`（原 `fgrep`） |
| --- | --- | --- | --- |
| 正则支持 | 基础正则，`+`、`?`、`\|`、`()` 需转义 | 扩展正则，这些符号可直接用 | 不解析正则，按字面匹配 |
| 速度 | 中等 | 中等 | 最快 |
| 现状 | 标准用法 | `egrep` 已废弃，改用 `grep -E` | `fgrep` 已废弃，改用 `grep -F` |
| 典型场景 | 简单关键字过滤 | 多条件或复杂模式 | 匹配含特殊字符的字面串 |

### A9 `netstat` 与 `ss`

| 对比项 | `netstat` | `ss` |
| --- | --- | --- |
| 数据来源 | 遍历 `/proc`，连接多时很慢 | 直接从内核获取信息，速度快很多 |
| 所属软件包 | `net-tools`（已停止维护） | `iproute`（在持续维护） |
| 常用写法 | `netstat -lntup` | `ss -lntup`，参数基本一致 |
| 结论 | 新脚本不要再使用 | 统一改用 `ss` |

### A10 `ifconfig` 与 `ip`

| 对比项 | `ifconfig` | `ip` |
| --- | --- | --- |
| 功能范围 | 只看网卡地址 | `addr`、`route`、`link`、`neigh` 全覆盖 |
| 所属软件包 | `net-tools`（已停止维护） | `iproute`（在持续维护） |
| 命令对照 | `ifconfig` | `ip addr show` 或 `ip a` |
| 命令对照 | `route -n` | `ip route show` 或 `ip r` |
| 命令对照 | `arp -n` | `ip neigh show` |
| 结论 | 已废弃 | 统一改用 `ip` |

### A11 `service` 与 `systemctl`

| 对比项 | `service`（SysVinit） | `systemctl`（systemd） |
| --- | --- | --- |
| 启停 | `service nginx restart` | `systemctl restart nginx` |
| 开机自启 | `chkconfig nginx on` | `systemctl enable nginx` |
| 状态查看 | `service nginx status`（信息少） | `systemctl status nginx`（含最新日志） |
| 日志 | 分散在各服务的日志文件 | 统一用 `journalctl -u nginx` |
| 结论 | 兼容层，已废弃 | 统一改用 `systemctl` |

### A12 `ps -ef` 与 `ps aux`

| 对比项 | `ps -ef` | `ps aux` |
| --- | --- | --- |
| 风格 | System V 标准风格 | BSD 风格 |
| 特有列 | PPID（父进程号） | `%CPU`、`%MEM`（资源占用） |
| 过滤写法 | `ps -ef \| grep nginx` | `ps aux \| grep nginx` |
| 使用建议 | 看进程父子关系、找 PID 时用 | 看谁在吃 CPU 与内存时用 |

### A13 `kill`、`pkill` 与 `killall`

| 对比项 | `kill` | `pkill` | `killall` |
| --- | --- | --- | --- |
| 指定对象 | PID | 进程名（支持模式匹配） | 进程名（精确） |
| 常用信号 | `-15` 优雅退出、`-9` 强制、`-1` 重载 | 同左，另加 `-f` 匹配完整命令行 | 同左 |
| 所属包 | 内置 | `procps` | `psmisc` |
| 风险 | 精准，最安全 | 模式写错会误杀 | 同名进程全杀 |
| 建议 | 生产环境优先用它 | 先 `pgrep -l` 确认再杀 | 谨慎使用 |

### A14 `su`、`su -` 与 `sudo`

| 对比项 | `su 用户` | `su - 用户` | `sudo 命令` |
| --- | --- | --- | --- |
| 环境变量 | 沿用当前用户的环境 | 完整加载目标用户的环境 | 沿用当前环境，以目标身份执行 |
| 工作目录 | 不变 | 切到目标用户家目录 | 不变 |
| 需要密码 | 需要目标用户密码 | 需要目标用户密码 | 需要自己的密码（或免密） |
| 可审计性 | 差，不知道谁干的 | 差 | 好，每条命令都记日志 |
| 建议 | 基本不用 | 完整切换身份时用 | 日常提权首选 |

### A15 `tail -f` 与 `tail -F`

| 对比项 | `tail -f` | `tail -F` |
| --- | --- | --- |
| 追踪依据 | 按文件描述符追踪 | 按文件名追踪，文件重建后自动重试 |
| 日志切割后 | 停在旧文件上，看不到新日志 | 自动跟上新生成的文件 |
| 等价写法 | `-f` 即 `--follow=descriptor` | `-F` 即 `--follow=name --retry` |
| 建议 | 临时观察短时用 | 长期追踪日志一律用 `-F` |

### A16 `yum`、`dnf` 与 `rpm`

| 对比项 | `rpm` | `yum` | `dnf` |
| --- | --- | --- | --- |
| 依赖处理 | 不管依赖，需手工补齐 | 自动解析并安装依赖 | 自动解析，算法更快更准 |
| 软件来源 | 本地 rpm 文件 | 配置的软件仓库 | 配置的软件仓库 |
| 典型动作 | 安装 `-ivh`、查询 `-qa`、卸载 `-e` | 安装 `install -y`、查询 `list` | 与 yum 语法完全兼容 |
| 适用版本 | 全版本通用 | CentOS 6 与 7 | CentOS 8 及以上 |
| 结论 | 用于离线装包与查询归属 | 老系统继续用 | 新系统用 `dnf` |

### A17 `tar`、`gzip` 与 `zip`

| 对比项 | `tar` | `gzip` | `zip` |
| --- | --- | --- | --- |
| 能否打包多文件 | 能（核心能力） | 不能，只能压单个文件 | 能，打包压缩一体 |
| 压缩算法 | 借 `-z`、`-j`、`-J` 调用外部算法 | gzip 算法 | deflate 算法 |
| 保留权限属主 | 保留（加 `-p`） | 不保留 | 部分保留 |
| 跨平台 | Linux 原生 | Linux 原生 | 与 Windows 通用 |
| 建议 | Linux 内部传递首选 | 压缩单个日志时用 | 与 Windows 交换文件用 |

### A18 `chmod` 数字法与符号法

| 对比项 | 数字法 | 符号法 |
| --- | --- | --- |
| 写法 | `chmod 755 file` | `chmod u+x,g-w,o=r file` |
| 计算方式 | 权限位相加：r=4、w=2、x=1 | 对象 u、g、o、a 加加减减 |
| 影响范围 | 覆盖式设置全部三层权限 | 只改指定的那一层，其他不变 |
| 适用场景 | 批量设定统一权限 | 微调某一项权限 |
| 目录与文件默认 | 文件 644、目录 755 | 由 umask 决定 |

### A19 `wget` 与 `curl`

| 对比项 | `wget` | `curl` |
| --- | --- | --- |
| 主要定位 | 下载文件 | 传输数据、调试接口 |
| 输出行为 | 默认保存到文件 | 默认输出到屏幕 |
| 递归下载 | 支持 `--mirror`、`-r` | 不支持 |
| 接口调试 | 弱 | 强，可自定义方法、请求头、上传数据 |
| 典型命令 | `wget -O file URL` | `curl -I URL`、`curl -X POST -d 'a=1' URL` |
| 建议 | 纯下载用 `wget` | 验服务与调接口用 `curl` |

### A20 `which`、`whereis` 与 `type`

| 对比项 | `which` | `whereis` | `type` |
| --- | --- | --- | --- |
| 查找范围 | 只在 `PATH` 里找可执行文件 | 找二进制、源码与手册页 | 判断是别名、内部命令还是外部命令 |
| 能否识别别名 | 不能 | 不能 | 能，这是它的独有价值 |
| 典型用途 | 确认命令装在哪 | 找手册与源码位置 | 排查「命令行为不符合预期」 |
| 建议 | 先用 `type -a` 再看 `which -a` | 需要手册时用 | 三者配合定位命令 |

### A21 `chmod` 与 `chown`

| 对比项 | `chmod` | `chown` |
| --- | --- | --- |
| 修改对象 | 权限位（rwx） | 属主与属组 |
| 常见写法 | `chmod 750 file` | `chown www.www file` |
| 递归参数 | `-R` | `-R` |
| 记忆口诀 | 改「能干什么」 | 改「属于谁」 |
| 关联命令 | `umask` 决定新建时的默认权限 | `chgrp` 只改属组 |

### A22 `alias` 与 `export`

| 对比项 | `alias` | `export` |
| --- | --- | --- |
| 作用对象 | 命令的简写 | 环境变量 |
| 写法 | `alias ll='ls -l'` | `export PATH=$PATH:/usr/local/bin` |
| 查看方式 | `alias` | `env` 或 `export -p` |
| 取消方式 | `unalias ll` | `unset 变量名` |
| 生效范围 | 当前 shell，永久化需写入 `~/.bashrc` | 同左，永久化写入 `/etc/profile` 或 `~/.bash_profile` |
| 立即生效 | `source ~/.bashrc` | `source /etc/profile` |

### A23 `;`、`&&` 与 `||`

| 对比项 | `;` | `&&` | `\|\|` |
| --- | --- | --- | --- |
| 执行逻辑 | 顺序执行，不管成败 | 前一个成功才执行后一个 | 前一个失败才执行后一个 |
| 依赖返回值 | 不依赖 | 依赖 `$?` 等于 0 | 依赖 `$?` 不等于 0 |
| 典型写法 | `cd /data; ls` | `make && make install` | `ping -c1 10.0.0.7 \|\| echo "不通"` |
| 使用建议 | 无关命令串联用 | 有依赖关系的步骤用 | 失败兜底处理用 |

### A24 `crontab` 与 `at`

| 对比项 | `crontab` | `at` |
| --- | --- | --- |
| 执行次数 | 周期性重复执行 | 只执行一次 |
| 时间写法 | 分 时 日 月 周 | `at 14:00`、`at now +1 hour` |
| 管理命令 | `crontab -e`、`crontab -l` | `at -l`（atq）、`at -d`（atrm） |
| 配置文件 | `/var/spool/cron/用户名` | 队列在 `/var/spool/at/` |
| 注意事项 | 命令中的 `%` 需转义，建议写脚本 | 依赖 `atd` 服务运行 |

### A25 文件的三个时间：atime、mtime 与 ctime

| 对比项 | Access（atime） | Modify（mtime） | Change（ctime） |
| --- | --- | --- | --- |
| 含义 | 最后一次被读取的时间 | 最后一次内容被修改的时间 | 最后一次属性被修改的时间 |
| 触发动作 | `cat`、`less` 读取 | `vi` 保存、`echo >` 写入 | `chmod`、`chown`、`mv` |
| 查看方式 | `stat file` | `stat file` | `stat file` |
| 常用场景 | 判断文件是否长期冷数据 | `find -mtime` 按此查找 | 排查配置文件何时被动过 |
| 注意 | 内容改动会同时刷新 mtime 与 ctime | 二者常一起变化 | 无法手工设置 ctime |

### A26 `xargs` 与管道 `|`

| 对比项 | 管道 `\|` | `xargs` |
| --- | --- | --- |
| 传递内容 | 把前一个命令的输出当作后一个命令的标准输入 | 把输入转换成后一个命令的参数 |
| 能否直接被命令接收 | 只有支持标准输入的命令才行（如 `grep`、`less`） | 让不支持标准输入的命令也能接收（如 `rm`、`useradd`） |
| 典型写法 | `cat file \| grep a` | `cat list \| xargs rm -f` |
| 文件名含空格 | 不受影响 | 必须配合 `find -print0` 与 `xargs -0` |
| 参数个数控制 | 无 | `-n1` 每次传一个，`-P` 并行执行 |


{% endraw %}
