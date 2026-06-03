// ===== Confidential Meetings App =====

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
    securityCheckInterval: null
};

const $ = (sel) => document.querySelector(sel);
const EMOJIS = ['😊', '😎', '🤗', '😇', '🙂', '😄', '🥳', '😌', '🤩', '😁', '😺', '🦊', '🐱', '🐼', '🐨', '🦁', '🐯', '🐸', '🦄', '🐙'];

// ===== Обработчик тревог =====
window.onSecurityAlert = function(type, message, stats) {
    console.error('🔴 ТРЕВОГА:', type, message);
    
    const overlay = $('#alertOverlay');
    const layout = $('#meetingLayout');
    
    // Перекрашиваем интерфейс в красный
    layout.style.filter = 'hue-rotate(140deg) saturate(3) brightness(0.7)';
    layout.style.transition = 'all 0.5s ease';
    
    // Показываем оверлей
    overlay.classList.remove('hidden');
    
    // Заполняем информацию
    const icons = {
        'REPLAY_ATTACK': '🔄',
        'TIMING_ANOMALY': '⏰',
        'SEQUENCE_ERROR': '📊',
        'INVALID_SIGNATURE': '✍️',
        'HASH_MISMATCH': '🔍',
        'DECRYPTION_ERROR': '🔓'
    };
    
    $('#alertIcon').textContent = icons[type] || '⚠️';
    $('#alertTitle').textContent = 'ОБНАРУЖЕНА АНОМАЛИЯ!';
    $('#alertMessage').textContent = message;
    
    let detailsHTML = '<div class="alert-stats">';
    detailsHTML += `<p>Недействительных подписей: <strong>${stats.invalidSignatures}</strong></p>`;
    detailsHTML += `<p>Replay-атак: <strong>${stats.replayAttacks}</strong></p>`;
    detailsHTML += `<p>Аномалий времени: <strong>${stats.timingAnomalies}</strong></p>`;
    detailsHTML += `<p>Несовпадений хеша: <strong>${stats.hashMismatches}</strong></p>`;
    detailsHTML += `<p>Всего кадров: <strong>${stats.totalFrames}</strong></p>`;
    detailsHTML += '</div>';
    
    $('#alertDetails').innerHTML = detailsHTML;
    
    // Таймер автоотключения
    let countdown = 15;
    const timerEl = $('#alertTimer');
    const countdownInterval = setInterval(() => {
        countdown--;
        timerEl.textContent = `Автоотключение через ${countdown} сек`;
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            dismissAlert();
        }
    }, 1000);
    
    // Кнопки
    $('#alertDismissBtn').onclick = () => {
        clearInterval(countdownInterval);
        dismissAlert();
    };
    
    $('#alertHangupBtn').onclick = () => {
        clearInterval(countdownInterval);
        hangUp();
    };
};

function dismissAlert() {
    const overlay = $('#alertOverlay');
    const layout = $('#meetingLayout');
    
    overlay.classList.add('hidden');
    layout.style.filter = 'none';
    
    CryptoModule.dismissAlerts();
}

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', () => {
    setupMainScreen();
    setupCreateScreen();
    setupJoinScreen();
    setupInviteScreen();
    setupMeetingScreen();
    checkUrlForRoom();
});

