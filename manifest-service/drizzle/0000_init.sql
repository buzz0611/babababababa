CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text DEFAULT '' NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"tel" text DEFAULT '' NOT NULL,
	"representative" text DEFAULT '' NOT NULL,
	"jwnet_subscriber_no" text DEFAULT '' NOT NULL,
	"ledger_start_month" integer DEFAULT 4 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"direction" text NOT NULL,
	"title" text NOT NULL,
	"waste_types" text DEFAULT '' NOT NULL,
	"start_date" date,
	"end_date" date,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emitter_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"permit_no" text DEFAULT '' NOT NULL,
	"permit_authority" text DEFAULT '' NOT NULL,
	"permit_expiry" date,
	"methods" text DEFAULT '' NOT NULL,
	"is_final_disposal" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwnet_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"manifest_id" integer,
	"secondary_id" integer,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response" text DEFAULT '' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger_closures" (
	"facility_id" integer NOT NULL,
	"fiscal_year" integer NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_by" integer,
	CONSTRAINT "ledger_closures_facility_id_fiscal_year_pk" PRIMARY KEY("facility_id","fiscal_year")
);
--> statement-breakpoint
CREATE TABLE "manifests" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_id" integer NOT NULL,
	"medium" text NOT NULL,
	"manifest_no" text NOT NULL,
	"issue_date" date NOT NULL,
	"emitter_id" integer NOT NULL,
	"emitter_site_id" integer,
	"transporter_id" integer,
	"waste_type" text NOT NULL,
	"waste_name" text DEFAULT '' NOT NULL,
	"special" boolean DEFAULT false NOT NULL,
	"declared_qty" numeric(14, 3),
	"declared_unit" text DEFAULT 't' NOT NULL,
	"packaging" text DEFAULT '' NOT NULL,
	"received_date" date,
	"received_qty_t" numeric(14, 3),
	"disposal_method" text DEFAULT '' NOT NULL,
	"disposal_end_date" date,
	"disposed_qty_t" numeric(14, 3),
	"c2_sent_date" date,
	"d_sent_date" date,
	"disposal_reported_date" date,
	"final_notice_received_date" date,
	"final_disposal_date" date,
	"final_disposal_place" text DEFAULT '' NOT NULL,
	"e_sent_date" date,
	"final_reported_date" date,
	"note" text DEFAULT '' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"tel" text DEFAULT '' NOT NULL,
	"is_emitter" boolean DEFAULT false NOT NULL,
	"is_transporter" boolean DEFAULT false NOT NULL,
	"is_disposer" boolean DEFAULT false NOT NULL,
	"permit_no" text DEFAULT '' NOT NULL,
	"permit_authority" text DEFAULT '' NOT NULL,
	"permit_expiry" date,
	"jwnet_subscriber_no" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secondary_links" (
	"secondary_id" integer NOT NULL,
	"manifest_id" integer NOT NULL,
	"allocated_qty_t" numeric(14, 3),
	CONSTRAINT "secondary_links_secondary_id_manifest_id_pk" PRIMARY KEY("secondary_id","manifest_id")
);
--> statement-breakpoint
CREATE TABLE "secondary_manifests" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_id" integer NOT NULL,
	"medium" text NOT NULL,
	"manifest_no" text NOT NULL,
	"issue_date" date NOT NULL,
	"registered_date" date,
	"waste_type" text NOT NULL,
	"waste_name" text DEFAULT '' NOT NULL,
	"special" boolean DEFAULT false NOT NULL,
	"qty_t" numeric(14, 3) NOT NULL,
	"transporter_id" integer,
	"disposer_id" integer NOT NULL,
	"dest_address" text DEFAULT '' NOT NULL,
	"disposal_method" text DEFAULT '' NOT NULL,
	"is_final" boolean DEFAULT true NOT NULL,
	"b2_date" date,
	"d_date" date,
	"e_date" date,
	"final_disposal_date" date,
	"final_disposal_place" text DEFAULT '' NOT NULL,
	"reported_to_authority" date,
	"note" text DEFAULT '' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"login_id" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_login_id_unique" UNIQUE("login_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emitter_sites" ADD CONSTRAINT "emitter_sites_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jwnet_messages" ADD CONSTRAINT "jwnet_messages_manifest_id_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."manifests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jwnet_messages" ADD CONSTRAINT "jwnet_messages_secondary_id_secondary_manifests_id_fk" FOREIGN KEY ("secondary_id") REFERENCES "public"."secondary_manifests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jwnet_messages" ADD CONSTRAINT "jwnet_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_closures" ADD CONSTRAINT "ledger_closures_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_closures" ADD CONSTRAINT "ledger_closures_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_emitter_id_partners_id_fk" FOREIGN KEY ("emitter_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_emitter_site_id_emitter_sites_id_fk" FOREIGN KEY ("emitter_site_id") REFERENCES "public"."emitter_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_transporter_id_partners_id_fk" FOREIGN KEY ("transporter_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secondary_links" ADD CONSTRAINT "secondary_links_secondary_id_secondary_manifests_id_fk" FOREIGN KEY ("secondary_id") REFERENCES "public"."secondary_manifests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secondary_links" ADD CONSTRAINT "secondary_links_manifest_id_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."manifests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secondary_manifests" ADD CONSTRAINT "secondary_manifests_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secondary_manifests" ADD CONSTRAINT "secondary_manifests_transporter_id_partners_id_fk" FOREIGN KEY ("transporter_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secondary_manifests" ADD CONSTRAINT "secondary_manifests_disposer_id_partners_id_fk" FOREIGN KEY ("disposer_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secondary_manifests" ADD CONSTRAINT "secondary_manifests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manifests_no_idx" ON "manifests" USING btree ("medium","manifest_no");--> statement-breakpoint
CREATE UNIQUE INDEX "secondary_no_idx" ON "secondary_manifests" USING btree ("medium","manifest_no");