import db from '../config/knex.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export const test = async (req, res) => {
    res.json({
        message: 'controller funcionando >.<'
    })
}

export const register = async (req, res) => {
    try {
        const {
    nome,
    email,
    senha,
    cpf,
    telefone,
    data_nasc,
    cidade,
    estado,
    tipo
} = req.body

        if (
    !nome ||
    !email ||
    !senha ||
    !cpf ||
    !telefone ||
    !data_nasc ||
    !cidade ||
    !estado ||
    !tipo
) {
    return res.status(400).json({
        erro: 'Todos os campos obrigatórios devem ser preenchidos >.<'
    })
}

        const usuarios = await db('usuario')
        .select('usu_id')
        .where('usu_email', email)

        if (usuarios.length > 0) {
            return res.status(409).json({
                erro: "Este e-mail já está sendo usado O.o"
            })
        }

        const senhaCriptografada = await bcrypt.hash(senha, 10)

        await db('usuario').insert({
    usu_nome: nome,
    usu_email: email,
    usu_senha: senhaCriptografada,
    usu_cpf: cpf,
    usu_tel: telefone,
    usu_data_nasc: data_nasc,
    usu_cid: cidade,
    usu_est: estado,
    usu_tipo: tipo
})

        return res.status(201).json({
            mensagem: "Usuário cadastrado com sucesso! ^w^"
        })

    } catch (erro) {
        console.error(erro)
        return res.status(500).json({
            erro: "Erro ao cadastrar usuário >.<"
        })
    }
}

export const login = async (req, res) => {
    try {
        const { email, senha } = req.body

        if (!email || !senha) {
            return res.status(400).json({
                erro: 'E-mail e senha são obrigatórios >:('
            })
        }

        const usuarios = await db('usuario')
    .select('*')
    .where('usu_email', email)

        if (usuarios.length === 0) {
            return res.status(404).json({
                erro: "Usuário não encontrado O~o"
            })
        }

        const usuario = usuarios[0]

        const senhaCorreta = await bcrypt.compare(senha, usuario.usu_senha)

        if (!senhaCorreta) {
            return res.status(401).json({
                erro: "Senha incorreta :P"
            })
        }

        const token = jwt.sign(
    {
        id: usuario.usu_id,
        email: usuario.usu_email,
        tipo: usuario.usu_tipo
    },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        )

        return res.json({
            mensagem: "Login bem-sucedido! ^w^",
            token
        })

    } catch (erro) {
        console.error(erro)
        return res.status(500).json({
            erro: "Erro ao realizar login DX"
        })
    }
}