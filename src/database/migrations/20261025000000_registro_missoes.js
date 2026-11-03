/* Registro de ações dos admins, código de login do supremo, missões da semana e histórico de XP */
export async function up(knex) {
    /* Quem fez o quê e quando (painel do supremo) */
    if (!(await knex.schema.hasTable('admin_registro'))) {
        await knex.schema.createTable('admin_registro', (table) => {
            table.increments('reg_id').primary()
            /* Quem fez (null se a conta já foi excluída) */
            table.integer('usu_id').unsigned().nullable()
            table.string('usu_nome', 150).notNullable()
            /* Sobre quem (conta afetada), quando houver */
            table.integer('alvo_usu_id').unsigned().nullable()
            table.string('alvo_nome', 150).nullable()
            table.string('reg_acao', 40).notNullable()
            table.string('reg_detalhe', 500).nullable()
            table.dateTime('reg_data').notNullable().defaultTo(knex.fn.now())
            table.index(['reg_data'])
        })
    }

    /* Código de 6 dígitos mandado por e-mail no login do supremo */
    if (!(await knex.schema.hasTable('codigo_login'))) {
        await knex.schema.createTable('codigo_login', (table) => {
            table.increments('cod_id').primary()
            table.integer('usu_id').unsigned().notNullable()
            table.string('cod_hash', 64).notNullable()
            table.dateTime('cod_expira').notNullable()
            table.integer('cod_tentativas').notNullable().defaultTo(0)
            table.boolean('cod_usado').notNullable().defaultTo(false)
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Missões resgatadas (uma vez por semana cada) */
    if (!(await knex.schema.hasTable('missao_resgate'))) {
        await knex.schema.createTable('missao_resgate', (table) => {
            table.increments('mis_id').primary()
            table.integer('free_id').unsigned().notNullable()
            table.string('mis_codigo', 40).notNullable()
            /* Segunda-feira da semana, ex.: 2026-10-19 */
            table.date('mis_semana').notNullable()
            table.integer('mis_xp').notNullable()
            table.dateTime('mis_data').notNullable().defaultTo(knex.fn.now())
            table.unique(['free_id', 'mis_codigo', 'mis_semana'])
            table.foreign('free_id').references('free_id').inTable('freelancer').onDelete('CASCADE')
        })
    }

    /* Todo XP ganho, com data: é daqui que sai o ranking do mês */
    if (!(await knex.schema.hasTable('xp_evento'))) {
        await knex.schema.createTable('xp_evento', (table) => {
            table.increments('xpe_id').primary()
            table.integer('free_id').unsigned().notNullable()
            table.integer('xpe_xp').notNullable()
            table.string('xpe_motivo', 60).notNullable()
            table.dateTime('xpe_data').notNullable().defaultTo(knex.fn.now())
            table.index(['xpe_data'])
            table.foreign('free_id').references('free_id').inTable('freelancer').onDelete('CASCADE')
        })
    }
}

/* Desfaz */
export async function down(knex) {
    for (const tabela of ['xp_evento', 'missao_resgate', 'codigo_login', 'admin_registro']) {
        await knex.schema.dropTableIfExists(tabela)
    }
}
