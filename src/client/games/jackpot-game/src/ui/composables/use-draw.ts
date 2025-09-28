import { ref } from "vue";
import type { LotteryResultDto } from "../../model/applications/dto/lottery-result-dto";
import type { MemberDto } from "../../model/applications/dto/member-dto";
import { DrawService } from "../../model/applications/draw-service";
import { ResultService } from "../../model/applications/result-service";
import { useRouter } from "vue-router";
import { container } from "tsyringe";

export function useDraw() {
  const loading = ref(false);
  const showResult = ref(false);
  const winners = ref<LotteryResultDto[]>([]);
  const members = ref<MemberDto[]>([]);
  const router = useRouter();
  const drawService = container.resolve(DrawService);
  const resultService = container.resolve(ResultService);

  const executeDraw = async () => {
    loading.value = true;
    try {
      const drawRes = await drawService.executeDraw({
        drawName: "抽選",
        candidateIds: ["1", "2", "3"],
        winnerCount: 1,
      });
      const resultRes = await resultService.getResult(drawRes.drawId);
      winners.value = resultRes?.results ?? [];
      // 仮: メンバー情報を取得するAPI呼び出し（本来はServiceから取得）
      members.value = [
        { id: "1", name: "山田太郎", order: 1 },
        { id: "2", name: "佐藤花子", order: 2 },
        { id: "3", name: "鈴木一郎", order: 3 },
      ];
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
