import type { Kysely } from "kysely";
import type { DB } from "../types";
import { AuditChecklistItemRepository } from "./audit-checklist-item-repository";
import { AuditCriterionRepository } from "./audit-criterion-repository";
import { AuditDimensionRepository } from "./audit-dimension-repository";
import { AuditRepository } from "./audit-repository";
import { AuditVersionRepository } from "./audit-version-repository";
import { AssessmentRepository } from "./assessment-repository";
import { EntityRepository } from "./entity-repository";

export function createAuditRepositories(db: Kysely<DB>) {
  return {
    audit: new AuditRepository(db),
    dimension: new AuditDimensionRepository(db),
    criterion: new AuditCriterionRepository(db),
    checklistItem: new AuditChecklistItemRepository(db),
    version: new AuditVersionRepository(db),
    entity: new EntityRepository(db),
    assessment: new AssessmentRepository(db),
  };
}

export {
  AuditRepository,
  AuditDimensionRepository,
  AuditCriterionRepository,
  AuditChecklistItemRepository,
  AuditVersionRepository,
  EntityRepository,
  AssessmentRepository,
};
