import db from '../config/knex.js'
import { temTabela } from '../services/registro.js'
import { enviarPush } from '../services/push.js'
import { bloqueados } from '../services/bloqueio.js'

/*
 * Pedido de orçamento rápido: o contratante manda a mesma pergunta para até 3 freelancers
 * ("quanto cobra por um site de 5 páginas?") e vê as respostas lado a lado, antes de criar o projeto.
 */

const MAX_FREELANCERS = 3
const semMigracao = (res) => res.status(503).json({ erro: 'Esta opção ainda não está disponível no servidor (falta rodar as migrações).' })

export const criarPedido = async (req, res) => {
    try {
        if (!(await temTabela('orcamento_pedido'))) return semMigracao(res)
        const pergunta = String(req.body?.pergunta ?? '').trim()
        const ids = [...new Set((Array.isArray(req.body?.freelancers) ? req.body.freelancers : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))]
        if (pergunta.length < 15 || pergunta.length > 600) return res.status(400).json({ erro: 'Descreva o que precisa em 15 a 600 letras.' })
        if (ids.length < 1 || ids.length > MAX_FREELANCERS) return res.status(400).json({ erro: `Escolha de 1 a ${MAX_FREELANCERS} freelancers.` })

        const freelancers = await db('usuario').whereIn('usu_id', ids).where({ tipo_usuario: 'freelancer', status_conta: 'ativa' }).select('usu_id', 'usu_nome')
        if (freelancers.length !== ids.length) return res.status(400).json({ erro: 'Algum dos freelancers escolhidos não está disponível.' })
        for (const f of freelancers) if (await bloqueados(req.usuario.id, f.usu_id)) return res.status(403).json({ erro: `Não dá para pedir orçamento para ${f.usu_nome.split(' ')[0]}.` })

        const tipo_id = Number(req.body?.tipo_id) || null
        const orc_id = await db.transaction(async (trx) => {
            const [id] = await trx('orcamento_pedido').insert({ usu_id: req.usuario.id, orc_pergunta: pergunta, tipo_id })
            await trx('orcamento_resposta').insert(ids.map((usu_id) => ({ orc_id: id, usu_id })))
            return id
        })
        const eu = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        const titulo = 'Pedido de orçamento'
        const texto = `${eu?.usu_nome?.split(' ')[0] ?? 'Um contratante'} quer saber quanto você cobra: "${pergunta.slice(0, 100)}${pergunta.length > 100 ? '...' : ''}"`
        await db('notificacao').insert(ids.map((usu_id) => ({ usu_id, not_titulo: titulo, not_desc: texto })))
        await enviarPush(ids, { titulo, texto, url: '/freelancer/orcamentos' })
        return res.status(201).json({ mensagem: `Pedido enviado para ${ids.length} ${ids.length === 1 ? 'freelancer' : 'freelancers'}.`, orc_id })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao pedir o orçamento.' })
    }
}

