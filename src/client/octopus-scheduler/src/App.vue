<script setup lang="ts">
import { onMounted } from 'vue';
import { GasFunctionService } from '/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts'

onMounted(async () => {
  const gasFunctionService = GasFunctionService.create("callOctopusSchedulerApi");
  if (!gasFunctionService) throw new Error();

  // 1. save (新規スケジュール登録)
  await new Promise<void>(resolve => {
    gasFunctionService
      .createCall<any>("ScheduleService.save", JSON.stringify({
        eventName: "疎通テストイベント",
        start: new Date(2025, 7, 28, 10, 0, 0),
        end: new Date(2025, 7, 28, 12, 0, 0)
      }))
      .withTimeout(20000)
      .withSuccessed(saveResult => {
        console.log("[ScheduleService.save]", saveResult);
        resolve();
      })
      .withFailuered(message => {
        console.error("[ScheduleService.save] failed", message);
        resolve();
      })
      .invoke();
  });

  // 2. getScheduleMetadatas (一覧取得)
  let metaResult: any[] = [];
  await new Promise<void>(resolve => {
    gasFunctionService
      .createCall<any[]>("ScheduleService.getScheduleMetadatas")
      .withTimeout(20000)
      .withSuccessed(result => {
        console.log("[ScheduleService.getScheduleMetadatas]", result);
        metaResult = result;
        resolve();
      })
      .withFailuered(message => {
        console.error("[ScheduleService.getScheduleMetadatas] failed", message);
        resolve();
      })
      .invoke();
  });

  // 3. findById (個別取得)
  let firstId: string | null = null;
  if (Array.isArray(metaResult) && metaResult.length > 0) {
    firstId = metaResult[0].scheduleId;
    await new Promise<void>(resolve => {
      gasFunctionService
        .createCall<any>("ScheduleService.findById", firstId)
        .withTimeout(20000)
        .withSuccessed(findResult => {
          console.log("[ScheduleService.findById]", findResult);
          resolve();
        })
        .withFailuered(message => {
          console.error("[ScheduleService.findById] failed", message);
          resolve();
        })
        .invoke();
    });
  }

  // 4. delete (削除)
  if (firstId) {
    await new Promise<void>(resolve => {
      gasFunctionService
        .createCall<any>("ScheduleService.delete", firstId)
        .withTimeout(20000)
        .withSuccessed(deleteResult => {
          if (deleteResult && typeof deleteResult.deletedCount === 'number' && deleteResult.deletedCount > 0) {
            console.log("[ScheduleService.delete] 削除成功", deleteResult);
          } else {
            console.warn("[ScheduleService.delete] 削除対象なし", deleteResult);
          }
          resolve();
        })
        .withFailuered(message => {
          console.error("[ScheduleService.delete] failed", message);
          resolve();
        })
        .invoke();
    });
  }
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
