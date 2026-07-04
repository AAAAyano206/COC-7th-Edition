import { createConnection } from 'mysql2/promise';

async function main() {
  const conn = await createConnection({
    uri: process.env.DATABASE_URL,
    ssl: {}
  });
  await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
  const [tables] = await conn.execute('SHOW TABLES') as any;
  for (const row of tables) {
    const tableName = Object.values(row)[0];
    await conn.execute('DROP TABLE IF EXISTS `' + tableName + '`');
    console.log('Dropped:', tableName);
  }
  await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
  console.log('All tables dropped!');
}

main().catch(console.error);
