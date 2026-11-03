import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'
import { enviarPush } from '../services/push.js'
import { carteiraPronta, pagarEtapa as liberarParteDaEtapa } from '../services/carteira.js'

/*
 * Etapas do projeto: o contratante divide o trabalho em partes
 * ("rascunho", "revisão", "final") e o freelancer marca cada uma como feita.
 */

const LIMITE_ETAPAS = 10
const LIMITE_TITULO = 100

async function notificar(usu_id, titulo, descricao, url) {
    try {
        await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: descricao })
        await enviarPush(usu_id, { titulo, texto: descricao, url })
    } catch (erro) {
        console.error(erro)
    }
}

/* Quem pode ver e mexer: o dono do projeto e o freelancer contratado */
async function participantes(serv_id) {
    const servico = await db('servico')
        .join('contratante', 'servico.cont_id', 'contratante.cont_id')
        .where('servico.serv_id', serv_id)
        .select('servico.serv_id', 'servico.serv_titulo', 'servico.serv_status', 'contratante.usu_id as dono_usu_id')
        .first()

    if (!servico) return null

    const contratado = await db('candidatura')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where('candidatura.serv_id', serv_id)
        .where('candidatura.cand_status', 'aceita')
        .select('freelancer.usu_id')
        .first()

    return { ...servico, freelancer_usu_id: contratado?.usu_id ?? null }
}

/* Colunas da etapa (o pagamento por etapa só existe depois da migração) */
async function colunasEtapa() {
    const base = ['eta_id', 'eta_titulo', 'eta_ordem', 'eta_concluida_em']
    if (await temColuna('servico_etapa', 'eta_liberado_valor')) base.push('eta_liberado_valor', 'eta_liberada_em')
    return base
}

const comValor = (e) => (e.eta_liberado_valor === undefined || e.eta_liberado_valor === null ? e : { ...e, eta_liberado_valor: Number(e.eta_liberado_valor) })

async function listar(serv_id) {
    const linhas = await db('servico_etapa')
        .where('serv_id', serv_id)
        .select(await colunasEtapa())
        .orderBy([{ column: 'eta_ordem' }, { column: 'eta_id' }])
    return linhas.map(comValor)
}

/* Etapas de vários projetos de uma vez (para o histórico) */
export async function etapasDosProjetos(ids) {
    if (ids.length === 0 || !(await temTabela('servico_etapa'))) return {}

    const linhas = await db('servico_etapa')
        .whereIn('serv_id', ids)
        .select('serv_id', ...(await colunasEtapa()))
        .orderBy([{ column: 'eta_ordem' }, { column: 'eta_id' }])

    const porProjeto = {}
    for (const { serv_id, ...etapa } of linhas) {
        ;(porProjeto[serv_id] ??= []).push(comValor(etapa))
    }
    return porProjeto
}

async function preparar(req, res) {
    if (!(await temTabela('servico_etapa'))) {
        res.status(503).json({ erro: 'Etapas ainda não disponíveis.' })
        return null
    }

    const projeto = await participantes(req.params.id)
    const eu = Number(req.usuario.id)

    if (!projeto || (projeto.dono_usu_id !== eu && projeto.freelancer_usu_id !== eu)) {
        res.status(404).json({ erro: 'Projeto não encontrado.' })
        return null
    }

    return { projeto, eu, ehDono: projeto.dono_usu_id === eu }
}

