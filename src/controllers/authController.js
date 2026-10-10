import db from '../config/knex.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { verificarTokenGoogle, ErroGoogle } from '../services/google.js'
import { enviarEmail } from '../services/email.js'

export const test = async (req, res) => {
    res.json({
        message: 'controller funcionando >.<'
    })
}

const REGEX_CPF = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/
const REGEX_TELEFONE = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/
const REGEX_ESTADO = /^[A-Za-z]{2}$/
const SENHA_MINIMA = 6

const gerarToken = (usuario) => jwt.sign(
    {
        id: usuario.usu_id,
        email: usuario.usu_email,
        tipo: usuario.tipo_usuario
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
)

const respostaLogin = (usuario) => ({
    mensagem: 'Login bem-sucedido! ^w^',
    token: gerarToken(usuario),
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
            googleToken
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

        if (tipo !== 'freelancer' && tipo !== 'contratante') {
            return res.status(400).json({
                erro: 'Tipo de usuário inválido.'
            })
        }

        if (String(senha).length < SENHA_MINIMA) {
            return res.status(400).json({
                erro: `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`
            })
        }

        const cpfTexto = String(cpf).trim()
        const telTexto = String(telefone).trim()
        const estadoTexto = String(estado).trim()

        if (!REGEX_CPF.test(cpfTexto)) {
            return res.status(400).json({
                erro: 'CPF inválido. Use o formato 000.000.000-00 ou 11 dígitos.'
            })
        }

        if (!REGEX_TELEFONE.test(telTexto)) {
            return res.status(400).json({
                erro: 'Telefone inválido. Use o formato (00) 00000-0000 ou (00) 0000-0000.'
            })
        }

        if (!REGEX_ESTADO.test(estadoTexto)) {
            return res.status(400).json({
                erro: 'Estado inválido. Use a sigla de 2 letras (ex.: SP).'
            })
        }

        const cpfLimpo = cpfTexto.replace(/\D/g, '')
        const telLimpo = telTexto.replace(/\D/g, '')
        const estadoLimpo = estadoTexto.toUpperCase()

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

        await db.transaction(async (trx) => {

            const [usu_id] = await trx('usuario').insert({
                usu_nome: nome,
                usu_email: email,
                usu_senha: senhaCriptografada,
                usu_cpf: cpfLimpo,
                usu_tel: telLimpo,
                usu_data_nasc: data_nasc,
                usu_cid: cidade,
                usu_est: estadoLimpo,
                tipo_usuario: tipo
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

        /* Pelo Google a pessoa nao tem senha para digitar no login,
           entao ja devolvemos a sessao. */
        if (googleToken) {
            const usuario = await db('usuario').where('usu_email', email).first()

            return res.status(201).json(respostaLogin(usuario))
        }

        return res.status(201).json({
            mensagem: 'Usuário cadastrado com sucesso! ^w^'
        })

    } catch (erro) {
        if (erro instanceof ErroGoogle) {
            return res.status(401).json({ erro: erro.message })
        }

        console.error(erro)

        /* Dois cadastros simultaneos podem passar pelas consultas acima;
           a chave unica do banco e a ultima barreira. */
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
        const { email, senha } = req.body

        if (!email || !senha) {
            return res.status(400).json({
                erro: 'E-mail e senha são obrigatórios >:('
            })
        }

        const usuarios = await db('usuario')
            .select('*')
            .where('usu_email', email)

        if (usuarios.length === 0) {
            return res.status(404).json({
                erro: 'Usuário não encontrado O~o'
            })
        }

        const usuario = usuarios[0]

        const senhaCorreta = await bcrypt.compare(
            senha,
            usuario.usu_senha
        )

        if (!senhaCorreta) {
            return res.status(401).json({
                erro: 'Senha incorreta :P'
            })
        }

        return res.json(respostaLogin(usuario))

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao realizar login DX'
        })
    }
}

export const loginGoogle = async (req, res) => {
    try {
        const google = await verificarTokenGoogle(req.body.accessToken)

        const usuario = await db('usuario')
            .where('usu_email', google.email)
            .first()

        if (usuario) {
            return res.json(respostaLogin(usuario))
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

/*
 * Responde sempre a mesma mensagem, exista o e-mail ou nao: uma resposta
 * diferente deixaria qualquer um descobrir quem tem conta na plataforma.
 */
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

        if (String(senha).length < SENHA_MINIMA) {
            return res.status(400).json({
                erro: `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`
            })
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

        /* Troca a senha e invalida todos os links pendentes do usuario,
           nao so o usado: um link antigo nao pode continuar valendo. */
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