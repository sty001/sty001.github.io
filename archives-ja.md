---
icon: fas fa-archive
title: アーカイブ
permalink: /ja/archives/
lang: ja
---

<div class="lang-switcher-bar">
  <a href="/">简体中文</a> · <a href="/en/">English</a> · <a href="/ja/">日本語</a> · <a href="/fr/">Français</a>
</div>

本サイトの日本語記事一覧（新しい順）：

{% assign lang_posts = site.posts | where: "lang", page.lang | sort: "date" | reverse %}
<ul>
  {% for post in lang_posts %}
  <li><span class="text-muted">{{ post.date | date: "%Y-%m-%d" }}</span> — <a href="{{ post.url | relative_url }}">{{ post.title }}</a></li>
  {% endfor %}
</ul>

> 中国語の全ライブラリは[中国語アーカイブ](/archives/){:lang="zh"}をご覧ください。
