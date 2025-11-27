import { Request, Response } from 'express';
import pool from '../db';
import encryptionService from '../services/encryption.service';
import LLMService from '../services/llm/llm.service';

export class AgentController {
    /**
     * Create agent
     */
    async create(req: Request, res: Response) {
        try {
            const {
                name,
                systemPrompt,
                llmProvider,
                llmModel,
                apiKey
            } = req.body;

            // Check if agent with same name already exists
            const existingAgent = await pool.query(
                'SELECT id FROM agents WHERE name = $1',
                [name]
            );

            if (existingAgent.rows.length > 0) {
                return res.status(400).json({ error: 'An agent with this name already exists' });
            }

            // Encrypt API key
            const apiKeyEncrypted = encryptionService.encrypt(apiKey);

            const result = await pool.query(
                `INSERT INTO agents (id, name, "systemPrompt", "llmProvider", "llmModel", "apiKeyEncrypted", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
                 RETURNING id, name, "systemPrompt", "llmProvider", "llmModel", "createdAt", "updatedAt"`,
                [name, systemPrompt, llmProvider, llmModel, apiKeyEncrypted]
            );

            res.json(result.rows[0]);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * List agents
     */
    async list(req: Request, res: Response) {
        try {
            const result = await pool.query(`
                SELECT 
                    a.id, 
                    a.name, 
                    a."systemPrompt", 
                    a."llmProvider", 
                    a."llmModel", 
                    a."createdAt", 
                    a."updatedAt",
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', kb.id,
                                'fileName', kb."fileName",
                                'fileType', kb."fileType",
                                'status', kb.status,
                                'chunkCount', kb."chunkCount",
                                'createdAt', kb."createdAt"
                            ) ORDER BY kb."createdAt" DESC
                        ) FILTER (WHERE kb.id IS NOT NULL),
                        '[]'::json
                    ) as "knowledgeBases"
                FROM agents a
                LEFT JOIN knowledge_bases kb ON kb."agentId" = a.id
                GROUP BY a.id, a.name, a."systemPrompt", a."llmProvider", a."llmModel", a."createdAt", a."updatedAt"
                ORDER BY a."createdAt" DESC
            `);
            res.json(result.rows);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get agent
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const result = await pool.query(
                'SELECT id, name, "systemPrompt", "llmProvider", "llmModel", "createdAt", "updatedAt" FROM agents WHERE id = $1',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            res.json(result.rows[0]);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update agent
     */
    async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const {
                name,
                systemPrompt,
                llmProvider,
                llmModel,
                apiKey
            } = req.body;

            // Check if another agent with same name already exists
            const existingAgent = await pool.query(
                'SELECT id FROM agents WHERE name = $1 AND id != $2',
                [name, id]
            );

            if (existingAgent.rows.length > 0) {
                return res.status(400).json({ error: 'An agent with this name already exists' });
            }

            let query = `UPDATE agents SET name = $1, "systemPrompt" = $2, "llmProvider" = $3, "llmModel" = $4, "updatedAt" = NOW()`;
            let params = [name, systemPrompt, llmProvider, llmModel];

            if (apiKey) {
                const apiKeyEncrypted = encryptionService.encrypt(apiKey);
                query += `, "apiKeyEncrypted" = $5 WHERE id = $6`;
                params.push(apiKeyEncrypted, id);
            } else {
                query += ` WHERE id = $5`;
                params.push(id);
            }

            query += ` RETURNING id, name, "systemPrompt", "llmProvider", "llmModel", "createdAt", "updatedAt"`;

            const result = await pool.query(query, params);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            res.json(result.rows[0]);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Delete agent
     */
    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM agents WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Chat with agent
     */
    async chat(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { messages } = req.body;

            // Get agent
            const agentResult = await pool.query('SELECT * FROM agents WHERE id = $1', [id]);
            if (agentResult.rows.length === 0) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            const agent = agentResult.rows[0];

            // Decrypt API key
            const apiKey = encryptionService.decrypt(agent.apiKeyEncrypted);

            // Get agent actions
            const actionsResult = await pool.query(
                `SELECT a.* FROM actions a
                 JOIN agent_actions aa ON a.id = aa."actionId"
                 WHERE aa."agentId" = $1 AND aa.enabled = true`,
                [id]
            );

            const actions = actionsResult.rows;

            // Build messages array with system prompt
            const messagesWithSystem = [
                { role: 'system' as const, content: agent.systemPrompt },
                ...messages
            ];

            // Generate response using LLM service singleton
            const response = await LLMService.chat(
                agent.llmProvider,
                agent.llmModel,
                messagesWithSystem,
                actions,
                apiKey
            );

            // Check if LLM wants to call a tool
            if (response.toolCall) {
                // Find the action
                const action = actions.find(a => a.name === response.toolCall!.tool);

                if (action) {
                    // Execute the action
                    const actionExecutor = require('../services/actions/action-executor.service').default;
                    const executionResult = await actionExecutor.execute(action.id, response.toolCall.inputs);

                    // Format the action result for the LLM
                    let resultMessage = '';
                    if (executionResult.success && executionResult.data) {
                        resultMessage = `The action "${response.toolCall.tool}" was executed successfully. Here is the data:\n${JSON.stringify(executionResult.data, null, 2)}\n\nPlease provide a natural, conversational response to the user based on this data. Answer their specific question directly.`;
                    } else {
                        resultMessage = `The action "${response.toolCall.tool}" failed with error: ${executionResult.error}`;
                    }

                    // Add the tool result to messages and call LLM again
                    const messagesWithToolResult = [
                        ...messagesWithSystem,
                        { role: 'assistant' as const, content: response.content },
                        {
                            role: 'user' as const,
                            content: resultMessage
                        }
                    ];

                    // Get final response from LLM with the action result
                    // Don't pass actions again to prevent another tool call
                    const finalResponse = await LLMService.chat(
                        agent.llmProvider,
                        agent.llmModel,
                        messagesWithToolResult,
                        [], // Empty actions array to prevent another tool call
                        apiKey
                    );

                    // Return final response with tool execution details
                    const chatMessage = {
                        role: 'assistant',
                        content: finalResponse.content,
                        toolCalls: [response.toolCall],
                        toolResults: [executionResult]
                    };

                    return res.json(chatMessage);
                }
            }

            // Transform response to match ChatMessage interface
            const chatMessage = {
                role: 'assistant',
                content: response.content,
                toolCalls: response.toolCall ? [response.toolCall] : undefined,
                toolResults: undefined
            };

            res.json(chatMessage);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Add action to agent
     */
    async addAction(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { actionId } = req.body;

            const result = await pool.query(
                `INSERT INTO agent_actions (id, "agentId", "actionId", enabled, "createdAt")
                 VALUES (gen_random_uuid(), $1, $2, true, NOW())
                 ON CONFLICT ("agentId", "actionId") DO UPDATE SET enabled = true
                 RETURNING *`,
                [id, actionId]
            );

            res.json(result.rows[0]);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Remove action from agent
     */
    async removeAction(req: Request, res: Response) {
        try {
            const { id, actionId } = req.params;

            await pool.query(
                'DELETE FROM agent_actions WHERE "agentId" = $1 AND "actionId" = $2',
                [id, actionId]
            );

            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new AgentController();
