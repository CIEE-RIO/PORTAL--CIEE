(function iniciarMemoriaCalculo() {
    const pesosPadrao = {
        contratosMarcados: 4,
        prorrogacoes: 2,
        alteracoes: 2,
        contratosDesligados: 1.25,
        ticketsResolvidos: .75,
        satisfacaoPositiva: 0,
        satisfacaoNegativa: 0
    };
    const kpisIgnoradosPeso = ["sla", "satisfacaoPositiva", "satisfacaoNegativa"];

    const formulas = [
        {
            titulo: "Meta por atividade",
            formula: "média histórica x (1 + percentual de acréscimo)",
            detalhe: "O percentual padrão é 10%. Pode ser alterado por célula, atividade e competência."
        },
        {
            titulo: "Média histórica",
            formula: "soma das últimas competências anteriores / quantidade de competências encontradas",
            detalhe: "O sistema usa até 5 competências no cálculo da meta; se existirem apenas 2, usa essas 2."
        },
        {
            titulo: "Piso estatístico",
            formula: "mediana individual equivalente a 8h x 70%",
            detalhe: "Impede percentuais absurdos quando uma meta histórica ficou baixa demais."
        },
        {
            titulo: "Meta final da célula",
            formula: "maior valor entre meta calculada e piso estatístico da célula",
            detalhe: "Quando há meta manual, a meta manual prevalece sobre a fórmula."
        },
        {
            titulo: "Meta individual",
            formula: "meta final da célula/atividade / quantidade de pessoas da atividade",
            detalhe: "Depois aplica o fator de jornada: 1,00 para 8h e 0,75 para 6h."
        },
        {
            titulo: "Percentual de cumprimento",
            formula: "produção realizada / meta final x 100",
            detalhe: "Esse percentual alimenta rankings, metas por célula e gráficos de evolução."
        },
        {
            titulo: "Índice de esforço",
            formula: "soma de cada atividade x peso da prova de 10 pontos",
            detalhe: "Os pesos das atividades consideradas somam 10 pontos: contratos marcados têm maior peso, prorrogações e alterações ficam equilibradas, contratos desligados vêm abaixo e tickets resolvidos têm menor peso."
        },
        {
            titulo: "Pressão operacional",
            formula: "índice de esforço atual / limite sustentável x 100",
            detalhe: "Compara o esforço produzido com a capacidade sustentável estimada. Ao incluir novas atividades, a régua de capacidade também fica mais completa."
        }
    ];

    function escaparHtml(valor) {
        return String(valor ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function nomeKpi(kpi) {
        return nomesKpis?.[kpi] || kpi;
    }

    function renderizarFormulas() {
        const container = document.getElementById("listaFormulas");

        if (!container) {
            return;
        }

        container.innerHTML = formulas.map(item => `
            <div class="formula-row">
                <span>${escaparHtml(item.titulo)}</span>
                <strong>${escaparHtml(item.formula)}</strong>
                <p>${escaparHtml(item.detalhe)}</p>
            </div>
        `).join("");
    }

    function renderizarKpis() {
        const tabela = document.getElementById("tabelaKpisMemoria");

        if (!tabela) {
            return;
        }

        tabela.innerHTML = Object.entries(regrasProducao)
            .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
            .map(([celula, kpis]) => `
                <tr>
                    <td><strong>${escaparHtml(celula)}</strong></td>
                    <td>${kpis.map(kpi => `<span class="calc-chip">${escaparHtml(nomeKpi(kpi))}</span>`).join("")}</td>
                    <td>Produção principal da célula; demais atividades entram como produção extra.</td>
                </tr>
            `).join("");
    }

    function renderizarPesos() {
        const tabela = document.getElementById("tabelaPesosMemoria");

        if (!tabela) {
            return;
        }

        tabela.innerHTML = Object.keys(nomesKpis).filter(kpi => !kpisIgnoradosPeso.includes(kpi)).map(kpi => {
            const peso = Number(pesosPadrao[kpi] ?? 1);
            const pesoTexto = String(Number(peso).toFixed(2)).replace(".", ",");
            return `
                <tr>
                    <td><strong>${escaparHtml(nomeKpi(kpi))}</strong></td>
                    <td>${pesoTexto}</td>
                    <td>Quantidade produzida x ${pesoTexto} ponto(s)</td>
                </tr>
            `;
        }).join("");
    }

    renderizarFormulas();
    renderizarKpis();
    renderizarPesos();
})();
