import { ref } from "vue";
import { container } from "tsyringe";
import { ScreenConfigService } from "../../../model/applications/screen-config-service";

export function useScreenConfigs() {
  const screenConfigService = container.resolve(
    ScreenConfigService
  ) as unknown as ScreenConfigService;

  const loading = ref(false);
  const loadingStatus = ref("");

  const homeConfig = ref<any>({
    id: "",
    bgmMode: "select",
    bgmAssetId: "",
    buttonSeMode: "select",
    buttonSeAssetId: "",
    progressSeMode: "select",
    progressSeAssetId: "",
  });
  const openingConfig = ref<any>({
    id: "",
    bgmMode: "select",
    bgmAssetId: "",
    displayMode: "list",
    contents: [],
  });
  const descriptionConfig = ref<any>({ id: "", slides: [] });
  const demoConfig = ref<any>({
    id: "",
    winnerMemberId: "",
    winnerPrizeId: "",
    bgmMode: "select",
    bgmAssetId: "",
    seMode: "select",
    seAssetId: "",
  });
  const mainConfig = ref<any>({
    id: "",
    bgmMode: "select",
    bgmAssetId: "",
    memberSeMode: "select",
    memberSeAssetId: "",
    prizeStartSeMode: "select",
    prizeStartSeAssetId: "",
    lotterySeMode: "select",
    lotterySeAssetId: "",
    confirmSeMode: "select",
    confirmSeAssetId: "",
    winnerSeMode: "select",
    winnerSeAssetId: "",
    nextSeMode: "select",
    nextSeAssetId: "",
    halfSeMode: "select",
    halfSeAssetId: "",
    endSeMode: "select",
    endSeAssetId: "",
  });
  const resultConfig = ref<any>({
    id: "",
    bgmMode: "select",
    bgmAssetId: "",
    scrollSeMode: "select",
    scrollSeAssetId: "",
    highSeMode: "select",
    highSeAssetId: "",
    lowSeMode: "select",
    lowSeAssetId: "",
    fadeSeMode: "select",
    fadeSeAssetId: "",
  });

  const loadScreenConfigs = async () => {
    try {
      loadingStatus.value = "画面設定を読み込み中...";
      const screenTypes = [
        "home",
        "opening",
        "description",
        "demo",
        "main",
        "result",
      ];
      // For admin UI we want the raw stored config (placeholders like {asset:ID} preserved)
      const results = await Promise.all(
        screenTypes.map((type) =>
          // request without resolving assets so admin shows placeholders
          // (ScreenConfigService.fetchScreenConfigWithOptions returns resolved or raw)
          // default runtime consumers can still call fetchScreenConfig(...) which resolves assets
          (screenConfigService as any).fetchScreenConfigWithOptions(type, {
            resolveAssets: false,
          })
        )
      );

      results.forEach((config: any, idx: number) => {
        const type = screenTypes[idx];
        if (type === "home") {
          homeConfig.value = {
            id: config.id || "",
            bgmMode: config.bgmAssetId ? "select" : "select",
            bgmAssetId: config.bgmAssetId || "",
            buttonSeMode: "select",
            buttonSeAssetId: config.seAssetIds?.[0] || "",
            progressSeMode: "select",
            progressSeAssetId: config.seAssetIds?.[1] || "",
          };
        } else if (type === "opening") {
          openingConfig.value = {
            id: config.id || "",
            bgmMode: config.bgmAssetId ? "select" : "select",
            bgmAssetId: config.bgmAssetId || "",
            displayMode: config.displayMode || "list",
            contents: config.elements.map((el: any) => ({
              id: el.id,
              type: el.type,
              text: el.content || "",
              content: el.content || "",
              assetId: el.assetId || "",
              imageMode: "select",
              seMode: "select",
              effect: el.animation?.type || "fade",
              duration: el.animation?.duration || 1000,
              scrollDirection: el.animation?.scrollDirection || "up",
              seAssetId: "",
            })),
          };
        } else if (type === "description") {
          descriptionConfig.value = {
            id: config.id || "",
            slides: config.elements.map((el: any, idx2: number) => ({
              id: el.id,
              html: el.content || "",
              imageAssetId: el.assetId || "",
              imageMode: el.assetId ? "select" : "select",
              effect: el.animation?.type || "fade",
              duration: el.animation?.duration || 1000,
              bgmAssetId: (config.seAssetIds && config.seAssetIds[idx2]) || "",
              bgmMode:
                config.seAssetIds && config.seAssetIds[idx2]
                  ? "select"
                  : "select",
            })),
          };
        } else if (type === "demo") {
          demoConfig.value = {
            id: config.id || "",
            winnerMemberId: "",
            winnerPrizeId: "",
            bgmMode: config.bgmAssetId ? "select" : "select",
            bgmAssetId: config.bgmAssetId || "",
            seMode: "select",
            seAssetId: config.seAssetIds?.[0] || "",
          };
        } else if (type === "main") {
          mainConfig.value = {
            id: config.id || "",
            bgmMode: config.bgmAssetId ? "select" : "select",
            bgmAssetId: config.bgmAssetId || "",
            memberSeMode: "select",
            memberSeAssetId: config.seAssetIds?.[0] || "",
            prizeStartSeMode: "select",
            prizeStartSeAssetId: config.seAssetIds?.[1] || "",
            lotterySeMode: "select",
            lotterySeAssetId: config.seAssetIds?.[2] || "",
            confirmSeMode: "select",
            confirmSeAssetId: config.seAssetIds?.[3] || "",
            winnerSeMode: "select",
            winnerSeAssetId: config.seAssetIds?.[4] || "",
            nextSeMode: "select",
            nextSeAssetId: config.seAssetIds?.[5] || "",
            halfSeMode: "select",
            halfSeAssetId: config.seAssetIds?.[6] || "",
            endSeMode: "select",
            endSeAssetId: config.seAssetIds?.[7] || "",
          };
        } else if (type === "result") {
          resultConfig.value = {
            id: config.id || "",
            bgmMode: "select",
            bgmAssetId: config.bgmAssetId || "",
            scrollSeMode: "select",
            scrollSeAssetId: config.seAssetIds?.[0] || "",
            highSeMode: "select",
            highSeAssetId: config.seAssetIds?.[1] || "",
            lowSeMode: "select",
            lowSeAssetId: config.seAssetIds?.[2] || "",
            fadeSeMode: "select",
            fadeSeAssetId: config.seAssetIds?.[3] || "",
          };
        }
      });
    } catch (error) {
      console.error("Failed to load screen configs:", error);
    }
  };

  const updateHomeConfig = (config: any) => {
    homeConfig.value = config;
  };
  const updateOpeningConfig = (config: any) => {
    openingConfig.value = config;
  };
  const updateDescriptionConfig = (config: any) => {
    descriptionConfig.value = config;
  };
  const updateDemoConfig = (config: any) => {
    demoConfig.value = config;
  };
  const updateMainConfig = (config: any) => {
    mainConfig.value = config;
  };
  const updateResultConfig = (config: any) => {
    resultConfig.value = config;
  };

  const saveConfigs = async () => {
    const configs = [
      {
        id: homeConfig.value.id,
        type: "home" as const,
        bgmAssetId: homeConfig.value.bgmAssetId || undefined,
        seAssetIds: [
          homeConfig.value.buttonSeAssetId,
          homeConfig.value.progressSeAssetId,
        ].filter((id: any) => id),
        backgroundStyle: "",
        elements: [],
      },
      {
        id: openingConfig.value.id,
        type: "opening" as const,
        bgmAssetId: openingConfig.value.bgmAssetId || undefined,
        seAssetIds: openingConfig.value.contents.flatMap((c: any) =>
          c.seAssetId ? [c.seAssetId] : []
        ),
        backgroundStyle: "",
        displayMode: openingConfig.value.displayMode || "list",
        elements: openingConfig.value.contents.map((content: any) => ({
          type: content.type as any,
          content:
            content.type === "html"
              ? content.content || content.text
              : content.text,
          assetId: content.assetId,
          animation: {
            type: content.effect as any,
            duration: content.duration,
            scrollDirection: content.scrollDirection,
          },
        })),
      },
      {
        id: descriptionConfig.value.id,
        type: "description" as const,
        bgmAssetId: undefined,
        seAssetIds: descriptionConfig.value.slides.flatMap((s: any) =>
          s.bgmAssetId ? [s.bgmAssetId] : []
        ),
        backgroundStyle: "",
        elements: descriptionConfig.value.slides.map((slide: any) => ({
          type: "text" as const,
          content: slide.html,
          assetId: slide.imageAssetId,
          animation: { type: slide.effect as any, duration: slide.duration },
        })),
      },
      {
        id: demoConfig.value.id,
        type: "demo" as const,
        bgmAssetId: demoConfig.value.bgmAssetId || undefined,
        seAssetIds: demoConfig.value.seAssetId
          ? [demoConfig.value.seAssetId]
          : [],
        backgroundStyle: "",
        elements: [],
      },
      {
        id: mainConfig.value.id,
        type: "main" as const,
        bgmAssetId: mainConfig.value.bgmAssetId || undefined,
        seAssetIds: [
          mainConfig.value.memberSeAssetId,
          mainConfig.value.prizeStartSeAssetId,
          mainConfig.value.lotterySeAssetId,
          mainConfig.value.confirmSeAssetId,
          mainConfig.value.winnerSeAssetId,
          mainConfig.value.nextSeAssetId,
          mainConfig.value.halfSeAssetId,
          mainConfig.value.endSeAssetId,
        ].filter((id: any) => id),
        backgroundStyle: "",
        elements: [],
      },
      {
        id: resultConfig.value.id,
        type: "result" as const,
        bgmAssetId: resultConfig.value.bgmAssetId || undefined,
        seAssetIds: [
          resultConfig.value.scrollSeAssetId,
          resultConfig.value.highSeAssetId,
          resultConfig.value.lowSeAssetId,
          resultConfig.value.fadeSeAssetId,
        ].filter((id: any) => id),
        backgroundStyle: "",
        elements: [],
      },
    ];

    await screenConfigService.saveScreenConfigs(configs as any);
    await screenConfigService.syncScreenConfigs();
    await loadScreenConfigs();
  };

  return {
    loading,
    loadingStatus,
    homeConfig,
    openingConfig,
    descriptionConfig,
    demoConfig,
    mainConfig,
    resultConfig,
    loadScreenConfigs,
    updateHomeConfig,
    updateOpeningConfig,
    updateDescriptionConfig,
    updateDemoConfig,
    updateMainConfig,
    updateResultConfig,
    saveConfigs,
  } as const;
}
