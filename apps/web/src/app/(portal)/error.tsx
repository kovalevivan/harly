"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="size-12 text-muted-foreground" />
      <div>
        <h1 className="text-lg font-semibold">{"Что-то пошло не так"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {"Произошла непредвиденная ошибка. Пожалуйста, попробуйте еще раз. "}</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          {"Попробуйте еще раз "}</Button>
        <Button asChild variant="ghost">
          <Link href="/portal/dashboard">
            {"Вернуться к панели управления "}</Link>
        </Button>
      </div>
    </div>
  );
}
