<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
import { onMounted } from 'vue';

import { GasFunctionService } from '/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts'

onMounted(async () => {
  const gasFunctionService = new GasFunctionService('ScheduleEventService.findAllScheduleEvents', { timeout: 20000 });

  try {
    const result = await gasFunctionService.call<any>();
    console.log(`result: ${result}`);
  } catch (error) {
    console.error('Error calling GAS function:', error);
  }
});
</script>

<template>
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <HelloWorld msg="Vite + Vue + Content-Deck!" />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
