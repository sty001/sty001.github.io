---
title: "day14-文件批量压缩作业实操"
date: 2026-10-24 09:44:00 +0800
categories: [软件, Linux, 10-作业实操]
tags: [Linux, 10-作业实操, 作业实操]
slug: "linux-homework-14"
---

{% raw %}



课程第 14 天的作业：目录里混着 `.jpg`、`.png` 等其它文件，要把其中所有以 `.txt` 结尾的文件统一压缩处理。作业原文只给了目录清单和一句「思路」，这里把思路补全，用三种主流做法（find -exec、find | xargs、tar --exclude）逐一真跑，`.txt` 后缀匹配的边界情况（文件名含空格、`.txt.bak`、大写后缀、子目录递归）也全部实测。

## 实操环境说明
{: .sec-prac}

本环境无法启动真实 Linux（WSL 被安全策略禁用、无 Docker），因此采用分级实操：

- **A 级（已真实执行）**：shell 核心命令在 Git Bash 环境实际运行，输出为真实结果，文中标注 `已实操`；
- **B 级（标准命令 + 预期输出）**：系统级命令给出真实可用的命令序列与 CentOS 7 标准预期输出，标注 `预期输出`。

本篇 find、tar、xargs、gzip 全部为 A 级真跑，tar 版本为 GNU tar 1.35（与 CentOS 7 的 tar 1.26 参数完全兼容，本文未使用 1.35 独有参数）。实操目录统一用 `/tmp/hw/day14`，示例中的文件名做了通用化处理（test01.txt 等），输出中的本地用户名已按脱敏要求替换为 `user`。

## 题目总览
{: .sec-prac}

| 题号 | 题目（精简复述） | 分级 |
| --- | --- | --- |
| 题 1 | 将目录中以 `.txt` 结尾的文件统一压缩处理 | A 级（三种做法全部真跑） |
| 题 1-扩展 | `.txt` 筛选与 jpg/png 排除的边界处理 | A 级（空格文件名、大小写、子目录真跑） |

## 题 1：将以 .txt 结尾的文件统一进行压缩处理

**考察点**：find 的 `-name` 筛选、find 与后续命令的三种衔接方式（`-exec`、`xargs`、`tar --exclude`）、tar 的打包与追加参数，以及「文件名含空格」这一生产环境高频坑。

**实现思路**：作业要求的是「只压缩 .txt，不压缩 jpg/png」。核心是先拿到「准确的 .txt 文件清单」，再把这份清单交给 tar。思路分三层：

1. 第一层：**先筛后打包**。用 `find` 按名字筛选，把结果交给 tar。这是最通用、最符合运维习惯的做法。
2. 第二层：**反向排除**。不筛选，直接打包整个目录，用 tar 的 `--exclude` 把 jpg/png 挡在门外。写法最短，但依赖「非 txt 的扩展名可枚举」这一前提。
3. 第三层：**清单落盘**。把 find 结果先写到文件列表，再让 tar 按列表打包。适合清单需要人工复核或需要复用的场景。

三种做法的对比如下：

| 做法 | 典型命令 | 适用场景 | 优点 | 缺点 |
| --- | --- | --- | --- | --- |
| find -exec | `find 目录 -name "*.txt" -exec tar -czf x.tar.gz {} +` | 文件数量中等、一次成包 | 文件名含空格天然安全，一条命令搞定 | 文件过多时 find 会分批调用，后面的批次覆盖前面的批次 |
| find 管道 xargs | `find 目录 -name "*.txt" -print0 \| xargs -0 tar -czf x.tar.gz` | 文件数量大、需要看执行过程 | 可用 `-t` 打印命令、`-n` 控制每批个数，便于调试 | 不加 `-print0` / `-0` 时遇空格文件名直接失败 |
| tar --exclude | `tar -czf x.tar.gz --exclude="*.jpg" --exclude="*.png" 目录` | 目录内容清晰、只需排除少数类型 | 一条命令、无需 find | 新增一种非 txt 类型就要加一条 exclude，容易漏 |
| tar -T 清单 | `find 目录 -name "*.txt" > list && tar -czf x.tar.gz -T list` | 清单需复核/复用、要配合定时任务 | 清单可存档、可 diff、可人工修订 | 多一步落盘，空格文件名仍需注意（tar -T 按行读取，可容忍空格） |

