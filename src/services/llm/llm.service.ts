import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface Tool {
    name: string;
    description: string;
    variables: Array<{
        name: string;
        type: string;
        description: string;
    }>;
}

export interface LLMResponse {
    content: string;
    toolCall?: {
        tool: string;
        inputs: Record<string, any>;
    };
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

class LLMService {
    /**
     * Unified chat method supporting OpenAI and Google Gemini
     */
    async chat(
        provider: 'openai' | 'google',
        model: string,
        messages: Message[],
        tools: Tool[],
        apiKey: string
    ): Promise<LLMResponse> {
        if (provider === 'openai') {
            return this.chatOpenAI(model, messages, tools, apiKey);
        } else if (provider === 'google') {
            return this.chatGoogle(model, messages, tools, apiKey);
        } else {
            throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    private async chatOpenAI(
        model: string,
        messages: Message[],
        tools: Tool[],
        apiKey: string
    ): Promise<LLMResponse> {
        const openai = new OpenAI({ apiKey });

        // Build system instruction with tools
        const systemMessage = this.buildSystemInstruction(messages, tools);
        const userMessages = messages.filter(m => m.role !== 'system');

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemMessage },
                ...userMessages.map(m => ({ role: m.role, content: m.content }))
            ],
            temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content || '';
        const toolCall = this.parseToolCall(content);

        return {
            content,
            toolCall,
            usage: {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            }
        };
    }

    private async chatGoogle(
        model: string,
        messages: Message[],
        tools: Tool[],
        apiKey: string
    ): Promise<LLMResponse> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model });

        // Build system instruction with tools
        const systemInstruction = this.buildSystemInstruction(messages, tools);

        // Combine messages for Gemini
        const conversationHistory = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

        const chat = geminiModel.startChat({
            history: conversationHistory.slice(0, -1),
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
            },
        });

        const lastMessage = conversationHistory[conversationHistory.length - 1];
        const fullPrompt = `${systemInstruction}\n\n${lastMessage.parts[0].text}`;

        const result = await chat.sendMessage(fullPrompt);
        const response = await result.response;
        const content = response.text();
        const toolCall = this.parseToolCall(content);

        return {
            content,
            toolCall,
            usage: {
                promptTokens: 0, // Gemini doesn't provide token counts in free tier
                completionTokens: 0,
                totalTokens: 0,
            }
        };
    }

    /**
     * Build system instruction with tool manifest
     */
    private buildSystemInstruction(messages: Message[], tools: Tool[]): string {
        const systemPrompt = messages.find(m => m.role === 'system')?.content || '';

        if (tools.length === 0) {
            return systemPrompt;
        }

        const toolsManifest = tools.map(tool => {
            const vars = tool.variables.map(v => `${v.name} (${v.type})`).join(', ');
            return `- **${tool.name}**: ${tool.description}\n  Variables: ${vars}`;
        }).join('\n');

        return `${systemPrompt}

You have access to these actions:

${toolsManifest}

When you decide an API call is required, output exactly one JSON object inside a single \`\`\`json code block with keys: tool, inputs.
Do not output any extra text around the JSON. Wait for the platform to return the action result and then continue the reply.

Example:
\`\`\`json
{"tool": "actionName", "inputs": {"var1": "value1", "var2": 123}}
\`\`\``;
    }

    /**
     * Parse tool call from LLM response
     */
    private parseToolCall(content: string): { tool: string; inputs: Record<string, any> } | undefined {
        // Look for JSON code block
        const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (!jsonMatch) {
            return undefined;
        }

        try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.tool && parsed.inputs) {
                return {
                    tool: parsed.tool,
                    inputs: parsed.inputs
                };
            }
        } catch (e) {
            console.error('Failed to parse tool call:', e);
        }

        return undefined;
    }
}

export default new LLMService();
