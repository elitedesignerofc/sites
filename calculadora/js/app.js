// ===================================================================
// Dados padrão dos itens (usados na primeira visita e no "Restaurar
// padrão" do painel administrativo). Depois de editado pelo admin,
// a lista real fica salva em CHAVE_CONFIG.
// ===================================================================
const ARMAS_PADRAO = [
  { id: "GLOCK", nome: "Glock", normal: 1500, minimo: 750 },
  { id: "FIVE", nome: "Five", normal: 1500, minimo: 1000 },
  { id: "TEC", nome: "Tec", normal: 2500, minimo: 1500 },
  { id: "NAVY", nome: "Navy", normal: 4500, minimo: 2750 },
  { id: "MTAR", nome: "Mtar", normal: 5000, minimo: 3200 },
  { id: "AK-47", nome: "AK-47", normal: 5500, minimo: 3300 },
  { id: "M4A1", nome: "M4A1", normal: 7000, minimo: 3750 },
  { id: "HK416", nome: "HK416", normal: 8000, minimo: 4000 },
  { id: "G36", nome: "G36", normal: 10000, minimo: 4500 },
];
const NOME_PADRAO = "Nome da facção aqui";
const LOGO_PADRAO = document.getElementById("brandLogo").getAttribute("src");
const BANNER_PADRAO = document.getElementById("bannerImg").getAttribute("src");

const PERCENTUAL_FUNCIONARIO = 0.2;

const CHAVE_RASCUNHO = "medellin_rascunho";
const CHAVE_HISTORICO = "medellin_historico";
const CHAVE_WEBHOOK = "medellin_webhook_url";
const CHAVE_CONFIG = "medellin_config";
const CHAVE_SENHA_HASH = "medellin_admin_hash";
// Hash SHA-256 da senha padrão "#Admin123". A senha nunca fica em
// texto puro no código — só o hash. Pode (e deve) ser trocada dentro
// do próprio painel administrativo, em "Alterar senha do painel".
const HASH_SENHA_PADRAO = "35f91b815a68b0ec63a08df8de9fde302de5a84fc577a832be1166e54e33764b";

const moeda = (valor) =>
  "R$ " + valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ===================================================================
// Configuração (nome da facção, logo, banner e itens) — persistida localmente
// ===================================================================
function configPadrao() {
  return { nome: NOME_PADRAO, logo: null, banner: BANNER_PADRAO, armas: ARMAS_PADRAO.map((a) => ({ ...a })) };
}

function carregarConfig() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CONFIG));
    if (!salvo || !Array.isArray(salvo.armas) || salvo.armas.length === 0) return configPadrao();
    return {
      nome: salvo.nome || NOME_PADRAO,
      logo: salvo.logo || null,
      // Se o admin nunca mexeu no banner, mantém o padrão do site.
      // Se ele explicitamente removeu (null salvo), respeita a remoção.
      banner: salvo.banner !== undefined ? salvo.banner : BANNER_PADRAO,
      armas: salvo.armas,
    };
  } catch (e) {
    return configPadrao();
  }
}

function salvarConfig(config) {
  localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config));
}

let config = carregarConfig();

function aplicarIdentidade() {
  document.getElementById("brandNome").textContent = config.nome;
  document.getElementById("brandLogo").src = config.logo || LOGO_PADRAO;

  const bannerTopo = document.getElementById("bannerTopo");
  const bannerImg = document.getElementById("bannerImg");
  if (config.banner) {
    bannerImg.src = config.banner;
    bannerTopo.hidden = false;
  } else {
    bannerImg.src = "";
    bannerTopo.hidden = true;
  }
  aplicarCorDoBanner();
}

