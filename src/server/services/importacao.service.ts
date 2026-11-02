import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { intervaloDoExtrato, montarPrevia } from '#/server/importacao/montar-previa'
import {
  carregarContextoDaPrevia,
  confirmarImportacao,
  desfazerImportacao,
  listarImportacoes,
} from '#/server/repositories/importacao.repository'
import { checkBudgetsAndNotify } from '#/server/services/budget-notify.server'

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) throw new Error('Unauthorized')
  return session
}

const MAX_BYTES_EXTRATO = 1024 * 1024

const grupoSchema = z.enum(['caixinhas', 'fatura_cartao', 'pix_proprio'])
const escolhasSchema = z.partialRecord(grupoSchema, z.string().nullable())

export const prepararImportacao = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      walletId: z.string(),
      texto: z.string().max(MAX_BYTES_EXTRATO, 'O arquivo passa de 1 MB'),
      // Escolhas feitas na prévia sobrepõem as lembradas (para recalcular possíveis duplicadas).
      escolhasDeGrupo: escolhasSchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const intervalo = intervaloDoExtrato(data.texto)
    if (!intervalo) return montarPrevia(data.texto, vazio(data.walletId)) // lança a mensagem de arquivo inválido/vazio
    const contexto = await carregarContextoDaPrevia(session.user.id, session.user.name, data.walletId, intervalo)
    return montarPrevia(data.texto, {
      ...contexto,
      escolhasDeGrupo: { ...contexto.escolhasDeGrupo, ...data.escolhasDeGrupo },
    })
  })

function vazio(walletId: string) {
  return {
    carteira: { id: walletId, criadaEm: new Date(0) },
    nomeUsuario: '',
    transacoesExistentes: [],
    externalIdsImportados: [],
    categoriaPorDescricao: {},
    escolhasDeGrupo: {},
    categoriaOutrosReceitaId: null,
  }
}

export const confirmarImportacaoDoExtrato = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      walletId: z.string(),
      linhas: z
        .array(
          z.object({
            externalId: z.string().min(1),
            data: z.coerce.date(),
            valor: z.number().positive(),
            tipo: z.enum(['INCOME', 'EXPENSE']),
            descricao: z.string().max(500),
            categoriaId: z.string().nullable(),
            grupo: grupoSchema.nullable(),
          }),
        )
        .min(1, 'Marque ao menos uma linha')
        .max(2000),
      escolhasDeGrupo: escolhasSchema,
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const resultado = await confirmarImportacao(session.user.id, data.walletId, {
      linhas: data.linhas,
      escolhasDeGrupo: data.escolhasDeGrupo,
    })
    checkBudgetsAndNotify(session.user.id)
    return resultado
  })

export const desfazerImportacaoDoExtrato = createServerFn({ method: 'POST' })
  .validator(z.object({ importId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const resultado = await desfazerImportacao(session.user.id, data.importId)
    checkBudgetsAndNotify(session.user.id)
    return resultado
  })

export const getImportacoesDaCarteira = createServerFn({ method: 'GET' })
  .validator(z.object({ walletId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    return listarImportacoes(session.user.id, data.walletId)
  })
