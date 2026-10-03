import db from '../config/knex.js'

/*
 * Duas projecoes de proposito.
 *
 * CAMPOS_PUBLICOS: o que qualquer usuario logado pode ver de outra pessoa.
 * Nao inclui CPF, telefone, e-mail nem data de nascimento — antes a listagem
 * devolvia tudo isso de todo mundo.
 *
 * CAMPOS_PROPRIOS: o perfil completo, so para o dono da conta.
 * Nenhuma das duas inclui usu_senha.
 */
const CAMPOS_PUBLICOS = [
    'usu_id',
    'usu_nome',
    'usu_cid',
    'usu_est',
    'usu_desc',
    'usu_foto',
    'tipo_usuario',
    'status_conta',
    'data_criacao'
]

const CAMPOS_PROPRIOS = [
    ...CAMPOS_PUBLICOS,
    'usu_email',
    'usu_cpf',
    'usu_tel',
    'usu_data_nasc',
    'data_atualizacao'
]

export const listarUsuarios = () => {
    return db('usuario').select(CAMPOS_PUBLICOS)
}

export const buscarUsuarioPorId = (id) => {
    return db('usuario')
        .select(CAMPOS_PUBLICOS)
        .where('usu_id', id)
        .first()
}

export const buscarPerfilCompleto = (id) => {
    return db('usuario')
        .select(CAMPOS_PROPRIOS)
        .where('usu_id', id)
        .first()
}

export const buscarUsuarioPorEmail = (email) => {
    return db('usuario')
        .where('usu_email', email)
        .first()
}

export const atualizarUsuario = (id, dados) => {
    return db('usuario')
        .where('usu_id', id)
        .update(dados)
}

export const deletarUsuario = (id) => {
    return db('usuario')
        .where('usu_id', id)
        .del()
}

/*
 * Areas de atuacao do freelancer.
 *
 * freelancer_tipo_servico ja existia na migration (free_id + tipo_id, chave
 * primaria composta) e nunca tinha sido usada. Como em portfolio, a tabela
 * referencia freelancer.free_id, nao usuario.usu_id.
 */
export const buscarFreelancerPorUsuario = (usu_id) => {
    return db('freelancer').select('free_id').where('usu_id', usu_id).first()
}

export const listarAreas = (free_id) => {
    return db('freelancer_tipo_servico')
        .join('tipo_servico', 'freelancer_tipo_servico.tipo_id', 'tipo_servico.tipo_id')
        .where('freelancer_tipo_servico.free_id', free_id)
        .select('tipo_servico.tipo_id', 'tipo_servico.tipo_nome')
        .orderBy('tipo_servico.tipo_nome')
}

/*
 * Substitui o conjunto inteiro de areas numa transaction: apagar e inserir
 * precisam acontecer juntos, senao uma falha no meio deixaria o freelancer
 * sem nenhuma area salva.
 */
export const substituirAreas = (free_id, tipos) => {
    return db.transaction(async (trx) => {
        await trx('freelancer_tipo_servico').where('free_id', free_id).del()

        if (tipos.length > 0) {
            await trx('freelancer_tipo_servico').insert(
                tipos.map((tipo_id) => ({ free_id, tipo_id }))
            )
        }
    })
}

/* Confere quais dos ids enviados existem de fato em tipo_servico. */
export const filtrarTiposExistentes = async (tipos) => {
    const linhas = await db('tipo_servico').select('tipo_id').whereIn('tipo_id', tipos)

    return linhas.map((l) => l.tipo_id)
}
