// ===== Confidential Meetings App v10 =====

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
    remoteSpeechInterval: null,
    hasRemotePeer: false
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const EMOJIS = ['😊', '😎', '🤗', '😇', '🙂', '😄', '🥳', '😌', '🤩', '😁', '😺', '🦊', '🐱', '🐼', '🐨', '🦁', '🐯', '🐸', '🦄', '🐙'];

// ===== Обработчик тревог =====
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
    const ci = setInterval(() => {
        countdown--;
        if (timerEl) timerEl.textContent = `Автоотключение через ${countdown} сек`;
        if (countdown <= 0) { clearInterval(ci); dismissAlert(); }
    }, 1000);
    
    $('#alertDismissBtn').onclick = () => { clearInterval(ci); dismissAlert(); };
    $('#alertHangupBtn').onclick = () => { clearInterval(ci); hangUp(); };
};

function dismissAlert() {
    $('#alertOverlay')?.classList.add('hidden');
    const ml = $('#meetingLayout'); if (ml) ml.style.filter = 'none';
}

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Confidential Meetings v10');
    setupMainScreen();
    setupCreateScreen();
    setupJoinScreen();
    setupInviteScreen();
    setupMeetingScreen();
    setTimeout(() => { if (!checkUrlForRoom()) { $('#mainScreen')?.classList.remove('hidden'); } }, 500);
});

function getRandomEmoji() { return EMOJIS[Math.floor(Math.random() * EMOJIS.length)]; }

// ===== Предпросмотр камеры =====
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
    } catch (error) {
        if (videoElement) videoElement.classList.add('hidden');
        if (avatarEmojiElement) avatarEmojiElement.classList.remove('hidden');
        return null;
    }
}

function stopCameraPreview() {
    if (AppState.previewStream) { AppState.previewStream.getTracks().forEach(t => t.stop()); AppState.previewStream = null; }
}

function switchScreen(screenId) {
    ['mainScreen','createScreen','joinScreen','inviteScreen','meetingScreen','scannerScreen'].forEach(id => {
        const el = $('#' + id); if (el) el.classList.add('hidden');
    });
    const target = $('#' + screenId); if (target) target.classList.remove('hidden');
}

// ===== Индикатор речи =====
function startSpeechDetection(stream, cardSelector) {
    if (!stream) return null;
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        audioContext.createMediaStreamSource(stream).connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        return setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const card = $(cardSelector);
            if (card) { if (avg > 30) card.classList.add('speaking'); else card.classList.remove('speaking'); }
        }, 200);
    } catch (e) { return null; }
}

// ===== Главный экран =====
function setupMainScreen() {
    $('#showCreateBtn')?.addEventListener('click', () => {
        AppState.userEmoji = getRandomEmoji();
        const el = $('#createAvatarEmoji'); if (el) el.textContent = AppState.userEmoji;
        switchScreen('createScreen');
        if ($('#createCameraToggle')?.checked) startCameraPreview($('#createPreviewVideo'), $('#createAvatarEmoji'));
    });
    $('#showJoinBtn')?.addEventListener('click', () => {
        AppState.userEmoji = getRandomEmoji();
        const el = $('#joinAvatarEmoji'); if (el) el.textContent = AppState.userEmoji;
        switchScreen('joinScreen');
        if ($('#joinCameraToggle')?.checked) startCameraPreview($('#joinPreviewVideo'), $('#joinAvatarEmoji'));
    });
}

