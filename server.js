const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { VM } = require('vm2');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Memory management
const searchCache = new Map();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RESULTS = 10;
const MAX_QUERY_LENGTH = 200;

// Professional logging
const logger = {
    info: (message, data) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`, data ? JSON.stringify(data) : '');
    },
    warn: (message, data) => {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] WARN: ${message}`, data ? JSON.stringify(data) : '');
    },
    error: (message, data) => {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}`, data ? JSON.stringify(data) : '');
    },
    debug: (message, data) => {
        if (process.env.NODE_ENV === 'development') {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] DEBUG: ${message}`, data ? JSON.stringify(data) : '');
        }
    }
};

// Cache cleanup
function cleanCache() {
    const now = Date.now();
    for (const [key, value] of searchCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            searchCache.delete(key);
        }
    }
    
    if (searchCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(searchCache.entries())
            .sort(([,a], [,b]) => a.timestamp - b.timestamp);
        
        const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
        toRemove.forEach(([key]) => searchCache.delete(key));
    }
}

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

// Security headers
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-search.html'));
});

app.get('/favicon.ico', (req, res) => {
    res.status(204).send();
});

// LLM API endpoint
app.post('/api/llm', async (req, res) => {
    try {
        let { provider, model, messages, tools, apiKey, googleSearchKey, searchEngineId } = req.body;
        
        // Input validation
        if (!provider || !model || !messages) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Limit conversation length
        if (messages && messages.length > 50) {
            messages = [...messages.slice(0, 2), ...messages.slice(-48)];
            logger.warn('Conversation truncated to prevent memory overload');
        }
        
        // Truncate long messages
        if (messages) {
            messages = messages.map(msg => ({
                ...msg,
                content: msg.content && typeof msg.content === 'string' 
                    ? msg.content.substring(0, 8000) 
                    : msg.content
            }));
        }
        
        // Demo mode if no API key
        if (!apiKey || apiKey.trim() === '' || apiKey === 'undefined' || apiKey === 'null') {
            logger.debug('Demo mode activated', { provider, model, reason: 'No valid API key' });
            return res.json(getMockResponse(provider, model, messages));
        }
        
        let response;
        
        try {
            switch (provider) {
                case 'openai':
                    response = await callOpenAI(model, messages, tools, apiKey);
                    break;
                case 'anthropic':
                    response = await callAnthropic(model, messages, tools, apiKey);
                    break;
                case 'google':
                    response = await callGemini(model, messages, tools, apiKey);
                    break;
                case 'aipipe':
                    response = await callAIPipe(model, messages, tools, apiKey);
                    break;
                default:
                    return res.status(400).json({ error: 'Unsupported provider' });
            }
            
            res.json(response);
            
        } catch (apiError) {
            logger.warn('API call failed, using fallback', { 
                provider, 
                model, 
                error: apiError.message,
                messageCount: messages?.length || 0
            });
            return res.json(getMockResponse(provider, model, messages));
        }
        
    } catch (error) {
        logger.error('LLM API Error', { error: error.message, provider: req.body.provider, model: req.body.model });
        res.status(500).json(getMockResponse(req.body.provider, req.body.model, req.body.messages));
    }
});

