import { ref } from "vue";
import type { Ref } from "vue";
import type { Member, MemberPhotoCache } from "@octopus/accounts";

/**
 * 名簿の顔写真を、メンバーIDから引く。名簿は1回読み込んで使い回し、知らないメンバーが来たとき
 * (名簿が増えた可能性があるとき)だけ読み直す。写真の中身は共通のキャッシュ(ハッシュ別・端末内)を通す。
 * 写真が無い・取れないメンバーは undefined(呼び出し側が頭文字のアバターを出す)。
 */
export function useRosterPhotos(
  roster: { listMembers(): Promise<Member[]> },
  cache: MemberPhotoCache
): { urlOf: (memberId: string) => string | undefined; ensure: (memberIds: string[]) => Promise<void>; version: Ref<number> } {
  let photoByMember: Map<string, string | undefined> | null = null;
  /** 写真が読み込めるたびに進める。これを読んだ computed が、新しい写真で更新される。 */
  const version = ref(0);

  async function memberPhotos(wanted: string[]): Promise<Map<string, string | undefined>> {
    if (!photoByMember || wanted.some((id) => !photoByMember!.has(id))) {
      photoByMember = new Map((await roster.listMembers()).map((m) => [m.id, m.photo]));
    }
    return photoByMember;
  }

  return {
    version,
    urlOf: (memberId) => cache.get(photoByMember?.get(memberId)),
    ensure: async (memberIds) => {
      try {
        const photos = await memberPhotos(memberIds);
        await cache.ensure(memberIds.map((id) => photos.get(id)));
      } catch {
        return; // 名簿が読めなければ、次の機会に取り直す(写真は飾りなので、画面は止めない)
      }
      version.value++;
    },
  };
}
