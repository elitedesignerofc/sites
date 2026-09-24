import { CONFIG } from './config.js';

const useSupabase = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
const store = useSupabase
  ? await (await import('./store-supabase.js')).createSupabaseStore(CONFIG)
  : (await import('./store-local.js')).createLocalStore();

/* ---------- utilidades ---------- */
const $ = (s) => document.querySelector(s);

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return e;
}

const hue = (s) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 360; return x; };
const SMALL = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'a', 'o']);
const initials = (s) => {
  const words = s.trim().split(/\s+/);
  const main = words.filter(w => !SMALL.has(w.toLowerCase()));
  return (main.length ? main : words).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
};
const avatar = (name, cls = '') =>
  h('div', { class: 'avatar ' + cls, style: `background:hsl(${hue(name)} 42% 42%)`, 'aria-hidden': 'true' }, initials(name));

const fmtTime = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function dayLabel(d) {
  const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return 'Hoje';
  if (dayKey(d) === dayKey(y)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

// negrito, itálico, código e links — montado com nós de texto (sem innerHTML)
function rich(text) {
  const frag = document.createDocumentFragment();
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|https?:\/\/[^\s<]+)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const t = m[0];
    if (t[0] === '`') frag.append(h('code', null, t.slice(1, -1)));
    else if (t.startsWith('**')) frag.append(h('strong', null, t.slice(2, -2)));
    else if (t[0] === '*') frag.append(h('em', null, t.slice(1, -1)));
    else frag.append(h('a', { href: t, target: '_blank', rel: 'noopener noreferrer nofollow' }, t));
    last = m.index + t.length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

/* ---------- estado ---------- */
const S = {
  user: null, servers: [], server: null, channels: [], channel: null,
  members: new Map(), online: new Set(), messages: [], unread: new Set(), unsub: null
};

/* ---------- modal ---------- */
function openModal(title, desc, content) {
  const m = $('#modal');
  m.hidden = false;
  m.replaceChildren(h('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('h2', null, title), desc ? h('p', null, desc) : null, content));
  m.onclick = (e) => { if (e.target === m) closeModal(); };
  const first = m.querySelector('input, button');
  if (first) first.focus();
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.replaceChildren(); }

function formModal({ title, desc, fields, submit, onSubmit }) {
  const err = h('div', { class: 'error', role: 'alert' });
  const inputs = {};
  const rows = fields.map(f => {
    inputs[f.name] = h('input', { id: 'f-' + f.name, name: f.name, placeholder: f.placeholder || '', maxlength: f.max || 60, required: true, autocomplete: 'off' });
    return h('div', { class: 'field' }, h('label', { for: 'f-' + f.name }, f.label), inputs[f.name]);
  });
  const ok = h('button', { type: 'submit', class: 'btn' }, submit);
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ''; ok.disabled = true;
      try {
        const values = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]));
        await onSubmit(values);
        closeModal();
      } catch (x) { err.textContent = x.message; ok.disabled = false; }
    }
  }, rows, err, h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: closeModal }, 'Cancelar'), ok));
  openModal(title, desc, form);
}

