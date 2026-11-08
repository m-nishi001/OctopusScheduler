// OctopusScheduler ドキュメントを配信する GAS Web アプリ。
// 同じプロジェクトに index.html(docs/gas/index.html をそのまま貼る)を置いて使う。
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('OctopusScheduler ドキュメント')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
