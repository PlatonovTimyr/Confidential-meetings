// ===== Confidential Meetings App v15 =====

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
    previewStream: null,
    speechInterval: null,
    remoteSpeechInterval: null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const EMOJIS = ['😊', '😎', '🤗', '😇', '🙂', '😄', '🥳', '😌', '🤩', '😁', '😺', '🦊', '🐱', '🐼', '🐨', '🦁', '🐯', '🐸', '🦄', '🐙'];

// ===== Уведомления =====
function showNotification(message) {
    const statusEl = $('#meetingStatus');
    if (!statusEl) return;
    const originalText = statusEl.textContent;
    statusEl.textContent = message;
    statusEl.style.color = '#fdcb6e';
    statusEl.style.fontWeight = 'bold';
    setTimeout(() => {
        statusEl.textContent = originalText;
        statusEl.style.color = '';
        statusEl.style.fontWeight = '';
    }, 3000);
}

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 v15');
    setupMainScreen();
    setupCreateScreen();
    setupJoinScreen();
    setupInviteScreen();
    setupMeetingScreen();
    setTimeout(() => { if (!checkUrlForRoom()) { const ms = $('#mainScreen'); if (ms) ms.classList.remove('hidden'); } }, 500);
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
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ac.createAnalyser();
        ac.createMediaStreamSource(stream).connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        return setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a,b)=>a+b,0)/dataArray.length;
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
        if (this.checked) startCameraPreview($('#createPreviewVideo'),$('#createAvatarEmoji'));
        else { stopCameraPreview(); $('#createPreviewVideo')?.classList.add('hidden'); $('#createAvatarEmoji')?.classList.remove('hidden'); }
    });
    
    $('#createMeetingBtn')?.addEventListener('click', async () => {
        AppState.userName = $('#createUserName')?.value.trim() || 'Организатор';
        AppState.isHost = true;
        // ВСЕГДА включаем камеру и микрофон, галочки только для начального состояния
        AppState.cameraEnabled = true;
        AppState.micEnabled = true;
        
        try {
            stopCameraPreview();
            if (typeof CryptoModule !== 'undefined') {
                const keys = await CryptoModule.generateKeys();
                AppState.encryptionKeyStr = btoa(String.fromCharCode(...new Uint8Array(keys.encryptionKey)));
            }
            AppState.roomId = generateRoomId();
            
            // Всегда захватываем медиа
            await captureMedia();
            
            // Применяем настройки из галочек
            const wantCamera = $('#createCameraToggle')?.checked ?? true;
            const wantMic = $('#createMicToggle')?.checked ?? true;
            
            if (!wantCamera && AppState.localStream) {
                const vt = AppState.localStream.getVideoTracks()[0];
                if (vt) { vt.enabled = false; AppState.cameraEnabled = false; }
            }
            if (!wantMic && AppState.localStream) {
                const at = AppState.localStream.getAudioTracks()[0];
                if (at) { at.enabled = false; AppState.micEnabled = false; }
            }
            
            initTrystero();
            switchScreen('meetingScreen');
            updateLocalDisplay();
            updateHostUI();
            startTimer();
            showNotification('✅ Встреча создана');
            
            const link = generateMeetingLink();
            const ml = $('#meetingLink'); if (ml) ml.value = link;
            const kd = $('#encryptionKeyDisplay'); if (kd) kd.textContent = AppState.encryptionKeyStr.substring(0,32)+'...';
            const qc = $('#qrCanvas'); if (qc) await generateQRCode(qc, link);
        } catch (error) { alert('Ошибка: ' + error.message); }
    });
    
    $('#changeCreateAvatar')?.addEventListener('click', () => {
        const e = getRandomEmoji(); const el = $('#createAvatarEmoji'); if (el) el.textContent = e;
        AppState.userEmoji = e;
    });
}

// ===== Экран присоединения =====
function setupJoinScreen() {
    $('#joinCameraToggle')?.addEventListener('change', function() {
        if (this.checked) startCameraPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji'));
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
        const e = getRandomEmoji(); const el = $('#joinAvatarEmoji'); if (el) el.textContent = e;
        AppState.userEmoji = e;
    });
    $('#backFromScanner')?.addEventListener('click', () => {
        stopScanner(); switchScreen('joinScreen');
        if ($('#joinCameraToggle')?.checked) startCameraPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji'));
    });
}

