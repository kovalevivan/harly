import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("apps/web/src");
const catalogue = {
  ...JSON.parse(fs.readFileSync(path.join(root, "locales/ru.json"), "utf8")),
  ...JSON.parse(fs.readFileSync(path.join(root, "locales/ru-overrides.json"), "utf8")),
};
const selected = {};
function add(value) {
  const key = value.replace(/\s+/g, " ").trim();
  const replacement = catalogue[key];
  if (typeof replacement !== "string" || replacement === key) return;
  // A translation must retain every marker once, with no invented markers.
  const markers = key.match(/⟦\d+⟧/g) ?? [];
  if (JSON.stringify([...markers].sort()) !== JSON.stringify((replacement.match(/⟦\d+⟧/g) ?? []).sort())) return;
  selected[key] = replacement;
}
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "locales") visit(file);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      function walk(node) {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          add(node.text);
          if (/^[a-z]+(?:_[a-z]+)*$/.test(node.text)) add(node.text.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "));
        }
        else if (ts.isTemplateExpression(node)) add(node.head.text + node.templateSpans.map((span, i) => `⟦${i}⟧${span.literal.text}`).join(""));
        ts.forEachChild(node, walk);
      }
      walk(source);
    }
  }
}
visit(root);
for (const key of ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected", "Earlier step", "Task", "Meetings", "External", "Pipeline", "Candidate", "Event", "Application", "Job", "Communication", "Documents", "Notification", "Triage", "Onboarding"]) add(key);
fs.writeFileSync(path.join(root, "locales/system-ru.json"), JSON.stringify(Object.fromEntries(Object.entries(selected).sort()), null, 2) + "\n");
console.log(`Saved ${Object.keys(selected).length} system labels/error messages.`);
