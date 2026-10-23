# 作者文章管理指南

本博客的文章全部由仓库根目录 `_posts/` 下的 Markdown 文件生成。**作者（仓库所有者）拥有完全的增删改权限**——每次修改推送到 `main` 分支后，GitHub Actions 自动构建并发布（约 1 分钟生效）。

## 文件命名规则

```
_posts/YYYY-MM-DD-文章标识.md
```

例如：`_posts/2026-10-23-blogmap.md`

## 新建文章

在 `_posts/` 下新建 `YYYY-MM-DD-title.md`，写入：

```markdown
---
title: 文章标题
description: 一句话摘要（可选，显示在文章标题下）
date: 2026-10-23 12:00:00 +0800
categories: [分类]
tags: [标签1, 标签2]
---

正文内容（标准 Markdown）……
```

> ⚠️ 注意：Front Matter 里 `title:` 的值如果包含**半角冒号 `:`**，必须用英文双引号包裹整句，例如：
> `title: "嵌入式开发：从裸机到 RTOS"`
> 否则构建会失败（YAML 语法错误）。

## 修改文章

直接编辑对应 `_posts/` 下的 `.md` 文件，改完推送即可。

## 删除文章

删除对应的 `.md` 文件并推送，线上该文章即下线（分类/标签/归档列表自动同步更新）：

```bash
git rm _posts/2026-10-16-life-notes.md
git commit -m "删除文章 xxx"
git push
```

## 置顶 / 隐藏

- **置顶**：front-matter 加 `pin: true`（多置顶按日期排序）
- **隐藏**：把文件移出 `_posts/` 目录，或文件名前加下划线（如 `_draft.md` 即草稿，不会发布）

## 常用命令速查

```bash
# 本地改完推上线
git add -A && git commit -m "更新文章" && git push origin main

# 网络抖动时改用 openssl 后端推送
git -c http.sslBackend=openssl push origin main
```

> 也可以直接在对话里说「删除某篇文章」「改某篇文章的标题」，由助手代为执行并部署。