// ===== Экран приглашения =====
function setupInviteScreen() {
    $('#inviteCameraToggle')?.addEventListener('change', function() {
        if (this.checked) startCameraPreview($('#invitePreviewVideo'),$('#inviteAvatarEmoji'));
        else { stopCameraPreview(); $('#invitePreviewVideo')?.classList.add('hidden'); $('#inviteAvatarEmoji')?.classList.remove('hidden'); }
    });
    $('#inviteConnectBtn')?.addEventListener('click', async () => {
        AppState.userName = $('#inviteUserName')?.value.trim() || 'Гость';
        AppState.isHost = false;
        AppState.cameraEnabled = true;
        AppState.micEnabled = true;
        if (!AppState.roomId) return alert('Не найдена комната');
        
        try {
            stopCameraPreview();
            switchScreen('meetingScreen');
            updateLocalDisplay();
            updateHostUI();
            startTimer();
            showNotification('🔄 Подключение...');
            
            await captureMedia();
            
            const wantCamera = $('#inviteCameraToggle')?.checked ?? true;
            const wantMic = $('#inviteMicToggle')?.checked ?? true;
            
            if (!wantCamera && AppState.localStream) {
                const vt = AppState.localStream.getVideoTracks()[0];
                if (vt) { vt.enabled = false; AppState.cameraEnabled = false; }
            }
            if (!wantMic && AppState.localStream) {
                const at = AppState.localStream.getAudioTracks()[0];
                if (at) { at.enabled = false; AppState.micEnabled = false; }
            }
            
            initTrystero();
        } catch (error) { alert('Ошибка: ' + error.message); }
    });
    $('#changeInviteAvatar')?.addEventListener('click', () => {
        const e = getRandomEmoji(); const el = $('#inviteAvatarEmoji'); if (el) el.textContent = e;
        AppState.userEmoji = e;
    });
}

// ===== UI роли =====
function updateHostUI() {
    const shareBtn = $('#shareBtn');
    if (shareBtn) { shareBtn.style.display = AppState.isHost ? 'flex' : 'none'; }
}

// ===== Экран встречи =====
function setupMeetingScreen() {
    $('#micBtn')?.addEventListener('click', toggleMic);
    $('#cameraBtn')?.addEventListener('click', toggleCamera);
    $('#screenShareBtn')?.addEventListener('click', toggleScreenShare);
    $('#shareBtn')?.addEventListener('click', () => { if (!AppState.isHost) return; $('#sharePanel')?.classList.toggle('hidden'); $('#chatPanel')?.classList.add('hidden'); });
    $('#chatBtn')?.addEventListener('click', () => { $('#chatPanel')?.classList.toggle('hidden'); $('#sharePanel')?.classList.add('hidden'); });
    $('#hangupBtn')?.addEventListener('click', hangUp);
    $('#closeSharePanel')?.addEventListener('click', () => $('#sharePanel')?.classList.add('hidden'));
    $('#closeChatPanel')?.addEventListener('click', () => $('#chatPanel')?.classList.add('hidden'));
    $('#copyLinkBtn')?.addEventListener('click', () => {
        const i = $('#meetingLink'); if (i) { i.select(); document.execCommand('copy'); }
        const b = $('#copyLinkBtn'); if (b) { b.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => { b.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500); }
    });
    $('#sendMessageBtn')?.addEventListener('click', sendChatMessage);
    $('#chatInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
    $('#changeLocalAvatar')?.addEventListener('click', () => {
        const e = getRandomEmoji(); const el = $('#localAvatarEmoji'); if (el) el.textContent = e;
        AppState.userEmoji = e; sendMyInfo();
    });
}

function sendMyInfo() {
    if (!AppState.sendUserInfo) return;
    AppState.sendUserInfo({ name: AppState.userName, hasVideo: AppState.cameraEnabled, emoji: AppState.userEmoji, role: AppState.isHost ? 'Организатор' : 'Участник' });
}

// ===== Захват медиа =====
async function captureMedia() {
    try {
        AppState.localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        });
        
        const lv = $('#localVideo');
        if (lv) { lv.srcObject = AppState.localStream; lv.parentElement?.classList.remove('hidden'); }
        $('#localAvatarWrapper')?.classList.add('hidden');
        updateMicButton();
        updateCameraButton();
        
        if (AppState.speechInterval) clearInterval(AppState.speechInterval);
        AppState.speechInterval = startSpeechDetection(AppState.localStream, '#localCard');
    } catch (error) {
        console.error('Ошибка медиа:', error);
        AppState.cameraEnabled = false;
        $('#localVideo')?.parentElement?.classList.add('hidden');
        $('#localAvatarWrapper')?.classList.remove('hidden');
    }
}

