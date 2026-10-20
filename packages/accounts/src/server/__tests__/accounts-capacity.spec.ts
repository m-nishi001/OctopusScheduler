import { describe, it, expect } from "vitest";
import { GAS_LIKE_LIMITS, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { StorageCapacityError } from "@octopus/infrastructures/interfaces";
import { addMember, getRosterUsage, listMembers, replaceAllMembers } from "../accounts-use-cases";
import type { AccountsUseCaseDeps } from "../accounts-use-cases";

/** GAS の ScriptProperty と同じ容量の上限をかけた保存先。名簿は1つの値(約9KB)に入れる。 */
function createGasLikeDeps(): AccountsUseCaseDeps {
  let counter = 0;
  return { storage: new InMemoryKeyValueStorage(GAS_LIKE_LIMITS), generateId: () => `generated-${++counter}` };
}

/** 実運用に近い名簿の1人(日本語の名前・半角のID)。 */
const person = (i: number) => ({ id: `member-${String(i).padStart(3, "0")}`, name: `参加者の名前${i}` });

describe("GAS の容量の上限での名簿", () => {
  it("50人は余裕で登録でき、使用量は上限の半分以下", async () => {
    const deps = createGasLikeDeps();
    for (let i = 0; i < 50; i++) await addMember(deps, person(i));
    const usage = await getRosterUsage(deps);
    expect(usage.members).toBe(50);
    expect(usage.maxBytes).toBe(GAS_LIKE_LIMITS.maxScalarBytes);
    expect(usage.usedBytes).toBeLessThan(usage.maxBytes! / 2);
  });

  it("上限を超える登録は、原因の分かる容量エラーで断り、登録済みの名簿は壊れない", async () => {
    const deps = createGasLikeDeps();
    let added = 0;
    let failure: unknown = null;
    for (let i = 0; i < 400 && failure === null; i++) {
      try {
        await addMember(deps, person(i));
        added++;
      } catch (e) {
        failure = e;
      }
    }
    expect(failure).toBeInstanceOf(StorageCapacityError);
    expect((failure as Error).message).toContain("上限");
    expect(added).toBeGreaterThan(100); // 100人以上は入る
    expect(await listMembers(deps)).toHaveLength(added); // 失敗した登録は反映されず、それまでの名簿はそのまま
  });

  it("一括の取り込みが上限を超えるときも、容量エラーで断り、名簿は元のまま", async () => {
    const deps = createGasLikeDeps();
    await addMember(deps, person(0));
    const tooMany = Array.from({ length: 400 }, (_, i) => person(i + 1));
    await expect(replaceAllMembers(deps, tooMany)).rejects.toBeInstanceOf(StorageCapacityError);
    expect(await listMembers(deps)).toEqual([person(0)]);
  });

  it("上限の無い保存先では、上限なし(null)として使用量を返す", async () => {
    const deps: AccountsUseCaseDeps = { storage: new InMemoryKeyValueStorage(), generateId: () => "x" };
    await addMember(deps, person(1));
    expect(await getRosterUsage(deps)).toEqual({ members: 1, usedBytes: expect.any(Number), maxBytes: null });
  });
});
