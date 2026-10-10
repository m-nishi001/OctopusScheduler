-- ILock(D1)の所有者トークン。期限切れ後に他者が奪取したロックを、元の保持者が
-- finally で消してしまう事故を防ぐため、解放時は owner の一致を条件にする。
ALTER TABLE locks ADD COLUMN owner TEXT NOT NULL DEFAULT '';
