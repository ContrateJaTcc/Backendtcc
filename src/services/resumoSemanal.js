import { filtroLiberados } from './moderacao.js'
import db from '../config/knex.js'
import { enviarEmail } from './email.js'
import { temColuna } from './registro.js'

/*
 * Resumo da semana por e-mail (segunda-feira de manhã): projetos novos na área do freelancer,
 * candidaturas novas para o contratante, avaliações pendentes e mensagens não lidas.
 * Quem não tem nada de novo não recebe e-mail.
 */

const DIA = 86_400_000
const SEMANA = 7 * DIA

const frontend = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

async function avaliacoesPendentes(u) {
    const campo = u.tipo_usuario === 'contratante' ? 'contratante.usu_id' : 'freelancer.usu_id'
    const pares = await db('servico')
        .join('contratante', 'servico.cont_id', 'contratante.cont_id')
        .join('candidatura', 'servico.serv_id', 'candidatura.serv_id')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where(campo, u.usu_id)
        .where('servico.serv_status', 'finalizado')
        .where('candidatura.cand_status', 'aceita')
        .select('servico.serv_id')
    if (pares.length === 0) return 0
    const feitas = await db('avaliacao').where('usu_avaliador', u.usu_id).whereIn('serv_id', pares.map((p) => p.serv_id)).pluck('serv_id')
    const jaFeitas = new Set(feitas)
    return pares.filter((p) => !jaFeitas.has(p.serv_id)).length
}

/* O que vai no resumo de uma pessoa (também usado pela prévia nas Configurações) */
export async function montarResumo(u) {
    const desde = new Date(Date.now() - SEMANA)
    const itens = []

    if (u.tipo_usuario === 'freelancer') {
        const free = await db('freelancer').where('usu_id', u.usu_id).select('free_id').first()
        const areas = free ? await db('freelancer_tipo_servico').where('free_id', free.free_id).pluck('tipo_id') : []
        const consulta = db('servico')
            .where('serv_status', 'aberto')
            .modify(await filtroLiberados('serv_moderacao'))
            .where('serv_data_criacao', '>=', desde)
            .orderBy('serv_id', 'desc')
        if (areas.length) consulta.whereIn('tipo_id', areas)
        const novos = await consulta.select('serv_id', 'serv_titulo').limit(20)
        if (novos.length) {
            itens.push({
                titulo: `${novos.length} ${novos.length === 1 ? 'projeto novo' : 'projetos novos'} ${areas.length ? 'na sua área' : 'no site'}`,
                detalhes: novos.slice(0, 3).map((n) => n.serv_titulo),
                link: '/freelancer'
            })
        }
    }

    if (u.tipo_usuario === 'contratante') {
        const comData = await temColuna('candidatura', 'cand_data')
        const consulta = db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .where('contratante.usu_id', u.usu_id)
            .where('candidatura.cand_status', 'pendente')
        if (comData) consulta.where('candidatura.cand_data', '>=', desde)
        const [{ total }] = await consulta.count('* as total')
        if (Number(total)) {
            itens.push({ titulo: `${total} ${Number(total) === 1 ? 'candidatura esperando' : 'candidaturas esperando'} a sua resposta`, detalhes: [], link: '/contratante/candidatos' })
        }
    }

    const pendentes = await avaliacoesPendentes(u)
    if (pendentes) {
        itens.push({ titulo: `Você tem ${pendentes} ${pendentes === 1 ? 'avaliação pendente' : 'avaliações pendentes'}`, detalhes: [], link: `/${u.tipo_usuario}/avaliacoes` })
    }

    const [{ naoLidas }] = await db('mensagem').where({ usu_destinatario: u.usu_id, msg_lida: false }).count('* as naoLidas')
    if (Number(naoLidas)) {
        itens.push({ titulo: `${naoLidas} ${Number(naoLidas) === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`, detalhes: [], link: `/${u.tipo_usuario}/mensagens` })
    }

    return { nome: String(u.usu_nome ?? '').split(' ')[0] || 'Olá', itens }
}

const escapar = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function emailDoResumo(resumo) {
    const base = frontend()
    const texto =
        `Oi, ${resumo.nome}! Seu resumo da semana no ContrateJá:\n\n` +
        resumo.itens.map((i) => `• ${i.titulo}${i.detalhes.length ? `\n  ${i.detalhes.join('\n  ')}` : ''}\n  ${base}${i.link}`).join('\n\n') +
        `\n\nPara parar de receber, desligue em Configurações > Resumo por e-mail.`

    const html =
        `<div style="font-family:Arial,sans-serif;background:#1b1b30;color:#fbf5ef;padding:24px">` +
        `<h1 style="color:#f2d3ab;font-size:22px;margin:0 0 12px">Seu resumo da semana</h1>` +
        `<p>Oi, ${escapar(resumo.nome)}! Olha o que aconteceu no castelo:</p>` +
        resumo.itens
            .map(
                (i) =>
                    `<div style="background:#212139;border:2px solid #494d7e;padding:12px 14px;margin:10px 0">` +
                    `<strong style="color:#fbf5ef">${escapar(i.titulo)}</strong>` +
                    (i.detalhes.length ? `<ul style="margin:6px 0 0;padding-left:18px;color:#e6dadb">${i.detalhes.map((d) => `<li>${escapar(d)}</li>`).join('')}</ul>` : '') +
                    `<p style="margin:8px 0 0"><a href="${base}${i.link}" style="color:#f2d3ab">Ver no site</a></p></div>`
            )
            .join('') +
        `<p style="color:#b3a2bc;font-size:12px">Para parar de receber, desligue em Configurações &gt; Resumo por e-mail.</p></div>`

    return { texto, html }
}

/* Manda para todo mundo que quer receber e ainda não recebeu nos últimos 6 dias; devolve quantos saíram */
export async function enviarResumos() {
    if (!(await temColuna('usuario', 'usu_resumo_email'))) return 0

    const pessoas = await db('usuario')
        .where('status_conta', 'ativa')
        .where('usu_resumo_email', true)
        .whereIn('tipo_usuario', ['freelancer', 'contratante'])
        .where((q) => q.whereNull('usu_resumo_enviado_em').orWhere('usu_resumo_enviado_em', '<', new Date(Date.now() - 6 * DIA)))
        .select('usu_id', 'usu_nome', 'usu_email', 'tipo_usuario')

    let enviados = 0
    for (const u of pessoas) {
        try {
            const resumo = await montarResumo(u)
            await db('usuario').where('usu_id', u.usu_id).update({ usu_resumo_enviado_em: db.fn.now() })
            if (resumo.itens.length === 0) continue
            const { texto, html } = emailDoResumo(resumo)
            await enviarEmail({ para: u.usu_email, assunto: 'Seu resumo da semana - ContrateJá', texto, html })
            enviados += 1
        } catch (erro) {
            console.error('[resumo]', u.usu_id, erro)
        }
    }
    return enviados
}
