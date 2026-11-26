/*
 * PostgreSQL de verdade para os testes, sem instalar nada: PGlite (Postgres em WebAssembly)
 * servido pelo pglite-socket. O backend conecta com o mesmo driver "pg" que usa no Neon.
 */
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

export async function subirPostgres(porta = 54329) {
    const pglite = await PGlite.create()
    const servidor = new PGLiteSocketServer({ db: pglite, port: porta, host: '127.0.0.1', maxConnections: 20 })
    await servidor.start()
    process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${porta}/postgres?sslmode=disable`
    return {
        async parar() {
            await servidor.stop()
            await pglite.close()
        }
    }
}
