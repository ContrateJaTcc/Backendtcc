import { filtroLiberados } from '../services/moderacao.js'
import { bloqueados } from '../services/bloqueio.js'
import db from '../config/knex.js'
import { temColuna } from '../services/registro.js'
import { enviarPush } from '../services/push.js'
import { minhaGuilda } from './guildaController.js'

const buscarFreelancer = (usu_id) =>
    db('freelancer').select('free_id').where('usu_id', usu_id).first()

const buscarContratante = (usu_id) =>
    db('contratante').select('cont_id').where('usu_id', usu_id).first()

const COLUNAS_SERVICO = [
    'servico.serv_id',
    'servico.tipo_id',
    'tipo_servico.tipo_nome as categoria',
    'servico.serv_titulo',
    'servico.serv_desc',
    'servico.serv_valor',
    'servico.serv_tipo_valor',
    'servico.serv_qtd_dias',
    'servico.serv_local',
    'servico.serv_cidade',
    'servico.serv_estado',
    'servico.serv_habilidades',
    'servico.serv_vagas',
    'servico.serv_status',
    'servico.serv_data_criacao'
]

/* Contraproposta: campos opcionais da candidatura (só depois da migração) */
const LIMITE_RECADO = 500

async function colunasProposta() {
    return (await temColuna('candidatura', 'cand_valor_proposto'))
        ? ['candidatura.cand_valor_proposto', 'candidatura.cand_prazo_proposto', 'candidatura.cand_mensagem']
        : []
}

/* Lê e valida a contraproposta do corpo; devolve { erro } ou os campos para gravar */
async function lerProposta(body) {
    const valor = body.valor_proposto === '' || body.valor_proposto == null ? null : Number(body.valor_proposto)
    const prazo = body.prazo_proposto === '' || body.prazo_proposto == null ? null : Number(body.prazo_proposto)
    const mensagem = String(body.mensagem ?? '').trim()

    if (valor !== null && (!Number.isFinite(valor) || valor <= 0 || valor > 1_000_000)) {
        return { erro: 'Valor proposto inválido.' }
    }
    if (prazo !== null && (!Number.isInteger(prazo) || prazo < 1 || prazo > 365)) {
        return { erro: 'O prazo proposto vai de 1 a 365 dias.' }
    }
    if (mensagem.length > LIMITE_RECADO) {
        return { erro: `O recado pode ter até ${LIMITE_RECADO} letras.` }
    }
    if (!(await temColuna('candidatura', 'cand_valor_proposto'))) return { campos: {} }

    return { campos: { cand_valor_proposto: valor, cand_prazo_proposto: prazo, cand_mensagem: mensagem || null } }
}

