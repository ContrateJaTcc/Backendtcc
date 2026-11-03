import db from '../config/knex.js'
import { temTabela } from '../services/registro.js'
import { enviarPush } from '../services/push.js'
import { inicioDoMes } from '../services/aparencia.js'

/*
 * Guildas: grupos de até 6 freelancers com nome, lema e brasão. Cada pessoa fica em uma guilda só.
 * A guilda soma o XP do mês dos membros (ranking de guildas) e pode se candidatar junta a projetos maiores.
 */

export const MAX_MEMBROS = 6
export const BRASOES = ['escudo', 'espada', 'dragao', 'coroa', 'estrela', 'arvore']
export const CORES = ['ouro', 'ciano', 'rosa', 'lilas', 'verde', 'vermelho']

const pronto = async () => (await temTabela('guilda')) && (await temTabela('guilda_membro'))

async function notificar(usu_id, titulo, texto) {
    try {
        await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: texto })
        await enviarPush(usu_id, { titulo, texto, url: '/freelancer/guildas' })
    } catch (erro) {
        console.error(erro)
    }
}

/* XP do mês de cada membro (o ranking de guildas soma isso) */
async function xpDoMes(usuIds) {
    if (usuIds.length === 0 || !(await temTabela('xp_evento'))) return new Map()
    const linhas = await db('xp_evento')
        .join('freelancer', 'xp_evento.free_id', 'freelancer.free_id')
        .whereIn('freelancer.usu_id', usuIds)
        .where('xp_evento.xpe_data', '>=', inicioDoMes(0))
        .groupBy('freelancer.usu_id')
        .select('freelancer.usu_id', db.raw('SUM(xp_evento.xpe_xp) as xp'))
    return new Map(linhas.map((l) => [l.usu_id, Number(l.xp)]))
}

export async function minhaGuilda(usu_id) {
    if (!(await pronto())) return null
    const m = await db('guilda_membro').where('usu_id', usu_id).first()
    return m ? db('guilda').where('gui_id', m.gui_id).first() : null
}

async function detalhes(gui_id) {
    const g = await db('guilda').where('gui_id', gui_id).first()
    if (!g) return null
    const membros = await db('guilda_membro')
        .join('usuario', 'guilda_membro.usu_id', 'usuario.usu_id')
        .join('freelancer', 'freelancer.usu_id', 'usuario.usu_id')
        .where('guilda_membro.gui_id', gui_id)
        .select('usuario.usu_id', 'usuario.usu_nome', 'usuario.usu_foto', 'freelancer.free_nivel', 'guilda_membro.gme_papel', 'guilda_membro.gme_entrou')
        .orderBy([{ column: 'guilda_membro.gme_papel' }, { column: 'guilda_membro.gme_entrou' }])
    const xp = await xpDoMes(membros.map((m) => m.usu_id))
    const comXp = membros.map((m) => ({ ...m, xp_mes: xp.get(m.usu_id) ?? 0 }))
    return {
        gui_id: g.gui_id,
        nome: g.gui_nome,
        lema: g.gui_lema,
        brasao: g.gui_brasao,
        cor: g.gui_cor,
        criada: g.gui_criada,
        dono: g.gui_dono,
        membros: comXp,
        xp_mes: comXp.reduce((t, m) => t + m.xp_mes, 0)
    }
}

