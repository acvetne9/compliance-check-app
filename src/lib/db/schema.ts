import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Policy Documents
// ---------------------------------------------------------------------------

export const policies = pgTable(
  "policies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    folderId: text("folder_id").notNull(), // AA, CMC, DD, etc.
    fileName: text("file_name").notNull(),
    blobUrl: text("blob_url").notNull(),
    summary: text("summary"),
    structuredSummary: text("structured_summary"), // JSON: key provisions for Haiku triage
    pageCount: integer("page_count"),
    tokenCount: integer("token_count"),
    isIngested: boolean("is_ingested").default(false),
    ingestedAt: timestamp("ingested_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_policies_folder").on(table.folderId)]
);

export const policyChunks = pgTable(
  "policy_chunks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    policyId: text("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    pageStart: integer("page_start").notNull(),
    pageEnd: integer("page_end").notNull(),
    content: text("content").notNull(),
    sectionHeader: text("section_header"),
    tokenCount: integer("token_count").notNull(),
  },
  (table) => [index("idx_chunks_policy").on(table.policyId)]
);

// ---------------------------------------------------------------------------
// Compliance Documents
// ---------------------------------------------------------------------------

export const complianceDocs = pgTable("compliance_docs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  fileName: text("file_name").notNull(),
  blobUrl: text("blob_url").notNull(),
  textContent: text("text_content"),
  requirementsJson: text("requirements_json"),
  extractionStatus: text("extraction_status"),
  userId: text("user_id"), // null = shared/seed doc, set = user-uploaded
  pageCount: integer("page_count"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// Compliance Runs
// ---------------------------------------------------------------------------

export const complianceRuns = pgTable(
  "compliance_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    complianceDocId: text("compliance_doc_id")
      .notNull()
      .references(() => complianceDocs.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | extracting | checking | completed | failed
    requirementsCount: integer("requirements_count"),
    metCount: integer("met_count"),
    notMetCount: integer("not_met_count"),
    unclearCount: integer("unclear_count"),
    userId: text("user_id"),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_runs_compliance_doc").on(table.complianceDocId)]
);

// ---------------------------------------------------------------------------
// Requirements (extracted from a compliance doc per run)
// ---------------------------------------------------------------------------

export const requirements = pgTable(
  "requirements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    complianceRunId: text("compliance_run_id")
      .notNull()
      .references(() => complianceRuns.id, { onDelete: "cascade" }),
    externalId: text("external_id"), // e.g. "3.1.a" from the doc
    section: text("section"),
    text: text("text").notNull(),
    textHash: text("text_hash").notNull(), // normalized hash for cross-run caching
    category: text("category"),
    aggregatedStatus: text("aggregated_status"), // met | not_met | unclear
  },
  (table) => [index("idx_requirements_run").on(table.complianceRunId)]
);

// ---------------------------------------------------------------------------
// Compliance Results (one per requirement × policy pair)
// ---------------------------------------------------------------------------

export const complianceResults = pgTable(
  "compliance_results",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requirementId: text("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    policyId: text("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    complianceRunId: text("compliance_run_id")
      .notNull()
      .references(() => complianceRuns.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // met | not_met | unclear
    evidence: text("evidence"),
    confidence: integer("confidence"), // 0-100
    reasoning: text("reasoning"),
    checkedAt: timestamp("checked_at").defaultNow(),
  },
  (table) => [
    index("idx_results_requirement").on(table.requirementId),
    index("idx_results_policy").on(table.policyId),
    index("idx_results_run").on(table.complianceRunId),
  ]
);

// ---------------------------------------------------------------------------
// Cross-Run Cache (requirement_hash + policy_id → cached result)
// ---------------------------------------------------------------------------

export const cachedChecks = pgTable(
  "cached_checks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requirementHash: text("requirement_hash").notNull(),
    policyId: text("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // met | not_met | unclear
    evidence: text("evidence"),
    confidence: integer("confidence"),
    reasoning: text("reasoning"),
    checkedAt: timestamp("checked_at").defaultNow(),
  },
  (table) => [
    unique("uq_cached_check").on(table.requirementHash, table.policyId),
    index("idx_cached_req_hash").on(table.requirementHash),
  ]
);

// ---------------------------------------------------------------------------
// Category-level policy cache (skip entire categories on re-runs)
// ---------------------------------------------------------------------------

export const categoryPolicyCache = pgTable(
  "category_policy_cache",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    category: text("category").notNull(),
    policyId: text("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // not_applicable = all reqs in category were N/A
    checkedAt: timestamp("checked_at").defaultNow(),
  },
  (table) => [
    unique("uq_category_policy").on(table.category, table.policyId),
    index("idx_category_policy_lookup").on(table.category, table.policyId),
  ]
);

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type Policy = typeof policies.$inferSelect;
export type PolicyChunk = typeof policyChunks.$inferSelect;
export type ComplianceDoc = typeof complianceDocs.$inferSelect;
export type ComplianceRun = typeof complianceRuns.$inferSelect;
export type Requirement = typeof requirements.$inferSelect;
export type ComplianceResult = typeof complianceResults.$inferSelect;
export type CachedCheck = typeof cachedChecks.$inferSelect;
export type CategoryPolicyCache = typeof categoryPolicyCache.$inferSelect;
