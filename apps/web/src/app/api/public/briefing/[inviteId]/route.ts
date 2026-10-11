import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authorizeInvitation,
  cookieName,
  publicBrief,
  processBriefingMessage,
  completeBriefing,
  cancelBriefingTurn,
} from "@/features/jobs/briefing/service";
import { getHarlyPublicOrigin } from "@/lib/public-origin";
import { saveBriefAnswers } from "@/features/jobs/briefing/edit-brief";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status, headers });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const { inviteId } = await params;
  const invite = await authorizeInvitation(
    inviteId,
    request.cookies.get(cookieName(inviteId))?.value || "",
  );
  if (!invite)
    return fail(
      "Ссылка недействительна, отозвана или срок её действия истёк. Попросите HR прислать новую ссылку.",
      401,
    );
  return NextResponse.json(await publicBrief(invite.briefId), { headers });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  if (request.headers.get("origin") !== getHarlyPublicOrigin())
    return fail("Запрос с другого сайта запрещён.", 403);
  const { inviteId } = await params;
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 50000) return fail("Сообщение слишком большое.", 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object") return fail("Некорректный запрос.");
  } catch {
    return fail("Некорректный запрос.");
  }
  const token =
    body.action === "exchange" && typeof body.token === "string"
      ? body.token
      : request.cookies.get(cookieName(inviteId))?.value || "";
  const invite = await authorizeInvitation(inviteId, token);
  if (!invite)
    return fail(
      "Ссылка недействительна, отозвана или срок её действия истёк. Попросите HR новую ссылку.",
      401,
    );
  if (body.action === "exchange") {
    const response = NextResponse.json({ ok: true }, { headers });
    response.cookies.set(cookieName(inviteId), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: `/api/public/briefing/${inviteId}`,
      expires: invite.expiresAt,
    });
    return response;
  }
  if (invite.completedAt)
    return fail(
      "Брифинг уже передан HR. Для изменений потребуется новое приглашение.",
      409,
    );
  try {
    if (body.action === "message") {
      const parsed = z
        .object({
          message: z.string().trim().min(2).max(5000),
          requestId: z.uuid(),
          expectedVersion: z.iso.datetime(),
        })
        .parse(body);
      await processBriefingMessage({
        briefId: invite.briefId,
        invitationId: invite.id,
        ...parsed,
      });
    } else if (body.action === "complete") {
      const version = z.iso.datetime().parse(body.expectedVersion);
      await completeBriefing(invite.briefId, version);
    } else if (body.action === "cancel") {
      await cancelBriefingTurn(invite.briefId, z.uuid().parse(body.requestId));
    } else if (body.action === "edit") {
      await saveBriefAnswers(
        invite.briefId,
        body.answers,
        z.iso.datetime().parse(body.expectedVersion),
      );
    } else return fail("Неизвестное действие.");
    return NextResponse.json(await publicBrief(invite.briefId), { headers });
  } catch (error) {
    return fail(
      error instanceof z.ZodError
        ? "Проверьте сообщение и обновите страницу."
        : error instanceof Error
          ? error.message
          : "Не удалось выполнить действие.",
    );
  }
}
