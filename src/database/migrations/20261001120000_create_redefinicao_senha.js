/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

/*
 * Pedidos de "esqueci a senha".
 *
 * Guardamos so o hash SHA-256 do token, nunca o token em si: quem tiver
 * acesso de leitura ao banco nao consegue usar os links que estao no ar.
 * red_usado impede reutilizar um link depois que a senha ja foi trocada.
 */
export async function up(knex) {
    const existe = await knex.schema.hasTable('redefinicao_senha')

    if (existe) return

    await knex.schema.createTable('redefinicao_senha', (table) => {
        table.increments('red_id').primary()

        table
            .integer('usu_id')
            .unsigned()
            .notNullable()
            .references('usu_id')
            .inTable('usuario')
            .onDelete('CASCADE')

        table.specificType('red_token_hash', 'CHAR(64)').notNullable().unique()
        table.dateTime('red_expira').notNullable()
        table.boolean('red_usado').notNullable().defaultTo(false)

        table
            .dateTime('data_criacao')
            .notNullable()
            .defaultTo(knex.fn.now())
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('redefinicao_senha')
}
