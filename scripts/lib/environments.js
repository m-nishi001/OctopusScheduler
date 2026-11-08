/**
 * Cloudflare にデプロイする環境(dev / staging / prod)の定義。純粋なデータ表と、それを検証・展開する純粋関数。
 *
 * 各環境は Worker・D1・R2・Durable Object・レート制限がすべて別で、互いに影響しない。
 * URL は `https://<workerName>.<アカウントのサブドメイン>.workers.dev`。
 * 独自ドメインを使う場合は環境変数 `customDomainEnv` に値を入れたときだけ routes を出力する(ドメインはリポジトリに書かない)。
 */

/** 環境どうしで重ならない必要がある値の一覧(検証で使う)。 */
const UNIQUE_KEYS = ["workerName", "d1Name", "bucket", "tomlName"];

/** テンプレート(wrangler.example.toml)にあるレート制限の namespace_id。環境ごとの値に置き換える。 */
export const TEMPLATE_RATELIMIT_IDS = ["1001", "1002"];

/** 以前 staging のバケットに付けていた自動削除ルール名(staging には付けず、残っていれば外す)。 */
export const LEGACY_STAGING_RULE = "staging-autoclean";
/** dev のバケットに付ける自動削除ルール名。 */
export const AUTOCLEAN_RULE = "dev-autoclean";

export const ENVIRONMENTS = {
  dev: {
    name: "dev",
    workerName: "octopus-scheduler-dev",
    d1Name: "octopus-scheduler-dev-db",
    bucket: "octopus-scheduler-dev-assets",
    ratelimitIds: ["3001", "3002"],
    tomlName: "wrangler.dev.toml",
    seed: true,
    autoclean: true,
    removeLegacyAutoclean: false,
    confirmDown: false,
    customDomainEnv: "OCTOPUS_DOMAIN_DEV",
  },
  staging: {
    name: "staging",
    workerName: "octopus-scheduler-staging",
    d1Name: "octopus-scheduler-staging-db",
    bucket: "octopus-scheduler-staging-assets",
    ratelimitIds: ["2001", "2002"],
    tomlName: "wrangler.staging.toml",
    seed: true,
    autoclean: false,
    removeLegacyAutoclean: true,
    confirmDown: false,
    customDomainEnv: "OCTOPUS_DOMAIN_STAGING",
  },
  prod: {
    name: "prod",
    workerName: "octopus-scheduler",
    d1Name: "octopus-scheduler-db",
    bucket: "octopus-scheduler-assets",
    ratelimitIds: ["1001", "1002"],
    tomlName: "wrangler.prod.toml",
    seed: false,
    autoclean: false,
    removeLegacyAutoclean: false,
    confirmDown: true,
    customDomainEnv: "OCTOPUS_DOMAIN_PROD",
  },
};

/** 環境名から定義を返す。未知の名前は例外。 */
export function getEnvironment(name, table = ENVIRONMENTS) {
  const env = Object.hasOwn(table, name) ? table[name] : undefined;
  if (!env) throw new Error(`不明な環境: ${name}(${Object.keys(table).join(" / ")})`);
  return env;
}

/**
 * 表の整合性を検証する(違反があれば例外)。
 *  - Worker 名・D1 名・バケット名・設定ファイル名・レート制限 ID が環境どうしで重ならない
 *  - prod はテストデータを投入せず、R2 の自動削除もせず、削除時に確認を求める
 */
export function validateEnvironments(table = ENVIRONMENTS) {
  const envs = Object.values(table);
  for (const key of UNIQUE_KEYS) assertUnique(envs.map((e) => [e.name, e[key]]), key);
  assertUnique(envs.flatMap((e) => e.ratelimitIds.map((id) => [e.name, id])), "ratelimitIds");
  for (const e of envs) {
    if (e.ratelimitIds.length !== TEMPLATE_RATELIMIT_IDS.length) throw new Error(`${e.name}: ratelimitIds は ${TEMPLATE_RATELIMIT_IDS.length} 個必要です`);
  }
  const prod = table.prod;
  if (prod) {
    if (prod.seed) throw new Error("prod はテストデータを投入できません(seed: false)");
    if (prod.autoclean) throw new Error("prod は R2 の自動削除を付けられません(autoclean: false)");
    if (!prod.confirmDown) throw new Error("prod は削除時に Worker 名の入力確認が必要です(confirmDown: true)");
  }
  return table;
}

function assertUnique(pairs, label) {
  const seen = new Map();
  for (const [envName, value] of pairs) {
    if (seen.has(value)) throw new Error(`${label} '${value}' が ${seen.get(value)} と ${envName} で重複しています`);
    seen.set(value, envName);
  }
}

// 読み込み時に検証して、表の書き間違いをすぐ見つける。
validateEnvironments();

/** R2 の自動削除に対する操作: 付ける / 残っていれば外す / 何もしない。 */
export function lifecyclePolicy(env) {
  if (env.autoclean) return "add";
  if (env.removeLegacyAutoclean) return "remove";
  return "none";
}

/** 独自ドメイン(あれば)。環境変数 `customDomainEnv` が空なら null。 */
export function resolveCustomDomain(env, processEnv = process.env) {
  const value = env.customDomainEnv ? processEnv[env.customDomainEnv]?.trim() : "";
  return value ? value : null;
}

/**
 * wrangler.example.toml を環境用に変える(Worker 名・レート制限の namespace_id・任意で routes)。
 * D1/R2 のプレースホルダは残す(setup() が実リソースで埋める)。
 */
export function toEnvTemplate(template, env, { domain = null } = {}) {
  const routes = domain ? `\nroutes = [{ pattern = "${domain}", custom_domain = true }]` : "";
  let out = template.replace(/^name\s*=\s*"[^"]+"/m, `name = "${env.workerName}"${routes}`);
  TEMPLATE_RATELIMIT_IDS.forEach((from, i) => {
    out = out.replace(`namespace_id = "${from}"`, `namespace_id = "${env.ratelimitIds[i]}"`);
  });
  return out;
}

/** コマンドがその環境で許可されるか(prod はテストデータの投入を拒否)。 */
export function assertCommandAllowed(env, command) {
  if (!["up", "seed", "down"].includes(command)) throw new Error("使い方: node scripts/cf-env.js <dev|staging|prod> <up|seed|down> [--no-seed|--with-results]");
  if (command === "seed" && !env.seed) throw new Error(`${env.name} にはテストデータを投入できません`);
}

/** 削除時に Worker 名の入力確認が必要か。 */
export function requiresTypedConfirmation(env) {
  return env.confirmDown;
}

/** 入力された文字列が削除の確認として正しいか(確認が不要な環境は常に true)。 */
export function isDownConfirmed(env, typed) {
  return !requiresTypedConfirmation(env) || (typeof typed === "string" && typed.trim() === env.workerName);
}
