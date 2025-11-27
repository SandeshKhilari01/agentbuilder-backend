-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "llmProvider" TEXT NOT NULL,
    "llmModel" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authEnabled" BOOLEAN NOT NULL DEFAULT false,
    "authConfig" JSONB,
    "defaultHeaders" JSONB,
    "defaultParams" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descriptionForLlm" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "executionMode" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "bodyTemplate" TEXT,
    "urlTemplate" TEXT,
    "queryTemplate" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "embeddingProvider" TEXT,
    "embeddingModel" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vector_chunks" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "vectorId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vector_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secrets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "lastResponse" JSONB,
    "lastStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integrations_name_key" ON "integrations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "actions_name_key" ON "actions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "agent_actions_agentId_actionId_key" ON "agent_actions"("agentId", "actionId");

-- CreateIndex
CREATE UNIQUE INDEX "vector_chunks_knowledgeBaseId_chunkIndex_key" ON "vector_chunks"("knowledgeBaseId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "secrets_name_key" ON "secrets"("name");

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vector_chunks" ADD CONSTRAINT "vector_chunks_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
