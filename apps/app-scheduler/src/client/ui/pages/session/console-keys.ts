/**
 * コントロール画面のキー操作。ホスト画面を見ている操作者が、Enter で主ボタン、Backspace で「前へ」を押せるようにする。
 * 判定を純関数にして、押してよい場面/いけない場面をテストで固定する。
 */
import type { MainAction } from './console-guidance';

export interface KeyLike {
    key: string;
    repeat: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    /** イベントの発生元(フォーカスのある要素)。 */
    target: EventTarget | null;
}

export interface KeyContext {
    /** 主ボタンの動作。主ボタンが無い(押せる操作が無い)ときは null。 */
    mainAction: MainAction | null;
    /** 「前へ」が使えるか(説明のスライドの途中)。 */
    canBack: boolean;
    /** 送信中、または接続できていないとき。 */
    blocked: boolean;
}

export type ConsoleKeyCommand = 'main' | 'back';

/** Enter で押すと誤操作の被害が大きいもの(回答の締切)は、クリックだけにする。 */
const ENTER_EXCLUDED: ReadonlyArray<MainAction['kind']> = ['closeAnswers'];

/** Enter を主ボタンの代わりに使える動作か(ラベルに「Enter」を添える判断にも使う)。 */
export function enterTriggers(action: MainAction | null): boolean {
    return !!action && !ENTER_EXCLUDED.includes(action.kind);
}

/** フォーカスが、自分でEnterを処理する要素(入力欄・ボタン・リンクなど)にあるか。 */
function isInteractive(target: EventTarget | null): boolean {
    const el = target as { tagName?: string; isContentEditable?: boolean } | null;
    if (!el || typeof el.tagName !== 'string') return false;
    if (el.isContentEditable) return true;
    return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY'].includes(el.tagName.toUpperCase());
}

/**
 * 管理コンソールのキー操作を、主ボタン(Enter)か「前へ」(Backspace)に対応づける。修飾キー付き・押しっぱなし・入力欄やボタンにフォーカスがあるとき・操作を受け付けられないときは null。
 */
export function resolveConsoleKey(e: KeyLike, ctx: KeyContext): ConsoleKeyCommand | null {
    if (e.key !== 'Enter' && e.key !== 'Backspace') return null;
    if (e.repeat) return null;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return null;
    if (isInteractive(e.target)) return null;
    if (ctx.blocked) return null;
    if (e.key === 'Backspace') return ctx.canBack ? 'back' : null;
    return enterTriggers(ctx.mainAction) ? 'main' : null;
}
