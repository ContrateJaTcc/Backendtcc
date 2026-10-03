/*
 * Valida o access token que o frontend recebeu do Google (Google Identity
 * Services, fluxo "token client").
 *
 * O ponto critico e conferir o "aud": sem isso, um token emitido para
 * QUALQUER outro site que use login do Google seria aceito aqui, e quem
 * tivesse esse token entraria na conta da vitima.
 */
const TOKENINFO = 'https://oauth2.googleapis.com/tokeninfo'
const USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo'

export class ErroGoogle extends Error {}

export async function verificarTokenGoogle(accessToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID

    if (!clientId) {
        throw new Error('GOOGLE_CLIENT_ID nao configurado no .env')
    }

    if (!accessToken || typeof accessToken !== 'string') {
        throw new ErroGoogle('Token do Google ausente.')
    }

    const respostaInfo = await fetch(
        `${TOKENINFO}?access_token=${encodeURIComponent(accessToken)}`
    )

    // Token expirado, revogado ou inventado: o Google responde 400.
    if (!respostaInfo.ok) {
        throw new ErroGoogle('Token do Google inválido ou expirado.')
    }

    const info = await respostaInfo.json()

    if (info.aud !== clientId && info.azp !== clientId) {
        throw new ErroGoogle('Token do Google não pertence a este aplicativo.')
    }

    if (!info.email || String(info.email_verified) !== 'true') {
        throw new ErroGoogle('Sua conta Google não tem um e-mail verificado.')
    }

    /* tokeninfo nao traz o nome; o userinfo traz. Se falhar, seguimos so
       com o e-mail — o nome e apenas para preencher o formulario. */
    let perfil = {}

    try {
        const respostaPerfil = await fetch(USERINFO, {
            headers: { Authorization: `Bearer ${accessToken}` }
        })

        if (respostaPerfil.ok) {
            perfil = await respostaPerfil.json()
        }
    } catch {
        perfil = {}
    }

    return {
        googleId: info.sub,
        email: String(info.email).toLowerCase(),
        nome: perfil.given_name || '',
        sobrenome: perfil.family_name || ''
    }
}
