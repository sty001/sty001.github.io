---
layout: page
title: 音乐台
description: 网易云音乐播放器 · 支持歌单切换 · 后台常驻播放
permalink: /music/
nav: false
toc: false
pin: false
---

> 把本页固定在一个浏览器标签，即可**边听歌边浏览博客**——在本标签切歌、换歌单，音乐持续不断；其他标签里随便翻页、看文章都不会打断播放。

<div class="music-page-picker" role="tablist" aria-label="歌单切换">
  <button class="music-tab active" type="button" data-list="3778678">🔥 热歌榜</button>
  <button class="music-tab" type="button" data-list="3779629">🆕 新歌榜</button>
  <button class="music-tab" type="button" data-list="19723756">🚀 飙升榜</button>
  <button class="music-tab" type="button" data-list="2884035">✨ 原创榜</button>
</div>

<iframe
  id="music-page-frame"
  frameborder="no"
  border="0"
  marginwidth="0"
  marginheight="0"
  width="100%"
  height="620"
  loading="lazy"
  title="网易云音乐播放器"
  src="https://music.163.com/outchain/player?type=0&id=3778678&auto=0&height=620&size=small"
></iframe>

**使用说明**

- 歌单按钮一键切换类型；播放器列表内可点任意歌曲播放，正在播放的歌曲会高亮，播完自动连播下一首。
- 想听自己的收藏歌单：在网易云网页版打开你的歌单，复制地址栏 `/playlist?id=XXXXX` 中的数字 ID 发给站长即可加入切换列表。
- 网易云外链播放器为官方组件，登录与个性化推荐需在网易云音乐 App / 官网内完成。
- 在博客右下角找到 🎵 悬浮球，可随时展开迷你点歌台，最小化后后台播放、不影响阅读。

<script>
  (function () {
    var frame = document.getElementById("music-page-frame");
    var picker = document.querySelector(".music-page-picker");
    if (!frame || !picker) { return; }
    picker.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".music-tab");
      if (!btn) { return; }
      picker.querySelectorAll(".music-tab").forEach(function (t) { t.classList.remove("active"); });
      btn.classList.add("active");
      frame.src =
        "https://music.163.com/outchain/player?type=0&id=" +
        btn.dataset.list +
        "&auto=0&height=620&size=small";
    });
  })();
</script>
