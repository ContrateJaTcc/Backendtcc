/*
 * Configurações do site inteiro (cenário global do administrador supremo).
 * Quem é o supremo não fica no banco: é um e-mail fixo em src/config/supremo.js.
 */
export async function up(knex) {
    /* Chave e valor em JSON (ex.: cenario) */
    const temConfig = await knex.schema.hasTable('config_site')

    if (!temConfig) {
        await knex.schema.createTable('config_site', (table) => {
            table.string('cfg_chave', 50).primary()
            table.text('cfg_valor').notNullable()
            table.dateTime('cfg_atualizado_em').notNullable().defaultTo(knex.fn.now())
        })
    }
}

/* Desfaz */
export async function down(knex) {
    await knex.schema.dropTableIfExists('config_site')
}