/* ---------- login ---------- */
function renderAuth(mode = 'in') {
  const box = $('#auth');
  box.hidden = false; $('#app').hidden = true; box.replaceChildren();
  const local = store.kind === 'local';
  const err = h('div', { class: 'error', role: 'alert' });
  const inputs = {};
  const field = (id, label, type, ac) => {
    inputs[id] = h('input', { id, name: id, type, required: true, autocomplete: ac, maxlength: id === 'username' ? 24 : 120 });
    return h('div', { class: 'field' }, h('label', { for: id }, label), inputs[id]);
  };
  let fields;
  if (local) fields = [field('username', 'Como quer ser chamado?', 'text', 'nickname')];
  else if (mode === 'up') fields = [field('username', 'Nome de usuário', 'text', 'nickname'), field('email', 'E-mail', 'email', 'email'), field('password', 'Senha (mín. 6 caracteres)', 'password', 'new-password')];
  else fields = [field('email', 'E-mail', 'email', 'email'), field('password', 'Senha', 'password', 'current-password')];

  const btn = h('button', { type: 'submit', class: 'btn wide' }, local ? 'Entrar' : mode === 'up' ? 'Criar conta' : 'Entrar');
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true;
      const v = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]));
      try {
        const u = local ? await store.signIn(v) : mode === 'up' ? await store.signUp(v) : await store.signIn(v);
        await start(u);
      } catch (x) { err.textContent = x.message; }
      finally { btn.disabled = false; }
    }
  }, fields, err, btn);

  const tabs = local ? null : h('div', { class: 'tabs', role: 'tablist' },
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'in'), onclick: () => renderAuth('in') }, 'Entrar'),
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'up'), onclick: () => renderAuth('up') }, 'Criar conta'));

  box.append(h('div', { class: 'auth-card' },
    h('h1', null, 'Fogueira 🔥'),
    h('p', null, 'Converse com a sua turma em servidores e canais.'),
    tabs, form,
    local ? h('p', { class: 'hint' }, 'Modo demo: os dados ficam só neste navegador. Abra outra aba, entre com outro nome e teste o tempo real.') : null));
  const first = form.querySelector('input'); if (first) first.focus();
}

/* ---------- fluxo principal ---------- */
async function start(user) {
  S.user = user;
  $('#auth').hidden = true; $('#app').hidden = false;
  S.servers = await store.listServers();
  const last = localStorage.getItem('fogueira_last_server');
  const target = S.servers.find(s => s.id === last) || S.servers[0];
  if (target) await selectServer(target.id);
  else { resetServerState(); renderAll(); }
}

function resetServerState() {
  if (S.unsub) { S.unsub(); S.unsub = null; }
  Object.assign(S, { server: null, channels: [], channel: null, messages: [], members: new Map(), online: new Set() });
  S.unread.clear();
}

async function selectServer(id) {
  resetServerState();
  S.server = S.servers.find(s => s.id === id) || null;
  if (!S.server) { renderAll(); return; }
  localStorage.setItem('fogueira_last_server', id);
  renderAll();
  try {
    const [channels, members] = await Promise.all([store.listChannels(id), store.listMembers(id)]);
    if (!S.server || S.server.id !== id) return;
    S.channels = channels;
    S.members = new Map(members.map(m => [m.id, m]));
    S.unsub = store.subscribe(id, { onMessage, onDelete, onChannel, onPresence, onMembers });
    const lastCh = localStorage.getItem('fogueira_last_ch_' + id);
    await selectChannel((channels.find(c => c.id === lastCh) || channels[0] || {}).id);
  } catch (e) { toast(e.message); }
  closeDrawers();
}

async function selectChannel(id) {
  S.channel = S.channels.find(c => c.id === id) || null;
  S.unread.delete(id);
  S.messages = [];
  renderAll();
  if (!S.channel) return;
  localStorage.setItem('fogueira_last_ch_' + S.server.id, id);
  try {
    const list = await store.listMessages(id);
    if (S.channel && S.channel.id === id) { S.messages = list; renderMessages(true); }
  } catch (e) { toast(e.message); }
  closeDrawers();
  if (window.matchMedia('(min-width: 721px)').matches) $('#input').focus();
}

/* ---------- eventos em tempo real ---------- */
function onMessage(msg) {
  if (S.messages.some(m => m.id === msg.id)) return;
  if (!S.members.has(msg.user_id)) onMembers();
  if (S.channel && msg.channel_id === S.channel.id) { S.messages.push(msg); renderMessages(false); }
  else if (msg.user_id !== S.user.id) { S.unread.add(msg.channel_id); renderChannels(); }
}
function onDelete(id) {
  const n = S.messages.length;
  S.messages = S.messages.filter(m => m.id !== id);
  if (S.messages.length !== n) renderMessages(false);
}
function onChannel(c) {
  if (S.channels.some(x => x.id === c.id)) return;
  S.channels.push(c); renderChannels();
}
function onPresence(set) { S.online = set; renderMembers(); }
async function onMembers() {
  if (!S.server) return;
  const id = S.server.id;
  try {
    const list = await store.listMembers(id);
    if (!S.server || S.server.id !== id) return;
    S.members = new Map(list.map(m => [m.id, m]));
    renderMembers(); renderMessages(false);
  } catch { /* ignora: tenta de novo no próximo evento */ }
}

