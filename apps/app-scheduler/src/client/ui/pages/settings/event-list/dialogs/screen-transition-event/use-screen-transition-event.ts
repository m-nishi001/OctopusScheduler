import { toDatetimeLocal, fromDatetimeLocal } from "@octopus/client-common/date-utils/date-utils";
import { toast } from '@octopus/ui-kit';
import { ref, watch } from "vue";
import { container } from "tsyringe";
import { AppEventService } from "../../../../../../control/app-event/app-event-service";
import { TransitionPageEvent } from "../../../../../../control/app-event/transition/transition-page-event";

export function useScreenTransitionEvent(props: any, emit: any) {
  const isEdit = ref(!!props.event);

  function entityToForm(e: any) {
    return {
      startTime: toDatetimeLocal(e.startTime),
      endTime: toDatetimeLocal(e.endTime),
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
