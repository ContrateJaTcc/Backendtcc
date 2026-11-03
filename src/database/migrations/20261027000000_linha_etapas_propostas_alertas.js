/* Linha do tempo do projeto, contraproposta, etapas, alertas de busca e arquivo (PDF) no chat */
export async function up(knex) {
    /* Quando foi contratado e quando foi concluído (a entrega já tem serv_entregue_em) */
    if (!(await knex.schema.hasColumn('servico', 'serv_contratado_em'))) {
        await knex.schema.alterTable('servico', (table) => {
            table.dateTime('serv_contratado_em').nullable()
            table.dateTime('serv_finalizado_em').nullable()
        })
    }

    /* Contraproposta do freelancer: outro valor e/ou prazo, com um recado */
    if (!(await knex.schema.hasColumn('candidatura', 'cand_valor_proposto'))) {
        await knex.schema.alterTable('candidatura', (table) => {
            table.decimal('cand_valor_proposto', 10, 2).nullable()
            table.integer('cand_prazo_proposto').nullable()
            table.string('cand_mensagem', 500).nullable()
        })
    }

    /* Etapas que o contratante define e o freelancer marca como feitas */
    if (!(await knex.schema.hasTable('servico_etapa'))) {
        await knex.schema.createTable('servico_etapa', (table) => {
            table.increments('eta_id').primary()
            table.integer('serv_id').unsigned().notNullable()
            table.string('eta_titulo', 100).notNullable()
            table.integer('eta_ordem').notNullable().defaultTo(0)
            table.dateTime('eta_concluida_em').nullable()
            table.foreign('serv_id').references('serv_id').inTable('servico').onDelete('CASCADE')
        })
    }

    /* Busca salva: avisa o freelancer quando sai projeto parecido */
    if (!(await knex.schema.hasTable('busca_salva'))) {
        await knex.schema.createTable('busca_salva', (table) => {
            table.increments('bus_id').primary()
            table.integer('usu_id').unsigned().notNullable()
            table.string('bus_termo', 80).nullable()
            table.integer('tipo_id').unsigned().nullable()
            table.decimal('bus_valor_min', 10, 2).nullable()
            table.dateTime('bus_data').notNullable().defaultTo(knex.fn.now())
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
            table.foreign('tipo_id').references('tipo_id').inTable('tipo_servico').onDelete('CASCADE')
        })
    }

    /* PDF na conversa (data URI), com o nome do arquivo */
    if (!(await knex.schema.hasColumn('mensagem', 'msg_arquivo'))) {
        await knex.schema.alterTable('mensagem', (table) => {
            table.specificType('msg_arquivo', 'MEDIUMTEXT').nullable()
            table.string('msg_arquivo_nome', 120).nullable()
        })
    }
}

/* Desfaz */
export async function down(knex) {
    await knex.schema.dropTableIfExists('busca_salva')
    await knex.schema.dropTableIfExists('servico_etapa')

    if (await knex.schema.hasColumn('mensagem', 'msg_arquivo')) {
        await knex.schema.alterTable('mensagem', (table) => {
            table.dropColumn('msg_arquivo')
            table.dropColumn('msg_arquivo_nome')
        })
    }
    if (await knex.schema.hasColumn('candidatura', 'cand_valor_proposto')) {
        await knex.schema.alterTable('candidatura', (table) => {
            table.dropColumn('cand_valor_proposto')
            table.dropColumn('cand_prazo_proposto')
            table.dropColumn('cand_mensagem')
        })
    }
    if (await knex.schema.hasColumn('servico', 'serv_contratado_em')) {
        await knex.schema.alterTable('servico', (table) => {
            table.dropColumn('serv_contratado_em')
            table.dropColumn('serv_finalizado_em')
        })
    }
}
