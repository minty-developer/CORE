import nodemailer from 'nodemailer';
import { query, env } from './database.js';
import { serverLog } from './utiles.js';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { writeFileSync as fsWrite, unlinkSync as fsUnlink, existsSync as fsExists } from 'fs';
import { execSync as cpExec } from 'child_process';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: env.email.user,
        pass: env.email.pass
    }
});

export const sendMail = async (to, subject, html) => {
    try {
        await transporter.sendMail({
            from: `"CORE Admin" <${env.email.user}>`,
            to, subject, html
        });
        return { success: true };
    } catch (err) {
        console.error(`메일 발송 실패: ${err.message}`);
        throw err;
    }
};

export const authService = {
    async sendVerificationCode(req, res) {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "이메일이 누락되었습니다." });
        if (!email.endsWith('@dsm.hs.kr')) return res.status(400).json({ success: false, message: "DSM 메일만 가능합니다." });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`[인증코드 발송] ${email} : ${code}`);

        try {
            await sendMail(email, "CORE 인증 코드", `<h1>인증번호는 [${code}] 입니다.</h1>`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, message: "메일 발송 실패" });
        }
    },

    async signup(req, res) {
        const { username, password, email } = req.body;
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            // PostgreSQL 순서형 인덱스 적용 ($1, $2...)
            await query('INSERT INTO users (username, hashed_password, email, lv) VALUES ($1, $2, $3, $4)',
                [username, hashedPassword, email, 1]);
            res.status(201).json({ success: true, message: "회원가입 완료" });
        } catch (err) {
            res.status(500).json({ success: false, message: "이미 존재하는 계정이거나 DB 오류입니다." });
        }
    },

    async login(req, res) {
        const { username, password } = req.body;

        try {
            const rows = await query('SELECT * FROM users WHERE username = $1', [username]);
            if (rows.length === 0) {
                return res.status(401).json({ success: false, message: "사용자를 찾을 수 없습니다." });
            }

            const user = rows[0];
            const isMatch = await bcrypt.compare(password, user.hashed_password);

            if (!isMatch) {
                return res.status(401).json({ success: false, message: "비밀번호가 일치하지 않습니다." });
            }

            // ★ [버그 수정]: user.Permission -> user.permission (소문자로 변경하여 미들웨어와 통일)
            const token = jwt.sign(
                { id: user.id, permission: user.permission, username: user.username, email: user.email, lv: user.lv },
                env.jwtSecret,
                { expiresIn: '1h' }
            );

            res.cookie('token', token, { httpOnly: true, maxAge: 3600000, sameSite: 'lax' });
            res.json({ success: true, user: { name: user.username, lv: user.lv } });

        } catch (err) {
            console.error("로그인 서버 에러:", err);
            res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
        }
    }
};

export const problemService = {
    async getProblemList(req, res) {
        try {
            const problems = await query('SELECT * FROM problems');
            res.json(problems);
        } catch (err) {
            res.status(500).json({ message: "데이터 로드 실패" });
        }
    },
    async getProblemDetail(req, res) {
        const { id } = req.params;
        try {
            const rows = await query('SELECT * FROM problems WHERE id = $1', [id]);
            if (rows.length === 0) return res.status(404).send("문제 없음");
            res.json(rows[0]);
        } catch (err) {
            res.status(500).send("조회 실패");
        }
    },

    async submitCode(req, res) {
        const { problemId, code } = req.body;
        const fileName = `temp_${Date.now()}`;
        const cPath = path.join(process.cwd(), `${fileName}.c`);
        const exePath = path.join(process.cwd(), `${fileName}.exe`);

        if (!req.user || !req.user.id) {
            return res.status(401).json({ status: "Error", message: "로그인이 필요합니다." });
        }

        const userId = req.user.id;

        try {
            const testCases = await query(
                'SELECT input_data, expected_output FROM test_cases WHERE problem_id = $1',
                [problemId]
            );

            if (testCases.length === 0) return res.status(404).json({ status: "Error", message: "테스트 케이스가 없습니다." });

            fsWrite(cPath, code);

            try {
                cpExec(`gcc "${cPath}" -o "${exePath}"`);
            } catch (compileErr) {
                const errorMsg = compileErr.stderr?.toString() || "문법 에러가 발생했습니다.";
                return res.json({ status: "Compile Error", message: errorMsg });
            }

            let passedCount = 0;
            let failMessage = "";

            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                try {
                    const stdout = cpExec(`"${exePath}"`, {
                        input: String(tc.input_data),
                        timeout: 2000
                    }).toString().trim();

                    if (stdout === String(tc.expected_output).trim()) {
                        passedCount++;
                    } else {
                        failMessage = `결과: ${stdout}`;
                        break;
                    }
                } catch (runErr) {
                    return res.json({ status: "Runtime Error", message: `시간 초과 혹은 실행 오류 (TC ${i + 1})` });
                }
            }

            const isAccepted = passedCount === testCases.length;

            if (isAccepted) {
                try {
                    await query(
                        'INSERT INTO solve_history (user_id, problem_id) VALUES ($1, $2)',
                        [userId, problemId]
                    );
                    const progress = await query(
                        'SELECT COUNT(DISTINCT problem_id) AS solved_count FROM solve_history WHERE user_id = $1',
                        [userId]
                    );
                    const solvedCount = Number(progress[0]?.solved_count) || 0;
                    const nextLevel = Math.floor(solvedCount / 10) + 1;
                    await query('UPDATE users SET lv = $1 WHERE id = $2', [nextLevel, userId]);
                    console.log(`[STREAK] 유저 ${userId}번, ${problemId}번 문제 해결 기록 완료`);
                } catch (dbErr) {
                    console.error("활동 기록 저장 실패:", dbErr.message);
                }
            }

            res.json({
                status: isAccepted ? "Accepted" : "Wrong Answer",
                message: isAccepted ? `축하합니다! 모든 테스트 케이스를 통과했습니다.` : failMessage
            });

        } catch (err) {
            console.error("서버 에러:", err);
            res.status(500).json({ status: "Error", message: "채점 중 서버 오류가 발생했습니다." });
        } finally {
            try {
                if (fsExists(cPath)) fsUnlink(cPath);
                if (fsExists(exePath)) fsUnlink(exePath);
            } catch (e) {
                console.error("파일 삭제 실패:", e.message);
            }
        }
    }
};