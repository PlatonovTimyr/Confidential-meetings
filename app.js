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
    securityCheckInterval: null,
    previewStream: null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const EMOJIS = ['😊', '😎', '🤗', '😇', '🙂', '😄', '🥳', '😌', '🤩', '😁', '😺', '🦊', '🐱', '🐼', '🐨', '🦁', '🐯', '🐸', '🦄', '🐙'];

// ===== Обработчик тревог =====
window.onSecurityAlert = function(type, message, stats) {
    console.error('ТРЕВОГА:', type, message);
    
    const overlay = $('#alertOverlay');
    const layout = $('#meetingLayout');
    
    if (layout) {
        layout.style.filter = 'hue-rotate(140deg) saturate(3) brightness(0.7)';
        layout.style.transition = 'all 0.5s ease';
    }
    
    if (overlay) overlay.classList.remove('hidden');
    
    const alertIcon = $('#alertIcon');
    const alertTitle = $('#alertTitle');
    const alertMessage = $('#alertMessage');
    const alertDetails = $('#alertDetails');
    
    if (alertIcon) alertIcon.textContent = '⚠️';
    if (alertTitle) alertTitle.textContent = 'ОБНАРУЖЕНА АНОМАЛИЯ!';
    if (alertMessage) alertMessage.textContent = message;
    
    if (alertDetails && stats) {
        let detailsHTML = '<div class="alert-stats">';
        detailsHTML += `<p>Недействительных подписей: <strong>${stats.invalidSignatures}</strong></p>`;
        detailsHTML += `<p>Replay-атак: <strong>${stats.replayAttacks}</strong></p>`;
        detailsHTML += `<p>Аномалий времени: <strong>${stats.timingAnomalies}</strong></p>`;
        detailsHTML += '</div>';
        alertDetails.innerHTML = detailsHTML;
    }
    
    let countdown = 15;
    const timerEl = $('#alertTimer');
    const countdownInterval = setInterval(() => {
        countdown--;
        if (timerEl) timerEl.textContent = `Автоотключение через ${countdown} сек`;
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            dismissAlert();
        }
    }, 1000);
    
    const dismissBtn = $('#alertDismissBtn');
    const hangupBtn = $('#alertHangupBtn');
    
    if (dismissBtn) {
        dismissBtn.onclick = () => {
            clearInterval(countdownInterval);
            dismissAlert();
        };
    }
    
    if (hangupBtn) {
        hangupBtn.onclick = () => {
            clearInterval(countdownInterval);
            hangUp();
        };
    }
};

function dismissAlert() {
    const overlay = $('#alertOverlay');
    const layout = $('#meetingLayout');
    
    if (overlay) overlay.classList.add('hidden');
    if (layout) layout.style.filter = 'none';
    
    if (typeof CryptoModule !== 'undefined') {
        CryptoModule.dismissAlerts();
    }
}

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Confidential Meetings - Инициализация...');
    console.log('📍 Текущий URL:', window.location.href);
    
    setupMainScreen();
    setupCreateScreen();
    setupJoinScreen();
    setupInviteScreen();
    setupMeetingScreen();
    
    // Проверяем URL с задержкой
    setTimeout(() => {
        const hasRoom = checkUrlForRoom();
        if (!hasRoom) {
            console.log('📱 Комната не найдена, показываем главный экран');
            const mainScreen = $('#mainScreen');
            if (mainScreen) mainScreen.classList.remove('hidden');
        }
    }, 500);
});

function getRandomEmoji() {
    return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

// ===== Предпросмотр камеры =====
async function startCameraPreview(videoElement, avatarEmojiElement) {
    if (!videoElement) return null;
    
    try {
        stopCameraPreview();
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
        });
        
        AppState.previewStream = stream;
        videoElement.srcObject = stream;
        videoElement.classList.remove('hidden');
        if (avatarEmojiElement) avatarEmojiElement.classList.add('hidden');
        
        return stream;
    } catch (error) {
        console.log('Предпросмотр камеры недоступен:', error.message);
        if (videoElement) videoElement.classList.add('hidden');
        if (avatarEmojiElement) avatarEmojiElement.classList.remove('hidden');
        return null;
    }
}

function stopCameraPreview() {
    if (AppState.previewStream) {
        AppState.previewStream.getTracks().forEach(track => track.stop());
        AppState.previewStream = null;
    }
}

