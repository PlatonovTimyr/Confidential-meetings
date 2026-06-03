// ===== Confidential Meetings v17 STABLE =====

const AppState = {
    userName: '', userEmoji: '😊', cameraEnabled: true, micEnabled: true,
    isHost: false, roomId: null, encryptionKeyStr: '',
    localStream: null, peers: new Map(), room: null,
    sendSignal: null, sendChatMsg: null, sendUserInfo: null,
    scannerStream: null, isConnected: false,
    timerInterval: null, startTime: null, previewStream: null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const EMOJIS = ['😊','😎','🤗','😇','🙂','😄','🥳','😌','🤩','😁'];

function showNotification(msg) {
    const el = $('#meetingStatus'); if (!el) return;
    el.textContent = msg; el.style.color = '#fdcb6e';
    setTimeout(() => { el.style.color = ''; }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 v17 STABLE');
    setupMain(); setupCreate(); setupJoin(); setupInvite(); setupMeeting();
    setTimeout(() => { if (!checkUrl()) $('#mainScreen').classList.remove('hidden'); }, 500);
});

function getEmoji() { return EMOJIS[Math.floor(Math.random()*EMOJIS.length)]; }

async function startPreview(vid, emoji) {
    if (!vid) return;
    try {
        stopPreview();
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        AppState.previewStream = s; vid.srcObject = s; vid.classList.remove('hidden');
        if (emoji) emoji.classList.add('hidden');
    } catch(e) { vid.classList.add('hidden'); if (emoji) emoji.classList.remove('hidden'); }
}
function stopPreview() { if (AppState.previewStream) { AppState.previewStream.getTracks().forEach(t=>t.stop()); AppState.previewStream=null; } }

function switchScreen(id) {
    ['mainScreen','createScreen','joinScreen','inviteScreen','meetingScreen','scannerScreen'].forEach(x=>{const e=$('#'+x);if(e)e.classList.add('hidden');});
    const t=$('#'+id); if(t)t.classList.remove('hidden');
}

function setupMain() {
    $('#showCreateBtn').onclick = () => {
        AppState.userEmoji=getEmoji(); const e=$('#createAvatarEmoji');if(e)e.textContent=AppState.userEmoji;
        switchScreen('createScreen'); if($('#createCameraToggle').checked) startPreview($('#createPreviewVideo'),$('#createAvatarEmoji'));
    };
    $('#showJoinBtn').onclick = () => {
        AppState.userEmoji=getEmoji(); const e=$('#joinAvatarEmoji');if(e)e.textContent=AppState.userEmoji;
        switchScreen('joinScreen'); if($('#joinCameraToggle').checked) startPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji'));
    };
}

function setupCreate() {
    $('#createCameraToggle').onchange = function() {
        if(this.checked) startPreview($('#createPreviewVideo'),$('#createAvatarEmoji'));
        else { stopPreview(); $('#createPreviewVideo').classList.add('hidden'); $('#createAvatarEmoji').classList.remove('hidden'); }
    };
    $('#createMeetingBtn').onclick = async () => {
        AppState.userName = $('#createUserName').value.trim() || 'Организатор';
        AppState.isHost = true; AppState.cameraEnabled = true; AppState.micEnabled = true;
        try {
            stopPreview(); AppState.roomId = 'meet-'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);
            await captureMedia();
            const cam = $('#createCameraToggle').checked;
            const mic = $('#createMicToggle').checked;
            if (!cam && AppState.localStream) { const t=AppState.localStream.getVideoTracks()[0]; if(t){t.enabled=false; AppState.cameraEnabled=false;} }
            if (!mic && AppState.localStream) { const t=AppState.localStream.getAudioTracks()[0]; if(t){t.enabled=false; AppState.micEnabled=false;} }
            initTrystero(); switchScreen('meetingScreen'); updateUI(); updateHostUI(); startTimer();
            showNotification('✅ Встреча создана');
            const link = location.href.split('#')[0].replace(/index\.html$/,'')+'#room='+AppState.roomId+'&key='+AppState.encryptionKeyStr;
            const ml=$('#meetingLink'); if(ml)ml.value=link;
            const qc=$('#qrCanvas'); if(qc) new QRCode(qc,{text:link,width:200,height:200});
        } catch(e) { alert('Ошибка: '+e.message); }
    };
    $('#changeCreateAvatar').onclick = () => { const e=getEmoji(); $('#createAvatarEmoji').textContent=e; AppState.userEmoji=e; };
}

