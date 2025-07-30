<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
import { onMounted } from 'vue';
import { GasFunctionService } from './google-script/gas-function-service';
import { GasFunction } from './google-script/gas-function';

onMounted(async () => {
  var gasFunctionServicie = GasFunctionService.create("callOctopusSchedulerApi");
  if (!gasFunctionServicie) throw new Error();

  const result0 = await gasFunctionServicie.call(new GasFunction<any>("DriveService.readyZipping", "1Ign_7fctDdaEoR1X9gMm_7Qjz1poUsxS").withTimeout(20000));
  if(result0.status === "failed") throw new Error();

  var result = await gasFunctionServicie
    .callParallel(
      [
        new GasFunction<any>("DriveService.zip", ["1Ign_7fctDdaEoR1X9gMm_7Qjz1poUsxS", 0]).withTimeout(20000),
        new GasFunction<any>("DriveService.zip", ["1Ign_7fctDdaEoR1X9gMm_7Qjz1poUsxS", 1]).withTimeout(20000)
      ]
    );
  console.log(`result: ${result}`);
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
  <HelloWorld msg="Vite + Vue" />
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