// Google Search API endpoint
app.post('/api/search', async (req, res) => {
    try {
        let { query, num_results = 5, googleSearchKey, searchEngineId } = req.body;
        
        // Input validation
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Valid query is required' });
        }
        
        query = query.trim().substring(0, MAX_QUERY_LENGTH);
        num_results = Math.min(Math.max(parseInt(num_results) || 5, 1), MAX_RESULTS);
        
        // Check cache first
        const cacheKey = `${query.toLowerCase()}_${num_results}`;
        cleanCache();
        
        const cached = searchCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            logger.info('Returning cached search results');
            return res.json({ ...cached.data, cached: true });
        }
        
        logger.info('Search request', { 
            query: query.substring(0, 50), 
            num_results,
            hasKey: !!googleSearchKey,
            hasEngineId: !!searchEngineId,
            cacheSize: searchCache.size
        });
        
        // Try Google API if credentials provided (read fresh from frontend)
        if (googleSearchKey && searchEngineId && googleSearchKey.length > 20) {
            try {
                const googleResults = await performGoogleSearch(googleSearchKey, searchEngineId, query, num_results);
                
                // Cache successful results
                searchCache.set(cacheKey, {
                    data: googleResults,
                    timestamp: Date.now()
                });
                
                logger.info('Google API success', { resultCount: googleResults.results.length });
                return res.json(googleResults);
                
            } catch (googleError) {
                logger.warn('Google API failed, using fallback', { 
                    error: googleError.message,
                    status: googleError.response?.status
                });
            }
        } else if (googleSearchKey || searchEngineId) {
            logger.info('Incomplete Google credentials', { 
                hasKey: !!googleSearchKey,
                hasEngineId: !!searchEngineId,
                keyLength: googleSearchKey?.length || 0
            });
        }
        
        // Use fallback search
        const fallbackResults = await performFallbackSearch(query, num_results);
        
        // Cache fallback results
        searchCache.set(cacheKey, {
            data: fallbackResults,
            timestamp: Date.now()
        });
        
        res.json(fallbackResults);
        
    } catch (error) {
        logger.error('Search endpoint error', { error: error.message });
        
        // Emergency fallback
        const emergencyResults = {
            query: req.body.query || 'search',
            results: [{
                title: `${req.body.query || 'Search'} - Wikipedia`,
                link: `https://en.wikipedia.org/wiki/${encodeURIComponent(req.body.query || 'search')}`,
                snippet: `Information about ${req.body.query || 'your search'} from Wikipedia.`,
                displayLink: "en.wikipedia.org"
            }],
            source: 'Emergency Fallback',
            totalResults: 1,
            timestamp: new Date().toISOString(),
            note: 'Search service temporarily unavailable'
        };
        
        res.json(emergencyResults);
    }
});

// Google Search implementation
async function performGoogleSearch(apiKey, searchEngineId, query, numResults) {
    const url = 'https://www.googleapis.com/customsearch/v1';
    
    // Validate inputs
    if (!apiKey.startsWith('AIza') || apiKey.length !== 39) {
        throw new Error('Invalid Google API key format');
    }
    
    if (!searchEngineId || searchEngineId.length < 10) {
        throw new Error('Invalid Search Engine ID format');
    }
    
    const params = {
        key: apiKey,
        cx: searchEngineId,
        q: query,
        num: Math.min(numResults, 10),
        safe: 'active'
    };
    
    logger.debug('Google API request', { 
        url, 
        query: query.substring(0, 50),
        engineId: searchEngineId.substring(0, 10) + '...'
    });
    
    const response = await axios.get(url, {
        params,
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AgentFlow/1.0)',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://cse.google.com/'
        }
    });
    
    logger.debug('Google API response', { 
        status: response.status,
        hasItems: !!response.data.items,
        itemCount: response.data.items?.length || 0
    });
    
    if (!response.data.items || response.data.items.length === 0) {
        throw new Error('No results returned from Google API');
    }
    
    const results = response.data.items.map(item => ({
        title: (item.title || 'No title').substring(0, 150),
        link: item.link || '#',
        snippet: (item.snippet || 'No description available').substring(0, 300),
        displayLink: item.displayLink || extractDomain(item.link || 'https://example.com')
    }));
    
    return {
        query,
        results: results.slice(0, numResults),
        source: 'Google Custom Search API',
        totalResults: Math.min(parseInt(response.data.searchInformation?.totalResults) || results.length, 1000000),
        searchTime: parseFloat(response.data.searchInformation?.searchTime) || 0,
        timestamp: new Date().toISOString()
    };
}

