import db from '../config/knex.js'

export const criarServico = async (req, res) => {
    try {
        const {
            titulo,
            descricao,
            tipo_id,
            valor,
            tipo_valor,
            data_inicio,
            qtd_dias,
            local,
            cidade,
            estado,
            habilidades,
            forma_pagamento,
            vagas,
            status
        } = req.body

        if (
            !titulo ||
            !descricao ||
            !tipo_id ||
            valor === undefined ||
            !tipo_valor ||
            !qtd_dias ||
            !local ||
            !vagas
        ) {
            return res.status(400).json({
                erro: 'Preencha todos os campos obrigatórios.'
            })
        }

        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem criar projetos.'
            })
        }

        const contratante = await db('contratante')
            .select('cont_id')
            .where('usu_id', req.usuario.id)
            .first()

        if (!contratante) {
            return res.status(404).json({
                erro: 'Contratante não encontrado.'
            })
        }

        const [serv_id] = await db('servico').insert({
            cont_id: contratante.cont_id,
            tipo_id,
            serv_titulo: titulo,
            serv_desc: descricao,
            serv_valor: valor,
            serv_tipo_valor: tipo_valor,
            serv_data_inicio: data_inicio || null,
            serv_qtd_dias: qtd_dias,
            serv_local: local,
            serv_cidade: cidade || null,
            serv_estado: estado || null,
            serv_habilidades: habilidades || null,
            serv_forma_pagamento: forma_pagamento || null,
            serv_vagas: vagas,
            serv_status: status || 'rascunho'
        })

        const projeto = await db('servico')
            .where('serv_id', serv_id)
            .first()

        return res.status(201).json({
            mensagem: 'Projeto criado com sucesso!',
            projeto
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao criar projeto.'
        })
    }
}