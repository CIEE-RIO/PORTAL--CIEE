function calcularMetaPorKpi(media, percentualAcrescimo = 10) {
    return Math.round(Number(media || 0) * (1 + (Number(percentualAcrescimo || 0) / 100)));
}

function criarEstruturaMeta() {
    return {
        total: 0,
        quantidadeFuncionarios: 0,
        media: 0,
        meta: 0,
        metaOriginal: 0,
        pisoIndividual8h: 0,
        percentualAcrescimo: 10,
        metaManual: 0,
        fonte: "competenciaAtual",
        percentual: 0
    };
}

function somarProducaoAtual(metasPorCelula, funcionarios) {
    funcionarios.forEach(funcionario => {
        const celula = funcionario.celula || "Sem célula";

        if (!metasPorCelula[celula]) {
            metasPorCelula[celula] = {};
        }

        Object.keys(funcionario.principais).forEach(kpi => {
            if (!metasPorCelula[celula][kpi]) {
                metasPorCelula[celula][kpi] = criarEstruturaMeta();
            }

            metasPorCelula[celula][kpi].total += Number(funcionario.principais[kpi] || 0);
        });
    });
}

function contarFuncionariosPorKpi(metasPorCelula, funcionarios) {
    Object.keys(metasPorCelula).forEach(celula => {
        Object.keys(metasPorCelula[celula]).forEach(kpi => {
            metasPorCelula[celula][kpi].quantidadeFuncionarios = funcionarios
                .filter(funcionario => funcionario.celula === celula && kpi in funcionario.principais)
                .reduce((total, funcionario) => total + Number(funcionario.avaliacaoMeta?.fatorMeta ?? 1), 0);
        });
    });
}

function valorHistoricoPorKpi(item, kpi) {
    if (item.kpis && kpi in item.kpis) {
        return Number(item.kpis[kpi] || 0);
    }

    if (item.principais && kpi in item.principais) {
        return Number(item.principais[kpi] || 0);
    }

    return Number(item[kpi] || 0);
}

function calcularMediaHistorica(historico, celula, kpi, competenciaAtual) {
    const porCompetencia = new Map();

    historico
        .filter(item => item.celula === celula)
        .filter(item => !competenciaAtual || !item.competencia || item.competencia < competenciaAtual)
        .forEach(item => {
            const competencia = item.competencia || "sem-competencia";
            const valor = valorHistoricoPorKpi(item, kpi);

            if (!valor) {
                return;
            }

            porCompetencia.set(competencia, (porCompetencia.get(competencia) || 0) + valor);
        });

    const ultimasCompetencias = [...porCompetencia.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-5);

    if (!ultimasCompetencias.length) {
        return null;
    }

    const total = ultimasCompetencias.reduce((soma, [, valor]) => soma + valor, 0);
    return Math.round(total / ultimasCompetencias.length);
}

function calcularMediaHistoricaGeralKpi(historico, kpi, competenciaAtual) {
    const porCompetencia = new Map();

    historico
        .filter(item => !competenciaAtual || !item.competencia || item.competencia < competenciaAtual)
        .forEach(item => {
            const competencia = item.competencia || "sem-competencia";
            const valor = valorHistoricoPorKpi(item, kpi);

            if (!valor) {
                return;
            }

            porCompetencia.set(competencia, (porCompetencia.get(competencia) || 0) + valor);
        });

    const ultimasCompetencias = [...porCompetencia.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-5);

    if (!ultimasCompetencias.length) {
        return null;
    }

    const total = ultimasCompetencias.reduce((soma, [, valor]) => soma + valor, 0);
    return Math.round(total / ultimasCompetencias.length);
}

function calcularMediana(valores) {
    const ordenados = valores
        .map(Number)
        .filter(valor => Number.isFinite(valor) && valor > 0)
        .sort((a, b) => a - b);

    if (!ordenados.length) {
        return 0;
    }

    const meio = Math.floor(ordenados.length / 2);

    if (ordenados.length % 2) {
        return ordenados[meio];
    }

    return (ordenados[meio - 1] + ordenados[meio]) / 2;
}

