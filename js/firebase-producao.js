(async function iniciarFirebaseProducao() {
    const firebaseApp = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const firestore = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    const {
        collection,
        doc,
        getDocsFromServer,
        initializeFirestore,
        memoryLocalCache,
        onSnapshot,
        serverTimestamp,
        setDoc,
        writeBatch
    } = firestore;

    const firebaseConfig = {
        apiKey: "AIzaSyD7OHPZ8flOUGyCrdL3Sp-ZTASj03Dbn94",
        authDomain: "portal-producao-d3a08.firebaseapp.com",
        projectId: "portal-producao-d3a08",
        storageBucket: "portal-producao-d3a08.firebasestorage.app",
        messagingSenderId: "881576324700",
        appId: "1:881576324700:web:c68bdbe4c309d5fd1f4099"
    };

    const app = firebaseApp.initializeApp(firebaseConfig);
    const db = initializeFirestore(app, { localCache: memoryLocalCache() });
    const CHUNK_SIZE = 300;
    const docAtual = doc(db, "producao", "atual");
    const paginaImportacao = Boolean(document.getElementById("arquivoProducao"));
    const paginaProducao = Boolean(document.getElementById("filtroCompetenciaVisualizada"));
    const TODAS_ATIVIDADES_PARAMETRO = "__todas_atividades__";
    let competenciaAtualVigente = null;
    let filtroCompetenciaManual = false;

    function setStatus(tipo, texto) {
        const resultado = document.getElementById("resultadoImportacao");

        if (!resultado) {
            return;
        }

        resultado.className = `status-message ${tipo || "muted"}`;
        resultado.textContent = texto;
    }

    function slug(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    }

    function getCompetenciaDoc(competencia) {
        return doc(db, "producao_competencias", competencia);
    }

    function getChunksCollection(competencia) {
        return collection(db, "producao_competencias", competencia, "chunks");
    }

    function getComentariosCollection(competencia) {
        return collection(db, "producao_comentarios", competencia, "itens");
    }

    function getAvaliacoesMetaCollection(competencia) {
        return collection(db, "producao_avaliacoes_meta", competencia, "itens");
    }

    function getParametrosMetasCollection() {
        return collection(db, "parametros_metas");
    }

    function getParametrosKpisCollection() {
        return collection(db, "parametros_kpis_celula");
    }

    function getHistoricoParametrosCollection() {
        return collection(db, "parametros_historico");
    }

    function proximaCompetencia(competencia) {
        const ano = Number(String(competencia).slice(0, 4));
        const mes = Number(String(competencia).slice(5, 7));
        const data = new Date(ano, mes, 1);

        return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    }

    function zerarProducaoDasLinhas(linhas) {
        return linhas.map(linha => {
            const zerada = { ...linha };

            Object.keys(nomesKpis).forEach(kpi => {
                zerada[kpi] = 0;
            });

            return zerada;
        });
    }

    function chaveParametroMetaFirebase(competencia, celula, kpi) {
        return `${competencia || "geral"}_${slug(celula)}_${kpi}`;
    }

    function chaveParametroMetaLocal(competencia, celula, kpi) {
        return `${competencia || "geral"}|${celula || "Sem célula"}|${kpi}`;
    }

    function chaveParametroKpisFirebase(competencia, celula) {
        return `${competencia || "geral"}_${slug(celula)}`;
    }

    function chaveParametroKpisLocal(competencia, celula) {
        return `${competencia || "geral"}|${celula || "Sem célula"}`;
    }

    function pesosPadraoVelocimetro() {
        return {
            contratosMarcados: 1.4,
            prorrogacoes: 1,
            alteracoes: .7,
            contratosDesligados: 1.3,
            ticketsResolvidos: .9
        };
    }

    function preencherSelectKpisParametros() {
        const select = document.getElementById("parametroMetaKpi");

        if (!select || select.dataset.configurado) {
            return;
        }

        select.innerHTML = `<option value="${TODAS_ATIVIDADES_PARAMETRO}">Todas as atividades da célula</option>` + Object.keys(nomesKpis)
            .map(kpi => `<option value="${kpi}">${nomesKpis[kpi]}</option>`)
            .join("");
        select.dataset.configurado = "1";
    }

    function atividadesSelecionadasParametroMeta(kpi) {
        if (kpi === TODAS_ATIVIDADES_PARAMETRO) {
            return Object.keys(nomesKpis);
        }

        return kpi ? [kpi] : [];
    }

    function rotuloAtividadeParametro(kpi) {
        return kpi === TODAS_ATIVIDADES_PARAMETRO ? "Todas as atividades" : (nomesKpis[kpi] || kpi);
    }

    function preencherPesosVelocimetro() {
        const container = document.getElementById("parametrosPesosVelocimetro");

        if (!container) {
            return;
        }

        const pesos = {
            ...pesosPadraoVelocimetro(),
            ...(window.dadosProducao.parametros?.pesos || {})
        };

        container.innerHTML = Object.keys(nomesKpis)
            .filter(kpi => kpi !== "sla")
            .map(kpi => `
            <label class="parameter-weight-row">
                <span>${nomesKpis[kpi]}</span>
                <input type="number" min="0" step="0.1" data-kpi="${kpi}" value="${pesos[kpi] ?? 1}">
            </label>
        `).join("");
    }

    async function preencherSelectCelulasParametros() {
        const selects = [
            document.getElementById("parametroMetaCelula"),
            document.getElementById("parametroKpiCelula")
        ].filter(Boolean);

        if (!selects.length) {
            return;
        }

        const competencias = await listarCompetenciasSalvas();
        const celulas = new Set();

        for (const competencia of competencias.slice(-6)) {
            const linhas = await carregarLinhasDaCompetencia(competencia);
            linhas.forEach(linha => {
                if (linha.celula) {
                    celulas.add(linha.celula);
                }
            });
        }

        const opcoes = [...celulas].sort((a, b) => a.localeCompare(b));

        const html = opcoes.length
            ? `<option value="">Selecione</option>${opcoes.map(celula => `<option value="${celula}">${celula}</option>`).join("")}`
            : `<option value="">Nenhuma célula encontrada</option>`;

        selects.forEach(select => {
            const valorAtual = select.value;
            select.innerHTML = html;
            if (valorAtual && opcoes.includes(valorAtual)) {
                select.value = valorAtual;
            }
        });
    }

    function obterKpisConfiguradosCelula(competencia, celula) {
        const parametros = window.dadosProducao.parametros?.kpisCelula || {};
        const exato = parametros[chaveParametroKpisLocal(competencia, celula)];

        if (exato) {
            return exato.kpis || [];
        }

        const anteriores = Object.values(parametros)
            .filter(parametro => parametro.celula === celula)
            .filter(parametro => parametro.competencia && parametro.competencia !== "geral")
            .filter(parametro => !competencia || parametro.competencia <= competencia)
            .sort((a, b) => b.competencia.localeCompare(a.competencia));

        return anteriores[0]?.kpis || obterKpisPrincipais(celula);
    }

    function renderizarKpisCelulaParametros() {
        const container = document.getElementById("parametrosKpisCelula");
        const competencia = document.getElementById("parametroKpiCompetencia")?.value || document.getElementById("competenciaProducao")?.value || competenciaAtualVigente;
        const celula = document.getElementById("parametroKpiCelula")?.value;

        if (!container) {
            return;
        }

        const selecionados = new Set(celula ? obterKpisConfiguradosCelula(competencia, celula) : []);

        container.innerHTML = Object.keys(nomesKpis).map(kpi => `
            <label>
                <input type="checkbox" value="${kpi}" ${selecionados.has(kpi) ? "checked" : ""}>
                <span>${nomesKpis[kpi]}</span>
            </label>
        `).join("");
    }

    function preencherCompetenciaParametros(competencia) {
        const competenciaMeta = document.getElementById("parametroMetaCompetencia");
        const competenciaKpi = document.getElementById("parametroKpiCompetencia");
        const competenciaImportacao = document.getElementById("competenciaProducao");

        if (competenciaMeta && !competenciaMeta.value) {
            competenciaMeta.value = competenciaImportacao?.value || competencia || "";
        }

        if (competenciaKpi && !competenciaKpi.value) {
            competenciaKpi.value = competenciaImportacao?.value || competencia || "";
        }
    }

    function configurarEventosParametros() {
        const celulaKpi = document.getElementById("parametroKpiCelula");
        const competenciaKpi = document.getElementById("parametroKpiCompetencia");

        if (celulaKpi && !celulaKpi.dataset.configurado) {
            celulaKpi.addEventListener("change", renderizarKpisCelulaParametros);
            celulaKpi.dataset.configurado = "1";
        }

        if (competenciaKpi && !competenciaKpi.dataset.configurado) {
            competenciaKpi.addEventListener("change", renderizarKpisCelulaParametros);
            competenciaKpi.dataset.configurado = "1";
        }
    }

    function formatarDataHistorico(valor) {
        if (!valor) {
            return "-";
        }

        const data = valor.toDate ? valor.toDate() : new Date(valor);
        return Number.isNaN(data.getTime()) ? "-" : data.toLocaleString("pt-BR");
    }

    async function carregarParametrosProducao(competencia = null) {
        const metasSnap = await getDocsFromServer(getParametrosMetasCollection());
        const metas = {};

        metasSnap.forEach(item => {
            const data = item.data();

            if (!data.competencia || !data.celula || !data.kpi) {
                return;
            }

            metas[chaveParametroMetaLocal(data.competencia, data.celula, data.kpi)] = data;
        });

        const kpisSnap = await getDocsFromServer(getParametrosKpisCollection());
        const kpisCelula = {};

        kpisSnap.forEach(item => {
            const data = item.data();

            if (!data.competencia || !data.celula || !Array.isArray(data.kpis)) {
                return;
            }

            kpisCelula[chaveParametroKpisLocal(data.competencia, data.celula)] = data;
        });

        let pesos = {};
        const pesosSnap = await getDocsFromServer(collection(db, "parametros"));
        pesosSnap.forEach(item => {
            if (item.id === "velocimetro") {
                pesos = item.data().pesos || {};
            }
        });

        window.dadosProducao.parametros = {
            metas,
            pesos,
            kpisCelula
        };

        preencherSelectKpisParametros();
        await preencherSelectCelulasParametros();
        preencherPesosVelocimetro();
        preencherCompetenciaParametros(competencia);
        configurarEventosParametros();
        renderizarKpisCelulaParametros();

        if (paginaImportacao) {
            await renderizarHistoricoParametros();
        }
    }

    window.carregarParametrosProducao = carregarParametrosProducao;

    async function registrarHistoricoParametros(payload) {
        const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

        await setDoc(doc(getHistoricoParametrosCollection(), id), {
            ...payload,
            criadoEm: serverTimestamp()
        });
    }

    async function renderizarHistoricoParametros() {
        const tabela = document.getElementById("historicoParametrosProducao");

        if (!tabela) {
            return;
        }

        const snap = await getDocsFromServer(getHistoricoParametrosCollection());
        const linhas = [];

        snap.forEach(item => linhas.push(item.data()));
        linhas.sort((a, b) => {
            const dataA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
            const dataB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
            return dataB - dataA;
        });

        tabela.innerHTML = linhas.slice(0, 20).map(item => `
            <tr>
                <td>${formatarDataHistorico(item.criadoEm)}</td>
                <td>${item.tipo || "-"}</td>
                <td>${item.competencia || "-"}</td>
                <td>${item.detalhe || "-"}</td>
                <td>${item.valorNovo || "-"}</td>
            </tr>
        `).join("") || `<tr><td colspan="5">Nenhuma alteração registrada.</td></tr>`;
    }

    window.salvarParametroMeta = async function salvarParametroMeta() {
        const competencia = document.getElementById("parametroMetaCompetencia")?.value;
        const celula = document.getElementById("parametroMetaCelula")?.value;
        const kpi = document.getElementById("parametroMetaKpi")?.value;
        const percentualAcrescimo = Number(document.getElementById("parametroMetaPercentual")?.value || 10);
        const metaManual = Number(document.getElementById("parametroMetaManual")?.value || 0);
        const observacao = document.getElementById("parametroMetaObservacao")?.value?.trim() || "";
        const atividades = atividadesSelecionadasParametroMeta(kpi);

        if (!competencia || !celula || !atividades.length) {
            alert("Informe competência, célula e atividade para salvar a meta.");
            return;
        }

        await Promise.all(atividades.map(atividade => {
            const dados = {
                competencia,
                celula,
                kpi: atividade,
                percentualAcrescimo,
                metaManual,
                observacao,
                atualizadoEm: serverTimestamp()
            };

            return setDoc(doc(getParametrosMetasCollection(), chaveParametroMetaFirebase(competencia, celula, atividade)), dados, { merge: true });
        }));

        await registrarHistoricoParametros({
            tipo: "Meta",
            competencia,
            detalhe: `${celula} / ${rotuloAtividadeParametro(kpi)}`,
            valorNovo: metaManual > 0 ? `Meta manual ${metaManual}` : `${percentualAcrescimo}%`,
            observacao
        });
        await carregarParametrosProducao(competencia);
        setStatus("success", atividades.length > 1 ? "Parâmetros de meta salvos para todas as atividades da célula." : "Parâmetro de meta salvo com sucesso.");
    };

    window.voltarParametroMetaPadrao = async function voltarParametroMetaPadrao() {
        const competencia = document.getElementById("parametroMetaCompetencia")?.value;
        const celula = document.getElementById("parametroMetaCelula")?.value;
        const kpi = document.getElementById("parametroMetaKpi")?.value;
        const atividades = atividadesSelecionadasParametroMeta(kpi);

        if (!competencia || !celula || !atividades.length) {
            alert("Informe competência, célula e atividade para voltar a meta ao padrão.");
            return;
        }

        await Promise.all(atividades.map(atividade => {
            const dados = {
                competencia,
                celula,
                kpi: atividade,
                percentualAcrescimo: 10,
                metaManual: 0,
                observacao: "Voltou ao padrão",
                atualizadoEm: serverTimestamp()
            };

            return setDoc(doc(getParametrosMetasCollection(), chaveParametroMetaFirebase(competencia, celula, atividade)), dados, { merge: true });
        }));

        await registrarHistoricoParametros({
            tipo: "Meta",
            competencia,
            detalhe: `${celula} / ${rotuloAtividadeParametro(kpi)}`,
            valorNovo: "Padrão 10%",
            observacao: "Voltou ao padrão"
        });

        const percentual = document.getElementById("parametroMetaPercentual");
        const manual = document.getElementById("parametroMetaManual");
        const observacaoCampo = document.getElementById("parametroMetaObservacao");

        if (percentual) percentual.value = 10;
        if (manual) manual.value = "";
        if (observacaoCampo) observacaoCampo.value = "";

        await carregarParametrosProducao(competencia);
        setStatus("success", atividades.length > 1 ? "Metas de todas as atividades voltaram ao padrão." : "Meta voltou ao padrão.");
    };
    window.salvarParametrosPesos = async function salvarParametrosPesos() {
        const inputs = [...document.querySelectorAll("#parametrosPesosVelocimetro input[data-kpi]")];
        const pesos = {};

        inputs.forEach(input => {
            pesos[input.dataset.kpi] = Number(input.value || 1);
        });

        await setDoc(doc(db, "parametros", "velocimetro"), {
            pesos,
            atualizadoEm: serverTimestamp()
        }, { merge: true });
        await registrarHistoricoParametros({
            tipo: "Peso velocímetro",
            competencia: "geral",
            detalhe: "Pesos por atividade",
            valorNovo: "Pesos atualizados"
        });
        await carregarParametrosProducao();
        setStatus("success", "Pesos do velocímetro salvos com sucesso.");
    };

    window.voltarPesosPadrao = async function voltarPesosPadrao() {
        const pesos = pesosPadraoVelocimetro();

        await setDoc(doc(db, "parametros", "velocimetro"), {
            pesos,
            atualizadoEm: serverTimestamp()
        }, { merge: true });
        await registrarHistoricoParametros({
            tipo: "Peso velocímetro",
            competencia: "geral",
            detalhe: "Pesos por atividade",
            valorNovo: "Pesos padrão"
        });
        window.dadosProducao.parametros.pesos = pesos;
        preencherPesosVelocimetro();
        await renderizarHistoricoParametros();
        setStatus("success", "Pesos do velocímetro voltaram ao padrão.");
    };

    window.salvarParametrosKpisCelula = async function salvarParametrosKpisCelula() {
        const competencia = document.getElementById("parametroKpiCompetencia")?.value;
        const celula = document.getElementById("parametroKpiCelula")?.value;
        const kpis = [...document.querySelectorAll("#parametrosKpisCelula input:checked")].map(input => input.value);

        if (!competencia || !celula || !kpis.length) {
            alert("Informe competência, célula e selecione pelo menos uma atividade.");
            return;
        }

        const dados = {
            competencia,
            celula,
            kpis,
            atualizadoEm: serverTimestamp()
        };

        await setDoc(doc(getParametrosKpisCollection(), chaveParametroKpisFirebase(competencia, celula)), dados, { merge: true });
        await registrarHistoricoParametros({
            tipo: "Atividades da célula",
            competencia,
            detalhe: celula,
            valorNovo: kpis.map(kpi => nomesKpis[kpi] || kpi).join(", ")
        });
        await carregarParametrosProducao(competencia);
        setStatus("success", "Atividades ativas da célula salvas com sucesso.");
    };

    window.voltarKpisCelulaPadrao = async function voltarKpisCelulaPadrao() {
        const competencia = document.getElementById("parametroKpiCompetencia")?.value;
        const celula = document.getElementById("parametroKpiCelula")?.value;
        const kpis = obterKpisPrincipaisPadrao(celula);

        if (!competencia || !celula || !kpis.length) {
            alert("Informe competência e célula para voltar às atividades padrão.");
            return;
        }

        await setDoc(doc(getParametrosKpisCollection(), chaveParametroKpisFirebase(competencia, celula)), {
            competencia,
            celula,
            kpis,
            atualizadoEm: serverTimestamp()
        }, { merge: true });
        await registrarHistoricoParametros({
            tipo: "Atividades da célula",
            competencia,
            detalhe: celula,
            valorNovo: "Atividades padrão"
        });
        await carregarParametrosProducao(competencia);
        setStatus("success", "Atividades da célula voltaram ao padrão.");
    };

    async function limparChunks(competencia) {
        const snap = await getDocsFromServer(getChunksCollection(competencia));

        if (snap.empty) {
            return;
        }

        let batch = writeBatch(db);
        let operacoes = 0;

        for (const item of snap.docs) {
            batch.delete(item.ref);
            operacoes += 1;

            if (operacoes >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                operacoes = 0;
            }
        }

        if (operacoes > 0) {
            await batch.commit();
        }
    }

    async function gravarChunks(competencia, linhas) {
        await limparChunks(competencia);

        let batch = writeBatch(db);
        let operacoes = 0;

        for (let i = 0; i < linhas.length; i += CHUNK_SIZE) {
            const ordem = i / CHUNK_SIZE;
            const chunkRef = doc(getChunksCollection(competencia), String(ordem).padStart(4, "0"));

            batch.set(chunkRef, {
                order: ordem,
                rows: linhas.slice(i, i + CHUNK_SIZE)
            });

            operacoes += 1;

            if (operacoes >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                operacoes = 0;
            }
        }

        if (operacoes > 0) {
            await batch.commit();
        }
    }

    async function carregarLinhasDaCompetencia(competencia) {
        const snap = await getDocsFromServer(getChunksCollection(competencia));
        const chunks = [];

        snap.forEach(item => chunks.push(item.data()));
        chunks.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

        return chunks.flatMap(chunk => chunk.rows || []);
    }

    async function carregarComentarios(competencia) {
        const comentarios = {};

        if (!competencia) {
            window.dadosProducao.comentarios = comentarios;
            return comentarios;
        }

        const snap = await getDocsFromServer(getComentariosCollection(competencia));

        snap.forEach(item => {
            const data = item.data();

            if (data.funcionarioId) {
                comentarios[data.funcionarioId] = data.comentario || "";
            }
        });

        window.dadosProducao.comentarios = comentarios;
        return comentarios;
    }

    async function carregarAvaliacoesMeta(competencia) {
        const avaliacoes = {};

        if (!competencia) {
            window.dadosProducao.avaliacoesMeta = avaliacoes;
            return avaliacoes;
        }

        const snap = await getDocsFromServer(getAvaliacoesMetaCollection(competencia));

        snap.forEach(item => {
            const data = item.data();

            if (data.funcionarioId) {
                avaliacoes[data.funcionarioId] = {
                    semanasAtivas: Number(data.semanasAtivas ?? 4),
                    motivo: data.motivo || "",
                    observacao: data.observacao || ""
                };
            }
        });

        window.dadosProducao.avaliacoesMeta = avaliacoes;
        return avaliacoes;
    }

    window.salvarComentarioProducao = async function salvarComentarioProducao(funcionarioId, comentario) {
        const competencia = window.dadosProducao.competencia;

        if (!competencia || !funcionarioId) {
            return;
        }

        const id = slug(funcionarioId) || "sem-id";
        await setDoc(doc(getComentariosCollection(competencia), id), {
            competencia,
            funcionarioId,
            comentario: String(comentario || ""),
            atualizadoEm: serverTimestamp()
        }, { merge: true });
    };

    window.salvarAvaliacaoMetaProducao = async function salvarAvaliacaoMetaProducao(funcionarioId, avaliacao) {
        const competencia = window.dadosProducao.competencia;

        if (!competencia || !funcionarioId) {
            return;
        }

        const semanasAtivas = Math.max(0, Math.min(4, Number(avaliacao?.semanasAtivas ?? 4)));
        const id = slug(funcionarioId) || "sem-id";

        await setDoc(doc(getAvaliacoesMetaCollection(competencia), id), {
            competencia,
            funcionarioId,
            semanasAtivas,
            motivo: String(avaliacao?.motivo || ""),
            observacao: String(avaliacao?.observacao || ""),
            atualizadoEm: serverTimestamp()
        }, { merge: true });
    };

    async function listarCompetenciasSalvas() {
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

    async function obterCompetenciaMaisRecente() {
        const competencias = await listarCompetenciasSalvas();

        return competencias.at(-1) || competenciaAtualVigente;
    }

    function montarHistoricoDaCompetencia(competencia, linhas) {
        return linhas.map(linha => ({
            ...linha,
            competencia
        }));
    }

    async function carregarHistorico(competenciaAtual) {
        const competencias = await listarCompetenciasSalvas();
        const anoAtual = String(competenciaAtual || "").slice(0, 4);
        const ultimas = competencias
            .filter(competencia => competencia !== competenciaAtual)
            .filter(competencia => !anoAtual || competencia.startsWith(anoAtual))
            .filter(competencia => !competenciaAtual || competencia < competenciaAtual)
            .sort((a, b) => a.localeCompare(b))
            .slice(-12);

        const historico = [];

        for (const competencia of ultimas) {
            const linhas = await carregarLinhasDaCompetencia(competencia);
            historico.push(...montarHistoricoDaCompetencia(competencia, linhas));
        }

        window.dadosProducao.historico = historico;
    }

    window.carregarHistoricoProducao = carregarHistorico;

    function atualizarCompetenciaNaTela(competencia) {
        const input = document.getElementById("competenciaProducao");
        const filtro = document.getElementById("filtroCompetenciaVisualizada");

        if (input && competencia) {
            input.value = competencia;
        }

        if (filtro && competencia) {
            filtro.value = competencia;
        }
    }

    async function preencherFiltroCompetencias(competenciaAtiva) {
        const filtro = document.getElementById("filtroCompetenciaVisualizada");

        if (!filtro) {
            return;
        }

        const competencias = await listarCompetenciasSalvas();
        const opcoes = competencias
            .slice()
            .sort((a, b) => b.localeCompare(a))
            .map(competencia => `<option value="${competencia}">${competencia}</option>`)
            .join("");

        filtro.innerHTML = `<option value="">Competência vigente</option>${opcoes}`;

        if (competenciaAtiva) {
            filtro.value = competenciaAtiva;
        }
    }

    async function salvarCalculoMetas(competencia) {
        let batch = writeBatch(db);
        let operacoes = 0;

        Object.keys(window.dadosProducao.metas).forEach(celula => {
            Object.keys(window.dadosProducao.metas[celula]).forEach(kpi => {
                const item = window.dadosProducao.metas[celula][kpi];
                const id = `${competencia}_${slug(celula)}_${kpi}`;
                const ref = doc(db, "calculo_metas", id);

                batch.set(ref, {
                    competencia,
                    celula,
                    kpi,
                    mediaUltimos5Meses: item.media,
                    percentualAcrescimo: item.percentualAcrescimo ?? 10,
                    metaManual: item.metaManual || 0,
                    metaOriginal: item.metaOriginal || item.meta,
                    pisoIndividual8h: item.pisoIndividual8h || 0,
                    metaFinal: item.meta,
                    producaoRealizada: item.total,
                    percentualCumprimento: item.percentual,
                    quantidadeFuncionarios: item.quantidadeFuncionarios,
                    fonte: item.fonte,
                    dataCalculo: serverTimestamp()
                });

                operacoes += 1;
            });
        });

        if (operacoes > 0) {
            await batch.commit();
        }
    }

    window.salvarProducaoNoFirebase = async function salvarProducaoNoFirebase(linhasPadronizadas) {
        const competencia = window.dadosProducao.competencia;

        if (!competencia) {
            throw new Error("Informe a competência antes de salvar a produção.");
        }

        setStatus("muted", "Salvando produção no Firebase...");

        await gravarChunks(competencia, linhasPadronizadas);

        await setDoc(getCompetenciaDoc(competencia), {
            competencia,
            totalRows: linhasPadronizadas.length,
            chunkSize: CHUNK_SIZE,
            atualizadoEm: serverTimestamp()
        }, { merge: true });

        await setDoc(docAtual, {
            competencia,
            totalRows: linhasPadronizadas.length,
            atualizadoEm: serverTimestamp()
        }, { merge: true });

        competenciaAtualVigente = competencia;

        await salvarCalculoMetas(competencia);

        setStatus("success", `Produção ${competencia} salva no Firebase com ${formatarNumero(linhasPadronizadas.length)} registros.`);
    };

    async function carregarProducaoSalva(meta) {
        if (!meta?.competencia) {
            setStatus("muted", "Firebase conectado. Nenhuma produção publicada ainda.");
            return;
        }

        setStatus("muted", `Carregando produção ${meta.competencia} do Firebase...`);

        await preencherFiltroCompetencias(meta.competencia);
        atualizarCompetenciaNaTela(meta.competencia);
        await carregarParametrosProducao(meta.competencia);
        await carregarHistorico(meta.competencia);
        await carregarAvaliacoesMeta(meta.competencia);

        const linhas = await carregarLinhasDaCompetencia(meta.competencia);
        window.dadosProducao.competencia = meta.competencia;

        processarProducao(linhas);
        await carregarComentarios(meta.competencia);
        atualizarDashboardProducao();

        setStatus("success", `Produção ${meta.competencia} carregada do Firebase com ${formatarNumero(linhas.length)} registros.`);
    }

    async function carregarCompetenciaMaisRecente() {
        const competencia = await obterCompetenciaMaisRecente();

        if (!competencia) {
            setStatus("muted", "Firebase conectado. Nenhuma produção publicada ainda.");
            return;
        }

        competenciaAtualVigente = competencia;
        await carregarProducaoSalva({ competencia });
    }

    async function carregarPreviaProximaCompetencia() {
        const competenciaBase = await obterCompetenciaMaisRecente();

        if (!competenciaBase) {
            setStatus("error", "Nenhuma competência vigente encontrada para gerar a prévia.");
            return;
        }

        competenciaAtualVigente = competenciaBase;

        const competenciaPrevia = proximaCompetencia(competenciaBase);
        setStatus("muted", `Gerando prévia ${competenciaPrevia} com base em ${competenciaBase}...`);

        const linhasBase = await carregarLinhasDaCompetencia(competenciaBase);
        const linhasZeradas = zerarProducaoDasLinhas(linhasBase);

        await carregarParametrosProducao(competenciaPrevia);
        await carregarHistorico(competenciaPrevia);

        window.dadosProducao.competencia = competenciaPrevia;
        window.dadosProducao.comentarios = {};
        window.dadosProducao.avaliacoesMeta = {};

        processarProducao(linhasZeradas);
        atualizarDashboardProducao();

        const filtro = document.getElementById("filtroCompetenciaVisualizada");

        if (filtro) {
            filtro.value = "";
        }

        setStatus("success", `Prévia ${competenciaPrevia} gerada com ${formatarNumero(linhasZeradas.length)} colaboradores zerados. Esta visualização não foi salva no Firebase.`);
    }

    function configurarFiltroCompetencia() {
        const filtro = document.getElementById("filtroCompetenciaVisualizada");
        const limpar = document.getElementById("limparCompetenciaVisualizada");
        const previa = document.getElementById("verPreviaProximaCompetencia");

        if (filtro && !filtro.dataset.configurado) {
            filtro.addEventListener("change", async () => {
                filtroCompetenciaManual = Boolean(filtro.value);
                const competencia = filtro.value || await obterCompetenciaMaisRecente();

                if (competencia) {
                    carregarProducaoSalva({ competencia }).catch(erro => {
                        console.error(erro);
                        setStatus("error", `Erro ao carregar competência: ${erro.message}`);
                    });
                }
            });
            filtro.dataset.configurado = "1";
        }

        if (limpar && !limpar.dataset.configurado) {
            limpar.addEventListener("click", () => {
                filtroCompetenciaManual = false;

                if (filtro) {
                    filtro.value = "";
                }

                carregarCompetenciaMaisRecente().catch(erro => {
                    console.error(erro);
                    setStatus("error", `Erro ao limpar filtro: ${erro.message}`);
                });
            });
            limpar.dataset.configurado = "1";
        }

        if (previa && !previa.dataset.configurado) {
            previa.addEventListener("click", () => {
                filtroCompetenciaManual = false;
                carregarPreviaProximaCompetencia().catch(erro => {
                    console.error(erro);
                    setStatus("error", `Erro ao gerar prévia: ${erro.message}`);
                });
            });
            previa.dataset.configurado = "1";
        }
    }

    configurarFiltroCompetencia();

    if (paginaImportacao) {
        carregarParametrosProducao().catch(console.error);
    }

    onSnapshot(docAtual, snapshot => {
        if (!snapshot.exists()) {
            setStatus("muted", "Firebase conectado. Nenhuma produção publicada ainda.");
            return;
        }

        const meta = snapshot.data();
        competenciaAtualVigente = meta.competencia;

        if (paginaImportacao) {
            setStatus("success", `Firebase conectado. Competência vigente: ${meta.competencia}.`);
            carregarParametrosProducao(meta.competencia).catch(console.error);
            return;
        }

        if (paginaProducao && filtroCompetenciaManual) {
            preencherFiltroCompetencias(document.getElementById("filtroCompetenciaVisualizada")?.value).catch(console.error);
            return;
        }

        carregarCompetenciaMaisRecente().catch(erro => {
            console.error(erro);
            setStatus("error", `Erro ao carregar Firebase: ${erro.message}`);
        });
    }, erro => {
        console.error(erro);
        setStatus("error", `Erro de conexão com Firebase: ${erro.message}`);
    });
})().catch(erro => {
    console.error(erro);
    const resultado = document.getElementById("resultadoImportacao");

    if (resultado) {
        resultado.className = "status-message error";
        resultado.textContent = `Erro ao iniciar Firebase: ${erro.message}`;
    }
});
