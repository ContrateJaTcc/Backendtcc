import db from '../config/knex.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { verificarTokenGoogle, ErroGoogle } from '../services/google.js'
import { enviarEmail, emailConfigurado } from '../services/email.js'
import { EMAIL_SUPREMO, ehSupremo } from '../config/supremo.js'
import { temTabela, temColuna } from '../services/registro.js'
import { quemIndicou } from './indicacaoController.js'
import { conferirLocal, emailValido, erroCpf, erroNascimento, erroNome, erroSenha, erroTelefone } from '../services/validacao.js'

export const test = async (req, res) => {
    res.json({
        message: 'controller funcionando >.<'
    })
}

const CONTAS_BLOQUEADAS = ['suspensa', 'banida']

/* Sessão: 1 hora; com "manter conectado", 30 dias (o supremo, por segurança, no máximo 12 horas) */
const duracaoSessao = (usuario, lembrar) => (!lembrar ? '1h' : ehSupremo(usuario) ? '12h' : '30d')

/* sid: a sessão guardada na tabela "sessao" (dá para encerrar à distância nas Configurações) */
const gerarToken = (usuario, lembrar = false, sid = null) => jwt.sign(
    {
        id: usuario.usu_id,
        email: usuario.usu_email,
        tipo: usuario.tipo_usuario,
        ...(sid ? { sid } : {})
    },
    process.env.JWT_SECRET,
    { expiresIn: duracaoSessao(usuario, lembrar) }
)

/* "Chrome no Windows" a partir do navegador que pediu o login */
function descreverAparelho(agente = '') {
    const a = String(agente)
    const navegador = /Edg\//.test(a) ? 'Edge' : /OPR\//.test(a) ? 'Opera' : /Firefox\//.test(a) ? 'Firefox' : /Chrome\//.test(a) ? 'Chrome' : /Safari\//.test(a) ? 'Safari' : 'Navegador'
    const sistema = /Android/.test(a) ? 'Android' : /iPhone|iPad/.test(a) ? 'iPhone' : /Windows/.test(a) ? 'Windows' : /Mac OS X/.test(a) ? 'Mac' : /Linux/.test(a) ? 'Linux' : 'aparelho desconhecido'
    return `${navegador} no ${sistema}`
}

async function abrirSessao(usuario, req) {
    if (!req || !(await temTabela('sessao'))) return null
    const ses_id = crypto.randomUUID()
    await db('sessao').insert({
        ses_id,
        usu_id: usuario.usu_id,
        ses_agente: descreverAparelho(req.headers?.['user-agent']).slice(0, 200),
        ses_ip: String(req.ip ?? '').slice(0, 60) || null
    })
    return ses_id
}

/*
 * A conta do supremo (config/supremo.js) vira administrador ativa ao entrar, se ainda não for:
 * assim ela não depende de rodar comando no banco nem pode ser deixada de fora por engano.
 */
async function garantirSupremo(usuario) {
    const ehAConta = String(usuario.usu_email ?? '').trim().toLowerCase() === EMAIL_SUPREMO

    if (!ehAConta || (usuario.tipo_usuario === 'administrador' && usuario.status_conta === 'ativa')) return usuario

    await db('usuario').where('usu_id', usuario.usu_id).update({
        tipo_usuario: 'administrador',
        status_conta: 'ativa',
        data_atualizacao: db.fn.now()
    })

    return { ...usuario, tipo_usuario: 'administrador', status_conta: 'ativa' }
}

const respostaLogin = async (usuario, lembrar = false, req = null) => ({
    mensagem: 'Login bem-sucedido! ^w^',
    token: gerarToken(usuario, lembrar, await abrirSessao(usuario, req)),
    tipo: usuario.tipo_usuario,
    usuario: {
        id: usuario.usu_id,
        nome: usuario.usu_nome,
        email: usuario.usu_email,
        tipo: usuario.tipo_usuario
    }
})

