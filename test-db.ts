import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
    try {
        // Test raw query
        const result = await prisma.$queryRaw`SELECT current_database(), current_schema()`;
        console.log('✅ Database connection successful:', result);

        // Test table insert
        const integration = await prisma.$queryRaw`
      INSERT INTO integrations (id, name, method, url, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'Test Integration', 'GET', 'https://api.example.com', NOW(), NOW())
      RETURNING *
    `;
        console.log('✅ Insert successful:', integration);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
