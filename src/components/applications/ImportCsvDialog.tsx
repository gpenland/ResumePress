"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { APPLICATION_CSV_COLUMNS, parseApplicationsCsv } from "@/lib/applicationsShared";
import type { ImportCsvResult } from "@/app/(protected)/applications/actions";

type Props = {
  importApplicationsCsv: (csvText: string) => Promise<ImportCsvResult>;
};

export default function ImportCsvDialog({ importApplicationsCsv }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseApplicationsCsv> | null>(null);
  const [result, setResult] = useState<ImportCsvResult | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setPreview(parseApplicationsCsv(text));
    setResult(null);
    setOpen(true);
  }

  function handleConfirm() {
    if (!csvText) return;
    startTransition(async () => {
      const res = await importApplicationsCsv(csvText);
      setResult(res);
      if (res.ok) {
        router.refresh();
      }
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCsvText(null);
      setPreview(null);
      setResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        className="hidden"
        id="csv-import-input"
      />
      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
        Import CSV
      </Button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Import applications from CSV</AlertDialogTitle>
            <AlertDialogDescription>
              Expected columns: {APPLICATION_CSV_COLUMNS.join(", ")}. Only "company" and "roleTitle" are
              required — everything else can be blank.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {result ? (
            result.ok ? (
              <p className="text-sm text-green-600">Imported {result.imported} application(s).</p>
            ) : (
              <div className="text-sm text-destructive space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )
          ) : preview ? (
            <div className="space-y-2 max-h-72 overflow-y-auto text-sm">
              <p className="text-muted-foreground text-xs">
                {preview.rows.length} row(s) ready to import
                {preview.errors.length > 0 && `, ${preview.errors.length} skipped`}.
              </p>
              {preview.rows.slice(0, 10).map((row, i) => (
                <div key={i} className="rounded border px-2 py-1">
                  <span className="font-medium">{row.roleTitle}</span>{" "}
                  <span className="text-muted-foreground">@ {row.company}</span>
                  {row.status && <span className="text-muted-foreground"> · {row.status}</span>}
                </div>
              ))}
              {preview.rows.length > 10 && (
                <p className="text-muted-foreground text-xs">…and {preview.rows.length - 10} more</p>
              )}
              {preview.errors.length > 0 && (
                <div className="text-destructive space-y-0.5 pt-1">
                  {preview.errors.map((err, i) => (
                    <p key={i} className="text-xs">{err}</p>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>{result ? "Close" : "Cancel"}</AlertDialogCancel>
            {!result && (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirm();
                }}
                disabled={isPending || !preview || preview.rows.length === 0}
              >
                {isPending ? "Importing…" : `Import ${preview?.rows.length ?? 0} row(s)`}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
