/*
 * Agenda, modelos de recado, pausa do prazo, "visto por último", avisos por tipo, convite de amigos,
 * filtro de spam nos projetos e monitor de erros.
 */
const COLUNAS_USUARIO = [
    /* Última vez que a pessoa usou o site (atualiza no máximo a cada 2 minutos) */
    ['usu_visto_em', (t) => t.dateTime('usu_visto_em').nullable()],
    ['usu_mostrar_online', (t) => t.boolean('usu_mostrar_online').notNullable().defaultTo(true)],
    /* Some da busca de freelancers e do mapa, sem apagar a conta */
    ['usu_aparecer_busca', (t) => t.boolean('usu_aparecer_busca').notNullable().defaultTo(true)],
    /* {"sino":{"mensagens":false},"celular":{...}}: só o que foi desligado */
    ['usu_avisos', (t) => t.text('usu_avisos').nullable()],
    /* Convide um amigo (indicação): código próprio, quem indicou e se o prêmio já saiu */
    ['usu_indicacao_codigo', (t) => t.string('usu_indicacao_codigo', 12).nullable().unique()],
    ['usu_indicado_por', (t) => t.integer('usu_indicado_por').unsigned().nullable()],
    ['usu_indicacao_premiada', (t) => t.boolean('usu_indicacao_premiada').notNullable().defaultTo(false)]
]

const COLUNAS_SERVICO = [
    /* Pausa do prazo: pedida por uma parte, aceita pela outra; os dias parados somam no prazo ao retomar */
    ['serv_pausa_pedida_por', (t) => t.integer('serv_pausa_pedida_por').unsigned().nullable()],
    ['serv_pausa_motivo', (t) => t.string('serv_pausa_motivo', 200).nullable()],
    ['serv_pausado_em', (t) => t.dateTime('serv_pausado_em').nullable()],
    ['serv_pausa_dias', (t) => t.integer('serv_pausa_dias').notNullable().defaultTo(0)],
    /* Filtro de spam: null = normal; "pendente" = esperando a administração; "aprovado"; "recusado" */
    ['serv_moderacao', (t) => t.string('serv_moderacao', 10).nullable()],
    ['serv_moderacao_motivo', (t) => t.string('serv_moderacao_motivo', 200).nullable()]
]

export async function up(knex) {
    for (const [coluna, criar] of COLUNAS_USUARIO) {
        if (!(await knex.schema.hasColumn('usuario', coluna))) await knex.schema.alterTable('usuario', criar)
    }
    for (const [coluna, criar] of COLUNAS_SERVICO) {
        if (!(await knex.schema.hasColumn('servico', coluna))) await knex.schema.alterTable('servico', criar)
    }

    /* Cartas de candidatura salvas */
    if (!(await knex.schema.hasTable('modelo_recado'))) {
        await knex.schema.createTable('modelo_recado', (table) => {
            table.increments('mod_id').primary()
            table.integer('usu_id').unsigned().notNullable()
            table.string('mod_titulo', 60).notNullable()
            table.text('mod_texto').notNullable()
            table.dateTime('mod_criado_em').notNullable().defaultTo(knex.fn.now())
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Erros do site e do servidor, agrupados (a mesma mensagem no mesmo lugar soma na contagem) */
    if (!(await knex.schema.hasTable('erro_registro'))) {
        await knex.schema.createTable('erro_registro', (table) => {
            table.increments('err_id').primary()
            table.string('err_chave', 64).notNullable().unique()
            table.enu('err_origem', ['site', 'servidor']).notNullable()
            table.string('err_mensagem', 500).notNullable()
            table.string('err_local', 300).nullable()
            table.integer('err_total').notNullable().defaultTo(1)
            table.dateTime('err_primeira').notNullable().defaultTo(knex.fn.now())
            table.dateTime('err_ultima').notNullable().defaultTo(knex.fn.now())
        })
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('erro_registro')
    await knex.schema.dropTableIfExists('modelo_recado')
    for (const [tabela, colunas] of [['servico', COLUNAS_SERVICO], ['usuario', COLUNAS_USUARIO]]) {
        for (const [coluna] of colunas) {
            if (await knex.schema.hasColumn(tabela, coluna)) await knex.schema.alterTable(tabela, (t) => t.dropColumn(coluna))
        }
    }
}
