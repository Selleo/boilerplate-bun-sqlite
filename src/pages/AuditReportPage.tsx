import {
  Check,
  CircleDashed,
  Link as LinkIcon,
  Loader2,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { getActiveWorkspaceId, withWorkspaceQuery } from "../workspace-context";

type AssessmentResponse = "pass" | "fail" | "partial" | "na" | "none";

type AssessmentDetail = {
  id: number;
  auditId: number;
  auditPublicId: string;
  auditName: string;
  auditVersionId: number;
  auditVersionNo: number;
  entityId: number;
  entityType: string;
  entityName: string;
  status: "draft" | "submitted";
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reportShareHash: string | null;
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
  snapshot: {
    id: number;
    publicId: string;
    name: string;
    description: string;
    dimensions: Array<{
      id: number;
      position: number;
      name: string;
      criteria: Array<{
        id: number;
        position: number;
        name: string;
        description: string;
        items: Array<{
          id: number;
          position: number;
          name: string;
        }>;
      }>;
    }>;
  };
  answers: Array<{
    itemId: number;
    response: AssessmentResponse;
    note: string;
    updatedAt: string;
  }>;
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

function responseButtonClass(value: AssessmentResponse, active: boolean) {
  if (!active) {
    return "inline-flex items-center gap-1 rounded-md border border-[#d4cec0] bg-white px-2.5 py-1 text-xs font-medium text-[#5f594d] transition-colors hover:bg-[#f6f3ec]";
  }

  switch (value) {
    case "pass":
      return "inline-flex items-center gap-1 rounded-md border border-[#1e6a3b] bg-[#d9eadf] px-2.5 py-1 text-xs font-medium text-[#1e6a3b] transition-colors";
    case "fail":
      return "inline-flex items-center gap-1 rounded-md border border-[#9f2d2d] bg-[#fbe4e4] px-2.5 py-1 text-xs font-medium text-[#9f2d2d] transition-colors";
    case "partial":
      return "inline-flex items-center gap-1 rounded-md border border-[#a36207] bg-[#fcefd8] px-2.5 py-1 text-xs font-medium text-[#a36207] transition-colors";
    case "na":
      return "inline-flex items-center gap-1 rounded-md border border-[#64748b] bg-[#e2e8f0] px-2.5 py-1 text-xs font-medium text-[#475569] transition-colors";
    case "none":
    default:
      return "inline-flex items-center gap-1 rounded-md border border-[#6b665b] bg-[#ebe7de] px-2.5 py-1 text-xs font-medium text-[#5f594d] transition-colors";
  }
}

function responseLabel(response: AssessmentResponse) {
  switch (response) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fail";
    case "partial":
      return "Partial";
    case "na":
      return "N/A";
    default:
      return "None";
  }
}

export function AuditReportPage() {
  const navigate = useNavigate();
  const { id, auditPublicId, reportShareHash } = useParams<{
    audit_id: string;
    id: string;
    auditPublicId: string;
    reportShareHash: string;
  }>();

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});

  const assessmentId = Number(id);
  const isSharedView = Boolean(auditPublicId && reportShareHash);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isSharedView && (!Number.isFinite(assessmentId) || assessmentId <= 0)) {
        setError("Invalid assessment id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const workspaceId = getActiveWorkspaceId();
        if (!isSharedView && !workspaceId) {
          throw new Error("Select a workspace to open this assessment.");
        }

        const endpoint = isSharedView
          ? `/api/share/${encodeURIComponent(auditPublicId ?? "")}/${encodeURIComponent(reportShareHash ?? "")}`
          : withWorkspaceQuery(`/api/assessments/${assessmentId}`, workspaceId);

        const response = await fetch(endpoint, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!isSharedView && response.status === 401) {
          await logoutAndRedirectToLogin();
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "Failed to load assessment.");
        }

        const data = (await response.json()) as { assessment: AssessmentDetail };
        if (!cancelled) {
          setAssessment(data.assessment);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load assessment.");
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
  }, [assessmentId, auditPublicId, reportShareHash, isSharedView]);

  const answerByItemId = useMemo(() => {
    const map = new Map<number, { response: AssessmentResponse; note: string; updatedAt: string }>();
    for (const answer of assessment?.answers ?? []) {
      map.set(answer.itemId, {
        response: answer.response,
        note: answer.note,
        updatedAt: answer.updatedAt,
      });
    }
    return map;
  }, [assessment]);

  const progress = useMemo(() => {
    const itemIds =
      assessment?.snapshot.dimensions.flatMap((dimension) =>
        dimension.criteria.flatMap((criterion) => criterion.items.map((item) => item.id))
      ) ?? [];
    const total = itemIds.length;
    let answered = 0;
    for (const itemId of itemIds) {
      const response = answerByItemId.get(itemId)?.response ?? "none";
      if (response !== "none") {
        answered += 1;
      }
    }
    const unanswered = Math.max(0, total - answered);
    const completionPercent = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { total, answered, unanswered, completionPercent };
  }, [assessment, answerByItemId]);

  const scoringScope = useMemo(() => {
    const itemIds =
      assessment?.snapshot.dimensions.flatMap((dimension) =>
        dimension.criteria.flatMap((criterion) => criterion.items.map((item) => item.id))
      ) ?? [];
    let naCount = 0;
    for (const itemId of itemIds) {
      const response = answerByItemId.get(itemId)?.response ?? "none";
      if (response === "na") {
        naCount += 1;
      }
    }
    return { naCount };
  }, [assessment, answerByItemId]);

  const liveScore = useMemo(() => {
    const itemIds =
      assessment?.snapshot.dimensions.flatMap((dimension) =>
        dimension.criteria.flatMap((criterion) => criterion.items.map((item) => item.id))
      ) ?? [];
    let max = 0;
    let score = 0;
    for (const itemId of itemIds) {
      const response = answerByItemId.get(itemId)?.response ?? "none";
      if (response === "na") continue;
      max += 1;
      if (response === "pass") {
        score += 1;
      }
    }
    return { score, max };
  }, [assessment, answerByItemId]);

  const saveAnswer = async (itemId: number, response: AssessmentResponse, note: string) => {
    if (!assessment || assessment.status !== "draft" || isSharedView) return;

    setSavingItemId(itemId);
    setItemErrors((current) => {
      if (!(itemId in current)) return current;
      const next = { ...current };
      delete next[itemId];
      return next;
    });

    try {
      const workspaceId = getActiveWorkspaceId();
      if (!workspaceId) {
        throw new Error("Select a workspace to continue.");
      }
      const result = await fetch(
        withWorkspaceQuery(`/api/assessments/${assessment.id}/answers/${itemId}`, workspaceId),
        {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, note }),
      });

      if (!isSharedView && result.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      if (!result.ok) {
        const payload = (await result.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to save answer.");
      }

      setAssessment((current) => {
        if (!current) return current;
        const now = new Date().toISOString();
        const existingIndex = current.answers.findIndex((answer) => answer.itemId === itemId);
        const nextAnswers = [...current.answers];

        if (existingIndex >= 0) {
          const existing = nextAnswers[existingIndex];
          if (existing) {
            nextAnswers[existingIndex] = {
              itemId: existing.itemId,
              response,
              note,
              updatedAt: now,
            };
          }
        } else {
          nextAnswers.push({ itemId, response, note, updatedAt: now });
        }

        return {
          ...current,
          updatedAt: now,
          answers: nextAnswers,
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save answer.";
      setItemErrors((current) => ({
        ...current,
        [itemId]: message,
      }));
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 100));
      setSavingItemId(null);
    }
  };

  const submitAssessment = async () => {
    if (!assessment || assessment.status !== "draft" || submitting || isSharedView) return;
    if (progress.unanswered > 0) {
      const shouldSubmit = window.confirm(
        `There are ${progress.unanswered} unanswered checklist items. Submit anyway?`
      );
      if (!shouldSubmit) return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const workspaceId = getActiveWorkspaceId();
      if (!workspaceId) {
        throw new Error("Select a workspace to continue.");
      }
      const response = await fetch(
        withWorkspaceQuery(`/api/assessments/${assessment.id}/submit`, workspaceId),
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!isSharedView && response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to submit assessment.");
      }

      navigate("/assessments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit assessment.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#d9d4c8] bg-white p-6">
        <p className="text-sm text-[#7a7468]">Loading assessment...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="rounded-2xl border border-[#d9d4c8] bg-white p-6">
        <p className="text-sm text-[#8a5648]">{error ?? "Assessment not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: "Assessments", to: "/assessments" },
          {
            label: `${assessment.auditPublicId} - ${assessment.auditName} (v${assessment.auditVersionNo}) for ${assessment.entityType}/${assessment.entityName} (#${assessment.id})`,
          },
        ]}
      />
      <section className="space-y-2">
        <div className="rounded-xl border border-[#e2dccf] bg-[#fcfbf8] p-4 text-sm text-[#4f4a3f]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#7a7468]">
              {isSharedView
                ? "Public report view. Editing requires signed-in access."
                : "Assessment is locked after submit. Draft assessments can be edited inline."}
            </p>
            <span className="text-xs text-[#7a7468]">
              Last updated {formatDateLabel(assessment.updatedAt)}
            </span>
          </div>
          {isSharedView && assessment.reportShareHash ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-[#7a7468]">
              <LinkIcon size={12} />
              /share/{assessment.auditPublicId}/{assessment.reportShareHash}
            </p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-[#8a5648]">{error}</p> : null}
      </section>

      {assessment.snapshot.dimensions.map((dimension) => (
        (() => {
          return (
        <section
          key={dimension.id}
          className="rounded-2xl border border-[#d9d4c8] bg-white p-5 space-y-4"
        >
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-[#a8a293]">{dimension.position}.</span>
            {dimension.name}
          </h2>

          <div className="space-y-4">
            {dimension.criteria.map((criterion) => (
              (() => {
                const criterionTotal = criterion.items.length;
                const criterionAnswered = criterion.items.filter(
                  (item) => (answerByItemId.get(item.id)?.response ?? "none") !== "none"
                ).length;

                return (
              <article
                key={criterion.id}
                className="rounded-xl border border-[#e7e1d5] bg-[#fcfbf8] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">
                    <span className="mr-2 text-[#a8a293]">{criterion.position}.</span>
                    {criterion.name}
                  </h3>
                  <span className="inline-flex items-center rounded-full border border-[#d4cec0] bg-white px-2 py-0.5 text-xs text-[#5f594d] tabular-nums">
                    {criterionAnswered}/{criterionTotal}
                  </span>
                </div>
                {criterion.description.trim() ? (
                  <p className="text-sm text-[#6b665b]">{criterion.description}</p>
                ) : null}

                <div className="space-y-2">
                  {criterion.items.map((item) => {
                    const answer = answerByItemId.get(item.id) ?? {
                      response: "none" as AssessmentResponse,
                      note: "",
                      updatedAt: "",
                    };
                    const isSaving = savingItemId === item.id;
                    const isLocked = isSharedView || assessment.status !== "draft";

                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border border-[#e4decf] bg-white p-3 ${
                          isSaving ? "opacity-75" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              <span className="mr-2 text-[#a8a293]">{item.position}.</span>
                              {item.name}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {(["pass", "fail", "partial", "na", "none"] as const).map((value) => (
                              <button
                                key={value}
                                type="button"
                                disabled={isLocked || isSaving}
                                className={responseButtonClass(value, answer.response === value)}
                                onClick={() => void saveAnswer(item.id, value, answer.note)}
                                title={responseLabel(value)}
                              >
                                {value === "pass" ? <Check size={13} /> : null}
                                {value === "fail" ? <X size={13} /> : null}
                                {value === "partial" ? <CircleDashed size={13} /> : null}
                                <span>{responseLabel(value)}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <textarea
                          value={answer.note}
                          disabled={isLocked || isSaving}
                          onChange={(event) => {
                            const note = event.target.value;
                            setAssessment((current) => {
                              if (!current) return current;
                              const existingIndex = current.answers.findIndex((currentAnswer) => currentAnswer.itemId === item.id);
                              const nextAnswers = [...current.answers];
                              if (existingIndex >= 0) {
                                const existing = nextAnswers[existingIndex];
                                if (existing) {
                                  nextAnswers[existingIndex] = {
                                    itemId: existing.itemId,
                                    response: existing.response,
                                    note,
                                    updatedAt: existing.updatedAt,
                                  };
                                }
                              } else {
                                nextAnswers.push({
                                  itemId: item.id,
                                  response: "none",
                                  note,
                                  updatedAt: "",
                                });
                              }

                              return {
                                ...current,
                                answers: nextAnswers,
                              };
                            });
                          }}
                          onBlur={(event) => void saveAnswer(item.id, answer.response, event.target.value)}
                          placeholder="Add evidence or context"
                          className="mt-2 min-h-16 w-full rounded-md border border-[#d4cec0] px-2 py-2 text-sm placeholder:text-[#bcb6a8]"
                        />

                        <div className="mt-2 flex items-center justify-between text-xs text-[#7a7468]">
                          {isSaving ? (
                            <span className="inline-flex items-center gap-1 text-[#1f6feb]">
                              <Loader2 size={12} className="animate-spin" /> Saving
                            </span>
                          ) : itemErrors[item.id] ? (
                            <span className="text-[#8a5648]">{itemErrors[item.id]}</span>
                          ) : <span />}
                          <span>Updated {formatDateLabel(answer.updatedAt || null)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
                );
              })()
            ))}
          </div>
        </section>
          );
        })()
      ))}

      {assessment.status === "draft" && !isSharedView ? (
        <section className="sticky bottom-4 z-20 rounded-xl border border-[#d9d4c8] bg-white/95 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-[#4f4a3f] tabular-nums">
                <Shield size={14} className="text-[#1f6feb]" />
                <span className="inline-block w-[20ch]">
                  Score {liveScore.score}/{liveScore.max} (N/A: {scoringScope.naCount})
                </span>
                <span className="inline-block w-[26ch]">
                  {progress.unanswered} unanswered ({progress.completionPercent}%, {progress.answered}/{progress.total})
                </span>
                <div className="h-2 w-32 overflow-hidden rounded-full bg-[#e9e4d8]">
                  <div
                    className="h-full rounded-full bg-[#1f6feb] transition-all"
                    style={{ width: `${progress.completionPercent}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => void submitAssessment()}
                disabled={submitting}
                className="shrink-0 rounded-lg bg-[#1f6feb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b63d6] disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit assessment"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
