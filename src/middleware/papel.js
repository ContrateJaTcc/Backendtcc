/* Papel */
export const exigirPapel = (...papeis) => (req, res, next) => {
    if (!req.usuario || !papeis.includes(req.usuario.tipo)) {
        return res.status(403).json({
            erro: 'Você não tem permissão para acessar este recurso.'
        })
    }

    next()
}

export const exigirAdmin = exigirPapel('administrador')

/* Supremo: a única conta com todos os poderes (config/supremo.js) */
export const exigirSupremo = (req, res, next) => {
    if (!req.usuario?.supremo) {
        return res.status(403).json({
            erro: 'Só o administrador supremo pode fazer isso.'
        })
    }

    next()
}
