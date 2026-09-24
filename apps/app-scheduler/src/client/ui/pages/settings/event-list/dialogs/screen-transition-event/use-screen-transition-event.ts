import { ref, watch } from "vue";
import { container } from "tsyringe";
import { AppEventService } from "../../../../../../control/app-event/app-event-service";
import { TransitionPageEvent } from "../../../../../../control/app-event/transition/transition-page-event";

export function useScreenTransitionEvent(props: any, emit: any) {
  const isEdit = ref(!!props.event);

  function entityToForm(e: any) {
    return {
      startTime: formatDateTime(e.startTime),
      endTime: formatDateTime(e.endTime),
      transitionUrl: e.transitionUrl ?? "",
      fadeOutDuration: e.fadeOutDuration ?? 0,
    };
  }

  const initialEntity = props.event ?? TransitionPageEvent.createEmpty();
  const form = ref(entityToForm(initialEntity));
  const appEventService = container.resolve(AppEventService);

  watch(
    () => props.event,
    (newEvent) => {
      const e = newEvent ?? TransitionPageEvent.createEmpty();
      form.value = entityToForm(e);
      isEdit.value = !!newEvent;
    }
  );

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
    try {
      await appEventService.saveScheduledEvent(
        {
          actionType: "TransitionPageEvent",
          transitionUrl: form.value.transitionUrl,
          fadeOutDuration: form.value.fadeOutDuration,
          startTime,
          endTime,
        },
        props.event
      );
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
