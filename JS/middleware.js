import jwt from 'jsonwebtoken';
import { env } from './database.js';

export const verifyToken = (req, res, next) => {
    const token = req.cookies.token;

    // 1. 토큰 없음 (비인증 상태) -> 401
    if (!token) {
        return res.status(401).json({ success: false, message: "로그인이 필요합니다." });
    }

    try {
        const decoded = jwt.verify(token, env.jwtSecret);
        req.user = decoded;
        next();
    } catch (err) {
        // 2. 만료되었거나 잘못된 토큰 -> 401
        return res.status(401).json({ success: false, message: "유효하지 않은 세션입니다." });
    }
};

export const verifyTeacher = (req, res, next) => {
    const userPerm = Number(req.user.permission);
    if (userPerm === 0 || userPerm === 2) {
        next();
    } else {
        res.status(403).json({ success: false, message: "접근 권한이 없습니다." });
    }
};

export const requestContext = (req, res, next) => {
    req.db = env.db;
    next();
};