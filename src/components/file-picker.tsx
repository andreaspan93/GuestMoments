"use client";

import { Upload } from "lucide-react";
import { useId, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FilePicker({
  accept,
  multiple = false,
  disabled = false,
  name,
  buttonLabel,
  emptyLabel,
  formatSelection,
  onFiles,
}: {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  name?: string;
  buttonLabel: string;
  emptyLabel: string;
  formatSelection: (files: File[]) => string;
  onFiles: (files: FileList | null) => void;
}) {
  const id = useId();
  const summaryId = `${id}-summary`;
  const [summary, setSummary] = useState(emptyLabel);

  return (
    <div className="grid gap-2">
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-describedby={summaryId}
        className="sr-only"
        onChange={(event) => {
          const files = event.target.files;
          const list = files ? Array.from(files) : [];
          setSummary(list.length === 0 ? emptyLabel : formatSelection(list));
          onFiles(files);
        }}
      />
      <label
        htmlFor={id}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-12 w-full cursor-pointer gap-2 sm:w-fit",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload className="size-4" aria-hidden="true" />
        {buttonLabel}
      </label>
      <p id={summaryId} className="text-sm break-words text-foreground/80">
        {summary}
      </p>
    </div>
  );
}
