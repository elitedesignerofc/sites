# Tela Maldivas — Maldivas City

Site estático completo (HTML + CSS + JS, um arquivo só). Compartilhamento de
tela, câmera, voz e lousa colaborativa em tempo real via WebRTC, usando o
signaling gratuito público do PeerJS (0.peerjs.com) — não precisa de
servidor próprio.

## Como publicar (GitHub Pages, grátis)

1. Crie um repositório no GitHub (pode ser público, que é o modo grátis).
2. Suba o arquivo `index.html` na raiz do repositório.
3. Vá em Settings > Pages, escolha a branch `main` e a pasta `/ (root)`, salve.
4. Em 1-2 minutos o site fica no ar em `seu-usuario.github.io/nome-do-repo`.

## Domínio próprio (opcional)

1. Edite o arquivo `CNAME` com o domínio que você quer usar (ex:
   `tela.maldivascity.gg`) e suba ele junto na raiz do repositório.
2. No provedor do seu domínio, crie um registro CNAME apontando esse
   subdomínio para `seu-usuario.github.io`.

## Painel admin

Clique em "Painel admin" no rodapé do site (senha padrão: `maldivas123`).
Dá pra configurar textos, cores, logo/marca e regras da sala (senha mínima,
formato do código, limite de pessoas). A configuração fica salva só no
navegador de quem edita — use os botões "Exportar JSON" / "Importar JSON"
pra levar a configuração de um navegador pra outro, ou pra me mandar de
volta caso queira que eu deixe pré-configurado no arquivo.

## Limitações a saber

- Sem servidor TURN dedicado: em redes muito restritivas (corporativa,
  escolar, CGNAT feio) a conexão pode falhar. Resolver isso de forma
  garantida exige um servidor pago.
- O servidor de signaling público do PeerJS não tem garantia de uptime —
  funciona bem pra uso de comunidade pequena/média, mas pode falhar em
  pico de uso.
- Sem gravação/histórico de sala — tudo é em tempo real, e acaba quando
  todo mundo sai.
- A senha do painel admin é só pra evitar clique acidental, não é
  segurança real (é um arquivo estático, o código-fonte é visível).
