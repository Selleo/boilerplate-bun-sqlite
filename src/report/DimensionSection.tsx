import type { Grade, Criterion as CriterionType, ChecklistItem } from "./types";
import { ScoreBadge } from "./ScoreBadge";
import { ChecklistRow } from "./ChecklistItem";

function averageGrade(grades: Grade[]): Grade {
  const valid = grades.filter((grade) => grade !== "N/A");
  if (valid.length === 0) return "N/A";

  const avgOffset =
    valid.reduce((sum, grade) => {
      const offset = Math.max(0, grade.toUpperCase().charCodeAt(0) - "A".charCodeAt(0));
      return sum + offset;
    }, 0) / valid.length;

  return String.fromCharCode("A".charCodeAt(0) + Math.round(avgOffset));
}

function CriterionHeader({ name, score, comment }: {
  name: string;
  score: Grade;
  comment: string;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-5 border-b border-[#ece7dd] print:px-2 print:bg-[#f8f5ef]">
      <ScoreBadge grade={score} size="lg" />
      <div className="flex-1 min-w-0">
        <h4 className="text-base font-semibold text-[#2e2a24]">{name}</h4>
        <p className="text-sm text-[#7a7468] mt-0.5 leading-relaxed">{comment}</p>
      </div>
    </div>
  );
}

function CriterionBody({ checklist }: { checklist: ChecklistItem[] }) {
  return (
    <div className="px-3 py-2 divide-y divide-slate-100 print:px-0">
      {checklist.map((item) => (
        <ChecklistRow key={item.id} label={item.label} status={item.status} comments={item.comments} />
      ))}
    </div>
  );
}

function Criterion({ name, score, comment, checklist }: {
  name: string;
  score: Grade;
  comment: string;
  checklist: ChecklistItem[];
}) {
  return (
    <div className="bg-white border border-[#e7e1d5] rounded-xl overflow-hidden shadow-sm print:rounded-none print:shadow-none print:border-0 print:bg-transparent print:py-2">
      <CriterionHeader name={name} score={score} comment={comment} />
      <CriterionBody checklist={checklist} />
    </div>
  );
}

function DimensionHeader({ name, criteriaCount, grade }: {
  name: string;
  criteriaCount: number;
  grade: Grade;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-5 border-b border-[#ddd7ca] bg-[#fbf9f4] print:px-2 print:bg-[#f4f1ea]">
      <div className="flex-1">
        <h3 className="text-lg font-bold text-[#2e2a24]">{name}</h3>
        <p className="text-xs text-[#7a7468] mt-0.5">
          {criteriaCount} criteria evaluated
        </p>
      </div>
      <ScoreBadge grade={grade} size="lg" />
    </div>
  );
}

function DimensionBody({ criteria }: { criteria: CriterionType[] }) {
  return (
    <div className="p-5 flex flex-col gap-4 print:p-0 print:gap-0">
      {criteria.map((c) => (
        <Criterion key={c.id} name={c.name} score={c.score} comment={c.comment} checklist={c.checklist} />
      ))}
    </div>
  );
}

export function DimensionSection({ name, criteria }: {
  name: string;
  criteria: CriterionType[];
}) {
  const dimGrade = averageGrade(criteria.map((c) => c.score));
  return (
    <section className="relative print:break-after-page">
      <div className="relative border border-[#d9d4c8] rounded-2xl overflow-hidden bg-[#fdfcf8] print:rounded-none print:border-x-0 print:bg-white">
        <DimensionHeader name={name} criteriaCount={criteria.length} grade={dimGrade} />
        <DimensionBody criteria={criteria} />
      </div>
    </section>
  );
}
