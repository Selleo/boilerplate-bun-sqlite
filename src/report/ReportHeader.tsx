import type { Grade, Criterion } from "./types";
import { ScoreBadge } from "./ScoreBadge";

function barColor(grade: Grade): string {
  if (grade === "N/A") return "bg-slate-400";
  const offset = Math.max(0, Math.min(5, grade.toUpperCase().charCodeAt(0) - "A".charCodeAt(0)));
  return ["bg-green-500", "bg-lime-500", "bg-yellow-400", "bg-orange-500", "bg-red-500", "bg-red-700"][
    offset
  ]!;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function GradeDistribution({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const grades = Object.keys(counts).sort();

  return (
    <div className="flex-1 flex items-center gap-3 ml-auto">
      <span className="text-xs text-slate-400 shrink-0">Distribution</span>
      <div className="flex-1 flex h-5 rounded-md overflow-hidden gap-px">
        {grades.map((g) =>
          (counts[g] ?? 0) > 0 ? (
            <div
              key={g}
              className={`${barColor(g)} flex items-center justify-center`}
              style={{ width: `${((counts[g] ?? 0) / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <div className="flex gap-2 text-[10px] text-slate-400 shrink-0">
        {grades.map((g) =>
          (counts[g] ?? 0) > 0 ? (
            <span key={g}>
              {g}:{counts[g] ?? 0}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function ReportHeader({
  title,
  project,
  auditPublicId,
  entityName,
  date,
  version,
  overallScore,
  dimensionCount,
  criteria,
}: {
  title: string;
  project: string;
  auditPublicId?: string;
  entityName?: string;
  date: string;
  version: string;
  overallScore: Grade;
  dimensionCount: number;
  criteria: Criterion[];
}) {
  const totalChecks = criteria.reduce((sum, c) => sum + c.checklist.length, 0);

  const counts: Record<string, number> = {};
  for (const c of criteria) {
    counts[c.score] = (counts[c.score] ?? 0) + 1;
  }

  return (
    <header className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm print:rounded-none print:shadow-none print:border-x-0">
      <div className="px-8 py-8 flex items-start gap-8 print:px-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Assessment Report</p>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">{title}</h1>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-400">
            <span>v{version}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>{auditPublicId ?? project}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>{date}</span>
          </div>
          {entityName ? <p className="mt-2 text-sm text-slate-500">{entityName}</p> : null}
        </div>
        <div className="flex flex-col items-center gap-2">
          <ScoreBadge grade={overallScore} size="xl" />
        </div>
      </div>

      <div className="border-t border-slate-100 px-8 py-4 flex gap-8 print:px-2">
        <Stat label="Dimensions" value={dimensionCount} />
        <Stat label="Criteria" value={criteria.length} />
        <Stat label="Checks" value={totalChecks} />
        <GradeDistribution counts={counts} />
      </div>
    </header>
  );
}