export const register = async (req, res) => {
    try {
        const {
            nome,
            cpf,
            telefone,
            data_nasc,
            cidade,
            estado,
            tipo,
            googleToken,
            aceitouTermos,
            convite
        } = req.body

        let { email, senha } = req.body

    
        if (googleToken) {
            const google = await verificarTokenGoogle(googleToken)
            email = google.email
            senha = crypto.randomBytes(32).toString('hex')
        }

        if (
            !nome ||
            !email ||
            !senha ||
            !cpf ||
            !telefone ||
            !data_nasc ||
            !cidade ||
            !estado ||
            !tipo
        ) {
            return res.status(400).json({
                erro: 'Todos os campos obrigatórios devem ser preenchidos >.<'
            })
        }

        if (!aceitouTermos) {
            return res.status(400).json({
                erro: 'É preciso aceitar os Termos de Uso para criar a conta.'
            })
        }

        if (tipo !== 'freelancer' && tipo !== 'contratante') {
            return res.status(400).json({
                erro: 'Tipo de usuário inválido.'
            })
        }

        email = String(email).trim().toLowerCase()
        const local = conferirLocal(cidade, estado)

        /* O primeiro problema encontrado, na ordem dos campos do formulário */
        const problema =
            erroNome(nome) ||
            (emailValido(email) ? '' : 'E-mail inválido.') ||
            (googleToken ? '' : erroSenha(senha)) ||
            erroCpf(cpf) ||
            erroTelefone(telefone) ||
            erroNascimento(data_nasc) ||
            local.erro

        if (problema) {
            return res.status(400).json({ erro: problema })
        }

        const cpfLimpo = String(cpf).replace(/\D/g, '')
        const telLimpo = String(telefone).replace(/\D/g, '')

        const usuarioExistente = await db('usuario')
            .select('usu_id')
            .where('usu_email', email)
            .first()

        if (usuarioExistente) {
            return res.status(409).json({
                erro: 'Este e-mail já está sendo usado O.o'
            })
        }

        const cpfExistente = await db('usuario')
            .select('usu_id')
            .where('usu_cpf', cpfLimpo)
            .first()

        if (cpfExistente) {
            return res.status(409).json({
                erro: 'Este CPF já está cadastrado O.o'
            })
        }

        const senhaCriptografada = await bcrypt.hash(senha, 10)
        /* Convide um amigo: código inválido não impede o cadastro, só não liga a ninguém */
        const indicadoPor = await quemIndicou(convite)
        /* Cadastro com e-mail e senha precisa confirmar o e-mail (o Google já confirmou o dele) */
        const confirmar = !googleToken && (await confirmacaoPossivel())

        await db.transaction(async (trx) => {

            const [usu_id] = await trx('usuario').insert({
                usu_nome: String(nome).trim().replace(/\s+/g, ' '),
                usu_email: email,
                usu_senha: senhaCriptografada,
                usu_cpf: cpfLimpo,
                usu_tel: telLimpo,
                usu_data_nasc: data_nasc,
                usu_cid: local.cidade,
                usu_est: local.estado,
                tipo_usuario: tipo,
                ...(indicadoPor ? { usu_indicado_por: indicadoPor } : {}),
                ...(confirmar ? { usu_email_confirmado: false } : {})
            })

            if (tipo === 'contratante') {
                await trx('contratante').insert({
                    usu_id
                })
            }

            if (tipo === 'freelancer') {
                await trx('freelancer').insert({
                    usu_id
                })
            }
        })

        /* Sessão Google */
        if (googleToken) {
            const usuario = await db('usuario').where('usu_email', email).first()

            return res.status(201).json(await respostaLogin(usuario, false, req))
        }

        if (confirmar) {
            const usuario = await db('usuario').where('usu_email', email).first()
            return res.status(201).json({ mensagem: 'Conta criada! Falta confirmar o e-mail.', ...(await pedirConfirmacao(usuario)) })
        }

        return res.status(201).json({
            mensagem: 'Usuário cadastrado com sucesso! ^w^'
        })

    } catch (erro) {
        if (erro instanceof ErroGoogle) {
            return res.status(401).json({ erro: erro.message })
        }

        console.error(erro)

        /* Duplicado */
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                erro: 'E-mail ou CPF já cadastrado O.o'
            })
        }

        return res.status(500).json({
            erro: 'Erro ao cadastrar usuário >.<'
        })
    }
}

