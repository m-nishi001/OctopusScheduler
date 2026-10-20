import { toDatetimeLocal, fromDatetimeLocal } from "@octopus/client-common/date-utils/date-utils";
import { toast } from '@octopus/ui-kit';
import { ref, onMounted } from "vue";
import { container } from "tsyringe";
import { AppEventService } from "../../../../../../control/app-event/app-event-service";
import { StopAudioEvent } from "../../../../../../control/app-event/stop-audio/stop-audio-event";

export function useStopAudioEvent(props: any, emit: any) {
  const isEdit = ref(!!props.event);

  function entityToForm(e: StopAudioEvent) {
    return {
      startTime: toDatetimeLocal(e.startTime),
      endTime: toDatetimeLocal(e.endTime),
      fadeOutDuration: e.fadeOutDuration ?? 0,
    };
  }

  const initialEntity = props.event ?? StopAudioEvent.createEmpty();
  const form = ref(entityToForm(initialEntity));
  const appEventService = container.resolve(AppEventService);

  onMounted(() => {});


  async function onSubmit() {
    const startTime = fromDatetimeLocal(form.value.startTime);
    const endTime = fromDatetimeLocal(form.value.endTime);
    if (startTime >= endTime) {
      toast.error("開始時間が終了時間より後です。");
      return;
    }

    try {
      await appEventService.saveScheduledEvent(
        {
          actionType: "StopAudioEvent",
          fadeOutDuration: form.value.fadeOutDuration,
          startTime,
          endTime,
        },
        props.event
      );
      emit("saved");
      emit("close");
    } catch (e) {
      toast.error(
        "保存に失敗しました: " + (e instanceof Error ? e.message : String(e))
      );
    }
  }

  function onClose() {
    emit("close");
  }

  return { form, isEdit, onSubmit, onClose };
}
