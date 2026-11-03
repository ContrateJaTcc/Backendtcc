import webpush from 'web-push'
import db from '../config/knex.js'
import { temColuna, temTabela } from './registro.js'
import { avisoLigado, lerPreferencia } from './avisos.js'

/*
 * Notificações no celular/computador (Web Push), mesmo com o site fechado.
 * Só liga com as chaves VAPID nas variáveis de ambiente (gerar com: npx web-push generate-vapid-keys):
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_EMAIL (ex.: mailto:contato@contrateja.com).
 * Nunca derruba quem chamou: se falhar, só avisa no log.
 */
const chavePublica = process.env.VAPID_PUBLIC_KEY ?? null
export const pushConfigurado = Boolean(chavePublica && process.env.VAPID_PRIVATE_KEY)

if (pushConfigurado) {
    webpush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:contato@contrateja.com', chavePublica, process.env.VAPID_PRIVATE_KEY)
}

export const chavePublicaPush = () => (pushConfigurado ? chavePublica : null)

/* Manda para todos os aparelhos das contas; url = página que abre ao tocar (sem url: o painel da pessoa) */
export async function enviarPush(usuIds, { titulo, texto, url = null }) {
    try {
        const ids = [].concat(usuIds).filter(Boolean)
        if (!pushConfigurado || ids.length === 0 || !(await temTabela('push_inscricao'))) return

        const inscricoes = await db('push_inscricao')
            .join('usuario', 'push_inscricao.usu_id', 'usuario.usu_id')
            .whereIn('push_inscricao.usu_id', ids)
            .select('push_inscricao.*', 'usuario.tipo_usuario', ...((await temColuna('usuario', 'usu_avisos')) ? ['usuario.usu_avisos'] : []))

        /* Avisos por tipo: quem desligou este tipo no celular não recebe */
        const querem = inscricoes.filter((i) => avisoLigado(lerPreferencia(i.usu_avisos), 'celular', titulo, texto))

        await Promise.all(
            querem.map(async (i) => {
                try {
                    const corpo = JSON.stringify({ titulo, texto, url: url ?? `/${i.tipo_usuario}` })
                    await webpush.sendNotification({ endpoint: i.pus_endpoint, keys: { p256dh: i.pus_p256dh, auth: i.pus_auth } }, corpo, { TTL: 60 * 60 * 24 })
                } catch (erro) {
                    /* Aparelho desinscrito ou expirado: some da lista */
                    if (erro.statusCode === 404 || erro.statusCode === 410) await db('push_inscricao').where('pus_id', i.pus_id).del()
                    else console.error('[push]', erro.statusCode ?? erro.message)
                }
            })
        )
    } catch (erro) {
        console.error('[push]', erro)
    }
}