export const login = async (req, res) => {
    try {
        const email = String(req.body.email ?? '').trim()
        const { senha } = req.body
        const lembrar = Boolean(req.body.lembrar)

        if (!email || !senha) {
            return res.status(400).json({
                erro: 'E-mail e senha são obrigatórios >:('
            })
        }

        const usuarios = await db('usuario')
            .select('*')
            .where('usu_email', email)

        /* Mensagem genérica */
        const ERRO_CREDENCIAIS = { erro: 'E-mail ou senha incorretos.' }

        if (usuarios.length === 0) {
            return res.status(401).json(ERRO_CREDENCIAIS)
        }

        const senhaCorreta = await bcrypt.compare(
            senha,
            usuarios[0].usu_senha
        )

        if (!senhaCorreta) {
            return res.status(401).json(ERRO_CREDENCIAIS)
        }

        /* Só depois da senha certa: a conta do supremo vira administrador */
        const usuario = await garantirSupremo(usuarios[0])

        if (CONTAS_BLOQUEADAS.includes(usuario.status_conta)) {
            return res.status(403).json({
                erro: `Sua conta está ${usuario.status_conta}. Fale com o suporte.`
            })
        }

        /* E-mail ainda não confirmado: manda um código novo e pede para digitar */
        if (usuario.usu_email_confirmado === 0 || usuario.usu_email_confirmado === false) {
            if (await confirmacaoPossivel()) return res.json(await pedirConfirmacao(usuario, lembrar))
        }

        /* Supremo (ou quem ligou a verificação em 2 etapas): a senha não basta, falta o código mandado por e-mail */
        if (await precisaDeCodigo(usuario)) {
            return res.json(await pedirCodigo(usuario, lembrar))
        }

        return res.json(await respostaLogin(usuario, lembrar, req))

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao realizar login DX'
        })
    }
}

/* ---------- Confirmar o e-mail do cadastro ---------- */

/* Só quando o e-mail funciona de verdade: sem isso ninguém conseguiria entrar */
const confirmacaoPossivel = async () => emailConfigurado && (await temTabela('codigo_login')) && (await temColuna('usuario', 'usu_email_confirmado'))

async function pedirConfirmacao(usuario, lembrar = false) {
    await gerarCodigo(usuario, 'confirmar')
    return {
        confirmarEmail: true,
        email: mascararEmail(usuario.usu_email),
        /* Prova de que o cadastro (ou a senha) já passou; sozinho não abre sessão */
        desafio: jwt.sign({ pendente: usuario.usu_id, lembrar, proposito: 'confirmar' }, process.env.JWT_SECRET, { expiresIn: '1h' })
    }
}

function lerDesafioConfirmacao(texto) {
    try {
        const d = jwt.verify(String(texto ?? ''), process.env.JWT_SECRET, { algorithms: ['HS256'] })
        return d.proposito === 'confirmar' ? d : null
    } catch {
        return null
    }
}

export const confirmarEmail = async (req, res) => {
    try {
        const desafio = lerDesafioConfirmacao(req.body.desafio)
        if (!desafio) return res.status(401).json({ erro: 'O pedido expirou. Entre com e-mail e senha para receber outro código.' })

        const problema = await conferirCodigo(desafio.pendente, req.body.codigo)
        if (problema) return res.status(problema.status).json({ erro: problema.erro })

        await db('usuario').where('usu_id', desafio.pendente).update({ usu_email_confirmado: true })
        const usuario = await garantirSupremo(await db('usuario').where('usu_id', desafio.pendente).first())
        if (!usuario || CONTAS_BLOQUEADAS.includes(usuario.status_conta)) return res.status(403).json({ erro: 'Esta conta não pode entrar agora.' })

        return res.json({ ...(await respostaLogin(usuario, Boolean(desafio.lembrar), req)), mensagem: 'E-mail confirmado! Bem-vindo ao castelo.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao confirmar o e-mail.' })
    }
}

export const reenviarConfirmacao = async (req, res) => {
    try {
        const desafio = lerDesafioConfirmacao(req.body.desafio)
        if (!desafio) return res.status(401).json({ erro: 'O pedido expirou. Entre com e-mail e senha para receber outro código.' })
        const usuario = await db('usuario').where('usu_id', desafio.pendente).first()
        if (!usuario || usuario.usu_email_confirmado) return res.status(400).json({ erro: 'Este e-mail já foi confirmado.' })
        await gerarCodigo(usuario, 'confirmar')
        return res.json({ mensagem: `Mandamos outro código para ${mascararEmail(usuario.usu_email)}.` })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao mandar o código.' })
    }
}

