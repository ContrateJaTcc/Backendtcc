/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

/*
 * Liga as tabelas de gamificacao que ja existiam desde o inicio, mas que
 * nenhum codigo usava (insignia, freelancer_insignia, avaliacao).
 *
 * 1. insignia ganha ins_codigo: as regras de conquista ficam no codigo
 *    (src/services/gamificacao.js) e precisam de um identificador estavel —
 *    o nome e texto de exibicao e pode mudar.
 * 2. O catalogo de insignias e inserido aqui.
 * 3. avaliacao: a chave unica era (serv_id, usu_avaliador), o que impedia o
 *    contratante de avaliar mais de um freelancer no mesmo projeto (vagas > 1).
 *    Passa a ser (serv_id, usu_avaliador, usu_avaliado).
 */
const CATALOGO = [
    ['primeiro_projeto', 'Primeiro Projeto', 'Concluiu o primeiro projeto na plataforma.'],
    ['em_ascensao', 'Em Ascensão', 'Concluiu 5 projetos.'],
    ['veterano', 'Veterano', 'Concluiu 10 projetos.'],
    ['nota_maxima', 'Nota Máxima', 'Recebeu uma avaliação 5 estrelas.'],
    ['favorito', 'Favorito dos Clientes', 'Média de 4,8 ou mais com pelo menos 5 avaliações.'],
    ['vitrine', 'Vitrine Completa', 'Publicou 3 trabalhos no portfólio.'],
    ['perfil_completo', 'Perfil Completo', 'Tem foto, descrição e áreas de atuação no perfil.'],
    ['nivel_5', 'Nível 5', 'Alcançou o nível 5.']
]

export async function up(knex) {
    const temCodigo = await knex.schema.hasColumn('insignia', 'ins_codigo')

    if (!temCodigo) {
        await knex.schema.alterTable('insignia', (table) => {
            table.string('ins_codigo', 50).nullable().unique().after('ins_id')
        })
    }

    for (const [codigo, nome, desc] of CATALOGO) {
        const existente = await knex('insignia').where('ins_codigo', codigo).first()

        if (!existente) {
            await knex('insignia').insert({ ins_codigo: codigo, ins_nome: nome, ins_desc: desc })
        }
    }

    /* A unica nova e criada antes de remover a antiga: a foreign key de
       serv_id precisa de algum indice comecando por serv_id o tempo todo. */
    const [indices] = await knex.raw("SHOW INDEX FROM avaliacao WHERE Key_name = 'avaliacao_serv_id_usu_avaliador_usu_avaliado_unique'")

    if (indices.length === 0) {
        await knex.schema.alterTable('avaliacao', (table) => {
            table.unique(['serv_id', 'usu_avaliador', 'usu_avaliado'])
        })
    }

    const [antigos] = await knex.raw("SHOW INDEX FROM avaliacao WHERE Key_name = 'avaliacao_serv_id_usu_avaliador_unique'")

    if (antigos.length > 0) {
        await knex.schema.alterTable('avaliacao', (table) => {
            table.dropUnique(['serv_id', 'usu_avaliador'])
        })
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('avaliacao', (table) => {
        table.unique(['serv_id', 'usu_avaliador'])
    })

    await knex.schema.alterTable('avaliacao', (table) => {
        table.dropUnique(['serv_id', 'usu_avaliador', 'usu_avaliado'])
    })

    await knex('insignia').whereIn('ins_codigo', CATALOGO.map(([codigo]) => codigo)).del()

    await knex.schema.alterTable('insignia', (table) => {
        table.dropColumn('ins_codigo')
    })
}
