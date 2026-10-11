import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function PortalNotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <FileQuestion className="size-12 text-muted-foreground" />
      <div>
        <h1 className="text-lg font-semibold">{"Страница не найдена"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {"Страница, которую вы ищете, не существует или была перемещена. "}</p>
      </div>
      <Button asChild variant="ghost">
        <Link href="/portal/dashboard">
          {"Вернуться к панели управления "}</Link>
      </Button>
    </div>
  );
}
