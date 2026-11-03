import crypto from 'crypto'
import db from '../config/knex.js'
import { temColuna } from '../services/registro.js'
import { concederXp } from '../services/gamificacao.js'
import { enviarPush } from '../services/push.js'

/*
 * Convide um amigo: cada conta tem um código (ex.: ANA-7K2Q). Quem se cadastra pelo link fica ligado a quem indicou;
 * quando a pessoa conclui o primeiro projeto, os dois ganham XP (contas de contratante, que não têm XP, ganham o aviso e a contagem).
 */

export const XP_INDICACAO = 50
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const pronta = () => temColuna('usuario', 'usu_indicacao_codigo')

function novoCodigo(nome) {
    const prefixo = String(nome ?? '').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'AMIGO'
    let sufixo = ''
    for (let i = 0; i < 4; i++) sufixo += ALFABETO[crypto.randomInt(ALFABETO.length)]
    return `${prefixo}-${sufixo}`
}

async function codigoDe(usu_id) {
    const u = await db('usuario').where('usu_id', usu_id).select('usu_nome', 'usu_indicacao_codigo').first()
    if (u?.usu_indicacao_codigo) return u.usu_indicacao_codigo
    for (let tentativa = 0; tentativa < 5; tentativa++) {
        const codigo = novoCodigo(u?.usu_nome)
        try {
            await db('usuario').where('usu_id', usu_id).update({ usu_indicacao_codigo: codigo })
            return codigo
        } catch (erro) {
            if (erro.code !== 'ER_DUP_ENTRY') throw erro
        }
    }
    throw new Error('Não deu para gerar o código de convite.')
}

/* Usado no cadastro: devolve o usu_id de quem indicou (ou null se o código não existe) */
export async function quemIndicou(codigo) {
    const texto = String(codigo ?? '').trim().toUpperCase()
    if (!texto || !(await pronta())) return null
    const u = await db('usuario').where('usu_indicacao_codigo', texto).select('usu_id').first()
    return u?.usu_id ?? null
}

export const minhaIndicacao = async (req, res) => {
    try {
        if (!(await pronta())) return res.json({ disponivel: false })
        const codigo = await codigoDe(req.usuario.id)
        const indicados = await db('usuario')
            .where('usu_indicado_por', req.usuario.id)
            .select('usu_nome', 'tipo_usuario', 'usu_indicacao_premiada', 'data_criacao')
            .orderBy('data_criacao', 'desc')
        const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
        return res.json({
            disponivel: true,
            codigo,
            link: `${frontend}/cadastro?convite=${codigo}`,
            xp_por_amigo: XP_INDICACAO,
            indicados: indicados.map((u) => ({
                /* Só o primeiro nome e a inicial: é uma lista para comemorar, não para expor ninguém */
                nome: u.usu_nome.split(' ')[0] + (u.usu_nome.split(' ')[1] ? ` ${u.usu_nome.split(' ')[1][0]}.` : ''),
                tipo: u.tipo_usuario,
                premiado: Boolean(u.usu_indicacao_premiada),
                desde: u.data_criacao
            }))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o convite.' })
    }
}

async function darXpSeFreelancer(trx, usu_id) {
    const f = await trx('freelancer').where('usu_id', usu_id).select('free_id').first()
    if (f) await concederXp(trx, f.free_id, XP_INDICACAO, 'indicacao')
    return Boolean(f)
}

/* Chamado quando um projeto é concluído, para o freelancer e o contratante dele */
export async function premiarIndicacao(usuIds) {
    try {
        if (!(await pronta())) return
        for (const usu_id of usuIds.filter(Boolean)) {
            const u = await db('usuario').where('usu_id', usu_id).select('usu_nome', 'usu_indicado_por', 'usu_indicacao_premiada').first()
            if (!u?.usu_indicado_por || u.usu_indicacao_premiada) continue
            await db.transaction(async (trx) => {
                const marcou = await trx('usuario').where({ usu_id, usu_indicacao_premiada: false }).update({ usu_indicacao_premiada: true })
                if (!marcou) return
                await darXpSeFreelancer(trx, usu_id)
                await darXpSeFreelancer(trx, u.usu_indicado_por)
            })
            const nome = u.usu_nome.split(' ')[0]
            const texto = `${nome}, que entrou pelo seu convite, concluiu o primeiro projeto. Vocês dois ganharam ${XP_INDICACAO} XP (para contas de freelancer).`
            await db('notificacao').insert({ usu_id: u.usu_indicado_por, not_titulo: 'Seu convite deu certo!', not_desc: texto })
            await enviarPush(u.usu_indicado_por, { titulo: 'Seu convite deu certo!', texto })
        }
    } catch (erro) {
        console.error(erro)
    }
}
