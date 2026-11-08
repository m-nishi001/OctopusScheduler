#!/usr/bin/env node
// docs/markdown/** と docs/html/** から、GAS に置ける自己完結の docs/gas/index.html を作る。
//   node scripts/build-docs.mjs          ... 生成して書き出す(npm run docs:build)
//   node scripts/build-docs.mjs --check  ... 生成結果とコミット済みの docs/gas/index.html を比べる(npm run docs:check)
// 規約と手順は docs/README.md を参照。出力は決定的(日時や乱数を使わない)。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const MD_DIR = path.join(DOCS, "markdown");
const HTML_DIR = path.join(DOCS, "html");
const GAS_DIR = path.join(DOCS, "gas");
const OUT = path.join(GAS_DIR, "index.html");
const CHECK = process.argv.includes("--check");

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const read = (p) => fs.readFileSync(p, "utf8");

// ---- sitemap と md ファイルの突き合わせ ---------------------------------
const sitemap = JSON.parse(read(path.join(MD_DIR, "sitemap.json")));
const sitemapKeys = new Set();
for (const sec of sitemap.sections) {
  for (const pg of sec.pages) {
    if (sitemapKeys.has(pg.path)) err(`sitemap: ページが重複しています: ${pg.path}`);
    sitemapKeys.add(pg.path);
    if (!fs.existsSync(path.join(MD_DIR, `${pg.path}.md`))) err(`sitemap: ファイルがありません: docs/markdown/${pg.path}.md`);
  }
}
function walkMd(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}
for (const f of walkMd(MD_DIR)) {
  const key = path.relative(MD_DIR, f).split(path.sep).join("/").replace(/\.md$/, "");
  if (!sitemapKeys.has(key)) err(`sitemap にないページです: docs/markdown/${key}.md`);
}

// ---- リポジトリ URL(リポジトリ内のソースへのリンクを GitHub に向ける) ----
function repoUrl() {
  if (process.env.DOCS_REPO_URL) return process.env.DOCS_REPO_URL.replace(/\/$/, "");
  try {
    const u = execFileSync("git", ["remote", "get-url", "origin"], { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    const m = u.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/);
    return m ? `https://github.com/${m[1]}` : null;
  } catch {
    return null;
  }
}
const REPO = repoUrl();
if (!REPO) warn("リポジトリ URL を取得できないため、ソースへのリンクは文字だけにします");

// ---- 画像(base64 data URI。同じ画像は1回だけ) ------------------------------
const images = new Map(); // id -> data URI
const MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif" };
function imageId(abs) {
  const rp = path.relative(path.join(DOCS, "assets", "images"), abs).split(path.sep).join("/");
  return rp.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "_");
}
function registerImage(src, mdFile, where) {
  const cands = [path.resolve(path.dirname(mdFile), src), path.join(DOCS, "assets", "images", path.basename(src))];
  const abs = cands.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
  const mime = MIME[path.extname(src).toLowerCase()];
  if (!abs || !mime) {
    err(`${where}: 画像を解決できません: ${src}`);
    return null;
  }
  if (!abs.startsWith(path.join(DOCS, "assets") + path.sep)) {
    err(`${where}: 画像は docs/assets/ に置いてください: ${src}`);
    return null;
  }
  const id = imageId(abs);
  if (!images.has(id)) images.set(id, `data:${mime};base64,${fs.readFileSync(abs).toString("base64")}`);
  return id;
}

