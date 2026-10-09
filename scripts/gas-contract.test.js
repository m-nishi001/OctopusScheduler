import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGasContract } from "./gas-contract.js";

test("handlerVariableNames: 接頭辞付き内部変数と、接頭辞なし関数(doGet等)の実装変数を含む", () => {
  const { handlerVariableNames, internalNames, unprefixed, ownerOf } = loadGasContract();
  for (const n of internalNames) assert.ok(handlerVariableNames.includes(n), n);
  // Cloudflare(ESM/strict)では宣言なし代入が ReferenceError になるため、doGet の実装変数も必要。
  assert.ok(unprefixed.length > 0);
  for (const name of unprefixed) {
    assert.ok(handlerVariableNames.includes(`_${ownerOf(name)}_${name}`), name);
  }
  assert.equal(new Set(handlerVariableNames).size, handlerVariableNames.length, "重複なし");
});
