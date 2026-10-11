import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith(".tsx") && !/\.(test|spec)\./.test(entry.name)) {
      let content = fs.readFileSync(file, "utf8");
      const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const edits = [];
      function walk(node) {
        if (ts.isJsxExpression(node) && node.expression) {
          const expression = node.expression.getText(source);
          const attribute = ts.isJsxAttribute(node.parent) ? node.parent.name.getText(source) : null;
          if ((!attribute || ["error", "label", "title", "description", "aria-label"].includes(attribute))
            && /^(?:\w*[Ee]rror(?:Message)?|stageName|[\w.]+\.error|[\w.]*[Ee]rror\.message|stage\.name|\w+Stage\.name|\w+\.(?:group|category))$/.test(expression)) {
            edits.push({ start: node.expression.getStart(source), end: node.expression.end, value: `localizeSystemText(${expression})` });
          }
        }
        ts.forEachChild(node, walk);
      }
      walk(source);
      if (!edits.length) continue;
      for (const edit of edits.sort((a, b) => b.start - a.start)) content = content.slice(0, edit.start) + edit.value + content.slice(edit.end);
      if (!content.includes('import { localizeSystemText }')) {
        const directive = content.match(/^(?:"use client";|"use server";)\s*/);
        const position = directive?.[0].length ?? 0;
        content = content.slice(0, position) + 'import { localizeSystemText } from "@/lib/localize-system-text";\n' + content.slice(position);
      }
      fs.writeFileSync(file, content);
    }
  }
}
visit("apps/web/src");
