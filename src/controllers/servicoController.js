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

export const listarMeusServicos = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem visualizar seus projetos.'
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

        const projetos = await db('servico')
            .join(
                'tipo_servico',
                'servico.tipo_id',
                'tipo_servico.tipo_id'
            )
            .where('servico.cont_id', contratante.cont_id)
            .select(
                'servico.serv_id',
                'servico.cont_id',
                'servico.tipo_id',
                'tipo_servico.tipo_nome as categoria',
                'servico.serv_titulo',
                'servico.serv_desc',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_data_inicio',
                'servico.serv_qtd_dias',
                'servico.serv_local',
                'servico.serv_cidade',
                'servico.serv_estado',
                'servico.serv_habilidades',
                'servico.serv_forma_pagamento',
                'servico.serv_vagas',
                'servico.serv_status',
                'servico.serv_data_criacao',
                'servico.serv_data_atualizacao'
            )
            .orderBy('servico.serv_id', 'desc')

        return res.json({
            projetos
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao listar projetos.'
        })
    }
}
export const buscarServicoPorId = async (req, res) => {
    try {
        const projeto = await db('servico')
            .join(
                'tipo_servico',
                'servico.tipo_id',
                'tipo_servico.tipo_id'
            )
            .join(
                'contratante',
                'servico.cont_id',
                'contratante.cont_id'
            )
            .join(
                'usuario',
                'contratante.usu_id',
                'usuario.usu_id'
            )
            .where('servico.serv_id', req.params.id)
            .where(function () {
                if (req.usuario.tipo === 'contratante') {
                    this.where('contratante.usu_id', req.usuario.id)
                } else {
                    this.where('servico.serv_status', 'aberto')
                }
            })
            .select(
                'servico.serv_id',
                'servico.cont_id',
                'servico.tipo_id',
                'tipo_servico.tipo_nome as categoria',
                'servico.serv_titulo',
                'servico.serv_desc',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_data_inicio',
                'servico.serv_qtd_dias',
                'servico.serv_local',
                'servico.serv_cidade',
                'servico.serv_estado',
                'servico.serv_habilidades',
                'servico.serv_forma_pagamento',
                'servico.serv_vagas',
                'servico.serv_status',
                'servico.serv_data_criacao',
                'servico.serv_data_atualizacao',
                'usuario.usu_id as contratante_usu_id',
                'usuario.usu_nome as contratante_nome',
                'usuario.usu_desc as contratante_desc',
                'usuario.usu_foto as contratante_foto',
                'usuario.data_criacao as contratante_data_criacao',
                db.raw(`
                    (
                        SELECT COUNT(*)
                        FROM servico AS s2
                        WHERE s2.cont_id = servico.cont_id
                        AND s2.serv_status = 'aberto'
                    ) AS contratante_servicos_postados
                `),
                /* Reputacao do contratante: o que os freelancers deram a ele. */
                db.raw(`
                    (
                        SELECT ROUND(AVG(a.aval_nota), 1)
                        FROM avaliacao AS a
                        WHERE a.usu_avaliado = usuario.usu_id
                    ) AS contratante_nota
                `),
                db.raw(`
                    (
                        SELECT COUNT(*)
                        FROM avaliacao AS a
                        WHERE a.usu_avaliado = usuario.usu_id
                    ) AS contratante_total_avaliacoes
                `),
                /* Para o freelancer nao ver "Candidatar-se" num projeto em que ja se candidatou. */
                db.raw(`
                    (
                        SELECT COUNT(*)
                        FROM candidatura AS c
                        JOIN freelancer AS f ON f.free_id = c.free_id
                        WHERE c.serv_id = servico.serv_id AND f.usu_id = ?
                    ) AS ja_candidatado
                `, [req.usuario.id])
            )
            .first()

        if (!projeto) {
            return res.status(404).json({
                erro: 'Projeto não encontrado.'
            })
        }

        return res.json({ projeto })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao buscar projeto.'
        })
    }
}
export const atualizarServico = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem editar projetos.'
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

        const projeto = await db('servico')
            .where('serv_id', req.params.id)
            .where('cont_id', contratante.cont_id)
            .first()

        if (!projeto) {
            return res.status(404).json({
                erro: 'Projeto não encontrado.'
            })
        }

        /*
         * A edicao so publica ou volta para rascunho. Em andamento, finalizado
         * e cancelado tem fluxos proprios: aceitar candidatura e
         * PUT /servicos/:id/finalizar (que concede o XP). Sem esta trava,
         * mandar status "finalizado" aqui pulava tudo isso.
         */
        const EDITAVEIS = ['rascunho', 'aberto']

        if (!EDITAVEIS.includes(status) || !EDITAVEIS.includes(projeto.serv_status)) {
            return res.status(400).json({
                erro: 'Só é possível editar projetos em rascunho ou abertos.'
            })
        }

        await db('servico')
            .where('serv_id', req.params.id)
            .update({
                tipo_id,
                serv_titulo: titulo,
                serv_desc: descricao,
                serv_valor: valor,
                serv_tipo_valor: tipo_valor,
                serv_data_inicio: data_inicio || null,
                serv_qtd_dias: qtd_dias || null,
                serv_local: local,
                serv_cidade: cidade || null,
                serv_estado: estado || null,
                serv_habilidades: habilidades || null,
                serv_forma_pagamento: forma_pagamento || null,
                serv_vagas: vagas,
                serv_status: status
            })

        return res.json({
            mensagem: 'Projeto atualizado com sucesso.'
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao atualizar projeto.'
        })
    }
    
}
export const listarOutrosServicos = async (req, res) => {
    try {
        const servicoAtual = await db('servico')
            .select('cont_id')
            .where('serv_id', req.params.id)
            .first()

        if (!servicoAtual) {
            return res.status(404).json({
                erro: 'Projeto não encontrado.'
            })
        }

        const projetos = await db('servico')
            .join(
                'tipo_servico',
                'servico.tipo_id',
                'tipo_servico.tipo_id'
            )
            .where('servico.cont_id', servicoAtual.cont_id)
            .where('servico.serv_status', 'aberto')
            .whereNot('servico.serv_id', req.params.id)
            .select(
                'servico.serv_id',
                'servico.serv_titulo',
                'servico.serv_desc',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_qtd_dias',
                'servico.serv_data_criacao',
                'tipo_servico.tipo_nome as categoria'
            )
            .orderBy('servico.serv_data_criacao', 'desc')

        return res.json({ projetos })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao buscar outros serviços.'
        })
    }
}