// ===================================================================
// Cor de destaque extraída do banner — assim os brilhos, bordas e
// sombras douradas passam a usar o mesmo tom do banner enviado.
// ===================================================================
function corMediaDaImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const largura = 40;
        const altura = Math.max(1, Math.round(largura * (img.height / img.width || 1)));
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, largura, altura);
        const dados = ctx.getImageData(0, 0, largura, altura).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < dados.length; i += 4) {
          if (dados[i + 3] < 200) continue; // ignora pixels transparentes
          r += dados[i];
          g += dados[i + 1];
          b += dados[i + 2];
          n++;
        }
        if (n === 0) { resolve(null); return; }
        resolve({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

function rgbParaHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslParaHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const paraHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${paraHex(f(0))}${paraHex(f(8))}${paraHex(f(4))}`;
}

function hexParaRgbTexto(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

async function aplicarCorDoBanner() {
  const raiz = document.documentElement;
  if (!config.banner) {
    raiz.style.removeProperty("--gold");
    raiz.style.removeProperty("--gold-soft");
    raiz.style.removeProperty("--gold-rgb");
    return;
  }
  try {
    const media = await corMediaDaImagem(config.banner);
    if (!media) return;
    const { h, s, l } = rgbParaHsl(media.r, media.g, media.b);
    const sAjustado = Math.max(s, 55);
    const lPrincipal = Math.min(Math.max(l, 42), 60);
    const lSuave = Math.min(lPrincipal + 16, 80);
    const corPrincipal = hslParaHex(h, sAjustado, lPrincipal);
    raiz.style.setProperty("--gold", corPrincipal);
    raiz.style.setProperty("--gold-soft", hslParaHex(h, sAjustado, lSuave));
    raiz.style.setProperty("--gold-rgb", hexParaRgbTexto(corPrincipal));
  } catch (e) {
    // Se a imagem não puder ser lida (ex.: bloqueio de origem), mantém o dourado padrão.
    raiz.style.removeProperty("--gold");
    raiz.style.removeProperty("--gold-soft");
    raiz.style.removeProperty("--gold-rgb");
  }
}

// ===================================================================
// Montagem da grade de armas
// ===================================================================
const gradeArmas = document.getElementById("gradeArmas");

function montarGrade() {
  gradeArmas.innerHTML = "";
  config.armas.forEach((arma) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.dataset.item = arma.id;
    card.innerHTML = `
      <div class="item-nome">${arma.nome}</div>
      <div class="item-controls">
        <div class="stepper">
          <button type="button" data-role="menos" aria-label="Diminuir">−</button>
          <input type="number" min="0" step="1" value="0" inputmode="numeric" data-role="quantidade" aria-label="Quantidade de ${arma.nome}">
          <button type="button" data-role="mais" aria-label="Aumentar">+</button>
        </div>
        <div class="item-preco-fixo" data-role="preco-label" aria-label="Preço de ${arma.nome}"></div>
      </div>
      <div class="item-detalhes" data-role="detalhes" hidden>
        <div class="item-detalhe-linha">
          <span>Quantidade</span>
          <span data-role="det-quantidade"></span>
        </div>
        <div class="item-detalhe-linha">
          <span>Valor unitário</span>
          <span data-role="det-unitario"></span>
        </div>
        <div class="item-detalhe-linha item-detalhe-total">
          <span>Soma</span>
          <span data-role="det-soma"></span>
        </div>
      </div>
    `;
    gradeArmas.appendChild(card);
  });
}
aplicarIdentidade();
montarGrade();

// ===================================================================
// Modo de preço global (Normal / Mínimo) — aplica-se a todos os itens
// de uma vez, no lugar de escolher item a item.
// ===================================================================
const CHAVE_MODO_PRECO = "medellin_modo_preco";
let modoPreco = localStorage.getItem(CHAVE_MODO_PRECO) === "minimo" ? "minimo" : "normal";

function precoDoItem(arma) {
  if (arma.precoUnico) return arma.normal;
  return modoPreco === "minimo" ? arma.minimo : arma.normal;
}

function aplicarBotoesModoPreco() {
  document.querySelectorAll(".modo-preco-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.modo === modoPreco);
  });
}
aplicarBotoesModoPreco();

document.querySelectorAll(".modo-preco-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    modoPreco = btn.dataset.modo;
    localStorage.setItem(CHAVE_MODO_PRECO, modoPreco);
    aplicarBotoesModoPreco();
    calcular();
  });
});


// ===================================================================
// Cálculo do total
// ===================================================================
function calcular() {
  let total = 0;
  let totalItens = 0;

  document.querySelectorAll(".item-card").forEach((card) => {
    const input = card.querySelector('[data-role="quantidade"]');
    const rotuloPreco = card.querySelector('[data-role="preco-label"]');
    const detalhes = card.querySelector('[data-role="detalhes"]');
    const arma = config.armas.find((a) => a.id === card.dataset.item);
    if (!arma) return;

    const quantidade = Math.max(0, parseInt(input.value, 10) || 0);
    const preco = precoDoItem(arma);
    const subtotal = quantidade * preco;

    rotuloPreco.textContent = moeda(preco);

    total += subtotal;
    totalItens += quantidade;

    if (quantidade > 0) {
      detalhes.hidden = false;
      card.querySelector('[data-role="det-quantidade"]').textContent = quantidade;
      card.querySelector('[data-role="det-unitario"]').textContent = moeda(preco);
      card.querySelector('[data-role="det-soma"]').textContent = moeda(subtotal);
    } else {
      detalhes.hidden = true;
    }
    card.classList.toggle("has-quantidade", quantidade > 0);
  });

  document.getElementById("total").textContent = moeda(total);
  document.getElementById("totalItens").textContent = totalItens;
  document.getElementById("valorFuncionario").textContent = moeda(total * PERCENTUAL_FUNCIONARIO);

  salvarRascunho();
  return { total, totalItens };
}

gradeArmas.addEventListener("input", (e) => {
  if (e.target.matches('[data-role="quantidade"]')) calcular();
});
gradeArmas.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-role='mais'], [data-role='menos']");
  if (!btn) return;
  const card = btn.closest(".item-card");
  const input = card.querySelector('[data-role="quantidade"]');
  const atual = Math.max(0, parseInt(input.value, 10) || 0);
  input.value = btn.dataset.role === "mais" ? atual + 1 : Math.max(0, atual - 1);
  calcular();
});

// ===================================================================
// Busca / filtro
// ===================================================================
const buscaArma = document.getElementById("buscaArma");
buscaArma.addEventListener("input", () => {
  const termo = buscaArma.value.trim().toLowerCase();
  let algumVisivel = false;
  document.querySelectorAll(".item-card").forEach((card) => {
    const nome = card.dataset.item.toLowerCase();
    const visivel = nome.includes(termo);
    card.classList.toggle("is-hidden", !visivel);
    if (visivel) algumVisivel = true;
  });
  let semResultado = gradeArmas.querySelector(".sem-resultados");
  if (!algumVisivel) {
    if (!semResultado) {
      semResultado = document.createElement("p");
      semResultado.className = "sem-resultados";
      semResultado.textContent = "Nenhuma arma encontrada.";
      gradeArmas.appendChild(semResultado);
    }
  } else if (semResultado) {
    semResultado.remove();
  }
});

// ===================================================================
// Zerar valores
// ===================================================================
document.getElementById("btnZerar").addEventListener("click", () => {
  document.querySelectorAll('[data-role="quantidade"]').forEach((input) => (input.value = 0));
  modoPreco = "normal";
  localStorage.setItem(CHAVE_MODO_PRECO, modoPreco);
  aplicarBotoesModoPreco();
  calcular();
  mostrarToast("Valores zerados.");
});

// ===================================================================
// Rascunho automático (sobrevive a atualizações de página)
// ===================================================================
function salvarRascunho() {
  const dados = {};
  document.querySelectorAll(".item-card").forEach((card) => {
    const qtd = parseInt(card.querySelector('[data-role="quantidade"]').value, 10) || 0;
    if (qtd > 0) dados[card.dataset.item] = { qtd };
  });
  localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados));
}

function carregarRascunho() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || "{}");
    document.querySelectorAll(".item-card").forEach((card) => {
      const salvo = dados[card.dataset.item];
      if (!salvo) return;
      card.querySelector('[data-role="quantidade"]').value = salvo.qtd;
    });
  } catch (e) {
    /* rascunho inválido, ignora */
  }
}

// ===================================================================
// Troca de tipo de transação
// ===================================================================
const tipoTransacao = document.getElementById("tipoTransacao");
const campoTroca = document.getElementById("campoTroca");
tipoTransacao.addEventListener("change", () => {
  campoTroca.hidden = tipoTransacao.value !== "Troca";
});

// ===================================================================
// Abas (Calculadora / Histórico)
// ===================================================================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");

    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("is-active");

    if (btn.dataset.tab === "historico") renderizarHistorico();
  });
});

// ===================================================================
// Validação do formulário
// ===================================================================
function validarFormulario() {
  const campos = [
    { id: "facComprador" },
    { id: "compradores" },
    { id: "idComprador" },
    { id: "vendedor" },
    { id: "discordIdVendedor" },
  ];
  let primeiro = null;
  let ok = true;

  campos.forEach(({ id }) => {
    const input = document.getElementById(id);
    const vazio = input.value.trim() === "";
    input.closest(".campo").classList.toggle("tem-erro", vazio);
    if (vazio) {
      ok = false;
      if (!primeiro) primeiro = input;
    }
  });

  const erroEl = document.getElementById("erroFormulario");
  if (!ok) {
    erroEl.textContent = "Preencha todos os campos obrigatórios antes de salvar.";
    erroEl.hidden = false;
    primeiro.focus();
    return false;
  }
  erroEl.hidden = true;
  return true;
}

// ===================================================================
// Montagem dos itens comprados (para mensagem e histórico)
// ===================================================================
function coletarItensComprados() {
  const itens = [];
  document.querySelectorAll(".item-card").forEach((card) => {
    const qtd = parseInt(card.querySelector('[data-role="quantidade"]').value, 10) || 0;
    if (qtd <= 0) return;
    const arma = config.armas.find((a) => a.id === card.dataset.item);
    if (!arma) return;
    const preco = precoDoItem(arma);
    itens.push({ item: card.dataset.item, quantidade: qtd, preco, subtotal: qtd * preco });
  });
  return itens;
}

// ===================================================================
// Salvar compra
// ===================================================================
const btnSalvar = document.getElementById("btnSalvar");

btnSalvar.addEventListener("click", async () => {
  if (!validarFormulario()) return;

  const { total, totalItens } = calcular();
  if (totalItens === 0) {
    mostrarToast("Adicione ao menos um item antes de salvar.", true);
    return;
  }

  const registro = {
    data: new Date().toISOString(),
    facComprador: valor("facComprador"),
    compradores: valor("compradores"),
    idComprador: valor("idComprador"),
    vendedor: valor("vendedor"),
    discordIdVendedor: valor("discordIdVendedor"),
    tipoTransacao: tipoTransacao.value,
    detalhesTroca: valor("detalhesTroca"),
    itens: coletarItensComprados(),
    total,
    valorFuncionario: total * PERCENTUAL_FUNCIONARIO,
  };

  salvarNoHistorico(registro);

  const webhook = localStorage.getItem(CHAVE_WEBHOOK);
  if (webhook) {
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Enviando...";
    try {
      await enviarParaDiscord(registro, webhook);
      mostrarToast("Compra salva e enviada para o Discord.");
    } catch (err) {
      mostrarToast("Compra salva localmente, mas falhou o envio para o Discord.", true);
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "FINALIZAR VENDA";
    }
  } else {
    mostrarToast("Compra salva no histórico. Configure o webhook (🔒) para enviar ao Discord também.");
  }

  limparFormularioPosVenda();
});

function valor(id) {
  return document.getElementById(id).value.trim();
}

// Monta uma tabela alinhada em texto monoespaçado (fica legível tanto
// colada no Discord quanto copiada para outro lugar).
function montarTabelaItens(itens) {
  const col = (texto, largura) => String(texto).padEnd(largura).slice(0, largura);
  const colD = (texto, largura) => String(texto).padStart(largura);

  let tabela = "```\n";
  tabela += `${col("Item", 14)} ${colD("Qtd", 4)}  ${colD("Preço", 12)}  ${colD("Subtotal", 12)}\n`;
  itens.forEach((i) => {
    tabela += `${col(i.item, 14)} ${colD(i.quantidade, 4)}  ${colD(moeda(i.preco), 12)}  ${colD(moeda(i.subtotal), 12)}\n`;
  });
  tabela += "```";
  return tabela;
}

// Monta um embed do Discord (o "cartão" colorido), no mesmo espírito
// visual do painel de Histórico de vendas do site.
function corAtualComoDecimal() {
  const cor = getComputedStyle(document.documentElement).getPropertyValue("--gold").trim() || "#c9a227";
  return parseInt(cor.replace("#", ""), 16);
}

function montarEmbedDiscord(r) {
  const dataFormatada = new Date(r.data).toLocaleString("pt-BR");
  const campos = [
    { name: "FAC comprador", value: r.facComprador || "-", inline: true },
    { name: "Comprador", value: r.compradores || "-", inline: true },
    { name: "ID do comprador", value: r.idComprador || "-", inline: true },
    { name: "Vendedor", value: r.vendedor || "-", inline: true },
    { name: "ID do vendedor", value: r.discordIdVendedor || "-", inline: true },
    { name: "Itens", value: montarTabelaItens(r.itens), inline: false },
    { name: "Valor bruto", value: moeda(r.total), inline: true },
    { name: "Valor a retirar (20%)", value: moeda(r.valorFuncionario), inline: true },
  ];
  if (r.tipoTransacao === "Troca" && r.detalhesTroca) {
    campos.push({ name: "Detalhes", value: r.detalhesTroca, inline: false });
  }

  return {
    embeds: [
      {
        title: r.tipoTransacao === "Troca" ? "Nova troca registrada" : "Nova venda registrada",
        color: corAtualComoDecimal(),
        fields: campos,
        footer: { text: `Registrado em ${dataFormatada}` },
      },
    ],
  };
}

async function enviarParaDiscord(registro, webhookURL) {
  const resposta = await fetch(webhookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(montarEmbedDiscord(registro)),
  });
  if (!resposta.ok) throw new Error("Falha ao enviar para o Discord");
}

