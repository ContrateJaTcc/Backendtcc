/*
 * Cria (ou atualiza) a conta do administrador supremo. O e-mail é fixo (src/config/supremo.js):
 * este script não transforma nenhuma outra conta em supremo.
 * Uso: npm run criar-supremo -- "SenhaForte" ["Nome"]
 */
import 'dotenv/config'
import bcrypt from 'bcrypt'
import db from '../src/config/knex.js'
import { EMAIL_SUPREMO } from '../src/config/supremo.js'

const [senha, nome = 'Lucas'] = process.argv.slice(2)

if (!senha || senha.length < 8) {
    console.error('Uso: npm run criar-supremo -- "<senha com 8+ caracteres>" [nome]')
    console.error(`(a conta é sempre ${EMAIL_SUPREMO})`)
    process.exit(1)
}

try {
    const existente = await db('usuario').whereRaw('LOWER(usu_email) = ?', [EMAIL_SUPREMO]).first()
    const hash = await bcrypt.hash(senha, 10)

    if (existente) {
        await db('usuario').where('usu_id', existente.usu_id).update({
            tipo_usuario: 'administrador',
            usu_senha: hash,
            status_conta: 'ativa'
        })
        console.log(`Conta ${EMAIL_SUPREMO} agora é o administrador supremo (senha atualizada).`)
    } else {
        await db('usuario').insert({
            usu_nome: nome,
            usu_email: EMAIL_SUPREMO,
            usu_senha: hash,
            /* CPF fictício */
            usu_cpf: String(Date.now()).slice(-11).padStart(11, '0'),
            usu_tel: '00000000000',
            usu_data_nasc: '2000-01-01',
            usu_cid: '-',
            usu_est: 'NA',
            tipo_usuario: 'administrador'
        })
        console.log(`Administrador supremo ${EMAIL_SUPREMO} criado.`)
    }
} catch (erro) {
    console.error(erro)
    process.exitCode = 1
} finally {
    await db.destroy()
}
