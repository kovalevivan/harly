"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/lib/notification-island/toast";
import { SectionHeader, StatusPill } from "@/features/workspaces/settings-ui";
import { SsoDuotoneIcon } from "@/components/ui/icons/phosphor";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { updateEnabledLoginMethodsAction } from "@/features/security/actions";
import {
  LOGIN_METHODS,
  type AvailableLoginMethods,
  type LoginMethod,
} from "@/features/auth/login-methods";

/** Human labels + helper text for each method row. */
const METHOD_META: Record<
  LoginMethod,
  { label: string; hint: string }
> = {
  password: { label: "Электронная почта и пароль", hint: "Стандартный вход по электронной почте + пароль." },
  google: { label: "Гугл", hint: "OAuth через Google Workspace." },
  microsoft: { label: "Microsoft/Энтра ID", hint: "OAuth через учетные записи Microsoft." },
  github: { label: "GitHub", hint: "OAuth через GitHub." },
  linkedin: { label: "LinkedIn", hint: "OAuth через LinkedIn." },
  sso: { label: "Корпоративный единый вход", hint: "Единый вход SAML или OIDC." },
  magic_link: { label: "Волшебная ссылка", hint: "Ссылка для входа в электронную почту без пароля." },
  passkey: { label: "Ключ доступа", hint: "Аутентификатор устройства/платформы WebAuthn." },
};

/**
 * Map a configured-methods object onto the flat LoginMethod keys so we can tell,
 * per row, whether the method is actually usable on this deployment.
 */
function toConfiguredSet(configured: AvailableLoginMethods): Set<LoginMethod> {
  const set = new Set<LoginMethod>();
  if (configured.password) set.add("password");
  if (configured.passkey) set.add("passkey");
  if (configured.magicLink) set.add("magic_link");
  if (configured.sso) set.add("sso");
  for (const provider of configured.social) set.add(provider);
  return set;
}

export function LoginMethodsCard({
  configured,
  enabledMethods,
  isOwner,
}: {
  /** Which methods are actually configured (ignoring the allow-list). */
  configured: AvailableLoginMethods;
  /** The admin's saved allow-list. Empty = "auto". */
  enabledMethods: LoginMethod[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const configuredSet = useMemo(
    () => toConfiguredSet(configured),
    [configured],
  );

  // "Auto" when the saved allow-list is empty: show everything configured.
  const [customize, setCustomize] = useState(enabledMethods.length > 0);
  // Selection is only meaningful in customize mode. Seed it from the saved
  // list, or from everything configured when switching on for the first time.
  const [selected, setSelected] = useState<Set<LoginMethod>>(
    () => new Set(enabledMethods),
  );

  function handleToggleCustomize(on: boolean) {
    setCustomize(on);
    if (on && selected.size === 0) {
      // Pre-select the currently-configured methods so turning on "custom"
      // doesn't momentarily read as "nothing selected".
      setSelected(new Set(configuredSet));
    }
  }

  function toggleMethod(method: LoginMethod, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(method);
      else next.delete(method);
      return next;
    });
  }

  function handleSave() {
    // Auto mode persists as an empty array; custom mode persists the selection
    // intersected with what's configured (never save an unusable method).
    const payload: LoginMethod[] = customize
      ? LOGIN_METHODS.filter(
          (m) => selected.has(m) && configuredSet.has(m),
        )
      : [];

    if (customize && payload.length === 0) {
      toast.error("Выберите хотя бы один настроенный метод или отключите настройку.");
      return;
    }

    startTransition(async () => {
      const result = await updateEnabledLoginMethodsAction(payload);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить методы входа.");
        return;
      }
      toast.success(
        customize
          ? "Обновлены методы входа."
          : "На экране входа в систему будут показаны все настроенные методы.",
      );
      router.refresh();
    });
  }

  const activeCount = customize
    ? LOGIN_METHODS.filter((m) => selected.has(m) && configuredSet.has(m)).length
    : configuredSet.size;

  return (
    <Card className="gap-5 p-6">
      <SectionHeader
        icon={SsoDuotoneIcon}
        title={"Методы входа"}
        description={"Выберите, какие методы аутентификации будут отображаться на экране входа в систему для сотрудников. Ненастроенные методы никогда не отображаются."}
        badge={
          <StatusPill tone={customize ? "on" : "off"}>
            {customize ? `${activeCount} выбрано` : "Авто (все настроено)"}
          </StatusPill>
        }
        action={
          isOwner ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{"Настроить"}</span>
              <Switch
                checked={customize}
                onCheckedChange={handleToggleCustomize}
                disabled={isPending}
                aria-label={"Настройте, какие методы входа будут отображаться"}
              />
            </div>
          ) : null
        }
      />

      {!isOwner ? (
        <p className="text-xs text-muted-foreground">
          {"Изменить этот параметр могут только владельцы рабочей области. "}</p>
      ) : (
        <>
          {!customize ? (
            <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {"На экране входа в систему автоматически отображаются все настроенные вами методы. Включи "}<span className="font-medium">{"Настроить"}</span>{" "}
              {"чтобы ограничить персонал определенным набором (например, только SSO). "}</p>
          ) : (
            <div className="space-y-2">
              {LOGIN_METHODS.map((method) => {
                const isConfigured = configuredSet.has(method);
                const isOn = selected.has(method) && isConfigured;
                return (
                  <div
                    key={method}
                    className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {METHOD_META[method].label}
                        {!isConfigured ? (
                          <span className="ml-2 align-middle">
                            <StatusPill tone="off">{"Не настроено"}</StatusPill>
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {METHOD_META[method].hint}
                      </p>
                    </div>
                    <Switch
                      checked={isOn}
                      onCheckedChange={(v) => toggleMethod(method, v)}
                      disabled={isPending || !isConfigured}
                      aria-label={`Показывать ${METHOD_META[method].label} на экране входа в систему.`}
                    />
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                {"Прежде чем метод можно будет отобразить, его необходимо настроить. Настройте поставщиков OAuth и корпоративный единый вход выше, а также доставку электронной почты в настройках электронной почты. "}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-pine-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Сохранение…" : "Сохранить изменения"}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
