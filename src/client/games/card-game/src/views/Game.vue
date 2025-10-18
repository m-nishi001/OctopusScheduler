<template>
    <div class="page">
        <h1>Card Game — Game</h1>
        <div>Service name: {{ name }}</div>
        <button @click="callService">Call TestService.GetName()</button>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { GasFunctionService } from '../../../../packages/common-lib/src/google-apps-script/gas-script-service';

export default defineComponent({
    setup() {
        const name = ref<string>('');
        const service = GasFunctionService.create('callCardGameApi');

        async function callService() {
            if (!service) return;
            try {
                const res = await service.call<{ name: string }>('TestService.GetName');
                name.value = res.name;
            } catch (e: any) {
                name.value = `ERROR: ${e?.message ?? String(e)}`;
            }
        }

        return { name, callService };
    }
});
</script>
