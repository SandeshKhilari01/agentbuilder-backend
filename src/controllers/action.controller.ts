import { Request, Response } from 'express';
import pool from '../db';
import actionExecutor from '../services/actions/action-executor.service';

export class ActionController {
    /**
     * Create action
     */
    async create(req: Request, res: Response) {
        try {
            const {
                name,
                descriptionForLlm,
                integrationId,
                executionMode,
                variables,
                bodyTemplate,
                urlTemplate,
                queryTemplate
            } = req.body;

            console.log('Received action creation request:');
            console.log('Name:', name);
            console.log('Variables:', variables);
            console.log('Variables type:', typeof variables);
            console.log('Variables JSON:', JSON.stringify(variables));

            // Check if action with same name already exists
            const existingAction = await pool.query(
                'SELECT id FROM actions WHERE name = $1',
                [name]
            );

            if (existingAction.rows.length > 0) {
                return res.status(400).json({ error: 'An action with this name already exists' });
            }

            const result = await pool.query(
                `INSERT INTO actions (id, name, "descriptionForLlm", "integrationId", "executionMode", variables, "bodyTemplate", "urlTemplate", "queryTemplate", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                 RETURNING *`,
                [name, descriptionForLlm, integrationId, executionMode, JSON.stringify(variables), bodyTemplate, urlTemplate, JSON.stringify(queryTemplate)]
            );

            console.log('Created action:', result.rows[0]);

            res.json(result.rows[0]);
        } catch (error: any) {
            console.error('Error creating action:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * List actions
     */
    async list(req: Request, res: Response) {
        try {
            const result = await pool.query(`
                SELECT a.*, 
                       row_to_json(i.*) as integration
                FROM actions a
                LEFT JOIN integrations i ON a."integrationId" = i.id
                ORDER BY a."createdAt" DESC
            `);
            res.json(result.rows);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get action
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM actions WHERE id = $1', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Action not found' });
            }

            res.json(result.rows[0]);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update action
     */
    async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const {
                name,
                descriptionForLlm,
                integrationId,
                executionMode,
                variables,
                bodyTemplate,
                urlTemplate,
                queryTemplate
            } = req.body;

            // Check if another action with same name already exists
            const existingAction = await pool.query(
                'SELECT id FROM actions WHERE name = $1 AND id != $2',
                [name, id]
            );

            if (existingAction.rows.length > 0) {
                return res.status(400).json({ error: 'An action with this name already exists' });
            }

            const result = await pool.query(
                `UPDATE actions 
                 SET name = $1, "descriptionForLlm" = $2, "integrationId" = $3, "executionMode" = $4,
                     variables = $5, "bodyTemplate" = $6, "urlTemplate" = $7, "queryTemplate" = $8, "updatedAt" = NOW()
                 WHERE id = $9
                 RETURNING *`,
                [name, descriptionForLlm, integrationId, executionMode, JSON.stringify(variables), bodyTemplate, urlTemplate, JSON.stringify(queryTemplate), id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Action not found' });
            }

            res.json(result.rows[0]);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Delete action
     */
    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM actions WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Test action
     */
    async test(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { inputs } = req.body;

            // Execute action
            const executionResult = await actionExecutor.execute(id, inputs);

            res.json(executionResult);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Execute action
     */
    async execute(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { inputs } = req.body;

            // Execute action
            const executionResult = await actionExecutor.execute(id, inputs);

            res.json(executionResult);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get test cases for action
     */
    async getTestCases(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const result = await pool.query(
                'SELECT * FROM test_cases WHERE "actionId" = $1 ORDER BY "createdAt" DESC',
                [id]
            );
            res.json(result.rows);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Delete test case
     */
    async deleteTestCase(req: Request, res: Response) {
        try {
            const { testCaseId } = req.params;
            await pool.query('DELETE FROM test_cases WHERE id = $1', [testCaseId]);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new ActionController();