// ===== Демонстрация экрана =====
async function toggleScreenShare() {
    if (AppState.screenSharing) {
        stopScreenShare();
        return;
    }
    
    try {
        // Захватываем экран
        AppState.screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' },
            audio: false
        });
        
        // Слушаем завершение
        const screenTrack = AppState.screenStream.getVideoTracks()[0];
        screenTrack.onended = () => stopScreenShare();
        
        // Показываем локально
        const ssv = $('#screenShareVideo');
        if (ssv) ssv.srcObject = AppState.screenStream;
        $('#screenShareCard')?.classList.remove('hidden');
        $('#screenShareBtn')?.classList.add('active');
        AppState.screenSharing = true;
        
        // Отправляем экран всем пирам
        for (const [peerId, peer] of AppState.peers) {
            try {
                // Заменяем видео-трек на экран
                const senders = peer.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                
                if (videoSender) {
                    await videoSender.replaceTrack(screenTrack);
                    console.log('✅ Экран отправлен пиру (замена):', peerId);
                } else {
                    peer.addTrack(screenTrack, AppState.localStream);
                    console.log('✅ Экран отправлен пиру (добавлен):', peerId);
                }
            } catch (e) {
                console.error('Ошибка отправки экрана пиру:', peerId, e);
                // Пробуем addTrack как запасной вариант
                try { peer.addTrack(screenTrack, AppState.localStream); } catch(e2) {}
            }
        }
        
        showNotification('📺 Демонстрация экрана включена');
        
    } catch (error) {
        console.error('Ошибка демонстрации:', error);
        alert('Не удалось начать демонстрацию экрана');
    }
}

function stopScreenShare() {
    if (AppState.screenStream) {
        AppState.screenStream.getTracks().forEach(t => t.stop());
        AppState.screenStream = null;
    }
    
    const ssv = $('#screenShareVideo');
    if (ssv) ssv.srcObject = null;
    $('#screenShareCard')?.classList.add('hidden');
    $('#screenShareBtn')?.classList.remove('active');
    AppState.screenSharing = false;
    
    // Возвращаем видео с камеры всем пирам
    if (AppState.localStream) {
        const cameraTrack = AppState.localStream.getVideoTracks()[0];
        if (cameraTrack) {
            for (const [peerId, peer] of AppState.peers) {
                try {
                    const senders = peer.getSenders();
                    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                    if (videoSender) {
                        videoSender.replaceTrack(cameraTrack);
                        console.log('✅ Камера возвращена пиру:', peerId);
                    }
                } catch (e) {
                    console.error('Ошибка возврата камеры:', peerId, e);
                }
            }
        }
    }
    
    showNotification('📺 Демонстрация экрана выключена');
}

