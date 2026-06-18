// ===== Confidential Meetings - MULTI PEER STAR =====

const AppState = {
    userName: '', userEmoji: '😊', cameraEnabled: true, micEnabled: true,
    screenSharing: false, isHost: false, roomId: null,
    localStream: null, screenStream: null,
    peers: new Map(), // peerId -> SimplePeer
    room: null,
    sendSignal: null, sendChatMsg: null, sendUserInfo: null,
    scannerStream: null, timerInterval: null, startTime: null, previewStream: null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const EMOJIS = ['😊','😎','🤗','😇','🙂','😄','🥳','😌','🤩','😁','😺','🦊','🐱','🐼','🐨'];

function showNotification(msg) {
    const el = $('#meetingStatus'); if (!el) return;
    el.textContent = msg; el.style.color = '#fdcb6e';
    setTimeout(() => { el.style.color = ''; }, 3000);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 MULTI PEER STAR');
    setupMain(); setupCreate(); setupJoin(); setupInvite(); setupMeeting();
    setTimeout(() => { if (!checkUrl()) $('#mainScreen').classList.remove('hidden'); }, 500);
});

function getEmoji() { return EMOJIS[Math.floor(Math.random()*EMOJIS.length)]; }

async function startPreview(vid, emoji) {
    if (!vid) return;
    try { stopPreview(); const s = await navigator.mediaDevices.getUserMedia({ video: { width:640, height:480 }, audio:false }); AppState.previewStream=s; vid.srcObject=s; vid.classList.remove('hidden'); if(emoji)emoji.classList.add('hidden'); } catch(e) { vid.classList.add('hidden'); if(emoji)emoji.classList.remove('hidden'); }
}
function stopPreview() { if(AppState.previewStream){AppState.previewStream.getTracks().forEach(t=>t.stop());AppState.previewStream=null;} }

function switchScreen(id) {
    ['mainScreen','createScreen','joinScreen','inviteScreen','meetingScreen','scannerScreen'].forEach(x=>{const e=$('#'+x);if(e)e.classList.add('hidden');});
    const t=$('#'+id); if(t)t.classList.remove('hidden');
}

// ===== ГЛАВНЫЙ ЭКРАН =====
function setupMain() {
    $('#showCreateBtn').onclick = () => { AppState.userEmoji=getEmoji(); $('#createAvatarEmoji').textContent=AppState.userEmoji; switchScreen('createScreen'); if($('#createCameraToggle').checked)startPreview($('#createPreviewVideo'),$('#createAvatarEmoji')); };
    $('#showJoinBtn').onclick = () => { AppState.userEmoji=getEmoji(); $('#joinAvatarEmoji').textContent=AppState.userEmoji; switchScreen('joinScreen'); if($('#joinCameraToggle').checked)startPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji')); };
}

// ===== СОЗДАНИЕ ВСТРЕЧИ (ХОСТ) =====
function setupCreate() {
    $('#createCameraToggle').onchange = function() { if(this.checked)startPreview($('#createPreviewVideo'),$('#createAvatarEmoji')); else{stopPreview();$('#createPreviewVideo').classList.add('hidden');$('#createAvatarEmoji').classList.remove('hidden');} };
    $('#createMeetingBtn').onclick = async () => {
        AppState.userName = $('#createUserName').value.trim()||'Организатор';
        AppState.isHost = true;
        AppState.cameraEnabled = true;
        AppState.micEnabled = true;
        try {
            stopPreview();
            AppState.roomId = 'meet-'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);
            await captureMedia();
            const cam = $('#createCameraToggle').checked;
            const mic = $('#createMicToggle').checked;
            if (!cam && AppState.localStream) { const t = AppState.localStream.getVideoTracks()[0]; if(t){t.enabled=false; AppState.cameraEnabled=false;} }
            if (!mic && AppState.localStream) { const t = AppState.localStream.getAudioTracks()[0]; if(t){t.enabled=false; AppState.micEnabled=false;} }
            
            initTrystero();
            switchScreen('meetingScreen');
            updateUI();
            updateHostUI();
            startTimer();
            showNotification('✅ Встреча создана');
            
            const link = location.href.split('#')[0].replace(/index\.html$/,'')+'#room='+AppState.roomId;
            $('#meetingLink').value = link;
            try { new QRCode($('#qrCanvas'),{text:link,width:200,height:200}); } catch(e){}
        } catch(e) { alert('Ошибка: '+e.message); }
    };
    $('#changeCreateAvatar').onclick = () => { const e=getEmoji(); $('#createAvatarEmoji').textContent=e; AppState.userEmoji=e; };
}

