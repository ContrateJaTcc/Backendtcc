/*
 * O que muda entre MySQL e PostgreSQL (Neon), num lugar só.
 * O resto do código usa o knex normal, que já escreve o SQL certo para cada banco.
 */
import { usaPostgres } from '../../knexfile.js'

export const ehPostgres = usaPostgres

/* Hoje (só a data) */
export const sqlHoje = () => (ehPostgres ? 'CURRENT_DATE' : 'CURDATE()')

/* Agora menos N dias (N vem do código, nunca do usuário) */
export const sqlDiasAtras = (dias) => {
    const n = Math.trunc(Number(dias))
    return ehPostgres ? `(NOW() - INTERVAL '${n} days')` : `DATE_SUB(NOW(), INTERVAL ${n} DAY)`
}

/* Mês (1 a 12) de uma coluna de data */
export const sqlMes = (coluna) => (ehPostgres ? `CAST(EXTRACT(MONTH FROM ${coluna}) AS INTEGER)` : `MONTH(${coluna})`)

/* Junta textos de várias linhas num só ("a, b, c") */
export const sqlJuntar = (expressao, { separador = ',', ordem = expressao, distintos = false } = {}) =>
    ehPostgres
        ? `STRING_AGG(${distintos ? 'DISTINCT ' : ''}CAST(${expressao} AS TEXT), '${separador}' ORDER BY ${distintos ? `CAST(${expressao} AS TEXT)` : ordem})`
        : `GROUP_CONCAT(${distintos ? 'DISTINCT ' : ''}${expressao} ORDER BY ${ordem} SEPARATOR '${separador}')`

/* Registro repetido (UNIQUE): ER_DUP_ENTRY no MySQL, 23505 no PostgreSQL */
export const ehDuplicado = (erro) => erro?.code === 'ER_DUP_ENTRY' || erro?.code === '23505'

/*
 * Id da linha inserida. MySQL devolve [id]; PostgreSQL só devolve com RETURNING ([{ coluna: id }]).
 * Uso: const id = await inserirComId(db('tabela'), { ... }, 'tab_id')
 */
export async function inserirComId(consulta, dados, coluna) {
    const linhas = ehPostgres ? await consulta.insert(dados).returning(coluna) : await consulta.insert(dados)
    const primeira = linhas?.[0]
    return primeira !== null && typeof primeira === 'object' ? primeira[coluna] : primeira
}

/* Linhas de um db.raw(): MySQL devolve [linhas, campos]; PostgreSQL devolve { rows } */
export const linhasDoRaw = (resultado) => (ehPostgres ? resultado?.rows ?? [] : resultado?.[0] ?? [])
