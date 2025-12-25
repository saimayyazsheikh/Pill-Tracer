const { auth } = require('../config/firebase-admin');
const { query } = require('../db/connection');

// Verify Firebase ID token
async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify the ID token
        const decodedToken = await auth.verifyIdToken(token);

        // Get user data from Oracle
        const users = await query('SELECT * FROM users WHERE id = :1', [decodedToken.uid]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];

        // Check if user is approved
        if (user.status !== 'approved') {
            return res.status(403).json({
                success: false,
                message: 'Account pending approval or suspended'
            });
        }

        // Attach user data to request (Map to camelCase to maintain compatibility)
        req.user = {
            uid: user.id, // Map DB 'id' to API 'uid'
            email: user.email,
            role: user.role,
            status: user.status,
            pharmacyName: user.pharmacy_name,
            branchId: user.branch_id,
            profile: {
                phone: user.phone,
                address: user.address,
                licenseNumber: user.license_number
            }
        };

        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

// Require specific role
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
}

// Log activity
async function logActivity(userId, action, resource, details = {}) {
    try {
        await query(
            'INSERT INTO activity_logs (user_id, action, resource_type, details) VALUES (:1, :2, :3, :4)',
            [userId, action, resource, JSON.stringify(details)]
        );
    } catch (error) {
        console.error('Activity logging error:', error);
    }
}

module.exports = {
    verifyToken,
    requireRole,
    logActivity
};
