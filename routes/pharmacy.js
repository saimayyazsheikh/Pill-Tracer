const express = require('express');
const { query } = require('../db/connection');
const { verifyToken, requireRole, logActivity } = require('../middleware/auth');
const oracledb = require('oracledb');

const router = express.Router();

// All pharmacy routes require authentication
router.use(verifyToken);
router.use(requireRole('pharmacy_admin'));

// Get pharmacy dashboard stats
router.get('/dashboard/stats', async (req, res) => {
    try {
        const branchId = req.user.branchId;

        // Get inventory count
        const countResult = await query(
            'SELECT COUNT(*) as total FROM inventory_records WHERE branch_id = :1',
            [branchId]
        );
        const inventoryCount = countResult[0].total;

        // Get total inventory value
        const valueResult = await query(
            'SELECT SUM(price * quantity) as totalValue FROM inventory_records WHERE branch_id = :1',
            [branchId]
        );
        const inventoryValue = valueResult[0].totalvalue || 0; // Case might vary, connection helper lowercases it

        // Get low stock count
        const lowStockResult = await query(
            'SELECT COUNT(*) as total FROM inventory_records WHERE branch_id = :1 AND quantity < 20',
            [branchId]
        );
        const lowStockCount = lowStockResult[0].total;

        // Get out of stock count
        const outStockResult = await query(
            'SELECT COUNT(*) as total FROM inventory_records WHERE branch_id = :1 AND quantity = 0',
            [branchId]
        );
        const outOfStockCount = outStockResult[0].total;

        res.json({
            success: true,
            data: {
                totalMedicines: inventoryCount,
                inventoryValue: parseFloat(inventoryValue),
                lowStock: lowStockCount,
                outOfStock: outOfStockCount
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard stats'
        });
    }
});

// Get pharmacy inventory
router.get('/inventory', async (req, res) => {
    try {
        const branchId = req.user.branchId;

        const sql = `
            SELECT 
                i.id,
                COALESCE(i.medicine_name, m.name) as medicine_name,
                COALESCE(i.description, m.description) as description,
                i.price,
                i.quantity,
                i.last_updated
            FROM inventory_records i
            LEFT JOIN medicines m ON i.medicine_id = m.id
            WHERE i.branch_id = :1
            ORDER BY medicine_name ASC
        `;

        const inventory = await query(sql, [branchId]);

        res.json({
            success: true,
            count: inventory.length,
            data: inventory
        });
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching inventory'
        });
    }
});

// Add medicine to pharmacy inventory
router.post('/inventory', async (req, res) => {
    try {
        const { medicine_id, price, quantity } = req.body;
        const branchId = req.user.branchId;

        if (!medicine_id || price === undefined || quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Check if medicine exists
        const medicines = await query('SELECT * FROM medicines WHERE id = :1', [medicine_id]);
        if (medicines.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Medicine not found'
            });
        }
        const medicine = medicines[0];

        // Check if already in inventory
        const existing = await query(
            'SELECT * FROM inventory_records WHERE medicine_id = :1 AND branch_id = :2',
            [medicine_id, branchId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Medicine already in your inventory'
            });
        }

        // Add to inventory
        const result = await query(
            'INSERT INTO inventory_records (medicine_id, branch_id, price, quantity, updated_by) VALUES (:1, :2, :3, :4, :5) RETURNING id INTO :6',
            [medicine_id, branchId, parseFloat(price), parseInt(quantity), req.user.uid, { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }]
        );

        await logActivity(req.user.uid, 'add', 'inventory', {
            medicine: medicine.name,
            price,
            quantity
        });

        res.json({
            success: true,
            message: 'Medicine added to inventory',
            data: {
                id: result.insertId,
                medicine_name: medicine.name,
                price,
                quantity
            }
        });
    } catch (error) {
        console.error('Add inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding to inventory'
        });
    }
});

