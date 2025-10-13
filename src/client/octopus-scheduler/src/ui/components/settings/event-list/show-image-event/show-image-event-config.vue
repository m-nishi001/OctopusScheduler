<template>
    <div class="event-config">
        <h3>{{ isNew ? '画像表示イベント新規作成' : '画像表示イベント編集' }}</h3>
        <div class="config-item">
            <label>イベント名:</label>
            <input v-model="localEvent.name" type="text" class="admin-input" placeholder="イベント名を入力" />
        </div>
        <div class="config-item">
            <label>開始日時:</label>
            <input v-model="localEvent.timeSpan.start" type="datetime-local" class="admin-input" />
        </div>
        <div class="config-item">
            <label>終了日時:</label>
            <input v-model="localEvent.timeSpan.end" type="datetime-local" class="admin-input" />
        </div>
        <div class="config-item">
            <label>画像アセット:</label>
            <select v-model="localConfig.imageId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
            <button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving"
                :style="{ opacity: saving ? 0.6 : 1 }">{{ isNew ? '作成' : '保存' }}</button>
            <div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
        </div>
        <!-- ロードモーダル -->
        <div v-if="loading" class="modal-overlay">
            <div class="modal-content">
                <h3>{{ loadingStatus || 'データを読み込み中...' }}</h3>
                <p>アセットを読み込んでいます。しばらくお待ちください。</p>
                <div class="spinner"></div>
            </div>
        </div>
        <!-- 保存モーダル -->
        <div v-if="saving" class="modal-overlay">
            <div class="modal-content">
                <h3>保存中...</h3>
                <p>{{ saveStatus }}</p>
                <div class="spinner"></div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useEventSettingData } from '../use-event-setting-data';
import { ShowImageEventDetail } from '../../../../../model/domains/schedule-event/entity/events/show-image-event';
import { ScheduleEventDto } from '../../../../../model/domains/schedule-event/entity/schedule-event';
import { ShowImageEventConverter } from '../../../../../model/applications/schedule-event/converters/show-image-event-converter';
import { container } from 'tsyringe';
import { ScheduleEventService } from '../../../../../model/applications/schedule-event/schedule-event-service';

interface Props {
    modelValue: ScheduleEventDto;
    isNew?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:modelValue', value: ScheduleEventDto): void; (e: 'saved'): void }>();

const {
    imageAssets,
    loading,
    loadingStatus,
    saving,
    saveStatus,
    handleSave,
} = useEventSettingData();

const converter = container.resolve(ShowImageEventConverter);
const scheduleEventService = container.resolve(ScheduleEventService);

const localConfig = ref({
    imageId: "",
});

const localEvent = ref({
    name: "",
    timeSpan: { start: "", end: "" },
});

const loadConfig = () => {
    if (props.isNew) {
        localEvent.value = {
            name: "",
            timeSpan: { start: "", end: "" },
        };
        localConfig.value.imageId = "";
    } else {
        const detail = converter.toDto(props.modelValue);
        localEvent.value = {
            name: props.modelValue.name,
            timeSpan: {
                start: props.modelValue.timeSpan.start.toISOString().slice(0, 16),
                end: props.modelValue.timeSpan.end.toISOString().slice(0, 16),
            },
        };
        localConfig.value.imageId = detail.imageId || "";
    }
};

onMounted(() => {
    loadConfig();
});

const handleSaveClick = async () => {
    if (!localEvent.value.name || !localEvent.value.timeSpan.start || !localEvent.value.timeSpan.end) {
        alert('必須項目を入力してください');
        return;
    }
    await handleSave(async () => {
        const detail = new ShowImageEventDetail(localConfig.value.imageId);
        const eventData = {
            id: props.isNew ? crypto.randomUUID() : props.modelValue.id,
            type: 'ShowImageEvent',
            name: localEvent.value.name,
            timeSpan: {
                start: new Date(localEvent.value.timeSpan.start),
                end: new Date(localEvent.value.timeSpan.end),
                equals: () => false,
            },
            detail,
            processedAt: props.isNew ? null : props.modelValue.processedAt,
            registeredAt: props.isNew ? new Date() : props.modelValue.registeredAt,
            updatedAt: new Date(),
        };
        if (props.isNew) {
            await scheduleEventService.addScheduleEvents([eventData]);
        } else {
            await scheduleEventService.updateScheduleEvents([eventData]);
        }
        emit('saved');
    });
};
</script>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useEventSettingData } from '../use-event-setting-data';
import { ShowImageEventDetail } from '../../../../../model/domains/schedule-event/entity/events/show-image-event';
import { ScheduleEventDto } from '../../../../../model/domains/schedule-event/entity/schedule-event';
import { ShowImageEventConverter } from '../../../../../model/applications/schedule-event/converters/show-image-event-converter';
import { container } from 'tsyringe';

interface Props {
    modelValue: ScheduleEventDto;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:modelValue', value: ScheduleEventDto): void }>();

const {
    imageAssets,
    loading,
    loadingStatus,
    saving,
    saveStatus,
    handleSave,
} = useEventSettingData();

const converter = container.resolve(ShowImageEventConverter);

const localConfig = ref({
    imageId: "",
});

const loadConfig = () => {
    const detail = converter.toDto(props.modelValue);
    localConfig.value.imageId = detail.imageId || "";
};

onMounted(() => {
    loadConfig();
});

const handleSaveClick = async () => {
    await handleSave(async () => {
        const detail = new ShowImageEventDetail(localConfig.value.imageId);
        const updatedEvent = converter.toEntity(detail, {
            id: props.modelValue.id,
            type: props.modelValue.type,
            name: props.modelValue.name,
            timeSpan: props.modelValue.timeSpan,
            processedAt: props.modelValue.processedAt,
            registeredAt: props.modelValue.registeredAt,
            updatedAt: new Date(),
        });
        emit('update:modelValue', updatedEvent);
    });
};
</script>

<style scoped>
.event-config {
    margin-bottom: 32px;
}

.event-config h3 {
    margin-bottom: 16px;
    color: #fff;
}

.config-item {
    margin-bottom: 24px;
}

.config-item label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: #fff;
}

.admin-input {
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    background: #232b36;
    color: #fff;
    font-size: 1rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    margin-bottom: 8px;
    width: 100%;
}

.admin-input:focus {
    outline: 2px solid #4f8cff;
}

.admin-btn {
    padding: 10px 24px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
}

.admin-btn:hover {
    background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: #232b36;
    color: #fff;
    padding: 28px;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
}

.spinner {
    margin: 16px auto;
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4f8cff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

/* Prevent inputs and flex children from causing horizontal overflow */
.admin-input {
    box-sizing: border-box;
    max-width: 100%;
    overflow-wrap: anywhere;
}

.config-item {
    min-width: 0;
}
</style>