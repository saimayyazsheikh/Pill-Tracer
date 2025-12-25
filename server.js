const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { connectToDatabase } = require('./db/connection');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const pharmacyRoutes = require('./routes/pharmacy');
const superAdminRoutes = require('./routes/super-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/super-admin', superAdminRoutes);

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Pill Tracer API is running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

// Start server
async function startServer() {
    try {
        // Connect to Oracle
        await connectToDatabase();

        // Start Express server
        app.listen(PORT, () => {
            console.log('\n🚀 Pill Tracer Server Started!\n');
            console.log(`📍 Server running at: http://localhost:${PORT}`);
            console.log(`🗄️  Database: Oracle Database (${process.env.DB_USER || 'system'})`);
            console.log(`🔐 Authentication: Firebase`);
            console.log('\n✨ Ready to serve requests!\n');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