function limparFormularioPosVenda() {
  document.querySelectorAll('[data-role="quantidade"]').forEach((input) => (input.value = 0));
  ["facComprador", "compradores", "idComprador", "discordIdVendedor", "detalhesTroca"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  campoTroca.hidden = true;
  tipoTransacao.value = "Venda";
  calcular();
}

// ===================================================================
// Histórico
// ===================================================================
function lerHistorico() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_HISTORICO) || "[]");
  } catch (e) {
    return [];
  }
}

function salvarNoHistorico(registro) {
  const historico = lerHistorico();
  historico.unshift(registro);
  localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
}

function ehHoje(dataIso) {
  const d = new Date(dataIso);
  const hoje = new Date();
  return d.toDateString() === hoje.toDateString();
}

function renderizarHistorico() {
  const historico = lerHistorico();
  const lista = document.getElementById("listaHistorico");
  const vazio = document.getElementById("historicoVazio");

  const doDia = historico.filter((r) => ehHoje(r.data));
  document.getElementById("statHojeQtd").textContent = doDia.length;
  document.getElementById("statHojeTotal").textContent = moeda(doDia.reduce((s, r) => s + r.total, 0));

  lista.querySelectorAll(".registro").forEach((el) => el.remove());

  if (historico.length === 0) {
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  historico.forEach((r, index) => {
    const dataFormatada = new Date(r.data).toLocaleString("pt-BR");
    const linhasItens = r.itens
      .map(
        (i) =>
          `<tr><td>${i.item}</td><td class="num">${i.quantidade}</td><td class="num">${moeda(i.preco)}</td><td class="num">${moeda(i.subtotal)}</td></tr>`
      )
      .join("");

    const details = document.createElement("details");
    details.className = "registro";
    details.innerHTML = `
      <summary>
        <div class="registro-titulo">
          <strong>${r.compradores || "Comprador não informado"}</strong>
          <small>${dataFormatada} · vendedor: ${r.vendedor || "-"} · ${r.tipoTransacao}</small>
        </div>
        <span class="registro-total">${moeda(r.total)}</span>
      </summary>
      <div class="registro-corpo">
        <table>
          <thead><tr><th>Item</th><th>Qtd.</th><th>Preço</th><th>Subtotal</th></tr></thead>
          <tbody>${linhasItens}</tbody>
        </table>
        <p>FAC comprador: ${r.facComprador || "-"} · ID do comprador: ${r.idComprador || "-"} · ID do vendedor: ${r.discordIdVendedor || "-"}</p>
        ${r.tipoTransacao === "Troca" && r.detalhesTroca ? `<p>Detalhes: ${r.detalhesTroca}</p>` : ""}
        <p>Valor a retirar: <strong>${moeda(r.valorFuncionario)}</strong></p>
        <div class="registro-acoes">
          <button type="button" class="btn btn-ghost btn-excluir-registro" data-index="${index}">Excluir</button>
        </div>
      </div>
    `;
    lista.appendChild(details);
  });
}

document.getElementById("listaHistorico").addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-excluir-registro");
  if (!btn) return;
  const historico = lerHistorico();
  historico.splice(parseInt(btn.dataset.index, 10), 1);
  localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
  renderizarHistorico();
});

