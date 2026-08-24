(function configurarAutenticacao() {
    const MODULOS_PORTAL = [
        { id: "home", nome: "Menu", caminho: "index.html", padrao: true },
        { id: "sazonalidade", nome: "Sazonalidade", caminho: "modulos/sazonalidade/index.html" },
        { id: "desligamentos", nome: "Desligamentos", caminho: "modulos/desligamentos/index.html" },
        { id: "producao", nome: "Produção", caminho: "modulos/producao/index.html" },
        { id: "colaboradores", nome: "Mural de destaques", caminho: "modulos/colaboradores/index.html" },
        { id: "importar-producao", nome: "Importar dados", caminho: "modulos/importar-producao/index.html" },
        { id: "memoria-calculo", nome: "Memória de cálculo", caminho: "modulos/memoria-calculo/index.html" },
        { id: "usuarios", nome: "Usuários", caminho: "modulos/usuarios/index.html", admin: true }
    ];
    const USUARIOS_PADRAO = [
        { usuario: "rodrigob@cieerj.org.br", email: "rodrigob@cieerj.org.br", apelido: "rodrigob", nome: "Rodrigo B", perfil: "admin", modulos: ["todos"], podeEscrever: true, fixo: true }
    ];
    const APELIDOS_LOGIN = {
        rodrigob: "rodrigob@cieerj.org.br",
        operacao: "operacao@portal.local",
        comercial: "comercial@portal.local"
    };
    const CHAVE_SESSAO = "portal_ciee_sessao";
    const COLECAO_USUARIOS = "usuarios_login";
    const paginaLogin = location.pathname.toLowerCase().endsWith("/login.html");
    const paginaUsuarios = location.pathname.toLowerCase().includes("/modulos/usuarios/");
    const caminhoLogin = `${caminhoBase()}login.html`;
    const caminhoInicial = `${caminhoBase()}index.html`;
    let firebaseDbPromise = null;
    let firebaseAuthPromise = null;

    const firebaseConfig = {
        apiKey: "AIzaSyD7OHPZ8flOUGyCrdL3Sp-ZTASj03Dbn94",
        authDomain: "portal-producao-d3a08.firebaseapp.com",
        projectId: "portal-producao-d3a08",
        storageBucket: "portal-producao-d3a08.firebasestorage.app",
        messagingSenderId: "881576324700",
        appId: "1:881576324700:web:c68bdbe4c309d5fd1f4099"
    };

    function caminhoBase() {
        return location.pathname.includes("/modulos/") ? "../../" : "./";
    }

    function normalizarId(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    }

    function normalizarEmail(valor) {
        return String(valor || "").trim().toLowerCase();
    }

    function idUsuarioPerfil(usuario) {
        return normalizarEmail(usuario?.email || usuario?.usuario);
    }

    function normalizarApelido(valor) {
        return normalizarId(valor);
    }

    function normalizarPerfil(perfil) {
        return perfil === "admin" ? "admin" : "visualizacao";
    }

    function normalizarModulosUsuario(usuario) {
        if (normalizarPerfil(usuario?.perfil) === "admin") {
            return ["todos"];
        }

        const permitidos = new Set(MODULOS_PORTAL.filter(modulo => !modulo.admin).map(modulo => modulo.id));
        const modulos = Array.isArray(usuario?.modulos) ? usuario.modulos : [];
        const filtrados = modulos.filter(modulo => permitidos.has(modulo));

        return filtrados.length ? [...new Set(filtrados)] : ["home"];
    }

    function normalizarUsuario(usuario) {
        const perfil = normalizarPerfil(usuario?.perfil);
        const email = normalizarEmail(usuario?.email || usuario?.usuario);

        return {
            ...usuario,
            id: usuario?.id || email || usuario?.usuario,
            usuario: email || usuario?.usuario || usuario?.id,
            email,
            apelido: normalizarApelido(usuario?.apelido),
            perfil,
            modulos: perfil === "admin" ? ["todos"] : normalizarModulosUsuario({ ...usuario, perfil }),
            podeEscrever: perfil === "admin" || usuario?.podeEscrever === true
        };
    }

    function moduloAtual() {
        const path = location.pathname.toLowerCase().replace(/\\/g, "/");

        if (path.endsWith("/login.html")) {
            return "login";
        }

        if (path.includes("/modulos/sazonalidade/")) return "sazonalidade";
        if (path.includes("/modulos/desligamentos/")) return "desligamentos";
        if (path.includes("/modulos/producao/")) return "producao";
        if (path.includes("/modulos/colaboradores/")) return "colaboradores";
        if (path.includes("/modulos/importar-producao/")) return "importar-producao";
        if (path.includes("/modulos/memoria-calculo/")) return "memoria-calculo";
        if (path.includes("/modulos/usuarios/")) return "usuarios";

        return "home";
    }

    function usuarioPodeAcessar(usuario, moduloId) {
        const usuarioNormalizado = normalizarUsuario(usuario || {});

        if (usuarioNormalizado.perfil === "admin") {
            return true;
        }

        if (moduloId === "usuarios") {
            return false;
        }

        return usuarioNormalizado.modulos.includes(moduloId);
    }

    function caminhoModulo(moduloId) {
        const modulo = MODULOS_PORTAL.find(item => item.id === moduloId) || MODULOS_PORTAL[0];
        return `${caminhoBase()}${modulo.caminho}`;
    }

    function caminhoInicialPermitido(usuario) {
        const usuarioNormalizado = normalizarUsuario(usuario);

        if (usuarioNormalizado.perfil === "admin") {
            return caminhoInicial;
        }

        return caminhoModulo(usuarioNormalizado.modulos[0] || "home");
    }

    function nomeModulo(moduloId) {
        return MODULOS_PORTAL.find(item => item.id === moduloId)?.nome || "este módulo";
    }

    function renderizarAcessoNegado(moduloId, sessao) {
        const conteudo = document.querySelector(".content") || document.body;

        if (!conteudo || document.getElementById("portalAcessoNegado")) {
            return;
        }

        document.body.classList.add("access-denied-mode");

        const card = document.createElement("section");
        card.id = "portalAcessoNegado";
        card.className = "access-denied-card";
        card.innerHTML = `
            <div class="access-denied-emoji" aria-hidden="true">😅</div>
            <span class="eyebrow">Acesso restrito</span>
            <h1>Eu sei que o projeto está maneiro...</h1>
            <p>Mas a área <strong>${nomeModulo(moduloId)}</strong> ainda não está liberada para o seu perfil. Chama um admin se esse acesso fizer sentido para você.</p>
            <a class="primary-link-button" href="${caminhoInicialPermitido(sessao)}">Voltar para uma área liberada</a>
        `;

        conteudo.prepend(card);
    }

    function prepararAcessoNegado(moduloId, sessao) {
        window.portalAcessoBloqueado = true;

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => renderizarAcessoNegado(moduloId, sessao), { once: true });
            return;
        }

        renderizarAcessoNegado(moduloId, sessao);
    }

    async function obterFirebase() {
        if (firebaseDbPromise) {
            return firebaseDbPromise;
        }

        firebaseDbPromise = Promise.all([
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
        ]).then(([firebaseApp, firestore]) => {
            const app = firebaseApp.getApps().length
                ? firebaseApp.getApp()
                : firebaseApp.initializeApp(firebaseConfig);
            const db = firestore.getFirestore(app);

            return { db, firestore };
        });

        return firebaseDbPromise;
    }

    async function obterFirebaseAuth() {
        if (firebaseAuthPromise) {
            return firebaseAuthPromise;
        }

        firebaseAuthPromise = Promise.all([
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js")
        ]).then(([firebaseApp, firebaseAuth]) => {
            const app = firebaseApp.getApps().length
                ? firebaseApp.getApp()
                : firebaseApp.initializeApp(firebaseConfig);
            const auth = firebaseAuth.getAuth(app);

            return { auth, firebaseAuth };
        });

        return firebaseAuthPromise;
    }

    async function obterUsuarioAuthAtual() {
        const { auth, firebaseAuth } = await obterFirebaseAuth();

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

    async function exigirUsuarioAuthAtivo() {
        const sessao = obterSessao();
        const usuarioAuth = await obterUsuarioAuthAtual();
        const emailSessao = normalizarEmail(sessao?.email || sessao?.usuario);
        const emailAuth = normalizarEmail(usuarioAuth?.email);

        if (!usuarioAuth || (emailSessao && emailAuth !== emailSessao)) {
            sessionStorage.removeItem(CHAVE_SESSAO);
            throw new Error("Sessão Firebase expirada. Saia, entre novamente e tente salvar de novo.");
        }

        return usuarioAuth;
    }

    function obterSessao() {
        try {
            return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || "null");
        } catch {
            return null;
        }
    }

    async function listarUsuariosFirebase() {
        try {
            if (!paginaLogin) {
                await exigirUsuarioAuthAtivo();
            }

            const { db, firestore } = await obterFirebase();
            const snap = await firestore.getDocs(firestore.collection(db, COLECAO_USUARIOS));
            const usuarios = [];

            snap.forEach(item => {
                const data = item.data();

                if (data.email || data.usuario) {
                    usuarios.push(normalizarUsuario({
                        id: item.id,
                        ...data
                    }));
                }
            });

            return usuarios;
        } catch (erro) {
            console.warn("Nao foi possivel carregar usuarios do Firebase.", erro);
            return [];
        }
    }

    async function listarUsuarios() {
        const mapa = new Map();
        const cadastrados = await listarUsuariosFirebase();

        USUARIOS_PADRAO.forEach(usuario => mapa.set(idUsuarioPerfil(usuario), normalizarUsuario(usuario)));
        cadastrados.forEach(usuario => {
            const chave = idUsuarioPerfil(usuario);
            const existente = mapa.get(chave) || {};
            const protegido = Boolean(existente.fixo);

            mapa.set(chave, normalizarUsuario({
                ...existente,
                ...usuario,
                perfil: protegido ? "admin" : usuario.perfil,
                modulos: protegido ? ["todos"] : usuario.modulos,
                podeEscrever: protegido ? true : usuario.podeEscrever,
                fixo: Boolean(existente.fixo || usuario.fixo)
            }));
        });

        return [...mapa.values()];
    }

    async function salvarUsuario(usuario) {
        await exigirUsuarioAuthAtivo();

        const { db, firestore } = await obterFirebase();
        const email = normalizarEmail(usuario.email || usuario.usuario);
        const id = email;

        if (!id) {
            throw new Error("E-mail invalido.");
        }

        await firestore.setDoc(firestore.doc(db, COLECAO_USUARIOS, id), {
            nome: usuario.nome,
            usuario: email,
            email,
            apelido: normalizarApelido(usuario.apelido),
            perfil: normalizarPerfil(usuario.perfil),
            modulos: normalizarModulosUsuario(usuario),
            podeEscrever: normalizarPerfil(usuario.perfil) === "admin" || usuario.podeEscrever === true,
            atualizadoEm: firestore.serverTimestamp()
        }, { merge: true });
    }

    async function removerUsuario(usuario) {
        await exigirUsuarioAuthAtivo();

        const { db, firestore } = await obterFirebase();
        await firestore.deleteDoc(firestore.doc(db, COLECAO_USUARIOS, String(usuario || "")));
    }

    function salvarSessao(usuario) {
        const usuarioNormalizado = normalizarUsuario(usuario);

        sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify({
            usuario: usuario.usuario || usuario.email,
            email: normalizarEmail(usuario.email || usuario.usuario),
            nome: usuario.nome,
            perfil: usuarioNormalizado.perfil,
            modulos: usuarioNormalizado.modulos,
            podeEscrever: usuarioNormalizado.podeEscrever,
            iniciadoEm: new Date().toISOString()
        }));
    }

    async function encerrarSessao() {
        sessionStorage.removeItem(CHAVE_SESSAO);
        try {
            const { auth, firebaseAuth } = await obterFirebaseAuth();
            await firebaseAuth.signOut(auth);
        } catch (erro) {
            console.warn("Nao foi possivel encerrar a sessao do Firebase Auth.", erro);
        }
        location.href = caminhoLogin;
    }

    async function usuarioValido(usuario, senha) {
        const identificador = String(usuario || "").trim();
        const apelido = normalizarApelido(identificador);
        const emailInicial = identificador.includes("@")
            ? normalizarEmail(identificador)
            : normalizarEmail(APELIDOS_LOGIN[apelido]);
        let usuarios = [];
        let email = emailInicial;

        if (!email) {
            usuarios = await listarUsuarios();
            email = normalizarEmail(usuarios.find(item => item.apelido === apelido)?.email);
        }

        if (!email) {
            throw new Error("Apelido ou e-mail nao encontrado.");
        }

        const { auth, firebaseAuth } = await obterFirebaseAuth();
        await firebaseAuth.signInWithEmailAndPassword(auth, email, String(senha || ""));
        const usuariosAtualizados = await listarUsuarios();
        const encontrado = usuariosAtualizados.find(item => idUsuarioPerfil(item) === email)
            || usuarios.find(item => idUsuarioPerfil(item) === email);

        return normalizarUsuario(encontrado || {
            usuario: email,
            email,
            nome: email,
            perfil: "visualizacao",
            modulos: ["home"]
        });
    }

    function protegerPagina() {
        if (paginaLogin) {
            return;
        }

        const sessao = obterSessao();

        if (!sessao) {
            location.replace(caminhoLogin);
            return;
        }

        const modulo = moduloAtual();

        if (!usuarioPodeAcessar(sessao, modulo)) {
            prepararAcessoNegado(modulo, sessao);
        }
    }

    function configurarLogin() {
        const form = document.getElementById("loginForm");

        if (!form) {
            return;
        }

        if (obterSessao()) {
            location.replace(caminhoInicial);
            return;
        }

        form.addEventListener("submit", async event => {
            event.preventDefault();

            const usuario = document.getElementById("loginUsuario")?.value;
            const senha = document.getElementById("loginSenha")?.value;
            const mensagem = document.getElementById("loginMensagem");

            if (mensagem) {
                mensagem.hidden = false;
                mensagem.textContent = "Validando acesso...";
            }

            try {
                const encontrado = await usuarioValido(usuario, senha);

                salvarSessao(encontrado);
                location.replace(caminhoInicialPermitido(encontrado));
            } catch (erro) {
                console.warn("Falha no login Firebase.", erro);
                if (mensagem) {
                    mensagem.textContent = "E-mail ou senha invalidos, ou acesso ainda nao cadastrado.";
                }
            }
        });
    }

    function configurarVisibilidadeNavegacao() {
        const sessao = obterSessao();

        if (!sessao || paginaLogin) {
            return;
        }

        document.querySelectorAll(".sidebar nav a").forEach(link => {
            const href = link.getAttribute("href") || "";
            const modulo = MODULOS_PORTAL
                .filter(item => item.id !== "home")
                .find(item => href.includes(item.caminho) || href.includes(item.caminho.replace("modulos/", "../")))
                || (href.includes("index.html") && !href.includes("/modulos/") && !href.includes("../") ? MODULOS_PORTAL[0] : null)
                || (href.endsWith("../../index.html") ? MODULOS_PORTAL[0] : null);

            if (modulo && !usuarioPodeAcessar(sessao, modulo.id)) {
                link.remove();
            }
        });
    }

    function inserirBotaoSair() {
        const sessao = obterSessao();

        if (paginaLogin || !sessao) {
            return;
        }

        const nav = document.querySelector(".sidebar nav");

        if (!nav || document.getElementById("botaoSairPortal")) {
            return;
        }

        if (sessao.perfil === "admin" && !document.getElementById("linkUsuariosPortal")) {
            const link = document.createElement("a");
            link.id = "linkUsuariosPortal";
            link.href = `${caminhoBase()}modulos/usuarios/index.html`;
            link.innerHTML = `<span class="nav-icon nav-icon-users" aria-hidden="true"></span>Usuários`;
            nav.appendChild(link);
        }

        const botao = document.createElement("button");
        botao.type = "button";
        botao.id = "botaoSairPortal";
        botao.className = "logout-button";
        botao.textContent = "Sair";
        botao.addEventListener("click", encerrarSessao);
        nav.appendChild(botao);
    }

    window.portalAuth = {
        obterSessao,
        listarUsuarios,
        salvarUsuario,
        removerUsuario,
        modulosDisponiveis: () => MODULOS_PORTAL.map(item => ({ ...item })),
        usuarioPodeAcessar,
        normalizarUsuario,
        usuarioAdmin: () => obterSessao()?.perfil === "admin",
        usuarioPodeEscrever: () => obterSessao()?.perfil === "admin" || obterSessao()?.podeEscrever === true
    };

    protegerPagina();
    document.addEventListener("DOMContentLoaded", () => {
        configurarLogin();
        configurarVisibilidadeNavegacao();
        inserirBotaoSair();
    });
})();

