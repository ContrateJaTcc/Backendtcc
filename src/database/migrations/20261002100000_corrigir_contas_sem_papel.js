/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

/*
 * Contas antigas criadas pelo POST /usuarios (removido depois) ganharam a linha
 * em "usuario", mas nunca a linha em "freelancer" ou "contratante". Essas
 * contas entram no site mas não conseguem se candidatar, publicar projeto,
 * ter portfólio, XP ou insígnias.
 *
 * Cria a linha que falta conforme o tipo_usuario de cada conta. Só insere,
 * nunca altera nem apaga.
 */
export async function up(knex) {
    const freelancersSemLinha = await knex('usuario')
        .leftJoin('freelancer', 'usuario.usu_id', 'freelancer.usu_id')
        .where('usuario.tipo_usuario', 'freelancer')
        .whereNull('freelancer.free_id')
        .select('usuario.usu_id')

    if (freelancersSemLinha.length > 0) {
        await knex('freelancer').insert(freelancersSemLinha.map((u) => ({ usu_id: u.usu_id })))
    }

    const contratantesSemLinha = await knex('usuario')
        .leftJoin('contratante', 'usuario.usu_id', 'contratante.usu_id')
        .where('usuario.tipo_usuario', 'contratante')
        .whereNull('contratante.cont_id')
        .select('usuario.usu_id')

    if (contratantesSemLinha.length > 0) {
        await knex('contratante').insert(contratantesSemLinha.map((u) => ({ usu_id: u.usu_id })))
    }
}

/* Não há como saber quais linhas esta migration criou; desfazer não remove nada. */
export async function down() {}
