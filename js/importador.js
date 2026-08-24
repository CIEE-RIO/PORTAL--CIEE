let importacaoPendente = null;
let preCadastroOperacional = carregarPreCadastroOperacional();

const camposLancamentoManual = {
    competencia: "manualCompetencia",
    nome: "manualNome",
    email: "manualEmail",
    celula: "manualCelula",
    contratosMarcados: "manualContratosMarcados",
    prorrogacoes: "manualProrrogacoes",
    alteracoes: "manualAlteracoes",
    contratosDesligados: "manualContratosDesligados",
    ticketsResolvidos: "manualTicketsResolvidos",
    sla: "manualSla",
    observacao: "manualObservacao"
};

function carregarPreCadastroOperacional() {
    try {
        const salvo = JSON.parse(localStorage.getItem("portal_pre_cadastro_operacional") || "{}");

        return {
            colaboradores: Array.isArray(salvo.colaboradores) ? salvo.colaboradores : [],
            celulas: Array.isArray(salvo.celulas) ? salvo.celulas : []
        };
    } catch {
        return { colaboradores: [], celulas: [] };
    }
}

function salvarPreCadastroOperacionalLocal() {
    localStorage.setItem("portal_pre_cadastro_operacional", JSON.stringify(preCadastroOperacional));
}

async function registrarHistoricoImportador(payload) {
    if (typeof window.registrarHistoricoAtualizacaoProducao !== "function") {
        return;
    }

    try {
        await window.registrarHistoricoAtualizacaoProducao(payload);
    } catch (erro) {
        console.warn("Nao foi possivel registrar o historico da atualizacao.", erro);
    }
}

function registrarColaboradorPreCadastro(colaborador, indiceLinha = null) {
    const nome = String(
        colaborador?.nome
        || colaborador?.colaborador
        || colaborador?.funcionario
        || colaborador?.["Colaborador"]
        || colaborador?.["Nome"]
        || ""
    ).trim();

    if (!nome) {
        return;
    }

    const email = String(colaborador.email || "").trim().toLowerCase();
    const celula = String(colaborador.celula || "").trim();
    const idBase = idPreCadastro(email || nome);
    const id = colaborador.origem === "manual" || indiceLinha === null
        ? idBase
        : `${idBase || "linha"}-${String(indiceLinha + 1).padStart(3, "0")}`;
    const indice = preCadastroOperacional.colaboradores.findIndex(item => item.id === id);
    const registro = {
        id,
        nome,
        email,
        celula,
        origem: colaborador.origem || "base"
    };

    if (indice >= 0) {
        preCadastroOperacional.colaboradores[indice] = {
            ...registro,
            ...preCadastroOperacional.colaboradores[indice]
        };
    } else {
        preCadastroOperacional.colaboradores.push(registro);
    }

    if (celula) {
        registrarCelulaPreCadastro(celula);
    }
}

function registrarCelulaPreCadastro(nome) {
    const celula = String(nome || "").trim();
    const id = idPreCadastro(celula);

    if (!celula || preCadastroOperacional.celulas.some(item => item.id === id)) {
        return;
    }

    preCadastroOperacional.celulas.push({ id, nome: celula, origem: "base" });
}

