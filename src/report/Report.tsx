import type { ReportData } from "./types";
import { ReportHeader } from "./ReportHeader";
import { DimensionSection } from "./DimensionSection";

export function Report({ data }: { data: ReportData }) {
  const allCriteria = data.dimensions.flatMap((d) => d.criteria);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 print:px-0 print:py-0 print:mx-0 print:max-w-none">
      <ReportHeader
        title={data.title}
        project={data.project}
        auditPublicId={data.auditPublicId}
        entityName={data.entityName}
        date={data.date}
        version={data.version}
        overallScore={data.overallScore}
        dimensionCount={data.dimensions.length}
        criteria={allCriteria}
      />
      {data.dimensions.map((dimension) => (
        <DimensionSection key={dimension.id} name={dimension.name} criteria={dimension.criteria} />
      ))}
    </div>
  );
}
