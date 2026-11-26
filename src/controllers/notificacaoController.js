import db from '../config/knex.js'
import { gerarLembretes } from '../services/lembretes.js'
import { avisoLigado, preferenciaDe } from '../services/avisos.js'


/* Listar */
export const listarNotificacoes = async (req, res) => {
    try {
        /* Lembrete com problema nunca impede de ver as notificações */
        await gerarLembretes(req.usuario.id).catch((erro) => console.error(erro))

        /* Avisos por tipo: o que a pessoa desligou no sino não aparece (nem conta como não lido) */
        const prefs = await preferenciaDe(req.usuario.id)
        const mostrar = (n) => avisoLigado(prefs, 'sino', n.not_titulo, n.not_desc)

        /* Em páginas: ?antes=<not_id> traz as 20 anteriores ("carregar mais") */
        const antes = Number(req.query.antes) || null
        const recentes = await db('notificacao')
            .where('usu_id', req.usuario.id)
            .modify((q) => {
                if (antes) q.where('not_id', '<', antes)
            })
            .select('not_id', 'not_titulo', 'not_desc', 'not_lida', 'not_data')
            .orderBy('not_id', 'desc')
            .limit(120)

        const naoLidas = await db('notificacao')
            .where('usu_id', req.usuario.id)
            .where('not_lida', false)
            .select('not_titulo', 'not_desc')

        const visiveis = recentes.filter(mostrar)
        return res.json({
            mais: visiveis.length > 20 || recentes.length === 120,
            notificacoes: visiveis.slice(0, 20).map((n) => ({ ...n, not_lida: Boolean(n.not_lida) })),
            naoLidas: naoLidas.filter(mostrar).length
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar notificações.' })
    }
}

/* Marcar lidas */
export const marcarTodasLidas = async (req, res) => {
    try {
        await db('notificacao')
            .where('usu_id', req.usuario.id)
            .where('not_lida', false)
            .update({ not_lida: true })

        return res.status(204).end()
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao atualizar notificações.' })
    }
}

/* Uma notificação: marcar como lida ou não lida ({ lida: true | false }) */
export const marcarUma = async (req, res) => {
    try {
        const lida = req.body?.lida !== false
        const alteradas = await db('notificacao')
            .where({ not_id: Number(req.params.id), usu_id: req.usuario.id })
            .update({ not_lida: lida })

        if (!alteradas) return res.status(404).json({ erro: 'Notificação não encontrada.' })
        return res.json({ mensagem: lida ? 'Marcada como lida.' : 'Marcada como não lida.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao atualizar a notificação.' })
    }
}

/* Apagar uma notificação */
export const apagarUma = async (req, res) => {
    try {
        const apagadas = await db('notificacao')
            .where({ not_id: Number(req.params.id), usu_id: req.usuario.id })
            .del()

        if (!apagadas) return res.status(404).json({ erro: 'Notificação não encontrada.' })
        return res.json({ mensagem: 'Notificação apagada.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao apagar a notificação.' })
    }
}

/* Limpar: apaga as já lidas (com ?todas=1, apaga todas) */
export const limpar = async (req, res) => {
    try {
        const todas = req.query.todas === '1'
        const apagadas = await db('notificacao')
            .where('usu_id', req.usuario.id)
            .modify((q) => {
                if (!todas) q.where('not_lida', true)
            })
            .del()

        return res.json({
            mensagem: apagadas ? `${apagadas} ${apagadas === 1 ? 'notificação apagada' : 'notificações apagadas'}.` : 'Nada para limpar.',
            apagadas
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao limpar as notificações.' })
    }
}
