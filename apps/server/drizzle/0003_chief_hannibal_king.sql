CREATE TABLE `story_characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`appearance` text,
	`reference_image_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON UPDATE no action ON DELETE no action
);
