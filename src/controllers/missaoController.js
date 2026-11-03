import db from '../config/knex.js'
import { concederXp, nivelPorXp } from '../services/gamificacao.js'
import { temTabela } from '../services/registro.js'
import { aparenciaDe, campeoesDoMesPassado, inicioDoMes as inicioDoMesDesloc } from '../services/aparencia.js'

/*
 * Missões da semana do freelancer: metas pequenas que renovam toda segunda-feira (horário de Brasília)
 * e dão XP extra. O progresso é contado direto das tabelas; resgatar grava em missao_resgate.
 */

const FUSO_BRASIL = -3 * 60 * 60_000

/* Segunda-feira 00:00 (Brasília) da semana atual, como Date em UTC */
function inicioDaSemana(agora = new Date()) {
    const local = new Date(agora.getTime() + FUSO_BRASIL)
    const diasDesdeSegunda = (local.getUTCDay() + 6) % 7
    local.setUTCHours(0, 0, 0, 0)
    local.setUTCDate(local.getUTCDate() - diasDesdeSegunda)
    return new Date(local.getTime() - FUSO_BRASIL)
}

/* A segunda-feira em texto (a mesma para todo mundo no Brasil), ex.: 2026-10-19 */
const rotuloDaSemana = (inicio) => new Date(inicio.getTime() + FUSO_BRASIL).toISOString().slice(0, 10)

const contar = async (consulta) => Number((await consulta.count('* as total').first())?.total ?? 0)

const MISSOES = [
    {
        codigo: 'candidatar',
        titulo: 'Caçador de projetos',
        descricao: 'Candidate-se a 2 projetos.',
        meta: 2,
        xp: 30,
        contar: (f, desde) => contar(db('candidatura').where('free_id', f.free_id).where('cand_data', '>=', desde))
    },
    {
        codigo: 'conversar',
        titulo: 'Bom de papo',
        descricao: 'Envie 5 mensagens para contratantes.',
        meta: 5,
        xp: 20,
        contar: (f, desde) => contar(db('mensagem').where('usu_remetente', f.usu_id).where('msg_data', '>=', desde))
    },
    {
        codigo: 'vitrine',
        titulo: 'Vitrine em dia',
        descricao: 'Adicione ou atualize 1 trabalho no portfólio.',
        meta: 1,
        xp: 25,
        contar: (f, desde) => contar(db('portfolio').where('free_id', f.free_id).where('port_data_atualizacao', '>=', desde))
    },
    {
        codigo: 'entregar',
        titulo: 'Mão na massa',
        descricao: 'Marque 1 trabalho como entregue.',
        meta: 1,
        xp: 50,
        contar: (f, desde) =>
            contar(
                db('candidatura')
                    .join('servico', 'candidatura.serv_id', 'servico.serv_id')
                    .where('candidatura.free_id', f.free_id)
                    .where('candidatura.cand_status', 'aceita')
                    .where('servico.serv_entregue_em', '>=', desde)
            )
    }
]

/* Começo do dia de hoje (Brasília), como Date em UTC, e o dia em texto */
function inicioDoDia(agora = new Date()) {
    const local = new Date(agora.getTime() + FUSO_BRASIL)
    local.setUTCHours(0, 0, 0, 0)
    return new Date(local.getTime() - FUSO_BRASIL)
}
const rotuloDoDia = (inicio) => new Date(inicio.getTime() + FUSO_BRASIL).toISOString().slice(0, 10)

/* Missões do dia: bem pequenas, renovam à meia-noite (o código começa com "dia_") */
const MISSOES_DIA = [
    {
        codigo: 'dia_entrar',
        titulo: 'Bom dia, castelo',
        descricao: 'Passe pelo castelo hoje.',
        meta: 1,
        xp: 5,
        /* Quem abre as missões já está no castelo hoje */
        contar: async () => 1
    },
    {
        codigo: 'dia_conversar',
        titulo: 'Recado do dia',
        descricao: 'Mande 1 mensagem para alguém.',
        meta: 1,
        xp: 10,
        contar: (f, desde) => contar(db('mensagem').where('usu_remetente', f.usu_id).where('msg_data', '>=', desde))
    },
    {
        codigo: 'dia_explorar',
        titulo: 'Olho no mural',
        descricao: 'Salve ou candidate-se a 1 projeto.',
        meta: 1,
        xp: 10,
        contar: async (f, desde) =>
            (await contar(db('candidatura').where('free_id', f.free_id).where('cand_data', '>=', desde))) +
            ((await temTabela('servico_salvo')) ? await contar(db('servico_salvo').where('usu_id', f.usu_id).where('sal_data', '>=', desde)) : 0)
    }
]

