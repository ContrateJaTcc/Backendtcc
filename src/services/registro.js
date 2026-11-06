import db from '../config/knex.js'

/*
 * Registro de ações dos admins (tabela admin_registro). Nunca derruba a ação principal:
 * se a tabela ainda não existe (migração não rodou) ou o insert falha, só avisa no log.
 */

/*
 * Tabelas novas: o código roda antes e depois da migração. "Existe" fica guardado para sempre;
 * "não existe" só por um minuto, para o servidor já ligado enxergar a migração sem ser republicado.
 */
const tabelas = new Map()
const RECONFERIR_MS = 60_000

function conferir(chave, consulta) {
    const guardado = tabelas.get(chave)
    if (guardado && (guardado.existe || Date.now() - guardado.em < RECONFERIR_MS)) return guardado.promessa

    const item = { em: Date.now(), existe: false, promessa: null }
    item.promessa = consulta()
        .then((existe) => {
            item.existe = Boolean(existe)
            return item.existe
        })
        .catch(() => false)
    tabelas.set(chave, item)
    return item.promessa
}

export function temTabela(nome) {
    return conferir(nome, () => db.schema.hasTable(nome))
}

/* Mesma coisa para colunas novas em tabelas antigas (ex.: mensagem.msg_imagem) */
export function temColuna(tabela, coluna) {
    return conferir(`${tabela}.${coluna}`, () => db.schema.hasColumn(tabela, coluna))
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
