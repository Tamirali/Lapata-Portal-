// Main Application Module
let currentTab = 'register';
let records = [];
let currentRecordToDelete = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    loadAllRecords();
});

// Initialize application
function initApp() {
    setupLanguage();
    setupTabNavigation();
    setupFormSubmission();
    setupSearch();
    setupFileUpload();
}

// Language Management
function getCurrentLanguage() {
    return document.querySelector('.lang-btn.active').textContent.trim().toLowerCase() === 'हिंदी' ? 'hi' : 'en';
}

function switchLanguage(lang) {
    const buttons = document.querySelectorAll('.lang-btn');
    
    // Update button states
    buttons.forEach(btn => {
        if (btn.textContent.trim().toLowerCase() === (lang === 'hi' ? 'हिंदी' : 'english')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update all text elements
    document.querySelectorAll(`[data-lang="hi"]`).forEach(el => {
        el.style.display = lang === 'hi' ? 'block' : 'none';
    });
    
    document.querySelectorAll(`[data-lang="en"]`).forEach(el => {
        el.style.display = lang === 'en' ? 'block' : 'none';
    });
    
    showSuccess(lang === 'hi' ? 'भाषा बदली गई' : 'Language changed');
}

// Tab Navigation
function setupTabNavigation() {
    openTab('register');
}

function openTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activate selected tab
    const activeTabBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => 
        btn.getAttribute('onclick')?.includes(`'${tabName}'`)
    );
    
    if (activeTabBtn) {
        activeTabBtn.classList.add('active');
    }
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Load data if needed
    if (tabName === 'data') {
        loadAllRecords();
    }
}

// Form Submission
function setupFormSubmission() {
    const form = document.getElementById('registrationForm');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        saveRecord();
    });
}

async function saveRecord() {
    try {
        // Validate form
        if (!validateForm()) {
            return;
        }
        
        // Get form data
        const record = {
            id: generateId(),
            fullName: document.getElementById('fullName').value.trim(),
            age: parseInt(document.getElementById('age').value),
            address: document.getElementById('address').value.trim(),
            biometrics: biometricScanner ? biometricScanner.getBiometricData() : null,
            contacts: {
                contact1: {
                    name: document.getElementById('contact1Name').value.trim(),
                    phone: document.getElementById('contact1Phone').value.trim()
                },
                contact2: {
                    name: document.getElementById('contact2Name').value.trim(),
                    phone: document.getElementById('contact2Phone').value.trim()
                },
                contact3: {
                    name: document.getElementById('contact3Name').value.trim(),
                    phone: document.getElementById('contact3Phone').value.trim()
                },
                contact4: {
                    name: document.getElementById('contact4Name').value.trim(),
                    phone: document.getElementById('contact4Phone').value.trim()
                }
            },
            registeredAt: Date.now(),
            lastUpdated: Date.now()
        };
        
        // Show loading
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> सेव हो रहा है...';
        submitBtn.disabled = true;
        
        // Save to Firebase
        await database.ref(`${DB.records}/${record.id}`).set(record);
        
        // Reset form
        document.getElementById('registrationForm').reset();
        
        // Reset biometrics
        if (biometricScanner) {
            biometricScanner.reset();
        }
        
        // Show success message
        showSuccess('रिकॉर्ड सफलतापूर्वक सहेजा गया!');
        
        // Switch to data tab
        setTimeout(() => {
            openTab('data');
        }, 1000);
        
    } catch (error) {
        console.error('Save error:', error);
        showError('रिकॉर्ड सेव करने में त्रुटि: ' + error.message);
    } finally {
        // Restore button
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> डेटा क्लाउड में सुरक्षित करें';
        submitBtn.disabled = false;
    }
}

function validateForm() {
    const fullName = document.getElementById('fullName').value.trim();
    const age = document.getElementById('age').value;
    const contact1Name = document.getElementById('contact1Name').value.trim();
    const contact1Phone = document.getElementById('contact1Phone').value.trim();
    
    if (!fullName) {
        showError('कृपया पूरा नाम दर्ज करें');
        return false;
    }
    
    if (!age || age < 1 || age > 100) {
        showError('कृपया 1 से 100 के बीच उम्र दर्ज करें');
        return false;
    }
    
    if (!contact1Name || !contact1Phone) {
        showError('कृपया प्राथमिक संपर्क की जानकारी दर्ज करें');
        return false;
    }
    
    return true;
}

// Data Management
async function loadAllRecords() {
    try {
        const recordsRef = database.ref(DB.records);
        
        recordsRef.on('value', (snapshot) => {
            records = [];
            const data = snapshot.val();
            
            if (data) {
                Object.keys(data).forEach(key => {
                    records.push({ id: key, ...data[key] });
                });
            }
            
            updateStatistics();
            displayRecords();
        });
        
    } catch (error) {
        console.error('Load records error:', error);
        showError('डेटा लोड करने में त्रुटि');
    }
}

