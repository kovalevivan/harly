// One-time, reviewable migration of UI copy into the Russian-only demo sources.
// This never runs in the browser and never changes identifiers, protocol values,
// comparison operands, routes, styles, user data or TypeScript literal types.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("apps/web/src");
const apply = process.argv.includes("--apply");
const catalogue = {
  ...JSON.parse(fs.readFileSync(path.join(root, "locales/ru.json"), "utf8")),
  ...JSON.parse(fs.readFileSync(path.join(root, "locales/ru-overrides.json"), "utf8")),
};
const pending = new Set();
const changes = [];
const copyKeys = /^(label|title|description|hint|placeholder|emptyText|text|message|subject|error|subtitle|heading|helpText|loadingText|tooltip|blurb|summary|eyebrow|caption|ctaLabel|aria-label|alt|name|.*(?:Label|Title|Description|Text|Message|Placeholder|Caption|Hint))$/;
const technicalKeys = /^(className|class|style|href|src|id|key|value|type|name|role|variant|size|status|method|mode|action|field|icon|event|category|group|color|background|border|font|fontFamily|boxShadow|rootMargin|margin|padding|display|position|cursor|pointerEvents|textAlign|overflow|width|height|stroke|fill|htmlFor|content|prompt|system|accept|rel|target|autoComplete|data-.*)$/;
function normalize(value) {
  return value.replace(/&apos;|&#39;/g, "'").replace(/&quot;|&#34;/g, '"')
    .replace(/&amp;/g, "&").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
    .replace(/\s+/g, " ").trim();
}
function human(value) {
  return /[a-zA-Z]/.test(value) && !/[А-Яа-яЁё]/.test(value)
    && !/^(https?:|\/|[.#@]|--|var\(|rgb|hsl|[a-z]+:)/i.test(value)
    && !/[{}<>]|\b(bg-|text-|border-|flex|items-|justify-|rounded-|px-|py-|mt-|w-|h-)/.test(value)
    && !/rgba?\(|\d(?:px|rem|vh|vw|em)\b|!absolute|cursive/.test(value)
    && !/^[\w./@+-]+\.[a-z]{2,}$/.test(value)
    && !/^[a-z\d_./-]+$/.test(value)
    && !/^[A-Z_\d]+$/.test(value)
    && !/^(\(?(max-width|prefers-color-scheme)|; Secure|: heartbeat)|\b(select .+ from|is (not )?null|coalesce\(|order by)\b/i.test(value)
    && (/[\s.,!?…]/.test(value) || /^[A-Z][a-z]+$/.test(value) || value === "AI")
    && (/[a-z]{2}/.test(value) || value === "AI");
}
function allowed(node, source) {
  let current = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isTypeNode(parent) || ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return false;
    if (ts.isTaggedTemplateExpression(parent) || ts.isRegularExpressionLiteral(parent)) return false;
    if (ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(parent.operatorToken.kind)) return false;
    if (ts.isCaseClause(parent)) return false;
    if (ts.isJsxAttribute(parent)) return copyKeys.test(parent.name.getText(source)) && !["name"].includes(parent.name.getText(source));
    if (ts.isPropertyAssignment(parent)) {
      if (parent.name === current) return false;
      const key = parent.name.getText(source).replace(/^['"]|['"]$/g, "");
      if (technicalKeys.test(key)) return false;
      // Other keys include status -> display-label maps. Only exact catalogue
      // entries are selected for those, never unknown operational values.
      return copyKeys.test(key) || source.fileName.endsWith("tsx") || Boolean(catalogue[normalize(node.text ?? "")]);
    }
    if (ts.isCallExpression(parent)) {
      const callee = parent.expression.getText(source);
      if (/^(cn|cva|clsx|twMerge|fetch|redirect|notFound|require)$|\.(includes|startsWith|endsWith|replace|replaceAll|match|test|matchMedia|querySelector|setAttribute|setItem|getItem|append|delete|eq|inArray|orderBy)$|^console\.|^logger\./.test(callee)) return false;
      if (/^(toast\.|notify\.|alert$|setError$|set.*Error$|Error$)/.test(callee)) return true;
      if (source.fileName.endsWith("tsx")) return true;
      // Don't change SDK options / validation discriminators.
      if (/^z\.|^sql$/.test(callee)) return /\.(min|max|email|url|refine)$/.test(callee) && node !== parent.arguments[0];
    }
    if (ts.isNewExpression(parent) && parent.expression.getText(source) !== "Error") return false;
    if (ts.isJsxExpression(parent)) return true;
    if (ts.isReturnStatement(parent)) return source.fileName.endsWith("tsx") || Boolean(catalogue[normalize(node.text ?? "")]);
    if (ts.isVariableDeclaration(parent)) {
      if (/class|style|url|href|path|route|slug|key|id|prompt|system|sql|query|token|endpoint|origin|^group$|^category$|^CANONICAL_STAGES$/i.test(parent.name.getText(source))) return false;
      return source.fileName.endsWith("tsx") || Boolean(catalogue[normalize(node.text ?? "")]);
    }
    if (ts.isStatement(parent)) return Boolean(catalogue[normalize(node.text ?? "")]);
    current = parent;
  }
  return false;
}
function translate(raw, explicit = false) {
  const value = normalize(raw);
  if (!value || (!human(value) && !(explicit && /^[a-zA-Z]+[:.]?$/.test(value)))) return null;
  const russian = catalogue[value];
  if (!russian || russian === value) { pending.add(value); return null; }
  return `${/^\s/.test(raw) ? " " : ""}${russian}${/\s$/.test(raw) ? " " : ""}`;
}
function scan(file) {
  const original = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  function walk(node) {
    if (ts.isJsxText(node)) {
      const russian = translate(node.getText(source), true);
      if (russian) edits.push({ start: node.getStart(source), end: node.end, value: `{${JSON.stringify(russian)}}` });
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && allowed(node, source)) {
      const russian = translate(node.text, ts.isJsxAttribute(node.parent) || (ts.isPropertyAssignment(node.parent) && node.parent.name.getText(source) === "label"));
      if (russian) edits.push({ start: node.getStart(source), end: node.end, value: ts.isJsxAttribute(node.parent) ? `{${JSON.stringify(russian)}}` : JSON.stringify(russian) });
    } else if (ts.isTemplateExpression(node) && allowed(node, source)) {
      // Translate the complete phrase; numbered markers preserve expressions
      // and permit Russian word order, rather than translating DOM fragments.
      const phrase = node.head.text + node.templateSpans.map((span, i) => `⟦${i}⟧${span.literal.text}`).join("");
      const russian = translate(phrase);
      if (russian && node.templateSpans.every((_, i) => russian.split(`⟦${i}⟧`).length === 2)) {
        const parts = russian.split(/(⟦\d+⟧)/).map((part) => {
          const match = part.match(/^⟦(\d+)⟧$/);
          return match ? `\${${node.templateSpans[Number(match[1])].expression.getText(source)}}` : part.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
        });
        edits.push({ start: node.getStart(source), end: node.end, value: `\`${parts.join("")}\`` });
        return;
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
  if (!edits.length) return;
  changes.push({ file: path.relative(root, file), strings: edits.length });
  if (apply) {
    let output = original;
    for (const edit of edits.sort((a, b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
    fs.writeFileSync(file, output);
  }
}
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "locales") visit(file);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) && !file.includes("components/locale/")
      && (entry.name.endsWith("tsx") || /components\/dashboard\/nav-items\.ts$|features\/automations\/builder\/(catalog|templates|library|node-copy|node-visuals|graph-diff|validation-view|state\/blocks|inspector\/bindings)\.ts$/.test(file))) scan(file);
  }
}
visit(root);
fs.writeFileSync("/tmp/harly-ui-pending.json", JSON.stringify([...pending].sort(), null, 2) + "\n");
fs.writeFileSync("/tmp/harly-ui-changes.json", JSON.stringify(changes, null, 2) + "\n");
console.log(`${apply ? "Updated" : "Found"} ${changes.length} files, ${changes.reduce((total, file) => total + file.strings, 0)} strings; ${pending.size} pending translations.`);
