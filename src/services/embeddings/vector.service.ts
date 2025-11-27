import { Pinecone } from '@pinecone-database/pinecone';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface VectorMatch {
    id: string;
    score: number;
    metadata?: Record<string, any>;
}

export interface VectorUpsertItem {
    id: string;
    values: number[];
    metadata?: Record<string, any>;
}

class VectorService {
    private client: Pinecone | null = null;
    private indexName: string;
    private usePinecone: boolean = false;

    constructor() {
        this.indexName = process.env.PINECONE_INDEX_NAME || 'agent-kb';

        if (process.env.PINECONE_API_KEY) {
            this.initializePinecone();
            this.usePinecone = true;
        } else {
            console.log('📦 Using PostgreSQL for persistent vector storage');
        }
    }

    private initializePinecone() {
        this.client = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        });
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Upsert vectors to the index
     */
    async upsert(
        vectors: VectorUpsertItem[],
        namespace?: string
    ): Promise<void> {
        if (this.usePinecone && this.client) {
            // Use Pinecone
            const index = this.client.index(this.indexName);
            await index.namespace(namespace || 'default').upsert(vectors);
        } else {
            // Use PostgreSQL - vectors are stored when creating VectorChunk in kb.service
            // This method is called from kb.service but actual storage happens there
            // We just need to ensure the embedding is included in the VectorChunk creation
            console.log(`📦 Vectors will be stored in PostgreSQL (${vectors.length} vectors)`);
        }
    }

    /**
     * Query vectors from the index
     */
    async query(
        vector: number[],
        topK: number = 5,
        namespace?: string,
        filter?: Record<string, any>
    ): Promise<VectorMatch[]> {
        if (this.usePinecone && this.client) {
            // Use Pinecone
            const index = this.client.index(this.indexName);

            const queryResponse = await index.namespace(namespace || 'default').query({
                vector,
                topK,
                includeMetadata: true,
                filter
            });

            return queryResponse.matches.map(match => ({
                id: match.id,
                score: match.score || 0,
                metadata: match.metadata as Record<string, any>
            }));
        } else {
            // Use PostgreSQL
            // Extract agentId from namespace (format: "agent-{agentId}")
            const agentId = namespace?.replace('agent-', '') || '';

            // Fetch all vector chunks for this agent
            const chunks = await prisma.vectorChunk.findMany({
                where: {
                    knowledgeBase: {
                        agentId: agentId
                    }
                },
                select: {
                    id: true,
                    vectorId: true,
                    embedding: true,
                    text: true,
                    metadata: true,
                    chunkIndex: true,
                    knowledgeBase: {
                        select: {
                            fileName: true
                        }
                    }
                }
            });

            if (chunks.length === 0) {
                return [];
            }

            // Calculate similarity for all vectors
            const matches: VectorMatch[] = [];

            for (const chunk of chunks) {
                if (!chunk.embedding) continue;

                const embeddingArray = chunk.embedding as number[];
                const score = this.cosineSimilarity(vector, embeddingArray);

                matches.push({
                    id: chunk.vectorId,
                    score,
                    metadata: {
                        text: chunk.text.substring(0, 500),
                        fileName: chunk.knowledgeBase.fileName,
                        chunkIndex: chunk.chunkIndex,
                        ...(chunk.metadata as Record<string, any> || {})
                    }
                });
            }

            // Sort by score (descending) and take top K
            matches.sort((a, b) => b.score - a.score);
            const results = matches.slice(0, topK);

            console.log(`🔍 Found ${results.length} matches in PostgreSQL (from ${chunks.length} total chunks)`);

            return results;
        }
    }

    /**
     * Delete vectors by IDs
     */
    async deleteByIds(
        ids: string[],
        namespace?: string
    ): Promise<void> {
        if (this.usePinecone && this.client) {
            // Use Pinecone
            const index = this.client.index(this.indexName);
            await index.namespace(namespace || 'default').deleteMany(ids);
        } else {
            // Use PostgreSQL
            await prisma.vectorChunk.deleteMany({
                where: {
                    vectorId: {
                        in: ids
                    }
                }
            });
            console.log(`🗑️  Deleted ${ids.length} vectors from PostgreSQL`);
        }
    }

    /**
     * Delete all vectors in a namespace
     */
    async deleteNamespace(namespace: string): Promise<void> {
        if (this.usePinecone && this.client) {
            // Use Pinecone
            const index = this.client.index(this.indexName);
            await index.namespace(namespace).deleteAll();
        } else {
            // Use PostgreSQL - delete all chunks for an agent
            const agentId = namespace.replace('agent-', '');

            await prisma.vectorChunk.deleteMany({
                where: {
                    knowledgeBase: {
                        agentId: agentId
                    }
                }
            });
            console.log(`🗑️  Deleted all vectors for agent ${agentId} from PostgreSQL`);
        }
    }
}

export default new VectorService();
