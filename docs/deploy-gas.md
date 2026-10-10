# GAS へのデプロイ

> **要点**
> - 事前に Drive フォルダを 1 つ作り、そのフォルダ ID をスクリプト プロパティ `OCTOPUS_ROOT_FOLDER_ID` に登録する
> - デプロイは `npm run deploy:gas`
> - 参加者がスマホで入る運用では、デプロイ時の「アクセスできるユーザー」を変更する
> - 初回管理者は [authentication.md](authentication.md) の手順で作る

## 手順

1. Google Drive に保存先用のフォルダを 1 つ作り、フォルダ ID（URL の `folders/` 以降）を控える
2. `.clasp.example.json` を `.clasp.json` にコピーし、`scriptId` を設定する
3. Apps Script の「プロジェクトの設定 → スクリプト プロパティ」に登録する

   | キー | 値 | 必須 |
   | --- | --- | --- |
   | `OCTOPUS_ROOT_FOLDER_ID` | 手順 1 のフォルダ ID | ✓ |
   | `OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD` | 初回管理者のパスワード（[詳細](authentication.md)） | 初回のみ |

4. `npm run deploy:gas`（ビルドして `clasp push` します）

## 参加者に使ってもらう場合

`appsscript.json` の `webapp.access` は既定で `MYSELF` です。このままだと参加者（別アカウントのスマホ）がポータルを開けません。デプロイ時に「アクセスできるユーザー」を、運用に合わせて「全員」や「Google アカウントを持つ全員」に設定してください。リポジトリの既定値は変えていません。

## 詳細

### 保存先

- アセットや JSON は `<module>/<kind>/<name>` 形式のパスで、ルートフォルダ配下のサブフォルダに保存されます（例: `octopus-scheduler/assets/1_a.png`）。
- サブフォルダは初回書き込み時に自動作成されます。作成はスクリプトロックで直列化し、同名フォルダの重複を防ぎます。
- スライドショーイベントの「フォルダ名」は `octopus-scheduler/assets/<フォルダ名>` を指します。画像はそのフォルダに置きます。

### トラブルシュート

| 症状 | 原因と対処 |
| --- | --- |
| `StorageNotConfiguredError` | `OCTOPUS_ROOT_FOLDER_ID` が未設定、またはアクセスできないフォルダ。ID と共有権限を確認 |
| 同名フォルダが複数ある | 競合の名残。作成日時が最古のフォルダが使われるので、他のフォルダのファイルをそこへ移し、空のフォルダを削除 |

### 制約

セッション機能は GAS ではポーリングで動き、同時参加は約 30 人が目安です。数百人規模なら [Cloudflare](deploy-cloudflare.md) を使ってください（[比較](session-hub.md#3-実行基盤の違い)）。