document.getElementById("btnLimparHistorico").addEventListener("click", () => {
  if (!confirm("Apagar todo o histórico de vendas deste navegador?")) return;
  localStorage.removeItem(CHAVE_HISTORICO);
  renderizarHistorico();
  mostrarToast("Histórico apagado.");
});

// ===================================================================
// Painel administrativo (logo, nome da facção, itens e preços)
// ===================================================================
async function sha256Hex(texto) {
  if (window.crypto && window.crypto.subtle) {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback simples caso o navegador não exponha Web Crypto (ex.: contexto não seguro).
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash << 5) - hash + texto.charCodeAt(i);
    hash |= 0;
  }
  return "fallback-" + hash;
}

function obterHashSenha() {
  return localStorage.getItem(CHAVE_SENHA_HASH) || HASH_SENHA_PADRAO;
}

const modalSenha = document.getElementById("modalSenha");
const inputSenhaAdmin = document.getElementById("inputSenhaAdmin");
const erroSenha = document.getElementById("erroSenha");

document.getElementById("btnAdmin").addEventListener("click", () => {
  inputSenhaAdmin.value = "";
  erroSenha.hidden = true;
  modalSenha.hidden = false;
  inputSenhaAdmin.focus();
});
document.getElementById("btnCancelarSenha").addEventListener("click", () => (modalSenha.hidden = true));
modalSenha.addEventListener("click", (e) => {
  if (e.target === modalSenha) modalSenha.hidden = true;
});
inputSenhaAdmin.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btnEntrarAdmin").click();
});

