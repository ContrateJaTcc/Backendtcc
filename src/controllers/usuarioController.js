import * as usuarioModel from '../models/usuarioModel.js'
import bcrypt from 'bcrypt'

/*
 * O token carrega { id, email, tipo }. O :id da URL vem como string,
 * por isso a comparacao com Number().
 */
const ehDono = (req) => Number(req.params.id) === Number(req.usuario?.id)

/* Campos que o usuario pode alterar em si mesmo. Uma lista explicita evita
 * que um PUT com tipo_usuario ou status_conta no corpo mude o papel da conta
 * ou reative uma conta suspensa. */
const CAMPOS_EDITAVEIS = [
    'usu_nome',
    'usu_tel',
    'usu_cid',
    'usu_est',
    'usu_desc',
    'usu_foto',
    'usu_senha'
]

/*
 * A foto chega como data URI (base64) gerado pelo navegador, que ja reduz a
 * imagem para 256x256 em JPEG — algo em torno de 20 KB. O limite abaixo da
 * folga para isso e ainda assim impede que alguem grave um arquivo inteiro no
 * banco mandando a requisicao direto, sem passar pela tela.
 *
 * Um endereco http(s) continua aceito, para uma foto hospedada fora.
 */
const LIMITE_FOTO = 150000

function validarFoto(valor) {
    const texto = String(valor)

    if (texto.length > LIMITE_FOTO) {
        return 'A imagem é grande demais. Escolha uma foto menor.'
    }

    const ehDataUri = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(texto)
    const ehEndereco = /^https?:\/\//i.test(texto)

    if (!ehDataUri && !ehEndereco) {
        return 'Formato de imagem não reconhecido.'
    }

    return null
}

export const listarUsuarios = async (req, res) => {
    try {
        const usuarios = await usuarioModel.listarUsuarios()

        return res.status(200).json(usuarios)
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao listar usuários'
        })
    }
}

export const buscarMeuPerfil = async (req, res) => {
    try {
        const usuario = await usuarioModel.buscarPerfilCompleto(req.usuario.id)

        if (!usuario) {
            return res.status(404).json({
                erro: 'Usuário não encontrado'
            })
        }

        return res.status(200).json(usuario)
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao buscar perfil'
        })
    }
}

export const buscarUsuario = async (req, res) => {
    try {
        const { id } = req.params

        // O dono ve o proprio cadastro completo; os demais, so o perfil publico.
        const usuario = ehDono(req)
            ? await usuarioModel.buscarPerfilCompleto(id)
            : await usuarioModel.buscarUsuarioPorId(id)

        if (!usuario) {
            return res.status(404).json({
                erro: 'Usuário não encontrado'
            })
        }

        return res.status(200).json(usuario)
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao buscar usuário'
        })
    }
}

export const atualizarUsuario = async (req, res) => {
    try {
        if (!ehDono(req)) {
            return res.status(403).json({
                erro: 'Você só pode alterar a própria conta'
            })
        }

        const dados = {}

        for (const campo of CAMPOS_EDITAVEIS) {
            if (req.body[campo] !== undefined) dados[campo] = req.body[campo]
        }

        // Enviar usu_foto: null remove a foto, por isso so validamos se veio algo.
        if (dados.usu_foto) {
            const problema = validarFoto(dados.usu_foto)

            if (problema) {
                return res.status(400).json({ erro: problema })
            }
        }

        if (dados.usu_senha) {
            dados.usu_senha = await bcrypt.hash(dados.usu_senha, 10)
        }

        if (Object.keys(dados).length === 0) {
            return res.status(400).json({
                erro: 'Nenhum campo válido para atualizar'
            })
        }

        const resultado = await usuarioModel.atualizarUsuario(req.params.id, dados)

        if (resultado === 0) {
            return res.status(404).json({
                erro: 'Usuário não encontrado'
            })
        }

        return res.status(200).json({
            mensagem: 'Usuário atualizado com sucesso!'
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao atualizar usuário'
        })
    }
}

export const deletarUsuario = async (req, res) => {
    try {
        if (!ehDono(req)) {
            return res.status(403).json({
                erro: 'Você só pode excluir a própria conta'
            })
        }

        const resultado = await usuarioModel.deletarUsuario(req.params.id)

        if (resultado === 0) {
            return res.status(404).json({
                erro: 'Usuário não encontrado'
            })
        }

        return res.status(200).json({
            mensagem: 'Usuário deletado com sucesso!'
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao deletar usuário'
        })
    }
}

/*
 * GET /usuarios/eu/areas — areas de atuacao do freelancer logado.
 */
export const listarMinhasAreas = async (req, res) => {
    try {
        const freelancer = await usuarioModel.buscarFreelancerPorUsuario(req.usuario.id)

        if (!freelancer) {
            return res.status(403).json({
                erro: 'Apenas freelancers possuem áreas de atuação.'
            })
        }

        const areas = await usuarioModel.listarAreas(freelancer.free_id)

        return res.status(200).json({ areas })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao carregar áreas de atuação'
        })
    }
}

/*
 * PUT /usuarios/eu/areas — substitui o conjunto de areas de uma vez.
 *
 * A tela manda a selecao inteira, nao o que mudou: e mais simples de acertar
 * do que calcular adicoes e remocoes dos dois lados.
 */
export const salvarMinhasAreas = async (req, res) => {
    try {
        /* O formato do corpo e conferido antes de consultar o banco: e mais
           barato e devolve 400 em vez de 500 quando a requisicao vem errada. */
        if (!Array.isArray(req.body.tipos)) {
            return res.status(400).json({
                erro: 'Envie a lista de áreas em "tipos".'
            })
        }

        const freelancer = await usuarioModel.buscarFreelancerPorUsuario(req.usuario.id)

        if (!freelancer) {
            return res.status(403).json({
                erro: 'Apenas freelancers possuem áreas de atuação.'
            })
        }

        /* Numeros validos, sem repeticao. */
        const pedidos = [...new Set(
            req.body.tipos
                .map((t) => Number(t))
                .filter((t) => Number.isInteger(t) && t > 0)
        )]

        /* So grava ids que existem em tipo_servico: um id inventado violaria a
           foreign key e derrubaria a requisicao com erro de banco. */
        const validos = pedidos.length > 0
            ? await usuarioModel.filtrarTiposExistentes(pedidos)
            : []

        await usuarioModel.substituirAreas(freelancer.free_id, validos)

        const areas = await usuarioModel.listarAreas(freelancer.free_id)

        return res.status(200).json({
            mensagem: 'Áreas de atuação atualizadas!',
            areas
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao salvar áreas de atuação'
        })
    }
}
