import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";

type DeleteSummaryResponse = {
  audit: {
    id: number;
    name: string;
    publicId: string;
  };
  summary: {
    dimensions: number;
    criteria: number;
    checklistItems: number;
    versions: number;
    workspaceLinks: number;
    assessmentsTotal: number;
    assessmentsDraft: number;
    assessmentsSubmitted: number;
    assessmentAnswers: number;
    distinctEntitiesAssessed: number;
  };
};

export function AuditDeletePage() {
  const navigate = useNavigate();
  const { auditId } = useParams<{ auditId: string }>();
  const id = Number(auditId);

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [data, setData] = useState<DeleteSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!Number.isFinite(id) || id <= 0) {
        setError("Invalid audit id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/audits/${id}/delete-summary`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (response.status === 401) {
          await logoutAndRedirectToLogin();
          return;
        }
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "Failed to load delete summary.");
        }
        const payload = (await response.json()) as DeleteSummaryResponse;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load delete summary.");
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
  }, [id]);

  const deleteAudit = async () => {
    if (deleting || !data) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/audits/${data.audit.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete audit.");
      }
      navigate("/audits");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete audit.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Audit templates", to: "/audits" },
          { label: "Delete audit" },
        ]}
      />

      <section className="rounded-2xl border-2 border-[#7f1d1d] bg-[#b91c1c] p-6 text-white">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <AlertTriangle size={16} />
          Destructive action
        </div>
        <p className="mt-2 text-sm text-white/95">
          Review all related resources before deletion. This action permanently removes the audit
          template and cannot be undone.
        </p>
      </section>

      <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6">
        {loading ? <p className="text-sm text-[#6b665b]">Loading delete summary...</p> : null}
        {error ? <p className="text-sm font-medium text-[#b42318]">{error}</p> : null}

        {!loading && !error && data ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#7a7468]">Audit</p>
              <p className="mt-1 text-lg font-semibold text-[#1f1f1f]">
                {data.audit.publicId} - {data.audit.name}
              </p>
            </div>

            <div className="space-y-3">
              <ImpactSection
                title="Assessment impact (Highest risk)"
                tone="high"
                open
                alwaysOpen
                onToggle={() => {}}
              >
                <p>
                  Assessments total: <span className="font-semibold">{data.summary.assessmentsTotal}</span>
                </p>
                <p>Draft: {data.summary.assessmentsDraft}</p>
                <p>Submitted: {data.summary.assessmentsSubmitted}</p>
                <p>Assessment answers: {data.summary.assessmentAnswers}</p>
                <p>Entities with assessment history: {data.summary.distinctEntitiesAssessed}</p>
              </ImpactSection>

              <ImpactSection
                title="Template asset impact (Medium risk)"
                tone="neutral"
                open={assetOpen}
                onToggle={() => setAssetOpen((value) => !value)}
              >
                <p>Audit template record: 1</p>
                <p>Dimensions: {data.summary.dimensions}</p>
                <p>Criteria: {data.summary.criteria}</p>
                <p>Checklist items: {data.summary.checklistItems}</p>
                <p>Published versions: {data.summary.versions}</p>
              </ImpactSection>

              <ImpactSection
                title="Workspace distribution impact (Lower risk)"
                tone="neutral"
                open={workspaceOpen}
                onToggle={() => setWorkspaceOpen((value) => !value)}
              >
                <p>Workspace links: {data.summary.workspaceLinks}</p>
              </ImpactSection>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => void deleteAudit()}
                disabled={deleting}
                className="inline-flex items-center justify-center rounded-lg bg-[#b42318] px-6 py-3 text-sm font-semibold text-white hover:bg-[#9f1f15] disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete, I understand this cannot be undone"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ImpactSection({
  title,
  tone,
  open,
  alwaysOpen = false,
  onToggle,
  children,
}: {
  title: string;
  tone: "high" | "neutral";
  open: boolean;
  alwaysOpen?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const containerClass =
    tone === "high"
      ? "rounded-xl border-2 border-[#991b1b] bg-[#fef2f2] p-4"
      : "rounded-xl border border-[#e7e1d4] bg-[#fcfbf8] p-4";
  const headerClass =
    tone === "high"
      ? "text-sm font-semibold text-[#7f1d1d]"
      : "text-sm font-semibold text-[#3e3a33]";
  const bodyClass = tone === "high" ? "mt-2 space-y-1 text-sm text-[#7f1d1d]" : "mt-2 space-y-1 text-sm text-[#3e3a33]";

  return (
    <section className={containerClass}>
      <button
        type="button"
        onClick={alwaysOpen ? undefined : onToggle}
        disabled={alwaysOpen}
        className={`inline-flex w-full items-center justify-between gap-2 text-left ${headerClass} ${
          alwaysOpen ? "cursor-default" : ""
        }`}
      >
        <span>{title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open ? <div className={bodyClass}>{children}</div> : null}
    </section>
  );
}
