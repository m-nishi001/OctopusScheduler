<script setup lang="ts">
import { onMounted } from 'vue';
import { GasFunction, GasFunctionService } from '@common-lib/google-apps-script/gas-script-service'

onMounted(async () => {
  var gasFunctionServicie = GasFunctionService.create("callOctopusSchedulerApi");
  if (!gasFunctionServicie) throw new Error();

  // const result0 = await gasFunctionServicie.call(new GasFunction<any>("DriveService.readyZipping", "1Ign_7fctDdaEoR1X9gMm_7Qjz1poUsxS").withTimeout(20000));
  // if (result0.status === "failed") throw new Error();

  // var result = await gasFunctionServicie
  //   .callParallel(
  //     [
  //       new GasFunction<any>("DriveService.zip", ["1Ign_7fctDdaEoR1X9gMm_7Qjz1poUsxS", 0]).withTimeout(20000),
  //       new GasFunction<any>("DriveService.zip", ["1Ign_7fctDdaEoR1X9gMm_7Qjz1poUsxS", 1]).withTimeout(20000)
  //     ]
  //   );


  // const result3 = await gasFunctionServicie.call(new GasFunction<any>("ScheduleEventService.addScheduleEvents", [{
  //   eventName: "TestEvent-del",
  //   start: new Date(2025, 12, 10),
  //   end: new Date(2025, 12, 11)
  // }]).withTimeout(20000));
  // console.log(`result: ${result3}`);

  // const result0 = await gasFunctionServicie.call(new GasFunction<any>("ScheduleEventService.addScheduleEvents", [{
  //   eventName: "TestEvent1",
  //   start: new Date(2025, 7, 10),
  //   end: new Date(2025, 7, 11)
  // }]).withTimeout(20000));
  // console.log(`result: ${result0}`);

  const result1 = await gasFunctionServicie.call(new GasFunction<any>("ScheduleEventService.findAllScheduleEvents", {}).withTimeout(20000));
  console.log(`result: ${result1}`);

  // await gasFunctionServicie.call(new GasFunction<any>("ScheduleEventService.updateScheduleEvents", [{
  //   eventId: (result1 as SuccessResponse<any>).data[0].eventId,
  //   eventName: "TestEvent1-1",
  //   start: new Date(2025, 7, 11, 13, 10, 30),
  //   end: new Date(2025, 7, 11, 14, 20, 19)
  // }]).withTimeout(20000));

  // const result2 = await gasFunctionServicie.call(new GasFunction<any>("ScheduleEventService.findAllScheduleEvents", {}).withTimeout(20000));
  // console.log(`result: ${result2}`);

  // const result4 = await gasFunctionServicie.call(new GasFunction<any>("ScheduleEventService.findAllScheduleEvents", {}).withTimeout(20000));
  // console.log(`result: ${result4}`);

  // const result5 = await gasFunctionServicie.call(new GasFunction<any>("ScheduleEventService.deleteSchedduleEvent", [{
  //   eventId: (result4 as SuccessResponse<any>).data[1].eventId
  // }]).withTimeout(20000));
  // console.log(`result: ${result5}`);

});
</script>

<template>
  <div>
    <!-- <a href="https://vite.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a> -->
  </div>
  <!-- <HelloWorld msg="Vite + Vue" /> -->
  <router-view />
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
