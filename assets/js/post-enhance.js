/* ==========================================================================
   博客增强 v7
   1) 阅读进度条（文章位置追踪）
   2) 中文阅读时长估算（覆盖 Chirpy 默认的英文词数估算）
   3) 分享栏：微博 / QQ空间 / 微信朋友圈(二维码) / 企业微信 / 飞书 / X / 复制链接
   4) 侧栏微信公众号入口（点击弹二维码）
   5) 点击特效（涟漪高亮 + 雪花粒子；雪花飘落为纯 CSS 静态实现）
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

  /* ===== 全局轻提示 ===== */
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "share-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () { t.remove(); }, 2600);
  }

  /* ===== 二维码弹窗（朋友圈 / 侧栏公众号 共用） ===== */
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

  /* ===== 4. 侧栏微信公众号入口（点击弹公众号二维码） ===== */
  var wxEntry = document.querySelector('#sidebar a[aria-label="wechat"]');
  if (wxEntry) {
    wxEntry.addEventListener("click", function (e) {
      e.preventDefault();
      openQrModal("/assets/img/wechat-qr.png",
        '<p>微信扫一扫，关注公众号<br><strong>陆沉盲瞽</strong></p>');
    });
  }

  /* ===== 5. 点击特效（涟漪高亮 + 雪花粒子迸发；整体 try-catch 兜底） ===== */
  try {
    (function initClickFx() {
      var COLORS = ["#7c4dff", "#448aff", "#58a6ff", "#a371f7"];
      document.addEventListener("click", function (ev) {
        var x = ev.clientX, y = ev.clientY;

        /* 涟漪高亮圈（实心光晕） */
        var ripple = document.createElement("div");
        ripple.className = "click-ripple";
        ripple.style.left = x + "px";
        ripple.style.top = y + "px";
        document.body.appendChild(ripple);
        setTimeout(function () { ripple.remove(); }, 680);

        /* 外圈水波纹（扩散更慢更大，与内圈形成双层涟漪） */
        var wave = document.createElement("div");
        wave.className = "click-wave";
        wave.style.left = x + "px";
        wave.style.top = y + "px";
        document.body.appendChild(wave);
        setTimeout(function () { wave.remove(); }, 900);

        /* 雪花粒子迸发 */
        var n = 6 + Math.floor(Math.random() * 3);
        for (var i = 0; i < n; i++) {
          var p = document.createElement("span");
          p.className = "click-snow";
          p.textContent = "❄";
          var ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
          var dist = 26 + Math.random() * 30;
          p.style.left = x + "px";
          p.style.top = y + "px";
          p.style.color = COLORS[i % COLORS.length];
          p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
          p.style.setProperty("--dy", Math.sin(ang) * dist - 10 + "px");
          p.style.setProperty("--rot", (Math.random() * 260 - 130) + "deg");
          p.style.fontSize = 9 + Math.random() * 6 + "px";
          document.body.appendChild(p);
          (function (el) { setTimeout(function () { el.remove(); }, 750); })(p);
        }
      }, { passive: true });
    })();
  } catch (e) { /* 特效失败不影响任何功能 */ }

  /* ===== 6. 全站氛围特效：飘雪 + 鼠标跟随光晕 ===== */
  try {
    (function initAmbientFx() {
      var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
      var mqFine = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : null;
      var reduce = !!(mqReduce && mqReduce.matches);
      var fine = !!(mqFine && mqFine.matches);

      /* --- 6.1 飘雪：JS 生成少量雪花 + CSS 动画；靠两侧飘，避免压住正文栏 --- */
      /* 不受系统“减少动态效果”影响：用户要求常驻显示 */
      if (true) {
        var layer = document.createElement("div");
        layer.id = "snow-fx";
        layer.setAttribute("aria-hidden", "true");
        var COUNT = 22;
        for (var i = 0; i < COUNT; i++) {
          var flake = document.createElement("span");
          flake.className = "snowflake";
          flake.textContent = "❄";
          var r = Math.random();
          var vw = r < 0.34 ? Math.random() * 22
                 : r < 0.68 ? 78 + Math.random() * 22
                 : Math.random() * 100;
          flake.style.left = vw.toFixed(2) + "vw";
          flake.style.top = (-10 - Math.random() * 20).toFixed(1) + "vh";
          flake.style.fontSize = (9 + Math.random() * 7).toFixed(1) + "px";
          flake.style.opacity = (0.3 + Math.random() * 0.4).toFixed(2);
          flake.style.animationDuration = (11 + Math.random() * 12).toFixed(1) + "s";
          flake.style.animationDelay = (-Math.random() * 22).toFixed(1) + "s";
          flake.style.setProperty("--sway", (14 + Math.random() * 26).toFixed(0) + "px");
          layer.appendChild(flake);
        }
        document.body.appendChild(layer);
      }

      /* --- 6.2 鼠标跟随光晕：给指针"着色"；仅精确指针设备启用（触屏不启用） --- */
      if (fine) {
        var glow = document.createElement("div");
        glow.id = "cursor-glow";
        glow.setAttribute("aria-hidden", "true");
        var ring = document.createElement("div");
        ring.id = "cursor-ring";
        ring.setAttribute("aria-hidden", "true");
        document.body.appendChild(glow);
        document.body.appendChild(ring);

        var tx = 0, ty = 0, gx = 0, gy = 0, rx = 0, ry = 0, raf = 0;

        function paint() {
          gx += (tx - gx) * 0.12;
          gy += (ty - gy) * 0.12;
          rx += (tx - rx) * 0.28;
          ry += (ty - ry) * 0.28;
          glow.style.transform = "translate3d(" + (gx - 110).toFixed(1) + "px," + (gy - 110).toFixed(1) + "px,0)";
          ring.style.transform = "translate3d(" + (rx - 13).toFixed(1) + "px," + (ry - 13).toFixed(1) + "px,0)";
          if (Math.abs(tx - gx) > 0.1 || Math.abs(ty - gy) > 0.1) {
            raf = requestAnimationFrame(paint);
          } else {
            raf = 0;
          }
        }

        document.addEventListener("mousemove", function (ev) {
          tx = ev.clientX;
          ty = ev.clientY;
          glow.style.opacity = "1";
          ring.style.opacity = "1";
          if (!raf) raf = requestAnimationFrame(paint);
        }, { passive: true });

        document.addEventListener("mouseleave", function () {
          glow.style.opacity = "0";
          ring.style.opacity = "0";
        });
      }
    })();
  } catch (e) { /* 氛围特效失败不影响任何功能 */ }
})();
