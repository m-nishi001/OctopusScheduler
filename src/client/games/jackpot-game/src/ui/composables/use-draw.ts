import { ref } from "vue";
import type { DrawResultDto } from "../../model/applications/dto/draw-result-dto";
import type { MemberDto } from "../../model/applications/dto/member-dto";
import type { PrizeDto } from "../../model/applications/dto/prize-dto";
import { DrawService } from "../../model/applications/draw-service";
import { ResultService } from "../../model/applications/result-service";
import { useRouter } from "vue-router";
import { container } from "tsyringe";

export function useDraw() {
  const loading = ref(false);
  const showResult = ref(false);
  const winners = ref<DrawResultDto[]>([]);
  const members = ref<MemberDto[]>([]);
  const prizes = ref<PrizeDto[]>([]);
  const router = useRouter();
  const drawService = container.resolve(DrawService);
  const resultService = container.resolve(ResultService);

  const executeDraw = async () => {
    loading.value = true;
    try {
      // 仮データ
      members.value = [
        { id: "1", name: "山田太郎", order: 1 },
        { id: "2", name: "佐藤花子", order: 2 },
        { id: "3", name: "鈴木一郎", order: 3 },
      ];
      prizes.value = [
        { id: "p1", name: "景品A", rank: 1, order: 1 },
        { id: "p2", name: "景品B", rank: 2, order: 2 },
        { id: "p3", name: "景品C", rank: 3, order: 3 },
      ];
      const drawRes = await drawService.executeDraw({
        prizes: prizes.value,
        members: members.value,
      });
      const resultRes = await resultService.getResult(drawRes.drawId);
      winners.value = resultRes?.results ?? [];
      showResult.value = true;
    } finally {
      loading.value = false;
    }
  };

  const goResult = () => router.push("/jackpot-result");

  const getMemberName = (memberId: string) => {
    const member = members.value.find((m) => m.id === memberId);
    return member ? member.name : memberId;
  };

  return { loading, showResult, winners, executeDraw, goResult, getMemberName };
}
