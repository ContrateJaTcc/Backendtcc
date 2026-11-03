/* Tipos de serviço */
const TIPOS = [
    { tipo_nome: 'Desenvolvimento Web', tipo_desc: 'Sites, sistemas web e integrações' },
    { tipo_nome: 'Design', tipo_desc: 'Identidade visual, interfaces e peças gráficas' },
    { tipo_nome: 'Marketing', tipo_desc: 'Tráfego pago, redes sociais e conteúdo' },
    { tipo_nome: 'Redação e Tradução', tipo_desc: 'Textos, revisão e versão entre idiomas' },
    { tipo_nome: 'Programação', tipo_desc: 'Aplicativos, automações e scripts' },
]

export async function seed(knex) {
    for (const tipo of TIPOS) {
        const existente = await knex('tipo_servico')
            .select('tipo_id')
            .where('tipo_nome', tipo.tipo_nome)
            .first()

        // Insere sem apagar
        if (!existente) {
            await knex('tipo_servico').insert(tipo)
        } else {
            await knex('tipo_servico')
                .where('tipo_id', existente.tipo_id)
                .update({ tipo_desc: tipo.tipo_desc })
        }
    }
}
