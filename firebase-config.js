// Firebase Configuration for LAPATA PORTAL v2.0

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

// Initialize services
const database = firebase.database();
const storage = firebase.storage();

// Constants
const ADMIN_PASSWORD = "tamir@lI00769";
const ADMIN_CONTACT = "+918797221991";

// Database references
const DB_PATHS = {
    PERSONS: 'persons',
    FACE_DESCRIPTORS: 'face_descriptors',
    FINGERPRINT_HASHES: 'fingerprint_hashes',
    SEARCH_HISTORY: 'search_history',
    SYSTEM_LOGS: 'system_logs'
};

// Storage paths
const STORAGE_PATHS = {
    FACES: 'faces',
    FINGERPRINTS: 'fingerprints',
    BACKUPS: 'backups'
};

// Utility Functions
const FirebaseUtils = {
    // Generate unique ID
    generateId: () => {
        return 'ID_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // Get server timestamp
    getTimestamp: () => {
        return firebase.database.ServerValue.TIMESTAMP;
    },
    
    // Format phone number
    formatPhone: (phone) => {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.replace(/(\d{2})(\d{5})(\d{5})/, '+$1 $2 $3');
    },
    
    // Validate phone number
    isValidPhone: (phone) => {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length === 10 || cleaned.length === 12;
    },
    
    // Encrypt sensitive data (basic encryption)
    encryptData: (data, key = ADMIN_PASSWORD) => {
        // Simple XOR encryption for demo (use proper encryption in production)
        let encrypted = '';
        for (let i = 0; i < data.length; i++) {
            encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(encrypted);
    },
    
    // Decrypt data
    decryptData: (encryptedData, key = ADMIN_PASSWORD) => {
        try {
            const decoded = atob(encryptedData);
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    },
    
    // Upload file with progress tracking
    uploadFile: async (file, path, onProgress) => {
        const storageRef = storage.ref(path);
        const uploadTask = storageRef.put(file);
        
        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    // Progress tracking
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) onProgress(progress);
                },
                (error) => {
                    reject(error);
                },
                async () => {
                    // Upload complete
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    resolve({
                        url: downloadURL,
                        path: path,
                        size: file.size
                    });
                }
            );
        });
    },
    
    // Download file as blob
    downloadFile: async (path) => {
        const storageRef = storage.ref(path);
        const url = await storageRef.getDownloadURL();
        
        const response = await fetch(url);
        return await response.blob();
    },
    
    // Search in database
    searchDatabase: async (query, field = 'name') => {
        const personsRef = database.ref(DB_PATHS.PERSONS);
        const snapshot = await personsRef.orderByChild(field).startAt(query).endAt(query + '\uf8ff').once('value');
        
        const results = [];
        snapshot.forEach(childSnapshot => {
            results.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        return results;
    },
    
    // Get person by ID
    getPersonById: async (personId) => {
        const snapshot = await database.ref(`${DB_PATHS.PERSONS}/${personId}`).once('value');
        return snapshot.val();
    },
    
    // Get face descriptor
    getFaceDescriptor: async (personId) => {
        const snapshot = await database.ref(`${DB_PATHS.FACE_DESCRIPTORS}/${personId}`).once('value');
        return snapshot.val();
    },
    
    // Get all persons with pagination
    getAllPersons: async (limit = 50, startAt = null) => {
        let query = database.ref(DB_PATHS.PERSONS).orderByChild('registeredAt').limitToLast(limit);
        
        if (startAt) {
            query = query.endAt(startAt);
        }
        
        const snapshot = await query.once('value');
        
        const persons = [];
        snapshot.forEach(childSnapshot => {
            persons.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Reverse to get newest first
        return persons.reverse();
    },
    
    // Add search log
    logSearch: async (searchData) => {
        const logId = FirebaseUtils.generateId();
        const logData = {
            ...searchData,
            timestamp: FirebaseUtils.getTimestamp(),
            ip: await FirebaseUtils.getClientIP(),
            userAgent: navigator.userAgent
        };
        
        await database.ref(`${DB_PATHS.SEARCH_HISTORY}/${logId}`).set(logData);
        return logId;
    },
    
    // Get client IP (approximate)
    getClientIP: async () => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    },
    
    // Backup database
    backupDatabase: async () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = `backup_${timestamp}`;
        
        // Get all data
        const [persons, faceDescriptors, searchHistory] = await Promise.all([
            FirebaseUtils.getAllPersons(1000),
            database.ref(DB_PATHS.FACE_DESCRIPTORS).once('value').then(s => s.val()),
            database.ref(DB_PATHS.SEARCH_HISTORY).once('value').then(s => s.val())
        ]);
        
        const backupData = {
            persons,
            faceDescriptors,
            searchHistory,
            backupTime: FirebaseUtils.getTimestamp(),
            version: '2.0.0'
        };
        
        // Store backup
        await database.ref(`${DB_PATHS.SYSTEM_LOGS}/backups/${backupId}`).set(backupData);
        
        // Also save to storage as JSON file
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        await FirebaseUtils.uploadFile(blob, `${STORAGE_PATHS.BACKUPS}/${backupId}.json`);
        
        return backupId;
    },
    
    // Restore from backup
    restoreBackup: async (backupId) => {
        const snapshot = await database.ref(`${DB_PATHS.SYSTEM_LOGS}/backups/${backupId}`).once('value');
        const backupData = snapshot.val();
        
        if (!backupData) {
            throw new Error('Backup not found');
        }
        
        // Restore data
        const updates = {};
        
        // Restore persons
        backupData.persons.forEach(person => {
            updates[`${DB_PATHS.PERSONS}/${person.id}`] = person;
        });
        
        // Restore face descriptors
        if (backupData.faceDescriptors) {
            Object.keys(backupData.faceDescriptors).forEach(key => {
                updates[`${DB_PATHS.FACE_DESCRIPTORS}/${key}`] = backupData.faceDescriptors[key];
            });
        }
        
        // Apply updates
        await database.ref().update(updates);
        
        return {
            restored: backupData.persons.length,
            timestamp: backupData.backupTime
        };
    },
    
    // Delete old backups
    cleanupOldBackups: async (keepLast = 5) => {
        const snapshot = await database.ref(`${DB_PATHS.SYSTEM_LOGS}/backups`).once('value');
        const backups = [];
        
        snapshot.forEach(childSnapshot => {
            backups.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Sort by timestamp (newest first)
        backups.sort((a, b) => b.backupTime - a.backupTime);
        
        // Keep only the most recent backups
        const toDelete = backups.slice(keepLast);
        
        // Delete old backups
        for (const backup of toDelete) {
            await database.ref(`${DB_PATHS.SYSTEM_LOGS}/backups/${backup.id}`).remove();
            
            // Also delete from storage
            try {
                const storageRef = storage.ref(`${STORAGE_PATHS.BACKUPS}/${backup.id}.json`);
                await storageRef.delete();
            } catch (error) {
                console.warn('Could not delete backup file:', error);
            }
        }
        
        return toDelete.length;
    },
    
    // Get system statistics
    getSystemStats: async () => {
        const [personsCount, searchesCount, storageUsage] = await Promise.all([
            database.ref(DB_PATHS.PERSONS).once('value').then(s => s.numChildren()),
            database.ref(DB_PATHS.SEARCH_HISTORY).once('value').then(s => s.numChildren()),
            FirebaseUtils.getStorageUsage()
        ]);
        
        return {
            persons: personsCount,
            searches: searchesCount,
            storage: storageUsage,
            lastUpdated: FirebaseUtils.getTimestamp()
        };
    },
    
    // Get storage usage (approximate)
    getStorageUsage: async () => {
        try {
            // This is an approximation - Firebase doesn't provide exact storage usage
            const persons = await FirebaseUtils.getAllPersons(1000);
            const totalSize = persons.reduce((acc, person) => {
                // Approximate size based on data structure
                return acc + JSON.stringify(person).length;
            }, 0);
            
            return {
                total: totalSize,
                persons: persons.length,
                averagePerPerson: persons.length > 0 ? totalSize / persons.length : 0
            };
        } catch (error) {
            return { total: 0, persons: 0, averagePerPerson: 0 };
        }
    },
    
    // Validate admin access
    validateAdminAccess: (password) => {
        return password === ADMIN_PASSWORD;
    },
    
    // Send emergency alert
    sendEmergencyAlert: async (personId, alertType) => {
        const person = await FirebaseUtils.getPersonById(personId);
        if (!person) throw new Error('Person not found');
        
        const alertId = FirebaseUtils.generateId();
        const alertData = {
            id: alertId,
            personId,
            personName: person.name,
            alertType,
            contacts: person.contacts,
            timestamp: FirebaseUtils.getTimestamp(),
            status: 'pending'
        };
        
        await database.ref(`emergency_alerts/${alertId}`).set(alertData);
        
        // Also send to admin
        await database.ref(`admin_notifications/${alertId}`).set({
            ...alertData,
            priority: 'high',
            requiresAction: true
        });
        
        return alertId;
    },
    
    // Mark alert as resolved
    resolveAlert: async (alertId, resolutionNotes) => {
        const updateData = {
            status: 'resolved',
            resolvedAt: FirebaseUtils.getTimestamp(),
            resolutionNotes
        };
        
        await database.ref(`emergency_alerts/${alertId}`).update(updateData);
        await database.ref(`admin_notifications/${alertId}`).update(updateData);
        
        return true;
    }
};

// Initialize Toastr
toastr.options = {
    positionClass: "toast-top-right",
    timeOut: 4000,
    extendedTimeOut: 2000,
    closeButton: true,
    progressBar: true,
    newestOnTop: true,
    showMethod: "fadeIn",
    hideMethod: "fadeOut",
    showEasing: "swing",
    hideEasing: "linear",
    showDuration: 300,
    hideDuration: 1000
};

// Export for global use
window.database = database;
window.storage = storage;
window.FirebaseUtils = FirebaseUtils;
window.ADMIN_PASSWORD = ADMIN_PASSWORD;
window.ADMIN_CONTACT = ADMIN_CONTACT;
