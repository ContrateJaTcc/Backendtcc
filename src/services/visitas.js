import crypto from 'crypto'
import db from '../config/knex.js'
import { temTabela } from './registro.js'

/*
 * Visitas ao perfil do freelancer: conta no máximo uma por visitante por dia.
 * A chave é um resumo (hash) de quem visitou: não dá para voltar ao IP nem à conta.
 */

const FUSO_BRASIL = -3 * 60 * 60_000
export const hojeBrasil = (agora = Date.now()) => new Date(agora + FUSO_BRASIL).toISOString().slice(0, 10)

const ROBO = /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|preview|embedly|pinterest/i

const resumo = (texto) => crypto.createHash('sha256').update(`${process.env.JWT_SECRET ?? 'contrateja'}:${texto}`).digest('hex').slice(0, 40)

/* origem: 'publico' (link /p/...) ou 'contratante' (portfólio dentro do site) */
export async function registrarVisita(usu_id, { req, visitanteId = null, origem }) {
    try {
        if (!usu_id || !(await temTabela('perfil_visita'))) return
        if (visitanteId && Number(visitanteId) === Number(usu_id)) return
        /* Robôs de prévia de link (WhatsApp, LinkedIn...) e buscadores não contam como visita */
        if (!visitanteId && ROBO.test(req.get('user-agent') ?? '')) return

        const quem = visitanteId ? `u:${visitanteId}` : `a:${req.ip}:${req.get('user-agent') ?? ''}`
        await db('perfil_visita')
            .insert({ usu_id, vis_dia: hojeBrasil(), vis_chave: resumo(quem), vis_origem: origem })
            .onConflict(['usu_id', 'vis_dia', 'vis_chave'])
            .ignore()
    } catch (erro) {
        /* Contar visita nunca derruba a página */
        console.error('[visitas]', erro)
    }
}
