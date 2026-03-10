import { CircleDashed, CircleCheckBig, FileChartColumnIncreasing, HatGlasses } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { getEntityTypeBadgeClass } from "../entity-type-color";
import {
  WORKSPACE_CONTEXT_EVENT,
  getActiveWorkspaceId,
  withWorkspaceQuery,
} from "../workspace-context";

type AuditOption = {
  id: number;
  publicId: string;
  name: string;
  latestPublishedVersion: number | null;
};

type EntityOption = {
  id: number;
  type: string;
  name: string;
  description: string;
  updatedAt: string;
};

type AssessmentListRow = {
  id: number;
  auditId: number;
  auditPublicId: string;
  auditName: string;
  auditVersionNo: number;
  entityId: number;
  entityType: string;
  entityName: string;
  status: "draft" | "submitted";
  updatedAt: string;
  submittedAt: string | null;
  submittedByAvatarUrl: string | null;
  reportShareHash: string | null;
  grade: string;
  score: {
    full: {
      data: {
        min: number;
        max: number;
        score: number;
        result: number | null;
        grade: string;
        maxGrade: string;
      };
    };
  };
};

function formatDateLabel(value: string | null | undefined): string {
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

export function AssessmentsPage() {
  const navigate = useNavigate();

  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [assessments, setAssessments] = useState<AssessmentListRow[]>([]);

  const [selectedAuditId, setSelectedAuditId] = useState<string>("");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [creatingAssessment, setCreatingAssessment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0);

  const publishedAudits = useMemo(
    () => audits.filter((audit) => audit.latestPublishedVersion !== null),
    [audits]
  );

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
          throw new Error("Select a workspace to load assessments.");
        }
        const [auditResponse, entityResponse, assessmentResponse] = await Promise.all([
          fetch(withWorkspaceQuery("/api/audits", workspaceId), {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }),
          fetch(withWorkspaceQuery("/api/entities", workspaceId), {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }),
          fetch(withWorkspaceQuery("/api/assessments", workspaceId), {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }),
        ]);

        if (
          auditResponse.status === 401 ||
          entityResponse.status === 401 ||
          assessmentResponse.status === 401
        ) {
          await logoutAndRedirectToLogin();
          return;
        }

        if (!auditResponse.ok || !entityResponse.ok || !assessmentResponse.ok) {
          throw new Error("Failed to load assessments view.");
        }

        const auditData = (await auditResponse.json()) as { audits: AuditOption[] };
        const entityData = (await entityResponse.json()) as { entities: EntityOption[] };
        const assessmentData = (await assessmentResponse.json()) as {
          assessments: AssessmentListRow[];
        };

        if (!cancelled) {
          setAudits(auditData.audits ?? []);
          setEntities(entityData.entities ?? []);
          setAssessments(assessmentData.assessments ?? []);

          if (!selectedAuditId && (auditData.audits ?? []).length > 0) {
            const firstPublished = (auditData.audits ?? []).find(
              (audit) => audit.latestPublishedVersion !== null
            );
            setSelectedAuditId(firstPublished ? String(firstPublished.id) : "");
          }

          if (!selectedEntityId && (entityData.entities ?? []).length > 0) {
            const firstEntity = entityData.entities[0];
            if (firstEntity) {
              setSelectedEntityId(String(firstEntity.id));
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load assessments view.");
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

  const createAssessment = async () => {
    if (creatingAssessment) return;

    const auditId = Number(selectedAuditId);
    const entityId = Number(selectedEntityId);
    if (!Number.isFinite(auditId) || auditId <= 0 || !Number.isFinite(entityId) || entityId <= 0) {
      setError("Choose a published audit and entity first.");
      return;
    }

    setCreatingAssessment(true);
    setError(null);

    try {
      const workspaceId = getActiveWorkspaceId();
      if (!workspaceId) {
        throw new Error("Select a workspace before starting an assessment.");
      }
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId, entityId, workspaceId }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to create assessment.");
      }

      const data = (await response.json()) as {
        assessment: { id: number; auditId: number };
      };
      navigate(`/assessments/${data.assessment.auditId}/${data.assessment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assessment.");
      setCreatingAssessment(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Assessments" }]} />

      <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold">Start New Assessment</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <label className="text-sm lg:col-span-6">
            <span className="mb-2 block text-[#5f594d]">Audit Version</span>
            <select
              value={selectedAuditId}
              onChange={(event) => setSelectedAuditId(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2"
            >
              <option value="">Select audit version</option>
              {publishedAudits.map((audit) => (
                <option key={audit.id} value={audit.id}>
                  {audit.publicId} - {audit.name} (v{audit.latestPublishedVersion})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm lg:col-span-4">
            <span className="mb-2 block text-[#5f594d]">Entity (assessment target)</span>
            <select
              value={selectedEntityId}
              onChange={(event) => setSelectedEntityId(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2"
            >
              <option value="">Select entity</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.type}/{entity.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end lg:col-span-2">
            <button
              type="button"
              onClick={() => void createAssessment()}
              disabled={
                creatingAssessment ||
                !selectedAuditId ||
                !selectedEntityId ||
                publishedAudits.length === 0
              }
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#1f6feb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b63d6] disabled:opacity-50"
            >
              {creatingAssessment ? "Creating..." : "Start assessment"}
            </button>
          </div>
        </div>

        {publishedAudits.length === 0 ? (
          <p className="text-sm text-[#8a5648]">
            Publish an audit first. Assessments always run against a published snapshot.
          </p>
        ) : null}

        {error ? <p className="text-sm text-[#8a5648]">{error}</p> : null}
      </section>

      <div>
        <h2 className="text-lg font-semibold">Existing Assessments</h2>

        {loading ? <p className="mt-4 text-sm text-[#7a7468]">Loading assessments...</p> : null}

        {!loading && assessments.length === 0 ? (
          <p className="mt-4 text-sm text-[#7a7468]">No assessments yet.</p>
        ) : null}

        {!loading && assessments.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[#e2dccf]">
            <table className="min-w-full divide-y divide-[#e9e4d8] text-sm">
              <thead className="bg-[#fcfbf8] text-left text-[#5f594d]">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Audit</th>
                  <th className="px-4 py-3 font-medium">Entity Type</th>
                  <th className="px-4 py-3 font-medium">Entity Name</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Grade</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Submitted By</th>
                  <th className="px-4 py-3 font-medium">Last Updated</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9de] bg-white text-[#2e2a24]">
                {assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td className="px-4 py-3 font-mono text-xs">{assessment.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{assessment.auditName}</div>
                      <div className="text-xs text-[#7a7468]">
                        {assessment.auditPublicId} v{assessment.auditVersionNo}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={getEntityTypeBadgeClass(assessment.entityType)}>
                        {assessment.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {assessment.entityName}
                    </td>
                    <td className="px-4 py-3">
                      {assessment.score.full.data.score}/{assessment.score.full.data.max}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex min-w-8 items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold ${gradeChipClass(
                          assessment.grade || assessment.score.full.data.grade
                        )}`}
                      >
                        {assessment.grade || assessment.score.full.data.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span title={assessment.status} aria-label={assessment.status}>
                        {assessment.status === "submitted" ? (
                          <CircleCheckBig
                            size={16}
                            className="text-[#1e6a3b]"
                          />
                        ) : (
                          <CircleDashed
                            size={16}
                            className="text-[#1f4ea8]"
                          />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {assessment.submittedByAvatarUrl ? (
                        <img
                          src={assessment.submittedByAvatarUrl}
                          alt="Submitter avatar"
                          className="h-7 w-7 rounded-full border border-[#d4cec0]"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-xs text-[#7a7468]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDateLabel(assessment.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {assessment.status === "draft" ? (
                          <Link
                            to={`/assessments/${assessment.auditId}/${assessment.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#d4cec0] px-3 py-2 hover:bg-[#f6f3ec]"
                          >
                            Assess
                            <HatGlasses size={14} />
                          </Link>
                        ) : null}
                        {assessment.status === "submitted" && assessment.reportShareHash ? (
                          <Link
                            to={`/share/${assessment.auditPublicId}/${assessment.reportShareHash}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open report"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d4cec0] hover:bg-[#f6f3ec]"
                          >
                            <FileChartColumnIncreasing size={14} />
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