function switchScreen(screenId) {
    const screens = ['mainScreen', 'createScreen', 'joinScreen', 'inviteScreen', 'meetingScreen', 'scannerScreen'];
    screens.forEach(id => {
        const el = $('#' + id);
        if (el) el.classList.add('hidden');
    });
    
    const target = $('#' + screenId);
    if (target) target.classList.remove('hidden');
}

// ===== Главный экран =====
function setupMainScreen() {
    const showCreateBtn = $('#showCreateBtn');
    const showJoinBtn = $('#showJoinBtn');
    
    if (showCreateBtn) {
        showCreateBtn.addEventListener('click', () => {
            AppState.userEmoji = getRandomEmoji();
            const emojiEl = $('#createAvatarEmoji');
            if (emojiEl) emojiEl.textContent = AppState.userEmoji;
            
            switchScreen('createScreen');
            
            const cameraToggle = $('#createCameraToggle');
            if (cameraToggle && cameraToggle.checked) {
                startCameraPreview($('#createPreviewVideo'), $('#createAvatarEmoji'));
            }
        });
    }
    
    if (showJoinBtn) {
        showJoinBtn.addEventListener('click', () => {
            AppState.userEmoji = getRandomEmoji();
            const emojiEl = $('#joinAvatarEmoji');
            if (emojiEl) emojiEl.textContent = AppState.userEmoji;
            
            switchScreen('joinScreen');
            
            const cameraToggle = $('#joinCameraToggle');
            if (cameraToggle && cameraToggle.checked) {
                startCameraPreview($('#joinPreviewVideo'), $('#joinAvatarEmoji'));
            }
        });
    }
}

// ===== Экран создания =====
function setupCreateScreen() {
    const cameraToggle = $('#createCameraToggle');
    if (cameraToggle) {
        cameraToggle.addEventListener('change', function() {
            if (this.checked) {
                startCameraPreview($('#createPreviewVideo'), $('#createAvatarEmoji'));
            } else {
                stopCameraPreview();
                const previewVideo = $('#createPreviewVideo');
                const avatarEmoji = $('#createAvatarEmoji');
                if (previewVideo) previewVideo.classList.add('hidden');
                if (avatarEmoji) avatarEmoji.classList.remove('hidden');
            }
        });
    }
    
    const createBtn = $('#createMeetingBtn');
    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            const nameInput = $('#createUserName');
            AppState.userName = (nameInput && nameInput.value.trim()) || 'Организатор';
            AppState.isHost = true;
            AppState.cameraEnabled = $('#createCameraToggle') ? $('#createCameraToggle').checked : true;
            AppState.micEnabled = $('#createMicToggle') ? $('#createMicToggle').checked : true;
            
            try {
                stopCameraPreview();
                
                if (typeof CryptoModule !== 'undefined') {
                    const keys = await CryptoModule.generateKeys();
                    AppState.encryptionKeyStr = btoa(String.fromCharCode(...new Uint8Array(keys.encryptionKey)));
                }
                
                AppState.roomId = generateRoomId();
                
                if (AppState.cameraEnabled) {
                    await captureMedia();
                }
                
                initTrystero();
                switchScreen('meetingScreen');
                updateLocalDisplay();
                startTimer();
                updateStatus('Защищённая встреча создана');
                
                const link = generateMeetingLink();
                const meetingLinkInput = $('#meetingLink');
                if (meetingLinkInput) meetingLinkInput.value = link;
                
                const keyDisplay = $('#encryptionKeyDisplay');
                if (keyDisplay) keyDisplay.textContent = AppState.encryptionKeyStr.substring(0, 32) + '...';
                
                const qrCanvas = $('#qrCanvas');
                if (qrCanvas) await generateQRCode(qrCanvas, link);
                
            } catch (error) {
                alert('Ошибка: ' + error.message);
                console.error(error);
            }
        });
    }
    
    const changeAvatarBtn = $('#changeCreateAvatar');
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            const emoji = getRandomEmoji();
            const emojiEl = $('#createAvatarEmoji');
            if (emojiEl) emojiEl.textContent = emoji;
            AppState.userEmoji = emoji;
        });
    }
}

