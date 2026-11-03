/*
 * Contato por fora no chat: antes da contratação, telefone, e-mail ou "me chama no zap"
 * costumam ser o começo de golpe (pagamento por fora, sem garantia nenhuma).
 * A mensagem ainda é enviada, mas ganha um aviso para quem recebe.
 */

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/i
/* (24) 99999-0000, 24 99999 0000, +55 24 999990000... (ignora valores com R$ e anos soltos) */
const TELEFONE = /(?:\+?55[\s-]?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/
const APLICATIVOS = /\b(whats\s?app|whats|wpp|zap|telegram|insta(gram)?|discord|signal)\b/i

export function temContatoExterno(texto) {
    const t = String(texto ?? '')
    if (!t) return false
    return EMAIL.test(t) || APLICATIVOS.test(t) || TELEFONE.test(t.replace(/R\$\s?[\d.,]+/g, ''))
}
