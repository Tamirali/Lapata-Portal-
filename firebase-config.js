// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDyxgyUhV4u7Fjort1GpOtoI_FTU3X3IFk",
    authDomain: "lapata-portal.firebaseapp.com",
    databaseURL: "https://lapata-portal-default-rtdb.firebaseio.com",
    projectId: "lapata-portal",
    storageBucket: "lapata-portal.firebasestorage.app",
    messagingSenderId: "627466745113",
    appId: "1:627466745113:web:9fbcdc6b99103f336fc188"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Admin Configuration
const ADMIN_PASSWORD = "tamir@lI00769";
const ADMIN_CONTACT = "+918797221991";

// Database References
const DB = {
    records: 'records',
    biometrics: 'biometrics'
};

// Initialize Toastr
toastr.options = {
    positionClass: "toast-top-right",
    timeOut: 3000,
    closeButton: true,
    progressBar: true
};

// Show success message
function showSuccess(message) {
    toastr.success(message);
}

// Show error message
function showError(message) {
    toastr.error(message);
}

// Show info message
function showInfo(message) {
    toastr.info(message);
}

// Show warning message
function showWarning(message) {
    toastr.warning(message);
}

// Format phone number
function formatPhoneNumber(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{5})/, '+$1 $2 $3');
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
