import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGeminiModels() {
    const apiKey = 'AIzaSyDPyYfxOGEsbBOlTzemcsKRDVKd-uSTp3g';

    console.log('🔍 Testing Gemini models with your working API key...\n');

    const genAI = new GoogleGenerativeAI(apiKey);

    // Models to test based on your HTML example
    const modelsToTest = [
        'gemini-2.5-flash',
        'gemini-pro',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp',
    ];

    console.log('Testing models:\n');

    for (const modelName of modelsToTest) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Say "test successful"');
            const response = await result.response;
            const text = response.text();
            console.log(`✅ ${modelName.padEnd(30)} - WORKS! Response: ${text.substring(0, 30)}...`);
        } catch (error: any) {
            const errorMsg = error.message.split('\n')[0];
            if (errorMsg.includes('404')) {
                console.log(`❌ ${modelName.padEnd(30)} - NOT FOUND (404)`);
            } else {
                console.log(`❌ ${modelName.padEnd(30)} - ${errorMsg.substring(0, 60)}`);
            }
        }
    }

    console.log('\n✨ Test complete!');
}

testGeminiModels().catch(console.error);
