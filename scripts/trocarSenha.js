/*
 * Define uma senha nova para uma conta que já existe (ex.: quando o e-mail de recuperação não chega).
 * Não muda o papel nem nada além da senha.
 * Uso: npm run trocar-senha -- email@exemplo.com "SenhaNova"
 */
import 'dotenv/config'
import bcrypt from 'bcrypt'
import db from '../src/config/knex.js'

const [email, senha] = process.argv.slice(2)

if (!email || !senha || senha.length < 6) {
    console.error('Uso: npm run trocar-senha -- <email> "<senha nova com 6+ caracteres>"')
    process.exit(1)
}

try {
    const conta = await db('usuario').select('usu_id', 'usu_nome').whereRaw('LOWER(usu_email) = ?', [email.trim().toLowerCase()]).first()

    if (!conta) {
        console.error(`Nenhuma conta com o e-mail ${email}.`)
        process.exitCode = 1
    } else {
        await db('usuario').where('usu_id', conta.usu_id).update({
            usu_senha: await bcrypt.hash(senha, 10),
            data_atualizacao: db.fn.now()
        })
        console.log(`Senha de ${conta.usu_nome} (${email}) trocada.`)
    }
} catch (erro) {
    console.error(erro)
    process.exitCode = 1
} finally {
    await db.destroy()
}