### 步骤 1：构造测试数据（已实操）
{: .sec-ver}

先还原作业目录结构：3 个 txt、1 个 jpg、1 个 png。

```bash
mkdir -p /tmp/hw/day14/data
cd /tmp/hw/day14
printf 'hello 01\n' > data/test01.txt
printf 'hello 02\n' > data/test02.txt
printf 'hello 03\n' > data/test03.txt
printf 'JPGDATA\n'  > data/test04.jpg
printf 'PNGDATA\n'  > data/test05.png
ls -l data
```

输出：

```console
$ ls -l data
total 5
-rw-r--r-- 1 user 197609 9 Oct 24 04:35 test01.txt
-rw-r--r-- 1 user 197609 9 Oct 24 04:35 test02.txt
-rw-r--r-- 1 user 197609 9 Oct 24 04:35 test03.txt
-rw-r--r-- 1 user 197609 8 Oct 24 04:35 test04.jpg
-rw-r--r-- 1 user 197609 8 Oct 24 04:35 test05.png
```

### 步骤 2：先确认 find 的筛选结果（已实操）
{: .sec-ver}

打包前**必须**先单独跑一遍 find 看清单对不对，这是避免「打包错文件」的关键习惯。

```bash
find data -name "*.txt"
```

输出：

```console
$ find data -name "*.txt"
data/test01.txt
data/test02.txt
data/test03.txt
```

清单里只有 txt，jpg 与 png 已被排除，可以作为后续打包的输入。

### 步骤 3：做法一 find -exec（先踩坑，再修正）（已实操）
{: .sec-warn}

`-exec` 结尾有两种写法，含义完全不同，这是本题最重要的一个坑：

- `\;`（分号）：find **每找到一个文件就执行一次**后面的命令；
- `+`（加号）：find 把**所有找到的文件一次性拼到命令行末尾，只执行一次**。

先用 `\;` 试：

```bash
find data -name "*.txt" -exec tar -cf txt_bad.tar {} \;
tar -tf txt_bad.tar
```

输出：

```console
$ tar -tf txt_bad.tar
data/test03.txt
```

包里只剩最后一个文件。原因很清楚：`tar -cf` 是「创建」归档，每执行一次就把归档**重新覆盖**一次，3 个文件跑 3 遍，最终只留下第 3 次的结果。

改用 `+`：

```bash
find data -name "*.txt" -exec tar -czf txt_exec.tar.gz {} +
tar -tzf txt_exec.tar.gz
```

输出：

```console
$ tar -tzf txt_exec.tar.gz
data/test01.txt
data/test02.txt
data/test03.txt
```

三个文件齐全，做法一成立。等价的 `-v` 可见写法是 `find data -name "*.txt" -exec tar -czvf txt_exec.tar.gz {} +`。

> **易错点**：`-exec` 结尾的 `+` 并不是「永远只执行一次」。当文件数量大到命令行长度超过系统上限时，find 会自动**分批**调用，此时 `-czf` 的覆盖问题会再次出现，最终包里只剩最后一批。文件数量可能过千时，改用步骤 7 的「`-rf` 追加后再 gzip」写法。

### 步骤 4：做法二 find 管道 xargs（已实操）
{: .sec-prac}

```bash
find data -name "*.txt" | xargs tar -czf txt_xargs.tar.gz
tar -tzf txt_xargs.tar.gz
```

输出：

```console
$ tar -tzf txt_xargs.tar.gz
data/test01.txt
data/test02.txt
data/test03.txt
```

