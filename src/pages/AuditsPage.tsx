import { Pencil, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";

type AuditListRow = {
  id: number;
  publicId: string;
  name: string;
  latestPublishedVersion: number | null;
  lastPublishedAt: string | null;
  dimensionCount: number;
  criterionCount: number;
  checklistItemCount: number;
};

type CreatedAuditResponse = {
  id: number;
  publicId: string;
  name: string;
  description: string;
  version: number;
  updatedAt: string;
};

function formatDateLabel(value: string | null): string {
  if (!value) return "None";
  const normalized = value.includes(" ") ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "None";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

export function AuditsPage() {
  const navigate = useNavigate();
  const [audits, setAudits] = useState<AuditListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/audits", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.status === 401) {
          await logoutAndRedirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load audits.");
        }

        const data = (await response.json()) as { audits: AuditListRow[] };
        if (!cancelled) {
          setAudits(data.audits ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load audits.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const createAudit = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to create audit.");
      }

      const data = (await response.json()) as { audit: CreatedAuditResponse };
      const created = data.audit;
      navigate(`/audits/${created.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create audit.");
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Breadcrumbs items={[{ label: "Audit templates" }]} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/audits/import")}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d4cec0] bg-white px-4 py-2 text-sm font-medium hover:bg-[#f6f3ec]"
          >
            <Sparkles size={14} className="text-[#1f6feb]" />
            Generate with AI
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={() => void createAudit()}
            className="rounded-lg bg-[#1f6feb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b63d6] disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create audit"}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-[#d9d4c8] bg-white overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-sm text-[#6b665b]">Loading audits...</div>
        ) : null}
        {error ? (
          <div className="px-4 py-6 text-sm text-red-700">{error}</div>
        ) : null}

        <table className="w-full text-sm">
          <thead className="bg-[#f8f5ef] text-left text-[#5d584d]">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Public ID</th>
              <th className="px-4 py-3 font-medium">Latest Version Published</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Last Published</th>
              <th className="px-4 py-3 font-medium">Dimensions</th>
              <th className="px-4 py-3 font-medium">Criteria</th>
              <th className="px-4 py-3 font-medium">Checklist Items</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && !error && audits.length === 0 ? (
              <tr className="border-t border-[#ece7dd]">
                <td colSpan={9} className="px-4 py-6 text-[#6b665b]">
                  No audits yet.
                </td>
              </tr>
            ) : null}
            {audits.map((audit) => (
              <tr key={audit.id} className="border-t border-[#ece7dd]">
                <td className="px-4 py-3 font-mono text-xs">{audit.id}</td>
                <td className="px-4 py-3 font-mono text-xs">{audit.publicId}</td>
                <td className="px-4 py-3">
                  {audit.latestPublishedVersion === null ? "None" : audit.latestPublishedVersion}
                </td>
                <td className="px-4 py-3">{audit.name}</td>
                <td className="px-4 py-3">
                  {formatDateLabel(audit.lastPublishedAt)}
                </td>
                <td className="px-4 py-3">{audit.dimensionCount}</td>
                <td className="px-4 py-3">{audit.criterionCount}</td>
                <td className="px-4 py-3">{audit.checklistItemCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      to={`/audits/${audit.id}/edit`}
                      className="inline-flex items-center justify-center rounded-md border border-[#d4cec0] p-2 hover:bg-[#f6f3ec]"
                      aria-label={`Edit ${audit.name}`}
                    >
                      <Pencil size={14} />
                    </Link>
                    <Link
                      to={`/audits/${audit.id}/delete`}
                      className="inline-flex items-center justify-center rounded-md border border-[#e7cfc7] p-2 text-[#8a5648] hover:bg-[#fff8f6]"
                      aria-label={`Delete ${audit.name}`}
                    >
                      <Trash2 size={14} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
