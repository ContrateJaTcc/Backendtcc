import { bloqueados } from '../services/bloqueio.js'
import db from '../config/knex.js'
import { LIMITE_COMENTARIO } from './avaliacaoController.js'
import { enviarPush } from '../services/push.js'

/* Notificação */
async function notificar(usu_id, titulo, descricao) {
    try {
        await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: descricao })
        await enviarPush(usu_id, { titulo, texto: descricao })
    } catch (erro) {
        console.error(erro)
    }
}

/* Convidar */
export const criarConvite = async (req, res) => {
    try {
        const serv_id = Number(req.body.serv_id)
        const usu_id = Number(req.body.usu_id)
        const mensagem = String(req.body.mensagem ?? '').trim()

        if (!serv_id || !usu_id) {
            return res.status(400).json({ erro: 'Escolha o projeto e o freelancer.' })
        }

        if (mensagem.length > LIMITE_COMENTARIO) {
            return res.status(400).json({
                erro: `A mensagem deve ter no máximo ${LIMITE_COMENTARIO} caracteres.`
            })
        }

        const servico = await db('servico')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .where('servico.serv_id', serv_id)
            .where('contratante.usu_id', req.usuario.id)
            .select('servico.serv_id', 'servico.serv_titulo', 'servico.serv_status')
            .first()

        if (!servico) {
            return res.status(404).json({ erro: 'Projeto não encontrado.' })
        }

        if (servico.serv_status !== 'aberto') {
            return res.status(400).json({ erro: 'Só é possível convidar para projetos abertos.' })
        }

        if (await bloqueados(req.usuario.id, usu_id)) {
            return res.status(403).json({ erro: 'Não dá para convidar esta pessoa: uma de vocês bloqueou a outra.' })
        }

        const freelancer = await db('freelancer')
            .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
            .where('freelancer.usu_id', usu_id)
            .where('usuario.status_conta', 'ativa')
            .select('freelancer.free_id')
            .first()

        if (!freelancer) {
            return res.status(404).json({ erro: 'Freelancer não encontrado.' })
        }

        const candidatura = await db('candidatura')
            .where({ serv_id, free_id: freelancer.free_id })
            .whereNot('cand_status', 'cancelada')
            .first()

        if (candidatura) {
            return res.status(409).json({ erro: 'Este freelancer já se candidatou a este projeto.' })
        }

        const existente = await db('convite')
            .where({ serv_id, free_id: freelancer.free_id })
            .first()

        if (existente) {
            return res.status(409).json({ erro: 'Você já convidou este freelancer para este projeto.' })
        }

        const [conv_id] = await db('convite').insert({
            serv_id,
            free_id: freelancer.free_id,
            conv_mensagem: mensagem || null
        })

        await notificar(
            usu_id,
            'Você recebeu um convite!',
            `Um contratante convidou você para "${servico.serv_titulo}". Veja na aba Convites.`
        )

        return res.status(201).json({ mensagem: 'Convite enviado!', conv_id })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao enviar convite.' })
    }
}

/* Recebidos */
export const listarRecebidos = async (req, res) => {
    try {
        const convites = await db('convite')
            .join('freelancer', 'convite.free_id', 'freelancer.free_id')
            .join('servico', 'convite.serv_id', 'servico.serv_id')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .where('freelancer.usu_id', req.usuario.id)
            .select(
                'convite.conv_id',
                'convite.conv_status',
                'convite.conv_mensagem',
                'convite.conv_data',
                'servico.serv_id',
                'servico.serv_titulo',
                'servico.serv_desc',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_status',
                'tipo_servico.tipo_nome as categoria',
                'usuario.usu_nome as contratante_nome',
                'usuario.usu_foto as contratante_foto'
            )
            .orderBy('convite.conv_id', 'desc')

        return res.json({ convites })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar convites.' })
    }
}

/* Enviados */
export const listarEnviados = async (req, res) => {
    try {
        const convites = await db('convite')
            .join('servico', 'convite.serv_id', 'servico.serv_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('freelancer', 'convite.free_id', 'freelancer.free_id')
            .where('contratante.usu_id', req.usuario.id)
            .modify((q) => {
                if (req.query.usu_id) q.where('freelancer.usu_id', Number(req.query.usu_id))
            })
            .select(
                'convite.conv_id',
                'convite.conv_status',
                'convite.conv_data',
                'servico.serv_id',
                'servico.serv_titulo',
                'freelancer.usu_id'
            )
            .orderBy('convite.conv_id', 'desc')

        return res.json({ convites })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar convites enviados.' })
    }
}

/* Responder */
export const responderConvite = async (req, res) => {
    try {
        const { acao } = req.body

        if (acao !== 'aceitar' && acao !== 'recusar') {
            return res.status(400).json({ erro: 'Ação inválida. Use "aceitar" ou "recusar".' })
        }

        const convite = await db('convite')
            .join('freelancer', 'convite.free_id', 'freelancer.free_id')
            .join('servico', 'convite.serv_id', 'servico.serv_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .where('convite.conv_id', req.params.id)
            .where('freelancer.usu_id', req.usuario.id)
            .select(
                'convite.conv_id',
                'convite.conv_status',
                'convite.free_id',
                'servico.serv_id',
                'servico.serv_titulo',
                'servico.serv_status',
                'contratante.usu_id as contratante_usu_id'
            )
            .first()

        if (!convite) {
            return res.status(404).json({ erro: 'Convite não encontrado.' })
        }

        if (convite.conv_status !== 'pendente') {
            return res.status(400).json({ erro: 'Este convite já foi respondido.' })
        }

        if (acao === 'recusar') {
            await db('convite').where('conv_id', convite.conv_id).update({ conv_status: 'recusado' })

            await notificar(
                convite.contratante_usu_id,
                'Convite recusado',
                `O freelancer recusou o convite para "${convite.serv_titulo}".`
            )

            return res.json({ mensagem: 'Convite recusado.' })
        }

        if (convite.serv_status !== 'aberto') {
            return res.status(400).json({ erro: 'Este projeto não está mais aberto.' })
        }

        /* Vira candidatura */
        await db.transaction(async (trx) => {
            await trx('convite').where('conv_id', convite.conv_id).update({ conv_status: 'aceito' })

            const existente = await trx('candidatura')
                .where({ serv_id: convite.serv_id, free_id: convite.free_id })
                .first()

            if (existente) {
                await trx('candidatura')
                    .where('cand_id', existente.cand_id)
                    .update({ cand_status: 'pendente', cand_data: trx.fn.now() })
            } else {
                await trx('candidatura').insert({ serv_id: convite.serv_id, free_id: convite.free_id })
            }
        })

        await notificar(
            convite.contratante_usu_id,
            'Convite aceito!',
            `O freelancer aceitou o convite para "${convite.serv_titulo}". Confirme na aba Candidaturas.`
        )

        return res.json({ mensagem: 'Convite aceito! Sua candidatura foi enviada ao contratante.' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao responder convite.' })
    }
}