export const listarEtapas = async (req, res) => {
    try {
        const ctx = await preparar(req, res)
        if (!ctx) return

        return res.json({ etapas: await listar(ctx.projeto.serv_id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as etapas.' })
    }
}

export const criarEtapa = async (req, res) => {
    try {
        const ctx = await preparar(req, res)
        if (!ctx) return

        if (!ctx.ehDono) {
            return res.status(403).json({ erro: 'Só o contratante define as etapas.' })
        }

        if (ctx.projeto.serv_status !== 'em_andamento') {
            return res.status(400).json({ erro: 'Só dá para criar etapas em projetos em andamento.' })
        }

        const titulo = String(req.body.titulo ?? '').trim()

        if (!titulo || titulo.length > LIMITE_TITULO) {
            return res.status(400).json({ erro: `Dê um nome de até ${LIMITE_TITULO} letras para a etapa.` })
        }

        const atuais = await listar(ctx.projeto.serv_id)

        if (atuais.length >= LIMITE_ETAPAS) {
            return res.status(400).json({ erro: `Um projeto pode ter até ${LIMITE_ETAPAS} etapas.` })
        }

        const ordem = atuais.reduce((maior, e) => Math.max(maior, e.eta_ordem), 0) + 1

        await db('servico_etapa').insert({ serv_id: ctx.projeto.serv_id, eta_titulo: titulo, eta_ordem: ordem })

        if (ctx.projeto.freelancer_usu_id) {
            await notificar(
                ctx.projeto.freelancer_usu_id,
                'Nova etapa no projeto',
                `"${ctx.projeto.serv_titulo}" ganhou a etapa "${titulo}".`,
                '/freelancer/entregues'
            )
        }

        return res.status(201).json({ mensagem: 'Etapa criada.', etapas: await listar(ctx.projeto.serv_id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao criar a etapa.' })
    }
}

export const removerEtapa = async (req, res) => {
    try {
        const ctx = await preparar(req, res)
        if (!ctx) return

        if (!ctx.ehDono) {
            return res.status(403).json({ erro: 'Só o contratante remove etapas.' })
        }

        const etapa = await db('servico_etapa').where({ eta_id: req.params.etaId, serv_id: ctx.projeto.serv_id }).first()
        if (etapa?.eta_liberada_em) {
            return res.status(400).json({ erro: 'Esta etapa já foi paga e não pode ser removida.' })
        }

        const apagadas = await db('servico_etapa')
            .where({ eta_id: req.params.etaId, serv_id: ctx.projeto.serv_id })
            .del()

        if (apagadas === 0) {
            return res.status(404).json({ erro: 'Etapa não encontrada.' })
        }

        return res.json({ mensagem: 'Etapa removida.', etapas: await listar(ctx.projeto.serv_id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao remover a etapa.' })
    }
}

/* O freelancer marca (ou desmarca) a etapa como feita */
export const concluirEtapa = async (req, res) => {
    try {
        const ctx = await preparar(req, res)
        if (!ctx) return

        if (ctx.ehDono) {
            return res.status(403).json({ erro: 'Quem marca a etapa como feita é o freelancer.' })
        }

        if (ctx.projeto.serv_status !== 'em_andamento') {
            return res.status(400).json({ erro: 'O projeto não está mais em andamento.' })
        }

        const etapa = await db('servico_etapa')
            .where({ eta_id: req.params.etaId, serv_id: ctx.projeto.serv_id })
            .first()

        if (!etapa) {
            return res.status(404).json({ erro: 'Etapa não encontrada.' })
        }

        if (etapa.eta_liberada_em) {
            return res.status(400).json({ erro: 'Esta etapa já foi aprovada e paga: não dá para reabrir.' })
        }

        const feita = !etapa.eta_concluida_em

        await db('servico_etapa')
            .where('eta_id', etapa.eta_id)
            .update({ eta_concluida_em: feita ? db.fn.now() : null })

        if (feita) {
            await notificar(
                ctx.projeto.dono_usu_id,
                'Etapa concluída',
                `A etapa "${etapa.eta_titulo}" de "${ctx.projeto.serv_titulo}" foi marcada como feita.`,
                '/contratante/historico'
            )
        }

        return res.json({
            mensagem: feita ? 'Etapa marcada como feita.' : 'Etapa reaberta.',
            etapas: await listar(ctx.projeto.serv_id)
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao atualizar a etapa.' })
    }
}

/*
 * O contratante aprova uma etapa já feita e libera a parte dela da garantia (simulação).
 * Só vale com o pagamento guardado: sem garantia a etapa continua só como marcação.
 */
export const aprovarEtapa = async (req, res) => {
    try {
        const ctx = await preparar(req, res)
        if (!ctx) return

        if (!ctx.ehDono) return res.status(403).json({ erro: 'Quem aprova a etapa é o contratante.' })
        if (!(await carteiraPronta()) || !(await temColuna('servico_etapa', 'eta_liberado_valor'))) {
            return res.status(503).json({ erro: 'O pagamento por etapa ainda está sendo preparado. Tente mais tarde.' })
        }
        if (ctx.projeto.serv_status !== 'em_andamento' || !ctx.projeto.freelancer_usu_id) {
            return res.status(400).json({ erro: 'O projeto não está mais em andamento.' })
        }

        const etapa = await db('servico_etapa').where({ eta_id: req.params.etaId, serv_id: ctx.projeto.serv_id }).first()
        if (!etapa) return res.status(404).json({ erro: 'Etapa não encontrada.' })
        if (!etapa.eta_concluida_em) return res.status(400).json({ erro: 'O freelancer ainda não marcou esta etapa como feita.' })
        if (etapa.eta_liberada_em) return res.status(400).json({ erro: 'Esta etapa já foi paga.' })

        const s = await db('servico')
            .where('serv_id', ctx.projeto.serv_id)
            .select('serv_id', 'serv_titulo', 'serv_garantia_valor', 'serv_garantia_em', 'serv_garantia_liberada_em', 'serv_garantia_estornada_em')
            .first()
        if (!s.serv_garantia_em || s.serv_garantia_liberada_em || s.serv_garantia_estornada_em) {
            return res.status(400).json({ erro: 'Guarde o pagamento na garantia antes de pagar por etapa.' })
        }

        const pago = await db.transaction((trx) => liberarParteDaEtapa(trx, s, etapa, ctx.projeto.freelancer_usu_id))
        if (!pago) return res.status(400).json({ erro: 'Não sobrou valor guardado para esta etapa.' })

        const reais = `R$ ${pago.toFixed(2).replace('.', ',')}`
        await notificar(
            ctx.projeto.freelancer_usu_id,
            'Etapa paga',
            `O contratante aprovou "${etapa.eta_titulo}" de "${ctx.projeto.serv_titulo}". ${reais} caíram na sua carteira.`,
            '/freelancer/carteira'
        )

        return res.json({ mensagem: `Etapa aprovada: ${reais} foram para o freelancer.`, etapas: await listar(ctx.projeto.serv_id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao aprovar a etapa.' })
    }
}
