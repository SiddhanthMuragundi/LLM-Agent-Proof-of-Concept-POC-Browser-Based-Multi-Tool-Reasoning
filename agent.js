// AgentFlow - Complete Frontend JavaScript with All Fixes
class LLMAgent {
    constructor() {
        this.conversation = [];
        this.isProcessing = false;
        this.tools = this.initializeTools();
        this.debugMode = false;
        
        // Memory management settings
        this.maxConversationLength = 50;
        this.maxDOMMessages = 100;
        this.maxMessageLength = 5000;
        
        // Search management
        this.searchCache = new Map();
        this.maxCacheEntries = 50;
        this.cacheTTL = 3 * 60 * 1000; // 3 minutes
        this.searchCooldown = 1000;
        this.lastSearchTime = 0;
        
        this.initializeUI();
        this.startCleanupInterval();
    }

    // Logging system
    log(level, message, data = null) {
        if (!this.debugMode && level === 'debug') return;
        
        const timestamp = new Date().toISOString();
        
        if (this.debugMode) {
            switch (level) {
                case 'error':
                    console.error(`[${timestamp}] ERROR: ${message}`, data || '');
                    break;
                case 'warn':
                    console.warn(`[${timestamp}] WARN: ${message}`, data || '');
                    break;
                case 'info':
                    console.info(`[${timestamp}] INFO: ${message}`, data || '');
                    break;
                case 'debug':
                    console.log(`[${timestamp}] DEBUG: ${message}`, data || '');
                    break;
            }
        } else if (level === 'error') {
            this.showAlert(`System Error: ${message}`, 'danger');
        }
    }

