<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div class="bg-white rounded p-6 w-96 text-center">
                <h3 class="text-xl font-bold mb-2">{{ title }}</h3>
                <div v-if="imageUrl" class="mb-3">
                    <img :src="imageUrl" :alt="imageAlt || title" class="modal-image" />
                </div>
                <p class="mb-4"><slot>{{ message }}</slot></p>
                <div class="mt-2">
                    <button class="btn-primary" @click="close">{{ primaryLabel }}</button>
                </div>
            </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'DrawModal',
    props: {
        title: { type: String, required: true },
        message: { type: String, required: false, default: '' },
        primaryLabel: { type: String, required: false, default: 'Enter で続行' },
        imageUrl: { type: String, required: false, default: '' },
        imageAlt: { type: String, required: false, default: '' }
    },
    emits: ['close'],
    setup(_, { emit }) {
        const close = () => emit('close');
        return { close };
    }
});
</script>

<style scoped>
.btn-primary {
    background: linear-gradient(90deg, #6d28d9, #ec4899);
    color: white;
    padding: 8px 14px;
    border-radius: 6px;
}
.modal-image {
    max-width: 160px;
    max-height: 120px;
    object-fit: contain;
    display: block;
    margin: 0 auto 8px auto;
}
</style>
