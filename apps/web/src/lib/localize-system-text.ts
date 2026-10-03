import catalogue from "@/locales/system-ru.json";
import type { ReactNode } from "react";

const strings: Record<string, string> = catalogue;
const templates = Object.entries(strings)
  .filter(([key]) => key.includes("⟦"))
  .map(([key, replacement]) => {
    const indices: number[] = [];
    const pattern = key.split(/(⟦\d+⟧)/).map((part) => {
      const marker = part.match(/^⟦(\d+)⟧$/);
      if (marker) {
        indices.push(Number(marker[1]));
        return "(.+?)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
    return { expression: new RegExp(`^${pattern}$`), replacement, indices };
  });

/** Localize system labels/errors at render time; never pass candidate/user copy. */
export function localizeSystemText(value: string): string;
export function localizeSystemText(value: string | null): string | null;
export function localizeSystemText(value: string | undefined): string | undefined;
export function localizeSystemText(value: string | null | undefined): string | null | undefined;
export function localizeSystemText(value: ReactNode): ReactNode;
export function localizeSystemText(value: ReactNode): ReactNode {
  if (typeof value !== "string") return value;
  const key = value.replace(/\s+/g, " ").trim();
  if (Object.hasOwn(strings, key)) return strings[key];
  for (const { expression, replacement, indices } of templates) {
    const match = key.match(expression);
    if (!match) continue;
    return replacement.replace(/⟦(\d+)⟧/g, (_, index: string) => {
      const captured = match[indices.indexOf(Number(index)) + 1];
      return captured ?? "";
    });
  }
  return value;
}
