const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * base64 をバイト列にする。`atob` を使わないのは、この関数が GAS のバンドルにも入り、
 * Apps Script(V8)には `atob` / `btoa` が無いため(ビルドの検証が、使っていれば断る)。
 */
function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let out = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | BASE64_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

/** データURL(`data:…;base64,…`)を Blob にする。種類(MIME)が無ければ `application/octet-stream`。 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
  return new Blob([decodeBase64(base64)], { type: mime });
}
