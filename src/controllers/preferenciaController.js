import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'
import { CANAIS, CATEGORIAS, lerPreferencia, limparPreferencia } from '../services/avisos.js'

/* Configurações guardadas na conta: avisos por tipo, privacidade e cartas de candidatura salvas */

const semMigracao = (res) => res.status(503).json({ erro: 'Esta opção ainda não está disponível no servidor (falta rodar as migrações).' })

export const verAvisos = async (req, res) => {
    try {
        if (!(await temColuna('usuario', 'usu_avisos'))) return res.json({ disponivel: false, categorias: CATEGORIAS, canais: CANAIS, avisos: lerPreferencia(null) })
        const u = await db('usuario').where('usu_id', req.usuario.id).select('usu_avisos').first()
        return res.json({ disponivel: true, categorias: CATEGORIAS, canais: CANAIS, avisos: lerPreferencia(u?.usu_avisos) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os avisos.' })
    }
}

export const salvarAvisos = async (req, res) => {
    try {
        if (!(await temColuna('usuario', 'usu_avisos'))) return semMigracao(res)
        const desligados = limparPreferencia(req.body?.avisos)
        await db('usuario').where('usu_id', req.usuario.id).update({ usu_avisos: JSON.stringify(desligados) })
        return res.json({ mensagem: 'Avisos salvos.', avisos: lerPreferencia(JSON.stringify(desligados)) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao salvar os avisos.' })
    }
}

export const verPrivacidade = async (req, res) => {
    try {
        if (!(await temColuna('usuario', 'usu_mostrar_online'))) return res.json({ disponivel: false, mostrar_online: true, aparecer_busca: true })
        const u = await db('usuario').where('usu_id', req.usuario.id).select('usu_mostrar_online', 'usu_aparecer_busca').first()
        return res.json({ disponivel: true, mostrar_online: Boolean(u?.usu_mostrar_online), aparecer_busca: Boolean(u?.usu_aparecer_busca) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar a privacidade.' })
    }
}

export const salvarPrivacidade = async (req, res) => {
    try {
        if (!(await temColuna('usuario', 'usu_mostrar_online'))) return semMigracao(res)
        const dados = {}
        if (typeof req.body?.mostrar_online === 'boolean') dados.usu_mostrar_online = req.body.mostrar_online
        if (typeof req.body?.aparecer_busca === 'boolean') dados.usu_aparecer_busca = req.body.aparecer_busca
        if (!Object.keys(dados).length) return res.status(400).json({ erro: 'Nada para salvar.' })
        await db('usuario').where('usu_id', req.usuario.id).update(dados)
        return res.json({ mensagem: 'Privacidade salva.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao salvar a privacidade.' })
    }
}

/* ---------- Cartas de candidatura salvas ---------- */

const MAX_MODELOS = 10
const LIMITE_TEXTO = 500

function lerModelo(corpo) {
    const titulo = String(corpo?.titulo ?? '').trim()
    const texto = String(corpo?.texto ?? '').trim()
    if (!titulo || titulo.length > 60) return { erro: 'Dê um nome de até 60 letras para a carta.' }
    if (texto.length < 10) return { erro: 'A carta precisa de pelo menos 10 letras.' }
    if (texto.length > LIMITE_TEXTO) return { erro: `A carta pode ter até ${LIMITE_TEXTO} letras.` }
    return { mod_titulo: titulo, mod_texto: texto }
}

export const listarModelos = async (req, res) => {
    try {
        if (!(await temTabela('modelo_recado'))) return res.json({ disponivel: false, modelos: [] })
        const modelos = await db('modelo_recado').where('usu_id', req.usuario.id).orderBy('mod_id').select('mod_id', 'mod_titulo', 'mod_texto')
        return res.json({ disponivel: true, modelos })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as cartas.' })
    }
}

export const criarModelo = async (req, res) => {
    try {
        if (!(await temTabela('modelo_recado'))) return semMigracao(res)
        const dados = lerModelo(req.body)
        if (dados.erro) return res.status(400).json({ erro: dados.erro })
        const [{ total }] = await db('modelo_recado').where('usu_id', req.usuario.id).count('* as total')
        if (Number(total) >= MAX_MODELOS) return res.status(400).json({ erro: `Dá para guardar até ${MAX_MODELOS} cartas. Apague uma para criar outra.` })
        const [mod_id] = await db('modelo_recado').insert({ ...dados, usu_id: req.usuario.id })
        return res.status(201).json({ mensagem: 'Carta guardada.', modelo: { mod_id, ...dados } })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao guardar a carta.' })
    }
}

export const editarModelo = async (req, res) => {
    try {
        if (!(await temTabela('modelo_recado'))) return semMigracao(res)
        const dados = lerModelo(req.body)
        if (dados.erro) return res.status(400).json({ erro: dados.erro })
        const alteradas = await db('modelo_recado').where({ mod_id: req.params.id, usu_id: req.usuario.id }).update(dados)
        if (!alteradas) return res.status(404).json({ erro: 'Carta não encontrada.' })
        return res.json({ mensagem: 'Carta atualizada.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao atualizar a carta.' })
    }
}

export const apagarModelo = async (req, res) => {
    try {
        if (!(await temTabela('modelo_recado'))) return semMigracao(res)
        const apagadas = await db('modelo_recado').where({ mod_id: req.params.id, usu_id: req.usuario.id }).del()
        if (!apagadas) return res.status(404).json({ erro: 'Carta não encontrada.' })
        return res.json({ mensagem: 'Carta apagada.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao apagar a carta.' })
    }
}
