/**
 * 素材(画像・音声)の索引の純粋関数。素材は「同じファイル名 = 同じ素材」として、モジュールの中で1つだけ持つ。
 * 索引(名前 → ハッシュ)は状態として持たず、項目が参照している名前から保存のたびに作り直す。
 */

/**
 * 項目が参照している名前だけを抜き出して、索引(名前 → ハッシュ)を作る。使われなくなった素材は自然に外れる。
 * `known` に無い名前を参照していれば例外(参照切れのまま保存しない)。
 */
export function deriveMedia<E>(
  items: readonly E[],
  refsOf: (e: E) => Iterable<string>,
  known: ReadonlyMap<string, string>
): Record<string, string> {
  const media: Record<string, string> = {};
  for (const item of items) {
    for (const name of refsOf(item)) {
      if (!name || name in media) continue;
      const hash = known.get(name);
      if (hash === undefined) throw new Error(`素材「${name}」が見つかりません`);
      media[name] = hash;
    }
  }
  return media;
}

/** 取り込む素材と、いまの索引を比べる: 新しい名前 / 同じ名前で中身が違う(差し替え) / 同じ中身。 */
export function diffMedia(
  stored: Readonly<Record<string, string>>,
  incoming: ReadonlyMap<string, string>
): { added: string[]; replaced: string[]; same: string[] } {
  const out = { added: [] as string[], replaced: [] as string[], same: [] as string[] };
  for (const [name, hash] of incoming) {
    if (!(name in stored)) out.added.push(name);
    else if (stored[name] !== hash) out.replaced.push(name);
    else out.same.push(name);
  }
  return out;
}
