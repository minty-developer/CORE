import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authService, problemService } from './services.js';
import { verifyToken, verifyTeacher } from './middleware.js';
import { query } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const htmlPath = (fileName) => path.resolve(__dirname, `../HTML/${fileName}`);

router.post('/send-email', (req, res) => authService.sendVerificationCode(req, res));
router.post('/signup', (req, res) => authService.signup(req, res));
router.post('/loginto', (req, res) => authService.login(req, res));
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

router.get('/api/students', verifyToken, verifyTeacher, async (req, res) => {
    try {
        const students = await query('SELECT id, username, permission, LV FROM users');
        res.json(students || []);
    } catch (err) {
        console.error('[STUDENTS] list failed:', err.message);
        res.status(500).json({ message: 'Student list load failed' });
    }
});

router.get('/api/students/:id', verifyToken, verifyTeacher, async (req, res) => {
    try {
        const [student] = await query('SELECT id, username, LV, email FROM users WHERE id = ?', [req.params.id]);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        res.json(student);
    } catch (err) {
        console.error('[STUDENTS] detail failed:', err.message);
        res.status(500).json({ message: 'Student detail load failed' });
    }
});

router.get('/api/user/activity/:id', verifyToken, async (req, res) => {
    try {
        const activityData = await query(`
            SELECT
                DATE_FORMAT(solved_at, '%Y-%m-%d') as date,
                COUNT(DISTINCT problem_id) as count
            FROM solve_history
            WHERE user_id = ?
            GROUP BY DATE_FORMAT(solved_at, '%Y-%m-%d')
            ORDER BY date ASC
        `, [req.params.id]);
        res.json(activityData || []);
    } catch (err) {
        console.error('[ACTIVITY] load failed:', err.message);
        res.json([]);
    }
});

router.get('/api/problems', (req, res) => problemService.getProblemList(req, res));
router.get('/api/problems/:id', (req, res) => problemService.getProblemDetail(req, res));
router.post('/api/problems/submit', verifyToken, (req, res) => problemService.submitCode(req, res));

router.get('/api/rank', async (req, res) => {
    try {
        const rows = await query(`
            SELECT
                u.id,
                u.username,
                COALESCE(u.LV, 1) AS LV,
                COUNT(DISTINCT sh.problem_id) AS solved_count
            FROM users u
            LEFT JOIN solve_history sh ON sh.user_id = u.id
            GROUP BY u.id, u.username, u.LV
            ORDER BY LV DESC, solved_count DESC, u.username ASC
        `);
        res.json(rows || []);
    } catch (err) {
        console.error('[RANK] load failed:', err.message);
        res.status(500).json({ message: 'Rank load failed' });
    }
});

router.get('/api/notices', async (req, res) => {
    try {
        const notices = await query('SELECT id, title, content, created_at FROM notice ORDER BY created_at DESC');
        res.json(notices || []);
    } catch (err) {
        console.error('[NOTICES] list failed:', err.message);
        res.status(500).json({ message: 'Notice list load failed' });
    }
});

router.get('/api/notices/:id', async (req, res) => {
    try {
        const [notice] = await query('SELECT id, title, content, created_at FROM notice WHERE id = ?', [req.params.id]);
        if (!notice) return res.status(404).json({ message: 'Notice not found' });
        res.json(notice);
    } catch (err) {
        console.error('[NOTICES] detail failed:', err.message);
        res.status(500).json({ message: 'Notice detail load failed' });
    }
});

router.get('/', (req, res) => res.sendFile(htmlPath('index.html')));
router.get('/login', (req, res) => res.sendFile(htmlPath('login.html')));
router.get('/Change_password', (req, res) => res.sendFile(htmlPath('Change_password.html')));
router.get('/resolve', (req, res) => res.sendFile(htmlPath('resolve.html')));
router.get('/rank', (req, res) => res.sendFile(htmlPath('rank.html')));
router.get('/MyPage', verifyToken, (req, res) => res.sendFile(htmlPath('Mypage.html')));
router.get('/students', verifyToken, verifyTeacher, (req, res) => res.sendFile(htmlPath('students.html')));
router.get('/students_detail/:id', verifyToken, verifyTeacher, (req, res) => res.sendFile(htmlPath('students_detail.html')));
router.get('/notice/:id', (req, res) => res.sendFile(htmlPath('notice_detail.html')));
router.get('/solve/:id', (req, res) => res.sendFile(htmlPath('solve_detail.html')));

router.get('/me', verifyToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

export default router;