document.getElementById("btnEntrarAdmin").addEventListener("click", async () => {
  const digitado = await sha256Hex(inputSenhaAdmin.value);
  if (digitado === obterHashSenha()) {
    modalSenha.hidden = true;
    abrirPainelAdmin();
  } else {
    erroSenha.hidden = false;
    inputSenhaAdmin.select();
  }
});

const modalAdmin = document.getElementById("modalAdmin");
const adminListaItens = document.getElementById("adminListaItens");
let itensAdminEmEdicao = [];

function abrirPainelAdmin() {
  document.getElementById("adminNomeFaccao").value = config.nome;
  document.getElementById("adminLogoPreview").src = config.logo || LOGO_PADRAO;
  document.getElementById("adminLogoArquivo").value = "";
  document.getElementById("adminLogoArquivo").dataset.dataUrl = "";
  atualizarPreviaBanner(config.banner);
  document.getElementById("adminBannerArquivo").value = "";
  document.getElementById("adminBannerArquivo").dataset.dataUrl = "";
  document.getElementById("adminWebhook").value = localStorage.getItem(CHAVE_WEBHOOK) || "";
  document.getElementById("adminNovaSenha").value = "";
  document.getElementById("adminConfirmarSenha").value = "";
  document.getElementById("erroSenhaAdmin").hidden = true;
  document.getElementById("erroAdmin").hidden = true;

  itensAdminEmEdicao = config.armas.map((a) => ({ ...a }));
  renderizarItensAdmin();

  modalAdmin.hidden = false;
}

