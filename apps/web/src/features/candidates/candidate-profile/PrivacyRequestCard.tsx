"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fulfilDsarErasureAction,
  reviewDsarRequestAction,
} from "@/features/workspaces/dsar-actions";
import {
  DSAR_STATUS_META,
  DSAR_TYPE_META,
  DsarStatusBadge,
  isOpenDsarStatus,
} from "@/features/workspaces/dsar-shared";
import { RelativeTime, ShortDate } from "@/lib/date-hydration";
import { cn } from "@/lib/utils";

import type { CandidatePrivacyRow, PrivacyInventory } from "./types";

const INVENTORY_ROWS: Array<{ key: keyof PrivacyInventory; label: string }> = [
  { key: "applications", label: "Отклики" },
  { key: "interviews", label: "Собеседования" },
  { key: "messages", label: "Сообщения электронной почты" },
  { key: "files", label: "Файлы и резюме" },
  { key: "notes", label: "Внутренние примечания" },
  { key: "scorecards", label: "Карты показателей" },
  { key: "aiEvaluations", label: "Автоматические оценки" },
  { key: "offers", label: "Предложения" },
  { key: "activity", label: "События временной шкалы активности" },
];

// GDPR Art. 12(3): respond to a data-subject request within one month.
const DSAR_DUE_DAYS = 30;

