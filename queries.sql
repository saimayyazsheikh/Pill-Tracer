-- ==========================================
-- PILL TRACER - SAMPLE SQL QUERIES
-- Usage: Open this file, Select a block, Right-Click -> Execute
-- ==========================================

-- 1. View all users
SELECT * FROM users;

-- 2. View all medicines (Global Master List)
SELECT * FROM medicines ORDER BY name;

-- 3. View your Inventory (What you have in stock)
SELECT * FROM inventory_records;

-- 4. View Inventory with Medicine Names (Joined)
SELECT 
    i.id,
    COALESCE(i.medicine_name, m.name) as medicine_name,
    i.price,
    i.quantity,
    b.name as pharmacy_name
FROM inventory_records i
LEFT JOIN medicines m ON i.medicine_id = m.id
LEFT JOIN branches b ON i.branch_id = b.id;

-- 5. Search for a specific medicine (e.g., 'Saim')
SELECT * FROM inventory_records 
WHERE UPPER(medicine_name) LIKE '%SAIM%';

-- 6. Check System Activity Logs
SELECT * FROM activity_logs ORDER BY timestamp DESC;
