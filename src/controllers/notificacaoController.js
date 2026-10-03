import db from '../config/knex.js'

/*
 * As notificacoes ja eram gravadas (candidatura aceita, projeto concluido,
 * avaliacao recebida, insignia nova), mas nenhuma rota as entregava.
 */

/* GET /notificacoes — as 20 mais recentes e o total de nao lidas. */
export const listarNotificacoes = async (req, res) => {
    try {
        const notificacoes = await db('notificacao')
            .where('usu_id', req.usuario.id)
            .select('not_id', 'not_titulo', 'not_desc', 'not_lida', 'not_data')
            .orderBy('not_id', 'desc')
            .limit(20)

        const [{ naoLidas }] = await db('notificacao')
            .where('usu_id', req.usuario.id)
            .where('not_lida', false)
            .count('* as naoLidas')

        return res.json({
            notificacoes: notificacoes.map((n) => ({ ...n, not_lida: Boolean(n.not_lida) })),
            naoLidas: Number(naoLidas)
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar notificações.' })
    }
}

/* PUT /notificacoes/lidas — marca todas como lidas (ao abrir o sininho). */
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