function setupJoin() {
    $('#joinCameraToggle').onchange = function() {
        if(this.checked) startPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji'));
        else { stopPreview(); $('#joinPreviewVideo').classList.add('hidden'); $('#joinAvatarEmoji').classList.remove('hidden'); }
    };
    $('#joinByLinkBtn').onclick = () => $('#linkInputGroup').classList.remove('hidden');
    $('#joinByQRBtn').onclick = () => { stopPreview(); switchScreen('scannerScreen'); startScanner(); };
    $('#connectByLinkBtn').onclick = async () => {
        const link = $('#meetingLinkInput').value.trim();
        if (!link) return alert('Вставьте ссылку');
        stopPreview();
        try {
            const u = new URL(link); const h = u.hash.slice(1); const p = new URLSearchParams(h);
            const r = p.get('room'); if (!r) return alert('Неверная ссылка');
            AppState.roomId = r; AppState.isHost = false; AppState.cameraEnabled = true; AppState.micEnabled = true;
            if (p.get('key')) AppState.encryptionKeyStr = p.get('key');
            AppState.userName = $('#joinUserName').value.trim() || 'Гость';
            switchScreen('meetingScreen'); updateUI(); updateHostUI(); startTimer();
            showNotification('🔄 Подключение...');
            await captureMedia();
            const cam = $('#joinCameraToggle').checked;
            const mic = $('#joinMicToggle').checked;
            if (!cam && AppState.localStream) { const t=AppState.localStream.getVideoTracks()[0]; if(t){t.enabled=false; AppState.cameraEnabled=false;} }
            if (!mic && AppState.localStream) { const t=AppState.localStream.getAudioTracks()[0]; if(t){t.enabled=false; AppState.micEnabled=false;} }
            initTrystero();
        } catch(e) { alert('Неверный формат ссылки'); }
    };
    $('#changeJoinAvatar').onclick = () => { const e=getEmoji(); $('#joinAvatarEmoji').textContent=e; AppState.userEmoji=e; };
    $('#backFromScanner').onclick = () => { stopScanner(); switchScreen('joinScreen'); if($('#joinCameraToggle').checked) startPreview($('#joinPreviewVideo'),$('#joinAvatarEmoji')); };
}