// ===== Экран присоединения =====
function setupJoinScreen() {
    const cameraToggle = $('#joinCameraToggle');
    if (cameraToggle) {
        cameraToggle.addEventListener('change', function() {
            if (this.checked) {
                startCameraPreview($('#joinPreviewVideo'), $('#joinAvatarEmoji'));
            } else {
                stopCameraPreview();
                const previewVideo = $('#joinPreviewVideo');
                const avatarEmoji = $('#joinAvatarEmoji');
                if (previewVideo) previewVideo.classList.add('hidden');
                if (avatarEmoji) avatarEmoji.classList.remove('hidden');
            }
        });
    }
    
    const joinByLinkBtn = $('#joinByLinkBtn');
    if (joinByLinkBtn) {
        joinByLinkBtn.addEventListener('click', () => {
            const linkInputGroup = $('#linkInputGroup');
            if (linkInputGroup) linkInputGroup.classList.remove('hidden');
        });
    }
    
    const joinByQRBtn = $('#joinByQRBtn');
    if (joinByQRBtn) {
        joinByQRBtn.addEventListener('click', () => {
            stopCameraPreview();
            switchScreen('scannerScreen');
            startScanner();
        });
    }
    
    const connectByLinkBtn = $('#connectByLinkBtn');
    if (connectByLinkBtn) {
        connectByLinkBtn.addEventListener('click', async () => {
            const linkInput = $('#meetingLinkInput');
            const link = linkInput ? linkInput.value.trim() : '';
            if (!link) return alert('Вставьте ссылку');
            
            stopCameraPreview();
            await parseAndJoin(link);
        });
    }
    
    const changeAvatarBtn = $('#changeJoinAvatar');
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            const emoji = getRandomEmoji();
            const emojiEl = $('#joinAvatarEmoji');
            if (emojiEl) emojiEl.textContent = emoji;
            AppState.userEmoji = emoji;
        });
    }
    
    const backFromScanner = $('#backFromScanner');
    if (backFromScanner) {
        backFromScanner.addEventListener('click', () => {
            stopScanner();
            switchScreen('joinScreen');
            const camToggle = $('#joinCameraToggle');
            if (camToggle && camToggle.checked) {
                startCameraPreview($('#joinPreviewVideo'), $('#joinAvatarEmoji'));
            }
        });
    }
}

// ===== Экран приглашения =====
function setupInviteScreen() {
    const cameraToggle = $('#inviteCameraToggle');
    if (cameraToggle) {
        cameraToggle.addEventListener('change', function() {
            if (this.checked) {
                startCameraPreview($('#invitePreviewVideo'), $('#inviteAvatarEmoji'));
            } else {
                stopCameraPreview();
                const previewVideo = $('#invitePreviewVideo');
                const avatarEmoji = $('#inviteAvatarEmoji');
                if (previewVideo) previewVideo.classList.add('hidden');
                if (avatarEmoji) avatarEmoji.classList.remove('hidden');
            }
        });
    }
    
    const connectBtn = $('#inviteConnectBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            const nameInput = $('#inviteUserName');
            AppState.userName = (nameInput && nameInput.value.trim()) || 'Гость';
            AppState.cameraEnabled = $('#inviteCameraToggle') ? $('#inviteCameraToggle').checked : true;
            AppState.micEnabled = $('#inviteMicToggle') ? $('#inviteMicToggle').checked : true;
            
            if (!AppState.roomId) return alert('Не найдена комната');
            
            try {
                stopCameraPreview();
                
                // Сначала показываем экран встречи
                switchScreen('meetingScreen');
                updateLocalDisplay();
                startTimer();
                updateStatus('Подключение к защищённой встрече...');
                
                // Затем захватываем медиа и подключаемся
                if (AppState.cameraEnabled) {
                    await captureMedia();
                }
                
                initTrystero();
                
            } catch (error) {
                alert('Ошибка: ' + error.message);
                console.error(error);
            }
        });
    }
    
    const changeAvatarBtn = $('#changeInviteAvatar');
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            const emoji = getRandomEmoji();
            const emojiEl = $('#inviteAvatarEmoji');
            if (emojiEl) emojiEl.textContent = emoji;
            AppState.userEmoji = emoji;
        });
    }
}

