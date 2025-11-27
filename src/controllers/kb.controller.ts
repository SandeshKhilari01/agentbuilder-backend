import { Request, Response } from 'express';
import pool from '../db';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import kbService from '../services/embeddings/kb.service';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

export const upload = multer({ storage });

export class KBController {
    /**
     * Upload file
     */
    async upload(req: Request, res: Response) {
        try {
            const { agentId } = req.params;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const fileType = path.extname(file.originalname).substring(1).toLowerCase();

            const result = await pool.query(
                `INSERT INTO knowledge_bases (id, "agentId", "fileName", "fileType", "filePath", "fileSize", status, "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'uploaded', NOW(), NOW())
                 RETURNING *`,
                [agentId, file.originalname, fileType, file.path, file.size]
            );

            res.json(result.rows[0]);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Build embeddings
     */
    async buildEmbeddings(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { provider, model } = req.body;

            const result = await pool.query('SELECT * FROM knowledge_bases WHERE id = $1', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Knowledge base not found' });
            }

            const kb = result.rows[0];

            // Update status to processing
            await pool.query(
                'UPDATE knowledge_bases SET status = $1, "updatedAt" = NOW() WHERE id = $2',
                ['processing', id]
            );

            // Process file and build embeddings
            try {
                await kbService.processFile(id);

                // Fetch updated KB to get chunk count
                const updatedKb = await pool.query('SELECT * FROM knowledge_bases WHERE id = $1', [id]);

                res.json({ success: true, chunkCount: updatedKb.rows[0].chunkCount });
            } catch (error: any) {
                // Update status to failed
                await pool.query(
                    'UPDATE knowledge_bases SET status = $1, "updatedAt" = NOW() WHERE id = $2',
                    ['failed', id]
                );
                throw error;
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Search knowledge base
     */
    async search(req: Request, res: Response) {
        try {
            const { agentId } = req.params;
            const { query, topK } = req.body;

            const results = await kbService.search(agentId, query, topK || 5);

            res.json(results);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * List knowledge bases
     */
    async list(req: Request, res: Response) {
        try {
            const { agentId } = req.params;

            const result = await pool.query(
                'SELECT * FROM knowledge_bases WHERE "agentId" = $1 ORDER BY "createdAt" DESC',
                [agentId]
            );

            res.json(result.rows);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Delete knowledge base
     */
    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const result = await pool.query('SELECT * FROM knowledge_bases WHERE id = $1', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Knowledge base not found' });
            }

            const kb = result.rows[0];

            // Delete file
            if (fs.existsSync(kb.filePath)) {
                fs.unlinkSync(kb.filePath);
            }

            // Delete from database
            await pool.query('DELETE FROM knowledge_bases WHERE id = $1', [id]);

            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new KBController();
