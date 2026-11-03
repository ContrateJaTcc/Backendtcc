import db from '../config/knex.js'
import { temColuna, temTabela, registrarAcao } from '../services/registro.js'
import { registrarErro } from '../services/monitor.js'
import { enviarPush } from '../services/push.js'

/* Administração: fila de revisão do filtro de spam e monitor de erros */

export const filaModeracao = async (req, res) => {
    try {
        if (!(await temColuna('servico', 'serv_moderacao'))) return res.json({ disponivel: false, projetos: [] })
        const projetos = await db('servico')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .where('servico.serv_moderacao', 'pendente')
            .select(
                'servico.serv_id', 'servico.serv_titulo', 'servico.serv_desc', 'servico.serv_valor', 'servico.serv_tipo_valor',
                'servico.serv_moderacao_motivo', 'servico.serv_data_criacao', 'tipo_servico.tipo_nome', 'usuario.usu_id', 'usuario.usu_nome'
            )
            .orderBy('servico.serv_id')
        return res.json({ disponivel: true, projetos })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar a fila de revisão.' })
    }
}

/* acao: aprovar | recusar (com motivo para o contratante) */
export const decidirModeracao = async (req, res) => {
    try {
        if (!(await temColuna('servico', 'serv_moderacao'))) return res.status(503).json({ erro: 'Falta rodar as migrações.' })
        const { acao } = req.body ?? {}
        const motivo = String(req.body?.motivo ?? '').trim().slice(0, 200)
        if (!['aprovar', 'recusar'].includes(acao)) return res.status(400).json({ erro: 'Ação inválida.' })
        if (acao === 'recusar' && motivo.length < 5) return res.status(400).json({ erro: 'Explique ao contratante por que o projeto foi recusado.' })

        const s = await db('servico')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .where('servico.serv_id', req.params.id)
            .where('servico.serv_moderacao', 'pendente')
            .select('servico.serv_id', 'servico.serv_titulo', 'contratante.usu_id as dono')
            .first()
        if (!s) return res.status(404).json({ erro: 'Projeto não está na fila de revisão.' })

        await db('servico').where('serv_id', s.serv_id).update({
            serv_moderacao: acao === 'aprovar' ? 'aprovado' : 'recusado',
            serv_moderacao_motivo: acao === 'aprovar' ? null : motivo
        })
        await registrarAcao(req, acao === 'aprovar' ? 'aprovar_projeto' : 'recusar_projeto', { alvo: s.dono, detalhe: `${s.serv_titulo}${motivo ? `: ${motivo}` : ''}`.slice(0, 200) })

        const titulo = acao === 'aprovar' ? 'Projeto aprovado' : 'Projeto não aprovado'
        const texto = acao === 'aprovar'
            ? `"${s.serv_titulo}" passou na revisão e já aparece para os freelancers.`
            : `"${s.serv_titulo}" não foi publicado: ${motivo}. Edite o projeto para mandar de novo.`
        await db('notificacao').insert({ usu_id: s.dono, not_titulo: titulo, not_desc: texto })
        await enviarPush(s.dono, { titulo, texto, url: '/contratante' })

        return res.json({ mensagem: acao === 'aprovar' ? 'Projeto aprovado e publicado.' : 'Projeto recusado. O contratante foi avisado.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao decidir a revisão.' })
    }
}

/* ---------- Monitor de erros ---------- */

/* O navegador manda os erros do site (rota pública, com limite de tentativas) */
export const receberErroSite = async (req, res) => {
    const mensagem = String(req.body?.mensagem ?? '').trim()
    if (mensagem) await registrarErro({ origem: 'site', mensagem, local: String(req.body?.local ?? '').slice(0, 300) || null })
    return res.status(204).end()
}

export const listarErros = async (req, res) => {
    try {
        if (!(await temTabela('erro_registro'))) return res.json({ disponivel: false, erros: [] })
        const erros = await db('erro_registro')
            .select('err_id', 'err_origem', 'err_mensagem', 'err_local', 'err_total', 'err_primeira', 'err_ultima')
            .orderBy('err_ultima', 'desc')
            .limit(100)
        return res.json({ disponivel: true, erros })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os erros.' })
    }
}

/* Apaga um (resolvido) ou todos */
export const limparErros = async (req, res) => {
    try {
        if (!(await temTabela('erro_registro'))) return res.status(204).end()
        const q = db('erro_registro')
        if (req.params.id) q.where('err_id', req.params.id)
        await q.del()
        await registrarAcao(req, 'limpar_erros', { detalhe: req.params.id ? `erro ${req.params.id}` : 'todos' })
        return res.json({ mensagem: req.params.id ? 'Erro marcado como resolvido.' : 'Lista de erros limpa.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao limpar os erros.' })
    }
}