// Abertos
export const listarServicosAbertos = async (req, res) => {
    try {
        const { busca, tipo_id } = req.query
        const freelancer = await buscarFreelancer(req.usuario.id)

        const comPrazo = await temColuna('servico', 'serv_candidaturas_ate')

        const projetos = await db('servico')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .where('servico.serv_status', 'aberto')
            /* Projetos esperando a revisão do filtro de spam não aparecem */
            .modify(await filtroLiberados())
            /* Inscrições encerradas saem da lista */
            .modify((q) => {
                if (comPrazo) q.where((s) => s.whereNull('servico.serv_candidaturas_ate').orWhere('servico.serv_candidaturas_ate', '>=', db.raw('CURDATE()')))
            })
            .modify((q) => {
                if (busca) {
                    q.where((sub) => {
                        sub.where('servico.serv_titulo', 'like', `%${busca}%`)
                            .orWhere('servico.serv_desc', 'like', `%${busca}%`)
                    })
                }

                if (tipo_id) q.where('servico.tipo_id', tipo_id)
            })
            .select(
                ...COLUNAS_SERVICO,
                'usuario.usu_nome as contratante_nome',
                'usuario.usu_id as contratante_usu_id',
                ...(comPrazo ? ['servico.serv_candidaturas_ate'] : []),
                /* Reputação do contratante, para os cards de recomendação */
                db.raw('(SELECT ROUND(AVG(a.aval_nota), 1) FROM avaliacao AS a WHERE a.usu_avaliado = usuario.usu_id) AS contratante_nota')
            )
            .orderBy('servico.serv_id', 'desc')

        let idsCandidatados = []

        if (freelancer && projetos.length > 0) {
            const candidaturas = await db('candidatura')
                .select('serv_id')
                .where('free_id', freelancer.free_id)
                .whereNot('cand_status', 'cancelada')
                .whereIn('serv_id', projetos.map((p) => p.serv_id))

            idsCandidatados = candidaturas.map((c) => c.serv_id)
        }

        return res.json({
            projetos: projetos.map((p) => ({
                ...p,
                ja_candidatado: idsCandidatados.includes(p.serv_id)
            }))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({
            erro: 'Erro ao listar projetos disponíveis.'
        })
    }
}

// Candidatar
export const candidatarSe = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'freelancer') {
            return res.status(403).json({
                erro: 'Apenas freelancers podem se candidatar.'
            })
        }

        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            })
        }

        const servico = await db('servico')
            .select('serv_id', 'serv_status', ...((await temColuna('servico', 'serv_candidaturas_ate')) ? ['serv_candidaturas_ate'] : []), ...((await temColuna('servico', 'serv_moderacao')) ? ['serv_moderacao'] : []))
            .where('serv_id', req.params.id)
            .first()

        if (!servico) {
            return res.status(404).json({
                erro: 'Projeto não encontrado.'
            })
        }

        /* Bloqueio entre o freelancer e o dono do projeto */
        const dono = await db('servico').join('contratante', 'servico.cont_id', 'contratante.cont_id').where('servico.serv_id', servico.serv_id).select('contratante.usu_id').first()
        if (await bloqueados(req.usuario.id, dono?.usu_id)) {
            return res.status(403).json({ erro: 'Você não pode se candidatar a este projeto.' })
        }

        if (servico.serv_status !== 'aberto' || ['pendente', 'recusado'].includes(servico.serv_moderacao)) {
            return res.status(400).json({
                erro: 'Este projeto não está aberto para candidaturas.'
            })
        }

        const limite = servico.serv_candidaturas_ate ? new Date(servico.serv_candidaturas_ate).toISOString().slice(0, 10) : null
        if (limite && limite < new Date().toISOString().slice(0, 10)) {
            return res.status(400).json({ erro: 'As candidaturas para este projeto já encerraram.' })
        }

        const proposta = await lerProposta(req.body ?? {})

        if (proposta.erro) {
            return res.status(400).json({ erro: proposta.erro })
        }

        /* Candidatura com a guilda: o contratante vê que é um time (só quem está numa guilda) */
        if (req.body?.com_guilda) {
            const guilda = await minhaGuilda(req.usuario.id)
            if (!guilda) return res.status(400).json({ erro: 'Você não está em nenhuma guilda.' })
            if (await temColuna('candidatura', 'cand_gui_id')) proposta.campos.cand_gui_id = guilda.gui_id
        } else if (await temColuna('candidatura', 'cand_gui_id')) {
            proposta.campos.cand_gui_id = null
        }

        const jaExiste = await db('candidatura')
            .select('cand_id', 'cand_status')
            .where({
                free_id: freelancer.free_id,
                serv_id: servico.serv_id
            })
            .first()

        if (jaExiste && jaExiste.cand_status !== 'cancelada') {
            return res.status(409).json({
                erro: 'Você já se candidatou a este projeto.'
            })
        }

        // Reativar
        if (jaExiste && jaExiste.cand_status === 'cancelada') {
            await db('candidatura')
                .where('cand_id', jaExiste.cand_id)
                .update({
                    cand_status: 'pendente',
                    cand_data: db.fn.now(),
                    ...proposta.campos
                })

            return res.json({
                mensagem: 'Candidatura enviada novamente!',
                cand_id: jaExiste.cand_id
            })
        }

        const [cand_id] = await db('candidatura').insert({
            free_id: freelancer.free_id,
            serv_id: servico.serv_id,
            ...proposta.campos
        })

        return res.status(201).json({
            mensagem: 'Candidatura enviada!',
            cand_id
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({
            erro: 'Erro ao enviar candidatura.'
        })
    }
}

