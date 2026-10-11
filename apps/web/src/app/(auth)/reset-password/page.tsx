import Link from "next/link";

import { getAuthBranding } from "@/features/auth/branding.server";
import { AuthShell, AuthCard } from "../_components/auth-shell";
import { ResetPasswordForm } from "./_components/reset-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const [{ token, error }, branding] = await Promise.all([
    searchParams,
    getAuthBranding(),
  ]);

  return (
    <AuthShell
      branding={branding}
      rightSlot={
        <Link
          href="/login"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {"Вернуться для входа в систему "}</Link>
      }
    >
      <AuthCard
        title={"Сбросить пароль"}
        subtitle={"Выберите новый пароль для своей учетной записи."}
      >
        <ResetPasswordForm token={token ?? null} tokenError={error ?? null} />
      </AuthCard>
    </AuthShell>
  );
}