    initializeUI() {
        // Get DOM elements
        this.conversationEl = document.getElementById('conversation');
        this.userInputEl = document.getElementById('user-input');
        this.sendBtnEl = document.getElementById('send-btn');
        this.sendTextEl = document.getElementById('send-text');
        this.sendSpinnerEl = document.getElementById('send-spinner');
        this.alertContainer = document.getElementById('alert-container');
        this.providerSelect = document.getElementById('llm-provider');
        this.modelSelect = document.getElementById('model-name');
        this.apiKeyInput = document.getElementById('api-key');
        this.googleSearchKeyInput = document.getElementById('google-search-key');
        this.searchEngineIdInput = document.getElementById('search-engine-id');
        this.clearChatBtn = document.getElementById('clear-chat');
        this.messageCountEl = document.getElementById('message-count');
        this.debugModeToggle = document.getElementById('debug-mode');
        this.configToggleBtn = document.getElementById('config-toggle-btn');
        this.configBody = document.getElementById('config-body');

        // Event listeners
        this.sendBtnEl.addEventListener('click', () => this.handleUserInput());
        this.userInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleUserInput();
            }
        });

        this.providerSelect.addEventListener('change', (e) => {
            this.updateModelForProvider(e.target.value);
            this.apiKeyInput.value = '';
            this.validateApiKeyInput();
            this.showConfigurationAlert(`Switched to ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        this.apiKeyInput.addEventListener('input', () => this.validateApiKeyInput());
        this.googleSearchKeyInput.addEventListener('input', () => this.validateGoogleSearchKey());
        this.searchEngineIdInput.addEventListener('input', () => this.validateGoogleSearchKey());
        
        this.modelSelect.addEventListener('change', (e) => {
            this.showConfigurationAlert(`Model changed to ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        this.clearChatBtn.addEventListener('click', () => this.clearChat());
        
        if (this.debugModeToggle) {
            this.debugModeToggle.addEventListener('change', (e) => {
                this.debugMode = e.target.checked;
                this.showConfigurationAlert(
                    this.debugMode ? 'Debug mode enabled' : 'Debug mode disabled', 
                    this.debugMode ? 'info' : 'secondary'
                );
            });
        }

        if (this.configToggleBtn) {
            this.configToggleBtn.addEventListener('click', () => this.toggleConfigurationPanel());
        }

        // Initialize
        this.addMessage('agent', 'Welcome to AgentFlow! 🧠 I\'m your memory-optimized AI assistant that can:\n\n• Search Google for real-time information\n• Execute AI workflows for data processing\n• Run JavaScript code safely in your browser\n• Loop through complex tasks until completion\n\nTry: "Search for IBM AI news" or "Interview me to create a blog post"');
        this.updateMessageCount();
        this.updateModelForProvider('openai');
        
        setTimeout(() => {
            this.validateApiKeyInput();
            this.validateGoogleSearchKey();
        }, 100);
    }

    initializeTools() {
        return [
            {
                type: "function",
                function: {
                    name: "google_search",
                    description: "Search Google for information using the Google Custom Search API",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { 
                                type: "string", 
                                description: "Search query" 
                            },
                            num_results: { 
                                type: "integer", 
                                description: "Number of results (max 10)", 
                                default: 5 
                            }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "ai_pipe",
                    description: "Execute AI workflow for data processing",
                    parameters: {
                        type: "object",
                        properties: {
                            workflow: { type: "string", description: "Workflow type" },
                            data: { type: "string", description: "Input data" }
                        },
                        required: ["workflow", "data"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "execute_javascript",
                    description: "Execute JavaScript code safely",
                    parameters: {
                        type: "object",
                        properties: {
                            code: { type: "string", description: "JavaScript code to execute" }
                        },
                        required: ["code"]
                    }
                }
            }
        ];
    }

    startCleanupInterval() {
        setInterval(() => {
            this.cleanSearchCache();
            this.cleanConversationMemory();
            this.cleanDOMMessages();
            
            if (this.debugMode) {
                this.logMemoryUsage();
            }
        }, 60000); // Clean every minute
    }

    // Memory management functions
    cleanSearchCache() {
        const now = Date.now();
        for (const [key, value] of this.searchCache.entries()) {
            if (now - value.timestamp > this.cacheTTL) {
                this.searchCache.delete(key);
            }
        }
        
        if (this.searchCache.size > this.maxCacheEntries) {
            const entries = Array.from(this.searchCache.entries())
                .sort(([,a], [,b]) => a.timestamp - b.timestamp);
            
            const toRemove = entries.slice(0, entries.length - this.maxCacheEntries);
            toRemove.forEach(([key]) => this.searchCache.delete(key));
        }
    }

    cleanConversationMemory() {
        if (this.conversation.length > this.maxConversationLength) {
            const keepFirst = this.conversation.slice(0, 1);
            const keepRecent = this.conversation.slice(-this.maxConversationLength + 1);
            this.conversation = [...keepFirst, ...keepRecent];
            
            this.log('debug', 'Conversation memory cleaned', { 
                newLength: this.conversation.length 
            });
        }
    }

    cleanDOMMessages() {
        const messages = this.conversationEl.querySelectorAll('.message');
        if (messages.length > this.maxDOMMessages) {
            const toRemove = messages.length - this.maxDOMMessages + 10;
            for (let i = 5; i < toRemove + 5; i++) {
                if (messages[i]) {
                    messages[i].remove();
                }
            }
            this.log('debug', 'DOM messages cleaned', { removed: toRemove });
        }
    }

    logMemoryUsage() {
        if (window.performance?.memory) {
            const memory = window.performance.memory;
            this.log('debug', 'Memory usage', {
                used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                conversationLength: this.conversation.length,
                searchCacheSize: this.searchCache.size,
                domMessages: document.querySelectorAll('.message').length
            });
        }
    }

    // Configuration management
    updateModelForProvider(provider) {
        const modelOptions = {
            'openai': [
                { value: 'gpt-4o', label: 'GPT-4o' },
                { value: 'gpt-4.1', label: 'GPT-4.1' },
                { value: 'gpt-5', label: 'GPT-5' }
            ],
            'anthropic': [
                { value: 'claude-sonnet-4-20250514', label: 'Claude 4.0 Sonnet' },
                { value: 'claude-opus-4-1-20250805', label: 'Claude 4.1 Opus' }
            ],
            'google': [
                { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
                { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }
            ],
            'aipipe': [
                { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
                { value: 'gpt-4o', label: 'GPT-4o' }
            ]
        };
        
        this.modelSelect.innerHTML = '';
        const models = modelOptions[provider] || modelOptions['openai'];
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            this.modelSelect.appendChild(option);
        });
        
        this.validateApiKeyInput();
    }

    validateApiKeyInput() {
        const apiKey = this.apiKeyInput.value.trim();
        const provider = this.providerSelect.value;
        
        let statusEl = document.getElementById('api-key-status');
        if (!statusEl) {
            statusEl = document.createElement('small');
            statusEl.id = 'api-key-status';
            statusEl.className = 'form-text';
            this.apiKeyInput.parentNode.appendChild(statusEl);
        }
        
        if (!apiKey) {
            statusEl.textContent = 'Demo Mode - No API key';
            statusEl.className = 'form-text text-warning';
        } else if (apiKey.length < 10) {
            statusEl.textContent = 'API key too short';
            statusEl.className = 'form-text text-danger';
        } else {
            const providerNames = {
                'openai': 'OpenAI',
                'anthropic': 'Anthropic',
                'google': 'Google',
                'aipipe': 'AI Pipe'
            };
            statusEl.textContent = `${providerNames[provider]} API key configured`;
            statusEl.className = 'form-text text-success';
        }
    }

    validateGoogleSearchKey() {
        const googleKey = this.googleSearchKeyInput.value.trim();
        const searchEngineId = this.searchEngineIdInput.value.trim();
        
        let statusEl = document.getElementById('google-search-status');
        if (!statusEl) {
            statusEl = document.createElement('small');
            statusEl.id = 'google-search-status';
            statusEl.className = 'form-text';
            this.googleSearchKeyInput.parentNode.appendChild(statusEl);
        }
        
        if (!googleKey && !searchEngineId) {
            statusEl.textContent = 'Using fallback search (no credentials)';
            statusEl.className = 'form-text text-info';
        } else if (!googleKey) {
            statusEl.textContent = 'Google API key missing';
            statusEl.className = 'form-text text-warning';
        } else if (!searchEngineId) {
            statusEl.textContent = 'Search Engine ID missing';
            statusEl.className = 'form-text text-warning';
        } else if (!googleKey.startsWith('AIza') || googleKey.length !== 39) {
            statusEl.textContent = 'Invalid Google API key format (should start with "AIza" and be 39 chars)';
            statusEl.className = 'form-text text-danger';
        } else if (searchEngineId.length < 10 || !searchEngineId.includes(':')) {
            statusEl.textContent = 'Invalid Search Engine ID format (should contain ":")';
            statusEl.className = 'form-text text-danger';
        } else {
            statusEl.textContent = 'Google Search API configured ✓';
            statusEl.className = 'form-text text-success';
        }
    }

    toggleConfigurationPanel() {
        const isCollapsed = this.configBody.style.display === 'none';
        
        if (isCollapsed) {
            this.configBody.style.display = 'block';
            this.configToggleBtn.innerHTML = '<i class="fas fa-chevron-up me-1"></i>Hide Config';
        } else {
            this.configBody.style.display = 'none';
            this.configToggleBtn.innerHTML = '<i class="fas fa-chevron-down me-1"></i>Show Config';
        }
    }

    showConfigurationAlert(message, type) {
        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertEl.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertEl);
        setTimeout(() => {
            if (alertEl.parentNode) {
                alertEl.remove();
            }
        }, 3000);
    }

    clearChat() {
        if (this.conversation.length > 1) {
            if (!confirm('Clear conversation? This cannot be undone.')) {
                return;
            }
        }

        this.conversation = [];
        this.conversationEl.innerHTML = '';
        this.addMessage('agent', 'Welcome back to AgentFlow! 🧠 Ready to assist you with searches, AI workflows, and code execution.');
        this.updateMessageCount();
        this.showAlert('Conversation cleared successfully!', 'success');
        this.userInputEl.focus();
    }

    updateMessageCount() {
        const messageCount = this.conversationEl.querySelectorAll('.message').length;
        if (this.messageCountEl) {
            this.messageCountEl.textContent = `${messageCount} message${messageCount !== 1 ? 's' : ''}`;
        }
    }

    // Main conversation handling
    async handleUserInput() {
        const input = this.userInputEl.value.trim();
        if (!input || this.isProcessing) return;

        // Limit input length
        const limitedInput = input.substring(0, 2000);
        if (input.length > 2000) {
            this.showAlert('Input truncated to 2000 characters', 'warning');
        }

        this.addMessage('user', limitedInput);
        this.userInputEl.value = '';
        this.setProcessing(true);

        this.conversation.push({
            role: 'user',
            content: limitedInput
        });

        await this.agentLoop();
    }

    async agentLoop() {
        try {
            while (true) {
                const response = await this.callLLM();
                
                if (response.content) {
                    this.addMessage('agent', response.content);
                    this.log('debug', 'Agent response received', { 
                        contentLength: response.content.length 
                    });
                }

                if (response.tool_calls && response.tool_calls.length > 0) {
                    const toolResults = await Promise.all(
                        response.tool_calls.map(tc => this.handleToolCall(tc))
                    );
                    
                    this.conversation.push({
                        role: 'assistant',
                        content: response.content,
                        tool_calls: response.tool_calls
                    });
                    
                    for (const result of toolResults) {
                        this.conversation.push(result);
                    }
                    
                    continue;
                } else {
                    this.conversation.push({
                        role: 'assistant',
                        content: response.content
                    });
                    break;
                }
            }
        } catch (error) {
            this.showAlert(`Agent Error: ${error.message}`, 'danger');
            this.log('error', 'Agent loop error', { error: error.message });
        } finally {
            this.setProcessing(false);
        }
    }

    // FIXED: Always read fresh credentials from frontend
    async callLLM() {
        const provider = this.providerSelect.value;
        const apiKey = this.apiKeyInput.value.trim();
        const model = this.modelSelect.value;

        if (!apiKey || apiKey === '') {
            return this.getMockLLMResponse();
        }

        try {
            // Always read fresh values from frontend every time
            const requestData = {
                provider: provider,
                model: model,
                messages: this.conversation.slice(-20), // Memory limit
                tools: this.tools,
                apiKey: apiKey, // Fresh from frontend
                googleSearchKey: this.googleSearchKeyInput.value.trim(), // Fresh
                searchEngineId: this.searchEngineIdInput.value.trim() // Fresh
            };

            const response = await fetch('/api/llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData),
                signal: AbortSignal.timeout(60000)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `API request failed: ${response.status}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            this.log('error', `Backend API Error: ${provider.toUpperCase()}`, { error: error.message });
            throw new Error(`Failed to call ${provider.toUpperCase()} API: ${error.message}`);
        }
    }

    // FIXED: Consistent response format that won't break mid-conversation
    getMockLLMResponse() {
        const lastMessage = this.conversation[this.conversation.length - 1];
        const userInput = lastMessage ? lastMessage.content.toLowerCase() : '';
        const provider = this.providerSelect.value;
        const model = this.modelSelect.value;
        
        let content = `Hello! I'm a ${provider.toUpperCase()} ${model} response in demo mode. `;
        
        const conversationHistory = this.conversation.map(msg => msg.content).join(' ').toLowerCase();

        // Enhanced contextual responses
        if (userInput.includes('interview') && userInput.includes('blog')) {
            content = "Sure! What's the topic for your blog post? I'll help you gather information and structure your content.";
            return { content, tool_calls: null };
        }
        
        if (userInput.includes('ibm') && (conversationHistory.includes('interview') || conversationHistory.includes('blog'))) {
            content = "Let me search for current IBM information to help with your blog post.";
            return {
                content,
                tool_calls: [{
                    id: 'call_demo_' + Date.now(),
                    type: 'function',
                    function: {
                        name: 'google_search',
                        arguments: JSON.stringify({
                            query: 'IBM company recent developments AI cloud 2024 2025',
                            num_results: 5
                        })
                    }
                }]
            };
        }
        
        if ((userInput.includes('next') || userInput.includes('continue')) && conversationHistory.includes('ibm')) {
            content = "Great! Based on my research, IBM is focusing heavily on AI and hybrid cloud solutions. What specific aspect would you like to highlight? For example:\n\n1. AI initiatives (Watson, watsonx)\n2. Hybrid cloud strategy\n3. Quantum computing\n4. Sustainability efforts\n\nWhich interests you most?";
            return { content, tool_calls: null };
        }
        
        if (conversationHistory.includes('ibm') && userInput.includes('ai')) {
            content = "Excellent choice! Let me gather more detailed information about IBM's AI initiatives.";
            return {
                content,
                tool_calls: [{
                    id: 'call_demo_' + Date.now(),
                    type: 'function',
                    function: {
                        name: 'google_search',
                        arguments: JSON.stringify({
                            query: 'IBM AI Watson watsonx artificial intelligence 2024',
                            num_results: 3
                        })
                    }
                }]
            };
        }
        
        if (userInput.includes('search') || userInput.includes('find')) {
            const searchTerm = this.extractSearchTerm(userInput);
            content += `I'll search for information about "${searchTerm}".`;
            return {
                content,
                tool_calls: [{
                    id: 'call_demo_' + Date.now(),
                    type: 'function',
                    function: {
                        name: 'google_search',
                        arguments: JSON.stringify({
                            query: searchTerm,
                            num_results: 5
                        })
                    }
                }]
            };
        } else if (userInput.includes('code') || userInput.includes('javascript')) {
            content += "I'll run some JavaScript code for you.";
            return {
                content,
                tool_calls: [{
                    id: 'call_demo_' + Date.now(),
                    type: 'function',
                    function: {
                        name: 'execute_javascript',
                        arguments: JSON.stringify({
                            code: "console.log('Hello from AgentFlow demo!'); const result = Math.random() * 100; console.log('Random number:', Math.floor(result)); return Math.floor(result);"
                        })
                    }
                }]
            };
        } else if (userInput.includes('analyze') || userInput.includes('summarize')) {
            content += "I'll process that using an AI workflow.";
            return {
                content,
                tool_calls: [{
                    id: 'call_demo_' + Date.now(),
                    type: 'function',
                    function: {
                        name: 'ai_pipe',
                        arguments: JSON.stringify({
                            workflow: 'summarize',
                            data: userInput
                        })
                    }
                }]
            };
        }
        
        if (conversationHistory.includes('interview') || conversationHistory.includes('blog')) {
            const interviewResponses = [
                "What specific angle would you like to take with this topic?",
                "Who is your target audience for this content?",
                "What key message do you want readers to take away?",
                "Would you like me to research any specific aspects further?",
                "Should we start outlining the structure?"
            ];
            content = interviewResponses[Math.floor(Math.random() * interviewResponses.length)];
            return { content, tool_calls: null };
        }
        
        content += "I'm here to help with searches, code execution, and AI workflows. Add API keys for full functionality!";
        return { content, tool_calls: null };
    }

    extractSearchTerm(input) {
        const patterns = [
            /search for (.+)/i,
            /find (.+)/i,
            /look up (.+)/i,
            /about (.+)/i
        ];
        
        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        return input.replace(/search|find|look up|about/gi, '').trim() || 'information';
    }

    // Tool handling
    async handleToolCall(toolCall) {
        const { name, arguments: args } = toolCall.function;
        const parsedArgs = JSON.parse(args);

        this.addMessage('tool', `🔧 Executing ${name}...`, 'thinking');

        try {
            let result;
            switch (name) {
                case 'google_search':
                    result = await this.googleSearch(parsedArgs.query, parsedArgs.num_results || 5);
                    break;
                case 'ai_pipe':
                    result = await this.aiPipe(parsedArgs.workflow, parsedArgs.data);
                    break;
                case 'execute_javascript':
                    result = await this.executeJavaScript(parsedArgs.code);
                    break;
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }

            this.addMessage('tool', `✅ ${name} completed:\n${this.formatToolResult(name, result)}`);
            
            return {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
            };
        } catch (error) {
            const errorMsg = `❌ ${name} failed: ${error.message}`;
            this.addMessage('tool', errorMsg);
            return {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: errorMsg
            };
        }
    }

    // FIXED: Google Search with fresh credential reading every time
    async googleSearch(query, numResults = 5) {
        if (!query || typeof query !== 'string') {
            throw new Error('Invalid search query');
        }
        
        query = query.trim().substring(0, 200);
        numResults = Math.min(Math.max(parseInt(numResults) || 5, 1), 10);
        
        // Rate limiting
        const now = Date.now();
        if (now - this.lastSearchTime < this.searchCooldown) {
            await new Promise(resolve => setTimeout(resolve, this.searchCooldown - (now - this.lastSearchTime)));
        }
        this.lastSearchTime = Date.now();
        
        // Check cache
        const cacheKey = `${query.toLowerCase()}_${numResults}`;
        this.cleanSearchCache();
        
        const cached = this.searchCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
            this.log('debug', 'Using cached search results', { query: query.substring(0, 50) });
            return { ...cached.data, cached: true };
        }
        
        try {
            // Always read fresh credentials from frontend every time
            const googleSearchKey = this.googleSearchKeyInput.value.trim();
            const searchEngineId = this.searchEngineIdInput.value.trim();
            
            this.log('debug', 'Starting search with fresh credentials', { 
                query: query.substring(0, 50), 
                numResults, 
                hasApiKey: !!googleSearchKey,
                hasEngineId: !!searchEngineId,
                cacheSize: this.searchCache.size
            });
            
            // Always send fresh credentials to backend every time
            const requestData = {
                query: query,
                num_results: numResults,
                googleSearchKey: googleSearchKey, // Fresh from frontend
                searchEngineId: searchEngineId // Fresh from frontend
            };
            
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData),
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                throw new Error(`Search API error: ${response.status}`);
            }

            const result = await response.json();
            
            // Clean and validate result
            const cleanedResult = {
                query: result.query,
                results: (result.results || []).slice(0, numResults).map(item => ({
                    title: (item.title || 'No title').substring(0, 150),
                    link: item.link || '#',
                    snippet: (item.snippet || 'No description').substring(0, 300),
                    displayLink: item.displayLink || 'unknown'
                })),
                source: result.source || 'Unknown',
                totalResults: Math.min(result.totalResults || 0, 1000000),
                timestamp: result.timestamp || new Date().toISOString(),
                cached: result.cached || false,
                note: result.note
            };
            
            // Cache if not already cached
            if (!result.cached) {
                this.searchCache.set(cacheKey, {
                    data: cleanedResult,
                    timestamp: Date.now()
                });
            }
            
            this.log('info', 'Search completed', { 
                query: query.substring(0, 50),
                source: cleanedResult.source,
                resultCount: cleanedResult.results.length,
                fromCache: result.cached
            });

            return cleanedResult;

        } catch (error) {
            this.log('warn', 'Search failed, using fallback', { 
                query: query.substring(0, 50), 
                error: error.message 
            });
            
            return this.getMinimalFallbackResults(query, numResults);
        }
    }

    getMinimalFallbackResults(query, numResults = 5) {
        const queryLower = query.toLowerCase();
        numResults = Math.min(numResults, 5);
        
        // Knowledge base for common topics
        const knowledgeResults = {
            'ibm': {
                title: "IBM Official Website - AI and Cloud Computing",
                link: "https://www.ibm.com",
                snippet: "IBM provides enterprise AI, hybrid cloud computing, and quantum technologies for digital transformation.",
                displayLink: "www.ibm.com"
            },
            'ai': {
                title: "Artificial Intelligence - Wikipedia",
                link: "https://en.wikipedia.org/wiki/Artificial_intelligence",
                snippet: "Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans.",
                displayLink: "en.wikipedia.org"
            },
            'openai': {
                title: "OpenAI - Artificial Intelligence Research",
                link: "https://openai.com",
                snippet: "OpenAI is an AI research and deployment company dedicated to ensuring artificial general intelligence benefits all humanity.",
                displayLink: "openai.com"
            },
            'google': {
                title: "Google - Search and AI Technologies",
                link: "https://www.google.com",
                snippet: "Google's mission is to organize the world's information and make it universally accessible and useful.",
                displayLink: "www.google.com"
            }
        };
        
        // Check if we have specific knowledge for this query
        for (const [topic, result] of Object.entries(knowledgeResults)) {
            if (queryLower.includes(topic)) {
                return {
                    query,
                    results: [result].slice(0, numResults),
                    source: 'Knowledge Base',
                    totalResults: 1,
                    timestamp: new Date().toISOString(),
                    note: 'Enhanced fallback results - configure Google Search API for real-time results'
                };
            }
        }
        
        // Generic fallback results
        const genericResults = [
            {
                title: `${query} - Wikipedia`,
                link: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
                snippet: `Wikipedia article about ${query}. Free encyclopedia with comprehensive information.`,
                displayLink: "en.wikipedia.org"
            },
            {
                title: `${query} - Google Search`,
                link: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                snippet: `Search results for ${query} on Google. Find websites, news, and information.`,
                displayLink: "www.google.com"
            },
            {
                title: `${query} - Latest News`,
                link: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
                snippet: `Latest news and updates about ${query} from trusted news sources.`,
                displayLink: "news.google.com"
            }
        ];
        
        return {
            query,
            results: genericResults.slice(0, numResults),
            source: 'Minimal Fallback',
            totalResults: genericResults.length,
            timestamp: new Date().toISOString(),
            note: 'Basic fallback results - add Google API credentials for enhanced search'
        };
    }

    async aiPipe(workflow, data) {
        try {
            const response = await fetch('/api/ai-pipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflow: workflow,
                    data: data.substring(0, 1000) // Limit data size
                }),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`AI Pipe API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            this.log('warn', 'AI Pipe API unavailable, using mock', { workflow, error: error.message });
            return {
                workflow: workflow,
                result: `Mock AI Pipe ${workflow} result for: ${data.substring(0, 100)}...`,
                status: 'completed',
                timestamp: new Date().toISOString()
            };
        }
    }

    async executeJavaScript(code) {
        try {
            // Limit code size for security
            if (code.length > 5000) {
                code = code.substring(0, 5000);
                this.showAlert('Code truncated to 5000 characters', 'warning');
            }
            
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code }),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`Code execution API error: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.displayCodeResult(result);
            }
            
            return result;
        } catch (error) {
            this.log('error', 'Code execution failed', { error: error.message });
            return {
                success: false,
                result: null,
                logs: [],
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // UI helper functions
    formatToolResult(toolName, result) {
        switch (toolName) {
            case 'google_search':
                return this.formatSearchResults(result);
            case 'ai_pipe':
                return `**Workflow:** ${result.workflow}\n**Result:** ${result.result}`;
            case 'execute_javascript':
                return result.success 
                    ? `**Success!** Result: ${result.result}\nLogs: ${result.logs.join(', ')}`
                    : `**Error:** ${result.error}`;
            default:
                return JSON.stringify(result, null, 2).substring(0, 1000);
        }
    }

    formatSearchResults(result) {
        if (!result || !result.results || !Array.isArray(result.results)) {
            return 'No search results available';
        }
        
        const source = result.cached ? ` (cached, ${result.source})` : ` (${result.source})`;
        const resultCount = result.results.length;
        let note = result.note ? `\n*${result.note}*\n` : '';
        
        let formatted = `## Search: "${result.query}"${source}${note}\n**${resultCount} result${resultCount !== 1 ? 's' : ''}**\n\n`;
        
        result.results.forEach((item, index) => {
            const title = item.title.substring(0, 80) + (item.title.length > 80 ? '...' : '');
            const snippet = item.snippet.substring(0, 150) + (item.snippet.length > 150 ? '...' : '');
            
            formatted += `### ${index + 1}. **${title}**\n`;
            formatted += `${snippet}\n`;
            formatted += `🔗 [${item.displayLink}](${item.link})\n\n`;
        });
        
        return formatted;
    }

    displayCodeResult(result) {
        const codeDiv = document.createElement('div');
        codeDiv.className = 'code-execution mt-3';
        codeDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <strong><i class="fas fa-play-circle me-2"></i>Code Execution</strong>
                <span class="badge bg-success"><i class="fas fa-check me-1"></i>Success</span>
            </div>
            <div class="bg-dark text-light p-3 rounded mb-2">
                <small class="text-muted d-block mb-2">Code:</small>
                <pre class="text-light mb-0"><code>${this.escapeHtml(result.code || 'N/A')}</code></pre>
            </div>
            ${result.result !== undefined ? `<div class="mt-2"><strong>Result:</strong> <code>${this.escapeHtml(String(result.result))}</code></div>` : ''}
            ${result.logs && result.logs.length > 0 ? `<div class="mt-2"><strong>Console:</strong><br><code>${result.logs.map(log => this.escapeHtml(log)).join('<br>')}</code></div>` : ''}
        `;
        this.conversationEl.appendChild(codeDiv);
        this.scrollToBottom();
    }

    addMessage(type, content, className = '') {
        // Limit message content for memory management
        if (typeof content === 'string' && content.length > this.maxMessageLength) {
            content = content.substring(0, this.maxMessageLength) + '\n\n<span class="truncated">[Message truncated to save memory]</span>';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message ${className}`;
        
        const icons = {
            'user': '<i class="fas fa-user"></i>',
            'agent': '<i class="fas fa-robot"></i>',
            'tool': '<i class="fas fa-cog"></i>'
        };
        
        const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.innerHTML = `
            <div class="d-flex align-items-start">
                <div class="me-3">${icons[type] || '<i class="fas fa-message"></i>'}</div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                        <small class="opacity-75">${timestamp}</small>
                    </div>
                    <div>${this.formatMessage(content)}</div>
                </div>
            </div>
        `;
        
        this.conversationEl.appendChild(messageDiv);
        this.cleanDOMMessages();
        this.scrollToBottom();
        this.updateMessageCount();
    }

    formatMessage(content) {
        return this.escapeHtml(content).replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.conversationEl.scrollTop = this.conversationEl.scrollHeight;
    }

    setProcessing(isProcessing) {
        this.isProcessing = isProcessing;
        this.sendBtnEl.disabled = isProcessing;
        this.userInputEl.disabled = isProcessing;
        
        if (isProcessing) {
            this.sendTextEl.classList.add('d-none');
            this.sendSpinnerEl.classList.remove('d-none');
        } else {
            this.sendTextEl.classList.remove('d-none');
            this.sendSpinnerEl.classList.add('d-none');
        }
    }

    showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show border-0`;
        
        const icons = {
            'success': '<i class="fas fa-check-circle me-2"></i>',
            'danger': '<i class="fas fa-exclamation-triangle me-2"></i>',
            'warning': '<i class="fas fa-exclamation-circle me-2"></i>',
            'info': '<i class="fas fa-info-circle me-2"></i>'
        };
        
        alertDiv.innerHTML = `
            ${icons[type] || icons['info']}${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        this.alertContainer.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    // Utility methods for external access (memory monitor)
    getCacheStats() {
        return {
            size: this.searchCache.size,
            maxSize: this.maxCacheEntries,
            ttl: this.cacheTTL / 1000 + 's'
        };
    }

    clearCache() {
        this.searchCache.clear();
        this.log('info', 'Search cache cleared manually');
    }
}

// Initialize agent when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.agent = new LLMAgent();
    
    // Export utilities for memory monitor
    window.searchUtils = {
        clearCache: () => window.agent.clearCache(),
        getCacheStats: () => window.agent.getCacheStats(),
        cleanCache: () => window.agent.cleanSearchCache()
    };
    
    // Global error handler
    window.addEventListener('error', (event) => {
        if (window.agent) {
            window.agent.log('error', 'Global error caught', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno
            });
        }
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        if (window.agent) {
            window.agent.log('error', 'Unhandled promise rejection', {
                reason: event.reason
            });
        }
    });
});

