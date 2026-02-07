// LAPATA PORTAL v2.0 - Main Application File

// Global Variables
let currentTab = 'live-search';
let cameraStream = null;
let faceMatcher = null;
let storageManager = null;
let performanceMonitor = null;
let records = [];

// Initialize Application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 LAPATA PORTAL v2.0 Initializing...');
    
    // Initialize Components
    await initComponents();
    
    // Setup Event Listeners
    setupEventListeners();
    
    // Load Face API Models
    await loadFaceAPIModels();
    
    // Initialize Storage Manager
    storageManager = new StorageManager();
    
    // Initialize Performance Monitor
    performanceMonitor = new PerformanceMonitor();
    
    // Check Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(() => {
            console.log('✅ Service Worker Ready');
        });
    }
    
    console.log('✅ LAPATA PORTAL v2.0 Ready!');
});

// Initialize Components
async function initComponents() {
    // Load saved records from IndexedDB
    records = await storageManager.getAllRecords();
    
    // Update UI
    updateRecordCount();
    displayRecords(records);
    
    // Initialize tabs
    setupTabs();
}

// Setup Event Listeners
function setupEventListeners() {
    // Tab Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // Camera Controls
    document.getElementById('startCameraBtn').addEventListener('click', toggleCamera);
    document.getElementById('captureBtn').addEventListener('click', captureAndSearch);
    
    // Registration Form
    document.getElementById('registrationForm').addEventListener('submit', handleRegistration);
    
    // Database Search
    document.getElementById('searchDatabase').addEventListener('input', filterRecords);
    document.getElementById('refreshBtn').addEventListener('click', refreshDatabase);
    
    // Biometric Capture
    document.getElementById('faceImage').addEventListener('change', handleFaceImageUpload);
    document.getElementById('fingerprintImage').addEventListener('change', handleFingerprintUpload);
    
    // Emergency Contacts
    setupEmergencyContacts();
    
    // Network Status
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
}

// Load Face API Models
async function loadFaceAPIModels() {
    try {
        console.log('📦 Loading Face API Models...');
        
        // Load required models
        await faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models/face-api');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models/face-api');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models/face-api');
        await faceapi.nets.faceExpressionNet.loadFromUri('/assets/models/face-api');
        
        console.log('✅ Face API Models Loaded');
        
        // Initialize Face Matcher
        await initializeFaceMatcher();
        
    } catch (error) {
        console.error('❌ Error loading Face API models:', error);
        showError('फेस रिकग्निशन मॉडल लोड नहीं हो पाए। कृपया इंटरनेट कनेक्शन चेक करें।');
    }
}

// Initialize Face Matcher
async function initializeFaceMatcher() {
    try {
        // Load face descriptors from Firebase
        const descriptors = await loadFaceDescriptors();
        
        if (descriptors.length > 0) {
            const labeledDescriptors = descriptors.map(desc => 
                new faceapi.LabeledFaceDescriptors(desc.id, [desc.descriptor])
            );
            
            faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
            console.log(`✅ Face Matcher initialized with ${descriptors.length} faces`);
        } else {
            console.log('ℹ️ No faces found in database');
        }
    } catch (error) {
        console.error('Error initializing face matcher:', error);
    }
}