/* ---------- renderização ---------- */
function renderAll() {
  renderRail(); renderServerHead(); renderChannels(); renderMe(); renderMembers(); renderTopbar(); renderMessages(true); renderComposer();
}

function renderRail() {
  const rail = $('#rail');
  rail.replaceChildren(
    ...S.servers.map(s => h('button', {
      class: 'srv', title: s.name, 'aria-label': s.name,
      'aria-current': String(Boolean(S.server && S.server.id === s.id)),
      onclick: () => selectServer(s.id)
    }, initials(s.name))),
    h('button', { class: 'srv add', title: 'Criar ou entrar em um servidor', 'aria-label': 'Criar ou entrar em um servidor', onclick: openAddServer }, '+')
  );
}

function renderServerHead() {
  const head = $('#serverHead');
  head.replaceChildren(h('span', null, S.server ? S.server.name : 'Sem servidor'), h('span', { 'aria-hidden': 'true' }, '▾'));
  head.disabled = !S.server;
  $('#serverMenu').hidden = true;
}

function renderChannels() {
  const list = $('#channelList');
  if (!S.server) { list.replaceChildren(); return; }
  const isOwner = S.server.owner_id === S.user.id;
  list.replaceChildren(
    h('div', { class: 'group-label' }, h('span', null, 'Canais de texto'),
      isOwner ? h('button', { title: 'Criar canal', 'aria-label': 'Criar canal', onclick: openNewChannel }, '+') : null),
    ...S.channels.map(c => h('button', {
      class: 'ch' + (S.unread.has(c.id) ? ' unread' : ''),
      'aria-current': String(Boolean(S.channel && S.channel.id === c.id)),
      onclick: () => selectChannel(c.id)
    }, h('span', { class: 'hash' }, '#'), h('span', null, c.name), S.unread.has(c.id) ? h('span', { class: 'dot', 'aria-label': 'mensagens novas' }) : null))
  );
}

function renderMe() {
  $('#mePanel').replaceChildren(
    avatar(S.user.username, 'sm'),
    h('div', { class: 'name', title: S.user.username }, S.user.username),
    h('button', { onclick: signOut }, 'Sair')
  );
}

function renderMembers() {
  const box = $('#members');
  const all = [...S.members.values()].sort((a, b) => a.username.localeCompare(b.username, 'pt-BR'));
  const isOn = (m) => S.online.has(m.id) || m.id === S.user.id;
  const on = all.filter(isOn), off = all.filter(m => !isOn(m));
  const row = (m, online) => h('div', { class: 'mem' + (online ? '' : ' off') },
    h('div', { class: 'avatar sm', style: `background:hsl(${hue(m.username)} 42% 42%);position:relative`, 'aria-hidden': 'true' },
      initials(m.username), h('span', { class: 'presence' })),
    h('span', { class: 'n' }, m.username, online ? null : ' (offline)'));
  box.replaceChildren(
    ...(on.length ? [h('h2', null, `Online — ${on.length}`), ...on.map(m => row(m, true))] : []),
    ...(off.length ? [h('h2', null, `Offline — ${off.length}`), ...off.map(m => row(m, false))] : [])
  );
}

function renderTopbar() {
  const t = $('#channelTitle');
  t.replaceChildren(...(S.channel ? [h('span', { class: 'hash' }, '#'), S.channel.name] : []));
  document.title = S.channel ? `#${S.channel.name} · ${S.server.name} · Fogueira` : 'Fogueira';
}

