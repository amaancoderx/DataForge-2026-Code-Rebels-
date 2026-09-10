/* build.mjs: assemble the shipped pages from src/.
   Produces:
     artifact.html : body fragment, for publishing as a Claude Artifact
     index.html    : standalone page, for GitHub Pages / opening locally
   Usage: node build.mjs                                                     */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");

const page = read("src/page.html");
const engine = read("src/engine.js");
const ui = read("src/ui.js");

const scripts = `\n<script>\n/* ---- src/engine.js (inlined verbatim by build.mjs) ---- */\n${engine}\n</script>\n<script>\n/* ---- src/ui.js (inlined verbatim by build.mjs) ---- */\n${ui}\n</script>\n`;

const fragment = page.trimEnd() + "\n" + scripts;
fs.writeFileSync(path.join(here, "artifact.html"), fragment);

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="An interactive explainer: why fixed-size linear-attention memory degrades, and why Dragon Hatchling pairs sparsity with non-negative activations.">
<style>html{color-scheme:light dark}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${fragment}
</body>
</html>
`;
fs.writeFileSync(path.join(here, "index.html"), standalone);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + " KB";
console.log("built artifact.html  " + kb(fragment));
console.log("built index.html     " + kb(standalone));
