import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const migracoes = { directory: './src/database/migrations' }
const seeds = { directory: './src/database/seeds' }

/*
 * Banco de dados:
 * - DATABASE_URL com postgres://... (Neon) usa PostgreSQL
 * - sem DATABASE_URL, usa o MySQL antigo (DB_HOST, DB_USER...)
 */
const url = process.env.DATABASE_URL ?? ''
export const usaPostgres = /^postgres(ql)?:\/\//i.test(url)

/* Banco local de teste (sem SSL); o Neon exige SSL */
const semSsl = /sslmode=disable/i.test(url) || /@(localhost|127\.0\.0\.1)[:/]/i.test(url)

const postgres = {
    client: 'pg',
    connection: {
        connectionString: url,
        ...(semSsl ? {} : { ssl: { rejectUnauthorized: false } })
    },
    /* Na Vercel cada função abre poucas conexões; o Neon (pooler) cuida do resto */
    pool: { min: 0, max: Number(process.env.DB_POOL_MAX) || 5 },
    migrations: migracoes,
    seeds
}

const mysql = {
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: {
            rejectUnauthorized: false
        }
    },
    migrations: migracoes,
    seeds
}

const connection = usaPostgres ? postgres : mysql

export default {
    development: connection,
    production: connection
}
