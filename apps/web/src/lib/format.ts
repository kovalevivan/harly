import { localizeSystemText } from "./localize-system-text";

export function formatEmploymentType(value: string) {
  return localizeSystemText(value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" "));
}

export function formatWorkplaceType(value: string) {
  return localizeSystemText(value[0]?.toUpperCase() + value.slice(1));
}

export function formatJobStatus(value: string) {
  return localizeSystemText(value[0]?.toUpperCase() + value.slice(1));
}

/** snake_case / lowercase → Title Case (e.g. "culture_fit" → "Culture Fit"). */
export function formatEnumLabel(value: string) {
  return localizeSystemText(value
    .split("_")
    .map((part) => (part[0]?.toUpperCase() ?? "") + part.slice(1))
    .join(" "));
}