// ===== Экран встречи =====
function setupMeetingScreen() {
    const micBtn = $('#micBtn');
    const cameraBtn = $('#cameraBtn');
    const screenShareBtn = $('#screenShareBtn');
    const shareBtn = $('#shareBtn');
    const chatBtn = $('#chatBtn');
    const hangupBtn = $('#hangupBtn');
    
    if (micBtn) micBtn.addEventListener('click', toggleMic);
    if (cameraBtn) cameraBtn.addEventListener('click', toggleCamera);
    if (screenShareBtn) screenShareBtn.addEventListener('click', toggleScreenShare);
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const sharePanel = $('#sharePanel');
            const chatPanel = $('#chatPanel');
            if (sharePanel) sharePanel.classList.toggle('hidden');
            if (chatPanel) chatPanel.classList.add('hidden');
        });
    }
    
    if (chatBtn) {
        chatBtn.addEventListener('click', () => {
            const chatPanel = $('#chatPanel');
            const sharePanel = $('#sharePanel');
            if (chatPanel) chatPanel.classList.toggle('hidden');
            if (sharePanel) sharePanel.classList.add('hidden');
        });
    }
    
    if (hangupBtn) hangupBtn.addEventListener('click', hangUp);
    
    const closeSharePanel = $('#closeSharePanel');
    const closeChatPanel = $('#closeChatPanel');
    if (closeSharePanel) closeSharePanel.addEventListener('click', () => {
        const sharePanel = $('#sharePanel');
        if (sharePanel) sharePanel.classList.add('hidden');
    });
    if (closeChatPanel) closeChatPanel.addEventListener('click', () => {
        const chatPanel = $('#chatPanel');
        if (chatPanel) chatPanel.classList.add('hidden');
    });
    
    const copyLinkBtn = $('#copyLinkBtn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            const input = $('#meetingLink');
            if (input) {
                input.select();
                document.execCommand('copy');
                copyLinkBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyLinkBtn.innerHTML = '<i class="fas fa-copy"></i>';
                }, 1500);
            }
        });
    }
    
    const sendMessageBtn = $('#sendMessageBtn');
    const chatInput = $('#chatInput');
    if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendChatMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    const changeLocalAvatar = $('#changeLocalAvatar');
    if (changeLocalAvatar) {
        changeLocalAvatar.addEventListener('click', () => {
            const emoji = getRandomEmoji();
            const emojiEl = $('#localAvatarEmoji');
            if (emojiEl) emojiEl.textContent = emoji;
            AppState.userEmoji = emoji;
            
            if (AppState.sendUserInfo) {
                AppState.sendUserInfo({
                    name: AppState.userName,
                    hasVideo: AppState.cameraEnabled,
                    emoji: AppState.userEmoji
                });
            }
        });
    }
}

