/*
 * Rodada das 30 sugestões: e-mail confirmado, horas trabalhadas, avaliação por critério, bloqueio, resposta citando,
 * projeto recorrente, aviso de disponibilidade, chefão do mês, histórico do anúncio, denúncia de mensagem,
 * critérios de aceite, versões da entrega, horários de atendimento, pedido de orçamento, anotações privadas,
 * desafio da semana e trabalho de amostra.
 */
const COLUNAS = {
    usuario: [
        /* Quem já tinha conta conta como confirmado; o cadastro novo começa sem confirmar (quando o e-mail funciona) */
        ['usu_email_confirmado', (t) => t.boolean('usu_email_confirmado').notNullable().defaultTo(true)],
        /* {"dias":[1,2,3,4,5],"de":9,"ate":18}: horários em que o freelancer atende */
        ['usu_horarios', (t) => t.text('usu_horarios').nullable()]
    ],
    avaliacao: [
        ['aval_comunicacao', (t) => t.tinyint('aval_comunicacao').nullable()],
        ['aval_prazo', (t) => t.tinyint('aval_prazo').nullable()],
        ['aval_qualidade', (t) => t.tinyint('aval_qualidade').nullable()]
    ],
    mensagem: [['msg_resposta_id', (t) => t.integer('msg_resposta_id').unsigned().nullable()]],
    servico: [
        /* Projeto recorrente: no dia marcado sai uma cópia nova, já com convite para o mesmo freelancer */
        ['serv_repetir', (t) => t.boolean('serv_repetir').notNullable().defaultTo(false)],
        ['serv_repetir_em', (t) => t.date('serv_repetir_em').nullable()],
        ['serv_repetido_de', (t) => t.integer('serv_repetido_de').unsigned().nullable()],
        /* Trabalho de amostra: tarefa pequena para testar um freelancer (o usu_id dele) */
        ['serv_amostra_de', (t) => t.integer('serv_amostra_de').unsigned().nullable()]
    ]
}

