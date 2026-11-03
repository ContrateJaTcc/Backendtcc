import db from '../config/knex.js'
import { gerarLembretes } from './lembretes.js'
import { enviarResumos } from './resumoSemanal.js'
import { temTabela } from './registro.js'
import { recalcularRank, DIAS_AVALIACAO_CEGA } from './gamificacao.js'
import { marcarTarefa } from '../controllers/painelController.js'
import { rodarRecorrentes } from '../controllers/trabalhoController.js'

/*
 * Tarefas que rodam sozinhas, sem ninguém abrir o site:
 * - lembretes de prazo (a cada 30 minutos);
 * - resumo semanal por e-mail (segunda-feira, a partir das 9h de Brasília);
 * - limpeza de "digitando..." e sessões velhas (uma vez por dia).
 *
 * Com o servidor ligado direto (npm start) quem chama é o setInterval daqui.
 * Na Vercel não existe processo parado esperando: lá quem chama é o Vercel Cron, pelas rotas /tarefas.
 */

const MEIA_HORA = 30 * 60_000
const FUSO_BRASIL = -3 * 60 * 60_000

export async function rodarLembretes() {
    await gerarLembretes()
    /* A saúde do servidor (painel admin) mostra quando cada tarefa rodou */
    await marcarTarefa('lembretes')
}

export async function rodarResumo(agora = new Date()) {
    const local = new Date(agora.getTime() + FUSO_BRASIL)
    /* Só na segunda-feira de manhã (o próprio envio evita mandar duas vezes na semana) */
    if (local.getUTCDay() !== 1 || local.getUTCHours() < 9) return 0
    const enviados = await enviarResumos()
    await marcarTarefa('resumo')
    return enviados
}

/*
 * Avaliação às cegas que passou dos 7 dias sem a outra pessoa avaliar: a nota aparece sozinha,
 * então a média do freelancer precisa ser refeita (olha uma janela de 3 dias para não perder nenhuma).
 */
export async function revelarAvaliacoes(agora = Date.now()) {
    const DIA = 86_400_000
    const ids = await db('avaliacao')
        .join('freelancer', 'freelancer.usu_id', 'avaliacao.usu_avaliado')
        .whereBetween('avaliacao.aval_data', [new Date(agora - (DIAS_AVALIACAO_CEGA + 3) * DIA), new Date(agora - DIAS_AVALIACAO_CEGA * DIA)])
        .distinct('avaliacao.usu_avaliado')
        .pluck('avaliacao.usu_avaliado')
    for (const id of ids) await recalcularRank(db, id)
    return ids.length
}

export async function rodarLimpeza() {
    if (await temTabela('chat_digitando')) await db('chat_digitando').where('dig_ate', '<', new Date(Date.now() - 60_000)).del()
    if (await temTabela('sessao')) await db('sessao').where('ses_ultimo_uso', '<', new Date(Date.now() - 60 * 86_400_000)).del()
    await revelarAvaliacoes()
    /* Projetos recorrentes cujo dia chegou viram projetos novos */
    await rodarRecorrentes()
    await marcarTarefa('limpeza')
}

let ligado = false
let ultimaLimpeza = 0

async function rodada() {
    try {
        await rodarLembretes()
        const enviados = await rodarResumo()
        if (enviados) console.log(`[agendador] ${enviados} resumo(s) semanal(is) enviados`)
        if (Date.now() - ultimaLimpeza > 24 * 60 * 60_000) {
            ultimaLimpeza = Date.now()
            await rodarLimpeza()
        }
    } catch (erro) {
        console.error('[agendador]', erro)
    }
}

export function iniciarAgendador() {
    if (ligado || process.env.AGENDADOR === '0') return
    ligado = true
    /* Primeira rodada um minuto depois de ligar (dá tempo do banco acordar) */
    setTimeout(rodada, 60_000).unref?.()
    setInterval(rodada, MEIA_HORA).unref?.()
    console.log('[agendador] lembretes a cada 30 min e resumo toda segunda às 9h')
}