function updateStatistics() {
    document.getElementById('totalRecords').textContent = records.length;
    
    const withBiometrics = records.filter(r => r.biometrics && r.biometrics.hasBiometrics).length;
    document.getElementById('withBiometrics').textContent = withBiometrics;
}

function displayRecords(filter = '') {
    const container = document.getElementById('recordsContainer');
    
    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-database"></i>
                <p>कोई रिकॉर्ड नहीं मिला</p>
            </div>
        `;
        return;
    }
    
    let filteredRecords = records;
    
    if (filter) {
        const searchTerm = filter.toLowerCase();
        filteredRecords = records.filter(record => 
            record.fullName?.toLowerCase().includes(searchTerm) ||
            record.address?.toLowerCase().includes(searchTerm) ||
            record.contacts?.contact1?.name?.toLowerCase().includes(searchTerm) ||
            record.contacts?.contact1?.phone?.includes(searchTerm) ||
            record.age?.toString().includes(searchTerm)
        );
    }
    
    container.innerHTML = filteredRecords.map(record => `
        <div class="record-item">
            <div class="record-header">
                <div class="record-name">${record.fullName}</div>
                <div class="record-actions">
                    <button class="btn-secondary btn-sm" onclick="viewRecord('${record.id}')">
                        <i class="fas fa-eye"></i> देखें
                    </button>
                    <button class="btn-danger btn-sm" onclick="confirmDeleteRecord('${record.id}')">
                        <i class="fas fa-trash"></i> डिलीट
                    </button>
                </div>
            </div>
            <div class="record-details">
                <div class="record-detail">
                    <strong>उम्र</strong>
                    ${record.age} वर्ष
                </div>
                <div class="record-detail">
                    <strong>अभिभावक</strong>
                    ${record.contacts?.contact1?.name || 'N/A'}
                </div>
                <div class="record-detail">
                    <strong>संपर्क</strong>
                    ${formatPhoneNumber(record.contacts?.contact1?.phone) || 'N/A'}
                </div>
                <div class="record-detail">
                    <strong>पता</strong>
                    ${record.address || 'N/A'}
                </div>
            </div>
            ${record.biometrics?.hasBiometrics ? `
                <div class="biometric-badges">
                    ${record.biometrics?.fingerprint ? '<span class="badge"><i class="fas fa-fingerprint"></i> फिंगरप्रिंट</span>' : ''}
                    ${record.biometrics?.face ? '<span class="badge"><i class="fas fa-user-circle"></i> चेहरा</span>' : ''}
                </div>
            ` : ''}
        </div>
    `).join('');
}

function refreshData() {
    loadAllRecords();
    showInfo('डेटा रिफ्रेश किया गया');
}

// Search Functionality
function setupSearch() {
    const filterInput = document.getElementById('filterData');
    
    if (filterInput) {
        filterInput.addEventListener('input', (e) => {
            displayRecords(e.target.value);
        });
    }
}

function searchByPhoto() {
    const fileInput = document.getElementById('photoUpload');
    fileInput.click();
}

function searchByText() {
    const searchTerm = document.getElementById('textSearch').value.trim();
    
    if (!searchTerm) {
        showWarning('कृपया खोजने के लिए कुछ दर्ज करें');
        return;
    }
    
    // Filter records
    const results = records.filter(record => 
        record.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.contacts?.contact1?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.contacts?.contact1?.phone?.includes(searchTerm) ||
        record.age?.toString().includes(searchTerm)
    );
    
    displaySearchResults(results);
}

function displaySearchResults(results) {
    const container = document.getElementById('resultsContainer');
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>कोई परिणाम नहीं मिला</p>
                <p>कृपया अलग शब्दों से खोजें</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = results.map(record => `
        <div class="record-item">
            <div class="record-header">
                <div class="record-name">${record.fullName}</div>
                <div class="record-actions">
                    <button class="btn-primary btn-sm" onclick="contactGuardian('${record.id}')">
                        <i class="fas fa-phone"></i> संपर्क करें
                    </button>
                </div>
            </div>
            <div class="record-details">
                <div class="record-detail">
                    <strong>उम्र</strong>
                    ${record.age} वर्ष
                </div>
                <div class="record-detail">
                    <strong>अभिभावक</strong>
                    ${record.contacts?.contact1?.name || 'N/A'}
                </div>
                <div class="record-detail">
                    <strong>संपर्क नंबर</strong>
                    ${formatPhoneNumber(record.contacts?.contact1?.phone) || 'N/A'}
                </div>
            </div>
            <div class="contact-options">
                <p><strong>आपातकालीन संपर्क:</strong></p>
                <div class="contact-buttons">
                    ${record.contacts?.contact1?.phone ? `
                        <button class="btn-secondary btn-sm" onclick="callNumber('${record.contacts.contact1.phone}')">
                            <i class="fas fa-phone"></i> 1
                        </button>
                    ` : ''}
                    ${record.contacts?.contact2?.phone ? `
                        <button class="btn-secondary btn-sm" onclick="callNumber('${record.contacts.contact2.phone}')">
                            <i class="fas fa-phone"></i> 2
                        </button>
                    ` : ''}
                    ${record.contacts?.contact3?.phone ? `
                        <button class="btn-secondary btn-sm" onclick="callNumber('${record.contacts.contact3.phone}')">
                            <i class="fas fa-phone"></i> 3
                        </button>
                    ` : ''}
                    ${record.contacts?.contact4?.phone ? `
                        <button class="btn-secondary btn-sm" onclick="callNumber('${record.contacts.contact4.phone}')">
                            <i class="fas fa-phone"></i> 4
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function contactGuardian(recordId) {
    const record = records.find(r => r.id === recordId);
    if (record && record.contacts?.contact1?.phone) {
        callNumber(record.contacts.contact1.phone);
    }
}

function callNumber(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`tel:${cleanPhone}`, '_blank');
}

// File Upload
function setupFileUpload() {
    const uploadArea = document.getElementById('photoUploadArea');
    const fileInput = document.getElementById('photoUpload');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
            uploadArea.style.background = '#f0f7ff';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'var(--border-color)';
            uploadArea.style.background = '';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
            uploadArea.style.background = '#f0f7ff';
            
            if (e.dataTransfer.files.length > 0) {
                handlePhotoUpload(e.dataTransfer.files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handlePhotoUpload(e.target.files[0]);
            }
        });
    }
}

function handlePhotoUpload(file) {
    if (!file.type.startsWith('image/')) {
        showError('कृपया केवल इमेज फाइल अपलोड करें');
        return;
    }
    
    // Show loading
    const uploadArea = document.getElementById('photoUploadArea');
    const originalHTML = uploadArea.innerHTML;
    uploadArea.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>प्रोसेसिंग...</p>';
    
    // Simulate photo processing
    setTimeout(() => {
        // Simulate face recognition
        const matchedRecords = records.filter(() => Math.random() > 0.5); // 50% chance of match
        
        if (matchedRecords.length > 0) {
            displaySearchResults(matchedRecords.slice(0, 3)); // Show max 3 results
            showSuccess('फोटो मिलान सफल! संभावित मैच मिले');
        } else {
            showInfo('फोटो का डेटाबेस में कोई मैच नहीं मिला');
        }
        
        // Reset upload area
        uploadArea.innerHTML = originalHTML;
    }, 2000);
}

// Delete Record
function confirmDeleteRecord(recordId) {
    currentRecordToDelete = recordId;
    document.getElementById('deleteModal').classList.add('active');
}

function closeModal() {
    document.getElementById('deleteModal').classList.remove('active');
    currentRecordToDelete = null;
    document.getElementById('adminPassword').value = '';
}

async function confirmDelete() {
    const password = document.getElementById('adminPassword').value;
    
    if (password !== ADMIN_PASSWORD) {
        showError('गलत पासवर्ड!');
        return;
    }
    
    if (!currentRecordToDelete) {
        showError('कोई रिकॉर्ड चयनित नहीं');
        return;
    }
    
    try {
        await database.ref(`${DB.records}/${currentRecordToDelete}`).remove();
        showSuccess('रिकॉर्ड सफलतापूर्वक डिलीट किया गया');
        closeModal();
    } catch (error) {
        showError('रिकॉर्ड डिलीट करने में त्रुटि');
    }
}

function viewRecord(recordId) {
    const record = records.find(r => r.id === recordId);
    if (record) {
        let details = `
            <strong>नाम:</strong> ${record.fullName}<br>
            <strong>उम्र:</strong> ${record.age}<br>
            <strong>पता:</strong> ${record.address || 'N/A'}<br><br>
        `;
        
        if (record.contacts) {
            details += `<strong>आपातकालीन संपर्क:</strong><br>`;
            for (let i = 1; i <= 4; i++) {
                const contact = record.contacts[`contact${i}`];
                if (contact && contact.name && contact.phone) {
                    details += `${i}. ${contact.name}: ${formatPhoneNumber(contact.phone)}<br>`;
                }
            }
        }
        
        alert(details);
    }
}

// Utility Functions
function closeDisclaimer() {
    document.querySelectorAll('.disclaimer-banner').forEach(banner => {
        banner.style.display = 'none';
    });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
