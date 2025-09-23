<template>
  <AdminLayout>
    <h2>抽選設定管理</h2>
    <form @submit.prevent="updateSettings">
      <label>
        抽選名:
        <input v-model="settings.drawName" type="text" />
      </label>
      <label>
        当選者数:
        <input v-model.number="settings.winnerCount" type="number" min="1" />
      </label>
      <Button type="submit">設定を保存</Button>
    </form>
  </AdminLayout>
</template>

<script lang="ts">
import AdminLayout from './AdminLayout.vue';
import Button from './Button.vue';
import { ref } from 'vue';
import { AdminService } from '../../model/applications/AdminService';

export default {
  name: 'AdminView',
  components: { AdminLayout, Button },
  setup() {
    const settings = ref({ drawName: '', winnerCount: 1 });
    const adminService = new AdminService();
    const updateSettings = async () => {
      await adminService.updateSettings(settings.value);
      alert('設定を保存しました');
    };
    return { settings, updateSettings };
  },
};
</script>