// ===== Экран создания =====
function setupCreateScreen() {
    $('#createCameraToggle')?.addEventListener('change', function() {
        if (this.checked) startCameraPreview($('#createPreviewVideo'), $('#createAvatarEmoji'));
        else { stopCameraPreview(); $('#createPreviewVideo')?.classList.add('hidden'); $('#createAvatarEmoji')?.classList.remove('hidden'); }
    });
    
    $('#createMeetingBtn')?.addEventListener('click', async () => {
        AppState.userName = $('#createUserName')?.value.trim() || 'Организатор';
        AppState.isHost = true;
        AppState.hasRemotePeer = false;
        AppState.cameraEnabled = $('#createCameraToggle')?.checked ?? true;
        AppState.micEnabled = $('#createMicToggle')?.checked ?? true;
        
        try {
            stopCameraPreview();
            if (typeof CryptoModule !== 'undefined') {
                const keys = await CryptoModule.generateKeys();
                AppState.encryptionKeyStr = btoa(String.fromCharCode(...new Uint8Array(keys.encryptionKey)));
            }
            AppState.roomId = generateRoomId();
            
            switchScreen('meetingScreen');
            updateLocalDisplay();
            startTimer();
            
            // Скрываем remote card, показываем empty state
            $('#remoteCard')?.classList.add('hidden');
            $('#emptyState')?.classList.remove('hidden');
            updateStatus('Ожидание участников...');
            
            if (AppState.cameraEnabled) await captureMedia();
            initTrystero();
            
            const link = generateMeetingLink();
            const meetingLinkInput = $('#meetingLink'); if (meetingLinkInput) meetingLinkInput.value = link;
            const keyDisplay = $('#encryptionKeyDisplay'); if (keyDisplay) keyDisplay.textContent = AppState.encryptionKeyStr.substring(0, 32) + '...';
            const qrCanvas = $('#qrCanvas'); if (qrCanvas) await generateQRCode(qrCanvas, link);
        } catch (error) { alert('Ошибка: ' + error.message); }
    });
    
    $('#changeCreateAvatar')?.addEventListener('click', () => {
        const emoji = getRandomEmoji(); const el = $('#createAvatarEmoji'); if (el) el.textContent = emoji;
        AppState.userEmoji = emoji;
    });
}

// ===== Экран присоединения =====
function setupJoinScreen() {
    $('#joinCameraToggle')?.addEventListener('change', function() {
        if (this.checked) startCameraPreview($('#joinPreviewVideo'), $('#joinAvatarEmoji'));
        else { stopCameraPreview(); $('#joinPreviewVideo')?.classList.add('hidden'); $('#joinAvatarEmoji')?.classList.remove('hidden'); }
    });
    $('#joinByLinkBtn')?.addEventListener('click', () => $('#linkInputGroup')?.classList.remove('hidden'));
    $('#joinByQRBtn')?.addEventListener('click', () => { stopCameraPreview(); switchScreen('scannerScreen'); startScanner(); });
    $('#connectByLinkBtn')?.addEventListener('click', async () => {
        const link = $('#meetingLinkInput')?.value.trim();
        if (!link) return alert('Вставьте ссылку');
        stopCameraPreview(); await parseAndJoin(link);
    });
    $('#changeJoinAvatar')?.addEventListener('click', () => {
        const emoji = getRandomEmoji(); const el = $('#joinAvatarEmoji'); if (el) el.textContent = emoji;
        AppState.userEmoji = emoji;
    });
    $('#backFromScanner')?.addEventListener('click', () => {
        stopScanner(); switchScreen('joinScreen');
        if ($('#joinCameraToggle')?.checked) startCameraPreview($('#joinPreviewVideo'), $('#joinAvatarEmoji'));
    });
}

// ===== Экран приглашения =====
function setupInviteScreen() {
    $('#inviteCameraToggle')?.addEventListener('change', function() {
        if (this.checked) startCameraPreview($('#invitePreviewVideo'), $('#inviteAvatarEmoji'));
        else { stopCameraPreview(); $('#invitePreviewVideo')?.classList.add('hidden'); $('#inviteAvatarEmoji')?.classList.remove('hidden'); }
    });
    
    $('#inviteConnectBtn')?.addEventListener('click', async () => {
        AppState.userName = $('#inviteUserName')?.value.trim() || 'Гость';
        AppState.cameraEnabled = $('#inviteCameraToggle')?.checked ?? true;
        AppState.micEnabled = $('#inviteMicToggle')?.checked ?? true;
        AppState.isHost = false;
        AppState.hasRemotePeer = false;
        if (!AppState.roomId) return alert('Не найдена комната');
        
        try {
            stopCameraPreview();
            switchScreen('meetingScreen');
            updateLocalDisplay();
            startTimer();
            $('#remoteCard')?.classList.add('hidden');
            $('#emptyState')?.classList.remove('hidden');
            updateStatus('Подключение...');
            
            if (AppState.cameraEnabled) await captureMedia();
            initTrystero();
        } catch (error) { alert('Ошибка: ' + error.message); }
    });
    
    $('#changeInviteAvatar')?.addEventListener('click', () => {
        const emoji = getRandomEmoji(); const el = $('#inviteAvatarEmoji'); if (el) el.textContent = emoji;
        AppState.userEmoji = emoji;
    });
}

