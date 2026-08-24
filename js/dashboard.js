let graficoEvolucaoProducao = null;
const timersComentariosProducao = new Map();

const nomesMesesCurtos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const coresGrafico = [
    "#003b71", "#ff7a00", "#168a4a", "#7c3aed", "#dc2626",
    "#0891b2", "#db2777", "#65a30d", "#ea580c", "#2563eb",
    "#9333ea", "#0f766e", "#be123c", "#4d7c0f"
];

function preencherTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function escaparHtml(valor) {
    return String(valor || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function slugFotoFuncionario(nome) {
    return String(nome || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\([^)]*\)/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function iniciaisFuncionario(nome) {
    const partes = String(nome || "")
        .replace(/\([^)]*\)/g, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!partes.length) {
        return "?";
    }

    return `${partes[0][0] || ""}${partes.length > 1 ? partes[partes.length - 1][0] : ""}`.toUpperCase();
}

function avatarFuncionario(funcionario, tamanho = "sm") {
    const nome = funcionario?.nome || funcionario?.email || "";
    const slugs = [
        slugFotoFuncionario(funcionario?.nome),
        slugFotoFuncionario(funcionario?.email)
    ].filter(Boolean);
    const slugsUnicos = [...new Set(slugs)];
    const iniciais = iniciaisFuncionario(nome);
    const caminhos = slugsUnicos.flatMap(slug => [
        `../../assets/funcionarios/${slug}.jpg`,
        `../../assets/funcionarios/${slug}.jpeg`,
        `../../assets/funcionarios/${slug}.png`,
        `../../assets/funcionarios/${slug}.png.png`
    ]);

    return `
        <span class="avatar avatar-${tamanho}">
            <img src="${caminhos[0]}" data-fallbacks='${JSON.stringify(caminhos.slice(1))}' alt="${escaparHtml(nome)}" onerror="trocarFotoFuncionario(this);">
            <b>${escaparHtml(iniciais)}</b>
        </span>
    `;
}

function trocarFotoFuncionario(img) {
    const fallbacks = JSON.parse(img.dataset.fallbacks || "[]");
    const proxima = fallbacks.shift();

    if (proxima) {
        img.dataset.fallbacks = JSON.stringify(fallbacks);
        img.src = proxima;
        return;
    }

    img.style.display = "none";
    img.nextElementSibling.style.display = "grid";
}

function configurarPreviewFotosAvatares() {
    if (window.previewFotosAvataresConfigurado) {
        return;
    }

    const preview = document.createElement("img");
    preview.className = "avatar-photo-preview";
    preview.alt = "Foto do colaborador";
    document.body.appendChild(preview);

    function moverPreview(event) {
        const largura = 190;
        const altura = 190;
        const margem = 16;
        let left = event.clientX + 18;
        let top = event.clientY - (altura / 2);

        if (left + largura + margem > window.innerWidth) {
            left = event.clientX - largura - 18;
        }

        top = Math.max(margem, Math.min(window.innerHeight - altura - margem, top));
        preview.style.left = `${left}px`;
        preview.style.top = `${top}px`;
    }

    document.addEventListener("mouseover", event => {
        const img = event.target.closest?.(".avatar img");

        if (!img || img.style.display === "none") {
            return;
        }

        preview.src = img.currentSrc || img.src;
        preview.alt = img.alt || "Foto do colaborador";
        moverPreview(event);
        preview.classList.add("show");
    });

    document.addEventListener("mousemove", event => {
        if (preview.classList.contains("show")) {
            moverPreview(event);
        }
    });

    document.addEventListener("mouseout", event => {
        if (event.target.closest?.(".avatar img")) {
            preview.classList.remove("show");
        }
    });

    window.previewFotosAvataresConfigurado = true;
}

function renderizarLinhaVazia(colunas, texto = "Aguardando importação.") {
    return `<tr><td colspan="${colunas}">${texto}</td></tr>`;
}

function criarCardIndicador(titulo, valor, destaque = false, unidade = "") {
    return `
        <article class="kpi-card ${destaque ? "kpi-card-highlight" : ""}">
            <span>${titulo}</span>
            <strong>${formatarNumero(valor)}${unidade ? ` ${unidade}` : ""}</strong>
        </article>
    `;
}

function criarCardsProducoes(totais) {
    return Object.keys(nomesKpis).map(kpi => {
        if (kpi === "sla") {
            const totalFuncionarios = Number(dadosProducao.dashboard.totalFuncionarios || 0);
            const mediaSla = totalFuncionarios ? (Number(totais.sla || 0) / totalFuncionarios) : 0;

            return criarCardIndicador("SLA médio", mediaSla, false, "horas");
        }

        return criarCardIndicador(nomesKpis[kpi], totais[kpi] || 0);
    });
}

function renderizarIndicadoresProducao() {
    const container = document.getElementById("cardsProducoes");

    if (!container) {
        return;
    }

    const totais = dadosProducao.dashboard.totaisKpis || {};
    const cards = [
        criarCardIndicador("Colaboradores / Estagiários", dadosProducao.dashboard.totalFuncionarios, true),
        criarCardIndicador("Células ativas", dadosProducao.dashboard.totalCelulas, true),
        ...criarCardsProducoes(totais)
    ];

    container.innerHTML = cards.join("");
}

function classeMeta(percentualMeta) {
    if (percentualMeta >= 100) {
        return "badge badge-success";
    }

    if (percentualMeta >= 80) {
        return "badge badge-warning";
    }

    return "badge badge-danger";
}

function nomeCurtoFuncionario(nome) {
    const partes = String(nome || "")
        .replace(/\([^)]*\)/g, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (partes.length <= 1) {
        return partes[0] || "Sem nome";
    }

    return `${partes[0]} ${partes[partes.length - 1]}`;
}

function calcularResumoMetas(metas) {
    const itens = Object.values(metas || {});
    const total = itens.reduce((soma, meta) => soma + Number(meta.total || 0), 0);
    const metaTotal = itens.reduce((soma, meta) => soma + Number(meta.meta || 0), 0);
    const mediaPercentual = itens.length
        ? Math.round(itens.reduce((soma, meta) => soma + Number(meta.percentual || 0), 0) / itens.length)
        : 0;

    return {
        total,
        metaTotal,
        percentualTotal: percentual(total, metaTotal),
        mediaPercentual
    };
}

function rotuloFonteMeta(meta) {
    if (meta.fonte === "metaManual") {
        return "Meta manual";
    }

    if (meta.fonte === "pisoEstatistico") {
        return "Piso estatistico";
    }

    if (meta.fonte === "referenciaKpiGeral") {
        return "Referencia geral da atividade";
    }

    if (Number(meta.percentualAcrescimo || 10) !== 10) {
        return `${formatarNumero(meta.percentualAcrescimo)}% configurado`;
    }

    return meta.fonte === "historico5Meses" ? "Historico 5 meses" : "Previa da competencia";
}

function renderizarMetasPorCelula() {
    const container = document.getElementById("cardsMetasCelulas");

    if (!container) {
        return;
    }

    const celulas = Object.keys(dadosProducao.metas);

    if (!celulas.length) {
        container.innerHTML = `<div class="empty-state">Aguardando importação.</div>`;
        return;
    }

    const cardsCelulas = celulas.map(celula => {
        const metas = dadosProducao.metas[celula];
        const resumoCelula = calcularResumoMetas(metas);
        const linhas = Object.keys(metas).map(kpi => {
            const meta = metas[kpi];

            return `
                <div class="meta-row">
                    <div>
                        <strong>${nomesKpis[kpi] || kpi}</strong>
                        <span>${rotuloFonteMeta(meta)}</span>
                    </div>
                    <div class="meta-numbers">
                        <span>${formatarNumero(meta.total)} / ${formatarNumero(meta.meta)}</span>
                        <b class="${classeMeta(meta.percentual)}">${formatarNumero(meta.percentual)}%</b>
                    </div>
                </div>
            `;
        }).join("");

        return `
            <article class="meta-cell-card">
                <header>
                    <h3>${celula}</h3>
                    <span>${Object.keys(metas).length} atividades</span>
                </header>
                <div class="meta-list">${linhas}</div>
                <footer class="meta-total-row">
                    <span>Media total celula</span>
                    <b class="${classeMeta(resumoCelula.mediaPercentual)}">${formatarNumero(resumoCelula.mediaPercentual)}%</b>
                </footer>
            </article>
        `;
    }).join("");

    container.innerHTML = cardsCelulas;
}

function renderizarRankingGeral() {
    const tabela = document.getElementById("tabelaRankingGeral");

    if (!tabela) {
        return;
    }

    const linhas = dadosProducao.rankings.geral.map(funcionario => `
        <tr>
            <td class="rank-position">${funcionario.rankingGeral}</td>
            <td class="rank-person">
                <div class="person-with-avatar">
                    ${avatarFuncionario(funcionario)}
                    <div>
                        <strong title="${escaparHtml(funcionario.nome)}">${escaparHtml(nomeCurtoFuncionario(funcionario.nome))}</strong>
                        <span>${funcionario.jornada.horas} horas</span>
                    </div>
                </div>
            </td>
            <td><span class="${classeMeta(funcionario.percentualGeral)}">${formatarNumero(funcionario.percentualGeral)}%</span></td>
            <td>${escaparHtml(funcionario.celula)}</td>
            <td>${formatarNumero(funcionario.totalPrincipal)}</td>
        </tr>
    `);

    tabela.innerHTML = linhas.length ? linhas.join("") : renderizarLinhaVazia(5);
}

function calcularRankingDestaquesKpi() {
    return (dadosProducao.funcionarios || [])
        .map(funcionario => {
            const melhor = Object.keys(funcionario.principais || {})
                .map(kpi => ({
                    kpi,
                    valor: Number(funcionario.principais[kpi] || 0),
                    meta: Number(funcionario.metas?.[kpi] || 0),
                    percentual: percentual(funcionario.principais[kpi], funcionario.metas?.[kpi])
                }))
                .filter(item => item.meta > 0 && item.valor > 0)
                .sort((a, b) => b.percentual - a.percentual || b.valor - a.valor)[0];

            if (!melhor) {
                return null;
            }

            return {
                funcionario,
                ...melhor
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.percentual - a.percentual || b.valor - a.valor)
        .slice(0, 10);
}

function renderizarRankingDestaquesKpi() {
    const tabela = document.getElementById("tabelaRankingKpiDestaque");

    if (!tabela) {
        return;
    }

    const linhas = calcularRankingDestaquesKpi().map((item, indice) => `
        <tr>
            <td class="rank-position">${indice + 1}</td>
            <td class="rank-person">
                <div class="person-with-avatar">
                    ${avatarFuncionario(item.funcionario)}
                    <div>
                        <strong title="${escaparHtml(item.funcionario.nome)}">${escaparHtml(nomeCurtoFuncionario(item.funcionario.nome))}</strong>
                        <span>${escaparHtml(item.funcionario.celula)}</span>
                    </div>
                </div>
            </td>
            <td>
                <strong>${nomesKpis[item.kpi] || item.kpi}</strong>
                <span>${formatarNumero(item.valor)} / ${formatarNumero(item.meta)}</span>
            </td>
            <td><span class="${classeMeta(item.percentual)}">${formatarNumero(item.percentual)}%</span></td>
        </tr>
    `);

    tabela.innerHTML = linhas.length ? linhas.join("") : renderizarLinhaVazia(4);
}

function obterDetalheKpisFuncionario(funcionario) {
    return Object.keys(funcionario.principais).map(kpi => {
        const valor = funcionario.principais[kpi];
        const meta = funcionario.metas[kpi] || 0;
        const desempenho = funcionario.desempenho[kpi] || 0;

        return `
            <span class="person-kpi-chip ${classeMeta(desempenho)}">
                ${nomesKpis[kpi] || kpi}: ${formatarNumero(valor)} / ${formatarNumero(meta)}
                <b>${formatarNumero(desempenho)}%</b>
            </span>
        `;
    }).join("");
}

function slaFuncionario(funcionario) {
    return Number(funcionario?.principais?.sla ?? funcionario?.extras?.sla ?? funcionario?.sla ?? 0);
}

function classeSlaFuncionario(sla) {
    if (sla <= 24) {
        return "badge-success";
    }

    if (sla <= 48) {
        return "badge-warning";
    }

    return "badge-danger";
}

function indicadorSlaFuncionario(funcionario) {
    const sla = slaFuncionario(funcionario);

    if (!sla) {
        return `<span class="person-sla-chip badge-neutral">SLA não informado</span>`;
    }

    return `<span class="person-sla-chip ${classeSlaFuncionario(sla)}">SLA médio <b>${formatarNumero(sla)}h</b></span>`;
}

function comentarioFuncionario(funcionario) {
    return dadosProducao.comentarios?.[valorFuncionario(funcionario)] || "";
}

function avaliacaoMetaFuncionario(funcionario) {
    const padrao = {
        semanasAtivas: 4,
        motivo: "",
        observacao: "",
        avaliado: true,
        fatorMeta: 1
    };

    return {
        ...padrao,
        ...(funcionario.avaliacaoMeta || dadosProducao.avaliacoesMeta?.[valorFuncionario(funcionario)] || {})
    };
}

function funcionarioAvaliadoMeta(funcionario) {
    const avaliacao = avaliacaoMetaFuncionario(funcionario);

    return avaliacao.avaliado !== false && Number(avaliacao.semanasAtivas) > 0;
}

function opcoesSemanasMeta(semanasAtivas) {
    const opcoes = [
        [4, "4 semanas - 100%"],
        [3, "3 semanas - 75%"],
        [2, "2 semanas - 50%"],
        [1, "1 semana - 25%"],
        [0, "0 semanas - fora da meta"]
    ];

    return opcoes.map(([valor, label]) => `
        <option value="${valor}" ${Number(semanasAtivas) === valor ? "selected" : ""}>${label}</option>
    `).join("");
}

function opcoesMotivoMeta(motivoAtual) {
    const motivos = ["", "Férias", "Licença médica", "Treinamento", "Apoio em outra demanda", "Outro"];

    return motivos.map(motivo => `
        <option value="${escaparHtml(motivo)}" ${motivoAtual === motivo ? "selected" : ""}>${motivo || "Motivo"}</option>
    `).join("");
}

function agruparFuncionariosPorCelula() {
    return (dadosProducao.funcionarios || []).reduce((grupo, funcionario) => {
        const celula = funcionario.celula || "Sem célula";

        if (!grupo[celula]) {
            grupo[celula] = [];
        }

        grupo[celula].push(funcionario);
        return grupo;
    }, {});
}

function obterPrioridadesPessoas() {
    const celulas = valoresSelecionados(document.getElementById("priorizarCelulaPessoas"));
    const funcionarios = valoresSelecionados(document.getElementById("priorizarFuncionarioPessoas"));

    return {
        celulas: new Set(celulas),
        funcionarios: new Set(funcionarios)
    };
}

function ordenarCelulasPorPrioridade(celulas, prioridades) {
    const celulaPorFuncionario = new Map();

    Object.entries(agruparFuncionariosPorCelula()).forEach(([celula, lista]) => {
        lista.forEach(funcionario => {
            celulaPorFuncionario.set(valorFuncionario(funcionario), celula);
        });
    });

    return [...celulas].sort((a, b) => {
        const prioridadeA = prioridades.celulas.has(a)
            || [...prioridades.funcionarios].some(id => celulaPorFuncionario.get(id) === a);
        const prioridadeB = prioridades.celulas.has(b)
            || [...prioridades.funcionarios].some(id => celulaPorFuncionario.get(id) === b);

        if (prioridadeA !== prioridadeB) {
            return prioridadeA ? -1 : 1;
        }

        return a.localeCompare(b, "pt-BR");
    });
}

function ordenarFuncionariosPorPrioridade(funcionarios, prioridades) {
    return [...funcionarios].sort((a, b) => {
        const prioridadeA = prioridades.funcionarios.has(valorFuncionario(a));
        const prioridadeB = prioridades.funcionarios.has(valorFuncionario(b));

        if (prioridadeA !== prioridadeB) {
            return prioridadeA ? -1 : 1;
        }

        const avaliacaoA = avaliacaoMetaFuncionario(a);
        const avaliacaoB = avaliacaoMetaFuncionario(b);

        if (avaliacaoA.avaliado !== avaliacaoB.avaliado) {
            return avaliacaoA.avaliado ? -1 : 1;
        }

        return Number(b.percentualGeral || 0) - Number(a.percentualGeral || 0);
    });
}

function renderizarAnalisePessoasPorCelula() {
    const container = document.getElementById("analisePessoasCelula");

    if (!container) {
        return;
    }

    const prioridades = obterPrioridadesPessoas();
    const funcionariosPorCelula = agruparFuncionariosPorCelula();
    const celulas = ordenarCelulasPorPrioridade(Object.keys(funcionariosPorCelula), prioridades);

    if (!celulas.length) {
        container.innerHTML = `<div class="empty-state">Aguardando importação.</div>`;
        return;
    }

    container.innerHTML = celulas.map(celula => {
        const resumoMetasCelula = calcularResumoMetas(dadosProducao.metas?.[celula]);
        const percentualCelula = resumoMetasCelula.mediaPercentual;
        const funcionariosOrdenados = ordenarFuncionariosPorPrioridade(funcionariosPorCelula[celula], prioridades);
        const celulaPriorizada = prioridades.celulas.has(celula)
            || funcionariosOrdenados.some(funcionario => prioridades.funcionarios.has(valorFuncionario(funcionario)));
        const funcionarios = funcionariosOrdenados
            .map(funcionario => {
                const avaliacao = avaliacaoMetaFuncionario(funcionario);
                const funcionarioId = valorFuncionario(funcionario);
                const foraMeta = avaliacao.avaliado === false || Number(avaliacao.semanasAtivas) === 0;

                return `
                <tr class="${prioridades.funcionarios.has(funcionarioId) ? "person-row-priority" : ""} ${foraMeta ? "person-row-out-meta" : ""}">
                    <td>
                        <div class="person-with-avatar">
                            ${avatarFuncionario(funcionario)}
                            <div>
                                <strong>${escaparHtml(funcionario.nome)}</strong>
                                <span class="muted-line">${escaparHtml(funcionario.email || "-")}</span>
                                ${indicadorSlaFuncionario(funcionario)}
                                <div class="person-meta-control">
                                    <label>
                                        <span>Participação na competência</span>
                                        <select class="person-meta-weeks" data-funcionario-id="${escaparHtml(funcionarioId)}">${opcoesSemanasMeta(avaliacao.semanasAtivas)}</select>
                                    </label>
                                    <label>
                                        <span>Motivo</span>
                                        <select class="person-meta-reason" data-funcionario-id="${escaparHtml(funcionarioId)}">${opcoesMotivoMeta(avaliacao.motivo)}</select>
                                    </label>
                                </div>
                                <textarea class="person-comment-input person-meta-note" data-funcionario-id="${escaparHtml(funcionarioId)}" placeholder="Comentário do mês...">${escaparHtml(comentarioFuncionario(funcionario) || avaliacao.observacao || "")}</textarea>
                            </div>
                        </div>
                    </td>
                    <td>${funcionario.jornada.tipo}</td>
                    <td>${funcionario.jornada.horas} horas</td>
                    <td>${formatarNumero(funcionario.totalPrincipal)}</td>
                    <td>${formatarNumero(funcionario.metaTotal)}</td>
                    <td><span class="${classeMeta(funcionario.percentualGeral)}">${formatarNumero(funcionario.percentualGeral)}%</span></td>
                    <td><div class="person-kpi-list">${obterDetalheKpisFuncionario(funcionario)}</div></td>
                </tr>
            `;
            }).join("");

        return `
            <article class="people-cell-card ${celulaPriorizada ? "people-cell-priority" : ""}">
                <header>
                    <div>
                        <h3>${escaparHtml(celula)}</h3>
                        <span>${funcionariosPorCelula[celula].length} pessoas</span>
                    </div>
                    <span class="cell-total-percent ${classeMeta(percentualCelula)}">${formatarNumero(percentualCelula)}%</span>
                </header>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Funcionário</th>
                                <th>Regra</th>
                                <th>Carga horária</th>
                                <th>Produção</th>
                                <th>Meta individual</th>
                                <th>% Meta</th>
                                <th>Atividades da célula</th>
                            </tr>
                        </thead>
                        <tbody>${funcionarios}</tbody>
                    </table>
                </div>
            </article>
        `;
    }).join("");
}

function valoresSelecionados(select) {
    if (!select) {
        return [];
    }

    if (select.classList?.contains("multi-filter")) {
        return JSON.parse(select.dataset.selected || "[]");
    }

    return [...select.selectedOptions].map(option => option.value).filter(Boolean);
}

function resumoSelecao(selecionados, vazio) {
    if (!selecionados.length) {
        return vazio;
    }

    if (selecionados.length === 1) {
        return selecionados[0];
    }

    return `${selecionados.length} selecionados`;
}

function rotuloFuncionario(funcionario) {
    return funcionario?.nome || funcionario?.email || "Sem nome";
}

function valorFuncionario(funcionario) {
    return funcionario?.id || chaveFuncionario(funcionario);
}

function aplicarOpcoesMultiplas(controle, opcoes, selecionados, vazio) {
    const valoresOpcoes = opcoes.map(opcao => typeof opcao === "string" ? opcao : opcao.valor);
    const selecionadosValidos = new Set(selecionados.filter(valor => valoresOpcoes.includes(valor)));
    const botao = controle.querySelector(".multi-filter-button");
    const menu = controle.querySelector(".multi-filter-menu");

    controle.dataset.selected = JSON.stringify([...selecionadosValidos]);

    if (botao) {
        const labelsSelecionados = opcoes
            .map(opcao => ({
                valor: typeof opcao === "string" ? opcao : opcao.valor,
                label: typeof opcao === "string" ? opcao : opcao.label
            }))
            .filter(opcao => selecionadosValidos.has(opcao.valor))
            .map(opcao => opcao.label);

        botao.textContent = resumoSelecao(labelsSelecionados, vazio);
    }

    if (!menu) {
        return;
    }

    menu.innerHTML = opcoes.length
        ? opcoes.map(opcao => {
            const valor = typeof opcao === "string" ? opcao : opcao.valor;
            const label = typeof opcao === "string" ? opcao : opcao.label;

            return `
            <label class="multi-filter-option">
                <input type="checkbox" value="${escaparHtml(valor)}" ${selecionadosValidos.has(valor) ? "checked" : ""}>
                <span>${escaparHtml(label)}</span>
            </label>
        `;
        }).join("")
        : `<div class="multi-filter-empty">Nenhuma opção disponível</div>`;
}

function atualizarFiltrosEvolucao() {
    const filtroCelula = document.getElementById("filtroCelulaProducao");
    const filtroFuncionario = document.getElementById("filtroFuncionarioProducao");

    if (!filtroCelula || !filtroFuncionario) {
        return;
    }

    const celulasSelecionadas = valoresSelecionados(filtroCelula);
    const funcionariosSelecionados = valoresSelecionados(filtroFuncionario);
    const celulas = [...new Set(dadosProducao.funcionarios.map(funcionario => funcionario.celula))]
        .sort((a, b) => a.localeCompare(b));
    const funcionariosBase = dadosProducao.funcionarios
        .filter(funcionario => !celulasSelecionadas.length || celulasSelecionadas.includes(funcionario.celula))
        .map(funcionario => ({
            valor: valorFuncionario(funcionario),
            label: rotuloFuncionario(funcionario)
        }))
        .filter((funcionario, indice, lista) => lista.findIndex(item => item.valor === funcionario.valor) === indice)
        .sort((a, b) => a.label.localeCompare(b.label));

    aplicarOpcoesMultiplas(filtroCelula, celulas, celulasSelecionadas, "Todas");
    aplicarOpcoesMultiplas(filtroFuncionario, funcionariosBase, funcionariosSelecionados, "Todos");
}

function atualizarFiltrosPrioridadePessoas() {
    const filtroCelula = document.getElementById("priorizarCelulaPessoas");
    const filtroFuncionario = document.getElementById("priorizarFuncionarioPessoas");

    if (!filtroCelula || !filtroFuncionario) {
        return;
    }

    const celulasSelecionadas = valoresSelecionados(filtroCelula);
    const funcionariosSelecionados = valoresSelecionados(filtroFuncionario);
    const celulas = [...new Set(dadosProducao.funcionarios.map(funcionario => funcionario.celula))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
    const funcionarios = dadosProducao.funcionarios
        .map(funcionario => ({
            valor: valorFuncionario(funcionario),
            label: rotuloFuncionario(funcionario)
        }))
        .filter((funcionario, indice, lista) => lista.findIndex(item => item.valor === funcionario.valor) === indice)
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

    aplicarOpcoesMultiplas(filtroCelula, celulas, celulasSelecionadas, "Todas");
    aplicarOpcoesMultiplas(filtroFuncionario, funcionarios, funcionariosSelecionados, "Todos");
}

function anoBaseEvolucao() {
    const competencia = dadosProducao.competencia || new Date().toISOString().slice(0, 7);
    const ano = Number(String(competencia).slice(0, 4));
    return Number.isFinite(ano) ? ano : new Date().getFullYear();
}

function competenciaBaseEvolucao() {
    return dadosProducao.competencia || `${anoBaseEvolucao()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

function competenciasDesdeJaneiro() {
    const competencia = competenciaBaseEvolucao();
    const ano = Number(competencia.slice(0, 4));
    const mesFinal = Math.max(1, Number(competencia.slice(5, 7)) || 1);

    return Array.from({ length: mesFinal }, (_, indice) => {
        const mes = indice + 1;
        return `${ano}-${String(mes).padStart(2, "0")}`;
    });
}

function labelCompetencia(competencia) {
    const mes = Number(String(competencia).slice(5, 7));
    const ano = String(competencia).slice(0, 4);

    return `${nomesMesesCurtos[mes - 1] || competencia}/${ano}`;
}

function agruparHistoricoPorCompetencia() {
    const mapa = new Map();

    (dadosProducao.historico || []).forEach(linha => {
        const competencia = linha.competencia;

        if (!competencia) {
            return;
        }

        if (!mapa.has(competencia)) {
            mapa.set(competencia, []);
        }

        mapa.get(competencia).push(linha);
    });

    mapa.set(competenciaBaseEvolucao(), dadosProducao.funcionarios.filter(funcionarioAvaliadoMeta));
    return mapa;
}

function processarLinhasParaEvolucao(linhas, competencia) {
    if (!linhas.length) {
        return [];
    }

    const jaProcessado = linhas.every(linha => linha.principais && linha.metas && linha.jornada);

    if (jaProcessado) {
        return linhas;
    }

    const funcionarios = linhas
        .filter(funcionario => funcionario.nome || funcionario.email)
        .map(funcionario => processarFuncionario(funcionario, { ignorarAvaliacaoMeta: true }));
    const metas = calcularMetasPorCelula(funcionarios, dadosProducao.historico, competencia);

    return aplicarMetasEDesempenho(funcionarios, metas);
}

function percentualDaLista(funcionarios) {
    const totalProducao = funcionarios.reduce((total, funcionario) => total + Number(funcionario.totalPrincipal || 0), 0);
    const totalMeta = funcionarios.reduce((total, funcionario) => total + Number(funcionario.metaTotal || 0), 0);

    return percentual(totalProducao, totalMeta);
}

function funcionariosParaGrafico(celulasSelecionadas, funcionariosSelecionados) {
    if (funcionariosSelecionados.length) {
        return funcionariosSelecionados;
    }

    if (celulasSelecionadas.length) {
        return dadosProducao.funcionarios
            .filter(funcionario => celulasSelecionadas.includes(funcionario.celula))
            .map(valorFuncionario)
            .filter((id, indice, lista) => lista.indexOf(id) === indice)
            .sort((a, b) => {
                const nomeA = rotuloFuncionario(dadosProducao.funcionarios.find(funcionario => valorFuncionario(funcionario) === a));
                const nomeB = rotuloFuncionario(dadosProducao.funcionarios.find(funcionario => valorFuncionario(funcionario) === b));
                return nomeA.localeCompare(nomeB);
            });
    }

    return [];
}

function valoresEvolucaoPorFiltro(idFuncionario, celulasSelecionadas, porCompetencia) {
    return competenciasDesdeJaneiro().map(competencia => {
        const linhas = porCompetencia.get(competencia) || [];
        const funcionarios = processarLinhasParaEvolucao(linhas, competencia)
            .filter(funcionario => !celulasSelecionadas.length || celulasSelecionadas.includes(funcionario.celula))
            .filter(funcionario => !idFuncionario || valorFuncionario(funcionario) === idFuncionario);

        return funcionarios.length ? percentualDaLista(funcionarios) : 0;
    });
}

function nomeFuncionarioPorId(idFuncionario, porCompetencia) {
    const atual = dadosProducao.funcionarios.find(funcionario => valorFuncionario(funcionario) === idFuncionario);

    if (atual) {
        return rotuloFuncionario(atual);
    }

    for (const linhas of porCompetencia.values()) {
        const funcionario = processarLinhasParaEvolucao(linhas, "").find(item => valorFuncionario(item) === idFuncionario);

        if (funcionario) {
            return rotuloFuncionario(funcionario);
        }
    }

    return idFuncionario;
}

function montarDatasetsEvolucao() {
    const celulasSelecionadas = valoresSelecionados(document.getElementById("filtroCelulaProducao"));
    const funcionariosSelecionados = valoresSelecionados(document.getElementById("filtroFuncionarioProducao"));
    const porCompetencia = agruparHistoricoPorCompetencia();
    const funcionariosGrafico = funcionariosParaGrafico(celulasSelecionadas, funcionariosSelecionados);

    if (!funcionariosGrafico.length) {
        return [{
            label: "Equipe geral - % da meta",
            data: valoresEvolucaoPorFiltro("", [], porCompetencia),
            borderColor: coresGrafico[0],
            backgroundColor: `${coresGrafico[0]}22`,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: .28,
            fill: true
        }];
    }

    return funcionariosGrafico.map((idFuncionario, indice) => {
        const cor = coresGrafico[indice % coresGrafico.length];

        return {
            label: nomeFuncionarioPorId(idFuncionario, porCompetencia),
            data: valoresEvolucaoPorFiltro(idFuncionario, celulasSelecionadas, porCompetencia),
            borderColor: cor,
            backgroundColor: `${cor}1F`,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: .28,
            fill: false
        };
    });
}

function deveMostrarRotulo(contexto) {
    const datasets = contexto.chart.data.datasets;
    const valor = contexto.dataset.data[contexto.dataIndex];

    if (!valor) {
        return false;
    }

    if (datasets.length <= 2) {
        return true;
    }

    return contexto.dataIndex === contexto.dataset.data.length - 1;
}

function renderizarGraficoEvolucao() {
    const canvas = document.getElementById("graficoEvolucaoProducao");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    if (typeof ChartDataLabels !== "undefined") {
        Chart.register(ChartDataLabels);
    }

    const contexto = canvas.getContext("2d");

    if (graficoEvolucaoProducao) {
        graficoEvolucaoProducao.destroy();
    }

    graficoEvolucaoProducao = new Chart(contexto, {
        type: "line",
        data: {
            labels: competenciasDesdeJaneiro().map(labelCompetencia),
            datasets: montarDatasetsEvolucao()
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "nearest",
                intersect: false
            },
            layout: {
                padding: {
                    top: 28,
                    right: 28,
                    bottom: 8,
                    left: 8
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: "bottom",
                    labels: {
                        boxWidth: 12,
                        color: "#102033",
                        font: { weight: "bold" }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: contexto => `${contexto.dataset.label}: ${formatarNumero(contexto.parsed.y)}%`
                    }
                },
                datalabels: {
                    display: deveMostrarRotulo,
                    formatter: valor => `${formatarNumero(valor)}%`,
                    align: contexto => contexto.datasetIndex % 2 === 0 ? "top" : "bottom",
                    anchor: "end",
                    offset: contexto => 6 + (contexto.datasetIndex % 4) * 4,
                    clamp: true,
                    clip: false,
                    borderRadius: 5,
                    padding: {
                        top: 3,
                        right: 5,
                        bottom: 3,
                        left: 5
                    },
                    color: "#fff",
                    backgroundColor: contexto => contexto.dataset.borderColor,
                    font: {
                        size: 10,
                        weight: "bold"
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: valor => `${formatarNumero(valor)}%`
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function limitarValor(valor, minimo, maximo) {
    return Math.min(maximo, Math.max(minimo, valor));
}

function obterDiagnosticoCapacidade(ocupacao, percentualAcimaFaixa = 0) {
    if (ocupacao >= 100 || percentualAcimaFaixa >= 50) {
        return {
            classe: "capacity-danger",
            titulo: "Saturação operacional",
            texto: "A equipe está acima da capacidade sustentável. Novas demandas devem ser redistribuídas ou acompanhadas com prioridade."
        };
    }

    if (ocupacao >= 90) {
        return {
            classe: "capacity-danger",
            titulo: "Pressão alta",
            texto: "A equipe está próxima do limite sustentável. Novas demandas devem ser direcionadas com cautela, priorizando células e colaboradores com maior folga operacional."
        };
    }

    if (ocupacao >= 75 || percentualAcimaFaixa >= 35) {
        return {
            classe: "capacity-warning",
            titulo: "Pressão moderada",
            texto: "A equipe está em uma faixa moderada: ainda há controle, mas novas demandas devem ser distribuídas com atenção."
        };
    }

    return {
        classe: "capacity-good",
        titulo: "Pressão baixa",
        texto: "A equipe está abaixo da faixa sustentável estimada."
    };
}

function calcularForcaTrabalho() {
    const funcionarios = dadosProducao.funcionarios || [];
    const totalProducao = funcionarios.reduce((total, funcionario) => total + Number(funcionario.totalPrincipal || 0), 0);
    const totalMeta = funcionarios.reduce((total, funcionario) => total + Number(funcionario.metaTotal || 0), 0);
    const ocupacao = percentual(totalProducao, totalMeta);
    const capacidadeRestante = Math.max(0, totalMeta - totalProducao);
    const capacidadePercentual = Math.max(0, 100 - ocupacao);
    const porCelula = Object.entries(dadosProducao.rankings.celulas || {}).map(([celula, lista]) => {
        const producao = lista.reduce((total, funcionario) => total + Number(funcionario.totalPrincipal || 0), 0);
        const meta = lista.reduce((total, funcionario) => total + Number(funcionario.metaTotal || 0), 0);

        return {
            celula,
            producao,
            meta,
            ocupacao: percentual(producao, meta),
            capacidadeRestante: Math.max(0, meta - producao)
        };
    }).sort((a, b) => a.ocupacao - b.ocupacao);

    return {
        totalProducao,
        totalMeta,
        ocupacao,
        capacidadeRestante,
        capacidadePercentual,
        porCelula
    };
}

function renderizarForcaTrabalho() {
    const container = document.getElementById("forcaTrabalho");

    if (!container) {
        return;
    }

    if (!dadosProducao.funcionarios.length) {
        container.innerHTML = `<div class="empty-state">Aguardando importação.</div>`;
        return;
    }

    const capacidade = calcularForcaTrabalho();
    const diagnostico = obterDiagnosticoCapacidade(capacidade.ocupacao);
    const angulo = limitarValor((capacidade.ocupacao / 100) * 180, 0, 180);
    const celulas = capacidade.porCelula.map(celula => `
        <div class="capacity-cell-row">
            <div>
                <strong>${escaparHtml(celula.celula)}</strong>
                <span>${formatarNumero(celula.capacidadeRestante)} pontos livres</span>
            </div>
            <div class="capacity-cell-meter" style="--cell-fill:${limitarValor(celula.ocupacao, 0, 100)}%">
                <span></span>
            </div>
            <b>${formatarNumero(celula.ocupacao)}%</b>
        </div>
    `).join("");

    container.innerHTML = `
        <article class="capacity-gauge-card ${diagnostico.classe}">
            <div class="capacity-gauge" style="--gauge-angle:${angulo}deg">
                <div class="capacity-gauge-face"></div>
                <div class="capacity-gauge-arc"></div>
                <div class="capacity-gauge-ticks" aria-hidden="true">
                    <span class="tick tick-0">0</span>
                    <span class="tick tick-60">60</span>
                    <span class="tick tick-90">90</span>
                    <span class="tick tick-120">120</span>
                </div>
                <div class="capacity-gauge-needle"></div>
                <div class="capacity-gauge-center"></div>
            </div>
            <div class="capacity-gauge-value">
                <strong>${formatarNumero(capacidade.ocupacao)}%</strong>
                <span>ocupação da equipe</span>
            </div>
        </article>

        <article class="capacity-summary-card">
            <span class="capacity-status ${diagnostico.classe}">${diagnostico.titulo}</span>
            <h3>${diagnostico.texto}</h3>
            <div class="capacity-summary-grid">
                <div>
                    <span>Produção atual</span>
                    <strong>${formatarNumero(capacidade.totalProducao)}</strong>
                </div>
                <div>
                    <span>Capacidade planejada</span>
                    <strong>${formatarNumero(capacidade.totalMeta)}</strong>
                </div>
                <div>
                    <span>Folga estimada</span>
                    <strong>${formatarNumero(capacidade.capacidadeRestante)}</strong>
                </div>
                <div>
                    <span>Margem</span>
                    <strong>${formatarNumero(capacidade.capacidadePercentual)}%</strong>
                </div>
            </div>
            <p>Use a folga estimada como referência inicial. A decisão final ainda deve considerar complexidade dos casos, prazos e células específicas.</p>
        </article>

        <article class="capacity-cells-card">
            <h3>Folga por célula</h3>
            <div class="capacity-cell-list">
                ${celulas || `<div class="empty-state">Sem células para comparar.</div>`}
            </div>
        </article>
    `;
}

function obterDiagnosticoCapacidade(ocupacao, percentualAcimaFaixa = 0) {
    if (ocupacao >= 100 || percentualAcimaFaixa >= 50) {
        return {
            classe: "capacity-danger",
            titulo: "Saturação operacional",
            texto: "A equipe está acima da capacidade sustentável. Novas demandas devem ser redistribuídas ou acompanhadas com prioridade."
        };
    }

    if (ocupacao >= 90) {
        return {
            classe: "capacity-danger",
            titulo: "Pressão alta",
            texto: "A equipe está próxima do limite sustentável. Novas demandas devem ser direcionadas com cautela, priorizando células e colaboradores com maior folga operacional."
        };
    }

    if (ocupacao >= 75 || percentualAcimaFaixa >= 35) {
        return {
            classe: "capacity-warning",
            titulo: "Pressão moderada",
            texto: "A equipe está em uma faixa moderada: ainda há controle, mas novas demandas devem ser distribuídas com atenção."
        };
    }

    return {
        classe: "capacity-good",
        titulo: "Pressão baixa",
        texto: "A equipe está abaixo da faixa sustentável estimada."
    };
}

function fatorJornadaFuncionario(funcionario) {
    const fatorJornada = Number(funcionario?.jornada?.fatorMeta || 1);
    const fatorParticipacao = Number(funcionario?.avaliacaoMeta?.fatorMeta ?? 1);
    const fator = fatorJornada * fatorParticipacao;

    return fator > 0 ? fator : 0;
}

function calcularTetoProdutivo(funcionarios) {
    const validos = funcionarios.filter(funcionario => Number(funcionario.totalPrincipal || 0) > 0);
    const totalFte = funcionarios.reduce((total, funcionario) => total + fatorJornadaFuncionario(funcionario), 0);
    const producoesEquivalentes8h = validos
        .map(funcionario => Number(funcionario.totalPrincipal || 0) / fatorJornadaFuncionario(funcionario))
        .sort((a, b) => b - a);

    if (!producoesEquivalentes8h.length || !totalFte) {
        return {
            teto: 0,
            benchmark8h: 0,
            pessoasReferencia: 0
        };
    }

    const pessoasReferencia = Math.max(1, Math.ceil(producoesEquivalentes8h.length * .25));
    const topQuartil = producoesEquivalentes8h.slice(0, pessoasReferencia);
    const benchmark8h = topQuartil.reduce((total, valor) => total + valor, 0) / topQuartil.length;

    return {
        teto: Math.round(benchmark8h * totalFte),
        benchmark8h,
        pessoasReferencia
    };
}

function calcularForcaTrabalho() {
    const funcionarios = dadosProducao.funcionarios || [];
    const totalProducao = funcionarios.reduce((total, funcionario) => total + Number(funcionario.totalPrincipal || 0), 0);
    const tetoGeral = calcularTetoProdutivo(funcionarios);
    const ocupacao = percentual(totalProducao, tetoGeral.teto);
    const capacidadeRestante = Math.max(0, tetoGeral.teto - totalProducao);
    const capacidadePercentual = Math.max(0, 100 - ocupacao);
    const porCelula = Object.entries(dadosProducao.rankings.celulas || {}).map(([celula, lista]) => {
        const producao = lista.reduce((total, funcionario) => total + Number(funcionario.totalPrincipal || 0), 0);
        const tetoCelula = calcularTetoProdutivo(lista);

        return {
            celula,
            producao,
            teto: tetoCelula.teto,
            ocupacao: percentual(producao, tetoCelula.teto),
            capacidadeRestante: Math.max(0, tetoCelula.teto - producao)
        };
    }).sort((a, b) => a.ocupacao - b.ocupacao);

    return {
        totalProducao,
        tetoProdutivo: tetoGeral.teto,
        benchmark8h: tetoGeral.benchmark8h,
        pessoasReferencia: tetoGeral.pessoasReferencia,
        ocupacao,
        capacidadeRestante,
        capacidadePercentual,
        porCelula
    };
}

function renderizarForcaTrabalho() {
    const container = document.getElementById("forcaTrabalho");

    if (!container) {
        return;
    }

    if (!dadosProducao.funcionarios.length) {
        container.innerHTML = `<div class="empty-state">Aguardando importação.</div>`;
        return;
    }

    const capacidade = calcularForcaTrabalho();
    const diagnostico = obterDiagnosticoCapacidade(capacidade.ocupacao);
    const angulo = limitarValor((capacidade.ocupacao / 100) * 180, 0, 180);
    const celulas = capacidade.porCelula.map(celula => `
        <div class="capacity-cell-row">
            <div>
                <strong>${escaparHtml(celula.celula)}</strong>
                <span>${formatarNumero(celula.capacidadeRestante)} pontos livres</span>
            </div>
            <div class="capacity-cell-meter" style="--cell-fill:${limitarValor(celula.ocupacao, 0, 100)}%">
                <span></span>
            </div>
            <b>${formatarNumero(celula.ocupacao)}%</b>
        </div>
    `).join("");

    container.innerHTML = `
        <article class="capacity-gauge-card ${diagnostico.classe}">
            <div class="capacity-gauge" style="--gauge-angle:${angulo}deg">
                <div class="capacity-gauge-arc"></div>
                <div class="capacity-gauge-needle"></div>
                <div class="capacity-gauge-center"></div>
            </div>
            <div class="capacity-gauge-value">
                <strong>${formatarNumero(capacidade.ocupacao)}%</strong>
                <span>uso do teto produtivo</span>
            </div>
        </article>

        <article class="capacity-summary-card">
            <span class="capacity-status ${diagnostico.classe}">${diagnostico.titulo}</span>
            <h3>${diagnostico.texto}</h3>
            <div class="capacity-summary-grid">
                <div>
                    <span>Produção atual</span>
                    <strong>${formatarNumero(capacidade.totalProducao)}</strong>
                </div>
                <div>
                    <span>Teto produtivo</span>
                    <strong>${formatarNumero(capacidade.tetoProdutivo)}</strong>
                </div>
                <div>
                    <span>Folga estimada</span>
                    <strong>${formatarNumero(capacidade.capacidadeRestante)}</strong>
                </div>
                <div>
                    <span>Benchmark 8h</span>
                    <strong>${formatarNumero(capacidade.benchmark8h)}</strong>
                </div>
            </div>
            <p>Referência calculada pela média do quartil superior de produção, ajustada para jornada de 8h. A decisão final ainda deve considerar complexidade dos casos, prazos e células específicas.</p>
        </article>

        <article class="capacity-cells-card">
            <h3>Folga por célula</h3>
            <div class="capacity-cell-list">
                ${celulas || `<div class="empty-state">Sem células para comparar.</div>`}
            </div>
        </article>
    `;
}

const pesosEsforcoKpi = {
    contratosMarcados: 4,
    prorrogacoes: 2,
    alteracoes: 2,
    contratosDesligados: 1.25,
    ticketsResolvidos: .75
};

const kpisIgnoradosEsforco = new Set([
    "satisfacaoPositiva",
    "satisfacaoNegativa",
    "sla"
]);

function obterPesoEsforcoKpi(kpi) {
    const pesosConfigurados = dadosProducao.parametros?.pesos || {};

    return Math.max(0, Number(pesosConfigurados[kpi] ?? pesosEsforcoKpi[kpi] ?? 1));
}

function listarAtividadesEsforcoFuncionario(funcionario) {
    const atividades = [];

    Object.entries(funcionario.principais || {}).forEach(([kpi, valor]) => {
        if (kpisIgnoradosEsforco.has(kpi)) {
            return;
        }

        const quantidade = Number(valor || 0);

        if (quantidade > 0) {
            atividades.push({
                kpi,
                nome: nomesKpis[kpi] || kpi,
                quantidade,
                peso: obterPesoEsforcoKpi(kpi),
                principal: true
            });
        }
    });

    Object.entries(funcionario.extras || {}).forEach(([kpi, valor]) => {
        if (kpisIgnoradosEsforco.has(kpi)) {
            return;
        }

        const quantidade = Number(valor || 0);

        if (quantidade > 0) {
            atividades.push({
                kpi,
                nome: nomesKpis[kpi] || kpi,
                quantidade,
                peso: obterPesoEsforcoKpi(kpi),
                principal: false
            });
        }
    });

    return atividades.map(atividade => ({
        ...atividade,
        pontos: atividade.quantidade * atividade.peso
    }));
}

function calcularIndiceEsforcoFuncionario(funcionario) {
    return listarAtividadesEsforcoFuncionario(funcionario)
        .reduce((total, atividade) => total + atividade.pontos, 0);
}

function calcularComposicaoEsforco(funcionarios) {
    const composicao = {};

    funcionarios.forEach(funcionario => {
        listarAtividadesEsforcoFuncionario(funcionario).forEach(atividade => {
            const chave = `${atividade.principal ? "principal" : "extra"}:${atividade.kpi}`;

            if (!composicao[chave]) {
                composicao[chave] = {
                    kpi: atividade.kpi,
                    nome: atividade.nome,
                    quantidade: 0,
                    peso: atividade.peso,
                    pontos: 0,
                    principal: atividade.principal
                };
            }

            composicao[chave].quantidade += atividade.quantidade;
            composicao[chave].pontos += atividade.pontos;
        });
    });

    const total = Object.values(composicao).reduce((soma, item) => soma + item.pontos, 0);

    return Object.values(composicao)
        .map(item => ({
            ...item,
            percentual: total ? Math.round((item.pontos / total) * 100) : 0
        }))
        .sort((a, b) => b.pontos - a.pontos);
}

function calcularTetoProdutivo(funcionarios) {
    const validos = funcionarios.filter(funcionario => calcularIndiceEsforcoFuncionario(funcionario) > 0);
    const totalFte = funcionarios.reduce((total, funcionario) => total + fatorJornadaFuncionario(funcionario), 0);
    const indicesEquivalentes8h = validos
        .map(funcionario => calcularIndiceEsforcoFuncionario(funcionario) / fatorJornadaFuncionario(funcionario))
        .sort((a, b) => b - a);

    if (!indicesEquivalentes8h.length || !totalFte) {
        return {
            teto: 0,
            benchmark8h: 0,
            pessoasReferencia: 0
        };
    }

    const pessoasReferencia = Math.max(1, Math.ceil(indicesEquivalentes8h.length * .25));
    const topQuartil = indicesEquivalentes8h.slice(0, pessoasReferencia);
    const benchmark8h = topQuartil.reduce((total, valor) => total + valor, 0) / topQuartil.length;

    return {
        teto: Math.round(benchmark8h * totalFte),
        benchmark8h,
        pessoasReferencia
    };
}

function calcularForcaTrabalho() {
    const funcionarios = dadosProducao.funcionarios || [];
    const totalProducao = funcionarios.reduce((total, funcionario) => total + calcularIndiceEsforcoFuncionario(funcionario), 0);
    const tetoGeral = calcularTetoProdutivo(funcionarios);
    const ocupacao = percentual(totalProducao, tetoGeral.teto);
    const capacidadeRestante = Math.max(0, tetoGeral.teto - totalProducao);
    const capacidadePercentual = Math.max(0, 100 - ocupacao);
    const porCelula = Object.entries(dadosProducao.rankings.celulas || {}).map(([celula, lista]) => {
        const producao = lista.reduce((total, funcionario) => total + calcularIndiceEsforcoFuncionario(funcionario), 0);
        const tetoCelula = calcularTetoProdutivo(lista);

        return {
            celula,
            producao,
            teto: tetoCelula.teto,
            ocupacao: percentual(producao, tetoCelula.teto),
            capacidadeRestante: Math.max(0, tetoCelula.teto - producao)
        };
    }).sort((a, b) => a.ocupacao - b.ocupacao);

    return {
        totalProducao,
        tetoProdutivo: tetoGeral.teto,
        benchmark8h: tetoGeral.benchmark8h,
        pessoasReferencia: tetoGeral.pessoasReferencia,
        ocupacao,
        capacidadeRestante,
        capacidadePercentual,
        porCelula
    };
}

function renderizarForcaTrabalho() {
    const container = document.getElementById("forcaTrabalho");

    if (!container) {
        return;
    }

    if (!dadosProducao.funcionarios.length) {
        container.innerHTML = `<div class="empty-state">Aguardando importação.</div>`;
        return;
    }

    const capacidade = calcularForcaTrabalho();
    const diagnostico = obterDiagnosticoCapacidade(capacidade.ocupacao);
    const angulo = limitarValor((capacidade.ocupacao / 100) * 180, 0, 180);
    const celulas = capacidade.porCelula.map(celula => `
        <div class="capacity-cell-row">
            <div>
                <strong>${escaparHtml(celula.celula)}</strong>
                <span>${formatarNumero(celula.capacidadeRestante)} pontos ponderados livres</span>
            </div>
            <div class="capacity-cell-meter" style="--cell-fill:${limitarValor(celula.ocupacao, 0, 100)}%">
                <span></span>
            </div>
            <b>${formatarNumero(celula.ocupacao)}%</b>
        </div>
    `).join("");

    container.innerHTML = `
        <article class="capacity-gauge-card ${diagnostico.classe}">
            <div class="capacity-gauge" style="--gauge-angle:${angulo}deg">
                <div class="capacity-gauge-arc"></div>
                <div class="capacity-gauge-needle"></div>
                <div class="capacity-gauge-center"></div>
            </div>
            <div class="capacity-gauge-value">
                <strong>${formatarNumero(capacidade.ocupacao)}%</strong>
                <span>uso do teto ponderado</span>
            </div>
        </article>

        <article class="capacity-summary-card">
            <span class="capacity-status ${diagnostico.classe}">${diagnostico.titulo}</span>
            <h3>${diagnostico.texto}</h3>
            <div class="capacity-summary-grid">
                <div>
                    <span>Índice atual</span>
                    <strong>${formatarNumero(capacidade.totalProducao)}</strong>
                </div>
                <div>
                    <span>Teto ponderado</span>
                    <strong>${formatarNumero(capacidade.tetoProdutivo)}</strong>
                </div>
                <div>
                    <span>Folga ponderada</span>
                    <strong>${formatarNumero(capacidade.capacidadeRestante)}</strong>
                </div>
                <div>
                    <span>Benchmark 8h</span>
                    <strong>${formatarNumero(capacidade.benchmark8h)}</strong>
                </div>
            </div>
            <p>Referência calculada por índice ponderado de esforço, usando o quartil superior da equipe ajustado para jornada de 8h. Assim, atividades diferentes não entram com o mesmo peso.</p>
        </article>

        <article class="capacity-cells-card">
            <h3>Folga por célula</h3>
            <div class="capacity-cell-list">
                ${celulas || `<div class="empty-state">Sem células para comparar.</div>`}
            </div>
        </article>
    `;
}

function percentil(valores, ponto) {
    const ordenados = valores
        .filter(valor => Number.isFinite(valor))
        .sort((a, b) => a - b);

    if (!ordenados.length) {
        return 0;
    }

    const posicao = (ordenados.length - 1) * ponto;
    const base = Math.floor(posicao);
    const topo = Math.ceil(posicao);

    if (base === topo) {
        return ordenados[base];
    }

    return ordenados[base] + ((ordenados[topo] - ordenados[base]) * (posicao - base));
}

function obterAmostraHistoricaEsforco() {
    const porCompetencia = agruparHistoricoPorCompetencia();
    const amostra = [];

    porCompetencia.forEach((linhas, competencia) => {
        processarLinhasParaEvolucao(linhas, competencia).forEach(funcionario => {
            const indice = calcularIndiceEsforcoFuncionario(funcionario);

            if (indice > 0) {
                amostra.push(indice / fatorJornadaFuncionario(funcionario));
            }
        });
    });

    return amostra;
}

function calcularReferenciaSustentavel(funcionarios) {
    const amostraHistorica = obterAmostraHistoricaEsforco();
    const amostraAtual = funcionarios
        .filter(funcionario => fatorJornadaFuncionario(funcionario) > 0)
        .map(funcionario => calcularIndiceEsforcoFuncionario(funcionario) / fatorJornadaFuncionario(funcionario))
        .filter(valor => valor > 0);
    const amostra = amostraHistorica.length >= 8 ? amostraHistorica : amostraAtual;
    const totalFte = funcionarios.reduce((total, funcionario) => total + fatorJornadaFuncionario(funcionario), 0);
    const faixaSustentavel8h = percentil(amostra, .70);
    const faixaCritica8h = percentil(amostra, .90) || faixaSustentavel8h;

    return {
        limiteSustentavel: Math.round(faixaSustentavel8h * totalFte),
        limiteCritico: Math.round(faixaCritica8h * totalFte),
        faixaSustentavel8h,
        faixaCritica8h
    };
}

function obterDiagnosticoCapacidade(ocupacao, percentualAcimaFaixa = 0) {
    if (ocupacao >= 100 || percentualAcimaFaixa >= 50) {
        return {
            classe: "capacity-danger",
            titulo: "Saturação operacional",
            texto: "A equipe está acima da capacidade sustentável. Novas demandas devem ser redistribuídas ou acompanhadas com prioridade."
        };
    }

    if (ocupacao >= 90) {
        return {
            classe: "capacity-danger",
            titulo: "Pressão alta",
            texto: "A equipe está próxima do limite sustentável. Novas demandas devem ser direcionadas com cautela, priorizando células e colaboradores com maior folga operacional."
        };
    }

    if (ocupacao >= 75 || percentualAcimaFaixa >= 35) {
        return {
            classe: "capacity-warning",
            titulo: "Pressão moderada",
            texto: "A equipe está em uma faixa moderada: ainda há controle, mas novas demandas devem ser distribuídas com atenção."
        };
    }

    return {
        classe: "capacity-good",
        titulo: "Pressão baixa",
        texto: "A equipe está abaixo da faixa sustentável estimada."
    };
}

function principaisKpisPressao(funcionario) {
    return listarAtividadesEsforcoFuncionario(funcionario)
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 3);
}

function detalharPressaoFuncionario(funcionario, faixaSustentavel8h) {
    const fatorJornada = fatorJornadaFuncionario(funcionario);
    const indice = calcularIndiceEsforcoFuncionario(funcionario);
    const indice8h = fatorJornada ? indice / fatorJornada : indice;

    return {
        nome: funcionario.nome,
        jornada: funcionario.jornada?.horas || (fatorJornada >= 1 ? 8 : 6),
        indice,
        indice8h,
        acimaFaixa: indice8h > faixaSustentavel8h,
        kpis: principaisKpisPressao(funcionario)
    };
}

function renderizarDetalhePressaoCelula(celula) {
    const pessoas = celula.detalhesPessoas || [];
    const pessoasAcima = pessoas.filter(pessoa => pessoa.acimaFaixa);
    const listaPessoas = pessoasAcima.length ? pessoasAcima : pessoas.slice(0, 3);
    const pessoasHtml = listaPessoas.length
        ? listaPessoas.map(pessoa => {
            const kpis = pessoa.kpis.length
                ? pessoa.kpis.map(kpi => {
                    const tipo = kpi.principal ? "atividade principal" : "atividade não principal";
                    return `${escaparHtml(kpi.nome)} <em class="${kpi.principal ? "effort-main" : "effort-extra"}">${tipo}</em>: ${formatarNumero(kpi.quantidade)} x peso ${String(kpi.peso).replace(".", ",")}`;
                }).join("<br>")
                : "Sem atividade com volume no mês.";

            return `
                <li>
                    <strong>${escaparHtml(pessoa.nome)}</strong>
                    <span>${formatarNumero(pessoa.indice)} pts | ${pessoa.jornada}h | equiv. 8h: ${formatarNumero(pessoa.indice8h)}</span>
                    <small>${kpis}</small>
                </li>
            `;
        }).join("")
        : `<li><span>Nenhuma pessoa acima da faixa nesta célula.</span></li>`;
    const composicaoHtml = celula.composicao.length
        ? celula.composicao.slice(0, 4).map(item => `
            <li>
                <strong>${escaparHtml(item.nome)} <em class="${item.principal ? "effort-main" : "effort-extra"}">${item.principal ? "atividade principal" : "atividade não principal"}</em></strong>
                <span>${formatarNumero(item.pontos)} pts (${formatarNumero(item.percentual)}%)</span>
            </li>
        `).join("")
        : `<li><span>Sem composição de esforço registrada.</span></li>`;

    return `
        <div class="capacity-cell-detail" role="tooltip">
            <strong>Por que está em pressão?</strong>
            <p>Faixa sustentável da célula: ${formatarNumero(celula.benchmark8h)} pts equivalentes a 8h.</p>
            <div>
                <span>Pessoas que puxam a pressão</span>
                <ul>${pessoasHtml}</ul>
            </div>
            <div>
                <span>Atividades com maior peso</span>
                <ul>${composicaoHtml}</ul>
            </div>
        </div>
    `;
}

function calcularForcaTrabalho() {
    const funcionarios = (dadosProducao.funcionarios || []).filter(funcionario => fatorJornadaFuncionario(funcionario) > 0);
    const totalProducao = funcionarios.reduce((total, funcionario) => total + calcularIndiceEsforcoFuncionario(funcionario), 0);
    const referencia = calcularReferenciaSustentavel(funcionarios);
    const ocupacao = percentual(totalProducao, referencia.limiteSustentavel);
    const capacidadeRestante = Math.max(0, referencia.limiteSustentavel - totalProducao);
    const excessoEstimado = Math.max(0, totalProducao - referencia.limiteSustentavel);
    const pessoasAcimaFaixa = funcionarios.filter(funcionario => {
        const indice8h = calcularIndiceEsforcoFuncionario(funcionario) / fatorJornadaFuncionario(funcionario);
        return indice8h > referencia.faixaSustentavel8h;
    }).length;
    const percentualAcimaFaixa = funcionarios.length ? Math.round((pessoasAcimaFaixa / funcionarios.length) * 100) : 0;
    const porCelula = Object.entries(dadosProducao.rankings.celulas || {}).map(([celula, lista]) => {
        const producao = lista.reduce((total, funcionario) => total + calcularIndiceEsforcoFuncionario(funcionario), 0);
        const referenciaCelula = calcularReferenciaSustentavel(lista);
        const detalhesPessoas = lista
            .map(funcionario => detalharPressaoFuncionario(funcionario, referenciaCelula.faixaSustentavel8h))
            .sort((a, b) => b.indice8h - a.indice8h);
        const pessoasAcima = lista.filter(funcionario => {
            const indice8h = calcularIndiceEsforcoFuncionario(funcionario) / fatorJornadaFuncionario(funcionario);
            return indice8h > referenciaCelula.faixaSustentavel8h;
        }).length;

        return {
            celula,
            producao,
            teto: referenciaCelula.limiteSustentavel,
            ocupacao: percentual(producao, referenciaCelula.limiteSustentavel),
            capacidadeRestante: Math.max(0, referenciaCelula.limiteSustentavel - producao),
            pessoasAcima,
            benchmark8h: referenciaCelula.faixaSustentavel8h,
            detalhesPessoas,
            composicao: calcularComposicaoEsforco(lista)
        };
    }).sort((a, b) => b.ocupacao - a.ocupacao);

    return {
        totalProducao,
        tetoProdutivo: referencia.limiteSustentavel,
        limiteCritico: referencia.limiteCritico,
        benchmark8h: referencia.faixaSustentavel8h,
        benchmarkCritico8h: referencia.faixaCritica8h,
        ocupacao,
        capacidadeRestante,
        excessoEstimado,
        pessoasAcimaFaixa,
        percentualAcimaFaixa,
        composicao: calcularComposicaoEsforco(funcionarios),
        porCelula
    };
}

function renderizarComposicaoEsforco(composicao) {
    if (!composicao.length) {
        return `<div class="empty-state">Sem composição de atividades para exibir.</div>`;
    }

    const cores = ["#003b71", "#ff7a00", "#168a4a", "#7c3aed", "#0891b2", "#c23b3b"];
    const segmentos = composicao.map((item, indice) => `
        <span style="width:${item.percentual}%; background:${cores[indice % cores.length]}" title="${escaparHtml(item.nome)}: ${formatarNumero(item.percentual)}%"></span>
    `).join("");
    const linhas = composicao.map((item, indice) => `
        <div class="workload-row">
            <i style="background:${cores[indice % cores.length]}"></i>
            <div>
                <strong>${escaparHtml(item.nome)} <em class="${item.principal ? "effort-main" : "effort-extra"}">${item.principal ? "atividade principal" : "atividade não principal"}</em></strong>
                <span>${formatarNumero(item.quantidade)} atividades x peso ${String(item.peso).replace(".", ",")}</span>
            </div>
            <b>${formatarNumero(item.pontos)} pts</b>
        </div>
    `).join("");

    return `
        <div class="workload-composition">
            <div class="workload-stack">${segmentos}</div>
            <div class="workload-list">${linhas}</div>
        </div>
    `;
}

function atividadesDisponiveisSimulacao() {
    return Object.keys(nomesKpis)
        .filter(kpi => !kpisIgnoradosEsforco.has(kpi))
        .map(kpi => ({
            kpi,
            nome: nomesKpis[kpi] || kpi
        }));
}

function calcularProjecaoDemandas(demandas) {
    const capacidade = calcularForcaTrabalho();
    const demandasValidas = demandas
        .map(demanda => ({
            kpi: demanda.kpi,
            quantidade: Number(demanda.quantidade || 0),
            peso: obterPesoEsforcoKpi(demanda.kpi),
            nome: nomesKpis[demanda.kpi] || demanda.kpi
        }))
        .filter(demanda => demanda.kpi && demanda.quantidade > 0)
        .map(demanda => ({
            ...demanda,
            pontos: demanda.quantidade * demanda.peso
        }));
    const pontosExtras = demandasValidas.reduce((total, demanda) => total + demanda.pontos, 0);

    if (!demandasValidas.length || pontosExtras <= 0) {
        return null;
    }

    const celulas = capacidade.porCelula.map(celulaCapacidade => {
        const funcionarios = dadosProducao.rankings.celulas?.[celulaCapacidade.celula] || [];
        const atividadesPrincipaisCelula = obterKpisPrincipais(celulaCapacidade.celula);
        const demandasPrincipais = demandasValidas.filter(demanda => atividadesPrincipaisCelula.includes(demanda.kpi));
        const aderenciaAtividades = demandasPrincipais.length / demandasValidas.length;
        const ocupacaoProjetada = percentual(celulaCapacidade.producao + pontosExtras, celulaCapacidade.teto);
        const impacto = ocupacaoProjetada - celulaCapacidade.ocupacao;
        const colaboradores = funcionarios.map(funcionario => {
            const fator = fatorJornadaFuncionario(funcionario);
            const indice = calcularIndiceEsforcoFuncionario(funcionario);
            const limiteIndividual = celulaCapacidade.benchmark8h * fator;
            const folgaPontos = Math.max(0, limiteIndividual - indice);
            const produzido = demandasValidas.reduce((total, demanda) => {
                return total + Number(funcionario.principais?.[demanda.kpi] || 0) + Number(funcionario.extras?.[demanda.kpi] || 0);
            }, 0);
            const meta = demandasValidas.reduce((total, demanda) => total + Number(funcionario.metas?.[demanda.kpi] || 0), 0);
            const folgaMeta = Math.max(0, meta - produzido);
            const aderenciaColaborador = demandasValidas.filter(demanda => funcionario.principais && demanda.kpi in funcionario.principais).length / demandasValidas.length;
            const encaixe = (aderenciaAtividades * 140)
                + (aderenciaColaborador * 80)
                + folgaPontos
                + (folgaMeta * .35)
                + (funcionario.jornada?.horas >= 8 ? 12 : 0)
                - Math.max(0, indice - limiteIndividual);

            return {
                funcionario,
                folgaPontos,
                folgaMeta,
                produzido,
                meta,
                encaixe
            };
        }).sort((a, b) => b.encaixe - a.encaixe);

        const topColaboradores = colaboradores.slice(0, 3);
        const scoreColaboradores = topColaboradores.reduce((total, item) => total + item.encaixe, 0) / Math.max(1, topColaboradores.length);
        const score = (aderenciaAtividades * 700)
            + celulaCapacidade.capacidadeRestante
            + scoreColaboradores
            - Math.max(0, ocupacaoProjetada - 100) * 12
            - impacto * 2;

        return {
            ...celulaCapacidade,
            atividadePrincipal: aderenciaAtividades === 1,
            aderenciaAtividades,
            ocupacaoProjetada,
            impacto,
            score,
            colaboradores: topColaboradores
        };
    }).sort((a, b) => b.score - a.score);

    return {
        demandas: demandasValidas,
        quantidade: demandasValidas.reduce((total, demanda) => total + demanda.quantidade, 0),
        pontosExtras,
        ocupacaoGeralProjetada: percentual(capacidade.totalProducao + pontosExtras, capacidade.tetoProdutivo),
        celulas
    };
}

function calcularProjecaoDemanda(kpi, quantidade) {
    return calcularProjecaoDemandas([{ kpi, quantidade }]);
}

function renderizarResultadoProjecao(projecao) {
    if (!projecao) {
        return `<div class="empty-state">Nenhuma demanda adicional informada. Impacto projetado: 0.</div>`;
    }

    const melhor = projecao.celulas[0];

    if (!melhor) {
        return `<div class="empty-state">Não há células disponíveis para simulação.</div>`;
    }

    const colaboradores = melhor.colaboradores.map((item, indice) => `
        <li>
            <strong>${indice + 1}. ${escaparHtml(nomeCurtoFuncionario(item.funcionario.nome))}</strong>
            <span>${escaparHtml(item.funcionario.celula)} | ${item.funcionario.jornada?.horas || 8}h | folga: ${formatarNumero(item.folgaPontos)} pts</span>
            <small>Produzido nas atividades: ${formatarNumero(item.produzido)}${item.meta ? ` / meta ${formatarNumero(item.meta)}` : ""}</small>
        </li>
    `).join("");

    const composicao = projecao.demandas.map(demanda => `
        <span>${escaparHtml(demanda.nome)}: ${formatarNumero(demanda.quantidade)} x peso ${String(demanda.peso).replace(".", ",")}</span>
    `).join("");
    const alternativas = projecao.celulas.slice(1, 4).map(celula => `
        <div>
            <strong>${escaparHtml(celula.celula)}</strong>
            <span>${formatarNumero(celula.ocupacao)}% atual -> ${formatarNumero(celula.ocupacaoProjetada)}%</span>
        </div>
    `).join("");

    return `
        <div class="demand-result">
            <div class="demand-result-main">
                <span>Melhor direcionamento</span>
                <strong>${escaparHtml(melhor.celula)}</strong>
                <p>${melhor.aderenciaAtividades >= 1 ? "Todas as atividades são principais da célula" : `${formatarNumero(melhor.aderenciaAtividades * 100)}% das atividades são principais da célula`} | ${formatarNumero(melhor.ocupacao)}% -> ${formatarNumero(melhor.ocupacaoProjetada)}%</p>
            </div>
            <div class="demand-result-grid">
                <div>
                    <span>Carga total simulada</span>
                    <strong>${formatarNumero(projecao.quantidade)}</strong>
                    <small>${formatarNumero(projecao.pontosExtras)} pontos ponderados</small>
                </div>
                <div>
                    <span>Pressão geral projetada</span>
                    <strong>${formatarNumero(projecao.ocupacaoGeralProjetada)}%</strong>
                    <small>considerando a carga adicional informada</small>
                </div>
            </div>
            <div class="demand-composition">${composicao}</div>
            <div class="demand-collaborators">
                <span>Colaboradores sugeridos</span>
                <ul>${colaboradores || "<li><span>Sem colaboradores sugeridos.</span></li>"}</ul>
            </div>
            <div class="demand-alternatives">
                <span>Alternativas próximas</span>
                ${alternativas || "<small>Sem alternativas relevantes.</small>"}
            </div>
        </div>
    `;
}

function executarSimuladorDemanda() {
    const demandas = [...document.querySelectorAll("#listaDemandasSimulador .demand-activity-row")].map(linha => ({
        kpi: linha.querySelector("select")?.value,
        quantidade: Number(linha.querySelector("input")?.value || 0)
    }));
    const resultado = document.getElementById("resultadoSimuladorDemanda");

    if (!resultado) {
        return;
    }

    resultado.innerHTML = renderizarResultadoProjecao(calcularProjecaoDemandas(demandas));
}

function criarLinhaDemandaSimulador(kpi = "contratosMarcados", quantidade = 0) {
    const opcoes = atividadesDisponiveisSimulacao()
        .map(item => `<option value="${item.kpi}" ${item.kpi === kpi ? "selected" : ""}>${escaparHtml(item.nome)}</option>`)
        .join("");

    return `
        <div class="demand-activity-row">
            <label>
                <span>Atividade</span>
                <select>${opcoes}</select>
            </label>
            <label>
                <span>Quantidade adicional</span>
                <input type="number" min="0" step="1" value="${Number(quantidade || 0)}">
            </label>
            <button type="button" class="secondary-button demand-remove-row" title="Remover atividade">Remover</button>
        </div>
    `;
}

function configurarSimuladorDemanda() {
    const lista = document.getElementById("listaDemandasSimulador");
    const adicionar = document.getElementById("adicionarAtividadeDemanda");
    const botao = document.getElementById("simularNovaDemanda");

    if (!lista || lista.dataset.configurado) {
        return;
    }

    lista.innerHTML = criarLinhaDemandaSimulador("contratosMarcados", 0);

    lista.addEventListener("input", executarSimuladorDemanda);
    lista.addEventListener("change", executarSimuladorDemanda);
    lista.addEventListener("click", event => {
        if (!event.target.classList.contains("demand-remove-row")) {
            return;
        }

        const linhas = lista.querySelectorAll(".demand-activity-row");

        if (linhas.length > 1) {
            event.target.closest(".demand-activity-row")?.remove();
            executarSimuladorDemanda();
        }
    });
    adicionar?.addEventListener("click", () => {
        lista.insertAdjacentHTML("beforeend", criarLinhaDemandaSimulador("prorrogacoes", 0));
        executarSimuladorDemanda();
    });
    botao?.addEventListener("click", executarSimuladorDemanda);
    lista.dataset.configurado = "1";
    executarSimuladorDemanda();
}

function renderizarForcaTrabalho() {
    const container = document.getElementById("forcaTrabalho");

    if (!container) {
        return;
    }

    if (!dadosProducao.funcionarios.length) {
        container.innerHTML = `<div class="empty-state">Aguardando importação.</div>`;
        return;
    }

    const capacidade = calcularForcaTrabalho();
    const diagnostico = obterDiagnosticoCapacidade(capacidade.ocupacao, capacidade.percentualAcimaFaixa);
    const angulo = limitarValor((capacidade.ocupacao / 100) * 180, 0, 180);
    const celulas = capacidade.porCelula.map(celula => `
        <div class="capacity-cell-row" tabindex="0">
            <div>
                <strong>${escaparHtml(celula.celula)}</strong>
                <span>${celula.pessoasAcima} pessoa(s) acima da faixa</span>
            </div>
            <div class="capacity-cell-meter" style="--cell-fill:${limitarValor(celula.ocupacao, 0, 100)}%">
                <span></span>
            </div>
            <b>${formatarNumero(celula.ocupacao)}%</b>
            ${renderizarDetalhePressaoCelula(celula)}
        </div>
    `).join("");

    container.innerHTML = `
        <article class="capacity-gauge-card ${diagnostico.classe}">
            <div class="capacity-gauge" style="--gauge-angle:${angulo}deg">
                <div class="capacity-gauge-arc"></div>
                <div class="capacity-gauge-needle"></div>
                <div class="capacity-gauge-center"></div>
            </div>
            <div class="capacity-gauge-value">
                <strong>${formatarNumero(capacidade.ocupacao)}%</strong>
                <span>pressão operacional</span>
            </div>
            <div class="capacity-gauge-caption">
                <b>${formatarNumero(capacidade.totalProducao)}</b>
                <span>pontos de carga ponderada</span>
            </div>
        </article>

        <article class="capacity-summary-card">
            <span class="capacity-status ${diagnostico.classe}">${diagnostico.titulo}</span>
            <h3>${diagnostico.texto}</h3>
            <div class="capacity-summary-grid">
                <div>
                    <span>Índice atual</span>
                    <strong>${formatarNumero(capacidade.totalProducao)}</strong>
                </div>
                <div>
                    <span>Faixa sustentável</span>
                    <strong>${formatarNumero(capacidade.tetoProdutivo)}</strong>
                </div>
                <div>
                    <span>Excesso estimado</span>
                    <strong>${formatarNumero(capacidade.excessoEstimado)}</strong>
                </div>
                <div>
                    <span>Pessoas acima</span>
                    <strong>${formatarNumero(capacidade.percentualAcimaFaixa)}%</strong>
                </div>
            </div>
            <p>A leitura usa índice ponderado de esforço e compara a produção atual com uma faixa sustentável, baseada no percentil 70 da produção equivalente a 8h. Isso ajuda a mostrar pressão mesmo quando a equipe segue entregando muito.</p>
            ${renderizarComposicaoEsforco(capacidade.composicao)}
        </article>

        <article class="capacity-cells-card">
            <h3>Pressão por célula</h3>
            <div class="capacity-cell-list">
                ${celulas || `<div class="empty-state">Sem células para comparar.</div>`}
            </div>
        </article>
            <article class="capacity-demand-card">
            <div>
                <h3>PROSPECTIVA DE NOVA DEMANDA</h3>
                <p>Simule uma carga adicional e veja a melhor célula e os colaboradores mais indicados.</p>
            </div>
            <div id="listaDemandasSimulador" class="demand-activity-list"></div>
            <div class="demand-actions">
                <button type="button" class="secondary-button" id="adicionarAtividadeDemanda">Adicionar atividade</button>
                <button type="button" id="simularNovaDemanda">Simular</button>
            </div>
            <div id="resultadoSimuladorDemanda"></div>
        </article>
    `;

    configurarSimuladorDemanda();
}

function configurarEventosFiltrosEvolucao() {
    const filtroCelula = document.getElementById("filtroCelulaProducao");
    const filtroFuncionario = document.getElementById("filtroFuncionarioProducao");
    const limparFiltros = document.getElementById("limparFiltrosProducao");

    if (filtroCelula && !filtroCelula.dataset.configurado) {
        configurarMultiFiltro(filtroCelula, () => {
            atualizarFiltrosEvolucao();
            renderizarGraficoEvolucao();
        });
        filtroCelula.dataset.configurado = "1";
    }

    if (filtroFuncionario && !filtroFuncionario.dataset.configurado) {
        configurarMultiFiltro(filtroFuncionario, renderizarGraficoEvolucao);
        filtroFuncionario.dataset.configurado = "1";
    }

    if (limparFiltros && !limparFiltros.dataset.configurado) {
        limparFiltros.addEventListener("click", () => {
            if (filtroCelula) {
                filtroCelula.dataset.selected = "[]";
            }

            if (filtroFuncionario) {
                filtroFuncionario.dataset.selected = "[]";
            }

            document.querySelectorAll(".multi-filter.open").forEach(controle => controle.classList.remove("open"));
            atualizarFiltrosEvolucao();
            renderizarGraficoEvolucao();
        });
        limparFiltros.dataset.configurado = "1";
    }
}

function configurarEventosPrioridadePessoas() {
    const filtroCelula = document.getElementById("priorizarCelulaPessoas");
    const filtroFuncionario = document.getElementById("priorizarFuncionarioPessoas");
    const limparFiltros = document.getElementById("limparPrioridadePessoas");

    if (filtroCelula && !filtroCelula.dataset.configurado) {
        configurarMultiFiltro(filtroCelula, () => {
            atualizarFiltrosPrioridadePessoas();
            renderizarAnalisePessoasPorCelula();
        });
        filtroCelula.dataset.configurado = "1";
    }

    if (filtroFuncionario && !filtroFuncionario.dataset.configurado) {
        configurarMultiFiltro(filtroFuncionario, () => {
            atualizarFiltrosPrioridadePessoas();
            renderizarAnalisePessoasPorCelula();
        });
        filtroFuncionario.dataset.configurado = "1";
    }

    if (limparFiltros && !limparFiltros.dataset.configurado) {
        limparFiltros.addEventListener("click", () => {
            if (filtroCelula) {
                filtroCelula.dataset.selected = "[]";
            }

            if (filtroFuncionario) {
                filtroFuncionario.dataset.selected = "[]";
            }

            document.querySelectorAll(".multi-filter.open").forEach(controle => controle.classList.remove("open"));
            atualizarFiltrosPrioridadePessoas();
            renderizarAnalisePessoasPorCelula();
        });
        limparFiltros.dataset.configurado = "1";
    }
}

function configurarComentariosProducao() {
    const container = document.getElementById("analisePessoasCelula");

    if (!container || container.dataset.comentariosConfigurados) {
        return;
    }

    container.addEventListener("input", event => {
        const campo = event.target;

        if (!campo.classList.contains("person-comment-input")) {
            return;
        }

        const funcionarioId = campo.dataset.funcionarioId;
        const texto = campo.value;

        dadosProducao.comentarios[funcionarioId] = texto;

        if (timersComentariosProducao.has(funcionarioId)) {
            clearTimeout(timersComentariosProducao.get(funcionarioId));
        }

        timersComentariosProducao.set(funcionarioId, setTimeout(() => {
            if (typeof window.salvarComentarioProducao === "function") {
                window.salvarComentarioProducao(funcionarioId, texto).catch(erro => {
                    console.error(erro);
                });
            }
        }, 600));
    });

    container.addEventListener("change", event => {
        const campo = event.target;

        if (!campo.classList.contains("person-meta-weeks") && !campo.classList.contains("person-meta-reason")) {
            return;
        }

        const funcionarioId = campo.dataset.funcionarioId;
        const linha = campo.closest("tr");
        const semanasAtivas = Number(linha?.querySelector(".person-meta-weeks")?.value ?? 4);
        const motivo = linha?.querySelector(".person-meta-reason")?.value || "";
        const observacao = linha?.querySelector(".person-comment-input")?.value || "";

        dadosProducao.avaliacoesMeta[funcionarioId] = {
            semanasAtivas,
            motivo,
            observacao
        };

        if (typeof window.salvarAvaliacaoMetaProducao === "function") {
            window.salvarAvaliacaoMetaProducao(funcionarioId, dadosProducao.avaliacoesMeta[funcionarioId]).catch(erro => {
                console.error(erro);
            });
        }

        if (Array.isArray(dadosProducao.linhasOriginais) && dadosProducao.linhasOriginais.length) {
            processarProducao(dadosProducao.linhasOriginais);
            atualizarDashboardProducao();
        }
    });

    container.dataset.comentariosConfigurados = "1";
}

function configurarMultiFiltro(controle, aoAlterar) {
    const botao = controle.querySelector(".multi-filter-button");
    const menu = controle.querySelector(".multi-filter-menu");

    botao?.addEventListener("click", event => {
        event.stopPropagation();
        document.querySelectorAll(".multi-filter.open").forEach(aberto => {
            if (aberto !== controle) {
                aberto.classList.remove("open");
            }
        });
        controle.classList.toggle("open");
    });

    menu?.addEventListener("change", event => {
        if (event.target.type !== "checkbox") {
            return;
        }

        const selecionados = [...menu.querySelectorAll("input:checked")].map(input => input.value);
        controle.dataset.selected = JSON.stringify(selecionados);
        aoAlterar();
    });
}

document.addEventListener("click", () => {
    document.querySelectorAll(".multi-filter.open").forEach(controle => controle.classList.remove("open"));
});

function atualizarDashboardProducao() {
    configurarPreviewFotosAvatares();
    renderizarIndicadoresProducao();
    renderizarForcaTrabalho();
    renderizarMetasPorCelula();
    renderizarRankingGeral();
    renderizarRankingDestaquesKpi();
    atualizarFiltrosPrioridadePessoas();
    renderizarAnalisePessoasPorCelula();
    configurarComentariosProducao();
    atualizarFiltrosEvolucao();
    configurarEventosFiltrosEvolucao();
    configurarEventosPrioridadePessoas();
    renderizarGraficoEvolucao();
}

document.addEventListener("DOMContentLoaded", atualizarDashboardProducao);
