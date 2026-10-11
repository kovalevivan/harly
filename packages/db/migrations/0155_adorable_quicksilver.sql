CREATE TABLE "briefing_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefing_turns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brief_id" uuid NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_briefs" ADD COLUMN "agent_lease_id" uuid;--> statement-breakpoint
ALTER TABLE "job_briefs" ADD COLUMN "agent_lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "briefing_invitations" ADD CONSTRAINT "briefing_invitations_brief_id_job_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."job_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing_turns" ADD CONSTRAINT "briefing_turns_brief_id_job_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."job_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "briefing_invitations_brief_idx" ON "briefing_invitations" USING btree ("brief_id");--> statement-breakpoint
CREATE INDEX "briefing_turns_brief_created_idx" ON "briefing_turns" USING btree ("brief_id","created_at");