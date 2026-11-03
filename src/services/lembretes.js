import db from '../config/knex.js'
import { temColuna } from './registro.js'
import { enviarPush } from './push.js'

/*
 * Lembretes de prazo: rodam quando a pessoa abre as notificações e também pelo agendador
 * (services/agendador.js, ou /tarefas/lembretes na Vercel), para todo mundo de uma vez.
 * - faltando 2 dias ou menos para o prazo (contratação + dias combinados) e sem entrega: avisa o freelancer;
 * - prazo vencido e sem entrega: avisa os dois.
 * Cada aviso sai uma vez só por projeto (as colunas guardam quando saiu).
 */

const DIA = 86_400_000
const ANTECEDENCIA = 2 * DIA

async function avisar(usu_id, titulo, texto, url) {
    await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: texto })
    await enviarPush(usu_id, { titulo, texto, url })
}

const diasRestantes = (ms) => Math.max(0, Math.ceil(ms / DIA))

/* Reuniões aceitas que começam na próxima hora: avisa os dois (uma vez) */
const AVISO_REUNIAO = 60 * 60_000

async function lembrarReunioes(usu_id) {
    if (!(await temColuna('mensagem', 'msg_reuniao_lembrete_em'))) return

    const agora = Date.now()
    const reunioes = await db('mensagem')
        .where('msg_reuniao_status', 'aceita')
        .whereNull('msg_reuniao_lembrete_em')
        .whereBetween('msg_reuniao_em', [new Date(agora), new Date(agora + AVISO_REUNIAO)])
        .where((q) => {
            if (usu_id) q.where('usu_remetente', usu_id).orWhere('usu_destinatario', usu_id)
        })
        .select('msg_id', 'usu_remetente', 'usu_destinatario', 'msg_reuniao_em', 'msg_reuniao_link')

    for (const r of reunioes) {
        const alteradas = await db('mensagem').where('msg_id', r.msg_id).whereNull('msg_reuniao_lembrete_em').update({ msg_reuniao_lembrete_em: db.fn.now() })
        if (alteradas === 0) continue
        const minutos = Math.max(1, Math.round((new Date(r.msg_reuniao_em).getTime() - agora) / 60_000))
        const texto = `Sua reunião começa em ${minutos} min.${r.msg_reuniao_link ? ` Link: ${r.msg_reuniao_link}` : ' Combine pelo chat como vão se falar.'}`
        for (const id of [r.usu_remetente, r.usu_destinatario]) {
            const tipo = (await db('usuario').where('usu_id', id).select('tipo_usuario').first())?.tipo_usuario ?? 'freelancer'
            await avisar(id, 'Reunião daqui a pouco', texto, `/${tipo}/mensagens`)
        }
    }
}

/* usu_id: só os projetos dessa pessoa; sem usu_id: todos os projetos em andamento */
export async function gerarLembretes(usu_id = null) {
    await lembrarReunioes(usu_id)

    if (!(await temColuna('servico', 'serv_lembrete_prazo_em')) || !(await temColuna('servico', 'serv_contratado_em'))) return
    const comPausa = await temColuna('servico', 'serv_pausado_em')

    const projetos = await db('servico')
        .join('contratante', 'servico.cont_id', 'contratante.cont_id')
        .leftJoin('candidatura', function () {
            this.on('candidatura.serv_id', 'servico.serv_id').andOn('candidatura.cand_status', db.raw('?', ['aceita']))
        })
        .leftJoin('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where('servico.serv_status', 'em_andamento')
        .whereNull('servico.serv_entregue_em')
        .whereNotNull('servico.serv_contratado_em')
        .whereNotNull('servico.serv_qtd_dias')
        /* Prazo pausado (pausaController): nada de lembrete até retomar */
        .modify((q) => {
            if (comPausa) q.whereNull('servico.serv_pausado_em')
        })
        .where((q) => {
            if (usu_id) q.where('contratante.usu_id', usu_id).orWhere('freelancer.usu_id', usu_id)
        })
        .select(
            'servico.serv_id',
            'servico.serv_titulo',
            'servico.serv_qtd_dias',
            'servico.serv_contratado_em',
            'servico.serv_lembrete_prazo_em',
            'servico.serv_lembrete_atraso_em',
            'contratante.usu_id as dono',
            'freelancer.usu_id as freelancer'
        )

    const agora = Date.now()

    for (const p of projetos) {
        const prazo = new Date(p.serv_contratado_em).getTime() + p.serv_qtd_dias * DIA
        const falta = prazo - agora

        if (falta < 0 && !p.serv_lembrete_atraso_em) {
            await db('servico').where('serv_id', p.serv_id).update({ serv_lembrete_atraso_em: db.fn.now() })
            const texto = `O prazo de "${p.serv_titulo}" passou e o trabalho ainda não foi marcado como entregue.`
            await avisar(p.dono, 'Prazo vencido', `${texto} Converse com o freelancer pelo chat.`, '/contratante/historico')
            if (p.freelancer) await avisar(p.freelancer, 'Prazo vencido', `${texto} Combine um novo prazo com o contratante.`, '/freelancer/entregues')
        } else if (falta >= 0 && falta <= ANTECEDENCIA && !p.serv_lembrete_prazo_em && p.freelancer) {
            await db('servico').where('serv_id', p.serv_id).update({ serv_lembrete_prazo_em: db.fn.now() })
            const dias = diasRestantes(falta)
            await avisar(
                p.freelancer,
                'Prazo chegando',
                `${dias <= 1 ? 'Falta 1 dia' : `Faltam ${dias} dias`} para o prazo de "${p.serv_titulo}".`,
                '/freelancer/entregues'
            )
        }
    }
}