// Add medicine directly (without master list)
router.post('/inventory/direct', async (req, res) => {
    try {
        const { medicine_name, description, price, quantity } = req.body;
        const branchId = req.user.branchId;

        if (!medicine_name || price === undefined || quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields (medicine_name, price, quantity)'
            });
        }

        // Check if medicine with same name already exists in this pharmacy's inventory
        const existing = await query(
            'SELECT * FROM inventory_records WHERE medicine_name = :1 AND branch_id = :2',
            [medicine_name, branchId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Medicine with this name already exists in your inventory'
            });
        }

        // Add to inventory directly (no medicine_id reference)
        const result = await query(
            'INSERT INTO inventory_records (medicine_name, description, branch_id, price, quantity, updated_by) VALUES (:1, :2, :3, :4, :5, :6) RETURNING id INTO :7',
            [medicine_name, description || '', branchId, parseFloat(price), parseInt(quantity), req.user.uid, { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }]
        );

        await logActivity(req.user.uid, 'add_direct', 'inventory', {
            medicine: medicine_name,
            price,
            quantity
        });

        res.json({
            success: true,
            message: 'Medicine added to inventory',
            data: {
                id: result.insertId,
                medicine_name,
                description,
                price,
                quantity
            }
        });
    } catch (error) {
        console.error('Add direct inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding to inventory'
        });
    }
});

// Update inventory item (full edit)
router.put('/inventory/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { medicine_name, description, price, quantity } = req.body;
        const branchId = req.user.branchId;

        const updateFields = [];
        const updateValues = [];
        let bindIndex = 1;

        if (medicine_name !== undefined) {
            updateFields.push(`medicine_name = :${bindIndex++}`);
            updateValues.push(medicine_name);
        }
        if (description !== undefined) {
            updateFields.push(`description = :${bindIndex++}`);
            updateValues.push(description);
        }
        if (price !== undefined) {
            updateFields.push(`price = :${bindIndex++}`);
            updateValues.push(parseFloat(price));
        }
        if (quantity !== undefined) {
            updateFields.push(`quantity = :${bindIndex++}`);
            updateValues.push(parseInt(quantity));
        }

        updateFields.push(`updated_by = :${bindIndex++}`);
        updateValues.push(req.user.uid);

        if (updateFields.length > 0) {
            updateValues.push(parseInt(id)); // Parse ID for Oracle
            updateValues.push(branchId);

            const result = await query(
                `UPDATE inventory_records SET ${updateFields.join(', ')} WHERE id = :${bindIndex++} AND branch_id = :${bindIndex++}`,
                updateValues
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Inventory item not found or access denied'
                });
            }
        }

        await logActivity(req.user.uid, 'update', 'inventory', { id, medicine_name, price, quantity });

        res.json({
            success: true,
            message: 'Medicine updated successfully'
        });
    } catch (error) {
        console.error('Update inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating inventory'
        });
    }
});

// Delete inventory item
router.delete('/inventory/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const branchId = req.user.branchId;

        const result = await query(
            'DELETE FROM inventory_records WHERE id = :1 AND branch_id = :2',
            [parseInt(id), branchId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Inventory item not found or access denied'
            });
        }

        await logActivity(req.user.uid, 'delete', 'inventory', { id });

        res.json({
            success: true,
            message: 'Medicine removed from inventory'
        });
    } catch (error) {
        console.error('Delete inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting inventory item'
        });
    }
});

// Search medicines from master list
router.get('/medicines/search', async (req, res) => {
    try {
        const { q } = req.query;

        let sql = 'SELECT * FROM medicines';
        const params = [];

        if (q) {
            // Case insensitive search in Oracle
            sql += ' WHERE UPPER(name) LIKE UPPER(:1)';
            params.push(`%${q}%`);
        }

        // Oracle Sort and Limit
        sql += ' ORDER BY name ASC FETCH FIRST 50 ROWS ONLY';

        const medicines = await query(sql, params);

        res.json({
            success: true,
            count: medicines.length,
            data: medicines
        });
    } catch (error) {
        console.error('Search medicines error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching medicines'
        });
    }
});

module.exports = router;