async function carregarPreCadastroDasBasesImportadas() {
    let tentativas = 0;

    while (
        (
            typeof window.listarCompetenciasProducaoFirebase !== "function"
            || typeof window.carregarLinhasProducaoFirebase !== "function"
        )
        && tentativas < 20
    ) {
        await new Promise(resolve => setTimeout(resolve, 150));
        tentativas += 1;
    }

    if (
        typeof window.listarCompetenciasProducaoFirebase !== "function"
        || typeof window.carregarLinhasProducaoFirebase !== "function"
    ) {
        renderizarPreCadastroOperacional();
        return;
    }

    try {
        setStatusPreCadastro("preCadastroColaboradorStatus", "muted", "Carregando colaboradores das competências importadas...");
        const competencias = await window.listarCompetenciasProducaoFirebase();
        const ultimaCompetencia = competencias.at(-1);
        const ajustesManuais = ultimaCompetencia
            ? []
            : preCadastroOperacional.colaboradores.filter(item => item.origem === "manual");
        const celulasManuais = ultimaCompetencia
            ? []
            : preCadastroOperacional.celulas.filter(item => item.origem === "manual");
        let totalLinhasBase = 0;

        preCadastroOperacional = {
            colaboradores: [...ajustesManuais],
            celulas: [...celulasManuais]
        };

        if (ultimaCompetencia) {
            const linhas = await window.carregarLinhasProducaoFirebase(ultimaCompetencia);
            totalLinhasBase = linhas.length;
            linhas.forEach((linha, indice) => registrarColaboradorPreCadastro(linha, indice));
        }

        salvarPreCadastroOperacionalLocal();
        renderizarPreCadastroOperacional();
        setStatusPreCadastro(
            "preCadastroColaboradorStatus",
            preCadastroOperacional.colaboradores.length !== totalLinhasBase && ultimaCompetencia ? "error" : "success",
            ultimaCompetencia
                ? `Lista atualizada com base na última competência importada: ${ultimaCompetencia}. ${formatarNumero(totalLinhasBase)} linha(s) e ${formatarNumero(preCadastroOperacional.colaboradores.length)} registro(s) carregado(s).`
                : "Nenhuma competência importada encontrada."
        );
    } catch (erro) {
        console.warn("Nao foi possivel carregar o pre-cadastro pelas bases importadas.", erro);
        renderizarPreCadastroOperacional();
        setStatusPreCadastro("preCadastroColaboradorStatus", "error", "Não foi possível carregar as bases importadas. O cadastro local foi mantido.");
    }
}

function obterPlanilha(workbook) {
    const nomePreferencial = workbook.SheetNames.find(nome => normalizarTexto(nome) === "PLANILHA1");
    const nomeAba = nomePreferencial || workbook.SheetNames[0];

    return {
        nomeAba,
        planilha: workbook.Sheets[nomeAba]
    };
}

function campoManual(chave) {
    return document.getElementById(camposLancamentoManual[chave]);
}

function statusLancamentoManual(tipo, mensagem) {
    const status = document.getElementById("resultadoLancamentoManual");

    if (!status) {
        return;
    }

    status.className = `status-message ${tipo}`;
    status.textContent = mensagem;
}

function numeroManual(chave) {
    return numeroPlanilha(campoManual(chave)?.value || 0);
}

function chaveColaboradorManual(linha) {
    const email = String(linha.email || "").trim().toLowerCase();

    if (email) {
        return `email:${email}`;
    }

    return `nome:${normalizarTexto(linha.nome)}`;
}

function montarLinhaLancamentoManual() {
    const funcionarioSelecionado = obterColaboradorSelecionadoManual();
    const nome = String(funcionarioSelecionado?.nome || campoManual("nome")?.value || "").trim();
    const email = String(campoManual("email")?.value || "").trim();
    const celula = String(campoManual("celula")?.value || "").trim();
    const competencia = String(campoManual("competencia")?.value || document.getElementById("competenciaProducao")?.value || "").trim();

    if (!competencia) {
        throw new Error("Informe a competência do lançamento manual.");
    }

    if (!nome) {
        throw new Error("Informe o nome do colaborador.");
    }

    if (!celula) {
        throw new Error("Informe a célula do colaborador.");
    }

    return {
        competencia,
        linha: {
            nome,
            email,
            celula,
            contratosMarcados: numeroManual("contratosMarcados"),
            prorrogacoes: numeroManual("prorrogacoes"),
            alteracoes: numeroManual("alteracoes"),
            contratosDesligados: numeroManual("contratosDesligados"),
            ticketsResolvidos: numeroManual("ticketsResolvidos"),
            satisfacaoPositiva: 0,
            satisfacaoNegativa: 0,
            sla: numeroManual("sla"),
            origem: "manual",
            observacaoManual: String(campoManual("observacao")?.value || "").trim()
        }
    };
}

