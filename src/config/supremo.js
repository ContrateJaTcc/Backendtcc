/*
 * O único administrador supremo do site. Fica fixo no código de propósito:
 * nenhuma tela, rota ou script consegue transformar outra conta em supremo.
 * (A senha nunca fica aqui: ela é definida com npm run criar-supremo.)
 */
export const EMAIL_SUPREMO = 'lucas@gmail.com'

/* Supremo = esta conta, e só enquanto for administrador */
export const ehSupremo = (usuario) =>
    Boolean(usuario) &&
    usuario.tipo_usuario === 'administrador' &&
    String(usuario.usu_email ?? '').trim().toLowerCase() === EMAIL_SUPREMO