function getRandomEmoji() {
    return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

// ===== Главный экран =====
function setupMainScreen() {
    $('#showCreateBtn').addEventListener('click', () => {
        AppState.userEmoji = getRandomEmoji();
        $('#createAvatarDisplay .avatar-emoji-large').textContent = AppState.userEmoji;
        $('#mainScreen').classList.add('hidden');
        $('#createScreen').classList.remove('hidden');
    });
    
    $('#showJoinBtn').addEventListener('click', () => {
        AppState.userEmoji = getRandomEmoji();
        $('#joinAvatarDisplay .avatar-emoji-large').textContent = AppState.userEmoji;
        $('#mainScreen').classList.add('hidden');
        $('#joinScreen').classList.remove('hidden');
    });
}

// ===== Экран создания =====
function setupCreateScreen() {
    $('#createMeetingBtn').addEventListener('click', async () => {
        const name = $('#createUserName').value.trim() || 'Организатор';
        AppState.userName = name;
        AppState.isHost = true;
        AppState.cameraEnabled = $('#createCameraToggle').checked;
        
        try {
            // Генерируем ключи шифрования
            const keys = await CryptoModule.generateKeys();
            
            // Конвертируем ключ в строку для URL
            AppState.encryptionKeyStr = btoa(String.fromCharCode(...new Uint8Array(keys.encryptionKey)));
            
            // Генерируем ID комнаты
            AppState.roomId = generateRoomId();
            
            if (AppState.cameraEnabled) {
                await captureMedia();
            }
            
            initTrystero();
            showMeetingScreen();
            updateLocalDisplay();
            startTimer();
            startSecurityMonitoring();
            updateStatus('Защищённая встреча создана');
            
            // Генерируем ссылку с ключом
            const link = generateMeetingLink();
            $('#meetingLink').value = link;
            $('#encryptionKeyDisplay').textContent = AppState.encryptionKeyStr.substring(0, 32) + '...';
            await generateQRCode($('#qrCanvas'), link);
            
        } catch (error) {
            alert('Ошибка: ' + error.message);
            console.error(error);
        }
    });
    
    $('#changeCreateAvatar').addEventListener('click', () => {
        const emoji = getRandomEmoji();
        $('#createAvatarDisplay .avatar-emoji-large').textContent = emoji;
        AppState.userEmoji = emoji;
    });
}

// ===== Экран присоединения =====
function setupJoinScreen() {
    $('#joinByLinkBtn').addEventListener('click', () => {
        $('#linkInputGroup').classList.remove('hidden');
    });
    
    $('#joinByQRBtn').addEventListener('click', () => {
        $('#joinScreen').classList.add('hidden');
        $('#scannerScreen').classList.remove('hidden');
        startScanner();
    });
    
    $('#connectByLinkBtn').addEventListener('click', async () => {
        const link = $('#meetingLinkInput').value.trim();
        if (!link) return alert('Вставьте ссылку');
        
        await parseAndJoin(link);
    });
    
    $('#changeJoinAvatar').addEventListener('click', () => {
        const emoji = getRandomEmoji();
        $('#joinAvatarDisplay .avatar-emoji-large').textContent = emoji;
        AppState.userEmoji = emoji;
    });
    
    $('#backFromScanner').addEventListener('click', () => {
        $('#scannerScreen').classList.add('hidden');
        $('#joinScreen').classList.remove('hidden');
        stopScanner();
    });
}

// ===== Экран приглашения =====
function setupInviteScreen() {
    $('#inviteConnectBtn').addEventListener('click', async () => {
        AppState.userName = $('#inviteUserName').value.trim() || 'Гость';
        AppState.cameraEnabled = $('#inviteCameraToggle').checked;
        
        if (!AppState.roomId) return alert('Не найдена комната');
        
        try {
            if (AppState.cameraEnabled) {
                await captureMedia();
            }
            
            initTrystero();
            showMeetingScreen();
            updateLocalDisplay();
            startTimer();
            startSecurityMonitoring();
            updateStatus('Подключение к защищённой встрече...');
            
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    });
    
    $('#changeInviteAvatar').addEventListener('click', () => {
        const emoji = getRandomEmoji();
        $('#inviteAvatarDisplay .avatar-emoji-medium').textContent = emoji;
        AppState.userEmoji = emoji;
    });
}

// ===== Экран встречи =====
function setupMeetingScreen() {
    $('#micBtn').addEventListener('click', toggleMic);
    $('#cameraBtn').addEventListener('click', toggleCamera);
    $('#screenShareBtn').addEventListener('click', toggleScreenShare);
    $('#shareBtn').addEventListener('click', () => {
        $('#sharePanel').classList.toggle('hidden');
        $('#chatPanel').classList.add('hidden');
    });
    $('#chatBtn').addEventListener('click', () => {
        $('#chatPanel').classList.toggle('hidden');
        $('#sharePanel').classList.add('hidden');
    });
    $('#hangupBtn').addEventListener('click', hangUp);
    
    $('#closeSharePanel').addEventListener('click', () => $('#sharePanel').classList.add('hidden'));
    $('#closeChatPanel').addEventListener('click', () => $('#chatPanel').classList.add('hidden'));
    
    $('#copyLinkBtn').addEventListener('click', () => {
        const input = $('#meetingLink');
        input.select();
        document.execCommand('copy');
        
        const btn = $('#copyLinkBtn');
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 1500);
    });
    
    $('#sendMessageBtn').addEventListener('click', sendEncryptedMessage);
    $('#chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendEncryptedMessage();
    });
    
    $('#changeLocalAvatar').addEventListener('click', () => {
        const emoji = getRandomEmoji();
        $('#localAvatarEmoji').textContent = emoji;
        AppState.userEmoji = emoji;
    });
}