async function freelancerDe(req) {
    return db('freelancer').where('usu_id', req.usuario.id).select('free_id', 'usu_id', 'free_xp').first()
}

async function situacao(f) {
    const inicio = inicioDaSemana()
    const semana = rotuloDaSemana(inicio)
    const temResgate = await temTabela('missao_resgate')
    const resgatadas = temResgate
        ? new Set((await db('missao_resgate').where({ free_id: f.free_id, mis_semana: semana }).select('mis_codigo')).map((r) => r.mis_codigo))
        : new Set()

    const missoes = await Promise.all(
        MISSOES.map(async (m) => {
            const progresso = await m.contar(f, inicio)
            return {
                codigo: m.codigo,
                titulo: m.titulo,
                descricao: m.descricao,
                meta: m.meta,
                xp: m.xp,
                progresso: Math.min(progresso, m.meta),
                resgatada: resgatadas.has(m.codigo)
            }
        })
    )

    /* Missões do dia: o resgate grava o próprio dia no lugar da semana */
    const hoje = inicioDoDia()
    const dia = rotuloDoDia(hoje)
    const resgatadasHoje = temResgate
        ? new Set((await db('missao_resgate').where({ free_id: f.free_id, mis_semana: dia }).where('mis_codigo', 'like', 'dia_%').select('mis_codigo')).map((r) => r.mis_codigo))
        : new Set()
    const diarias = await Promise.all(
        MISSOES_DIA.map(async (m) => {
            const progresso = await m.contar(f, hoje)
            return { codigo: m.codigo, titulo: m.titulo, descricao: m.descricao, meta: m.meta, xp: m.xp, progresso: Math.min(progresso, m.meta), resgatada: resgatadasHoje.has(m.codigo) }
        })
    )

    return {
        semana,
        termina: new Date(inicio.getTime() + 7 * 86_400_000).toISOString(),
        /* Sem a migração ainda dá para ver o progresso, mas não resgatar */
        resgateDisponivel: temResgate,
        missoes,
        dia,
        dia_termina: new Date(hoje.getTime() + 86_400_000).toISOString(),
        diarias
    }
}

export const listarMissoes = async (req, res) => {
    try {
        const f = await freelancerDe(req)
        if (!f) return res.status(403).json({ erro: 'Missões são só para freelancers.' })

        return res.json(await situacao(f))

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar as missões.' })
    }
}

export const resgatarMissao = async (req, res) => {
    try {
        const f = await freelancerDe(req)
        if (!f) return res.status(403).json({ erro: 'Missões são só para freelancers.' })

        const atual = await situacao(f)
        const doDia = req.params.codigo.startsWith('dia_')
        const missao = (doDia ? atual.diarias : atual.missoes).find((m) => m.codigo === req.params.codigo)

        if (!missao) return res.status(404).json({ erro: 'Missão não encontrada.' })
        if (!atual.resgateDisponivel) return res.status(503).json({ erro: 'As missões ainda estão sendo preparadas. Tente mais tarde.' })
        if (missao.resgatada) return res.status(400).json({ erro: doDia ? 'Você já resgatou esta missão hoje.' : 'Você já resgatou esta missão nesta semana.' })
        if (missao.progresso < missao.meta) return res.status(400).json({ erro: 'Esta missão ainda não foi cumprida.' })

        await db.transaction(async (trx) => {
            await trx('missao_resgate').insert({ free_id: f.free_id, mis_codigo: missao.codigo, mis_semana: doDia ? atual.dia : atual.semana, mis_xp: missao.xp })
            await concederXp(trx, f.free_id, missao.xp, `missao_${missao.codigo}`)
        })

        return res.json({
            mensagem: `Missão cumprida! +${missao.xp} XP`,
            xp: missao.xp,
            nivelAntes: nivelPorXp(f.free_xp),
            nivelDepois: nivelPorXp(f.free_xp + missao.xp)
        })

    } catch (erro) {
        /* Dois cliques ao mesmo tempo: o segundo bate na chave única */
        if (erro?.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Você já resgatou esta missão nesta semana.' })

        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao resgatar a missão.' })
    }
}

/* ---------- Ranking ---------- */

/* Primeiro dia do mês (Brasília), como Date em UTC */
function inicioDoMes(agora = new Date()) {
    const local = new Date(agora.getTime() + FUSO_BRASIL)
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - FUSO_BRASIL)
}

