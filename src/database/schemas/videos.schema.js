import { query } from '../database.connection.js';

export const createVideosTable = async () => {
    const sql = `
    CREATE TABLE IF NOT EXISTS videos (
      id UUID PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      original_url VARCHAR(512) NOT NULL,
      hls_url VARCHAR(512),
      cloudflare_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    );
  `;
    try {
        await query(sql);
        console.log('PostgreSQL schema: videos table ready');
    } catch (err) {
        console.error('Error creating videos table:', err);
    }
};