// ===== Захват медиа =====
async function captureMedia() {
    try {
        AppState.localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        });
        
        $('#localVideo').srcObject = AppState.localStream;
        $('#localVideo').parentElement.classList.remove('hidden');
        $('#localAvatarWrapper').classList.add('hidden');
        
    } catch (error) {
        console.error('Ошибка камеры:', error);
        AppState.cameraEnabled = false;
        $('#localVideo').parentElement.classList.add('hidden');
        $('#localAvatarWrapper').classList.remove('hidden');
    }
}

// ===== Демонстрация экрана =====
async function toggleScreenShare() {
    if (AppState.screenSharing) {
        stopScreenShare();
        return;
    }
    
    try {
        AppState.screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
        });
        
        AppState.screenStream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };
        
        // Добавляем экран как дополнительный поток
        $('#screenShareVideo').srcObject = AppState.screenStream;
        $('#screenShareCard').classList.remove('hidden');
        $('#screenShareBtn').classList.add('active');
        AppState.screenSharing = true;
        
        // Отправляем экран всем пирам
        AppState.peers.forEach(peer => {
            const screenTrack = AppState.screenStream.getVideoTracks()[0];
            peer.addTrack(screenTrack, AppState.localStream);
        });
        
    } catch (error) {
        console.error('Ошибка демонстрации:', error);
    }
}

function stopScreenShare() {
    if (AppState.screenStream) {
        AppState.screenStream.getTracks().forEach(t => t.stop());
        AppState.screenStream = null;
    }
    $('#screenShareCard').classList.add('hidden');
    $('#screenShareBtn').classList.remove('active');
    AppState.screenSharing = false;
}

// ===== Trystero =====
function initTrystero() {
    AppState.room = window.trysteroJoinRoom({
        appId: 'conf-meet-v3-' + AppState.roomId
    }, 'meeting');
    
    const [sendSignal, getSignal] = AppState.room.makeAction('signal');
    const [sendChat, getChat] = AppState.room.makeAction('chat');
    const [sendUserInfo, getUserInfo] = AppState.room.makeAction('userInfo');
    
    AppState.sendSignal = sendSignal;
    AppState.sendChatMsg = sendChat;
    AppState.sendUserInfo = sendUserInfo;
    
    getSignal((data, peerId) => handleSignal(peerId, data));
    
    getChat(async (data) => {
        if (data.encrypted) {
            const decrypted = await CryptoModule.decryptMessage(data);
            if (decrypted) {
                displayChatMessage(data.sender, decrypted, false);
            }
        }
    });
    
    getUserInfo((info) => {
        updateRemoteUser(info.name, info.hasVideo);
    });
    
    AppState.room.onPeerJoin((peerId) => {
        console.log('Новый участник:', peerId);
        sendUserInfo({
            name: AppState.userName,
            hasVideo: AppState.cameraEnabled
        });
        
        if (!AppState.isHost) {
            createPeer(peerId, true);
        }
    });
    
    AppState.room.onPeerLeave((peerId) => {
        const peer = AppState.peers.get(peerId);
        if (peer) peer.destroy();
        AppState.peers.delete(peerId);
        
        $('#remoteVideo').srcObject = null;
        $('#remoteCard').classList.add('hidden');
        $('#emptyState').classList.remove('hidden');
        AppState.isConnected = false;
        updateStatus('Собеседник отключился');
        updateParticipantCount();
    });
}