// ===== Trystero =====
function initTrystero() {
    if (!window.trysteroJoinRoom) { updateStatus('Ошибка модуля связи'); return; }
    
    console.log('🔗 Trystero. Комната:', AppState.roomId, 'Роль:', AppState.isHost ? 'ХОСТ' : 'ГОСТЬ');
    
    AppState.room = window.trysteroJoinRoom({ appId: 'conf-meet-v15-' + AppState.roomId }, 'meeting');
    
    const [sendSignal, getSignal] = AppState.room.makeAction('signal');
    const [sendChat, getChat] = AppState.room.makeAction('chat');
    const [sendUserInfo, getUserInfo] = AppState.room.makeAction('userInfo');
    
    AppState.sendSignal = sendSignal;
    AppState.sendChatMsg = sendChat;
    AppState.sendUserInfo = sendUserInfo;
    
    getSignal((data, peerId) => handleSignal(peerId, data));
    
    getChat((data) => {
        if (data && data.text) displayChatMessage(data.sender || 'Собеседник', data.text, false);
    });
    
    getUserInfo((info) => {
        console.log('👤 Инфо:', info);
        updateRemoteUser(info);
    });
    
    AppState.room.onPeerJoin((peerId) => {
        console.log('🟢 Пир присоединился:', peerId);
        setTimeout(() => sendMyInfo(), 300);
        
        if (!AppState.isHost) {
            console.log('📞 Гость инициирует WebRTC');
            createPeer(peerId, true);
        }
        
        // Если уже идёт демонстрация — отправляем её новому пиру
        if (AppState.screenSharing && AppState.screenStream) {
            setTimeout(() => {
                const peer = AppState.peers.get(peerId);
                if (peer && AppState.screenStream) {
                    const screenTrack = AppState.screenStream.getVideoTracks()[0];
                    if (screenTrack && screenTrack.readyState === 'live') {
                        try {
                            peer.addTrack(screenTrack, AppState.localStream);
                            console.log('✅ Экран отправлен новому пиру:', peerId);
                        } catch(e) {
                            console.error('Ошибка отправки экрана новому пиру:', e);
                        }
                    }
                }
            }, 2000);
        }
    });
    
    AppState.room.onPeerLeave((peerId) => {
        console.log('🔴 Пир отключился:', peerId);
        const peer = AppState.peers.get(peerId);
        if (peer) peer.destroy();
        AppState.peers.delete(peerId);
        
        if (AppState.peers.size === 0) {
            $('#remoteVideo').srcObject = null;
            $('#remoteCard')?.classList.add('hidden');
            $('#screenShareCard')?.classList.add('hidden');
            $('#emptyState')?.classList.remove('hidden');
            AppState.isConnected = false;
            showNotification('Собеседник отключился');
        }
        updateParticipantCount();
    });
}

// ===== WebRTC =====
function handleSignal(peerId, signalData) {
    let peer = AppState.peers.get(peerId);
    if (!peer) peer = createPeer(peerId, !AppState.isHost);
    try { peer.signal(signalData); } catch (e) { console.error(e); }
}

