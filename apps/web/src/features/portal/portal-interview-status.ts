export function portalInterviewStatusLabel(
  status: "scheduled" | "completed" | "canceled",
): "Запланировано" | "Завершено" | "Отменено" {
  if (status === "completed") return "Завершено";
  if (status === "canceled") return "Отменено";
  return "Запланировано";
}