// ===== Захват медиа =====
async function captureMedia() {
    try {
        AppState.localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        });
        
        const audioTrack = AppState.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = AppState.micEnabled;
        }
        
        const localVideo = $('#localVideo');
        if (localVideo) {
            localVideo.srcObject = AppState.localStream;
            const videoWrapper = localVideo.parentElement;
            if (videoWrapper) videoWrapper.classList.remove('hidden');
        }
        
        const localAvatarWrapper = $('#localAvatarWrapper');
        if (localAvatarWrapper) localAvatarWrapper.classList.add('hidden');
        
        updateMicButton();
        
    } catch (error) {
        console.error('Ошибка камеры:', error);
        AppState.cameraEnabled = false;
        const localVideo = $('#localVideo');
        if (localVideo && localVideo.parentElement) {
            localVideo.parentElement.classList.add('hidden');
        }
        const localAvatarWrapper = $('#localAvatarWrapper');
        if (localAvatarWrapper) localAvatarWrapper.classList.remove('hidden');
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
        
        const screenShareVideo = $('#screenShareVideo');
        if (screenShareVideo) screenShareVideo.srcObject = AppState.screenStream;
        
        const screenShareCard = $('#screenShareCard');
        if (screenShareCard) screenShareCard.classList.remove('hidden');
        
        const screenShareBtn = $('#screenShareBtn');
        if (screenShareBtn) screenShareBtn.classList.add('active');
        
        AppState.screenSharing = true;
        
        const screenTrack = AppState.screenStream.getVideoTracks()[0];
        
        AppState.peers.forEach((peer) => {
            try {
                peer.addTrack(screenTrack, AppState.localStream || undefined);
            } catch (e) {
                console.error('Ошибка добавления трека:', e);
            }
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
    
    const screenShareVideo = $('#screenShareVideo');
    if (screenShareVideo) screenShareVideo.srcObject = null;
    
    const screenShareCard = $('#screenShareCard');
    if (screenShareCard) screenShareCard.classList.add('hidden');
    
    const screenShareBtn = $('#screenShareBtn');
    if (screenShareBtn) screenShareBtn.classList.remove('active');
    
    AppState.screenSharing = false;
}

// ===== Trystero =====
function initTrystero() {
    if (!window.trysteroJoinRoom) {
        console.error('Trystero не загружен!');
        updateStatus('Ошибка загрузки модуля связи');
        return;
    }
    
    console.log('Инициализация Trystero с комнатой:', AppState.roomId);
    
    AppState.room = window.trysteroJoinRoom({
        appId: 'conf-meet-v6-' + AppState.roomId
    }, 'meeting');
    
    const [sendSignal, getSignal] = AppState.room.makeAction('signal');
    const [sendChat, getChat] = AppState.room.makeAction('chat');
    const [sendUserInfo, getUserInfo] = AppState.room.makeAction('userInfo');
    
    AppState.sendSignal = sendSignal;
    AppState.sendChatMsg = sendChat;
    AppState.sendUserInfo = sendUserInfo;
    
    getSignal((data, peerId) => {
        console.log('Получен сигнал от:', peerId);
        handleSignal(peerId, data);
    });
    
    getChat((data) => {
        console.log('Получено сообщение чата:', data);
        if (data && data.text) {
            displayChatMessage(data.sender || 'Собеседник', data.text, false);
        }
    });
    
    getUserInfo((info) => {
        console.log('Получена информация о пользователе:', info);
        updateRemoteUser(info);
    });
    
    AppState.room.onPeerJoin((peerId) => {
        console.log('Новый участник присоединился:', peerId);
        
        // Отправляем информацию о себе
        sendUserInfo({
            name: AppState.userName,
            hasVideo: AppState.cameraEnabled,
            emoji: AppState.userEmoji
        });
        
        // Если мы гость - инициируем WebRTC соединение
        if (!AppState.isHost) {
            console.log('Гость инициирует соединение...');
            createPeer(peerId, true);
        }
    });
    
    AppState.room.onPeerLeave((peerId) => {
        console.log('Участник отключился:', peerId);
        const peer = AppState.peers.get(peerId);
        if (peer) peer.destroy();
        AppState.peers.delete(peerId);
        
        const remoteVideo = $('#remoteVideo');
        if (remoteVideo) remoteVideo.srcObject = null;
        
        const remoteCard = $('#remoteCard');
        if (remoteCard) remoteCard.classList.add('hidden');
        
        const screenShareCard = $('#screenShareCard');
        if (screenShareCard) screenShareCard.classList.add('hidden');
        
        const emptyState = $('#emptyState');
        if (emptyState) emptyState.classList.remove('hidden');
        
        AppState.isConnected = false;
        updateStatus('Собеседник отключился');
        updateParticipantCount();
    });
}

// ===== WebRTC сигналы =====
function handleSignal(peerId, signalData) {
    console.log('Обработка сигнала от:', peerId);
    let peer = AppState.peers.get(peerId);
    
    if (!peer) {
        console.log('Создание нового peer для:', peerId);
        peer = createPeer(peerId, AppState.isHost); // Хост НЕ инициирует
    }
    
    try {
        peer.signal(signalData);
    } catch (e) {
        console.error('Ошибка сигнала:', e);
    }
}

function createPeer(peerId, initiator) {
    console.log('Создание peer, инициатор:', initiator);
    
    const streams = [];
    if (AppState.localStream) streams.push(AppState.localStream);
    if (AppState.screenStream) streams.push(AppState.screenStream);
    
    const peer = new SimplePeer({
        initiator: initiator,
        streams: streams,
        trickle: true,
        config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        }
    });
    
    peer.on('signal', (data) => {
        console.log('Отправка сигнала');
        if (AppState.sendSignal) AppState.sendSignal(data);
    });
    
    peer.on('stream', (stream) => {
        console.log('Получен удалённый поток');
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            const label = videoTrack.label || '';
            
            if (label.includes('screen') || label.includes('display')) {
                const screenShareVideo = $('#screenShareVideo');
                if (screenShareVideo) screenShareVideo.srcObject = stream;
                const screenShareCard = $('#screenShareCard');
                if (screenShareCard) screenShareCard.classList.remove('hidden');
            } else {
                const remoteVideo = $('#remoteVideo');
                if (remoteVideo) {
                    remoteVideo.srcObject = stream;
                    const videoWrapper = remoteVideo.parentElement;
                    if (videoWrapper) videoWrapper.classList.remove('hidden');
                }
                const remoteAvatarWrapper = $('#remoteAvatarWrapper');
                if (remoteAvatarWrapper) remoteAvatarWrapper.classList.add('hidden');
            }
        }
        
        const remoteCard = $('#remoteCard');
        if (remoteCard) remoteCard.classList.remove('hidden');
        
        const emptyState = $('#emptyState');
        if (emptyState) emptyState.classList.add('hidden');
        
        AppState.isConnected = true;
        updateStatus('✅ Защищённое соединение установлено');
        updateParticipantCount();
    });
    
    peer.on('connect', () => {
        console.log('Peer соединение установлено');
        updateStatus('🔄 Установка защищённого канала...');
    });
    
    peer.on('close', () => {
        console.log('Peer закрыт:', peerId);
        AppState.peers.delete(peerId);
        const remoteVideo = $('#remoteVideo');
        if (remoteVideo) remoteVideo.srcObject = null;
        const remoteCard = $('#remoteCard');
        if (remoteCard) remoteCard.classList.add('hidden');
        const emptyState = $('#emptyState');
        if (emptyState) emptyState.classList.remove('hidden');
        AppState.isConnected = false;
        updateStatus('Собеседник отключился');
        updateParticipantCount();
    });
    
    peer.on('error', (err) => {
        console.error('Peer ошибка:', err);
        updateStatus('Ошибка соединения: ' + err.message);
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
            updateMicButton();
        }
    }
}

