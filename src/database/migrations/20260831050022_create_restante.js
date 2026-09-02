export async function up(knex) {

    // 1. freelancer
    await knex.schema.createTable('freelancer', (table) => {
        table.increments('free_id').primary()
        table.integer('usu_id').unsigned().notNullable().unique()

        table.integer('free_xp').notNullable().defaultTo(0)
        table.integer('free_nivel').notNullable().defaultTo(1)
        table.decimal('free_rank', 3, 2).notNullable().defaultTo(0.00)

        table.foreign('usu_id')
            .references('usu_id')
            .inTable('usuario')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')
    })


    // 2. contratante
    await knex.schema.createTable('contratante', (table) => {
        table.increments('cont_id').primary()
        table.integer('usu_id').unsigned().notNullable().unique()

        table.foreign('usu_id')
            .references('usu_id')
            .inTable('usuario')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')
    })


    // 3. tipo_servico
    await knex.schema.createTable('tipo_servico', (table) => {
        table.increments('tipo_id').primary()
        table.string('tipo_nome', 100).notNullable().unique()
        table.text('tipo_desc')
    })


    // 4. servico
    await knex.schema.createTable('servico', (table) => {
        table.increments('serv_id').primary()

        table.integer('cont_id').unsigned().notNullable()
        table.integer('tipo_id').unsigned().notNullable()

        table.string('serv_titulo', 150).notNullable()
        table.text('serv_desc').notNullable()
        table.decimal('serv_valor', 10, 2).notNullable()
        table.date('serv_data_inicio')
        table.integer('serv_qtd_dias')
        table.integer('serv_vagas').notNullable().defaultTo(1)

        table.enu('serv_status', [
            'aberto',
            'em_andamento',
            'finalizado',
            'cancelado'
        ]).notNullable().defaultTo('aberto')

        table.dateTime('serv_data_criacao')
            .notNullable()
            .defaultTo(knex.fn.now())

        table.dateTime('serv_data_atualizacao')
            .notNullable()
            .defaultTo(knex.fn.now())

        table.foreign('cont_id')
            .references('cont_id')
            .inTable('contratante')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.foreign('tipo_id')
            .references('tipo_id')
            .inTable('tipo_servico')
            .onDelete('RESTRICT')
            .onUpdate('CASCADE')
    })


    // 5. candidatura
    await knex.schema.createTable('candidatura', (table) => {
        table.increments('cand_id').primary()

        table.integer('free_id').unsigned().notNullable()
        table.integer('serv_id').unsigned().notNullable()

        table.enu('cand_status', [
            'pendente',
            'aceita',
            'recusada',
            'cancelada'
        ]).notNullable().defaultTo('pendente')

        table.dateTime('cand_data')
            .notNullable()
            .defaultTo(knex.fn.now())

        table.foreign('free_id')
            .references('free_id')
            .inTable('freelancer')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.foreign('serv_id')
            .references('serv_id')
            .inTable('servico')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.unique(['free_id', 'serv_id'])
    })


    // 6. portfolio
    await knex.schema.createTable('portfolio', (table) => {
        table.increments('port_id').primary()

        table.integer('free_id').unsigned().notNullable()

        table.string('port_titulo', 150).notNullable()
        table.text('port_desc').notNullable()
        table.string('port_link', 255)
        table.string('port_img', 255)

        table.dateTime('port_data_criacao')
            .notNullable()
            .defaultTo(knex.fn.now())

        table.dateTime('port_data_atualizacao')
            .notNullable()
            .defaultTo(knex.fn.now())

        table.foreign('free_id')
            .references('free_id')
            .inTable('freelancer')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')
    })


    // 7. avaliacao
    await knex.schema.createTable('avaliacao', (table) => {
        table.increments('aval_id').primary()

        table.integer('serv_id').unsigned().notNullable()
        table.integer('usu_avaliador').unsigned().notNullable()
        table.integer('usu_avaliado').unsigned().notNullable()

        table.integer('aval_nota').notNullable()
        table.text('aval_comentario')

        table.dateTime('aval_data')
            .notNullable()
            .defaultTo(knex.fn.now())

        table.foreign('serv_id')
            .references('serv_id')
            .inTable('servico')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.foreign('usu_avaliador')
            .references('usu_id')
            .inTable('usuario')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.foreign('usu_avaliado')
            .references('usu_id')
            .inTable('usuario')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.check('`aval_nota` BETWEEN 1 AND 5')

        table.unique(['serv_id', 'usu_avaliador'])
    })


    // 8. insignia
    await knex.schema.createTable('insignia', (table) => {
        table.increments('ins_id').primary()

        table.string('ins_nome', 100).notNullable().unique()
        table.text('ins_desc')
    })


    // 9. freelancer_insignia
    await knex.schema.createTable('freelancer_insignia', (table) => {
        table.integer('free_id').unsigned().notNullable()
        table.integer('ins_id').unsigned().notNullable()

        table.dateTime('freeins_data')
            .notNullable()
            .defaultTo(knex.fn.now())

        table.primary(['free_id', 'ins_id'])

        table.foreign('free_id')
            .references('free_id')
            .inTable('freelancer')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.foreign('ins_id')
            .references('ins_id')
            .inTable('insignia')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')
    })


    // 10. mensagem
    await knex.schema.createTable('mensagem', (table) => {
        table.increments('msg_id').primary()

        table.integer('serv_id').unsigned().notNullable()
        table.integer('usu_remetente').unsigned().notNullable()
        table.integer('usu_destinatario').unsigned().notNullable()

        table.text('msg_texto').notNullable()

        table.dateTime('msg_data')
            .notNullable()
            .defaultTo(knex.fn.now())

        table.boolean('msg_lida')
            .notNullable()
            .defaultTo(false)

        table.foreign('serv_id')
            .references('serv_id')
            .inTable('servico')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.foreign('usu_remetente')
            .references('usu_id')
            .inTable('usuario')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.foreign('usu_destinatario')
            .references('usu_id')
            .inTable('usuario')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')
    })


    // 11. notificacao
    await knex.schema.createTable('notificacao', (table) => {
        table.increments('not_id').primary()

        table.integer('usu_id').unsigned().notNullable()

        table.string('not_titulo', 150).notNullable()
        table.text('not_desc').notNullable()

        table.boolean('not_lida')
            .notNullable()
            .defaultTo(false)

        table.dateTime('not_data')
            .notNullable()
            .defaultTo(knex.fn.now())

        table.foreign('usu_id')
            .references('usu_id')
            .inTable('usuario')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')
    })


    // 12. freelancer_tipo_servico
    await knex.schema.createTable('freelancer_tipo_servico', (table) => {
        table.integer('free_id').unsigned().notNullable()
        table.integer('tipo_id').unsigned().notNullable()

        table.primary(['free_id', 'tipo_id'])

        table.foreign('free_id')
            .references('free_id')
            .inTable('freelancer')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')

        table.foreign('tipo_id')
            .references('tipo_id')
            .inTable('tipo_servico')
            .onDelete('CASCADE')
            .onUpdate('CASCADE')
    })
}


export async function down(knex) {

    await knex.schema.dropTableIfExists('freelancer_tipo_servico')
    await knex.schema.dropTableIfExists('notificacao')
    await knex.schema.dropTableIfExists('mensagem')
    await knex.schema.dropTableIfExists('freelancer_insignia')
    await knex.schema.dropTableIfExists('insignia')
    await knex.schema.dropTableIfExists('avaliacao')
    await knex.schema.dropTableIfExists('portfolio')
    await knex.schema.dropTableIfExists('candidatura')
    await knex.schema.dropTableIfExists('servico')
    await knex.schema.dropTableIfExists('tipo_servico')
    await knex.schema.dropTableIfExists('contratante')
    await knex.schema.dropTableIfExists('freelancer')
}