function setupInvite() {
    $('#inviteCameraToggle').onchange = function() {
        if(this.checked) startPreview($('#invitePreviewVideo'),$('#inviteAvatarEmoji'));
        else { stopPreview(); $('#invitePreviewVideo').classList.add('hidden'); $('#inviteAvatarEmoji').classList.remove('hidden'); }
    };
    $('#inviteConnectBtn').onclick = async () => {
        AppState.userName = $('#inviteUserName').value.trim() || 'Гость';
        AppState.isHost = false; AppState.cameraEnabled = true; AppState.micEnabled = true;
        if (!AppState.roomId) return alert('Не найдена комната');
        try {
            stopPreview(); switchScreen('meetingScreen'); updateUI(); updateHostUI(); startTimer();
            showNotification('🔄 Подключение...'); await captureMedia();
            const cam = $('#inviteCameraToggle').checked;
            const mic = $('#inviteMicToggle').checked;
            if (!cam && AppState.localStream) { const t=AppState.localStream.getVideoTracks()[0]; if(t){t.enabled=false; AppState.cameraEnabled=false;} }
            if (!mic && AppState.localStream) { const t=AppState.localStream.getAudioTracks()[0]; if(t){t.enabled=false; AppState.micEnabled=false;} }
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
    $('#screenShareBtn').onclick = () => showNotification('📺 Функция в разработке');
    $('#shareBtn').onclick = () => { if(!AppState.isHost) return; $('#sharePanel').classList.toggle('hidden'); $('#chatPanel').classList.add('hidden'); };
    $('#chatBtn').onclick = () => { $('#chatPanel').classList.toggle('hidden'); $('#sharePanel').classList.add('hidden'); };
    $('#hangupBtn').onclick = hangUp;
    $('#closeSharePanel').onclick = () => $('#sharePanel').classList.add('hidden');
    $('#closeChatPanel').onclick = () => $('#chatPanel').classList.add('hidden');
    $('#copyLinkBtn').onclick = () => {
        const i=$('#meetingLink'); if(i){i.select(); document.execCommand('copy');}
        const b=$('#copyLinkBtn'); b.innerHTML='<i class="fas fa-check"></i>';
        setTimeout(()=>{b.innerHTML='<i class="fas fa-copy"></i>';},1500);
    };
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
        const lv=$('#localVideo'); if(lv){lv.srcObject=AppState.localStream; lv.parentElement.classList.remove('hidden');}
        $('#localAvatarWrapper').classList.add('hidden');
        updateMicBtn(); updateCamBtn();
    } catch(e) { AppState.cameraEnabled=false; $('#localVideo').parentElement.classList.add('hidden'); $('#localAvatarWrapper').classList.remove('hidden'); }
}

function initTrystero() {
    if (!window.trysteroJoinRoom) { showNotification('Ошибка модуля связи'); return; }
    console.log('🔗 Trystero. Комната:', AppState.roomId);
    AppState.room = window.trysteroJoinRoom({ appId: 'conf-meet-v17-'+AppState.roomId }, 'meeting');
    const [sendSignal, getSignal] = AppState.room.makeAction('signal');
    const [sendChat, getChat] = AppState.room.makeAction('chat');
    const [sendUserInfo, getUserInfo] = AppState.room.makeAction('userInfo');
    AppState.sendSignal = sendSignal; AppState.sendChatMsg = sendChat; AppState.sendUserInfo = sendUserInfo;
    
    getSignal((data, peerId) => { let p=AppState.peers.get(peerId); if(!p) p=createPeer(peerId, !AppState.isHost); try{p.signal(data);}catch(e){} });
    getChat((data) => { if(data&&data.text) showChatMsg(data.sender||'Собеседник', data.text, false); });
    getUserInfo((info) => { updateRemote(info); });
    
    AppState.room.onPeerJoin((peerId) => {
        console.log('🟢 Пир:', peerId);
        setTimeout(()=>sendMyInfo(), 300);
        if (!AppState.isHost) createPeer(peerId, true);
    });
    
    AppState.room.onPeerLeave((peerId) => {
        console.log('🔴 Пир ушёл:', peerId);
        const p=AppState.peers.get(peerId); if(p)p.destroy(); AppState.peers.delete(peerId);
        if (AppState.peers.size===0) {
            $('#remoteVideo').srcObject=null; $('#remoteCard').classList.add('hidden');
            $('#emptyState').classList.remove('hidden'); AppState.isConnected=false;
            showNotification('Собеседник отключился');
        }
        updateCount();
    });
}

function createPeer(peerId, initiator) {
    console.log('🔧 Peer, инициатор:', initiator);
    const streams = AppState.localStream ? [AppState.localStream] : [];
    const peer = new SimplePeer({ initiator, streams, trickle: true, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } });
    
    peer.on('signal', (data) => { if(AppState.sendSignal) AppState.sendSignal(data); });
    
    peer.on('stream', (stream) => {
        console.log('📥 Поток получен');
        const vt = stream.getVideoTracks();
        if (vt.length > 0) {
            const rv=$('#remoteVideo'); if(rv){rv.srcObject=stream; rv.parentElement.classList.remove('hidden');}
            $('#remoteAvatarWrapper').classList.add('hidden');
        }
        $('#remoteCard').classList.remove('hidden'); $('#emptyState').classList.add('hidden');
        AppState.isConnected = true; showNotification('✅ Соединение установлено'); updateCount();
    });
    
    peer.on('connect', () => console.log('🔗 Соединение'));
    peer.on('close', () => { AppState.peers.delete(peerId); if(AppState.peers.size===0){$('#remoteVideo').srcObject=null;$('#remoteCard').classList.add('hidden');$('#emptyState').classList.remove('hidden');AppState.isConnected=false;} updateCount(); });
    peer.on('error', (e) => console.error('Peer error:', e));
    
    AppState.peers.set(peerId, peer);
    return peer;
}

