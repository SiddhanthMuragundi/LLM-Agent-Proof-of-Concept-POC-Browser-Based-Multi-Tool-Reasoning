// Test script for AI Pipe integration
const axios = require('axios');

async function testAIPipeIntegration() {
    const baseURL = 'http://localhost:3000';
    
    const testCases = [
        {
            name: 'GPT-4o Mini via AI Pipe',
            provider: 'aipipe',
            model: 'gpt-4o-mini',
            message: 'Hello! Can you help me test this integration?'
        },
        {
            name: 'GPT-4o via AI Pipe',
            provider: 'aipipe',
            model: 'gpt-4o',
            message: 'Hello! This is a test for GPT-4o via AI Pipe.'
        },
        {
            name: 'Gemini 1.5 Flash via AI Pipe',
            provider: 'aipipe',
            model: 'gemini-1.5-flash',
            message: 'Hello! Can you help me test Gemini integration via AI Pipe?'
        },
        {
            name: 'Gemini 1.5 Pro via AI Pipe',
            provider: 'aipipe',
            model: 'gemini-1.5-pro',
            message: 'Hello! This is a test for Gemini 1.5 Pro via AI Pipe.'
        }
    ];
    
    console.log('Testing AI Pipe Integration...\n');
    
    for (const testCase of testCases) {
        try {
            console.log(`Testing: ${testCase.name}`);
            
            const response = await axios.post(`${baseURL}/api/llm`, {
                provider: testCase.provider,
                model: testCase.model,
                messages: [
                    { role: 'user', content: testCase.message }
                ],
                apiKey: '' // Empty key to trigger mock mode
            });
            
            if (response.data && response.data.content) {
                console.log('✅ Success - Mock response received');
                console.log(`Response preview: ${response.data.content.substring(0, 100)}...\n`);
            } else if (response.data && response.data.choices) {
                console.log('✅ Success - Mock response received (OpenAI format)');
                console.log(`Response preview: ${response.data.choices[0].message.content.substring(0, 100)}...\n`);
            } else {
                console.log('❌ Unexpected response format');
                console.log('Response:', JSON.stringify(response.data, null, 2));
            }
        } catch (error) {
            console.log(`❌ Error testing ${testCase.name}:`, error.message);
        }
    }
    
    console.log('Test completed!');
}

// Run the test
testAIPipeIntegration().catch(console.error);
