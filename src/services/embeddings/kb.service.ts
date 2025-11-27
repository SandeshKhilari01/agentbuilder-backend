import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import embeddingsService from './embeddings.service';
import vectorService from './vector.service';
import encryptionService from '../encryption.service';

const prisma = new PrismaClient();

const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200; // characters

class KBService {
    /**
     * Process uploaded file: extract text, chunk, generate embeddings, store in vector DB
     */
    async processFile(kbId: string): Promise<void> {
        const kb = await prisma.knowledgeBase.findUnique({
            where: { id: kbId },
            include: { agent: true }
        });

        if (!kb) {
            throw new Error('Knowledge base not found');
        }

        try {
            // Update status
            await prisma.knowledgeBase.update({
                where: { id: kbId },
                data: { status: 'processing' }
            });

            // Extract text
            const text = await this.extractText(kb.filePath, kb.fileType);

            // Chunk text
            const chunks = this.chunkText(text);

            // Get API key for embeddings - use agent's key or fall back to default
            let apiKey: string;
            try {
                apiKey = encryptionService.decrypt(kb.agent.apiKeyEncrypted);
            } catch (error) {
                console.warn('Failed to decrypt agent API key, using default:', error);
                apiKey = process.env.DEFAULT_OPENAI_API_KEY || '';
            }

            if (!apiKey) {
                throw new Error('No API key available for embeddings. Please configure an API key for the agent.');
            }

            // Determine embedding provider based on agent's LLM provider
            const provider = (kb.agent.llmProvider === 'google' ? 'google' : 'openai') as 'openai' | 'google';
            const embeddingModel = provider === 'google' ? 'embedding-001' : 'text-embedding-3-small';

            console.log(`Using ${provider} embeddings with model ${embeddingModel} for agent ${kb.agent.name}`);

            // Generate embeddings and store
            const vectorItems = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                // Generate embedding
                const { embedding } = await embeddingsService.generateEmbeddings(
                    chunk,
                    provider,
                    apiKey,
                    embeddingModel
                );


                // Create vector ID
                const vectorId = `${kbId}-chunk-${i}`;

                // Store in DB with embedding
                await prisma.vectorChunk.create({
                    data: {
                        knowledgeBaseId: kbId,
                        chunkIndex: i,
                        text: chunk,
                        vectorId,
                        embedding: embedding, // Store the vector embedding
                        metadata: {
                            fileName: kb.fileName,
                            chunkIndex: i,
                            totalChunks: chunks.length
                        }
                    }
                });

                vectorItems.push({
                    id: vectorId,
                    values: embedding,
                    metadata: {
                        kbId,
                        fileName: kb.fileName,
                        chunkIndex: i,
                        text: chunk.substring(0, 500) // Store preview in metadata
                    }
                });
            }

            // Upsert to vector DB
            await vectorService.upsert(vectorItems, `agent-${kb.agentId}`);

            // Update status
            await prisma.knowledgeBase.update({
                where: { id: kbId },
                data: {
                    status: 'indexed',
                    chunkCount: chunks.length
                }
            });

        } catch (error) {
            console.error('Error processing KB file:', error);
            await prisma.knowledgeBase.update({
                where: { id: kbId },
                data: { status: 'failed' }
            });
            throw error;
        }
    }

    /**
     * Search knowledge base
     */
    async search(
        agentId: string,
        query: string,
        topK: number = 5
    ): Promise<Array<{ text: string; score: number; metadata: any }>> {
        // Get agent to determine embedding provider
        const agent = await prisma.agent.findUnique({
            where: { id: agentId }
        });

        if (!agent) {
            throw new Error('Agent not found');
        }

        // Get API key for embeddings - use agent's key or fall back to default
        let apiKey: string;
        try {
            apiKey = encryptionService.decrypt(agent.apiKeyEncrypted);
        } catch (error) {
            console.warn('Failed to decrypt agent API key, using default:', error);
            apiKey = process.env.DEFAULT_OPENAI_API_KEY || '';
        }

        if (!apiKey) {
            throw new Error('No API key available for embeddings. Please configure an API key for the agent.');
        }

        // Determine embedding provider based on agent's LLM provider
        const provider = (agent.llmProvider === 'google' ? 'google' : 'openai') as 'openai' | 'google';
        const embeddingModel = provider === 'google' ? 'embedding-001' : 'text-embedding-3-small';

        // Generate query embedding
        const { embedding } = await embeddingsService.generateEmbeddings(
            query,
            provider,
            apiKey,
            embeddingModel
        );

        // Query vector DB
        const matches = await vectorService.query(
            embedding,
            topK,
            `agent-${agentId}`
        );

        // Fetch full text from DB
        const results = [];
        for (const match of matches) {
            const chunk = await prisma.vectorChunk.findFirst({
                where: { vectorId: match.id }
            });

            if (chunk) {
                results.push({
                    text: chunk.text,
                    score: match.score,
                    metadata: chunk.metadata
                });
            }
        }

        return results;
    }

    /**
     * Extract text from file based on type
     */
    private async extractText(filePath: string, fileType: string): Promise<string> {
        const buffer = await fs.readFile(filePath);

        switch (fileType.toLowerCase()) {
            case 'pdf':
                const pdfData = await pdfParse(buffer);
                return pdfData.text;

            case 'docx':
                const docxResult = await mammoth.extractRawText({ buffer });
                return docxResult.value;

            case 'txt':
                return buffer.toString('utf-8');

            case 'csv':
                const records = csvParse(buffer, { columns: true });
                return JSON.stringify(records, null, 2);

            case 'json':
                const jsonData = JSON.parse(buffer.toString('utf-8'));
                return JSON.stringify(jsonData, null, 2);

            default:
                throw new Error(`Unsupported file type: ${fileType}`);
        }
    }

    /**
     * Chunk text into overlapping segments
     */
    private chunkText(text: string): string[] {
        const chunks: string[] = [];
        let start = 0;

        while (start < text.length) {
            const end = Math.min(start + CHUNK_SIZE, text.length);
            chunks.push(text.substring(start, end));
            start += CHUNK_SIZE - CHUNK_OVERLAP;
        }

        return chunks;
    }

    /**
     * Delete knowledge base and associated vectors
     */
    async deleteKB(kbId: string): Promise<void> {
        const kb = await prisma.knowledgeBase.findUnique({
            where: { id: kbId },
            include: { vectorChunks: true }
        });

        if (!kb) {
            throw new Error('Knowledge base not found');
        }

        // Delete vectors from vector DB
        const vectorIds = kb.vectorChunks.map(chunk => chunk.vectorId);
        if (vectorIds.length > 0) {
            await vectorService.deleteByIds(vectorIds, `agent-${kb.agentId}`);
        }

        // Delete file
        try {
            await fs.unlink(kb.filePath);
        } catch (error) {
            console.error('Error deleting file:', error);
        }

        // Delete from DB (cascade will delete chunks)
        await prisma.knowledgeBase.delete({
            where: { id: kbId }
        });
    }
}

export default new KBService();