function calcularPisoMetaIndividual8h(funcionarios, celula, kpi) {
    const producoesEquivalentes8h = funcionarios
        .filter(funcionario => funcionario.celula === celula && kpi in funcionario.principais)
        .map(funcionario => {
            const fatorParticipacao = Number(funcionario.avaliacaoMeta?.fatorMeta ?? 1);
            const fatorJornada = Number(funcionario.jornada?.fatorMeta || 1) * fatorParticipacao;
            const valor = Number(funcionario.principais[kpi] || 0);

            return fatorJornada ? valor / fatorJornada : valor;
        })
        .filter(valor => valor > 0);

    const mediana = calcularMediana(producoesEquivalentes8h);

    return Math.round(mediana * 0.7);
}

function chaveParametroMeta(competencia, celula, kpi) {
    return `${competencia || "geral"}|${celula || "Sem célula"}|${kpi}`;
}

function obterParametroMeta(competencia, celula, kpi) {
    const parametros = dadosProducao.parametros?.metas || {};

    const exato = parametros[chaveParametroMeta(competencia, celula, kpi)];

    if (exato) {
        return exato;
    }

    const anteriores = Object.values(parametros)
        .filter(parametro => parametro.celula === celula && parametro.kpi === kpi)
        .filter(parametro => parametro.competencia && parametro.competencia !== "geral")
        .filter(parametro => !competencia || parametro.competencia <= competencia)
        .sort((a, b) => b.competencia.localeCompare(a.competencia));

    return anteriores[0] || parametros[chaveParametroMeta("geral", celula, kpi)] || null;
}

function calcularMetasPorCelula(funcionarios, historico = [], competenciaAtual = null) {
    const metasPorCelula = {};

    somarProducaoAtual(metasPorCelula, funcionarios);
    contarFuncionariosPorKpi(metasPorCelula, funcionarios);

    Object.keys(metasPorCelula).forEach(celula => {
        Object.keys(metasPorCelula[celula]).forEach(kpi => {
            const item = metasPorCelula[celula][kpi];
            const mediaHistorica = calcularMediaHistorica(historico, celula, kpi, competenciaAtual);
            const mediaHistoricaGeralKpi = mediaHistorica === null ? calcularMediaHistoricaGeralKpi(historico, kpi, competenciaAtual) : null;
            const baseMeta = mediaHistorica ?? mediaHistoricaGeralKpi ?? item.total;
            const parametroMeta = obterParametroMeta(competenciaAtual, celula, kpi);
            const percentualAcrescimo = Number(parametroMeta?.percentualAcrescimo ?? 10);
            const metaManual = Number(parametroMeta?.metaManual || 0);
            const pisoIndividual8h = calcularPisoMetaIndividual8h(funcionarios, celula, kpi);
            const pisoCelula = pisoIndividual8h * Number(item.quantidadeFuncionarios || 0);
            const metaOriginal = metaManual > 0
                ? Math.round(metaManual)
                : calcularMetaPorKpi(baseMeta, percentualAcrescimo);

            item.media = baseMeta;
            item.metaOriginal = metaOriginal;
            item.pisoIndividual8h = pisoIndividual8h;
            item.percentualAcrescimo = percentualAcrescimo;
            item.metaManual = metaManual;
            item.meta = metaManual > 0 ? metaOriginal : Math.max(metaOriginal, pisoCelula);
            item.fonte = metaManual > 0
                ? "metaManual"
                : (item.meta > metaOriginal ? "pisoEstatistico" : (mediaHistorica !== null ? "historico5Meses" : (mediaHistoricaGeralKpi !== null ? "referenciaKpiGeral" : "competenciaAtual")));
            item.percentual = percentual(item.total, item.meta);
        });
    });

    return metasPorCelula;
}

function obterMetaIndividual(metaCelulaKpi) {
    const quantidade = Number(metaCelulaKpi?.quantidadeFuncionarios || 0);

    if (!quantidade) {
        return 0;
    }

    return Number(metaCelulaKpi.meta || 0) / quantidade;
}
