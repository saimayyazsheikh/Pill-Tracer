const express = require('express');
const { auth } = require('../config/firebase-admin');
const { query } = require('../db/connection');
const { logActivity } = require('../middleware/auth');
const oracledb = require('oracledb');

const router = express.Router();

// Register new pharmacy
router.post('/register', async (req, res) => {
    try {
        const { email, password, pharmacyName, city, address, phone, licenseNumber } = req.body;

        // Validation
        if (!email || !password || !pharmacyName || !city) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create Firebase user
        const userRecord = await auth.createUser({
            email,
            password,
            emailVerified: false
        });

        // Create Branch (Oracle)
        const branchResult = await query(
            'INSERT INTO branches (name, address, city, country, firebase_uid) VALUES (:1, :2, :3, :4, :5) RETURNING id INTO :6',
            [pharmacyName, address || '', city, 'Pakistan', userRecord.uid, { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }]
        );

        const branchId = branchResult.insertId;

        // Create User (Oracle)
        // Renamed uid -> id
        await query(
            'INSERT INTO users (id, email, pharmacy_name, role, status, branch_id, phone, address, license_number) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)',
            [userRecord.uid, email, pharmacyName, 'pharmacy_admin', 'pending', branchId, phone || '', address || '', licenseNumber || '']
        );

        // Log activity
        await logActivity(userRecord.uid, 'register', 'user', { pharmacyName, city });

        res.json({
            success: true,
            message: 'Registration successful. Please wait for admin approval.',
            data: {
                uid: userRecord.uid,
                email,
                pharmacyName,
                status: 'pending'
            }
        });
    } catch (error) {
        console.error('Registration error:', error);

        if (error.code === 'auth/email-already-exists') {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
});

// Verify token and get user profile
router.post('/verify-token', async (req, res) => {
    console.log('🔹 /verify-token request received');
    try {
        const { token } = req.body;
        console.log('   Token received (length):', token ? token.length : 'null');

        if (!token) {
            console.log('   ❌ No token provided');
            return res.status(400).json({
                success: false,
                message: 'Token required'
            });
        }

        // Verify token
        console.log('   Verifying Firebase token...');
        const decodedToken = await auth.verifyIdToken(token);
        console.log('   ✅ Token verified. UID:', decodedToken.uid);

        // Get user data
        console.log('   Querying Oracle for user...');
        const users = await query('SELECT * FROM users WHERE id = :1', [decodedToken.uid]);
        console.log('   Users found:', users.length);

        if (users.length === 0) {
            console.log('   ❌ User not found in Oracle');
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];

        // Update last login (Oracle SYSTIMESTAMP)
        console.log('   Updating last_login...');
        await query('UPDATE users SET last_login = SYSTIMESTAMP WHERE id = :1', [decodedToken.uid]);
        console.log('   ✅ last_login updated');

        res.json({
            success: true,
            data: {
                uid: user.id, // Map DB 'id' to API 'uid'
                email: user.email,
                role: user.role,
                status: user.status,
                pharmacyName: user.pharmacy_name,
                branchId: user.branch_id,
                profile: {
                    phone: user.phone,
                    address: user.address,
                    city: user.city,
                    licenseNumber: user.license_number
                }
            }
        });
    } catch (error) {
        console.error('❌ Token verification error:', error);
        // Respond with the actual error message for debugging
        res.status(500).json({
            success: false,
            message: `Server Error: ${error.message}`
        });
    }
});

// Get user profile
router.get('/profile/:uid', async (req, res) => {
    try {
        const { uid } = req.params;

        const users = await query('SELECT * FROM users WHERE id = :1', [uid]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];

        // Format data to match previous structure
        const userData = {
            uid: user.id,
            email: user.email,
            role: user.role,
            status: user.status,
            pharmacyName: user.pharmacy_name,
            branchId: user.branch_id,
            profile: {
                phone: user.phone,
                address: user.address,
                licenseNumber: user.license_number
            },
            createdAt: user.created_at,
            lastLogin: user.last_login
        };

        res.json({
            success: true,
            data: userData
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile'
        });
    }
});

// Update user profile
router.put('/profile/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const { pharmacyName, phone, address } = req.body;

        const updateFields = [];
        const updateValues = [];
        let bindIndex = 1; // Oracle binds start at 1

        if (pharmacyName) {
            updateFields.push(`pharmacy_name = :${bindIndex++}`);
            updateValues.push(pharmacyName);
        }
        if (phone) {
            updateFields.push(`phone = :${bindIndex++}`);
            updateValues.push(phone);
        }
        if (address) {
            updateFields.push(`address = :${bindIndex++}`);
            updateValues.push(address);
        }

        if (updateFields.length > 0) {
            updateValues.push(uid); // Add uid for WHERE clause
            // The WHERE clause bind needs to have the correct index
            await query(
                `UPDATE users SET ${updateFields.join(', ')} WHERE id = :${bindIndex}`,
                updateValues
            );
        }

        await logActivity(uid, 'update', 'profile', { pharmacyName, phone, address });

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
});

module.exports = router;
