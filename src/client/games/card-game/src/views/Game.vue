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
            service
                .createCall<{ name: string }>('TestService.GetName')
                .withSuccessed((res: { name: string }) => { name.value = res.name; })
                .withFailuered((msg: string) => { name.value = `ERROR: ${msg}`; })
                .invoke();
        }

        return { name, callService };
    }
});
</script>
