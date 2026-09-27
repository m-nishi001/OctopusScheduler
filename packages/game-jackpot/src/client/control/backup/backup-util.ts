export async function exportLocalBackup(includeAssets = true) {
  // Minimal backup: export localStorage keys relevant to jackpot-game
  try {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("jackpot-")
    );
    const data: Record<string, string> = {};
    for (const k of keys) {
      data[k] = localStorage.getItem(k) as string;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      includeAssets,
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const filename = `jackpot-backup-${new Date().toISOString()}.json`;
    // Create a temporary link and click to download
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { filename, size: blob.size };
  } catch (e) {
    console.error("exportLocalBackup failed", e);
    throw e;
  }
}