export function PrivacyRequestCard({
  request,
  candidateId,
  candidateEmail,
  canFulfilErasure,
  inventory,
}: {
  request: CandidatePrivacyRow;
  candidateId: string;
  candidateEmail: string;
  canFulfilErasure: boolean;
  inventory: PrivacyInventory;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  function review(decision: "approve" | "deny") {
    startTransition(async () => {
      const result = await reviewDsarRequestAction({
        requestId: request.id,
        decision,
        notes: note || undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось просмотреть запрос.");
        return;
      }
      toast.success(
        decision === "approve"
          ? "Запрос одобрен к исполнению."
          : "Запрос отклонен.",
      );
      router.refresh();
    });
  }

  function fulfilErasure() {
    startTransition(async () => {
      const result = await fulfilDsarErasureAction({
        requestId: request.id,
        candidateId,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось выполнить запрос на удаление.");
        return;
      }
      toast.success("Данные кандидата удалены, запрос выполнен.");
      router.replace("/dashboard/candidates");
    });
  }

  const dueDate = new Date(
    new Date(request.createdAt).getTime() + DSAR_DUE_DAYS * 86_400_000,
  );
  const isOpen = isOpenDsarStatus(request.status);
  const isErasure = request.type === "erasure";
  const scoped = INVENTORY_ROWS.filter((row) => inventory[row.key] > 0);
  const emailConfirmed =
    confirmEmail.trim().toLowerCase() === candidateEmail.trim().toLowerCase();

  const source = request.requestedBy ? "портал кандидатов" : null;
  const typeMeta = DSAR_TYPE_META[request.type];

  return (
    <div className="relative max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          DSAR_STATUS_META[request.status].accentClassName,
        )}
      />
      <div className="space-y-5 p-5 pl-6">
        {/* Heading , type icon + title + status, timing floated right */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                typeMeta.className,
              )}
            >
              <typeMeta.icon className="size-4" strokeWidth={1.8} />
            </span>
            <h3 className="font-medium">{typeMeta.label}</h3>
            <DsarStatusBadge status={request.status} />
          </div>
          <span className="shrink-0 text-[13px] text-muted-foreground">
            <RelativeTime value={request.createdAt} />
          </span>
        </div>

        {/* One-line context , who, how, deadline */}
        <p className="text-sm text-muted-foreground">
          {"По запросу"}{" "}
          <span className="text-foreground">
            {request.requestedBy ?? "кандидат"}
          </span>
          {source ? ` через ${source}` : ""}
          {isOpen ? (
            <>
              {" "}
              {"· ответить через "}<ShortDate value={dueDate} />
            </>
          ) : null}
          {request.processedBy ? (
            <> {"· рассмотрено "}{request.processedBy}</>
          ) : null}
        </p>

        {/* Data in scope , scannable number grid, weighted like the warning it is */}
        {isErasure ? (
          <div
            className={cn(
              "rounded-xl border p-5",
              scoped.length > 0
                ? "border-destructive/20 bg-destructive/[0.04]"
                : "border-border/60 bg-muted/30",
            )}
          >
            <p
              className={cn(
                "flex items-center gap-1.5 text-[13px]",
                scoped.length > 0
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {scoped.length > 0 ? (
                <AlertTriangle className="size-3.5 shrink-0" />
              ) : null}
              {scoped.length > 0
                ? "Одобрение навсегда уничтожает следующее"
                : "Никаких связанных записей — остается только профиль кандидата"}
            </p>
            {scoped.length > 0 ? (
              <dl className="mt-4 grid grid-cols-[repeat(3,auto)] justify-start gap-x-12 gap-y-5">
                {scoped.map((row) => (
                  <div key={row.key}>
                    <dd className="text-xl font-semibold tabular-nums leading-none text-foreground">
                      {inventory[row.key]}
                    </dd>
                    <dt className="mt-1.5 text-[13px] text-muted-foreground">
                      {row.label}
                    </dt>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        {/* Prior review note , only for already-decided requests */}
        {request.notes && request.status !== "pending" ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {request.notes}
          </p>
        ) : null}
        {request.status === "blocked" && request.reviewDueAt ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {"Ожидается юридическая приостановка проверки"}{" "}
            {new Date(request.reviewDueAt).toLocaleDateString("ru-RU")}.
          </p>
        ) : null}

        {/* Decision , pending: optional note + Deny / Approve */}
        {request.status === "pending" ? (
          <div className="space-y-4">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={"Примечание о внутренней проверке (необязательно)"}
              maxLength={1000}
              className="min-h-[70px] resize-y text-sm"
            />
            <div className="flex gap-2.5">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    className="border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                  >
                    {"Запретить "}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{"Отклонить этот запрос?"}</DialogTitle>
                    <DialogDescription>
                      {"При этом решение и заметка о его проверке заносятся в журнал аудита. "}</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={isPending}>
                        {"Отмена "}</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => review("deny")}
                      >
                        {"Отклонить запрос "}</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={isPending}>
                    {"Утвердить "}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{"Утвердить к исполнению?"}</DialogTitle>
                    <DialogDescription>
                      {isErasure
                        ? "Одобрение переводит запрос к выполнению; он еще не удаляет данные. Роль с доступом к удалению кандидатов подтверждает удаление на втором этапе."
                        : "Ваше одобрение будет записано в журнале аудита."}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={isPending}>
                        {"Отмена "}</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        disabled={isPending}
                        onClick={() => review("approve")}
                      >
                        {"Утвердить запрос "}</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ) : null}

        {/* Fulfilment , processing erasure: irreversible confirm */}
        {(request.status === "processing" || request.status === "blocked") &&
        isErasure ? (
          canFulfilErasure ? (
            <Dialog
              onOpenChange={(open) => {
                if (!open) setConfirmEmail("");
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={isPending}>
                  {"Удалить данные кандидата "}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{"Удалить данные кандидата навсегда?"}</DialogTitle>
                  <DialogDescription>
                    {"Это соответствует утвержденному запросу. Профиль кандидата и каждая связанная выше запись удаляются без возможности восстановления, после чего вы возвращаетесь в раздел «Кандидаты». "}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <label
                    htmlFor={`erase-confirm-${request.id}`}
                    className="text-sm text-muted-foreground"
                  >
                    {"Тип"}{" "}
                    <span className="font-medium text-foreground">
                      {candidateEmail}
                    </span>{" "}
                    {"чтобы подтвердить. "}</label>
                  <Input
                    id={`erase-confirm-${request.id}`}
                    value={confirmEmail}
                    onChange={(event) => setConfirmEmail(event.target.value)}
                    placeholder={candidateEmail}
                    autoComplete="off"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" disabled={isPending}>
                      {"Отмена "}</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      variant="destructive"
                      disabled={isPending || !emailConfirmed}
                      onClick={fulfilErasure}
                    >
                      {"Стереть навсегда "}</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <p className="text-sm text-muted-foreground">
              {"Утверждено и ожидает выполнения — роль с доступом к удалению кандидата должна завершить удаление. "}</p>
          )
        ) : null}
      </div>
    </div>
  );
}
