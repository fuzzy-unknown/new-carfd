CREATE TABLE `generation_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text,
	`model` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`input_params` text NOT NULL,
	`output_result` text,
	`cost` text,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_records_task_id_unique` ON `generation_records` (`task_id`);