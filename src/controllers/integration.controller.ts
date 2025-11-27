import { Request, Response } from 'express';
import pool from '../db';
import axios from 'axios';

export class IntegrationController {
    /**
     * Create integration
     */
    async create(req: Request, res: Response) {
        try {
            const {
                name,
                description,
                method,
                url,
                authEnabled,
                authConfig,
                defaultHeaders,
                defaultParams
            } = req.body;

            // Check if integration with same name already exists
            const existingIntegration = await pool.query(
                'SELECT id FROM integrations WHERE name = $1',
                [name]
            );

            if (existingIntegration.rows.length > 0) {
                return res.status(400).json({ error: 'An integration with this name already exists' });
            }

            // Properly handle JSON fields - convert to null if empty/undefined
            const authConfigJson = authConfig && Object.keys(authConfig).length > 0 ? authConfig : null;
            const defaultHeadersJson = defaultHeaders && Object.keys(defaultHeaders).length > 0 ? defaultHeaders : null;
            const defaultParamsJson = defaultParams && Object.keys(defaultParams).length > 0 ? defaultParams : null;

            const result = await pool.query(
                `INSERT INTO integrations (id, name, description, method, url, "authEnabled", "authConfig", "defaultHeaders", "defaultParams", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                 RETURNING *`,
                [
                    name,
                    description || null,
                    method,
                    url,
                    authEnabled || false,
                    authConfigJson ? JSON.stringify(authConfigJson) : null,
                    defaultHeadersJson ? JSON.stringify(defaultHeadersJson) : null,
                    defaultParamsJson ? JSON.stringify(defaultParamsJson) : null
                ]
            );

            res.json(result.rows[0]);
        } catch (error: any) {
            console.error('Error creating integration:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * List integrations
     */
    async list(req: Request, res: Response) {
        try {
            const result = await pool.query('SELECT * FROM integrations ORDER BY "createdAt" DESC');
            res.json(result.rows);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get integration
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM integrations WHERE id = $1', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Integration not found' });
            }

            res.json(result.rows[0]);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update integration
     */
    async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const {
                name,
                description,
                method,
                url,
                authEnabled,
                authConfig,
                defaultHeaders,
                defaultParams
            } = req.body;

            // Check if another integration with same name already exists
            const existingIntegration = await pool.query(
                'SELECT id FROM integrations WHERE name = $1 AND id != $2',
                [name, id]
            );

            if (existingIntegration.rows.length > 0) {
                return res.status(400).json({ error: 'An integration with this name already exists' });
            }

            const result = await pool.query(
                `UPDATE integrations 
                 SET name = $1, description = $2, method = $3, url = $4, "authEnabled" = $5, 
                     "authConfig" = $6, "defaultHeaders" = $7, "defaultParams" = $8, "updatedAt" = NOW()
                 WHERE id = $9
                 RETURNING *`,
                [name, description, method, url, authEnabled, JSON.stringify(authConfig), JSON.stringify(defaultHeaders), JSON.stringify(defaultParams), id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Integration not found' });
            }

            res.json(result.rows[0]);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Delete integration
     */
    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM integrations WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Test integration
     */
    async test(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { testInputs } = req.body;

            const result = await pool.query('SELECT * FROM integrations WHERE id = $1', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Integration not found' });
            }

            const integration = result.rows[0];

            // Build test request
            let url = integration.url;

            // Replace path params if provided
            if (testInputs) {
                for (const [key, value] of Object.entries(testInputs)) {
                    url = url.replace(`{${key}}`, String(value));
                }
            }

            const headers: Record<string, string> = {
                ...(integration.defaultHeaders || {})
            };

            // Add auth headers
            if (integration.authEnabled && integration.authConfig) {
                const authEntries = integration.authConfig;

                for (const entry of authEntries) {
                    if (entry.type === 'header') {
                        headers[entry.key] = entry.value;
                    }
                }
            }

            // Execute request
            const axiosConfig: any = {
                url,
                method: integration.method.toLowerCase(),
                headers,
                params: integration.defaultParams,
                timeout: 10000
            };

            // Add request body for POST, PUT, PATCH
            if (['post', 'put', 'patch'].includes(integration.method.toLowerCase())) {
                axiosConfig.data = testInputs;
                // Ensure Content-Type is set for JSON
                if (!axiosConfig.headers['Content-Type']) {
                    axiosConfig.headers['Content-Type'] = 'application/json';
                }
            }

            const response = await axios(axiosConfig);

            res.json({
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data
            });

        } catch (error: any) {
            res.status(500).json({
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
        }
    }
}

export default new IntegrationController();
