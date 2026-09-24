// Modo online: Supabase (Postgres + Auth + Realtime). O esquema está em supabase/schema.sql.
export async function createSupabaseStore(cfg) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  let me = null;

  const toUser = (u) => ({
    id: u.id,
    username: (u.user_metadata && u.user_metadata.username) || (u.email || 'usuario').split('@')[0]
  });
  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  return {
    kind: 'supabase',
    async init() {
      const { data } = await sb.auth.getSession();
      if (data.session) me = toUser(data.session.user);
      return me;
    },
    async signUp({ email, password, username }) {
      const name = (username || '').trim();
      if (name.length < 2 || name.length > 24) throw new Error('Use um nome de 2 a 24 caracteres.');
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username: name } } });
      if (error) throw new Error(error.message);
      if (!data.session) throw new Error('Conta criada. Confirme o e-mail que enviamos e depois entre.');
      me = toUser(data.session.user);
      return me;
    },
    async signIn({ email, password }) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      me = toUser(data.user);
      return me;
    },
    async signOut() {
      await sb.auth.signOut();
      me = null;
    },
    async listServers() {
      const rows = check(await sb.from('server_members').select('servers(id,name,invite_code,owner_id)').eq('user_id', me.id));
      return rows.map(r => r.servers).filter(Boolean);
    },
    async createServer(name) {
      return check(await sb.rpc('create_server', { server_name: name.trim() }));
    },
    async joinServer(code) {
      return check(await sb.rpc('join_server', { code: code.trim() }));
    },
    async leaveServer(id) {
      check(await sb.from('server_members').delete().eq('server_id', id).eq('user_id', me.id));
    },
    async listChannels(serverId) {
      return check(await sb.from('channels').select('*').eq('server_id', serverId).order('created_at'));
    },
    async createChannel(serverId, name) {
      return check(await sb.from('channels').insert({ server_id: serverId, name }).select().single());
    },
    async listMembers(serverId) {
      const rows = check(await sb.from('server_members').select('profiles(id,username)').eq('server_id', serverId));
      return rows.map(r => r.profiles).filter(Boolean);
    },
    async listMessages(channelId) {
      const rows = check(
        await sb.from('messages').select('id,channel_id,server_id,user_id,content,created_at')
          .eq('channel_id', channelId).order('created_at', { ascending: false }).limit(100)
      );
      return rows.reverse();
    },
    async sendMessage(channelId, content, serverId) {
      return check(
        await sb.from('messages').insert({ channel_id: channelId, server_id: serverId, user_id: me.id, content }).select().single()
      );
    },
    async deleteMessage(id) {
      check(await sb.from('messages').delete().eq('id', id));
    },
    subscribe(serverId, h) {
      const ch = sb.channel('server:' + serverId, { config: { presence: { key: me.id } } });
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `server_id=eq.${serverId}` }, p => h.onMessage(p.new))
        // eventos DELETE não aceitam filtro por coluna; o app ignora ids que não conhece
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, p => h.onDelete(p.old.id))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channels', filter: `server_id=eq.${serverId}` }, p => h.onChannel(p.new))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'server_members', filter: `server_id=eq.${serverId}` }, () => h.onMembers && h.onMembers())
        .on('presence', { event: 'sync' }, () => h.onPresence(new Set(Object.keys(ch.presenceState()))))
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await ch.track({ username: me.username });
        });
      return () => { sb.removeChannel(ch); };
    }
  };
}
