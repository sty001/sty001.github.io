/* ==========================================================================
   文章阅读增强 v3
   1) 阅读进度条（文章位置追踪）
   2) 中文阅读时长估算（覆盖 Chirpy 默认的英文词数估算）
   3) 分享栏：微博 / QQ空间 / 微信朋友圈(二维码) / 企业微信 / 飞书 / X / 复制链接
   4) 侧栏微信公众号入口（点击弹二维码）
   5) 主页右上角点歌台（网易云音乐外链播放器）
   ========================================================================== */
(function () {
  "use strict";

  /* ===== 1. 阅读进度条 ===== */
  var bar = document.createElement("div");
  bar.id = "reading-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var pct = max > 0 ? (doc.scrollTop || document.body.scrollTop) / max * 100 : 0;
    bar.style.width = pct.toFixed(2) + "%";
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });
  updateProgress();

  /* ===== 2. 中文阅读时长（中文 ~400 字/分钟，英文 ~200 词/分钟） ===== */
  function calcMinutes() {
    var el = document.querySelector(".post-content");
    if (!el) return null;
    var text = (el.innerText || "").replace(/\s+/g, " ");
    var cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
    var en = (text.match(/[A-Za-z0-9]+/g) || []).length;
    var mins = Math.round(cjk / 400 + en / 200);
    return Math.max(1, mins);
  }

  /* 全局轻提示（分享 / 微信入口共用） */
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "share-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () { t.remove(); }, 2600);
  }

  /* ===== 3. 二维码弹窗（朋友圈分享 / 侧栏公众号 共用） ===== */
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

  /* ===== 4. 分享栏 ===== */
  var tail = document.querySelector(".post-tail-wrapper");
  if (tail && document.querySelector(".post-content")) {
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
      } else {
        legacyCopy(text);
        done();
      }
    }

    /* 复制链接 */
    shareBar.querySelector(".share-copy").addEventListener("click", function () {
      var btn = this;
      copyText(plainUrl, function () { flash(btn, '<i class="fas fa-check"></i>已复制'); });
    });

    /* 微信朋友圈：弹出本文二维码（qrcode-generator 本地生成，零外链） */
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

    /* 企业微信：复制标题+链接 */
    shareBar.querySelector(".share-wecom").addEventListener("click", function () {
      var btn = this;
      copyText(document.title + "\n" + plainUrl, function () {
        flash(btn, '<i class="fas fa-check"></i>已复制');
        toast("标题和链接已复制，打开企业微信粘贴发送即可");
      });
    });

    /* 飞书：复制标题+链接 */
    shareBar.querySelector(".share-feishu").addEventListener("click", function () {
      var btn = this;
      copyText(document.title + "\n" + plainUrl, function () {
        flash(btn, '<i class="fas fa-check"></i>已复制');
        toast("标题和链接已复制，打开飞书粘贴发送即可");
      });
    });
  }

  /* ===== 5. 侧栏微信公众号入口（点击弹公众号二维码） ===== */
  var wxEntry = document.querySelector('#sidebar a[aria-label="wechat"]');
  if (wxEntry) {
    wxEntry.addEventListener("click", function (e) {
      e.preventDefault();
      openQrModal("/assets/img/wechat-qr.png",
        '<p>微信扫一扫，关注公众号<br><strong>陆沉盲瞽</strong></p>');
    });
  }

  /* ===== 6. 主页右上角点歌台（网易云音乐官方外链播放器） ===== */
  /* MUSIC_LIST_ID：网易云音乐歌单 ID，当前为官方「云音乐热歌榜」。
     想换成自己的歌单：网易云网页版打开你的歌单，URL 中 /playlist?id=XXXXX 的数字即 ID */
  var MUSIC_LIST_ID = "3778678";
  var onHome = location.pathname.replace(/\/+$/, "") === "" || location.pathname === "/index.html";
  if (onHome && !document.getElementById("music-entry")) {
    var musicBtn = document.createElement("button");
    musicBtn.id = "music-entry";
    musicBtn.type = "button";
    musicBtn.title = "点歌台 · 网易云音乐";
    musicBtn.setAttribute("aria-label", "点歌台");
    musicBtn.innerHTML = '<i class="fas fa-music"></i>';
    document.body.appendChild(musicBtn);

    var musicPanel = null;
    var musicOnKey = null;

    musicBtn.addEventListener("click", function () {
      if (musicPanel) { closeMusic(); return; }
      musicPanel = document.createElement("div");
      musicPanel.id = "music-panel";
      musicPanel.innerHTML =
        '<div class="music-head">' +
        '<span><i class="fas fa-music"></i>点歌台 · 网易云音乐</span>' +
        '<button class="music-close" type="button" aria-label="关闭">&times;</button>' +
        '</div>' +
        '<iframe frameborder="no" border="0" marginwidth="0" marginheight="0" ' +
        'width="100%" height="430" loading="lazy" title="网易云音乐播放器" ' +
        'src="https://music.163.com/outchain/player?type=0&id=' + MUSIC_LIST_ID + '&auto=0&height=430&size=small"></iframe>';
      document.body.appendChild(musicPanel);
      requestAnimationFrame(function () { musicPanel.classList.add("show"); });
      musicBtn.classList.add("active");

      musicOnKey = function (ev) { if (ev.key === "Escape") closeMusic(); };
      document.addEventListener("keydown", musicOnKey);
      musicPanel.querySelector(".music-close").addEventListener("click", closeMusic);
    });

    function closeMusic() {
      if (!musicPanel) return;
      musicPanel.classList.remove("show");
      musicBtn.classList.remove("active");
      var el = musicPanel;
      setTimeout(function () { el.remove(); }, 220);
      musicPanel = null;
      if (musicOnKey) { document.removeEventListener("keydown", musicOnKey); musicOnKey = null; }
    }
  }
})();
