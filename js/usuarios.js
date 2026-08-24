(function configurarCadastroUsuarios() {
    const form = document.getElementById("formUsuario");
    const tabela = document.getElementById("tabelaUsuarios");
    const perfil = document.getElementById("usuarioPerfil");
    const podeEscrever = document.getElementById("usuarioPodeEscrever");
    const modulosBox = document.getElementById("usuarioModulosBox");
    const modulosContainer = document.getElementById("usuarioModulos");

    if (!form || !tabela || !window.portalAuth) {
        return;
    }

    function limparTexto(valor) {
        return String(valor || "").trim();
    }

    function escaparHtml(valor) {
        return String(valor || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function modulosSelecionados() {
        return [...document.querySelectorAll("#usuarioModulos input:checked")].map(input => input.value);
    }

    function modulosPermitidosCadastro() {
        return window.portalAuth.modulosDisponiveis().filter(modulo => !modulo.admin);
    }

    function usuarioProtegido(usuario) {
        const identificador = String(usuario?.email || usuario?.usuario || usuario || "").toLowerCase();
        return Boolean(usuario?.fixo)
            || identificador === "rodrigob@cieerj.org.br";
    }

    function rotuloPerfil(usuario) {
        return usuario.perfil === "admin" ? "Admin" : "Visualização";
    }

    function opcoesPerfil(usuario) {
        const protegido = usuarioProtegido(usuario);

        return `
            <select class="user-profile-select" data-usuario="${escaparHtml(usuario.usuario)}" ${protegido ? "disabled" : ""}>
                <option value="visualizacao" ${usuario.perfil !== "admin" && !protegido ? "selected" : ""}>Visualização</option>
                <option value="admin" ${usuario.perfil === "admin" || protegido ? "selected" : ""}>Admin</option>
            </select>
        `;
    }

    function controleEscrita(usuario) {
        const protegido = usuarioProtegido(usuario);
        const admin = usuario.perfil === "admin" || protegido;
        const marcado = admin || usuario.podeEscrever === true;

        return `
            <label class="user-write-inline">
                <input type="checkbox" class="user-write-checkbox" data-usuario="${escaparHtml(usuario.usuario)}" ${marcado ? "checked" : ""} ${admin ? "disabled" : ""}>
                Pode alterar
            </label>
        `;
    }

    function checkboxesModulos(usuario) {
        const protegido = usuarioProtegido(usuario);

        if (protegido) {
            return `<span class="badge badge-success">Todos os módulos</span>`;
        }

        const admin = usuario.perfil === "admin";
        const permitidos = modulosPermitidosCadastro();
        const selecionados = new Set(admin ? permitidos.map(modulo => modulo.id) : (usuario.modulos || []));

        return `
            <span class="badge badge-success user-admin-modules-badge" ${admin ? "" : "hidden"}>Todos os módulos</span>
            <div class="user-modules-inline" data-usuario="${escaparHtml(usuario.usuario)}" ${admin ? "hidden" : ""}>
                ${permitidos.map(modulo => `
                    <label>
                        <input type="checkbox" value="${escaparHtml(modulo.id)}" ${selecionados.has(modulo.id) ? "checked" : ""}>
                        ${escaparHtml(modulo.nome)}
                    </label>
                `).join("")}
            </div>
        `;
    }

    function atualizarVisibilidadeModulos() {
        if (!modulosBox || !perfil) {
            return;
        }

        const admin = perfil.value === "admin";
        modulosBox.hidden = admin;

        if (podeEscrever) {
            podeEscrever.checked = admin || podeEscrever.checked;
            podeEscrever.disabled = admin;
        }
    }

    function preencherModulos() {
        if (!modulosContainer) {
            return;
        }

        modulosContainer.innerHTML = modulosPermitidosCadastro().map(modulo => `
            <label>
                <input type="checkbox" value="${escaparHtml(modulo.id)}" ${modulo.padrao ? "checked" : ""}>
                ${escaparHtml(modulo.nome)}
            </label>
        `).join("");
    }

    async function renderizarUsuarios() {
        tabela.innerHTML = `<tr><td colspan="7">Carregando usuários...</td></tr>`;

        const usuarios = await window.portalAuth.listarUsuarios();

        tabela.innerHTML = usuarios.map(usuario => {
            const protegido = usuarioProtegido(usuario);

            return `
            <tr>
                <td>${escaparHtml(usuario.nome || usuario.usuario)}</td>
                <td>${escaparHtml(usuario.email || usuario.usuario)}</td>
                <td>${escaparHtml(usuario.apelido || "-")}</td>
                <td>${opcoesPerfil(usuario)}</td>
                <td>${controleEscrita(usuario)}</td>
                <td>${checkboxesModulos(usuario)}</td>
                <td>
                    <div class="user-action-row">
                        ${protegido ? `<span class="badge badge-success">Principal</span>` : ""}
                        <button type="button" class="secondary-button user-save-access" data-usuario="${escaparHtml(usuario.usuario)}">Salvar acesso</button>
                        ${protegido ? "" : `<button type="button" class="secondary-button user-delete-button" data-usuario="${escaparHtml(usuario.id || usuario.usuario)}">Excluir</button>`}
                    </div>
                </td>
            </tr>
        `;
        }).join("") || `<tr><td colspan="7">Nenhum acesso cadastrado.</td></tr>`;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        try {
            const nome = limparTexto(document.getElementById("usuarioNome")?.value);
            const usuario = limparTexto(document.getElementById("usuarioLogin")?.value);
            const apelido = limparTexto(document.getElementById("usuarioApelido")?.value);
            const perfilSelecionado = perfil?.value || "visualizacao";
            const modulos = perfilSelecionado === "admin" ? ["todos"] : modulosSelecionados();
            const escritaLiberada = perfilSelecionado === "admin" || podeEscrever?.checked === true;
            const usuarios = await window.portalAuth.listarUsuarios();

            if (!nome || !usuario) {
                alert("Preencha nome e e-mail.");
                return;
            }

            if (perfilSelecionado !== "admin" && !modulos.length) {
                alert("Selecione pelo menos um módulo para o perfil de visualização.");
                return;
            }

            if (usuarios.some(item => String(item.email || item.usuario || "").toLowerCase() === usuario.toLowerCase())) {
                alert("Esse usuário já existe.");
                return;
            }

            if (apelido && usuarios.some(item => String(item.apelido || "").toLowerCase() === apelido.toLowerCase())) {
                alert("Esse apelido já está em uso.");
                return;
            }

            await window.portalAuth.salvarUsuario({
                nome,
                usuario,
                email: usuario,
                apelido,
                perfil: perfilSelecionado,
                modulos,
                podeEscrever: escritaLiberada
            });

            form.reset();
            preencherModulos();
            atualizarVisibilidadeModulos();
            await renderizarUsuarios();
            alert("Acesso cadastrado com sucesso.");
        } catch (erro) {
            console.error(erro);
            alert(`Erro ao cadastrar acesso: ${erro.message || "verifique suas permissões no Firebase."}`);
        }
    });

    tabela.addEventListener("click", async event => {
        const excluir = event.target.closest(".user-delete-button");
        const salvarAcesso = event.target.closest(".user-save-access");

        if (excluir) {
            if (!confirm("Excluir este login?")) {
                return;
            }

            await window.portalAuth.removerUsuario(excluir.dataset.usuario);
            await renderizarUsuarios();
            return;
        }

        if (salvarAcesso) {
            const usuario = salvarAcesso.dataset.usuario;
            const usuarios = await window.portalAuth.listarUsuarios();
            const atual = usuarios.find(item => item.usuario === usuario);
            const perfilCampo = tabela.querySelector(`.user-profile-select[data-usuario="${CSS.escape(usuario)}"]`);
            const escritaCampo = tabela.querySelector(`.user-write-checkbox[data-usuario="${CSS.escape(usuario)}"]`);
            const protegido = usuarioProtegido(atual || usuario);
            const perfilSelecionado = protegido ? "admin" : (perfilCampo?.value || "visualizacao");
            const modulos = perfilSelecionado === "admin"
                ? ["todos"]
                : [...tabela.querySelectorAll(`.user-modules-inline[data-usuario="${CSS.escape(usuario)}"] input:checked`)].map(input => input.value);
            const escritaLiberada = perfilSelecionado === "admin" || escritaCampo?.checked === true;

            if (!atual) {
                alert("Usuário não encontrado.");
                return;
            }

            if (perfilSelecionado !== "admin" && !modulos.length) {
                alert("Selecione pelo menos um módulo para o perfil de visualização.");
                return;
            }

            await window.portalAuth.salvarUsuario({
                ...atual,
                perfil: perfilSelecionado,
                modulos,
                podeEscrever: protegido ? true : escritaLiberada
            });
            await renderizarUsuarios();
        }
    });

    tabela.addEventListener("change", event => {
        const seletorPerfil = event.target.closest(".user-profile-select");

        if (!seletorPerfil) {
            return;
        }

        const linha = seletorPerfil.closest("tr");
        const admin = seletorPerfil.value === "admin";
        const badge = linha?.querySelector(".user-admin-modules-badge");
        const lista = linha?.querySelector(".user-modules-inline");
        const escrita = linha?.querySelector(".user-write-checkbox");

        if (badge) {
            badge.hidden = !admin;
        }

        if (lista) {
            lista.hidden = admin;
        }

        if (escrita) {
            escrita.checked = admin || escrita.checked;
            escrita.disabled = admin;
        }
    });

    perfil?.addEventListener("change", atualizarVisibilidadeModulos);
    preencherModulos();
    atualizarVisibilidadeModulos();

    renderizarUsuarios().catch(erro => {
        console.error(erro);
        tabela.innerHTML = `<tr><td colspan="7">Erro ao carregar usuários.</td></tr>`;
    });
})();