/* ---------- Código por e-mail no login do supremo ---------- */

const VALIDADE_CODIGO_MINUTOS = 10
const TENTATIVAS_CODIGO = 5

/*
 * Só exige o código quando o e-mail funciona de verdade (SMTP configurado) e a tabela existe:
 * sem isso o supremo ficaria trancado para fora. SUPREMO_SEM_CODIGO=1 desliga de propósito.
 */
async function codigoObrigatorio() {
    return emailConfigurado && process.env.SUPREMO_SEM_CODIGO !== '1' && (await temTabela('codigo_login'))
}

/* Verificação em 2 etapas: precisa de e-mail funcionando e da tabela dos códigos */
const doisFatoresPossivel = async () => emailConfigurado && (await temTabela('codigo_login')) && (await temColuna('usuario', 'usu_2fa'))

async function precisaDeCodigo(usuario) {
    if (ehSupremo(usuario)) return codigoObrigatorio()
    return Boolean(usuario.usu_2fa) && (await doisFatoresPossivel())
}

/* m***s@gmail.com */
const mascararEmail = (email) => email.replace(/^(.)(.*)(.@.*)$/, (_, a, meio, b) => a + '*'.repeat(Math.max(1, meio.length)) + b)

/* Gera e manda o código; proposito "codigo" (login) ou "ativar2fa" (ligar/desligar nas Configurações) */
async function gerarCodigo(usuario, proposito = 'codigo') {
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')

    await db('codigo_login').where({ usu_id: usuario.usu_id, cod_usado: false }).update({ cod_usado: true })
    await db('codigo_login').insert({
        usu_id: usuario.usu_id,
        cod_hash: hashToken(codigo),
        cod_expira: new Date(Date.now() + VALIDADE_CODIGO_MINUTOS * 60_000)
    })

    await enviarEmail({
        para: usuario.usu_email,
        assunto: `${codigo} é o seu código de acesso - ContrateJá`,
        texto:
            (proposito === 'codigo'
                ? `Seu código para entrar no ContrateJá é ${codigo}.\n\n`
                : proposito === 'confirmar'
                    ? `Bem-vindo ao ContrateJá! Para confirmar o seu e-mail, digite o código ${codigo}.\n\n`
                    : `Seu código para mudar a verificação em 2 etapas é ${codigo}.\n\n`) +
            `Ele vale por ${VALIDADE_CODIGO_MINUTOS} minutos. Se não foi você, troque sua senha agora.`
    })
}

/* Confere o último código válido da pessoa; devolve null se deu certo ou a resposta de erro */
async function conferirCodigo(usu_id, digitadoBruto) {
    const pedido = await db('codigo_login')
        .where({ usu_id, cod_usado: false })
        .where('cod_expira', '>', new Date())
        .orderBy('cod_id', 'desc')
        .first()

    if (!pedido) return { status: 401, erro: 'O código expirou. Peça outro.' }

    if (pedido.cod_tentativas >= TENTATIVAS_CODIGO) {
        await db('codigo_login').where('cod_id', pedido.cod_id).update({ cod_usado: true })
        return { status: 429, erro: 'Tentativas demais. Peça outro código.' }
    }

    const digitado = hashToken(String(digitadoBruto ?? '').replace(/\D/g, ''))

    if (!crypto.timingSafeEqual(Buffer.from(digitado), Buffer.from(pedido.cod_hash))) {
        await db('codigo_login').where('cod_id', pedido.cod_id).increment('cod_tentativas', 1)
        return { status: 401, erro: 'Código incorreto.' }
    }

    await db('codigo_login').where('cod_id', pedido.cod_id).update({ cod_usado: true })
    return null
}

