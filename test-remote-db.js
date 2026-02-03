const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Fix for self-signed certificates in some hosted DBs (like Heroku/Render/Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function test() {
    console.log('🔌 Connecting to:', process.env.DATABASE_URL?.split('@')[1] || 'URL not set');

    try {
        const client = await pool.connect();
        const result = await client.query('SELECT current_user, current_database(), version()');
        console.log('✅ Connection successful!');
        console.log('User:', result.rows[0].current_user);
        console.log('Database:', result.rows[0].current_database);
        console.log('Version:', result.rows[0].version);
        client.release();
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        if (error.code === '28P01') {
            console.error('💡 Hint: Check your username and password.');
        } else if (error.code === '3D000') {
            console.error('💡 Hint: Database does not exist.');
        } else if (error.code === 'ENOTFOUND') {
            console.error('💡 Hint: Hostname not found. Check the host URL.');
        } else if (error.message.includes('SSL')) {
            console.error('💡 Hint: SSL issue. Try adding ?sslmode=require to your JDBC url or use the SSL config.');
        }
        process.exit(1);
    }
}

test();
