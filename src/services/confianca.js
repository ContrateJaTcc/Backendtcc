import db from '../config/knex.js'

/*
 * Sinais de confiança do freelancer:
 * - verificado: conta ativa (o e-mail já foi confirmado no cadastro), foto, descrição,
 *   pelo menos uma área de atuação e pelo menos um projeto concluído;
 * - tempo de resposta: mediana do tempo até responder uma mensagem recebida (últimos 60 dias).
 */

const JANELA_DIAS = 60
/* Respostas depois de 3 dias não contam: viram conversa nova, não demora */
const RESPOSTA_MAXIMA = 3 * 86_400_000

export async function verificacao(usu_id) {
    const u = await db('usuario')
        .join('freelancer', 'usuario.usu_id', 'freelancer.usu_id')
        .where('usuario.usu_id', usu_id)
        .select('usuario.status_conta', 'usuario.usu_foto', 'usuario.usu_desc', 'freelancer.free_id')
        .first()

    if (!u) return { verificado: false, criterios: [] }

    const [[{ areas }], [{ concluidos }]] = await Promise.all([
        db('freelancer_tipo_servico').where('free_id', u.free_id).count('* as areas'),
        db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .where('candidatura.free_id', u.free_id)
            .where('candidatura.cand_status', 'aceita')
            .where('servico.serv_status', 'finalizado')
            .count('* as concluidos')
    ])

    const criterios = [
        { codigo: 'conta', rotulo: 'Conta confirmada', ok: u.status_conta === 'ativa' },
        { codigo: 'foto', rotulo: 'Foto no perfil', ok: Boolean(u.usu_foto) },
        { codigo: 'sobre', rotulo: 'Descrição preenchida', ok: Boolean(String(u.usu_desc ?? '').trim()) },
        { codigo: 'areas', rotulo: 'Áreas de atuação', ok: Number(areas) > 0 },
        { codigo: 'entrega', rotulo: 'Primeiro projeto concluído', ok: Number(concluidos) > 0 }
    ]

    return { verificado: criterios.every((c) => c.ok), criterios }
}

/* Mediana em minutos (null quando ainda não há respostas suficientes) */
export async function tempoResposta(usu_id) {
    const desde = new Date(Date.now() - JANELA_DIAS * 86_400_000)

    const mensagens = await db('mensagem')
        .where((q) => q.where('usu_remetente', usu_id).orWhere('usu_destinatario', usu_id))
        .where('msg_data', '>=', desde)
        .select('serv_id', 'usu_remetente', 'usu_destinatario', 'msg_data')
        .orderBy('msg_data')

    /* Para cada conversa, a primeira mensagem recebida sem resposta espera a próxima que a pessoa mandar */
    const esperando = new Map()
    const tempos = []

    for (const m of mensagens) {
        const outro = m.usu_remetente === usu_id ? m.usu_destinatario : m.usu_remetente
        const chave = `${m.serv_id}:${outro}`
        const quando = new Date(m.msg_data).getTime()

        if (m.usu_destinatario === usu_id) {
            if (!esperando.has(chave)) esperando.set(chave, quando)
        } else if (esperando.has(chave)) {
            const demora = quando - esperando.get(chave)
            if (demora >= 0 && demora <= RESPOSTA_MAXIMA) tempos.push(demora)
            esperando.delete(chave)
        }
    }

    if (tempos.length < 2) return null

    tempos.sort((a, b) => a - b)
    const meio = Math.floor(tempos.length / 2)
    const mediana = tempos.length % 2 ? tempos[meio] : (tempos[meio - 1] + tempos[meio]) / 2

    return Math.max(1, Math.round(mediana / 60_000))
}
