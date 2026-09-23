/**
 * `IApiClient` を、契約インターフェース `TApi` の形に見せかける型付きAPIクライアント。
 *
 * `callXxxGame(apiClient, "methodName", args)` のように呼び出し名を文字列で
 * 渡す代わりに、`xxxApi.methodName(args)` という直接の関数呼び出しの見た目に
 * するための薄いProxy。実体は変わらず `apiClient.call(`${prefix}_methodName`, ...)`
 * を呼ぶだけであり、GAS(`google.script.run`)・将来のCloudflare(`fetch`)いずれの
 * `IApiClient` 実装の上でも同じように機能する。
 */
import type { ApiCallOptions, IApiClient } from "./api-client";

type ApiMethod = (arg?: unknown, options?: ApiCallOptions) => Promise<unknown>;

/**
 * `endpointNames` に無いプロパティへのアクセスは例外にする。契約にないメソッドを
 * `as any` で呼び出すような迂回をタイプミスも含めて実行時にも検出するため。
 *
 * `TApi` は具体的なエンドポイント契約インターフェース(例: `JackpotGameApi`)を
 * 想定しており、通常のインターフェースはインデックスシグネチャを持たないため、
 * `Record<string, ApiMethod>` のような制約は付けない(付けると全ての契約側
 * インターフェースがそれを満たせなくなってしまう)。
 */
export function createTypedApiClient<TApi extends object>(
  apiClient: IApiClient,
  prefix: string,
  endpointNames: readonly (keyof TApi & string)[]
): TApi {
  const allowed = new Set<string>(endpointNames);
  const methodCache = new Map<string, ApiMethod>();

  return new Proxy({} as TApi, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol") {
        return Reflect.get(target, prop, receiver);
      }
      if (!allowed.has(prop)) {
        throw new Error(
          `Unknown ${prefix} endpoint: "${prop}". Check the endpoint contract for available endpoints.`
        );
      }
      let fn = methodCache.get(prop);
      if (!fn) {
        fn = (arg?: unknown, options?: ApiCallOptions) =>
          apiClient.call(`${prefix}_${prop}`, arg, options);
        methodCache.set(prop, fn);
      }
      return fn;
    },
    has(_target, prop) {
      return typeof prop === "string" && allowed.has(prop);
    },
  });
}
