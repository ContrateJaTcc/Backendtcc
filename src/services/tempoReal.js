import { EventEmitter } from 'events'

/*
 * Aviso de "tem mensagem nova" entre requisições da mesma instância.
 * Na Vercel cada instância tem a sua memória, então quem espera
 * também confere o banco de tempos em tempos (ver aguardarMensagens).
 */
const canal = new EventEmitter()
canal.setMaxListeners(0)

export function avisar(...usuIds) {
    for (const id of usuIds) canal.emit(`usuario:${id}`)
}

/* Resolve quando chegar um aviso para o usuário ou quando o tempo acabar */
export function esperarAviso(usuId, ms) {
    return new Promise((resolve) => {
        const evento = `usuario:${usuId}`
        const fim = () => {
            clearTimeout(timer)
            canal.off(evento, fim)
            resolve()
        }
        const timer = setTimeout(fim, ms)
        canal.on(evento, fim)
    })
}
