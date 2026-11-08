# docs/ の案内

取扱説明書と開発者向けドキュメントを、Markdown で書きます。`npm run docs:build` で、GAS にそのまま置ける1ファイルの HTML(`docs/gas/index.html`)を作ります。

## 構成

```
docs/
  markdown/
    sitemap.json     ナビの唯一の定義(セクション・ページの順序とタイトル)
    manual/*.md      取扱説明書(管理者・参加者向け)と「しくみ」の図解
    dev/*.md         開発者向け(dev/index.md が目次)
  assets/
    images/*.webp    取扱説明書の画面写真
    diagrams/*.svg   図(しくみの図解。色は各 SVG に埋め込み、Dark 固定)
  html/              ビューアの枠(本文なし): index.html / style.css / app.js
  _config.yml, _layouts/  GitHub Pages(Jekyll)用。html/style.css を読み込み Dark で表示
  gas/               生成物(commit する): index.html / Code.gs / appsscript.json
scripts/build-docs.mjs   ビルド本体
```

## Markdown の書き方

- 見出しの id は `## タイトル {#some-id}` と書く(ページの先頭は `# タイトル {#id}`)。付けなくても、GitHub と同じ規則で自動の id がつく。
- ページへのリンクは、相対パスの `.md` で書く。見出しへは `#id` を付ける。例: `[x](02-prep-people.md#id)` / `[x](../dev/usage.md)`。ビルドが画面内のリンクに直す。GitHub でもそのまま読める。
- 画面写真は `![説明](../../assets/images/x.webp)`。同じ画像は1回だけ埋め込まれる。
- 図は `![説明](../../assets/diagrams/x.svg "図の下の説明文")`。ビルドが `<svg>` をその場に展開する。
- 画面の番号つき写真などは、生の HTML ブロック(`<figure class="shot">…</figure>`、`<p class="lead">`、`<div class="note">` ほか。クラスは `html/style.css` 参照)をそのまま書く。HTML の中は Markdown にならない。ブロックの途中に空行を入れない。
- 日本語の直前直後では `**強調**` が効かないことがある。そのときは `<strong>…</strong>` を使う(ビルドが検出してエラーにする)。
- リポジトリ内のソースへのリンク(例 `../../packages/...`)は、GitHub の URL に直る。
- ` ```mermaid ` はふつうのコードブロックとして表示される。
- 新しいページは、`.md` を置いて `sitemap.json` に足す。どちらかだけだとビルドが失敗する。

## ビルド

```
npm run docs:build   # docs/gas/index.html を作り直す
npm run docs:check   # 作り直した結果が commit 済みの docs/gas/index.html と同じか確かめる(CI で実行)
```

次のどれかがあると、ビルドは失敗します(exit 1): 解決できないリンク・画像・見出し id、sitemap にないページ、ファイルのない sitemap 項目。出力は決定的で、`docs/markdown` や `docs/html` を直したら `docs:build` して `docs/gas/index.html` も commit します(忘れると CI の `docs:check` が落ちます)。

## GAS で公開する

`docs/gas/index.html` は、CSS・JS・全ページの本文・画像・図をすべて含む自己完結の1ファイルです(外部の読み込みはありません。約3MB)。

1. <https://script.google.com> で新しいプロジェクトを作る(アプリ本体のプロジェクトとは別にする)。
2. `Code.gs` の中身を、`docs/gas/Code.gs` に置き換える。
3. HTML ファイルを追加して名前を `index` にし、`docs/gas/index.html` の中身をすべて貼る。
4. (任意)プロジェクトの設定で「appsscript.json をエディタで表示」を有効にし、`docs/gas/appsscript.json` の内容を貼る。clasp を使うなら、3ファイルをそのまま push する。
5. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」。実行ユーザーは「自分」、アクセスできるユーザーは公開したい範囲(誰でも / 組織内)にしてデプロイする。
6. 発行された URL を共有する。更新したときは、貼り直して「デプロイを管理」→ 新しいバージョンで更新する。

ページの移動は `#/manual/04-day` のようなハッシュで行います。GAS のページは iframe の中で表示されるため、共有する URL にハッシュは付けられません(開いたあとのページ移動は動きます)。

目次は [markdown/dev/index.md](markdown/dev/index.md) にあります。
