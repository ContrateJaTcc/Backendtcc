import db from '../config/knex.js'
import { temColuna } from './registro.js'

/*
 * "Visto por último": a hora vem do middleware de login (middleware/auth.js).
 * Só aparece para os outros se a pessoa deixou "Mostrar quando estou online" ligado nas Configurações.
 */
export async function colunasPresenca(prefixo = '') {
    if (!(await temColuna('usuario', 'usu_visto_em'))) return []
    return [`${prefixo}usu_visto_em`, `${prefixo}usu_mostrar_online`]
}

export const vistoDe = (u) => (u && u.usu_mostrar_online !== 0 && u.usu_mostrar_online !== false && u.usu_visto_em ? u.usu_visto_em : null)

export async function vistoDoUsuario(usu_id) {
    const colunas = await colunasPresenca()
    if (colunas.length === 0) return null
    return vistoDe(await db('usuario').where('usu_id', usu_id).select(colunas).first())
}
