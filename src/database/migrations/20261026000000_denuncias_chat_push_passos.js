/* Denúncias, imagem no chat, notificações no celular (push) e primeiros passos do freelancer */
export async function up(knex) {
    /* Denúncia de projeto ou perfil, para a fila dos admins */
    if (!(await knex.schema.hasTable('denuncia'))) {
        await knex.schema.createTable('denuncia', (table) => {
            table.increments('den_id').primary()
            /* Quem denunciou */
            table.integer('usu_id').unsigned().notNullable()
            table.enu('den_alvo_tipo', ['servico', 'usuario']).notNullable()
            table.integer('den_alvo_id').unsigned().notNullable()
            table.string('den_motivo', 40).notNullable()
            table.string('den_detalhe', 500).nullable()
            table.enu('den_status', ['aberta', 'resolvida', 'descartada']).notNullable().defaultTo('aberta')
            table.dateTime('den_data').notNullable().defaultTo(knex.fn.now())
            table.integer('den_resolvida_por').unsigned().nullable()
            table.dateTime('den_resolvida_em').nullable()
            /* Cada pessoa denuncia a mesma coisa uma vez só */
            table.unique(['usu_id', 'den_alvo_tipo', 'den_alvo_id'])
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Imagem na mensagem (data URI comprimida no navegador) */
    if (!(await knex.schema.hasColumn('mensagem', 'msg_imagem'))) {
        await knex.schema.alterTable('mensagem', (table) => {
            table.specificType('msg_imagem', 'MEDIUMTEXT').nullable()
        })
    }

    /* Aparelhos que aceitaram notificação (Web Push) */
    if (!(await knex.schema.hasTable('push_inscricao'))) {
        await knex.schema.createTable('push_inscricao', (table) => {
            table.increments('pus_id').primary()
            table.integer('usu_id').unsigned().notNullable()
            table.string('pus_endpoint', 600).notNullable().unique()
            table.string('pus_p256dh', 200).notNullable()
            table.string('pus_auth', 100).notNullable()
            table.dateTime('pus_data').notNullable().defaultTo(knex.fn.now())
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Primeiros passos resgatados (cada um dá XP uma vez) */
    if (!(await knex.schema.hasTable('passo_resgate'))) {
        await knex.schema.createTable('passo_resgate', (table) => {
            table.increments('pas_id').primary()
            table.integer('free_id').unsigned().notNullable()
            table.string('pas_codigo', 40).notNullable()
            table.dateTime('pas_data').notNullable().defaultTo(knex.fn.now())
            table.unique(['free_id', 'pas_codigo'])
            table.foreign('free_id').references('free_id').inTable('freelancer').onDelete('CASCADE')
        })
    }
}

/* Desfaz */
export async function down(knex) {
    await knex.schema.dropTableIfExists('passo_resgate')
    await knex.schema.dropTableIfExists('push_inscricao')
    await knex.schema.dropTableIfExists('denuncia')

    if (await knex.schema.hasColumn('mensagem', 'msg_imagem')) {
        await knex.schema.alterTable('mensagem', (table) => table.dropColumn('msg_imagem'))
    }
}
