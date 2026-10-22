/**
 * ブラウザに注入する偽の `google.script.*`(GAS の HtmlService ページが持つクライアント API)。
 *
 *   google.script.run.withSuccessHandler(ok).withFailureHandler(ng).<サーバー関数名>(引数)
 *     → POST /rpc(Cloudflare 版と同じ { name, args })。成功は本文(サーバー関数の戻り値の文字列)を ok に、
 *       失敗(例外・同時実行数の超過など)は Error を ng に渡す。
 *   google.script.history / google.script.url
 *     → 本物は iframe の外側 URL を操作する。ここではページがトップレベルで開かれ、ルーターが
 *       location.hash を管理しているので、履歴は何もせず、getLocation は現在のハッシュを返す。
 *
 * 本物の GAS のクライアントにあって、この偽物に無いもの(window.setTimeout の制約など)は無い。
 * クライアントが google.script.run の有無で通信方式を選ぶ(= WebSocket を使わずポーリングに切り替わる)ことを再現するのが目的。
 */
export function browserShim() {
  return `(${shim.toString()})();`;
}

function shim() {
  function makeRun(onSuccess, onFailure, userObject) {
    return new Proxy(
      {},
      {
        get: function (_t, prop) {
          if (prop === "withSuccessHandler") return function (h) { return makeRun(h, onFailure, userObject); };
          if (prop === "withFailureHandler") return function (h) { return makeRun(onSuccess, h, userObject); };
          if (prop === "withUserObject") return function (o) { return makeRun(onSuccess, onFailure, o); };
          if (typeof prop !== "string") return undefined;
          return function (arg) {
            fetch("/rpc", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name: prop, args: arg }),
            })
              .then(function (res) {
                return res.text().then(function (text) {
                  if (res.ok) {
                    if (onSuccess) onSuccess(text, userObject);
                    return;
                  }
                  var message = text;
                  try { message = JSON.parse(text).message || text; } catch (e) { /* そのまま */ }
                  if (onFailure) onFailure(new Error(message), userObject);
                });
              })
              .catch(function (e) {
                if (onFailure) onFailure(new Error(String(e && e.message ? e.message : e)), userObject);
              });
          };
        },
      }
    );
  }

  window.google = {
    script: {
      run: makeRun(null, null, undefined),
      history: {
        push: function () {},
        replace: function () {},
        setChangeHandler: function () {},
      },
      url: {
        getLocation: function (cb) {
          var hash = (window.location.hash || "").replace(/^#/, "");
          cb({ hash: hash, parameter: {}, parameters: {} });
        },
      },
    },
  };
}
