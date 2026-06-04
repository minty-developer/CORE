import { highlightCode } from './utiles.js';

const DOM = {
    get: (id) => document.getElementById(id),
    getAll: (selector) => document.querySelectorAll(selector),
};

async function readJson(res) {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error(`Expected JSON, got ${contentType || 'unknown content type'}`);
    }
    return res.json();
}

const UI = {
    toggleAuthForm: (type) => {
        const loginForm = DOM.get('loginForm');
        const signupForm = DOM.get('signupForm');
        const tabs = DOM.getAll('.tab-btn');
        if (!loginForm || !signupForm) return;

        const isLogin = type === 'login';
        loginForm.classList.toggle('active', isLogin);
        signupForm.classList.toggle('active', !isLogin);
        tabs[0]?.classList.toggle('active', isLogin);
        tabs[1]?.classList.toggle('active', !isLogin);
    },

    sendEmailCode: async (inputId = 'email') => {
        const email = DOM.get(inputId)?.value.trim();
        if (!email) return alert('Please enter your email.');
        if (!email.endsWith('@dsm.hs.kr')) return alert('Only @dsm.hs.kr email addresses are allowed.');

        try {
            const res = await fetch('/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await readJson(res);
            alert(data.message || (data.success ? 'Verification code sent.' : 'Send failed.'));
        } catch (err) {
            alert('Server communication failed.');
        }
    },
};

const UI_AUTH = {
    handleLogin: async (e) => {
        e.preventDefault();
        const username = DOM.get('login_username')?.value;
        const password = DOM.get('login_password')?.value;
        if (!username || !password) return alert('Please enter username and password.');

        try {
            const res = await fetch('/loginto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await readJson(res);
            if (data.success) {
                location.href = '/';
            } else {
                alert(data.message || 'Login failed.');
            }
        } catch (err) {
            alert('Server communication failed.');
        }
    },

    logout: async () => {
        try {
            await fetch('/logout', { method: 'POST' });
            location.href = '/';
        } catch (err) {
            console.error('Logout failed', err);
        }
    },
};

const APP = {
    initStreak: async (apiUrl) => {
        const board = DOM.get('streak-board');
        const totalSolvedEl = DOM.get('total-solved');
        if (!board) return;

        try {
            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error(`Activity request failed (${res.status})`);
            const history = await readJson(res);
            if (!Array.isArray(history)) throw new Error('Activity response is not an array.');

            const activityMap = {};
            let totalCount = 0;
            let displayYear = null;

            history.forEach((item) => {
                if (!item?.date) return;
                const dateKey = String(item.date).slice(0, 10);
                const itemYear = Number(dateKey.slice(0, 4));
                const count = Number(item.count) || 1;
                activityMap[dateKey] = (activityMap[dateKey] || 0) + count;
                totalCount += count;
                if (itemYear) displayYear = Math.max(displayYear || itemYear, itemYear);
            });

            if (totalSolvedEl) totalSolvedEl.innerText = totalCount;
            board.innerHTML = '';
            displayYear = displayYear || new Date().getFullYear();

            for (let m = 0; m < 12; m += 1) {
                const monthWrapper = document.createElement('div');
                monthWrapper.className = 'month-wrapper';

                const monthLabel = document.createElement('div');
                monthLabel.className = 'month-label';
                monthLabel.innerText = `${displayYear}.${m + 1}`;
                monthWrapper.appendChild(monthLabel);

                const monthGrid = document.createElement('div');
                monthGrid.className = 'month-grid';

                const startDate = new Date(displayYear, m, 1);
                const endDate = new Date(displayYear, m + 1, 0);

                for (let i = 0; i < startDate.getDay(); i += 1) {
                    const emptyCell = document.createElement('div');
                    emptyCell.className = 'streak-cell empty';
                    monthGrid.appendChild(emptyCell);
                }

                for (let d = 1; d <= endDate.getDate(); d += 1) {
                    const dateKey = `${displayYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const count = activityMap[dateKey] || 0;
                    const level = count > 0 ? Math.min(Math.ceil(count / 2), 4) : 0;

                    const cell = document.createElement('div');
                    cell.className = `streak-cell level-${level}`;
                    cell.title = `${dateKey}: ${count} solved`;
                    monthGrid.appendChild(cell);
                }

                monthWrapper.appendChild(monthGrid);
                board.appendChild(monthWrapper);
            }
        } catch (err) {
            console.error('Activity load failed:', err);
            if (totalSolvedEl) totalSolvedEl.innerText = '0';
            board.innerHTML = '<p class="loading-text">Activity data is not available yet.</p>';
        }
    },

    checkAuth: async () => {
        const loginBtn = DOM.get('login_button');
        if (!loginBtn) return;

        try {
            const res = await fetch('/me');
            if (!res.ok) return;
            const data = await readJson(res);
            if (data.success && data.user) {
                loginBtn.innerText = 'MyPage';
                loginBtn.href = '/MyPage';
            }
        } catch (err) {
            console.log('Not signed in');
        }
    },

    initMyPage: async () => {
        try {
            const res = await fetch('/me');
            const data = await readJson(res);
            if (!data.success || !data.user) return;

            const user = data.user;
            if (DOM.get('Name')) DOM.get('Name').innerText = user.username || 'User';
            if (DOM.get('LV')) DOM.get('LV').innerText = user.LV || '1';
            if (DOM.get('email')) DOM.get('email').innerText = user.email || '--';
            if (DOM.get('created_at')) DOM.get('created_at').innerText = user.created_at ? new Date(user.created_at).toLocaleDateString() : '--';
            if (DOM.get('Permission')) DOM.get('Permission').innerText = user.permission || '';

            APP.initStreak(`/api/user/activity/${user.id}`);
        } catch (err) {
            location.href = '/login';
        }
    },

    initStudentDetail: async () => {
        const studentId = window.location.pathname.split('/').pop();
        if (!studentId || isNaN(studentId)) return;

        try {
            const resProfile = await fetch(`/api/students/${studentId}`);
            if (!resProfile.ok) throw new Error(`Student request failed (${resProfile.status})`);
            const user = await readJson(resProfile);

            if (DOM.get('student_name')) DOM.get('student_name').innerText = user.username || 'Student';
            if (DOM.get('student_lv')) DOM.get('student_lv').innerText = `LV.${user.LV || 1}`;

            APP.initStreak(`/api/user/activity/${studentId}`);
        } catch (err) {
            console.error('Student detail load failed', err);
        }
    },

    initProblemList: async () => {
        const listBody = DOM.get('LST');
        if (!listBody) return;

        try {
            const res = await fetch('/api/problems');
            if (!res.ok) throw new Error(`Problem list request failed (${res.status})`);
            const problems = await readJson(res);
            if (!Array.isArray(problems)) throw new Error('Problem list response is not an array.');

            listBody.innerHTML = problems.map((p) => `
                <tr onclick="location.href='/solve/${p.id}'" style="cursor:pointer">
                    <td>${p.id}</td>
                    <td>${p.title}</td>
                    <td>${p.time_limit} / ${p.memory_limit}</td>
                    <td>LV.${p.difficulty}</td>
                    <td>${p.created_by || 'Admin'}</td>
                    <td>Unsolved</td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Problem list load failed', err);
            listBody.innerHTML = '<tr><td colspan="6">Problem list is not available.</td></tr>';
        }
    },

    initEditor: async () => {
        const problemId = window.location.pathname.split('/').pop();
        const editor = DOM.get('answerInput');
        const highlightLayer = DOM.get('highlightingLayer');
        const lineNumbers = DOM.get('lineNumbers');

        try {
            const res = await fetch(`/api/problems/${problemId}`);
            if (!res.ok) throw new Error(`Problem request failed (${res.status})`);
            const data = await readJson(res);
            if (DOM.get('problem_title')) DOM.get('problem_title').innerText = data.title;
            if (DOM.get('problem_diff')) DOM.get('problem_diff').innerText = `LV.${data.difficulty || '--'}`;
            if (DOM.get('problem_desc')) DOM.get('problem_desc').innerHTML = (data.description || '').replace(/\n/g, '<br>');
            if (DOM.get('problem_limit')) DOM.get('problem_limit').innerText = `${data.time_limit} / ${data.memory_limit}`;
        } catch (err) {
            console.error('Problem load failed', err);
        }

        if (editor && highlightLayer && lineNumbers) {
            const updateEditor = () => {
                const code = editor.value;
                highlightLayer.innerHTML = highlightCode(code);
                const lines = code.split('\n').length;
                lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
                highlightLayer.scrollTop = editor.scrollTop;
                lineNumbers.scrollTop = editor.scrollTop;
            };

            editor.focus();
            editor.addEventListener('input', updateEditor);
            editor.addEventListener('scroll', updateEditor);
            editor.addEventListener('keydown', (e) => {
                if (e.key !== 'Tab') return;
                e.preventDefault();
                const start = editor.selectionStart;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(editor.selectionEnd);
                editor.selectionStart = editor.selectionEnd = start + 4;
                updateEditor();
            });
            updateEditor();
        }

        const submitBtn = DOM.get('submitBtn');
        if (submitBtn && editor) {
            submitBtn.onclick = async () => {
                const res = await fetch('/api/problems/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ problemId, code: editor.value }),
                });
                const result = await readJson(res);
                if (DOM.get('resultDisplay')) DOM.get('resultDisplay').style.display = 'block';
                if (DOM.get('statusBadge')) DOM.get('statusBadge').innerText = result.status;
                if (DOM.get('outputMessage')) DOM.get('outputMessage').innerText = result.message;
            };
        }
    },

    initMain: async () => {
        await APP.checkAuth();

        try {
            const res = await fetch('/api/notices');
            if (!res.ok) throw new Error(`Notice request failed (${res.status})`);
            const notices = await readJson(res);
            const list = DOM.get('noticeList');
            if (!list) return;

            list.innerHTML = notices.map((n) => `
                <li onclick="location.href='/notice/${n.id}'" style="cursor:pointer">
                    <span class="date">${new Date(n.created_at).toLocaleDateString()}</span>
                    <span class="notice-content">${n.title || n.content}</span>
                </li>
            `).join('');
        } catch (err) {
            console.error('Notice load failed', err);
        }
    },

    initRank: async () => {
        const rankList = DOM.get('rank-list');
        if (!rankList) return;

        try {
            const res = await fetch('/api/rank');
            if (!res.ok) throw new Error(`Rank request failed (${res.status})`);
            const ranks = await readJson(res);
            if (!Array.isArray(ranks) || !ranks.length) {
                rankList.innerHTML = '<tr><td colspan="4">No rank data yet.</td></tr>';
                return;
            }

            rankList.innerHTML = ranks.map((user, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${user.username}</td>
                    <td>LV.${user.LV || 1}</td>
                    <td>${user.solved_count || 0}</td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Rank load failed', err);
            rankList.innerHTML = '<tr><td colspan="4">Rank data is not available.</td></tr>';
        }
    },

    initNoticeDetail: async () => {
        const noticeId = window.location.pathname.split('/').pop();
        if (!noticeId || isNaN(noticeId)) return;

        try {
            const res = await fetch(`/api/notices/${noticeId}`);
            if (!res.ok) throw new Error(`Notice detail request failed (${res.status})`);
            const notice = await readJson(res);
            if (DOM.get('notice_title')) DOM.get('notice_title').innerText = notice.title || 'Notice';
            if (DOM.get('notice_date')) DOM.get('notice_date').innerText = notice.created_at ? new Date(notice.created_at).toLocaleDateString() : '';
            if (DOM.get('notice_content')) DOM.get('notice_content').innerText = notice.content || '';
        } catch (err) {
            if (DOM.get('notice_content')) DOM.get('notice_content').innerText = 'Notice is not available.';
        }
    },

    initStudents: async () => {
        try {
            const res = await fetch('/api/students');
            if (!res.ok) throw new Error(`Student list request failed (${res.status})`);
            const students = await readJson(res);
            const listBody = DOM.get('student-list');
            if (!listBody) return;

            if (!Array.isArray(students) || !students.length) {
                listBody.innerHTML = '<li class="empty-state">No students to show.</li>';
                return;
            }

            listBody.innerHTML = '';
            students.forEach((s) => {
                const li = document.createElement('li');
                li.textContent = `${s.username} (LV.${s.LV})`;
                li.onclick = () => { location.href = `/students_detail/${s.id}`; };
                listBody.appendChild(li);
            });
        } catch (err) {
            console.error('Student list load failed', err);
        }
    },
};

window.showForm = UI.toggleAuthForm;
window.sendEmailCode = UI.sendEmailCode;
window.logout = UI_AUTH.logout;

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (DOM.get('login_submit_btn')) DOM.get('login_submit_btn').onclick = UI_AUTH.handleLogin;

    if (path.startsWith('/resolve')) APP.initProblemList();
    else if (path.startsWith('/solve')) APP.initEditor();
    else if (path.startsWith('/students_detail')) APP.initStudentDetail();
    else if (path.startsWith('/students')) APP.initStudents();
    else if (path.startsWith('/MyPage')) APP.initMyPage();
    else if (path.startsWith('/rank')) APP.initRank();
    else if (path.startsWith('/notice')) APP.initNoticeDetail();
    else if (path === '/' || path === '/index.html') APP.initMain();
});
