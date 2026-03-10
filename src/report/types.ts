export type Grade = string;

export type CheckStatus = "done" | "partial" | "none" | "na";

export interface ChecklistItem {
  id: string;
  label: string;
  status: CheckStatus;
  comments?: string[];
}

export interface Criterion {
  id: string;
  name: string;
  score: Grade;
  comment: string;
  checklist: ChecklistItem[];
}

export interface Dimension {
  id: string;
  name: string;
  criteria: Criterion[];
}

export interface ReportData {
  title: string;
  project: string;
  auditPublicId?: string;
  entityName?: string;
  date: string;
  version: string;
  overallScore: Grade;
  dimensions: Dimension[];
}