/* Os 10 freelancers com mais XP: no mês (pelo histórico) ou no geral; e a posição de quem pergunta */
export const ranking = async (req, res) => {
    try {
        const periodo = req.query.periodo === 'geral' ? 'geral' : 'mes'
        /* Ranking por cidade: ?cidade=Volta Redonda&estado=RJ */
        const cidade = String(req.query.cidade ?? '').trim().slice(0, 100)
        const estado = String(req.query.estado ?? '').trim().toUpperCase().slice(0, 2)
        const daCidade = (q) => {
            if (cidade && estado) q.where('usuario.usu_cid', cidade).where('usuario.usu_est', estado)
        }
        let linhas = []

        if (periodo === 'geral') {
            linhas = await db('freelancer')
                .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
                .where('usuario.status_conta', 'ativa')
                .where('freelancer.free_xp', '>', 0)
                .modify(daCidade)
                .select('usuario.usu_id', 'usuario.usu_nome', 'usuario.usu_foto', 'freelancer.free_nivel', 'freelancer.free_xp as xp')
                .orderBy('freelancer.free_xp', 'desc')
                .limit(500)
        } else if (await temTabela('xp_evento')) {
            linhas = await db('xp_evento')
                .join('freelancer', 'xp_evento.free_id', 'freelancer.free_id')
                .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
                .where('usuario.status_conta', 'ativa')
                .where('xp_evento.xpe_data', '>=', inicioDoMes())
                .modify(daCidade)
                .groupBy('usuario.usu_id', 'usuario.usu_nome', 'usuario.usu_foto', 'freelancer.free_nivel')
                .select('usuario.usu_id', 'usuario.usu_nome', 'usuario.usu_foto', 'freelancer.free_nivel', db.raw('SUM(xp_evento.xpe_xp) as xp'))
                .orderBy('xp', 'desc')
                .limit(500)
        }

        const lista = linhas.map((l, i) => ({ posicao: i + 1, ...l, xp: Number(l.xp) }))
        const minha = lista.find((l) => l.usu_id === req.usuario.id) ?? null
        const top = lista.slice(0, 10)
        const aparencias = await aparenciaDe([...top.map((l) => l.usu_id), ...(minha ? [minha.usu_id] : [])])
        const comAparencia = (l) => ({ ...l, moldura: aparencias[l.usu_id]?.moldura ?? null, cor_nome: aparencias[l.usu_id]?.cor_nome ?? null })

        return res.json({
            periodo,
            cidade: cidade && estado ? { cidade, estado } : null,
            ranking: top.map(comAparencia),
            eu: minha ? comAparencia(minha) : null,
            /* Temporada: o ranking do mês zera no dia 1 */
            temporada_termina: inicioDoMesDesloc(1).toISOString()
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar o ranking.' })
    }
}

/* Campeões da temporada passada: os 3 primeiros do ranking do mês anterior */
export const campeoes = async (req, res) => {
    try {
        const lista = await campeoesDoMesPassado()
        const inicio = inicioDoMesDesloc(-1)
        return res.json({ mes: new Date(inicio.getTime() + FUSO_BRASIL).toISOString().slice(0, 7), campeoes: lista })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os campeões.' })
    }
}
