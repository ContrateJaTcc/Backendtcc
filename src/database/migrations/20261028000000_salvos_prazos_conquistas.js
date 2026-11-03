/* Projetos salvos, prazo para candidaturas, lembretes de prazo e conquistas secretas */
export async function up(knex) {
    /* Projetos que o freelancer marcou para ver depois */
    if (!(await knex.schema.hasTable('servico_salvo'))) {
        await knex.schema.createTable('servico_salvo', (table) => {
            table.integer('usu_id').unsigned().notNullable()
            table.integer('serv_id').unsigned().notNullable()
            table.dateTime('sal_data').notNullable().defaultTo(knex.fn.now())
            table.primary(['usu_id', 'serv_id'])
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
            table.foreign('serv_id').references('serv_id').inTable('servico').onDelete('CASCADE')
        })
    }

    /* Até quando o projeto aceita candidaturas, e quando os lembretes de prazo saíram (para avisar uma vez só) */
    if (!(await knex.schema.hasColumn('servico', 'serv_candidaturas_ate'))) {
        await knex.schema.alterTable('servico', (table) => {
            table.date('serv_candidaturas_ate').nullable()
            table.dateTime('serv_lembrete_prazo_em').nullable()
            table.dateTime('serv_lembrete_atraso_em').nullable()
        })
    }

    /* Conquistas secretas (não aparecem até a pessoa conseguir) */
    if (!(await knex.schema.hasTable('conquista_secreta'))) {
        await knex.schema.createTable('conquista_secreta', (table) => {
            table.integer('usu_id').unsigned().notNullable()
            table.string('con_codigo', 30).notNullable()
            table.dateTime('con_data').notNullable().defaultTo(knex.fn.now())
            table.primary(['usu_id', 'con_codigo'])
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }
}

/* Desfaz */
export async function down(knex) {
    await knex.schema.dropTableIfExists('conquista_secreta')
    await knex.schema.dropTableIfExists('servico_salvo')

    if (await knex.schema.hasColumn('servico', 'serv_candidaturas_ate')) {
        await knex.schema.alterTable('servico', (table) => {
            table.dropColumn('serv_candidaturas_ate')
            table.dropColumn('serv_lembrete_prazo_em')
            table.dropColumn('serv_lembrete_atraso_em')
        })
    }
}
