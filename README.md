# AgentFlow: Quick Start Guide

AgentFlow is a browser-based proof-of-concept for multi-tool reasoning using LLM agents. This guide will help you set up, run, and understand the project.

## What is AgentFlow?
AgentFlow demonstrates how large language model (LLM) agents can interact with multiple APIs and tools to solve complex tasks in a web environment. It features a simple UI and a Node.js backend.

🌐 **Try it live**: [https://agentflow-production.up.railway.app/](https://agentflow-production.up.railway.app/)

## Features
- Multi-agent architecture
- Integration with external APIs
- Simple browser-based UI
- Node.js backend

## Supported LLM Models & Providers
- **OpenAI**: GPT-4o, GPT-4.1, GPT-5
- **Anthropic**: Claude 4.0 Sonnet, Claude 4.1 Opus
- **Google**: Gemini 2.0 Flash, Gemini 2.5 Pro
- **AI Pipe**: GPT-4o Mini, GPT-4o (via proxy)

## Getting Started

### 1. Install Dependencies
Open a terminal in the project folder and run:
```sh
npm install
```

### 2. Start the Backend Server
Run:
```sh
node server.js
```

### 3. Open the Frontend
Open `index.html` in your browser. This is the main interface for interacting with the agent.

Or use the hosted version: [https://agentflow-production.up.railway.app/](https://agentflow-production.up.railway.app/)

## Project Structure
- `agent.js` — Main agent logic
- `server.js` — Backend server
- `index.html` — Frontend UI
- `styles.css` — UI styles

## How It Works
1. Enter your query in the browser UI.
2. The agent processes your input and may call external APIs or tools as needed.
3. Results are displayed in the browser, and the agent can loop through reasoning steps until the task is complete.

## Tips
- Make sure Node.js is installed on your system.
- You may need API keys for some external services (see project code for details).
- For development, keep the UI and backend running in parallel.

---
For more details, explore the code and experiment with different queries!
- Tool call handling with parallel execution
- Bootstrap-based UI with real-time feedback

### Backend (`server.js`)
- Express.js server with professional logging
- Multi-provider LLM integration
- Tool endpoints for search, AI Pipe, and code execution
- Mock response system for demo mode

### Core Loop Implementation
The JavaScript implementation follows the Python reference loop:
```javascript
async agentLoop() {
    while (true) {
        const response = await this.callLLM();
        if (response.content) {
            this.addMessage('agent', response.content);
        }
        if (response.tool_calls && response.tool_calls.length > 0) {
            // Handle tool calls in parallel
            const toolResults = await Promise.all(
                response.tool_calls.map(tc => this.handleToolCall(tc))
            );
            // Add results to conversation and continue
            for (const result of toolResults) {
                this.conversation.push(result);
            }
            continue; // Continue loop without user input
        } else {
            break; // Wait for next user input
        }
    }
}
```

## Usage Examples

### Interview Workflow
```
User: Interview me to create a blog post
Agent: Sure! What topic would you like to write about?

User: IBM's latest developments
Agent: Let me search for current IBM information...
[Executes Google search]
Agent: Based on my search, IBM has been focusing on...
```

### Code Execution
```
User: Calculate the factorial of 10
Agent: I'll write a function to calculate that for you.
[Executes JavaScript code]
Agent: The factorial of 10 is 3,628,800
```

### AI Pipe Workflow
```
User: Analyze the sentiment of this text: "I love this product!"
Agent: I'll use AI Pipe to analyze the sentiment...
[Executes AI Pipe workflow]
Agent: The sentiment analysis shows: Positive (confidence: 0.95)
```

## Tool Capabilities

### 🔍 Google Search
- Retrieves relevant web snippets
- Configurable number of results  
- Real-time information access
- Integrated into conversation flow

### 🤖 AI Pipe API
- Advanced AI workflows via proxy
- OpenAI model access through AI Pipe
- Seamless integration with conversation
- Professional error handling

### 💻 JavaScript Execution
- Safe browser-based code execution
- Console output capture
- Result display with formatting
- Access to utility functions

## Error Handling

- **Bootstrap Alerts**: User-friendly error messages
- **API Error Recovery**: Graceful fallback to mock responses
- **Input Validation**: Comprehensive validation for all inputs
- **Professional Logging**: Structured logging with debug levels

## Deliverable

A browser JS app with LLM conversation window and three working tool integrations:
- ✅ Google Search Snippets
- ✅ AI Pipe proxy API  
- ✅ JS code execution (sandboxed)

Uses OpenAI's tool-calling interface for all tool invocations. Shows errors with bootstrap-alert. Code is minimal and easy to extend.


## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+  
- Edge 80+

## Security Considerations

- API keys stored in browser session only
- JavaScript execution sandboxed to browser context
- No persistent storage of sensitive data
- Professional error handling without exposing internals

## License

MIT License - See LICENSE file for details.

## Contributing

This is a proof-of-concept designed for maximum hackability. Feel free to extend, modify, and experiment!

---

**Created for educational purposes** - Demonstrates modern LLM agent architectures with tool integration and reasoning loops.
