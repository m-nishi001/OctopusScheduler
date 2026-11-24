import type { Router } from "vue-router";
import type { SoundSystem } from "@octopus/client-common/audio/sound-system";

const QUIZ_SCREEN = /\/quiz\/[^/]+\/(intro|play|answer|result)(\/preview)?\/?$/;

/** クイズの画面(イントロ・出題・正解・ランキング。プレビューを含む)のパスか。 */
export function isQuizScreenPath(path: string): boolean {
  return QUIZ_SCREEN.test(path.split(/[?#]/)[0]);
}

/**
 * クイズの画面が切り替わるとき(行き先か元がクイズの画面のとき)、`screen` の曲をすべて止める。
 * クイズは、画面をまたいで同じ曲を流し続けない(各画面が、準備ができてから自分の曲を流す)ので、行き先の曲名を調べる必要がなく、
 * ジャックポットのガード(`installScreenBgmGuard`)のように設定を読まない。
 */
export function installQuizBgmGuard(router: Router, sound: Pick<SoundSystem, "screen">): () => void {
  return router.beforeResolve((to, from) => {
    if (isQuizScreenPath(to.path) || isQuizScreenPath(from.path)) void sound.screen.stopUnless(null);
  });
}
