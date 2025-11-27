// Quick test to list available Gemini models
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    const apiKey = process.env.DEFAULT_GOOGLE_API_KEY || process.argv[2];

    if (!apiKey) {
        console.error('Please provide GEMINI API key as argument or set DEFAULT_GOOGLE_API_KEY in .env');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log('Fetching available models...\n');

        // Try common model names
        const modelsToTest = [
            'gemini-pro',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b',
            'gemini-2.0-flash-exp',
            'models/gemini-pro',
            'models/gemini-1.5-pro',
            'models/gemini-1.5-flash',
        ];

        console.log('Testing model names:\n');

        for (const modelName of modelsToTest) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Hi');
                const response = await result.response;
                console.log(`✅ ${modelName} - WORKS`);
            } catch (error) {
                console.log(`❌ ${modelName} - ${error.message.split('\n')[0]}`);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

listModels();
