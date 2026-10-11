CREATE TABLE "hiring_review_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"resume_text" text NOT NULL,
	"reference" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_id" uuid,
	"review_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hiring_review_jobs" ADD CONSTRAINT "hiring_review_jobs_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_review_jobs" ADD CONSTRAINT "hiring_review_jobs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_review_jobs" ADD CONSTRAINT "hiring_review_jobs_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hiring_review_jobs_application_dedupe_idx" ON "hiring_review_jobs" USING btree ("application_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "hiring_review_jobs_due_idx" ON "hiring_review_jobs" USING btree ("status","lease_until");--> statement-breakpoint
CREATE INDEX "hiring_review_jobs_workspace_application_idx" ON "hiring_review_jobs" USING btree ("workspace_id","application_id","requested_at");