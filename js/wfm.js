import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocsFromServer,
    getFirestore,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD7OHPZ8flOUGyCrdL3Sp-ZTASj03Dbn94",
    authDomain: "portal-producao-d3a08.firebaseapp.com",
    projectId: "portal-producao-d3a08",
    storageBucket: "portal-producao-d3a08.firebasestorage.app",
    messagingSenderId: "881576324700",
    appId: "1:881576324700:web:c68bdbe4c309d5fd1f4099"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const colaboradores = [];
let feedbacks = [];
let competenciaBase = "";
let colaboradorAtivoId = "";

const $ = id => document.getElementById(id);
const fmtInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, item => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[item]));
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function slug(valor) {
    return normalizarTexto(valor)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function status(tipo, texto) {
    const node = $("wfmStatus");
    if (!node) return;
    node.className = `status-message ${tipo || "muted"}`;
    node.textContent = texto;
}

function usuarioPodeEscrever() {
    return window.portalAuth?.usuarioPodeEscrever?.() === true;
}

function sessaoAtual() {
    return window.portalAuth?.obterSessao?.() || {};
}

async function aguardarUsuarioAutenticado() {
    if (auth.currentUser) {
        return auth.currentUser;
    }

    return new Promise(resolve => {
        const cancelar = onAuthStateChanged(auth, usuario => {
            cancelar();
            resolve(usuario || null);
        });
    });
}

async function garantirSessaoFirebase() {
    const usuario = await aguardarUsuarioAutenticado();
    const sessao = sessaoAtual();
    const emailSessao = String(sessao?.email || sessao?.usuario || "").trim().toLowerCase();
    const emailAuth = String(usuario?.email || "").trim().toLowerCase();

    if (!usuario || (emailSessao && emailAuth !== emailSessao)) {
        throw new Error("Sessão Firebase expirada. Saia, entre novamente e abra a Avaliação WFM.");
    }

    return usuario;
}

function getCompetenciasCollection() {
    return collection(db, "producao_competencias");
}

function getChunksCollection(competencia) {
    return collection(db, "producao_competencias", competencia, "chunks");
}

function getAvaliacoesCollection() {
    return collection(db, "wfm_avaliacoes");
}

function idColaborador(item) {
    return slug(item.email || item.nome);
}

function normalizarColaborador(linha) {
    const nome = String(linha?.nome || linha?.colaborador || linha?.funcionario || linha?.Nome || linha?.Colaborador || "").trim();
    const email = String(linha?.email || linha?.["e-mail"] || linha?.Email || linha?.E-mail || "").trim().toLowerCase();
    const celula = String(linha?.celula || linha?.célula || linha?.Celula || linha?.Célula || "").trim();

    if (!nome && !email) return null;

    return {
        id: slug(email || nome),
        nome: nome || email,
        email,
        celula
    };
}

async function listarCompetencias() {
    const snap = await getDocsFromServer(getCompetenciasCollection());
    const competencias = [];

    snap.forEach(item => {
        const data = item.data() || {};
        competencias.push(data.competencia || item.id);
    });

    return competencias.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

async function carregarLinhasCompetencia(competencia) {
    const snap = await getDocsFromServer(getChunksCollection(competencia));
    const chunks = [];

    snap.forEach(item => chunks.push(item.data() || {}));
    chunks.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    return chunks.flatMap(chunk => chunk.rows || []);
}

async function carregarColaboradores() {
    status("muted", "Buscando última competência de Produção...");
    await garantirSessaoFirebase();
    const competencias = await listarCompetencias();
    competenciaBase = competencias.at(-1) || "";

    if (!competenciaBase) {
        colaboradores.splice(0);
        renderizarColaboradores();
        status("error", "Nenhuma competência de Produção encontrada no Firebase.");
        return;
    }

    const linhas = await carregarLinhasCompetencia(competenciaBase);
    const mapa = new Map();

    linhas
        .map(normalizarColaborador)
        .filter(Boolean)
        .forEach(colaborador => {
            const chave = colaborador.id || slug(colaborador.nome);
            const existente = mapa.get(chave) || {};
            mapa.set(chave, {
                ...existente,
                ...colaborador,
                celula: colaborador.celula || existente.celula || ""
            });
        });

    colaboradores.splice(0, colaboradores.length, ...[...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    renderizarColaboradores();
    status("success", `Base WFM carregada a partir da competência ${competenciaBase}.`);
}

function optionColaborador(colaborador) {
    return `<option value="${escaparHtml(colaborador.id)}">${escaparHtml(colaborador.nome)}</option>`;
}

function renderizarColaboradores() {
    const select = $("wfmColaborador");
    if (select) {
        const valor = select.value || colaboradorAtivoId;
        const opcoes = colaboradores.map(optionColaborador).join("");
        select.innerHTML = `<option value="">Selecione o colaborador</option>${opcoes}`;
        select.value = colaboradores.some(item => item.id === valor) ? valor : "";
    }

    $("wfmTotalColaboradores").textContent = fmtInt.format(colaboradores.length);
    $("wfmBaseInfo").textContent = competenciaBase
        ? `Lista carregada da competência ${competenciaBase}, usando a base de Produção.`
        : "Aguardando base de Produção.";

    renderizarPastas();
    renderizarPerfil();
    renderizarHistorico();
}

function feedbacksDoColaborador(colaboradorId) {
    return feedbacks.filter(item => item.colaboradorId === colaboradorId);
}

function renderizarPastas() {
    const alvo = $("wfmPastas");
    if (!alvo) return;

    const busca = normalizarTexto($("wfmBuscaColaborador")?.value || "");
    const lista = colaboradores.filter(item => {
        if (!busca) return true;
        return [item.nome, item.email, item.celula].some(valor => normalizarTexto(valor).includes(busca));
    });

    if (!lista.length) {
        alvo.innerHTML = `<div class="empty-state">Nenhuma pasta encontrada para essa busca.</div>`;
        return;
    }

    alvo.innerHTML = lista.map(colaborador => {
        const total = feedbacksDoColaborador(colaborador.id).length;
        const ativo = colaborador.id === colaboradorAtivoId ? " active" : "";

        return `
            <button type="button" class="wfm-folder-item${ativo}" data-colaborador="${escaparHtml(colaborador.id)}">
                <strong>${escaparHtml(colaborador.nome)}</strong>
                <span>${escaparHtml(colaborador.celula || "Sem célula padrão")}</span>
                <small>${fmtInt.format(total)} registro(s) WFM</small>
            </button>
        `;
    }).join("");
}

function selecionarColaborador(colaboradorId) {
    colaboradorAtivoId = colaboradores.some(item => item.id === colaboradorId) ? colaboradorId : "";
    if ($("wfmColaborador")) $("wfmColaborador").value = colaboradorAtivoId;
    renderizarPastas();
    renderizarPerfil();
    renderizarHistorico();
}

function renderizarPerfil() {
    const alvo = $("wfmPerfil");
    const resumo = $("wfmPerfilResumo");
    const selecionado = $("wfmSelecionadoResumo");
    if (!alvo) return;

    const colaborador = colaboradorSelecionado();

    if (!colaborador) {
        alvo.innerHTML = `<div class="empty-state">Nenhuma pasta selecionada.</div>`;
        if (resumo) resumo.textContent = "Selecione um colaborador para abrir a pasta de atendimento.";
        if (selecionado) {
            selecionado.className = "wfm-selected-banner";
            selecionado.textContent = "Selecione o colaborador avaliado para vincular o registro à pasta WFM.";
        }
        return;
    }

    const total = feedbacksDoColaborador(colaborador.id).length;
    if (resumo) resumo.textContent = "Pasta individual com dados do colaborador e histórico de avaliações.";
    if (selecionado) {
        selecionado.className = "wfm-selected-banner active";
        selecionado.textContent = `Registro vinculado à pasta WFM de ${colaborador.nome}.`;
    }
    alvo.innerHTML = `
        <div class="wfm-profile-avatar" aria-hidden="true">${escaparHtml(iniciais(colaborador.nome))}</div>
        <div>
            <strong>${escaparHtml(colaborador.nome)}</strong>
            <span>${escaparHtml(colaborador.email || "E-mail não informado")}</span>
            <span>${escaparHtml(colaborador.celula || "Célula padrão não informada")}</span>
        </div>
        <div class="wfm-profile-metric">
            <small>Registros WFM</small>
            <b>${fmtInt.format(total)}</b>
        </div>
    `;
}

function iniciais(nome) {
    return String(nome || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(parte => parte[0])
        .join("")
        .toUpperCase() || "WF";
}

async function carregarFeedbacks() {
    await garantirSessaoFirebase();
    const snap = await getDocsFromServer(getAvaliacoesCollection());
    feedbacks = [];

    snap.forEach(item => {
        const data = item.data() || {};
        feedbacks.push({
            id: item.id,
            ...data
        });
    });

    feedbacks.sort((a, b) => String(b.dataAvaliacao || "").localeCompare(String(a.dataAvaliacao || "")));
    $("wfmTotalFeedbacks").textContent = fmtInt.format(feedbacks.length);
    renderizarHistorico();
}

function colaboradorSelecionado() {
    const id = colaboradorAtivoId || $("wfmColaborador")?.value;
    return colaboradores.find(item => item.id === id) || null;
}

function renderizarHistorico() {
    const alvo = $("wfmHistorico");
    if (!alvo) return;

    const colaborador = colaboradorSelecionado();

    if (!colaborador) {
        alvo.innerHTML = `<div class="empty-state">Selecione um colaborador para visualizar o histórico.</div>`;
        return;
    }

    const lista = feedbacksDoColaborador(colaborador.id);

    if (!lista.length) {
        alvo.innerHTML = `<div class="empty-state">Esta pasta ainda não tem registros WFM.</div>`;
        return;
    }

    alvo.innerHTML = lista.map(item => `
        <article class="wfm-history-card">
            <div>
                <strong>${escaparHtml(item.colaboradorNome || "Sem colaborador")}</strong>
                <span>${escaparHtml([item.celula, item.canal].filter(Boolean).join(" | ") || "Sem detalhe")}</span>
            </div>
            <time>${escaparHtml(formatarData(item.dataAvaliacao))}</time>
            <div class="wfm-history-rating" aria-label="Avaliação ${escaparHtml(item.nota || "-")} de 5">${escaparHtml(estrelas(item.nota))}</div>
            ${Array.isArray(item.marcadores) && item.marcadores.length ? `
                <div class="wfm-history-tags">
                    ${item.marcadores.map(marcador => `<span>${escaparHtml(marcador)}</span>`).join("")}
                </div>
            ` : ""}
            <p>${escaparHtml(item.feedback || "")}</p>
            ${item.pontosPositivos ? `<small><b>Pontos positivos:</b> ${escaparHtml(item.pontosPositivos)}</small>` : ""}
            ${item.pontosMelhoria ? `<small><b>Pontos de melhoria:</b> ${escaparHtml(item.pontosMelhoria)}</small>` : ""}
            ${item.proximaAcao ? `<small><b>Próxima ação:</b> ${escaparHtml(item.proximaAcao)}</small>` : ""}
            <footer>
                <span>Registrado por ${escaparHtml(item.avaliadorNome || item.avaliadorEmail || "-")}</span>
                ${usuarioPodeEscrever() ? `<button type="button" class="danger-button compact-danger" data-excluir-feedback="${escaparHtml(item.id)}">Excluir</button>` : ""}
            </footer>
        </article>
    `).join("");
}

function formatarData(valor) {
    if (!valor) return "-";
    const [ano, mes, dia] = String(valor).split("-");
    if (!ano || !mes || !dia) return valor;
    return `${dia}/${mes}/${ano}`;
}

function notaSelecionada() {
    return Number(document.querySelector("input[name='wfmNota']:checked")?.value || 0);
}

function marcadoresSelecionados() {
    return [...document.querySelectorAll("input[name='wfmMarcadores']:checked")]
        .map(item => item.value)
        .filter(Boolean);
}

function estrelas(nota) {
    const valor = Math.max(0, Math.min(5, Number(nota || 0)));
    return "★".repeat(valor) + "☆".repeat(5 - valor);
}

function valorCsv(valor) {
    const texto = String(valor ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
    return `"${texto}"`;
}

function compararDataAvaliacao(a, b) {
    const dataA = String(a?.dataAvaliacao || "");
    const dataB = String(b?.dataAvaliacao || "");
    return dataA.localeCompare(dataB) || String(a?.colaboradorNome || "").localeCompare(String(b?.colaboradorNome || ""), "pt-BR");
}

function baixarRegistros(nomeArquivo, lista) {
    const colunas = [
        "Colaborador",
        "E-mail",
        "Célula",
        "Competência base",
        "Data da avaliação",
        "Canal",
        "Nota",
        "Marcadores",
        "Feedback",
        "Pontos positivos",
        "Pontos de melhoria",
        "Próxima ação",
        "Avaliador"
    ];
    const linhas = lista.map(item => [
        item.colaboradorNome,
        item.colaboradorEmail,
        item.celula,
        item.competenciaBase,
        formatarData(item.dataAvaliacao),
        item.canal,
        item.nota,
        Array.isArray(item.marcadores) ? item.marcadores.join(", ") : "",
        item.feedback,
        item.pontosPositivos,
        item.pontosMelhoria,
        item.proximaAcao,
        item.avaliadorNome || item.avaliadorEmail
    ]);
    const csv = [colunas, ...linhas].map(linha => linha.map(valorCsv).join(";")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function exportarPasta() {
    const colaborador = colaboradorSelecionado();

    if (!colaborador) {
        status("error", "Selecione uma pasta antes de exportar.");
        return;
    }

    const lista = feedbacksDoColaborador(colaborador.id);

    if (!lista.length) {
        status("error", "Esta pasta ainda não tem registros para exportar.");
        return;
    }

    baixarRegistros(`wfm-${slug(colaborador.nome)}.csv`, [...lista].sort(compararDataAvaliacao));
    status("success", "Planilha da pasta WFM exportada.");
}

function exportarGeral() {
    if (!feedbacks.length) {
        status("error", "Ainda não há registros WFM para exportar.");
        return;
    }

    baixarRegistros("wfm-geral-por-data-avaliacao.csv", [...feedbacks].sort(compararDataAvaliacao));
    status("success", "Planilha geral WFM exportada por data de avaliação.");
}

async function salvarFeedback(event) {
    event.preventDefault();

    if (!usuarioPodeEscrever()) {
        status("error", "Seu acesso é somente visualização. O feedback não foi salvo.");
        return;
    }

    const colaborador = colaboradorSelecionado();
    const feedback = String($("wfmFeedback")?.value || "").trim();
    const dataAvaliacao = $("wfmData")?.value;

    if (!colaborador || !dataAvaliacao || !feedback) {
        status("error", "Informe colaborador, data e feedback antes de salvar.");
        return;
    }

    const sessao = sessaoAtual();
    const payload = {
        colaboradorId: colaborador.id,
        colaboradorNome: colaborador.nome,
        colaboradorEmail: colaborador.email,
        celula: colaborador.celula,
        competenciaBase,
        dataAvaliacao,
        canal: $("wfmCanal")?.value || "Ticket",
        nota: notaSelecionada(),
        marcadores: marcadoresSelecionados(),
        feedback,
        pontosPositivos: String($("wfmPontosPositivos")?.value || "").trim(),
        pontosMelhoria: String($("wfmPontosMelhoria")?.value || "").trim(),
        proximaAcao: String($("wfmProximaAcao")?.value || "").trim(),
        avaliadorEmail: sessao.email || sessao.usuario || "",
        avaliadorNome: sessao.nome || sessao.email || sessao.usuario || "",
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
    };

    $("wfmSalvar").disabled = true;
    status("muted", "Salvando feedback WFM...");

    try {
        await addDoc(getAvaliacoesCollection(), payload);
        limparFormulario(false);
        await carregarFeedbacks();
        selecionarColaborador(colaborador.id);
        status("success", "Feedback WFM salvo com sucesso.");
    } catch (erro) {
        console.error(erro);
        status("error", `Erro ao salvar feedback: ${erro.message}`);
    } finally {
        $("wfmSalvar").disabled = false;
    }
}

async function excluirFeedback(id) {
    if (!usuarioPodeEscrever()) {
        status("error", "Seu acesso é somente visualização. O registro não foi excluído.");
        return;
    }

    if (!id) return;

    const item = feedbacks.find(registro => registro.id === id);
    const nome = item?.colaboradorNome || "este registro";
    const confirmado = window.confirm(`Excluir o feedback WFM de ${nome}? Essa ação não pode ser desfeita.`);

    if (!confirmado) return;

    status("muted", "Excluindo registro WFM...");

    try {
        await deleteDoc(doc(db, "wfm_avaliacoes", id));
        await carregarFeedbacks();
        renderizarPastas();
        renderizarPerfil();
        status("success", "Registro WFM excluído com sucesso.");
    } catch (erro) {
        console.error(erro);
        status("error", `Erro ao excluir feedback: ${erro.message}`);
    }
}

function limparFormulario(limparColaborador = true) {
    if (limparColaborador) selecionarColaborador("");
    ["wfmFeedback", "wfmPontosPositivos", "wfmPontosMelhoria", "wfmProximaAcao"].forEach(id => {
        if ($(id)) $(id).value = "";
    });
    if ($("wfmData")) $("wfmData").valueAsDate = new Date();
    if ($("wfmCanal")) $("wfmCanal").value = "Ticket";
    const notaPadrao = document.querySelector("input[name='wfmNota'][value='5']");
    if (notaPadrao) notaPadrao.checked = true;
    document.querySelectorAll("input[name='wfmMarcadores']").forEach(item => {
        item.checked = false;
    });
}

function aplicarPermissao() {
    if (usuarioPodeEscrever()) return;

    ["wfmSalvar", "wfmColaborador", "wfmData", "wfmCanal", "wfmFeedback", "wfmPontosPositivos", "wfmPontosMelhoria", "wfmProximaAcao"].forEach(id => {
        const node = $(id);
        if (!node) return;
        node.disabled = true;
        node.title = "Seu acesso é somente visualização.";
    });
    document.querySelectorAll("input[name='wfmNota'], input[name='wfmMarcadores']").forEach(node => {
        node.disabled = true;
        node.title = "Seu acesso é somente visualização.";
    });
    status("muted", "Acesso somente visualização. Você pode consultar feedbacks, mas não pode criar registros.");
}

async function inicializar() {
    if (window.portalAcessoBloqueado) return;

    limparFormulario(false);
    aplicarPermissao();

    $("wfmForm")?.addEventListener("submit", salvarFeedback);
    $("wfmLimpar")?.addEventListener("click", () => limparFormulario(true));
    $("wfmExportar")?.addEventListener("click", exportarPasta);
    $("wfmExportarGeral")?.addEventListener("click", exportarGeral);
    $("wfmColaborador")?.addEventListener("change", event => selecionarColaborador(event.target.value));
    $("wfmAtualizarBase")?.addEventListener("click", () => carregarColaboradores().catch(erro => status("error", `Erro ao atualizar base: ${erro.message}`)));
    $("wfmBuscaColaborador")?.addEventListener("input", renderizarPastas);
    $("wfmPastas")?.addEventListener("click", event => {
        const botao = event.target.closest("[data-colaborador]");
        if (!botao) return;
        selecionarColaborador(botao.dataset.colaborador);
    });
    $("wfmHistorico")?.addEventListener("click", event => {
        const botao = event.target.closest("[data-excluir-feedback]");
        if (!botao) return;
        excluirFeedback(botao.dataset.excluirFeedback);
    });

    try {
        await carregarColaboradores();
        await carregarFeedbacks();
    } catch (erro) {
        console.error(erro);
        status("error", `Erro ao carregar WFM: ${erro.message}`);
    }
}

document.addEventListener("DOMContentLoaded", inicializar);
