/* Gerado por scripts/gerarDocs.js (npm run docs). Não edite à mão. */
export default {
    "openapi": "3.0.3",
    "info": {
        "title": "API do ContrateJá",
        "version": "1.0.0",
        "description": "Backend do TCC ContrateJá (Express + MySQL). Erros vêm como { \"erro\": \"mensagem\" }. Para testar as rotas com cadeado, faça login em POST /auth/login e cole o token em \"Authorize\". Pagamentos são simulação: nenhum dinheiro de verdade passa pela carteira."
    },
    "tags": [
        {
            "name": "/auth",
            "description": "Login, cadastro, verificação em 2 etapas e sessões"
        },
        {
            "name": "/usuarios",
            "description": "Conta, perfil, disponibilidade, ganhos, mascote, visitas e favoritos"
        },
        {
            "name": "/servicos",
            "description": "Projetos, candidaturas, entrega, acordo, garantia, etapas, bônus e recibo"
        },
        {
            "name": "/candidaturas",
            "description": "Candidaturas dos freelancers"
        },
        {
            "name": "/mensagens",
            "description": "Chat: mensagens, propostas, reuniões, digitando e visto"
        },
        {
            "name": "/historico",
            "description": "Histórico de projetos"
        },
        {
            "name": "/portfolio",
            "description": "Portfólio dos freelancers"
        },
        {
            "name": "/perfil",
            "description": "Perfis com XP, insígnias e avaliações"
        },
        {
            "name": "/avaliacoes",
            "description": "Avaliações (às cegas por 7 dias)"
        },
        {
            "name": "/notificacoes",
            "description": "Sino de notificações"
        },
        {
            "name": "/convites",
            "description": "Convites de contratantes para freelancers"
        },
        {
            "name": "/admin",
            "description": "Painel da administração"
        },
        {
            "name": "/config",
            "description": "Cenário do site"
        },
        {
            "name": "/missoes",
            "description": "Missões da semana e do dia"
        },
        {
            "name": "/ranking",
            "description": "Ranking e temporadas"
        },
        {
            "name": "/publico",
            "description": "Rotas sem login: home, perfil público e certificado"
        },
        {
            "name": "/push",
            "description": "Avisos no celular (Web Push)"
        },
        {
            "name": "/denuncias",
            "description": "Denúncias"
        },
        {
            "name": "/passos",
            "description": "Primeiros passos do freelancer"
        },
        {
            "name": "/buscas",
            "description": "Alertas de busca"
        },
        {
            "name": "/conquistas",
            "description": "Conquistas secretas e álbum de insígnias"
        },
        {
            "name": "/carteira",
            "description": "Carteira fictícia (simulação de pagamento)"
        },
        {
            "name": "/loja",
            "description": "Loja de cosméticos com XP"
        },
        {
            "name": "/eventos",
            "description": "Eventos sazonais"
        },
        {
            "name": "/tarefas",
            "description": "Tarefas agendadas (Vercel Cron)"
        },
        {
            "name": "/guildas",
            "description": "Guildas de freelancers"
        },
        {
            "name": "/testes",
            "description": "Testes de habilidade"
        },
        {
            "name": "/comunidade",
            "description": ""
        },
        {
            "name": "/orcamentos",
            "description": ""
        }
    ],
    "components": {
        "securitySchemes": {
            "token": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT"
            }
        }
    },
    "paths": {
        "/auth": {
            "get": {
                "tags": [
                    "/auth"
                ],
                "summary": "Test",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/auth/register": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Register",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/auth/login": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Login",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/auth/google": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Login google",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/auth/codigo": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Confirmar codigo",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/auth/confirmar-email": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Confirmar email",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/auth/confirmar-email/reenviar": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Reenviar confirmacao",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/auth/esqueci-senha": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Esqueci senha",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/auth/redefinir-senha": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Redefinir senha",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/auth/seguranca": {
            "get": {
                "tags": [
                    "/auth"
                ],
                "summary": "Situacao seguranca",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/auth/2fa/codigo": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Pedir codigo2fa",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/auth/2fa": {
            "put": {
                "tags": [
                    "/auth"
                ],
                "summary": "Salvar2fa",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/auth/sessoes": {
            "get": {
                "tags": [
                    "/auth"
                ],
                "summary": "Listar sessoes",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/auth/sessoes/{id}": {
            "delete": {
                "tags": [
                    "/auth"
                ],
                "summary": "Encerrar sessao",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/auth/sessoes/encerrar-outras": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Encerrar outras",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/auth/sair": {
            "post": {
                "tags": [
                    "/auth"
                ],
                "summary": "Sair",
                "description": "Confirmar o e-mail do cadastro (código de 6 números).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Buscar meu perfil",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/areas": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Listar minhas areas",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Salvar minhas areas",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/disponibilidade": {
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Salvar disponibilidade",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/atividade": {
            "post": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Marcar atividade",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/resumo": {
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Salvar resumo email",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/resumo-previa": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Previa resumo",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/dados": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Baixar dados",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/ganhos": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Ganhos",
                "description": "Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/eu/mascote": {
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Salvar mascote",
                "description": "Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/eu/visitas": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Minhas visitas",
                "description": "Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/eu/agenda": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Agenda",
                "description": "Papel: freelancer ou contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/eu/retrospectiva": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Retrospectiva",
                "description": "Papel: freelancer ou contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/eu/marcos": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Marcos",
                "description": "Papel: freelancer ou contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/eu/avisos": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Ver avisos",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Salvar avisos",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/privacidade": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Ver privacidade",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Salvar privacidade",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/indicacao": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Minha indicacao",
                "description": "Papel: freelancer ou contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/eu/bloqueados": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Listar bloqueados",
                "description": "Bloqueio (qualquer conta bloqueia qualquer uma, menos a administração).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/bloqueios/{usuId}": {
            "post": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Bloquear",
                "description": "Bloqueio (qualquer conta bloqueia qualquer uma, menos a administração).",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Desbloquear",
                "description": "Bloqueio (qualquer conta bloqueia qualquer uma, menos a administração).",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/usuarios/eu/horarios": {
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Salvar horarios",
                "description": "Horários de atendimento do freelancer. Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/notas/{usuId}": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Ver nota",
                "description": "Do contratante sobre um freelancer: anotação privada e \"me avise quando estiver livre\". Papel: contratante.",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Salvar nota",
                "description": "Do contratante sobre um freelancer: anotação privada e \"me avise quando estiver livre\". Papel: contratante.",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/freelancers/{usuId}/aviso-livre": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Ver aviso disponivel",
                "description": "Do contratante sobre um freelancer: anotação privada e \"me avise quando estiver livre\". Papel: contratante.",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "post": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Pedir aviso disponivel",
                "description": "Do contratante sobre um freelancer: anotação privada e \"me avise quando estiver livre\". Papel: contratante.",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Cancelar aviso disponivel",
                "description": "Do contratante sobre um freelancer: anotação privada e \"me avise quando estiver livre\". Papel: contratante.",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/eu/modelos": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Listar modelos",
                "description": "Cartas de candidatura salvas (freelancer). Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "post": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Criar modelo",
                "description": "Cartas de candidatura salvas (freelancer). Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/eu/modelos/{id}": {
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Editar modelo",
                "description": "Cartas de candidatura salvas (freelancer). Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Apagar modelo",
                "description": "Cartas de candidatura salvas (freelancer). Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/favoritos": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Listar favoritos",
                "description": "Freelancers que o contratante guardou. Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/favoritos/{usuId}": {
            "post": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Favoritar",
                "description": "Freelancers que o contratante guardou. Papel: contratante.",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Desfavoritar",
                "description": "Freelancers que o contratante guardou. Papel: contratante.",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/freelancers": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Listar freelancers",
                "description": "Freelancers que o contratante guardou. Papel: contratante ou administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/freelancers/comparar": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Comparar freelancers",
                "description": "Freelancers que o contratante guardou. Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Listar usuarios",
                "description": "Freelancers que o contratante guardou. Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/usuarios/{id}": {
            "get": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Buscar usuario",
                "description": "Freelancers que o contratante guardou.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "put": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Atualizar usuario",
                "description": "Freelancers que o contratante guardou.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/usuarios"
                ],
                "summary": "Deletar usuario",
                "description": "Freelancers que o contratante guardou.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/abertos": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Listar servicos abertos",
                "description": "Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/amostra": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Pedir amostra",
                "description": "Trabalho de amostra: tarefa pequena para testar um freelancer antes do projeto grande. Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/meus": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Listar meus servicos",
                "description": "Trabalho de amostra: tarefa pequena para testar um freelancer antes do projeto grande. Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/salvos": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Listar salvos",
                "description": "Trabalho de amostra: tarefa pequena para testar um freelancer antes do projeto grande. Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/precos": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Precos sugeridos",
                "description": "Trabalho de amostra: tarefa pequena para testar um freelancer antes do projeto grande. Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/outros": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Listar outros servicos",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/{id}/parecidos": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Listar parecidos",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/{id}/salvar": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Salvar",
                "description": "Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Remover",
                "description": "Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/candidaturas": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Candidatar se",
                "description": "Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Cancelar candidatura",
                "description": "Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/entregar": {
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Entregar servico",
                "description": "Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/finalizar": {
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Finalizar servico",
                "description": "Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/acordo": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Ver acordo",
                "description": "Depois da contratação: termo de acordo, garantia, ajustes e disputa.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Aceitar acordo",
                "description": "Depois da contratação: termo de acordo, garantia, ajustes e disputa.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/{id}/garantia": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Depositar garantia",
                "description": "Depois da contratação: termo de acordo, garantia, ajustes e disputa. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/ajustes": {
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Pedir ajustes",
                "description": "Depois da contratação: termo de acordo, garantia, ajustes e disputa. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/disputa": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Abrir disputa",
                "description": "Depois da contratação: termo de acordo, garantia, ajustes e disputa.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/{id}/bonus": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Dar bonus",
                "description": "Depois da contratação: termo de acordo, garantia, ajustes e disputa. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/recibo": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Ver recibo",
                "description": "Depois da contratação: termo de acordo, garantia, ajustes e disputa.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/{id}/pausa": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Pedir pausa",
                "description": "Pausar o prazo: uma parte pede, a outra aceita; qualquer uma retoma.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Responder pausa",
                "description": "Pausar o prazo: uma parte pede, a outra aceita; qualquer uma retoma.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/{id}/horas": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Listar horas",
                "description": "Horas trabalhadas (projetos por hora): o freelancer registra, o contratante aprova.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Registrar horas",
                "description": "Horas trabalhadas (projetos por hora): o freelancer registra, o contratante aprova. Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/horas/{horId}": {
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Decidir horas",
                "description": "Horas trabalhadas (projetos por hora): o freelancer registra, o contratante aprova.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    },
                    {
                        "name": "horId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/{id}/criterios": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Listar criterios",
                "description": "Critérios de aceite: o contratante define, o freelancer marca, o contratante aprova.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Criar criterio",
                "description": "Critérios de aceite: o contratante define, o freelancer marca, o contratante aprova. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/criterios/{criId}": {
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Mudar criterio",
                "description": "Critérios de aceite: o contratante define, o freelancer marca, o contratante aprova.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    },
                    {
                        "name": "criId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/{id}/versoes": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Listar versoes",
                "description": "Versões da entrega e projeto recorrente.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/servicos/{id}/repetir": {
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Configurar repeticao",
                "description": "Versões da entrega e projeto recorrente. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/repetir-agora": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Repetir agora",
                "description": "Versões da entrega e projeto recorrente. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/etapas": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Listar etapas",
                "description": "Etapas: o contratante cria e remove, o freelancer contratado marca como feita.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Criar etapa",
                "description": "Etapas: o contratante cria e remove, o freelancer contratado marca como feita. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/etapas/{etaId}": {
            "delete": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Remover etapa",
                "description": "Etapas: o contratante cria e remove, o freelancer contratado marca como feita. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    },
                    {
                        "name": "etaId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Concluir etapa",
                "description": "Etapas: o contratante cria e remove, o freelancer contratado marca como feita. Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    },
                    {
                        "name": "etaId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}/etapas/{etaId}/aprovar": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Aprovar etapa",
                "description": "Etapas: o contratante cria e remove, o freelancer contratado marca como feita. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    },
                    {
                        "name": "etaId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos/{id}": {
            "get": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Buscar servico por id",
                "description": "Etapas: o contratante cria e remove, o freelancer contratado marca como feita.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "put": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Atualizar servico",
                "description": "Etapas: o contratante cria e remove, o freelancer contratado marca como feita. Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/servicos": {
            "post": {
                "tags": [
                    "/servicos"
                ],
                "summary": "Criar servico",
                "description": "Etapas: o contratante cria e remove, o freelancer contratado marca como feita. Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/candidaturas/minhas": {
            "get": {
                "tags": [
                    "/candidaturas"
                ],
                "summary": "Listar minhas candidaturas",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/candidaturas/recebidas": {
            "get": {
                "tags": [
                    "/candidaturas"
                ],
                "summary": "Listar candidaturas recebidas",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/candidaturas/{id}": {
            "put": {
                "tags": [
                    "/candidaturas"
                ],
                "summary": "Responder candidatura",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens": {
            "get": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Listar conversas",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "post": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Enviar mensagem",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/novas": {
            "get": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Aguardar mensagens",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/contatos": {
            "get": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Listar contatos",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/arquivo/{msgId}": {
            "get": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Baixar arquivo",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "parameters": [
                    {
                        "name": "msgId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/proposta": {
            "post": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Enviar proposta",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/proposta/{msgId}": {
            "put": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Responder proposta",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "parameters": [
                    {
                        "name": "msgId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/reuniao": {
            "post": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Marcar reuniao",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/reuniao/{msgId}": {
            "put": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Responder reuniao",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "parameters": [
                    {
                        "name": "msgId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/digitando": {
            "post": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Avisar digitando",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/{servId}/{outroId}/estado": {
            "get": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Estado conversa",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "parameters": [
                    {
                        "name": "servId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    },
                    {
                        "name": "outroId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/mensagens/{servId}/{outroId}": {
            "get": {
                "tags": [
                    "/mensagens"
                ],
                "summary": "Listar mensagens",
                "description": "Tempo real: segura a resposta até chegar mensagem nova.",
                "parameters": [
                    {
                        "name": "servId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    },
                    {
                        "name": "outroId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/historico": {
            "get": {
                "tags": [
                    "/historico"
                ],
                "summary": "Listar historico",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/portfolio/meu": {
            "get": {
                "tags": [
                    "/portfolio"
                ],
                "summary": "Listar meu portfolio",
                "description": "Ordem das rotas.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/portfolio/freelancer/{usuId}": {
            "get": {
                "tags": [
                    "/portfolio"
                ],
                "summary": "Listar por freelancer",
                "description": "Ordem das rotas.",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/portfolio": {
            "post": {
                "tags": [
                    "/portfolio"
                ],
                "summary": "Criar item",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/portfolio/de-projeto/{servId}": {
            "post": {
                "tags": [
                    "/portfolio"
                ],
                "summary": "Criar de projeto",
                "parameters": [
                    {
                        "name": "servId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/portfolio/{id}": {
            "put": {
                "tags": [
                    "/portfolio"
                ],
                "summary": "Atualizar item",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/portfolio"
                ],
                "summary": "Deletar item",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/perfil/freelancer/eu": {
            "get": {
                "tags": [
                    "/perfil"
                ],
                "summary": "Meu perfil freelancer",
                "description": "Ordem das rotas.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/perfil/freelancer/{usuId}": {
            "get": {
                "tags": [
                    "/perfil"
                ],
                "summary": "Perfil freelancer",
                "description": "Ordem das rotas.",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/perfil/contratante/eu": {
            "get": {
                "tags": [
                    "/perfil"
                ],
                "summary": "Meu perfil contratante",
                "description": "Ordem das rotas.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/avaliacoes/pendentes": {
            "get": {
                "tags": [
                    "/avaliacoes"
                ],
                "summary": "Listar pendentes",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/avaliacoes": {
            "post": {
                "tags": [
                    "/avaliacoes"
                ],
                "summary": "Criar avaliacao",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/notificacoes": {
            "get": {
                "tags": [
                    "/notificacoes"
                ],
                "summary": "Listar notificacoes",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/notificacoes/lidas": {
            "put": {
                "tags": [
                    "/notificacoes"
                ],
                "summary": "Marcar todas lidas",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/convites/recebidos": {
            "get": {
                "tags": [
                    "/convites"
                ],
                "summary": "Listar recebidos",
                "description": "Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/convites/enviados": {
            "get": {
                "tags": [
                    "/convites"
                ],
                "summary": "Listar enviados",
                "description": "Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/convites": {
            "post": {
                "tags": [
                    "/convites"
                ],
                "summary": "Criar convite",
                "description": "Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/convites/{id}": {
            "put": {
                "tags": [
                    "/convites"
                ],
                "summary": "Responder convite",
                "description": "Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/resumo": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Resumo",
                "description": "Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/metricas": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Metricas",
                "description": "Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/usuarios": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Listar usuarios",
                "description": "Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/usuarios/{id}/status": {
            "put": {
                "tags": [
                    "/admin"
                ],
                "summary": "Alterar status",
                "description": "Papel: administrador.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/servicos": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Listar servicos",
                "description": "Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/servicos/{id}/cancelar": {
            "put": {
                "tags": [
                    "/admin"
                ],
                "summary": "Cancelar servico",
                "description": "Papel: administrador.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/denuncias": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Listar denuncias",
                "description": "Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/moderacao": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Fila moderacao",
                "description": "Filtro de spam: projetos esperando revisão. Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/moderacao/{id}": {
            "put": {
                "tags": [
                    "/admin"
                ],
                "summary": "Decidir moderacao",
                "description": "Filtro de spam: projetos esperando revisão. Papel: administrador.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/erros": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Listar erros",
                "description": "Monitor de erros do site e do servidor. Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/admin"
                ],
                "summary": "Limpar erros",
                "description": "Funil (onde as pessoas desistem) e saúde do servidor. Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/funil": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Funil",
                "description": "Funil (onde as pessoas desistem) e saúde do servidor. Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/saude": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Saude",
                "description": "Funil (onde as pessoas desistem) e saúde do servidor. Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/erros/{id}": {
            "delete": {
                "tags": [
                    "/admin"
                ],
                "summary": "Limpar erros",
                "description": "Funil (onde as pessoas desistem) e saúde do servidor. Papel: administrador.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/denuncias/{id}": {
            "put": {
                "tags": [
                    "/admin"
                ],
                "summary": "Fechar denuncia",
                "description": "Funil (onde as pessoas desistem) e saúde do servidor. Papel: administrador.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/disputas": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Listar disputas",
                "description": "Funil (onde as pessoas desistem) e saúde do servidor. Papel: administrador.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/disputas/{id}": {
            "put": {
                "tags": [
                    "/admin"
                ],
                "summary": "Resolver disputa",
                "description": "Funil (onde as pessoas desistem) e saúde do servidor. Papel: administrador.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/usuarios/{id}/papel": {
            "put": {
                "tags": [
                    "/admin"
                ],
                "summary": "Mudar papel",
                "description": "Só o administrador supremo. Papel: administrador ou supremo.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/usuarios/{id}/entrar": {
            "post": {
                "tags": [
                    "/admin"
                ],
                "summary": "Entrar como",
                "description": "Só o administrador supremo. Papel: administrador ou supremo.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/usuarios/{id}": {
            "delete": {
                "tags": [
                    "/admin"
                ],
                "summary": "Excluir usuario",
                "description": "Só o administrador supremo. Papel: administrador ou supremo.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/avisos": {
            "post": {
                "tags": [
                    "/admin"
                ],
                "summary": "Enviar aviso",
                "description": "Só o administrador supremo. Papel: administrador ou supremo.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/cenario": {
            "put": {
                "tags": [
                    "/admin"
                ],
                "summary": "Salvar cenario",
                "description": "Só o administrador supremo. Papel: administrador ou supremo.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/registro": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Listar registro",
                "description": "Só o administrador supremo. Papel: administrador ou supremo.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/admin/migracoes": {
            "get": {
                "tags": [
                    "/admin"
                ],
                "summary": "Ver migracoes",
                "description": "Migrations do banco pelo servidor (sem precisar da senha do banco). Papel: administrador ou supremo.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "post": {
                "tags": [
                    "/admin"
                ],
                "summary": "Rodar migracoes",
                "description": "Migrations do banco pelo servidor (sem precisar da senha do banco). Papel: administrador ou supremo.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/config/cenario": {
            "get": {
                "tags": [
                    "/config"
                ],
                "summary": "Ver cenario",
                "description": "Público: o cenário que o supremo definiu para o site inteiro.",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/missoes": {
            "get": {
                "tags": [
                    "/missoes"
                ],
                "summary": "Listar missoes",
                "description": "Missões da semana (freelancer). Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/missoes/{codigo}/resgatar": {
            "post": {
                "tags": [
                    "/missoes"
                ],
                "summary": "Resgatar missao",
                "description": "Missões da semana (freelancer). Papel: freelancer.",
                "parameters": [
                    {
                        "name": "codigo",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/ranking": {
            "get": {
                "tags": [
                    "/ranking"
                ],
                "summary": "Ranking",
                "description": "Ranking dos freelancers (qualquer conta logada vê).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/ranking/campeoes": {
            "get": {
                "tags": [
                    "/ranking"
                ],
                "summary": "Campeoes",
                "description": "Os 3 primeiros do mês passado (ganham a moldura da temporada).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/publico/depoimentos": {
            "get": {
                "tags": [
                    "/publico"
                ],
                "summary": "Depoimentos",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/publico/contato": {
            "post": {
                "tags": [
                    "/publico"
                ],
                "summary": "Contato",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/publico/freelancer/{usuId}": {
            "get": {
                "tags": [
                    "/publico"
                ],
                "summary": "Perfil freelancer",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/publico/certificado/{servId}": {
            "get": {
                "tags": [
                    "/publico"
                ],
                "summary": "Certificado",
                "parameters": [
                    {
                        "name": "servId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/publico/mural": {
            "get": {
                "tags": [
                    "/publico"
                ],
                "summary": "Mural",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/publico/erros": {
            "post": {
                "tags": [
                    "/publico"
                ],
                "summary": "Receber erro site",
                "description": "Modo TV: números da plataforma (o navegador guarda por 1 minuto).",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    }
                }
            }
        },
        "/push/chave": {
            "get": {
                "tags": [
                    "/push"
                ],
                "summary": "Chave push",
                "description": "Notificações no celular, denúncias e primeiros passos.",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/push/inscricao": {
            "post": {
                "tags": [
                    "/push"
                ],
                "summary": "Inscrever push",
                "description": "Notificações no celular, denúncias e primeiros passos.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "delete": {
                "tags": [
                    "/push"
                ],
                "summary": "Desinscrever push",
                "description": "Notificações no celular, denúncias e primeiros passos.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/denuncias": {
            "post": {
                "tags": [
                    "/denuncias"
                ],
                "summary": "Denunciar",
                "description": "Papel: freelancer ou contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/passos": {
            "get": {
                "tags": [
                    "/passos"
                ],
                "summary": "Listar passos",
                "description": "Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/passos/{codigo}/resgatar": {
            "post": {
                "tags": [
                    "/passos"
                ],
                "summary": "Resgatar passo",
                "description": "Papel: freelancer.",
                "parameters": [
                    {
                        "name": "codigo",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/buscas": {
            "get": {
                "tags": [
                    "/buscas"
                ],
                "summary": "Listar buscas",
                "description": "Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "post": {
                "tags": [
                    "/buscas"
                ],
                "summary": "Criar busca",
                "description": "Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/buscas/{id}": {
            "delete": {
                "tags": [
                    "/buscas"
                ],
                "summary": "Remover busca",
                "description": "Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/conquistas": {
            "get": {
                "tags": [
                    "/conquistas"
                ],
                "summary": "Listar conquistas",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/conquistas/album": {
            "get": {
                "tags": [
                    "/conquistas"
                ],
                "summary": "Album",
                "description": "Álbum: todas as insígnias e conquistas, com quantos por cento das pessoas já têm cada uma.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/conquistas/{codigo}": {
            "post": {
                "tags": [
                    "/conquistas"
                ],
                "summary": "Desbloquear",
                "description": "Álbum: todas as insígnias e conquistas, com quantos por cento das pessoas já têm cada uma.",
                "parameters": [
                    {
                        "name": "codigo",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/carteira": {
            "get": {
                "tags": [
                    "/carteira"
                ],
                "summary": "Ver carteira",
                "description": "Carteira fictícia (simulação de pagamento com garantia). Papel: freelancer ou contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/carteira/credito": {
            "post": {
                "tags": [
                    "/carteira"
                ],
                "summary": "Adicionar credito",
                "description": "Carteira fictícia (simulação de pagamento com garantia). Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/loja": {
            "get": {
                "tags": [
                    "/loja"
                ],
                "summary": "Ver loja",
                "description": "Loja de cosméticos (gasta XP, então é dos freelancers). Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/loja/tema": {
            "get": {
                "tags": [
                    "/loja"
                ],
                "summary": "Meu tema",
                "description": "Loja de cosméticos (gasta XP, então é dos freelancers).",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/loja/equipar": {
            "put": {
                "tags": [
                    "/loja"
                ],
                "summary": "Equipar",
                "description": "Loja de cosméticos (gasta XP, então é dos freelancers). Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/loja/{codigo}/comprar": {
            "post": {
                "tags": [
                    "/loja"
                ],
                "summary": "Comprar",
                "description": "Loja de cosméticos (gasta XP, então é dos freelancers). Papel: freelancer.",
                "parameters": [
                    {
                        "name": "codigo",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/eventos": {
            "get": {
                "tags": [
                    "/eventos"
                ],
                "summary": "Ver evento",
                "description": "Eventos sazonais: itens escondidos pelas páginas.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/eventos/coletar": {
            "post": {
                "tags": [
                    "/eventos"
                ],
                "summary": "Coletar",
                "description": "Eventos sazonais: itens escondidos pelas páginas.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/eventos/resgatar": {
            "post": {
                "tags": [
                    "/eventos"
                ],
                "summary": "Resgatar evento",
                "description": "Eventos sazonais: itens escondidos pelas páginas.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/tarefas/lembretes": {
            "get": {
                "tags": [
                    "/tarefas"
                ],
                "summary": "Tarefarodar lembretes",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/tarefas/resumo": {
            "get": {
                "tags": [
                    "/tarefas"
                ],
                "summary": "Tarefarodar resumo",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/tarefas/limpeza": {
            "get": {
                "tags": [
                    "/tarefas"
                ],
                "summary": "Tarefarodar limpeza",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/tarefas/migrar": {
            "get": {
                "tags": [
                    "/tarefas"
                ],
                "summary": "Tarefalistar migracoes",
                "description": "Migrations do banco com a mesma chave (para quando ninguém tem a senha do banco nem do supremo).",
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    }
                }
            }
        },
        "/guildas": {
            "get": {
                "tags": [
                    "/guildas"
                ],
                "summary": "Listar",
                "description": "Guildas de freelancers (até 6 por guilda, uma guilda por pessoa). Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "post": {
                "tags": [
                    "/guildas"
                ],
                "summary": "Criar",
                "description": "Guildas de freelancers (até 6 por guilda, uma guilda por pessoa). Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/guildas/sair": {
            "post": {
                "tags": [
                    "/guildas"
                ],
                "summary": "Sair",
                "description": "Guildas de freelancers (até 6 por guilda, uma guilda por pessoa). Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/guildas/{id}": {
            "put": {
                "tags": [
                    "/guildas"
                ],
                "summary": "Editar",
                "description": "Guildas de freelancers (até 6 por guilda, uma guilda por pessoa). Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/guildas/{id}/entrar": {
            "post": {
                "tags": [
                    "/guildas"
                ],
                "summary": "Entrar",
                "description": "Guildas de freelancers (até 6 por guilda, uma guilda por pessoa). Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/guildas/{id}/membros/{usuId}": {
            "delete": {
                "tags": [
                    "/guildas"
                ],
                "summary": "Remover membro",
                "description": "Guildas de freelancers (até 6 por guilda, uma guilda por pessoa). Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    },
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/testes": {
            "get": {
                "tags": [
                    "/testes"
                ],
                "summary": "Listar testes",
                "description": "Testes de habilidade: quem passa ganha o selo da área. Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/testes/{tipoId}": {
            "get": {
                "tags": [
                    "/testes"
                ],
                "summary": "Ver teste",
                "description": "Testes de habilidade: quem passa ganha o selo da área. Papel: freelancer.",
                "parameters": [
                    {
                        "name": "tipoId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "post": {
                "tags": [
                    "/testes"
                ],
                "summary": "Responder teste",
                "description": "Testes de habilidade: quem passa ganha o selo da área. Papel: freelancer.",
                "parameters": [
                    {
                        "name": "tipoId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/comunidade/chefao": {
            "get": {
                "tags": [
                    "/comunidade"
                ],
                "summary": "Ver chefao",
                "description": "Chefão do mês (todo o castelo junto) e o prêmio de quem ajudou.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/comunidade/chefao/resgatar": {
            "post": {
                "tags": [
                    "/comunidade"
                ],
                "summary": "Resgatar chefao",
                "description": "Chefão do mês (todo o castelo junto) e o prêmio de quem ajudou. Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/comunidade/desafio": {
            "get": {
                "tags": [
                    "/comunidade"
                ],
                "summary": "Ver desafio",
                "description": "Desafio da semana: freelancers mandam, todo mundo logado vota.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            },
            "post": {
                "tags": [
                    "/comunidade"
                ],
                "summary": "Enviar desafio",
                "description": "Desafio da semana: freelancers mandam, todo mundo logado vota. Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/comunidade/desafio/{envId}/voto": {
            "post": {
                "tags": [
                    "/comunidade"
                ],
                "summary": "Votar desafio",
                "description": "Desafio da semana: freelancers mandam, todo mundo logado vota.",
                "parameters": [
                    {
                        "name": "envId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/comunidade/arvore": {
            "get": {
                "tags": [
                    "/comunidade"
                ],
                "summary": "Ver arvore",
                "description": "Árvore de habilidades (a minha ou a de um freelancer). Papel: freelancer.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/comunidade/arvore/{usuId}": {
            "get": {
                "tags": [
                    "/comunidade"
                ],
                "summary": "Ver arvore",
                "description": "Árvore de habilidades (a minha ou a de um freelancer).",
                "parameters": [
                    {
                        "name": "usuId",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/comunidade/guildas/{id}/missoes": {
            "get": {
                "tags": [
                    "/comunidade"
                ],
                "summary": "Ver missoes guilda",
                "description": "Missões do mês de uma guilda.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    }
                }
            }
        },
        "/orcamentos": {
            "get": {
                "tags": [
                    "/orcamentos"
                ],
                "summary": "Listar pedidos",
                "description": "Papel: freelancer ou contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            },
            "post": {
                "tags": [
                    "/orcamentos"
                ],
                "summary": "Criar pedido",
                "description": "Papel: contratante.",
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/orcamentos/{id}/resposta": {
            "put": {
                "tags": [
                    "/orcamentos"
                ],
                "summary": "Responder pedido",
                "description": "Papel: freelancer.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        },
        "/orcamentos/{id}/fechar": {
            "put": {
                "tags": [
                    "/orcamentos"
                ],
                "summary": "Fechar pedido",
                "description": "Papel: contratante.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "security": [
                    {
                        "token": []
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deu certo (JSON)"
                    },
                    "400": {
                        "description": "Dados inválidos: { erro }"
                    },
                    "401": {
                        "description": "Sem login ou sessão encerrada"
                    },
                    "403": {
                        "description": "Papel sem permissão"
                    }
                }
            }
        }
    }
}
