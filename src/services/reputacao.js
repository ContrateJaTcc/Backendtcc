import db from '../config/knex.js'
import { temColuna } from './registro.js'
import { avaliacaoVisivel } from './gamificacao.js'

/* Média de cada critério da avaliação (só notas visíveis); null quando ninguém deu nota naquele critério */
export async function mediasPorCriterio(usu_id) {
    if (!(await temColuna('avaliacao', 'aval_comunicacao'))) return null
    const [l] = await db('avaliacao')
        .where('usu_avaliado', usu_id)
        .whereRaw(avaliacaoVisivel())
        .select(
            db.raw('AVG(aval_comunicacao) as comunicacao'),
            db.raw('AVG(aval_prazo) as prazo'),
            db.raw('AVG(aval_qualidade) as qualidade'),
            db.raw('COUNT(aval_comunicacao) as total')
        )
    const arredondar = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10)
    if (!Number(l?.total)) return null
    return { comunicacao: arredondar(l.comunicacao), prazo: arredondar(l.prazo), qualidade: arredondar(l.qualidade), total: Number(l.total) }
}

const DIA = 86_400_000

/*
 * Reputação do contratante, do histórico dele: guarda o pagamento, aprova a entrega rápido e avalia sempre.
 * Cada selo só aparece com pelo menos 2 projetos para olhar (com 1 não dá para dizer "sempre").
 */
export async function reputacaoContratante(usu_id) {
    const projetos = await db('servico')
        .join('contratante', 'servico.cont_id', 'contratante.cont_id')
        .where('contratante.usu_id', usu_id)
        .whereIn('servico.serv_status', ['em_andamento', 'finalizado'])
        .select(
            'servico.serv_id',
            'servico.serv_status',
            'servico.serv_entregue_em',
            ...((await temColuna('servico', 'serv_finalizado_em')) ? ['servico.serv_finalizado_em'] : []),
            ...((await temColuna('servico', 'serv_garantia_em')) ? ['servico.serv_garantia_em', 'servico.serv_acordo_free_em'] : [])
        )

    const finalizados = projetos.filter((p) => p.serv_status === 'finalizado')
    const avaliados = finalizados.length
        ? await db('avaliacao').whereIn('serv_id', finalizados.map((p) => p.serv_id)).where('usu_avaliador', usu_id).countDistinct('serv_id as total').first()
        : { total: 0 }

    /* Pagamento: projetos com acordo assinado em que a garantia foi guardada */
    const comAcordo = projetos.filter((p) => p.serv_acordo_free_em !== undefined && (p.serv_acordo_free_em || p.serv_garantia_em))
    const pagou = comAcordo.filter((p) => p.serv_garantia_em).length

    /* Aprovação: dias entre a entrega e a conclusão (mediana) */
    const demoras = finalizados
        .filter((p) => p.serv_entregue_em && p.serv_finalizado_em)
        .map((p) => (new Date(p.serv_finalizado_em).getTime() - new Date(p.serv_entregue_em).getTime()) / DIA)
        .sort((a, b) => a - b)
    const mediana = demoras.length ? demoras[Math.floor(demoras.length / 2)] : null

    const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)
    const selos = []
    if (comAcordo.length >= 2 && pagou / comAcordo.length >= 0.9) selos.push({ codigo: 'paga', texto: 'Guarda o pagamento em dia' })
    if (demoras.length >= 2 && mediana <= 2) selos.push({ codigo: 'aprova', texto: 'Aprova a entrega rápido' })
    if (finalizados.length >= 2 && Number(avaliados.total) / finalizados.length >= 0.9) selos.push({ codigo: 'avalia', texto: 'Avalia sempre' })

    return {
        projetos_concluidos: finalizados.length,
        pagamento_em_dia: pct(pagou, comAcordo.length),
        dias_para_aprovar: mediana === null ? null : Math.round(mediana * 10) / 10,
        avalia: pct(Number(avaliados.total), finalizados.length),
        selos
    }
}