function preencherListasLancamentoManual() {
    const listaColaboradores = document.getElementById("manualNome");
    const listaPreCadastroColaboradores = document.getElementById("preCadastroColaboradoresLista");
    const selectCelulaManual = document.getElementById("manualCelula");
    const listaCelulas = document.getElementById("manualCelulas");
    const funcionarios = combinarColaboradoresLancamentoManual();

    if (listaColaboradores) {
        const valorAtual = listaColaboradores.value;
        const opcoes = funcionarios
            .filter(funcionario => funcionario.nome)
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map(funcionario => `<option value="${escaparHtml(funcionario.id || funcionario.nome)}">${escaparHtml(funcionario.nome)}</option>`);

        listaColaboradores.innerHTML = `<option value="">Selecione o colaborador</option>${opcoes.join("")}`;
        listaColaboradores.value = funcionarios.some(funcionario => (funcionario.id || funcionario.nome) === valorAtual) ? valorAtual : "";
    }

    if (listaPreCadastroColaboradores) {
        listaPreCadastroColaboradores.innerHTML = funcionarios
            .filter(funcionario => funcionario.nome)
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map(funcionario => `<option value="${escaparHtml(funcionario.nome)}" data-email="${escaparHtml(funcionario.email || "")}" data-celula="${escaparHtml(funcionario.celula || "")}"></option>`)
            .join("");
    }

    const celulas = combinarCelulasLancamentoManual()
        .sort((a, b) => a.localeCompare(b));

    if (selectCelulaManual) {
        const valorAtual = selectCelulaManual.value;
        selectCelulaManual.innerHTML = `<option value="">Selecione a célula</option>` + celulas
            .map(celula => `<option value="${escaparHtml(celula)}">${escaparHtml(celula)}</option>`)
            .join("");
        selectCelulaManual.value = celulas.includes(valorAtual) ? valorAtual : "";
    }

    if (listaCelulas) {
        listaCelulas.innerHTML = celulas.map(celula => `<option value="${escaparHtml(celula)}"></option>`).join("");
    }

    renderizarColaboradoresDaCelulaManual();
}

function combinarColaboradoresLancamentoManual() {
    const mapa = new Map();

    (dadosProducao.funcionarios || []).forEach(funcionario => {
        if (!funcionario.nome) return;
        mapa.set(normalizarTexto(funcionario.email || funcionario.nome), {
            nome: funcionario.nome,
            email: funcionario.email || "",
            celula: funcionario.celula || ""
        });
    });

    preCadastroOperacional.colaboradores.forEach(funcionario => {
        if (!funcionario.nome) return;
        mapa.set(normalizarTexto(funcionario.email || funcionario.nome), funcionario);
    });

    return [...mapa.values()];
}

function obterColaboradorSelecionadoManual() {
    const valor = String(campoManual("nome")?.value || "").trim();

    if (!valor) {
        return null;
    }

    return combinarColaboradoresLancamentoManual()
        .find(item => item.id === valor || item.nome === valor) || null;
}

function combinarCelulasLancamentoManual() {
    return [...new Set([
        ...preCadastroOperacional.celulas.map(celula => celula.nome || celula).filter(Boolean),
        ...combinarColaboradoresLancamentoManual().map(funcionario => funcionario.celula).filter(Boolean)
    ])];
}

function colaboradoresDaCelulaManual() {
    const celula = String(campoManual("celula")?.value || "").trim();

    if (!celula) {
        return [];
    }

    return combinarColaboradoresLancamentoManual()
        .filter(funcionario => normalizarTexto(funcionario.celula) === normalizarTexto(celula))
        .sort((a, b) => a.nome.localeCompare(b.nome));
}

function renderizarColaboradoresDaCelulaManual() {
    const container = document.getElementById("manualColaboradoresCelula");

    if (!container) {
        return;
    }

    const celula = String(campoManual("celula")?.value || "").trim();
    const colaboradores = colaboradoresDaCelulaManual();

    if (!celula) {
        container.hidden = true;
        container.innerHTML = "";
        return;
    }

    container.hidden = false;
    container.innerHTML = colaboradores.length
        ? `
            <div class="manual-cell-people-header">
                <strong>${escaparHtml(celula)}</strong>
                <span>${formatarNumero(colaboradores.length)} colaborador(es) encontrados</span>
            </div>
            <div class="manual-cell-people-grid">
                ${colaboradores.map(funcionario => `
                    <button type="button" class="manual-person-card" onclick="selecionarColaboradorManual('${escaparHtml(funcionario.id || funcionario.nome)}')">
                        <strong>${escaparHtml(funcionario.nome)}</strong>
                        <span>${escaparHtml(funcionario.email || "Sem e-mail")}</span>
                    </button>
                `).join("")}
            </div>
        `
        : `
            <div class="manual-cell-people-header">
                <strong>${escaparHtml(celula)}</strong>
                <span>Nenhum colaborador encontrado para esta célula.</span>
            </div>
        `;
}

