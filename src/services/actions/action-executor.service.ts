import { PrismaClient } from '@prisma/client';
import axios, { AxiosRequestConfig } from 'axios';
import Mustache from 'mustache';
import encryptionService from '../encryption.service';

const prisma = new PrismaClient();

export interface ExecutionResult {
    success: boolean;
    status?: number;
    data?: any;
    error?: string;
    request?: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: any;
    };
}

class ActionExecutorService {
    /**
     * Execute an action with given inputs
     */
    async execute(
        actionId: string,
        inputs: Record<string, any>
    ): Promise<ExecutionResult> {
        // Fetch action with integration
        const action = await prisma.action.findUnique({
            where: { id: actionId },
            include: { integration: true }
        });

        if (!action) {
            return {
                success: false,
                error: 'Action not found'
            };
        }

        try {
            // Validate inputs
            this.validateInputs(action.variables as any[], inputs);

            // Build request
            const request = await this.buildRequest(action, inputs);

            // Execute HTTP request with retry
            const response = await this.executeWithRetry(request);

            return {
                success: true,
                status: response.status,
                data: response.data,
                request: {
                    url: request.url!,
                    method: request.method!,
                    headers: this.maskHeaders(request.headers as Record<string, string>),
                    body: request.data
                }
            };

        } catch (error: any) {
            console.error('Action execution error:', error.message);
            return {
                success: false,
                error: error.message,
                status: error.response?.status
            };
        }
    }

    /**
     * Validate inputs against variable definitions
     */
    private validateInputs(
        variables: Array<{ name: string; type: string; description: string }>,
        inputs: Record<string, any>
    ): void {
        for (const variable of variables) {
            const value = inputs[variable.name];

            if (value === undefined || value === null) {
                throw new Error(`Missing required variable: ${variable.name}`);
            }

            // Type validation
            const actualType = typeof value;
            const expectedType = variable.type;

            if (expectedType === 'number' && actualType !== 'number') {
                throw new Error(`Variable ${variable.name} must be a number`);
            }
            if (expectedType === 'boolean' && actualType !== 'boolean') {
                throw new Error(`Variable ${variable.name} must be a boolean`);
            }
            if (expectedType === 'string' && actualType !== 'string') {
                throw new Error(`Variable ${variable.name} must be a string`);
            }
            if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
                throw new Error(`Variable ${variable.name} must be an object`);
            }
            if (expectedType === 'array' && !Array.isArray(value)) {
                throw new Error(`Variable ${variable.name} must be an array`);
            }
        }
    }

    /**
     * Build HTTP request from action and inputs
     */
    private async buildRequest(
        action: any,
        inputs: Record<string, any>
    ): Promise<AxiosRequestConfig> {
        const integration = action.integration;

        // Inject variables into URL
        let url = integration.url;
        if (action.urlTemplate) {
            url = Mustache.render(action.urlTemplate, inputs);
        } else {
            // Replace path params in integration URL
            url = Mustache.render(integration.url, inputs);
        }

        // Build headers
        const headers: Record<string, string> = {
            ...integration.defaultHeaders,
        };

        // Inject auth headers
        if (integration.authEnabled && integration.authConfig) {
            const authEntries = integration.authConfig as Array<{
                type: string;
                key: string;
                value: string;
                secret?: boolean;
            }>;

            for (const entry of authEntries) {
                if (entry.type === 'header') {
                    const value = await this.resolveValue(entry.value, inputs);
                    headers[entry.key] = value;
                }
            }
        }

        // Build query params
        let params: Record<string, any> = {
            ...integration.defaultParams,
        };

        if (action.queryTemplate) {
            const queryTemplateObj = action.queryTemplate as Record<string, string>;
            for (const [key, template] of Object.entries(queryTemplateObj)) {
                params[key] = Mustache.render(template, inputs);
            }
        }

        // Inject auth query params
        if (integration.authEnabled && integration.authConfig) {
            const authEntries = integration.authConfig as Array<{
                type: string;
                key: string;
                value: string;
                secret?: boolean;
            }>;

            for (const entry of authEntries) {
                if (entry.type === 'query') {
                    const value = await this.resolveValue(entry.value, inputs);
                    params[entry.key] = value;
                }
            }
        }

        // Build body
        let data: any = undefined;
        if (action.bodyTemplate && ['POST', 'PUT', 'PATCH'].includes(integration.method)) {
            const bodyStr = Mustache.render(action.bodyTemplate, inputs);
            try {
                data = JSON.parse(bodyStr);
            } catch (e) {
                data = bodyStr; // Use as plain text if not JSON
            }
        }

        return {
            url,
            method: integration.method.toLowerCase(),
            headers,
            params,
            data,
            timeout: 30000,
        };
    }

    /**
     * Resolve value - handle secret placeholders
     */
    private async resolveValue(
        template: string,
        inputs: Record<string, any>
    ): Promise<string> {
        // Check if it's a secret reference: {{SECRET_NAME}}
        const secretMatch = template.match(/^{{([A-Z_]+)}}$/);

        if (secretMatch) {
            const secretName = secretMatch[1];

            // Try to fetch from secrets table
            const secret = await prisma.secret.findUnique({
                where: { name: secretName }
            });

            if (secret) {
                return encryptionService.decrypt(secret.encryptedValue);
            }

            // Fallback to environment variable
            const envValue = process.env[secretName];
            if (envValue) {
                return envValue;
            }

            throw new Error(`Secret not found: ${secretName}`);
        }

        // Regular mustache template
        return Mustache.render(template, inputs);
    }

    /**
     * Execute request with retry logic
     */
    private async executeWithRetry(
        config: AxiosRequestConfig,
        maxRetries: number = 1
    ): Promise<any> {
        let lastError: any;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await axios(config);
            } catch (error: any) {
                lastError = error;

                // Only retry on 5xx errors
                if (error.response?.status >= 500 && attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                throw error;
            }
        }

        throw lastError;
    }

    /**
     * Mask sensitive headers for logging
     */
    private maskHeaders(headers: Record<string, string>): Record<string, string> {
        const masked = { ...headers };

        for (const key of Object.keys(masked)) {
            if (key.toLowerCase().includes('authorization') ||
                key.toLowerCase().includes('api-key') ||
                key.toLowerCase().includes('token')) {
                masked[key] = encryptionService.mask(masked[key]);
            }
        }

        return masked;
    }
}

export default new ActionExecutorService();
