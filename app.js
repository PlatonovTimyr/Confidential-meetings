// ===== Confidential Meetings App v14 FINAL =====

const AppState = {
    userName: '',
    userEmoji: '😊',
    cameraEnabled: true,
    micEnabled: true,
    screenSharing: false,
    isHost: false,
    roomId: null,
    encryptionKeyStr: '',
    localStream: null,
    screenStream: null,
    peers: new Map(),
    room: null,
    sendSignal: null,
    sendChatMsg: null,
    sendUserInfo: null,
    scannerStream: null,
    isConnected: false,
    timerInterval: null,
    startTime: null,
    securityCheckInterval: null,
    previewStream: null,
    speechInterval: null,
    remoteSpeechInterval: null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const EMOJIS = ['😊', '😎', '🤗', '😇', '🙂', '😄', '🥳', '😌', '🤩', '😁', '😺', '🦊', '🐱', '🐼', '🐨', '🦁', '🐯', '🐸', '🦄', '🐙'];

window.onSecurityAlert = function(type, message, stats) {
    console.error('ТРЕВОГА:', type, message);
    const overlay = $('#alertOverlay');
    const layout = $('#meetingLayout');
    if (layout) { layout.style.filter = 'hue-rotate(140deg) saturate(3) brightness(0.7)'; }
    if (overlay) overlay.classList.remove('hidden');
    const alertIcon = $('#alertIcon'); if (alertIcon) alertIcon.textContent = '⚠️';
    const alertTitle = $('#alertTitle'); if (alertTitle) alertTitle.textContent = 'ОБНАРУЖЕНА АНОМАЛИЯ!';
    const alertMessage = $('#alertMessage'); if (alertMessage) alertMessage.textContent = message;
    let countdown = 15;
    const timerEl = $('#alertTimer');
    const ci = setInterval(() => { countdown--; if (timerEl) timerEl.textContent = `Автоотключение через ${countdown} сек`; if (countdown <= 0) { clearInterval(ci); dismissAlert(); } }, 1000);
    $('#alertDismissBtn').onclick = () => { clearInterval(ci); dismissAlert(); };
    $('#alertHangupBtn').onclick = () => { clearInterval(ci); hangUp(); };
};

function dismissAlert() {
    const overlay = $('#alertOverlay'); if (overlay) overlay.classList.add('hidden');
    const layout = $('#meetingLayout'); if (layout) layout.style.filter = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Confidential Meetings v14');
    setupMainScreen(); setupCreateScreen(); setupJoinScreen(); setupInviteScreen(); setupMeetingScreen();
    setTimeout(() => { if (!checkUrlForRoom()) { const ms = $('#mainScreen'); if (ms) ms.classList.remove('hidden'); } }, 500);
});

function getRandomEmoji() { return EMOJIS[Math.floor(Math.random() * EMOJIS.length)]; }

async function startCameraPreview(videoElement, avatarEmojiElement) {
    if (!videoElement) return null;
    try {
        stopCameraPreview();
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        AppState.previewStream = stream;
        videoElement.srcObject = stream;
        videoElement.classList.remove('hidden');
        if (avatarEmojiElement) avatarEmojiElement.classList.add('hidden');
        return stream;
    } catch (error) { if (videoElement) videoElement.classList.add('hidden'); if (avatarEmojiElement) avatarEmojiElement.classList.remove('hidden'); return null; }
}

function stopCameraPreview() { if (AppState.previewStream) { AppState.previewStream.getTracks().forEach(t => t.stop()); AppState.previewStream = null; } }

function switchScreen(screenId) {
    ['mainScreen','createScreen','joinScreen','inviteScreen','meetingScreen','scannerScreen'].forEach(id => { const el = $('#' + id); if (el) el.classList.add('hidden'); });
    const target = $('#' + screenId); if (target) target.classList.remove('hidden');
}

