import knex from 'knex'
import pg from 'pg'
import config, { usaPostgres } from '../../knexfile.js'

const environment = process.env.NODE_ENV || 'development'

/*
 * PostgreSQL devolve COUNT e SUM de inteiros como texto (bigint). O MySQL devolvia número,
 * e o código espera número: converte aqui. DECIMAL continua como texto nos dois (o código usa Number()).
 */
if (usaPostgres) pg.types.setTypeParser(pg.types.builtins.INT8, (valor) => (valor === null ? null : Number(valor)))

const db = knex(config[environment])

export default db
