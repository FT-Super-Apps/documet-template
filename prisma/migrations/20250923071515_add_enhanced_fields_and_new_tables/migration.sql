/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `signers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `last_updated_at` to the `signed_documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dev"."document_fields" ADD COLUMN     "display_order" INTEGER DEFAULT 0,
ADD COLUMN     "help_text" VARCHAR(500),
ADD COLUMN     "is_active" BOOLEAN DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(6),
ADD COLUMN     "validation_rules" TEXT;

-- AlterTable
ALTER TABLE "dev"."documents" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_filesize_mb" INTEGER DEFAULT 10,
ADD COLUMN     "updated_at" TIMESTAMP(6),
ADD COLUMN     "version" VARCHAR(10) DEFAULT '1.0';

-- AlterTable
ALTER TABLE "dev"."signed_documents" ADD COLUMN     "approved_by" VARCHAR(255),
ADD COLUMN     "created_by" VARCHAR(255),
ADD COLUMN     "expiry_date" TIMESTAMP(6),
ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "last_updated_at" TIMESTAMP(6) NOT NULL,
ADD COLUMN     "priority_level" VARCHAR(20) DEFAULT 'normal',
ADD COLUMN     "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
ADD COLUMN     "status_notes" TEXT;

-- AlterTable
ALTER TABLE "dev"."signers" ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "last_signed_at" TIMESTAMP(6),
ADD COLUMN     "phone" VARCHAR(20),
ADD COLUMN     "position_title" VARCHAR(255),
ADD COLUMN     "signature_image_path" VARCHAR(500);

-- CreateTable
CREATE TABLE "dev"."document_templates" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "template_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_type" VARCHAR(10) NOT NULL DEFAULT 'docx',
    "file_size" INTEGER,
    "checksum" VARCHAR(64),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."document_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color_hex" VARCHAR(7) DEFAULT '#3B82F6',
    "icon" VARCHAR(50),
    "sort_order" INTEGER DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."document_history" (
    "id" SERIAL NOT NULL,
    "signed_doc_id" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "performed_by" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."notifications" (
    "id" SERIAL NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'info',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(6),
    "related_doc_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."audit_logs" (
    "id" SERIAL NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" VARCHAR(100) NOT NULL,
    "operation" VARCHAR(20) NOT NULL,
    "old_values" TEXT,
    "new_values" TEXT,
    "user_info" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_document_id_template_name_key" ON "dev"."document_templates"("document_id", "template_name");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_name_key" ON "dev"."document_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "signers_email_key" ON "dev"."signers"("email");

-- AddForeignKey
ALTER TABLE "dev"."document_templates" ADD CONSTRAINT "document_templates_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "dev"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev"."document_history" ADD CONSTRAINT "document_history_signed_doc_id_fkey" FOREIGN KEY ("signed_doc_id") REFERENCES "dev"."signed_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