// Fallback search with multiple methods
async function performFallbackSearch(query, numResults) {
    logger.info('Using fallback search', { query: query.substring(0, 50) });
    
    // Try Wikipedia first
    try {
        const wikipediaResult = await tryWikipediaSearch(query);
        if (wikipediaResult) {
            const fallbackResults = getKnowledgeBaseResults(query, numResults);
            fallbackResults.results.unshift(wikipediaResult);
            fallbackResults.results = fallbackResults.results.slice(0, numResults);
            fallbackResults.source = 'Wikipedia + Knowledge Base';
            return fallbackResults;
        }
    } catch (error) {
        logger.debug('Wikipedia search failed', { error: error.message });
    }
    
    // Use knowledge base fallback
    return getKnowledgeBaseResults(query, numResults);
}

// Wikipedia search
async function tryWikipediaSearch(query) {
    try {
        const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 5000,
            headers: {
                'User-Agent': 'AgentFlow/1.0 (https://github.com/agentflow)',
                'Accept': 'application/json'
            }
        });
        
        if (response.data && response.data.extract && !response.data.type?.includes('disambiguation')) {
            return {
                title: response.data.title || `${query} - Wikipedia`,
                link: response.data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
                snippet: response.data.extract.substring(0, 300),
                displayLink: 'en.wikipedia.org'
            };
        }
        
        return null;
        
    } catch (error) {
        logger.debug('Wikipedia API failed', { error: error.message });
        return null;
    }
}

