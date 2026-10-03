import db from '../config/knex.js'
import {
    concederXp,
    recalcularRank,
    XP_PROJETO_CONCLUIDO,
    XP_POR_ESTRELA
} from '../services/gamificacao.js'

const LIMITE_COMENTARIO = 1000

/* Notificacao e um extra: falhar aqui nao pode derrubar a acao principal. */
async function notificar(usu_id, titulo, descricao) {
    try {
        await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: descricao })
    } catch (erro) {
        console.error(erro)
    }
}

/*
 * PUT /servicos/:id/finalizar — o contratante marca o projeto como concluido.
 *
 * Cada freelancer aceito ganha o XP de projeto concluido, na mesma
 * transaction da mudanca de status: finalizar duas vezes nao pode dar XP
 * duas vezes, e o status so muda se o XP tambem foi gravado.
 */
export const finalizarServico = async (req, res) => {
    try {
        const contratante = await db('contratante')
            .select('cont_id')
            .where('usu_id', req.usuario.id)
            .first()

        if (!contratante) {
            return res.status(403).json({ erro: 'Apenas contratantes podem finalizar projetos.' })
        }

        const servico = await db('servico')
            .select('serv_id', 'cont_id', 'serv_titulo', 'serv_status')
            .where('serv_id', req.params.id)
            .first()

        if (!servico || servico.cont_id !== contratante.cont_id) {
            return res.status(404).json({ erro: 'Projeto não encontrado.' })
        }

        if (servico.serv_status !== 'em_andamento') {
            return res.status(400).json({ erro: 'Só é possível finalizar projetos em andamento.' })
        }

        const aceitos = await db('candidatura')
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .where('candidatura.serv_id', servico.serv_id)
            .where('candidatura.cand_status', 'aceita')
            .select('freelancer.free_id', 'freelancer.usu_id')

        /* O where no status protege contra dois cliques simultaneos: so
           uma das requisicoes consegue mudar a linha e conceder o XP. */
        const finalizou = await db.transaction(async (trx) => {
            const alteradas = await trx('servico')
                .where('serv_id', servico.serv_id)
                .where('serv_status', 'em_andamento')
                .update({ serv_status: 'finalizado' })

            if (alteradas === 0) return false

            for (const f of aceitos) {
                await concederXp(trx, f.free_id, XP_PROJETO_CONCLUIDO)
            }

            return true
        })

        if (!finalizou) {
            return res.status(400).json({ erro: 'Este projeto já foi finalizado.' })
        }

        for (const f of aceitos) {
            await notificar(
                f.usu_id,
                'Projeto concluído!',
                `"${servico.serv_titulo}" foi finalizado. Você ganhou ${XP_PROJETO_CONCLUIDO} XP. Avalie o contratante no seu histórico.`
            )
        }

        return res.json({ mensagem: 'Projeto finalizado! Agora avalie quem trabalhou com você.' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao finalizar projeto.' })
    }
}

/*
 * Quem o usuario logado pode (e ainda nao) avaliou: a outra ponta de cada
 * projeto finalizado em que ele participou.
 *
 * Contratante -> cada freelancer aceito nos projetos dele.
 * Freelancer  -> o contratante de cada projeto em que foi aceito.
 */
async function buscarPendentes(usuario) {
    let pares

    if (usuario.tipo === 'contratante') {
        pares = await db('servico')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('candidatura', 'servico.serv_id', 'candidatura.serv_id')
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
            .where('contratante.usu_id', usuario.id)
            .where('servico.serv_status', 'finalizado')
            .where('candidatura.cand_status', 'aceita')
            .select(
                'servico.serv_id',
                'servico.serv_titulo',
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_foto'
            )
    } else {
        pares = await db('candidatura')
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .where('freelancer.usu_id', usuario.id)
            .where('servico.serv_status', 'finalizado')
            .where('candidatura.cand_status', 'aceita')
            .select(
                'servico.serv_id',
                'servico.serv_titulo',
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_foto'
            )
    }

    if (pares.length === 0) return []

    const feitas = await db('avaliacao')
        .where('usu_avaliador', usuario.id)
        .whereIn('serv_id', pares.map((p) => p.serv_id))
        .select('serv_id', 'usu_avaliado')

    const jaAvaliado = new Set(feitas.map((a) => `${a.serv_id}:${a.usu_avaliado}`))

    return pares.filter((p) => !jaAvaliado.has(`${p.serv_id}:${p.usu_id}`))
}

/* GET /avaliacoes/pendentes */
export const listarPendentes = async (req, res) => {
    try {
        const pendentes = await buscarPendentes(req.usuario)

        return res.json({ pendentes })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar avaliações pendentes.' })
    }
}

/*
 * POST /avaliacoes — { serv_id, usu_avaliado, nota, comentario }
 *
 * So aceita avaliar quem esta na lista de pendentes: impede avaliar alguem
 * de um projeto do qual nao participou, ou avaliar a mesma pessoa duas vezes.
 */
export const criarAvaliacao = async (req, res) => {
    try {
        const serv_id = Number(req.body.serv_id)
        const usu_avaliado = Number(req.body.usu_avaliado)
        const nota = Number(req.body.nota)
        const comentario = String(req.body.comentario ?? '').trim()

        if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
            return res.status(400).json({ erro: 'Escolha uma nota de 1 a 5 estrelas.' })
        }

        if (comentario.length > LIMITE_COMENTARIO) {
            return res.status(400).json({
                erro: `O comentário deve ter no máximo ${LIMITE_COMENTARIO} caracteres.`
            })
        }

        const pendentes = await buscarPendentes(req.usuario)
        const alvo = pendentes.find((p) => p.serv_id === serv_id && p.usu_id === usu_avaliado)

        if (!alvo) {
            return res.status(400).json({
                erro: 'Você não pode avaliar esta pessoa neste projeto, ou já avaliou.'
            })
        }

        const avaliandoFreelancer = req.usuario.tipo === 'contratante'

        await db.transaction(async (trx) => {
            await trx('avaliacao').insert({
                serv_id,
                usu_avaliador: req.usuario.id,
                usu_avaliado,
                aval_nota: nota,
                aval_comentario: comentario || null
            })

            /* So o freelancer acumula XP e rank; o contratante tem apenas
               a media de reputacao, calculada na leitura. */
            if (avaliandoFreelancer) {
                const freelancer = await trx('freelancer')
                    .select('free_id')
                    .where('usu_id', usu_avaliado)
                    .first()

                await concederXp(trx, freelancer.free_id, nota * XP_POR_ESTRELA)
                await recalcularRank(trx, usu_avaliado)
            }
        })

        await notificar(
            usu_avaliado,
            'Você recebeu uma avaliação',
            `Nota ${nota} de 5 em "${alvo.serv_titulo}".` +
                (avaliandoFreelancer ? ` +${nota * XP_POR_ESTRELA} XP!` : '')
        )

        return res.status(201).json({ mensagem: 'Avaliação enviada. Obrigado!' })

    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'Você já avaliou esta pessoa neste projeto.' })
        }

        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao enviar avaliação.' })
    }
}
