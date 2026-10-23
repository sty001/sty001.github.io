---
title: ブログへようこそ
date: 2026-10-23 12:00:00 +0800
permalink: /ja/posts/welcome/
categories: [Blog, Notes]
tags: [ようこそ, ブログ]
lang: ja
---

<div class="lang-switcher-bar">
  <a href="/">简体中文</a> · <a href="/en/">English</a> · <span class="lang-current">日本語</span> · <a href="/fr/">Français</a>
</div>

これはブログの最初の記事です。GitHub Pages + Jekyll（Chirpy テーマ）の構築が正しく動いているかを確認するために書きました。

## このブログで書くこと

以下の分野の学習と実践を記録していきます：

- **FPGA / デジタル回路**：Quartus、Verilog、タイミング制約など
- **EDA ツールチェーン**：Cadence、Keil など
- **Web フルスタック開発**：フロントエンド、バックエンド、デプロイ
- **AI / 大規模言語モデル**：ファインチューニング、デプロイ、Agent 実践

## 新しい記事の書き方

`_posts/` ディレクトリに `YYYY-MM-DD-title.md` という名前でファイルを作り、先頭に Front Matter を書くだけです：

```yaml
---
title: 記事タイトル
date: 2026-10-23 12:00:00 +0800
categories: [カテゴリ]
tags: [タグ]
---
```

その後 `main` ブランチに `git push` すれば、GitHub Actions が自動でビルドし、GitHub Pages にデプロイします。

> 準備はすべて整いました。今後の更新にご期待ください ✨
