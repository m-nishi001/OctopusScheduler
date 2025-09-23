<template>
	<div>
		<h2>管理画面</h2>
		<section>
			<h3>メンバー管理</h3>
			<input placeholder="名前" v-model="newMemberName" />
			<button @click="addMember">追加</button>
			<ul>
				<li v-for="m in members" :key="m.id">{{ m.name }}</li>
			</ul>
		</section>
		<section>
			<h3>景品管理</h3>
			<input placeholder="景品名" v-model="newPrizeName" />
			<select v-model="newPrizeRank">
				<option value="high">高</option>
				<option value="normal">中</option>
				<option value="low">低</option>
			</select>
			<button @click="addPrize">追加</button>
			<ul>
				<li v-for="p in prizes" :key="p.id">{{ p.name }} ({{ p.rank }})</li>
			</ul>
		</section>
		<section>
			<h3>画面設定</h3>
			<input placeholder="画面名" v-model="screenName" />
			<button @click="saveScreen">保存</button>
		</section>
	</div>
</template>
<script lang="ts">
import { ref } from 'vue';
export default {
	name: 'Admin',
	setup() {
		const members = ref<{ id: string; name: string }[]>([]);
		const newMemberName = ref('');
		const addMember = () => {
			if (newMemberName.value) {
				members.value.push({ id: Date.now().toString(), name: newMemberName.value });
				newMemberName.value = '';
			}
		};
		const prizes = ref<{ id: string; name: string; rank: string }[]>([]);
		const newPrizeName = ref('');
		const newPrizeRank = ref('normal');
		const addPrize = () => {
			if (newPrizeName.value) {
				prizes.value.push({ id: Date.now().toString(), name: newPrizeName.value, rank: newPrizeRank.value });
				newPrizeName.value = '';
				newPrizeRank.value = 'normal';
			}
		};
		const screenName = ref('');
		const saveScreen = () => {
			// 画面設定保存処理（雛形）
			alert(`画面設定「${screenName.value}」を保存しました`);
		};
		return { members, newMemberName, addMember, prizes, newPrizeName, newPrizeRank, addPrize, screenName, saveScreen };
	},
};
</script>