async function pedirCodigo(usuario, lembrar) {
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')

    /* Um código por vez: os antigos deixam de valer */
    await db('codigo_login').where({ usu_id: usuario.usu_id, cod_usado: false }).update({ cod_usado: true })
    await db('codigo_login').insert({
        usu_id: usuario.usu_id,
        cod_hash: hashToken(codigo),
        cod_expira: new Date(Date.now() + VALIDADE_CODIGO_MINUTOS * 60_000)
    })

    await enviarEmail({
        para: usuario.usu_email,
        assunto: `${codigo} é o seu código de acesso - ContrateJá`,
        texto:
            (ehSupremo(usuario) ? `Seu código para entrar como administrador supremo é ${codigo}.\n\n` : `Seu código para entrar no ContrateJá é ${codigo}.\n\n`) +
            `Ele vale por ${VALIDADE_CODIGO_MINUTOS} minutos. Se não foi você, troque sua senha agora.`
    })

    return {
        codigoNecessario: true,
        email: mascararEmail(usuario.usu_email),
        /* Prova de que a senha já foi aceita; sozinho não abre sessão (não tem id) */
        desafio: jwt.sign({ pendente: usuario.usu_id, lembrar, proposito: 'codigo' }, process.env.JWT_SECRET, {
            expiresIn: `${VALIDADE_CODIGO_MINUTOS}m`
        })
    }
}

export const confirmarCodigo = async (req, res) => {
    try {
        let desafio

        try {
            desafio = jwt.verify(String(req.body.desafio ?? ''), process.env.JWT_SECRET, { algorithms: ['HS256'] })
        } catch {
            desafio = null
        }

        if (!desafio || desafio.proposito !== 'codigo') {
            return res.status(401).json({ erro: 'O código expirou. Entre de novo com e-mail e senha.' })
        }

        const pedido = await db('codigo_login')
            .where({ usu_id: desafio.pendente, cod_usado: false })
            .where('cod_expira', '>', new Date())
            .orderBy('cod_id', 'desc')
            .first()

        if (!pedido) {
            return res.status(401).json({ erro: 'O código expirou. Entre de novo com e-mail e senha.' })
        }

        if (pedido.cod_tentativas >= TENTATIVAS_CODIGO) {
            await db('codigo_login').where('cod_id', pedido.cod_id).update({ cod_usado: true })
            return res.status(429).json({ erro: 'Tentativas demais. Entre de novo para receber outro código.' })
        }

        const digitado = hashToken(String(req.body.codigo ?? '').replace(/\D/g, ''))

        if (!crypto.timingSafeEqual(Buffer.from(digitado), Buffer.from(pedido.cod_hash))) {
            await db('codigo_login').where('cod_id', pedido.cod_id).increment('cod_tentativas', 1)
            return res.status(401).json({ erro: 'Código incorreto.' })
        }

        await db('codigo_login').where('cod_id', pedido.cod_id).update({ cod_usado: true })

        const usuario = await db('usuario').where('usu_id', desafio.pendente).first()

        if (!usuario || CONTAS_BLOQUEADAS.includes(usuario.status_conta)) {
            return res.status(403).json({ erro: 'Esta conta não pode entrar agora.' })
        }

        return res.json(await respostaLogin(usuario, Boolean(desafio.lembrar), req))

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao conferir o código.' })
    }
}

export const loginGoogle = async (req, res) => {
    try {
        const google = await verificarTokenGoogle(req.body.accessToken)

        const encontrado = await db('usuario')
            .where('usu_email', google.email)
            .first()

        if (encontrado) {
            /* Entrar pelo Google prova que o e-mail é da pessoa */
            if (encontrado.usu_email_confirmado === 0 || encontrado.usu_email_confirmado === false) {
                await db('usuario').where('usu_id', encontrado.usu_id).update({ usu_email_confirmado: true })
            }
            const usuario = await garantirSupremo(encontrado)
            const lembrar = Boolean(req.body.lembrar)

            if (CONTAS_BLOQUEADAS.includes(usuario.status_conta)) {
                return res.status(403).json({
                    erro: `Sua conta está ${usuario.status_conta}. Fale com o suporte.`
                })
            }

            if (await precisaDeCodigo(usuario)) {
                return res.json(await pedirCodigo(usuario, lembrar))
            }

            return res.json(await respostaLogin(usuario, lembrar, req))
        }

        return res.json({
            cadastroNecessario: true,
            google: {
                email: google.email,
                nome: google.nome,
                sobrenome: google.sobrenome
            }
        })

    } catch (erro) {
        if (erro instanceof ErroGoogle) {
            return res.status(401).json({ erro: erro.message })
        }

        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao entrar com o Google DX'
        })
    }
}

