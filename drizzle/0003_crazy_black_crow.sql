CREATE TABLE `conversationSummaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`summary` text NOT NULL,
	`keyPoints` text,
	`messageCount` int NOT NULL,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversationSummaries_id` PRIMARY KEY(`id`)
);