function createPeer(peerId, initiator) {
    console.log('🔧 Peer, инициатор:', initiator);
    
    const streams = [];
    if (AppState.localStream) streams.push(AppState.localStream);
    if (AppState.screenStream) streams.push(AppState.screenStream);
    
    const peer = new SimplePeer({
        initiator,
        streams,
        trickle: true,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });
    
    peer.on('signal', (data) => { if (AppState.sendSignal) AppState.sendSignal(data); });
    
    peer.on('stream', (stream) => {
        console.log('📥 Поток получен, дорожек:', stream.getTracks().length);
        
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        // Проверяем ВСЕ видеодорожки
        let isScreen = false;
        for (const track of videoTracks) {
            const label = (track.label || '').toLowerCase();
            console.log('  Видеодорожка:', label);
            
            if (label.includes('screen') || label.includes('display') || label.includes('window')) {
                isScreen = true;
                const ssv = $('#screenShareVideo');
                if (ssv) ssv.srcObject = stream;
                $('#screenShareCard')?.classList.remove('hidden');
                showNotification('📺 Собеседник демонстрирует экран');
                break;
            }
        }
        
        if (!isScreen && videoTracks.length > 0) {
            const rv = $('#remoteVideo');
            if (rv) { rv.srcObject = stream; rv.parentElement?.classList.remove('hidden'); }
            $('#remoteAvatarWrapper')?.classList.add('hidden');
        }
        
        if (audioTracks.length > 0) {
            if (AppState.remoteSpeechInterval) clearInterval(AppState.remoteSpeechInterval);
            AppState.remoteSpeechInterval = startSpeechDetection(stream, '#remoteCard');
        }
        
        $('#remoteCard')?.classList.remove('hidden');
        $('#emptyState')?.classList.add('hidden');
        AppState.isConnected = true;
        showNotification('✅ Соединение установлено');
        updateParticipantCount();
    });
    
    peer.on('connect', () => console.log('🔗 Соединение установлено'));
    peer.on('close', () => {
        AppState.peers.delete(peerId);
        if (AppState.peers.size === 0) {
            $('#remoteVideo').srcObject = null;
            $('#remoteCard')?.classList.add('hidden');
            $('#screenShareCard')?.classList.add('hidden');
            $('#emptyState')?.classList.remove('hidden');
            AppState.isConnected = false;
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
        if (at) {
            at.enabled = !at.enabled;
            AppState.micEnabled = at.enabled;
            updateMicButton();
            showNotification(AppState.micEnabled ? '🎤 Микрофон включен' : '🔇 Микрофон выключен');
        }
    }
}

function updateMicButton() {
    const b = $('#micBtn');
    const i = $('#localMicIcon');
    if (AppState.micEnabled) {
        if (b) b.classList.remove('off');
        if (i) i.className = 'fas fa-microphone';
    } else {
        if (b) b.classList.add('off');
        if (i) i.className = 'fas fa-microphone-slash mic-off';
    }
}

function toggleCamera() {
    if (AppState.localStream) {
        const vt = AppState.localStream.getVideoTracks()[0];
        if (vt) {
            vt.enabled = !vt.enabled;
            AppState.cameraEnabled = vt.enabled;
            updateCameraButton();
            showNotification(AppState.cameraEnabled ? '📹 Камера включена' : '📷 Камера выключена');
            
            if (AppState.cameraEnabled) {
                $('#localVideo')?.parentElement?.classList.remove('hidden');
                $('#localAvatarWrapper')?.classList.add('hidden');
            } else {
                $('#localVideo')?.parentElement?.classList.add('hidden');
                $('#localAvatarWrapper')?.classList.remove('hidden');
            }
            sendMyInfo();
        }
    }
}

function updateCameraButton() {
    const b = $('#cameraBtn');
    if (AppState.cameraEnabled) {
        if (b) b.classList.remove('off');
    } else {
        if (b) b.classList.add('off');
    }
}

// ===== Чат =====
function sendChatMessage() {
    const ci = $('#chatInput'); if (!ci) return;
    const t = ci.value.trim(); if (!t) return;
    displayChatMessage(AppState.userName, t, true);
    if (AppState.sendChatMsg) AppState.sendChatMsg({ sender: AppState.userName, text: t, timestamp: Date.now() });
    ci.value = ''; ci.focus();
}

function displayChatMessage(sender, text, isMine) {
    const cm = $('#chatMessages'); if (!cm) return;
    const div = document.createElement('div');
    div.className = `chat-message ${isMine ? 'mine' : 'other'}`;
    div.innerHTML = `<span class="sender">${sender}</span><span class="text">${escapeHtml(text)}</span>`;
    const empty = cm.querySelector('.chat-empty'); if (empty) empty.remove();
    cm.appendChild(div); cm.scrollTop = cm.scrollHeight;
}

// ===== QR =====
async function generateQRCode(canvas, data) {
    if (!canvas || !data) return;
    try { await QRCode.toCanvas(canvas, data, { width: 200, margin: 2, color: { dark: '#000', light: '#fff' } }); } catch(e){}
}

// ===== Сканер =====
async function startScanner() {
    try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        AppState.scannerStream = s;
        const sv = $('#scannerVideo'); if (sv) sv.srcObject = s;
        scanLoop();
    } catch(e) { alert('Ошибка камеры'); switchScreen('joinScreen'); }
}

function scanLoop() {
    const iv = setInterval(() => {
        if (!AppState.scannerStream) { clearInterval(iv); return; }
        const v = $('#scannerVideo'); if (!v || v.readyState < 2) return;
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0);
        const code = jsQR(ctx.getImageData(0,0,c.width,c.height).data, c.width, c.height);
        if (code && code.data) { clearInterval(iv); stopScanner(); parseAndJoin(code.data); }
    }, 100);
}

function stopScanner() {
    if (AppState.scannerStream) { AppState.scannerStream.getTracks().forEach(t => t.stop()); AppState.scannerStream = null; }
}

