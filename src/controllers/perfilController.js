import db from '../config/knex.js'
import {
    sincronizarInsignias,
    resumoFreelancer,
    listarAvaliacoesRecebidas,
    reputacao
} from '../services/gamificacao.js'

/*
 * Dados de gamificacao e reputacao exibidos nas telas de perfil.
 * Os dados cadastrais continuam em /usuarios/eu.
 */
async function montarPerfilFreelancer(usu_id) {
    const freelancer = await db('freelancer').select('free_id').where('usu_id', usu_id).first()

    if (!freelancer) return null

    /* Insignias primeiro: sincronizar pode conceder novas, e o resumo
       deve refletir o estado ja atualizado. */
    const insignias = await sincronizarInsignias(freelancer.free_id)
    const resumo = await resumoFreelancer(freelancer.free_id)
    const avaliacoes = await listarAvaliacoesRecebidas(usu_id)

    return { resumo, insignias, avaliacoes }
}

/* GET /perfil/freelancer/eu */
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

/* GET /perfil/freelancer/:usuId — a mesma visao, para o contratante avaliar um candidato. */
export const perfilFreelancer = async (req, res) => {
    try {
        const perfil = await montarPerfilFreelancer(Number(req.params.usuId))

        if (!perfil) {
            return res.status(404).json({ erro: 'Freelancer não encontrado.' })
        }

        return res.json(perfil)
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar o perfil do freelancer.' })
    }
}

/*
 * GET /perfil/contratante/eu
 *
 * Numeros dos projetos, reputacao (a nota que os freelancers dao a ele) e os
 * freelancers com quem ja trabalhou, para recontratar.
 */
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
                'freelancer.free_rank'
            )
            .select(
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_foto',
                'freelancer.free_nivel',
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
                free_rank: Number(c.free_rank),
                projetos: Number(c.projetos)
            }))
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar seu painel.' })
    }
}
