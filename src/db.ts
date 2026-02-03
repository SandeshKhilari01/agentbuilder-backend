import { Pool } from 'pg';

// Use DATABASE_URL from environment or fallback to localhost with correct user
const connectionString = process.env.DATABASE_URL || 'postgresql://sandeshsonabakhilari@localhost:5432/agentbuilder';

console.log('🔌 Database connection string:', connectionString.replace(/:[^:@]+@/, ':****@')); // Mask password if any

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Test connection on startup
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

export default pool;
