const express = require('express');
const { query } = require('../db/connection');

const router = express.Router();

// Search medicines with filters
router.get('/search', async (req, res) => {
    try {
        const { name, country, city, branch } = req.query;

        // Build SQL query
        // We start from inventory_records to include custom added medicines (where medicine_id is NULL)
        let sql = `
            SELECT 
                i.id as inventory_id,
                COALESCE(i.medicine_name, m.name) as medicine_name,
                COALESCE(i.description, m.description) as description,
                b.name as branch_name,
                b.address as branch_address,
                b.city,
                b.country,
                i.price,
                i.quantity,
                i.last_updated
            FROM inventory_records i
            LEFT JOIN medicines m ON i.medicine_id = m.id
            JOIN branches b ON i.branch_id = b.id
            WHERE 1=1
        `;

        const params = [];
        let bindIndex = 1;

        // Apply filters
        if (name && name.trim()) {
            sql += ` AND UPPER(COALESCE(i.medicine_name, m.name)) LIKE UPPER(:${bindIndex++})`;
            params.push(`%${name.trim()}%`);
        }

        if (country && country.trim()) {
            sql += ` AND b.country = :${bindIndex++}`;
            params.push(country.trim());
        }

        if (city && city.trim()) {
            sql += ` AND b.city = :${bindIndex++}`;
            params.push(city.trim());
        }

        if (branch && branch.trim()) {
            sql += ` AND UPPER(b.name) LIKE UPPER(:${bindIndex++})`;
            params.push(`%${branch.trim()}%`);
        }

        // Sort by medicine name and city
        sql += ' ORDER BY COALESCE(i.medicine_name, m.name) ASC, b.city ASC FETCH FIRST 100 ROWS ONLY';

        const results = await query(sql, params);

        res.json({
            success: true,
            count: results.length,
            data: results
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching medicines',
            error: error.message
        });
    }
});

// Get available filter options
router.get('/filters', async (req, res) => {
    try {
        // Get unique countries
        const countryResult = await query('SELECT DISTINCT country FROM branches WHERE country IS NOT NULL ORDER BY country');
        const countries = countryResult.map(row => row.country);

        // Get unique cities
        const cityResult = await query('SELECT DISTINCT city FROM branches WHERE city IS NOT NULL ORDER BY city');
        const cities = cityResult.map(row => row.city);

        res.json({
            success: true,
            data: {
                countries,
                cities
            }
        });
    } catch (error) {
        console.error('Filter error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching filters',
            error: error.message
        });
    }
});

module.exports = router;
