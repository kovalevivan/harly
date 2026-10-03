"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { requestPortalErasureAction } from "./profile-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DSAR_TYPE_META,
  DsarStatusBadge,
  isOpenDsarStatus,
  type DsarStatus,
} from "@/features/workspaces/dsar-shared";

type ErasureRequest = {
  status: DsarStatus;
  createdAt: Date;
} | null;

const STATUS_COPY: Record<DsarStatus, string> = {
  pending: "Ваш запрос на удаление ожидает рассмотрения.",
  processing: "Ваш запрос на удаление обрабатывается.",
  blocked: "Ваш запрос на удаление временно заблокирован по закону.",
  completed: "Ваш запрос на удаление выполнен.",
  denied: "Ваш запрос на удаление не был одобрен. Если у вас есть вопросы, свяжитесь с командой по найму.",
};

export function PortalPrivacyControls({ erasureRequest }: { erasureRequest: ErasureRequest }) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState<DsarStatus | null>(erasureRequest?.status ?? null);
  const hasOpenRequest = requestStatus !== null && isOpenDsarStatus(requestStatus);
  const erasureMeta = DSAR_TYPE_META.erasure;

  function requestErasure() {
    startTransition(async () => {
      const result = await requestPortalErasureAction();
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось отправить запрос на удаление.");
        return;
      }
      setRequestStatus(result.status ?? "pending");
      setConfirmOpen(false);
      toast.success("Ваш запрос на удаление отправлен на рассмотрение.");
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-foreground">{"Ваши данные"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {"Загрузите портативную копию своего профиля и откликов или запросите удаление. "}</p>

      {requestStatus ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/60">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${erasureMeta.className}`}
          >
            <erasureMeta.icon className="size-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{erasureMeta.label}</p>
              <DsarStatusBadge status={requestStatus} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground" role="status">
              {STATUS_COPY[requestStatus]}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button variant="outline" size="sm" asChild>
          <a href="/api/portal/privacy/export?format=json">
            <Download className="size-4" />
            {"Скачать JSON "}</a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/portal/privacy/export?format=csv">
            <Download className="size-4" />
            {"Скачать CSV-файл "}</a>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending || hasOpenRequest || requestStatus === "completed"}
          className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {isPending
            ? "Отправка…"
            : hasOpenRequest
              ? "Запрошено удаление"
              : requestStatus === "completed"
                ? "Удаление завершено"
                : "Запросить удаление"}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{"Запросить удаление ваших данных?"}</DialogTitle>
            <DialogDescription>
              {"Команда по найму рассмотрит ваш запрос. После завершения ваш доступ к порталу и данные кандидатов могут стать недоступными. "}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>
                {"Отмена "}</Button>
            </DialogClose>
            <Button variant="destructive" onClick={requestErasure} disabled={isPending}>
              {isPending ? "Отправка…" : "Запросить удаление"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
