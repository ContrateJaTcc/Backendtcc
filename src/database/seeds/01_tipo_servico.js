/*
 * Sem este seed a tabela tipo_servico nasce vazia e qualquer POST /servicos
 * falha na chave estrangeira — a pasta seeds nem existia, embora o
 * knexfile.js ja apontasse para ela.
 *
 * Os nomes precisam bater com o que o frontend exibe no select. Desde a
 * criacao de GET /tipos-servico o frontend monta as opcoes a partir daqui,
 * entao esta lista e a unica fonte da verdade.
 */
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

        // insere sem apagar: um delete() quebraria os servicos ja cadastrados
        // que apontam para estes ids.
        if (!existente) {
            await knex('tipo_servico').insert(tipo)
        } else {
            await knex('tipo_servico')
                .where('tipo_id', existente.tipo_id)
                .update({ tipo_desc: tipo.tipo_desc })
        }
    }
}
