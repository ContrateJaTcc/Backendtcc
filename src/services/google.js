/* Google */
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

    // Token inválido
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

    /* Perfil Google */
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
