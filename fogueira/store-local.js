// Modo demo: tudo fica no localStorage do navegador. Cada ABA é um usuário diferente
// (a sessão fica no sessionStorage), e as abas conversam entre si via BroadcastChannel.
const KEY = 'fogueira_db_v1';
const SESSION = 'fogueira_session';
const DEMO_INVITE = 'FOGO';

const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }

function ensureDb() {
  let db = load();
  if (db && db.v === 1) return db;
  const now = Date.now();
  db = {
    v: 1,
    nextMsg: 4,
    users: { 'bot-fogueira': { id: 'bot-fogueira', username: 'Fogueira' } },
    servers: [{ id: 'srv-praca', name: 'Praça da Fogueira', owner_id: 'bot-fogueira', invite_code: DEMO_INVITE }],
    members: [{ server_id: 'srv-praca', user_id: 'bot-fogueira' }],
    channels: [
      { id: 'ch-geral', server_id: 'srv-praca', name: 'geral', created_at: now },
      { id: 'ch-ideias', server_id: 'srv-praca', name: 'ideias', created_at: now + 1 },
      { id: 'ch-offtopic', server_id: 'srv-praca', name: 'off-topic', created_at: now + 2 }
    ],
    messages: [
      { id: 1, channel_id: 'ch-geral', server_id: 'srv-praca', user_id: 'bot-fogueira', content: 'Bem-vindo à **Praça da Fogueira**! 🔥 Este é o modo demo: tudo fica salvo só no seu navegador.', created_at: now },
      { id: 2, channel_id: 'ch-geral', server_id: 'srv-praca', user_id: 'bot-fogueira', content: 'Abra outra aba, entre com outro nome e converse com você mesmo em tempo real.', created_at: now + 1000 },
      { id: 3, channel_id: 'ch-ideias', server_id: 'srv-praca', user_id: 'bot-fogueira', content: 'Dica: use **negrito**, *itálico* e `código` nas mensagens.', created_at: now + 2000 }
    ]
  };
  save(db);
  return db;
}