// ---- marked の設定 ------------------------------------------------------
const HEAD_ID = /\s*\{#([A-Za-z0-9_-]+)\}\s*$/;
const slugify = (s) =>
  s
    .replace(/[`*_]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, "")
    .replace(/\s/g, "-");

let cur = null; // いま変換中のページ { key, file, toc, ids }

const marked = new Marked({ gfm: true });
marked.use({
  walkTokens(token) {
    if (token.type !== "heading") return;
    const m = token.text.match(HEAD_ID);
    if (!m) return;
    token.explicitId = m[1];
    token.text = token.text.replace(HEAD_ID, "");
    const last = token.tokens[token.tokens.length - 1];
    if (last && last.type === "text" && HEAD_ID.test(last.text)) {
      last.text = last.text.replace(HEAD_ID, "");
      last.raw = last.raw.replace(HEAD_ID, "");
    } else {
      err(`${rel(cur.file)}: 見出しの {#id} を解釈できません: ${token.raw.trim()}`);
    }
  },
  renderer: {
    heading(token) {
      const inner = this.parser.parseInline(token.tokens);
      let id = token.explicitId;
      if (id) {
        if (cur.ids.has(id)) err(`${rel(cur.file)}: 見出し id が重複しています: ${id}`);
      } else {
        const base = slugify(token.text) || "section";
        id = base;
        for (let n = 1; cur.ids.has(id); n++) id = `${base}-${n}`;
      }
      cur.ids.add(id);
      if (token.depth === 2 || token.depth === 3) cur.toc.push({ id, depth: token.depth, html: inner });
      return `<h${token.depth} id="${id}">${inner}</h${token.depth}>\n`;
    },
    image({ href, title, text }) {
      if (/\.svg$/i.test(href)) {
        const abs = path.resolve(path.dirname(cur.file), href);
        if (!abs.startsWith(path.join(DOCS, "assets", "diagrams") + path.sep) || !fs.existsSync(abs)) {
          err(`${rel(cur.file)}: 図(SVG)を解決できません: ${href}`);
          return "";
        }
        const svg = read(abs).replace(/<\?xml[^>]*\?>\s*/, "").replace(/<!--[\s\S]*?-->/g, "").trim();
        const cap = title ? `<figcaption>${title}</figcaption>` : "";
        return `<figure class="shot dia">${svg}${cap}</figure>`;
      }
      const t = title ? ` title="${title}"` : "";
      return `<img src="${href}" alt="${text}"${t}>`;
    },
  },
});

// ---- 変換後の HTML の後処理(リンク・画像) -------------------------------
function githubUrl(abs) {
  const r = rel(abs);
  const isDir = fs.statSync(abs).isDirectory();
  return `${REPO}/${isDir ? "tree" : "blob"}/main/${r}`;
}
const safeDecode = (x) => {
  try {
    return decodeURIComponent(x);
  } catch {
    return x;
  }
};
const pendingAnchors = []; // 後で検証する { from, key, frag }

function rewriteLinks(html, page) {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/g, (all, attrs, inner) => {
    const hm = attrs.match(/\bhref="([^"]*)"/);
    if (!hm) return all;
    const href = hm[1].replace(/&amp;/g, "&");
    const rest = attrs.replace(hm[0], "").trim();
    const mk = (h, extra = "") => `<a href="${h.replace(/&/g, "&amp;")}"${rest ? " " + rest : ""}${extra}>${inner}</a>`;
    if (/^(https?:|mailto:)/i.test(href)) return mk(href, ' target="_blank" rel="noopener"');
    if (href.startsWith("#")) {
      const frag = safeDecode(href.slice(1));
      if (frag) pendingAnchors.push({ from: page.key, key: page.key, frag });
      return mk(`#/${page.key}${frag ? "~" + frag : ""}`);
    }
    const [pathPart, rawFrag = ""] = href.split("#");
    const frag = safeDecode(rawFrag);
    const abs = path.resolve(path.dirname(page.file), decodeURI(pathPart));
    if (abs.endsWith(".md") && abs.startsWith(MD_DIR + path.sep)) {
      const key = path.relative(MD_DIR, abs).split(path.sep).join("/").replace(/\.md$/, "");
      if (!sitemapKeys.has(key)) {
        err(`${rel(page.file)}: リンク先のページが sitemap にありません: ${href}`);
        return all;
      }
      if (frag) pendingAnchors.push({ from: page.key, key, frag });
      return mk(`#/${key}${frag ? "~" + frag : ""}`);
    }
    if (!abs.startsWith(ROOT + path.sep) || !fs.existsSync(abs)) {
      if (abs.startsWith(DOCS + path.sep)) err(`${rel(page.file)}: リンク先がありません: ${href}`);
      else warn(`${rel(page.file)}: リポジトリ内にないリンクを文字だけにしました: ${href}`);
      return inner;
    }
    if (!REPO) return inner;
    return mk(githubUrl(abs), ' target="_blank" rel="noopener"');
  });
}
function rewriteImages(html, page) {
  return html.replace(/<img\b([^>]*)>/g, (all, attrs) => {
    const sm = attrs.match(/\bsrc="([^"]*)"/);
    if (!sm || /^(data:|https?:)/i.test(sm[1])) return all;
    const id = registerImage(decodeURI(sm[1]), page.file, rel(page.file));
    return id ? `<img${attrs.replace(sm[0], `data-img="${id}"`)}>` : all;
  });
}