// Camera Functions
async function toggleCamera() {
    const btn = document.getElementById('startCameraBtn');
    const captureBtn = document.getElementById('captureBtn');
    
    if (cameraStream) {
        // Stop Camera
        stopCamera();
        btn.innerHTML = '<i class="fas fa-video"></i> कैमरा चालू करें';
        captureBtn.disabled = true;
        showInfo('कैमरा बंद किया गया');
    } else {
        // Start Camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            
            cameraStream = stream;
            const video = document.getElementById('liveVideo');
            video.srcObject = stream;
            
            btn.innerHTML = '<i class="fas fa-video-slash"></i> कैमरा बंद करें';
            captureBtn.disabled = false;
            
            // Start face detection
            startFaceDetection();
            
            showSuccess('कैमरा सक्रिय | फेस डिटेक्शन चालू');
            
        } catch (error) {
            console.error('Camera error:', error);
            ErrorHandler.handleBiometricError(error);
        }
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        
        const video = document.getElementById('liveVideo');
        video.srcObject = null;
        
        // Clear detection canvas
        const canvas = document.getElementById('detectionCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Face Detection
async function startFaceDetection() {
    const video = document.getElementById('liveVideo');
    const canvas = document.getElementById('detectionCanvas');
    
    // Set canvas size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);
    
    // Detection interval
    setInterval(async () => {
        if (!cameraStream) return;
        
        const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors()
            .withFaceExpressions();
        
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Clear canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw detections
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
        
        // Check for matches
        if (faceMatcher && detections.length > 0) {
            const match = faceMatcher.findBestMatch(detections[0].descriptor);
            
            if (match.distance < 0.5) { // Good match
                updateMatchProgress(match.distance);
                
                if (match.distance < 0.3) { // Excellent match
                    autoCaptureAndSearch(detections[0]);
                }
            }
        }
        
    }, 300); // Check every 300ms
}

// Capture and Search
async function captureAndSearch() {
    const startTime = performance.now();
    
    const video = document.getElementById('liveVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Detect faces
    const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();
    
    if (detections.length === 0) {
        showWarning('कोई चेहरा नहीं मिला। कृपया कैमरे को ठीक से रखें।');
        return;
    }
    
    // Search in database
    const result = await searchInDatabase(detections[0].descriptor);
    
    const endTime = performance.now();
    performanceMonitor.logMetric('searchTime', endTime - startTime);
    
    displaySearchResult(result);
}

// Search in Database
async function searchInDatabase(faceDescriptor) {
    try {
        // First try local IndexedDB
        const localResult = await storageManager.searchLocal(faceDescriptor);
        
        if (localResult && localResult.match > 0.85) {
            return localResult;
        }
        
        // If online, try Firebase
        if (navigator.onLine) {
            const firebaseResult = await searchFirebase(faceDescriptor);
            
            // Cache result
            if (firebaseResult) {
                await storageManager.cacheResult(firebaseResult);
            }
            
            return firebaseResult;
        }
        
        return localResult;
        
    } catch (error) {
        console.error('Search error:', error);
        return null;
    }
}

// Update Match Progress
function updateMatchProgress(distance) {
    const matchPercentage = Math.round((1 - distance) * 100);
    const progressBar = document.getElementById('matchProgressBar');
    const percentageText = document.getElementById('matchPercentage');
    
    progressBar.style.width = `${matchPercentage}%`;
    percentageText.textContent = `${matchPercentage}% मैच`;
    
    // Color based on match
    if (matchPercentage >= 90) {
        progressBar.style.background = 'linear-gradient(90deg, #2ec27e, #26a269)';
    } else if (matchPercentage >= 70) {
        progressBar.style.background = 'linear-gradient(90deg, #4ecdc4, #26a269)';
    } else {
        progressBar.style.background = 'linear-gradient(90deg, #ff6b6b, #ffa726)';
    }
}

// Display Search Result
function displaySearchResult(result) {
    const resultsContainer = document.getElementById('searchResults');
    
    if (!result || result.match < 0.7) {
        resultsContainer.innerHTML = `
            <div class="no-match">
                <i class="fas fa-search"></i>
                <h3>कोई मिलान नहीं मिला</h3>
                <p>डेटाबेस में इस व्यक्ति का रिकॉर्ड नहीं है।</p>
                <button class="btn-secondary" onclick="openTab('register')">
                    <i class="fas fa-user-plus"></i> नया पंजीकरण करें
                </button>
            </div>
        `;
    } else {
        const person = result.person;
        resultsContainer.innerHTML = `
            <div class="match-found">
                <div class="match-header">
                    <span class="match-badge">
                        <i class="fas fa-check-circle"></i> ${Math.round(result.match * 100)}% मैच
                    </span>
                    <h3>${person.name} (${person.age} वर्ष)</h3>
                </div>
                
                <div class="contact-info">
                    <h4><i class="fas fa-phone-alt"></i> आपातकालीन संपर्क:</h4>
                    ${generateContactButtons(person.contacts)}
                </div>
                
                <div class="match-actions">
                    <button class="btn-primary" onclick="callNumber('${person.contacts[0].phone}')">
                        <i class="fas fa-phone"></i> प्राथमिक संपर्क करें
                    </button>
                    <button class="btn-secondary" onclick="openTab('database')">
                        <i class="fas fa-info-circle"></i> पूरा विवरण देखें
                    </button>
                </div>
            </div>
        `;
    }
    
    resultsContainer.classList.add('active');
}

// Generate Contact Buttons
function generateContactButtons(contacts) {
    return contacts.map((contact, index) => `
        <div class="contact-item">
            <div>
                <strong>${contact.relation}:</strong> ${contact.name}
                <br><small>${maskPhoneNumber(contact.phone)}</small>
            </div>
            <button class="call-btn" onclick="callNumber('${contact.phone}')" 
                    title="${contact.relation} को कॉल करें">
                <i class="fas fa-phone"></i>
            </button>
        </div>
    `).join('');
}

// Call Number
function callNumber(phone) {
    const cleanNumber = phone.replace(/\D/g, '');
    window.open(`tel:${cleanNumber}`, '_blank');
    
    // Log the call
    SupportSystem.logCall(phone);
}

// Mask Phone Number
function maskPhoneNumber(phone) {
    return phone.replace(/(\d{4})\d{4}(\d{2})/, '$1****$2');
}

// Tab Switching
function switchTab(tabId) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(tabId).classList.add('active');
    
    currentTab = tabId;
    
    // Tab-specific actions
    if (tabId === 'database') {
        refreshDatabase();
    } else if (tabId === 'live-search') {
        // Nothing specific
    }
}

// Setup Tabs
function setupTabs() {
    const defaultTab = 'live-search';
    switchTab(defaultTab);
}

// Handle Registration
async function handleRegistration(event) {
    event.preventDefault();
    
    const startTime = performance.now();
    
    try {
        // Get form data
        const personData = collectFormData();
        
        // Validate
        if (!validateRegistration(personData)) {
            return;
        }
        
        // Compress and store images
        const compressedImages = await compressImages(personData.images);
        
        // Generate face descriptor
        const faceDescriptor = await generateFaceDescriptor(compressedImages.face);
        
        // Store in Firebase
        const personId = await storePersonData(personData, faceDescriptor, compressedImages);
        
        // Store locally
        await storageManager.storeRecord(personId, {
            ...personData,
            faceDescriptor,
            compressedImages
        });
        
        // Update face matcher
        await updateFaceMatcher(personId, faceDescriptor);
        
        const endTime = performance.now();
        performanceMonitor.logMetric('registrationTime', endTime - startTime);
        
        // Show success
        showSuccess(`${personData.name} का पंजीकरण सफल!`);
        
        // Reset form
        event.target.reset();
        
        // Switch to database tab
        setTimeout(() => switchTab('database'), 1500);
        
    } catch (error) {
        console.error('Registration error:', error);
        showError('पंजीकरण में त्रुटि: ' + error.message);
    }
}

// Collect Form Data
function collectFormData() {
    return {
        name: document.getElementById('personName').value.trim(),
        age: parseInt(document.getElementById('personAge').value),
        images: {
            face: document.getElementById('faceImage').files[0],
            fingerprint: document.getElementById('fingerprintImage').files[0]
        },
        contacts: collectEmergencyContacts(),
        timestamp: Date.now()
    };
}

// Collect Emergency Contacts
function collectEmergencyContacts() {
    const contacts = [];
    const contactElements = document.querySelectorAll('.contact-card');
    
    contactElements.forEach((card, index) => {
        const name = card.querySelector('.contact-name').value.trim();
        const phone = card.querySelector('.contact-phone').value.trim();
        const relation = card.querySelector('.contact-relation').value;
        
        if (name && phone) {
            contacts.push({
                name,
                phone,
                relation: relation || `संपर्क ${index + 1}`,
                priority: index + 1
            });
        }
    });
    
    return contacts;
}

// Setup Emergency Contacts
function setupEmergencyContacts() {
    const container = document.querySelector('.emergency-contacts');
    
    for (let i = 1; i <= 4; i++) {
        const card = document.createElement('div');
        card.className = 'contact-card';
        card.innerHTML = `
            <div class="contact-number">${i}</div>
            <div class="contact-inputs">
                <input type="text" class="contact-name" placeholder="नाम" required>
                <input type="tel" class="contact-phone" placeholder="मोबाइल नंबर" required>
                <select class="contact-relation">
                    <option value="">संबंध चुनें</option>
                    <option value="पिता">पिता</option>
                    <option value="माता">माता</option>
                    <option value="पुत्र">पुत्र</option>
                    <option value="पुत्री">पुत्री</option>
                    <option value="पति">पति</option>
                    <option value="पत्नी">पत्नी</option>
                    <option value="भाई">भाई</option>
                    <option value="बहन">बहन</option>
                    <option value="रिश्तेदार">रिश्तेदार</option>
                    <option value="पड़ोसी">पड़ोसी</option>
                </select>
            </div>
        `;
        container.appendChild(card);
    }
}

// Compress Images
async function compressImages(images) {
    const compressed = {};
    
    if (images.face) {
        compressed.face = await storageManager.compressImage(images.face, {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.7
        });
    }
    
    if (images.fingerprint) {
        compressed.fingerprint = await storageManager.compressImage(images.fingerprint, {
            maxWidth: 400,
            maxHeight: 400,
            quality: 0.8
        });
    }
    
    return compressed;
}

// Generate Face Descriptor
async function generateFaceDescriptor(faceImage) {
    if (!faceImage) return null;
    
    const img = await faceapi.bufferToImage(faceImage);
    const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
    
    return detection ? detection.descriptor : null;
}

// Store Person Data in Firebase
async function storePersonData(personData, faceDescriptor, images) {
    const personId = generatePersonId();
    
    // Store main data
    await database.ref(`persons/${personId}`).set({
        id: personId,
        name: personData.name,
        age: personData.age,
        contacts: personData.contacts,
        registeredAt: personData.timestamp,
        hasBiometrics: !!(faceDescriptor || images.fingerprint)
    });
    
    // Store biometric data separately
    if (faceDescriptor) {
        await database.ref(`face_descriptors/${personId}`).set({
            descriptor: Array.from(faceDescriptor),
            personId: personId,
            timestamp: personData.timestamp
        });
    }
    
    // Upload images to storage
    if (images.face) {
        await uploadImage(images.face, `faces/${personId}.jpg`);
    }
    
    if (images.fingerprint) {
        await uploadImage(images.fingerprint, `fingerprints/${personId}.jpg`);
    }
    
    return personId;
}

// Generate Person ID
function generatePersonId() {
    return 'P' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Upload Image to Firebase Storage
async function uploadImage(imageBlob, path) {
    const storageRef = firebase.storage().ref();
    const imageRef = storageRef.child(path);
    
    await imageRef.put(imageBlob);
    return await imageRef.getDownloadURL();
}

// Update Face Matcher
async function updateFaceMatcher(personId, faceDescriptor) {
    if (!faceDescriptor || !faceMatcher) return;
    
    const labeledDescriptor = new faceapi.LabeledFaceDescriptors(
        personId, 
        [faceDescriptor]
    );
    
    // Get current descriptors
    const currentDescriptors = faceMatcher.labeledDescriptors;
    currentDescriptors.push(labeledDescriptor);
    
    // Update matcher
    faceMatcher = new faceapi.FaceMatcher(currentDescriptors, 0.6);
}

// Filter Records
function filterRecords() {
    const searchTerm = document.getElementById('searchDatabase').value.toLowerCase();
    
    const filtered = records.filter(record => 
        record.name.toLowerCase().includes(searchTerm) ||
        record.contacts.some(contact => 
            contact.name.toLowerCase().includes(searchTerm) ||
            contact.phone.includes(searchTerm)
        )
    );
    
    displayRecords(filtered);
}

// Display Records
function displayRecords(recordsToDisplay) {
    const container = document.getElementById('recordsContainer');
    
    if (recordsToDisplay.length === 0) {
        container.innerHTML = `
            <div class="no-records">
                <i class="fas fa-database"></i>
                <h3>कोई रिकॉर्ड नहीं मिला</h3>
                <p>पंजीकरण करने के लिए "पंजीकरण" टैब पर जाएँ</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recordsToDisplay.map(record => `
        <div class="record-card" data-id="${record.id}">
            <div class="record-header">
                <div class="record-name">${record.name}</div>
                <div class="record-age">${record.age} वर्ष</div>
            </div>
            
            <div class="record-contacts">
                ${generateContactButtons(record.contacts.slice(0, 2))}
            </div>
            
            <div class="record-actions">
                <button class="btn-secondary btn-small" onclick="viewDetails('${record.id}')">
                    <i class="fas fa-eye"></i> विवरण
                </button>
                <button class="btn-danger btn-small" onclick="deleteRecord('${record.id}')">
                    <i class="fas fa-trash"></i> हटाएँ
                </button>
            </div>
        </div>
    `).join('');
}

// Update Record Count
function updateRecordCount() {
    const countElement = document.querySelector('.record-count');
    if (countElement) {
        countElement.textContent = `कुल रिकॉर्ड: ${records.length}`;
    }
}

// Refresh Database
async function refreshDatabase() {
    try {
        showLoading('डेटाबेस रिफ्रेश हो रहा है...');
        
        // Load from Firebase
        const newRecords = await loadRecordsFromFirebase();
        
        // Update local records
        records = newRecords;
        
        // Update IndexedDB
        await storageManager.syncRecords(records);
        
        // Update UI
        displayRecords(records);
        updateRecordCount();
        
        showSuccess('डेटाबेस रिफ्रेश हो गया!');
        
    } catch (error) {
        console.error('Refresh error:', error);
        showError('डेटाबेस रिफ्रेश में त्रुटि');
    }
}

// View Details
function viewDetails(personId) {
    const person = records.find(r => r.id === personId);
    if (!person) return;
    
    const details = `
        <strong>नाम:</strong> ${person.name}<br>
        <strong>उम्र:</strong> ${person.age} वर्ष<br>
        <strong>पंजीकरण तिथि:</strong> ${new Date(person.timestamp).toLocaleString('hi-IN')}<br><br>
        
        <strong>आपातकालीन संपर्क:</strong><br>
        ${person.contacts.map(contact => 
            `${contact.priority}. ${contact.relation}: ${contact.name} - ${contact.phone}`
        ).join('<br>')}
    `;
    
    // Show modal or alert
    showDetailsModal(details);
}

// Delete Record
async function deleteRecord(personId) {
    if (!confirm('क्या आप वाकई इस रिकॉर्ड को हटाना चाहते हैं?')) {
        return;
    }
    
    // Ask for admin password
    const password = prompt('एडमिन पासवर्ड डालें:');
    if (password !== 'tamir@lI00769') {
        showError('गलत पासवर्ड!');
        return;
    }
    
    try {
        // Delete from Firebase
        await database.ref(`persons/${personId}`).remove();
        await database.ref(`face_descriptors/${personId}`).remove();
        
        // Delete from local storage
        records = records.filter(r => r.id !== personId);
        await storageManager.deleteRecord(personId);
        
        // Update UI
        displayRecords(records);
        updateRecordCount();
        
        // Update face matcher
        await updateFaceMatcherAfterDeletion(personId);
        
        showSuccess('रिकॉर्ड सफलतापूर्वक हटा दिया गया!');
        
    } catch (error) {
        console.error('Delete error:', error);
        showError('रिकॉर्ड हटाने में त्रुटि');
    }
}

// Update Face Matcher after deletion
async function updateFaceMatcherAfterDeletion(personId) {
    if (!faceMatcher) return;
    
    // Remove the deleted person's descriptor
    const currentDescriptors = faceMatcher.labeledDescriptors.filter(
        desc => desc.label !== personId
    );
    
    // Recreate matcher
    faceMatcher = new faceapi.FaceMatcher(currentDescriptors, 0.6);
}

// Handle Online/Offline Status
function handleOnlineStatus() {
    showSuccess('इंटरनेट कनेक्शन वापस आ गया');
    
    // Sync data when coming online
    if (records.length === 0) {
        refreshDatabase();
    }
}

function handleOfflineStatus() {
    showWarning('आप ऑफलाइन हैं। लोकल डेटाबेस का उपयोग किया जाएगा।');
}

// Show Details Modal
function showDetailsModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>व्यक्ति विवरण</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">
                    बंद करें
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Show Loading
function showLoading(message) {
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(loading);
    
    return {
        hide: () => loading.remove()
    };
}

// Toast Notification Functions
function showSuccess(message) {
    toastr.success(message);
}

function showError(message) {
    toastr.error(message);
}

function showWarning(message) {
    toastr.warning(message);
}

function showInfo(message) {
    toastr.info(message);
}

// Initialize on load
window.onload = function() {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered:', reg))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
    
    // Check for updates
    checkForUpdates();
};

// Check for Updates
function checkForUpdates() {
    // Check if new version is available
    const currentVersion = '2.0.0';
    const savedVersion = localStorage.getItem('lapata_version');
    
    if (savedVersion !== currentVersion) {
        showInfo(`LAPATA PORTAL v${currentVersion} में आपका स्वागत है! नई सुविधाएँ:<br>
        • रियल-टाइम फेस रिकग्निशन<br>
        • ऑफलाइन सर्च सपोर्ट<br>
        • बेहतर सुरक्षा`);
        
        localStorage.setItem('lapata_version', currentVersion);
    }
}

// Export functions for global use
window.toggleCamera = toggleCamera;
window.captureAndSearch = captureAndSearch;
window.callNumber = callNumber;
window.viewDetails = viewDetails;
window.deleteRecord = deleteRecord;
window.openTab = switchTab;
window.filterRecords = filterRecords;
window.refreshDatabase = refreshDatabase;