// ===== Экран встречи =====
function setupMeetingScreen() {
    $('#micBtn')?.addEventListener('click', toggleMic);
    $('#cameraBtn')?.addEventListener('click', toggleCamera);
    $('#screenShareBtn')?.addEventListener('click', toggleScreenShare);
    $('#shareBtn')?.addEventListener('click', () => { $('#sharePanel')?.classList.toggle('hidden'); $('#chatPanel')?.classList.add('hidden'); });
    $('#chatBtn')?.addEventListener('click', () => { $('#chatPanel')?.classList.toggle('hidden'); $('#sharePanel')?.classList.add('hidden'); });
    $('#hangupBtn')?.addEventListener('click', hangUp);
    $('#closeSharePanel')?.addEventListener('click', () => $('#sharePanel')?.classList.add('hidden'));
    $('#closeChatPanel')?.addEventListener('click', () => $('#chatPanel')?.classList.add('hidden'));
    
    $('#copyLinkBtn')?.addEventListener('click', () => {
        const input = $('#meetingLink'); if (input) { input.select(); document.execCommand('copy'); }
        const btn = $('#copyLinkBtn'); if (btn) { btn.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500); }
    });
    
    $('#sendMessageBtn')?.addEventListener('click', sendChatMessage);
    $('#chatInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
    
    $('#changeLocalAvatar')?.addEventListener('click', () => {
        const emoji = getRandomEmoji(); const el = $('#localAvatarEmoji'); if (el) el.textContent = emoji;
        AppState.userEmoji = emoji;
        if (AppState.sendUserInfo) sendMyInfo();
    });
}

// ===== Отправка информации о себе =====
function sendMyInfo() {
    if (!AppState.sendUserInfo) return;
    const info = {
        name: AppState.userName,
        hasVideo: AppState.cameraEnabled,
        emoji: AppState.userEmoji,
        role: AppState.isHost ? 'Организатор' : 'Участник'
    };
    console.log('📤 Отправка информации о себе:', info);
    AppState.sendUserInfo(info);
}

// ===== Захват медиа =====
async function captureMedia() {
    try {
        AppState.localStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
        const at = AppState.localStream.getAudioTracks()[0]; if (at) at.enabled = AppState.micEnabled;
        const lv = $('#localVideo'); if (lv) { lv.srcObject = AppState.localStream; lv.parentElement?.classList.remove('hidden'); }
        $('#localAvatarWrapper')?.classList.add('hidden');
        updateMicButton();
        if (AppState.speechInterval) clearInterval(AppState.speechInterval);
        AppState.speechInterval = startSpeechDetection(AppState.localStream, '#localCard');
    } catch (error) {
        AppState.cameraEnabled = false;
        $('#localVideo')?.parentElement?.classList.add('hidden');
        $('#localAvatarWrapper')?.classList.remove('hidden');
    }
}

