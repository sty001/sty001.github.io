/* ==========================================================================
   文章阅读增强 v1
   1) 阅读进度条（文章位置追踪）
   2) 中文阅读时长估算（覆盖 Chirpy 默认的英文词数估算）
   3) 分享栏：微博 / QQ空间 / X / 微信 / 复制链接
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

  var mins = calcMinutes();
  var readtime = document.querySelector(".post-meta .readtime");
  if (readtime && mins) {
    readtime.innerHTML = "<em>" + mins + "</em> 分钟读完";
    readtime.setAttribute("title", "正文约 " + mins + " 分钟可读完（按中文 400 字/分钟估算）");
    readtime.classList.add("readtime-zh");
  }

  /* ===== 3. 分享栏 ===== */
  var tail = document.querySelector(".post-tail-wrapper");
  if (tail && document.querySelector(".post-content")) {
    var url = encodeURIComponent(location.href.split("#")[0]);
    var title = encodeURIComponent(document.title);

    var shareBar = document.createElement("div");
    shareBar.className = "share-bar";
    shareBar.setAttribute("aria-label", "分享本文");
    shareBar.innerHTML =
      '<span class="share-label"><i class="fa-fw fas fa-share-nodes"></i>分享</span>' +
      '<a class="share-btn share-weibo" target="_blank" rel="noopener noreferrer" href="https://service.weibo.com/share/share.php?url=' + url + "&title=" + title + '"><i class="fab fa-weibo"></i>微博</a>' +
      '<a class="share-btn share-qzone" target="_blank" rel="noopener noreferrer" href="https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=' + url + "&summary=" + title + '"><i class="fab fa-qq"></i>QQ空间</a>' +
      '<a class="share-btn share-x" target="_blank" rel="noopener noreferrer" href="https://twitter.com/intent/tweet?url=' + url + "&text=" + title + '"><i class="fab fa-x-twitter"></i>X</a>' +
      '<button class="share-btn share-wechat" type="button"><i class="fab fa-weixin"></i>微信</button>' +
      '<button class="share-btn share-copy" type="button"><i class="fas fa-link"></i>复制链接</button>';

    tail.parentNode.insertBefore(shareBar, tail);

    function flash(btn, html) {
      var old = btn.innerHTML;
      btn.innerHTML = html;
      setTimeout(function () { btn.innerHTML = old; }, 2000);
    }

    function copyLink(done) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(done, done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = location.href;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    }

    shareBar.querySelector(".share-copy").addEventListener("click", function () {
      var btn = this;
      copyLink(function () { flash(btn, '<i class="fas fa-check"></i>已复制'); });
    });

    shareBar.querySelector(".share-wechat").addEventListener("click", function () {
      var btn = this;
      copyLink(function () {
        flash(btn, '<i class="fab fa-weixin"></i>已复制');
        toast("链接已复制，去微信粘贴给好友或发朋友圈吧");
      });
    });
  }

  /* ===== 4. 侧栏微信公众号入口（点击弹二维码） ===== */
  var wxEntry = document.querySelector('#sidebar a[aria-label="wechat"]');
  if (wxEntry) {
    wxEntry.addEventListener("click", function (e) {
      e.preventDefault();
      var modal = document.createElement("div");
      modal.className = "qr-modal";
      modal.setAttribute("role", "dialog");
      modal.innerHTML =
        '<div class="qr-modal-box">' +
        '<button class="qr-close" type="button" aria-label="关闭">&times;</button>' +
        '<img src="/assets/img/wechat-qr.png" alt="微信公众号二维码">' +
        '<p>微信扫一扫，关注公众号<br><strong>陆沉盲瞽</strong></p>' +
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
    });
  }
})();
