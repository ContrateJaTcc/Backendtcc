import jwt from 'jsonwebtoken'

export default (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).json({
            erro: "token nao informado"
        })
    }

    const partes = authHeader.split(' ')

    if (partes.length !== 2) {
        return res.status(401).json({
            erro: "token mal formatado"
        })
    }

    const [tipo, token] = partes

    if (tipo !== 'Bearer') {
        return res.status(401).json({
            erro: "token nao validado"
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.usuario = decoded
        next()
    } catch (erro) {
        return res.status(401).json({
            erro: "token invalido"
        })
    }
}