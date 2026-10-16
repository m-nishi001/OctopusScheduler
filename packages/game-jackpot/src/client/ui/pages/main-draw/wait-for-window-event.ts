/**
 * window のイベントを待つ。来なくても fallbackMs で先へ進む(演出の完了通知が来ない場合に止まらないため)。
 * afterListening は、リスナーを登録した直後に呼ぶ(登録前に通知が飛ぶ競合を避けるため、表示の切り替えはここで行う)。
 */
export function waitForWindowEvent(
  name: string,
  fallbackMs: number,
  afterListening?: () => void
): Promise<void> {
  return new Promise<void>((resolve) => {
    const finish = () => {
      window.removeEventListener(name, finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, fallbackMs);
    window.addEventListener(name, finish);
    afterListening?.();
  });
}