// ===== WebRTC сигналы =====
function handleSignal(peerId, signalData) {
    let peer = AppState.peers.get(peerId);
    if (!peer) peer = createPeer(peerId, false);
    
    try {
        peer.signal(signalData);
    } catch (e) {
        console.error('Ошибка сигнала:', e);
    }
}

function createPeer(peerId, initiator) {
    const streams = [AppState.localStream];
    if (AppState.screenStream) {
        streams.push(AppState.screenStream);
    }
    
    const peer = new SimplePeer({
        initiator,
        streams: streams.filter(s => s),
        trickle: true,
        config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        }
    });
    
    peer.on('signal', (data) => {
        if (AppState.sendSignal) AppState.sendSignal(data);
    });
    
    peer.on('stream', (stream) => {
        // Определяем, видео это или экран
        if (stream.getVideoTracks().length > 0) {
            const track = stream.getVideoTracks()[0];
            if (track.label.includes('screen') || track.label.includes('display')) {
                $('#screenShareVideo').srcObject = stream;
                $('#screenShareCard').classList.remove('hidden');
            } else {
                $('#remoteVideo').srcObject = stream;
                $('#remoteVideo').parentElement.classList.remove('hidden');
                $('#remoteAvatarWrapper').classList.add('hidden');
            }
        }
        
        $('#remoteCard').classList.remove('hidden');
        $('#emptyState').classList.add('hidden');
        AppState.isConnected = true;
        updateStatus('✅ Защищённое соединение установлено');
        updateParticipantCount();
    });
    
    peer.on('connect', () => updateStatus('🔄 Установка защищённого канала...'));
    
    peer.on('close', () => {
        AppState.peers.delete(peerId);
        $('#remoteVideo').srcObject = null;
        $('#remoteCard').classList.add('hidden');
        $('#emptyState').classList.remove('hidden');
        AppState.isConnected = false;
        updateStatus('Собеседник отключился');
        updateParticipantCount();
    });
    
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        CryptoModule.triggerAlert('CONNECTION_ERROR', 'Ошибка соединения: ' + err.message);
        updateStatus('Ошибка соединения');
    });
    
    AppState.peers.set(peerId, peer);
    return peer;
}

// ===== Управление устройствами =====
function toggleMic() {
    if (AppState.localStream) {
        const audioTrack = AppState.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            AppState.micEnabled = audioTrack.enabled;
            
            const btn = $('#micBtn');
            const icon = $('#localMicIcon');
            
            if (AppState.micEnabled) {
                btn.classList.remove('off');
                icon.className = 'fas fa-microphone';
            } else {
                btn.classList.add('off');
                icon.className = 'fas fa-microphone-slash mic-off';
            }
        }
    }
}

function toggleCamera() {
    if (AppState.localStream) {
        const videoTrack = AppState.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            AppState.cameraEnabled = videoTrack.enabled;
            
            const btn = $('#cameraBtn');
            
            if (AppState.cameraEnabled) {
                btn.classList.remove('off');
                $('#localVideo').parentElement.classList.remove('hidden');
                $('#localAvatarWrapper').classList.add('hidden');
            } else {
                btn.classList.add('off');
                $('#localVideo').parentElement.classList.add('hidden');
                $('#localAvatarWrapper').classList.remove('hidden');
            }
        }
    }
}

// ===== Зашифрованный чат =====
async function sendEncryptedMessage() {
    const text = $('#chatInput').value.trim();
    if (!text) return;
    
    // Шифруем сообщение
    const encrypted = await CryptoModule.encryptMessage(text);
    
    displayChatMessage(AppState.userName, text, true);
    
    if (AppState.sendChatMsg) {
        AppState.sendChatMsg({
            sender: AppState.userName,
            encrypted: encrypted
        });
    }
    
    $('#chatInput').value = '';
}

