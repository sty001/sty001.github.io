---
icon: fas fa-archive
title: Archives
permalink: /fr/archives/
lang: fr
---

<div class="lang-switcher-bar">
  <a href="/">简体中文</a> · <a href="/en/">English</a> · <a href="/ja/">日本語</a> · <a href="/fr/">Français</a>
</div>

Tous les articles publiés en français sur ce site, du plus récent au plus ancien :

{% assign lang_posts = site.posts | where: "lang", page.lang | sort: "date" | reverse %}
<ul>
  {% for post in lang_posts %}
  <li><span class="text-muted">{{ post.date | date: "%Y-%m-%d" }}</span> — <a href="{{ post.url | relative_url }}">{{ post.title }}</a></li>
  {% endfor %}
</ul>

> Pour toute la bibliothèque chinoise, voir les [archives chinoises](/archives/){:lang="zh"}.
