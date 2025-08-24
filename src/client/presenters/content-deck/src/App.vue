<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
import { onMounted } from 'vue';

import { GasFunctionService } from '@common-lib/google-apps-script/gas-script-service'

onMounted(async () => {
  var gasFunctionServicie = GasFunctionService.create("callOctopusSchedulerApi");
  if (!gasFunctionServicie) throw new Error();

  const func = gasFunctionServicie
    .createCall<any>("ScheduleEventService.findAllScheduleEvents")
    .withTimeout(20000)
    .withSuccessed(o => console.log(`result: ${o}`));
  await gasFunctionServicie.all(func);
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
