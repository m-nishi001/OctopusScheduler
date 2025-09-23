<template>
	<div>
		<h2>結果画面</h2>
		<p>Enterキーでホーム画面へ</p>
	</div>
</template>
<script lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
export default {
	name: 'Result',
	setup() {
		const router = useRouter();
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') router.push('/');
		};
		onMounted(() => window.addEventListener('keydown', handleKey));
		onUnmounted(() => window.removeEventListener('keydown', handleKey));
	},
};
</script>
