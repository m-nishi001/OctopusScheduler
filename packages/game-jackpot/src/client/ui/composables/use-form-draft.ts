import { computed, ref, shallowRef } from "vue";

/** 値の中身が同じか(設定値は JSON にできる値だけなので、JSON で比べる)。 */
const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** 参照を共有しない写し(配列・オブジェクトの編集が、読み込んだ値を壊さないように)。 */
const clone = <V>(v: V): V => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as V));

/**
 * 設定フォームの「サーバーの値」と「入力の途中」を分けて持つ、画面に依存しないモデル。
 *
 * - `base`: サーバーから読み込んだ値。読み込み・同期はここだけを更新する。
 * - `draft`: 利用者が触った項目だけ。読み込みや同期は触れない(入力を上書きできない)。
 * - 表示する値は `draft[項目] ?? base[項目]`(`view`)。
 * - 未保存の変更があるか(`dirty`)は、`draft` が空でないかから導く。別のフラグは持たない。
 * - 保存は `base` の読み込みが終わるのを待ち、`base` に `draft` を重ねた値を送る。
 *   保存したあとは、保存した値のままの項目だけ `draft` から消す(保存中に入力した項目は残る)。
 *
 * 入力欄は読み込み前から操作できる。読み込み前の入力も `draft` に残り、読み込み後も消えない。
 * 値は項目(最上位のキー)単位で重ねる。配列・オブジェクトの項目は {@link edit} で写しを編集する。
 */
export function useFormDraft<T extends object>(empty: T, fetch: () => Promise<T>) {
  const base = shallowRef<T>(clone(empty));
  const draft = shallowRef<Partial<T>>({});
  /** 最初の読み込みが終わったか(成功 `loaded` / 失敗 `failed`)。 */
  const status = ref<"loading" | "loaded" | "failed">("loading");

  let seq = 0;
  let settleFirst: () => void = () => {};
  const firstSettled = new Promise<void>((resolve) => { settleFirst = resolve; });

  /** サーバーの値を読み直して `base` にする。`draft` には触れない。遅れて返った古い読み込みは捨てる。 */
  async function load(): Promise<void> {
    const mine = ++seq;
    try {
      const next = await fetch();
      if (mine === seq) {
        base.value = next;
        status.value = "loaded";
      }
    } catch (error) {
      console.error("Failed to load form:", error);
      if (mine === seq && status.value === "loading") status.value = "failed";
    } finally {
      if (mine === seq) settleFirst();
    }
  }

  /** 表示する値。 */
  const view = computed<Readonly<T>>(() => ({ ...base.value, ...draft.value }));

  const dirty = computed(() => Object.keys(draft.value).length > 0);

  function set<K extends keyof T>(key: K, value: T[K]): void {
    draft.value = { ...draft.value, [key]: value };
  }

  /** 配列・オブジェクトの項目を、いまの値の写しに対して編集する。 */
  function edit<K extends keyof T>(key: K, mutate: (copy: T[K]) => void): void {
    const copy = clone(view.value[key]);
    mutate(copy);
    set(key, copy);
  }

  /** 入力の途中をすべて捨てる。 */
  function discard(): void {
    draft.value = {};
  }

  /**
   * 保存する。`base` の読み込みを待ち(読み込めていなければ保存しない)、`base` に `draft` を重ねた値を `send` に渡す。
   * 成功したら読み直し、保存した値のままの項目だけ `draft` から消す。
   */
  async function save(send: (snapshot: T) => Promise<void>): Promise<void> {
    await firstSettled;
    if (status.value !== "loaded") throw new Error("設定を読み込めていないため保存できません");
    const snapshot: T = clone({ ...base.value, ...draft.value });
    await send(snapshot);
    const next = { ...draft.value };
    for (const key of Object.keys(next) as (keyof T)[]) {
      if (sameValue(next[key], snapshot[key])) delete next[key];
    }
    draft.value = next;
    await load();
  }

  return { view, dirty, status, load, set, edit, discard, save };
}
