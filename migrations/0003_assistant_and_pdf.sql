CREATE TABLE "material_files" (
	"material_id" uuid PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "material_files_size_check" CHECK (octet_length("material_files"."data") between 1 and 4194304)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_assistant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "material_files" ADD CONSTRAINT "material_files_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;