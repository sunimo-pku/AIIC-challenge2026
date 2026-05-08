const chatContainer = document.getElementById('chatContainer');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const chatStatus = document.getElementById('chatStatus');

let currentController = null;
let isComposing = false;

msgInput.addEventListener('compositionstart', () => { isComposing = true; });
msgInput.addEventListener('compositionend', () => { isComposing = false; });

msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
        e.preventDefault();
        sendChat();
    }
});

msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 140) + 'px';
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function createMsgRow(role, htmlContent) {
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;
    const avatarIcon = role === 'user' ? '👤' : '🤖';
    row.innerHTML = `
        <div class="avatar ${role}">${avatarIcon}</div>
        <div style="max-width:78%;">
            <div class="msg-bubble">${htmlContent}</div>
            ${role === 'bot' ? `
            <div class="msg-actions">
                <button onclick="copyText(this)">📋 复制</button>
            </div>` : ''}
        </div>
    `;
    return row;
}

function createStreamingRow() {
    const row = document.createElement('div');
    row.className = 'msg-row bot';
    row.id = 'streamingRow';
    row.innerHTML = `
        <div class="avatar bot">🤖</div>
        <div style="max-width:78%;">
            <div class="msg-bubble" id="streamBubble"><span class="cursor">▍</span></div>
        </div>
    `;
    return row;
}

function showTyping() {
    const row = document.createElement('div');
    row.className = 'msg-row bot';
    row.id = 'typingRow';
    row.innerHTML = `
        <div class="avatar bot">🤖</div>
        <div class="msg-bubble typing"><span></span><span></span><span></span></div>
    `;
    chatContainer.appendChild(row);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTyping() {
    const row = document.getElementById('typingRow');
    if (row) row.remove();
}

async function sendChat() {
    const text = msgInput.value.trim();
    if (!text) return;
    msgInput.value = '';
    msgInput.style.height = 'auto';
    chatContainer.appendChild(createMsgRow('user', escapeHtml(text)));

    sendBtn.disabled = true;
    stopBtn.style.display = 'inline-flex';
    chatStatus.textContent = 'Kimi 思考中...';
    showTyping();

    currentController = new AbortController();
    let fullText = '';

    try {
        const resp = await fetch('/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text }),
            signal: currentController.signal,
        });

        removeTyping();
        const row = createStreamingRow();
        chatContainer.appendChild(row);
        const bubble = document.getElementById('streamBubble');

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') {
                    bubble.innerHTML = escapeHtml(fullText);
                    bubble.id = '';
                    addCopyButton(row, fullText);
                    break;
                }
                if (data.startsWith('[ERROR]')) {
                    fullText += data;
                    bubble.innerHTML = escapeHtml(fullText);
                    break;
                }
                fullText += data;
                bubble.innerHTML = escapeHtml(fullText) + '<span class="cursor">▍</span>';
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }
        chatStatus.textContent = '就绪';
    } catch (err) {
        removeTyping();
        if (err.name === 'AbortError') {
            chatContainer.appendChild(createMsgRow('bot', '⏹️ 已停止生成'));
            chatStatus.textContent = '已停止';
        } else {
            chatContainer.appendChild(createMsgRow('bot', '请求失败: ' + err.message));
            chatStatus.textContent = '请求失败';
        }
    } finally {
        currentController = null;
        sendBtn.disabled = false;
        stopBtn.style.display = 'none';
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function stopChat() {
    if (currentController) {
        currentController.abort();
    }
}

function addCopyButton(row, text) {
    const actions = row.querySelector('.msg-actions');
    if (!actions) {
        const div = document.createElement('div');
        div.className = 'msg-actions';
        div.innerHTML = `<button onclick="copyText(this)">📋 复制</button>`;
        row.querySelector('div[style]').appendChild(div);
    }
}

function copyText(btn) {
    const bubble = btn.closest('.msg-row').querySelector('.msg-bubble');
    const text = bubble.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✅ 已复制';
        setTimeout(() => btn.textContent = orig, 1500);
    });
}
