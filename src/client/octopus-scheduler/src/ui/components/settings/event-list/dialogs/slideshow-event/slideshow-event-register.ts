import { ref, watch, onMounted, computed } from "vue";
import { container } from "tsyringe";
import { AssetService } from "../../../../../../model/applications/assets/asset-service";
import type { Asset } from "../../../../../../model/domains/assets/entity/asset";
import { ScheduleEventService } from "../../../../../../model/applications/schedule-event/schedule-event-service";
import {
  SlideshowEvent,
  SlideshowEventParams,
} from "../../../../../../model/domains/schedule-event/slideshow/slideshow-event";

export function useSlideshowEvent(props: any, emit: any) {
  const isEdit = ref(!!props.event);

  function entityToForm(e: SlideshowEvent) {
    return {
      startTime: formatDateTime(e.startTime),
      endTime: formatDateTime(e.endTime),
      folderId: e.folderId ?? "",
      displayDuration: e.displayDuration ?? 5,
      transitionType: e.transitionType ?? "fade",
      slideDirection: e.slideDirection ?? "left",
      bgmIds: e.bgmIds.join(",") || "",
      bgmList: e.bgmIds.map((id: string) => ({ id, name: getAssetName(id) })),
    };
  }

  const initialEntity = props.event ?? SlideshowEvent.createEmpty();
  const form = ref(entityToForm(initialEntity));

  const newBgmSource = ref<"existing" | "upload">("existing");
  const selectedBgmId = ref("");
  const newBgmFile = ref<File | null>(null);
  const assets = ref<Asset[]>([]);
  const assetService = container.resolve(AssetService);

  watch(
    () => props.event,
    (newEvent) => {
      const e = newEvent ?? SlideshowEvent.createEmpty();
      form.value = entityToForm(e);
      isEdit.value = !!newEvent;
    }
  );

  onMounted(async () => {
    await loadAssets();
  });

  const filteredAudioAssets = computed(() => {
    return assets.value.filter((asset) =>
      ((asset as any).blob as Blob).type.startsWith("audio")
    );
  });

  function getAssetName(id: string): string {
    const asset = assets.value.find((a) => a.id === id);
    return asset ? asset.name : id;
  }

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

  function removeBgm(index: number) {
    form.value.bgmList.splice(index, 1);
  }

  function addExistingBgm() {
    if (selectedBgmId.value) {
      const asset = assets.value.find((a) => a.id === selectedBgmId.value);
      if (asset && !form.value.bgmList.some((b: any) => b.id === asset.id)) {
        form.value.bgmList.push({ id: asset.id, name: asset.name });
      }
      selectedBgmId.value = "";
    }
  }

  async function addUploadBgm() {
    if (newBgmFile.value) {
      try {
        const asset: any = {
          id: "",
          name: newBgmFile.value.name,
          uploadedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          size: newBgmFile.value.size,
          blob: newBgmFile.value,
        };
        const ids = await assetService.addAssets([asset]);
        form.value.bgmList.push({ id: ids[0], name: asset.name });
        newBgmFile.value = null;
      } catch (e) {
        alert(
          "アセットアップロードに失敗しました: " +
            (e instanceof Error ? e.message : String(e))
        );
      }
    }
  }

  function onBgmFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    newBgmFile.value = target.files?.[0] || null;
  }

  const bgmFileInput = ref<HTMLInputElement | null>(null);
  function openBgmFilePicker() {
    bgmFileInput.value?.click();
  }
  function clearBgmFile() {
    newBgmFile.value = null;
    if (bgmFileInput.value) bgmFileInput.value.value = "";
  }

  async function onSubmit() {
    const startTime = new Date(form.value.startTime);
    const endTime = new Date(form.value.endTime);
    if (startTime >= endTime) {
      alert("開始時間が終了時間より後です。");
      return;
    }
    const scheduleEventService = container.resolve(ScheduleEventService);
    try {
      const baseParams = {
        startTime,
        endTime,
        folderId: form.value.folderId,
        displayDuration: form.value.displayDuration,
        transitionType: form.value.transitionType,
        slideDirection: form.value.slideDirection,
        bgmIds: form.value.bgmList.map((b: any) => b.id),
      } as const;

      if (props.event) {
        const params = new SlideshowEventParams({
          id: props.event.id,
          startTime: baseParams.startTime,
          endTime: baseParams.endTime,
          folderId: baseParams.folderId,
          displayDuration: baseParams.displayDuration,
          transitionType: baseParams.transitionType as any,
          slideDirection: baseParams.slideDirection as any,
          bgmIds: baseParams.bgmIds,
          processedAt: props.event.processedAt,
          registeredAt: props.event.registeredAt,
          updatedAt: new Date(),
        });
        const updated = SlideshowEvent.fromParams(params);
        await scheduleEventService.updateScheduleEvents([updated]);
      } else {
        const params = new SlideshowEventParams({
          id: "",
          startTime: baseParams.startTime,
          endTime: baseParams.endTime,
          folderId: baseParams.folderId,
          displayDuration: baseParams.displayDuration,
          transitionType: baseParams.transitionType as any,
          slideDirection: baseParams.slideDirection as any,
          bgmIds: baseParams.bgmIds,
          processedAt: null,
          registeredAt: new Date(),
          updatedAt: new Date(),
        });
        const tempEvent = SlideshowEvent.fromParams(params);
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

  return {
    form,
    isEdit,
    newBgmSource,
    selectedBgmId,
    newBgmFile,
    filteredAudioAssets,
    removeBgm,
    addExistingBgm,
    onBgmFileChange,
    bgmFileInput,
    openBgmFilePicker,
    clearBgmFile,
    addUploadBgm,
    onSubmit,
    onClose,
  };
}
