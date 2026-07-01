import { pgTable, uuid, text, timestamp, pgEnum, boolean, integer, date } from "drizzle-orm/pg-core";

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

export const contractors = pgTable("contractors", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  scope: text("scope"),
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

// Reusable SOP templates: a snapshot of stage/main task/sub task structure, no project-specific dates.
export const projectTemplates = pgTable("project_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  team: text("team", { enum: ["network", "osp", "finance", "management"] }),
  structure: text("structure").notNull(), // JSON: { stages: [{ name, tasks: [{ title, isMilestone, durationDays, subTasks: [{title, durationDays}] }] }] }
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
