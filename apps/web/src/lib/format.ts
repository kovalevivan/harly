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

const systemStatusLabels: Record<string, string> = {
  running: "Выполняется", succeeded: "Выполнено", success: "Успешно",
  failed: "Ошибка", skipped: "Пропущено", dead_letter: "Не удалось завершить",
  waiting: "Ожидание", retrying: "Повторная попытка", queued: "В очереди",
  completed_with_warnings: "Завершено с предупреждениями", stopped: "Остановлено",
  uncertain: "Требуется проверка", withdrawn: "Отозвано",
};

/** snake_case / lowercase → Title Case (e.g. "culture_fit" → "Culture Fit"). */
export function formatEnumLabel(value: string) {
  if (Object.hasOwn(systemStatusLabels, value)) return systemStatusLabels[value];
  return localizeSystemText(value
    .split("_")
    .map((part) => (part[0]?.toUpperCase() ?? "") + part.slice(1))
    .join(" "));
}