function displayChatMessage(sender, text, isMine) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isMine ? 'mine' : 'other'}`;
    msgDiv.innerHTML = `
        <span class="sender">${sender}</span>
        <span class="text">${escapeHtml(text)}</span>
    `;
    
    const empty = $('#chatMessages').querySelector('.chat-empty');
    if (empty) empty.remove();
    
    $('#chatMessages').appendChild(msgDiv);
    $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
}

// ===== Мониторинг безопасности =====
function startSecurityMonitoring() {
    AppState.securityCheckInterval = setInterval(() => {
        const stats = CryptoModule.securityStats;
        
        // Проверяем количество ошибок
        if (stats.invalidSignatures > 3) {
            CryptoModule.triggerAlert('MANY_INVALID_SIGNATURES', 
                'Слишком много недействительных подписей! Возможна MITM-атака.');
        }
        
        if (stats.replayAttacks > 2) {
            CryptoModule.triggerAlert('MANY_REPLAYS', 
                'Обнаружено множество replay-атак! Кто-то пытается перехватить соединение.');
        }
        
        // Обновляем индикаторы
        updateSecurityIndicators();
        
    }, 3000);
}

function updateSecurityIndicators() {
    const stats = CryptoModule.securityStats;
    const indicators = $$('.security-ok');
    
    if (indicators.length >= 3) {
        indicators[0].style.color = stats.hashMismatches === 0 ? 'var(--success)' : 'var(--danger)';
        indicators[1].style.color = stats.invalidSignatures === 0 ? 'var(--success)' : 'var(--danger)';
        indicators[2].style.color = stats.timingAnomalies < 5 ? 'var(--success)' : 'var(--warning)';
    }
}

// ===== QR =====
async function generateQRCode(canvas, data) {
    try {
        await QRCode.toCanvas(canvas, data, {
            width: 200,
            margin: 2,
            color: { dark: '#000', light: '#fff' }
        });
    } catch (e) {
        console.error('QR error:', e);
    }
}

// ===== Сканер =====
async function startScanner() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        
        AppState.scannerStream = stream;
        $('#scannerVideo').srcObject = stream;
        
        scanLoop();
    } catch (e) {
        alert('Ошибка камеры: ' + e.message);
        $('#scannerScreen').classList.add('hidden');
        $('#joinScreen').classList.remove('hidden');
    }
}

function scanLoop() {
    const interval = setInterval(() => {
        if (!AppState.scannerStream) {
            clearInterval(interval);
            return;
        }
        
        const video = $('#scannerVideo');
        if (video.readyState < 2) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        
        if (code && code.data) {
            clearInterval(interval);
            stopScanner();
            parseAndJoin(code.data);
        }
    }, 100);
}

function stopScanner() {
    if (AppState.scannerStream) {
        AppState.scannerStream.getTracks().forEach(t => t.stop());
        AppState.scannerStream = null;
    }
}

// ===== Парсинг ссылки и присоединение =====
async function parseAndJoin(link) {
    try {
        const url = new URL(link);
        const hash = url.hash.slice(1);
        const params = new URLSearchParams(hash);
        const roomId = params.get('room');
        const key = params.get('key');
        
        if (!roomId) return alert('Неверная ссылка');
        
        AppState.roomId = roomId;
        AppState.userName = $('#joinUserName').value.trim() || 'Гость';
        AppState.cameraEnabled = $('#joinCameraToggle').checked;
        
        // Импортируем ключ шифрования если есть
        if (key) {
            const keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
            await CryptoModule.importKey(keyBytes);
            AppState.encryptionKeyStr = key;
        }
        
        $('#scannerScreen').classList.add('hidden');
        await joinRoom(roomId);
        
    } catch (e) {
        alert('Неверный формат ссылки');
    }
}

// ===== Присоединение =====
async function joinRoom(roomId) {
    AppState.roomId = roomId;
    
    try {
        if (AppState.cameraEnabled) {
            await captureMedia();
        }
        
        initTrystero();
        showMeetingScreen();
        updateLocalDisplay();
        startTimer();
        startSecurityMonitoring();
        updateStatus('Подключение к защищённой встрече...');
        
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// ===== UI =====
function showMeetingScreen() {
    $('#mainScreen').classList.add('hidden');
    $('#createScreen').classList.add('hidden');
    $('#joinScreen').classList.add('hidden');
    $('#inviteScreen').classList.add('hidden');
    $('#meetingScreen').classList.remove('hidden');
}

function updateLocalDisplay() {
    $('#localName').textContent = AppState.userName || 'Вы';
    $('#localAvatarEmoji').textContent = AppState.userEmoji;
    
    if (AppState.cameraEnabled) {
        $('#localVideo').parentElement.classList.remove('hidden');
        $('#localAvatarWrapper').classList.add('hidden');
    } else {
        $('#localVideo').parentElement.classList.add('hidden');
        $('#localAvatarWrapper').classList.remove('hidden');
    }
    
    if (AppState.isHost) {
        $('#hostChip').classList.remove('hidden');
    }
}

function updateRemoteUser(name, hasVideo) {
    $('#remoteName').textContent = name || 'Собеседник';
    $('#remoteCard').classList.remove('hidden');
    $('#emptyState').classList.add('hidden');
    
    if (!hasVideo) {
        $('#remoteVideo').parentElement.classList.add('hidden');
        $('#remoteAvatarWrapper').classList.remove('hidden');
    }
    
    updateParticipantCount();
}

function updateParticipantCount() {
    $('#participantCount').textContent = AppState.peers.size + 1;
}

function updateStatus(text) {
    $('#meetingStatus').textContent = text;
}

// ===== Таймер =====
function startTimer() {
    AppState.startTime = Date.now();
    AppState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - AppState.startTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        $('#timerDisplay').textContent = `${mins}:${secs}`;
    }, 1000);
}

// ===== Завершение =====
function hangUp() {
    AppState.peers.forEach(peer => peer.destroy());
    AppState.peers.clear();
    
    if (AppState.room) {
        AppState.room.leave();
        AppState.room = null;
    }
    
    if (AppState.localStream) {
        AppState.localStream.getTracks().forEach(t => t.stop());
        AppState.localStream = null;
    }
    
    stopScreenShare();
    stopScanner();
    
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    if (AppState.securityCheckInterval) clearInterval(AppState.securityCheckInterval);
    
    AppState.isHost = false;
    AppState.roomId = null;
    AppState.isConnected = false;
    
    $('#meetingScreen').classList.add('hidden');
    $('#alertOverlay').classList.add('hidden');
    $('#meetingLayout').style.filter = 'none';
    $('#mainScreen').classList.remove('hidden');
    
    window.location.hash = '';
}

function goToMain() {
    $('#createScreen').classList.add('hidden');
    $('#joinScreen').classList.add('hidden');
    $('#inviteScreen').classList.add('hidden');
    $('#scannerScreen').classList.add('hidden');
    $('#mainScreen').classList.remove('hidden');
    stopScanner();
}

// ===== Утилиты =====
function generateRoomId() {
    return 'meet-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function generateMeetingLink() {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#room=${AppState.roomId}&key=${AppState.encryptionKeyStr}`;
}

function checkUrlForRoom() {
    const hash = window.location.hash.slice(1);
    if (hash) {
        const params = new URLSearchParams(hash);
        const roomId = params.get('room');
        const key = params.get('key');
        
        if (roomId) {
            AppState.roomId = roomId;
            if (key) {
                AppState.encryptionKeyStr = key;
            }
            
            // Показываем экран приглашения
            $('#mainScreen').classList.add('hidden');
            $('#inviteScreen').classList.remove('hidden');
            
            // Генерируем QR
            generateQRCode($('#inviteQRCanvas'), window.location.href);
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('beforeunload', hangUp);