const chatBox = document.getElementById('chatBox');
const msgInput = document.getElementById('msgInput');
const chatStatus = document.getElementById('chatStatus');
const ttsStatus = document.getElementById('ttsStatus');
const ttsText = document.getElementById('ttsText');
const ttsSpeaker = document.getElementById('ttsSpeaker');
const ttsBtn = document.getElementById('ttsBtn');
const audioWrap = document.getElementById('audioWrap');
const ttsAudio = document.getElementById('ttsAudio');

msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

async function apiPost(path, body) {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

async function sendChat() {
    const text = msgInput.value.trim();
    if (!text) return;
    appendMsg('user', text);
    msgInput.value = '';
    chatStatus.textContent = '请求中...';
    try {
        const data = await apiPost('/chat', { message: text });
        appendMsg('bot', data.reply || '无响应');
        chatStatus.textContent = '就绪';
    } catch (err) {
        appendMsg('bot', '请求失败: ' + err.message);
        chatStatus.textContent = '请求失败';
    }
}

function appendMsg(role, text) {
    const div = document.createElement('div');
    div.className = 'message ' + role;
    div.textContent = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
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
