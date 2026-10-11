"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";

export function RussianFileInput({
  id,
  accept,
  disabled,
  onChange,
}: {
  id: string;
  accept: string;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [filename, setFilename] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-full focus-within:outline focus-within:outline-ring focus-within:outline-offset-2">
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        aria-describedby={`${id}-selection`}
        onChange={(event) => {
          setFilename(event.target.files?.[0]?.name ?? "");
          onChange(event);
        }}
      />
      <Button asChild variant="outline">
        <label
          htmlFor={id}
          aria-disabled={disabled}
          className="cursor-pointer aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Выбрать файл
        </label>
      </Button>
      <span
        id={`${id}-selection`}
        role="status"
        className="break-all text-sm text-muted-foreground"
      >
        {filename || "Файл не выбран"}
      </span>
    </div>
  );
}
