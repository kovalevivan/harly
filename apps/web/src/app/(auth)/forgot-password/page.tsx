import Link from "next/link";

import { getAuthBranding } from "@/features/auth/branding.server";
import { AuthShell, AuthCard } from "../_components/auth-shell";
import { ForgotPasswordForm } from "./_components/forgot-password-form";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const branding = await getAuthBranding();

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
        title={"Забыли пароль"}
        subtitle={"Введите свой адрес электронной почты, и мы вышлем вам ссылку для его сброса."}
        footer={
          <>
            {"Запомнил это?"}{" "}
            <Link href="/login" className="font-semibold text-foreground hover:underline">
              {"Войти "}</Link>
          </>
        }
      >
        <ForgotPasswordForm />
      </AuthCard>
    </AuthShell>
  );
}
