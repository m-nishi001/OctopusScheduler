<template>
    <section v-if="inputs.inputs.value.length > 0" class="pp-inputs" aria-label="受付中の操作" data-testid="client-inputs">
        <button v-for="key in inputs.inputs.value" :key="key" type="button" class="pp-button pp-inputs__button"
            :disabled="inputs.busyKey.value !== null || inputs.waitingKeys.value.includes(key)" data-testid="client-input"
            :data-waiting="inputs.waitingKeys.value.includes(key) ? 'true' : undefined" @click="inputs.send(key)">
            {{ inputs.waitingKeys.value.includes(key) ? '止めています…' : clientInputLabel(key) }}
        </button>
        <p v-if="inputs.message.value" class="pp-muted" role="status" data-testid="client-input-message">{{ inputs.message.value }}</p>
    </section>
</template>

<script setup lang="ts">
import { clientInputLabel } from '../../model/activity';
import { useClientInputs } from '../../model/use-client-inputs';
import { usePortalContext } from '../../model/use-portal-session';

const inputs = useClientInputs(usePortalContext());
</script>

<style scoped>
.pp-inputs {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pp-inputs__button {
    min-height: 72px;
    font-size: 1.3rem;
}
</style>
