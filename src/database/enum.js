/*
 * Trocar os valores permitidos de uma coluna "enum" nas migrations.
 * MySQL: ALTER TABLE ... MODIFY ... ENUM(...)
 * PostgreSQL: o knex cria o enum como texto com uma regra CHECK (nome: tabela_coluna_check); troca a regra.
 */
export const ehMysql = (knex) => String(knex.client.config.client ?? '').includes('mysql')

export async function trocarEnum(knex, tabela, coluna, valores, { padrao = null } = {}) {
    const lista = valores.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',')

    if (ehMysql(knex)) {
        await knex.raw(`ALTER TABLE ?? MODIFY ?? ENUM(${lista}) NOT NULL${padrao ? ` DEFAULT '${padrao}'` : ''}`, [tabela, coluna])
        return
    }

    const regra = `${tabela}_${coluna}_check`
    await knex.raw('ALTER TABLE ?? DROP CONSTRAINT IF EXISTS ??', [tabela, regra])
    await knex.raw(`ALTER TABLE ?? ADD CONSTRAINT ?? CHECK (?? IN (${lista}))`, [tabela, regra, coluna])
    if (padrao) await knex.raw(`ALTER TABLE ?? ALTER COLUMN ?? SET DEFAULT '${padrao}'`, [tabela, coluna])
}

/* O índice existe? (MySQL: SHOW INDEX; PostgreSQL: pg_indexes) */
export async function temIndice(knex, tabela, nome) {
    if (ehMysql(knex)) {
        const [linhas] = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [tabela, nome])
        return linhas.length > 0
    }
    const r = await knex.raw('SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ?', [tabela, nome])
    return r.rows.length > 0
}
