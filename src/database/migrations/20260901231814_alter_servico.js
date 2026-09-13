/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    const hasTipoValor = await knex.schema.hasColumn('servico', 'serv_tipo_valor')
    const hasLocal = await knex.schema.hasColumn('servico', 'serv_local')
    const hasCidade = await knex.schema.hasColumn('servico', 'serv_cidade')
    const hasEstado = await knex.schema.hasColumn('servico', 'serv_estado')
    const hasHabilidades = await knex.schema.hasColumn('servico', 'serv_habilidades')
    const hasFormaPagamento = await knex.schema.hasColumn('servico', 'serv_forma_pagamento')

    await knex.schema.alterTable('servico', (table) => {
        if (!hasTipoValor) {
            table
                .enu('serv_tipo_valor', ['hora', 'fixo'])
                .notNullable()
                .defaultTo('fixo')
                .after('serv_valor')
        }

        if (!hasLocal) {
            table
                .enu('serv_local', ['remoto', 'hibrido', 'presencial'])
                .notNullable()
                .defaultTo('remoto')
                .after('serv_qtd_dias')
        }

        if (!hasCidade) {
            table
                .string('serv_cidade', 100)
                .nullable()
                .after('serv_local')
        }

        if (!hasEstado) {
            table
                .string('serv_estado', 2)
                .nullable()
                .after('serv_cidade')
        }

        if (!hasHabilidades) {
            table
                .text('serv_habilidades')
                .nullable()
                .after('serv_estado')
        }

        if (!hasFormaPagamento) {
            table
                .string('serv_forma_pagamento', 255)
                .nullable()
                .after('serv_habilidades')
        }

        table
            .enu('serv_status', [
                'rascunho',
                'aberto',
                'em_andamento',
                'finalizado',
                'cancelado'
            ])
            .notNullable()
            .defaultTo('rascunho')
            .alter()
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.alterTable('servico', (table) => {
        table.dropColumn('serv_tipo_valor')
        table.dropColumn('serv_local')
        table.dropColumn('serv_cidade')
        table.dropColumn('serv_estado')
        table.dropColumn('serv_habilidades')
        table.dropColumn('serv_forma_pagamento')

        table
            .enu('serv_status', [
                'aberto',
                'em_andamento',
                'finalizado',
                'cancelado'
            ])
            .notNullable()
            .defaultTo('aberto')
            .alter()
    })
}