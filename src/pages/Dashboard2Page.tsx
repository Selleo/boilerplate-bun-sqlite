import {
  ArrowRight,
  CircleCheckBig,
  CircleDashed,
  ClipboardList,
  FileCheck2,
  Fingerprint,
  Rocket,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { WORKSPACE_CONTEXT_EVENT, getActiveWorkspaceId, withWorkspaceQuery } from "../workspace-context";

type AssessmentListRow = {
  id: number;
  auditName: string;
  entityType: string;
  entityName: string;
  status: "draft" | "submitted";
  updatedAt: string;
  grade: string;
  score: {
    full: {
      data: {
        score: number;
        max: number;
      };
    };
  };
};

type DashboardResponse = {
  metrics: {
    auditsTotal: number;
    publishedAudits: number;
    draftAssessments: number;
    submittedAssessments: number;
    entitiesTotal: number;
  };
  recentAssessments: AssessmentListRow[];
};

function formatDateLabel(value: string): string {
  const normalized = value.includes(" ") ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "None";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof Shield;
}) {
  return (
    <article className="rounded-2xl border border-[#d9d4c8] bg-white p-5">
      <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#7a7468]">
        <Icon size={14} className="text-[#5a3d2d]" />
        {title}
      </div>
      <p className="text-3xl font-semibold text-[#1f1f1f]">{value}</p>
      <p className="mt-1 text-sm text-[#6b665b]">{subtitle}</p>
    </article>
  );
}

function gradeChipClass(grade: string) {
  const key = grade.trim().toUpperCase();
  if (key === "N/A") {
    return "bg-slate-200 text-slate-700 border-slate-300";
  }
  const offset = Math.max(0, Math.min(5, key.charCodeAt(0) - "A".charCodeAt(0)));
  return [
    "bg-green-500 text-white border-green-600",
    "bg-lime-500 text-white border-lime-600",
    "bg-yellow-400 text-white border-yellow-500",
    "bg-orange-500 text-white border-orange-600",
    "bg-red-500 text-white border-red-600",
    "bg-red-700 text-white border-red-800",
  ][offset]!;
}