// ===== ПРИСОЕДИНЕНИЕ (ГОСТЬ) =====
function setupJoin() {
    $('#joinCameraToggle').onchange = function() { if(this.checked)startPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji')); else{stopPreview();$('#joinPreviewVideo').classList.add('hidden');$('#joinAvatarEmoji').classList.remove('hidden');} };
    $('#joinByLinkBtn').onclick = () => $('#linkInputGroup').classList.remove('hidden');
    $('#joinByQRBtn').onclick = () => { stopPreview(); switchScreen('scannerScreen'); startScanner(); };
    $('#connectByLinkBtn').onclick = async () => {
        const link = $('#meetingLinkInput').value.trim();
        if (!link) return alert('Вставьте ссылку');
        stopPreview();
        try {
            const u = new URL(link); const h = u.hash.slice(1); const p = new URLSearchParams(h);
            const r = p.get('room'); if (!r) return alert('Неверная ссылка');
            AppState.roomId = r; AppState.isHost = false;
            AppState.cameraEnabled = true; AppState.micEnabled = true;
            AppState.userName = $('#joinUserName').value.trim()||'Гость';
            
            switchScreen('meetingScreen'); updateUI(); updateHostUI(); startTimer();
            showNotification('🔄 Подключение...');
            await captureMedia();
            const cam = $('#joinCameraToggle').checked;
            const mic = $('#joinMicToggle').checked;
            if (!cam && AppState.localStream) { const t = AppState.localStream.getVideoTracks()[0]; if(t){t.enabled=false; AppState.cameraEnabled=false;} }
            if (!mic && AppState.localStream) { const t = AppState.localStream.getAudioTracks()[0]; if(t){t.enabled=false; AppState.micEnabled=false;} }
            initTrystero();
        } catch(e) { alert('Неверный формат ссылки'); }
    };
    $('#changeJoinAvatar').onclick = () => { const e=getEmoji(); $('#joinAvatarEmoji').textContent=e; AppState.userEmoji=e; };
    $('#backFromScanner').onclick = () => { stopScanner(); switchScreen('joinScreen'); if($('#joinCameraToggle').checked)startPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji')); };
}

function setupInvite() {
    $('#inviteCameraToggle').onchange = function() { if(this.checked)startPreview($('#invitePreviewVideo'),$('#inviteAvatarEmoji')); else{stopPreview();$('#invitePreviewVideo').classList.add('hidden');$('#inviteAvatarEmoji').classList.remove('hidden');} };
    $('#inviteConnectBtn').onclick = async () => {
        AppState.userName = $('#inviteUserName').value.trim()||'Гость'; AppState.isHost = false;
        AppState.cameraEnabled = true; AppState.micEnabled = true;
        if (!AppState.roomId) return alert('Не найдена комната');
        try {
            stopPreview(); switchScreen('meetingScreen'); updateUI(); updateHostUI(); startTimer();
            showNotification('🔄 Подключение...'); await captureMedia();
            const cam = $('#inviteCameraToggle').checked; const mic = $('#inviteMicToggle').checked;
            if (!cam && AppState.localStream) { const t = AppState.localStream.getVideoTracks()[0]; if(t){t.enabled=false; AppState.cameraEnabled=false;} }
            if (!mic && AppState.localStream) { const t = AppState.localStream.getAudioTracks()[0]; if(t){t.enabled=false; AppState.micEnabled=false;} }
            initTrystero();
        } catch(e) { alert('Ошибка: '+e.message); }
    };
    $('#changeInviteAvatar').onclick = () => { const e=getEmoji(); $('#inviteAvatarEmoji').textContent=e; AppState.userEmoji=e; };
}

function updateHostUI() {
    const btn = $('#shareBtn');
    if (btn) btn.style.display = AppState.isHost ? 'flex' : 'none';
}

function setupMeeting() {
    $('#micBtn').onclick = toggleMic;
    $('#cameraBtn').onclick = toggleCamera;
    $('#screenShareBtn').onclick = toggleScreenShare;
    $('#shareBtn').onclick = () => { if(!AppState.isHost)return; $('#sharePanel').classList.toggle('hidden'); $('#chatPanel').classList.add('hidden'); };
    $('#chatBtn').onclick = () => { $('#chatPanel').classList.toggle('hidden'); $('#sharePanel').classList.add('hidden'); };
    $('#hangupBtn').onclick = hangUp;
    $('#closeSharePanel').onclick = () => $('#sharePanel').classList.add('hidden');
    $('#closeChatPanel').onclick = () => $('#chatPanel').classList.add('hidden');
    $('#copyLinkBtn').onclick = () => { const i=$('#meetingLink'); if(i){i.select();document.execCommand('copy');} const b=$('#copyLinkBtn'); b.innerHTML='<i class="fas fa-check"></i>'; setTimeout(()=>{b.innerHTML='<i class="fas fa-copy"></i>';},1500); };
    $('#sendMessageBtn').onclick = sendChat;
    $('#chatInput').onkeypress = (e) => { if(e.key==='Enter') sendChat(); };
    $('#changeLocalAvatar').onclick = () => { const e=getEmoji(); $('#localAvatarEmoji').textContent=e; AppState.userEmoji=e; sendMyInfo(); };
}

function sendMyInfo() {
    if (!AppState.sendUserInfo) return;
    AppState.sendUserInfo({ name: AppState.userName, hasVideo: AppState.cameraEnabled, emoji: AppState.userEmoji, role: AppState.isHost?'Организатор':'Участник' });
}

async function captureMedia() {
    try {
        AppState.localStream = await navigator.mediaDevices.getUserMedia({ video: { width:1280, height:720 }, audio: true });
        const lv = $('#localVideo'); if (lv) { lv.srcObject = AppState.localStream; lv.parentElement.classList.remove('hidden'); }
        $('#localAvatarWrapper').classList.add('hidden');
        updateMicBtn(); updateCamBtn();
    } catch(e) {
        AppState.cameraEnabled = false;
        $('#localVideo').parentElement.classList.add('hidden');
        $('#localAvatarWrapper').classList.remove('hidden');
    }
}

// ===== ДЕМОНСТРАЦИЯ ЭКРАНА =====
async function toggleScreenShare() {
    if (AppState.screenSharing) { stopScreenShare(); return; }
    try {
        AppState.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        AppState.screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
        
        const ssv = $('#screenShareVideo'); if (ssv) ssv.srcObject = AppState.screenStream;
        $('#screenShareCard').classList.remove('hidden');
        $('#screenShareBtn').classList.add('active');
        AppState.screenSharing = true;
        
        const screenTrack = AppState.screenStream.getVideoTracks()[0];
        AppState.peers.forEach(peer => { try { peer.addTrack(screenTrack, AppState.localStream); } catch(e){} });
        
        showNotification('📺 Демонстрация экрана включена');
    } catch(e) { console.error(e); }
}

function stopScreenShare() {
    if (AppState.screenStream) { AppState.screenStream.getTracks().forEach(t=>t.stop()); AppState.screenStream = null; }
    const ssv = $('#screenShareVideo'); if (ssv) ssv.srcObject = null;
    $('#screenShareCard').classList.add('hidden');
    $('#screenShareBtn').classList.remove('active');
    AppState.screenSharing = false;
    showNotification('📺 Демонстрация экрана выключена');
}

// ===== Trystero + Multi-Peer =====
function initTrystero() {
    if (!window.trysteroJoinRoom) { showNotification('Ошибка модуля связи'); return; }
    console.log('🔗 Комната:', AppState.roomId, 'Роль:', AppState.isHost?'ХОСТ':'ГОСТЬ');
    
    AppState.room = window.trysteroJoinRoom({ appId: 'star-'+AppState.roomId }, 'meeting');
    
    const [sendSignal, getSignal] = AppState.room.makeAction('signal');
    const [sendChat, getChat] = AppState.room.makeAction('chat');
    const [sendUserInfo, getUserInfo] = AppState.room.makeAction('userInfo');
    
    AppState.sendSignal = sendSignal;
    AppState.sendChatMsg = sendChat;
    AppState.sendUserInfo = sendUserInfo;
    
    // Сигналы
    getSignal((data, peerId) => {
        console.log('📡 Сигнал от:', peerId);
        let peer = AppState.peers.get(peerId);
        if (!peer) {
            // Хост создаёт peer когда получает сигнал (не инициатор)
            // Гость уже создал peer в onPeerJoin (инициатор)
            peer = createPeer(peerId, !AppState.isHost);
        }
        try { peer.signal(data); } catch(e) { console.error('Signal error:', e); }
    });
    
    // Чат
    getChat((data) => { if (data && data.text) showChatMsg(data.sender||'Собеседник', data.text, false); });
    
    // Информация о пользователе
    getUserInfo((info) => { updateRemote(info); });
    
    // Новый участник
    AppState.room.onPeerJoin((peerId) => {
        console.log('🟢 Новый участник:', peerId);
        setTimeout(() => sendMyInfo(), 500);
        
        // ГОСТЬ: инициирует WebRTC соединение к хосту
        if (!AppState.isHost) {
            console.log('📞 Гость инициирует WebRTC');
            createPeer(peerId, true);
        }
        // ХОСТ: ждёт сигнала от гостя (создаст peer в getSignal)
    });
    
    // Участник отключился
    AppState.room.onPeerLeave((peerId) => {
        console.log('🔴 Участник отключился:', peerId);
        const peer = AppState.peers.get(peerId);
        if (peer) peer.destroy();
        AppState.peers.delete(peerId);
        removeRemoteVideo(peerId);
        updateCount();
        showNotification('Участник отключился');
    });
}

function createPeer(peerId, initiator) {
    console.log('🔧 Создание peer:', peerId, 'Инициатор:', initiator);
    
    const streams = [];
    if (AppState.localStream) streams.push(AppState.localStream);
    if (AppState.screenStream) streams.push(AppState.screenStream);
    
    const peer = new SimplePeer({
        initiator: initiator,
        streams: streams,
        trickle: true,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });
    
    peer.on('signal', (data) => {
        console.log('📤 Сигнал для:', peerId);
        if (AppState.sendSignal) AppState.sendSignal(data);
    });
    
    peer.on('stream', (stream) => {
        console.log('📥 Поток от:', peerId, 'Дорожек:', stream.getTracks().length);
        
        const vt = stream.getVideoTracks();
        let isScreen = false;
        
        for (const track of vt) {
            const label = (track.label || '').toLowerCase();
            if (label.includes('screen') || label.includes('display')) {
                isScreen = true;
                const ssv = $('#screenShareVideo');
                if (ssv) ssv.srcObject = stream;
                $('#screenShareCard').classList.remove('hidden');
                showNotification('📺 Участник демонстрирует экран');
                break;
            }
        }
        
        if (!isScreen && vt.length > 0) {
            addRemoteVideo(peerId, stream);
        }
        
        updateCount();
        showNotification('✅ Участник подключился');
    });
    
    peer.on('connect', () => console.log('🔗 Peer подключен:', peerId));
    
    peer.on('close', () => {
        console.log('❌ Peer закрыт:', peerId);
        AppState.peers.delete(peerId);
        removeRemoteVideo(peerId);
        updateCount();
    });
    
    peer.on('error', (err) => console.error('Peer error:', peerId, err));
    
    AppState.peers.set(peerId, peer);
    return peer;
}

// ===== УПРАВЛЕНИЕ ВИДЕО КАРТОЧКАМИ =====
function addRemoteVideo(peerId, stream) {
    const grid = $('#participantsGrid');
    if (!grid) return;
    
    // Удаляем старую карточку если есть
    removeRemoteVideo(peerId);
    
    // Создаём новую карточку
    const card = document.createElement('div');
    card.id = 'card-' + peerId;
    card.className = 'participant-card remote';
    card.innerHTML = `
        <div class="video-wrapper">
            <video id="video-${peerId}" autoplay playsinline></video>
        </div>
        <div class="avatar-wrapper hidden">
            <div class="avatar-circle"><span class="avatar-emoji">👤</span></div>
        </div>
        <div class="participant-overlay">
            <div class="participant-details">
                <span class="participant-name" id="name-${peerId}">Участник</span>
            </div>
            <div class="media-status"><i class="fas fa-microphone"></i></div>
        </div>
    `;
    
    const emptyState = $('#emptyState');
    if (emptyState) {
        grid.insertBefore(card, emptyState);
    } else {
        grid.appendChild(card);
    }
    
    const video = document.getElementById('video-' + peerId);
    if (video && stream) {
        video.srcObject = stream;
    }
    
    // Скрываем empty state
    if (emptyState) emptyState.classList.add('hidden');
    
    // Скрываем старую одиночную карточку remote
    const remoteCard = $('#remoteCard');
    if (remoteCard) remoteCard.classList.add('hidden');
}

function removeRemoteVideo(peerId) {
    const card = document.getElementById('card-' + peerId);
    if (card) card.remove();
    
    if (AppState.peers.size === 0) {
        const emptyState = $('#emptyState');
        if (emptyState) emptyState.classList.remove('hidden');
    }
}

// ===== УПРАВЛЕНИЕ =====
function toggleMic() {
    if (!AppState.localStream) return;
    const t = AppState.localStream.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; AppState.micEnabled = t.enabled; updateMicBtn(); showNotification(AppState.micEnabled?'🎤 Микрофон включен':'🔇 Микрофон выключен'); }
}
function updateMicBtn() { const b=$('#micBtn'); const i=$('#localMicIcon'); if(AppState.micEnabled){b.classList.remove('off');i.className='fas fa-microphone';}else{b.classList.add('off');i.className='fas fa-microphone-slash mic-off';} }

function toggleCamera() {
    if (!AppState.localStream) return;
    const t = AppState.localStream.getVideoTracks()[0];
    if (t) {
        t.enabled = !t.enabled; AppState.cameraEnabled = t.enabled; updateCamBtn();
        showNotification(AppState.cameraEnabled?'📹 Камера включена':'📷 Камера выключена');
        if (AppState.cameraEnabled) { $('#localVideo').parentElement.classList.remove('hidden'); $('#localAvatarWrapper').classList.add('hidden'); }
        else { $('#localVideo').parentElement.classList.add('hidden'); $('#localAvatarWrapper').classList.remove('hidden'); }
        sendMyInfo();
    }
}
function updateCamBtn() { const b=$('#cameraBtn'); if(AppState.cameraEnabled)b.classList.remove('off'); else b.classList.add('off'); }

// ===== ЧАТ =====
function sendChat() {
    const ci = $('#chatInput'); if (!ci) return;
    const t = ci.value.trim(); if (!t) return;
    showChatMsg(AppState.userName, t, true);
    if (AppState.sendChatMsg) AppState.sendChatMsg({ sender: AppState.userName, text: t, timestamp: Date.now() });
    ci.value = ''; ci.focus();
}
function showChatMsg(sender, text, isMine) {
    const cm = $('#chatMessages'); if (!cm) return;
    const d = document.createElement('div'); d.className = 'chat-message '+(isMine?'mine':'other');
    d.innerHTML = '<span class="sender">'+sender+'</span><span class="text">'+text.replace(/</g,'&lt;')+'</span>';
    const empty = cm.querySelector('.chat-empty'); if (empty) empty.remove();
    cm.appendChild(d); cm.scrollTop = cm.scrollHeight;
}

// ===== СКАНЕР =====
async function startScanner() {
    try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        AppState.scannerStream = s; $('#scannerVideo').srcObject = s;
        const iv = setInterval(() => {
            if (!AppState.scannerStream) { clearInterval(iv); return; }
            const v = $('#scannerVideo'); if (!v || v.readyState < 2) return;
            const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
            const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0);
            const code = jsQR(ctx.getImageData(0,0,c.width,c.height).data, c.width, c.height);
            if (code && code.data) {
                clearInterval(iv); stopScanner();
                try {
                    const u = new URL(code.data); const h = u.hash.slice(1); const p = new URLSearchParams(h);
                    const r = p.get('room'); if (!r) return;
                    AppState.roomId = r; AppState.isHost = false;
                    AppState.cameraEnabled = true; AppState.micEnabled = true;
                    AppState.userName = $('#joinUserName').value.trim()||'Гость';
                    switchScreen('meetingScreen'); updateUI(); updateHostUI(); startTimer();
                    showNotification('🔄 Подключение...');
                    captureMedia().then(() => {
                        const cam = $('#joinCameraToggle').checked; const mic = $('#joinMicToggle').checked;
                        if (!cam && AppState.localStream) { const t = AppState.localStream.getVideoTracks()[0]; if(t){t.enabled=false; AppState.cameraEnabled=false;} }
                        if (!mic && AppState.localStream) { const t = AppState.localStream.getAudioTracks()[0]; if(t){t.enabled=false; AppState.micEnabled=false;} }
                        initTrystero();
                    });
                } catch(e) { alert('Неверный QR-код'); }
            }
        }, 100);
    } catch(e) { alert('Ошибка камеры'); switchScreen('joinScreen'); }
}
function stopScanner() { if (AppState.scannerStream) { AppState.scannerStream.getTracks().forEach(t=>t.stop()); AppState.scannerStream = null; } }

