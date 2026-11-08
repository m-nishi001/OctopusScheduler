// ドキュメントビューア。docs/markdown を build-docs.mjs が変換した DATA を表示する。
// ルート: #/<ページ> または #/<ページ>~<見出しid>(例 #/manual/04-day~day-session)。GAS の iframe でも動くよう古い書き方だけを使う。
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("app-data").textContent);
  var side = document.getElementById("app-side");
  var content = document.getElementById("app-content");
  var mtoc = document.getElementById("app-mtoc");
  var pager = document.getElementById("app-pager");
  var menuBtn = document.getElementById("app-menu");
  var lb = document.getElementById("lb");
  var lbImg = lb.querySelector("img");

  // 画面に出る順のページ一覧(章をまたいだ前後移動はしない。セクション内だけ)
  var order = [];
  DATA.sections.forEach(function (s, si) {
    s.pages.forEach(function (p, pi) {
      order.push({ path: p.path, title: p.title, sec: si, idx: pi });
    });
  });
  var current = null;

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function route(path, anchor) {
    return "#/" + path + (anchor ? "~" + anchor : "");
  }
  function parseHash() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    var i = h.indexOf("~");
    var path = i < 0 ? h : h.slice(0, i);
    var anchor = i < 0 ? "" : h.slice(i + 1);
    if (!DATA.pages[path]) path = order[0].path;
    return { path: path, anchor: anchor };
  }

  function renderSide() {
    side.innerHTML = "";
    DATA.sections.forEach(function (s) {
      side.appendChild(el("b", null, esc(s.title)));
      s.pages.forEach(function (p) {
        var a = el("a", { href: route(p.path), "data-path": p.path }, esc(p.title));
        if (p.path === current) {
          a.setAttribute("aria-current", "page");
          side.appendChild(a);
          var toc = DATA.pages[p.path].toc;
          if (toc.length) {
            var sub = el("div", { class: "sub" });
            toc.forEach(function (t) {
              sub.appendChild(el("a", { href: route(p.path, t.id), class: "d" + t.depth }, t.html));
            });
            side.appendChild(sub);
          }
        } else {
          side.appendChild(a);
        }
      });
    });
  }

  function renderMtoc(page) {
    if (!page.toc.length) {
      mtoc.hidden = true;
      return;
    }
    var h = "<summary>このページのもくじ</summary>";
    page.toc.forEach(function (t) {
      h += '<a class="d' + t.depth + '" href="' + route(current, t.id) + '">' + t.html + "</a>";
    });
    mtoc.innerHTML = h;
    mtoc.open = false;
    mtoc.hidden = false;
  }

  function renderPager() {
    var me = null;
    order.forEach(function (o) {
      if (o.path === current) me = o;
    });
    var prev = null;
    var next = null;
    order.forEach(function (o) {
      if (o.sec !== me.sec) return;
      if (o.idx === me.idx - 1) prev = o;
      if (o.idx === me.idx + 1) next = o;
    });
    var h = "";
    if (prev) h += '<a class="prev" href="' + route(prev.path) + '"><small>前のページ</small>' + esc(prev.title) + "</a>";
    if (next) h += '<a class="next" href="' + route(next.path) + '"><small>次のページ</small>' + esc(next.title) + "</a>";
    pager.innerHTML = h;
  }

  function scrollToAnchor(anchor) {
    if (!anchor) {
      window.scrollTo(0, 0);
      return;
    }
    var t = document.getElementById(anchor);
    if (t) t.scrollIntoView();
  }

  function render() {
    var r = parseHash();
    document.body.classList.remove("nav-open");
    menuBtn.setAttribute("aria-expanded", "false");
    if (r.path !== current) {
      current = r.path;
      var page = DATA.pages[current];
      content.innerHTML = page.html;
      var imgs = content.querySelectorAll("img[data-img]");
      for (var i = 0; i < imgs.length; i++) imgs[i].src = DATA.images[imgs[i].getAttribute("data-img")];
      document.title = page.title + " - " + DATA.title;
      renderMtoc(page);
      renderPager();
      renderSide();
    }
    scrollToAnchor(r.anchor);
  }

  // メニュー(スマホ幅でサイドバーを開閉)
  menuBtn.addEventListener("click", function () {
    var on = document.body.classList.toggle("nav-open");
    menuBtn.setAttribute("aria-expanded", on ? "true" : "false");
  });
  document.getElementById("app-title").addEventListener("click", function (e) {
    e.preventDefault();
    location.hash = route(order[0].path);
  });

  // 画像の拡大(クリックまたは Esc で閉じる)
  content.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.src) {
      lbImg.src = t.src;
      lb.classList.add("on");
    }
  });
  lb.addEventListener("click", function () {
    lb.classList.remove("on");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") lb.classList.remove("on");
  });

  window.addEventListener("hashchange", render);
  render();
})();
