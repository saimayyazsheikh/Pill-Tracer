const oracledb = require('oracledb');
require('dotenv').config();

// Enable Thin Mode (pure JS)
try {
  // Only init if needed (passed libDir via env, though Thin mode is default now)
  if (process.env.ORACLE_LIB_DIR) {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_LIB_DIR });
  }
} catch (err) {
  console.log('Oracle Thin Mode or Client initialization note:', err.message);
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

const dbConfig = {
  user: process.env.DB_USER || 'system',
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING || '127.0.0.1:1521/XE'
};

let pool;

async function connectToDatabase() {
  try {
    if (!pool) {
      pool = await oracledb.createPool(dbConfig);
      console.log('✅ Successfully connected to Oracle Database');

      // Initialize schema
      await initializeSchema();
    }
    return pool;
  } catch (error) {
    console.error('❌ Oracle connection error:', error);
    throw error;
  }
}

async function query(sql, params = []) {
  let connection;
  try {
    if (!pool) await connectToDatabase();

    // Oracle bind formatting
    // If params is an array, it's fine for positional binders :1, :2 etc if SQL uses them?
    // OR standard `?` is NOT supported. Oracledb uses `:name` or `:1`.
    // My migration plan says I will update the SQL.
    // But the calling code might still pass array [v1, v2].
    // If SQL uses `:1`, `:2` this works.
    // If SQL uses `:id`, params must be object { id: v1 }.

    connection = await pool.getConnection();

    // Debug
    // console.log('SQL:', sql);
    // console.log('Params:', params);

    const result = await connection.execute(sql, params, {
      autoCommit: true
    });

    if (result.rows) {
      // Lowercase keys
      return result.rows.map(row => {
        const newRow = {};
        for (const key in row) {
          newRow[key.toLowerCase()] = row[key];
        }
        return newRow;
      });
    }

    return {
      affectedRows: result.rowsAffected,
      insertId: (result.outBinds && Array.isArray(result.outBinds) && result.outBinds.length > 0)
        ? result.outBinds[0][0]
        : (result.outBinds && result.outBinds.id && result.outBinds.id[0])
          ? result.outBinds.id[0]
          : null
    };

  } catch (error) {
    console.error('Query error:', error);
    // console.error('SQL was:', sql);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

async function initializeSchema() {
  const fs = require('fs');
  const path = require('path');

  try {
    // Check if substantial tables exist
    // Query returns lowercase keys
    const result = await query(
      "SELECT table_name FROM user_tables WHERE table_name IN ('BRANCHES', 'USERS', 'MEDICINES', 'INVENTORY_RECORDS', 'ACTIVITY_LOGS')"
    );

    // We expect 5 tables. If fewer, something is missing.
    // Also handling case where query fails (e.g. connection issue)
    if (result.length < 5) {
      console.log(`⚠️  Schema check: Found ${result.length}/5 tables. Missing: 5 required vs ${result.length} found.`);
      console.log('   Found tables:', result.map(t => t.table_name));
      console.log('   Initializing schema...');

      const schemaPath = path.join(__dirname, 'schema_oracle.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      const statements = schemaSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      let connection;
      try {
        connection = await pool.getConnection();
        for (const sql of statements) {
          try {
            await connection.execute(sql);
          } catch (e) {
            // ORA-00955: name is already used by an existing object
            if (!e.message.includes('ORA-00955')) {
              console.error('Schema Error statement:', sql);
              console.error('Schema Error:', e.message);
            }
          }
        }
        console.log('✅ Schema initialized successfully');
      } finally {
        if (connection) await connection.close();
      }
    }
  } catch (err) {
    console.error('Schema initialization check failed:', err);
  }
}

async function closeConnection() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Oracle connection closed');
  }
}

module.exports = {
  connectToDatabase,
  query,
  closeConnection
};
