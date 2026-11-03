import { temColuna } from './registro.js'

/*
 * Filtro automático de spam nos projetos. Projeto suspeito não é recusado: vai para a fila de revisão
 * da administração (serv_moderacao = 'pendente') e só aparece para os freelancers depois de aprovado.
 * O site confere as mesmas regras (src/utils/moderacao.ts) para avisar o contratante antes de publicar.
 */

const TERMOS = [
    'dinheiro facil', 'ganhe dinheiro', 'renda extra garantida', 'lucro garantido', 'investimento garantido', 'ganhos garantidos',
    'trabalhe de casa e ganhe', 'fique rico', 'piramide', 'marketing multinivel', 'bitcoin', 'criptomoeda', 'cripto',
    'pix antecipado', 'pague a taxa', 'taxa de inscricao', 'taxa de adesao', 'deposito antecipado', 'clique aqui', 'link na bio',
    'sem experiencia ganhe', 'aposta', 'apostas', 'cassino', 'jogo do tigrinho'
]

const ENCURTADORES = /\b(bit\.ly|tinyurl\.com|cutt\.ly|encurtador\.com\.br|goo\.gl|is\.gd|rb\.gy|shorturl\.at|t\.co|ow\.ly|tiny\.cc)\//i

export const VALOR_SUSPEITO_FIXO = 100_000
export const VALOR_SUSPEITO_HORA = 2_000

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* Motivos da suspeita ([] = projeto normal) */
export function motivosDeSpam({ titulo, descricao, valor, tipo_valor }) {
    const texto = normalizar(`${titulo} ${descricao}`)
    const motivos = []
    const termo = TERMOS.find((t) => new RegExp(`\\b${t}\\b`).test(texto))
    if (termo) motivos.push(`termo suspeito ("${termo}")`)
    if (ENCURTADORES.test(`${titulo} ${descricao}`)) motivos.push('link encurtado')
    const v = Number(valor)
    if (Number.isFinite(v) && v > (tipo_valor === 'hora' ? VALOR_SUSPEITO_HORA : VALOR_SUSPEITO_FIXO)) motivos.push('valor fora do normal')
    const letras = String(titulo ?? '').replace(/[^A-Za-zÀ-ú]/g, '')
    if (/!{3,}/.test(`${titulo} ${descricao}`) || (letras.length >= 12 && letras === letras.toUpperCase())) motivos.push('título gritando')
    return motivos
}

/* Campos para gravar no projeto ({} quando a coluna ainda não existe) */
export async function camposModeracao(dados) {
    if (!(await temColuna('servico', 'serv_moderacao'))) return {}
    const motivos = motivosDeSpam(dados)
    return motivos.length ? { serv_moderacao: 'pendente', serv_moderacao_motivo: motivos.join(', ').slice(0, 200) } : {}
}

/*
 * Filtro das listas para freelancers: projeto em revisão ou recusado não aparece.
 * Uso: const liberados = await filtroLiberados(); ...modify(liberados)
 */
export async function filtroLiberados(coluna = 'servico.serv_moderacao') {
    const ativo = await temColuna('servico', 'serv_moderacao')
    return (q) => {
        if (ativo) q.where((s) => s.whereNull(coluna).orWhere(coluna, 'aprovado'))
    }
}
