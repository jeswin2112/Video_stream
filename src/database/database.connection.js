import pg from 'pg';
import { DB } from '../constants/env.constants.js';

const { Pool } = pg;

const pool = new Pool({
    connectionString: DB.URL,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);
