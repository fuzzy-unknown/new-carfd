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
  title: text("title"),
  storyText: text("story_text").notNull(),
  status: text("status").notNull().default("draft"), // draft, analyzed, characters_ready, scenes_ready, storyboard_ready, continuity_checked, generating, completed, failed
  analysisJson: text("analysis_json"),
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
  turnaroundSheetUrl: text("turnaround_sheet_url"),
  role: text("role"),
  profileJson: text("profile_json"),
  identityPrompt: text("identity_prompt"),
  negativePrompt: text("negative_prompt"),
  locked: integer("locked").notNull().default(0),
  referenceImagesJson: text("reference_images_json"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type StoryCharacter = typeof storyCharacters.$inferSelect;
export type NewStoryCharacter = typeof storyCharacters.$inferInsert;

// ===== 场景库表 =====
export const storyLocations = sqliteTable("story_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => storyProjects.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("mixed"),
  profileJson: text("profile_json").notNull(),
  scenePrompt: text("scene_prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  referenceImageUrl: text("reference_image_url"),
  locked: integer("locked").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type StoryLocation = typeof storyLocations.$inferSelect;
export type NewStoryLocation = typeof storyLocations.$inferInsert;

// ===== 分镜表 =====
export const storyShots = sqliteTable("story_shots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => storyProjects.id),
  shotIndex: integer("shot_index").notNull(),
  duration: integer("duration").notNull().default(5),
  locationId: integer("location_id").references(() => storyLocations.id),
  characterIdsJson: text("character_ids_json").notNull().default("[]"),
  narrative: text("narrative").notNull(),
  cameraJson: text("camera_json").notNull(),
  continuityJson: text("continuity_json").notNull(),
  videoPrompt: text("video_prompt"),
  negativePrompt: text("negative_prompt"),
  timelineJson: text("timeline_json"), // JSON array of {time: "0s-1s", action: "..."}
  environmentJson: text("environment_json"), // JSON object with backgroundMotion, lighting, mood, style
  videoTaskId: text("video_task_id"),
  videoUrl: text("video_url"),
  status: text("status").notNull().default("draft"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type StoryShot = typeof storyShots.$inferSelect;
export type NewStoryShot = typeof storyShots.$inferInsert;

// ===== 连续性检查结果表 =====
export const continuityReports = sqliteTable("continuity_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => storyProjects.id),
  issuesJson: text("issues_json").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type ContinuityReport = typeof continuityReports.$inferSelect;
export type NewContinuityReport = typeof continuityReports.$inferInsert;
