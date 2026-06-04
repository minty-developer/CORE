// 1. 서버 로그 (프론트엔드에서 호출 가능)
export async function serverLog(msg, level = 'INFO') {
    // 브라우저 환경일 때만 fetch 사용
    if (typeof window !== 'undefined') {
        try {
            await fetch(`/api/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, level: level })
            });
        } catch (err) { console.error("로그 전송 실패:", err); }
    } else {
        // 서버 환경(Node.js)일 때는 바로 출력
        console.log(`[SERVER-LOG][${level}] ${msg}`);
    }
}

// 2. 비밀번호 해싱 함수 제거
// (비밀번호 해싱은 오직 services.js 등 서버 로직에서만 수행해야 합니다.)

// 3. 코드 하이라이팅 (프론트엔드 전용)
export function highlightCode(code) {
    if (!code) return "";
    let highlighted = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rules = [
        { regex: /\/\/.*/g, color: '#6a9955' },
        { regex: /"(.*?)"/g, color: '#ce9178' },
        { regex: /\b(int|float|double|char|void|long|short|unsigned|signed|struct|enum|static|extern)\b/g, color: '#569cd6' },
        { regex: /\b(if|else|for|while|do|switch|case|default|break|continue|return|goto|include|define)\b/g, color: '#c586c0' },
        { regex: /\b\d+\b/g, color: '#b5cea8' }
    ];
    rules.forEach(rule => {
        highlighted = highlighted.replace(rule.regex, (match) => `<span style="color: ${rule.color}">${match}</span>`);
    });
    return highlighted;
}