// ---- 全ページの変換 -----------------------------------------------------
const pages = {};
for (const sec of sitemap.sections) {
  for (const pg of sec.pages) {
    const file = path.join(MD_DIR, `${pg.path}.md`);
    if (!fs.existsSync(file)) continue;
    cur = { key: pg.path, file, toc: [], ids: new Set() };
    let html = marked.parse(read(file));
    html = html.replace(/<p>\s*(<figure class="shot dia">[\s\S]*?<\/figure>)\s*<\/p>/g, "$1");
    html = html.replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, "</table></div>");
    // raw HTML 内の id も、アンカー検証の対象にする
    for (const m of html.matchAll(/\bid="([^"]+)"/g)) cur.ids.add(m[1]);
    const plain = html.replace(/<pre>[\s\S]*?<\/pre>/g, "").replace(/<code>[\s\S]*?<\/code>/g, "").replace(/<[^>]+>/g, "");
    if (plain.includes("**")) err(`${rel(file)}: 強調 ** が変換されていません(日本語の直前直後だと効かないことがあります。<strong>…</strong> を使ってください): ${plain.match(/.{0,20}\*\*.{0,20}/)[0]}`);
    html = rewriteLinks(html, cur);
    html = rewriteImages(html, cur);
    pages[pg.path] = { title: pg.title, html, toc: cur.toc };
    cur.html = html;
    pages[pg.path]._ids = cur.ids;
  }
}
for (const a of pendingAnchors) {
  const target = pages[a.key];
  if (target && !target._ids.has(a.frag)) err(`docs/markdown/${a.from}.md: リンク先の見出し/id がありません: ${a.key}#${a.frag}`);
}
for (const p of Object.values(pages)) delete p._ids;

// ---- データと HTML の組み立て ------------------------------------------
const data = {
  title: sitemap.title,
  sections: sitemap.sections.map((s) => ({ title: s.title, pages: s.pages.map((p) => ({ path: p.path, title: p.title })) })),
  pages,
  images: Object.fromEntries([...images.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))),
};
// <script> の中に置くので、`</script` や `<!--` を作らないよう `<` を JSON の < にする
const json = JSON.stringify(data).replace(/<(?=[/!])/g, "\\u003c");

const tpl = read(path.join(HTML_DIR, "index.html"));
const css = read(path.join(HTML_DIR, "style.css"));
const js = read(path.join(HTML_DIR, "app.js"));
for (const [name, body, bad] of [["style.css", css, /<\/style/i], ["app.js", js, /<\/script|<!--/i]]) {
  if (bad.test(body)) err(`docs/html/${name}: 埋め込めない文字列(</style, </script, <!--)を含みます`);
}
for (const ph of ["<!--CSS-->", "<!--DATA-->", "<!--JS-->"]) {
  if (!tpl.includes(ph)) err(`docs/html/index.html に ${ph} がありません`);
}
const out = tpl
  .replace("<!--CSS-->", () => css.trim())
  .replace("<!--DATA-->", () => json)
  .replace("<!--JS-->", () => js.trim());
// 外部参照が無いこと(外へ出るのは本文中の <a href="https://..."> だけ)
const ext = out.match(/<(?:script|link|img|iframe|source)\b[^>]*\b(?:src|href)="(?:https?:)?\/\/[^"]*"/i);
if (ext) err(`外部ファイルへの参照が残っています: ${ext[0].slice(0, 120)}`);

for (const f of ["Code.gs", "appsscript.json"]) {
  if (!fs.existsSync(path.join(GAS_DIR, f))) err(`docs/gas/${f} がありません`);
}

// ---- 出力 ---------------------------------------------------------------
for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\n${errors.length} 件のエラーがあります`);
  process.exit(1);
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const summary = `ページ ${Object.keys(pages).length} / 画像 ${images.size} / ${kb(Buffer.byteLength(out))}`;
if (CHECK) {
  const cur0 = fs.existsSync(OUT) ? read(OUT) : null;
  if (cur0 !== out) {
    console.error("docs/gas/index.html が docs/markdown・docs/html と合っていません。`npm run docs:build` を実行して commit してください。");
    process.exit(1);
  }
  console.log(`docs:check OK (${summary})`);
} else {
  fs.mkdirSync(GAS_DIR, { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log(`docs:build OK -> ${rel(OUT)} (${summary})`);
}
