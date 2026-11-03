import db from '../config/knex.js'
import { verificacao } from '../services/confianca.js'
import {
    sincronizarInsignias,
    resumoFreelancer,
    listarAvaliacoesRecebidas,
    reputacao
} from '../services/gamificacao.js'

/* Perfil freelancer */
async function montarPerfilFreelancer(usu_id) {
    const freelancer = await db('freelancer').select('free_id').where('usu_id', usu_id).first()

    if (!freelancer) return null

    /* Insígnias */
    const insignias = await sincronizarInsignias(freelancer.free_id)
    const resumo = await resumoFreelancer(freelancer.free_id)
    const avaliacoes = await listarAvaliacoesRecebidas(usu_id)

    const selo = await verificacao(usu_id)

    return { free_id: freelancer.free_id, resumo, insignias, avaliacoes, verificacao: selo }
}

/* Meu perfil */
export const meuPerfilFreelancer = async (req, res) => {
    try {
        const perfil = await montarPerfilFreelancer(req.usuario.id)

        if (!perfil) {
            return res.status(403).json({ erro: 'Apenas freelancers possuem esta área.' })
        }

        return res.json(perfil)
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar suas conquistas.' })
    }
}

/* Perfil freelancer */
export const perfilFreelancer = async (req, res) => {
    try {
        const perfil = await montarPerfilFreelancer(Number(req.params.usuId))

        if (!perfil) {
            return res.status(404).json({ erro: 'Freelancer não encontrado.' })
        }

        return res.json(perfil)
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao carregar o perfil do freelancer.',
            detalhe: erro.message
        })
    }
}

/* Perfil contratante */
export const meuPerfilContratante = async (req, res) => {
    try {
        const contratante = await db('contratante')
            .select('cont_id')
            .where('usu_id', req.usuario.id)
            .first()

        if (!contratante) {
            return res.status(403).json({ erro: 'Apenas contratantes possuem esta área.' })
        }

        const porStatus = await db('servico')
            .where('cont_id', contratante.cont_id)
            .select('serv_status')
            .count('* as total')
            .groupBy('serv_status')

        const contagem = Object.fromEntries(porStatus.map((s) => [s.serv_status, Number(s.total)]))

        const contratados = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
            .where('servico.cont_id', contratante.cont_id)
            .where('candidatura.cand_status', 'aceita')
            .groupBy(
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_foto',
                'freelancer.free_nivel',
                'freelancer.free_xp',
                'freelancer.free_rank'
            )
            .select(
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_foto',
                'freelancer.free_nivel',
                'freelancer.free_xp',
                'freelancer.free_rank',
                db.raw('COUNT(*) as projetos'),
                db.raw('MAX(servico.serv_id) as ultimo_serv_id')
            )
            .orderBy('ultimo_serv_id', 'desc')
            .limit(12)

        const estatisticas = {
            publicados:
                (contagem.aberto ?? 0) +
                (contagem.em_andamento ?? 0) +
                (contagem.finalizado ?? 0) +
                (contagem.cancelado ?? 0),
            abertos: contagem.aberto ?? 0,
            emAndamento: contagem.em_andamento ?? 0,
            concluidos: contagem.finalizado ?? 0,
            rascunhos: contagem.rascunho ?? 0,
            freelancersContratados: contratados.length
        }

        return res.json({
            estatisticas,
            reputacao: await reputacao(req.usuario.id),
            avaliacoes: await listarAvaliacoesRecebidas(req.usuario.id),
            contratados: contratados.map((c) => ({
                usu_id: c.usu_id,
                usu_nome: c.usu_nome,
                usu_foto: c.usu_foto,
                free_nivel: c.free_nivel,
                free_xp: c.free_xp,
                free_rank: Number(c.free_rank),
                projetos: Number(c.projetos)
            }))
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar seu painel.' })
    }
}
