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
// Configuração (nome da facção, logo e itens) — persistida localmente
// ===================================================================
function configPadrao() {
  return { nome: NOME_PADRAO, logo: null, armas: ARMAS_PADRAO.map((a) => ({ ...a })) };
}

function carregarConfig() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CONFIG));
    if (!salvo || !Array.isArray(salvo.armas) || salvo.armas.length === 0) return configPadrao();
    return {
      nome: salvo.nome || NOME_PADRAO,
      logo: salvo.logo || null,
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
      <div class="item-card-header">
        <span class="item-nome">${arma.nome}</span>
        <span class="item-subtotal" data-role="subtotal"></span>
      </div>
      <div class="item-controls">
        <div class="stepper">
          <button type="button" data-role="menos" aria-label="Diminuir">−</button>
          <input type="number" min="0" step="1" value="0" inputmode="numeric" data-role="quantidade" aria-label="Quantidade de ${arma.nome}">
          <button type="button" data-role="mais" aria-label="Aumentar">+</button>
        </div>
        <select class="item-preco" data-role="preco" aria-label="Preço de ${arma.nome}">
          ${
            arma.precoUnico
              ? `<option value="${arma.normal}">R$ ${arma.normal.toLocaleString("pt-BR")}</option>`
              : `<option value="${arma.normal}">Normal: ${arma.normal.toLocaleString("pt-BR")}</option>
                 <option value="${arma.minimo}">Mínimo: ${arma.minimo.toLocaleString("pt-BR")}</option>`
          }
        </select>
      </div>
    `;
    gradeArmas.appendChild(card);
  });
}
aplicarIdentidade();
montarGrade();

// ===================================================================
// Cálculo do total
// ===================================================================
function calcular() {
  let total = 0;
  let totalItens = 0;

  document.querySelectorAll(".item-card").forEach((card) => {
    const input = card.querySelector('[data-role="quantidade"]');
    const select = card.querySelector('[data-role="preco"]');
    const subtotalEl = card.querySelector('[data-role="subtotal"]');

    const quantidade = Math.max(0, parseInt(input.value, 10) || 0);
    const preco = parseFloat(select.value) || 0;
    const subtotal = quantidade * preco;

    total += subtotal;
    totalItens += quantidade;

    subtotalEl.textContent = quantidade > 0 ? `${quantidade} × ${moeda(preco)} = ${moeda(subtotal)}` : "";
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
gradeArmas.addEventListener("change", (e) => {
  if (e.target.matches('[data-role="preco"]')) calcular();
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
    const preco = card.querySelector('[data-role="preco"]').value;
    if (qtd > 0) dados[card.dataset.item] = { qtd, preco };
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
      card.querySelector('[data-role="preco"]').value = salvo.preco;
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
    const preco = parseFloat(card.querySelector('[data-role="preco"]').value) || 0;
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
      await enviarParaDiscord(montarMensagem(registro), webhook);
      mostrarToast("Compra salva e enviada para o Discord.");
    } catch (err) {
      mostrarToast("Compra salva localmente, mas falhou o envio para o Discord.", true);
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar compra";
    }
  } else {
    mostrarToast("Compra salva no histórico. Configure o webhook (⚙) para enviar ao Discord também.");
  }

  limparFormularioPosVenda();
});

function valor(id) {
  return document.getElementById(id).value.trim();
}

function montarMensagem(r) {
  let itensTexto = "";
  r.itens.forEach((i) => {
    itensTexto += `𝙸𝚃𝙴𝙼: ${i.item}\n𝚀𝚄𝙰𝙽𝚃𝙸𝙳𝙰𝙳𝙴: ${i.quantidade}\n𝚅𝙰𝙻𝙾𝚁: ${moeda(i.preco)}\n`;
  });
  const dataFormatada = new Date(r.data).toLocaleDateString("pt-BR");
  return (
    `𝙵𝙰𝙲 𝙲𝙾𝙼𝙿𝚁𝙰𝙳𝙾𝚁: ${r.facComprador}\n` +
    `𝙲𝙾𝙼𝙿𝚁𝙰𝙳𝙾𝚁𝙴𝚂: ${r.compradores}\n` +
    `𝚅𝙴𝙽𝙳𝙴𝙳𝙾𝚁: <@${r.discordIdVendedor}>\n` +
    `${itensTexto}` +
    `𝚅𝙰𝙻𝙾𝚁 𝙱𝚁𝚄𝚃𝙾: ${moeda(r.total)}\n` +
    `𝚅𝙰𝙻𝙾𝚁 𝙰 𝚁𝙴𝚃𝙸𝚁𝙰𝚁: ${moeda(r.valorFuncionario)}\n` +
    (r.tipoTransacao === "Troca" ? `DETALHES DA TROCA: ${r.detalhesTroca}\n` : "") +
    `𝙳𝙰𝚃𝙰: ${dataFormatada}`
  );
}

async function enviarParaDiscord(mensagem, webhookURL) {
  const resposta = await fetch(webhookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: mensagem }),
  });
  if (!resposta.ok) throw new Error("Falha ao enviar para o Discord");
}

function limparFormularioPosVenda() {
  document.querySelectorAll('[data-role="quantidade"]').forEach((input) => (input.value = 0));
  ["facComprador", "compradores", "discordIdVendedor", "detalhesTroca"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  campoTroca.hidden = true;
  tipoTransacao.value = "Venda";
  calcular();
}

// ===================================================================
// Copiar resumo (alternativa ao Discord)
// ===================================================================
document.getElementById("btnCopiar").addEventListener("click", async () => {
  const itens = coletarItensComprados();
  if (itens.length === 0) {
    mostrarToast("Adicione ao menos um item para copiar o resumo.", true);
    return;
  }
  const registro = {
    data: new Date().toISOString(),
    facComprador: valor("facComprador") || "-",
    compradores: valor("compradores") || "-",
    vendedor: valor("vendedor") || "-",
    discordIdVendedor: valor("discordIdVendedor") || "-",
    tipoTransacao: tipoTransacao.value,
    detalhesTroca: valor("detalhesTroca"),
    itens,
    total: parseFloat(document.getElementById("total").textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0,
    valorFuncionario: parseFloat(document.getElementById("valorFuncionario").textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0,
  };
  try {
    await navigator.clipboard.writeText(montarMensagem(registro));
    mostrarToast("Resumo copiado para a área de transferência.");
  } catch (e) {
    mostrarToast("Não foi possível copiar automaticamente.", true);
  }
});

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
        <p>FAC comprador: ${r.facComprador || "-"} · ID Discord vendedor: ${r.discordIdVendedor || "-"}</p>
        ${r.tipoTransacao === "Troca" && r.detalhesTroca ? `<p>Detalhes da troca: ${r.detalhesTroca}</p>` : ""}
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

  const webhookDigitado = document.getElementById("adminWebhook").value.trim();
  if (webhookDigitado) localStorage.setItem(CHAVE_WEBHOOK, webhookDigitado);
  else localStorage.removeItem(CHAVE_WEBHOOK);

  config = { nome: nomeDigitado, logo: logoFinal, armas: armasFinal };
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
