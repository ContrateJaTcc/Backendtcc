
/* Contas sem papel */
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

/* Desfaz */
export async function down() {}
