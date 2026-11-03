import db from '../config/knex.js'

/* Campos */
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

/* Áreas */
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

/* Substituir áreas */
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

/* Tipos existentes */
export const filtrarTiposExistentes = async (tipos) => {
    const linhas = await db('tipo_servico').select('tipo_id').whereIn('tipo_id', tipos)

    return linhas.map((l) => l.tipo_id)
}


export const listarFreelancers = async () => {
    const usuarios = await db('usuario')
        .join('freelancer', 'usuario.usu_id', 'freelancer.usu_id')
        .leftJoin(
            'freelancer_tipo_servico',
            'freelancer.free_id',
            'freelancer_tipo_servico.free_id'
        )
        .leftJoin(
            'tipo_servico',
            'freelancer_tipo_servico.tipo_id',
            'tipo_servico.tipo_id'
        )
        .where('usuario.tipo_usuario', 'freelancer')
        .where('usuario.status_conta', 'ativa')
        .select(
            'usuario.usu_id',
            'usuario.usu_nome',
            'usuario.usu_desc',
            'usuario.usu_cid',
            'usuario.usu_est',
            'usuario.usu_foto',
            'freelancer.free_id',
            'freelancer.free_nivel',
            'freelancer.free_xp'
        )
        .select(
            /* Insígnias */
            db.raw(`(
                SELECT GROUP_CONCAT(i.ins_codigo ORDER BY fi.freeins_data SEPARATOR ',')
                FROM freelancer_insignia fi
                JOIN insignia i ON i.ins_id = fi.ins_id
                WHERE fi.free_id = freelancer.free_id
            ) AS insignias`)
        )
        .select(
            db.raw(`
                GROUP_CONCAT(
                    DISTINCT tipo_servico.tipo_nome
                    ORDER BY tipo_servico.tipo_nome
                    SEPARATOR ', '
                ) AS areas_atuacao
            `)
        )
        .groupBy(
            'usuario.usu_id',
            'usuario.usu_nome',
            'usuario.usu_desc',
            'usuario.usu_cid',
            'usuario.usu_est',
            'usuario.usu_foto',
            'freelancer.free_id',
            'freelancer.free_nivel',
            'freelancer.free_xp'
        )
        .orderBy('usuario.usu_nome', 'asc')

    return usuarios
}
