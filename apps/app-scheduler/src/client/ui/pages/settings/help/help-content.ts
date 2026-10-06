// 設定画面ヘルプの文言。仕様(キー数・タイムアウト等)を変えたらここも更新すること。
// 数値の出典: ui/composables/keyboard-shortcut-listener.ts / settings/keyboard-shortcut/composables/useKeyCapture.ts

export const SETTINGS_TAB_HINTS: Record<string, string> = {
    events: '実行する内容(音楽・画像・スライドショー・画面遷移など)を作る場所です。作っただけでは動かず、「ショートカット」に割り当てるか「実行」で動かします。',
    assets: '画像・動画・音声などの素材を登録する場所です。イベントから選んで使います。',
    members: 'クイズ等で使う参加者の名簿です。',
    'keyboard-shortcuts': 'キー操作とイベントを結びつける場所です。実行画面を別タブで開いておくと、キーを押した時にそこで再生されます。',
};

export const HELP_FLOW = [
    'アセット: 画像・音声などの素材を登録する',
    'イベント: 素材を使って「何を流すか」を作る',
    'ショートカット: キー操作にイベントを割り当てる',
    '「実行画面を開く」で投影用の画面を別タブ(または別ウィンドウ)に開いておく',
    '設定画面(またはクイズ画面)でキーを押すと、実行画面に反映される',
];

export const HELP_SHORTCUT_RULES = [
    '1つのショートカットは最大3キーまで(例: Ctrl → 1)。押した順番も区別されます。',
    'キー入力欄をクリックしてキーを押すと記録されます。1.5秒止めると入力が確定します。',
    'Esc は予約済みで、押すと再生中の音声をすべて停止します(割り当て不可)。',
    '文字入力欄にカーソルがある間はショートカットは反応しません。',
    '「ショートカットを有効にする」を外すと、Esc以外は動きません。',
    '別のショートカットの先頭と同じキー列がある場合、確定まで0.4秒待ちます。',
    '実行画面を開いていないと、キーを押しても何も表示されません。',
];

export const HELP_QUIZ_NOTES = [
    'クイズ画面は「画面遷移」イベントで切り替えられます。遷移URLに /quiz/クイズID/intro のように入力します。',
    'クイズ進行中は Enter キーで次の画面(イントロ → QR → 出題 → 解答 → 結果)に進みます。',
    'クイズの作成・メンバー管理は ホーム →「Quiz Game」(クイズ管理)から行います。',
];

export const TRANSITION_URL_PRESETS = [
    { value: '/home', label: 'ホーム' },
    { value: '/quiz-admin', label: 'クイズ管理' },
    { value: '/jackpot-home', label: 'Jackpot ホーム' },
    { value: '/card-home', label: 'Card ホーム' },
];
