"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { permanentlyDeleteCandidateAction, restoreCandidateAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TrashCandidateActions({
  candidateId,
  candidateName,
}: {
  candidateId: string;
  candidateName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function restore() {
    startTransition(async () => {
      const result = await restoreCandidateAction(candidateId);
      if (result.success) {
        toast.success("Кандидат восстановлен.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Не удалось восстановить кандидата.");
      }
    });
  }

  function deleteForever() {
    startTransition(async () => {
      const result = await permanentlyDeleteCandidateAction(candidateId);
      if (result.success) {
        toast.success("Кандидат удален навсегда.");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Не удалось удалить кандидата.");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={restore}
        disabled={isPending}
      >
        <RotateCcw className="size-4" />
        {"Восстановить "}</Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        aria-label={"Удалить навсегда"}
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{"Удалить навсегда?"}</DialogTitle>
            <DialogDescription>
              “{candidateName}{"\", и все отклики, заметки, файлы и сообщения будут удалены навсегда. Это невозможно отменить. Любой ожидающий запрос на удаление будет помечен как выполненный. "}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              {"Отмена "}</Button>
            <Button
              variant="destructive"
              onClick={deleteForever}
              disabled={isPending}
            >
              {isPending ? "Удаление…" : "Удалить навсегда"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
