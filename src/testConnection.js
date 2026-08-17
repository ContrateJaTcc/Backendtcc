import db from './config/knex.js'

async function testarConexao() {
    try {
        await db.raw('SELECT 1')
        console.log('Banco conectado com sucesso!')
    } catch (erro) {
        console.error(erro)
    } finally {
        await db.destroy()
    }
}

testarConexao()