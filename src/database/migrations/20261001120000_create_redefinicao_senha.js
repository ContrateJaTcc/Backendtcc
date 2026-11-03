
/* Redefinição de senha */
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

/* Desfaz */
export async function down(knex) {
    await knex.schema.dropTableIfExists('redefinicao_senha')
}
