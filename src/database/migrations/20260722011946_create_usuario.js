/**
 * Cria a tabela de usuários.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.createTable('usuario', (table) => {
        table.increments('usu_id').primary()

        table.string('usu_nome', 150).notNullable()
        table.string('usu_email', 255).notNullable().unique()
        table.string('usu_senha', 255).notNullable()
        table.specificType('usu_cpf', 'CHAR(11)').notNullable().unique()
        table.string('usu_tel', 11).notNullable()
        table.date('usu_data_nasc').notNullable()
        table.string('usu_cid', 100).notNullable()
        table.specificType('usu_est', 'CHAR(2)').notNullable()

        table.text('usu_desc')
        table.string('usu_foto', 255)

        table
            .enu('tipo_usuario', [
                'freelancer',
                'contratante',
                'administrador'
            ])
            .notNullable()

        table
            .enu('status_conta', [
                'pendente',
                'ativa',
                'suspensa',
                'banida'
            ])
            .notNullable()
            .defaultTo('ativa')

        table
            .dateTime('data_criacao')
            .notNullable()
            .defaultTo(knex.fn.now())

        table
            .dateTime('data_atualizacao')
            .notNullable()
            .defaultTo(knex.fn.now())
    })
}

/**
 * Remove a tabela de usuários.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('usuario')
}