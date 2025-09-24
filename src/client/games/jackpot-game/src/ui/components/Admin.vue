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
<template>
	<div>
		<h2>管理画面</h2>
		<section>
			<h3>メンバー管理</h3>
			<input placeholder="名前" v-model="newMemberName" />
			<input type="file" @change="onMemberPhotoChange" />
			<button @click="addMember">追加</button>
			<ul>
				<li v-for="m in members" :key="m.id">
					<img v-if="m.photo" :src="m.photo" style="width:32px;border-radius:50%;margin-right:8px;" />
					<span>{{ m.name }}</span>
					<button @click="editMember(m)">編集</button>
					<button @click="deleteMember(m.id)">削除</button>
				</li>
			</ul>
			<div v-if="editingMember">
				<h4>メンバー編集</h4>
				<input v-model="editingMember.name" />
				<input type="file" @change="onEditMemberPhotoChange" />
				<button @click="saveMember">保存</button>
				<button @click="cancelEditMember">キャンセル</button>
			</div>
		</section>
		<section>
			<h3>景品管理</h3>
			<input placeholder="景品名" v-model="newPrizeName" />
			<select v-model="newPrizeRank">
				<option value="high">高</option>
				<option value="normal">中</option>
				<option value="low">低</option>
			</select>
			<input type="file" @change="onPrizeImageChange" />
			<button @click="addPrize">追加</button>
			<ul>
				<li v-for="p in prizes" :key="p.id">
					<img v-if="p.image" :src="p.image" style="width:32px;height:32px;object-fit:cover;border-radius:8px;margin-right:8px;" />
					<span>{{ p.name }} ({{ p.rank }})</span>
					<button @click="editPrize(p)">編集</button>
					<button @click="deletePrize(p.id)">削除</button>
				</li>
			</ul>
			<div v-if="editingPrize">
				<h4>景品編集</h4>
				<input v-model="editingPrize.name" />
				<select v-model="editingPrize.rank">
					<option value="high">高</option>
					<option value="normal">中</option>
					<option value="low">低</option>
				</select>
				<input type="file" @change="onEditPrizeImageChange" />
				<button @click="savePrize">保存</button>
				<button @click="cancelEditPrize">キャンセル</button>
			</div>
		</section>
		<section>
			<h3>画面設定</h3>
			<input placeholder="画面名" v-model="screenName" />
			<button @click="saveScreen">保存</button>
			<!-- 詳細な画面設定管理UIは今後拡張 -->
		</section>
	</div>
</template>
<script lang="ts">
import { ref } from 'vue';
export default {
	name: 'Admin',
	setup() {
		// メンバー管理
		const members = ref<{ id: string; name: string; photo?: string }[]>([]);
		const newMemberName = ref('');
		const newMemberPhoto = ref<string | null>(null);
		const editingMember = ref<{ id: string; name: string; photo?: string } | null>(null);
		const addMember = () => {
			if (newMemberName.value) {
				members.value.push({ id: Date.now().toString(), name: newMemberName.value, photo: newMemberPhoto.value || undefined });
				newMemberName.value = '';
				newMemberPhoto.value = null;
			}
		};
		const onMemberPhotoChange = (e: Event) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = () => { newMemberPhoto.value = reader.result as string; };
				reader.readAsDataURL(file);
			}
		};
		const editMember = (m: { id: string; name: string; photo?: string }) => {
			editingMember.value = { ...m };
		};
		const onEditMemberPhotoChange = (e: Event) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file && editingMember.value) {
				const reader = new FileReader();
				reader.onload = () => { editingMember.value!.photo = reader.result as string; };
				reader.readAsDataURL(file);
			}
		};
		const saveMember = () => {
			if (editingMember.value) {
				const idx = members.value.findIndex(m => m.id === editingMember.value!.id);
				if (idx !== -1) members.value[idx] = { ...editingMember.value };
				editingMember.value = null;
			}
		};
		const cancelEditMember = () => { editingMember.value = null; };
		const deleteMember = (id: string) => {
			members.value = members.value.filter(m => m.id !== id);
		};

		// 景品管理
		const prizes = ref<{ id: string; name: string; rank: string; image?: string }[]>([]);
		const newPrizeName = ref('');
		const newPrizeRank = ref('normal');
		const newPrizeImage = ref<string | null>(null);
		const editingPrize = ref<{ id: string; name: string; rank: string; image?: string } | null>(null);
		const addPrize = () => {
			if (newPrizeName.value) {
				prizes.value.push({ id: Date.now().toString(), name: newPrizeName.value, rank: newPrizeRank.value, image: newPrizeImage.value || undefined });
				newPrizeName.value = '';
				newPrizeRank.value = 'normal';
				newPrizeImage.value = null;
			}
		};
		const onPrizeImageChange = (e: Event) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = () => { newPrizeImage.value = reader.result as string; };
				reader.readAsDataURL(file);
			}
		};
		const editPrize = (p: { id: string; name: string; rank: string; image?: string }) => {
			editingPrize.value = { ...p };
		};
		const onEditPrizeImageChange = (e: Event) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file && editingPrize.value) {
				const reader = new FileReader();
				reader.onload = () => { editingPrize.value!.image = reader.result as string; };
				reader.readAsDataURL(file);
			}
		};
		const savePrize = () => {
			if (editingPrize.value) {
				const idx = prizes.value.findIndex(p => p.id === editingPrize.value!.id);
				if (idx !== -1) prizes.value[idx] = { ...editingPrize.value };
				editingPrize.value = null;
			}
		};
		const cancelEditPrize = () => { editingPrize.value = null; };
		const deletePrize = (id: string) => {
			prizes.value = prizes.value.filter(p => p.id !== id);
		};

		// 画面設定（雛形）
		const screenName = ref('');
		const saveScreen = () => {
			alert(`画面設定「${screenName.value}」を保存しました`);
		};

		return {
			members, newMemberName, newMemberPhoto, addMember, onMemberPhotoChange,
			editingMember, editMember, onEditMemberPhotoChange, saveMember, cancelEditMember, deleteMember,
			prizes, newPrizeName, newPrizeRank, newPrizeImage, addPrize, onPrizeImageChange,
			editingPrize, editPrize, onEditPrizeImageChange, savePrize, cancelEditPrize, deletePrize,
			screenName, saveScreen
		};
	},
};
</script>
