"use client";

import { useEffect, useState } from "react";
import raw from "@/locales/ru.json";
import overrides from "@/locales/ru-overrides.json";

type Language = "ru" | "en";
const catalogue = new Map<string, string>();
for (const [english, russian] of Object.entries({ ...raw, ...overrides })) {
  catalogue.set(normalize(english), russian);
}

function normalize(value: string) {
  return value.replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
    .replace(/\s+/g, " ").trim();
}

const originalText = new WeakMap<Text, { original: string; applied: string }>();
const originalAttrs = new WeakMap<Element, Map<string, { original: string; applied: string }>>();
const attributes = ["placeholder", "aria-label", "title", "alt"] as const;

function translated(value: string): string {
  const clean = normalize(value);
  const replacement = catalogue.get(clean);
  if (!replacement) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}${replacement}${trailing}`;
}

function updateNode(node: Text, language: Language) {
  const current = node.textContent ?? "";
  const stored = originalText.get(node);
  const original = stored && current === stored.applied ? stored.original : current;
  const next = language === "ru" ? translated(original) : original;
  originalText.set(node, { original, applied: next });
  if (current !== next) node.textContent = next;
}

function updateAttributes(element: Element, language: Language) {
  const stored = originalAttrs.get(element) ?? new Map();
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    const before = stored.get(attribute);
    const original = before && current === before.applied ? before.original : current;
    const next = language === "ru" ? translated(original) : original;
    stored.set(attribute, { original, applied: next });
    if (next !== current) element.setAttribute(attribute, next);
  }
  originalAttrs.set(element, stored);
}

function translateTree(root: Node, language: Language) {
  if (root instanceof Element && root.closest("[data-harly-no-translate],script,style,code,pre,svg,noscript,[contenteditable='true']")) return;
  if (root instanceof Text) {
    if (root.parentElement?.closest("[data-harly-no-translate],script,style,code,pre,svg,noscript,[contenteditable='true']")) return;
    updateNode(root, language);
    return;
  }
  if (root instanceof Element) updateAttributes(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Element && node.closest("[data-harly-no-translate],script,style,code,pre,svg,noscript,[contenteditable='true']")) continue;
    if (node instanceof Text && node.parentElement?.closest("[data-harly-no-translate],script,style,code,pre,svg,noscript,[contenteditable='true']")) continue;
    if (node instanceof Text) updateNode(node, language);
    else if (node instanceof Element) updateAttributes(node, language);
  }
}

export function LanguageController() {
  const [language, setLanguage] = useState<Language>("ru");
  useEffect(() => {
    const saved = document.cookie.match(/(?:^|; )harly_lang=(ru|en)(?:;|$)/)?.[1];
    if (saved === "en") setLanguage("en");
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.cookie = `harly_lang=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
    translateTree(document.body, language);
    let pending = false;
    const changed = new Set<Node>();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList") {
          for (const added of record.addedNodes) changed.add(added);
        } else changed.add(record.target);
      }
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        for (const node of changed) translateTree(node, language);
        changed.clear();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...attributes] });
    return () => observer.disconnect();
  }, [language]);
  return <div data-harly-no-translate className="fixed bottom-3 left-3 z-50 flex gap-1 rounded-lg border bg-background/95 p-1 text-xs shadow-sm">
    <button type="button" aria-label="Русский язык" aria-pressed={language === "ru"} onClick={() => setLanguage("ru")} className={language === "ru" ? "rounded bg-primary px-2 py-1 text-primary-foreground" : "rounded px-2 py-1 text-foreground"}>RU</button>
    <button type="button" aria-label="English language" aria-pressed={language === "en"} onClick={() => setLanguage("en")} className={language === "en" ? "rounded bg-primary px-2 py-1 text-primary-foreground" : "rounded px-2 py-1 text-foreground"}>EN</button>
  </div>;
}
