<template>
	<div>
		<h2>デモ抽選画面</h2>
		<p>Enterキーで本抽選画面へ</p>
	</div>
</template>
<script lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
export default {
	name: 'DemoDraw',
	setup() {
		const router = useRouter();
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') router.push('/main-draw');
		};
		onMounted(() => window.addEventListener('keydown', handleKey));
		onUnmounted(() => window.removeEventListener('keydown', handleKey));
	},
};
</script>
