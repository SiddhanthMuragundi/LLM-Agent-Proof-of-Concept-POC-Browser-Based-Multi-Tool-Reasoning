<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Presentation Generator</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 300;
        }

        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }

        .main-content {
            padding: 40px;
        }

        .step {
            margin-bottom: 40px;
            padding: 30px;
            border: 2px solid #f0f0f0;
            border-radius: 15px;
            transition: all 0.3s ease;
        }

        .step.active {
            border-color: #667eea;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.1);
        }

        .step-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }

        .step-number {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #667eea;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
        }

        .step-title {
            font-size: 1.5em;
            color: #333;
        }

        .form-group {
            margin-bottom: 25px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #555;
        }

        .form-control {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }

        .form-control:focus {
            outline: none;
            border-color: #667eea;
        }

        textarea.form-control {
            min-height: 200px;
            resize: vertical;
            font-family: inherit;
        }

        .file-upload {
            border: 3px dashed #e0e0e0;
            border-radius: 10px;
            padding: 40px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .file-upload:hover {
            border-color: #667eea;
            background: #f8f9ff;
        }

        .file-upload.dragover {
            border-color: #667eea;
            background: #f0f4ff;
        }

        .file-upload-icon {
            font-size: 3em;
            margin-bottom: 15px;
            color: #ccc;
        }

        .file-upload.has-file {
            border-color: #4caf50;
            background: #f0fff0;
        }

        .file-upload.has-file .file-upload-icon {
            color: #4caf50;
        }

        .btn {
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
        }

        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .progress-container {
            margin: 30px 0;
            display: none;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #f0f0f0;
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 0%;
            transition: width 0.3s ease;
        }

        .progress-text {
            text-align: center;
            margin-top: 10px;
            color: #666;
            font-weight: 500;
        }

        .preview-container {
            margin-top: 30px;
            display: none;
        }

        .slide-preview {
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            background: #fafafa;
        }

        .slide-title {
            font-size: 1.3em;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }

        .slide-content {
            color: #666;
            line-height: 1.6;
        }

        .error-message {
            background: #ffebee;
            color: #c62828;
            padding: 15px;
            border-radius: 10px;
            margin-top: 15px;
            display: none;
        }

        .success-message {
            background: #e8f5e8;
            color: #2e7d2e;
            padding: 15px;
            border-radius: 10px;
            margin-top: 15px;
            display: none;
        }

        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }

        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
            
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 2em;
            }
            
            .main-content {
                padding: 20px;
            }
        }

        .api-provider {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }

        .api-provider input[type="radio"] {
            margin-right: 5px;
        }

        .tooltip {
            position: relative;
            display: inline-block;
            cursor: help;
            margin-left: 5px;
        }

        .tooltip .tooltiptext {
            visibility: hidden;
            width: 200px;
            background-color: #555;
            color: #fff;
            text-align: center;
            border-radius: 6px;
            padding: 5px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            margin-left: -100px;
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 12px;
        }

        .tooltip:hover .tooltiptext {
            visibility: visible;
            opacity: 1;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 AI Presentation Generator</h1>
            <p>Transform your text into professional presentations with AI-powered content structuring</p>
        </div>

        <div class="main-content">
            <!-- Step 1: Text Input -->
            <div class="step active" id="step1">
                <div class="step-header">
                    <div class="step-number">1</div>
                    <div class="step-title">Input Your Content</div>
                </div>
                
                <div class="form-group">
                    <label for="inputText">Paste your text, markdown, or prose:</label>
                    <textarea 
                        id="inputText" 
                        class="form-control" 
                        placeholder="Paste your content here... This could be a research paper, meeting notes, documentation, or any long-form text you want to convert into a presentation."
                    ></textarea>
                </div>

                <div class="form-group">
                    <label for="guidance">
                        Presentation Guidance (Optional)
                        <span class="tooltip">ℹ️
                            <span class="tooltiptext">Describe the tone, structure, or use case. e.g., "investor pitch deck", "technical training", "sales presentation"</span>
                        </span>
                    </label>
                    <input 
                        type="text" 
                        id="guidance" 
                        class="form-control" 
                        placeholder="e.g., 'turn into an investor pitch deck' or 'make it a technical training presentation'"
                    />
                </div>
            </div>

            <!-- Step 2: API Configuration -->
            <div class="step" id="step2">
                <div class="step-header">
                    <div class="step-number">2</div>
                    <div class="step-title">Configure AI Provider</div>
                </div>

                <div class="form-group">
                    <label>Choose your AI provider:</label>
                    <div class="api-provider">
                        <input type="radio" id="openai" name="provider" value="openai" checked>
                        <label for="openai">OpenAI (GPT-4)</label>
                    </div>
                    <div class="api-provider">
                        <input type="radio" id="anthropic" name="provider" value="anthropic">
                        <label for="anthropic">Anthropic (Claude)</label>
                    </div>
                    <div class="api-provider">
                        <input type="radio" id="gemini" name="provider" value="gemini">
                        <label for="gemini">Google (Gemini)</label>
                    </div>
                    <div class="api-provider">
                        <input type="radio" id="aipipe" name="provider" value="aipipe">
                        <label for="aipipe">AI Pipe (OpenAI Models)</label>
                    </div>
                </div>

                <div class="form-group">
                    <label for="apiKey">
                        API Key
                        <span class="tooltip">🔒
                            <span class="tooltiptext">Your API key is never stored or logged. It's only used for this session.</span>
                        </span>
                    </label>
                    <input 
                        type="password" 
                        id="apiKey" 
                        class="form-control" 
                        placeholder="Enter your API key (never stored or logged)"
                    />
                </div>
            </div>

            <!-- Step 3: Template Upload (Optional) -->
            <div class="step" id="step3">
                <div class="step-header">
                    <div class="step-number">3</div>
                    <div class="step-title">Upload Template (Optional)</div>
                </div>

                <div class="form-group">
                    <label>PowerPoint Template (.pptx or .potx) - Optional:</label>
                    <div class="file-upload" id="templateUpload">
                        <div class="file-upload-icon">📎</div>
                        <div class="file-upload-text">
                            <strong>Click to upload</strong> or drag and drop your template
                            <br><small>Optional: Upload to customize styling, or use default template</small>
                        </div>
                        <input type="file" id="templateFile" accept=".pptx,.potx" style="display: none;">
                    </div>
                    <div id="templateInfo" style="margin-top: 10px; display: none;"></div>
                    
                    <!-- Placeholder Instructions -->
                    <div class="placeholder-info" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #007bff;">
                        <h4 style="color: #007bff; margin-bottom: 10px;">💡 How to use templates:</h4>
                        <p style="margin-bottom: 8px;"><strong>Option 1:</strong> Upload any PowerPoint template - content will replace default text</p>
                        <p style="margin-bottom: 8px;"><strong>Option 2:</strong> Add placeholders to your template for precise control:</p>
                        <ul style="margin-left: 20px; color: #666;">
                            <li><code>{{TITLE}}</code> or <code>[TITLE]</code> - Will be replaced with slide titles</li>
                            <li><code>{{CONTENT}}</code> or <code>[CONTENT]</code> - Will be replaced with slide content</li>
                        </ul>
                        <p style="margin-top: 8px; font-size: 0.9em; color: #666;">
                            Your template's backgrounds, images, colors, and formatting will be preserved!
                        </p>
                    </div>
                </div>
            </div>

            <!-- Generate Button -->
            <div style="text-align: center; margin: 40px 0;">
                <button class="btn btn-primary" id="generateBtn" onclick="generatePresentation()">
                    🚀 Generate Presentation
                </button>
            </div>

            <!-- Progress -->
            <div class="progress-container" id="progressContainer">
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <div class="progress-text" id="progressText">Initializing...</div>
            </div>

            <!-- Preview -->
            <div class="preview-container" id="previewContainer">
                <h3>📋 Slide Preview</h3>
                <div id="slidesPreviews"></div>
            </div>

            <!-- Messages -->
            <div class="error-message" id="errorMessage"></div>
            <div class="success-message" id="successMessage"></div>
        </div>
    </div>

    <script>
        let templateFile = null;
        let slidesData = null;
        let templateData = null;

        // File upload handling
        document.getElementById('templateUpload').addEventListener('click', () => {
            document.getElementById('templateFile').click();
        });

        document.getElementById('templateFile').addEventListener('change', handleTemplateUpload);

        // Drag and drop
        const uploadArea = document.getElementById('templateUpload');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleTemplateFile(files[0]);
            }
        });

        function handleTemplateUpload(e) {
            const file = e.target.files[0];
            handleTemplateFile(file);
        }

        function handleTemplateFile(file) {
            if (!file) return;

            const validTypes = ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 
                               'application/vnd.openxmlformats-officedocument.presentationml.template'];
            
            if (!validTypes.includes(file.type) && !file.name.endsWith('.pptx') && !file.name.endsWith('.potx')) {
                showError('Please upload a valid PowerPoint file (.pptx or .potx)');
                return;
            }

            templateFile = file;
            
            // Update UI
            const uploadArea = document.getElementById('templateUpload');
            uploadArea.classList.add('has-file');
            uploadArea.querySelector('.file-upload-text').innerHTML = `
                <strong>✅ ${file.name}</strong><br>
                <small>${(file.size / 1024 / 1024).toFixed(1)} MB</small>
            `;

            document.getElementById('templateInfo').style.display = 'block';
            document.getElementById('templateInfo').innerHTML = `
                <small style="color: #666;">
                    Template loaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)
                </small>
            `;
        }

        async function generatePresentation() {
            const inputText = document.getElementById('inputText').value.trim();
            const guidance = document.getElementById('guidance').value.trim();
            const apiKey = document.getElementById('apiKey').value.trim();
            const provider = document.querySelector('input[name="provider"]:checked').value;

            // Validation
            if (!inputText) {
                showError('Please enter some text to convert into a presentation.');
                return;
            }

            if (!apiKey) {
                showError('Please enter your API key.');
                return;
            }

            // Template is now optional
            const hasTemplate = templateFile !== null;

            // Show progress
            showProgress('Generating your presentation...');
            document.getElementById('generateBtn').disabled = true;

            try {
                // Create FormData for file upload support
                updateProgress(20, 'Analyzing content with AI...');
                
                const formData = new FormData();
                formData.append('text', inputText);
                formData.append('guidance', guidance);
                formData.append('provider', provider);
                formData.append('apiKey', apiKey);
                
                // Add template file if provided (optional)
                if (hasTemplate && templateFile) {
                    formData.append('template', templateFile);
                    console.log('Template file added to request');
                }
                
                const response = await fetch('/api/generate-pptx', {
                    method: 'POST',
                    body: formData // Use FormData instead of JSON for file uploads
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
                }

                updateProgress(80, 'Generating PPTX file...');

                // Get the blob and download it
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'presentation.pptx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                updateProgress(100, 'Complete! Your presentation is downloading...');
                
                setTimeout(() => {
                    hideProgress();
                    showSuccess('✅ Presentation generated and downloaded successfully!');
                    document.getElementById('generateBtn').disabled = false;
                }, 1000);

            } catch (error) {
                console.error('Generation error:', error);
                hideProgress();
                showError(`Failed to generate presentation: ${error.message}`);
                document.getElementById('generateBtn').disabled = false;
            }
        }

        function showProgress(message) {
            document.getElementById('progressContainer').style.display = 'block';
            document.getElementById('progressText').textContent = message;
            document.getElementById('progressFill').style.width = '0%';
        }

        function updateProgress(percentage, message) {
            document.getElementById('progressFill').style.width = percentage + '%';
            document.getElementById('progressText').textContent = message;
        }

        function hideProgress() {
            document.getElementById('progressContainer').style.display = 'none';
        }

        function showError(message) {
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }

        function showSuccess(message) {
            const successDiv = document.getElementById('successMessage');
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 5000);
        }

        // Add some sample text for demo
        document.addEventListener('DOMContentLoaded', function() {
            const sampleText = ``;
            document.getElementById('inputText').value = sampleText;
        });
    </script>
</body>
</html>
