<template>
	<div>
		<h2>説明画面</h2>
		<p>Enterキーでデモ抽選画面へ</p>
	</div>
</template>
<script lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
export default {
	name: 'Description',
	setup() {
		const router = useRouter();
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') router.push('/demo-draw');
		};
		onMounted(() => window.addEventListener('keydown', handleKey));
		onUnmounted(() => window.removeEventListener('keydown', handleKey));
	},
};
</script>
