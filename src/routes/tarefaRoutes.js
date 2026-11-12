import express from 'express'
import crypto from 'crypto'
import { rodarLembretes, rodarResumo, rodarLimpeza } from '../services/agendador.js'
import { aplicarMigracoes, listarMigracoes } from '../database/migracoes.js'

/*
 * Tarefas agendadas para a Vercel (vercel.json > crons). A Vercel manda
 * "Authorization: Bearer <CRON_SECRET>"; sem a variável configurada, as rotas ficam fechadas.
 */
const router = express.Router()

function exigirSegredo(req, res, next) {
    const segredo = process.env.CRON_SECRET
    const enviado = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    const iguais = segredo && enviado.length === segredo.length && crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))
    if (!iguais) return res.status(401).json({ erro: 'Não autorizado.' })
    next()
}

const tarefa = (fazer) => async (req, res) => {
    try {
        const resultado = await fazer()
        return res.json({ ok: true, resultado: resultado ?? null })
    } catch (erro) {
        console.error('[tarefa]', erro)
        return res.status(500).json({ erro: 'A tarefa falhou.' })
    }
}

router.get('/lembretes', exigirSegredo, tarefa(rodarLembretes))
router.get('/resumo', exigirSegredo, tarefa(() => rodarResumo()))
router.get('/limpeza', exigirSegredo, tarefa(rodarLimpeza))
/* Migrations do banco com a mesma chave (para quando ninguém tem a senha do banco nem do supremo) */
router.get('/migrar', exigirSegredo, tarefa(listarMigracoes))
router.post('/migrar', exigirSegredo, async (req, res) => {
    try {
        return res.json({ ok: true, resultado: await aplicarMigracoes() })
    } catch (erro) {
        console.error('[migrar]', erro)
        return res.status(500).json({ erro: 'A migration falhou.', detalhe: String(erro?.message ?? erro).slice(0, 300) })
    }
})

export default router
