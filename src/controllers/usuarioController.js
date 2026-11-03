import * as usuarioModel from '../models/usuarioModel.js'
import bcrypt from 'bcrypt'
import { verificacao, tempoResposta } from '../services/confianca.js'
import { aparenciaDe } from '../services/aparencia.js'
import { temColuna } from '../services/registro.js'
import db from '../config/knex.js'
import { conferirLocal, erroNome, erroSenha, erroTelefone } from '../services/validacao.js'
import { lerHorarios } from './relacaoController.js'

/* Dono */
const ehDono = (req) => Number(req.params.id) === Number(req.usuario?.id)

/* Campos editáveis */
const CAMPOS_EDITAVEIS = [
    'usu_nome',
    'usu_tel',
    'usu_cid',
    'usu_est',
    'usu_desc',
    'usu_foto',
    'usu_senha'
]

/* Limite da foto */
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

        /*
         * usu_supremo: o site mostra os poderes supremos;
         * supremo_id: esta sessão foi aberta pelo supremo "entrando como" a conta (o site mostra o aviso de volta)
         */
        /* Extras da conta (só existem depois das migrações novas) */
        const extras = (await temColuna('usuario', 'usu_resumo_email'))
            ? await db('usuario').where('usu_id', req.usuario.id).select('usu_resumo_email', 'usu_tema_cenario').first()
            : {}
        const aparencia = (await aparenciaDe([req.usuario.id]))[req.usuario.id] ?? {}
        /* Horários de atendimento (freelancer) */
        const horarios = (await temColuna('usuario', 'usu_horarios'))
            ? lerHorarios((await db('usuario').where('usu_id', req.usuario.id).select('usu_horarios').first())?.usu_horarios)
            : undefined

        return res.status(200).json({
            ...usuario,
            ...extras,
            ...aparencia,
            ...(horarios !== undefined ? { horarios } : {}),
            usu_supremo: req.usuario.supremo,
            supremo_id: req.usuario.supremo_id ?? null
        })
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

        // Perfil
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

        // Foto
        if (dados.usu_foto) {
            const problema = validarFoto(dados.usu_foto)

            if (problema) {
                return res.status(400).json({ erro: problema })
            }
        }

        /* As mesmas regras do cadastro (services/validacao.js) */
        if (dados.usu_nome !== undefined) {
            const problema = erroNome(dados.usu_nome)
            if (problema) return res.status(400).json({ erro: problema })
            dados.usu_nome = String(dados.usu_nome).trim().replace(/\s+/g, ' ')
        }

        if (dados.usu_tel !== undefined) {
            const problema = erroTelefone(dados.usu_tel)
            if (problema) return res.status(400).json({ erro: problema })
            dados.usu_tel = String(dados.usu_tel).replace(/\D/g, '')
        }

        /* Cidade e estado andam juntos: trocar um confere com o outro (o que veio ou o que já estava) */
        if (dados.usu_cid !== undefined || dados.usu_est !== undefined) {
            const atual = await db('usuario').where('usu_id', req.params.id).select('usu_cid', 'usu_est').first()
            const local = conferirLocal(dados.usu_cid ?? atual?.usu_cid, dados.usu_est ?? atual?.usu_est)
            if (local.erro) return res.status(400).json({ erro: local.erro })
            dados.usu_cid = local.cidade
            dados.usu_est = local.estado
        }

        if (dados.usu_senha !== undefined) {
            const problema = erroSenha(dados.usu_senha)
            if (problema) return res.status(400).json({ erro: problema })

            /* Quem pegar o aparelho logado não consegue trocar a senha sem saber a atual */
            const conta = await db('usuario').where('usu_id', req.params.id).select('usu_senha').first()
            const confere = conta && req.body.senha_atual && (await bcrypt.compare(String(req.body.senha_atual), conta.usu_senha))
            if (!confere) {
                return res.status(400).json({ erro: req.body.senha_atual ? 'A senha atual está errada.' : 'Informe a senha atual para trocar a senha.' })
            }

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

/* Áreas */
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

export const salvarMinhasAreas = async (req, res) => {
    try {
        /* Validação */
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

        /* Ids */
        const pedidos = [...new Set(
            req.body.tipos
                .map((t) => Number(t))
                .filter((t) => Number.isInteger(t) && t > 0)
        )]

        /* Ids válidos */
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


export const listarFreelancers = async (req, res) => {
    try {
        const todos = await usuarioModel.listarFreelancers()
        /* Quem escolheu sumir da busca (Configurações > Privacidade) não aparece para os contratantes */
        const escondidos = req.usuario.tipo !== 'administrador' && (await temColuna('usuario', 'usu_aparecer_busca'))
            ? new Set(await db('usuario').where('usu_aparecer_busca', false).pluck('usu_id'))
            : new Set()
        const lista = todos.filter((f) => !escondidos.has(f.usu_id))
        const aparencias = await aparenciaDe(lista.map((f) => f.usu_id))
        /* Selo de verificado, moldura, cor do nome e disponibilidade em cada cartão */
        const freelancers = await Promise.all(
            lista.map(async (f) => ({ ...f, ...aparencias[f.usu_id], verificado: (await verificacao(f.usu_id)).verificado }))
        )

        return res.status(200).json(freelancers)
    } catch (erro) {
        console.error('Erro ao listar freelancers:', erro)

        return res.status(500).json({
            erro: 'Erro ao carregar os freelancers.'
        })
    }
}

/*
 * Comparar até 3 freelancers lado a lado: nível, nota, prazo de resposta, testes e preço médio.
 * ?ids=2,5,7 (contratante)
 */
export const compararFreelancers = async (req, res) => {
    try {
        const ids = [...new Set(String(req.query.ids ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 3)
        if (ids.length < 2) return res.status(400).json({ erro: 'Escolha de 2 a 3 freelancers para comparar.' })

        const perfis = await db('usuario')
            .join('freelancer', 'usuario.usu_id', 'freelancer.usu_id')
            .whereIn('usuario.usu_id', ids)
            .where('usuario.status_conta', 'ativa')
            .select('usuario.usu_id', 'usuario.usu_nome', 'usuario.usu_foto', 'usuario.usu_cid', 'usuario.usu_est', 'usuario.data_criacao',
                'freelancer.free_id', 'freelancer.free_nivel', 'freelancer.free_xp', 'freelancer.free_rank')

        const aparencias = await aparenciaDe(perfis.map((p) => p.usu_id))

        const freelancers = await Promise.all(perfis.map(async (p) => {
            const [avaliacoes, concluidos, areas, resposta, selo] = await Promise.all([
                db('avaliacao').where('usu_avaliado', p.usu_id).count('* as total').first(),
                db('candidatura')
                    .join('servico', 'candidatura.serv_id', 'servico.serv_id')
                    .where({ 'candidatura.free_id': p.free_id, 'candidatura.cand_status': 'aceita', 'servico.serv_status': 'finalizado' })
                    .select(db.raw('COUNT(*) as total'), db.raw("AVG(CASE WHEN servico.serv_tipo_valor = 'fixo' THEN servico.serv_valor END) as preco"))
                    .first(),
                db('freelancer_tipo_servico').join('tipo_servico', 'freelancer_tipo_servico.tipo_id', 'tipo_servico.tipo_id').where('freelancer_tipo_servico.free_id', p.free_id).pluck('tipo_servico.tipo_nome'),
                tempoResposta(p.usu_id),
                verificacao(p.usu_id)
            ])
            const { free_id: _f, ...dados } = p
            return {
                ...dados,
                ...aparencias[p.usu_id],
                avaliacoes: Number(avaliacoes?.total) || 0,
                projetos_concluidos: Number(concluidos?.total) || 0,
                preco_medio: concluidos?.preco ? Math.round(Number(concluidos.preco)) : null,
                areas,
                tempo_resposta: resposta,
                verificado: selo.verificado
            }
        }))

        /* Na ordem em que foram escolhidos */
        freelancers.sort((a, b) => ids.indexOf(a.usu_id) - ids.indexOf(b.usu_id))
        return res.json({ freelancers })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao comparar os freelancers.' })
    }
}