/* Contratante: os pedidos dele com as respostas; freelancer: os pedidos que recebeu */
export const listarPedidos = async (req, res) => {
    try {
        if (!(await temTabela('orcamento_pedido'))) return res.json({ disponivel: false, pedidos: [] })
        const contratante = req.usuario.tipo === 'contratante'
        const pedidos = contratante
            ? await db('orcamento_pedido').where('usu_id', req.usuario.id).orderBy('orc_id', 'desc').limit(50)
            : await db('orcamento_pedido')
                .join('orcamento_resposta', 'orcamento_resposta.orc_id', 'orcamento_pedido.orc_id')
                .where('orcamento_resposta.usu_id', req.usuario.id)
                .select('orcamento_pedido.*')
                .orderBy('orcamento_pedido.orc_id', 'desc')
                .limit(50)
        const ids = pedidos.map((p) => p.orc_id)
        const respostas = ids.length
            ? await db('orcamento_resposta')
                .join('usuario', 'orcamento_resposta.usu_id', 'usuario.usu_id')
                .whereIn('orcamento_resposta.orc_id', ids)
                .modify((q) => {
                    if (!contratante) q.where('orcamento_resposta.usu_id', req.usuario.id)
                })
                .select('orcamento_resposta.*', 'usuario.usu_nome', 'usuario.usu_foto')
            : []
        const autores = contratante ? [] : await db('usuario').whereIn('usu_id', [...new Set(pedidos.map((p) => p.usu_id))]).select('usu_id', 'usu_nome')
        return res.json({
            disponivel: true,
            pedidos: pedidos.map((p) => ({
                orc_id: p.orc_id,
                pergunta: p.orc_pergunta,
                tipo_id: p.tipo_id,
                fechado: Boolean(p.orc_fechado),
                data: p.orc_data,
                ...(contratante ? {} : { contratante: autores.find((a) => a.usu_id === p.usu_id)?.usu_nome ?? 'Contratante' }),
                respostas: respostas
                    .filter((r) => r.orc_id === p.orc_id)
                    .map((r) => ({
                        usu_id: r.usu_id,
                        nome: r.usu_nome,
                        foto: r.usu_foto,
                        status: r.res_status,
                        valor: r.res_valor === null ? null : Number(r.res_valor),
                        prazo: r.res_prazo,
                        texto: r.res_texto,
                        data: r.res_data
                    }))
            }))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os orçamentos.' })
    }
}

/* Freelancer responde (valor e/ou prazo e um recado) ou recusa */
export const responderPedido = async (req, res) => {
    try {
        if (!(await temTabela('orcamento_resposta'))) return semMigracao(res)
        const chave = { orc_id: Number(req.params.id), usu_id: req.usuario.id }
        const resposta = await db('orcamento_resposta').where(chave).first()
        const pedido = await db('orcamento_pedido').where('orc_id', chave.orc_id).first()
        if (!resposta || !pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' })
        if (pedido.orc_fechado) return res.status(400).json({ erro: 'O contratante já encerrou este pedido.' })

        if (req.body?.recusar) {
            await db('orcamento_resposta').where(chave).update({ res_status: 'recusado', res_data: db.fn.now() })
            return res.json({ mensagem: 'Pedido recusado.' })
        }
        const valor = req.body?.valor === '' || req.body?.valor == null ? null : Number(req.body.valor)
        const prazo = req.body?.prazo === '' || req.body?.prazo == null ? null : Number(req.body.prazo)
        const texto = String(req.body?.texto ?? '').trim().slice(0, 500) || null
        if (valor !== null && (!Number.isFinite(valor) || valor <= 0 || valor > 1_000_000)) return res.status(400).json({ erro: 'Valor inválido.' })
        if (prazo !== null && (!Number.isInteger(prazo) || prazo < 1 || prazo > 365)) return res.status(400).json({ erro: 'O prazo vai de 1 a 365 dias.' })
        if (valor === null && !texto) return res.status(400).json({ erro: 'Informe o valor ou explique como você cobra.' })

        await db('orcamento_resposta').where(chave).update({ res_valor: valor, res_prazo: prazo, res_texto: texto, res_status: 'respondido', res_data: db.fn.now() })
        const eu = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        const titulo = 'Orçamento respondido'
        const aviso = `${eu?.usu_nome?.split(' ')[0] ?? 'Um freelancer'} respondeu o seu pedido de orçamento.`
        await db('notificacao').insert({ usu_id: pedido.usu_id, not_titulo: titulo, not_desc: aviso })
        await enviarPush(pedido.usu_id, { titulo, texto: aviso, url: '/contratante/orcamentos' })
        return res.json({ mensagem: 'Orçamento enviado ao contratante.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao responder o orçamento.' })
    }
}

export const fecharPedido = async (req, res) => {
    try {
        if (!(await temTabela('orcamento_pedido'))) return semMigracao(res)
        const alteradas = await db('orcamento_pedido').where({ orc_id: req.params.id, usu_id: req.usuario.id }).update({ orc_fechado: true })
        if (!alteradas) return res.status(404).json({ erro: 'Pedido não encontrado.' })
        return res.json({ mensagem: 'Pedido encerrado.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao encerrar o pedido.' })
    }
}
