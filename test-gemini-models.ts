import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

async function testGeminiModels() {
    const apiKey = process.argv[2] || process.env.DEFAULT_GOOGLE_API_KEY;

    if (!apiKey) {
        console.error('❌ No GEMINI API key provided');
        console.log('\nUsage: npx tsx test-gemini-models.ts YOUR_API_KEY');
        console.log('Or set DEFAULT_GOOGLE_API_KEY in .env');
        process.exit(1);
    }

    console.log('🔍 Testing Gemini models with your API key...\n');

    const genAI = new GoogleGenerativeAI(apiKey);

    // Models to test based on Google's documentation
    const modelsToTest = [
        'gemini-pro',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash-latest',
    ];

    console.log('Testing models:\n');

    for (const modelName of modelsToTest) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Say "test successful"');
            const response = await result.response;
            const text = response.text();
            console.log(`✅ ${modelName.padEnd(30)} - WORKS`);
        } catch (error: any) {
            const errorMsg = error.message.split('\n')[0];
            if (errorMsg.includes('404')) {
                console.log(`❌ ${modelName.padEnd(30)} - NOT FOUND (404)`);
            } else if (errorMsg.includes('API_KEY')) {
                console.log(`❌ ${modelName.padEnd(30)} - API KEY ERROR`);
            } else {
                console.log(`❌ ${modelName.padEnd(30)} - ${errorMsg.substring(0, 50)}`);
            }
        }
    }

    console.log('\n✨ Test complete!');
}

testGeminiModels().catch(console.error);