function startSpeechDetection(stream, cardSelector) {
    if (!stream) return null;
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ac.createAnalyser(); ac.createMediaStreamSource(stream).connect(analyser);
        analyser.fftSize = 256; const dataArray = new Uint8Array(analyser.frequencyBinCount);
        return setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a,b)=>a+b,0)/dataArray.length;
            const card = $(cardSelector); if (card) { if (avg > 30) card.classList.add('speaking'); else card.classList.remove('speaking'); }
        }, 200);
    } catch (e) { return null; }
}

function setupMainScreen() {
    $('#showCreateBtn')?.addEventListener('click', () => {
        AppState.userEmoji = getRandomEmoji(); const el = $('#createAvatarEmoji'); if (el) el.textContent = AppState.userEmoji;
        switchScreen('createScreen'); if ($('#createCameraToggle')?.checked) startCameraPreview($('#createPreviewVideo'), $('#createAvatarEmoji'));
    });
    $('#showJoinBtn')?.addEventListener('click', () => {
        AppState.userEmoji = getRandomEmoji(); const el = $('#joinAvatarEmoji'); if (el) el.textContent = AppState.userEmoji;
        switchScreen('joinScreen'); if ($('#joinCameraToggle')?.checked) startCameraPreview($('#joinPreviewVideo'), $('#joinAvatarEmoji'));
    });
}

function setupCreateScreen() {
    $('#createCameraToggle')?.addEventListener('change', function() { if (this.checked) startCameraPreview($('#createPreviewVideo'),$('#createAvatarEmoji')); else { stopCameraPreview(); $('#createPreviewVideo')?.classList.add('hidden'); $('#createAvatarEmoji')?.classList.remove('hidden'); } });
    $('#createMeetingBtn')?.addEventListener('click', async () => {
        AppState.userName = $('#createUserName')?.value.trim() || 'Организатор'; AppState.isHost = true;
        AppState.cameraEnabled = $('#createCameraToggle')?.checked ?? true; AppState.micEnabled = $('#createMicToggle')?.checked ?? true;
        try {
            stopCameraPreview();
            if (typeof CryptoModule !== 'undefined') { const keys = await CryptoModule.generateKeys(); AppState.encryptionKeyStr = btoa(String.fromCharCode(...new Uint8Array(keys.encryptionKey))); }
            AppState.roomId = generateRoomId();
            if (AppState.cameraEnabled) await captureMedia();
            initTrystero(); switchScreen('meetingScreen'); updateLocalDisplay(); updateHostUI(); startTimer();
            updateStatus('Защищённая встреча создана');
            const link = generateMeetingLink(); const ml = $('#meetingLink'); if (ml) ml.value = link;
            const kd = $('#encryptionKeyDisplay'); if (kd) kd.textContent = AppState.encryptionKeyStr.substring(0,32)+'...';
            const qc = $('#qrCanvas'); if (qc) await generateQRCode(qc, link);
        } catch (error) { alert('Ошибка: ' + error.message); }
    });
    $('#changeCreateAvatar')?.addEventListener('click', () => { const e = getRandomEmoji(); const el = $('#createAvatarEmoji'); if (el) el.textContent = e; AppState.userEmoji = e; });
}

