import db from '../config/knex.js'

/*
 * candidatura.free_id referencia freelancer.free_id, nao usuario.usu_id.
 * Estes helpers evitam repetir a traducao em cada rota.
 */
const buscarFreelancer = (usu_id) =>
    db('freelancer').select('free_id').where('usu_id', usu_id).first()

const buscarContratante = (usu_id) =>
    db('contratante').select('cont_id').where('usu_id', usu_id).first()

/* Campos do servico usados nas listagens, no mesmo formato de servicoController. */
const COLUNAS_SERVICO = [
    'servico.serv_id',
    'servico.tipo_id',
    'tipo_servico.tipo_nome as categoria',
    'servico.serv_titulo',
    'servico.serv_desc',
    'servico.serv_valor',
    'servico.serv_tipo_valor',
    'servico.serv_qtd_dias',
    'servico.serv_local',
    'servico.serv_cidade',
    'servico.serv_estado',
    'servico.serv_habilidades',
    'servico.serv_vagas',
    'servico.serv_status',
    'servico.serv_data_criacao'
]

/*
 * GET /servicos/abertos — o que o freelancer ve no dashboard.
 *
 * Esta rota faltava: a tela do freelancer mostrava dados falsos porque nao
 * havia como listar os servicos disponiveis.
 */
export const listarServicosAbertos = async (req, res) => {
    try {
        const { busca, tipo_id } = req.query

        const freelancer = await buscarFreelancer(req.usuario.id)

        const projetos = await db('servico')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .where('servico.serv_status', 'aberto')
            .modify((q) => {
                if (busca) {
                    q.where((sub) => {
                        sub.where('servico.serv_titulo', 'like', '%' + busca + '%')
                            .orWhere('servico.serv_desc', 'like', '%' + busca + '%')
                    })
                }
                if (tipo_id) q.where('servico.tipo_id', tipo_id)
            })
            .select(
                ...COLUNAS_SERVICO,
                'usuario.usu_nome as contratante_nome',
                'usuario.usu_id as contratante_usu_id'
            )
            .orderBy('servico.serv_id', 'desc')

        /*
         * Marca o que o freelancer ja se candidatou, para a tela mostrar
         * "Candidatura enviada" em vez de oferecer o botao de novo.
         */
        let idsCandidatados = []

        if (freelancer && projetos.length > 0) {
            const candidaturas = await db('candidatura')
                .select('serv_id')
                .where('free_id', freelancer.free_id)
                .whereIn('serv_id', projetos.map((p) => p.serv_id))

            idsCandidatados = candidaturas.map((c) => c.serv_id)
        }

        return res.json({
            projetos: projetos.map((p) => ({
                ...p,
                ja_candidatado: idsCandidatados.includes(p.serv_id)
            }))
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao listar projetos disponíveis.'
        })
    }
}

/* POST /servicos/:id/candidaturas — freelancer se candidata. */
export const candidatarSe = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'freelancer') {
            return res.status(403).json({
                erro: 'Apenas freelancers podem se candidatar.'
            })
        }

        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            })
        }

        const servico = await db('servico')
            .select('serv_id', 'serv_status')
            .where('serv_id', req.params.id)
            .first()

        if (!servico) {
            return res.status(404).json({
                erro: 'Projeto não encontrado.'
            })
        }

        if (servico.serv_status !== 'aberto') {
            return res.status(400).json({
                erro: 'Este projeto não está aberto para candidaturas.'
            })
        }

        const jaExiste = await db('candidatura')
            .select('cand_id')
            .where({ free_id: freelancer.free_id, serv_id: servico.serv_id })
            .first()

        if (jaExiste && jaExiste.cand_status !== 'cancelada') {
    return res.status(409).json({
        erro: 'Você já se candidatou a este projeto.'
    })
}

if (jaExiste && jaExiste.cand_status === 'cancelada') {
    await db('candidatura')
        .where('cand_id', jaExiste.cand_id)
        .update({
            cand_status: 'pendente',
            cand_data: db.fn.now()
        })

    return res.status(201).json({
        mensagem: 'Candidatura enviada novamente!',
        cand_id: jaExiste.cand_id
    })
}

        const [cand_id] = await db('candidatura').insert({
            free_id: freelancer.free_id,
            serv_id: servico.serv_id
        })

        return res.status(201).json({
            mensagem: 'Candidatura enviada!',
            cand_id
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao enviar candidatura.'
        })
    }
}

/* DELETE /servicos/:id/candidaturas — freelancer cancela a própria candidatura. */
export const cancelarCandidatura = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'freelancer') {
            return res.status(403).json({
                erro: 'Apenas freelancers podem cancelar candidaturas.'
            })
        }

        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            })
        }

        const candidatura = await db('candidatura')
            .where({
                free_id: freelancer.free_id,
                serv_id: req.params.id
            })
            .first()

        if (!candidatura) {
            return res.status(404).json({
                erro: 'Candidatura não encontrada.'
            })
        }

        if (candidatura.cand_status !== 'pendente') {
            return res.status(400).json({
                erro: 'Só é possível cancelar candidaturas pendentes.'
            })
        }

        await db('candidatura')
            .where('cand_id', candidatura.cand_id)
            .update({ cand_status: 'cancelada' })

        return res.json({
            mensagem: 'Candidatura cancelada com sucesso!'
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao cancelar candidatura.'
        })
    }
}

