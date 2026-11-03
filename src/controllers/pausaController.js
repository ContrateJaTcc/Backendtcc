import db from '../config/knex.js'
import { temColuna } from '../services/registro.js'
import { enviarPush } from '../services/push.js'

/*
 * Pausar o prazo: uma parte pede (com o motivo, ex.: "esperando o material do cliente"), a outra aceita.
 * Enquanto está pausado, os lembretes de prazo não saem. Ao retomar, os dias parados somam no prazo
 * (serv_qtd_dias), então tudo que calcula a data de entrega já sai certo.
 */

const DIA = 86_400_000
const MAX_DIAS_PAUSA = 60

async function notificar(usu_id, titulo, texto, url) {
    try {
        await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: texto })
        await enviarPush(usu_id, { titulo, texto, url })
    } catch (erro) {
        console.error(erro)
    }
}

/* Projeto em andamento com o dono e o freelancer contratado; null se a pessoa não participa */
export async function projetoDe(serv_id, usu_id) {
    const s = await db('servico')
        .join('contratante', 'servico.cont_id', 'contratante.cont_id')
        .where('servico.serv_id', serv_id)
        .select('servico.*', 'contratante.usu_id as dono')
        .first()
    if (!s) return null
    const contratado = await db('candidatura')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where({ 'candidatura.serv_id': serv_id, 'candidatura.cand_status': 'aceita' })
        .select('freelancer.usu_id')
        .first()
    s.freelancer = contratado?.usu_id ?? null
    if (usu_id !== s.dono && usu_id !== s.freelancer) return null
    s.outro = usu_id === s.dono ? s.freelancer : s.dono
    s.caminhoOutro = usu_id === s.dono ? '/freelancer/entregues' : '/contratante/historico'
    return s
}

export const pedirPausa = async (req, res) => {
    try {
        if (!(await temColuna('servico', 'serv_pausado_em'))) return res.status(503).json({ erro: 'A pausa ainda não está disponível no servidor.' })
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s) return res.status(404).json({ erro: 'Projeto não encontrado.' })
        if (s.serv_status !== 'em_andamento' || !s.freelancer) return res.status(400).json({ erro: 'Só dá para pausar projetos em andamento.' })
        if (s.serv_entregue_em) return res.status(400).json({ erro: 'O trabalho já foi entregue: não precisa pausar o prazo.' })
        if (s.serv_pausado_em) return res.status(400).json({ erro: 'O prazo já está pausado.' })
        if (s.serv_pausa_pedida_por) return res.status(400).json({ erro: 'Já existe um pedido de pausa esperando resposta.' })

        const motivo = String(req.body?.motivo ?? '').trim()
        if (motivo.length < 5 || motivo.length > 200) return res.status(400).json({ erro: 'Conte o motivo da pausa (de 5 a 200 letras).' })

        await db('servico').where('serv_id', s.serv_id).update({ serv_pausa_pedida_por: req.usuario.id, serv_pausa_motivo: motivo })
        await notificar(s.outro, 'Pedido de pausa no prazo', `Pediram para pausar o prazo de "${s.serv_titulo}": ${motivo}`, s.caminhoOutro)
        return res.json({ mensagem: 'Pedido enviado. O prazo pausa quando a outra pessoa aceitar.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao pedir a pausa.' })
    }
}

/* acao: aceitar | recusar | cancelar (quem pediu desiste) | retomar */
export const responderPausa = async (req, res) => {
    try {
        if (!(await temColuna('servico', 'serv_pausado_em'))) return res.status(503).json({ erro: 'A pausa ainda não está disponível no servidor.' })
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s) return res.status(404).json({ erro: 'Projeto não encontrado.' })
        const acao = req.body?.acao

        if (acao === 'aceitar' || acao === 'recusar' || acao === 'cancelar') {
            if (!s.serv_pausa_pedida_por) return res.status(400).json({ erro: 'Não há pedido de pausa esperando resposta.' })
            const pediu = s.serv_pausa_pedida_por === req.usuario.id
            if (acao === 'cancelar' ? !pediu : pediu) return res.status(403).json({ erro: acao === 'cancelar' ? 'Só quem pediu pode desistir.' : 'Quem responde é a outra pessoa.' })

            if (acao === 'aceitar') {
                await db('servico').where('serv_id', s.serv_id).update({ serv_pausado_em: db.fn.now(), serv_pausa_pedida_por: null })
                await notificar(s.outro, 'Prazo pausado', `A pausa de "${s.serv_titulo}" foi aceita. O prazo fica parado até alguém retomar.`, s.caminhoOutro)
                return res.json({ mensagem: 'Prazo pausado. Retome quando o trabalho puder continuar.' })
            }
            await db('servico').where('serv_id', s.serv_id).update({ serv_pausa_pedida_por: null, serv_pausa_motivo: null })
            if (acao === 'recusar') await notificar(s.outro, 'Pausa recusada', `O pedido de pausa de "${s.serv_titulo}" foi recusado. Conversem pelo chat.`, s.caminhoOutro)
            return res.json({ mensagem: acao === 'recusar' ? 'Pedido recusado.' : 'Pedido cancelado.' })
        }

        if (acao === 'retomar') {
            if (!s.serv_pausado_em) return res.status(400).json({ erro: 'O prazo não está pausado.' })
            const dias = Math.min(MAX_DIAS_PAUSA, Math.max(1, Math.ceil((Date.now() - new Date(s.serv_pausado_em).getTime()) / DIA)))
            await db('servico').where('serv_id', s.serv_id).update({
                serv_pausado_em: null,
                serv_pausa_motivo: null,
                serv_qtd_dias: (Number(s.serv_qtd_dias) || 0) + dias,
                serv_pausa_dias: (Number(s.serv_pausa_dias) || 0) + dias,
                /* O prazo mudou: os lembretes podem sair de novo */
                ...((await temColuna('servico', 'serv_lembrete_prazo_em')) ? { serv_lembrete_prazo_em: null, serv_lembrete_atraso_em: null } : {})
            })
            const texto = `O prazo de "${s.serv_titulo}" voltou a correr, com ${dias === 1 ? '1 dia a mais' : `${dias} dias a mais`}.`
            await notificar(s.outro, 'Prazo retomado', texto, s.caminhoOutro)
            return res.json({ mensagem: texto, dias })
        }

        return res.status(400).json({ erro: 'Ação inválida.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao responder a pausa.' })
    }
}