想看到 xargs 实际拼出了什么命令，加 `-t`（下面这条提前使用了步骤 7 会讲到的 `-print0` / `-0` 安全写法）：

```bash
find data -maxdepth 1 -name "*.txt" -print0 | xargs -0 -t tar -rf append2.tar
```

输出（`xargs -t` 的提示信息打印在标准错误上）：

```console
tar -rf append2.tar 'data/my report.txt' data/test01.txt data/test02.txt data/test03.txt
```

可以看到 xargs 把多行结果拼成了一条命令的参数，这是它比 `-exec \;` 高效的原因（少启进程）。

### 步骤 5：做法三 tar --exclude 反向排除（已实操）
{: .sec-prac}

不筛选，直接打包目录，把 jpg/png 挡在外面：

```bash
tar -czf txt_exclude.tar.gz --exclude="*.jpg" --exclude="*.png" data
tar -tzf txt_exclude.tar.gz
```

输出：

```console
$ tar -tzf txt_exclude.tar.gz
data/
data/test01.txt
data/test02.txt
data/test03.txt
```

注意输出里多了一行 `data/`——因为这次打包的是**目录本身**，tar 会把目录项也记进归档。前两种做法打包的是文件清单，不带目录项。两者解压后的目录结构一致，只是归档内容描述不同。

### 步骤 6：补充做法 tar -T 读取文件清单（已实操）
{: .sec-ext}

```bash
find data -name "*.txt" > txt_list.txt
cat txt_list.txt
tar -czf txt_list.tar.gz -T txt_list.txt
tar -tzf txt_list.tar.gz
```

输出：

```console
$ cat txt_list.txt
data/test01.txt
data/test02.txt
data/test03.txt
$ tar -tzf txt_list.tar.gz
data/test01.txt
data/test02.txt
data/test03.txt
```

`-T`（等价于 `--files-from`）按**行**读取清单，因此文件名里的空格不会被拆断，这一点比裸 xargs 安全。清单落盘后可以用 `wc -l` 核对数量、用 `grep` 复核内容，是备份脚本里最稳的写法。

### 步骤 7：边界一 文件名含空格（已实操）
{: .sec-prac}

生产环境的文件名带空格非常常见。先造一个：

```bash
printf 'space file\n' > "data/my report.txt"
find data -name "*.txt"
```

输出：

```console
$ find data -name "*.txt"
data/my report.txt
data/test01.txt
data/test02.txt
data/test03.txt
```

**裸 xargs 直接失败**（注意错误信息打印在标准错误上）：

```bash
find data -name "*.txt" | xargs tar -czf txt_space_bad.tar.gz
echo "退出码=$?"
```

输出：

```console
$ find data -name "*.txt" | xargs tar -czf txt_space_bad.tar.gz
tar: data/my: Cannot stat: No such file or directory
tar: report.txt: Cannot stat: No such file or directory
tar: Exiting with failure status due to previous errors
$ echo "退出码=$?"
退出码=123
```

xargs 默认以「空白（空格、制表、换行）」切分输入，`data/my report.txt` 被切成了 `data/my` 和 `report.txt` 两个参数，于是 tar 报找不到文件，退出码 123。

**正确写法：`-print0` 配 `xargs -0`**，两侧改用 NUL（`\0`）作分隔符：

```bash
find data -name "*.txt" -print0 | xargs -0 tar -czf txt_space_ok.tar.gz
tar -tzf txt_space_ok.tar.gz
```

输出：

```console
$ tar -tzf txt_space_ok.tar.gz
data/my report.txt
data/test01.txt
data/test02.txt
data/test03.txt
```

**而 find -exec 天然免疫**这个问题，因为它不经过 shell 的单词切分，文件名原样传给 tar：

```bash
find data -name "*.txt" -exec tar -czf txt_exec_space.tar.gz {} +
tar -tzf txt_exec_space.tar.gz
```

