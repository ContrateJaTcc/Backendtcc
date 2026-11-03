import db from '../config/knex.js'
import { temColuna, temTabela } from './registro.js'

/*
 * Carteira de mentira (simulação para o TCC: nenhum dinheiro de verdade passa por aqui).
 * O contratante guarda o valor na garantia quando contrata; ele só vai para o freelancer
 * quando o projeto é finalizado (ou volta para o contratante se uma disputa der razão a ele).
 */

/* Todo contratante começa com este saldo fictício para poder testar */
export const SALDO_INICIAL = 5000
export const CREDITO_FICTICIO = 1000
export const SALDO_MAXIMO = 50000

export const carteiraPronta = async () => (await temTabela('carteira_mov')) && (await temColuna('servico', 'serv_garantia_valor'))

export async function saldoDe(usu_id, conexao = db) {
    const linha = await conexao('carteira_mov').where('usu_id', usu_id).sum('mov_valor as saldo').first()
    return Math.round(Number(linha?.saldo ?? 0) * 100) / 100
}

export async function movimentar(conexao, { usu_id, serv_id = null, tipo, valor, desc }) {
    await conexao('carteira_mov').insert({ usu_id, serv_id, mov_tipo: tipo, mov_valor: valor, mov_desc: desc?.slice(0, 160) ?? null })
}

const centavos = (v) => Math.round(Number(v) * 100) / 100

/* Quanto da garantia já foi pago em etapas aprovadas (o resto ainda está guardado) */
export async function liberadoEmEtapas(conexao, serv_id) {
    if (!(await temColuna('servico_etapa', 'eta_liberado_valor'))) return 0
    const linha = await conexao('servico_etapa').where('serv_id', serv_id).sum('eta_liberado_valor as total').first()
    return centavos(linha?.total ?? 0)
}

/* O que ainda está guardado na garantia de um projeto */
export async function restanteDaGarantia(conexao, s) {
    if (!s?.serv_garantia_em) return 0
    return Math.max(0, centavos(Number(s.serv_garantia_valor) - (await liberadoEmEtapas(conexao, s.serv_id))))
}

/*
 * Contratante aprova uma etapa feita: libera a parte dela da garantia para o freelancer.
 * A parte é o que ainda está guardado dividido pelas etapas que faltam pagar, então a soma fecha certinho.
 * Devolve o valor pago (ou null se não havia o que pagar).
 */
export async function pagarEtapa(trx, s, etapa, freelancerUsuId) {
    const etapas = await trx('servico_etapa').where('serv_id', s.serv_id).select('eta_id', 'eta_liberada_em')
    const faltam = etapas.filter((e) => !e.eta_liberada_em).length
    const restante = await restanteDaGarantia(trx, s)
    if (faltam === 0 || restante <= 0) return null

    const parte = faltam === 1 ? restante : centavos(restante / faltam)
    const alteradas = await trx('servico_etapa')
        .where('eta_id', etapa.eta_id)
        .whereNull('eta_liberada_em')
        .update({ eta_liberada_em: db.fn.now(), eta_liberado_valor: parte })
    if (alteradas === 0) return null

    await movimentar(trx, { usu_id: freelancerUsuId, serv_id: s.serv_id, tipo: 'etapa', valor: parte, desc: `Etapa "${etapa.eta_titulo}" de "${s.serv_titulo}"` })
    return parte
}

/* Primeira visita do contratante à carteira: ganha o saldo inicial da simulação */
export async function garantirSaldoInicial(usu_id, tipo) {
    if (tipo !== 'contratante') return
    const algum = await db('carteira_mov').where('usu_id', usu_id).first()
    if (!algum) await movimentar(db, { usu_id, tipo: 'credito', valor: SALDO_INICIAL, desc: 'Saldo inicial da simulação' })
}

/* Projeto finalizado: o valor guardado vai para o freelancer (uma vez só) */
export async function liberarGarantia(trx, serv_id, freelancerUsuId) {
    if (!(await carteiraPronta()) || !freelancerUsuId) return null

    const s = await trx('servico').where('serv_id', serv_id).select('serv_titulo', 'serv_garantia_valor', 'serv_garantia_em', 'serv_garantia_liberada_em', 'serv_garantia_estornada_em').first()
    if (!s?.serv_garantia_em || s.serv_garantia_liberada_em || s.serv_garantia_estornada_em) return null

    const alteradas = await trx('servico').where('serv_id', serv_id).whereNull('serv_garantia_liberada_em').update({ serv_garantia_liberada_em: db.fn.now() })
    if (alteradas === 0) return null

    /* Etapas já pagas saem do total: cai só o que sobrou */
    const valor = await restanteDaGarantia(trx, { ...s, serv_id })
    if (valor > 0) await movimentar(trx, { usu_id: freelancerUsuId, serv_id, tipo: 'recebido', valor, desc: `Pagamento de "${s.serv_titulo}"` })
    return valor
}

/* Disputa a favor do contratante: o valor guardado volta para ele */
export async function estornarGarantia(trx, serv_id, contratanteUsuId) {
    if (!(await carteiraPronta())) return null

    const s = await trx('servico').where('serv_id', serv_id).select('serv_titulo', 'serv_garantia_valor', 'serv_garantia_em', 'serv_garantia_liberada_em', 'serv_garantia_estornada_em').first()
    if (!s?.serv_garantia_em || s.serv_garantia_liberada_em || s.serv_garantia_estornada_em) return null

    const alteradas = await trx('servico').where('serv_id', serv_id).whereNull('serv_garantia_estornada_em').update({ serv_garantia_estornada_em: db.fn.now() })
    if (alteradas === 0) return null

    /* O que já foi pago em etapas fica com o freelancer: volta só o que ainda estava guardado */
    const valor = await restanteDaGarantia(trx, { ...s, serv_id })
    if (valor > 0) await movimentar(trx, { usu_id: contratanteUsuId, serv_id, tipo: 'estorno', valor, desc: `Devolução de "${s.serv_titulo}"` })
    return valor
}
