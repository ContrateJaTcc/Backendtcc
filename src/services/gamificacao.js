import db from '../config/knex.js'

/*
 * Regras de XP, nivel e insignias do freelancer.
 *
 * XP:
 *   - projeto concluido: +100
 *   - avaliacao recebida: +20 por estrela (5 estrelas = +100)
 *
 * Nivel: o XP necessario cresce a cada nivel (curva quadratica), para que os
 * primeiros niveis venham rapido e os seguintes exijam constancia.
 *   nivel 2 = 50 XP, 3 = 200, 4 = 450, 5 = 800, 6 = 1250 ...
 * Um projeto concluido com nota 5 rende 200 XP.
 */
export const XP_PROJETO_CONCLUIDO = 100
export const XP_POR_ESTRELA = 20

const XP_BASE_NIVEL = 50

export const xpDoNivel = (nivel) => XP_BASE_NIVEL * (nivel - 1) ** 2

export const nivelPorXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / XP_BASE_NIVEL)) + 1

/*
 * Catalogo de regras. O codigo casa com insignia.ins_codigo (a migration
 * 20261002000000_gamificacao insere as linhas). Cada regra devolve o
 * progresso atual e a meta, para a tela mostrar "3/5" nas bloqueadas.
 */
const REGRAS = {
    primeiro_projeto: (e) => ({ progresso: e.concluidos, meta: 1 }),
    em_ascensao: (e) => ({ progresso: e.concluidos, meta: 5 }),
    veterano: (e) => ({ progresso: e.concluidos, meta: 10 }),
    nota_maxima: (e) => ({ progresso: e.notasCinco, meta: 1 }),
    /* Exige a media alem da quantidade: com media baixa o progresso trava
       um passo antes da meta, em vez de parecer concluido. */
    favorito: (e) => ({
        progresso: e.media >= 4.8 ? e.totalAvaliacoes : Math.min(e.totalAvaliacoes, 4),
        meta: 5
    }),
    vitrine: (e) => ({ progresso: e.itensPortfolio, meta: 3 }),
    perfil_completo: (e) => ({ progresso: e.itensPerfil, meta: 3 }),
    nivel_5: (e) => ({ progresso: e.nivel, meta: 5 })
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
        .select(
            conexao.raw('COUNT(*) as total'),
            conexao.raw('AVG(aval_nota) as media'),
            conexao.raw('SUM(aval_nota = 5) as cinco')
        )

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
        itensPerfil:
            (freelancer.usu_foto ? 1 : 0) +
            (freelancer.usu_desc?.trim() ? 1 : 0) +
            (Number(areas) > 0 ? 1 : 0)
    }
}

/*
 * Concede as insignias que o freelancer ja cumpre e ainda nao tem, e devolve
 * o catalogo completo com o estado de cada uma.
 *
 * Roda na leitura do perfil em vez de em cada evento (portfolio, foto, areas,
 * avaliacao...): assim nenhuma acao esquecida deixa de conceder a insignia.
 * Nunca remove — insignia conquistada fica, mesmo que o portfolio diminua.
 */
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
        /* insert ignore: duas abas abertas podem sincronizar ao mesmo tempo. */
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

/* Soma XP e recalcula o nivel na mesma escrita. Usar dentro da transaction
   do evento que gerou o XP. */
export async function concederXp(trx, free_id, quantidade) {
    const freelancer = await trx('freelancer').where('free_id', free_id).select('free_xp').first()

    if (!freelancer) return

    const xp = freelancer.free_xp + quantidade

    await trx('freelancer')
        .where('free_id', free_id)
        .update({ free_xp: xp, free_nivel: nivelPorXp(xp) })
}

/* free_rank guarda a media das notas recebidas (0.00 a 5.00). */
export async function recalcularRank(trx, usu_id) {
    const [{ media }] = await trx('avaliacao').where('usu_avaliado', usu_id).avg('aval_nota as media')

    await trx('freelancer')
        .where('usu_id', usu_id)
        .update({ free_rank: media === null ? 0 : Number(media).toFixed(2) })
}

/* Ultimas avaliacoes recebidas por um usuario (freelancer ou contratante). */
export function listarAvaliacoesRecebidas(usu_id, limite = 10) {
    return db('avaliacao')
        .join('usuario', 'avaliacao.usu_avaliador', 'usuario.usu_id')
        .join('servico', 'avaliacao.serv_id', 'servico.serv_id')
        .where('avaliacao.usu_avaliado', usu_id)
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
        .select(db.raw('COUNT(*) as total'), db.raw('AVG(aval_nota) as media'))

    return {
        media: linha.media === null ? 0 : Number(Number(linha.media).toFixed(2)),
        total: Number(linha.total)
    }
}
