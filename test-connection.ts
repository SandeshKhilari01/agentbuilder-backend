import { Pool } from 'pg';

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'agentbuilder',
});

async function test() {
    try {
        const result = await pool.query('SELECT current_user, current_database(), version()');
        console.log('✅ Connection successful!');
        console.log('User:', result.rows[0].current_user);
        console.log('Database:', result.rows[0].current_database);
        console.log('Version:', result.rows[0].version);

        // Test insert
        const insertResult = await pool.query(
            `INSERT INTO integrations (id, name, method, url, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), 'Test Connection', 'GET', 'https://test.com', NOW(), NOW())
             RETURNING *`
        );
        console.log('✅ Insert successful!', insertResult.rows[0]);

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        await pool.end();
        process.exit(1);
    }
}

test();
