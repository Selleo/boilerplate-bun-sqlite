import { Upload } from "lucide-react";
import { useState } from "react";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { getEntityTypeBadgeClass } from "../entity-type-color";

type PreviewRow = {
  rowNo: number;
  type: string;
  name: string;
  description: string;
  exists: boolean;
  existingEntityId: number | null;
  action: "skip" | "import";
};

export function EntitiesImportPage() {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selectedRowNos, setSelectedRowNos] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    requested: number;
    created: number;
    duplicates: number;
    failed: number;
  } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const loadFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setRows([]);
    setError(null);
    setValidationErrors([]);
    setSelectedRowNos([]);
    setImportSummary(null);
    setImportErrors([]);
  };

  const preprocess = async () => {
    if (loading) return;
    if (!csvText.trim()) {
      setError("Paste CSV content or upload a file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setValidationErrors([]);
    setRows([]);
    setSelectedRowNos([]);
    setImportSummary(null);
    setImportErrors([]);
    try {
      const response = await fetch("/api/entities/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        errors?: string[];
        rows?: PreviewRow[];
      };

      if (!response.ok) {
        setValidationErrors(payload.errors ?? []);
        throw new Error(payload.error ?? "Failed to preprocess CSV.");
      }

      setRows(payload.rows ?? []);
      setSelectedRowNos(
        (payload.rows ?? []).filter((row) => row.action === "import").map((row) => row.rowNo)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preprocess CSV.");
    } finally {
      setLoading(false);
    }
  };

  const importCount = rows.filter((row) => row.action === "import").length;
  const skipCount = rows.filter((row) => row.action === "skip").length;
  const selectableRows = rows.filter((row) => row.action === "import");
  const allSelectableChecked =
    selectableRows.length > 0 && selectableRows.every((row) => selectedRowNos.includes(row.rowNo));

  const toggleRow = (rowNo: number) => {
    setSelectedRowNos((current) =>
      current.includes(rowNo) ? current.filter((id) => id !== rowNo) : [...current, rowNo]
    );
  };

  const toggleAll = () => {
    setSelectedRowNos((current) => {
      if (allSelectableChecked) {
        return [];
      }
      return selectableRows.map((row) => row.rowNo);
    });
  };

  const importSelected = async () => {
    if (importing) return;
    const selectedRows = rows.filter(
      (row) => row.action === "import" && selectedRowNos.includes(row.rowNo)
    );
    if (selectedRows.length === 0) {
      setError("Select at least one row to import.");
      return;
    }

    setImporting(true);
    setImportSummary(null);
    setImportErrors([]);
    setError(null);
    try {
      const response = await fetch("/api/entities/import/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: selectedRows.map((row) => ({
            type: row.type,
            name: row.name,
            description: row.description,
          })),
        }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: { requested: number; created: number; duplicates: number; failed: number };
        errors?: string[];
      };
      if (!response.ok) {
        setImportErrors(payload.errors ?? []);
        throw new Error(payload.error ?? "Failed to import selected rows.");
      }

      const summary = payload.summary ?? null;
      const errors = payload.errors ?? [];
      await preprocess();
      setImportSummary(summary);
      setImportErrors(errors);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import selected rows.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Entities", to: "/entities" }, { label: "Import CSV" }]} />

      <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold">Import Entities from CSV</h2>
        <p className="text-sm text-[#5f594d]">
          Header is optional. Expected columns order: Entity Type, Name, Description
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              void loadFile(event.target.files?.[0] ?? null);
            }}
            className="w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 text-sm md:max-w-md"
          />
          <button
            type="button"
            onClick={() => void preprocess()}
            disabled={loading || !csvText.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d4cec0] px-4 py-2 text-sm hover:bg-[#f6f3ec] disabled:opacity-50"
          >
            <Upload size={14} />
            {loading ? "Preprocessing..." : "Preprocess CSV"}
          </button>
        </div>

        <textarea
          value={csvText}
          onChange={(event) => {
            setCsvText(event.target.value);
            setRows([]);
            setError(null);
            setValidationErrors([]);
          }}
          placeholder="Entity Type, Name, Description"
          className="min-h-[220px] w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 text-sm"
        />

        {error ? <p className="text-sm text-[#8a5648]">{error}</p> : null}
        {validationErrors.length > 0 ? (
          <ul className="list-disc pl-5 text-sm text-[#8a5648]">
            {validationErrors.slice(0, 12).map((validationError) => (
              <li key={validationError}>{validationError}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Preprocess Result</h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-[#5f594d]">
                Import: <span className="font-semibold">{importCount}</span> · Exists/Skip:{" "}
                <span className="font-semibold">{skipCount}</span>
              </p>
              <button
                type="button"
                onClick={() => void importSelected()}
                disabled={importing || selectedRowNos.length === 0}
                className="inline-flex items-center justify-center rounded-lg border border-[#d4cec0] px-3 py-2 text-sm hover:bg-[#f6f3ec] disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import selected"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#e2dccf]">
            <table className="min-w-full table-fixed divide-y divide-[#e9e4d8] text-sm">
              <colgroup>
                <col style={{ width: "6%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "32%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead className="bg-[#fcfbf8] text-left text-[#5f594d]">
                <tr>
                  <th className="px-4 py-3 font-medium w-10">
                    <input
                      type="checkbox"
                      checked={allSelectableChecked}
                      onChange={toggleAll}
                      disabled={selectableRows.length === 0}
                      aria-label="Select all importable rows"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Entity Type</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Exists</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9de] bg-white text-[#2e2a24]">
                {rows.map((row, index) => (
                  <tr key={`${row.type}-${row.name}-${index}`}>
                    <td className="px-4 py-3">
                      {row.action === "import" ? (
                        <input
                          type="checkbox"
                          checked={selectedRowNos.includes(row.rowNo)}
                          onChange={() => toggleRow(row.rowNo)}
                          aria-label={`Select ${row.type}/${row.name}`}
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={getEntityTypeBadgeClass(row.type)}>{row.type}</span>
                    </td>
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.description || "None"}</td>
                    <td className="px-4 py-3">
                      {row.exists ? (
                        <span className="inline-flex rounded-full bg-[#ece7dd] px-2 py-0.5 text-xs font-medium text-[#5e584d]">
                          Exists
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs font-medium text-[#166534]">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.action === "skip" ? (
                        <span className="inline-flex rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs font-medium text-[#4b5563]">
                          Skip
                        </span>
                      ) : selectedRowNos.includes(row.rowNo) ? (
                        <span className="inline-flex rounded-full bg-[#dbeafe] px-2 py-0.5 text-xs font-medium text-[#1d4ed8]">
                          Import
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[#fee2e2] px-2 py-0.5 text-xs font-medium text-[#b91c1c]">
                          Do not import
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importSummary ? (
            <p className="text-sm text-[#335749]">
              Imported {importSummary.created}/{importSummary.requested} selected rows ({importSummary.duplicates} duplicates,{" "}
              {importSummary.failed} failed).
            </p>
          ) : null}
          {importErrors.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-[#8a5648]">
              {importErrors.slice(0, 12).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
