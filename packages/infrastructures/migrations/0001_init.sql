-- ICache(D1)用のキャッシュテーブル。
CREATE TABLE IF NOT EXISTS cache_entries (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- ILock(D1)用の排他制御テーブル。行の存在自体がロック取得状態を表し、
-- expires_at を過ぎた行は次の取得者が上書き(奪取)できる。
CREATE TABLE IF NOT EXISTS locks (
  key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
