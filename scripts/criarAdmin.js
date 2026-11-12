/* Uso: npm run criar-admin -- email@exemplo.com SenhaForte "Nome do Admin" */
import 'dotenv/config'
import bcrypt from 'bcrypt'
import db from '../src/config/knex.js'
import { EMAIL_SUPREMO } from '../src/config/supremo.js'

const [emailBruto, senha, nome = 'Administrador'] = process.argv.slice(2)
const email = String(emailBruto ?? '').trim().toLowerCase()

if (!email || !email.includes('@') || !senha || senha.length < 8) {
    console.error('Uso: npm run criar-admin -- <email> <senha com 8+ caracteres> [nome]')
    process.exit(1)
}

/* A conta do supremo tem script próprio */
if (email === EMAIL_SUPREMO) {
    console.error(`${EMAIL_SUPREMO} é a conta do supremo: use npm run criar-supremo -- "<senha>"`)
    process.exit(1)
}

try {
    const existente = await db('usuario').whereRaw('LOWER(usu_email) = ?', [email]).first()
    const hash = await bcrypt.hash(senha, 10)

    if (existente) {
        await db('usuario').where('usu_id', existente.usu_id).update({
            tipo_usuario: 'administrador',
            usu_senha: hash,
            status_conta: 'ativa'
        })
        console.log(`Conta ${email} promovida a administrador.`)
        console.log('Atenção: a senha dessa conta foi trocada pela senha informada.')
    } else {
        await db('usuario').insert({
            usu_nome: nome,
            usu_email: email,
            usu_senha: hash,
            /* CPF fictício */
            usu_cpf: String(Date.now()).slice(-11).padStart(11, '0'),
            usu_tel: '00000000000',
            usu_data_nasc: '2000-01-01',
            usu_cid: '-',
            usu_est: 'NA',
            tipo_usuario: 'administrador'
        })
        console.log(`Administrador ${email} criado.`)
    }
} catch (erro) {
    console.error(erro)
    process.exitCode = 1
} finally {
    await db.destroy()
}
