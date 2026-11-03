import db from '../config/knex.js'
import { temTabela } from './registro.js'
import { enviarPush } from './push.js'

/*
 * Avaliação às cegas: a nota só aparece quando os dois lados avaliaram o projeto
 * ou quando passam 7 dias da avaliação (assim ninguém responde a nota do outro "na vingança").
 * Uso: .whereRaw(avaliacaoVisivel('a')) com o apelido da tabela avaliacao na consulta.
 */
export const DIAS_AVALIACAO_CEGA = 7
export const avaliacaoVisivel = (a = 'avaliacao') =>
    `(${a}.aval_data <= DATE_SUB(NOW(), INTERVAL ${DIAS_AVALIACAO_CEGA} DAY) OR EXISTS (SELECT 1 FROM avaliacao volta WHERE volta.serv_id = ${a}.serv_id AND volta.usu_avaliador = ${a}.usu_avaliado AND volta.usu_avaliado = ${a}.usu_avaliador))`

/* Gamificação */
export const XP_PROJETO_CONCLUIDO = 100
export const XP_POR_ESTRELA = 20

const XP_BASE_NIVEL = 50

export const xpDoNivel = (nivel) => XP_BASE_NIVEL * (nivel - 1) ** 2

export const nivelPorXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / XP_BASE_NIVEL)) + 1

/* Regras */
const REGRAS = {
    primeiro_projeto: (e) => ({ progresso: e.concluidos, meta: 1 }),
    em_ascensao: (e) => ({ progresso: e.concluidos, meta: 5 }),
    veterano: (e) => ({ progresso: e.concluidos, meta: 10 }),
    nota_maxima: (e) => ({ progresso: e.notasCinco, meta: 1 }),
    /* Favorito */
    favorito: (e) => ({
        progresso: e.media >= 4.8 ? e.totalAvaliacoes : Math.min(e.totalAvaliacoes, 4),
        meta: 5
    }),
    vitrine: (e) => ({ progresso: e.itensPortfolio, meta: 3 }),
    perfil_completo: (e) => ({ progresso: e.itensPerfil, meta: 3 }),
    nivel_5: (e) => ({ progresso: e.nivel, meta: 5 }),
    primeira_entrega: (e) => ({ progresso: e.entregas, meta: 1 }),
    requisitado: (e) => ({ progresso: e.convites, meta: 3 }),
    pontual: (e) => ({ progresso: e.entregasConcluidas, meta: 3 })
}

async function estatisticasFreelancer(free_id, conexao = db) {
    const freelancer = await conexao('freelancer')
        .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
        .where('freelancer.free_id', free_id)
        .select(
            'freelancer.usu_id',
            'freelancer.free_xp',
            'freelancer.free_nivel',
            'usuario.usu_foto',
            'usuario.usu_desc'
        )
        .first()

    if (!freelancer) return null

    const [{ concluidos }] = await conexao('candidatura')
        .join('servico', 'candidatura.serv_id', 'servico.serv_id')
        .where('candidatura.free_id', free_id)
        .where('candidatura.cand_status', 'aceita')
        .where('servico.serv_status', 'finalizado')
        .count('* as concluidos')

    const [notas] = await conexao('avaliacao')
        .where('usu_avaliado', freelancer.usu_id)
        .whereRaw(avaliacaoVisivel())
        .select(
            conexao.raw('COUNT(*) as total'),
            conexao.raw('AVG(aval_nota) as media'),
            conexao.raw('SUM(aval_nota = 5) as cinco')
        )

    /* Entregas */
    const [entregas] = await conexao('candidatura')
        .join('servico', 'candidatura.serv_id', 'servico.serv_id')
        .where('candidatura.free_id', free_id)
        .where('candidatura.cand_status', 'aceita')
        .whereNotNull('servico.serv_entregue_em')
        .select(
            conexao.raw('COUNT(*) as total'),
            conexao.raw("SUM(servico.serv_status = 'finalizado') as concluidas")
        )

    const [{ convites }] = await conexao('convite').where('free_id', free_id).count('* as convites')

    const [{ itens }] = await conexao('portfolio').where('free_id', free_id).count('* as itens')
    const [{ areas }] = await conexao('freelancer_tipo_servico').where('free_id', free_id).count('* as areas')

    return {
        usu_id: freelancer.usu_id,
        xp: freelancer.free_xp,
        nivel: freelancer.free_nivel,
        concluidos: Number(concluidos),
        totalAvaliacoes: Number(notas.total),
        media: notas.media === null ? 0 : Number(notas.media),
        notasCinco: Number(notas.cinco ?? 0),
        itensPortfolio: Number(itens),
        entregas: Number(entregas.total),
        entregasConcluidas: Number(entregas.concluidas ?? 0),
        convites: Number(convites),
        itensPerfil:
            (freelancer.usu_foto ? 1 : 0) +
            (freelancer.usu_desc?.trim() ? 1 : 0) +
            (Number(areas) > 0 ? 1 : 0)
    }
}

