import nodemailer from 'nodemailer'

/*
 * Envio de e-mail via SMTP.
 *
 * Com Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=seu@gmail.com
 * e SMTP_PASS = uma "senha de app" (Conta Google > Seguranca > Senhas de app),
 * nao a senha normal da conta.
 *
 * Sem SMTP configurado (ambiente de desenvolvimento), o e-mail nao e enviado:
 * o conteudo vai para o console para que o fluxo possa ser testado.
 */
const smtpConfigurado = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
)

const transporte = smtpConfigurado
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: (Number(process.env.SMTP_PORT) || 465) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    })
    : null

export async function enviarEmail({ para, assunto, texto, html }) {
    if (!transporte) {
        console.log('\n[email] SMTP nao configurado; e-mail que seria enviado:')
        console.log(`  Para: ${para}`)
        console.log(`  Assunto: ${assunto}`)
        console.log(`  ${texto}\n`)
        return
    }

    await transporte.sendMail({
        from: process.env.SMTP_FROM || `ContrateJá <${process.env.SMTP_USER}>`,
        to: para,
        subject: assunto,
        text: texto,
        html
    })
}
