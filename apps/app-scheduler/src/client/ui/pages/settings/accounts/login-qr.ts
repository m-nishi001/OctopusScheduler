import qrcode from "qrcode-generator";

/**
 * 文字列をQRコード画像(data URL)にする。ブラウザ内だけで生成し、外部のQR生成サービスには送らない。
 * 受付QRのURLにはログインキーが入っているため、第三者に渡してはいけない。
 */
export function qrDataUrl(text: string): string {
  // 型番は内容に合わせて自動選択(0)、誤り訂正は印刷の汚れに強い M。
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createDataURL(8, 2);
}
