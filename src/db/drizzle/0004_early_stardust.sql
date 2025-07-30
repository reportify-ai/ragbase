ALTER TABLE `models` ADD `provider` text DEFAULT 'ollama' NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `is_default` integer DEFAULT false NOT NULL;