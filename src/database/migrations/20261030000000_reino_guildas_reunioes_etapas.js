/*
 * Rodada do reino: pagamento por etapa, bônus, reuniões e alerta de contato no chat,
 * freelancers favoritos, testes de habilidade, guildas, mascote e visitas ao perfil.
 */
const TIPOS_MOV_ANTES = ['credito', 'garantia', 'recebido', 'estorno']
const TIPOS_MOV = [...TIPOS_MOV_ANTES, 'etapa', 'bonus']

const enumSql = (tipos) => `ENUM(${tipos.map((t) => `'${t}'`).join(',')})`

export async function up(knex) {
    /* Etapa paga: parte da garantia liberada quando o contratante aprova a etapa */
    if (!(await knex.schema.hasColumn('servico_etapa', 'eta_liberado_valor'))) {
        await knex.schema.alterTable('servico_etapa', (table) => {
            table.decimal('eta_liberado_valor', 10, 2).nullable()
            table.dateTime('eta_liberada_em').nullable()
        })
    }

    /* Bônus (simulado) mandado junto com o fim do projeto */
    if (!(await knex.schema.hasColumn('servico', 'serv_bonus_valor'))) {
        await knex.schema.alterTable('servico', (table) => {
            table.decimal('serv_bonus_valor', 10, 2).nullable()
            table.dateTime('serv_bonus_em').nullable()
            table.string('serv_bonus_recado', 200).nullable()
        })
    }

    /* Movimentos novos na carteira (o enum do MySQL precisa ser trocado inteiro) */
    if ((await knex.schema.hasTable('carteira_mov')) && knex.client.config.client?.includes('mysql')) {
        await knex.raw(`ALTER TABLE carteira_mov MODIFY mov_tipo ${enumSql(TIPOS_MOV)} NOT NULL`)
    }

    /* Reunião marcada pelo chat e mensagem com contato de fora */
    if (!(await knex.schema.hasColumn('mensagem', 'msg_reuniao_em'))) {
        await knex.schema.alterTable('mensagem', (table) => {
            table.dateTime('msg_reuniao_em').nullable()
            table.string('msg_reuniao_link', 300).nullable()
            table.enu('msg_reuniao_status', ['pendente', 'aceita', 'recusada', 'cancelada']).nullable()
            table.dateTime('msg_reuniao_lembrete_em').nullable()
            table.boolean('msg_alerta_contato').notNullable().defaultTo(false)
        })
    }

    /* Freelancers que o contratante guardou */
    if (!(await knex.schema.hasTable('freelancer_favorito'))) {
        await knex.schema.createTable('freelancer_favorito', (table) => {
            table.integer('usu_id').unsigned().notNullable()
            table.integer('fav_usu_id').unsigned().notNullable()
            table.dateTime('fav_data').notNullable().defaultTo(knex.fn.now())
            table.primary(['usu_id', 'fav_usu_id'])
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
            table.foreign('fav_usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Testes de habilidade: a última tentativa de cada área e quando passou */
    if (!(await knex.schema.hasTable('teste_habilidade'))) {
        await knex.schema.createTable('teste_habilidade', (table) => {
            table.integer('usu_id').unsigned().notNullable()
            table.integer('tipo_id').unsigned().notNullable()
            table.integer('tes_acertos').notNullable()
            table.integer('tes_total').notNullable()
            table.dateTime('tes_ultima_em').notNullable().defaultTo(knex.fn.now())
            table.dateTime('tes_aprovado_em').nullable()
            table.primary(['usu_id', 'tipo_id'])
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
            table.foreign('tipo_id').references('tipo_id').inTable('tipo_servico').onDelete('CASCADE')
        })
    }

    /* Guildas de freelancers */
    if (!(await knex.schema.hasTable('guilda'))) {
        await knex.schema.createTable('guilda', (table) => {
            table.increments('gui_id').primary()
            table.string('gui_nome', 30).notNullable().unique()
            table.string('gui_lema', 120).nullable()
            table.string('gui_brasao', 20).notNullable().defaultTo('escudo')
            table.string('gui_cor', 20).notNullable().defaultTo('ouro')
            table.integer('gui_dono').unsigned().notNullable()
            table.dateTime('gui_criada').notNullable().defaultTo(knex.fn.now())
            table.foreign('gui_dono').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    if (!(await knex.schema.hasTable('guilda_membro'))) {
        await knex.schema.createTable('guilda_membro', (table) => {
            table.integer('gui_id').unsigned().notNullable()
            /* Uma guilda por pessoa */
            table.integer('usu_id').unsigned().notNullable().primary()
            table.enu('gme_papel', ['lider', 'membro']).notNullable().defaultTo('membro')
            table.dateTime('gme_entrou').notNullable().defaultTo(knex.fn.now())
            table.foreign('gui_id').references('gui_id').inTable('guilda').onDelete('CASCADE')
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }

    /* Candidatura em nome da guilda */
    if (!(await knex.schema.hasColumn('candidatura', 'cand_gui_id'))) {
        await knex.schema.alterTable('candidatura', (table) => {
            table.integer('cand_gui_id').unsigned().nullable()
        })
    }

    /* Mascote do castelo */
    if (!(await knex.schema.hasColumn('usuario', 'usu_mascote'))) {
        await knex.schema.alterTable('usuario', (table) => {
            table.string('usu_mascote', 20).nullable()
            table.string('usu_mascote_nome', 20).nullable()
        })
    }

    /* Visitas ao perfil: uma por visitante por dia (a chave é um resumo, não guarda IP) */
    if (!(await knex.schema.hasTable('perfil_visita'))) {
        await knex.schema.createTable('perfil_visita', (table) => {
            table.integer('usu_id').unsigned().notNullable()
            table.date('vis_dia').notNullable()
            table.string('vis_chave', 64).notNullable()
            table.string('vis_origem', 12).notNullable()
            table.primary(['usu_id', 'vis_dia', 'vis_chave'])
            table.foreign('usu_id').references('usu_id').inTable('usuario').onDelete('CASCADE')
        })
    }
}

/* Desfaz */
export async function down(knex) {
    for (const tabela of ['perfil_visita', 'guilda_membro', 'guilda', 'teste_habilidade', 'freelancer_favorito']) {
        await knex.schema.dropTableIfExists(tabela)
    }

    const colunas = [
        ['usuario', ['usu_mascote', 'usu_mascote_nome']],
        ['candidatura', ['cand_gui_id']],
        ['mensagem', ['msg_reuniao_em', 'msg_reuniao_link', 'msg_reuniao_status', 'msg_reuniao_lembrete_em', 'msg_alerta_contato']],
        ['servico', ['serv_bonus_valor', 'serv_bonus_em', 'serv_bonus_recado']],
        ['servico_etapa', ['eta_liberado_valor', 'eta_liberada_em']]
    ]
    for (const [tabela, lista] of colunas) {
        if (await knex.schema.hasColumn(tabela, lista[0])) {
            await knex.schema.alterTable(tabela, (table) => {
                for (const c of lista) table.dropColumn(c)
            })
        }
    }

    if ((await knex.schema.hasTable('carteira_mov')) && knex.client.config.client?.includes('mysql')) {
        await knex('carteira_mov').whereIn('mov_tipo', ['etapa', 'bonus']).update({ mov_tipo: 'recebido' })
        await knex.raw(`ALTER TABLE carteira_mov MODIFY mov_tipo ${enumSql(TIPOS_MOV_ANTES)} NOT NULL`)
    }
}
