-- AlterTable
ALTER TABLE "vector_chunks" ADD COLUMN     "embedding" JSONB;

-- CreateIndex
CREATE INDEX "vector_chunks_knowledgeBaseId_idx" ON "vector_chunks"("knowledgeBaseId");
