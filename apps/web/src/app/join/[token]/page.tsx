import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { JoinWorkspaceButton } from "@/features/workspaces/JoinWorkspaceButton";
import { getWorkspaceByInviteToken } from "@/features/workspaces/data";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;
  const workspace = await getWorkspaceByInviteToken(token);

  if (!workspace) {
    notFound();
  }

  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="font-display text-lg tracking-tight text-pine">
          {"Харли "}</Link>
        {!session ? (
          <Link
            href={`/login?redirect=${encodeURIComponent(`/join/${token}`)}`}
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            {"Войти "}</Link>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
        {workspace.organizationLogo && (
          <div className="mb-6">
            <Image
              src={workspace.organizationLogo}
              alt={workspace.organizationName}
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
            {"Присоединяйтесь "}{workspace.organizationName}
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">
            {"Вы присоединитесь как"}{" "}
            <span className="font-semibold capitalize text-foreground">
              {workspace.role.replace("_", " ")}
            </span>
            .
          </p>

          <div className="mt-10">
            {!session ? (
              <div className="space-y-3">
                <Link
                  href={`/login?redirect=${encodeURIComponent(`/join/${token}`)}`}
                  className="block w-full rounded-lg bg-primary py-3.5 text-center text-sm font-semibold text-primary-foreground transition hover:bg-pine-strong"
                >
                  {"Войдите, чтобы присоединиться "}</Link>
                <p className="text-center text-xs text-muted-foreground">
                  {"Войдите или создайте учетную запись, чтобы присоединиться к этому рабочему пространству. "}</p>
              </div>
            ) : (
              <JoinWorkspaceButton token={token} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
