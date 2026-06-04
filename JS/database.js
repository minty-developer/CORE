import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '.env') });

export const env = {
    port: process.env.PORT || 3000,
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET,
    databaseUrl: process.env.DATABASE_URL, // Supabase 연결 문자열 (postgresql://...)
    email: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
};

// PostgreSQL 연결 풀 생성
const pool = new pg.Pool({
    connectionString: env.databaseUrl,
    ssl: {
        rejectUnauthorized: false // 클라우드 DB 보안 연결 필수 설정
    }
});

// 기존 query 함수 규격을 유지하여 다른 파일의 수정을 최소화합니다.
export async function query(sql, params) {
    const res = await pool.query(sql, params);
    return res.rows; // PostgreSQL은 결과가 res.rows에 배열로 담깁니다.
}

export default pool;