import { reactive } from "vue";

export function useObjectUrlStore() {
  const objectUrlMap: Map<string, string> = reactive(new Map<string, string>());

  function createObjectUrl(file: File | Blob, id: string): string {
    const url = URL.createObjectURL(file);
    objectUrlMap.set(id, url);
    return url;
  }

  function setUrl(id: string, url: string): void {
    objectUrlMap.set(id, url);
  }

  function getUrl(id: string): string | undefined {
    return objectUrlMap.get(id);
  }

  function revoke(id: string): void {
    const url = objectUrlMap.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrlMap.delete(id);
    }
  }

  function revokeAll(): void {
    for (const url of objectUrlMap.values()) {
      URL.revokeObjectURL(url);
    }
    objectUrlMap.clear();
  }

  return {
    objectUrlMap,
    createObjectUrl,
    setUrl,
    getUrl,
    revoke,
    revokeAll,
  };
}