function renderComposer() {
  const on = Boolean(S.channel);
  $('#input').disabled = !on; $('#sendBtn').disabled = !on;
  $('#input').placeholder = on ? `Escreva em #${S.channel.name}` : 'Escolha um canal para conversar';
}

function renderMessages(forceBottom) {
  const box = $('#messages');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  box.replaceChildren();

  if (!S.server) {
    box.append(h('div', { class: 'empty' },
      h('h2', null, 'Comece a sua turma'),
      h('p', null, 'Crie um servidor novo ou entre em um com um código de convite.'),
      store.kind === 'local' ? h('p', null, 'No modo demo, o convite do servidor de exemplo é FOGO.') : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: openCreateServer }, 'Criar servidor'),
        h('button', { class: 'btn ghost', onclick: openJoinServer }, 'Entrar com convite'))));
    return;
  }
  if (!S.channel) {
    box.append(h('div', { class: 'empty' }, h('h2', null, 'Nenhum canal ainda'),
      h('p', null, S.server.owner_id === S.user.id ? 'Use o + ao lado de "Canais de texto" para criar o primeiro.' : 'O dono do servidor ainda não criou canais.')));
    return;
  }
  if (!S.messages.length) {
    box.append(h('div', { class: 'empty' }, h('h2', null, `Bem-vindo ao #${S.channel.name}`), h('p', null, 'Ainda não há mensagens aqui. Escreva a primeira.')));
    return;
  }

  let prev = null;
  for (const m of S.messages) {
    const d = new Date(m.created_at);
    const pd = prev ? new Date(prev.created_at) : null;
    if (!pd || dayKey(pd) !== dayKey(d)) box.append(h('div', { class: 'day' }, dayLabel(d)));
    const grouped = pd && prev.user_id === m.user_id && dayKey(pd) === dayKey(d) && d - pd < 5 * 60000;
    const author = (S.members.get(m.user_id) || {}).username || 'Ex-membro';
    box.append(h('div', { class: 'msg' + (grouped ? '' : ' head') },
      grouped ? h('div', { class: 'gutter' }, fmtTime(d)) : avatar(author),
      h('div', { class: 'body' },
        grouped ? null : h('div', { class: 'meta' }, h('span', { class: 'author', style: `color:hsl(${hue(author)} 65% 72%)` }, author), h('span', { class: 'time' }, fmtTime(d))),
        h('div', { class: 'text' }, rich(m.content))),
      m.user_id === S.user.id ? h('button', { class: 'del', title: 'Apagar mensagem', onclick: () => removeMessage(m.id) }, 'Apagar') : null));
    prev = m;
  }
  if (forceBottom || nearBottom) box.scrollTop = box.scrollHeight;
}

/* ---------- ações ---------- */
async function removeMessage(id) {
  if (!confirm('Apagar esta mensagem?')) return;
  try { await store.deleteMessage(id); onDelete(id); } catch (e) { toast(e.message); }
}