function setupJoinScreen() {
    $('#joinCameraToggle')?.addEventListener('change', function() { if (this.checked) startCameraPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji')); else { stopCameraPreview(); $('#joinPreviewVideo')?.classList.add('hidden'); $('#joinAvatarEmoji')?.classList.remove('hidden'); } });
    $('#joinByLinkBtn')?.addEventListener('click', () => $('#linkInputGroup')?.classList.remove('hidden'));
    $('#joinByQRBtn')?.addEventListener('click', () => { stopCameraPreview(); switchScreen('scannerScreen'); startScanner(); });
    $('#connectByLinkBtn')?.addEventListener('click', async () => { const link = $('#meetingLinkInput')?.value.trim(); if (!link) return alert('Вставьте ссылку'); stopCameraPreview(); await parseAndJoin(link); });
    $('#changeJoinAvatar')?.addEventListener('click', () => { const e = getRandomEmoji(); const el = $('#joinAvatarEmoji'); if (el) el.textContent = e; AppState.userEmoji = e; });
    $('#backFromScanner')?.addEventListener('click', () => { stopScanner(); switchScreen('joinScreen'); if ($('#joinCameraToggle')?.checked) startCameraPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji')); });
}

function setupInviteScreen() {
    $('#inviteCameraToggle')?.addEventListener('change', function() { if (this.checked) startCameraPreview($('#invitePreviewVideo'),$('#inviteAvatarEmoji')); else { stopCameraPreview(); $('#invitePreviewVideo')?.classList.add('hidden'); $('#inviteAvatarEmoji')?.classList.remove('hidden'); } });
    $('#inviteConnectBtn')?.addEventListener('click', async () => {
        AppState.userName = $('#inviteUserName')?.value.trim() || 'Гость'; AppState.isHost = false;
        AppState.cameraEnabled = $('#inviteCameraToggle')?.checked ?? true; AppState.micEnabled = $('#inviteMicToggle')?.checked ?? true;
        if (!AppState.roomId) return alert('Не найдена комната');
        try { stopCameraPreview(); switchScreen('meetingScreen'); updateLocalDisplay(); updateHostUI(); startTimer(); updateStatus('Подключение...'); if (AppState.cameraEnabled) await captureMedia(); initTrystero(); } catch (error) { alert('Ошибка: ' + error.message); }
    });
    $('#changeInviteAvatar')?.addEventListener('click', () => { const e = getRandomEmoji(); const el = $('#inviteAvatarEmoji'); if (el) el.textContent = e; AppState.userEmoji = e; });
}

function updateHostUI() {
    const shareBtn = $('#shareBtn');
    if (shareBtn) { shareBtn.style.display = AppState.isHost ? 'flex' : 'none'; }
}

function setupMeetingScreen() {
    $('#micBtn')?.addEventListener('click', toggleMic);
    $('#cameraBtn')?.addEventListener('click', toggleCamera);
    $('#screenShareBtn')?.addEventListener('click', toggleScreenShare);
    $('#shareBtn')?.addEventListener('click', () => { if (!AppState.isHost) return; $('#sharePanel')?.classList.toggle('hidden'); $('#chatPanel')?.classList.add('hidden'); });
    $('#chatBtn')?.addEventListener('click', () => { $('#chatPanel')?.classList.toggle('hidden'); $('#sharePanel')?.classList.add('hidden'); });
    $('#hangupBtn')?.addEventListener('click', hangUp);
    $('#closeSharePanel')?.addEventListener('click', () => $('#sharePanel')?.classList.add('hidden'));
    $('#closeChatPanel')?.addEventListener('click', () => $('#chatPanel')?.classList.add('hidden'));
    $('#copyLinkBtn')?.addEventListener('click', () => { const i = $('#meetingLink'); if (i) { i.select(); document.execCommand('copy'); } const b = $('#copyLinkBtn'); if (b) { b.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => { b.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500); } });
    $('#sendMessageBtn')?.addEventListener('click', sendChatMessage);
    $('#chatInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
    $('#changeLocalAvatar')?.addEventListener('click', () => { const e = getRandomEmoji(); const el = $('#localAvatarEmoji'); if (el) el.textContent = e; AppState.userEmoji = e; if (AppState.sendUserInfo) sendMyInfo(); });
}

function sendMyInfo() {
    if (!AppState.sendUserInfo) return;
    AppState.sendUserInfo({ name: AppState.userName, hasVideo: AppState.cameraEnabled, emoji: AppState.userEmoji, role: AppState.isHost ? 'Организатор' : 'Участник' });
}

async function captureMedia() {
    try {
        AppState.localStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
        const at = AppState.localStream.getAudioTracks()[0]; if (at) at.enabled = AppState.micEnabled;
        const lv = $('#localVideo'); if (lv) { lv.srcObject = AppState.localStream; lv.parentElement?.classList.remove('hidden'); }
        $('#localAvatarWrapper')?.classList.add('hidden'); updateMicButton();
        if (AppState.speechInterval) clearInterval(AppState.speechInterval);
        AppState.speechInterval = startSpeechDetection(AppState.localStream, '#localCard');
    } catch (error) { AppState.cameraEnabled = false; $('#localVideo')?.parentElement?.classList.add('hidden'); $('#localAvatarWrapper')?.classList.remove('hidden'); }
}

async function toggleScreenShare() {
    if (AppState.screenSharing) { stopScreenShare(); return; }
    try {
        AppState.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        AppState.screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
        const ssv = $('#screenShareVideo'); if (ssv) ssv.srcObject = AppState.screenStream;
        $('#screenShareCard')?.classList.remove('hidden'); $('#screenShareBtn')?.classList.add('active');
        AppState.screenSharing = true;
        const st = AppState.screenStream.getVideoTracks()[0];
        AppState.peers.forEach(p => { try { p.addTrack(st, AppState.localStream); } catch(e){} });
        updateStatus('📺 Демонстрация экрана запущена');
    } catch (error) { console.error(error); }
}

function stopScreenShare() {
    if (AppState.screenStream) { AppState.screenStream.getTracks().forEach(t => t.stop()); AppState.screenStream = null; }
    const ssv = $('#screenShareVideo'); if (ssv) ssv.srcObject = null;
    $('#screenShareCard')?.classList.add('hidden'); $('#screenShareBtn')?.classList.remove('active');
    AppState.screenSharing = false; updateStatus('Демонстрация экрана остановлена');
}

function initTrystero() {
    if (!window.trysteroJoinRoom) { updateStatus('Ошибка модуля связи'); return; }
    console.log('🔗 Trystero. Комната:', AppState.roomId, 'Роль:', AppState.isHost ? 'ХОСТ' : 'ГОСТЬ');
    AppState.room = window.trysteroJoinRoom({ appId: 'conf-meet-v14-' + AppState.roomId }, 'meeting');
    const [sendSignal, getSignal] = AppState.room.makeAction('signal');
    const [sendChat, getChat] = AppState.room.makeAction('chat');
    const [sendUserInfo, getUserInfo] = AppState.room.makeAction('userInfo');
    AppState.sendSignal = sendSignal; AppState.sendChatMsg = sendChat; AppState.sendUserInfo = sendUserInfo;
    
    getSignal((data, peerId) => { console.log('📡 Сигнал от:', peerId); handleSignal(peerId, data); });
    getChat((data) => { if (data && data.text) displayChatMessage(data.sender || 'Собеседник', data.text, false); });
    getUserInfo((info) => { console.log('👤 Инфо:', info); updateRemoteUser(info); });
    
    AppState.room.onPeerJoin((peerId) => {
        console.log('🟢 Пир:', peerId);
        setTimeout(() => sendMyInfo(), 300);
        if (!AppState.isHost) { console.log('📞 Гость инициирует'); createPeer(peerId, true); }
        if (AppState.screenSharing && AppState.screenStream) {
            setTimeout(() => { const p = AppState.peers.get(peerId); if (p && AppState.screenStream) { try { p.addTrack(AppState.screenStream.getVideoTracks()[0], AppState.localStream); } catch(e){} } }, 2000);
        }
    });
    
    AppState.room.onPeerLeave((peerId) => {
        console.log('🔴 Пир ушёл:', peerId);
        const peer = AppState.peers.get(peerId); if (peer) peer.destroy();
        AppState.peers.delete(peerId);
        if (AppState.peers.size === 0) { $('#remoteVideo').srcObject = null; $('#remoteCard')?.classList.add('hidden'); $('#screenShareCard')?.classList.add('hidden'); $('#emptyState')?.classList.remove('hidden'); AppState.isConnected = false; updateStatus('Собеседник отключился'); }
        updateParticipantCount();
    });
}

function handleSignal(peerId, signalData) {
    let peer = AppState.peers.get(peerId); if (!peer) peer = createPeer(peerId, !AppState.isHost);
    try { peer.signal(signalData); } catch (e) { console.error(e); }
}

function createPeer(peerId, initiator) {
    console.log('🔧 Peer, инициатор:', initiator);
    const streams = []; if (AppState.localStream) streams.push(AppState.localStream); if (AppState.screenStream) streams.push(AppState.screenStream);
    const peer = new SimplePeer({ initiator, streams, trickle: true, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } });
    
    peer.on('signal', (data) => { if (AppState.sendSignal) AppState.sendSignal(data); });
    peer.on('stream', (stream) => {
        console.log('📥 Поток, дорожек:', stream.getTracks().length);
        const vt = stream.getVideoTracks();
        for (const track of vt) {
            const label = (track.label || '').toLowerCase();
            if (label.includes('screen') || label.includes('display') || label.includes('window')) {
                const ssv = $('#screenShareVideo'); if (ssv) ssv.srcObject = stream;
                $('#screenShareCard')?.classList.remove('hidden'); updateStatus('📺 Экран собеседника'); return;
            }
        }
        if (vt.length > 0 && !vt[0].label.toLowerCase().includes('screen')) {
            const rv = $('#remoteVideo'); if (rv) { rv.srcObject = stream; rv.parentElement?.classList.remove('hidden'); }
            $('#remoteAvatarWrapper')?.classList.add('hidden');
        }
        const at = stream.getAudioTracks();
        if (at.length > 0) { if (AppState.remoteSpeechInterval) clearInterval(AppState.remoteSpeechInterval); AppState.remoteSpeechInterval = startSpeechDetection(stream, '#remoteCard'); }
        $('#remoteCard')?.classList.remove('hidden'); $('#emptyState')?.classList.add('hidden');
        AppState.isConnected = true; updateStatus('✅ Соединение установлено'); updateParticipantCount();
    });
    
    peer.on('connect', () => updateStatus('🔄 Защищённый канал активен'));
    peer.on('close', () => { AppState.peers.delete(peerId); if (AppState.peers.size === 0) { $('#remoteVideo').srcObject = null; $('#remoteCard')?.classList.add('hidden'); $('#screenShareCard')?.classList.add('hidden'); $('#emptyState')?.classList.remove('hidden'); AppState.isConnected = false; } updateParticipantCount(); });
    peer.on('error', (err) => { console.error('Peer error:', err); });
    AppState.peers.set(peerId, peer); return peer;
}

function toggleMic() { if (AppState.localStream) { const at = AppState.localStream.getAudioTracks()[0]; if (at) { at.enabled = !at.enabled; AppState.micEnabled = at.enabled; updateMicButton(); } } }
function updateMicButton() { const b = $('#micBtn'); const i = $('#localMicIcon'); if (AppState.micEnabled) { if (b) b.classList.remove('off'); if (i) i.className = 'fas fa-microphone'; } else { if (b) b.classList.add('off'); if (i) i.className = 'fas fa-microphone-slash mic-off'; } }

function toggleCamera() {
    if (AppState.localStream) {
        const vt = AppState.localStream.getVideoTracks()[0];
        if (vt) { vt.enabled = !vt.enabled; AppState.cameraEnabled = vt.enabled;
            const b = $('#cameraBtn');
            if (AppState.cameraEnabled) { if (b) b.classList.remove('off'); $('#localVideo')?.parentElement?.classList.remove('hidden'); $('#localAvatarWrapper')?.classList.add('hidden'); }
            else { if (b) b.classList.add('off'); $('#localVideo')?.parentElement?.classList.add('hidden'); $('#localAvatarWrapper')?.classList.remove('hidden'); }
            sendMyInfo();
        }
    }
}

function sendChatMessage() { const ci = $('#chatInput'); if (!ci) return; const t = ci.value.trim(); if (!t) return; displayChatMessage(AppState.userName, t, true); if (AppState.sendChatMsg) AppState.sendChatMsg({ sender: AppState.userName, text: t, timestamp: Date.now() }); ci.value = ''; ci.focus(); }

function displayChatMessage(sender, text, isMine) {
    const cm = $('#chatMessages'); if (!cm) return;
    const div = document.createElement('div'); div.className = `chat-message ${isMine ? 'mine' : 'other'}`;
    div.innerHTML = `<span class="sender">${sender}</span><span class="text">${escapeHtml(text)}</span>`;
    const empty = cm.querySelector('.chat-empty'); if (empty) empty.remove();
    cm.appendChild(div); cm.scrollTop = cm.scrollHeight;
}

async function generateQRCode(canvas, data) { if (!canvas || !data) return; try { await QRCode.toCanvas(canvas, data, { width: 200, margin: 2, color: { dark: '#000', light: '#fff' } }); } catch(e){} }

async function startScanner() { try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); AppState.scannerStream = s; const sv = $('#scannerVideo'); if (sv) sv.srcObject = s; scanLoop(); } catch(e) { alert('Ошибка камеры'); switchScreen('joinScreen'); } }
function scanLoop() { const iv = setInterval(() => { if (!AppState.scannerStream) { clearInterval(iv); return; } const v = $('#scannerVideo'); if (!v || v.readyState < 2) return; const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0); const code = jsQR(ctx.getImageData(0,0,c.width,c.height).data, c.width, c.height); if (code && code.data) { clearInterval(iv); stopScanner(); parseAndJoin(code.data); } }, 100); }
function stopScanner() { if (AppState.scannerStream) { AppState.scannerStream.getTracks().forEach(t => t.stop()); AppState.scannerStream = null; } }

function parseHashParams() { const h = window.location.hash; if (!h || h === '#') return null; const hc = h.startsWith('#') ? h.slice(1) : h; const p = new URLSearchParams(hc); const r = p.get('room'); const k = p.get('key'); if (r) return { roomId: r, key: k }; if (hc.includes('room=')) { const parts = hc.split('&'); return { roomId: parts.find(x=>x.startsWith('room='))?.split('=')[1] || null, key: parts.find(x=>x.startsWith('key='))?.split('=')[1] || null }; } return null; }

async function parseAndJoin(link) { try { const u = new URL(link); const h = u.hash.slice(1); const p = new URLSearchParams(h); const r = p.get('room'); const k = p.get('key'); if (!r) return alert('Неверная ссылка'); AppState.roomId = r; AppState.isHost = false; AppState.userName = $('#joinUserName')?.value.trim() || 'Гость'; AppState.cameraEnabled = $('#joinCameraToggle')?.checked ?? true; AppState.micEnabled = $('#joinMicToggle')?.checked ?? true; if (k) AppState.encryptionKeyStr = k; await joinRoom(r); } catch(e) { alert('Неверный формат ссылки'); } }

async function joinRoom(roomId) { AppState.roomId = roomId; try { switchScreen('meetingScreen'); updateLocalDisplay(); updateHostUI(); startTimer(); updateStatus('Подключение...'); if (AppState.cameraEnabled) await captureMedia(); initTrystero(); } catch(e) { alert('Ошибка: '+e.message); } }

function checkUrlForRoom() { const p = parseHashParams(); if (p && p.roomId) { AppState.roomId = p.roomId; AppState.isHost = false; if (p.key) AppState.encryptionKeyStr = p.key; $$('.screen').forEach(s => s.classList.add('hidden')); const is = $('#inviteScreen'); if (is) is.classList.remove('hidden'); setTimeout(() => { const qc = $('#inviteQRCanvas'); if (qc) generateQRCode(qc, window.location.href); }, 500); setTimeout(() => { if ($('#inviteCameraToggle')?.checked) startCameraPreview($('#invitePreviewVideo'),$('#inviteAvatarEmoji')); }, 800); return true; } return false; }

function updateLocalDisplay() {
    const role = AppState.isHost ? 'Организатор' : 'Участник';
    const ln = $('#localName'); if (ln) ln.textContent = (AppState.userName || 'Вы') + ' • ' + role;
    const lae = $('#localAvatarEmoji'); if (lae) lae.textContent = AppState.userEmoji;
    if (AppState.cameraEnabled) { $('#localVideo')?.parentElement?.classList.remove('hidden'); $('#localAvatarWrapper')?.classList.add('hidden'); }
    else { $('#localVideo')?.parentElement?.classList.add('hidden'); $('#localAvatarWrapper')?.classList.remove('hidden'); }
    if (AppState.isHost) $('#hostChip')?.classList.remove('hidden'); else $('#hostChip')?.classList.add('hidden');
    updateMicButton();
}

function updateRemoteUser(info) {
    if (!info || !info.name) return;
    const name = info.name; const role = info.role || ''; const hasVideo = info.hasVideo !== undefined ? info.hasVideo : true;
    const rn = $('#remoteName'); if (rn) rn.textContent = name + (role ? ' • ' + role : '');
    const re = document.querySelector('#remoteAvatarWrapper .avatar-emoji'); if (re && info.emoji) re.textContent = info.emoji;
    $('#remoteCard')?.classList.remove('hidden'); $('#emptyState')?.classList.add('hidden');
    if (!hasVideo) { $('#remoteVideo')?.parentElement?.classList.add('hidden'); $('#remoteAvatarWrapper')?.classList.remove('hidden'); }
    else { $('#remoteVideo')?.parentElement?.classList.remove('hidden'); $('#remoteAvatarWrapper')?.classList.add('hidden'); }
    updateParticipantCount();
}

function updateParticipantCount() { const pc = $('#participantCount'); if (pc) pc.textContent = AppState.peers.size + 1; }
function updateStatus(text) { const ms = $('#meetingStatus'); if (ms) ms.textContent = text; }

function startTimer() { AppState.startTime = Date.now(); if (AppState.timerInterval) clearInterval(AppState.timerInterval); AppState.timerInterval = setInterval(() => { const e = Math.floor((Date.now()-AppState.startTime)/1000); const m = Math.floor(e/60).toString().padStart(2,'0'); const s = (e%60).toString().padStart(2,'0'); const td = $('#timerDisplay'); if (td) td.textContent = `${m}:${s}`; }, 1000); }

function hangUp() {
    AppState.peers.forEach(p => { try { p.destroy(); } catch(e){} }); AppState.peers.clear();
    if (AppState.room) { try { AppState.room.leave(); } catch(e){} AppState.room = null; }
    if (AppState.localStream) { AppState.localStream.getTracks().forEach(t => t.stop()); AppState.localStream = null; }
    if (AppState.speechInterval) clearInterval(AppState.speechInterval);
    if (AppState.remoteSpeechInterval) clearInterval(AppState.remoteSpeechInterval);
    stopScreenShare(); stopScanner(); stopCameraPreview();
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.isHost = false; AppState.roomId = null; AppState.isConnected = false;
    AppState.sendSignal = null; AppState.sendChatMsg = null; AppState.sendUserInfo = null;
    $('#alertOverlay')?.classList.add('hidden'); const ml = $('#meetingLayout'); if (ml) ml.style.filter = 'none';
    switchScreen('mainScreen'); window.location.hash = '';
}

function goToMain() { stopCameraPreview(); stopScanner(); switchScreen('mainScreen'); }
function generateRoomId() { return 'meet-' + Math.random().toString(36).substring(2,10) + Date.now().toString(36); }
function generateMeetingLink() { const b = window.location.href.split('#')[0].replace(/index\.html$/,''); return `${b}#room=${AppState.roomId}&key=${AppState.encryptionKeyStr}`; }
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
window.addEventListener('beforeunload', hangUp);