const VALIDADE_LINK_MINUTOS = 60

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

/* Esqueci a senha */
export const esqueciSenha = async (req, res) => {
    const resposta = {
        mensagem: 'Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha.'
    }

    try {
        const email = String(req.body.email || '').trim()

        if (!email) {
            return res.status(400).json({ erro: 'Informe o e-mail.' })
        }

        const usuario = await db('usuario')
            .select('usu_id', 'usu_nome', 'usu_email')
            .where('usu_email', email)
            .first()

        if (!usuario) {
            return res.json(resposta)
        }

        const token = crypto.randomBytes(32).toString('hex')
        const expira = new Date(Date.now() + VALIDADE_LINK_MINUTOS * 60 * 1000)

        await db('redefinicao_senha').insert({
            usu_id: usuario.usu_id,
            red_token_hash: hashToken(token),
            red_expira: expira
        })

        const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
        const link = `${frontend}/redefinir-senha?token=${token}`
        const primeiroNome = usuario.usu_nome.split(' ')[0]

        await enviarEmail({
            para: usuario.usu_email,
            assunto: 'Redefinição de senha - ContrateJá',
            texto:
                `Olá, ${primeiroNome}!\n\n` +
                `Recebemos um pedido para redefinir a sua senha. Acesse o link abaixo ` +
                `(válido por ${VALIDADE_LINK_MINUTOS} minutos):\n\n${link}\n\n` +
                `Se não foi você, ignore este e-mail; sua senha continua a mesma.`,
            html:
                `<p>Olá, ${primeiroNome}!</p>` +
                `<p>Recebemos um pedido para redefinir a sua senha. ` +
                `O link vale por ${VALIDADE_LINK_MINUTOS} minutos.</p>` +
                `<p><a href="${link}">Redefinir minha senha</a></p>` +
                `<p>Se não foi você, ignore este e-mail; sua senha continua a mesma.</p>`
        })

        return res.json(resposta)

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Não foi possível enviar o e-mail de redefinição. Tente novamente.'
        })
    }
}

export const redefinirSenha = async (req, res) => {
    try {
        const { token, senha } = req.body

        if (!token || !senha) {
            return res.status(400).json({ erro: 'Token e nova senha são obrigatórios.' })
        }

        const problemaSenha = erroSenha(senha)
        if (problemaSenha) {
            return res.status(400).json({ erro: problemaSenha })
        }

        const pedido = await db('redefinicao_senha')
            .where('red_token_hash', hashToken(String(token)))
            .where('red_usado', false)
            .where('red_expira', '>', new Date())
            .first()

        if (!pedido) {
            return res.status(400).json({
                erro: 'Link inválido ou expirado. Peça um novo em "Esqueci minha senha".'
            })
        }

        const senhaCriptografada = await bcrypt.hash(senha, 10)

        /* Troca senha */
        await db.transaction(async (trx) => {
            await trx('usuario')
                .where('usu_id', pedido.usu_id)
                .update({
                    usu_senha: senhaCriptografada,
                    data_atualizacao: trx.fn.now()
                })

            await trx('redefinicao_senha')
                .where('usu_id', pedido.usu_id)
                .update({ red_usado: true })
        })

        return res.json({ mensagem: 'Senha redefinida com sucesso! Entre com a nova senha.' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao redefinir a senha >.<'
        })
    }
}

/* ---------- Verificação em 2 etapas (Configurações) ---------- */

