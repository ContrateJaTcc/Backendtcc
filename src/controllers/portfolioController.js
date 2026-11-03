import db from '../config/knex.js'
import { vistoDoUsuario } from '../services/presenca.js'
import { mediasPorCriterio } from '../services/reputacao.js'
import { lerHorarios } from './relacaoController.js'
import { verificacao, tempoResposta } from '../services/confianca.js'
import { aparenciaUm } from '../services/aparencia.js'
import { temColuna } from '../services/registro.js'
import { nomeCurto } from './publicoController.js'
import { avaliacaoVisivel } from '../services/gamificacao.js'
import { registrarVisita } from '../services/visitas.js'

/* Portfólio */
const buscarFreelancer = (usu_id) =>
    db('freelancer').select('free_id').where('usu_id', usu_id).first()

/* Limite URL */
const LIMITE_URL = 255
const LIMITE_TITULO = 150

/* Validar URL */
function validarUrl(valor, campo) {
    if (!valor) return { ok: true, valor: null }

    const limpo = String(valor).trim()

    if (limpo === '') return { ok: true, valor: null }

    if (limpo.length > LIMITE_URL) {
        return { ok: false, erro: `O ${campo} deve ter no máximo ${LIMITE_URL} caracteres.` }
    }

    if (!/^https?:\/\//i.test(limpo)) {
        return { ok: false, erro: `O ${campo} deve começar com http:// ou https://` }
    }

    return { ok: true, valor: limpo }
}

/* Validar item */
function validarItem(corpo) {
    const titulo = String(corpo.port_titulo ?? '').trim()
    const desc = String(corpo.port_desc ?? '').trim()

    if (!titulo || !desc) {
        return { ok: false, erro: 'Informe o título e a descrição do trabalho.' }
    }

    if (titulo.length > LIMITE_TITULO) {
        return { ok: false, erro: `O título deve ter no máximo ${LIMITE_TITULO} caracteres.` }
    }

    const link = validarUrl(corpo.port_link, 'link')
    if (!link.ok) return link

    const img = validarUrl(corpo.port_img, 'endereço da imagem')
    if (!img.ok) return img

    return {
        ok: true,
        dados: {
            port_titulo: titulo,
            port_desc: desc,
            port_link: link.valor,
            port_img: img.valor
        }
    }
}

const CAMPOS = [
    'port_id',
    'free_id',
    'port_titulo',
    'port_desc',
    'port_link',
    'port_img',
    'port_data_criacao',
    'port_data_atualizacao'
]

/* Meu portfólio */
export const listarMeuPortfolio = async (req, res) => {
    try {
        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(403).json({
                erro: 'Apenas freelancers possuem portfólio.'
            })
        }

        const itens = await db('portfolio')
            .select(CAMPOS)
            .where('free_id', freelancer.free_id)
            .orderBy('port_id', 'desc')

        return res.json({ itens })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao carregar portfólio.'
        })
    }
}

/* Portfólio do freelancer */
export const listarPorFreelancer = async (req, res) => {
    try {
        const perfil = await db('usuario')
            .join('freelancer', 'usuario.usu_id', 'freelancer.usu_id')
            .where('usuario.usu_id', req.params.usuId)
            .select(
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_desc',
                'usuario.usu_cid',
                'usuario.usu_est',
                'usuario.usu_foto',
                'freelancer.free_id',
                'freelancer.free_nivel',
                'freelancer.free_xp',
                'freelancer.free_rank'
            )
            .first()

        if (!perfil) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            })
        }

        const itens = await db('portfolio')
            .select([...CAMPOS, ...((await temColuna('portfolio', 'port_serv_id')) ? ['port_serv_id'] : [])])
            .where('free_id', perfil.free_id)
            .orderBy('port_id', 'desc')

        /* Áreas */
        const areas = await db('freelancer_tipo_servico')
            .join('tipo_servico', 'freelancer_tipo_servico.tipo_id', 'tipo_servico.tipo_id')
            .where('freelancer_tipo_servico.free_id', perfil.free_id)
            .select('tipo_servico.tipo_id', 'tipo_servico.tipo_nome')
            .orderBy('tipo_servico.tipo_nome')

        const [selo, resposta, aparencia, visto, criterios, horarios] = await Promise.all([
            verificacao(perfil.usu_id),
            tempoResposta(perfil.usu_id),
            aparenciaUm(perfil.usu_id),
            vistoDoUsuario(perfil.usu_id),
            mediasPorCriterio(perfil.usu_id),
            (async () => ((await temColuna('usuario', 'usu_horarios')) ? lerHorarios((await db('usuario').where('usu_id', perfil.usu_id).select('usu_horarios').first())?.usu_horarios) : null))()
        ])

        /* Contratante abrindo o portfólio conta como visita (o próprio freelancer não) */
        if (req.usuario.tipo === 'contratante') await registrarVisita(perfil.usu_id, { req, visitanteId: req.usuario.id, origem: 'contratante' })

        /* Dados públicos */
        return res.json({ perfil: { ...perfil, verificado: selo.verificado, tempo_resposta: resposta, visto_em: visto, criterios, horarios, ...aparencia }, areas, itens })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao carregar portfólio.'
        })
    }
}