function renderizarItensAdmin() {
  adminListaItens.innerHTML = "";
  itensAdminEmEdicao.forEach((item, index) => {
    const linha = document.createElement("div");
    linha.className = "admin-item-card";
    linha.innerHTML = `
      <div class="admin-item-linha1">
        <span class="admin-item-numero">${index + 1}</span>
        <input type="text" class="admin-item-nome" placeholder="Nome do item" value="${escaparHtml(item.nome)}" data-campo="nome" data-index="${index}">
        <button type="button" class="admin-item-remover" data-index="${index}" aria-label="Remover item" title="Remover item">✕</button>
      </div>
      <label class="admin-preco-toggle">
        <input type="checkbox" data-campo="doisPrecos" data-index="${index}" ${item.precoUnico ? "" : "checked"}>
        <span>Dois preços (normal e mínimo)</span>
      </label>
      <div class="admin-item-precos">
        <label class="admin-preco-campo">
          <span>${item.precoUnico ? "Preço" : "Preço normal"}</span>
          <input type="number" min="0" step="1" value="${item.normal}" data-campo="normal" data-index="${index}">
        </label>
        <label class="admin-preco-campo" ${item.precoUnico ? "hidden" : ""}>
          <span>Preço mínimo</span>
          <input type="number" min="0" step="1" value="${item.minimo}" data-campo="minimo" data-index="${index}">
        </label>
      </div>
    `;
    adminListaItens.appendChild(linha);
  });
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

adminListaItens.addEventListener("input", (e) => {
  const campo = e.target.dataset.campo;
  const index = parseInt(e.target.dataset.index, 10);
  if (campo === undefined || Number.isNaN(index)) return;
  if (campo === "nome") itensAdminEmEdicao[index].nome = e.target.value;
  if (campo === "normal") itensAdminEmEdicao[index].normal = parseFloat(e.target.value) || 0;
  if (campo === "minimo") itensAdminEmEdicao[index].minimo = parseFloat(e.target.value) || 0;
});

adminListaItens.addEventListener("change", (e) => {
  if (e.target.dataset.campo !== "doisPrecos") return;
  const index = parseInt(e.target.dataset.index, 10);
  if (Number.isNaN(index)) return;
  itensAdminEmEdicao[index].precoUnico = !e.target.checked;
  renderizarItensAdmin();
});

adminListaItens.addEventListener("click", (e) => {
  const btn = e.target.closest(".admin-item-remover");
  if (!btn) return;
  itensAdminEmEdicao.splice(parseInt(btn.dataset.index, 10), 1);
  renderizarItensAdmin();
});

document.getElementById("btnAdicionarItem").addEventListener("click", () => {
  itensAdminEmEdicao.push({ id: "", nome: "", normal: 0, minimo: 0, precoUnico: false });
  renderizarItensAdmin();
  const inputs = adminListaItens.querySelectorAll('[data-campo="nome"]');
  inputs[inputs.length - 1].focus();
});

// Logo: converte o arquivo escolhido em data URL para ficar salvo junto da config.
document.getElementById("adminLogoArquivo").addEventListener("change", (e) => {
  const arquivo = e.target.files[0];
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    document.getElementById("adminLogoPreview").src = leitor.result;
    document.getElementById("adminLogoArquivo").dataset.dataUrl = leitor.result;
  };
  leitor.readAsDataURL(arquivo);
});

