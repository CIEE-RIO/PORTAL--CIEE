const firebaseConfig = {
  apiKey: "AIzaSyD7OHPZ8flOUGyCrdL3Sp-ZTASj03Dbn94",
  authDomain: "portal-producao-d3a08.firebaseapp.com",
  projectId: "portal-producao-d3a08",
  storageBucket: "portal-producao-d3a08.firebasestorage.app",
  messagingSenderId: "881576324700",
  appId: "1:881576324700:web:c68bdbe4c309d5fd1f4099"
};

const sample = {
  dataReferencia: "2026-11-08",
  dataComparacao: "2026-11-05",
  programas: {
    estagio: {
      total: {nome:"Total", anterior:33732, atual:33907, variacao:175, percentual:0.52, meta:42939, faltam:9032, porDia:903, vagas:1877},
      categorias: [
        {nome:"Privado", atual:17097, variacao:91, meta:19324, faltam:2227},
        {nome:"Público", atual:10172, variacao:47, meta:16498, faltam:6326},
        {nome:"Economia Mista", atual:6638, variacao:37, meta:7117, faltam:479}
      ],
      unidades: []
    },
    aprendiz: {
      total: {nome:"Total", anterior:25515, atual:25639, variacao:124, percentual:0.49, meta:27465, faltam:1826, porDia:183, vagas:824},
      categorias: [
        {nome:"Capacitador", atual:23306, variacao:104, meta:25083, faltam:1777},
        {nome:"Empregador", atual:2333, variacao:20, meta:2382, faltam:49}
      ],
      unidades: []
    }
  }
};

const UNIDADES = [
  "Barra Mansa", "Campos", "Duque de Caxias", "Macaé", "Niterói",
  "Nova Friburgo", "Nova Iguaçu", "Petrópolis", "Resende", "Rio de Janeiro",
  "Teresópolis", "Três Rios", "Virtual Santa Catarina", "Virtual Rio Grande do Sul",
  "Virtual Pernambuco", "Virtual Paraná", "Virtual Minas Gerais", "Virtual Espírito Santo",
  "Personalizado Digital", "CIEE Digital Nacional"
];
function normalizarUnidade(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}
const UNIDADE_LOOKUP = new Map(UNIDADES.map(nome => [normalizarUnidade(nome), nome]));
[
  ["CIEE - Personalizado Digital Nacional", "Personalizado Digital"],
  ["Personalizado Digital Nacional", "Personalizado Digital"],
  ["Virtual SC", "Virtual Santa Catarina"],
  ["Virtual RS", "Virtual Rio Grande do Sul"],
  ["Virtual PE", "Virtual Pernambuco"],
  ["Virtual PR", "Virtual Paraná"],
  ["Virtual MG", "Virtual Minas Gerais"],
  ["Virtual ES", "Virtual Espírito Santo"]
].forEach(([alias, nome]) => UNIDADE_LOOKUP.set(normalizarUnidade(alias), nome));

function unidadesDetalhadas(source) {
  const presentes = new Map();
  (Array.isArray(source) ? source : []).forEach(item => {
    const raw = String(item?.unidade ?? "").trim();
    const base = raw.split(/\s+[-–—]\s+/)[0].trim();
    const unidade = UNIDADE_LOOKUP.get(normalizarUnidade(raw))
      || UNIDADE_LOOKUP.get(normalizarUnidade(base));
    if (unidade) presentes.set(unidade, item);
  });
  return UNIDADES.map(unidade => ({
    ...(presentes.get(unidade) || {}),
    unidade,
    hasData: presentes.has(unidade)
  }));
}
function fmtCell(item, key) {
  return item.hasData && item[key] !== undefined && item[key] !== null && item[key] !== ""
    ? fmt(item[key]) : "—";
}
function fmtPercentCell(item) {
  return item.hasData && item.percentual !== undefined && item.percentual !== null && item.percentual !== ""
    ? fmtPercent(item.percentual) : "—";
}
function fmtSignedCell(item, key) {
  if (!item.hasData || item[key] === undefined || item[key] === null || item[key] === "") return "—";
  return `${number(item[key]) > 0 ? "+" : ""}${fmt(item[key])}`;
}

