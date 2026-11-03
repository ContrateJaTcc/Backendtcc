
/* Foto no banco */
export async function up(knex) {
    const existe = await knex.schema.hasColumn('usuario', 'usu_foto')

    if (!existe) return

    await knex.schema.alterTable('usuario', (table) => {
        table.text('usu_foto', 'mediumtext').alter()
    })
}

/* Desfaz */
export async function down(knex) {
    const existe = await knex.schema.hasColumn('usuario', 'usu_foto')

    if (!existe) return

    /* Trunca fotos */
    await knex.schema.alterTable('usuario', (table) => {
        table.string('usu_foto', 255).alter()
    })
}
