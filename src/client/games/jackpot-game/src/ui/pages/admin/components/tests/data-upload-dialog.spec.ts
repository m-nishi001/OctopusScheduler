import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";

// Polyfill DataTransfer for test environments (jsdom sometimes doesn't expose it)
if (typeof (globalThis as any).DataTransfer === "undefined") {
  (globalThis as any).DataTransfer = class {
    items: any;
    files: any[];
    constructor() {
      this.files = [];
      this.items = {
        add: (f: any) => {
          this.files.push(f);
        },
      };
    }
  } as any;
}
// Polyfill File.prototype.text for environments where it's not available (some Node/JSDOM versions)
if (typeof (File.prototype as any).text !== "function") {
  (File.prototype as any).text = async function () {
    const ab = await (this as any).arrayBuffer();
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(ab);
  };
}

// Mock the asset and prize service modules so they don't import the real infra
vi.mock("@model/applications/asset/asset-data-service", async () => {
  class FakeAssetDataService {
    private assets: any[] = [];
    async getAllAssetData() {
      return this.assets;
    }
    async createDriveDataDtoFromFile(file: File) {
      const now = new Date().toISOString();
      return {
        id: "",
        type: file.type,
        name: file.name,
        uploadedAt: now,
        lastUpdated: now,
        size: file.size,
        blob: file,
      };
    }
    async addAssetData(dtos: any[]) {
      const added = dtos.map((d, idx) => ({
        ...d,
        id: `asset-${Date.now()}-${idx}`,
        blob: d.blob,
      }));
      this.assets.push(...added);
      return added;
    }
  }
  return { AssetDataService: FakeAssetDataService } as any;
});

vi.mock("@model/applications/prize/prize-service", async () => {
  class FakePrizeService {
    public saved: any[] = [];
    async savePrize(prize: any) {
      this.saved.push(prize);
      return prize;
    }
  }
  return { PrizeService: FakePrizeService } as any;
});
vi.mock("@model/applications/member/member-service", async () => {
  class FakeMemberService {
    public saved: any[] = [];
    async saveMember(m: any) {
      this.saved.push(m);
      return m;
    }
  }
  return { MemberService: FakeMemberService } as any;
});

import DataUploadDialog from "../data-upload-dialog.vue";

// Create simple fakes and register them into tsyringe container (instances)
class FakeAssetServiceInstance {
  private assets: any[] = [];
  async getAllAssetData() {
    return this.assets;
  }
  async createDriveDataDtoFromFile(file: File) {
    const now = new Date().toISOString();
    return {
      id: "",
      type: file.type,
      name: file.name,
      uploadedAt: now,
      lastUpdated: now,
      size: file.size,
      blob: file,
    };
  }
  async addAssetData(dtos: any[]) {
    const added = dtos.map((d, idx) => ({
      ...d,
      id: `asset-${Date.now()}-${idx}`,
      blob: d.blob,
    }));
    this.assets.push(...added);
    return added;
  }
}

class FakePrizeService {
  public saved: any[] = [];
  async savePrize(prize: any) {
    this.saved.push(prize);
    return prize;
  }
}

