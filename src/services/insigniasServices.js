import db from '../config/knex.js';

const NIVEIS = [
    { nome: 'Turmalina Paraíba', servicos: 100, avaliacoes: 70, media: 4.5 },
    { nome: 'Opala de Fogo',     servicos: 60,  avaliacoes: 45, media: 4.0 },
    { nome: 'Rubelita',          servicos: 30,  avaliacoes: 18, media: 3.5 },
    { nome: 'Quartzo Rosa',      servicos: 10,  avaliacoes: 6,  media: 3.0 }
];

export async function verificarInsignia(free_id) {
    const freelancer = await db('freelancer')
        .where('free_id', free_id)
        .select('usu_id')
        .first();

    if (!freelancer) {
        return null;
    }

    const resultadoServicos = await db('candidatura')
        .join('servico', 'candidatura.serv_id', 'servico.serv_id')
        .where('candidatura.free_id', free_id)
        .where('candidatura.cand_status', 'aceita')
        .where('servico.serv_status', 'finalizado')
        .countDistinct({ concluidos: 'servico.serv_id' })
        .first();

    const concluidos = Number(resultadoServicos.concluidos || 0);

    const resultadoAvaliacoes = await db('avaliacao')
        .join('servico', 'avaliacao.serv_id', 'servico.serv_id')
        .join('candidatura', 'candidatura.serv_id', 'servico.serv_id')
        .where('candidatura.free_id', free_id)
        .where('candidatura.cand_status', 'aceita')
        .where('servico.serv_status', 'finalizado')
        .where('avaliacao.usu_avaliado', freelancer.usu_id)
        .count({ total: 'avaliacao.aval_id' })
        .avg({ media: 'avaliacao.aval_nota' })
        .first();

    const totalAvaliacoes = Number(resultadoAvaliacoes.total || 0);
    const media = Number(resultadoAvaliacoes.media || 0);

    const nomeInsignia = NIVEIS.find(n =>
        concluidos >= n.servicos &&
        totalAvaliacoes >= n.avaliacoes &&
        media >= n.media
    )?.nome ?? null;

    let insignia = null;

    if (nomeInsignia) {
        insignia = await db('insignia')
            .where('ins_nome', nomeInsignia)
            .first();

        if (!insignia) {
            throw new Error(
                `A insígnia "${nomeInsignia}" não existe na tabela insignia.`
            );
        }
    }

    await db.transaction(async (trx) => {
        const atuais = await trx('freelancer_insignia')
            .where('free_id', free_id)
            .select('ins_id');

        const jaTemInsigniaCorreta =
            insignia &&
            atuais.length === 1 &&
            Number(atuais[0].ins_id) === Number(insignia.ins_id);

        if (jaTemInsigniaCorreta) {
            return;
        }

        await trx('freelancer_insignia').where('free_id', free_id).del();

        if (insignia) {
            await trx('freelancer_insignia').insert({
                free_id: free_id,
                ins_id: insignia.ins_id,
                freeins_data: trx.fn.now()
            });
        }
    });

    return {
        free_id: Number(free_id),
        servicos_concluidos: concluidos,
        total_avaliacoes: totalAvaliacoes,
        media_avaliacoes: Number(media.toFixed(2)),
        insignia: nomeInsignia
    };
}