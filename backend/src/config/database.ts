import mysql, { type Pool } from 'mysql2/promise';

export class DatabaseConfigurationError extends Error {
  constructor() {
    super('Database configuration is incomplete.');
    this.name = 'DatabaseConfigurationError';
  }
}

let pool: Pool | undefined;

export function getDatabasePool(): Pool {
  const requiredSettings = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'];
  if (requiredSettings.some((setting) => !process.env[setting])) {
    throw new DatabaseConfigurationError();
  }

  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: ['DATE'],
    });
  }

  return pool;
}