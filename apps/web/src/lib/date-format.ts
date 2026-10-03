import { format as baseFormat, formatDistanceToNow as baseDistance } from "date-fns";
import { ru } from "date-fns/locale";

export function format(...args: Parameters<typeof baseFormat>) {
  return baseFormat(args[0], args[1], { ...args[2], locale: ru });
}

export function formatDistanceToNow(...args: Parameters<typeof baseDistance>) {
  return baseDistance(args[0], { ...args[1], locale: ru });
}
