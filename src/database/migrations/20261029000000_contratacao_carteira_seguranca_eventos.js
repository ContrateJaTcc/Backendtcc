/*
 * Rodada grande: termo de acordo, garantia (pagamento simulado), ajustes na entrega, disputas,
 * proposta no chat, "visto/digitando", disponibilidade, verificação em 2 etapas, sessões,
 * resumo por e-mail, sequência de dias, loja de cosméticos, eventos sazonais e portfólio a partir do projeto.
 */
export async function up(knex) {
    /* Termo de acordo, garantia e ajustes, tudo preso ao projeto */
    if (!(await knex.schema.hasColumn('servico', 'serv_acordo_cont_em'))) {
        await knex.schema.alterTable('servico', (table) => {
            table.dateTime('serv_acordo_cont_em').nullable()
            table.dateTime('serv_acordo_free_em').nullable()
            table.decimal('serv_garantia_valor', 10, 2).nullable()
            table.dateTime('serv_garantia_em').nullable()
            table.dateTime('serv_garantia_liberada_em').nullable()
            table.dateTime('serv_garantia_estornada_em').nullable()
            table.integer('serv_revisoes').notNullable().defaultTo(0)
            table.string('serv_revisao_nota', 500).nullable()
        })
    }

    /* Proposta de valor/prazo dentro da conversa */
    if (!(await knex.schema.hasColumn('mensagem', 'msg_proposta_valor'))) {
        await knex.schema.alterTable('mensagem', (table) => {
            table.decimal('msg_proposta_valor', 10, 2).nullable()
            table.integer('msg_proposta_prazo').nullable()
            table.enu('msg_proposta_status', ['pendente', 'aceita', 'recusada']).nullable()
        })
    }

    /* "Digitando..." (até quando vale o aviso) */
    if (!(await knex.schema.hasTable('chat_digitando'))) {
        await knex.schema.createTable('chat_digitando', (table) => {
            table.integer('serv_id').unsigned().notNullable()
            table.integer('usu_id').unsigned().notNullable()
            table.integer('outro_id').unsigned().notNullable()
            table.dateTime('dig_ate').notNullable()
            table.primary(['serv_id', 'usu_id', 'outro_id'])
            table.foreign('serv_id').references('serv_id').inTable('servico').onDelete('CASCADE')
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Carteira fictícia: cada linha é um movimento (o saldo é a soma) */
    if (!(await knex.schema.hasTable('carteira_mov'))) {
        await knex.schema.createTable('carteira_mov', (table) => {
            table.increments('mov_id').primary()
            table.integer('usu_id').unsigned().notNullable()
            table.integer('serv_id').unsigned().nullable()
            table.enu('mov_tipo', ['credito', 'garantia', 'recebido', 'estorno']).notNullable()
            table.decimal('mov_valor', 10, 2).notNullable()
            table.string('mov_desc', 160).nullable()
            table.dateTime('mov_data').notNullable().defaultTo(knex.fn.now())
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
            table.foreign('serv_id').references('serv_id').inTable('servico').onDelete('SET NULL')
        })
    }

    /* Disputas: quando contratante e freelancer não chegam a um acordo */
    if (!(await knex.schema.hasTable('disputa'))) {
        await knex.schema.createTable('disputa', (table) => {
            table.increments('dis_id').primary()
            table.integer('serv_id').unsigned().notNullable()
            table.integer('usu_id').unsigned().notNullable()
            table.string('dis_motivo', 30).notNullable()
            table.string('dis_detalhe', 1000).nullable()
            table.enu('dis_status', ['aberta', 'resolvida']).notNullable().defaultTo('aberta')
            table.string('dis_decisao', 20).nullable()
            table.string('dis_resposta', 500).nullable()
            table.dateTime('dis_data').notNullable().defaultTo(knex.fn.now())
            table.dateTime('dis_resolvida_em').nullable()
            table.foreign('serv_id').references('serv_id').inTable('servico').onDelete('CASCADE')
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Conta: disponibilidade, segurança, e-mail semanal e cosméticos equipados */
    if (!(await knex.schema.hasColumn('usuario', 'usu_disponibilidade'))) {
        await knex.schema.alterTable('usuario', (table) => {
            table.string('usu_disponibilidade', 12).notNullable().defaultTo('disponivel')
            table.date('usu_disponivel_ate').nullable()
            table.boolean('usu_2fa').notNullable().defaultTo(false)
            table.dateTime('usu_sessoes_desde').nullable()
            table.boolean('usu_resumo_email').notNullable().defaultTo(true)
            table.dateTime('usu_resumo_enviado_em').nullable()
            table.string('usu_moldura', 20).nullable()
            table.string('usu_cor_nome', 20).nullable()
            table.string('usu_tema_cenario', 20).nullable()
        })
    }

    /* Item do portfólio que veio de um projeto concluído (para não repetir) */
    if (!(await knex.schema.hasColumn('portfolio', 'port_serv_id'))) {
        await knex.schema.alterTable('portfolio', (table) => {
            table.integer('port_serv_id').unsigned().nullable()
        })
    }

    /* Sessões abertas (cada login vira uma; dá para encerrar à distância) */
    if (!(await knex.schema.hasTable('sessao'))) {
        await knex.schema.createTable('sessao', (table) => {
            table.string('ses_id', 36).primary()
            table.integer('usu_id').unsigned().notNullable()
            table.string('ses_agente', 200).nullable()
            table.string('ses_ip', 60).nullable()
            table.dateTime('ses_criada').notNullable().defaultTo(knex.fn.now())
            table.dateTime('ses_ultimo_uso').notNullable().defaultTo(knex.fn.now())
            table.boolean('ses_revogada').notNullable().defaultTo(false)
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Dias em que a pessoa entrou (sequência) */
    if (!(await knex.schema.hasTable('atividade_dia'))) {
        await knex.schema.createTable('atividade_dia', (table) => {
            table.integer('usu_id').unsigned().notNullable()
            table.date('dia').notNullable()
            table.primary(['usu_id', 'dia'])
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Cosméticos comprados com XP (o nível não cai: o XP gasto fica à parte) */
    if (!(await knex.schema.hasTable('cosmetico_compra'))) {
        await knex.schema.createTable('cosmetico_compra', (table) => {
            table.integer('usu_id').unsigned().notNullable()
            table.string('cos_codigo', 30).notNullable()
            table.integer('cos_preco').notNullable()
            table.dateTime('cos_data').notNullable().defaultTo(knex.fn.now())
            table.primary(['usu_id', 'cos_codigo'])
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Eventos sazonais: o que cada um coletou em cada ano */
    if (!(await knex.schema.hasTable('evento_coleta'))) {
        await knex.schema.createTable('evento_coleta', (table) => {
            table.integer('usu_id').unsigned().notNullable()
            table.string('evt_codigo', 20).notNullable()
            table.integer('evt_ano').notNullable()
            table.integer('evc_qtd').notNullable().defaultTo(0)
            table.string('evc_achados', 200).nullable()
            table.dateTime('evc_completo_em').nullable()
            table.boolean('evc_resgatado').notNullable().defaultTo(false)
            table.primary(['usu_id', 'evt_codigo', 'evt_ano'])
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }
}

/* Desfaz */
export async function down(knex) {
    for (const tabela of ['evento_coleta', 'cosmetico_compra', 'atividade_dia', 'sessao', 'disputa', 'carteira_mov', 'chat_digitando']) {
        await knex.schema.dropTableIfExists(tabela)
    }

    if (await knex.schema.hasColumn('portfolio', 'port_serv_id')) {
        await knex.schema.alterTable('portfolio', (table) => table.dropColumn('port_serv_id'))
    }

    if (await knex.schema.hasColumn('usuario', 'usu_disponibilidade')) {
        await knex.schema.alterTable('usuario', (table) => {
            for (const c of ['usu_disponibilidade', 'usu_disponivel_ate', 'usu_2fa', 'usu_sessoes_desde', 'usu_resumo_email', 'usu_resumo_enviado_em', 'usu_moldura', 'usu_cor_nome', 'usu_tema_cenario']) {
                table.dropColumn(c)
            }
        })
    }

    if (await knex.schema.hasColumn('mensagem', 'msg_proposta_valor')) {
        await knex.schema.alterTable('mensagem', (table) => {
            table.dropColumn('msg_proposta_valor')
            table.dropColumn('msg_proposta_prazo')
            table.dropColumn('msg_proposta_status')
        })
    }

    if (await knex.schema.hasColumn('servico', 'serv_acordo_cont_em')) {
        await knex.schema.alterTable('servico', (table) => {
            for (const c of ['serv_acordo_cont_em', 'serv_acordo_free_em', 'serv_garantia_valor', 'serv_garantia_em', 'serv_garantia_liberada_em', 'serv_garantia_estornada_em', 'serv_revisoes', 'serv_revisao_nota']) {
                table.dropColumn(c)
            }
        })
    }
}