export const listar = async (req, res) => {
    try {
        if (!(await pronto())) return res.json({ disponivel: false, minha: null, guildas: [], max_membros: MAX_MEMBROS })

        const guildas = await db('guilda').select('gui_id', 'gui_nome', 'gui_lema', 'gui_brasao', 'gui_cor').limit(200)
        const membros = await db('guilda_membro').select('gui_id', 'usu_id')
        const xp = await xpDoMes(membros.map((m) => m.usu_id))

        const lista = guildas
            .map((g) => {
                const deles = membros.filter((m) => m.gui_id === g.gui_id)
                return {
                    gui_id: g.gui_id,
                    nome: g.gui_nome,
                    lema: g.gui_lema,
                    brasao: g.gui_brasao,
                    cor: g.gui_cor,
                    membros: deles.length,
                    xp_mes: deles.reduce((t, m) => t + (xp.get(m.usu_id) ?? 0), 0)
                }
            })
            .sort((a, b) => b.xp_mes - a.xp_mes || b.membros - a.membros || a.nome.localeCompare(b.nome))
            .map((g, i) => ({ ...g, posicao: i + 1 }))

        const minha = await minhaGuilda(req.usuario.id)
        return res.json({
            disponivel: true,
            max_membros: MAX_MEMBROS,
            minha: minha
                ? {
                    ...(await detalhes(minha.gui_id)),
                    posicao: lista.find((g) => g.gui_id === minha.gui_id)?.posicao ?? null,
                    meu_papel: (await db('guilda_membro').where({ gui_id: minha.gui_id, usu_id: req.usuario.id }).first())?.gme_papel ?? 'membro'
                }
                : null,
            guildas: lista
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as guildas.' })
    }
}

function lerCampos(body) {
    const nome = String(body.nome ?? '').trim().replace(/\s+/g, ' ')
    const lema = String(body.lema ?? '').trim()
    const brasao = String(body.brasao ?? 'escudo')
    const cor = String(body.cor ?? 'ouro')
    if (nome.length < 3 || nome.length > 30) return { erro: 'O nome da guilda vai de 3 a 30 letras.' }
    if (lema.length > 120) return { erro: 'O lema pode ter até 120 letras.' }
    if (!BRASOES.includes(brasao)) return { erro: 'Escolha um dos brasões.' }
    if (!CORES.includes(cor)) return { erro: 'Escolha uma das cores.' }
    return { campos: { gui_nome: nome, gui_lema: lema || null, gui_brasao: brasao, gui_cor: cor } }
}

export const criar = async (req, res) => {
    try {
        if (!(await pronto())) return res.status(503).json({ erro: 'As guildas ainda estão sendo preparadas. Tente mais tarde.' })
        if (await minhaGuilda(req.usuario.id)) return res.status(400).json({ erro: 'Você já está numa guilda. Saia dela para fundar outra.' })

        const lido = lerCampos(req.body)
        if (lido.erro) return res.status(400).json({ erro: lido.erro })

        const repetida = await db('guilda').whereRaw('LOWER(gui_nome) = ?', [lido.campos.gui_nome.toLowerCase()]).first()
        if (repetida) return res.status(409).json({ erro: 'Já existe uma guilda com esse nome.' })

        const gui_id = await db.transaction(async (trx) => {
            const [id] = await trx('guilda').insert({ ...lido.campos, gui_dono: req.usuario.id })
            await trx('guilda_membro').insert({ gui_id: id, usu_id: req.usuario.id, gme_papel: 'lider' })
            return id
        })

        return res.status(201).json({ mensagem: `A guilda ${lido.campos.gui_nome} foi fundada! Chame outros freelancers para entrar.`, gui_id })
    } catch (erro) {
        if (erro?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma guilda com esse nome (ou você já está numa).' })
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao fundar a guilda.' })
    }
}

export const editar = async (req, res) => {
    try {
        if (!(await pronto())) return res.status(503).json({ erro: 'As guildas ainda estão sendo preparadas.' })
        const g = await db('guilda').where('gui_id', Number(req.params.id)).first()
        if (!g) return res.status(404).json({ erro: 'Guilda não encontrada.' })
        const eu = await db('guilda_membro').where({ gui_id: g.gui_id, usu_id: req.usuario.id }).first()
        if (eu?.gme_papel !== 'lider') return res.status(403).json({ erro: 'Só a liderança muda o brasão e o lema.' })

        const lido = lerCampos({ nome: g.gui_nome, ...req.body })
        if (lido.erro) return res.status(400).json({ erro: lido.erro })
        const { gui_nome: _nome, ...campos } = lido.campos
        await db('guilda').where('gui_id', g.gui_id).update(campos)
        return res.json({ mensagem: 'Guilda atualizada.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao atualizar a guilda.' })
    }
}

export const entrar = async (req, res) => {
    try {
        if (!(await pronto())) return res.status(503).json({ erro: 'As guildas ainda estão sendo preparadas.' })
        if (await minhaGuilda(req.usuario.id)) return res.status(400).json({ erro: 'Você já está numa guilda. Saia dela primeiro.' })

        const g = await db('guilda').where('gui_id', Number(req.params.id)).first()
        if (!g) return res.status(404).json({ erro: 'Guilda não encontrada.' })

        const ok = await db.transaction(async (trx) => {
            const total = Number((await trx('guilda_membro').where('gui_id', g.gui_id).count('* as n').first())?.n ?? 0)
            if (total >= MAX_MEMBROS) return false
            await trx('guilda_membro').insert({ gui_id: g.gui_id, usu_id: req.usuario.id, gme_papel: 'membro' })
            return true
        })
        if (!ok) return res.status(400).json({ erro: `A guilda já está cheia (${MAX_MEMBROS} membros).` })

        const eu = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        const lideres = await db('guilda_membro').where({ gui_id: g.gui_id, gme_papel: 'lider' }).pluck('usu_id')
        for (const id of lideres) await notificar(id, 'Novo membro na guilda', `${eu?.usu_nome ?? 'Alguém'} entrou na ${g.gui_nome}.`)

        return res.json({ mensagem: `Bem-vindo à ${g.gui_nome}!` })
    } catch (erro) {
        if (erro?.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Você já está numa guilda.' })
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao entrar na guilda.' })
    }
}

/* Sair: se a liderança sair, quem entrou primeiro assume; guilda vazia acaba */
async function tirar(gui_id, usu_id) {
    await db.transaction(async (trx) => {
        const saindo = await trx('guilda_membro').where({ gui_id, usu_id }).first()
        if (!saindo) return
        await trx('guilda_membro').where({ gui_id, usu_id }).del()
        const resto = await trx('guilda_membro').where('gui_id', gui_id).orderBy('gme_entrou')
        if (resto.length === 0) {
            await trx('guilda').where('gui_id', gui_id).del()
        } else if (saindo.gme_papel === 'lider' && !resto.some((m) => m.gme_papel === 'lider')) {
            await trx('guilda_membro').where({ gui_id, usu_id: resto[0].usu_id }).update({ gme_papel: 'lider' })
            await trx('guilda').where('gui_id', gui_id).update({ gui_dono: resto[0].usu_id })
        }
    })
}

export const sair = async (req, res) => {
    try {
        const g = await minhaGuilda(req.usuario.id)
        if (!g) return res.status(400).json({ erro: 'Você não está em nenhuma guilda.' })
        await tirar(g.gui_id, req.usuario.id)
        return res.json({ mensagem: `Você saiu da ${g.gui_nome}.` })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao sair da guilda.' })
    }
}

export const removerMembro = async (req, res) => {
    try {
        if (!(await pronto())) return res.status(503).json({ erro: 'As guildas ainda estão sendo preparadas.' })
        const gui_id = Number(req.params.id)
        const alvo = Number(req.params.usuId)
        const eu = await db('guilda_membro').where({ gui_id, usu_id: req.usuario.id }).first()
        if (eu?.gme_papel !== 'lider') return res.status(403).json({ erro: 'Só a liderança tira membros.' })
        if (alvo === req.usuario.id) return res.status(400).json({ erro: 'Para sair, use "Sair da guilda".' })
        const membro = await db('guilda_membro').where({ gui_id, usu_id: alvo }).first()
        if (!membro) return res.status(404).json({ erro: 'Essa pessoa não está na guilda.' })

        await tirar(gui_id, alvo)
        const g = await db('guilda').where('gui_id', gui_id).first()
        await notificar(alvo, 'Você saiu da guilda', `A liderança tirou você da ${g?.gui_nome ?? 'guilda'}.`)
        return res.json({ mensagem: 'Membro removido.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao remover o membro.' })
    }
}