// ===== Парсинг =====
function parseHashParams() {
    const h = window.location.hash; if (!h || h === '#') return null;
    const hc = h.startsWith('#') ? h.slice(1) : h;
    const p = new URLSearchParams(hc);
    const r = p.get('room'); const k = p.get('key');
    if (r) return { roomId: r, key: k };
    if (hc.includes('room=')) {
        const parts = hc.split('&');
        return { roomId: parts.find(x=>x.startsWith('room='))?.split('=')[1] || null, key: parts.find(x=>x.startsWith('key='))?.split('=')[1] || null };
    }
    return null;
}

async function parseAndJoin(link) {
    try {
        const u = new URL(link); const h = u.hash.slice(1); const p = new URLSearchParams(h);
        const r = p.get('room'); const k = p.get('key');
        if (!r) return alert('Неверная ссылка');
        AppState.roomId = r; AppState.isHost = false;
        AppState.userName = $('#joinUserName')?.value.trim() || 'Гость';
        AppState.cameraEnabled = true; AppState.micEnabled = true;
        if (k) AppState.encryptionKeyStr = k;
        await joinRoom(r);
    } catch(e) { alert('Неверный формат ссылки'); }
}

async function joinRoom(roomId) {
    AppState.roomId = roomId;
    try {
        switchScreen('meetingScreen'); updateLocalDisplay(); updateHostUI(); startTimer();
        showNotification('🔄 Подключение...');
        await captureMedia();
        initTrystero();
    } catch(e) { alert('Ошибка: '+e.message); }
}

function checkUrlForRoom() {
    const p = parseHashParams();
    if (p && p.roomId) {
        AppState.roomId = p.roomId; AppState.isHost = false;
        if (p.key) AppState.encryptionKeyStr = p.key;
        $$('.screen').forEach(s => s.classList.add('hidden'));
        const is = $('#inviteScreen'); if (is) is.classList.remove('hidden');
        setTimeout(() => { const qc = $('#inviteQRCanvas'); if (qc) generateQRCode(qc, window.location.href); }, 500);
        setTimeout(() => { if ($('#inviteCameraToggle')?.checked) startCameraPreview($('#invitePreviewVideo'),$('#inviteAvatarEmoji')); }, 800);
        return true;
    }
    return false;
}

// ===== UI =====
function updateLocalDisplay() {
    const role = AppState.isHost ? 'Организатор' : 'Участник';
    const ln = $('#localName'); if (ln) ln.textContent = (AppState.userName || 'Вы') + ' • ' + role;
    const lae = $('#localAvatarEmoji'); if (lae) lae.textContent = AppState.userEmoji;
    
    if (AppState.cameraEnabled) {
        $('#localVideo')?.parentElement?.classList.remove('hidden');
        $('#localAvatarWrapper')?.classList.add('hidden');
    } else {
        $('#localVideo')?.parentElement?.classList.add('hidden');
        $('#localAvatarWrapper')?.classList.remove('hidden');
    }
    
    if (AppState.isHost) $('#hostChip')?.classList.remove('hidden');
    else $('#hostChip')?.classList.add('hidden');
    
    updateMicButton();
    updateCameraButton();
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
    AppState.startTime = Date.now();
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.timerInterval = setInterval(() => {
        const e = Math.floor((Date.now()-AppState.startTime)/1000);
        const m = Math.floor(e/60).toString().padStart(2,'0');
        const s = (e%60).toString().padStart(2,'0');
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
    AppState.isHost = false; AppState.roomId = null; AppState.isConnected = false;
    AppState.sendSignal = null; AppState.sendChatMsg = null; AppState.sendUserInfo = null;
    $('#alertOverlay')?.classList.add('hidden');
    const ml = $('#meetingLayout'); if (ml) ml.style.filter = 'none';
    switchScreen('mainScreen'); window.location.hash = '';
}

function goToMain() { stopCameraPreview(); stopScanner(); switchScreen('mainScreen'); }
function generateRoomId() { return 'meet-' + Math.random().toString(36).substring(2,10) + Date.now().toString(36); }
function generateMeetingLink() { const b = window.location.href.split('#')[0].replace(/index\.html$/,''); return `${b}#room=${AppState.roomId}&key=${AppState.encryptionKeyStr}`; }
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
window.addEventListener('beforeunload', hangUp);