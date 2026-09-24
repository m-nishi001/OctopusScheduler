import { ref, watch, onMounted, computed } from "vue";
import { container } from "tsyringe";
import { AssetService } from "../../../../../../control/asset/asset-service";
import { AppEventService } from "../../../../../../control/app-event/app-event-service";
import { PlayAudioEvent } from "../../../../../../control/app-event/play-audio/play-audio-event";
import type { Asset } from "../../../../../../model/asset/asset";

export function useMusicPlaybackEvent(props: any, emit: any) {
  const isEdit = ref(!!props.event);

  function entityToForm(e: PlayAudioEvent) {
    return {
      startTime: formatDateTime(e.startTime),
      endTime: formatDateTime(e.endTime),
      audioId: e.audioId ?? "",
      fadeOutDuration: e.fadeOutDuration ?? 0,
      assetSource: "existing" as "existing" | "upload",
      selectedAssetId: e.audioId ?? "",
      uploadFile: null as File | null,
    };
  }

  const initialEntity = props.event ?? PlayAudioEvent.createEmpty();
  const form = ref(entityToForm(initialEntity));

  const assets = ref<Asset[]>([]);
  const assetService = container.resolve(AssetService);
  const appEventService = container.resolve(AppEventService);

  watch(
    () => props.event,
    (newEvent) => {
      const e = newEvent ?? PlayAudioEvent.createEmpty();
      form.value = entityToForm(e);
      isEdit.value = !!newEvent;
    }
  );

  onMounted(async () => {
    await loadAssets();
  });

  const filteredAssets = computed(() => {
    return assets.value.filter((asset) =>
      ((asset as any).blob as Blob).type.startsWith("audio")
    );
  });

  async function loadAssets() {
    try {
      assets.value = await assetService.getAssets();
    } catch (e) {
      console.error("Failed to load assets:", e);
    }
  }

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

    let audioId = form.value.audioId;

    if (form.value.assetSource === "existing") {
      audioId = form.value.selectedAssetId;
    } else if (form.value.assetSource === "upload" && form.value.uploadFile) {
      try {
        const asset: any = {
          id: "",
          name: form.value.uploadFile.name,
          uploadedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          size: form.value.uploadFile.size,
          blob: form.value.uploadFile,
        };
        const ids = await assetService.addAssets([asset]);
        audioId = ids[0];
      } catch (e) {
        alert(
          "アセットアップロードに失敗しました: " +
            (e instanceof Error ? e.message : String(e))
        );
        return;
      }
    }

    try {
      await appEventService.saveScheduledEvent(
        {
          actionType: "PlayAudioEvent",
          audioId,
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

  function onFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    form.value.uploadFile = target.files?.[0] || null;
  }

  const fileInput = ref<HTMLInputElement | null>(null);

  function openFilePicker() {
    fileInput.value?.click();
  }

  function clearFile() {
    form.value.uploadFile = null;
    if (fileInput.value) fileInput.value.value = "";
  }

  return {
    form,
    isEdit,
    filteredAssets,
    fileInput,
    openFilePicker,
    onFileChange,
    clearFile,
    onSubmit,
    onClose,
  };
}
