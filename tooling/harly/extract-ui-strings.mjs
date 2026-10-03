import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("apps/web/src");
const result = new Set();

function visitFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visitFiles(file);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) scan(file);
  }
}

function add(raw) {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!/[A-Za-z]{2}/.test(text) || text.length < 2 || text.length > 350) return;
  if (/[¿¡]/.test(text) || /[А-Яа-яЁё]/.test(text)) return;
  if (!/[a-z]{2}/.test(text)) return;
  if (/^(https?:|\/|[.#@!]|--|var\(|rgb|hsl|[a-z]+:|[a-z]+[_-][a-z_-]+$)/i.test(text)) return;
  if (/\b(?:bg-|text-|border-|flex|items-|justify-|rounded-|px-|py-|mt-|w-|h-)/.test(text)) return;
  if (/[{}<>]|\b(className|import|export|function)\b/.test(text)) return;
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return; // identifier, not a label
  if (/^[a-z\d_./-]+$/.test(text) && !/^[A-Z]/.test(text)) return;
  if (/^(GET|POST|PATCH|DELETE|PUT|true|false|null|undefined)$/.test(text)) return;
  result.add(text);
}

function scan(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function walk(node) {
    if (ts.isJsxText(node)) add(node.getText(source));
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      if (["placeholder", "title", "aria-label", "alt", "label", "description", "hint", "loadingText"].includes(node.name.text)) add(node.initializer.text);
    }
    if (ts.isStringLiteral(node) && node.parent) {
      if (ts.isPropertyAssignment(node.parent) && ["label", "title", "description", "hint", "placeholder", "emptyText", "text", "message", "subject"].includes(node.parent.name.getText(source))) add(node.text);
      if (ts.isCallExpression(node.parent) && /^(toast|notify|alert)\./.test(node.parent.expression.getText(source))) add(node.text);
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
}

visitFiles(root);
const items = [...result].sort((a, b) => a.localeCompare(b, "en"));
fs.mkdirSync("apps/web/src/locales", { recursive: true });
fs.writeFileSync("apps/web/src/locales/en-extracted.json", JSON.stringify(items, null, 2) + "\n");
console.log(`Extracted ${items.length} possible UI strings`);