输出：

```console
$ tar -tzf txt_exec_space.tar.gz
data/my report.txt
data/test01.txt
data/test02.txt
data/test03.txt
```

三种写法的空格安全性对比：

| 写法 | 空格文件名是否安全 | 原因 |
| --- | --- | --- |
| `find \| xargs`（裸） | 否 | 默认按空白切分，文件名被拆断 |
| `find -print0 \| xargs -0` | 是 | 改用 NUL 分隔 |
| `find -exec ... {} +` | 是 | 不经过 shell 单词切分 |
| `tar -T 清单` | 是 | 按行读取 |

### 步骤 8：边界二 .txt 后缀的匹配边界（已实操）
{: .sec-prac}

再补几个「看起来像 txt 但其实不是」的文件，看 `-name "*.txt"` 的真实边界：

```bash
mkdir -p data/sub
printf 'nested\n' > data/sub/nested.txt
printf 'bak\n'    > data/test06.txt.bak
printf 'upper\n'  > data/TEST07.TXT
find data -name "*.txt"
echo '--- -iname 忽略大小写 ---'
find data -iname "*.txt"
echo '--- 含 .txt 但非后缀 ---'
find data -name "*.txt*"
```

输出：

```console
$ find data -name "*.txt"
data/my report.txt
data/sub/nested.txt
data/test01.txt
data/test02.txt
data/test03.txt
--- -iname 忽略大小写 ---
data/my report.txt
data/sub/nested.txt
data/test01.txt
data/test02.txt
data/test03.txt
data/TEST07.TXT
--- 含 .txt 但非后缀 ---
data/my report.txt
data/sub/nested.txt
data/test01.txt
data/test02.txt
data/test03.txt
data/test06.txt.bak
```

结论三条：

1. `*.txt` 是**后缀匹配**，`.txt.bak` 不匹配（它不是以 `.txt` 结尾）——这正合题意。
2. `*.txt` 区分大小写，`TEST07.TXT` 默认不匹配；要一起收进来就用 `-iname`。
3. find **默认递归子目录**，`data/sub/nested.txt` 也会被收进来。只想打包当前层就加 `-maxdepth 1`：

```bash
find data -maxdepth 1 -name "*.txt"
```

输出：

```console
$ find data -maxdepth 1 -name "*.txt"
data/my report.txt
data/test01.txt
data/test02.txt
data/test03.txt
```

子目录里的 `nested.txt` 已消失。

反向排除 jpg/png 也可以用 find 的 `!`（非）来做，适合「排除类型少、保留类型多」的场景：

```bash
find data -type f ! -name "*.jpg" ! -name "*.png"
```

输出：

```console
$ find data -type f ! -name "*.jpg" ! -name "*.png"
data/my report.txt
data/sub/nested.txt
data/test01.txt
data/test02.txt
data/test03.txt
data/test06.txt.bak
data/TEST07.TXT
```

注意它把 `.txt.bak` 和 `.TXT` 也放行了——「反向排除」的语义是「不是 jpg/png 的都要」，比「只要 txt」宽得多，两者不等价。

### 步骤 9：分批覆盖的复现与安全写法（已实操）
{: .sec-prac}

用 `xargs -n1` 模拟「每批只处理一个文件」，把步骤 3 的覆盖问题放大看清楚：

```bash
rm -f multi.tar.gz
find data -maxdepth 1 -name "*.txt" -print0 | xargs -0 -n1 tar -czf multi.tar.gz
tar -tzf multi.tar.gz
```

输出：

```console
$ tar -tzf multi.tar.gz
data/test03.txt
```

安全写法是「**先追加到未压缩归档，再统一压缩**」。`-r` 是追加，不会覆盖：

```bash
rm -f safe.tar safe.tar.gz
find data -maxdepth 1 -name "*.txt" -print0 | xargs -0 tar -rf safe.tar
gzip -f safe.tar
tar -tzf safe.tar.gz
```

