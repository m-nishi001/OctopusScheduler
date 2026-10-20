import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { AssetDataService } from "./asset-data-service";
import { AssetDataRepository } from "../../model/asset/asset-data-repository";
import { CryptoIdGenerator } from "../../model/common/crypto-id-generator";

/**
 * 画面設定のエディタは、アップロードしたファイルの id を、保存を待たずに設定(BGM・画像・効果音の参照)に書く。
 * id を発行していなかったので、設定の参照先が空の id のまま保存されていた。
 */

beforeEach(() => {
  container.reset();
  let n = 0;
  container.register(CryptoIdGenerator, { useValue: { nextId: () => `generated-${++n}` } as never });
  container.register(AssetDataRepository, {
    useValue: { addAssetData: vi.fn(async (assets) => assets) } as never,
  });
});

describe("AssetDataService.createDriveDataDtoFromFile", () => {
  it("保存を待たずに使える id を、アップロードのたびに別々に発行する", async () => {
    const service = container.resolve(AssetDataService);
    const a = await service.createDriveDataDtoFromFile(new File(["a"], "a.png", { type: "image/png" }));
    const b = await service.createDriveDataDtoFromFile(new File(["b"], "b.png", { type: "image/png" }));

    expect(a.id).toBe("generated-1");
    expect(b.id).toBe("generated-2");
    expect(a.name).toBe("a.png");
    expect(a.type).toBe("image/png");
  });

  it("名前は NFC に正規化する", async () => {
    const service = container.resolve(AssetDataService);
    const dto = await service.createDriveDataDtoFromFile(new File(["x"], "が".normalize("NFD") + ".png"));
    expect(dto.name).toBe("が.png");
  });
});