export function Dashboard2Page() {
  const [metrics, setMetrics] = useState<DashboardResponse["metrics"]>({
    auditsTotal: 0,
    publishedAudits: 0,
    draftAssessments: 0,
    submittedAssessments: 0,
    entitiesTotal: 0,
  });
  const [recentAssessments, setRecentAssessments] = useState<AssessmentListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0);

  useEffect(() => {
    const handler = () => setWorkspaceRefreshToken((value) => value + 1);
    window.addEventListener(WORKSPACE_CONTEXT_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_CONTEXT_EVENT, handler);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const workspaceId = getActiveWorkspaceId();
        if (!workspaceId) {
          throw new Error("Select a workspace to load dashboard data.");
        }

        const response = await fetch(withWorkspaceQuery("/api/dashboard", workspaceId), {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (response.status === 401) {
          await logoutAndRedirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load dashboard data.");
        }

        const data = (await response.json()) as DashboardResponse;
        if (!cancelled) {
          setMetrics(
            data.metrics ?? {
              auditsTotal: 0,
              publishedAudits: 0,
              draftAssessments: 0,
              submittedAssessments: 0,
              entitiesTotal: 0,
            }
          );
          setRecentAssessments(data.recentAssessments ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
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
  }, [workspaceRefreshToken]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[#d9d4c8] bg-gradient-to-r from-[#f6efe2] via-[#f5f1e8] to-[#efe6d6] p-6">
        <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[#6b665b]">Audit Operations</p>
        <h1 className="text-3xl font-semibold text-[#1f1f1f]">Control Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#5f594d]">
          Track what is ready to assess, what is still in progress, and where to take the next action.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Audit templates"
          value={loading ? "..." : String(metrics.auditsTotal)}
          subtitle="Total managed templates"
          icon={ClipboardList}
        />
        <MetricCard
          title="Published"
          value={loading ? "..." : String(metrics.publishedAudits)}
          subtitle="Ready for assessments"
          icon={Rocket}
        />
        <MetricCard
          title="Draft Assessments"
          value={loading ? "..." : String(metrics.draftAssessments)}
          subtitle="Still in progress"
          icon={FileCheck2}
        />
        <MetricCard
          title="Submitted"
          value={loading ? "..." : String(metrics.submittedAssessments)}
          subtitle="Completed assessments"
          icon={Shield}
        />
        <MetricCard
          title="Entities"
          value={loading ? "..." : String(metrics.entitiesTotal)}
          subtitle="Assessment targets"
          icon={Fingerprint}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-[#d9d4c8] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Assessments</h2>
            <Link
              to="/assessments"
              className="inline-flex items-center gap-1 text-sm text-[#5a3d2d] hover:text-[#3f2b20]"
            >
              Open all
              <ArrowRight size={14} />
            </Link>
          </div>

          {error ? <p className="text-sm text-[#8a5648]">{error}</p> : null}
          {!error && loading ? <p className="text-sm text-[#7a7468]">Loading dashboard...</p> : null}
          {!error && !loading && recentAssessments.length === 0 ? (
            <p className="text-sm text-[#7a7468]">No assessments yet.</p>
          ) : null}

          {!error && !loading && recentAssessments.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[#ece7dd]">
              <table className="min-w-full text-sm">
                <thead className="bg-[#fcfbf8] text-left text-[#5f594d]">
                  <tr>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Audit</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Grade</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee9de] bg-white text-[#2e2a24]">
                  {recentAssessments.map((assessment) => (
                    <tr key={assessment.id}>
                      <td className="px-4 py-3 font-mono text-xs">{assessment.id}</td>
                      <td className="px-4 py-3">{assessment.auditName}</td>
                      <td className="px-4 py-3">
                        {assessment.entityType}/{assessment.entityName}
                      </td>
                      <td className="px-4 py-3">
                        {assessment.score.full.data.score}/{assessment.score.full.data.max}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex min-w-8 items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold ${gradeChipClass(assessment.grade)}`}
                        >
                          {assessment.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span title={assessment.status} aria-label={assessment.status}>
                          {assessment.status === "submitted" ? (
                            <CircleCheckBig size={16} className="text-[#1e6a3b]" />
                          ) : (
                            <CircleDashed size={16} className="text-[#1f4ea8]" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatDateLabel(assessment.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <article className="rounded-2xl border border-[#d9d4c8] bg-white p-5">
            <h3 className="text-base font-semibold">Quick Actions</h3>
            <div className="mt-3 space-y-2">
              <Link
                to="/audits"
                className="flex items-center justify-between rounded-lg border border-[#e6e0d4] px-3 py-2 hover:bg-[#f8f5ef]"
              >
                <span className="inline-flex items-center gap-2 text-sm">
                  <ClipboardList size={14} className="text-[#5a3d2d]" />
                  Manage audits
                </span>
                <ArrowRight size={14} className="text-[#7a7468]" />
              </Link>
              <Link
                to="/assessments"
                className="flex items-center justify-between rounded-lg border border-[#e6e0d4] px-3 py-2 hover:bg-[#f8f5ef]"
              >
                <span className="inline-flex items-center gap-2 text-sm">
                  <Shield size={14} className="text-[#5a3d2d]" />
                  Run assessments
                </span>
                <ArrowRight size={14} className="text-[#7a7468]" />
              </Link>
              <Link
                to="/entities"
                className="flex items-center justify-between rounded-lg border border-[#e6e0d4] px-3 py-2 hover:bg-[#f8f5ef]"
              >
                <span className="inline-flex items-center gap-2 text-sm">
                  <Fingerprint size={14} className="text-[#5a3d2d]" />
                  Manage entities
                </span>
                <ArrowRight size={14} className="text-[#7a7468]" />
              </Link>
            </div>
          </article>

        </div>
      </section>
    </div>
  );
}
