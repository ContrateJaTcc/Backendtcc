import db from '../config/knex.js';
import { verificarInsignia } from '../services/insigniasServices.js';

export async function consultarInsignia(req, res) {
    try {
        const free_id = Number(req.params.free_id);

        if (!Number.isInteger(free_id) || free_id <= 0) {
            return res.status(400).json({
                erro: 'O free_id deve ser um número inteiro positivo.'
            });
        }

        const resultado = await verificarInsignia(free_id);

        if (!resultado) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            });
        }

        return res.status(200).json(resultado);
    } catch (erro) {
        console.error('Erro ao consultar insígnia:', erro);

        return res.status(500).json({
            erro: 'Não foi possível consultar a insígnia.'
        });
    }
}

export async function consultarInsigniaPorUsuario(req, res) {
    try {
        const usu_id = Number(req.params.usu_id);

        if (!Number.isInteger(usu_id) || usu_id <= 0) {
            return res.status(400).json({
                erro: 'O usu_id deve ser um número inteiro positivo.'
            });
        }

        const freelancer = await db('freelancer')
            .where('usu_id', usu_id)
            .select('free_id')
            .first();

        if (!freelancer) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            });
        }

        const resultado = await verificarInsignia(freelancer.free_id);

        return res.status(200).json(resultado);
    } catch (erro) {
        console.error('Erro ao consultar insígnia por usuário:', erro);

        return res.status(500).json({
            erro: 'Não foi possível consultar a insígnia.'
        });
    }
}