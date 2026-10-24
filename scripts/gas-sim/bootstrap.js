// GAS のグローバル(PropertiesService / DriveApp / LockService / CacheService / Utilities / HtmlService / ScriptApp ...)を、
// サーバーバンドルを動かす vm コンテキストの**中で**組み立てる。
//
// 中で組み立てる理由: 外(Node 本体)のレルムで作った配列やエラーを渡すと、`instanceof Array` / `instanceof Error` が
// 偽になるなど、本物の GAS(V8 の単一レルム)と挙動が変わる。外とやり取りするのは JSON 文字列だけにする。
//
// このファイルは `vm` で評価され、関数 `(host) => void` を返す。host.call(op, argsJson) は
// `{"ok":true,"v":<値>}` または `{"ok":false,"m":"<メッセージ>"}` の JSON 文字列を返す(同期)。
// GAS に無いもの(setTimeout / crypto / structuredClone / TextEncoder / URL ...)は意図的に定義しない。
(function (host) {
  "use strict";

  function H(op) {
    var args = Array.prototype.slice.call(arguments, 1);
    var res = JSON.parse(host.call(op, JSON.stringify(args)));
    if (!res.ok) throw new Error(res.m);
    return res.v;
  }

  var toSigned = function (b64) {
    return H("b64ToSigned", b64);
  };
  var fromSigned = function (arr) {
    return H("signedToB64", arr);
  };
  var isByteArray = function (v) {
    return Array.isArray(v);
  };

  function unavailable(name) {
    var fail = function () {
      throw new Error(name + " is not available in the GAS simulator (this app must not call it)");
    };
    return new Proxy(
      {},
      {
        get: function () {
          return fail;
        },
      }
    );
  }

  // ---------- Blob ----------
  function makeBlob(b64, contentType, name) {
    var blob = {
      getBytes: function () {
        return toSigned(b64);
      },
      getDataAsString: function () {
        return H("b64ToUtf8", b64);
      },
      getContentType: function () {
        return contentType;
      },
      setContentType: function (t) {
        contentType = t;
        return blob;
      },
      getName: function () {
        return name;
      },
      setName: function (n) {
        name = n;
        return blob;
      },
      copyBlob: function () {
        return makeBlob(b64, contentType, name);
      },
      __b64: function () {
        return b64;
      },
    };
    return blob;
  }

  var Utilities = {
    getUuid: function () {
      return H("uuid");
    },
    newBlob: function (data, contentType, name) {
      var b64 = typeof data === "string" ? H("utf8ToB64", data) : fromSigned(data);
      return makeBlob(b64, contentType || (typeof data === "string" ? "text/plain" : "application/octet-stream"), name || "");
    },
    base64Encode: function (data) {
      return typeof data === "string" ? H("utf8ToB64", data) : fromSigned(data);
    },
    base64Decode: function (s) {
      return toSigned(String(s));
    },
    // value / key は「両方 string」か「両方 byte[]」でなければならない(本物と同じ)。戻り値は符号付きバイト。
    computeHmacSha256Signature: function (value, key) {
      var vs = typeof value === "string";
      var ks = typeof key === "string";
      if (vs !== ks) throw new Error("Exception: Argument types for value and key must match (both string or both byte[])");
      return H("hmac", vs ? H("utf8ToB64", value) : fromSigned(value), ks ? H("utf8ToB64", key) : fromSigned(key));
    },
    sleep: function (ms) {
      H("sleep", ms);
    },
  };

  // ---------- PropertiesService ----------
  var scriptProperties = {
    getProperty: function (k) {
      return H("props.get", String(k));
    },
    setProperty: function (k, v) {
      H("props.set", String(k), String(v));
      return scriptProperties;
    },
    deleteProperty: function (k) {
      H("props.delete", String(k));
      return scriptProperties;
    },
    getKeys: function () {
      return H("props.keys");
    },
    getProperties: function () {
      var out = {};
      H("props.keys").forEach(function (k) {
        out[k] = H("props.get", k);
      });
      return out;
    },
    setProperties: function (obj) {
      Object.keys(obj).forEach(function (k) {
        H("props.set", k, String(obj[k]));
      });
      return scriptProperties;
    },
    deleteAllProperties: function () {
      H("props.keys").forEach(function (k) {
        H("props.delete", k);
      });
      return scriptProperties;
    },
  };
  var PropertiesService = {
    getScriptProperties: function () {
      return scriptProperties;
    },
    getUserProperties: function () {
      throw new Error("PropertiesService.getUserProperties is not used by this app");
    },
  };

  // ---------- CacheService ----------
  var scriptCache = {
    get: function (k) {
      return H("cache.get", String(k));
    },
    put: function (k, v, ttl) {
      H("cache.put", String(k), String(v), ttl === undefined ? null : ttl);
    },
    remove: function (k) {
      H("cache.remove", String(k));
    },
  };
  var CacheService = {
    getScriptCache: function () {
      return scriptCache;
    },
  };

  // ---------- LockService ----------
  var scriptLock = {
    waitLock: function (ms) {
      H("lock.wait", Number(ms));
    },
    tryLock: function (ms) {
      return H("lock.try", Number(ms));
    },
    hasLock: function () {
      return H("lock.has");
    },
    releaseLock: function () {
      H("lock.release");
    },
  };
  var LockService = {
    getScriptLock: function () {
      return scriptLock;
    },
  };

  // ---------- DriveApp ----------
  function iterator(metas, wrap) {
    var i = 0;
    return {
      hasNext: function () {
        return i < metas.length;
      },
      next: function () {
        if (i >= metas.length) throw new Error("Exception: No more items");
        return wrap(metas[i++]);
      },
    };
  }

  function wrapFile(meta) {
    var m = meta;
    var file = {
      getId: function () {
        return m.id;
      },
      getName: function () {
        return m.name;
      },
      setName: function (n) {
        H("drive.setName", m.id, String(n));
        m.name = String(n);
        return file;
      },
      getMimeType: function () {
        return m.mimeType;
      },
      getSize: function () {
        return m.size;
      },
      getDateCreated: function () {
        return new Date(m.created);
      },
      getLastUpdated: function () {
        return new Date(m.updated);
      },
      getBlob: function () {
        return makeBlob(H("drive.content", m.id), m.mimeType, m.name);
      },
      setContent: function (text) {
        m = H("drive.setContent", m.id, H("utf8ToB64", String(text)));
        return file;
      },
      setTrashed: function (t) {
        H("drive.setTrashed", m.id, Boolean(t));
        return file;
      },
      isTrashed: function () {
        return H("drive.file", m.id).trashed;
      },
    };
    return file;
  }

  function wrapFolder(meta) {
    var m = meta;
    var folder = {
      getId: function () {
        return m.id;
      },
      getName: function () {
        return m.name;
      },
      getDateCreated: function () {
        return new Date(m.created);
      },
      getFoldersByName: function (name) {
        return iterator(H("drive.children", m.id, "folder", String(name)), wrapFolder);
      },
      getFolders: function () {
        return iterator(H("drive.children", m.id, "folder", null), wrapFolder);
      },
      getFilesByName: function (name) {
        return iterator(H("drive.children", m.id, "file", String(name)), wrapFile);
      },
      getFiles: function () {
        return iterator(H("drive.children", m.id, "file", null), wrapFile);
      },
      createFolder: function (name) {
        return wrapFolder(H("drive.createFolder", m.id, String(name)));
      },
      createFile: function (a, b, c) {
        // createFile(blob) / createFile(name, content, mimeType)
        if (typeof a === "string") {
          return wrapFile(H("drive.createFile", m.id, a, c || "text/plain", H("utf8ToB64", String(b))));
        }
        return wrapFile(H("drive.createFile", m.id, a.getName() || "Untitled", a.getContentType(), a.__b64()));
      },
      setTrashed: function (t) {
        H("drive.setTrashed", m.id, Boolean(t));
        return folder;
      },
    };
    return folder;
  }

  var DriveApp = {
    getFolderById: function (id) {
      return wrapFolder(H("drive.folder", String(id)));
    },
    getFileById: function (id) {
      return wrapFile(H("drive.file", String(id)));
    },
    getRootFolder: function () {
      return wrapFolder(H("drive.folder", H("drive.rootId")));
    },
  };

  // ---------- HtmlService / ScriptApp ----------
  function makeHtmlOutput(content) {
    var out = {
      __isHtmlOutput: true,
      title: "",
      metas: [],
      content: content,
      setTitle: function (t) {
        out.title = String(t);
        return out;
      },
      addMetaTag: function (name, value) {
        out.metas.push([String(name), String(value)]);
        return out;
      },
      setXFrameOptionsMode: function () {
        return out;
      },
      setFaviconUrl: function () {
        return out;
      },
      getContent: function () {
        return out.content;
      },
    };
    return out;
  }
  var HtmlService = {
    createTemplateFromFile: function (name) {
      var html = H("html.read", String(name));
      return {
        evaluate: function () {
          return makeHtmlOutput(html);
        },
      };
    },
    createHtmlOutput: function (html) {
      return makeHtmlOutput(String(html));
    },
    XFrameOptionsMode: { ALLOWALL: "ALLOWALL", DEFAULT: "DEFAULT" },
  };
  var ScriptApp = {
    getService: function () {
      return {
        getUrl: function () {
          return H("script.url");
        },
      };
    },
  };

  function fmt(args) {
    return Array.prototype.map
      .call(args, function (a) {
        if (typeof a === "string") return a;
        try {
          return a && a.stack ? String(a.stack) : JSON.stringify(a);
        } catch (e) {
          return String(a);
        }
      })
      .join(" ");
  }
  var console = {};
  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    console[level] = function () {
      H("log", level, fmt(arguments));
    };
  });

  var g = globalThis;
  g.PropertiesService = PropertiesService;
  g.CacheService = CacheService;
  g.LockService = LockService;
  g.DriveApp = DriveApp;
  g.Utilities = Utilities;
  g.HtmlService = HtmlService;
  g.ScriptApp = ScriptApp;
  g.SpreadsheetApp = unavailable("SpreadsheetApp");
  g.FormApp = unavailable("FormApp");
  g.console = console;

  // サーバー関数の呼び出し口。結果は JSON 文字列 {"kind":"string"|"html"|"json"|"undefined", ...} で返す。
  // 本物の GAS と同様、Promise を返す関数は解決を待つ。存在しない関数は例外。
  g.__simInvoke = async function (name, argJson) {
    var fn = g[name];
    if (typeof fn !== "function") throw new Error("Script function not found: " + name);
    var arg = argJson === null ? undefined : JSON.parse(argJson);
    var result = await fn(arg);
    if (result && result.__isHtmlOutput) {
      return JSON.stringify({ kind: "html", title: result.title, metas: result.metas, content: result.content });
    }
    if (typeof result === "string") return JSON.stringify({ kind: "string", value: result });
    if (result === undefined) return JSON.stringify({ kind: "undefined" });
    return JSON.stringify({ kind: "json", value: result });
  };
});
