import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes.js';
import { env } from './database.js'; // env 불러오기
import { requestContext } from './middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: env.baseUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 경로
app.use('/CSS', express.static(path.resolve(__dirname, '../CSS')));
app.use('/JS', express.static(path.resolve(__dirname, '../JS')));
app.use(express.static(__dirname));

app.use(requestContext);
app.use('/', authRoutes);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`[BOOT] CORE server running on ${env.baseUrl}`);
});

server.on('error', (err) => {
    console.error('[BOOT] Server failed:', err);
    process.exitCode = 1;
});

export default server;
