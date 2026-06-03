CREATE TABLE `continuity_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`issues_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `story_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'mixed' NOT NULL,
	`profile_json` text NOT NULL,
	`scene_prompt` text NOT NULL,
	`negative_prompt` text,
	`locked` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `story_shots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`shot_index` integer NOT NULL,
	`duration` integer DEFAULT 5 NOT NULL,
	`location_id` integer,
	`character_ids_json` text DEFAULT '[]' NOT NULL,
	`narrative` text NOT NULL,
	`camera_json` text NOT NULL,
	`continuity_json` text NOT NULL,
	`video_prompt` text,
	`negative_prompt` text,
	`video_task_id` text,
	`video_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `story_locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_story_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`story_text` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`analysis_json` text,
	`is_deleted` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_story_projects`("id", "title", "story_text", "status", "analysis_json", "is_deleted", "created_at", "updated_at") SELECT "id", "title", "story_text", "status", "analysis_json", "is_deleted", "created_at", "updated_at" FROM `story_projects`;--> statement-breakpoint
DROP TABLE `story_projects`;--> statement-breakpoint
ALTER TABLE `__new_story_projects` RENAME TO `story_projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `story_characters` ADD `role` text;--> statement-breakpoint
ALTER TABLE `story_characters` ADD `profile_json` text;--> statement-breakpoint
ALTER TABLE `story_characters` ADD `identity_prompt` text;--> statement-breakpoint
ALTER TABLE `story_characters` ADD `negative_prompt` text;--> statement-breakpoint
ALTER TABLE `story_characters` ADD `locked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `story_characters` ADD `reference_images_json` text;