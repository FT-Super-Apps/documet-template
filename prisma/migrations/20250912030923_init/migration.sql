-- CreateTable
CREATE TABLE "dev"."documents" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "prodi" VARCHAR(100),
    "template_path" VARCHAR(255),
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."document_fields" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER,
    "field_name" VARCHAR(255) NOT NULL,
    "field_type" VARCHAR(50) NOT NULL,
    "is_required" BOOLEAN DEFAULT true,
    "default_value" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."signers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nip" VARCHAR(50),
    "role" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100),
    "prodi" VARCHAR(100),
    "public_key" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "key_id" VARCHAR(32) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "signers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."signed_documents" (
    "id" TEXT NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "prodi" VARCHAR(100) NOT NULL,
    "document_content" TEXT NOT NULL,
    "document_hash" VARCHAR(64) NOT NULL,
    "no_surat" VARCHAR(100),
    "file_path" VARCHAR(500),
    "qr_code_data" TEXT NOT NULL,
    "qr_code_image" VARCHAR(500),
    "total_signatures_required" INTEGER NOT NULL DEFAULT 3,
    "total_signatures_received" INTEGER NOT NULL DEFAULT 0,
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),
    "document_id" INTEGER,

    CONSTRAINT "signed_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."document_signatures" (
    "id" SERIAL NOT NULL,
    "signed_doc_id" TEXT NOT NULL,
    "signer_id" INTEGER NOT NULL,
    "signature_data" TEXT NOT NULL,
    "signature_hash" VARCHAR(64) NOT NULL,
    "signer_info" TEXT NOT NULL,
    "algorithm" VARCHAR(50) NOT NULL DEFAULT 'EdDSA',
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."verification_logs" (
    "id" SERIAL NOT NULL,
    "signed_doc_id" TEXT NOT NULL,
    "verifier_ip" VARCHAR(45),
    "verifier_agent" TEXT,
    "verification_method" VARCHAR(50) NOT NULL,
    "verification_result" BOOLEAN NOT NULL,
    "verification_details" TEXT,
    "verified_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev"."system_config" (
    "id" SERIAL NOT NULL,
    "config_key" VARCHAR(100) NOT NULL,
    "config_value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_type_prodi_key" ON "dev"."documents"("type", "prodi");

-- CreateIndex
CREATE UNIQUE INDEX "signers_nip_key" ON "dev"."signers"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "signers_key_id_key" ON "dev"."signers"("key_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_signatures_signed_doc_id_signer_id_key" ON "dev"."document_signatures"("signed_doc_id", "signer_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_config_key_key" ON "dev"."system_config"("config_key");

-- AddForeignKey
ALTER TABLE "dev"."document_fields" ADD CONSTRAINT "document_fields_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "dev"."documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dev"."signed_documents" ADD CONSTRAINT "signed_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "dev"."documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev"."document_signatures" ADD CONSTRAINT "document_signatures_signed_doc_id_fkey" FOREIGN KEY ("signed_doc_id") REFERENCES "dev"."signed_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev"."document_signatures" ADD CONSTRAINT "document_signatures_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "dev"."signers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev"."verification_logs" ADD CONSTRAINT "verification_logs_signed_doc_id_fkey" FOREIGN KEY ("signed_doc_id") REFERENCES "dev"."signed_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