function toggleMic() {
    if (!AppState.localStream) return;
    const t = AppState.localStream.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; AppState.micEnabled = t.enabled; updateMicBtn(); showNotification(AppState.micEnabled?'🎤 Микрофон включен':'🔇 Микрофон выключен'); }
}
function updateMicBtn() {
    const b=$('#micBtn'); const i=$('#localMicIcon');
    if (AppState.micEnabled) { if(b)b.classList.remove('off'); if(i)i.className='fas fa-microphone'; }
    else { if(b)b.classList.add('off'); if(i)i.className='fas fa-microphone-slash mic-off'; }
}

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
function updateCamBtn() { const b=$('#cameraBtn'); if(AppState.cameraEnabled) b.classList.remove('off'); else b.classList.add('off'); }

function sendChat() {
    const ci=$('#chatInput'); if(!ci) return;
    const t=ci.value.trim(); if(!t) return;
    showChatMsg(AppState.userName, t, true);
    if(AppState.sendChatMsg) AppState.sendChatMsg({ sender:AppState.userName, text:t, timestamp:Date.now() });
    ci.value=''; ci.focus();
}
function showChatMsg(sender, text, isMine) {
    const cm=$('#chatMessages'); if(!cm) return;
    const d=document.createElement('div'); d.className='chat-message '+(isMine?'mine':'other');
    d.innerHTML='<span class="sender">'+sender+'</span><span class="text">'+text.replace(/</g,'&lt;')+'</span>';
    const empty=cm.querySelector('.chat-empty'); if(empty) empty.remove();
    cm.appendChild(d); cm.scrollTop=cm.scrollHeight;
}

async function startScanner() {
    try {
        const s=await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        AppState.scannerStream=s; $('#scannerVideo').srcObject=s;
        const iv=setInterval(()=>{
            if(!AppState.scannerStream){clearInterval(iv);return;}
            const v=$('#scannerVideo'); if(!v||v.readyState<2) return;
            const c=document.createElement('canvas'); c.width=v.videoWidth; c.height=v.videoHeight;
            const ctx=c.getContext('2d'); ctx.drawImage(v,0,0);
            const code=jsQR(ctx.getImageData(0,0,c.width,c.height).data, c.width, c.height);
            if(code&&code.data){ clearInterval(iv); stopScanner();
                try {
                    const u=new URL(code.data); const h=u.hash.slice(1); const p=new URLSearchParams(h);
                    const r=p.get('room'); if(!r) return;
                    AppState.roomId=r; AppState.isHost=false; AppState.cameraEnabled=true; AppState.micEnabled=true;
                    if(p.get('key')) AppState.encryptionKeyStr=p.get('key');
                    AppState.userName=$('#joinUserName').value.trim()||'Гость';
                    switchScreen('meetingScreen'); updateUI(); updateHostUI(); startTimer();
                    showNotification('🔄 Подключение...'); captureMedia().then(()=>{
                        const cam=$('#joinCameraToggle').checked; const mic=$('#joinMicToggle').checked;
                        if(!cam&&AppState.localStream){const t=AppState.localStream.getVideoTracks()[0];if(t){t.enabled=false;AppState.cameraEnabled=false;}}
                        if(!mic&&AppState.localStream){const t=AppState.localStream.getAudioTracks()[0];if(t){t.enabled=false;AppState.micEnabled=false;}}
                        initTrystero();
                    });
                } catch(e) { alert('Неверный QR-код'); }
            }
        }, 100);
    } catch(e) { alert('Ошибка камеры'); switchScreen('joinScreen'); }
}
function stopScanner() { if(AppState.scannerStream){AppState.scannerStream.getTracks().forEach(t=>t.stop());AppState.scannerStream=null;} }

