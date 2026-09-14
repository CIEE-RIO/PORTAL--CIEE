function normalizarChaveColuna(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

function valorPorColuna(linha, nomeColuna) {
    if (nomeColuna in linha) {
        return linha[nomeColuna];
    }

    const chaveMapa = Object.keys(mapaColunas || {})
        .find(chave => mapaColunas[chave] === nomeColuna);
    const alternativas = chaveMapa && mapaColunasAlternativas?.[chaveMapa]
        ? mapaColunasAlternativas[chaveMapa]
        : [];
    const chavesEsperadas = [nomeColuna, ...alternativas].map(normalizarChaveColuna);
    const chaveEncontrada = Object.keys(linha)
        .find(coluna => chavesEsperadas.includes(normalizarChaveColuna(coluna)));

    return chaveEncontrada ? linha[chaveEncontrada] : "";
}

function numeroPlanilha(valor) {
    if (typeof valor === "number") {
        return valor;
    }

    const texto = String(valor || "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim();

    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
}

function padronizarLinha(linha) {
    return {
        nome: String(valorPorColuna(linha, mapaColunas.nome) || "").trim(),
        email: String(valorPorColuna(linha, mapaColunas.email) || "").trim(),
        celula: String(valorPorColuna(linha, mapaColunas.celula) || "").trim(),
        contratosMarcados: numeroPlanilha(valorPorColuna(linha, mapaColunas.contratosMarcados)),
        prorrogacoes: numeroPlanilha(valorPorColuna(linha, mapaColunas.prorrogacoes)),
        alteracoes: numeroPlanilha(valorPorColuna(linha, mapaColunas.alteracoes)),
        contratosDesligados: numeroPlanilha(valorPorColuna(linha, mapaColunas.contratosDesligados)),
        ticketsResolvidos: numeroPlanilha(valorPorColuna(linha, mapaColunas.ticketsResolvidos)),
        satisfacaoPositiva: numeroPlanilha(valorPorColuna(linha, mapaColunas.satisfacaoPositiva)),
        satisfacaoNegativa: numeroPlanilha(valorPorColuna(linha, mapaColunas.satisfacaoNegativa)),
        sla: numeroPlanilha(valorPorColuna(linha, mapaColunas.sla))
    };
}

function padronizarPlanilha(linhas) {
    return linhas.map(linha => padronizarLinha(linha));
}
