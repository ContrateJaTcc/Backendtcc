import * as usuarioModel from '../models/usuarioModel.js'
import bcrypt from 'bcrypt'

export const listarUsuarios = async (req, res) => {
    try {
        const usuarios = await usuarioModel.listarUsuarios()

        return res.status(200).json(usuarios)
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao listar usuários'
        })
    }
}

export const buscarUsuario = async (req, res) => {
    try {
        const { id } = req.params

        const usuario = await usuarioModel.buscarUsuarioPorId(id)

        if (!usuario) {
            return res.status(404).json({
                erro: 'Usuário não encontrado'
            })
        }

        return res.status(200).json(usuario)
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao buscar usuário'
        })
    }
}

export const criarUsuario = async (req, res) => {
    try {
        const dados = req.body
        const senhaCriptografada = await bcrypt.hash(dados.usu_senha, 10)
        dados.usu_senha = senhaCriptografada
        const usuario = await usuarioModel.criarUsuario(dados)

        return res.status(201).json({
            mensagem: 'Usuário criado com sucesso!',
            usuario
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao criar usuário'
        })
    }
}

export const atualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params
        const dados = req.body
        if (dados.usu_senha) {
    dados.usu_senha = await bcrypt.hash(dados.usu_senha, 10)
}

        const resultado = await usuarioModel.atualizarUsuario(id, dados)

        if (resultado === 0) {
            return res.status(404).json({
                erro: 'Usuário não encontrado'
            })
        }

        return res.status(200).json({
            mensagem: 'Usuário atualizado com sucesso!'
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao atualizar usuário'
        })
    }
}

export const deletarUsuario = async (req, res) => {
    try {
        const { id } = req.params

        const resultado = await usuarioModel.deletarUsuario(id)

        if (resultado === 0) {
            return res.status(404).json({
                erro: 'Usuário não encontrado'
            })
        }

        return res.status(200).json({
            mensagem: 'Usuário deletado com sucesso!'
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao deletar usuário'
        })
    }
}