// ===== URL =====
function checkUrl() {
    const h = window.location.hash; if (!h || h === '#') return false;
    const hc = h.startsWith('#') ? h.slice(1) : h;
    const p = new URLSearchParams(hc); const r = p.get('room');
    if (!r) return false;
    AppState.roomId = r; AppState.isHost = false;
    $$('.screen').forEach(s => s.classList.add('hidden'));
    $('#inviteScreen').classList.remove('hidden');
    setTimeout(() => { try { new QRCode($('#inviteQRCanvas'), { text: location.href, width:200, height:200 }); } catch(e){} }, 500);
    setTimeout(() => { if ($('#inviteCameraToggle').checked) startPreview($('#invitePreviewVideo'), $('#inviteAvatarEmoji')); }, 800);
    return true;
}

// ===== UI =====
function updateUI() {
    const role = AppState.isHost ? 'Организатор' : 'Участник';
    $('#localName').textContent = (AppState.userName || 'Вы') + ' • ' + role;
    $('#localAvatarEmoji').textContent = AppState.userEmoji;
    if (AppState.cameraEnabled) { $('#localVideo').parentElement.classList.remove('hidden'); $('#localAvatarWrapper').classList.add('hidden'); }
    else { $('#localVideo').parentElement.classList.add('hidden'); $('#localAvatarWrapper').classList.remove('hidden'); }
    if (AppState.isHost) $('#hostChip').classList.remove('hidden');
    else $('#hostChip').classList.add('hidden');
    updateMicBtn(); updateCamBtn();
}

