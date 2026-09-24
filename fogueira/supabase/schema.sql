-- Fogueira — esquema para Supabase. Cole tudo no SQL Editor e clique em Run.

-- ========== Tabelas ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
  created_at timestamptz not null default now()
);

create table public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  owner_id uuid not null references public.profiles(id),
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.server_members (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  channel_id uuid not null references public.channels(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_channel_created_idx on public.messages (channel_id, created_at desc);

-- ========== Perfil automático ao criar conta ==========
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1)), 24));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== Ajuda para as políticas (evita recursão de RLS) ==========
create or replace function public.is_member(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.server_members where server_id = sid and user_id = auth.uid());
$$;

-- ========== Segurança (RLS) ==========
alter table public.profiles enable row level security;
alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;

create policy "perfis visíveis para quem está logado" on public.profiles
  for select to authenticated using (true);

create policy "membros veem o servidor" on public.servers
  for select to authenticated using (public.is_member(id));

create policy "membros veem a lista de membros" on public.server_members
  for select to authenticated using (public.is_member(server_id));
create policy "sair do servidor" on public.server_members
  for delete to authenticated using (user_id = auth.uid());

create policy "membros veem canais" on public.channels
  for select to authenticated using (public.is_member(server_id));
create policy "dono cria canais" on public.channels
  for insert to authenticated
  with check (exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));

create policy "membros leem mensagens" on public.messages
  for select to authenticated using (public.is_member(server_id));
create policy "membros enviam mensagens" on public.messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member(server_id)
    and exists (select 1 from public.channels c where c.id = channel_id and c.server_id = messages.server_id)
  );
create policy "apagar as próprias mensagens" on public.messages
  for delete to authenticated using (user_id = auth.uid());

-- ========== Funções: criar servidor e entrar por convite ==========
create or replace function public.create_server(server_name text)
returns public.servers language plpgsql security definer set search_path = public as $$
declare s public.servers;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  insert into public.servers (name, owner_id) values (trim(server_name), auth.uid()) returning * into s;
  insert into public.server_members (server_id, user_id) values (s.id, auth.uid());
  insert into public.channels (server_id, name) values (s.id, 'geral'), (s.id, 'off-topic');
  return s;
end $$;

create or replace function public.join_server(code text)
returns public.servers language plpgsql security definer set search_path = public as $$
declare s public.servers;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into s from public.servers where lower(invite_code) = lower(trim(code));
  if not found then raise exception 'Convite não encontrado'; end if;
  insert into public.server_members (server_id, user_id) values (s.id, auth.uid()) on conflict do nothing;
  return s;
end $$;

revoke all on function public.create_server(text) from public, anon;
revoke all on function public.join_server(text) from public, anon;
grant execute on function public.create_server(text) to authenticated;
grant execute on function public.join_server(text) to authenticated;

-- ========== Realtime ==========
alter publication supabase_realtime add table public.messages, public.channels, public.server_members;
