const E2EESync = (() => {
  function randomToken(len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
  }

  // 1. Gera sala + segredo localmente
  function createRoom(prefix = 'TRV') {
    const roomId = randomToken(10);
    const secret = randomToken(16);
    return {
      roomId,
      secret,
      pairCode: `${prefix}-${roomId}-${secret}`
    };
  }

  // 2. Gera link de convite com o segredo oculto no #hash
  function buildInviteLink(firebaseUrl, pairCode) {
    const cleanUrl = firebaseUrl.trim().replace(/\/+$/, '');
    const payload = btoa(JSON.stringify({ fb: cleanUrl, code: pairCode }));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#pair=${encodeURIComponent(payload)}`;
  }

  // 3. Lê o convite ao abrir o app no segundo dispositivo
  function consumeInviteFromHash(prefix = 'TRV') {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#pair=')) return null;

    try {
      const decoded = JSON.parse(atob(decodeURIComponent(hash.slice(6))));
      const regex = new RegExp(`^${prefix}-([A-Z0-9]{8,16})-([A-Z0-9]{12,32})$`);
      const match = (decoded.code || '').trim().toUpperCase().match(regex);
      if (!match || !decoded.fb) return null;

      // Remove o segredo da URL imediatamente após ler
      history.replaceState(null, '', window.location.pathname + window.location.search);

      return {
        firebaseUrl: decoded.fb.trim().replace(/\/+$/, ''),
        roomId: match[1],
        secret: match[2],
        pairCode: `${prefix}-${match[1]}-${match[2]}`
      };
    } catch (e) {
      console.warn('Convite inválido na URL:', e);
      return null;
    }
  }

  // 4. Deriva chave AES-GCM 256-bit via PBKDF2
  async function deriveKey(secret, roomId) {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode('e2ee_salt_' + roomId),
        iterations: 60000,
        hash: 'SHA-256'
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // 5. Cifra e envia (PUT) para o Firebase
  async function push(firebaseUrl, roomId, secret, dataObj) {
    const key = await deriveKey(secret, roomId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(dataObj));
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

    const body = {
      iv: btoa(String.fromCharCode(...iv)),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipherBuf))),
      updatedAt: Date.now()
    };

    const res = await fetch(`${firebaseUrl}/rooms/${roomId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return body.updatedAt;
  }

  // 6. Lê (GET) e decifra no dispositivo receptor
  async function pull(firebaseUrl, roomId, secret) {
    const res = await fetch(`${firebaseUrl}/rooms/${roomId}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const record = await res.json();
    if (!record || !record.iv || !record.ciphertext) return null;

    const key = await deriveKey(secret, roomId);
    const iv = Uint8Array.from(atob(record.iv), (c) => c.charCodeAt(0));
    const data = Uint8Array.from(atob(record.ciphertext), (c) => c.charCodeAt(0));
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return {
      payload: JSON.parse(new TextDecoder().decode(plainBuf)),
      updatedAt: record.updatedAt
    };
  }

  // 7. Revoga e apaga definitivamente (DELETE)
  async function revoke(firebaseUrl, roomId) {
    await fetch(`${firebaseUrl}/rooms/${roomId}.json`, { method: 'DELETE' });
  }

  return { createRoom, buildInviteLink, consumeInviteFromHash, push, pull, revoke };
})();