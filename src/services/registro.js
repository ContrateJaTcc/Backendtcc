import db from '../config/knex.js'

/*
 * Registro de ações dos admins (tabela admin_registro). Nunca derruba a ação principal:
 * se a tabela ainda não existe (migração não rodou) ou o insert falha, só avisa no log.
 */

/* Tabelas novas: confere uma vez se já existem (o código roda antes e depois da migração) */
const tabelas = new Map()
export function temTabela(nome) {
    if (!tabelas.has(nome)) tabelas.set(nome, db.schema.hasTable(nome).catch(() => false))
    return tabelas.get(nome)
}

/* Mesma coisa para colunas novas em tabelas antigas (ex.: mensagem.msg_imagem) */
export function temColuna(tabela, coluna) {
    const chave = `${tabela}.${coluna}`
    if (!tabelas.has(chave)) tabelas.set(chave, db.schema.hasColumn(tabela, coluna).catch(() => false))
    return tabelas.get(chave)
}

async function nomeDe(usu_id) {
    if (!usu_id) return null
    const u = await db('usuario').select('usu_nome').where('usu_id', usu_id).first()
    return u?.usu_nome ?? null
}

/*
 * acao: código curto (ex.: 'banir', 'entrar_como'); alvo: usu_id afetado (opcional);
 * detalhe: texto livre curto. Quem fez vem de req.usuario (o supremo, se estiver "entrando como").
 */
export async function registrarAcao(req, acao, { alvo = null, alvoNome = null, detalhe = null } = {}) {
    try {
        if (!(await temTabela('admin_registro'))) return

        const autorId = req.usuario?.supremo_id ?? req.usuario?.id ?? null

        await db('admin_registro').insert({
            usu_id: autorId,
            usu_nome: (await nomeDe(autorId)) ?? 'Desconhecido',
            alvo_usu_id: alvo,
            alvo_nome: alvoNome ?? (await nomeDe(alvo)),
            reg_acao: acao,
            reg_detalhe: detalhe ? String(detalhe).slice(0, 500) : null
        })
    } catch (erro) {
        console.error('[registro]', erro)
    }
}