function selecionarColaboradorManual(id) {
    const campo = campoManual("nome");

    if (!campo) {
        return;
    }

    campo.value = id;
    sincronizarColaboradorManual();
}

function sincronizarColaboradorManual() {
    const funcionario = obterColaboradorSelecionadoManual();

    if (!funcionario) {
        return;
    }

    if (campoManual("email")) {
        campoManual("email").value = funcionario.email || "";
    }

    if (campoManual("celula")) {
        campoManual("celula").value = funcionario.celula || "";
    }
}

function sincronizarColaboradorPreCadastro() {
    const nome = String(document.getElementById("preColaboradorNome")?.value || "").trim();
    const funcionario = combinarColaboradoresLancamentoManual().find(item => item.nome === nome);

    if (!funcionario) {
        return;
    }

    const email = document.getElementById("preColaboradorEmail");
    const celula = document.getElementById("preColaboradorCelula");

    if (email) email.value = funcionario.email || "";
    if (celula) celula.value = funcionario.celula || "";
}

function limparLancamentoManualProducao() {
    Object.entries(camposLancamentoManual).forEach(([chave, id]) => {
        const input = document.getElementById(id);

        if (!input || chave === "competencia") {
            return;
        }

        input.value = input.type === "number" ? "0" : "";
    });

    statusLancamentoManual("muted", "Campos limpos. Preencha os dados para adicionar ou atualizar um colaborador na competência.");
}

function setStatusPreCadastro(id, tipo, mensagem) {
    const status = document.getElementById(id);

    if (!status) return;

    status.className = `status-message ${tipo}`;
    status.textContent = mensagem;
}