function openAddServer() {
  openModal('Servidores', 'Crie o seu ou entre no de alguém.', h('div', { class: 'modal-actions', style: 'justify-content:flex-start' },
    h('button', { class: 'btn', onclick: openCreateServer }, 'Criar servidor'),
    h('button', { class: 'btn ghost', onclick: openJoinServer }, 'Entrar com convite')));
}
function openCreateServer() {
  formModal({
    title: 'Criar servidor', desc: 'Ele já vem com os canais #geral e #off-topic.',
    fields: [{ name: 'name', label: 'Nome do servidor', placeholder: 'Ex.: Turma do futsal', max: 40 }], submit: 'Criar servidor',
    onSubmit: async ({ name }) => {
      if (name.trim().length < 2) throw new Error('Use pelo menos 2 caracteres.');
      const s = await store.createServer(name);
      S.servers.push(s); await selectServer(s.id);
    }
  });
}
function openJoinServer() {
  formModal({
    title: 'Entrar com convite', desc: store.kind === 'local' ? 'No modo demo, teste com o código FOGO.' : 'Peça o código de convite para quem administra o servidor.',
    fields: [{ name: 'code', label: 'Código do convite', placeholder: 'Ex.: 3F9A21BC', max: 20 }], submit: 'Entrar',
    onSubmit: async ({ code }) => {
      const s = await store.joinServer(code);
      if (!S.servers.some(x => x.id === s.id)) S.servers.push(s);
      await selectServer(s.id);
    }
  });
}
function openNewChannel() {
  formModal({
    title: 'Criar canal', desc: 'Nomes em minúsculas, sem espaços.',
    fields: [{ name: 'name', label: 'Nome do canal', placeholder: 'Ex.: avisos', max: 30 }], submit: 'Criar canal',
    onSubmit: async ({ name }) => {
      const clean = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 30);
      if (!clean) throw new Error('Use letras, números ou hífen.');
      const c = await store.createChannel(S.server.id, clean);
      onChannel(c); await selectChannel(c.id);
    }
  });
}

function toggleServerMenu() {
  const menu = $('#serverMenu');
  if (!menu.hidden) { menu.hidden = true; return; }
  const owner = S.server.owner_id === S.user.id;
  menu.replaceChildren(...[
    h('button', { onclick: copyInvite }, `Copiar convite (${S.server.invite_code})`),
    owner ? h('button', { onclick: () => { menu.hidden = true; openNewChannel(); } }, 'Criar canal') : null,
    !owner ? h('button', { class: 'danger', onclick: leaveServer }, 'Sair do servidor') : null
  ].filter(Boolean));
  menu.hidden = false;
}
function copyInvite() {
  const code = S.server.invite_code;
  $('#serverMenu').hidden = true;
  const done = () => toast('Convite copiado: ' + code);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => toast('Código do convite: ' + code));
  else toast('Código do convite: ' + code);
}
async function leaveServer() {
  $('#serverMenu').hidden = true;
  if (!confirm(`Sair de "${S.server.name}"?`)) return;
  try {
    const id = S.server.id;
    await store.leaveServer(id);
    S.servers = S.servers.filter(s => s.id !== id);
    if (S.servers[0]) await selectServer(S.servers[0].id);
    else { resetServerState(); renderAll(); }
  } catch (e) { toast(e.message); }
}
async function signOut() {
  resetServerState();
  await store.signOut();
  S.user = null; S.servers = [];
  renderAuth();
}

/* ---------- gavetas (mobile) ---------- */
function closeDrawers() { document.body.classList.remove('nav-open', 'members-open'); }
$('#navBtn').addEventListener('click', () => { document.body.classList.toggle('nav-open'); document.body.classList.remove('members-open'); });
$('#membersBtn').addEventListener('click', () => { document.body.classList.toggle('members-open'); document.body.classList.remove('nav-open'); });
$('#backdrop').addEventListener('click', closeDrawers);

/* ---------- compositor ---------- */
const input = $('#input');
const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; };
input.addEventListener('input', autosize);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#composer').requestSubmit(); }
});
$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !S.channel) return;
  input.value = ''; autosize();
  try {
    const m = await store.sendMessage(S.channel.id, text, S.server.id);
    if (!S.messages.some(x => x.id === m.id)) { S.messages.push(m); renderMessages(true); }
  } catch (err) { input.value = text; autosize(); toast(err.message); }
});

$('#serverHead').addEventListener('click', (e) => { e.stopPropagation(); if (S.server) toggleServerMenu(); });
document.addEventListener('click', (e) => { if (!e.target.closest('#serverMenu')) $('#serverMenu').hidden = true; });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); $('#serverMenu').hidden = true; closeDrawers(); }
});

/* ---------- início ---------- */
try {
  const user = await store.init();
  if (user) await start(user); else renderAuth();
} catch (e) {
  renderAuth();
  $('#auth .error') && ($('#auth .error').textContent = 'Erro ao iniciar: ' + e.message);
}
