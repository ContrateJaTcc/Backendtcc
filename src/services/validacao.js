import { readFileSync } from 'fs'

/*
 * Regras do cadastro e do perfil (o site confere as mesmas em src/utils/validacao.ts, para avisar antes).
 * Cada função devolve '' quando está tudo certo, ou a mensagem para mostrar.
 */

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

const digitos = (v) => String(v ?? '').replace(/\D/g, '')

/* CPF: 11 dígitos, não todos iguais, e os dois dígitos verificadores batendo */
export function cpfValido(valor) {
    const d = digitos(valor)
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
    const digito = (ate) => {
        let soma = 0
        for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i)
        const resto = (soma * 10) % 11
        return resto === 10 ? 0 : resto
    }
    return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

export function erroCpf(valor) {
    if (!/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(String(valor ?? '').trim())) return 'CPF inválido. Use o formato 000.000.000-00 ou 11 dígitos.'
    return cpfValido(valor) ? '' : 'Este CPF não existe. Confira os números.'
}

/* DDDs em uso no Brasil (Anatel) */
const DDDS = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99])

/* Celular: DDD + 9 + 8 números. Fixo: DDD + 8 números começando de 2 a 5 */
export function erroTelefone(valor) {
    const d = digitos(valor)
    if (d.length !== 10 && d.length !== 11) return 'Telefone inválido. Use DDD + número, como (11) 91234-5678.'
    if (!DDDS.has(Number(d.slice(0, 2)))) return `O DDD ${d.slice(0, 2)} não existe.`
    const numero = d.slice(2)
    if (/^(\d)\1+$/.test(numero)) return 'Este número de telefone não parece real.'
    if (d.length === 11 && numero[0] !== '9') return 'Celular com 11 números começa com 9 depois do DDD.'
    if (d.length === 10 && !/[2-5]/.test(numero[0])) return 'Celular precisa do 9 na frente; fixo começa de 2 a 5.'
    return ''
}

export const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email ?? '').trim()) && String(email).length <= 150

/* Letras (com acento), espaço, hífen e apóstrofo */
export function erroNome(nome) {
    const t = String(nome ?? '').trim()
    if (t.replace(/[^\p{L}]/gu, '').length < 2) return 'Informe o nome.'
    if (!/^[\p{L}][\p{L}\s'’-]*$/u.test(t)) return 'O nome só pode ter letras.'
    if (t.length > 150) return 'O nome pode ter até 150 caracteres.'
    return ''
}

export const IDADE_MINIMA = 18

const dataHaAnos = (anos, hoje = new Date()) => {
    const d = new Date(hoje.getFullYear() - anos, hoje.getMonth(), hoje.getDate())
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function erroNascimento(data, hoje = new Date()) {
    const t = String(data ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(new Date(`${t}T12:00:00`).getTime())) return 'Data de nascimento inválida.'
    if (t > dataHaAnos(0, hoje)) return 'A data de nascimento não pode ser no futuro.'
    if (t < dataHaAnos(120, hoje)) return 'Confira o ano de nascimento.'
    if (t > dataHaAnos(IDADE_MINIMA, hoje)) return `É preciso ter ${IDADE_MINIMA} anos ou mais para usar o ContrateJá.`
    return ''
}

export const SENHA_MINIMA = 6

const SENHAS_COMUNS = new Set(['123456', '1234567', '12345678', '123456789', '1234567890', '654321', '111111', '000000', '123123', 'abc123', 'senha', 'senha1', 'senha123', 'password', 'qwerty', 'qwerty123', 'abcdef', 'iloveyou', 'contrateja'])

export function erroSenha(senha) {
    const t = String(senha ?? '')
    if (t.length < SENHA_MINIMA) return `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`
    /* O bcrypt só usa os primeiros 72 bytes */
    if (Buffer.byteLength(t) > 72) return 'A senha pode ter até 72 caracteres.'
    if (SENHAS_COMUNS.has(t.toLowerCase()) || /^(.)\1+$/.test(t)) return 'Essa senha é muito fácil de adivinhar. Escolha outra.'
    return ''
}

/* Cidades do IBGE por estado (só os nomes; o site tem a versão com coordenadas para o mapa) */
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

let cidades = null

function listaCidades() {
    if (cidades === null) {
        try {
            const dados = JSON.parse(readFileSync(new URL('../dados/cidades.json', import.meta.url), 'utf8'))
            cidades = new Map(Object.entries(dados).map(([uf, nomes]) => [uf, new Map(nomes.map((n) => [normalizar(n), n]))]))
        } catch {
            /* Sem o arquivo, só a sigla do estado é conferida */
            cidades = false
        }
    }
    return cidades
}

/*
 * Confere cidade e estado juntos. Devolve { erro } ou { cidade, estado } com o nome oficial
 * ("sao jose dos campos" + "sp" -> "São José dos Campos", "SP").
 */
export function conferirLocal(cidade, estado) {
    const uf = String(estado ?? '').trim().toUpperCase()
    const nome = String(cidade ?? '').trim()
    if (!UFS.includes(uf)) return { erro: 'Estado inválido. Use a sigla de 2 letras (ex.: SP).' }
    if (!nome) return { erro: 'Informe a cidade.' }
    const lista = listaCidades()
    if (!lista) return { cidade: nome.slice(0, 100), estado: uf }
    const oficial = lista.get(uf)?.get(normalizar(nome))
    if (!oficial) return { erro: `Não achamos a cidade "${nome.slice(0, 60)}" em ${uf}. Confira o nome.` }
    return { cidade: oficial, estado: uf }
}
