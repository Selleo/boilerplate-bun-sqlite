import type { ColumnType, Generated } from "kysely";

type TimestampColumn = ColumnType<string, string | undefined, string>;

export type AuditTable = {
  id: Generated<number>;
  public_id: string;
  name: string;
  description: string;
  current_published_version_id: ColumnType<number | null, number | null | undefined, number | null>;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type AuditDimensionTable = {
  id: Generated<number>;
  audit_id: number;
  position: number;
  name: string;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type AuditCriterionTable = {
  id: Generated<number>;
  audit_dimension_id: number;
  position: number;
  name: string;
  description: string;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type AuditChecklistItemTable = {
  id: Generated<number>;
  audit_criterion_id: number;
  position: number;
  name: string;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type AuditVersionTable = {
  id: Generated<number>;
  audit_id: number;
  version_no: number;
  content_json: string;
  published_at: TimestampColumn;
  published_by_user_id: string | null;
};

export type EntityTable = {
  id: Generated<number>;
  entity_type: string;
  name: string;
  description: string;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type AssessmentTable = {
  id: Generated<number>;
  audit_id: number;
  audit_version_id: number;
  entity_id: number;
  workspace_id: number;
  status: "draft" | "submitted";
  report_share_hash: string | null;
  score_json: string | null;
  grade: string | null;
  created_by_user_id: string;
  submitted_by_user_id: string | null;
  submitted_at: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type UserTable = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: number;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentAnswerTable = {
  id: Generated<number>;
  assessment_id: number;
  audit_checklist_item_id: number;
  response: "pass" | "fail" | "partial" | "na" | "none";
  note: string;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type WorkspaceTable = {
  id: Generated<number>;
  name: string;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type WorkspaceMemberTable = {
  workspace_id: number;
  user_id: string;
  role: "workspace_manager";
  created_at: TimestampColumn;
};

export type WorkspaceEntityTable = {
  workspace_id: number;
  entity_id: number;
  created_at: TimestampColumn;
};

export type WorkspaceAuditTable = {
  workspace_id: number;
  audit_id: number;
  created_at: TimestampColumn;
};

export type UserRoleTable = {
  user_id: string;
  role: "admin" | "audit_manager" | "user";
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type DB = {
  audit: AuditTable;
  audit_dimension: AuditDimensionTable;
  audit_criterion: AuditCriterionTable;
  audit_checklist_item: AuditChecklistItemTable;
  audit_version: AuditVersionTable;
  entity: EntityTable;
  user: UserTable;
  assessment: AssessmentTable;
  assessment_answer: AssessmentAnswerTable;
  workspace: WorkspaceTable;
  workspace_member: WorkspaceMemberTable;
  workspace_entity: WorkspaceEntityTable;
  workspace_audit: WorkspaceAuditTable;
  user_role: UserRoleTable;
};
