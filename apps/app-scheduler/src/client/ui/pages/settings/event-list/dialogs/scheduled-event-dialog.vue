<template>
    <UiDialog :model-value="true" :title="`${entry.label}イベント${isEdit ? '編集' : '追加'}`" size="md"
        :close-on-overlay="false" @close="emit('close')">
        <form id="scheduled-event-form" @submit.prevent="onSubmit">
            <div class="form-group">
                <label for="startTime">開始時間</label>
                <input id="startTime" type="datetime-local" v-model="times.start" required />
            </div>
            <div class="form-group">
                <label for="endTime">終了時間</label>
                <input id="endTime" type="datetime-local" v-model="times.end" required />
            </div>
            <component :is="entry.component" ref="formRef" :initial-data="initialDto" @save="onFormSave" />
        </form>
        <template #footer>
            <UiButton @click="emit('close')">キャンセル</UiButton>
            <UiButton type="submit" variant="primary" form="scheduled-event-form" :loading="saving">{{ isEdit ? '更新' : '追加' }}</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { container } from 'tsyringe';
import { UiButton, UiDialog, toast } from '@octopus/ui-kit';
import { fromDatetimeLocal, toDatetimeLocal } from '@octopus/client-common/date-utils/date-utils';
import { AppEventService } from '../../../../../control/app-event/app-event-service';
import { appEventToDto, createEmptyAppEvent, type AppEvent, type AppEventType } from '../../../../../control/app-event/app-event';
import type { AppEventDto } from '../../../../../control/app-event/dto/app-event-dto';
import { uiActionEntries } from '../../app-events/registry';
import type { EventFormHandle } from '../../app-events/ui-action-entry';

/**
 * 予定イベントの追加・編集ダイアログ(全種類共通)。
 * 開始・終了の時刻だけをここで持ち、種類ごとの項目は `app-events/events/*` のフォームに任せる。
 */
const props = defineProps<{
    /** 追加する種類。編集のときは `event.type` が使われる。 */
    type: AppEventType;
    /** 編集するイベント。省略すると新規追加。 */
    event?: AppEvent | null;
}>();
const emit = defineEmits<{ saved: []; close: [] }>();

const isEdit = computed(() => !!props.event);
const entry = computed(() => {
    const found = uiActionEntries.find((e) => e.actionType === (props.event?.type ?? props.type));
    if (!found) throw new Error(`予定イベントの編集フォームが無い種類です: ${props.event?.type ?? props.type}`);
    return found;
});

const source = props.event ?? createEmptyAppEvent(props.type);
const initialDto = appEventToDto(source);
const times = ref({ start: toDatetimeLocal(source.startTime), end: toDatetimeLocal(source.endTime) });

const formRef = ref<EventFormHandle | null>(null);
const saving = ref(false);
const appEventService = container.resolve(AppEventService);

/** 時刻を確かめてから、フォームに検証と(必要なら)アップロードをさせる。結果は `onFormSave` に届く。 */
async function onSubmit() {
    if (fromDatetimeLocal(times.value.start) >= fromDatetimeLocal(times.value.end)) {
        toast.error('開始時間が終了時間より後です。');
        return;
    }
    saving.value = true;
    try {
        await formRef.value?.save();
    } catch (e) {
        toast.error('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        saving.value = false;
    }
}

async function onFormSave(dto: AppEventDto) {
    try {
        await appEventService.saveScheduledEvent(
            { ...dto, startTime: fromDatetimeLocal(times.value.start), endTime: fromDatetimeLocal(times.value.end) },
            props.event ?? undefined
        );
        emit('saved');
        emit('close');
    } catch (e) {
        toast.error('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}
</script>