document.getElementById("btnRemoverLogo").addEventListener("click", () => {
  document.getElementById("adminLogoPreview").src = LOGO_PADRAO;
  document.getElementById("adminLogoArquivo").value = "";
  document.getElementById("adminLogoArquivo").dataset.dataUrl = "REMOVER";
});

function atualizarPreviaBanner(url) {
  const img = document.getElementById("adminBannerPreview");
  const vazio = document.getElementById("adminBannerVazio");
  if (url) {
    img.src = url;
    img.hidden = false;
    vazio.hidden = true;
  } else {
    img.src = "";
    img.hidden = true;
    vazio.hidden = false;
  }
}

// Banner: mesma lógica da logo — converte em data URL e guarda na config.
document.getElementById("adminBannerArquivo").addEventListener("change", (e) => {
  const arquivo = e.target.files[0];
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    atualizarPreviaBanner(leitor.result);
    document.getElementById("adminBannerArquivo").dataset.dataUrl = leitor.result;
  };
  leitor.readAsDataURL(arquivo);
});

document.getElementById("btnRemoverBanner").addEventListener("click", () => {
  atualizarPreviaBanner(null);
  document.getElementById("adminBannerArquivo").value = "";
  document.getElementById("adminBannerArquivo").dataset.dataUrl = "REMOVER";
});

function gerarIdUnico(nome, idsExistentes) {
  const base = nome.trim().toUpperCase().replace(/\s+/g, "_") || "ITEM";
  let id = base;
  let n = 2;
  while (idsExistentes.includes(id)) {
    id = `${base}_${n}`;
    n++;
  }
  return id;
}

