import { toast as sonnerToast } from "sonner";
import { localizeSystemText } from "./localize-system-text";

function message(value: unknown): unknown {
  return typeof value === "string" ? localizeSystemText(value) : value;
}

function options(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const result = { ...value } as Record<string, unknown>;
  if (typeof result.description === "string") result.description = message(result.description);
  return result;
}

const messageMethods = new Set(["success", "error", "info", "warning", "message", "loading"]);

/** Translate API errors before Sonner renders them, without touching the DOM. */
export const toast: typeof sonnerToast = new Proxy(sonnerToast, {
  apply(target, thisArg, args) {
    return Reflect.apply(target, thisArg, [message(args[0]), options(args[1])]);
  },
  get(target, property, receiver) {
    const method = Reflect.get(target, property, receiver);
    if (typeof property !== "string" || !messageMethods.has(property)) return method;
    return (...args: unknown[]) => Reflect.apply(method, target, [message(args[0]), options(args[1])]);
  },
});