function idPreCadastro(valor) {
    return normalizarTexto(valor).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function alternarAbaImportacao(aba) {
    document.querySelectorAll("[data-import-tab]").forEach(botao => {
        botao.classList.toggle("active", botao.dataset.importTab === aba);
    });

    const producao = document.getElementById("abaImportacaoProducao");
    const preCadastro = document.getElementById("abaImportacaoPreCadastro");
    const atualizacoes = document.getElementById("abaImportacaoAtualizacoes");
    const historico = document.getElementById("abaImportacaoHistorico");

    if (producao) producao.hidden = aba !== "producao";
    if (preCadastro) preCadastro.hidden = aba !== "preCadastro";
    if (atualizacoes) atualizacoes.hidden = aba !== "atualizacoes";
    if (historico) historico.hidden = aba !== "historico";
}

function renderizarPreCadastroOperacional() {
    const tabelaColaboradores = document.getElementById("preCadastroColaboradoresTabela");

    if (tabelaColaboradores) {
        tabelaColaboradores.innerHTML = preCadastroOperacional.colaboradores.length
            ? preCadastroOperacional.colaboradores
                .slice()
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map(colaborador => `
                    <tr>
                        <td>${escaparHtml(colaborador.nome)}</td>
                        <td>${escaparHtml(colaborador.email || "-")}</td>
                        <td>${escaparHtml(colaborador.celula || "-")}</td>
                        <td>
                            <button type="button" class="secondary-button compact-button" onclick="editarPreCadastroColaborador('${escaparHtml(colaborador.id)}')">Editar</button>
                            <button type="button" class="secondary-button compact-button" onclick="removerPreCadastroColaborador('${escaparHtml(colaborador.id)}')">Excluir</button>
                        </td>
                    </tr>
                `).join("")
            : `<tr><td colspan="4">Nenhum colaborador pré-cadastrado.</td></tr>`;
    }

    preencherListasLancamentoManual();
}

function salvarPreCadastroColaborador() {
    const nome = String(document.getElementById("preColaboradorNome")?.value || "").trim();
    const email = String(document.getElementById("preColaboradorEmail")?.value || "").trim().toLowerCase();
    const celula = String(document.getElementById("preColaboradorCelula")?.value || "").trim();

    if (!nome) {
        setStatusPreCadastro("preCadastroColaboradorStatus", "error", "Informe o nome do colaborador.");
        return;
    }

    const id = idPreCadastro(email || nome);
    const existente = preCadastroOperacional.colaboradores.findIndex(colaborador => colaborador.id === id);
    const colaborador = { id, nome, email, celula, origem: "manual" };

    if (existente >= 0) {
        preCadastroOperacional.colaboradores[existente] = colaborador;
    } else {
        preCadastroOperacional.colaboradores.push(colaborador);
    }

    registrarCelulaPreCadastro(celula);

    salvarPreCadastroOperacionalLocal();
    renderizarPreCadastroOperacional();
    limparPreCadastroColaborador();
    registrarHistoricoImportador({
        tipo: "Cadastro operacional",
        competencia: "geral",
        detalhe: `Colaborador: ${nome}`,
        valorNovo: celula || "Sem célula"
    });
    setStatusPreCadastro("preCadastroColaboradorStatus", "success", "Colaborador pré-cadastrado e disponível no lançamento manual.");
}

function limparPreCadastroColaborador() {
    ["preColaboradorNome", "preColaboradorEmail", "preColaboradorCelula"].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
}

function editarPreCadastroColaborador(id) {
    const colaborador = preCadastroOperacional.colaboradores.find(item => item.id === id);

    if (!colaborador) {
        return;
    }

    const nome = document.getElementById("preColaboradorNome");
    const email = document.getElementById("preColaboradorEmail");
    const celula = document.getElementById("preColaboradorCelula");

    if (nome) nome.value = colaborador.nome || "";
    if (email) email.value = colaborador.email || "";
    if (celula) celula.value = colaborador.celula || "";

    setStatusPreCadastro("preCadastroColaboradorStatus", "muted", "Edite os dados e clique em Salvar colaborador.");
}

function removerPreCadastroColaborador(id) {
    preCadastroOperacional.colaboradores = preCadastroOperacional.colaboradores.filter(colaborador => colaborador.id !== id);
    salvarPreCadastroOperacionalLocal();
    renderizarPreCadastroOperacional();
    registrarHistoricoImportador({
        tipo: "Cadastro operacional",
        competencia: "geral",
        detalhe: "Colaborador removido",
        valorNovo: id
    });
    setStatusPreCadastro("preCadastroColaboradorStatus", "success", "Colaborador removido do pré-cadastro.");
}

async function salvarLancamentoManualProducao() {
    try {
        const { competencia, linha } = montarLinhaLancamentoManual();
        const chaveNova = chaveColaboradorManual(linha);
        const linhasAtuais = typeof window.carregarLinhasProducaoFirebase === "function"
            ? await window.carregarLinhasProducaoFirebase(competencia)
            : [...(dadosProducao.linhasOriginais || [])];
        const indiceExistente = linhasAtuais.findIndex(item => chaveColaboradorManual(item) === chaveNova);
        const linhasAtualizadas = [...linhasAtuais];
        const acao = indiceExistente >= 0 ? "atualizado" : "incluído";

        if (indiceExistente >= 0) {
            linhasAtualizadas[indiceExistente] = {
                ...linhasAtualizadas[indiceExistente],
                ...linha
            };
        } else {
            linhasAtualizadas.push(linha);
        }

        dadosProducao.competencia = competencia;
        statusLancamentoManual("muted", "Carregando parâmetros e recalculando a competência...");

        if (typeof window.carregarHistoricoProducao === "function") {
            await window.carregarHistoricoProducao(competencia);
        }

        if (typeof window.carregarParametrosProducao === "function") {
            await window.carregarParametrosProducao(competencia);
        }

        processarProducao(linhasAtualizadas);
        atualizarDashboardProducao();

        if (typeof window.salvarProducaoNoFirebase === "function") {
            await window.salvarProducaoNoFirebase(linhasAtualizadas);
            await carregarPreCadastroDasBasesImportadas();
        } else {
            preencherListasLancamentoManual();
        }

        await registrarHistoricoImportador({
            tipo: "Lançamento manual",
            competencia,
            detalhe: `${linha.nome} / ${linha.celula}`,
            valorNovo: acao
        });
        statusLancamentoManual("success", `Lançamento manual ${acao} em ${competencia}. A competência foi recalculada e salva.`);
    } catch (erro) {
        console.error(erro);
        statusLancamentoManual("error", erro.message);
    }
}

function obterCompetenciaProducao() {
    const inputCompetencia = document.getElementById("competenciaProducao");

    if (inputCompetencia?.value) {
        return inputCompetencia.value;
    }

    throw new Error("Informe a competência da importação antes de enviar a planilha.");
}

function validarColunasObrigatorias(linhas) {
    if (!linhas.length) {
        return ["A planilha está vazia."];
    }

    const primeiraLinha = linhas[0];
    const colunasObrigatorias = Object.values(mapaColunas);

    return colunasObrigatorias.filter(coluna => {
        const chaveEsperada = normalizarChaveColuna(coluna);
        return !Object.keys(primeiraLinha)
            .some(chave => normalizarChaveColuna(chave) === chaveEsperada);
    });
}

function celulasSemRegra(dadosPadronizados) {
    return [...new Set(dadosPadronizados.map(linha => linha.celula || "Sem célula"))]
        .filter(celula => !obterKpisPrincipais(celula).length)
        .sort((a, b) => a.localeCompare(b));
}

function kpisReconhecidos(dadosPadronizados) {
    const kpis = new Set();

    dadosPadronizados.forEach(linha => {
        obterKpisPrincipais(linha.celula).forEach(kpi => kpis.add(kpi));
    });

    return [...kpis].sort((a, b) => (nomesKpis[a] || a).localeCompare(nomesKpis[b] || b));
}

function montarResumoValidacao({ competencia, nomeAba, dadosPadronizados, linhasSemEmail }) {
    const container = document.getElementById("preValidacaoImportacao");
    const celulas = [...new Set(dadosPadronizados.map(linha => linha.celula || "Sem célula"))]
        .sort((a, b) => a.localeCompare(b));
    const semRegra = celulasSemRegra(dadosPadronizados);
    const kpis = kpisReconhecidos(dadosPadronizados);
    const alertas = [
        linhasSemEmail ? `${formatarNumero(linhasSemEmail)} linha(s) sem e-mail. Nesses casos o histórico usa o nome como fallback.` : "",
        semRegra.length ? `Células sem regra de atividade: ${semRegra.join(", ")}.` : ""
    ].filter(Boolean);

    if (!container) {
        return;
    }

    container.hidden = false;
    container.innerHTML = `
        <div class="section-heading">
            <div>
                <h2>Pré-validação da importação</h2>
                <p>Confira os dados antes de salvar no Firebase.</p>
            </div>
            <button type="button" onclick="confirmarImportacaoProducao()">Confirmar e salvar</button>
        </div>
        <div class="import-validation-grid">
            <article><span>Competência</span><strong>${escaparHtml(competencia)}</strong></article>
            <article><span>Aba lida</span><strong>${escaparHtml(nomeAba)}</strong></article>
            <article><span>Colaboradores</span><strong>${formatarNumero(dadosPadronizados.length)}</strong></article>
            <article><span>Células</span><strong>${formatarNumero(celulas.length)}</strong></article>
            <article><span>Atividades reconhecidas</span><strong>${formatarNumero(kpis.length)}</strong></article>
            <article><span>Sem e-mail</span><strong>${formatarNumero(linhasSemEmail)}</strong></article>
        </div>
        <div class="import-validation-list">
            <h3>Células encontradas</h3>
            <p>${celulas.map(escaparHtml).join(", ") || "-"}</p>
        </div>
        <div class="import-validation-list">
            <h3>Atividades reconhecidas</h3>
            <p>${kpis.map(kpi => escaparHtml(nomesKpis[kpi] || kpi)).join(", ") || "-"}</p>
        </div>
        ${alertas.length ? `
            <div class="import-validation-alerts">
                <h3>Alertas</h3>
                ${alertas.map(alerta => `<p>${escaparHtml(alerta)}</p>`).join("")}
            </div>
        ` : `<div class="status-message success">Nenhum alerta encontrado na pré-validação.</div>`}
    `;
}

function importarProducao() {
    const input = document.getElementById("arquivoProducao");
    const resultado = document.getElementById("resultadoImportacao");
    const validacao = document.getElementById("preValidacaoImportacao");

    if (!input.files.length) {
        alert("Selecione uma planilha primeiro.");
        return;
    }

    importacaoPendente = null;

    if (validacao) {
        validacao.hidden = true;
        validacao.innerHTML = "";
    }

    const arquivo = input.files[0];
    const leitor = new FileReader();

    resultado.className = "status-message muted";
    resultado.textContent = "Lendo planilha...";

    leitor.onload = function(event) {
        try {
            const dados = new Uint8Array(event.target.result);
            const workbook = XLSX.read(dados, { type: "array" });
            const { nomeAba, planilha } = obterPlanilha(workbook);

            if (!planilha) {
                throw new Error("Nenhuma aba foi encontrada na planilha.");
            }

            const linhas = XLSX.utils.sheet_to_json(planilha, { defval: "" });
            const erros = validarColunasObrigatorias(linhas);

            if (erros.length) {
                throw new Error(`Colunas obrigatórias não encontradas: ${erros.join(", ")}`);
            }

            const dadosPadronizados = padronizarPlanilha(linhas);
            const competencia = obterCompetenciaProducao();
            const linhasSemEmail = dadosPadronizados
                .filter(funcionario => !String(funcionario.email || "").trim())
                .length;

            importacaoPendente = {
                competencia,
                nomeAba,
                dadosPadronizados,
                linhasSemEmail
            };

            montarResumoValidacao(importacaoPendente);

            resultado.className = "status-message success";
            resultado.textContent = "Planilha validada. Confira o resumo antes de confirmar o salvamento.";
        } catch (erro) {
            console.error(erro);
            resultado.className = "status-message error";
            resultado.textContent = erro.message;
        }
    };

    leitor.readAsArrayBuffer(arquivo);
}

async function confirmarImportacaoProducao() {
    const resultado = document.getElementById("resultadoImportacao");

    if (!importacaoPendente) {
        alert("Valide uma planilha antes de salvar.");
        return;
    }

    try {
        const { competencia, nomeAba, dadosPadronizados, linhasSemEmail } = importacaoPendente;
        dadosProducao.competencia = competencia;

        resultado.className = "status-message muted";
        resultado.textContent = "Carregando histórico para calcular metas...";

        if (typeof window.carregarHistoricoProducao === "function") {
            await window.carregarHistoricoProducao(competencia);
        }

        if (typeof window.carregarParametrosProducao === "function") {
            await window.carregarParametrosProducao(competencia);
        }

        processarProducao(dadosPadronizados);
        atualizarDashboardProducao();

        resultado.className = "status-message success";
        resultado.textContent = `Importação concluída pela aba "${nomeAba}". Salvando no Firebase...`;

        if (typeof window.salvarProducaoNoFirebase === "function") {
            await window.salvarProducaoNoFirebase(dadosPadronizados);
            await carregarPreCadastroDasBasesImportadas();
            await registrarHistoricoImportador({
                tipo: "Importação de produção",
                competencia,
                detalhe: `Aba ${nomeAba}`,
                valorNovo: `${formatarNumero(dadosPadronizados.length)} colaboradores`
            });
            preencherListasLancamentoManual();
            resultado.className = "status-message success";
            resultado.textContent = linhasSemEmail
                ? `Produção salva. Atenção: ${formatarNumero(linhasSemEmail)} linha(s) sem e-mail foram identificadas; nesses casos o histórico usa o nome como fallback.`
                : "Produção salva no Firebase com sucesso.";
        } else {
            resultado.textContent = `Importação concluída pela aba "${nomeAba}". ${formatarNumero(dadosProducao.dashboard.totalFuncionarios)} funcionários processados.`;
        }
    } catch (erro) {
        console.error(erro);
        resultado.className = "status-message error";
        resultado.textContent = erro.message;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    carregarPreCadastroDasBasesImportadas();
    window.addEventListener("producaoFirebasePronto", carregarPreCadastroDasBasesImportadas);

    const competenciaManual = campoManual("competencia");
    const competenciaImportacao = document.getElementById("competenciaProducao");
    const nomeManual = campoManual("nome");
    const celulaManual = campoManual("celula");
    const nomePreCadastro = document.getElementById("preColaboradorNome");

    if (competenciaManual && competenciaImportacao && !competenciaManual.value) {
        competenciaManual.value = competenciaImportacao.value || "";
    }

    competenciaImportacao?.addEventListener("change", () => {
        if (competenciaManual && !competenciaManual.value) {
            competenciaManual.value = competenciaImportacao.value;
        }
    });

    nomeManual?.addEventListener("change", sincronizarColaboradorManual);
    nomeManual?.addEventListener("blur", sincronizarColaboradorManual);
    celulaManual?.addEventListener("change", renderizarColaboradoresDaCelulaManual);
    celulaManual?.addEventListener("input", renderizarColaboradoresDaCelulaManual);
    nomePreCadastro?.addEventListener("change", sincronizarColaboradorPreCadastro);
    nomePreCadastro?.addEventListener("blur", sincronizarColaboradorPreCadastro);
});
