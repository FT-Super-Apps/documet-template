-- CreateTable
CREATE TABLE "dev"."document_signature_config" (
    "id" SERIAL NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "required_signature_count" INTEGER NOT NULL DEFAULT 1,
    "required_roles" TEXT[],
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "document_signature_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_signature_config_document_type_key" ON "dev"."document_signature_config"("document_type");
