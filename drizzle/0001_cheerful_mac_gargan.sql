CREATE TABLE `languageConfig` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` varchar(64) NOT NULL,
	`role` enum('nurse','patient') NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `languageConfig_id` PRIMARY KEY(`id`),
	CONSTRAINT `languageConfig_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`direction` varchar(32) NOT NULL,
	`sourceLang` varchar(16) NOT NULL,
	`targetLang` varchar(16) NOT NULL,
	`sourceText` text NOT NULL,
	`translatedText` text NOT NULL,
	`audioUrl` text,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `translations_id` PRIMARY KEY(`id`)
);
