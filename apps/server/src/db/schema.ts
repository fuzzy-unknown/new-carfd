import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ===== 生成记录表 =====
export const generationRecords = sqliteTable("generation_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: text("task_id").unique(),
  model: text("model").notNull(),
  category: text("category").notNull(), // text, image, video, audio
  status: text("status").notNull(), // pending, processing, succeeded, failed
  inputParams: text("input_params").notNull(), // JSON string of input parameters
  outputResult: text("output_result"), // JSON string of output result
  cost: text("cost"), // JSON string of cost information {inputTokens, outputTokens, totalPrice}
  errorMessage: text("error_message"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type GenerationRecord = typeof generationRecords.$inferSelect;
export type NewGenerationRecord = typeof generationRecords.$inferInsert;
