# LLM Agent Proof-of-Concept (POC): Browser-Based Multi-Tool Reasoning

Modern LLM-powered agents aren't limited to text—they can combine LLM output with external tools like web search, pipelined APIs, and even live code execution!

This proof-of-concept walks you through building a browser-based agent that can use several tools, looping as needed to accomplish a goal.

## Overview: POC Requirements

**Goal:**
Build a minimal JavaScript-based LLM agent that can:
- Take user input in the browser
- Query an LLM for output
- Dynamically trigger tool calls (e.g., search, AI workflow, code execution) based on LLM-chosen actions
- Loop until the task is complete, integrating results at each step

## Core Agent Logic

The core logic is provided by the Python loop below - but it needs to be in JavaScript:

```python
def loop(llm):
    msg = [user_input()]  # App begins by taking user input
    while True:
        output, tool_calls = llm(msg, tools)  # ... and sends the conversation + tools to the LLM
        print("Agent: ", output)  # Always stream LLM output, if any
        if tool_calls:  # Continue executing tool calls until LLM decides it needs no more
            msg += [ handle_tool_call(tc) for tc in tool_calls ]  # Allow multiple tool calls (may be parallel)
        else:
            msg.append(user_input())  # Add the user input message and continue
```

## Supported Tool Calls

Your agent should call these tools as needed:
- **Google Search API**: Return snippet results for user queries
- **AI Pipe API**: Use the aipipe proxy for flexible dataflows
- **JavaScript Code Execution**: Securely run and display results of user- or agent-provided JS code within the browser

## UI/Code Requirements

- **Model Picker**: Use bootstrap-llm-provider so users choose the LLM provider/model
- **LLM-Agent API**: Use OpenAI-style tool/function calls so the LLM can ask for tool actions and receive their results
- **Alert/Error UI**: Show errors gracefully with bootstrap-alert
- **Code Simplicity**: Keep all JavaScript and HTML as simple and small as possible—maximal hackability is the goal!

## Example Agent Conversation

Here's a sample "reasoning loop" in action:

```
User: Interview me to create a blog post.
Agent: output = Sure! What's the post about?, tool_calls = []

User: About IBM
Agent: output = Let me search for IBM, tool_calls = [search("IBM")]

Agent: output = OK, IBM is a big company founded in ..., tool_calls = []

User: Next step, please.
...
```

## Features

### 🤖 Multi-Provider LLM Support
- **OpenAI**: GPT-4o, GPT-4.1, GPT-5
- **Anthropic**: Claude 4.0 Sonnet, Claude 4.1 Opus
- **Google**: Gemini 2.0 Flash, Gemini 2.5 Pro
- **AI Pipe**: GPT-4o Mini, GPT-4o (via proxy)

### 🔧 Integrated Tools
- **Google Search**: Real-time web search with snippet results
- **AI Pipe API**: Advanced AI workflows and data processing
- **JavaScript Execution**: Safe in-browser code execution

### 🎛️ Dynamic Configuration
- Real-time provider/model switching
- API key validation and secure handling
- Professional logging with debug mode
- Bootstrap-based responsive UI

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd AgentFlow-main
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
node server.js
```

4. Open your browser to `http://localhost:3000`

## API Configuration

### Required API Keys

1. **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Anthropic**: Get your API key from [Anthropic Console](https://console.anthropic.com/)
3. **Google Gemini**: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
4. **AI Pipe**: Get free access at [aipipe.org/login](https://aipipe.org/login)
5. **Google Search**: Configure Custom Search Engine at [Google Cloud Console](https://console.cloud.google.com/)

### Environment Setup

No environment files needed - all configuration is done through the web interface for maximum hackability and ease of use.

## Architecture

### Frontend (`agent.js`)
- `LLMAgent` class handles the conversation loop
- Dynamic model switching and API key management
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

## Evaluation Criteria (2 Marks)

| Criteria | Marks |
|----------|-------|
| Output functionality | 1.0 |
| Code quality & clarity | 0.5 |
| UI/UX polish & extras | 0.5 |

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
