import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EmbeddingResult {
    embedding: number[];
    dimensions: number;
}

class EmbeddingsService {
    /**
     * Generate embeddings for text using specified provider
     */
    async generateEmbeddings(
        text: string,
        provider: 'openai' | 'google',
        apiKey: string,
        model?: string
    ): Promise<EmbeddingResult> {
        // If no API key, use mock embeddings for testing
        if (!apiKey || apiKey.trim() === '') {
            console.warn('⚠️  No API key provided, using mock embeddings for testing');
            return this.generateMockEmbeddings(text);
        }

        try {
            if (provider === 'openai') {
                return await this.generateOpenAIEmbeddings(text, apiKey, model || 'text-embedding-3-small');
            } else if (provider === 'google') {
                return await this.generateGoogleEmbeddings(text, apiKey, model || 'embedding-001');
            } else {
                throw new Error(`Unsupported embeddings provider: ${provider}`);
            }
        } catch (error: any) {
            // If API call fails (quota, invalid key, etc), fall back to mock embeddings
            console.warn(`⚠️  Embeddings API failed (${error.message}), using mock embeddings for testing`);
            return this.generateMockEmbeddings(text);
        }
    }

    private async generateOpenAIEmbeddings(
        text: string,
        apiKey: string,
        model: string
    ): Promise<EmbeddingResult> {
        const openai = new OpenAI({ apiKey });

        const response = await openai.embeddings.create({
            model,
            input: text,
        });

        return {
            embedding: response.data[0].embedding,
            dimensions: response.data[0].embedding.length
        };
    }

    private async generateGoogleEmbeddings(
        text: string,
        apiKey: string,
        model: string
    ): Promise<EmbeddingResult> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const embeddingModel = genAI.getGenerativeModel({ model: `models/${model}` });

        const result = await embeddingModel.embedContent(text);
        const embedding = result.embedding.values;

        return {
            embedding,
            dimensions: embedding.length
        };
    }

    /**
     * Generate embeddings for multiple texts in batch
     */
    async generateBatchEmbeddings(
        texts: string[],
        provider: 'openai' | 'google',
        apiKey: string,
        model?: string
    ): Promise<EmbeddingResult[]> {
        // For simplicity, process sequentially
        // In production, batch API calls where supported
        const results: EmbeddingResult[] = [];

        for (const text of texts) {
            const result = await this.generateEmbeddings(text, provider, apiKey, model);
            results.push(result);
        }

        return results;
    }

    /**
     * Generate mock embeddings for testing (when no API key available)
     * Creates a deterministic vector based on text content
     */
    private generateMockEmbeddings(text: string): EmbeddingResult {
        // Create a simple hash-based embedding (1536 dimensions like OpenAI)
        const dimensions = 1536;
        const embedding: number[] = [];

        // Use text content to generate deterministic values
        const textHash = this.simpleHash(text);

        for (let i = 0; i < dimensions; i++) {
            // Generate pseudo-random but deterministic values based on text and position
            const seed = textHash + i;
            const value = (Math.sin(seed) * 10000) % 1;
            embedding.push(value);
        }

        // Normalize the vector
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        const normalized = embedding.map(val => val / magnitude);

        console.log(`📝 Generated mock embedding for text: "${text.substring(0, 50)}..."`);

        return {
            embedding: normalized,
            dimensions
        };
    }

    /**
     * Simple hash function for deterministic mock embeddings
     */
    private simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
}

export default new EmbeddingsService();
