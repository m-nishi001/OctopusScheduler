import { onMounted, ref } from "vue";
import { container } from "tsyringe";
import { GetWebAppUrlUseCase } from "../../control/use-cases/get-web-app-url-use-case";
import { IssueJoinTokenUseCase } from "../../control/use-cases/issue-join-token-use-case";
import {
  buildParticipantJoinUrl,
  buildParticipantJoinUrlFromBase,
  withJoinToken,
} from "../../model/participant-url";
import type { QuizSession } from "../../model/quiz-session";

/**
 * QRコードに埋め込む参加者用URL。参加トークンを取得してから組み立てるため、
 * 取得できるまでは空文字(QRは表示しない)。rotate=trueはQR表示(セッション開始)時で、
 * 新しいトークンに切り替えて以前のURL/QRを無効にする。出題画面などは false で現在のトークンを使う。
 * サーバーからWebアプリの公開URLを取得できればそれを基点にする。
 */
export function useParticipantJoinUrl(
  quizId: string,
  session: Pick<QuizSession, "scope" | "joinUrlQuery">,
  options: { rotate: boolean },
  deps?: {
    useCase?: Pick<GetWebAppUrlUseCase, "execute">;
    issueJoinToken?: Pick<IssueJoinTokenUseCase, "execute">;
  }
) {
  const joinUrl = ref("");
  const errorMessage = ref<string | null>(null);

  onMounted(async () => {
    try {
      const issue = deps?.issueJoinToken ?? container.resolve(IssueJoinTokenUseCase);
      const joinToken = await issue.execute(quizId, session.scope, options.rotate);
      const query = withJoinToken(session.joinUrlQuery, joinToken);
      joinUrl.value = buildParticipantJoinUrl(quizId, query);
      const useCase = deps?.useCase ?? container.resolve(GetWebAppUrlUseCase);
      const baseUrl = await useCase.execute();
      joinUrl.value = buildParticipantJoinUrlFromBase(quizId, query, baseUrl);
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : String(e);
    }
  });

  return { joinUrl, errorMessage };
}