输出：

```console
$ tar -tzf safe.tar.gz
data/my report.txt
data/test01.txt
data/test02.txt
data/test03.txt
```

同样的思路，`-exec \;` 配 `-r` 也完全可用（每执行一次追加一个，不再互相覆盖）：

```bash
rm -f append.tar
find data -maxdepth 1 -name "*.txt" -exec tar -rf append.tar {} \;
tar -tf append.tar
```

输出：

```console
$ tar -tf append.tar
data/my report.txt
data/test01.txt
data/test02.txt
data/test03.txt
```

### 步骤 10：解压验证（已实操）
{: .sec-ver}

打完包必须验证，这是备份类操作的底线动作。解压到独立目录再核对：

```bash
rm -rf verify && mkdir verify
tar -xzf txt_exec_space.tar.gz -C verify
find verify -type f -exec ls -l {} \;
```

输出：

```console
$ find verify -type f -exec ls -l {} \;
-rw-r--r-- 1 user 197609 11 Oct 24 04:35 verify/data/my report.txt
-rw-r--r-- 1 user 197609  9 Oct 24 04:35 verify/data/test01.txt
-rw-r--r-- 1 user 197609  9 Oct 24 04:35 verify/data/test02.txt
-rw-r--r-- 1 user 197609  9 Oct 24 04:35 verify/data/test03.txt
```

再核对文件内容（含空格文件名，用 `for` 循环加引号遍历）：

```bash
for f in verify/data/*.txt; do printf '%s => ' "$f"; cat "$f"; done
```

输出：

```console
$ for f in verify/data/*.txt; do printf '%s => ' "$f"; cat "$f"; done
verify/data/my report.txt => space file
verify/data/test01.txt => hello 01
verify/data/test02.txt => hello 02
verify/data/test03.txt => hello 03
```

内容与源文件逐一对应，解压正确。

> **生产注意**：备份脚本里打包前先 find 清单落盘或 `tar -tzf` 核对数量，压缩完成校验退出码再动源文件——「压缩完就删原始数据」没有回退余地。

### 步骤 11：踩坑补充 绝对路径打包（已实操）
{: .sec-warn}

直接给 tar 传绝对路径，tar 会**剥掉开头的 `/`**：

```bash
tar -czf abs.tar.gz /tmp/hw/day14/data/test01.txt
tar -tzf abs.tar.gz
```

输出（警告打印在标准错误上，退出码仍为 0）：

