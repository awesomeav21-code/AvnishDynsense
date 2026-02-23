ALTER TABLE "tags" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;