const nf = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
const dateFmt = new Intl.DateTimeFormat("pt-BR", {day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"});
let report = sample;

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}
function fmt(value) {
  return nf.format(number(value));
}
function fmtPercent(value) {
  return `${pct.format(number(value))}%`;
}
function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function fmtDate(value) {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(`${String(value).slice(0,10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "—" : dateFmt.format(date);
}
function valueClass(value) {
  return number(value) > 0 ? "rd-positive" : number(value) < 0 ? "rd-negative" : "";
}
function setSource(isLive, label) {
  const el = document.getElementById("rdSource");
  el.textContent = label;
  el.classList.toggle("live", isLive);
}
function render() {
  const key = document.getElementById("rdProgram").value;
  const program = report.programas?.[key];
  const total = program?.total || {};
  const units = unidadesDetalhadas(program?.unidades);
  const categories = Array.isArray(program?.categorias) ? program.categorias : [];
  const query = document.getElementById("rdSearch").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = units.filter(item => String(item.unidade || "").toLocaleLowerCase("pt-BR").includes(query));

  document.getElementById("rdReference").textContent = fmtDate(report.dataReferencia);
  document.getElementById("rdComparison").textContent = fmtDate(report.dataComparacao);
  document.getElementById("rdKpis").innerHTML = [
    ["Contratos ativos", fmt(total.atual), `Variação ${number(total.variacao) >= 0 ? "+" : ""}${fmt(total.variacao)} vs. ${fmtDate(report.dataComparacao)}`],
    ["Meta", fmt(total.meta), `${fmtPercent(total.meta ? number(total.atual) / number(total.meta) * 100 : 0)} atingidos`],
    ["Faltam", fmt(total.faltam), `Por dia: ${fmt(total.porDia)}`],
    ["Vagas", fmt(total.vagas), `Variação diária ${number(total.variacao) >= 0 ? "+" : ""}${fmt(total.variacao)}`]
  ].map((card, index) => `<article class="rd-kpi"><span>${card[0]}</span><strong class="${index === 0 ? valueClass(total.variacao) : ""}">${card[1]}</strong><small>${card[2]}</small></article>`).join("");

  document.getElementById("rdCategories").innerHTML = categories.length
    ? categories.map(item => `<article class="rd-category"><span>${safeText(item.nome)}</span><strong>${fmt(item.atual)} <small class="${valueClass(item.variacao)}">${number(item.variacao) >= 0 ? "+" : ""}${fmt(item.variacao)}</small></strong><small>Meta ${fmt(item.meta)} · Faltam ${fmt(item.faltam)}</small></article>`).join("")
    : '<div class="rd-empty">Não há subdivisões neste relatório.</div>';

  if (!filtered.length) {
    document.getElementById("rdTable").innerHTML = '<div class="rd-empty">Nenhuma unidade corresponde à pesquisa.</div>';
    return;
  }
  document.getElementById("rdTable").innerHTML = `<div class="rd-table-wrap"><table class="rd-table"><thead><tr><th>Unidade</th><th>Anterior</th><th>Atual</th><th>Variação</th><th>%</th><th>Meta</th><th>Faltam</th><th>Por dia</th><th>Vagas</th><th>Novas vagas</th></tr></thead><tbody>${filtered.map(item => `<tr><td class="rd-unit">${safeText(item.unidade)}</td><td>${fmtCell(item,"anterior")}</td><td><strong>${fmtCell(item,"atual")}</strong></td><td class="${item.hasData ? valueClass(item.variacao) : ""}">${fmtSignedCell(item,"variacao")}</td><td>${fmtPercentCell(item)}</td><td>${fmtCell(item,"meta")}</td><td>${fmtCell(item,"faltam")}</td><td>${fmtCell(item,"porDia")}</td><td>${fmtCell(item,"vagas")}</td><td>${fmtCell(item,"novasVagas")}</td></tr>`).join("")}</tbody></table></div>`;
}

async function carregarFirestore() {
  const appSdk = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const authSdk = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const dbSdk = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  if (!auth.currentUser) {
    await new Promise(resolve => {
      const stop = authSdk.onAuthStateChanged(auth, () => { stop(); resolve(); });
    });
  }
  const db = dbSdk.getFirestore(app);
  const snapshot = await dbSdk.getDocs(dbSdk.collection(db, "resultados_diarios"));
  const docs = snapshot.docs.map(item => ({...item.data(), id:item.id}))
    .filter(item => item.dataReferencia && item.programas)
    .sort((a,b) => String(b.dataReferencia).localeCompare(String(a.dataReferencia)));
  if (docs.length) {
    report = docs[0];
    setSource(true, "Dados do Firebase");
  } else {
    setSource(false, "Exemplo de 08/11/2026");
  }
}

document.getElementById("rdProgram").addEventListener("change", render);
document.getElementById("rdSearch").addEventListener("input", render);
render();
carregarFirestore().then(render).catch(error => {
  console.warn("Não foi possível carregar os resultados diários do Firebase.", error);
  setSource(false, "Exemplo de 08/11/2026");
  const box = document.getElementById("rdError");
  box.className = "rd-error";
  box.textContent = "Não foi possível ler os resultados salvos. A página está exibindo a amostra do relatório para conferência visual.";
  box.hidden = false;
  render();
});