// Cancelar
export const cancelarCandidatura = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'freelancer') {
            return res.status(403).json({
                erro: 'Apenas freelancers podem cancelar candidaturas.'
            })
        }

        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            })
        }

        const candidatura = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .select(
                'candidatura.cand_id',
                'candidatura.cand_status'
            )
            .where('candidatura.serv_id', req.params.id)
            .where('candidatura.free_id', freelancer.free_id)
            .first()

        if (!candidatura) {
            return res.status(404).json({
                erro: 'Sua candidatura para este projeto não foi encontrada.'
            })
        }

        if (candidatura.cand_status !== 'pendente') {
            return res.status(400).json({
                erro: 'Só é possível cancelar uma candidatura pendente.'
            })
        }

        await db('candidatura')
            .where('cand_id', candidatura.cand_id)
            .update({ cand_status: 'cancelada' })

        return res.json({
            mensagem: 'Candidatura cancelada com sucesso.'
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({
            erro: 'Erro ao cancelar candidatura.'
        })
    }
}

// Minhas
export const listarMinhasCandidaturas = async (req, res) => {
    try {
        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            })
        }

        const candidaturas = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .where('candidatura.free_id', freelancer.free_id)
            .select(
                'candidatura.cand_id',
                'candidatura.cand_status',
                'candidatura.cand_data',
                ...(await colunasProposta()),
                ...COLUNAS_SERVICO
            )
            .orderBy('candidatura.cand_id', 'desc')

        return res.json({ candidaturas })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({
            erro: 'Erro ao listar suas candidaturas.'
        })
    }
}

// Recebidas
export const listarCandidaturasRecebidas = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem ver candidatos.'
            })
        }

        const contratante = await buscarContratante(req.usuario.id)

        if (!contratante) {
            return res.status(404).json({
                erro: 'Contratante não encontrado.'
            })
        }

        const comGuilda = await temColuna('candidatura', 'cand_gui_id')
        const linhas = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
            .modify((q) => {
                if (comGuilda) q.leftJoin('guilda', 'candidatura.cand_gui_id', 'guilda.gui_id')
            })
            .where('servico.cont_id', contratante.cont_id)
            .select(
                'candidatura.cand_id',
                'candidatura.cand_status',
                'candidatura.cand_data',
                ...(await colunasProposta()),
                'servico.serv_id',
                'servico.serv_titulo',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_qtd_dias',
                'freelancer.free_id',
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_desc',
                'usuario.usu_foto',
                'usuario.usu_cid',
                'usuario.usu_est',
                ...(comGuilda ? ['guilda.gui_id', 'guilda.gui_nome', 'guilda.gui_brasao', 'guilda.gui_cor'] : [])
            )
            .orderBy('candidatura.cand_id', 'desc')

        /* Candidatura em nome da guilda: quantos membros o time tem */
        const ids = [...new Set(linhas.map((l) => l.gui_id).filter(Boolean))]
        const tamanhos = ids.length
            ? new Map((await db('guilda_membro').whereIn('gui_id', ids).groupBy('gui_id').select('gui_id', db.raw('COUNT(*) as n'))).map((g) => [g.gui_id, Number(g.n)]))
            : new Map()
        const candidatos = linhas.map(({ gui_id, gui_nome, gui_brasao, gui_cor, ...c }) => ({
            ...c,
            guilda: gui_id ? { gui_id, nome: gui_nome, brasao: gui_brasao, cor: gui_cor, membros: tamanhos.get(gui_id) ?? 1 } : null
        }))

        return res.json({ candidatos })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({
            erro: 'Erro ao listar candidatos.'
        })
    }
}

