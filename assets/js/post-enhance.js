/* ==========================================================================
   博客增强 v4
   1) 阅读进度条（全局）
   2) 页面级增强（阅读时长 / 分享栏）→ initPage()，PJAX 换页后重跑
   3) 侧栏微信公众号入口（全局）
   4) 音乐台（全站悬浮球：选中榜单→点播放才切换；最小化后台播）
   5) 右上角语言切换器（全局）
   6) PJAX 站内导航：切换页面不中断音乐；异常自动降级原生跳转
   ========================================================================== */
(function () {
  "use strict";

  /* ===== 1. 阅读进度条（全局一次） ===== */
  var bar = document.getElementById("reading-progress");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "reading-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
  }

  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var pct = max > 0 ? (doc.scrollTop || document.body.scrollTop) / max * 100 : 0;
    bar.style.width = pct.toFixed(2) + "%";
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });

  /* ===== 工具函数 ===== */
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "share-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () { t.remove(); }, 2600);
  }

  function openQrModal(imgSrc, captionHTML) {
    var modal = document.createElement("div");
    modal.className = "qr-modal";
    modal.setAttribute("role", "dialog");
    modal.innerHTML =
      '<div class="qr-modal-box">' +
      '<button class="qr-close" type="button" aria-label="关闭">&times;</button>' +
      '<img src="' + imgSrc + '" alt="二维码">' +
      captionHTML +
      '</div>';
    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add("show"); });

    function close() {
      modal.classList.remove("show");
      setTimeout(function () { modal.remove(); }, 220);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(ev) { if (ev.key === "Escape") close(); }

    modal.querySelector(".qr-close").addEventListener("click", close);
    modal.addEventListener("click", function (ev) { if (ev.target === modal) close(); });
    document.addEventListener("keydown", onKey);
  }

  /* ===== 2. 页面级增强（每次换页重新执行） ===== */
  function initPage() {
    /* 2a. 中文阅读时长（中文 ~400 字/分钟，英文 ~200 词/分钟） */
    function calcMinutes() {
      var el = document.querySelector(".post-content");
      if (!el) return null;
      var text = (el.innerText || "").replace(/\s+/g, " ");
      var cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
      var en = (text.match(/[A-Za-z0-9]+/g) || []).length;
      return Math.max(1, Math.round(cjk / 400 + en / 200));
    }
    var mins = calcMinutes();
    var readtime = document.querySelector(".post-meta .readtime");
    if (readtime && mins) {
      readtime.innerHTML = "<em>" + mins + "</em> 分钟读完";
      readtime.setAttribute("title", "正文约 " + mins + " 分钟可读完（按中文 400 字/分钟估算）");
      readtime.classList.add("readtime-zh");
    }

    /* 2b. 分享栏（已存在则跳过，防重复） */
    var tail = document.querySelector(".post-tail-wrapper");
    if (tail && document.querySelector(".post-content") && !document.querySelector(".share-bar")) {
      var url = encodeURIComponent(location.href.split("#")[0]);
      var title = encodeURIComponent(document.title);
      var plainUrl = location.href.split("#")[0];

      var shareBar = document.createElement("div");
      shareBar.className = "share-bar";
      shareBar.setAttribute("aria-label", "分享本文");
      shareBar.innerHTML =
        '<span class="share-label"><i class="fa-fw fas fa-share-nodes"></i>分享</span>' +
        '<a class="share-btn share-weibo" target="_blank" rel="noopener noreferrer" href="https://service.weibo.com/share/share.php?url=' + url + "&title=" + title + '" title="分享到微博"><i class="fab fa-weibo"></i>微博</a>' +
        '<a class="share-btn share-qzone" target="_blank" rel="noopener noreferrer" href="https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=' + url + "&summary=" + title + '" title="分享到QQ空间"><i class="fab fa-qq"></i>QQ空间</a>' +
        '<button class="share-btn share-moments" type="button" title="分享到微信朋友圈"><i class="fab fa-weixin"></i>朋友圈</button>' +
        '<button class="share-btn share-wecom" type="button" title="分享到企业微信"><i class="fas fa-comment-dots"></i>企业微信</button>' +
        '<button class="share-btn share-feishu" type="button" title="分享到飞书"><i class="fas fa-paper-plane"></i>飞书</button>' +
        '<a class="share-btn share-x" target="_blank" rel="noopener noreferrer" href="https://twitter.com/intent/tweet?url=' + url + "&text=" + title + '" title="分享到 X"><i class="fab fa-x-twitter"></i>X</a>' +
        '<button class="share-btn share-copy" type="button" title="复制文章链接"><i class="fas fa-link"></i>复制链接</button>';

      tail.parentNode.insertBefore(shareBar, tail);

      function flash(btn, html) {
        var old = btn.innerHTML;
        btn.innerHTML = html;
        setTimeout(function () { btn.innerHTML = old; }, 2000);
      }
      function legacyCopy(text) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
      }
      function copyText(text, done) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
        } else { legacyCopy(text); done(); }
      }

      shareBar.querySelector(".share-copy").addEventListener("click", function () {
        var btn = this;
        copyText(plainUrl, function () { flash(btn, '<i class="fas fa-check"></i>已复制'); });
      });
      shareBar.querySelector(".share-moments").addEventListener("click", function () {
        try {
          var qr = window.qrcode(0, "M");
          qr.addData(plainUrl);
          qr.make();
          openQrModal(qr.createDataURL(8, 4),
            '<p><strong>微信扫一扫，打开本文</strong><br>微信内打开后点右上角「···」→ 分享到朋友圈<br>也可保存 / 截图二维码发朋友圈</p>');
        } catch (e) {
          copyText(plainUrl, function () { toast("链接已复制，去朋友圈粘贴分享吧"); });
        }
      });
      shareBar.querySelector(".share-wecom").addEventListener("click", function () {
        var btn = this;
        copyText(document.title + "\n" + plainUrl, function () {
          flash(btn, '<i class="fas fa-check"></i>已复制');
          toast("标题和链接已复制，打开企业微信粘贴发送即可");
        });
      });
      shareBar.querySelector(".share-feishu").addEventListener("click", function () {
        var btn = this;
        copyText(document.title + "\n" + plainUrl, function () {
          flash(btn, '<i class="fas fa-check"></i>已复制');
          toast("标题和链接已复制，打开飞书粘贴发送即可");
        });
      });
    }

    updateProgress();
  }
  window.__wbInitPage = initPage;
  initPage();

  /* ===== 3. 侧栏微信公众号入口（全局，sidebar 不随 PJAX 替换） ===== */
  var wxEntry = document.querySelector('#sidebar a[aria-label="wechat"]');
  if (wxEntry) {
    wxEntry.addEventListener("click", function (e) {
      e.preventDefault();
      openQrModal("/assets/img/wechat-qr.png",
        '<p>微信扫一扫，关注公众号<br><strong>陆沉盲瞽</strong></p>');
    });
  }

  /* ===== 4. 音乐台（全站：悬浮球 + 面板；选中榜单 → 点▶才切换播放） ===== */
  var musicBtn = document.getElementById("music-entry");
  var musicPanel = document.getElementById("music-panel");
  var musicFrame = document.getElementById("music-frame");
  var playBar = document.getElementById("music-play-bar");
  var playBtn = document.getElementById("music-play-btn");
  var playLabel = document.getElementById("music-play-label");
  if (musicBtn && musicPanel && musicFrame && playBar && playBtn) {
    var musicAutoMinTimer = null;
    var musicHovering = false;
    var currentList = null;
    var pendingList = null;
    var LIST_NAMES = { "3778678": "热歌榜", "3779629": "新歌榜", "19723756": "飙升榜", "2884035": "原创榜" };

    function scheduleAutoMin() {
      clearTimeout(musicAutoMinTimer);
      musicAutoMinTimer = setTimeout(function () {
        if (!musicHovering && musicPanel.classList.contains("show")) musicMinimize();
      }, 6000);
    }

    function musicLoadList(listId) {
      musicFrame.src = musicFrame.dataset.srcPrefix + listId + musicFrame.dataset.srcSuffix;
      currentList = listId;
      pendingList = null;
      playBar.hidden = true;
      musicBtn.classList.add("playing");
      try { localStorage.setItem("wb-music-list", listId); } catch (e) {}
      scheduleAutoMin();
    }

    function musicExpand() {
      if (!currentList && !musicFrame.getAttribute("src")) {
        /* 首次打开：恢复上次播放的榜单，否则默认热歌榜 */
        var saved = null;
        try { saved = localStorage.getItem("wb-music-list"); } catch (e) {}
        musicLoadList(saved || "3778678");
      }
      musicPanel.classList.add("show");
      musicBtn.classList.add("expanded");
      clearTimeout(musicAutoMinTimer);
    }

    function musicMinimize() {
      musicPanel.classList.remove("show");
      musicBtn.classList.remove("expanded");
      /* 最小化≠停止：iframe 不动，音乐继续 */
    }

    function musicStop() {
      clearTimeout(musicAutoMinTimer);
      musicPanel.classList.remove("show");
      musicBtn.classList.remove("expanded", "playing");
      musicFrame.src = "about:blank";
      currentList = null;
      pendingList = null;
      playBar.hidden = true;
    }

    musicBtn.addEventListener("click", function () {
      if (musicPanel.classList.contains("show")) musicMinimize();
      else musicExpand();
    });

    /* 榜单 tab：仅选中，不触碰播放器 —— 切换榜单不影响正在播放的音乐 */
    var musicTabs = musicPanel.querySelectorAll(".music-tab");
    musicTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var id = tab.dataset.list;
        if (id === currentList) {
          playBar.hidden = true;
          pendingList = null;
          musicTabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
          toast("正在播放「" + (LIST_NAMES[id] || "该榜单") + "」");
          return;
        }
        pendingList = id;
        musicTabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
        playLabel.textContent = "播放：" + (LIST_NAMES[id] || "选中榜单");
        playBar.hidden = false;
      });
    });

    /* 主动点「播放」才真正切换播放器 */
    playBtn.addEventListener("click", function () {
      if (pendingList) musicLoadList(pendingList);
    });

    musicFrame.addEventListener("load", scheduleAutoMin);
    musicPanel.addEventListener("mouseenter", function () {
      musicHovering = true;
      clearTimeout(musicAutoMinTimer);
    });
    musicPanel.addEventListener("mouseleave", function () {
      musicHovering = false;
      if (currentList) scheduleAutoMin();
    });

    document.getElementById("music-min").addEventListener("click", musicMinimize);
    document.getElementById("music-stop").addEventListener("click", musicStop);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && musicPanel.classList.contains("show")) musicMinimize();
    });
    document.getElementById("music-search").addEventListener("click", function () {
      window.open("https://music.163.com/#/search/m/", "_blank", "noopener");
    });
    document.getElementById("music-standalone").addEventListener("click", function () {
      window.open("/music/", "_blank", "noopener");
    });
  }

  /* ===== 5. 右上角语言切换器（全局） ===== */
  var langSwitcher = document.getElementById("lang-switcher");
  var langBtn = document.getElementById("lang-btn");
  var langMenu = document.getElementById("lang-menu");
  function updateLangHighlight(path) {
    if (!langMenu) return;
    var p = path;
    var currentLang = "zh";
    if (p === "/en" || p.indexOf("/en/") === 0) currentLang = "en";
    else if (p === "/ja" || p.indexOf("/ja/") === 0) currentLang = "ja";
    else if (p === "/fr" || p.indexOf("/fr/") === 0) currentLang = "fr";
    langMenu.querySelectorAll("a").forEach(function (a) {
      a.classList.toggle("current", a.dataset.lang === currentLang);
    });
  }
  if (langSwitcher && langBtn && langMenu) {
    updateLangHighlight(location.pathname);
    langBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      langMenu.classList.toggle("open");
    });
    document.addEventListener("click", function (ev) {
      if (!langSwitcher.contains(ev.target)) langMenu.classList.remove("open");
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") langMenu.classList.remove("open");
    });
  }

  /* ===== 6. PJAX 站内导航（切换页面音乐不断播；异常自动降级原生跳转） ===== */
  var PJAX_CONTAINERS = [
    { get: function (d) { return d.querySelector("main"); } },
    { get: function (d) { return d.querySelector("#panel-wrapper"); } },
    { get: function (d) { return d.querySelector("#tail-wrapper"); } }
  ];

  function pjaxShouldHandle(a) {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    var href = a.getAttribute("href") || "";
    if (!href || href.indexOf("#") === 0 || href.indexOf("mailto:") === 0 ||
        href.indexOf("tel:") === 0 || href.indexOf("javascript:") === 0) return false;
    if (a.origin !== location.origin) return false;
    if (a.pathname === location.pathname && a.hash) return false;
    /* 非页面资源：feed、sitemap、json、图片、压缩包等走原生 */
    if (/\.[a-z0-9]{2,5}(?:$|\?)/i.test(a.pathname) &&
        !/\.html?$/i.test(a.pathname)) return false;
    if (a.dataset && a.dataset.noPjax !== undefined) return false;
    return true;
  }

  function pjaxRunScripts(container) {
    if (!container) return;
    container.querySelectorAll("script").forEach(function (old) {
      var s = document.createElement("script");
      if (old.src) { s.src = old.src; s.async = false; }
      else { s.textContent = old.textContent; }
      old.parentNode.replaceChild(s, old);
    });
  }

  function pjaxSwap(doc, url) {
    var replaced = 0;
    PJAX_CONTAINERS.forEach(function (c) {
      var fresh = c.get(doc);
      var stale = c.get(document);
      if (fresh && stale) {
        stale.replaceWith(fresh);
        pjaxRunScripts(fresh);
        replaced++;
      }
    });
    if (replaced === 0) { location.href = url; return; } /* 结构不符 → 原生跳转 */
    document.title = doc.title;
    updateLangHighlight(location.pathname);
    if (typeof window.__wbInitPage === "function") window.__wbInitPage();
    window.scrollTo(0, 0);
  }

  function pjaxNavigate(url, push) {
    fetch(url, { headers: { "X-Requested-With": "pjax" }, credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (text) {
        var doc = new DOMParser().parseFromString(text, "text/html");
        pjaxSwap(doc, url);
        if (push) history.pushState({ pjax: true }, "", url);
        updateProgress();
      })
      .catch(function () { location.href = url; }); /* 网络异常 → 原生跳转 */
  }

  document.addEventListener("click", function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target.closest && ev.target.closest("a");
    if (!pjaxShouldHandle(a)) return;
    ev.preventDefault();
    pjaxNavigate(a.href, true);
  });

  window.addEventListener("popstate", function () {
    pjaxNavigate(location.href, false);
  });
})();
