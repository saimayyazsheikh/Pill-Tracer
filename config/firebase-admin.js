// Firebase Admin SDK Configuration
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'pill-tracer-887b2'
});

// Get Auth instance
const auth = admin.auth();

console.log('✅ Firebase Admin SDK initialized');

module.exports = {
    admin,
    auth
};
