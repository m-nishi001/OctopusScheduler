<template>
    <DataTable :columns="columns" :rows="shortcuts" row-key="id" empty-text="ショートカットがありません">
        <template #cell-keys="{ row }">{{ row.keys.join(' + ') }}</template>
        <template #cell-actions-list="{ row }">
            <ul class="action-list">
                <li v-for="(action, i) in resolvedActionsByShortcutId[row.id] || []" :key="actionKey(action, i)">
                    {{ actionLabel(action) }}
                </li>
            </ul>
        </template>
        <template #cell-operations="{ row }">
            <div class="row-actions">
                <UiButton size="sm" icon="play" icon-only aria-label="ショートカットを実行"
                    :disabled="isRunningById[row.id]" @click="onRun(row)" />
                <UiButton size="sm" icon="edit" icon-only aria-label="編集" @click="onEdit(row)" />
                <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除"
                    @click="onDelete(row.id)" />
            </div>
        </template>
    </DataTable>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { DataTable, UiButton } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import { container } from 'tsyringe';
import { KeyboardShortcut } from '@model/keyboard-shortcut/keyboard-shortcut';
import { AppEventService } from '../../../../control/app-event/app-event-service';
import { uiActionEntries } from '../app-events/registry';
import { sendShortcutViaChannel } from '../../../composables/send-shortcut-via-channel';

interface Props {
    shortcuts: KeyboardShortcut[];
}

interface Emits {
    edit: [shortcut: KeyboardShortcut];
    delete: [id: string];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const columns: DataTableColumn[] = [
    { key: 'keys', label: 'キー組み合わせ' },
    { key: 'actions-list', label: 'アクション' },
    { key: 'operations', label: '操作' },
];

const onEdit = (shortcut: KeyboardShortcut) => {
    emit('edit', shortcut);
};

const onDelete = (id: string) => {
    emit('delete', id);
};

// running state map to prevent double execution
const isRunningById = ref<Record<string, boolean>>({});

const onRun = async (shortcut: KeyboardShortcut) => {
    if (!shortcut || !shortcut.id) return;
    if (isRunningById.value[shortcut.id]) return;
    try {
        isRunningById.value = { ...isRunningById.value, [shortcut.id]: true };
        // Send the shortcut to the execute tab (same behavior as keyboard listener)
        await sendShortcutViaChannel((shortcut as any).eventIds || []);
    } catch (e) {
        // intentionally swallow errors; no toast required
    } finally {
        isRunningById.value = { ...isRunningById.value, [shortcut.id]: false };
    }
};

// compute stable key for action entries in the saved shortcut list
const actionKey = (a: any, i: number) => {
    return a?.eventId ?? a?.id ?? `act-${i}-${a?.type ?? 'x'}`;
};

const actionLabel = (a: any) => {
    if (!a) return '';
    // prefer explicit label from UI registry when available
    const entry = ACTION_REGISTRY[a.actionType || a.type];
    if (entry && entry.label) return entry.label;
    // fallback to actionType or other recognizable field
    return a.actionType || a.type || (a.eventId ? `未登録(${a.eventId})` : '不明');
};

// Registry for action entries (label lookup)
const ACTION_REGISTRY = Object.fromEntries(
    uiActionEntries.map((e) => [e.actionType, e])
);

const appEventService = container.resolve(AppEventService);

// resolved actions per shortcut id: map shortcut.id -> AppEventDto[]
const resolvedActionsByShortcutId = ref<Record<string, any[]>>({});

async function loadResolvedActions() {
    const result: Record<string, any[]> = {};
    for (const s of props.shortcuts || []) {
        const ids = (s as any).eventIds || [];
        const evDtos: any[] = [];
        const evs = await Promise.all(ids.map((id: string) => appEventService.getEventById(String(id))));
        for (const ev of evs) {
            if (!ev) {
                evDtos.push({ actionType: 'Unknown', eventId: null });
                continue;
            }
            try {
                evDtos.push(appEventService.toDto(ev));
            } catch (e) {
                evDtos.push({ actionType: ev.type, eventId: ev.id });
            }
        }
        result[s.id] = evDtos;
    }
    resolvedActionsByShortcutId.value = result;
}

onMounted(loadResolvedActions);
watch(() => props.shortcuts, loadResolvedActions, { deep: true });
</script>

<style scoped>
.action-list {
    margin: 0;
    padding-left: 1.2em;
}

.row-actions {
    display: flex;
    gap: var(--ui-space-2, 8px);
}
</style>
