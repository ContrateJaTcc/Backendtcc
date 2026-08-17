import db from '../config/knex.js'

export const listarUsuarios = () => {
    return db('usuario').select(
        'usu_id',
        'usu_nome',
        'usu_email',
        'usu_cpf',
        'usu_tel',
        'usu_data_nasc',
        'usu_cid',
        'usu_est',
        'usu_desc',
        'usu_foto',
        'tipo_usuario',
        'status_conta',
        'data_criacao',
        'data_atualizacao'
    )
}

export const buscarUsuarioPorId = (id) => {
    return db('usuario')
        .select(
            'usu_id',
            'usu_nome',
            'usu_email',
            'usu_cpf',
            'usu_tel',
            'usu_data_nasc',
            'usu_cid',
            'usu_est',
            'usu_desc',
            'usu_foto',
            'tipo_usuario',
            'status_conta',
            'data_criacao',
            'data_atualizacao'
        )
        .where('usu_id', id)
        .first()
}

export const buscarUsuarioPorEmail = (email) => {
    return db('usuario')
        .where('usu_email', email)
        .first()
}

export const criarUsuario = (dados) => {
    return db('usuario').insert(dados)
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