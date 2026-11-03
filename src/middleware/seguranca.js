/* Cabeçalhos */
export const cabecalhosSeguranca = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    /* A API só devolve JSON: nenhuma resposta dela pode rodar script ou ser embutida (a /docs libera o Swagger) */
    if (!req.path.startsWith('/docs')) res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.removeHeader('X-Powered-By')
    next()
}

/* Limite de tentativas */
/*
 * porConta: depois do login, conta por pessoa (e não por IP: numa escola, todo mundo sai pelo mesmo IP).
 * mensagem: o começo do texto do erro 429 (sem ela, o de tentativas de login).
 */
export const limitarTentativas = ({ maximo = 10, janelaMs = 15 * 60 * 1000, porConta = false, mensagem = null } = {}) => {
    const tentativas = new Map()

    return (req, res, next) => {
        const agora = Date.now()
        const chave = porConta && req.usuario?.id ? `u${req.usuario.id}` : req.ip

        /* Limpa as janelas vencidas de vez em quando, para o mapa não crescer para sempre */
        if (tentativas.size > 5000) for (const [k, r] of tentativas) if (agora > r.expira) tentativas.delete(k)
        const registro = tentativas.get(chave)

        if (!registro || agora > registro.expira) {
            tentativas.set(chave, { total: 1, expira: agora + janelaMs })
            return next()
        }

        registro.total += 1

        if (registro.total > maximo) {
            const minutos = Math.ceil((registro.expira - agora) / 60000)

            return res.status(429).json({
                erro: mensagem ? `${mensagem} Tente de novo em ${minutos} min.` : `Muitas tentativas. Tente de novo em ${minutos} min.`
            })
        }

        next()
    }
}
