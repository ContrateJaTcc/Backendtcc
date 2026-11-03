import db from '../config/knex.js'
import { premiarIndicacao } from './indicacaoController.js'
import { temColuna, temTabela } from '../services/registro.js'
import {
    concederXp,
    recalcularRank,
    XP_PROJETO_CONCLUIDO,
    XP_POR_ESTRELA,
    DIAS_AVALIACAO_CEGA
} from '../services/gamificacao.js'
import { verificarInsignia } from '../services/insigniasServices.js'
import { enviarPush } from '../services/push.js'
import { liberarGarantia } from '../services/carteira.js'

/* Comentário curto */
export const LIMITE_COMENTARIO = 280

/* Notificação */
async function notificar(usu_id, titulo, descricao) {
    try {
        await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: descricao })
        await enviarPush(usu_id, { titulo, texto: descricao })
    } catch (erro) {
        console.error(erro)
    }
}

/* Insígnia de pedra preciosa: recalculada depois de concluir projeto ou receber avaliação */
async function atualizarInsignia(free_id) {
    try {
        await verificarInsignia(free_id)
    } catch (erro) {
        console.error('Erro ao atualizar insígnia:', erro)
    }
}

/* Entregar */
export const entregarServico = async (req, res) => {
    try {
        const nota = String(req.body?.nota ?? '').trim()
        const link = String(req.body?.link ?? '').trim()

        if (nota.length > LIMITE_COMENTARIO) {
            return res.status(400).json({
                erro: `A observação deve ter no máximo ${LIMITE_COMENTARIO} caracteres.`
            })
        }

        if (link && (!/^https://S+$/i.test(link) || link.length > 300)) {
            return res.status(400).json({ erro: 'O link da entrega precisa começar com https:// (Drive, Figma, GitHub...).' })
        }

        const servico = await db('servico')
            .join('candidatura', 'servico.serv_id', 'candidatura.serv_id')
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .where('servico.serv_id', req.params.id)
            .where('freelancer.usu_id', req.usuario.id)
            .where('candidatura.cand_status', 'aceita')
            .select(
                'servico.serv_id',
                'servico.serv_titulo',
                'servico.serv_status',
                'servico.serv_entregue_em',
                'contratante.usu_id as contratante_usu_id'
            )
            .first()

        if (!servico) {
            return res.status(404).json({ erro: 'Projeto não encontrado entre os seus trabalhos.' })
        }

        if (servico.serv_status !== 'em_andamento') {
            return res.status(400).json({ erro: 'Só é possível entregar projetos em andamento.' })
        }

        if (servico.serv_entregue_em) {
            return res.status(400).json({ erro: 'Você já marcou este trabalho como entregue.' })
        }

        await db('servico')
            .where('serv_id', servico.serv_id)
            .update({
                serv_entregue_em: db.fn.now(),
                serv_entrega_nota: nota || null
            })

        /* Versões da entrega: cada entrega (a primeira e as depois dos ajustes) fica guardada */
        if (await temTabela('entrega_versao')) {
            const [{ total }] = await db('entrega_versao').where('serv_id', servico.serv_id).count('* as total')
            await db('entrega_versao').insert({ serv_id: servico.serv_id, ver_numero: Number(total) + 1, ver_nota: nota || null, ver_link: link || null })
        }

        await notificar(
            servico.contratante_usu_id,
            'Trabalho entregue',
            `O freelancer marcou "${servico.serv_titulo}" como entregue. Confira e finalize no histórico.`
        )

        return res.json({ mensagem: 'Entrega registrada! O contratante foi avisado.' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao registrar a entrega.' })
    }
}

/* Finalizar */
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

        const resultado = await concluirProjeto(servico)

        if (!resultado) {
            return res.status(400).json({ erro: 'Este projeto já foi finalizado.' })
        }

        return res.json({
            mensagem: resultado.pago
                ? 'Projeto finalizado! O pagamento guardado foi para o freelancer. Agora avalie quem trabalhou com você.'
                : 'Projeto finalizado! Agora avalie quem trabalhou com você.'
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao finalizar projeto.' })
    }
}

/*
 * Conclui o projeto: muda o status, dá o XP, libera o pagamento guardado na garantia
 * e avisa o freelancer. Também usado quando a administração resolve uma disputa a favor dele.
 * Devolve null se o projeto já não estava em andamento.
 */
export async function concluirProjeto(servico) {
    const aceitos = await db('candidatura')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where('candidatura.serv_id', servico.serv_id)
        .where('candidatura.cand_status', 'aceita')
        .select('freelancer.free_id', 'freelancer.usu_id')

    const comData = await temColuna('servico', 'serv_finalizado_em')
    let pago = null

    /* Transação */
    const finalizou = await db.transaction(async (trx) => {
        const alteradas = await trx('servico')
            .where('serv_id', servico.serv_id)
            .where('serv_status', 'em_andamento')
            .update({ serv_status: 'finalizado', ...(comData ? { serv_finalizado_em: db.fn.now() } : {}) })

        if (alteradas === 0) return false

        for (const f of aceitos) {
            await concederXp(trx, f.free_id, XP_PROJETO_CONCLUIDO, 'projeto_concluido')
        }

        pago = await liberarGarantia(trx, servico.serv_id, aceitos[0]?.usu_id)

        return true
    })

    if (!finalizou) return null

    for (const f of aceitos) {
        await atualizarInsignia(f.free_id)
    }

    /* Convide um amigo: o primeiro projeto concluído de quem foi indicado dá XP para os dois */
    const dono = await db('servico').join('contratante', 'servico.cont_id', 'contratante.cont_id').where('servico.serv_id', servico.serv_id).select('contratante.usu_id').first()
    await premiarIndicacao([...aceitos.map((f) => f.usu_id), dono?.usu_id])

    for (const f of aceitos) {
        await notificar(
            f.usu_id,
            'Projeto concluído!',
            `"${servico.serv_titulo}" foi finalizado. Você ganhou ${XP_PROJETO_CONCLUIDO} XP.` +
                (pago ? ` O pagamento de R$ ${pago.toFixed(2).replace('.', ',')} caiu na sua carteira.` : '') +
                ' Avalie o contratante e, se quiser, mostre o trabalho no seu portfólio.'
        )
    }

    return { pago }
}

/* Pendentes */
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
    const faltam = pares.filter((p) => !jaAvaliado.has(`${p.serv_id}:${p.usu_id}`))

    /* Avaliação às cegas: avisa quem já foi avaliado (a nota só aparece depois que a pessoa avaliar também) */
    const recebidas = faltam.length
        ? await db('avaliacao')
            .where('usu_avaliado', usuario.id)
            .whereIn('serv_id', faltam.map((p) => p.serv_id))
            .select('serv_id', 'usu_avaliador')
        : []
    const meAvaliaram = new Set(recebidas.map((a) => `${a.serv_id}:${a.usu_avaliador}`))

    return faltam.map((p) => ({ ...p, outro_ja_avaliou: meAvaliaram.has(`${p.serv_id}:${p.usu_id}`) }))
}

/* Pendentes */
export const listarPendentes = async (req, res) => {
    try {
        const pendentes = await buscarPendentes(req.usuario)

        return res.json({ pendentes })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar avaliações pendentes.' })
    }
}

/* Avaliar */
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

        /* Notas por critério (opcionais): comunicação, prazo e qualidade */
        const criterios = {}
        for (const campo of ['comunicacao', 'prazo', 'qualidade']) {
            const v = req.body[campo]
            if (v === undefined || v === null || v === '') continue
            if (!Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 5) return res.status(400).json({ erro: 'As notas por critério vão de 1 a 5.' })
            criterios[`aval_${campo}`] = Number(v)
        }
        const comCriterios = await temColuna('avaliacao', 'aval_comunicacao')

        const pendentes = await buscarPendentes(req.usuario)
        const alvo = pendentes.find((p) => p.serv_id === serv_id && p.usu_id === usu_avaliado)

        if (!alvo) {
            return res.status(400).json({
                erro: 'Você não pode avaliar esta pessoa neste projeto, ou já avaliou.'
            })
        }

        const avaliandoFreelancer = req.usuario.tipo === 'contratante'
        let free_id_avaliado = null
        /* Se o outro lado já avaliou, as duas notas aparecem agora; se não, a minha fica às cegas */
        const outroJaAvaliou = alvo.outro_ja_avaliou

        await db.transaction(async (trx) => {
            await trx('avaliacao').insert({
                serv_id,
                usu_avaliador: req.usuario.id,
                usu_avaliado,
                aval_nota: nota,
                aval_comentario: comentario || null,
                ...(comCriterios ? criterios : {})
            })

            /* XP */
            if (avaliandoFreelancer) {
                const freelancer = await trx('freelancer')
                    .select('free_id')
                    .where('usu_id', usu_avaliado)
                    .first()

                free_id_avaliado = freelancer.free_id

                await concederXp(trx, freelancer.free_id, nota * XP_POR_ESTRELA, 'avaliacao')
            }

            /* A média do freelancer só conta notas visíveis: as duas podem ter acabado de aparecer */
            await recalcularRank(trx, avaliandoFreelancer ? usu_avaliado : req.usuario.id)
        })

        if (free_id_avaliado) {
            await atualizarInsignia(free_id_avaliado)
        }

        const xp = avaliandoFreelancer ? ` +${nota * XP_POR_ESTRELA} XP!` : ''
        await notificar(
            usu_avaliado,
            'Você recebeu uma avaliação',
            outroJaAvaliou
                ? `Nota ${nota} de 5 em "${alvo.serv_titulo}". Agora as duas avaliações aparecem.${xp}`
                : `Alguém avaliou você em "${alvo.serv_titulo}". A nota aparece quando você avaliar também (ou em ${DIAS_AVALIACAO_CEGA} dias).${xp}`
        )

        return res.status(201).json({
            mensagem: outroJaAvaliou
                ? 'Avaliação enviada. As duas notas já aparecem no perfil de vocês.'
                : `Avaliação enviada. Ela aparece quando a outra pessoa avaliar também (ou em ${DIAS_AVALIACAO_CEGA} dias).`
        })

    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'Você já avaliou esta pessoa neste projeto.' })
        }

        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao enviar avaliação.' })
    }
}
