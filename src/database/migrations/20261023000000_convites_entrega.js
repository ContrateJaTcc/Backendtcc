/* Convites, entrega e novas insígnias */
const NOVAS_INSIGNIAS = [
    ['primeira_entrega', 'Mão na Massa', 'Marcou a entrega de um trabalho na plataforma.'],
    ['requisitado', 'Requisitado', 'Recebeu 3 convites de contratantes.'],
    ['pontual', 'Pontual', 'Entregou 3 trabalhos antes de o contratante finalizar.']
]

export async function up(knex) {
    /* Entrega */
    const temEntrega = await knex.schema.hasColumn('servico', 'serv_entregue_em')

    if (!temEntrega) {
        await knex.schema.alterTable('servico', (table) => {
            table.dateTime('serv_entregue_em').nullable()
            table.string('serv_entrega_nota', 280).nullable()
        })
    }

    /* Convite */
    const temConvite = await knex.schema.hasTable('convite')

    if (!temConvite) {
        await knex.schema.createTable('convite', (table) => {
            table.increments('conv_id').primary()

            table.integer('serv_id').unsigned().notNullable()
            table.integer('free_id').unsigned().notNullable()

            table.string('conv_mensagem', 280).nullable()

            table.enu('conv_status', ['pendente', 'aceito', 'recusado'])
                .notNullable()
                .defaultTo('pendente')

            table.dateTime('conv_data').notNullable().defaultTo(knex.fn.now())

            table.foreign('serv_id')
                .references('serv_id')
                .inTable('servico')
                .onDelete('CASCADE')
                .onUpdate('CASCADE')

            table.foreign('free_id')
                .references('free_id')
                .inTable('freelancer')
                .onDelete('CASCADE')
                .onUpdate('CASCADE')

            table.unique(['serv_id', 'free_id'])
        })
    }

    /* Insígnias */
    for (const [codigo, nome, desc] of NOVAS_INSIGNIAS) {
        const existente = await knex('insignia').where('ins_codigo', codigo).first()

        if (!existente) {
            await knex('insignia').insert({ ins_codigo: codigo, ins_nome: nome, ins_desc: desc })
        }
    }
}

/* Desfaz */
export async function down(knex) {
    await knex('insignia').whereIn('ins_codigo', NOVAS_INSIGNIAS.map(([codigo]) => codigo)).del()
    await knex.schema.dropTableIfExists('convite')

    const temEntrega = await knex.schema.hasColumn('servico', 'serv_entregue_em')

    if (temEntrega) {
        await knex.schema.alterTable('servico', (table) => {
            table.dropColumn('serv_entregue_em')
            table.dropColumn('serv_entrega_nota')
        })
    }
}