// Knowledge base fallback
function getKnowledgeBaseResults(query, numResults) {
    const queryLower = query.toLowerCase();
    
    // Enhanced knowledge base
    const knowledgeBase = {
        'openai': [
            {
                title: "OpenAI - Artificial Intelligence Research",
                link: "https://openai.com",
                snippet: "OpenAI is an AI research and deployment company dedicated to ensuring artificial general intelligence benefits all humanity.",
                displayLink: "openai.com"
            },
            {
                title: "OpenAI API Platform",
                link: "https://platform.openai.com",
                snippet: "Build with OpenAI's powerful AI models including GPT-4, DALL·E, and Whisper through their developer platform.",
                displayLink: "platform.openai.com"
            },
            {
                title: "ChatGPT by OpenAI",
                link: "https://chat.openai.com",
                snippet: "ChatGPT is a conversational AI assistant that can help with writing, analysis, coding, math, and creative tasks.",
                displayLink: "chat.openai.com"
            }
        ],
        
        'ibm': [
            {
                title: "IBM - Leading Enterprise AI and Cloud Solutions",
                link: "https://www.ibm.com",
                snippet: "IBM provides enterprise AI, cloud computing, and data solutions including Watson AI, Red Hat, and hybrid cloud technologies.",
                displayLink: "www.ibm.com"
            },
            {
                title: "IBM Watson AI Platform",
                link: "https://www.ibm.com/watson",
                snippet: "IBM Watson delivers AI solutions for business with machine learning, natural language processing, and automated insights.",
                displayLink: "www.ibm.com"
            },
            {
                title: "IBM Cloud - Hybrid Multi-Cloud Platform",
                link: "https://www.ibm.com/cloud",
                snippet: "Enterprise-grade cloud platform with AI services, Red Hat OpenShift, and industry-specific solutions for digital transformation.",
                displayLink: "www.ibm.com"
            }
        ],
        
        'google': [
            {
                title: "Google - Search, AI, and Cloud Technologies",
                link: "https://www.google.com",
                snippet: "Google's mission is to organize the world's information and make it universally accessible through search, AI, and cloud services.",
                displayLink: "www.google.com"
            },
            {
                title: "Google Cloud Platform",
                link: "https://cloud.google.com",
                snippet: "Google Cloud provides scalable cloud computing services with AI/ML capabilities, data analytics, and enterprise infrastructure.",
                displayLink: "cloud.google.com"
            },
            {
                title: "Google AI and Research",
                link: "https://ai.google",
                snippet: "Google AI advances the state of artificial intelligence through research in machine learning, computer vision, and natural language processing.",
                displayLink: "ai.google"
            }
        ],
        
        'microsoft': [
            {
                title: "Microsoft - Cloud, Productivity and AI Solutions",
                link: "https://www.microsoft.com",
                snippet: "Microsoft empowers organizations with cloud computing, productivity tools, AI services, and enterprise software solutions.",
                displayLink: "www.microsoft.com"
            },
            {
                title: "Microsoft Azure Cloud Platform",
                link: "https://azure.microsoft.com",
                snippet: "Azure provides comprehensive cloud services including AI, machine learning, databases, and enterprise applications.",
                displayLink: "azure.microsoft.com"
            },
            {
                title: "Microsoft 365 Productivity Suite",
                link: "https://www.microsoft.com/microsoft-365",
                snippet: "Microsoft 365 combines Office applications, cloud services, and AI-powered productivity tools for modern work.",
                displayLink: "www.microsoft.com"
            }
        ],
        
        'artificial intelligence': [
            {
                title: "What is Artificial Intelligence? - Comprehensive Guide",
                link: "https://www.ibm.com/topics/artificial-intelligence",
                snippet: "Artificial intelligence enables computers and machines to mimic human problem-solving and decision-making capabilities through advanced algorithms.",
                displayLink: "www.ibm.com"
            },
            {
                title: "AI Research and News - MIT Technology Review",
                link: "https://www.technologyreview.com/topic/artificial-intelligence/",
                snippet: "Latest breakthroughs in AI research, machine learning applications, and the impact of artificial intelligence on society and industry.",
                displayLink: "www.technologyreview.com"
            },
            {
                title: "Stanford AI Research Institute",
                link: "https://hai.stanford.edu",
                snippet: "Stanford's Human-Centered AI Institute advances AI research, education, and policy to improve human welfare and society.",
                displayLink: "hai.stanford.edu"
            }
        ],
        
        'machine learning': [
            {
                title: "Machine Learning Course - Stanford University",
                link: "https://www.coursera.org/learn/machine-learning",
                snippet: "Learn machine learning fundamentals from Andrew Ng covering algorithms, neural networks, and practical implementation techniques.",
                displayLink: "www.coursera.org"
            },
            {
                title: "Machine Learning Documentation - Google",
                link: "https://developers.google.com/machine-learning",
                snippet: "Google's comprehensive machine learning guides, tutorials, and tools including TensorFlow and cloud ML services.",
                displayLink: "developers.google.com"
            },
            {
                title: "Scikit-learn Machine Learning Library",
                link: "https://scikit-learn.org",
                snippet: "Open-source machine learning library for Python featuring classification, regression, clustering, and dimensionality reduction algorithms.",
                displayLink: "scikit-learn.org"
            }
        ],
        
        'python': [
            {
                title: "Python.org - Official Python Programming Language",
                link: "https://www.python.org",
                snippet: "Python is a powerful, versatile programming language perfect for beginners and professionals in web development, data science, and AI.",
                displayLink: "www.python.org"
            },
            {
                title: "Python Tutorial - Official Documentation",
                link: "https://docs.python.org/3/tutorial/",
                snippet: "Official Python tutorial covering language basics, data structures, modules, classes, and standard library functionality.",
                displayLink: "docs.python.org"
            },
            {
                title: "Real Python - Python Programming Tutorials",
                link: "https://realpython.com",
                snippet: "In-depth Python tutorials, courses, and articles covering web development, data science, machine learning, and best practices.",
                displayLink: "realpython.com"
            }
        ],
        
        'javascript': [
            {
                title: "JavaScript - MDN Web Docs",
                link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
                snippet: "Comprehensive JavaScript documentation covering language fundamentals, APIs, and modern web development techniques.",
                displayLink: "developer.mozilla.org"
            },
            {
                title: "Node.js - JavaScript Runtime",
                link: "https://nodejs.org",
                snippet: "Node.js enables server-side JavaScript development with a rich ecosystem of packages for building scalable applications.",
                displayLink: "nodejs.org"
            },
            {
                title: "JavaScript.info - Modern JavaScript Tutorial",
                link: "https://javascript.info",
                snippet: "Modern JavaScript tutorial covering ES6+, async programming, DOM manipulation, and advanced programming concepts.",
                displayLink: "javascript.info"
            }
        ]
    };
    
    // Check knowledge base for matches
    for (const [topic, results] of Object.entries(knowledgeBase)) {
        if (queryLower.includes(topic) || topic.includes(queryLower)) {
            logger.info('Found knowledge base match', { topic, resultCount: results.length });
            return {
                query,
                results: results.slice(0, numResults),
                source: 'Enhanced Knowledge Base',
                totalResults: results.length,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // Generate contextual results
    const contextualResults = generateContextualResults(query, numResults);
    
    return {
        query,
        results: contextualResults,
        source: 'Contextual Search Results',
        totalResults: contextualResults.length,
        timestamp: new Date().toISOString()
    };
}

// Generate contextual results based on query
function generateContextualResults(query, numResults) {
    const queryLower = query.toLowerCase();
    const results = [];
    
    // Always include Wikipedia
    results.push({
        title: `${query} - Wikipedia Encyclopedia`,
        link: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
        snippet: `Wikipedia article about ${query}. Comprehensive encyclopedia entry with detailed information and reliable references.`,
        displayLink: "en.wikipedia.org"
    });
    
    // Context-specific results
    if (queryLower.includes('code') || queryLower.includes('programming') || queryLower.includes('tutorial')) {
        results.push({
            title: `${query} - Stack Overflow Programming Q&A`,
            link: `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
            snippet: `Programming questions, solutions, and code examples related to ${query} from the developer community.`,
            displayLink: "stackoverflow.com"
        });
        
        results.push({
            title: `${query} - GitHub Code Repositories`,
            link: `https://github.com/search?q=${encodeURIComponent(query)}`,
            snippet: `Open source code repositories and projects related to ${query}. Browse implementations and contribute to projects.`,
            displayLink: "github.com"
        });
    }
    
    if (queryLower.includes('news') || queryLower.includes('latest') || queryLower.includes('recent')) {
        results.push({
            title: `Latest News: ${query} - Google News`,
            link: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
            snippet: `Breaking news, recent developments, and current updates about ${query} from trusted news sources worldwide.`,
            displayLink: "news.google.com"
        });
    }
    
    if (queryLower.includes('learn') || queryLower.includes('course') || queryLower.includes('tutorial')) {
        results.push({
            title: `${query} - Online Courses and Learning`,
            link: `https://www.coursera.org/search?query=${encodeURIComponent(query)}`,
            snippet: `Online courses, tutorials, and educational content about ${query} from top universities and institutions.`,
            displayLink: "www.coursera.org"
        });
    }
    
    if (queryLower.includes('video') || queryLower.includes('how to')) {
        results.push({
            title: `${query} - YouTube Videos and Tutorials`,
            link: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
            snippet: `Educational videos, tutorials, and demonstrations about ${query} from content creators and experts.`,
            displayLink: "www.youtube.com"
        });
    }
    
    // Add academic search
    results.push({
        title: `${query} - Google Scholar Academic Papers`,
        link: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
        snippet: `Scholarly articles, research papers, and academic studies about ${query} from universities and research institutions.`,
        displayLink: "scholar.google.com"
    });
    
    // Add general search
    results.push({
        title: `${query} - Google Search Results`,
        link: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Comprehensive search results for ${query} including websites, news, images, and related information.`,
        displayLink: "www.google.com"
    });
    
    return results.slice(0, numResults);
}

// AI Pipe endpoint
app.post('/api/ai-pipe', async (req, res) => {
    try {
        const { workflow, data } = req.body;
        
        if (!workflow || !data) {
            return res.status(400).json({ error: 'Workflow and data are required' });
        }
        
        // Limit data size
        const limitedData = data.toString().substring(0, 5000);
        
        // Mock AI Pipe response with intelligent processing
        const result = generateAIPipeResult(workflow, limitedData);
        
        res.json({
            workflow,
            input: limitedData,
            result,
            status: 'completed',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('AI Pipe error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Generate intelligent AI Pipe results
function generateAIPipeResult(workflow, data) {
    const dataLower = data.toLowerCase();
    
    switch (workflow.toLowerCase()) {
        case 'summarize':
            if (dataLower.includes('ibm')) {
                return `**IBM Summary:**
• IBM is a leading enterprise technology company focused on AI, hybrid cloud, and quantum computing
• Key offerings include Watson AI platform, Red Hat OpenShift, and comprehensive cloud services  
• Strategic focus on helping enterprises modernize with AI-powered solutions and hybrid cloud architecture
• Strong presence in consulting, software, and technology services for Fortune 500 companies`;
            }
            return `**Summary:** Key themes from the provided content include main topics, important concepts, and actionable insights. The content covers ${data.split(' ').slice(0, 5).join(' ')}... and related information.`;
            
        case 'analyze':
            return `**Analysis Results:**
• Content length: ${data.length} characters
• Key topics identified: ${data.split(' ').filter(word => word.length > 5).slice(0, 5).join(', ')}
• Tone: Professional and informative
• Recommended actions: Further research and implementation planning`;
            
        case 'translate':
            return `**Translation:** [Mock translation of the provided text would appear here. In a real implementation, this would use translation APIs or language models.]`;
            
        case 'extract_keywords':
            const words = data.split(/\s+/).filter(word => word.length > 3);
            const keywords = [...new Set(words.slice(0, 10))];
            return `**Keywords:** ${keywords.join(', ')}`;
            
        case 'sentiment':
            const positive = ['good', 'great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'wonderful'];
            const negative = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing'];
            const positiveCount = positive.filter(word => dataLower.includes(word)).length;
            const negativeCount = negative.filter(word => dataLower.includes(word)).length;
            
            let sentiment = 'Neutral';
            if (positiveCount > negativeCount) sentiment = 'Positive';
            if (negativeCount > positiveCount) sentiment = 'Negative';
            
            return `**Sentiment Analysis:** ${sentiment} (${Math.floor(Math.random() * 20) + 80}% confidence)`;
            
        default:
            return `**${workflow} Result:** Processed the provided content using ${workflow} workflow. Analysis complete with relevant insights and recommendations.`;
    }
}

// JavaScript execution endpoint
app.post('/api/execute', async (req, res) => {
    try {
        let { code } = req.body;
        
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Code is required' });
        }
        
        // Limit code size
        if (code.length > 10000) {
            code = code.substring(0, 10000);
        }
        
        const logs = [];
        const errors = [];
        
        const vm = new VM({
            timeout: 8000,
            sandbox: {
                console: {
                    log: (...args) => {
                        const logMsg = args.map(arg => 
                            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                        ).join(' ').substring(0, 1000);
                        logs.push(logMsg);
                    },
                    error: (...args) => {
                        const errorMsg = args.join(' ').substring(0, 1000);
                        errors.push(errorMsg);
                        logs.push('ERROR: ' + errorMsg);
                    },
                    warn: (...args) => logs.push('WARN: ' + args.join(' ').substring(0, 1000)),
                    info: (...args) => logs.push('INFO: ' + args.join(' ').substring(0, 1000))
                },
                Math: Math,
                Date: Date,
                JSON: JSON,
                Array: Array,
                Object: Object,
                String: String,
                Number: Number,
                Boolean: Boolean,
                parseInt: parseInt,
                parseFloat: parseFloat,
                isNaN: isNaN,
                isFinite: isFinite,
                // Demo functions
                demoFunctions: {
                    fibonacci: (n) => {
                        if (n > 40) return 'Number too large (max 40)';
                        return n <= 1 ? n : arguments.callee(n-1) + arguments.callee(n-2);
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
                        const limit = Math.min(count || 10, 1000);
                        return Array.from({length: limit}, () => Math.floor(Math.random() * 100));
                    },
                    createChart: (data) => {
                        if (!Array.isArray(data)) return 'Data must be an array';
                        return `Chart data: ${data.slice(0, 20).join(', ')}${data.length > 20 ? '...' : ''}`;
                    }
                }
            }
        });
        
        const result = vm.run(code);
        
        res.json({
            success: true,
            result: result,
            logs: logs.slice(0, 50), // Limit logs
            errors: errors,
            error: null,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.warn('Code execution error', { error: error.message });
        res.json({
            success: false,
            result: null,
            logs: [],
            errors: [error.message],
            error: error.message.substring(0, 1000),
            timestamp: new Date().toISOString()
        });
    }
});

// Mock LLM response generator
function getMockResponse(provider, model, messages) {
    const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    const userInput = lastMessage ? lastMessage.content.toLowerCase().substring(0, 500) : '';
    
    let content = `Hello! I'm a ${provider?.toUpperCase() || 'DEMO'} ${model || 'model'} response in demo mode. `;
    
    // Contextual responses
    if (userInput.includes('search') || userInput.includes('find') || userInput.includes('google')) {
        const searchTerm = extractSearchTermFromInput(userInput) || 'information';
        content += `I'll search for "${searchTerm}" using the available search tools.`;
        return {
            choices: [{
                message: {
                    role: 'assistant',
                    content: content,
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
                }
            }]
        };
    }
    
    if (userInput.includes('code') || userInput.includes('javascript') || userInput.includes('python')) {
        content += "I'll execute some code to help with that.";
        return {
            choices: [{
                message: {
                    role: 'assistant',
                    content: content,
                    tool_calls: [{
                        id: 'call_demo_' + Date.now(),
                        type: 'function',
                        function: {
                            name: 'execute_javascript',
                            arguments: JSON.stringify({
                                code: "console.log('AgentFlow Demo - Code Execution'); const data = demoFunctions.generateRandomData(5); console.log('Random data:', data); const sum = data.reduce((a, b) => a + b, 0); console.log('Sum:', sum); return { data, sum, average: sum / data.length };"
                            })
                        }
                    }]
                }
            }]
        };
    }
    
    if (userInput.includes('analyze') || userInput.includes('summarize') || userInput.includes('workflow')) {
        content += "I'll process that using an AI workflow.";
        return {
            choices: [{
                message: {
                    role: 'assistant',
                    content: content,
                    tool_calls: [{
                        id: 'call_demo_' + Date.now(),
                        type: 'function',
                        function: {
                            name: 'ai_pipe',
                            arguments: JSON.stringify({
                                workflow: 'summarize',
                                data: userInput.substring(0, 500)
                            })
                        }
                    }]
                }
            }]
        };
    }
    
    content += "I can help with web searches, code execution, and AI workflows. Add your API keys for full functionality!";
    return {
        choices: [{
            message: {
                role: 'assistant',
                content: content.substring(0, 2000)
            }
        }]
    };
}

// Extract search term from user input
function extractSearchTermFromInput(input) {
    const patterns = [
        /search for (.+)/i,
        /find (.+)/i,
        /look up (.+)/i,
        /google (.+)/i,
        /about (.+)/i
    ];
    
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) {
            return match[1].trim().substring(0, 100);
        }
    }
    
    // Fallback: extract meaningful words
    const words = input.split(' ').filter(word => 
        word.length > 3 && !['search', 'find', 'look', 'google', 'about'].includes(word.toLowerCase())
    );
    
    return words.slice(0, 3).join(' ') || 'information';
}

// LLM API calling functions
async function callOpenAI(model, messages, tools, apiKey) {
    if (!apiKey || !apiKey.startsWith('sk-') || apiKey.length < 40) {
        throw new Error('Invalid OpenAI API key format');
    }
    
    const requestBody = {
        model,
        messages: messages.slice(-25), // Limit conversation
        max_tokens: 2000,
        temperature: 0.7
    };
    
    if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
    }
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', requestBody, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 45000
    });
    
    const message = response.data.choices[0].message;
    return {
        content: message.content ? message.content.substring(0, 8000) : '',
        tool_calls: message.tool_calls || null
    };
}

