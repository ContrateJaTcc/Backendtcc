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
