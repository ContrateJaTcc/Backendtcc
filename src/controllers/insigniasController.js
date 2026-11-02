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
