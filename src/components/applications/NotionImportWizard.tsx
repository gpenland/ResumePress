"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  parseCsvTable,
  guessColumnMapping,
  applyColumnMapping,
  APPLICATION_IMPORT_FIELDS,
  type ColumnMapping,
  type MappedApplicationRow,
} from "@/lib/notionImportShared";

type Props = {
  importAction: (rows: MappedApplicationRow[]) => Promise<{ created: number; updated: number }>;
};

type Step = "upload" | "map" | "preview" | "done";

export default function NotionImportWizard({ importAction }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mappedRows, setMappedRows] = useState<MappedApplicationRow[]>([]);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; updated: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const table = parseCsvTable(text);
    if (table.headers.length === 0) {
      setUploadError("Couldn't read any columns from that file — is it a CSV?");
      return;
    }
    setUploadError(null);
    setHeaders(table.headers);
    setRows(table.rows);
    setMapping(guessColumnMapping(table.headers));
    setStep("map");
  }

  function updateMapping(field: string, value: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (value === "") delete next[field as keyof ColumnMapping];
      else next[field as keyof ColumnMapping] = Number(value);
      return next;
    });
  }

  function handlePreview() {
    const missingRequired = APPLICATION_IMPORT_FIELDS.filter((f) => f.required && mapping[f.key] === undefined);
    if (missingRequired.length > 0) {
      setMapError(`Map a column for: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }
    setMapError(null);
    const result = applyColumnMapping(rows, mapping);
    setMappedRows(result.rows);
    setMappingErrors(result.errors);
    setStep("preview");
  }

  function handleImport() {
    startTransition(async () => {
      const result = await importAction(mappedRows);
      setImportResult(result);
      setStep("done");
    });
  }

  function reset() {
    setStep("upload");
    setUploadError(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setMappedRows([]);
    setMappingErrors([]);
    setMapError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (step === "upload") {
    return (
      <Card>
        <CardContent className="py-8 space-y-3 text-center">
          <p className="text-sm text-muted-foreground">Choose a CSV file to import.</p>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="mx-auto w-auto"
          />
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </CardContent>
      </Card>
    );
  }

  if (step === "map") {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <p className="text-sm font-medium">Map columns ({rows.length} row(s) detected)</p>
          <div className="space-y-3">
            {APPLICATION_IMPORT_FIELDS.map((field) => (
              <div key={field.key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{field.label}{field.required && " *"}</Label>
                <select
                  value={mapping[field.key] ?? ""}
                  onChange={(e) => updateMapping(field.key, e.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">— none —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {mapError && <p className="text-sm text-destructive">{mapError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={reset}>Start over</Button>
            <Button type="button" size="sm" onClick={handlePreview}>Preview</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "preview") {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <p className="text-sm">
            <span className="font-medium">{mappedRows.length}</span> row(s) ready to import
            {mappingErrors.length > 0 && `, ${mappingErrors.length} skipped`}.
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto text-sm">
            {mappedRows.slice(0, 10).map((row, i) => (
              <div key={i} className="rounded border px-2 py-1">
                <span className="font-medium">{row.roleTitle}</span>{" "}
                <span className="text-muted-foreground">@ {row.companyName}</span>
                {row.status && <span className="text-muted-foreground"> · {row.status}</span>}
              </div>
            ))}
            {mappedRows.length > 10 && (
              <p className="text-muted-foreground text-xs">…and {mappedRows.length - 10} more</p>
            )}
          </div>
          {mappingErrors.length > 0 && (
            <div className="text-destructive text-xs space-y-0.5">
              {mappingErrors.slice(0, 10).map((err, i) => <p key={i}>{err}</p>)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep("map")}>Back</Button>
            <Button type="button" size="sm" onClick={handleImport} disabled={isPending || mappedRows.length === 0}>
              {isPending ? "Importing…" : `Import ${mappedRows.length} application(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-8 space-y-4 text-center">
        <p className="text-sm">
          Created <span className="font-medium">{importResult?.created ?? 0}</span>, updated{" "}
          <span className="font-medium">{importResult?.updated ?? 0}</span> application(s).
        </p>
        <div className="flex justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={reset}>Import another file</Button>
          <Link href="/applications" className={cn(buttonVariants({ size: "sm" }))}>Go to Applications</Link>
        </div>
      </CardContent>
    </Card>
  );
}