export const situacaoSeguranca = async (req, res) => {
    try {
        const comColuna = await temColuna('usuario', 'usu_2fa')
        const u = await db('usuario').where('usu_id', req.usuario.id).select(...['usu_email', ...(comColuna ? ['usu_2fa'] : [])]).first()
        return res.json({
            dois_fatores: Boolean(u?.usu_2fa),
            dois_fatores_possivel: await doisFatoresPossivel(),
            email: u ? mascararEmail(u.usu_email) : null,
            sessoes_disponivel: await temTabela('sessao')
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar a segurança da conta.' })
    }
}

/* Manda o código para ligar ou desligar a verificação */
export const pedirCodigo2fa = async (req, res) => {
    try {
        if (!(await doisFatoresPossivel())) {
            return res.status(503).json({ erro: 'O servidor ainda não está mandando e-mails, então a verificação em 2 etapas não pode ser ligada agora.' })
        }
        const usuario = await db('usuario').where('usu_id', req.usuario.id).first()
        await gerarCodigo(usuario, 'ativar2fa')
        return res.json({ mensagem: `Mandamos um código para ${mascararEmail(usuario.usu_email)}.` })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao mandar o código.' })
    }
}

export const salvar2fa = async (req, res) => {
    try {
        if (!(await doisFatoresPossivel())) return res.status(503).json({ erro: 'A verificação em 2 etapas não está disponível agora.' })
        const ativo = Boolean(req.body.ativo)
        const problema = await conferirCodigo(req.usuario.id, req.body.codigo)
        if (problema) return res.status(problema.status).json({ erro: problema.erro })

        await db('usuario').where('usu_id', req.usuario.id).update({ usu_2fa: ativo })
        return res.json({
            mensagem: ativo ? 'Verificação em 2 etapas ligada. No próximo login vamos pedir um código do e-mail.' : 'Verificação em 2 etapas desligada.',
            dois_fatores: ativo
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao salvar a verificação em 2 etapas.' })
    }
}

/* ---------- Sessões ativas ---------- */

export const listarSessoes = async (req, res) => {
    try {
        if (!(await temTabela('sessao'))) return res.json({ disponivel: false, sessoes: [] })
        const sessoes = await db('sessao')
            .where({ usu_id: req.usuario.id, ses_revogada: false })
            .where('ses_ultimo_uso', '>', new Date(Date.now() - 30 * 86_400_000))
            .select('ses_id', 'ses_agente', 'ses_ip', 'ses_criada', 'ses_ultimo_uso')
            .orderBy('ses_ultimo_uso', 'desc')
        return res.json({
            disponivel: true,
            sessoes: sessoes.map((s) => ({ ...s, ses_ip: s.ses_ip ? s.ses_ip.replace(/(\d+)\.(\d+)$/, '*.*') : null, atual: s.ses_id === req.usuario.sid }))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao listar as sessões.' })
    }
}

export const encerrarSessao = async (req, res) => {
    try {
        if (!(await temTabela('sessao'))) return res.status(404).json({ erro: 'Sessão não encontrada.' })
        if (req.params.id === req.usuario.sid) return res.status(400).json({ erro: 'Para sair deste aparelho, use o botão Sair.' })
        const alteradas = await db('sessao').where({ ses_id: req.params.id, usu_id: req.usuario.id }).update({ ses_revogada: true })
        if (!alteradas) return res.status(404).json({ erro: 'Sessão não encontrada.' })
        return res.json({ mensagem: 'Pronto: aquele aparelho foi desconectado.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao encerrar a sessão.' })
    }
}

/* Sai de todos os outros aparelhos (também derruba os logins antigos, de antes das sessões existirem) */
export const encerrarOutras = async (req, res) => {
    try {
        let total = 0
        if (await temTabela('sessao')) {
            total = await db('sessao').where({ usu_id: req.usuario.id, ses_revogada: false }).whereNot('ses_id', req.usuario.sid ?? '').update({ ses_revogada: true })
        }
        if (await temColuna('usuario', 'usu_sessoes_desde')) {
            await db('usuario').where('usu_id', req.usuario.id).update({ usu_sessoes_desde: db.fn.now() })
        }
        return res.json({ mensagem: total === 1 ? '1 outro aparelho foi desconectado.' : `Todos os outros aparelhos foram desconectados (${total}).` })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao desconectar os aparelhos.' })
    }
}

/* Sair: encerra esta sessão no servidor também */
export const sair = async (req, res) => {
    try {
        if (req.usuario.sid && (await temTabela('sessao'))) {
            await db('sessao').where({ ses_id: req.usuario.sid, usu_id: req.usuario.id }).update({ ses_revogada: true })
        }
        return res.json({ mensagem: 'Até logo!' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao sair.' })
    }
}
