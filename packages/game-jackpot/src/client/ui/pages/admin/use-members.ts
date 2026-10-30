import { ref, computed } from "vue";
import { container } from "tsyringe";
import { MemberRepository } from "@model/member/member-repository";
import { MemberService } from "@control/member/member-service";
import { AccountsRepository, MemberPhotoCache } from "@octopus/accounts";
import type { Member as DirectoryMember } from "@octopus/accounts";
import type { MemberDto } from "@control/member/dto/member-dto";

const STORAGE_KEY = "jackpot-game-members-json";

export interface MemberFormInput {
  /** 既存の共有マスタメンバーに紐付ける場合に指定する。新規作成時は省略する。 */
  id?: string;
  name: string;
  rank: number;
  /** 当選しやすさ(1〜100)。省略時は既定値。 */
  weight?: number;
}

/** メンバーの管理画面の状態と操作(一覧・選択・削除・アカウントの名簿からの取り込み)。 */
export function useMembers(
  memberRepoArg?: MemberRepository,
  memberServiceArg?: MemberService,
  directoryRepoArg?: AccountsRepository
) {
  const memberRepo = memberRepoArg || container.resolve(MemberRepository);
  const memberService = memberServiceArg || container.resolve(MemberService);
  const directoryRepo =
    directoryRepoArg || container.resolve(AccountsRepository);
  const photos = container.resolve(MemberPhotoCache);

  const members = ref<any[]>([]);
  /** 共有マスタに登録済みだが、まだこのゲームに紐付けていないメンバー。 */
  const availableDirectoryMembers = ref<DirectoryMember[]>([]);
  const selectedMembers = ref<string[]>([]);
  const deleting = ref(false);
  const deleteMessage = ref("");

  /** 写真が読み込めるたびに進める(一覧の再描画のきっかけ)。 */
  const photoTick = ref(0);

  const isAllSelected = computed({
    get: () =>
      members.value.length > 0 &&
      selectedMembers.value.length === members.value.length,
    set: (val: boolean) => {
      selectedMembers.value = val ? members.value.map((m) => m.id) : [];
    },
  });

  /** 顔写真の表示用URL(共通の名簿の写真。読み込み前・写真なしは空)。 */
  const getMemberImageSrc = (member: any) => {
    void photoTick.value;
    return photos.get(member.photo) ?? "";
  };

  const saveMembersToLocalJson = async () => {
    try {
      // sanitize members before saving to avoid persisting preview object URLs
      const clean = (members.value || []).map((m) => {
        const copy: any = { ...m };
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
      members.value = fetchedMembers;
      void photos.ensure(fetchedMembers.map((m) => m.photo)).then(() => photoTick.value++);
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
      weight: input.weight,
    };
    const addedMember = await memberService.saveMember(newMember);
    members.value.push(addedMember);
    await saveMembersToLocalJson();
    return addedMember;
  };

  const updateMember = async (original: any, input: MemberFormInput) => {
    const updated: any = { ...original, name: input.name, rank: input.rank, weight: input.weight };
    await memberRepo.updateMembers([{ id: updated.id, updateFn: () => updated }]);
    await fetchMembers();
    await saveMembersToLocalJson();
  };

  const deleteMember = async (id: string) => {
    deleting.value = true;
    deleteMessage.value = "メンバーの設定(ランク・当選しやすさ)を初期値に戻しています...";
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
    deleteMessage.value = "メンバーの設定(ランク・当選しやすさ)を初期値に戻しています...";
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
    const csv = members.value.length
      ? "id,rank,weight\n" + members.value.map((m) => `"${String(m.id).replace(/"/g, '""')}",${m.rank},${m.weight ?? ""}`).join("\n") + "\n"
      : "id,rank,weight\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members_format.csv";
    a.click();
    URL.revokeObjectURL(url);
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
  };
}
