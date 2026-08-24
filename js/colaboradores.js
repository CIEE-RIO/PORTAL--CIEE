(async function iniciarColaboradores() {
    const firebaseApp = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const firebaseAuth = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const firestore = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    const {
        collection,
        doc,
        getFirestore,
        getDocsFromServer,
    } = firestore;

    const firebaseConfig = {
        apiKey: "AIzaSyD7OHPZ8flOUGyCrdL3Sp-ZTASj03Dbn94",
        authDomain: "portal-producao-d3a08.firebaseapp.com",
        projectId: "portal-producao-d3a08",
        storageBucket: "portal-producao-d3a08.firebasestorage.app",
        messagingSenderId: "881576324700",
        appId: "1:881576324700:web:c68bdbe4c309d5fd1f4099"
    };

    const app = firebaseApp.getApps().some(item => item.name === "[DEFAULT]")
        ? firebaseApp.getApp()
        : firebaseApp.initializeApp(firebaseConfig);
    const auth = firebaseAuth.getAuth(app);
    const db = getFirestore(app);
    const estado = {
        competencias: [],
        colaboradores: new Map(),
        grafico: null,
        graficoExtras: null
    };

    const nomesMesesCurtos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const coresAtividadesExtras = ["#003b71", "#f97316", "#16a34a", "#7c3aed", "#0891b2", "#dc2626", "#ca8a04", "#475569"];

    function setStatus(tipo, texto) {
        const status = document.getElementById("statusColaboradores");

        if (!status) {
            return;
        }

        status.className = `status-message ${tipo || "muted"}`;
        status.textContent = texto;
    }

    async function aguardarUsuarioAutenticado() {
        if (auth.currentUser) {
            return auth.currentUser;
        }

        return new Promise(resolve => {
            const cancelar = firebaseAuth.onAuthStateChanged(auth, usuario => {
                cancelar();
                resolve(usuario || null);
            });
        });
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

    function nomeCurto(nome) {
        const partes = String(nome || "")
            .replace(/\([^)]*\)/g, "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (partes.length <= 2) {
            return partes.join(" ") || "Sem nome";
        }

        return `${partes[0]} ${partes[partes.length - 1]}`;
    }

    window.trocarFotoColaborador = function trocarFotoColaborador(img) {
        const fallbacks = JSON.parse(img.dataset.fallbacks || "[]");
        const proxima = fallbacks.shift();

        if (proxima) {
            img.dataset.fallbacks = JSON.stringify(fallbacks);
            img.src = proxima;
            return;
        }

        img.style.display = "none";
        img.nextElementSibling.style.display = "grid";
    };

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

    function caminhosFotoFuncionario(nome, email) {
        const slugs = [
            slugFotoFuncionario(nome),
            slugFotoFuncionario(email)
        ].filter(Boolean);

        return [...new Set(slugs)].flatMap(slug => [
            `../../assets/funcionarios/${slug}.jpg`,
            `../../assets/funcionarios/${slug}.jpeg`,
            `../../assets/funcionarios/${slug}.png`,
            `../../assets/funcionarios/${slug}.png.png`
        ]);
    }

    function avatarColaborador(nome, email = "") {
        const rotulo = nome || email;
        const iniciais = iniciaisFuncionario(rotulo);
        const caminhos = caminhosFotoFuncionario(nome, email);

        return `
            <span id="colaboradorAvatar" class="avatar avatar-lg">
                <img src="${caminhos[0]}" data-fallbacks='${JSON.stringify(caminhos.slice(1))}' alt="${escaparHtml(rotulo)}" onerror="trocarFotoColaborador(this);">
                <b>${escaparHtml(iniciais)}</b>
            </span>
        `;
    }

    function avatarDestaque(nome, email = "") {
        const rotulo = nome || email;
        const iniciais = iniciaisFuncionario(rotulo);
        const caminhos = caminhosFotoFuncionario(nome, email);

        return `
            <span class="avatar podium-avatar">
                <img src="${caminhos[0]}" data-fallbacks='${JSON.stringify(caminhos.slice(1))}' alt="${escaparHtml(rotulo)}" onerror="trocarFotoColaborador(this);">
                <b>${escaparHtml(iniciais)}</b>
            </span>
        `;
    }

    function labelCompetencia(competencia) {
        const mes = Number(String(competencia).slice(5, 7));
        const ano = String(competencia).slice(0, 4);

        return `${nomesMesesCurtos[mes - 1] || competencia}/${ano}`;
    }

    function slaDoMes(item) {
        return Number(item?.sla ?? item?.principais?.sla ?? item?.extras?.sla ?? 0);
    }

    function textoSla(valor) {
        return valor ? `${formatarNumero(valor)}h` : "-";
    }

    function mediaSlaColaborador(colaborador) {
        const slas = colaborador.meses
            .map(slaDoMes)
            .filter(valor => Number.isFinite(valor) && valor > 0);

        if (!slas.length) {
            return 0;
        }

        return slas.reduce((total, valor) => total + valor, 0) / slas.length;
    }

    function getChunksCollection(competencia) {
        return collection(db, "producao_competencias", competencia, "chunks");
    }

    async function carregarLinhasDaCompetencia(competencia) {
        const snap = await getDocsFromServer(getChunksCollection(competencia));
        const chunks = [];

        snap.forEach(item => chunks.push(item.data()));
        chunks.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

        return chunks.flatMap(chunk => chunk.rows || []);
    }

    async function listarCompetencias() {
        const snap = await getDocsFromServer(collection(db, "producao_competencias"));
        const competencias = [];

        snap.forEach(item => {
            const data = item.data();
            competencias.push(data.competencia || item.id);
        });

        return competencias
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    }

    function processarCompetencia(competencia, linhas, historicoAnterior) {
        const competenciaAnterior = dadosProducao.competencia;
        const historicoGlobalAnterior = dadosProducao.historico;

        try {
            dadosProducao.competencia = competencia;
            dadosProducao.historico = historicoAnterior;

            const funcionarios = linhas
                .filter(funcionario => funcionario.nome || funcionario.email)
                .map(processarFuncionario);
            const metas = calcularMetasPorCelula(funcionarios, historicoAnterior, competencia);

            return aplicarMetasEDesempenho(funcionarios, metas);
        } finally {
            dadosProducao.competencia = competenciaAnterior;
            dadosProducao.historico = historicoGlobalAnterior;
        }
    }

    function adicionarAoMapa(funcionario, competencia) {
        const id = valorFuncionario(funcionario);

        if (!estado.colaboradores.has(id)) {
            estado.colaboradores.set(id, {
                id,
                nome: funcionario.nome,
                email: funcionario.email,
                celula: funcionario.celula,
                jornada: funcionario.jornada,
                meses: []
            });
        }

        const colaborador = estado.colaboradores.get(id);
        colaborador.nome = funcionario.nome || colaborador.nome;
        colaborador.email = funcionario.email || colaborador.email;
        colaborador.celula = funcionario.celula || colaborador.celula;
        colaborador.jornada = funcionario.jornada || colaborador.jornada;
        colaborador.meses.push({
            competencia,
            producao: funcionario.totalPrincipal,
            meta: funcionario.metaTotal,
            percentual: funcionario.percentualGeral,
            sla: Number(funcionario.principais?.sla ?? funcionario.extras?.sla ?? funcionario.sla ?? 0),
            principais: funcionario.principais,
            extras: funcionario.extras,
            metas: funcionario.metas,
            desempenho: funcionario.desempenho
        });
    }

    async function carregarDados() {
        configurarPreviewFotosAvatares();
        estado.competencias = await listarCompetencias();

        if (!estado.competencias.length) {
            setStatus("muted", "Nenhuma base de produção foi encontrada no Firebase.");
            return;
        }

        const historicoAnterior = [];

        for (const competencia of estado.competencias) {
            const linhas = await carregarLinhasDaCompetencia(competencia);
            const processados = processarCompetencia(competencia, linhas, historicoAnterior);

            processados.forEach(funcionario => adicionarAoMapa(funcionario, competencia));
            historicoAnterior.push(...linhas.map(linha => ({ ...linha, competencia })));
        }

        preencherSelect();
        preencherFiltroDestaques();
        renderizarMuralDestaques();
        setStatus("success", `${estado.colaboradores.size} colaboradores carregados.`);
    }

    function preencherSelect() {
        const select = document.getElementById("selectColaborador");

        if (!select) {
            return;
        }

        const colaboradores = [...estado.colaboradores.values()]
            .sort((a, b) => a.nome.localeCompare(b.nome));

        select.innerHTML = `<option value="">Selecione um colaborador</option>` + colaboradores
            .map(colaborador => `<option value="${escaparHtml(colaborador.id)}">${escaparHtml(colaborador.nome)}</option>`)
            .join("");
    }

    function preencherFiltroDestaques() {
        const select = document.getElementById("filtroCompetenciaDestaques");

        if (!select) {
            return;
        }

        const ultima = estado.competencias[estado.competencias.length - 1] || "";
        select.innerHTML = `<option value="">Última competência</option>` + estado.competencias
            .slice()
            .reverse()
            .map(competencia => `<option value="${competencia}">${labelCompetencia(competencia)}</option>`)
            .join("");
        select.value = ultima;
    }

    function competenciaDestaquesSelecionada() {
        return document.getElementById("filtroCompetenciaDestaques")?.value || estado.competencias[estado.competencias.length - 1];
    }

    function obterCompetenciaAnterior(competencia) {
        const indice = estado.competencias.indexOf(competencia);

        return indice > 0 ? estado.competencias[indice - 1] : null;
    }

    function obterDestaquesDaCompetencia(competenciaSelecionada = null) {
        const competencia = competenciaSelecionada || estado.competencias[estado.competencias.length - 1];

        if (!competencia) {
            return {
                competencia: null,
                destaques: []
            };
        }

        const destaques = [...estado.colaboradores.values()]
            .map(colaborador => {
                const mes = colaborador.meses.find(item => item.competencia === competencia);

                if (!mes) {
                    return null;
                }

                return {
                    nome: colaborador.nome,
                    celula: colaborador.celula,
                    producao: mes.producao,
                    meta: mes.meta,
                    percentual: Number(mes.percentual || 0)
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.percentual - a.percentual)
            .slice(0, 3);

        return {
            competencia,
            destaques
        };
    }

    function obterDestaquesDaUltimaCompetencia() {
        return obterDestaquesDaCompetencia();
    }

    function renderizarMuralDestaques() {
        const mural = document.getElementById("muralDestaques");
        const subtitulo = document.getElementById("competenciaDestaques");

        if (!mural) {
            return;
        }

        const { competencia, destaques } = obterDestaquesDaUltimaCompetencia();

        if (subtitulo && competencia) {
            subtitulo.textContent = `Top colaboradores em ${labelCompetencia(competencia)}, considerando o percentual de meta atingida.`;
        }

        if (!destaques.length) {
            mural.innerHTML = `<div class="empty-state">Nenhum destaque encontrado na última competência.</div>`;
            return;
        }

        const classes = ["first", "second", "third"];
        const ordemVisual = destaques.length > 1 ? [1, 0, 2] : [0];
        const cards = ordemVisual
            .filter(indice => destaques[indice])
            .map(indice => {
                const destaque = destaques[indice];
                const posicao = indice + 1;

                return `
                    <article class="podium-place ${classes[indice]}" style="--delay:${indice * 90}ms">
                        <span class="podium-rank">${posicao}º</span>
                        ${avatarDestaque(destaque.nome)}
                        <strong>${escaparHtml(destaque.nome)}</strong>
                        <small>${escaparHtml(destaque.celula || "-")}</small>
                        <div class="podium-score">${formatarNumero(destaque.percentual)}%</div>
                        <p>${formatarNumero(destaque.producao)} de ${formatarNumero(destaque.meta)} pontos</p>
                    </article>
                `;
            })
            .join("");

        mural.innerHTML = cards;
    }

    function obterEvolucoesMensais(competenciaSelecionada = null) {
        const competenciaAtual = competenciaSelecionada || estado.competencias[estado.competencias.length - 1];
        const competenciaAnterior = obterCompetenciaAnterior(competenciaAtual);

        if (!competenciaAtual || !competenciaAnterior) {
            return {
                competenciaAtual,
                competenciaAnterior,
                destaques: []
            };
        }

        const destaques = [...estado.colaboradores.values()]
            .map(colaborador => {
                const atual = colaborador.meses.find(item => item.competencia === competenciaAtual);
                const anterior = colaborador.meses.find(item => item.competencia === competenciaAnterior);

                if (!atual || !anterior) {
                    return null;
                }

                const percentualAtual = Number(atual.percentual || 0);
                const percentualAnterior = Number(anterior.percentual || 0);
                const evolucao = percentualAtual - percentualAnterior;

                return {
                    nome: colaborador.nome,
                    celula: colaborador.celula,
                    percentualAtual,
                    percentualAnterior,
                    evolucao
                };
            })
            .filter(item => item && item.evolucao > 0)
            .sort((a, b) => b.evolucao - a.evolucao)
            .slice(0, 3);

        return {
            competenciaAtual,
            competenciaAnterior,
            destaques
        };
    }

    function obterDestaquesExtras(competenciaSelecionada = null) {
        const competencia = competenciaSelecionada || estado.competencias[estado.competencias.length - 1];
        const colaboradores = [...estado.colaboradores.values()];
        const maiorProducao = colaboradores
            .map(colaborador => {
                const mes = colaborador.meses.find(item => item.competencia === competencia);

                if (!mes) {
                    return null;
                }

                return {
                    nome: colaborador.nome,
                    celula: colaborador.celula,
                    valor: Number(mes.producao || 0),
                    detalhe: `${formatarNumero(mes.percentual)}% da meta`
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.valor - a.valor)[0];

        const maisConstante = colaboradores
            .map(colaborador => {
                const ultimosMeses = colaborador.meses
                    .filter(mes => !competencia || mes.competencia <= competencia)
                    .slice(-3);

                if (ultimosMeses.length < 3) {
                    return null;
                }

                const media = ultimosMeses.reduce((total, mes) => total + Number(mes.percentual || 0), 0) / ultimosMeses.length;
                const menorMes = Math.min(...ultimosMeses.map(mes => Number(mes.percentual || 0)));

                return {
                    nome: colaborador.nome,
                    celula: colaborador.celula,
                    valor: media,
                    detalhe: `Menor mês: ${formatarNumero(menorMes)}%`
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.valor - a.valor)[0];

        return {
            maiorProducao,
            maisConstante
        };
    }

    function obterPodiosPorAtividade(competenciaSelecionada = null) {
        const competencia = competenciaSelecionada || estado.competencias[estado.competencias.length - 1];
        const atividades = [
            {
                chave: "contratosMarcados",
                titulo: "Contratações",
                descricao: "Quem mais marcou contratos na competência.",
                unidade: "contratos"
            },
            {
                chave: "prorrogacoes",
                titulo: "Prorrogações",
                descricao: "Quem mais realizou prorrogações na competência.",
                unidade: "prorrogações"
            },
            {
                chave: "ticketsResolvidos",
                titulo: "Tickets resolvidos",
                descricao: "Quem mais respondeu tickets na competência.",
                unidade: "tickets"
            },
            {
                chave: "sla",
                titulo: "SLA",
                descricao: "Menores tempos de SLA na competência.",
                unidade: "horas",
                menorMelhor: true
            }
        ];

        return atividades.map(atividade => {
            const destaques = [...estado.colaboradores.values()]
                .map(colaborador => {
                    const mes = colaborador.meses.find(item => item.competencia === competencia);
                    const valor = atividade.chave === "sla"
                        ? slaDoMes(mes)
                        : Number(mes?.principais?.[atividade.chave] || 0) + Number(mes?.extras?.[atividade.chave] || 0);

                    if (!mes || valor <= 0) {
                        return null;
                    }

                    return {
                        nome: colaborador.nome,
                        celula: colaborador.celula,
                        valor,
                        unidade: atividade.unidade
                    };
                })
                .filter(Boolean)
                .sort((a, b) => atividade.menorMelhor ? a.valor - b.valor : b.valor - a.valor)
                .slice(0, 3);

            return {
                ...atividade,
                competencia,
                destaques
            };
        });
    }

    function renderizarSeloPodio(posicao) {
        if (posicao === 1) {
            return `
                <span class="podium-leader-icons" aria-label="1º lugar">
                    <img class="podium-rank-img" src="../../assets/icones/primeiro.png" alt="1º">
                    <img class="podium-trophy-img" src="../../assets/icones/trofeu.png" alt="">
                </span>
            `;
        }

        const medalha = posicao === 2 ? "medalha-de-prata.png" : "medalha-de-bronze.png";
        const alt = posicao === 2 ? "2º lugar" : "3º lugar";

        return `<img class="podium-rank-img" src="../../assets/icones/${medalha}" alt="${alt}">`;
    }

    function renderizarPodio(titulo, descricao, destaques, tipo) {
        if (!destaques.length) {
            return `
                <section class="highlight-panel">
                    <div class="highlight-panel-heading">
                        <h3>${escaparHtml(titulo)}</h3>
                        <p>${escaparHtml(descricao)}</p>
                    </div>
                    <div class="empty-state">Ainda não há dados suficientes para este destaque.</div>
                </section>
            `;
        }

        const classes = ["first", "second", "third"];
        const ordemVisual = destaques.length > 1 ? [1, 0, 2] : [0];
        const cards = ordemVisual
            .filter(indice => destaques[indice])
            .map(indice => {
                const destaque = destaques[indice];
                const posicao = indice + 1;
                const metrica = tipo === "evolucao"
                    ? `+${formatarNumero(destaque.evolucao)} p.p.`
                    : (tipo === "sla" ? textoSla(destaque.sla) : `${formatarNumero(destaque.percentual)}%`);
                const detalhe = tipo === "evolucao"
                    ? `${formatarNumero(destaque.percentualAnterior)}% para ${formatarNumero(destaque.percentualAtual)}%`
                    : (tipo === "sla" ? `Melhor SLA em ${destaque.detalhe}` : `${formatarNumero(destaque.producao)} de ${formatarNumero(destaque.meta)} pontos`);
return `
                    <article class="podium-place ${classes[indice]} ${tipo === "evolucao" ? "growth" : ""}" style="--delay:${indice * 90}ms">
                        ${renderizarSeloPodio(posicao)}
                        ${avatarDestaque(destaque.nome)}
                        <strong>${escaparHtml(destaque.nome)}</strong>
                        <small>${escaparHtml(destaque.celula || "-")}</small>
                        <div class="podium-score">${metrica}</div>
                        <p>${detalhe}</p>
                    </article>
                `;
            })
            .join("");

        return `
            <section class="highlight-panel">
                <div class="highlight-panel-heading">
                    <h3>${escaparHtml(titulo)}</h3>
                    <p>${escaparHtml(descricao)}</p>
                </div>
                <div class="podium-board">${cards}</div>
            </section>
        `;
    }

    function renderizarPodioAtividade(atividade) {
        if (!atividade.destaques.length) {
            return "";
        }

        const classes = ["first", "second", "third"];
        const ordemVisual = atividade.destaques.length > 1 ? [1, 0, 2] : [0];
        const cards = ordemVisual
            .filter(indice => atividade.destaques[indice])
            .map(indice => {
                const destaque = atividade.destaques[indice];
                const posicao = indice + 1;
                const valor = atividade.chave === "sla" ? textoSla(destaque.valor) : formatarNumero(destaque.valor);
return `
                    <article class="podium-place activity ${classes[indice]}" style="--delay:${indice * 90}ms">
                        ${renderizarSeloPodio(posicao)}
                        ${avatarDestaque(destaque.nome)}
                        <strong title="${escaparHtml(destaque.nome)}">${escaparHtml(nomeCurto(destaque.nome))}</strong>
                        <small>${escaparHtml(destaque.celula || "-")}</small>
                        <div class="podium-score">${valor}</div>
                        <p>${escaparHtml(destaque.unidade)}</p>
                    </article>
                `;
            })
            .join("");

        return `
            <article class="activity-podium-card">
                <div class="highlight-panel-heading">
                    <div>
                        <h4>${escaparHtml(atividade.titulo)}</h4>
                        <p>${escaparHtml(atividade.descricao)}</p>
                    </div>
                </div>
                <div class="podium-board compact">${cards}</div>
            </article>
        `;
    }

    function renderizarPodiosAtividades(competenciaSelecionada = null) {
        const podios = obterPodiosPorAtividade(competenciaSelecionada)
            .map(renderizarPodioAtividade)
            .filter(Boolean)
            .join("");

        if (!podios) {
            return "";
        }

        return `
            <section class="highlight-panel activity-podium-section">
                <div class="highlight-panel-heading">
                    <div>
                        <h3>Pódio por atividade</h3>
                        <p>Top 3 por atividade e menor tempo de SLA na competência selecionada.</p>
                    </div>
                </div>
                <div class="activity-podium-grid">${podios}</div>
            </section>
        `;
    }

    function renderizarCardExtra(titulo, destaque, tipo) {
        if (!destaque) {
            return "";
        }

        const valor = tipo === "producao"
            ? formatarNumero(destaque.valor)
            : `${formatarNumero(destaque.valor)}%`;

        return `
            <article class="highlight-mini-card">
                <span>${escaparHtml(titulo)}</span>
                ${avatarDestaque(destaque.nome)}
                <strong>${escaparHtml(destaque.nome)}</strong>
                <small>${escaparHtml(destaque.celula || "-")}</small>
                <b>${valor}</b>
                <p>${escaparHtml(destaque.detalhe)}</p>
            </article>
        `;
    }

    function renderizarMuralDestaques() {
        const mural = document.getElementById("muralDestaques");
        const subtitulo = document.getElementById("competenciaDestaques");

        if (!mural) {
            return;
        }

        const competenciaSelecionada = competenciaDestaquesSelecionada();
        const { competencia, destaques } = obterDestaquesDaCompetencia(competenciaSelecionada);
        const evolucoes = obterEvolucoesMensais(competencia);
        const extras = obterDestaquesExtras(competencia);

        if (subtitulo && competencia) {
            subtitulo.textContent = `Destaques em ${labelCompetencia(competencia)}, com ranking atual, evolução mensal e reconhecimentos extras.`;
        }

        if (!destaques.length && !evolucoes.destaques.length) {
            mural.innerHTML = `<div class="empty-state">Nenhum destaque encontrado na última competência.</div>`;
            return;
        }

        mural.innerHTML = `
            ${renderizarPodio("Pódio da competência", `Melhores percentuais em ${labelCompetencia(competencia)}.`, destaques, "meta")}
            ${renderizarPodio("Pódio de evolução", evolucoes.competenciaAnterior ? `Maiores crescimentos de ${labelCompetencia(evolucoes.competenciaAnterior)} para ${labelCompetencia(evolucoes.competenciaAtual)}.` : "Maiores crescimentos de um mês para o outro.", evolucoes.destaques, "evolucao")}
            ${renderizarPodiosAtividades(competencia)}
            <section class="highlight-extras">
                ${renderizarCardExtra("Maior produção", extras.maiorProducao, "producao")}
                ${renderizarCardExtra("Maior constância", extras.maisConstante, "constancia")}
            </section>
        `;
    }

    function obterTendencia(meses) {
        const validos = meses.filter(item => Number.isFinite(item.percentual));

        if (validos.length < 2) {
            return {
                texto: "Sem histórico",
                classe: "neutral"
            };
        }

        const anterior = validos[validos.length - 2].percentual;
        const atual = validos[validos.length - 1].percentual;
        const diferenca = atual - anterior;

        if (diferenca >= 5) {
            return {
                texto: "Em alta",
                classe: "up"
            };
        }

        if (diferenca <= -5 && atual < 100) {
            return {
                texto: "Em queda",
                classe: "down"
            };
        }

        if (diferenca <= -5) {
            return {
                texto: "Acima da meta",
                classe: "neutral"
            };
        }

        return {
            texto: "Na mesma",
            classe: "neutral"
        };
    }

    function melhorMes(meses) {
        return [...meses].sort((a, b) => Number(b.percentual || 0) - Number(a.percentual || 0))[0] || null;
    }

    function atividadesPrincipaisDoColaborador(colaborador) {
        const atividades = new Set();

        colaborador.meses.forEach(mes => {
            Object.keys(mes.principais || {}).forEach(kpi => {
                if (kpi !== "sla") {
                    atividades.add(kpi);
                }
            });
        });

        return [...atividades].sort((a, b) => (nomesKpis[a] || a).localeCompare(nomesKpis[b] || b));
    }

    function valorAtividadeMes(mes, kpi) {
        return Number(mes?.principais?.[kpi] || 0);
    }

    function renderizarTabela(colaborador) {
        const tabela = document.getElementById("tabelaMensalColaborador");

        tabela.innerHTML = colaborador.meses.map(item => `
            <tr>
                <td>${labelCompetencia(item.competencia)}</td>
                <td>${formatarNumero(item.producao)}</td>
                <td>${formatarNumero(item.meta)}</td>
                <td><span class="badge ${item.percentual >= 100 ? "badge-success" : item.percentual >= 80 ? "badge-warning" : "badge-danger"}">${formatarNumero(item.percentual)}%</span></td>
                <td>${textoSla(slaDoMes(item))}</td>
            </tr>
        `).join("");
    }

    function renderizarGrafico(colaborador) {
        const canvas = document.getElementById("graficoColaborador");

        if (!canvas || typeof Chart === "undefined") {
            return;
        }

        if (typeof ChartDataLabels !== "undefined") {
            Chart.register(ChartDataLabels);
        }

        if (estado.grafico) {
            estado.grafico.destroy();
        }

        estado.grafico = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                labels: colaborador.meses.map(item => labelCompetencia(item.competencia)),
                datasets: [{
                    label: "% da meta",
                    data: colaborador.meses.map(item => item.percentual),
                    borderColor: "#003b71",
                    backgroundColor: "rgba(0, 94, 168, .12)",
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: .28,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: contexto => `${formatarNumero(contexto.parsed.y)}% da meta`
                        }
                    },
                    datalabels: {
                        display: contexto => Boolean(contexto.dataset.data[contexto.dataIndex]),
                        formatter: valor => `${formatarNumero(valor)}%`,
                        backgroundColor: "#003b71",
                        color: "#fff",
                        borderRadius: 5,
                        padding: 5,
                        align: "top",
                        anchor: "end",
                        font: { weight: "bold", size: 10 }
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

    function atividadesExtrasDoColaborador(colaborador) {
        const atividadesIgnoradas = new Set(["sla", "satisfacaoPositiva", "satisfacaoNegativa"]);
        const atividades = new Set();

        colaborador.meses.forEach(mes => {
            Object.keys(mes.extras || {}).forEach(kpi => {
                const valor = Number(mes.extras?.[kpi] || 0);

                if (!atividadesIgnoradas.has(kpi) && valor > 0) {
                    atividades.add(kpi);
                }
            });
        });

        return [...atividades].sort((a, b) => (nomesKpis[a] || a).localeCompare(nomesKpis[b] || b));
    }

    function renderizarGraficoAtividadesExtras(colaborador) {
        const canvas = document.getElementById("graficoAtividadesExtrasColaborador");

        if (!canvas || typeof Chart === "undefined") {
            return;
        }

        if (estado.graficoExtras) {
            estado.graficoExtras.destroy();
        }

        const atividades = atividadesExtrasDoColaborador(colaborador);
        const meses = colaborador.meses;
        const percentualExtrasPorMes = meses.map(mes => {
            const totalExtras = Object.entries(mes.extras || {})
                .filter(([kpi]) => !["sla", "satisfacaoPositiva", "satisfacaoNegativa"].includes(kpi))
                .reduce((soma, [, valor]) => soma + Number(valor || 0), 0);
            const totalPrincipais = Object.values(mes.principais || {})
                .reduce((soma, valor) => soma + Number(valor || 0), 0);
            const totalAtividades = totalPrincipais + totalExtras;

            return totalAtividades ? (totalExtras / totalAtividades) * 100 : 0;
        });

        if (!atividades.length) {
            estado.graficoExtras = new Chart(canvas.getContext("2d"), {
                type: "bar",
                data: {
                    labels: meses.map(item => labelCompetencia(item.competencia)),
                    datasets: [{
                        label: "Sem atividades não principais",
                        data: meses.map(() => 0),
                        borderColor: "#d8e3ef",
                        backgroundColor: "rgba(216, 227, 239, .45)"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                        datalabels: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true },
                        x: { grid: { display: false } }
                    }
                }
            });
            return;
        }

        estado.graficoExtras = new Chart(canvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: meses.map(item => labelCompetencia(item.competencia)),
                datasets: [
                    ...atividades.map((kpi, indice) => {
                        const cor = coresAtividadesExtras[indice % coresAtividadesExtras.length];

                        return {
                            type: "bar",
                            label: nomesKpis[kpi] || kpi,
                            data: meses.map(mes => Number(mes.extras?.[kpi] || 0)),
                            borderColor: cor,
                            backgroundColor: `${cor}CC`,
                            borderWidth: 1,
                            borderRadius: 6,
                            yAxisID: "y"
                        };
                    }),
                    {
                        type: "line",
                        label: "% não principais no total",
                        data: percentualExtrasPorMes,
                        borderColor: "#111827",
                        backgroundColor: "rgba(17, 24, 39, .12)",
                        borderWidth: 3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: .32,
                        fill: false,
                        yAxisID: "yPercentual"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            font: { weight: "bold", size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: contexto => contexto.dataset.yAxisID === "yPercentual"
                                ? `${contexto.dataset.label}: ${formatarNumero(contexto.parsed.y)}%`
                                : `${contexto.dataset.label}: ${formatarNumero(contexto.parsed.y)}`
                        }
                    },
                    datalabels: {
                        display: contexto => Number(contexto.dataset.data[contexto.dataIndex] || 0) > 0,
                        formatter: (valor, contexto) => contexto.dataset.yAxisID === "yPercentual"
                            ? `${formatarNumero(valor)}%`
                            : formatarNumero(valor),
                        backgroundColor: contexto => contexto.dataset.borderColor,
                        color: "#fff",
                        borderRadius: 5,
                        padding: 4,
                        align: "top",
                        anchor: "end",
                        font: { weight: "bold", size: 9 },
                        clip: false,
                        clamp: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        position: "left",
                        title: {
                            display: true,
                            text: "Atividades não principais"
                        },
                        ticks: {
                            callback: valor => formatarNumero(valor)
                        }
                    },
                    yPercentual: {
                        beginAtZero: true,
                        position: "right",
                        grid: { drawOnChartArea: false },
                        title: {
                            display: true,
                            text: "% não principais no total"
                        },
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

    function renderizarResumoAtividades(colaborador) {
        const cabecalho = document.getElementById("cabecalhoAtividadesColaborador");
        const corpo = document.getElementById("resumoAtividadesColaborador");

        if (!cabecalho || !corpo) {
            return;
        }

        const atividades = atividadesPrincipaisDoColaborador(colaborador);
        const meses = colaborador.meses;
        const colunasAtividades = atividades
            .map(kpi => `<th>${escaparHtml(nomesKpis[kpi] || kpi)}</th>`)
            .join("");

        cabecalho.innerHTML = `
            <tr>
                <th>Mês</th>
                ${colunasAtividades}
                <th>Total</th>
            </tr>
        `;

        if (!atividades.length) {
            corpo.innerHTML = `<tr><td colspan="2">Nenhuma atividade principal encontrada.</td></tr>`;
            return;
        }

        const linhasMeses = meses.map(mes => {
            const valores = atividades.map(kpi => valorAtividadeMes(mes, kpi));

            return `
                <tr>
                    <td><strong>${labelCompetencia(mes.competencia)}</strong></td>
                    ${valores.map(valor => `<td>${formatarNumero(valor)}</td>`).join("")}
                    <td></td>
                </tr>
            `;
        }).join("");

        const totaisAtividades = atividades.map(kpi => meses.reduce((soma, mes) => soma + valorAtividadeMes(mes, kpi), 0));
        const totalAno = totaisAtividades.reduce((soma, valor) => soma + valor, 0);

        corpo.innerHTML = `
            ${linhasMeses}
            <tr class="activity-total-row">
                <td><strong>Total do ano</strong></td>
                ${totaisAtividades.map(valor => `<td><b>${formatarNumero(valor)}</b></td>`).join("")}
                <td><b>${formatarNumero(totalAno)}</b></td>
            </tr>
        `;
    }

    function selecionarColaborador(id) {
        const painel = document.getElementById("painelColaborador");

        if (!id || !estado.colaboradores.has(id)) {
            painel.hidden = true;
            return;
        }

        const colaborador = estado.colaboradores.get(id);
        const meses = colaborador.meses;
        const ultimo = meses[meses.length - 1];
        const melhor = melhorMes(meses);
        const tendencia = obterTendencia(meses);

        painel.hidden = false;
        document.getElementById("colaboradorAvatar").outerHTML = avatarColaborador(colaborador.nome, colaborador.email);
        document.getElementById("colaboradorNome").textContent = colaborador.nome;
        document.getElementById("colaboradorSubtitulo").textContent = `${colaborador.celula || "-"} | ${colaborador.email || "-"} | ${colaborador.jornada?.tipo || "-"}`;
        document.getElementById("colaboradorUltimaMeta").textContent = `${formatarNumero(ultimo?.percentual || 0)}%`;
        document.getElementById("colaboradorMelhorMes").textContent = melhor ? `${labelCompetencia(melhor.competencia)} (${formatarNumero(melhor.percentual)}%)` : "-";
        document.getElementById("colaboradorTendencia").textContent = tendencia.texto;
        document.getElementById("colaboradorTendencia").className = `trend-${tendencia.classe}`;
        document.getElementById("colaboradorMeses").textContent = formatarNumero(meses.length);
        document.getElementById("colaboradorSla").textContent = textoSla(mediaSlaColaborador(colaborador));

        renderizarTabela(colaborador);
        renderizarGrafico(colaborador);
        renderizarGraficoAtividadesExtras(colaborador);
        renderizarResumoAtividades(colaborador);
    }

    document.getElementById("selectColaborador")?.addEventListener("change", event => selecionarColaborador(event.target.value));
    document.getElementById("filtroCompetenciaDestaques")?.addEventListener("change", renderizarMuralDestaques);

    aguardarUsuarioAutenticado().then(usuario => {
        if (!usuario) {
            setStatus("error", "Sessão expirada. Saia e entre novamente para carregar colaboradores.");
            return null;
        }

        return carregarDados();
    }).catch(erro => {
        console.error(erro);
        setStatus("error", `Erro ao carregar colaboradores: ${erro.message}`);
    });
})();
