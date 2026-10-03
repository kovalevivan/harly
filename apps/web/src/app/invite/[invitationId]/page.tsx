import { formatEnumLabel } from "@/lib/format";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { AcceptInvitationButton } from "@/features/workspaces/AcceptInvitationButton";
import { InviteOnboard } from "@/features/workspaces/InviteOnboard";
import { getInvitationById } from "@/features/workspaces/data";

type InvitePageProps = {
  params: Promise<{
    invitationId: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { invitationId } = await params;
  const invitation = await getInvitationById(invitationId);

  if (!invitation) {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isExpired = invitation.expiresAt < new Date();
  const isRecipient =
    session?.user.email.trim().toLowerCase() ===
    invitation.email.trim().toLowerCase();
  const hasAccount = !!invitation.existingAuthUserId;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="font-display text-lg tracking-tight text-pine">
          {"Харли "}</Link>
        <Link
          href={`/login?redirect=${encodeURIComponent(`/invite/${invitationId}`)}`}
          className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          {"Войти "}</Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
        {invitation.organizationLogo && (
          <div className="mb-6">
            <Image
              src={invitation.organizationLogo}
              alt={invitation.organizationName}
              width={56}
              height={56}
              className="h-14 w-14 rounded-xl object-cover"
              unoptimized
            />
          </div>
        )}

        <div className="w-full max-w-sm">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-pine">
            {"Приглашение "}</p>
          <h1 className="mt-3 text-center font-display text-3xl tracking-tight text-foreground">
            {"Присоединяйтесь "}{invitation.organizationName}
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">
            {"Вас пригласили как"}{" "}
            <span className="font-semibold capitalize text-foreground">
              {invitation.role.replace("_", " ")}
            </span>{" "}
            {"используя "}{invitation.email}.
          </p>

          {invitation.inviter && (
            <div className="mt-5 flex items-center justify-center gap-3">
              {invitation.inviter.image ? (
                <Image
                  src={invitation.inviter.image}
                  alt={invitation.inviter.name}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sage text-xs font-semibold text-sage-ink">
                  {invitation.inviter.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {"Приглашен"}{" "}
                <span className="font-medium text-foreground">
                  {invitation.inviter.name}
                </span>
              </p>
            </div>
          )}

          <div className="mt-10">
            {invitation.status !== "pending" ? (
              <div className="rounded-lg bg-muted px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                {"Это приглашение "}{formatEnumLabel(invitation.status)}.
              </div>
            ) : isExpired ? (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive">
                {"Срок действия этого приглашения истек. "}</div>
            ) : !session ? (
              hasAccount ? (
                <div className="space-y-3">
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/invite/${invitationId}`)}`}
                    className="block w-full rounded-lg bg-primary py-3.5 text-center text-sm font-semibold text-primary-foreground transition hover:bg-pine-strong"
                  >
                    {"Войдите, чтобы принять "}</Link>
                  <p className="text-center text-xs text-muted-foreground">
                    {"Войти через"}{" "}
                    <span className="font-medium text-foreground">
                      {invitation.email}
                    </span>{" "}
                    {"принять это приглашение. "}</p>
                </div>
              ) : (
                <InviteOnboard
                  invitationId={invitation.id}
                  email={invitation.email}
                />
              )
            ) : !isRecipient ? (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive">
                {"Вы вошли в систему как "}{session.user.email}. This invitation
                belongs to {invitation.email}.
              </div>
            ) : (
              <AcceptInvitationButton invitationId={invitation.id} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
