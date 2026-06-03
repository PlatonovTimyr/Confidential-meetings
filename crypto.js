// ===== Модуль криптографии Confidential Meetings =====

const CryptoModule = {
    // Хранилище ключей
    encryptionKey: null,
    signingKey: null,
    ecdhKeyPair: null,
    remotePublicKey: null,
    sharedSecret: null,
    
    // Счётчики для проверки целостности
    frameCounter: 0,
    receivedFrames: new Set(),
    lastFrameTime: 0,
    
    // Статистика безопасности
    securityStats: {
        invalidSignatures: 0,
        replayAttacks: 0,
        timingAnomalies: 0,
        hashMismatches: 0,
        totalFrames: 0
    }
};

// ===== Генерация ключей =====
CryptoModule.generateKeys = async function() {
    // Генерируем AES-256 ключ
    this.encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    
    // Генерируем ключ для HMAC подписей
    this.signingKey = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-512' },
        true,
        ['sign', 'verify']
    );
    
    // Генерируем ECDH ключи для обмена
    this.ecdhKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-521' },
        true,
        ['deriveKey', 'deriveBits']
    );
    
    // Экспортируем публичный ключ для обмена
    const publicKey = await crypto.subtle.exportKey('raw', this.ecdhKeyPair.publicKey);
    this.publicKeyBytes = new Uint8Array(publicKey);
    
    return {
        encryptionKey: await crypto.subtle.exportKey('raw', this.encryptionKey),
        publicKey: this.publicKeyBytes
    };
};

// ===== Импорт ключа из ссылки =====
CryptoModule.importKey = async function(keyBytes) {
    this.encryptionKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
};

// ===== Шифрование кадра =====
CryptoModule.encryptFrame = async function(data, frameType = 'video') {
    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const timestamp = Date.now();
        this.frameCounter++;
        
        // Создаём метаданные кадра
        const metadata = new TextEncoder().encode(JSON.stringify({
            seq: this.frameCounter,
            ts: timestamp,
            type: frameType,
            prevHash: this.lastHash || ''
        }));
        
        // Конкатенируем метаданные и данные
        const fullData = new Uint8Array(metadata.length + data.byteLength);
        fullData.set(metadata, 0);
        fullData.set(new Uint8Array(data), metadata.length);
        
        // Шифруем
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: metadata },
            this.encryptionKey,
            fullData
        );
        
        // Подписываем
        const signature = await crypto.subtle.sign(
            { name: 'HMAC' },
            this.signingKey,
            encrypted
        );
        
        // Сохраняем хеш для связывания кадров
        const hashBuffer = await crypto.subtle.digest('SHA-256', encrypted);
        this.lastHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Собираем пакет
        const packet = {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted)),
            signature: Array.from(new Uint8Array(signature)),
            metadata: Array.from(metadata),
            seq: this.frameCounter,
            ts: timestamp,
            hash: this.lastHash
        };
        
        return packet;
        
    } catch (error) {
        console.error('Ошибка шифрования:', error);
        throw error;
    }
};

// ===== Расшифровка кадра =====
CryptoModule.decryptFrame = async function(packet) {
    try {
        // Проверка на replay-атаку
        if (this.receivedFrames.has(packet.seq)) {
            this.securityStats.replayAttacks++;
            this.triggerAlert('REPLAY_ATTACK', 'Обнаружена атака повторного воспроизведения! Кадр #' + packet.seq);
            return null;
        }
        
        // Проверка временной метки
        const now = Date.now();
        const timeDiff = Math.abs(now - packet.ts);
        if (timeDiff > 5000) {
            this.securityStats.timingAnomalies++;
            this.triggerAlert('TIMING_ANOMALY', 'Обнаружена аномалия времени! Разница: ' + timeDiff + 'мс');
        }
        
        // Проверка последовательности
        if (packet.seq <= this.lastReceivedSeq && this.lastReceivedSeq > 0) {
            this.securityStats.timingAnomalies++;
            this.triggerAlert('SEQUENCE_ERROR', 'Нарушение последовательности кадров!');
        }
        
        const iv = new Uint8Array(packet.iv);
        const encryptedData = new Uint8Array(packet.data);
        const signature = new Uint8Array(packet.signature);
        const metadata = new Uint8Array(packet.metadata);
        
        // Проверяем подпись
        const isValid = await crypto.subtle.verify(
            { name: 'HMAC' },
            this.signingKey,
            signature,
            encryptedData
        );
        
        if (!isValid) {
            this.securityStats.invalidSignatures++;
            this.triggerAlert('INVALID_SIGNATURE', 'Недействительная цифровая подпись! Кадр #' + packet.seq);
            return null;
        }
        
        // Расшифровываем
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: metadata },
            this.encryptionKey,
            encryptedData
        );
        
        // Проверяем хеш
        const hashBuffer = await crypto.subtle.digest('SHA-256', encryptedData);
        const currentHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (packet.hash && packet.hash !== currentHash) {
            this.securityStats.hashMismatches++;
            this.triggerAlert('HASH_MISMATCH', 'Несовпадение хеша целостности! Данные повреждены.');
            return null;
        }
        
        // Извлекаем данные (пропускаем метаданные)
        const metadataLength = metadata.length;
        const rawData = new Uint8Array(decrypted).slice(metadataLength);
        
        this.receivedFrames.add(packet.seq);
        this.lastReceivedSeq = packet.seq;
        this.securityStats.totalFrames++;
        
        return rawData.buffer;
        
    } catch (error) {
        console.error('Ошибка расшифровки:', error);
        this.triggerAlert('DECRYPTION_ERROR', 'Ошибка расшифровки: ' + error.message);
        return null;
    }
};

// ===== Система тревог =====
CryptoModule.activeAlerts = new Set();
CryptoModule.alertDismissed = false;

CryptoModule.triggerAlert = function(type, message) {
    if (this.alertDismissed) return;
    if (this.activeAlerts.has(type)) return;
    
    this.activeAlerts.add(type);
    
    // Вызываем внешний обработчик
    if (window.onSecurityAlert) {
        window.onSecurityAlert(type, message, this.securityStats);
    }
};

// ===== Сброс блокировки тревог =====
CryptoModule.dismissAlerts = function() {
    this.alertDismissed = true;
    this.activeAlerts.clear();
    
    setTimeout(() => {
        this.alertDismissed = false;
    }, 300000); // Блокировка на 5 минут
};

// ===== Шифрование сообщения чата =====
CryptoModule.encryptMessage = async function(text) {
    const data = new TextEncoder().encode(text);
    return await this.encryptFrame(data, 'chat');
};

// ===== Расшифровка сообщения чата =====
CryptoModule.decryptMessage = async function(packet) {
    const buffer = await this.decryptFrame(packet);
    if (!buffer) return null;
    return new TextDecoder().decode(buffer);
};