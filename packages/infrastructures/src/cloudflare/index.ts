/**
 * Cloudflare Worker のエントリポイント。
 *
 * GAS版(gas/index.ts)と異なり、esbuildのbanner/footerによるグローバル関数
 * 生成は不要(Workersは通常のESMを実行できるため)。各機能パッケージが
 * `server/endpoints.ts` からexportする `X_HANDLERS`/`X_PREFIX` を直接importし、
 * `${prefix}_${name}` をキーとするルートテーブルを組み立てて `/rpc` へのPOSTを
 * ディスパッチする。このキー形式は `createTypedApiClient` がクライアント側で
 * 生成する呼び出し名(`interfaces/typed-api-client.ts`)と完全に一致する。
 *
 * 静的アセット(Vueクライアント)は `env.ASSETS` バインディング経由でそのまま
 * 配信する(GASの `doGet`/HtmlService に相当)。
 */
import "reflect-metadata";
import { registerCloudflareInfrastructures } from "./container";
import { runWithRequestEnv } from "./request-context";
import type { CloudflareEnv } from "./env";

import { QUIZ_GAME_PREFIX, QUIZ_GAME_HANDLERS } from "@octopus/game-quiz/server";
import { JACKPOT_GAME_PREFIX, JACKPOT_GAME_HANDLERS } from "@octopus/game-jackpot/server";
import { OCTOPUS_SCHEDULER_PREFIX, OCTOPUS_SCHEDULER_HANDLERS } from "@octopus/app-scheduler/server";
import { MEMBER_DIRECTORY_PREFIX, MEMBER_DIRECTORY_HANDLERS } from "@octopus/member-directory/server";

type Handler = (args: unknown) => Promise<string>;

const ROUTES: Record<string, Handler> = {};

function mount(prefix: string, handlers: Record<string, Handler>): void {
  for (const [name, fn] of Object.entries(handlers)) {
    ROUTES[`${prefix}_${name}`] = fn;
  }
}

mount(QUIZ_GAME_PREFIX, QUIZ_GAME_HANDLERS);
mount(JACKPOT_GAME_PREFIX, JACKPOT_GAME_HANDLERS);
mount(OCTOPUS_SCHEDULER_PREFIX, OCTOPUS_SCHEDULER_HANDLERS);
mount(MEMBER_DIRECTORY_PREFIX, MEMBER_DIRECTORY_HANDLERS);

registerCloudflareInfrastructures();

interface RpcRequestBody {
  name: string;
  args?: unknown;
}

async function handleRpc(request: Request): Promise<Response> {
  let body: RpcRequestBody;
  try {
    body = await request.json<RpcRequestBody>();
  } catch {
    return Response.json({ status: "error", message: "Invalid JSON body" }, { status: 400 });
  }

  const handler = ROUTES[body.name];
  if (!handler) {
    return Response.json({ status: "error", message: `Unknown endpoint: ${body.name}` }, { status: 404 });
  }

  const responseJson = await handler(body.args);
  return new Response(responseJson, { headers: { "Content-Type": "application/json" } });
}

export default {
  async fetch(request: Request, env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> {
    return runWithRequestEnv(env, async () => {
      const url = new URL(request.url);
      if (url.pathname === "/rpc" && request.method === "POST") {
        return handleRpc(request);
      }
      return env.ASSETS.fetch(request);
    });
  },
};
