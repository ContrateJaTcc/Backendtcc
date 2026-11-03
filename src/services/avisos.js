import db from '../config/knex.js'
import { temColuna } from './registro.js'

/*
 * Avisos por tipo: cada pessoa escolhe o que chega no sino e o que chega no celular.
 * As notificações são gravadas sempre (as Configurações podem religar depois); o filtro vale na hora de mostrar
 * e na hora de mandar o push. Avisos da conta (segurança, papel, suspensão) não podem ser desligados.
 */

export const CATEGORIAS = ['mensagens', 'projetos', 'pagamentos', 'avaliacoes', 'conquistas']
export const CANAIS = ['sino', 'celular']

/* A ordem importa: "Pagamento guardado" é pagamento, não projeto */
const REGRAS = [
    ['avaliacoes', /avalia/i],
    ['pagamentos', /pagamento|pago\b|carteira|b[oô]nus|garantia|estorno|saque|recibo/i],
    ['conquistas', /ins[ií]gnia|n[ií]vel|conquista|ranking|miss[aã]o|teste|guilda|evento|desafio|chef[aã]o|drag[aã]o|\bxp\b/i],
    ['mensagens', /mensagem|proposta|reuni/i],
    ['projetos', /projeto|candidat|contrat|entreg|prazo|etapa|ajuste|acordo|disputa|convite|pausa|or[cç]amento|horas|crit[eé]rio|amostra|livre/i]
]

/* null = aviso da conta (sempre chega) */
export function categoriaDoAviso(titulo = '', texto = '') {
    const alvo = `${titulo} ${texto}`
    for (const [categoria, regra] of REGRAS) if (regra.test(titulo)) return categoria
    for (const [categoria, regra] of REGRAS) if (regra.test(alvo)) return categoria
    return null
}

/* Só guarda o que foi desligado; o resto é ligado */
export function lerPreferencia(texto) {
    let dados = {}
    try {
        dados = JSON.parse(texto ?? '{}') ?? {}
    } catch {
        dados = {}
    }
    const prefs = {}
    for (const canal of CANAIS) {
        prefs[canal] = {}
        for (const categoria of CATEGORIAS) prefs[canal][categoria] = dados?.[canal]?.[categoria] !== false
    }
    return prefs
}

export function limparPreferencia(corpo) {
    const desligados = {}
    for (const canal of CANAIS) {
        for (const categoria of CATEGORIAS) {
            if (corpo?.[canal]?.[categoria] === false) (desligados[canal] ??= {})[categoria] = false
        }
    }
    return desligados
}

export async function preferenciaDe(usu_id) {
    if (!(await temColuna('usuario', 'usu_avisos'))) return lerPreferencia(null)
    const u = await db('usuario').where('usu_id', usu_id).select('usu_avisos').first()
    return lerPreferencia(u?.usu_avisos)
}

export function avisoLigado(prefs, canal, titulo, texto) {
    const categoria = categoriaDoAviso(titulo, texto)
    return categoria === null || prefs[canal][categoria]
}
