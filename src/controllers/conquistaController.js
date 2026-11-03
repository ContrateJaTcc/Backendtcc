import db from '../config/knex.js'
import { temTabela } from '../services/registro.js'
import { enviarPush } from '../services/push.js'

/*
 * Conquistas secretas: aparecem como "???" até a pessoa conseguir. Não dão XP (só a graça de achar).
 * "coruja" sai do servidor (mensagem de madrugada); as outras o site avisa quando acontecem.
 */
export const SECRETAS = {
    coruja: { nome: 'Coruja noturna', descricao: 'Mandou uma mensagem entre meia-noite e 5 da manhã.', dica: 'Algumas conversas só acontecem de madrugada.' },
    explorador: { nome: 'Explorador do castelo', descricao: 'Escondeu tudo para admirar o cenário.', dica: 'Às vezes vale a pena só olhar a paisagem.' },
    lua_cheia: { nome: 'Lua cheia', descricao: 'Esteve no castelo numa noite de lua cheia.', dica: 'Volte quando a lua estiver redonda.' },
    clima: { nome: 'Mestre do clima', descricao: 'Experimentou todos os climas do castelo.', dica: 'O céu do castelo muda como você quiser.' },
    dragao: { nome: 'Caçador de dragões', descricao: 'Ajudou o castelo a derrotar o chefão do mês.', dica: 'Juntos, até o maior dragão cai.' }
}

/* As que o próprio site pode avisar (a coruja só o servidor confere, pela hora da mensagem) */
const DO_SITE = new Set(['explorador', 'lua_cheia', 'clima'])

/* Libera para a pessoa (uma vez) e avisa; devolve true se foi agora */
export async function liberarConquista(usu_id, codigo) {
    if (!SECRETAS[codigo] || !(await temTabela('conquista_secreta'))) return false

    if (await db('conquista_secreta').where({ usu_id, con_codigo: codigo }).first()) return false

    /* O ignore cobre dois pedidos ao mesmo tempo */
    await db('conquista_secreta')
        .insert({ usu_id, con_codigo: codigo })
        .onConflict(['usu_id', 'con_codigo'])
        .ignore()

    const texto = `Você achou a conquista secreta "${SECRETAS[codigo].nome}"!`
    await db('notificacao').insert({ usu_id, not_titulo: 'Conquista secreta!', not_desc: texto })
    await enviarPush(usu_id, { titulo: 'Conquista secreta!', texto })
    return true
}

async function lista(usu_id) {
    const minhas = (await temTabela('conquista_secreta'))
        ? await db('conquista_secreta').where('usu_id', usu_id).select('con_codigo', 'con_data')
        : []
    const quando = new Map(minhas.map((c) => [c.con_codigo, c.con_data]))

    return Object.entries(SECRETAS).map(([codigo, c]) =>
        quando.has(codigo)
            ? { codigo, nome: c.nome, descricao: c.descricao, conquistada: true, data: quando.get(codigo) }
            : { codigo, nome: '???', descricao: c.dica, conquistada: false, data: null }
    )
}

export const listarConquistas = async (req, res) => {
    try {
        return res.json({ conquistas: await lista(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as conquistas.' })
    }
}

export const desbloquear = async (req, res) => {
    try {
        const { codigo } = req.params

        if (!DO_SITE.has(codigo)) {
            return res.status(404).json({ erro: 'Conquista não encontrada.' })
        }

        const nova = await liberarConquista(req.usuario.id, codigo)

        return res.json({ nova, conquista: nova ? SECRETAS[codigo].nome : null, conquistas: await lista(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao registrar a conquista.' })
    }
}