describe("DataUploadDialog", () => {
  let assetSvc: any;
  let prizeSvc: any;
  beforeEach(async () => {
    assetSvc = new FakeAssetServiceInstance();
    const prizeModule = await import("@model/applications/prize/prize-service");
    prizeSvc = new prizeModule.PrizeService();
    // register into container for DI usage in component
    const assetModule = await import(
      "@model/applications/asset/asset-data-service"
    );
    container.registerInstance(assetModule.AssetDataService, assetSvc as any);
    // also register member and prize services into container
    const memberModule = await import(
      "@model/applications/member/member-service"
    );
    const memberSvc = new memberModule.MemberService();
    container.registerInstance(memberModule.MemberService, memberSvc as any);
    container.registerInstance(prizeModule.PrizeService, prizeSvc as any);
  });

  it("uploads assets and binds BGM1/BGM2 properly for prizes", async () => {
    const csvText =
      "name,rank,animation,imageFile,bgm1File,bgm2File\n" +
      "PrizeA,1,roulette,,bgm01.mp3,\n" +
      "PrizeB,2,roulette,,bgm01.mp3,\n";

    // Use window.File if available (jsdom) to ensure file API compatibility
    const FileClass: any =
      typeof window !== "undefined" && (window as any).File
        ? (window as any).File
        : File;
    // Create fake file objects with the properties used by the upload logic
    const csvFile = {
      name: "prizes.csv",
      type: "text/csv",
      size: csvText.length,
      async text() {
        return csvText;
      },
    } as any;
    const bgmFile = {
      name: "bgm01.mp3",
      type: "audio/mpeg",
      size: 1024,
      webkitRelativePath: "audio/bgm01.mp3",
    } as any;

    const wrapper = mount(DataUploadDialog as any, {
      props: { show: true, type: "prize" },
    });

    // set the csvFile and assetFiles via element mutation of input
    const csvInput = wrapper.find('input[type="file"][accept=".csv"]');
    // Simulate file selection — create a FileList that works in both browser and jsdom
    function makeFileList(files: File[]) {
      if (typeof DataTransfer !== "undefined") {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        return dt.files;
      }
      // jsdom environment in some test runners doesn't have DataTransfer; create a file-list-like object
      const fileListLike = files.reduce((obj: any, f, i) => {
        obj[i] = f;
        return obj;
      }, {} as any);
      (fileListLike as any).length = files.length;
      (fileListLike as any).item = (i: number) => files[i];
      return fileListLike as unknown as FileList;
    }
    // Simulate CSV file selection
    // Use a change event with a file list payload; that triggers onCsvChange in the component
    Object.defineProperty(csvInput.element, "files", {
      value: makeFileList([csvFile]),
    });
    await csvInput.trigger("change");
    expect((wrapper.vm as any).csvFile).toStrictEqual(csvFile);

    const folderInput = wrapper.find("input[webkitdirectory]");
    // Simulate folder assets selection
    Object.defineProperty(folderInput.element, "files", {
      value: makeFileList([bgmFile]),
    });
    await folderInput.trigger("change");
    expect((wrapper.vm as any).assetFiles.length).toBe(1);
    expect((wrapper.vm as any).assetFiles.length).toBe(1);

    // click upload
    const uploadBtn = wrapper.find("button.admin-btn");
    expect(uploadBtn.attributes("disabled")).toBeUndefined();
    await uploadBtn.trigger("click");

    // Wait for upload to complete (the modal closes after 1s) — we can wait a tick
    await new Promise((resolve) => setTimeout(resolve, 500));

    // check that prizeService saved two prizes and both reference the same BGM asset id
    expect(prizeSvc.saved.length).toBeGreaterThanOrEqual(2);
    const bgmIds = (prizeSvc.saved as any[]).map((p: any) => p.bgm1AssetId);
    expect(bgmIds[0]).toBeDefined();
    expect(bgmIds[0]).toEqual(bgmIds[1]);
  });

  it("uploads prizes with winning images and order from extended CSV", async () => {
    const csvText =
      "name,rank,animation,imageFile,image2File,bgm1File,bgm2File,winningImage1File,winningImage2File,order\n" +
      "PrizeC,3,slot,image1.png,image2.png,bgm1.mp3,bgm2.mp3,win1.jpg,win2.jpg,5\n";

    const csvFile = {
      name: "prizes-extended.csv",
      type: "text/csv",
      size: csvText.length,
      async text() {
        return csvText;
      },
    } as any;

    const image1File = { name: "image1.png", type: "image/png", size: 512, webkitRelativePath: "images/image1.png" } as any;
    const image2File = { name: "image2.png", type: "image/png", size: 512, webkitRelativePath: "images/image2.png" } as any;
    const bgm1File = { name: "bgm1.mp3", type: "audio/mpeg", size: 1024, webkitRelativePath: "audio/bgm1.mp3" } as any;
    const bgm2File = { name: "bgm2.mp3", type: "audio/mpeg", size: 1024, webkitRelativePath: "audio/bgm2.mp3" } as any;
    const win1File = { name: "win1.jpg", type: "image/jpeg", size: 256, webkitRelativePath: "images/win1.jpg" } as any;
    const win2File = { name: "win2.jpg", type: "image/jpeg", size: 256, webkitRelativePath: "images/win2.jpg" } as any;

    const wrapper = mount(DataUploadDialog as any, {
      props: { show: true, type: "prize" },
    });

    const csvInput = wrapper.find('input[type="file"][accept=".csv"]');
    function makeFileList(files: File[]) {
      if (typeof DataTransfer !== "undefined") {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        return dt.files;
      }
      const fileListLike = files.reduce((obj: any, f, i) => {
        obj[i] = f;
        return obj;
      }, {} as any);
      (fileListLike as any).length = files.length;
      (fileListLike as any).item = (i: number) => files[i];
      return fileListLike as unknown as FileList;
    }

    Object.defineProperty(csvInput.element, "files", {
      value: makeFileList([csvFile]),
    });
    await csvInput.trigger("change");

    const folderInput = wrapper.find("input[webkitdirectory]");
    Object.defineProperty(folderInput.element, "files", {
      value: makeFileList([image1File, image2File, bgm1File, bgm2File, win1File, win2File]),
    });
    await folderInput.trigger("change");

    const uploadBtn = wrapper.find("button.admin-btn");
    await uploadBtn.trigger("click");

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(prizeSvc.saved.length).toBe(1);
    const prize = prizeSvc.saved[0];
    expect(prize.name).toBe("PrizeC");
    expect(prize.rank).toBe(3);
    expect(prize.animation).toBe("slot");
    expect(prize.imageAssetId).toBeDefined();
    expect(prize.image2AssetId).toBeDefined();
    expect(prize.bgm1AssetId).toBeDefined();
    expect(prize.bgm2AssetId).toBeDefined();
    expect(prize.winningImage1AssetId).toBeDefined();
    expect(prize.winningImage2AssetId).toBeDefined();
    expect(prize.order).toBe(5);
  });

  it("maintains backward compatibility with old 7-column CSV", async () => {
    const csvText =
      "name,rank,animation,imageFile,image2File,bgm1File,bgm2File\n" +
      "PrizeD,4,roulette,image1.png,image2.png,bgm1.mp3,bgm2.mp3\n";

    const csvFile = {
      name: "prizes-old.csv",
      type: "text/csv",
      size: csvText.length,
      async text() {
        return csvText;
      },
    } as any;

    const image1File = { name: "image1.png", type: "image/png", size: 512, webkitRelativePath: "images/image1.png" } as any;
    const image2File = { name: "image2.png", type: "image/png", size: 512, webkitRelativePath: "images/image2.png" } as any;
    const bgm1File = { name: "bgm1.mp3", type: "audio/mpeg", size: 1024, webkitRelativePath: "audio/bgm1.mp3" } as any;
    const bgm2File = { name: "bgm2.mp3", type: "audio/mpeg", size: 1024, webkitRelativePath: "audio/bgm2.mp3" } as any;

    const wrapper = mount(DataUploadDialog as any, {
      props: { show: true, type: "prize" },
    });

    const csvInput = wrapper.find('input[type="file"][accept=".csv"]');
    function makeFileList(files: File[]) {
      if (typeof DataTransfer !== "undefined") {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        return dt.files;
      }
      const fileListLike = files.reduce((obj: any, f, i) => {
        obj[i] = f;
        return obj;
      }, {} as any);
      (fileListLike as any).length = files.length;
      (fileListLike as any).item = (i: number) => files[i];
      return fileListLike as unknown as FileList;
    }

    Object.defineProperty(csvInput.element, "files", {
      value: makeFileList([csvFile]),
    });
    await csvInput.trigger("change");

    const folderInput = wrapper.find("input[webkitdirectory]");
    Object.defineProperty(folderInput.element, "files", {
      value: makeFileList([image1File, image2File, bgm1File, bgm2File]),
    });
    await folderInput.trigger("change");

    const uploadBtn = wrapper.find("button.admin-btn");
    await uploadBtn.trigger("click");

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(prizeSvc.saved.length).toBe(1);
    const prize = prizeSvc.saved[0];
    expect(prize.name).toBe("PrizeD");
    expect(prize.rank).toBe(4);
    expect(prize.animation).toBe("roulette");
    expect(prize.imageAssetId).toBeDefined();
    expect(prize.image2AssetId).toBeDefined();
    expect(prize.bgm1AssetId).toBeDefined();
    expect(prize.bgm2AssetId).toBeDefined();
    expect(prize.winningImage1AssetId).toBeUndefined();
    expect(prize.winningImage2AssetId).toBeUndefined();
    expect(prize.order).toBe(0);
  });
});
