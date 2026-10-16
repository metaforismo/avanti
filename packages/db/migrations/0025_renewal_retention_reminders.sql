CREATE TABLE "renewal_reminders" (
	"source_case_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"office_id" text NOT NULL,
	"family_id" text NOT NULL,
	"reference" text NOT NULL,
	"language" text NOT NULL,
	"practice_year" integer NOT NULL,
	"contact" jsonb NOT NULL,
	"household" jsonb NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"consent_version" text NOT NULL,
	"withdrawal_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "renewal_reminders_withdrawal_token_hash_unique" UNIQUE("withdrawal_token_hash"),
	CONSTRAINT "renewal_reminders_year_check" CHECK ("renewal_reminders"."practice_year" between 2020 and 2099),
	CONSTRAINT "renewal_reminders_language_check" CHECK ("renewal_reminders"."language" in ('it','en','fr','es','ro','uk','ar','bn')),
	CONSTRAINT "renewal_reminders_expiry_check" CHECK ("renewal_reminders"."expires_at" <= make_timestamptz("renewal_reminders"."practice_year" + 1, 4, 1, 0, 0, 0, 'Europe/Rome'))
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "renewal_contact_consent_version" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "renewal_contact_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "renewal_reminders" ADD CONSTRAINT "renewal_reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_reminders" ADD CONSTRAINT "renewal_reminders_office_id_organization_id_offices_id_organization_id_fk" FOREIGN KEY ("office_id","organization_id") REFERENCES "public"."offices"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "renewal_reminders_campaign_idx" ON "renewal_reminders" USING btree ("organization_id","practice_year","source_case_id");--> statement-breakpoint
CREATE INDEX "renewal_reminders_family_idx" ON "renewal_reminders" USING btree ("organization_id","family_id");--> statement-breakpoint
CREATE INDEX "renewal_reminders_expiry_idx" ON "renewal_reminders" USING btree ("expires_at");