function updateMicButton() {
    const btn = $('#micBtn');
    const icon = $('#localMicIcon');
    
    if (AppState.micEnabled) {
        if (btn) btn.classList.remove('off');
        if (icon) icon.className = 'fas fa-microphone';
    } else {
        if (btn) btn.classList.add('off');
        if (icon) icon.className = 'fas fa-microphone-slash mic-off';
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
                if (btn) btn.classList.remove('off');
                const localVideo = $('#localVideo');
                if (localVideo && localVideo.parentElement) {
                    localVideo.parentElement.classList.remove('hidden');
                }
                const localAvatarWrapper = $('#localAvatarWrapper');
                if (localAvatarWrapper) localAvatarWrapper.classList.add('hidden');
            } else {
                if (btn) btn.classList.add('off');
                const localVideo = $('#localVideo');
                if (localVideo && localVideo.parentElement) {
                    localVideo.parentElement.classList.add('hidden');
                }
                const localAvatarWrapper = $('#localAvatarWrapper');
                if (localAvatarWrapper) localAvatarWrapper.classList.remove('hidden');
            }
            
            if (AppState.sendUserInfo) {
                AppState.sendUserInfo({
                    name: AppState.userName,
                    hasVideo: AppState.cameraEnabled,
                    emoji: AppState.userEmoji
                });
            }
        }
    }
}

// ===== Чат =====
function sendChatMessage() {
    const chatInput = $('#chatInput');
    if (!chatInput) return;
    
    const text = chatInput.value.trim();
    if (!text) return;
    
    console.log('Отправка сообщения:', text);
    
    displayChatMessage(AppState.userName, text, true);
    
    if (AppState.sendChatMsg) {
        AppState.sendChatMsg({
            sender: AppState.userName,
            text: text,
            timestamp: Date.now()
        });
    }
    
    chatInput.value = '';
    chatInput.focus();
}

