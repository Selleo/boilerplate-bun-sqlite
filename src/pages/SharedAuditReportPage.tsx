import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Report } from "../report/Report";
import type { Grade, ReportData } from "../report/types";

type AssessmentResponse = "pass" | "fail" | "partial" | "na" | "none";

type SharedAssessmentDetail = {
  id: number;
  auditPublicId: string;
  auditName: string;
  auditVersionNo: number;
  entityType: string;
  entityName: string;
  submittedAt: string | null;
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
    dimensions: Array<{
      id: number;
      data: {
        min: number;
        max: number;
        score: number;
        result: number | null;
        grade: string;
        maxGrade: string;
      };
    }>;
    criteria: Array<{
      id: number;
      dimensionId: number;
      data: {
        min: number;
        max: number;
        score: number;
        result: number | null;
        grade: string;
        maxGrade: string;
      };
    }>;
    items: Array<{
      id: number;
      criterionId: number;
      dimensionId: number;
      data: {
        status: AssessmentResponse;
        comment: string;
      };
    }>;
  };
  snapshot: {
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

function toCheckStatus(response: AssessmentResponse): "done" | "partial" | "none" | "na" {
  if (response === "pass") return "done";
  if (response === "partial") return "partial";
  if (response === "na") return "na";
  return "none";
}

function gradeFromResult(result: number | null): Grade {
  if (result === null || Number.isNaN(result)) return "N/A";
  if (result <= 0.19) return "F";
  if (result <= 0.39) return "E";
  if (result <= 0.54) return "D";
  if (result <= 0.69) return "C";
  if (result <= 0.89) return "B";
  return "A";
}

function buildReportData(assessment: SharedAssessmentDetail): ReportData {
  const itemDataById = new Map<number, (typeof assessment.score.items)[number]["data"]>(
    assessment.score.items.map((item) => [item.id, item.data])
  );

  const criterionScoreById = new Map<number, (typeof assessment.score.criteria)[number]["data"]>(
    assessment.score.criteria.map((criterion) => [criterion.id, criterion.data])
  );

  const dimensions = [...assessment.snapshot.dimensions]
    .sort((a, b) => a.position - b.position)
    .map((dimension) => {
      const criteria = [...dimension.criteria]
        .sort((a, b) => a.position - b.position)
        .map((criterion) => {
          const checklist = [...criterion.items]
            .sort((a, b) => a.position - b.position)
            .map((item) => {
              const itemData = itemDataById.get(item.id);
              const response = itemData?.status ?? "none";
              return {
                id: String(item.id),
                label: item.name,
                status: toCheckStatus(response),
                comments: itemData?.comment?.trim() ? [itemData.comment.trim()] : undefined,
              };
            });

          const criterionScore = criterionScoreById.get(criterion.id);
          const scoreText = criterionScore
            ? `${criterionScore.score}/${criterionScore.max}`
            : "No submitted score.";
          const criterionGrade = criterionScore
            ? gradeFromResult(criterionScore.result)
            : ("N/A" as Grade);

          return {
            id: String(criterion.id),
            name: criterion.name,
            score: criterionGrade,
            comment: criterion.description
              ? `${criterion.description} (${scoreText})`
              : scoreText,
            checklist,
          };
        });

      return {
        id: String(dimension.id),
        name: dimension.name,
        criteria,
      };
    });

  return {
    title: `${assessment.auditName} Report`,
    project: assessment.auditName,
    auditPublicId: assessment.auditPublicId,
    entityName:
      assessment.entityName && assessment.entityType
        ? `${assessment.entityType}/${assessment.entityName}`
        : (assessment.entityName || "Unknown Entity"),
    date: formatDateLabel(assessment.submittedAt),
    version: String(assessment.auditVersionNo),
    overallScore: gradeFromResult(assessment.score.full.data.result),
    dimensions,
  };
}

export function SharedAuditReportPage() {
  const { auditPublicId, reportShareHash } = useParams<{
    auditPublicId: string;
    reportShareHash: string;
  }>();

  const [assessment, setAssessment] = useState<SharedAssessmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!auditPublicId || !reportShareHash) {
        setError("Invalid report link.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/share/${encodeURIComponent(auditPublicId)}/${encodeURIComponent(reportShareHash)}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "Failed to load shared report.");
        }

        const data = (await response.json()) as { assessment: SharedAssessmentDetail };
        if (!cancelled) {
          setAssessment(data.assessment);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load shared report.");
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
  }, [auditPublicId, reportShareHash]);

  const reportData = useMemo(() => {
    if (!assessment) return null;
    return buildReportData(assessment);
  }, [assessment]);

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6">
          <p className="text-sm text-[#7a7468]">Loading report...</p>
        </section>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6">
          <p className="text-sm text-[#8a5648]">{error ?? "Report not found."}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Report data={reportData} />
    </div>
  );
}
