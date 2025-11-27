/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `actions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `agents` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `integrations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "actions_name_key" ON "actions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "agents_name_key" ON "agents"("name");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_name_key" ON "integrations"("name");
