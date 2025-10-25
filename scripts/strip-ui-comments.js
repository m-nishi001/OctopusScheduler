const fs = require("fs");
const path = require("path");

const uiDir = path.join(
  __dirname,
  "..",
  "src",
  "client",
  "games",
  "jackpot-game",
  "src",
  "ui"
);

function walk(dir) {
  const res = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) res.push(...walk(full));
    else if (/\.(vue|ts|js)$/.test(name)) res.push(full);
  }
  return res;
}

function preserveComment(content) {
  // preserve if contains @license, @preserve, @ts-ignore, eslint, prettier, istanbul
  return /@license|@preserve|@ts-ignore|eslint-disable|eslint-enable|prettier|istanbul|global|exported/.test(
    content
  );
}

function stripVueComments(content) {
  // Split into template, script, style parts
  return content
    .replace(
      /<template([\s\S]*?)>([\s\S]*?)<\/template>/i,
      (m, attrs, inner) => {
        // remove HTML comments unless they contain @license or @preserve
        const stripped = inner.replace(/<!--([\s\S]*?)-->/g, (cm) => {
          return preserveComment(cm) ? cm : "";
        });
        return `<template${attrs}>${stripped}</template>`;
      }
    )
    .replace(/<script([\s\S]*?)>([\s\S]*?)<\/script>/i, (m, attrs, inner) => {
      // preserve block comments starting with /** (JSDoc) and any comment that contains preserve tokens
      // remove // comments (except those with tokens)
      let s = inner;
      // Remove block comments /* ... */ that are not /** and do not contain preserve tokens
      s = s.replace(/\/\*([\s\S]*?)\*\//g, (cm) => {
        if (/^\*/.test(RegExp.$1) || preserveComment(cm)) return cm; // keep /** or preserved
        return "";
      });
      // Remove line comments // ...\n unless contains preserve tokens or starts with //@ts or // eslint
      s = s.replace(/(^|\n)\s*\/\/([^\n]*)/g, (m2, p1, p2) => {
        const cm = "//" + p2;
        return preserveComment(cm) || /^\s*\/\/\s*@/.test(cm)
          ? p1 + cm
          : p1 + "";
      });
      return `<script${attrs}>${s}</script>`;
    })
    .replace(/<style([\s\S]*?)>([\s\S]*?)<\/style>/i, (m, attrs, inner) => {
      // remove CSS comments unless they contain @license or @preserve
      const s = inner.replace(/\/\*([\s\S]*?)\*\//g, (cm) =>
        preserveComment(cm) ? cm : ""
      );
      return `<style${attrs}>${s}</style>`;
    });
}

function stripGenericComments(content) {
  // For .ts/.js files: remove block comments not starting with /** and not containing preserve tokens
  let s = content.replace(/\/\*([\s\S]*?)\*\//g, (cm) => {
    if (/^\*/.test(RegExp.$1) || preserveComment(cm)) return cm;
    return "";
  });
  // remove line comments unless they contain preserve tokens or start with @ts or eslint directives
  s = s.replace(/(^|\n)\s*\/\/([^\n]*)/g, (m2, p1, p2) => {
    const cm = "//" + p2;
    return preserveComment(cm) || /^\s*\/\/\s*@/.test(cm) ? p1 + cm : p1 + "";
  });
  return s;
}

const files = walk(uiDir);
console.log("Found", files.length, "files to process");
let changed = 0;
for (const f of files) {
  try {
    const orig = fs.readFileSync(f, "utf8");
    let out = orig;
    if (/\.vue$/.test(f)) out = stripVueComments(orig);
    else out = stripGenericComments(orig);
    if (out !== orig) {
      fs.writeFileSync(f, out, "utf8");
      changed++;
      console.log("Updated", f);
    }
  } catch (e) {
    console.error("ERR", f, e.message);
  }
}
console.log("Done. Files changed:", changed);
