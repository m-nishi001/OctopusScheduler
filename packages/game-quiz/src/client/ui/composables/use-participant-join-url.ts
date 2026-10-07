import { onMounted, ref } from "vue";
import { container } from "tsyringe";
import { GetWebAppUrlUseCase } from "../../control/use-cases/get-web-app-url-use-case";
import {
  buildParticipantJoinUrl,
  buildParticipantJoinUrlFromBase,
} from "../../model/participant-url";

/**
 * QRコードに埋め込む参加者用URL。まずwindow.location基準で即座に表示し、
 * サーバーからWebアプリの公開URLを取得できたらそれに差し替える。
 */
export function useParticipantJoinUrl(
  quizId: string,
  deps?: { useCase?: Pick<GetWebAppUrlUseCase, "execute"> }
) {
  const joinUrl = ref(buildParticipantJoinUrl(quizId));

  onMounted(async () => {
    const useCase = deps?.useCase ?? container.resolve(GetWebAppUrlUseCase);
    const baseUrl = await useCase.execute();
    joinUrl.value = buildParticipantJoinUrlFromBase(quizId, baseUrl);
  });

  return { joinUrl };
}
