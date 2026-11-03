import nodemailer from 'nodemailer'

/* E-mail */
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

/* O supremo só precisa de código no login quando dá para mandar e-mail de verdade */
export const emailConfigurado = smtpConfigurado

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