// ===== Демонстрация экрана =====
async function toggleScreenShare() {
    if (AppState.screenSharing) { stopScreenShare(); return; }
    try {
        AppState.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        AppState.screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
        const ssv = $('#screenShareVideo'); if (ssv) ssv.srcObject = AppState.screenStream;
        $('#screenShareCard')?.classList.remove('hidden');
        $('#screenShareBtn')?.classList.add('active');
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
    AppState.screenSharing = false;
}

// ===== Trystero =====
function initTrystero() {
    if (!window.trysteroJoinRoom) { updateStatus('Ошибка модуля связи'); return; }
    
    console.log('🔗 Trystero. Комната:', AppState.roomId, 'Роль:', AppState.isHost ? 'ХОСТ' : 'ГОСТЬ');
    
    AppState.room = window.trysteroJoinRoom({ appId: 'conf-meet-v10-' + AppState.roomId }, 'meeting');
    
    const [sendSignal, getSignal] = AppState.room.makeAction('signal');
    const [sendChat, getChat] = AppState.room.makeAction('chat');
    const [sendUserInfo, getUserInfo] = AppState.room.makeAction('userInfo');
    
    AppState.sendSignal = sendSignal;
    AppState.sendChatMsg = sendChat;
    AppState.sendUserInfo = sendUserInfo;
    
    getSignal((data, peerId) => {
        console.log('📡 Сигнал от:', peerId);
        handleSignal(peerId, data);
    });
    
    getChat((data) => {
        if (data && data.text) displayChatMessage(data.sender || 'Собеседник', data.text, false);
    });
    
    getUserInfo((info) => {
        console.log('👤 Получена информация:', info);
        if (!AppState.hasRemotePeer) {
            AppState.hasRemotePeer = true;
            updateRemoteUser(info);
            // Отправляем свою информацию в ответ
            setTimeout(() => sendMyInfo(), 500);
        } else {
            updateRemoteUser(info);
        }
    });
    
    AppState.room.onPeerJoin((peerId) => {
        console.log('🟢 Пир присоединился:', peerId);
        // Отправляем информацию о себе
        setTimeout(() => sendMyInfo(), 300);
        
        if (!AppState.isHost) {
            console.log('📞 Гость инициирует WebRTC');
            createPeer(peerId, true);
        }
    });
    
    AppState.room.onPeerLeave((peerId) => {
        console.log('🔴 Пир отключился:', peerId);
        const peer = AppState.peers.get(peerId);
        if (peer) peer.destroy();
        AppState.peers.delete(peerId);
        AppState.hasRemotePeer = false;
        
        // Проверяем, есть ли ещё пиры
        if (AppState.peers.size === 0) {
            $('#remoteVideo').srcObject = null;
            $('#remoteCard')?.classList.add('hidden');
            $('#screenShareCard')?.classList.add('hidden');
            $('#emptyState')?.classList.remove('hidden');
            AppState.isConnected = false;
            updateStatus('Собеседник отключился');
        }
        updateParticipantCount();
    });
    
    // Отправляем информацию о себе при инициализации
    setTimeout(() => sendMyInfo(), 1000);
}

// ===== WebRTC =====
function handleSignal(peerId, signalData) {
    let peer = AppState.peers.get(peerId);
    if (!peer) peer = createPeer(peerId, !AppState.isHost);
    try { peer.signal(signalData); } catch (e) { console.error('Signal error:', e); }
}

function createPeer(peerId, initiator) {
    console.log('🔧 Peer. Инициатор:', initiator);
    const streams = [];
    if (AppState.localStream) streams.push(AppState.localStream);
    if (AppState.screenStream) streams.push(AppState.screenStream);
    
    const peer = new SimplePeer({ initiator, streams, trickle: true, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } });
    
    peer.on('signal', (data) => { if (AppState.sendSignal) AppState.sendSignal(data); });
    
    peer.on('stream', (stream) => {
        console.log('📥 Поток получен');
        const vt = stream.getVideoTracks();
        const at = stream.getAudioTracks();
        
        if (vt.length > 0) {
            const label = (vt[0].label || '').toLowerCase();
            if (label.includes('screen') || label.includes('display')) {
                const ssv = $('#screenShareVideo'); if (ssv) ssv.srcObject = stream;
                $('#screenShareCard')?.classList.remove('hidden');
                updateStatus('📺 Экран собеседника');
            } else {
                const rv = $('#remoteVideo'); if (rv) { rv.srcObject = stream; rv.parentElement?.classList.remove('hidden'); }
                $('#remoteAvatarWrapper')?.classList.add('hidden');
            }
        }
        
        if (at.length > 0) {
            if (AppState.remoteSpeechInterval) clearInterval(AppState.remoteSpeechInterval);
            AppState.remoteSpeechInterval = startSpeechDetection(stream, '#remoteCard');
        }
        
        $('#remoteCard')?.classList.remove('hidden');
        $('#emptyState')?.classList.add('hidden');
        AppState.isConnected = true;
        AppState.hasRemotePeer = true;
        updateStatus('✅ Защищённое соединение установлено');
        updateParticipantCount();
    });
    
    peer.on('connect', () => updateStatus('🔄 Защищённый канал активен'));
    
    peer.on('close', () => {
        AppState.peers.delete(peerId);
        if (AppState.peers.size === 0) {
            $('#remoteVideo').srcObject = null;
            $('#remoteCard')?.classList.add('hidden');
            $('#screenShareCard')?.classList.add('hidden');
            $('#emptyState')?.classList.remove('hidden');
            AppState.isConnected = false;
            AppState.hasRemotePeer = false;
            updateStatus('Собеседник отключился');
        }
        updateParticipantCount();
    });
    
    peer.on('error', (err) => { console.error('Peer error:', err); });
    
    AppState.peers.set(peerId, peer);
    return peer;
}

