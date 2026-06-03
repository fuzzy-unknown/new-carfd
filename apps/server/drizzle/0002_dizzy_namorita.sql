CREATE TABLE `story_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_text` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `story_scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`scene_number` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`video_prompt` text NOT NULL,
	`video_task_id` text,
	`video_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON UPDATE no action ON DELETE no action
);
