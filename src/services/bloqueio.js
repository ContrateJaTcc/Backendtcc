import db from '../config/knex.js'
import { temTabela } from './registro.js'

/*
 * Bloqueio: quem bloqueia não recebe mais mensagem, candidatura, convite, proposta nem reunião da outra pessoa
 * (e também não manda para ela). Vale nos dois sentidos para não dar para "furar" pelo outro lado.
 */
export async function bloqueados(a, b) {
    if (!a || !b || !(await temTabela('bloqueio'))) return false
    const linha = await db('bloqueio')
        .where((q) => q.where({ usu_id: a, bloqueado_id: b }).orWhere({ usu_id: b, bloqueado_id: a }))
        .first()
    return Boolean(linha)
}

export const ERRO_BLOQUEIO = 'Não dá para falar com esta pessoa: uma de vocês bloqueou a outra.'
