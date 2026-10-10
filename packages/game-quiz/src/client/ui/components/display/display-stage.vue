<template>
    <div class="display-stage">
        <header class="stage-header">
            <h1 v-if="$slots.title" class="stage-title"><slot name="title" /></h1>
        </header>
        <main class="stage-body">
            <slot />
        </main>
        <footer class="stage-footer">
            <p v-if="$slots.hint" class="stage-hint"><slot name="hint" /></p>
        </footer>
    </div>
</template>

<style scoped>
/*
 * クイズ表示画面(intro / qr / answer)の共通枠。
 * 親(execute-view)の `.execute-content > * { display:block }` に負けないよう、
 * ルートのセレクタを重ねて詳細度を上げている。
 * サイズはすべて vmin / clamp 基準なので、横長・縦長・4Kのいずれでも収まる。
 */
.display-stage.display-stage {
    --stage-gold: #ffd54a;
    --stage-card: rgba(17, 24, 39, 0.65);
    --stage-muted: rgba(255, 255, 255, 0.85);

    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    padding: clamp(16px, 3vmin, 48px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
    background: radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0f172a 45%, #0b1220 100%);
    color: #fff;
    text-align: center;
}

.stage-title {
    margin: 0;
    padding-bottom: clamp(8px, 2vmin, 28px);
    font-size: clamp(1.75rem, 5.5vmin, 4.5rem);
    font-weight: 800;
    line-height: 1.2;
    background: linear-gradient(180deg, #fff3b0 0%, var(--stage-gold) 50%, #f59e0b 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: none;
    filter: drop-shadow(0 2px 8px rgba(255, 213, 74, 0.35));
}

.stage-body {
    min-height: 0;
    min-width: 0;
    /* 子が cqw / cqh で「本文領域に収まる最大サイズ」を指定できるようにする。 */
    container-type: size;
    display: grid;
    place-items: center;
}

.stage-hint {
    margin: 0;
    padding-top: clamp(8px, 2vmin, 28px);
    font-size: clamp(1rem, 2.4vmin, 1.75rem);
    color: var(--stage-muted);
}

@media (prefers-reduced-motion: reduce) {
    .display-stage * {
        animation: none !important;
    }
}
</style>
