CREATE TABLE `document_chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_id` integer NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chunk_id` integer NOT NULL,
	`embedding_model_id` integer NOT NULL,
	`vector` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE `files` ADD `mime_type` text;--> statement-breakpoint
ALTER TABLE `files` ADD `content_length` integer;--> statement-breakpoint
ALTER TABLE `files` ADD `last_processed` text;--> statement-breakpoint
ALTER TABLE `files` ADD `error_message` text;