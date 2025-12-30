document.addEventListener('DOMContentLoaded', () => {
    
    // --- Matrix Rain Animation ---
    const canvas = document.getElementById('matrix-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        
        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        const columns = Math.floor(width / 20);
        const drops = [];
        for (let i = 0; i < columns; i++) {
            drops[i] = 1;
        }

        const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        
        function drawMatrix() {
            ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
            ctx.fillRect(0, 0, width, height);
            
            ctx.fillStyle = "#00FF41"; // Neon green
            ctx.font = "15px monospace";
            
            for (let i = 0; i < drops.length; i++) {
                const text = letters[Math.floor(Math.random() * letters.length)];
                ctx.fillText(text, i * 20, drops[i] * 20);
                
                if (drops[i] * 20 > height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        }
        
        setInterval(drawMatrix, 50);
    }

    // --- Mobile Menu ---
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.textContent = nav.classList.contains('active') ? '✕' : '☰';
        });

        // Close menu when clicking a link
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                menuToggle.textContent = '☰';
            });
        });
    }

    // --- Playground Logic (REAL API INTEGRATION) ---
    
    // UI Elements
    const fileInput = document.getElementById('file-input');
    const uploadZone = document.getElementById('upload-zone');
    const previewImage = document.getElementById('preview-image');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const loadingState = document.getElementById('loading-state');
    const resultFinal = document.getElementById('result-final');
    const resultPlaceholder = document.querySelector('.result-placeholder');
    const downloadBtn = document.getElementById('download-btn');
    const uploadContent = document.querySelector('.upload-content');
    const resultContainer = document.getElementById('result-container') || document.querySelector('.result-display');
    const statusText = document.getElementById('status-text') || document.querySelector('.status-text');

    // API Configuration
    const USER_ID = 'DObRu1vyStbUynoQmTcHBlhs55z2';
    const EFFECT_ID = 'mugshot';
    
    // Global State
    let currentUploadedUrl = null;

    // --- Helper Functions ---

    // Generate nanoid for unique filename
    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Manage Loading State
    function showLoading() {
        if (loadingState) {
            loadingState.classList.remove('hidden');
            loadingState.style.display = 'flex'; // Ensure centering
        }
        if (resultPlaceholder) resultPlaceholder.classList.add('hidden');
        if (resultFinal) resultFinal.classList.add('hidden');
        if (downloadBtn) downloadBtn.classList.add('hidden');
        if (resultContainer) resultContainer.classList.add('loading');
    }

    function hideLoading() {
        if (loadingState) {
            loadingState.classList.add('hidden');
            loadingState.style.display = 'none';
        }
        if (resultContainer) resultContainer.classList.remove('loading');
    }

    // Update Status Text
    function updateStatus(text) {
        if (statusText) statusText.textContent = text;
        
        // Update button text to reflect status
        if (generateBtn) {
            if (text.includes('PROCESSING') || text.includes('UPLOADING') || text.includes('SUBMITTING')) {
                generateBtn.disabled = true;
                generateBtn.textContent = text;
            } else if (text === 'READY') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'GENERATE MUGSHOT';
            } else if (text === 'COMPLETE') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'GENERATE AGAIN';
            }
        }
    }

    // Error Handler
    function showError(msg) {
        alert('Error: ' + msg);
        updateStatus('ERROR');
    }

    // Show Upload Preview
    function showPreview(url) {
        if (previewImage) {
            previewImage.src = url;
            previewImage.classList.remove('hidden');
            previewImage.style.display = 'block';
        }
        if (uploadContent) uploadContent.classList.add('hidden');
    }

    // Show Final Result
    function showResultMedia(url) {
        if (resultFinal) {
            // Add cache buster to prevent stale image loading
            resultFinal.src = url + '?t=' + new Date().getTime(); 
            resultFinal.classList.remove('hidden');
            resultFinal.style.display = 'block';
            resultFinal.style.filter = 'none'; // Ensure no CSS filters interfere
            
            // Check for video URL just in case, though this is image effect
            if (url.match(/\.(mp4|webm)/i)) {
                console.warn('Received video URL for image effect');
            }
        }
    }

    // --- API Interactions ---

    // 1. Upload file to CDN storage
    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        const fileName = uniqueId + '.' + fileExtension;
        
        // Get signed URL
        const signedUrlResponse = await fetch(
            'https://api.chromastudio.ai/get-emd-upload-url?fileName=' + encodeURIComponent(fileName),
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get signed URL: ' + signedUrlResponse.statusText);
        }
        
        const signedUrl = await signedUrlResponse.text();
        console.log('Got signed URL');
        
        // PUT file to signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file: ' + uploadResponse.statusText);
        }
        
        // Return public URL
        const downloadUrl = 'https://contents.maxstudio.ai/' + fileName;
        console.log('Uploaded to:', downloadUrl);
        return downloadUrl;
    }

    // 2. Submit generation job
    async function submitImageGenJob(imageUrl) {
        const endpoint = 'https://api.chromastudio.ai/image-gen';
        
        const body = {
            model: 'image-effects',
            toolType: 'image-effects',
            effectId: EFFECT_ID,
            imageUrl: imageUrl,
            userId: USER_ID,
            removeWatermark: true,
            isPrivate: true
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        const data = await response.json();
        console.log('Job submitted:', data.jobId);
        return data;
    }

    // 3. Poll job status
    async function pollJobStatus(jobId) {
        const baseUrl = 'https://api.chromastudio.ai/image-gen';
        const POLL_INTERVAL = 2000;
        const MAX_POLLS = 60; // 2 minutes max
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `${baseUrl}/${USER_ID}/${jobId}/status`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json, text/plain, */*' }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to check status: ' + response.statusText);
            }
            
            const data = await response.json();
            console.log('Poll', polls + 1, '- Status:', data.status);
            
            if (data.status === 'completed') {
                return data;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            // Update UI progress
            updateStatus('PROCESSING... ' + Math.min(99, Math.floor(((polls + 1) / 10) * 100)) + '%');
            
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out');
    }

    // --- Logic Handlers ---

    // Handle File Selection (Auto-Upload)
    async function handleFileSelect(file) {
        if (!file) return;

        try {
            if (resetBtn) resetBtn.disabled = false;
            
            // Show local preview immediately
            const reader = new FileReader();
            reader.onload = (e) => showPreview(e.target.result);
            reader.readAsDataURL(file);
            
            // Disable generate until upload completes
            if (generateBtn) generateBtn.disabled = true;
            updateStatus('UPLOADING...');
            
            // Perform Upload
            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            updateStatus('READY');
            
        } catch (error) {
            console.error(error);
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // Handle Generate Click
    async function handleGenerate() {
        if (!currentUploadedUrl) return;
        
        try {
            showLoading();
            updateStatus('SUBMITTING JOB...');
            
            // 1. Submit Job
            const jobData = await submitImageGenJob(currentUploadedUrl);
            
            // 2. Poll for Status
            updateStatus('PROCESSING...');
            const result = await pollJobStatus(jobData.jobId);
            
            // 3. Extract Result URL
            const resultItem = Array.isArray(result.result) ? result.result[0] : result.result;
            const resultUrl = resultItem?.image || resultItem?.mediaUrl;
            
            if (!resultUrl) throw new Error('No image URL in response');
            
            console.log('Result URL:', resultUrl);
            
            // 4. Display Result
            showResultMedia(resultUrl);
            hideLoading();
            
            if (downloadBtn) {
                downloadBtn.classList.remove('hidden');
                downloadBtn.style.display = 'inline-block';
                downloadBtn.dataset.url = resultUrl;
            }
            
            updateStatus('COMPLETE');
            
        } catch (error) {
            hideLoading();
            console.error(error);
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // --- Wiring Event Listeners ---

    // File Input Change
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFileSelect(file);
        });
    }

    // Drag & Drop Zone
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
            uploadZone.style.borderColor = 'var(--primary)';
            uploadZone.style.boxShadow = '0 0 10px var(--primary)';
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            uploadZone.style.borderColor = 'var(--border-color)';
            uploadZone.style.boxShadow = 'none';
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            uploadZone.style.borderColor = 'var(--border-color)';
            uploadZone.style.boxShadow = 'none';
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        });
        
        uploadZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }

    // Generate Button
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentUploadedUrl = null;
            if (fileInput) fileInput.value = '';
            
            if (previewImage) {
                previewImage.src = '';
                previewImage.classList.add('hidden');
                previewImage.style.display = 'none';
            }
            
            if (uploadContent) uploadContent.classList.remove('hidden');
            
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'GENERATE MUGSHOT';
            }
            
            if (resetBtn) resetBtn.disabled = true;
            
            if (resultPlaceholder) resultPlaceholder.classList.remove('hidden');
            if (resultFinal) {
                resultFinal.classList.add('hidden');
                resultFinal.src = '';
            }
            if (loadingState) {
                loadingState.classList.add('hidden');
                loadingState.style.display = 'none';
            }
            if (downloadBtn) downloadBtn.classList.add('hidden');
            
            if (statusText) statusText.textContent = '';
        });
    }

    // Download Button (Robust Fetch Implementation)
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const url = downloadBtn.dataset.url;
            if (!url) return;
            
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Downloading...';
            downloadBtn.style.pointerEvents = 'none';
            
            try {
                // FORCE DOWNLOAD via Blob
                const fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
                const response = await fetch(fetchUrl, {
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                if (!response.ok) throw new Error('Network error');
                
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `mugshot_result_${generateNanoId(8)}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Cleanup
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                
            } catch (err) {
                console.error('Download error:', err);
                // Fallback to open in new tab
                alert('Direct download failed. Opening in new tab.');
                window.open(url, '_blank');
            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.style.pointerEvents = 'auto';
            }
        });
    }

    // --- FAQ Accordion ---
    const faqs = document.querySelectorAll('.faq-question');
    faqs.forEach(faq => {
        faq.addEventListener('click', () => {
            faq.classList.toggle('active');
            const answer = faq.nextElementSibling;
            if (faq.classList.contains('active')) {
                answer.style.maxHeight = answer.scrollHeight + "px";
            } else {
                answer.style.maxHeight = null;
            }
        });
    });

    // --- Modals ---
    const modalTriggers = document.querySelectorAll('[data-modal-target]');
    const modalClosers = document.querySelectorAll('[data-modal-close]');
    
    function openModal(modalId) {
        const modal = document.getElementById(modalId + '-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeModal(modal) {
        modal.classList.add('hidden');
    }

    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const target = trigger.getAttribute('data-modal-target');
            openModal(target);
        });
    });

    modalClosers.forEach(closer => {
        closer.addEventListener('click', () => {
            const modal = closer.closest('.modal');
            closeModal(modal);
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // --- Scroll Animations ---
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
});