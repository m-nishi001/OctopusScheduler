import { ref, computed } from "vue";
import { container } from "tsyringe";
import { MemberRepository } from "@model/member/member-repository";
import { AssetDataService } from "@control/asset/asset-data-service";
import { MemberService } from "@control/member/member-service";
import { MemberDirectoryRepository } from "@octopus/member-directory";
import type { Member as DirectoryMember } from "@octopus/member-directory";
import type { MemberDto } from "@control/member/dto/member-dto";
import type { Asset } from "@model/asset/asset-data";

const STORAGE_KEY = "jackpot-game-members-json";

export interface MemberFormInput {
  /** 既存の共有マスタメンバーに紐付ける場合に指定する。新規作成時は省略する。 */
  id?: string;
  name: string;
  rank: number;
  photoAssetId?: string;
  /** アップロードモードで選択された、まだ保存されていないアセット。 */
  tempAsset?: Asset | null;
}

export function useMembers(
  memberRepoArg?: MemberRepository,
  assetDataServiceArg?: AssetDataService,
  memberServiceArg?: MemberService,
  directoryRepoArg?: MemberDirectoryRepository
) {
  const memberRepo = memberRepoArg || container.resolve(MemberRepository);
  const assetDataService =
    assetDataServiceArg || container.resolve(AssetDataService);
  const memberService = memberServiceArg || container.resolve(MemberService);
  const directoryRepo =
    directoryRepoArg || container.resolve(MemberDirectoryRepository);

  const members = ref<any[]>([]);
  /** 共有マスタに登録済みだが、まだこのゲームに紐付けていないメンバー。 */
  const availableDirectoryMembers = ref<DirectoryMember[]>([]);
  const selectedMembers = ref<string[]>([]);
  const deleting = ref(false);
  const deleteMessage = ref("");

  const objectUrlMap = new Map<string, string>();

  const isAllSelected = computed({
    get: () =>
      members.value.length > 0 &&
      selectedMembers.value.length === members.value.length,
    set: (val: boolean) => {
      selectedMembers.value = val ? members.value.map((m) => m.id) : [];
    },
  });

  const getMemberImageSrc = (member: any) =>
    member.photoAssetId ? objectUrlMap.get(member.photoAssetId) || "" : "";

  const saveMembersToLocalJson = async () => {
    try {
      // sanitize members before saving to avoid persisting preview object URLs
      const clean = (members.value || []).map((m) => {
        const copy: any = { ...m };
        if (copy.photoDataUrl) delete copy.photoDataUrl;
        for (const k of Object.keys(copy)) {
          const v = copy[k];
          if (typeof v === "string" && v.startsWith && v.startsWith("blob:")) {
            copy[k] = "";
          }
        }
        return copy;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (e) {
      console.error("Failed to save members JSON to localStorage", e);
    }
  };

  const fetchAvailableDirectoryMembers = async () => {
    try {
      const allDirectoryMembers = await directoryRepo.listMembers();
      const attachedIds = new Set(members.value.map((m) => m.id));
      availableDirectoryMembers.value = allDirectoryMembers.filter(
        (m) => !attachedIds.has(m.id)
      );
    } catch (error) {
      console.error("Failed to fetch available directory members:", error);
      availableDirectoryMembers.value = [];
    }
  };

  const fetchMembers = async () => {
    try {
      const fetchedMembers = await memberRepo.getMembers();
      for (const member of fetchedMembers) {
        if (member.photoAssetId) {
          const asset = await assetDataService.getAssetDataById(
            member.photoAssetId
          );
          if (asset && asset.id) {
            try {
              objectUrlMap.set(member.photoAssetId, URL.createObjectURL(asset.blob));
            } catch {
              /* ignore preview URL creation failures */
            }
          }
        }
      }
      members.value = fetchedMembers;
      await saveMembersToLocalJson();
      await fetchAvailableDirectoryMembers();
    } catch (error) {
      console.error("Failed to fetch members:", error);
      members.value = [];
    }
  };

  const addMember = async (input: MemberFormInput): Promise<MemberDto> => {
    const newMember: MemberDto = {
      id: input.id || "",
      name: input.name,
      rank: input.rank,
      photoAssetId: input.photoAssetId || undefined,
    };
    let previewBlob: Blob | undefined;
    if (input.tempAsset) {
      const uploaded = await assetDataService.addAssetData([input.tempAsset]);
      newMember.photoAssetId = uploaded[0].id;
      previewBlob = input.tempAsset.blob;
    }
    const addedMember = await memberService.saveMember(newMember);
    if (previewBlob && newMember.photoAssetId) {
      try {
        objectUrlMap.set(newMember.photoAssetId, URL.createObjectURL(previewBlob));
      } catch {
        /* ignore preview URL creation failures */
      }
    } else if (newMember.photoAssetId && !objectUrlMap.has(newMember.photoAssetId)) {
      try {
        const asset = await assetDataService.getAssetDataById(
          newMember.photoAssetId
        );
        if (asset && asset.blob) {
          try {
            objectUrlMap.set(newMember.photoAssetId, URL.createObjectURL(asset.blob));
          } catch {
            /* ignore preview URL creation failures */
          }
        }
      } catch {
        /* ignore lookup failures */
      }
    }
    members.value.push(addedMember);
    await saveMembersToLocalJson();
    return addedMember;
  };

  const updateMember = async (original: any, input: MemberFormInput) => {
    const updated: any = { ...original, name: input.name, rank: input.rank };
    if (input.tempAsset) {
      try {
        const uploaded = await assetDataService.addAssetData([input.tempAsset]);
        if (uploaded && uploaded[0] && uploaded[0].id) {
          updated.photoAssetId = uploaded[0].id;
        }
      } catch (e) {
        console.error("Failed to upload photo asset during edit:", e);
      }
    } else if (input.photoAssetId) {
      updated.photoAssetId = input.photoAssetId;
    }
    await memberRepo.updateMembers([{ id: updated.id, updateFn: () => updated }]);
    await fetchMembers();
    await saveMembersToLocalJson();
  };

  const deleteMember = async (id: string) => {
    deleting.value = true;
    deleteMessage.value = "メンバーをこのゲームから外しています...";
    try {
      await memberService.deleteMember(id);
      await fetchMembers();
      await saveMembersToLocalJson();
    } catch (error) {
      console.error("Failed to delete member:", error);
    } finally {
      deleting.value = false;
    }
  };

  const deleteSelectedMembers = async () => {
    if (!selectedMembers.value.length) return;
    deleting.value = true;
    deleteMessage.value = "メンバーをこのゲームから外しています...";
    try {
      await memberService.deleteMembers(selectedMembers.value);
      await fetchMembers();
      selectedMembers.value = [];
      await saveMembersToLocalJson();
    } catch (error) {
      console.error("Failed to delete members:", error);
    } finally {
      deleting.value = false;
    }
  };

  const exportFormatCsv = () => {
    const csv = "名前,ランク,写真ファイル名\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members_format.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const disposeObjectUrls = () => {
    try {
      for (const url of objectUrlMap.values()) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }
      objectUrlMap.clear();
    } catch {
      /* ignore */
    }
  };

  return {
    members,
    availableDirectoryMembers,
    selectedMembers,
    isAllSelected,
    deleting,
    deleteMessage,
    getMemberImageSrc,
    fetchMembers,
    addMember,
    updateMember,
    deleteMember,
    deleteSelectedMembers,
    exportFormatCsv,
    disposeObjectUrls,
  };
}
