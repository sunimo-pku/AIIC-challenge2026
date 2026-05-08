const chatContainer = document.getElementById('chatContainer');
const msgInput = document.getElementById('msgInput');
const chatStatus = document.getElementById('chatStatus');
const ttsStatus = document.getElementById('ttsStatus');
const ttsText = document.getElementById('ttsText');
const ttsSpeaker = document.getElementById('ttsSpeaker');
const ttsBtn = document.getElementById('ttsBtn');
const audioWrap = document.getElementById('audioWrap');
const ttsAudio = document.getElementById('ttsAudio');
const audioLabel = document.querySelector('.audio-label span');

msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});

msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
});

async function apiPost(path, body) {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

function createMsgRow(role, content) {
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;
    const avatarIcon = role === 'user' ? '👤' : '🤖';
    const name = role === 'user' ? '你' : 'Kimi';
    row.innerHTML = `
        <div class="avatar ${role}">${avatarIcon}</div>
        <div style="max-width:78%;">
            <div class="msg-bubble">${escapeHtml(content)}</div>
            ${role === 'bot' ? `
            <div class="msg-actions">
                <button onclick="copyText(this, '${encodeURIComponent(content)}')">📋 复制</button>
            </div>` : ''}
        </div>
    `;
    return row;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    chatContainer.appendChild(createMsgRow('user', text));
    chatStatus.textContent = 'Kimi 思考中...';
    showTyping();

    try {
        const data = await apiPost('/chat', { message: text });
        removeTyping();
        const reply = data.reply || '无响应';
        chatContainer.appendChild(createMsgRow('bot', reply));
        chatStatus.textContent = '就绪';
    } catch (err) {
        removeTyping();
        chatContainer.appendChild(createMsgRow('bot', '请求失败: ' + err.message));
        chatStatus.textContent = '请求失败';
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function copyText(btn, encoded) {
    const text = decodeURIComponent(encoded);
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✅ 已复制';
        setTimeout(() => btn.textContent = orig, 1500);
    });
}

async function doTTS() {
    const text = ttsText.value.trim();
    const speaker = ttsSpeaker.value.trim();
    if (!text) return alert('请输入要合成的文本');
    ttsBtn.disabled = true;
    ttsStatus.textContent = '合成中...';
    try {
        const data = await apiPost('/tts', { text, speaker });
        if (data.error) {
            alert('合成失败: ' + data.error);
            ttsStatus.textContent = '合成失败';
        } else {
            ttsAudio.src = 'data:audio/mp3;base64,' + data.audio_base64;
            audioLabel.textContent = text.length > 30 ? text.slice(0, 30) + '...' : text;
            audioWrap.classList.add('active');
            ttsAudio.play();
            ttsStatus.textContent = '合成完成';
        }
    } catch (err) {
        alert('请求异常: ' + err.message);
        ttsStatus.textContent = '请求异常';
    } finally {
        ttsBtn.disabled = false;
    }
}