function displayChatMessage(sender, text, isMine) {
    const chatMessages = $('#chatMessages');
    if (!chatMessages) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isMine ? 'mine' : 'other'}`;
    msgDiv.innerHTML = `
        <span class="sender">${sender}</span>
        <span class="text">${escapeHtml(text)}</span>
    `;
    
    const empty = chatMessages.querySelector('.chat-empty');
    if (empty) empty.remove();
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== QR =====
async function generateQRCode(canvas, data) {
    if (!canvas || !data) return;
    
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
        const scannerVideo = $('#scannerVideo');
        if (scannerVideo) scannerVideo.srcObject = stream;
        
        scanLoop();
    } catch (e) {
        alert('Ошибка камеры: ' + e.message);
        switchScreen('joinScreen');
    }
}

function scanLoop() {
    const interval = setInterval(() => {
        if (!AppState.scannerStream) {
            clearInterval(interval);
            return;
        }
        
        const video = $('#scannerVideo');
        if (!video || video.readyState < 2) return;
        
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

// ===== Парсинг ссылки =====
function parseHashParams() {
    const hash = window.location.hash;
    console.log('Парсинг хеша:', hash);
    
    if (!hash || hash === '#') return null;
    
    const hashContent = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(hashContent);
    
    const roomId = params.get('room');
    const key = params.get('key');
    
    if (roomId) {
        return { roomId, key };
    }
    
    // Альтернативный парсинг
    if (hashContent.includes('room=')) {
        const parts = hashContent.split('&');
        const roomPart = parts.find(p => p.startsWith('room='));
        const keyPart = parts.find(p => p.startsWith('key='));
        
        return {
            roomId: roomPart ? roomPart.split('=')[1] : null,
            key: keyPart ? keyPart.split('=')[1] : null
        };
    }
    
    return null;
}

async function parseAndJoin(link) {
    try {
        const url = new URL(link);
        const hash = url.hash.slice(1);
        const params = new URLSearchParams(hash);
        const roomId = params.get('room');
        const key = params.get('key');
        
        if (!roomId) return alert('Неверная ссылка');
        
        AppState.roomId = roomId;
        AppState.isHost = false;
        AppState.userName = ($('#joinUserName') && $('#joinUserName').value.trim()) || 'Гость';
        AppState.cameraEnabled = $('#joinCameraToggle') ? $('#joinCameraToggle').checked : true;
        AppState.micEnabled = $('#joinMicToggle') ? $('#joinMicToggle').checked : true;
        
        if (key) {
            AppState.encryptionKeyStr = key;
            if (typeof CryptoModule !== 'undefined') {
                try {
                    const keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
                    await CryptoModule.importKey(keyBytes);
                } catch (e) {
                    console.error('Ошибка импорта ключа:', e);
                }
            }
        }
        
        await joinRoom(roomId);
        
    } catch (e) {
        alert('Неверный формат ссылки');
    }
}

// ===== Присоединение к комнате =====
async function joinRoom(roomId) {
    AppState.roomId = roomId;
    
    try {
        // Сначала показываем экран встречи
        switchScreen('meetingScreen');
        updateLocalDisplay();
        startTimer();
        updateStatus('Подключение к защищённой встрече...');
        
        // Захватываем медиа
        if (AppState.cameraEnabled) {
            await captureMedia();
        }
        
        // Инициализируем Trystero
        initTrystero();
        
    } catch (error) {
        alert('Ошибка: ' + error.message);
        console.error(error);
    }
}

// ===== Проверка URL при загрузке =====
function checkUrlForRoom() {
    console.log('Проверка URL при загрузке...');
    console.log('Текущий URL:', window.location.href);
    
    const parsed = parseHashParams();
    
    if (parsed && parsed.roomId) {
        console.log('Найдена комната:', parsed.roomId);
        
        AppState.roomId = parsed.roomId;
        AppState.isHost = false;
        
        if (parsed.key) {
            console.log('Найден ключ шифрования');
            AppState.encryptionKeyStr = parsed.key;
            
            try {
                if (typeof CryptoModule !== 'undefined') {
                    const keyBytes = Uint8Array.from(atob(parsed.key), c => c.charCodeAt(0));
                    CryptoModule.importKey(keyBytes);
                    console.log('Ключ импортирован');
                }
            } catch (e) {
                console.error('Ошибка импорта ключа:', e);
            }
        }
        
        // Скрываем все экраны кроме приглашения
        const screens = $$('.screen');
        screens.forEach(s => s.classList.add('hidden'));
        
        const inviteScreen = $('#inviteScreen');
        if (inviteScreen) inviteScreen.classList.remove('hidden');
        
        // Генерируем QR
        setTimeout(() => {
            const qrCanvas = $('#inviteQRCanvas');
            if (qrCanvas) generateQRCode(qrCanvas, window.location.href);
        }, 500);
        
        // Запускаем предпросмотр
        setTimeout(() => {
            const cameraToggle = $('#inviteCameraToggle');
            if (cameraToggle && cameraToggle.checked) {
                startCameraPreview($('#invitePreviewVideo'), $('#inviteAvatarEmoji'));
            }
        }, 800);
        
        return true;
    }
    
    console.log('Комната не найдена в URL');
    return false;
}

// ===== UI =====
function updateLocalDisplay() {
    const localName = $('#localName');
    if (localName) localName.textContent = AppState.userName || 'Вы';
    
    const localAvatarEmoji = $('#localAvatarEmoji');
    if (localAvatarEmoji) localAvatarEmoji.textContent = AppState.userEmoji;
    
    if (AppState.cameraEnabled) {
        const localVideo = $('#localVideo');
        if (localVideo && localVideo.parentElement) {
            localVideo.parentElement.classList.remove('hidden');
        }
        const localAvatarWrapper = $('#localAvatarWrapper');
        if (localAvatarWrapper) localAvatarWrapper.classList.add('hidden');
    } else {
        const localVideo = $('#localVideo');
        if (localVideo && localVideo.parentElement) {
            localVideo.parentElement.classList.add('hidden');
        }
        const localAvatarWrapper = $('#localAvatarWrapper');
        if (localAvatarWrapper) localAvatarWrapper.classList.remove('hidden');
    }
    
    if (AppState.isHost) {
        const hostChip = $('#hostChip');
        if (hostChip) hostChip.classList.remove('hidden');
    }
    
    updateMicButton();
}

function updateRemoteUser(info) {
    console.log('Обновление информации о пользователе:', info);
    
    const name = info.name || 'Собеседник';
    const hasVideo = info.hasVideo !== undefined ? info.hasVideo : true;
    const emoji = info.emoji || '👤';
    
    const remoteName = $('#remoteName');
    if (remoteName) remoteName.textContent = name;
    
    const remoteEmojiEl = document.querySelector('#remoteAvatarWrapper .avatar-emoji');
    if (remoteEmojiEl) remoteEmojiEl.textContent = emoji;
    
    const remoteCard = $('#remoteCard');
    if (remoteCard) remoteCard.classList.remove('hidden');
    
    const emptyState = $('#emptyState');
    if (emptyState) emptyState.classList.add('hidden');
    
    if (!hasVideo) {
        const remoteVideo = $('#remoteVideo');
        if (remoteVideo && remoteVideo.parentElement) {
            remoteVideo.parentElement.classList.add('hidden');
        }
        const remoteAvatarWrapper = $('#remoteAvatarWrapper');
        if (remoteAvatarWrapper) remoteAvatarWrapper.classList.remove('hidden');
    }
    
    updateParticipantCount();
}

function updateParticipantCount() {
    const count = AppState.peers.size + 1;
    const participantCount = $('#participantCount');
    if (participantCount) participantCount.textContent = count;
}

function updateStatus(text) {
    const meetingStatus = $('#meetingStatus');
    if (meetingStatus) meetingStatus.textContent = text;
}

// ===== Мониторинг безопасности =====
function startSecurityMonitoring() {
    if (typeof CryptoModule === 'undefined') return;
    
    AppState.securityCheckInterval = setInterval(() => {
        const stats = CryptoModule.securityStats;
        
        if (stats.invalidSignatures > 3) {
            CryptoModule.triggerAlert('MANY_INVALID_SIGNATURES', 
                'Слишком много недействительных подписей!');
        }
        
        if (stats.replayAttacks > 2) {
            CryptoModule.triggerAlert('MANY_REPLAYS', 
                'Обнаружено множество replay-атак!');
        }
        
    }, 3000);
}

// ===== Таймер =====
function startTimer() {
    AppState.startTime = Date.now();
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - AppState.startTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        const timerDisplay = $('#timerDisplay');
        if (timerDisplay) timerDisplay.textContent = `${mins}:${secs}`;
    }, 1000);
}

// ===== Завершение =====
function hangUp() {
    AppState.peers.forEach(peer => {
        try { peer.destroy(); } catch(e) {}
    });
    AppState.peers.clear();
    
    if (AppState.room) {
        try { AppState.room.leave(); } catch(e) {}
        AppState.room = null;
    }
    
    if (AppState.localStream) {
        AppState.localStream.getTracks().forEach(t => t.stop());
        AppState.localStream = null;
    }
    
    stopScreenShare();
    stopScanner();
    stopCameraPreview();
    
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    if (AppState.securityCheckInterval) clearInterval(AppState.securityCheckInterval);
    
    AppState.isHost = false;
    AppState.roomId = null;
    AppState.isConnected = false;
    AppState.sendSignal = null;
    AppState.sendChatMsg = null;
    AppState.sendUserInfo = null;
    
    const alertOverlay = $('#alertOverlay');
    if (alertOverlay) alertOverlay.classList.add('hidden');
    
    const meetingLayout = $('#meetingLayout');
    if (meetingLayout) meetingLayout.style.filter = 'none';
    
    switchScreen('mainScreen');
    
    window.location.hash = '';
}

function goToMain() {
    stopCameraPreview();
    stopScanner();
    switchScreen('mainScreen');
}

// ===== Утилиты =====
function generateRoomId() {
    return 'meet-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function generateMeetingLink() {
    const base = window.location.href.split('#')[0];
    const cleanBase = base.replace(/index\.html$/, '');
    return `${cleanBase}#room=${AppState.roomId}&key=${AppState.encryptionKeyStr}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('beforeunload', hangUp);