document.getElementById("btnFecharAdmin").addEventListener("click", () => (modalAdmin.hidden = true));
modalAdmin.addEventListener("click", (e) => {
  if (e.target === modalAdmin) modalAdmin.hidden = true;
});

document.getElementById("btnSalvarAdmin").addEventListener("click", async () => {
  const erroAdmin = document.getElementById("erroAdmin");
  const erroSenhaAdmin = document.getElementById("erroSenhaAdmin");
  erroAdmin.hidden = true;
  erroSenhaAdmin.hidden = true;

  const nomeDigitado = document.getElementById("adminNomeFaccao").value.trim();
  if (!nomeDigitado) {
    erroAdmin.textContent = "O nome da facção não pode ficar em branco.";
    erroAdmin.hidden = false;
    return;
  }

  const itensValidos = itensAdminEmEdicao.filter((i) => i.nome.trim() !== "");
  if (itensValidos.length === 0) {
    erroAdmin.textContent = "Adicione ao menos um item.";
    erroAdmin.hidden = false;
    return;
  }

  const idsExistentes = [];
  const armasFinal = itensValidos.map((i) => {
    const id = gerarIdUnico(i.nome, idsExistentes);
    idsExistentes.push(id);
    return {
      id,
      nome: i.nome.trim(),
      normal: Math.max(0, i.normal),
      minimo: Math.max(0, i.minimo),
      precoUnico: !!i.precoUnico,
    };
  });

  const novaSenha = document.getElementById("adminNovaSenha").value;
  const confirmarSenha = document.getElementById("adminConfirmarSenha").value;
  if (novaSenha || confirmarSenha) {
    if (novaSenha.length < 4) {
      erroSenhaAdmin.textContent = "A nova senha precisa ter pelo menos 4 caracteres.";
      erroSenhaAdmin.hidden = false;
      return;
    }
    if (novaSenha !== confirmarSenha) {
      erroSenhaAdmin.textContent = "As senhas não coincidem.";
      erroSenhaAdmin.hidden = false;
      return;
    }
    localStorage.setItem(CHAVE_SENHA_HASH, await sha256Hex(novaSenha));
  }

  const logoArquivoEl = document.getElementById("adminLogoArquivo");
  let logoFinal = config.logo;
  if (logoArquivoEl.dataset.dataUrl === "REMOVER") logoFinal = null;
  else if (logoArquivoEl.dataset.dataUrl) logoFinal = logoArquivoEl.dataset.dataUrl;

  const bannerArquivoEl = document.getElementById("adminBannerArquivo");
  let bannerFinal = config.banner;
  if (bannerArquivoEl.dataset.dataUrl === "REMOVER") bannerFinal = null;
  else if (bannerArquivoEl.dataset.dataUrl) bannerFinal = bannerArquivoEl.dataset.dataUrl;

  const webhookDigitado = document.getElementById("adminWebhook").value.trim();
  if (webhookDigitado) localStorage.setItem(CHAVE_WEBHOOK, webhookDigitado);
  else localStorage.removeItem(CHAVE_WEBHOOK);

  config = { nome: nomeDigitado, logo: logoFinal, banner: bannerFinal, armas: armasFinal };
  salvarConfig(config);
  aplicarIdentidade();
  montarGrade();
  carregarRascunho();
  calcular();

  modalAdmin.hidden = true;
  mostrarToast("Painel administrativo atualizado.");
});

document.getElementById("btnRestaurarPadrao").addEventListener("click", () => {
  if (!confirm("Restaurar nome, logo e lista de itens para os valores padrão? A senha do painel não é afetada.")) return;
  config = configPadrao();
  salvarConfig(config);
  aplicarIdentidade();
  montarGrade();
  carregarRascunho();
  calcular();
  modalAdmin.hidden = true;
  mostrarToast("Configuração padrão restaurada.");
});

// ===================================================================
// Toast
// ===================================================================
let toastTimeout;
function mostrarToast(mensagem, erro = false) {
  const toast = document.getElementById("toast");
  toast.textContent = mensagem;
  toast.classList.toggle("is-error", erro);
  toast.classList.add("is-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

// ===================================================================
// Inicialização
// ===================================================================
carregarRascunho();
calcular();