export function createLocalStore() {
  const kind = 'local';
  const bc = new BroadcastChannel('fogueira');
  let me = null;
  let h = null;            // handlers do servidor atual
  let currentServer = null;
  const seen = new Map();  // userId -> último sinal de vida
  let lastOnline = '';
  let timer = null;

  const db = () => ensureDb();
  const isMember = (d, sid) => d.members.some(m => m.server_id === sid && m.user_id === me.id);

  function onlineSet() {
    const now = Date.now();
    const s = new Set([me.id]);
    for (const [id, t] of seen) if (now - t < 15000) s.add(id);
    return s;
  }
  function emitPresence() {
    if (!h) return;
    const s = onlineSet();
    const sig = [...s].sort().join(',');
    if (sig === lastOnline) return;
    lastOnline = sig;
    h.onPresence(s);
  }

  bc.onmessage = (ev) => {
    const m = ev.data;
    if (!me) return;
    if (m.t === 'hello') { seen.set(m.userId, Date.now()); emitPresence(); }
    else if (m.t === 'ping') { bc.postMessage({ t: 'hello', userId: me.id }); }
    else if (m.t === 'bye') { seen.delete(m.userId); emitPresence(); }
    else if (!h || m.serverId !== currentServer) return;
    else if (m.t === 'msg') h.onMessage(m.msg);
    else if (m.t === 'del') h.onDelete(m.id);
    else if (m.t === 'chan') h.onChannel(m.channel);
    else if (m.t === 'members') h.onMembers && h.onMembers();
  };
  window.addEventListener('beforeunload', () => { if (me) bc.postMessage({ t: 'bye', userId: me.id }); });

  return {
    kind,
    async init() {
      ensureDb();
      const id = sessionStorage.getItem(SESSION);
      const u = id && db().users[id];
      if (u) { me = { id: u.id, username: u.username }; return me; }
      return null;
    },
    // Modo demo: só o nome. Se o nome já existe, entra como ele.
    async signIn({ username }) {
      const name = (username || '').trim();
      if (name.length < 2 || name.length > 24) throw new Error('Use um nome de 2 a 24 caracteres.');
      const d = db();
      let u = Object.values(d.users).find(x => x.username.toLowerCase() === name.toLowerCase());
      if (!u) {
        u = { id: uid(), username: name };
        d.users[u.id] = u;
        d.members.push({ server_id: 'srv-praca', user_id: u.id });
        save(d);
        bc.postMessage({ t: 'members', serverId: 'srv-praca' });
      }
      sessionStorage.setItem(SESSION, u.id);
      me = { id: u.id, username: u.username };
      return me;
    },
    async signOut() {
      bc.postMessage({ t: 'bye', userId: me.id });
      sessionStorage.removeItem(SESSION);
      me = null;
    },
    async listServers() {
      const d = db();
      return d.servers.filter(s => isMember(d, s.id));
    },
    async createServer(name) {
      const d = db();
      const s = { id: uid(), name: name.trim(), owner_id: me.id, invite_code: uid().replace(/-/g, '').slice(0, 8).toUpperCase() };
      d.servers.push(s);
      d.members.push({ server_id: s.id, user_id: me.id });
      const t = Date.now();
      d.channels.push({ id: uid(), server_id: s.id, name: 'geral', created_at: t }, { id: uid(), server_id: s.id, name: 'off-topic', created_at: t + 1 });
      save(d);
      return s;
    },
    async joinServer(code) {
      const d = db();
      const s = d.servers.find(x => x.invite_code.toLowerCase() === code.trim().toLowerCase());
      if (!s) throw new Error('Convite não encontrado.');
      if (!isMember(d, s.id)) {
        d.members.push({ server_id: s.id, user_id: me.id });
        save(d);
        bc.postMessage({ t: 'members', serverId: s.id });
      }
      return s;
    },
    async leaveServer(id) {
      const d = db();
      d.members = d.members.filter(m => !(m.server_id === id && m.user_id === me.id));
      save(d);
      bc.postMessage({ t: 'members', serverId: id });
    },
    async listChannels(serverId) {
      return db().channels.filter(c => c.server_id === serverId).sort((a, b) => a.created_at - b.created_at);
    },
    async createChannel(serverId, name) {
      const d = db();
      const s = d.servers.find(x => x.id === serverId);
      if (!s || s.owner_id !== me.id) throw new Error('Só o dono do servidor cria canais.');
      const c = { id: uid(), server_id: serverId, name, created_at: Date.now() };
      d.channels.push(c);
      save(d);
      bc.postMessage({ t: 'chan', serverId, channel: c });
      return c;
    },
    async listMembers(serverId) {
      const d = db();
      return d.members.filter(m => m.server_id === serverId).map(m => d.users[m.user_id]).filter(Boolean);
    },
    async listMessages(channelId) {
      return db().messages.filter(m => m.channel_id === channelId).slice(-100);
    },
    async sendMessage(channelId, content) {
      const d = db();
      const ch = d.channels.find(c => c.id === channelId);
      if (!ch || !isMember(d, ch.server_id)) throw new Error('Sem acesso a este canal.');
      const msg = { id: d.nextMsg++, channel_id: channelId, server_id: ch.server_id, user_id: me.id, content, created_at: Date.now() };
      d.messages.push(msg);
      save(d);
      bc.postMessage({ t: 'msg', serverId: ch.server_id, msg });
      return msg;
    },
    async deleteMessage(id) {
      const d = db();
      const m = d.messages.find(x => x.id === id);
      if (!m || m.user_id !== me.id) throw new Error('Você só pode apagar as suas mensagens.');
      d.messages = d.messages.filter(x => x.id !== id);
      save(d);
      bc.postMessage({ t: 'del', serverId: m.server_id, id });
    },
    subscribe(serverId, handlers) {
      currentServer = serverId;
      h = handlers;
      lastOnline = '';
      bc.postMessage({ t: 'hello', userId: me.id });
      bc.postMessage({ t: 'ping' });
      emitPresence();
      timer = setInterval(() => { bc.postMessage({ t: 'hello', userId: me.id }); emitPresence(); }, 5000);
      return () => { clearInterval(timer); h = null; currentServer = null; };
    }
  };
}
