CREATE TABLE "job_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"title" text NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_question" text,
	"profile" jsonb,
	"generated_draft" jsonb,
	"job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_briefs" ADD CONSTRAINT "job_briefs_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_briefs" ADD CONSTRAINT "job_briefs_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_briefs_workspace_created_idx" ON "job_briefs" USING btree ("workspace_id","created_at");