function checkUrl() {
    const h=window.location.hash; if(!h||h==='#') return false;
    const hc=h.startsWith('#')?h.slice(1):h;
    const p=new URLSearchParams(hc);
    const r=p.get('room'); if(!r) return false;
    AppState.roomId=r; AppState.isHost=false;
    if(p.get('key')) AppState.encryptionKeyStr=p.get('key');
    $$('.screen').forEach(s=>s.classList.add('hidden'));
    const is=$('#inviteScreen'); if(is)is.classList.remove('hidden');
    setTimeout(()=>{const qc=$('#inviteQRCanvas');if(qc)new QRCode(qc,{text:location.href,width:200,height:200});},500);
    setTimeout(()=>{if($('#inviteCameraToggle').checked)startPreview($('#invitePreviewVideo'),$('#inviteAvatarEmoji'));},800);
    return true;
}

function updateUI() {
    const role=AppState.isHost?'Организатор':'Участник';
    $('#localName').textContent=(AppState.userName||'Вы')+' • '+role;
    $('#localAvatarEmoji').textContent=AppState.userEmoji;
    if(AppState.cameraEnabled){$('#localVideo').parentElement.classList.remove('hidden');$('#localAvatarWrapper').classList.add('hidden');}
    else{$('#localVideo').parentElement.classList.add('hidden');$('#localAvatarWrapper').classList.remove('hidden');}
    if(AppState.isHost)$('#hostChip').classList.remove('hidden'); else $('#hostChip').classList.add('hidden');
    updateMicBtn(); updateCamBtn();
}
function updateRemote(info) {
    if(!info||!info.name) return;
    const role=info.role||'';
    $('#remoteName').textContent=info.name+(role?' • '+role:'');
    const re=document.querySelector('#remoteAvatarWrapper .avatar-emoji'); if(re&&info.emoji) re.textContent=info.emoji;
    $('#remoteCard').classList.remove('hidden'); $('#emptyState').classList.add('hidden');
    if(!info.hasVideo){$('#remoteVideo').parentElement.classList.add('hidden');$('#remoteAvatarWrapper').classList.remove('hidden');}
    else{$('#remoteVideo').parentElement.classList.remove('hidden');$('#remoteAvatarWrapper').classList.add('hidden');}
    updateCount();
}
function updateCount() { $('#participantCount').textContent=AppState.peers.size+1; }
function updateStatus(t) { $('#meetingStatus').textContent=t; }

function startTimer() {
    AppState.startTime=Date.now();
    if(AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.timerInterval=setInterval(()=>{
        const e=Math.floor((Date.now()-AppState.startTime)/1000);
        const m=Math.floor(e/60).toString().padStart(2,'0');
        const s=(e%60).toString().padStart(2,'0');
        $('#timerDisplay').textContent=m+':'+s;
    },1000);
}

function hangUp() {
    AppState.peers.forEach(p=>{try{p.destroy();}catch(e){}}); AppState.peers.clear();
    if(AppState.room){try{AppState.room.leave();}catch(e){} AppState.room=null;}
    if(AppState.localStream){AppState.localStream.getTracks().forEach(t=>t.stop()); AppState.localStream=null;}
    stopScanner(); stopPreview();
    if(AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.isHost=false; AppState.roomId=null; AppState.isConnected=false;
    AppState.sendSignal=null; AppState.sendChatMsg=null; AppState.sendUserInfo=null;
    switchScreen('mainScreen'); window.location.hash='';
}

function goToMain() { stopPreview(); stopScanner(); switchScreen('mainScreen'); }
window.addEventListener('beforeunload', hangUp);