function updateRemote(info) {
    if (!info || !info.name) return;
    // Обновляем имя в карточках
    const cards = document.querySelectorAll('.participant-card.remote');
    cards.forEach(card => {
        const nameEl = card.querySelector('.participant-name');
        if (nameEl && nameEl.textContent.startsWith(info.name)) {
            nameEl.textContent = info.name + (info.role ? ' • ' + info.role : '');
        }
    });
    updateCount();
}

function updateCount() {
    const count = AppState.peers.size + 1;
    $('#participantCount').textContent = count;
}

function startTimer() {
    AppState.startTime = Date.now();
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.timerInterval = setInterval(() => {
        const e = Math.floor((Date.now() - AppState.startTime) / 1000);
        const m = Math.floor(e / 60).toString().padStart(2, '0');
        const s = (e % 60).toString().padStart(2, '0');
        $('#timerDisplay').textContent = m + ':' + s;
    }, 1000);
}

function hangUp() {
    if (AppState.screenStream) { AppState.screenStream.getTracks().forEach(t=>t.stop()); AppState.screenStream = null; }
    AppState.screenSharing = false;
    AppState.peers.forEach(p => { try { p.destroy(); } catch(e){} });
    AppState.peers.clear();
    if (AppState.room) { try { AppState.room.leave(); } catch(e){} AppState.room = null; }
    if (AppState.localStream) { AppState.localStream.getTracks().forEach(t=>t.stop()); AppState.localStream = null; }
    stopScanner(); stopPreview();
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.isHost = false; AppState.roomId = null;
    AppState.sendSignal = null; AppState.sendChatMsg = null; AppState.sendUserInfo = null;
    // Удаляем все динамические карточки
    document.querySelectorAll('[id^="card-"]').forEach(c => c.remove());
    switchScreen('mainScreen'); window.location.hash = '';
}

function goToMain() { stopPreview(); stopScanner(); switchScreen('mainScreen'); }
function generateRoomId() { return 'meet-'+Math.random().toString(36).substring(2,10)+Date.now().toString(36); }
function generateMeetingLink() { const b = window.location.href.split('#')[0].replace(/index\.html$/,''); return `${b}#room=${AppState.roomId}`; }
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
window.addEventListener('beforeunload', hangUp);