/* GET /candidaturas/minhas — o freelancer acompanha o que enviou. */
export const listarMinhasCandidaturas = async (req, res) => {
    try {
        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            })
        }

        const candidaturas = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .where('candidatura.free_id', freelancer.free_id)
            .select(
                'candidatura.cand_id',
                'candidatura.cand_status',
                'candidatura.cand_data',
                ...COLUNAS_SERVICO
            )
            .orderBy('candidatura.cand_id', 'desc')

        return res.json({ candidaturas })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao listar suas candidaturas.'
        })
    }
}

/*
 * GET /candidaturas/recebidas — alimenta a tela "Escolher candidatos".
 * So traz candidaturas de projetos do contratante logado.
 */
export const listarCandidaturasRecebidas = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem ver candidatos.'
            })
        }

        const contratante = await buscarContratante(req.usuario.id)

        if (!contratante) {
            return res.status(404).json({
                erro: 'Contratante não encontrado.'
            })
        }

        const candidatos = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
            .where('servico.cont_id', contratante.cont_id)
            .select(
                'candidatura.cand_id',
                'candidatura.cand_status',
                'candidatura.cand_data',
                'servico.serv_id',
                'servico.serv_titulo',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'freelancer.free_id',
                /* Perfil publico do candidato: sem CPF, telefone ou e-mail. */
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_desc',
                'usuario.usu_foto',
                'usuario.usu_cid',
                'usuario.usu_est'
            )
            .orderBy('candidatura.cand_id', 'desc')

        return res.json({ candidatos })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao listar candidatos.'
        })
    }
}

/* PUT /candidaturas/:id — aceitar ou recusar. */
export const responderCandidatura = async (req, res) => {
    try {
        const { acao } = req.body

        if (acao !== 'aceitar' && acao !== 'recusar') {
            return res.status(400).json({
                erro: 'Ação inválida. Use "aceitar" ou "recusar".'
            })
        }

        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem responder candidaturas.'
            })
        }

        const contratante = await buscarContratante(req.usuario.id)

        if (!contratante) {
            return res.status(404).json({
                erro: 'Contratante não encontrado.'
            })
        }

        const candidatura = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .where('candidatura.cand_id', req.params.id)
            .select(
                'candidatura.cand_id',
                'candidatura.cand_status',
                'candidatura.free_id',
                'servico.serv_id',
                'servico.cont_id',
                'servico.serv_titulo',
                'servico.serv_status'
            )
            .first()

        if (!candidatura) {
            return res.status(404).json({
                erro: 'Candidatura não encontrada.'
            })
        }

        /* Checagem de posse: so o dono do projeto responde. */
        if (candidatura.cont_id !== contratante.cont_id) {
            return res.status(403).json({
                erro: 'Esta candidatura não é de um projeto seu.'
            })
        }

        if (candidatura.cand_status !== 'pendente') {
            return res.status(400).json({
                erro: 'Esta candidatura já foi respondida.'
            })
        }

        if (acao === 'recusar') {
            await db('candidatura')
                .where('cand_id', candidatura.cand_id)
                .update({ cand_status: 'recusada' })

            await notificarFreelancer(
                candidatura.free_id,
                'Candidatura não aceita',
                'Sua candidatura para "' + candidatura.serv_titulo + '" não foi aceita desta vez.'
            )

            return res.json({ mensagem: 'Candidatura recusada.' })
        }

        if (candidatura.serv_status !== 'aberto') {
            return res.status(400).json({
                erro: 'Este projeto já não está aberto.'
            })
        }

        /*
         * Transaction: aceitar envolve tres escritas que precisam valer juntas.
         * Gravadas pela metade, o projeto ficaria com duas candidaturas aceitas
         * ou em andamento sem ninguem aceito.
         */
        await db.transaction(async (trx) => {
            await trx('candidatura')
                .where('cand_id', candidatura.cand_id)
                .update({ cand_status: 'aceita' })

            await trx('candidatura')
                .where('serv_id', candidatura.serv_id)
                .whereNot('cand_id', candidatura.cand_id)
                .where('cand_status', 'pendente')
                .update({ cand_status: 'recusada' })

            await trx('servico')
                .where('serv_id', candidatura.serv_id)
                .update({ serv_status: 'em_andamento' })
        })

        await notificarFreelancer(
            candidatura.free_id,
            'Você foi escolhido!',
            'Sua candidatura para "' + candidatura.serv_titulo + '" foi aceita.'
        )

        return res.json({ mensagem: 'Candidatura aceita!' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao responder candidatura.'
        })
    }
}

/* A notificacao e um extra: falhar aqui nao pode derrubar a acao principal. */
async function notificarFreelancer(free_id, titulo, descricao) {
    try {
        const freelancer = await db('freelancer')
            .select('usu_id')
            .where('free_id', free_id)
            .first()

        if (!freelancer) return

        await db('notificacao').insert({
            usu_id: freelancer.usu_id,
            not_titulo: titulo,
            not_desc: descricao
        })
    } catch (erro) {
        console.error('Falha ao criar notificação:', erro)
    }
}
