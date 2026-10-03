import express from 'express'
import db from '../config/knex.js'

const router = express.Router()

/*
 * Publico de proposito: o select de categorias aparece antes do login no
 * fluxo de cadastro de projeto, e a lista nao tem nada sensivel.
 *
 * Existe para o frontend parar de mapear nome -> id na mao. Aquele mapa
 * quebrava de duas formas: se os ids do banco fossem outros, o insert
 * falhava na FK; e ao editar um projeto, um nome com acento diferente do
 * escrito no mapa dava "Categoria invalida" sem o usuario conseguir salvar.
 */
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
