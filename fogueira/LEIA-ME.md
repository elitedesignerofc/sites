# Fogueira 🔥 — chat estilo Discord (grátis)

Servidores, canais de texto, mensagens em tempo real, lista de membros online, convites por código e layout responsivo (funciona no celular).

## 1) Testar agora (modo demo, sem cadastro em nada)

Precisa de um servidor HTTP local (abrir o `index.html` com duplo clique não funciona por causa dos módulos JS):

```
cd fogueira
python3 -m http.server 8000
```

Abra http://localhost:8000. Abra **duas abas** e entre com nomes diferentes: as mensagens aparecem em tempo real entre elas.
No modo demo os dados ficam só no seu navegador. O convite do servidor de exemplo é `FOGO`.

## 2) Colocar online de verdade (tudo no plano grátis)

O app é um site estático + Supabase (banco, login e tempo real).

**Backend — Supabase**
1. Crie uma conta em supabase.com e um projeto novo (guarde a senha do banco).
2. Menu **SQL Editor** → cole todo o conteúdo de `supabase/schema.sql` → **Run**.
3. Menu **Authentication → Providers → Email**: para testes, desative **Confirm email** (assim o cadastro entra direto).
4. Menu **Project Settings → API**: copie a **Project URL** e a chave **anon public**.
5. Cole os dois valores em `config.js`.

**Front-end — hospedagem estática grátis** (escolha uma)
- **Cloudflare Pages** ou **Netlify**: crie um projeto novo e arraste a pasta `fogueira` (upload direto, sem build).
- **GitHub Pages**: suba a pasta para um repositório e ative Pages.

Pronto: mande o link do site e os códigos de convite dos servidores para os amigos.

## Limites do plano grátis do Supabase (conferidos em jul/2026, podem mudar)
- Projeto grátis **pausa após 7 dias sem uso** (dá para reativar no painel; os dados ficam).
- 200 conexões simultâneas de tempo real, ~2 milhões de mensagens de realtime por mês, 500 MB de banco.
- Bom para uma turma de amigos ou comunidade pequena. Passou disso, considere o plano pago.

## Segurança
- A chave `anon` no front-end é normal; quem protege os dados são as políticas RLS do `schema.sql` (só membros leem/escrevem no servidor).
- Servidores só são acessíveis por código de convite. Só o dono cria canais. Cada um apaga apenas as próprias mensagens.

## O que ainda não tem (próximos passos possíveis)
Chamadas de voz/vídeo (exigem WebRTC + servidor de sinalização/TURN), mensagens diretas, imagens e arquivos (Supabase Storage), respostas/reações, editar mensagem, papéis e moderação, notificações push.

## Arquivos
- `index.html`, `style.css`, `app.js` — a interface
- `store-local.js` — modo demo (localStorage)
- `store-supabase.js` — modo online
- `supabase/schema.sql` — tabelas, segurança e funções
- `config.js` — suas chaves do Supabase
