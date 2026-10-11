import Link from "next/link";

import { getAvailableLoginMethods } from "@/features/auth/login-methods.server";
import { getAuthBranding } from "@/features/auth/branding.server";
import { organizationExists } from "@/lib/self-host";
import { AuthShell, AuthCard } from "../_components/auth-shell";
import { SignupForm } from "./_components/signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // Self-host model: one workspace per deployment. The first account
  // bootstraps it; afterwards signups are invite-only (enforced in
  // enforceInviteOnly). Anyone landing here directly gets the message
  // instead of a form that can only fail.
  const [methods, branding, inviteOnly] = await Promise.all([
    getAvailableLoginMethods(),
    getAuthBranding(),
    organizationExists(),
  ]);
  const googleEnabled = methods.social.includes("google");

  return (
    <AuthShell
      branding={branding}
      rightSlot={
        <Link
          href="/login"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {"Войти "}</Link>
      }
    >
      <AuthCard
        title={"Создайте свою учетную запись"}
        subtitle={"Настройте свою АТС за считанные минуты. Кредитная карта не требуется."}
        footer={
          <>
            {"У вас уже есть аккаунт?"}{" "}
            <Link href="/login" className="font-semibold text-foreground hover:underline">
              {"Войти "}</Link>
          </>
        }
      >
        {inviteOnly ? (
          <div className="rounded-lg bg-muted px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {"Регистрация возможна только по приглашению. "}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {"Это рабочее пространство Harly уже настроено. Попросите администратора пригласить вас — ваша ссылка-приглашение приведет вас прямо к нужной роли. "}</p>
          </div>
        ) : (
          <SignupForm googleEnabled={googleEnabled} />
        )}
      </AuthCard>
    </AuthShell>
  );
}