// ===== Управление =====
function toggleMic() {
    if (AppState.localStream) {
        const at = AppState.localStream.getAudioTracks()[0];
        if (at) { at.enabled = !at.enabled; AppState.micEnabled = at.enabled; updateMicButton(); }
    }
}

function updateMicButton() {
    const btn = $('#micBtn'); const icon = $('#localMicIcon');
    if (AppState.micEnabled) { if (btn) btn.classList.remove('off'); if (icon) icon.className = 'fas fa-microphone'; }
    else { if (btn) btn.classList.add('off'); if (icon) icon.className = 'fas fa-microphone-slash mic-off'; }
}

function toggleCamera() {
    if (AppState.localStream) {
        const vt = AppState.localStream.getVideoTracks()[0];
        if (vt) {
            vt.enabled = !vt.enabled; AppState.cameraEnabled = vt.enabled;
            const btn = $('#cameraBtn');
            if (AppState.cameraEnabled) {
                if (btn) btn.classList.remove('off');
                $('#localVideo')?.parentElement?.classList.remove('hidden');
                $('#localAvatarWrapper')?.classList.add('hidden');
            } else {
                if (btn) btn.classList.add('off');
                $('#localVideo')?.parentElement?.classList.add('hidden');
                $('#localAvatarWrapper')?.classList.remove('hidden');
            }
            sendMyInfo();
        }
    }
}

// ===== Чат =====
function sendChatMessage() {
    const input = $('#chatInput'); if (!input) return;
    const text = input.value.trim(); if (!text) return;
    displayChatMessage(AppState.userName, text, true);
    if (AppState.sendChatMsg) AppState.sendChatMsg({ sender: AppState.userName, text, timestamp: Date.now() });
    input.value = ''; input.focus();
}

function displayChatMessage(sender, text, isMine) {
    const cm = $('#chatMessages'); if (!cm) return;
    const div = document.createElement('div'); div.className = `chat-message ${isMine ? 'mine' : 'other'}`;
    div.innerHTML = `<span class="sender">${sender}</span><span class="text">${escapeHtml(text)}</span>`;
    const empty = cm.querySelector('.chat-empty'); if (empty) empty.remove();
    cm.appendChild(div); cm.scrollTop = cm.scrollHeight;
}

// ===== QR =====
async function generateQRCode(canvas, data) {
    if (!canvas || !data) return;
    try { await QRCode.toCanvas(canvas, data, { width: 200, margin: 2, color: { dark: '#000', light: '#fff' } }); } catch (e) {}
}

// ===== Сканер =====
async function startScanner() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        AppState.scannerStream = stream;
        const sv = $('#scannerVideo'); if (sv) sv.srcObject = stream;
        scanLoop();
    } catch (e) { alert('Ошибка камеры'); switchScreen('joinScreen'); }
}

function scanLoop() {
    const interval = setInterval(() => {
        if (!AppState.scannerStream) { clearInterval(interval); return; }
        const video = $('#scannerVideo'); if (!video || video.readyState < 2) return;
        const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (code && code.data) { clearInterval(interval); stopScanner(); parseAndJoin(code.data); }
    }, 100);
}

function stopScanner() { if (AppState.scannerStream) { AppState.scannerStream.getTracks().forEach(t => t.stop()); AppState.scannerStream = null; } }

// ===== Парсинг =====
function parseHashParams() {
    const hash = window.location.hash; if (!hash || hash === '#') return null;
    const hc = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(hc);
    const roomId = params.get('room'); const key = params.get('key');
    if (roomId) return { roomId, key };
    if (hc.includes('room=')) {
        const parts = hc.split('&');
        return { roomId: parts.find(p=>p.startsWith('room='))?.split('=')[1] || null, key: parts.find(p=>p.startsWith('key='))?.split('=')[1] || null };
    }
    return null;
}

async function parseAndJoin(link) {
    try {
        const url = new URL(link); const hash = url.hash.slice(1); const params = new URLSearchParams(hash);
        const roomId = params.get('room'); const key = params.get('key');
        if (!roomId) return alert('Неверная ссылка');
        AppState.roomId = roomId; AppState.isHost = false; AppState.hasRemotePeer = false;
        AppState.userName = $('#joinUserName')?.value.trim() || 'Гость';
        AppState.cameraEnabled = $('#joinCameraToggle')?.checked ?? true;
        AppState.micEnabled = $('#joinMicToggle')?.checked ?? true;
        if (key) { AppState.encryptionKeyStr = key; }
        await joinRoom(roomId);
    } catch (e) { alert('Неверный формат ссылки'); }
}

