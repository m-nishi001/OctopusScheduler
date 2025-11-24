import { LocalStorageService } from "@common-lib/storage/local-storage-service";

export async function exportLocalBackup(options?: { includeAssets?: boolean }) {
  const includeAssets = options?.includeAssets ?? true;
  const ls = new LocalStorageService("octopus-scheduler", "");

  // get all keys/values
  const all = await ls.getAll<any>();
  const data: Record<string, any> = {};
  for (const [k, v] of Array.from(all.entries())) {
    data[k] = v;
  }

  // If assets included, try to convert blob to dataUrl for each asset
  const assets: any[] = [];
  if (includeAssets && data["Asset"] && Array.isArray(data["Asset"])) {
    // asset entries may be stored as map of id->asset or array; handle common cases
    try {
      const entries = data["Asset"];
      const list = Array.isArray(entries) ? entries : Object.values(entries);
      for (const a of list) {
        const assetCopy: any = { ...a };
        try {
          if (assetCopy.blob) {
            // browser File/Blob -> dataURL
            const dataUrl = await blobToDataUrl(assetCopy.blob);
            assetCopy.dataUrl = dataUrl;
            delete assetCopy.blob;
          }
        } catch (e) {
          // ignore per-asset errors
        }
        assets.push(assetCopy);
      }
    } catch (e) {
      // ignore
    }
  }

  const payload = {
    metadata: {
      exportedAt: new Date().toISOString(),
      source: "local",
    },
    data,
    assets,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const filename = `octopus-scheduler-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { filename, size: blob.size };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob as Blob);
    } catch (e) {
      reject(e);
    }
  });
}
