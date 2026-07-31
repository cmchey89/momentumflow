import { pgTable, uuid, text, timestamp, pgEnum, boolean, integer, date, numeric } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["superadmin", "manager", "member"] }).notNull().default("member"),
  team: text("team", { enum: ["network", "osp", "finance", "management"] }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "done"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "manager", "member"]);
export const teamEnum = pgEnum("team", ["network", "osp", "finance", "management"]);
export const handoffStatusEnum = pgEnum("handoff_status", ["active", "pending", "returned"]);
export const handoffRecordStatusEnum = pgEnum("handoff_record_status", ["pending", "resolved", "returned"]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),
  role: memberRoleEnum("role").default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  assignedTo: text("assigned_to"),
  createdBy: text("created_by").notNull(),
  dueDate: timestamp("due_date"),
  // Team fields
  sourceTeam: teamEnum("source_team"),
  currentTeam: teamEnum("current_team"),
  handoffStatus: handoffStatusEnum("handoff_status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const taskHandoffs = pgTable("task_handoffs", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  fromTeam: teamEnum("from_team").notNull(),
  toTeam: teamEnum("to_team").notNull(),
  note: text("note"),
  sentBy: text("sent_by").notNull(),
  status: handoffRecordStatusEnum("status").default("pending").notNull(),
  resolvedNote: text("resolved_note"),
  resolvedBy: text("resolved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const updates = pgTable("updates", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Project tracker: Background / Stages / Finance ─────────────────────────

export const projectBackground = pgTable("project_background", {
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).primaryKey(),
  why: text("why"),
  client: text("client"),
  poNumber: text("po_number"),
  poValue: integer("po_value"),
  targetStart: date("target_start"),
  targetEnd: date("target_end"),
  markupPct: numeric("markup_pct", { precision: 5, scale: 2 }).default("0"),
  claimedToDate: numeric("claimed_to_date", { precision: 12, scale: 2 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectFiles = pgTable("project_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stageStatusEnum = pgEnum("stage_status", ["pending", "in_progress", "done"]);

export const projectStages = pgTable("project_stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  status: stageStatusEnum("status").default("pending").notNull(),
  planStart: date("plan_start"),
  planEnd: date("plan_end"),
  actualStart: date("actual_start"),
  actualEnd: date("actual_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Main task and sub task both live here; a main task has parentId = null,
// a sub task has parentId = the main task's id. isMilestone only applies to main tasks.
export const planTasks = pgTable("plan_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  stageId: uuid("stage_id").references(() => projectStages.id, { onDelete: "cascade" }).notNull(),
  parentId: uuid("parent_id"),
  title: text("title").notNull(),
  isMilestone: boolean("is_milestone").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  planStart: date("plan_start"),
  planEnd: date("plan_end"),
  actualStart: date("actual_start"),
  actualEnd: date("actual_end"),
  status: stageStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskComments = pgTable("task_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").references(() => planTasks.id, { onDelete: "cascade" }).notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  text: text("text"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const claimStatusEnum = pgEnum("claim_status", ["pending", "submitted", "approved", "paid"]);
export const woTypeEnum = pgEnum("wo_type", ["original", "variation"]);
export const woStatusEnum = pgEnum("wo_status", ["active", "superseded"]);

export const contractors = pgTable("contractors", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  scope: text("scope"),
  allocatedBudget: numeric("allocated_budget", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contractorClaims = pgTable("contractor_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  contractorId: uuid("contractor_id").references(() => contractors.id, { onDelete: "cascade" }).notNull(),
  stageId: uuid("stage_id").references(() => projectStages.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  invoiceNo: text("invoice_no"),
  status: claimStatusEnum("status").default("pending").notNull(),
  claimDate: date("claim_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clientClaims = pgTable("client_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  stageId: uuid("stage_id").references(() => projectStages.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  invoiceNo: text("invoice_no"),
  status: claimStatusEnum("status").default("pending").notNull(),
  claimDate: date("claim_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Finance: Work Orders (Revenue) ────────────────────────────────────────

export const workOrders = pgTable("work_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  woNumber: text("wo_number").notNull(),
  description: text("description"),
  type: woTypeEnum("type").default("original").notNull(),
  status: woStatusEnum("status").default("active").notNull(),
  contractValue: numeric("contract_value", { precision: 12, scale: 2 }).notNull().default("0"),
  issueDate: date("issue_date"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Finance: Contractor POs (Cost) ────────────────────────────────────────

export const contractorPos = pgTable("contractor_pos", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  contractorId: uuid("contractor_id").references(() => contractors.id, { onDelete: "cascade" }).notNull(),
  poNumber: text("po_number").notNull(),
  scope: text("scope"),
  poValue: numeric("po_value", { precision: 12, scale: 2 }).notNull().default("0"),
  issueDate: date("issue_date"),
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PO Schedule of Values: each line item has unit, qty, rate, and completed qty for progress tracking.
export const poLineItems = pgTable("po_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  poId: uuid("po_id").references(() => contractorPos.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull().default("pcs"),
  totalQty: numeric("total_qty", { precision: 12, scale: 2 }).notNull().default("0"),
  unitRate: numeric("unit_rate", { precision: 12, scale: 2 }).notNull().default("0"),
  completedQty: numeric("completed_qty", { precision: 12, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Each payment is a partial draw against the PO; running total determines remaining PO balance.
export const poPayments = pgTable("po_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  poId: uuid("po_id").references(() => contractorPos.id, { onDelete: "cascade" }).notNull(),
  paymentDate: date("payment_date"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  invoiceRef: text("invoice_ref"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reusable SOP templates: a snapshot of stage/main task/sub task structure, no project-specific dates.
export const projectTemplates = pgTable("project_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  team: text("team", { enum: ["network", "osp", "finance", "management"] }),
  structure: text("structure").notNull(), // JSON: { stages: [{ name, tasks: [{ title, isMilestone, durationDays, subTasks: [{title, durationDays}] }] }] }
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Quotations: company-wide rate catalog + supplier costs, per-project quotations ─────

// Money on this feature uses numeric(12,2) (cents-precision), unlike the whole-dollar
// integers used elsewhere (poValue, claim amounts) — SOR/supplier rates need cents.
export const rateSourceEnum = pgEnum("rate_source", ["sor", "unscheduled_sor"]);
export const lineItemSourceEnum = pgEnum("line_item_source", ["sor", "unscheduled_sor", "adhoc"]);

export const rateCategories = pgTable("rate_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  markupPct: numeric("markup_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// SOR and Unscheduled SOR rates both live here, distinguished by `source` — one catalog
// to cross-reference against when pricing a quotation line item.
export const rateCatalogItems = pgTable("rate_catalog_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: rateSourceEnum("source").notNull(),
  categoryId: uuid("category_id").references(() => rateCategories.id, { onDelete: "set null" }),
  code: text("code").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supplierCostItems = pgTable("supplier_cost_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").references(() => rateCategories.id, { onDelete: "set null" }),
  supplierName: text("supplier_name").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  cost: numeric("cost", { precision: 12, scale: 2 }).notNull(),
  effectiveDate: date("effective_date"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotations = pgTable("quotations", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  quoteNumber: text("quote_number").notNull(),
  client: text("client"),
  quoteDate: date("quote_date"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Line items snapshot description/unit/rate at the time they're added, with an optional
// pointer back to the catalog/supplier source row for traceability — so a saved
// quotation doesn't silently change if the catalog is edited later.
export const quotationLineItems = pgTable("quotation_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  source: lineItemSourceEnum("source").notNull(),
  catalogItemId: uuid("catalog_item_id").references(() => rateCatalogItems.id, { onDelete: "set null" }),
  supplierCostItemId: uuid("supplier_cost_item_id").references(() => supplierCostItems.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  qty: numeric("qty", { precision: 12, scale: 2 }).notNull(),
  unitRate: numeric("unit_rate", { precision: 12, scale: 2 }).notNull(),
  markupPct: numeric("markup_pct", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