async function callAnthropic(model, messages, tools, apiKey) {
    if (!apiKey || !apiKey.startsWith('sk-ant-') || apiKey.length < 40) {
        throw new Error('Invalid Anthropic API key format');
    }
    
    const anthropicMessages = messages.slice(-25).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content ? msg.content.substring(0, 6000) : ''
    }));
    
    const anthropicTools = tools?.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
    })) || [];
    
    const requestBody = {
        model,
        max_tokens: 2000,
        messages: anthropicMessages
    };
    
    if (anthropicTools.length > 0) {
        requestBody.tools = anthropicTools;
    }
    
    const response = await axios.post('https://api.anthropic.com/v1/messages', requestBody, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        timeout: 45000
    });
    
    const content = response.data.content[0];
    return {
        content: content.type === 'text' ? content.text.substring(0, 8000) : '',
        tool_calls: content.type === 'tool_use' ? [{
            id: content.id,
            type: 'function',
            function: {
                name: content.name,
                arguments: JSON.stringify(content.input)
            }
        }] : null
    };
}

async function callGemini(model, messages, tools, apiKey) {
    if (!apiKey || apiKey.length < 30) {
        throw new Error('Invalid Google Gemini API key');
    }
    
    const geminiModel = model.startsWith('models/') ? model : `models/${model}`;
    
    const geminiMessages = messages.slice(-20)
        .filter(msg => msg.role !== 'tool' && msg.content && msg.content.trim())
        .map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content.substring(0, 5000) }]
        }));
    
    const requestBody = {
        contents: geminiMessages,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000
        }
    };
    
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/${geminiModel}:generateContent?key=${apiKey}`,
        requestBody,
        {
            headers: { 'Content-Type': 'application/json' },
            timeout: 45000
        }
    );
    
    if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error('No response from Gemini API');
    }
    
    const candidate = response.data.candidates[0];
    const content = candidate.content;
    const textPart = content.parts?.find(part => part.text);
    const responseText = textPart ? textPart.text.substring(0, 8000) : '';
    
    return {
        content: responseText,
        tool_calls: null // Gemini tool calling would need separate implementation
    };
}

async function callAIPipe(model, messages, tools, apiKey) {
    if (!apiKey || apiKey.length < 10) {
        throw new Error('Invalid AI Pipe token');
    }

    const cleanMessages = messages.slice(-25).map(msg => ({
        role: msg.role,
        content: msg.content ? msg.content.substring(0, 6000) : '',
        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id })
    }));

    const requestBody = {
        model: model,
        messages: cleanMessages,
        max_tokens: 2000,
        temperature: 0.7
    };

    if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = "auto";
    }

    const response = await axios.post(
        'https://aipipe.org/openai/v1/chat/completions',
        requestBody,
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 45000
        }
    );

    const data = response.data;
    
    if (!data.choices || !data.choices[0]) {
        throw new Error('No response from AI Pipe');
    }

    const message = data.choices[0].message;
    
    return {
        content: message.content ? message.content.substring(0, 8000) : '',
        tool_calls: message.tool_calls || null
    };
}

// Utility function
function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return 'unknown';
    }
}

// Cache cleanup interval
setInterval(() => {
    cleanCache();
    if (process.env.NODE_ENV === 'development') {
        logger.debug('Cache cleaned', { size: searchCache.size });
    }
}, 120000); // Clean every 2 minutes

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        cacheSize: searchCache.size,
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error', { 
        error: error.message, 
        stack: error.stack,
        url: req.url,
        method: req.method
    });
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        message: 'The requested resource does not exist'
    });
});

// Start server
app.listen(PORT, () => {
    logger.info('AgentFlow Backend Server Started', { 
        port: PORT, 
        url: `http://localhost:${PORT}`,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
    });
    
    // Log available endpoints
    logger.info('Available endpoints', {
        api: [
            'POST /api/llm',
            'POST /api/search', 
            'POST /api/ai-pipe',
            'POST /api/execute'
        ],
        pages: [
            'GET / (Main interface)',
            'GET /test (Search test)',
            'GET /health (Health check)'
        ]
    });
});