/* Sincronizar insígnias */
export async function sincronizarInsignias(free_id) {
    const estatisticas = await estatisticasFreelancer(free_id)

    if (!estatisticas) return []

    const catalogo = await db('insignia')
        .whereNotNull('ins_codigo')
        .select('ins_id', 'ins_codigo', 'ins_nome', 'ins_desc')
        .orderBy('ins_id')

    const conquistadas = await db('freelancer_insignia')
        .where('free_id', free_id)
        .select('ins_id', 'freeins_data')

    const dataPorInsignia = new Map(conquistadas.map((c) => [c.ins_id, c.freeins_data]))
    const novas = []

    const resultado = catalogo.map((ins) => {
        const regra = REGRAS[ins.ins_codigo]
        const { progresso, meta } = regra ? regra(estatisticas) : { progresso: 0, meta: 1 }
        const jaTinha = dataPorInsignia.has(ins.ins_id)
        const cumpre = progresso >= meta

        if (!jaTinha && cumpre) novas.push(ins)

        return {
            codigo: ins.ins_codigo,
            nome: ins.ins_nome,
            descricao: ins.ins_desc,
            conquistada: jaTinha || cumpre,
            data: dataPorInsignia.get(ins.ins_id) ?? (cumpre ? new Date() : null),
            progresso: Math.min(progresso, meta),
            meta
        }
    })

    if (novas.length > 0) {
        /* Insert ignore */
        await db('freelancer_insignia')
            .insert(novas.map((ins) => ({ free_id, ins_id: ins.ins_id })))
            .onConflict(['free_id', 'ins_id'])
            .ignore()

        await db('notificacao').insert(
            novas.map((ins) => ({
                usu_id: estatisticas.usu_id,
                not_titulo: 'Nova insígnia desbloqueada!',
                not_desc: `Você conquistou a insígnia "${ins.ins_nome}".`
            }))
        ).catch((erro) => console.error(erro))

        for (const ins of novas) {
            await enviarPush(estatisticas.usu_id, { titulo: 'Nova insígnia desbloqueada!', texto: `Você conquistou a insígnia "${ins.ins_nome}".` })
        }
    }

    return resultado
}

export async function resumoFreelancer(free_id) {
    const estatisticas = await estatisticasFreelancer(free_id)

    if (!estatisticas) return null

    const nivel = nivelPorXp(estatisticas.xp)

    return {
        xp: estatisticas.xp,
        nivel,
        xpNivelAtual: xpDoNivel(nivel),
        xpProximoNivel: xpDoNivel(nivel + 1),
        media: Number(estatisticas.media.toFixed(2)),
        totalAvaliacoes: estatisticas.totalAvaliacoes,
        concluidos: estatisticas.concluidos
    }
}

/* Conceder XP (e anotar no histórico, de onde sai o ranking do mês) */
export async function concederXp(trx, free_id, quantidade, motivo = 'xp') {
    const freelancer = await trx('freelancer').where('free_id', free_id).select('free_xp').first()

    if (!freelancer) return

    const xp = freelancer.free_xp + quantidade

    await trx('freelancer')
        .where('free_id', free_id)
        .update({ free_xp: xp, free_nivel: nivelPorXp(xp) })

    if (await temTabela('xp_evento')) {
        await trx('xp_evento').insert({ free_id, xpe_xp: quantidade, xpe_motivo: motivo })
    }
}

/* Rank */
export async function recalcularRank(trx, usu_id) {
    const [{ media }] = await trx('avaliacao').where('usu_avaliado', usu_id).whereRaw(avaliacaoVisivel()).avg('aval_nota as media')

    await trx('freelancer')
        .where('usu_id', usu_id)
        .update({ free_rank: media === null ? 0 : Number(media).toFixed(2) })
}

/* Avaliações */
export function listarAvaliacoesRecebidas(usu_id, limite = 10) {
    return db('avaliacao')
        .join('usuario', 'avaliacao.usu_avaliador', 'usuario.usu_id')
        .join('servico', 'avaliacao.serv_id', 'servico.serv_id')
        .where('avaliacao.usu_avaliado', usu_id)
        .whereRaw(avaliacaoVisivel())
        .select(
            'avaliacao.aval_id',
            'avaliacao.aval_nota',
            'avaliacao.aval_comentario',
            'avaliacao.aval_data',
            'servico.serv_titulo',
            'usuario.usu_nome as avaliador_nome',
            'usuario.usu_foto as avaliador_foto'
        )
        .orderBy('avaliacao.aval_id', 'desc')
        .limit(limite)
}

export async function reputacao(usu_id) {
    const [linha] = await db('avaliacao')
        .where('usu_avaliado', usu_id)
        .whereRaw(avaliacaoVisivel())
        .select(db.raw('COUNT(*) as total'), db.raw('AVG(aval_nota) as media'))

    return {
        media: linha.media === null ? 0 : Number(Number(linha.media).toFixed(2)),
        total: Number(linha.total)
    }
}
