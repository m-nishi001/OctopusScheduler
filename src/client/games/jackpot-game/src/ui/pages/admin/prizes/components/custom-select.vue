<template>
    <div class="custom-select" ref="root">
        <button type="button" class="admin-input custom-select-trigger" :aria-expanded="open" :aria-haspopup="'listbox'"
            @click="toggle" ref="trigger">
            <span class="selected">{{ selectedLabel }}</span>
            <span class="arrow">▾</span>
        </button>

        <teleport to="body">
            <ul v-if="open" :style="dropdownStyle" class="custom-select-list" role="listbox"
                :aria-activedescendant="activeId || undefined" @keydown.esc="close">
                <li v-if="allowEmpty" :key="''" class="custom-select-option" role="option" @click="select('')">
                    選択なし
                </li>
                <li v-for="opt in options" :key="opt.value" :id="getOptionId(opt.value)"
                    :class="['custom-select-option', { 'is-active': opt.value === modelValue }]" role="option"
                    @click="select(opt.value)">
                    {{ opt.label }}
                </li>
            </ul>
        </teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch, nextTick } from 'vue';

const props = defineProps({
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array as () => { value: string | number, label: string }[], default: () => [] },
    allowEmpty: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const trigger = ref<HTMLElement | null>(null);
const root = ref<HTMLElement | null>(null);

const dropdownStyle = ref<Record<string, string>>({ position: 'absolute' });

const modelValue = computed(() => props.modelValue);
const selectedLabel = computed(() => {
    if (modelValue.value === '' || modelValue.value === null || modelValue.value === undefined) return '';
    const opt = props.options.find(o => o.value === modelValue.value);
    return opt ? opt.label : '';
});

const toggle = async () => {
    open.value = !open.value;
    if (open.value) {
        await nextTick();
        positionDropdown();
        addGlobalListeners();
    } else {
        removeGlobalListeners();
    }
};
const close = () => {
    open.value = false;
    removeGlobalListeners();
};

const select = (value: string | number) => {
    emit('update:modelValue', value as any);
    close();
};

const positionDropdown = () => {
    if (!trigger.value) return;
    const rect = trigger.value.getBoundingClientRect();
    const width = Math.max(rect.width, 200);
    const top = rect.bottom + 6;
    const left = rect.left;

    // clamp into viewport
    const viewportHeight = window.innerHeight;
    // fallback for bottom-up placement
    dropdownStyle.value = {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        minWidth: `${width}px`,
        zIndex: '2200'
    };

    // if dropdown would overflow bottom of viewport, open upwards
    // but we don't know height yet; set maxHeight to control it
    const maxHeight = Math.min(320, Math.floor(viewportHeight - rect.bottom - 20));
    dropdownStyle.value.maxHeight = `${maxHeight}px`;
    dropdownStyle.value.overflowY = 'auto';
};

let onDocumentClick = (ev: MouseEvent) => {
    if (!root.value) return;
    if (!root.value.contains(ev.target as Node)) {
        close();
    }
};

const addGlobalListeners = () => {
    document.addEventListener('click', onDocumentClick);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
};
const removeGlobalListeners = () => {
    document.removeEventListener('click', onDocumentClick);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', close, true);
};

onBeforeUnmount(() => {
    removeGlobalListeners();
});

const activeId = ref<string | null>(null);

watch(modelValue, (v) => {
    activeId.value = getOptionId(v as any);
});

const getOptionId = (value: string | number) => `custom-select-option-${String(value)}`;
</script>

<style scoped>
.custom-select {
    display: inline-block;
    position: relative;
}

.custom-select-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
    min-width: 160px;
}

.custom-select-list {
    background: linear-gradient(180deg, #232b36 0%, #2a3441 100%);
    border-radius: 8px;
    padding: 8px 0;
    color: #fff;
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.6);
    list-style: none;
    margin: 0;
}

.custom-select-option {
    padding: 10px 16px;
    cursor: pointer;
}

.custom-select-option:hover,
.custom-select-option.is-active {
    background: rgba(79, 140, 255, 0.14);
}

.custom-select-option+.custom-select-option {
    border-top: 1px solid rgba(255, 255, 255, 0.02);
}

.arrow {
    opacity: 0.9;
}
</style>
