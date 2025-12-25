const express = require('express');
const { query } = require('../db/connection');
const { verifyToken, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// All super admin routes require authentication
router.use(verifyToken);
router.use(requireRole('super_admin'));

// Get system-wide dashboard stats
router.get('/dashboard/stats', async (req, res) => {
    try {
        const medResult = await query('SELECT COUNT(*) as total FROM medicines');
        const branchResult = await query('SELECT COUNT(*) as total FROM branches');
        const invResult = await query('SELECT COUNT(*) as total FROM inventory_records');
        const userResult = await query('SELECT COUNT(*) as total FROM users');
        const pendingResult = await query('SELECT COUNT(*) as total FROM users WHERE status = :1', ['pending']);

        res.json({
            success: true,
            data: {
                totalMedicines: medResult[0].total,
                totalBranches: branchResult[0].total,
                totalInventory: invResult[0].total,
                totalUsers: userResult[0].total,
                pendingApprovals: pendingResult[0].total
            }
        });
    } catch (error) {
        console.error('Admin dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard stats'
        });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await query('SELECT * FROM users ORDER BY created_at DESC');

        // Map to camelCase for frontend compatibility (connection helper does toLowerCase, so we match lowercase keys)
        const formattedUsers = users.map(user => ({
            id: user.id, // Renamed uid -> id
            uid: user.id, // Keep old property name for frontend compatibility
            email: user.email,
            pharmacyName: user.pharmacy_name,
            role: user.role,
            status: user.status,
            branchId: user.branch_id,
            profile: {
                phone: user.phone,
                address: user.address,
                licenseNumber: user.license_number
            },
            createdAt: user.created_at,
            lastLogin: user.last_login
        }));

        res.json({
            success: true,
            count: formattedUsers.length,
            data: formattedUsers
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users'
        });
    }
});

// Approve pharmacy
router.put('/users/:uid/approve', async (req, res) => {
    try {
        const { uid } = req.params;

        await query('UPDATE users SET status = :1 WHERE id = :2', ['approved', uid]);

        await logActivity(req.user.uid, 'approve', 'user', { uid });

        res.json({
            success: true,
            message: 'Pharmacy approved successfully'
        });
    } catch (error) {
        console.error('Approve user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving pharmacy'
        });
    }
});

// Suspend pharmacy
router.put('/users/:uid/suspend', async (req, res) => {
    try {
        const { uid } = req.params;

        await query('UPDATE users SET status = :1 WHERE id = :2', ['suspended', uid]);

        await logActivity(req.user.uid, 'suspend', 'user', { uid });

        res.json({
            success: true,
            message: 'Pharmacy suspended successfully'
        });
    } catch (error) {
        console.error('Suspend user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error suspending pharmacy'
        });
    }
});

// Get activity logs
router.get('/activity-logs', async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const logs = await query(
            'SELECT * FROM activity_logs ORDER BY timestamp DESC FETCH FIRST :1 ROWS ONLY',
            [parseInt(limit)]
        );

        res.json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity logs'
        });
    }
});

// Get all medicines (for super admin)
router.get('/medicines', async (req, res) => {
    try {
        const medicines = await query('SELECT * FROM medicines ORDER BY name ASC');

        res.json({
            success: true,
            count: medicines.length,
            data: medicines
        });
    } catch (error) {
        console.error('Get medicines error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching medicines'
        });
    }
});

// Get all branches (for super admin)
router.get('/branches', async (req, res) => {
    try {
        const branches = await query('SELECT * FROM branches ORDER BY city ASC, name ASC');

        res.json({
            success: true,
            count: branches.length,
            data: branches
        });
    } catch (error) {
        console.error('Get branches error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching branches'
        });
    }
});

module.exports = router;
