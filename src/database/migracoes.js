/*
 * Lista fixa das migrations, importadas uma a uma: na Vercel o servidor é empacotado e só leva
 * os arquivos importados no código (o knex não consegue ler a pasta migrations sozinho lá).
 * Migration nova: crie o arquivo em migrations/ e acrescente aqui (o teste confere).
 */
import * as m1 from './migrations/20260722011946_create_usuario.js'
import * as m2 from './migrations/20260831050022_create_restante.js'
import * as m3 from './migrations/20260901231814_alter_servico.js'
import * as m4 from './migrations/20260930220000_alter_usuario_foto.js'
import * as m5 from './migrations/20261001120000_create_redefinicao_senha.js'
import * as m6 from './migrations/20261002000000_gamificacao.js'
import * as m7 from './migrations/20261002100000_corrigir_contas_sem_papel.js'
import * as m8 from './migrations/20261023000000_convites_entrega.js'
import * as m9 from './migrations/20261024000000_supremo.js'
import * as m10 from './migrations/20261025000000_registro_missoes.js'
import * as m11 from './migrations/20261026000000_denuncias_chat_push_passos.js'
import * as m12 from './migrations/20261027000000_linha_etapas_propostas_alertas.js'
import * as m13 from './migrations/20261028000000_salvos_prazos_conquistas.js'
import * as m14 from './migrations/20261029000000_contratacao_carteira_seguranca_eventos.js'
import * as m15 from './migrations/20261030000000_reino_guildas_reunioes_etapas.js'
import * as m16 from './migrations/20261101000000_agenda_avisos_moderacao_erros.js'
import * as m17 from './migrations/20261102000000_rodada_trinta.js'

export const MIGRACOES = {
    '20260722011946_create_usuario.js': m1,
    '20260831050022_create_restante.js': m2,
    '20260901231814_alter_servico.js': m3,
    '20260930220000_alter_usuario_foto.js': m4,
    '20261001120000_create_redefinicao_senha.js': m5,
    '20261002000000_gamificacao.js': m6,
    '20261002100000_corrigir_contas_sem_papel.js': m7,
    '20261023000000_convites_entrega.js': m8,
    '20261024000000_supremo.js': m9,
    '20261025000000_registro_missoes.js': m10,
    '20261026000000_denuncias_chat_push_passos.js': m11,
    '20261027000000_linha_etapas_propostas_alertas.js': m12,
    '20261028000000_salvos_prazos_conquistas.js': m13,
    '20261029000000_contratacao_carteira_seguranca_eventos.js': m14,
    '20261030000000_reino_guildas_reunioes_etapas.js': m15,
    '20261101000000_agenda_avisos_moderacao_erros.js': m16,
    '20261102000000_rodada_trinta.js': m17,
}

/* Fonte de migrations do knex: mesmos nomes de arquivo que o "npm run migrate" grava em knex_migrations */
export const fonteMigracoes = {
    getMigrations: async () => Object.keys(MIGRACOES).sort(),
    getMigrationName: (nome) => nome,
    getMigration: async (nome) => MIGRACOES[nome]
}