const TABELAS = {
    hora_registro: (t, knex) => {
        t.increments('hor_id').primary()
        t.integer('serv_id').unsigned().notNullable()
        t.integer('usu_id').unsigned().notNullable()
        t.dateTime('hor_inicio').notNullable()
        t.dateTime('hor_fim').nullable()
        t.integer('hor_minutos').nullable()
        t.string('hor_desc', 200).nullable()
        t.enu('hor_status', ['rodando', 'pendente', 'aprovada', 'recusada']).notNullable().defaultTo('pendente')
        t.dateTime('hor_criado_em').notNullable().defaultTo(knex.fn.now())
        t.foreign('serv_id').references('serv_id').inTable('servico').onDelete('CASCADE')
        t.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
    },
    bloqueio: (t, knex) => {
        t.integer('usu_id').unsigned().notNullable()
        t.integer('bloqueado_id').unsigned().notNullable()
        t.dateTime('blo_data').notNullable().defaultTo(knex.fn.now())
        t.primary(['usu_id', 'bloqueado_id'])
        t.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        t.foreign('bloqueado_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
    },
    aviso_disponivel: (t, knex) => {
        t.integer('usu_id').unsigned().notNullable()
        t.integer('free_usu_id').unsigned().notNullable()
        t.dateTime('avi_data').notNullable().defaultTo(knex.fn.now())
        t.primary(['usu_id', 'free_usu_id'])
        t.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        t.foreign('free_usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
    },
    chefao_resgate: (t, knex) => {
        t.integer('usu_id').unsigned().notNullable()
        t.string('che_mes', 7).notNullable()
        t.dateTime('che_data').notNullable().defaultTo(knex.fn.now())
        t.primary(['usu_id', 'che_mes'])
        t.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
    },
    servico_mudanca: (t, knex) => {
        t.increments('mud_id').primary()
        t.integer('serv_id').unsigned().notNullable()
        t.string('mud_campo', 30).notNullable()
        t.string('mud_antes', 300).nullable()
        t.string('mud_depois', 300).nullable()
        t.dateTime('mud_data').notNullable().defaultTo(knex.fn.now())
        t.foreign('serv_id').references('serv_id').inTable('servico').onDelete('CASCADE')
    },
    servico_criterio: (t, knex) => {
        t.increments('cri_id').primary()
        t.integer('serv_id').unsigned().notNullable()
        t.string('cri_texto', 150).notNullable()
        t.integer('cri_ordem').notNullable().defaultTo(0)
        t.dateTime('cri_entregue_em').nullable()
        t.dateTime('cri_aprovado_em').nullable()
        t.dateTime('cri_criado_em').notNullable().defaultTo(knex.fn.now())
        t.foreign('serv_id').references('serv_id').inTable('servico').onDelete('CASCADE')
    },
    entrega_versao: (t, knex) => {
        t.increments('ver_id').primary()
        t.integer('serv_id').unsigned().notNullable()
        t.integer('ver_numero').notNullable()
        t.text('ver_nota').nullable()
        t.string('ver_link', 300).nullable()
        t.dateTime('ver_data').notNullable().defaultTo(knex.fn.now())
        t.foreign('serv_id').references('serv_id').inTable('servico').onDelete('CASCADE')
    },
    orcamento_pedido: (t, knex) => {
        t.increments('orc_id').primary()
        t.integer('usu_id').unsigned().notNullable()
        t.text('orc_pergunta').notNullable()
        t.integer('tipo_id').unsigned().nullable()
        t.boolean('orc_fechado').notNullable().defaultTo(false)
        t.dateTime('orc_data').notNullable().defaultTo(knex.fn.now())
        t.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
    },
    orcamento_resposta: (t) => {
        t.integer('orc_id').unsigned().notNullable()
        t.integer('usu_id').unsigned().notNullable()
        t.decimal('res_valor', 10, 2).nullable()
        t.integer('res_prazo').nullable()
        t.string('res_texto', 500).nullable()
        t.enu('res_status', ['aguardando', 'respondido', 'recusado']).notNullable().defaultTo('aguardando')
        t.dateTime('res_data').nullable()
        t.primary(['orc_id', 'usu_id'])
        t.foreign('orc_id').references('orc_id').inTable('orcamento_pedido').onDelete('CASCADE')
        t.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
    },
    nota_privada: (t, knex) => {
        t.integer('usu_id').unsigned().notNullable()
        t.integer('alvo_id').unsigned().notNullable()
        t.string('not_texto', 1000).notNullable()
        t.dateTime('not_atualizada_em').notNullable().defaultTo(knex.fn.now())
        t.primary(['usu_id', 'alvo_id'])
        t.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        t.foreign('alvo_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
    },
    desafio_envio: (t, knex) => {
        t.increments('env_id').primary()
        t.string('des_semana', 10).notNullable()
        t.integer('usu_id').unsigned().notNullable()
        t.string('env_titulo', 80).notNullable()
        t.string('env_link', 300).notNullable()
        t.string('env_desc', 300).nullable()
        t.dateTime('env_data').notNullable().defaultTo(knex.fn.now())
        t.unique(['des_semana', 'usu_id'])
        t.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
    },
    desafio_voto: (t) => {
        t.integer('env_id').unsigned().notNullable()
        t.integer('usu_id').unsigned().notNullable()
        t.primary(['env_id', 'usu_id'])
        t.foreign('env_id').references('env_id').inTable('desafio_envio').onDelete('CASCADE')
        t.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
    },
    desafio_premio: (t, knex) => {
        t.string('des_semana', 10).primary()
        t.integer('usu_id').unsigned().nullable()
        t.dateTime('pre_data').notNullable().defaultTo(knex.fn.now())
    }
}

export async function up(knex) {
    for (const [tabela, colunas] of Object.entries(COLUNAS)) {
        for (const [coluna, criar] of colunas) {
            if (!(await knex.schema.hasColumn(tabela, coluna))) await knex.schema.alterTable(tabela, criar)
        }
    }
    for (const [tabela, criar] of Object.entries(TABELAS)) {
        if (!(await knex.schema.hasTable(tabela))) await knex.schema.createTable(tabela, (t) => criar(t, knex))
    }
    /* Denúncia de uma mensagem do chat (o alvo é o msg_id) */
    if ((await knex.schema.hasTable('denuncia')) && String(knex.client.config.client ?? '').includes('mysql')) {
        await knex.raw("ALTER TABLE denuncia MODIFY den_alvo_tipo ENUM('servico','usuario','mensagem') NOT NULL")
    }
}

export async function down(knex) {
    for (const tabela of Object.keys(TABELAS).reverse()) await knex.schema.dropTableIfExists(tabela)
    for (const [tabela, colunas] of Object.entries(COLUNAS)) {
        for (const [coluna] of colunas) {
            if (await knex.schema.hasColumn(tabela, coluna)) await knex.schema.alterTable(tabela, (t) => t.dropColumn(coluna))
        }
    }
    if ((await knex.schema.hasTable('denuncia')) && String(knex.client.config.client ?? '').includes('mysql')) {
        await knex.raw("DELETE FROM denuncia WHERE den_alvo_tipo = 'mensagem'")
        await knex.raw("ALTER TABLE denuncia MODIFY den_alvo_tipo ENUM('servico','usuario') NOT NULL")
    }
}
