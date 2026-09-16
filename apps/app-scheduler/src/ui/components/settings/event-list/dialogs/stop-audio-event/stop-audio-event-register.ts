import { ref, onMounted } from "vue";
import { container } from "tsyringe";
import { AppEventService } from "../../../../../../model/applications/app-event/app-event-service";
import {
  StopAudioEvent,
  StopAudioEventParams,
} from "../../../../../../model/domains/app-event/stop-audio/stop-audio-event";

export function useStopAudioEvent(props: any, emit: any) {
  const isEdit = ref(!!props.event);

  function entityToForm(e: StopAudioEvent) {
    return {
      startTime: formatDateTime(e.startTime),
      endTime: formatDateTime(e.endTime),
      fadeOutDuration: e.fadeOutDuration ?? 0,
    };
  }

  const initialEntity = props.event ?? StopAudioEvent.createEmpty();
  const form = ref(entityToForm(initialEntity));

  onMounted(() => {});

  function formatDateTime(date: Date): string {
    return date.toISOString().slice(0, 16);
  }

  async function onSubmit() {
    const startTime = new Date(form.value.startTime);
    const endTime = new Date(form.value.endTime);
    if (startTime >= endTime) {
      alert("開始時間が終了時間より後です。");
      return;
    }

    const scheduleEventService = container.resolve(AppEventService);

    try {
      if (isEdit.value && props.event) {
        const params = new StopAudioEventParams({
          id: props.event.id,
          startTime,
          endTime,
          audioId: undefined,
          fadeOutDuration: form.value.fadeOutDuration,
          processedAt: props.event.processedAt,
          registeredAt: props.event.registeredAt,
          updatedAt: new Date(),
        });
        const updated = StopAudioEvent.fromParams(params);
        await scheduleEventService.updateScheduleEvents([updated]);
      } else {
        const params = new StopAudioEventParams({
          id: "",
          startTime,
          endTime,
          audioId: undefined,
          fadeOutDuration: form.value.fadeOutDuration,
          processedAt: null,
          registeredAt: new Date(),
          updatedAt: new Date(),
        });
        const tempEvent = StopAudioEvent.fromParams(params);
        await scheduleEventService.addScheduleEvents([tempEvent]);
      }
      emit("saved");
      emit("close");
    } catch (e) {
      alert(
        "保存に失敗しました: " + (e instanceof Error ? e.message : String(e))
      );
    }
  }

  function onClose() {
    emit("close");
  }

  return { form, isEdit, onSubmit, onClose };
}