/* Criar */
export const criarItem = async (req, res) => {
    try {
        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(403).json({
                erro: 'Apenas freelancers podem adicionar trabalhos ao portfólio.'
            })
        }

        const validacao = validarItem(req.body)

        if (!validacao.ok) {
            return res.status(400).json({ erro: validacao.erro })
        }

        const [port_id] = await db('portfolio').insert({
            free_id: freelancer.free_id,
            ...validacao.dados
        })

        const item = await db('portfolio').select(CAMPOS).where('port_id', port_id).first()

        return res.status(201).json({
            mensagem: 'Trabalho adicionado ao portfólio!',
            item
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao adicionar trabalho.'
        })
    }
}

/*
 * Projeto concluído vira trabalho do portfólio: já vem com o título, a descrição e a avaliação do cliente.
 * Dá para mudar o título e a descrição antes de mandar; cada projeto entra uma vez só.
 */
export const criarDeProjeto = async (req, res) => {
    try {
        if (!(await temColuna('portfolio', 'port_serv_id'))) {
            return res.status(503).json({ erro: 'Isso ainda está sendo preparado. Tente mais tarde.' })
        }

        const freelancer = await buscarFreelancer(req.usuario.id)
        if (!freelancer) return res.status(403).json({ erro: 'Apenas freelancers possuem portfólio.' })

        const projeto = await db('servico')
            .join('candidatura', 'servico.serv_id', 'candidatura.serv_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .where('servico.serv_id', req.params.servId)
            .where('candidatura.free_id', freelancer.free_id)
            .where('candidatura.cand_status', 'aceita')
            .select('servico.serv_id', 'servico.serv_titulo', 'servico.serv_desc', 'servico.serv_status', 'usuario.usu_id as cliente_id', 'usuario.usu_nome as cliente_nome')
            .first()

        if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado entre os seus trabalhos.' })
        if (projeto.serv_status !== 'finalizado') return res.status(400).json({ erro: 'Só projetos concluídos vão para o portfólio.' })
        if (await db('portfolio').where({ free_id: freelancer.free_id, port_serv_id: projeto.serv_id }).first()) {
            return res.status(400).json({ erro: 'Este projeto já está no seu portfólio.' })
        }

        const avaliacao = await db('avaliacao')
            .where({ serv_id: projeto.serv_id, usu_avaliado: req.usuario.id, usu_avaliador: projeto.cliente_id })
            .whereRaw(avaliacaoVisivel())
            .select('aval_nota', 'aval_comentario')
            .first()

        const depoimento = avaliacao
            ? `\n\n★ ${avaliacao.aval_nota}/5${avaliacao.aval_comentario ? ` — "${avaliacao.aval_comentario}"` : ''} (${nomeCurto(projeto.cliente_nome)})`
            : ''

        const validacao = validarItem({
            port_titulo: String(req.body.port_titulo ?? '').trim() || projeto.serv_titulo,
            port_desc: (String(req.body.port_desc ?? '').trim() || projeto.serv_desc) + depoimento,
            port_link: req.body.port_link,
            port_img: req.body.port_img
        })

        if (!validacao.ok) return res.status(400).json({ erro: validacao.erro })

        const [port_id] = await db('portfolio').insert({ free_id: freelancer.free_id, port_serv_id: projeto.serv_id, ...validacao.dados })
        const item = await db('portfolio').select(CAMPOS).where('port_id', port_id).first()

        return res.status(201).json({ mensagem: 'Projeto adicionado ao portfólio!', item })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao adicionar o projeto ao portfólio.' })
    }
}

/* Dono */
async function buscarItemDoDono(port_id, usu_id) {
    const freelancer = await buscarFreelancer(usu_id)

    if (!freelancer) {
        return { erro: 'Apenas freelancers possuem portfólio.', status: 403 }
    }

    const item = await db('portfolio').select(CAMPOS).where('port_id', port_id).first()

    if (!item) {
        return { erro: 'Trabalho não encontrado.', status: 404 }
    }

    if (item.free_id !== freelancer.free_id) {
        return { erro: 'Este trabalho pertence a outro freelancer.', status: 403 }
    }

    return { item }
}

/* Editar */
export const atualizarItem = async (req, res) => {
    try {
        const dono = await buscarItemDoDono(req.params.id, req.usuario.id)

        if (dono.erro) {
            return res.status(dono.status).json({ erro: dono.erro })
        }

        const validacao = validarItem(req.body)

        if (!validacao.ok) {
            return res.status(400).json({ erro: validacao.erro })
        }

        await db('portfolio')
            .where('port_id', req.params.id)
            .update({
                ...validacao.dados,
                port_data_atualizacao: db.fn.now()
            })

        const item = await db('portfolio').select(CAMPOS).where('port_id', req.params.id).first()

        return res.json({
            mensagem: 'Trabalho atualizado!',
            item
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao atualizar trabalho.'
        })
    }
}

/* Excluir */
export const deletarItem = async (req, res) => {
    try {
        const dono = await buscarItemDoDono(req.params.id, req.usuario.id)

        if (dono.erro) {
            return res.status(dono.status).json({ erro: dono.erro })
        }

        await db('portfolio').where('port_id', req.params.id).del()

        return res.json({
            mensagem: 'Trabalho removido do portfólio.'
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao remover trabalho.'
        })
    }
}
