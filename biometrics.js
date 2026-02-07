// Biometric Simulation Module
class BiometricScanner {
    constructor() {
        this.fingerprintData = null;
        this.faceData = null;
        this.isCameraActive = false;
        this.videoStream = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Fingerprint scanner click
        document.getElementById('fingerprintScanner').addEventListener('click', (e) => {
            if (e.target.closest('.scanner-placeholder')) {
                this.captureFingerprint();
            }
        });

        // Face scanner click
        document.getElementById('faceScanner').addEventListener('click', (e) => {
            if (e.target.closest('.scanner-placeholder') && !this.isCameraActive) {
                this.startFaceCapture();
            }
        });
    }

    // Fingerprint Capture
    captureFingerprint() {
        const scanner = document.getElementById('fingerprintScanner');
        const placeholder = document.getElementById('fingerprintPlaceholder');
        const canvas = document.getElementById('fingerprintCanvas');
        const status = document.getElementById('fingerprintStatus');
        
        // Show loading
        placeholder.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>स्कैनिंग...</p>';
        
        setTimeout(() => {
            // Generate random fingerprint pattern
            canvas.style.display = 'block';
            canvas.width = scanner.clientWidth;
            canvas.height = scanner.clientHeight;
            
            const ctx = canvas.getContext('2d');
            
            // Draw fingerprint pattern
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw fingerprint lines
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const radius = 20 + Math.random() * 30;
                
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            // Hide placeholder
            placeholder.style.display = 'none';
            
            // Generate fingerprint data
            this.fingerprintData = {
                id: 'fp_' + Date.now(),
                pattern: this.generateFingerprintPattern(),
                timestamp: Date.now()
            };
            
            // Update status
            status.innerHTML = '<i class="fas fa-check-circle" style="color: #2ec27e;"></i> फिंगरप्रिंट सफलतापूर्वक स्कैन किया गया';
            
            showSuccess('फिंगरप्रिंट सफलतापूर्वक स्कैन किया गया');
                
        }, 1500);
    }

    // Clear fingerprint
    clearFingerprint() {
        const canvas = document.getElementById('fingerprintCanvas');
        const placeholder = document.getElementById('fingerprintPlaceholder');
        const status = document.getElementById('fingerprintStatus');
        
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.innerHTML = '<i class="fas fa-fingerprint"></i><p>अंगूठा यहां रखें</p>';
        status.innerHTML = 'स्कैन नहीं किया गया';
        
        this.fingerprintData = null;
        showInfo('फिंगरप्रिंट डेटा साफ किया गया');
    }

    // Start Face Capture
    async startFaceCapture() {
        if (this.isCameraActive) {
            this.stopFaceCapture();
            return;
        }
        
        const placeholder = document.getElementById('facePlaceholder');
        const video = document.getElementById('faceVideo');
        const status = document.getElementById('faceStatus');
        
        try {
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true,
                audio: false 
            });
            
            this.videoStream = stream;
            this.isCameraActive = true;
            
            // Show video
            video.style.display = 'block';
            video.srcObject = stream;
            placeholder.style.display = 'none';
            
            // Update status
            status.innerHTML = '<i class="fas fa-video" style="color: #1a5fb4;"></i> कैमरा सक्रिय - फोटो लेने के लिए क्लिक करें';
            
            // Update button text
            const startBtn = document.querySelector('[onclick="startFaceCapture()"]');
            if (startBtn) {
                startBtn.innerHTML = '<i class="fas fa-video-slash"></i> कैमरा बंद करें';
            }
            
            showInfo('कैमरा सक्रिय किया गया');
                
        } catch (error) {
            console.error('Camera error:', error);
            showError('कैमरा एक्सेस में समस्या: ' + error.message);
        }
    }

    // Capture Face Photo
    captureFace() {
        if (!this.isCameraActive) {
            showWarning('कृपया पहले कैमरा चालू करें');
            return;
        }
        
        const video = document.getElementById('faceVideo');
        const canvas = document.getElementById('faceCanvas');
        const placeholder = document.getElementById('facePlaceholder');
        const status = document.getElementById('faceStatus');
        
        // Create canvas and draw video frame
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Stop camera
        this.stopFaceCapture();
        
        // Show captured image
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'cover';
        
        // Generate face data
        this.faceData = {
            id: 'face_' + Date.now(),
            timestamp: Date.now(),
            features: this.generateFaceFeatures()
        };
        
        // Update status
        status.innerHTML = '<i class="fas fa-check-circle" style="color: #2ec27e;"></i> चेहरा सफलतापूर्वक कैप्चर किया गया';
        
        showSuccess('चेहरा सफलतापूर्वक कैप्चर किया गया');
    }

    // Stop Face Capture
    stopFaceCapture() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        
        this.isCameraActive = false;
        
        const video = document.getElementById('faceVideo');
        const placeholder = document.getElementById('facePlaceholder');
        const status = document.getElementById('faceStatus');
        
        video.style.display = 'none';
        video.srcObject = null;
        
        // Reset button text
        const startBtn = document.querySelector('[onclick="startFaceCapture()"]');
        if (startBtn) {
            startBtn.innerHTML = '<i class="fas fa-video"></i> कैमरा चालू करें';
        }
    }

    // Generate fingerprint pattern
    generateFingerprintPattern() {
        const pattern = [];
        for (let i = 0; i < 64; i++) {
            pattern.push(Math.random().toString(36).substr(2, 1));
        }
        return pattern.join('');
    }

    // Generate face features
    generateFaceFeatures() {
        const features = {
            eyeDistance: Math.random() * 50 + 40,
            noseLength: Math.random() * 30 + 20,
            mouthWidth: Math.random() * 40 + 30
        };
        return features;
    }

    // Get biometric data for submission
    getBiometricData() {
        return {
            fingerprint: this.fingerprintData,
            face: this.faceData,
            hasBiometrics: !!(this.fingerprintData || this.faceData)
        };
    }

    // Reset all biometric data
    reset() {
        this.clearFingerprint();
        this.stopFaceCapture();
        
        const faceCanvas = document.getElementById('faceCanvas');
        faceCanvas.style.display = 'none';
        
        const faceStatus = document.getElementById('faceStatus');
        faceStatus.innerHTML = 'कैप्चर नहीं किया गया';
        
        this.faceData = null;
    }
}

// Initialize biometric scanner globally
let biometricScanner;

document.addEventListener('DOMContentLoaded', function() {
    biometricScanner = new BiometricScanner();
});
