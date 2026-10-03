/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

/*
 * usu_foto nasceu como varchar(255), tamanho de endereco de imagem.
 * Agora a foto do avatar e enviada pelo proprio usuario e guardada no banco
 * como data URI (base64), entao a coluna precisa comportar o conteudo.
 *
 * O navegador reduz a imagem para 256x256 em JPEG antes de enviar, o que
 * costuma dar uns 20 KB; MEDIUMTEXT da folga de sobra e evita depender de
 * um servico externo de armazenamento.
 */
export async function up(knex) {
    const existe = await knex.schema.hasColumn('usuario', 'usu_foto')

    if (!existe) return

    await knex.schema.alterTable('usuario', (table) => {
        table.text('usu_foto', 'mediumtext').alter()
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    const existe = await knex.schema.hasColumn('usuario', 'usu_foto')

    if (!existe) return

    /* Atencao: voltar para varchar(255) trunca as fotos ja gravadas. */
    await knex.schema.alterTable('usuario', (table) => {
        table.string('usu_foto', 255).alter()
    })
}
