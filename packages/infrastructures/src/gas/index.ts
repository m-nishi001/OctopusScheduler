/**
 * GAS バンドルのエントリポイント。
 *
 * 各エンドポイントモジュールは `GAS_ENDPOINTS` の接頭辞ごとのグローバルハンドラ
 * (`_<prefix>_<name>`)へ関数を代入する副作用モジュール。バンドルに含めるため、
 * ここで各機能パッケージの `/server` を読み込む。
 *
 * `doGet` を含む公開する GAS グローバル関数名の一覧は、各機能パッケージが
 * 自分のエンドポイント名一覧を公開し、esbuild がそれらを集約して banner/footer
 * を生成する(scripts/gas-contract.js)。
 */
import "reflect-metadata";
import { registerGasInfrastructures } from "./container";

registerGasInfrastructures();

import "@octopus/game-quiz/server";
import "@octopus/game-jackpot/server";
// TODO(migration): app-scheduler の /server 移行が完了したら復活させる。
// import "@octopus/app-scheduler/server";
