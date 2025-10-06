import { ref } from "vue";
import { container } from "tsyringe";
import { MemberService } from "../../../model/applications/member-service";
import { PrizeService } from "../../../model/applications/prize-service";

export function useEntities() {
  const memberService = container.resolve(
    MemberService
  ) as unknown as MemberService;
  const prizeService = container.resolve(
    PrizeService
  ) as unknown as PrizeService;

  const members = ref<any[]>([]);
  const prizes = ref<any[]>([]);

  const fetchMembers = async () => {
    try {
      members.value = await memberService.fetchMembers();
    } catch (error) {
      console.error("Failed to fetch members:", error);
      members.value = [];
    }
  };

  const fetchPrizes = async () => {
    try {
      prizes.value = await prizeService.fetchPrizes();
    } catch (error) {
      console.error("Failed to fetch prizes:", error);
      prizes.value = [];
    }
  };

  return {
    members,
    prizes,
    fetchMembers,
    fetchPrizes,
  } as const;
}
