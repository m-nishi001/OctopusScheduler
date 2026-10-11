<template>
    <section v-if="jackpot && (jackpot.member || jackpot.prize)" class="pp-card pp-jackpot" data-testid="winner" aria-live="polite">
        <p class="pp-jackpot__label">ジャックポット</p>
        <p v-if="jackpot.member" class="pp-jackpot__line">当選者: <strong>{{ jackpot.member }}</strong></p>
        <p v-if="jackpot.prize" class="pp-jackpot__line">賞品: <strong>{{ jackpot.prize }}</strong></p>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { readJackpotView } from '../../model/activity';
import { usePortalContext } from '../../model/use-portal-session';

const session = usePortalContext();
/** 当選者・賞品は、ホストの停止演出が終わるまで公開されない（先にネタバレしない）。 */
const jackpot = computed(() => readJackpotView(session.state.value.roomState?.data));
</script>

<style scoped>
.pp-jackpot {
    border-color: var(--pp-gold);
    box-shadow: 0 0 28px rgba(255, 213, 74, 0.28);
    background: linear-gradient(160deg, #4a1220, var(--pp-surface));
}

.pp-jackpot__label {
    margin: 0 0 6px;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--pp-gold);
}

.pp-jackpot__line {
    margin: 4px 0;
    font-size: 1.25rem;
}

.pp-jackpot__line strong {
    color: var(--pp-gold-light);
    font-size: 1.5rem;
}
</style>
