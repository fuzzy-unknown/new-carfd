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

// ===== 故事探索项目表 =====
export const storyProjects = sqliteTable("story_projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storyText: text("story_text").notNull(),
  status: text("status").notNull().default("ready"), // analyzing, ready, generating, completed
  isDeleted: integer("is_deleted").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type StoryProject = typeof storyProjects.$inferSelect;
export type NewStoryProject = typeof storyProjects.$inferInsert;

// ===== 故事场景表 =====
export const storyScenes = sqliteTable("story_scenes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => storyProjects.id),
  sceneNumber: integer("scene_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  videoPrompt: text("video_prompt").notNull(),
  characterNames: text("character_names"), // JSON array of character names
  videoTaskId: text("video_task_id"),
  videoUrl: text("video_url"),
  status: text("status").notNull().default("pending"), // pending, generating, completed, failed
  errorMessage: text("error_message"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type StoryScene = typeof storyScenes.$inferSelect;
export type NewStoryScene = typeof storyScenes.$inferInsert;

// ===== 故事角色表 =====
export const storyCharacters = sqliteTable("story_characters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => storyProjects.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  appearance: text("appearance"),
  referenceImageUrl: text("reference_image_url"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type StoryCharacter = typeof storyCharacters.$inferSelect;
export type NewStoryCharacter = typeof storyCharacters.$inferInsert;