// Responder
export const responderCandidatura = async (req, res) => {
    try {
        const { acao } = req.body

        if (acao !== 'aceitar' && acao !== 'recusar') {
            return res.status(400).json({
                erro: 'Ação inválida. Use "aceitar" ou "recusar".'
            })
        }

        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem responder candidaturas.'
            })
        }

        const contratante = await buscarContratante(req.usuario.id)

        if (!contratante) {
            return res.status(404).json({
                erro: 'Contratante não encontrado.'
            })
        }

        const candidatura = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .where('candidatura.cand_id', req.params.id)
            .select(
                'candidatura.cand_id',
                'candidatura.cand_status',
                'candidatura.free_id',
                ...(await colunasProposta()),
                'servico.serv_id',
                'servico.cont_id',
                'servico.serv_titulo',
                'servico.serv_status'
            )
            .first()

        if (!candidatura) {
            return res.status(404).json({
                erro: 'Candidatura não encontrada.'
            })
        }

        if (candidatura.cont_id !== contratante.cont_id) {
            return res.status(403).json({
                erro: 'Esta candidatura não é de um projeto seu.'
            })
        }

        if (candidatura.cand_status !== 'pendente') {
            return res.status(400).json({
                erro: 'Esta candidatura já foi respondida.'
            })
        }

        if (acao === 'recusar') {
            await db('candidatura')
                .where('cand_id', candidatura.cand_id)
                .update({ cand_status: 'recusada' })

            await notificarFreelancer(
                candidatura.free_id,
                'Candidatura não aceita',
                `Sua candidatura para "${candidatura.serv_titulo}" não foi aceita desta vez.`
            )

            return res.json({ mensagem: 'Candidatura recusada.' })
        }

        if (candidatura.serv_status !== 'aberto') {
            return res.status(400).json({
                erro: 'Este projeto já não está aberto.'
            })
        }

        await db.transaction(async (trx) => {
            await trx('candidatura')
                .where('cand_id', candidatura.cand_id)
                .update({ cand_status: 'aceita' })

            await trx('candidatura')
                .where('serv_id', candidatura.serv_id)
                .whereNot('cand_id', candidatura.cand_id)
                .where('cand_status', 'pendente')
                .update({ cand_status: 'recusada' })

            /* Aceitar a candidatura aceita também a contraproposta: o projeto passa a valer o combinado */
            const combinado = {}
            if (candidatura.cand_valor_proposto != null) combinado.serv_valor = candidatura.cand_valor_proposto
            if (candidatura.cand_prazo_proposto != null) combinado.serv_qtd_dias = candidatura.cand_prazo_proposto
            if (await temColuna('servico', 'serv_contratado_em')) combinado.serv_contratado_em = db.fn.now()

            await trx('servico')
                .where('serv_id', candidatura.serv_id)
                .update({ serv_status: 'em_andamento', ...combinado })
        })

        await notificarFreelancer(
            candidatura.free_id,
            'Você foi escolhido!',
            `Sua candidatura para "${candidatura.serv_titulo}" foi aceita.`
        )

        return res.json({ mensagem: 'Candidatura aceita!' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({
            erro: 'Erro ao responder candidatura.'
        })
    }
}

async function notificarFreelancer(free_id, titulo, descricao) {
    try {
        const freelancer = await db('freelancer')
            .select('usu_id')
            .where('free_id', free_id)
            .first()

        if (!freelancer) return

        await db('notificacao').insert({
            usu_id: freelancer.usu_id,
            not_titulo: titulo,
            not_desc: descricao
        })
        await enviarPush(freelancer.usu_id, { titulo, texto: descricao })
    } catch (erro) {
        console.error('Falha ao criar notificação:', erro)
    }
}