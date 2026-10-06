# @octopus/ui-kit

設定画面など共通UIの部品集。ソースのみ配布(`main: ./src/index.ts`)。

## 規約
- 1部品=1ディレクトリ(`components/<name>/<name>.vue` + `.spec.ts`)。
- 色・フォント・余白・z-index は `src/tokens/tokens.css` の `--ui-*` のみ参照する(値の直書き禁止)。
- ブレークポイントは 640px のみ。
- 部品間の依存は一方向(上位部品 → UiButton/UiIcon)。循環させない。
- モジュール固有のロジックは入れない。

## 部品
| 部品 | 用途 |
|---|---|
| PageShell | 画面枠(タイトル/タブ/サブタブ/フッター) |
| DataTable | 一覧(640px以下でカード表示) |
| UiButton | primary/secondary/danger/ghost、sm/md、loading、icon |
| UiIcon | 自前SVGアイコン(`components/ui-icon/icons.ts` に追加) |
| FormGrid / UiField | 2カラム自動折返しのフォーム |
| HeaderActions | ヘッダー右側の標準操作(バックアップ/ホーム) |
