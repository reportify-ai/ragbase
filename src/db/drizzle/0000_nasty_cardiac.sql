CREATE TABLE `embedding_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`apiUrl` text NOT NULL,
	`dimension` integer NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `embedding_models_name_unique` ON `embedding_models` (`name`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`size` integer NOT NULL,
	`hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`status` integer DEFAULT 0 NOT NULL,
	`sync_directory_id` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kbs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kbs_name_unique` ON `kbs` (`name`);--> statement-breakpoint
CREATE TABLE `models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`apiUrl` text NOT NULL,
	`apiKey` text,
	`contextSize` integer NOT NULL,
	`temperature` real NOT NULL,
	`topP` real NOT NULL,
	`maxTokens` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `models_name_unique` ON `models` (`name`);--> statement-breakpoint
CREATE TABLE `sync_directories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kb_id` integer NOT NULL,
	`dir_path` text NOT NULL,
	`sync_type` text NOT NULL,
	`recursive` integer DEFAULT false NOT NULL,
	`ignore_hidden` integer DEFAULT true NOT NULL,
	`ignore_large` integer DEFAULT true NOT NULL,
	`file_types` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `sync_directory_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_directory_id` integer NOT NULL,
	`kb_id` integer,
	`start_time` text NOT NULL,
	`end_time` text,
	`status` text NOT NULL,
	`total_files` integer DEFAULT 0 NOT NULL,
	`synced_files` integer DEFAULT 0 NOT NULL,
	`failed_files` integer DEFAULT 0 NOT NULL,
	`message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