```console
$ tar -czf abs.tar.gz /tmp/hw/day14/data/test01.txt
tar: Removing leading `/' from member names
$ tar -tzf abs.tar.gz
tmp/hw/day14/data/test01.txt
```

这个设计是为了防止解压时覆盖真实系统路径。想保留绝对路径需加 `-P`，但**强烈不建议**——解压到别的机器会直接盖掉同名系统文件。正确做法是 `cd` 到目标目录的**上一级**，用相对路径打包，或用 `-C` 指定工作目录：

```bash
tar -czf rel.tar.gz -C /tmp/hw/day14 data/test01.txt
```

`-C` 的含义是「执行到这一步时先切换目录」，打包、解压两个方向都能用：`tar -czf /backup/x.tgz -C /var/www html` 相当于先 `cd /var/www` 再打包 html，包内路径干净；解压侧 `tar -xzf x.tgz -C /target` 把内容直接释放到指定目录，省去「解压在当前目录再挪走」的麻烦。注意 `-C` 的位置有讲究——它影响的是**其后**的路径参数，写在文件名前面还是后面结果不同。

## 三种做法的完整对比与选型建议
{: .sec-best}

| 维度 | find -exec `{} +` | find -print0 \| xargs -0 | tar --exclude |
| --- | --- | --- | --- |
| 命令条数 | 1 条 | 1 条（管道） | 1 条 |
| 空格文件名 | 安全 | 配 `-0` 后安全 | 安全（tar 内部处理） |
| 超多文件分批 | 会分批，有覆盖风险 | 会分批，有覆盖风险 | 不涉及 |
| 是否需要枚举非 txt 类型 | 不需要 | 不需要 | 需要 |
| 能否先复核清单 | 需另跑一次 find | 需另跑一次 find | 不方便 |
| 推荐指数 | 日常首选 | 需要调试/观察时首选 | 目录内容简单时首选 |

### 辨析：-exec {} + 与 xargs

两者都在解决「批量传参」，机制不同：`-exec {} +` 由 find 自己攒参数，达到上限就分批调用，行为完全可预期；xargs 是独立进程，默认按空白切分输入（所以才有 `-0` 这件事），攒参方式可调（`-n` 每批个数、`-L` 按行、`-P` 并行）。xargs 多出并行与占位替换这些能力，find -exec 胜在不经 shell 单词切分、少一层转义心智负担。日常二选一都行，涉及空格文件名时 xargs 必配 `-print0` / `-0`。

推荐落地组合（本题的标准答案写法）：

```bash
cd /tmp/hw/day14
find data -type f -name "*.txt" -print0 | xargs -0 tar -czf txt_final.tar.gz
```

要点三个：`-type f` 只收普通文件（排除目录、软链等）、`-print0` 与 `xargs -0` 成对出现保证空格安全、打包前先单独跑一次 find 核对清单。文件数量可能过万时，换成步骤 9 的「`-rf` 追加 + gzip」写法。

## 验证方法
{: .sec-ver}

按以下四条自查，全部满足即证明做对：

1. `tar -tzf 包名.tar.gz` 列出的成员全是 `.txt`，没有 `.jpg`、`.png`。
2. 成员数量与 `find 目录 -name "*.txt" | wc -l` 的输出**完全相等**。
3. 解压到临时目录后，`find 临时目录 -type f` 的文件名与源文件名一一对应，`cat` 内容一致。
4. 文件名里带空格的文件在归档列表中显示为**一个完整成员**（不会被拆成两行）。

## 本篇小结
{: .sec-sum}

把这一题摊开，是七条：

1. 本题的本质是「先拿到准确清单，再把清单交给 tar」，find 负责筛选，tar 负责打包，两者职责分开才不容易出错。
2. `find -exec` 结尾的 `\;` 是「每文件执行一次」，`+` 是「全部拼一起执行一次」；配 `-czf` 时必须用 `+`，否则归档被反复覆盖，只剩最后一个文件。
3. 文件名含空格时，裸 `xargs` 会按空白切分直接报错（退出码 123），必须用 `find -print0 | xargs -0`；`find -exec` 与 `tar -T` 天然安全。
4. `-name "*.txt"` 是严格后缀匹配且区分大小写，`.txt.bak` 不匹配、`TEST07.TXT` 不匹配（需 `-iname`）；find 默认递归子目录，只要当前层加 `-maxdepth 1`。
5. 反向排除（`! -name "*.jpg" ! -name "*.png"` 或 `tar --exclude`）的语义是「不是 jpg/png 的全要」，与「只要 txt」不等价，选型时要先想清楚需求。
6. 文件数量大时不要用 `-czf` 一次成包，改为 `-rf` 追加到未压缩归档再 `gzip`，避免分批调用导致的覆盖丢数据。
7. 打包一律用相对路径，给 tar 传绝对路径会被剥掉开头的 `/`；打包完成必须 `tar -tzf` 列清单 + 解压抽样验证。

> **参见**：[find](/posts/linux-fileattr-03/)、[tar](/posts/linux-fileattr-05/)、[权限与inode](/posts/linux-fileattr-03/)、[tar三件套与inode/block](/posts/linux-fileattr-05/)、[day13 find 命令真跑](/posts/linux-homework-13/)


{% endraw %}