// Demo functions for code execution testing
window.demoFunctions = {
    fibonacci: (n) => {
        if (n > 40) return 'Number too large (max 40)';
        return n <= 1 ? n : window.demoFunctions.fibonacci(n-1) + window.demoFunctions.fibonacci(n-2);
    },
    
    isPrime: (num) => {
        if (num > 1000000) return 'Number too large (max 1,000,000)';
        if (num < 2) return false;
        for (let i = 2; i <= Math.sqrt(num); i++) {
            if (num % i === 0) return false;
        }
        return true;
    },
    
    generateRandomData: (count) => {
        const limit = Math.min(count || 10, 100);
        return Array.from({length: limit}, () => Math.floor(Math.random() * 100));
    },
    
    sortArray: (arr) => {
        if (!Array.isArray(arr)) return 'Input must be an array';
        return [...arr].sort((a, b) => a - b);
    },
    
    calculateStats: (numbers) => {
        if (!Array.isArray(numbers)) return 'Input must be an array';
        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        return { sum, average: avg, min, max, count: numbers.length };
    }
};

// Utility functions for demo
window.utils = {
    generateRandomArray: (size) => window.demoFunctions.generateRandomData(size),
    fibonacci: (n) => window.demoFunctions.fibonacci(n),
    isPrime: (n) => window.demoFunctions.isPrime(n),
    stats: (arr) => window.demoFunctions.calculateStats(arr)
};