async function joinRoom(roomId) {
    AppState.roomId = roomId;
    try {
        switchScreen('meetingScreen'); updateLocalDisplay(); startTimer();
        $('#remoteCard')?.classList.add('hidden'); $('#emptyState')?.classList.remove('hidden');
        updateStatus('Подключение...');
        if (AppState.cameraEnabled) await captureMedia();
        initTrystero();
    } catch (error) { alert('Ошибка: ' + error.message); }
}

function checkUrlForRoom() {
    const parsed = parseHashParams();
    if (parsed && parsed.roomId) {
        AppState.roomId = parsed.roomId; AppState.isHost = false; AppState.hasRemotePeer = false;
        if (parsed.key) AppState.encryptionKeyStr = parsed.key;
        $$('.screen').forEach(s => s.classList.add('hidden'));
        const inviteScreen = $('#inviteScreen'); if (inviteScreen) inviteScreen.classList.remove('hidden');
        setTimeout(() => { const qc = $('#inviteQRCanvas'); if (qc) generateQRCode(qc, window.location.href); }, 500);
        setTimeout(() => { if ($('#inviteCameraToggle')?.checked) startCameraPreview($('#invitePreviewVideo'), $('#inviteAvatarEmoji')); }, 800);
        return true;
    }
    return false;
}

// ===== UI =====
function updateLocalDisplay() {
    const ln = $('#localName'); if (ln) ln.textContent = (AppState.userName || 'Вы') + ' • ' + (AppState.isHost ? 'Организатор' : 'Участник');
    const lae = $('#localAvatarEmoji'); if (lae) lae.textContent = AppState.userEmoji;
    if (AppState.cameraEnabled) { $('#localVideo')?.parentElement?.classList.remove('hidden'); $('#localAvatarWrapper')?.classList.add('hidden'); }
    else { $('#localVideo')?.parentElement?.classList.add('hidden'); $('#localAvatarWrapper')?.classList.remove('hidden'); }
    if (AppState.isHost) $('#hostChip')?.classList.remove('hidden');
    else $('#hostChip')?.classList.add('hidden');
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

function startTimer() {
    AppState.startTime = Date.now(); if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.timerInterval = setInterval(() => {
        const e = Math.floor((Date.now() - AppState.startTime)/1000);
        const m = Math.floor(e/60).toString().padStart(2,'0'); const s = (e%60).toString().padStart(2,'0');
        const td = $('#timerDisplay'); if (td) td.textContent = `${m}:${s}`;
    }, 1000);
}

function hangUp() {
    AppState.peers.forEach(p => { try { p.destroy(); } catch(e){} }); AppState.peers.clear();
    if (AppState.room) { try { AppState.room.leave(); } catch(e){} AppState.room = null; }
    if (AppState.localStream) { AppState.localStream.getTracks().forEach(t => t.stop()); AppState.localStream = null; }
    if (AppState.speechInterval) clearInterval(AppState.speechInterval);
    if (AppState.remoteSpeechInterval) clearInterval(AppState.remoteSpeechInterval);
    stopScreenShare(); stopScanner(); stopCameraPreview();
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.isHost = false; AppState.roomId = null; AppState.isConnected = false; AppState.hasRemotePeer = false;
    AppState.sendSignal = null; AppState.sendChatMsg = null; AppState.sendUserInfo = null;
    $('#alertOverlay')?.classList.add('hidden');
    const ml = $('#meetingLayout'); if (ml) ml.style.filter = 'none';
    switchScreen('mainScreen'); window.location.hash = '';
}

function goToMain() { stopCameraPreview(); stopScanner(); switchScreen('mainScreen'); }

function generateRoomId() { return 'meet-' + Math.random().toString(36).substring(2,10) + Date.now().toString(36); }
function generateMeetingLink() {
    const base = window.location.href.split('#')[0].replace(/index\.html$/, '');
    return `${base}#room=${AppState.roomId}&key=${AppState.encryptionKeyStr}`;
}
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

window.addEventListener('beforeunload', hangUp);