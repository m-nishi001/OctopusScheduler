# 開発環境を作る(新しい PC・コンテナの作り直し)

> **要点**
> - ツール(Node 22・gh・AWS CLI・Claude Code・Playwright の chromium・`npm ci`)は `.devcontainer` が自動で入れる
> - 機密情報(ログイン・キー)は Git に置けないので、**毎回ログインし直す**。足りないものは `npm run doctor` が教える
> - Claude Code のメモリ(`~/.claude`)だけはホストのフォルダに置き、コンテナを作り直しても、PC を替えても(フォルダを移せば)残す

## 初回の手順

1. Docker Desktop と VS Code(拡張機能 Dev Containers)を入れる
2. ホストにメモリ用のフォルダを作る(無いとコンテナが起動しない):
   `%USERPROFILE%\.octopus-dev\claude`(PC を替えるときは、旧 PC のこのフォルダを新 PC にコピーする。OneDrive などでバックアップしてもよい)
3. リポジトリを clone して VS Code で開き、**Reopen in Container**。初回は `npm ci` と chromium の導入まで自動で走る
4. コンテナのターミナルで `npm run doctor` を実行し、✘ の下の → に出た手順でログインする

## ログインするもの

| 対象 | コマンド | 保存先 |
| --- | --- | --- |
| GitHub | `gh auth login` | ボリューム `octopus-dev-gh` |
| Cloudflare | `npx wrangler login --callback-host=0.0.0.0`([詳細](deploy-cloudflare.md#docker--コンテナ内で-wrangler-login-が完了しない)) | ボリューム `octopus-dev-wrangler` |
| R2 の S3 キー | 下記 | ボリューム `octopus-dev-aws` |
| clasp(GAS) | `npx clasp login --no-localhost` | コンテナ内(作り直すと再ログイン) |
| Claude Code | `claude` で初回ログイン | ホストのメモリ用フォルダ |

ボリュームはコンテナを作り直しても残るが、PC が壊れると消える。その場合は上の表のとおりログインし直す。

## R2 の S3 キー(バケットを空にする用)

R2 のバケットは空でないと削除できず、wrangler には一覧・一括削除が無い。`staging:down` / `teardown:cloudflare` は、S3 互換 API で空にするために AWS CLI の profile `r2` を使う。

1. Cloudflare ダッシュボード → R2 → API → **Manage API tokens** で、対象バケットに「Object Read & Write」権限のトークンを作る。表示される Access Key ID / Secret Access Key と、アカウントの S3 エンドポイントを控える(Secret は再表示できない)
2. コンテナ内で設定する(値は自分のもの。**コミットしない・チャットや Issue に貼らない**):

```bash
aws configure --profile r2          # Access Key ID / Secret Access Key を入力、Region は auto
aws configure set endpoint_url https://<アカウントID>.r2.cloudflarestorage.com --profile r2
aws configure set request_checksum_calculation when_required --profile r2
aws configure set response_checksum_validation when_required --profile r2
```

3. `aws s3 ls --profile r2` でバケットの一覧が出れば成功

## メモリ用フォルダについて

`~/.claude`(メモリ・設定・Claude Code のログイン)はホストの `%USERPROFILE%\.octopus-dev\claude` に置かれ、エクスプローラーから普通のフォルダとして見える。ログイン情報も入るので、他人に渡したり公開リポジトリに入れたりしない。
