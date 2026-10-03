// Preserve styles, input values, routes and protocol attributes during a copy
// migration. Match stable JSX / class-helper occurrences against the Git base.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const base = process.argv[2] ?? "0a6e2c201d7a0cf39ec1c5745f2b1db1e7d157e2";
const files = execFileSync("git", ["diff", base, "--name-only"], { encoding: "utf8" }).trim().split("\n");
const technicalAttributes = new Set(["className", "style", "value", "id", "key", "size", "variant", "type", "href", "src", "target", "rel", "role", "name", "accept", "autoComplete"]);
function collect(source) {
  const counts = new Map();
  const result = new Map();
  function walk(node) {
    let identity;
    if (ts.isJsxAttribute(node) && technicalAttributes.has(node.name.getText(source))) {
      identity = `attribute:${node.parent.parent.tagName.getText(source)}:${node.name.getText(source)}`;
    } else if (ts.isCallExpression(node) && /^(cn|cva|clsx|twMerge|localFont)$/.test(node.expression.getText(source))) {
      identity = `style-call:${node.expression.getText(source)}`;
    } else if (ts.isVariableDeclaration(node) && node.initializer && /style|class/i.test(node.name.getText(source))) {
      identity = `style-variable:${node.name.getText(source)}`;
      node = node.initializer;
    }
    if (identity) {
      const index = counts.get(identity) ?? 0;
      counts.set(identity, index + 1);
      result.set(`${identity}:${index}`, node);
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
  return result;
}
let restored = 0;
for (const file of files) {
  if (!file.endsWith(".tsx") || !fs.existsSync(file) || /\.(test|spec)\./.test(file)) continue;
  let previous;
  try { previous = execFileSync("git", ["show", `${base}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { continue; }
  let content = fs.readFileSync(file, "utf8");
  const before = ts.createSourceFile(file, previous, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const after = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const originals = collect(before);
  const edits = [];
  for (const [key, node] of collect(after)) {
    const original = originals.get(key);
    if (!original || original.getText(before) === node.getText(after)) continue;
    edits.push({ start: node.getStart(after), end: node.end, value: original.getText(before) });
  }
  // Outer style expressions own nested expressions; avoid overlapping edits.
  const uniqueEdits = [...new Map(edits.map((edit) => [`${edit.start}:${edit.end}`, edit])).values()];
  const nonOverlapping = uniqueEdits.filter((edit) => !uniqueEdits.some((outer) => outer !== edit && outer.start <= edit.start && outer.end >= edit.end));
  for (const edit of nonOverlapping.sort((a, b) => b.start - a.start)) content = content.slice(0, edit.start) + edit.value + content.slice(edit.end);
  if (nonOverlapping.length) {
    restored += nonOverlapping.length;
    fs.writeFileSync(file, content);
  }
}
console.log(`Preserved ${restored} technical attributes/style expressions from ${base}.`);
