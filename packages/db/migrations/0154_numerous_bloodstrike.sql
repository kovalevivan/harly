ALTER TABLE "job_briefs" ADD COLUMN "intake" jsonb;--> statement-breakpoint
ALTER TABLE "job_briefs" ADD COLUMN "resume_reviews" jsonb DEFAULT '[]'::jsonb NOT NULL;