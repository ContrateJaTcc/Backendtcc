import express from 'express'
import db from '../config/knex.js'

const router = express.Router()

/* Tipos de serviço */
router.get('/', async (req, res) => {
    try {
        const tipos = await db('tipo_servico')
            .select('tipo_id', 'tipo_nome', 'tipo_desc')
            .orderBy('tipo_nome')

        return res.status(200).json({ tipos })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao listar tipos de serviço'
        })
    }
})

export default router
