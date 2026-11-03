import db from '../config/knex.js'
import { temTabela } from '../services/registro.js'

/* Projetos salvos pelo freelancer para ver depois */

async function disponivel(res) {
    if (await temTabela('servico_salvo')) return true
    res.status(503).json({ erro: 'Projetos salvos ainda não disponíveis.' })
    return false
}

const idsSalvos = (usu_id) => db('servico_salvo').where('usu_id', usu_id).orderBy('sal_data', 'desc').pluck('serv_id')

export const listarSalvos = async (req, res) => {
    try {
        if (!(await disponivel(res))) return
        return res.json({ ids: await idsSalvos(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os projetos salvos.' })
    }
}

export const salvar = async (req, res) => {
    try {
        if (!(await disponivel(res))) return

        const servico = await db('servico').where('serv_id', req.params.id).select('serv_id').first()

        if (!servico) {
            return res.status(404).json({ erro: 'Projeto não encontrado.' })
        }

        await db('servico_salvo')
            .insert({ usu_id: req.usuario.id, serv_id: servico.serv_id })
            .onConflict(['usu_id', 'serv_id'])
            .ignore()

        return res.json({ mensagem: 'Projeto salvo.', ids: await idsSalvos(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao salvar o projeto.' })
    }
}

export const remover = async (req, res) => {
    try {
        if (!(await disponivel(res))) return

        await db('servico_salvo').where({ usu_id: req.usuario.id, serv_id: req.params.id }).del()

        return res.json({ mensagem: 'Projeto tirado dos salvos.', ids: await idsSalvos(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao tirar o projeto dos salvos.' })
    }
}
