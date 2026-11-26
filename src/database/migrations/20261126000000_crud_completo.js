/*
 * CRUD completo: colunas para desativar categoria, editar/apagar mensagem e editar avaliação.
 * Só acrescenta colunas (o código confere com temColuna antes de usar, então nada quebra antes de rodar).
 */
const COLUNAS = {
    /* Categoria com projetos não pode ser apagada: a administração desativa */
    tipo_servico: [['tipo_ativo', (t) => t.boolean('tipo_ativo').notNullable().defaultTo(true)]],
    /* Mensagem editada ou apagada (fica como "Mensagem apagada" na conversa) */
    mensagem: [
        ['msg_editada_em', (t) => t.dateTime('msg_editada_em').nullable()],
        ['msg_apagada_em', (t) => t.dateTime('msg_apagada_em').nullable()]
    ],
    /* Avaliação corrigida enquanto estava às cegas */
    avaliacao: [['aval_editada_em', (t) => t.dateTime('aval_editada_em').nullable()]]
}

export async function up(knex) {
    for (const [tabela, colunas] of Object.entries(COLUNAS)) {
        if (!(await knex.schema.hasTable(tabela))) continue
        for (const [coluna, criar] of colunas) {
            if (!(await knex.schema.hasColumn(tabela, coluna))) await knex.schema.alterTable(tabela, criar)
        }
    }
}

export async function down(knex) {
    for (const [tabela, colunas] of Object.entries(COLUNAS)) {
        if (!(await knex.schema.hasTable(tabela))) continue
        for (const [coluna] of colunas) {
            if (await knex.schema.hasColumn(tabela, coluna)) await knex.schema.alterTable(tabela, (t) => t.dropColumn(coluna))
        }
    }
}
