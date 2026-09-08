# Nexis Mobile — Fatia 4 (recorrência, parcelamento, filtros) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar recorrência e parcelamento na criação de transações, exclusão com escopo (esta / esta e futuras / toda a série) e filtros de tipo/carteira/categoria na lista, no app `nexis-mobile`.

**Architecture:** Backend aditivo — o `POST /api/mobile/transactions` volta a aceitar `recurring/interval/installments` (espelhando o `addTransaction` do PWA), o `DELETE /api/mobile/transactions/$id` ganha `?mode=` opcional que despacha pra `deleteInstallmentGroup`, e `calcNextDue` passa a ser exportado do repositório. App — o schema/api ganham os campos novos, o `transaction-sheet` ganha um bloco Repetir/Parcelar (só na criação) e um seletor de exclusão de grupo, e a tela de Transações ganha uma barra de filtros colapsável que filtra client-side sem tocar nos cards de resumo.

**Tech Stack:** TanStack Start (SSR) + Prisma + zod + vitest (nexis); Expo Router + NativeWind/react-native-css + TanStack Query + zod + jest-expo (nexis-mobile). Componente nativo novo: `Switch` de `react-native`.

**Spec:** `docs/superpowers/specs/2026-09-08-nexis-mobile-slice-4-transactions-recurrence-filters-design.md`

## Global Constraints

- **Dois repos.** Tasks 1–3 são no `nexis` (`/home/welbertbarbosa/projects/personal/nexis`). Tasks 4–10 são no `nexis-mobile` (`/home/welbertbarbosa/projects/personal/nexis-mobile`). Cada task diz o repo.
- **Branch.** `nexis`: trabalhar em `feat/mobile-slice-4-transactions-backend` a partir de `origin/main`. `nexis-mobile`: `feat/mobile-slice-4-transactions` a partir de `origin/main`.
- **Rotas mobile aditivas** — `auth.api.getSession({ headers: request.headers })` → `Response.json({ error: 'Unauthorized' }, { status: 401 })` sem sessão; body via `schema.safeParse(await request.json())` → `400` com `{ error: parsed.error.message }`; `Error` conhecido do repo → `404` com `{ error }`.
- **Data.** O app manda `'YYYY-MM-DD'`; o backend persiste `new Date(`${ymd}T12:00:00`)` (helper `toDate` já existe nos dois route files).
- **Enums.** `RecurrenceInterval` = `'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY'`. `installments` inteiro `2..24`.
- **App UI** só de `#/tw`; exceções permitidas já em uso + `Switch` (de `react-native`).
- **Testes de tela mobile** mockam `#/tw`, `lucide-react-native`, `expo-router` (inclui `useFocusEffect`), `#/api/*`, `#/components/transactions/transaction-sheet-context`. Sem `fireEvent.press` que dispare `useMutation` + `waitFor` (trava o RNTL v13 nesse ambiente) — testes de sheet/tela verificam superfície de render e estado local.
- **Decisão D3:** modo edição do sheet NÃO muda — nada de toggle de recorrência/parcela quando `tx` está setado. `TransactionEditInput` não muda.
- **Decisão D6:** os cards Receitas/Despesas continuam somando sobre `txs` (mês inteiro), nunca sobre `filteredTxs`.
- **Commits:** terminar cada task com commit. Mensagens em pt-BR, sem escopo além da task.
- Rodar `npx tsc --noEmit` limpo ao fim de cada task que toca `.ts`/`.tsx`.

---

## File Structure

**nexis (backend):**
- `src/server/repositories/transaction.repository.ts` — MODIFY: `calcNextDue` vira `export`.
- `src/routes/api/mobile/transactions.ts` — MODIFY: `createBody` + handler `POST`.
- `src/routes/api/mobile/transactions.$id.ts` — MODIFY: handler `DELETE`.
- `src/routes/api/mobile/transactions.test.ts` — MODIFY: casos de recorrência/parcela.
- `src/routes/api/mobile/transactions.$id.test.ts` — MODIFY: casos de `?mode=`.

**nexis-mobile (app):**
- `src/schemas/transaction.ts` — MODIFY: `TransactionInput` += 3 campos.
- `src/schemas/transaction.test.ts` — MODIFY: validação dos campos novos.
- `src/api/transactions.ts` — MODIFY: `createTransaction` tolera `null`; `deleteTransaction(id, mode?)`.
- `src/api/transactions.test.ts` — MODIFY: `?mode=` e resposta `null`.
- `src/components/transactions/transaction-sheet.tsx` — MODIFY: bloco Repetir/Parcelar (só criação) + seletor de exclusão de grupo + `INTERVALS` const.
- `src/__tests__/transaction-sheet.test.tsx` — MODIFY: render dos toggles e do seletor.
- `src/app/(app)/transactions.tsx` — MODIFY: estado de filtro, `filteredTxs`, `categoriesInMonth`, barra colapsável, empty state.
- `src/__tests__/transactions-screen.test.tsx` — MODIFY: filtro estreita a lista, resumo imune, "limpar".

---

## Task 1: `nexis` — exportar `calcNextDue`

**Repo:** `nexis`

**Files:**
- Modify: `src/server/repositories/transaction.repository.ts` (a `function calcNextDue`, ~linha 22)

**Interfaces:**
- Produces: `export function calcNextDue(from: Date, interval: RecurrenceInterval): Date` — soma 7 dias (WEEKLY), 14 (BIWEEKLY), 1 mês (MONTHLY), 1 ano (YEARLY).

- [ ] **Step 1: Setup da branch**

```bash
cd /home/welbertbarbosa/projects/personal/nexis
git fetch origin -q && git checkout -b feat/mobile-slice-4-transactions-backend origin/main
```

- [ ] **Step 2: Tornar `calcNextDue` exportada**

Em `src/server/repositories/transaction.repository.ts`, trocar:

```ts
function calcNextDue(from: Date, interval: RecurrenceInterval): Date {
```

por:

```ts
export function calcNextDue(from: Date, interval: RecurrenceInterval): Date {
```

Nenhuma outra mudança. `processDueRecurring` continua chamando a mesma função no mesmo arquivo.

- [ ] **Step 3: Verificar que compila e os testes existentes passam**

Run: `cd /home/welbertbarbosa/projects/personal/nexis && npx tsc --noEmit && npx vitest run src/server/repositories`
Expected: PASS (ou "no test files" pra o segundo — ok). `tsc` sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/server/repositories/transaction.repository.ts
git commit -m "refactor: exporta calcNextDue do transaction.repository"
```

---

## Task 2: `nexis` — `POST /api/mobile/transactions` aceita recorrência e parcelamento

**Repo:** `nexis`

**Files:**
- Modify: `src/routes/api/mobile/transactions.ts`
- Test: `src/routes/api/mobile/transactions.test.ts`

**Interfaces:**
- Consumes: `calcNextDue` (Task 1); `createTransaction`, `createInstallments`, `getTransactionsByMonth` de `#/server/repositories/transaction.repository`.
- Produces: `POST /api/mobile/transactions` aceitando body `{ walletId, amount, type, categoryId?, description?, date?, recurring?, interval?, installments? }`. `installments >= 2` → responde `null` (200). Senão → responde `{ ...t, amount: number }` (200). `recurring` sem `interval` usa `'MONTHLY'`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/routes/api/mobile/transactions.test.ts`, adicionar `createInstallments` e `calcNextDue` ao mock do repositório e novos casos.

Trocar o bloco de mock:

```ts
const getSession = vi.fn()
const getTransactionsByMonth = vi.fn()
const createTransaction = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/transaction.repository', () => ({
  getTransactionsByMonth: (...a: unknown[]) => getTransactionsByMonth(...a),
  createTransaction: (...a: unknown[]) => createTransaction(...a),
}))
```

por:

```ts
const getSession = vi.fn()
const getTransactionsByMonth = vi.fn()
const createTransaction = vi.fn()
const createInstallments = vi.fn()
const calcNextDue = vi.fn(() => new Date('2099-01-01T12:00:00.000Z'))

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/transaction.repository', () => ({
  getTransactionsByMonth: (...a: unknown[]) => getTransactionsByMonth(...a),
  createTransaction: (...a: unknown[]) => createTransaction(...a),
  createInstallments: (...a: unknown[]) => createInstallments(...a),
  calcNextDue: (...a: unknown[]) => calcNextDue(...a),
}))
```

No `beforeEach`, adicionar os resets:

```ts
    createInstallments.mockReset()
    calcNextDue.mockReset()
    calcNextDue.mockReturnValue(new Date('2099-01-01T12:00:00.000Z'))
```

Adicionar os casos (dentro do `describe('/api/mobile/transactions')`):

```ts
  it('POST com installments>=2 chama createInstallments e responde null', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    createInstallments.mockResolvedValue({ id: 'root' })
    const res = await (await handlers()).POST({
      request: req('http://x/api/mobile/transactions', 'POST', {
        walletId: 'w1',
        amount: 300,
        type: 'EXPENSE',
        installments: 3,
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(createInstallments).toHaveBeenCalledWith(
      expect.objectContaining({ walletId: 'w1', amount: 300, type: 'EXPENSE', installments: 3 }),
    )
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it('POST recurring calcula nextDue no backend e passa pro createTransaction', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    createTransaction.mockResolvedValue({ id: 't9', amount: { toNumber: () => 50 } })
    await (await handlers()).POST({
      request: req('http://x/api/mobile/transactions', 'POST', {
        walletId: 'w1',
        amount: 50,
        type: 'EXPENSE',
        date: '2026-09-15',
        recurring: true,
        interval: 'WEEKLY',
      }),
    })
    expect(calcNextDue).toHaveBeenCalledWith(expect.any(Date), 'WEEKLY')
    const passed = createTransaction.mock.calls[0][0]
    expect(passed.recurring).toBe(true)
    expect(passed.interval).toBe('WEEKLY')
    expect(passed.nextDue).toEqual(new Date('2099-01-01T12:00:00.000Z'))
  })

  it('POST recurring sem interval usa MONTHLY', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    createTransaction.mockResolvedValue({ id: 't9', amount: { toNumber: () => 50 } })
    await (await handlers()).POST({
      request: req('http://x/api/mobile/transactions', 'POST', {
        walletId: 'w1',
        amount: 50,
        type: 'EXPENSE',
        recurring: true,
      }),
    })
    expect(calcNextDue).toHaveBeenCalledWith(expect.any(Date), 'MONTHLY')
  })

  it('POST installments:1 é 400 (mínimo 2)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).POST({
      request: req('http://x/api/mobile/transactions', 'POST', {
        walletId: 'w1',
        amount: 10,
        type: 'EXPENSE',
        installments: 1,
      }),
    })
    expect(res.status).toBe(400)
    expect(createInstallments).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis && npx vitest run src/routes/api/mobile/transactions.test.ts`
Expected: FAIL — `createInstallments` / `calcNextDue` não são chamados (a rota ainda ignora esses campos).

- [ ] **Step 3: Implementar na rota**

Em `src/routes/api/mobile/transactions.ts`:

Trocar o import:

```ts
import { createTransaction, getTransactionsByMonth } from '#/server/repositories/transaction.repository'
```

por:

```ts
import {
  calcNextDue,
  createInstallments,
  createTransaction,
  getTransactionsByMonth,
} from '#/server/repositories/transaction.repository'
```

Trocar `createBody`:

```ts
// Cópia do createTransactionSchema de transaction.service.ts, sem os campos de
// recorrência/parcelamento (fora do escopo da Fatia 3 do app mobile).
const createBody = z.object({
  walletId: z.string(),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(), // 'YYYY-MM-DD'
})
```

por:

```ts
// Cópia do createTransactionSchema de transaction.service.ts.
const createBody = z.object({
  walletId: z.string(),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(), // 'YYYY-MM-DD'
  recurring: z.boolean().optional(),
  interval: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  installments: z.number().int().min(2).max(24).optional(),
})
```

Trocar o corpo do handler `POST` (o bloco depois do `if (!parsed.success)`):

```ts
        const { date, ...rest } = parsed.data
        const t = await createTransaction({ ...rest, date: toDate(date) })
        return Response.json({ ...t, amount: t.amount.toNumber() })
```

por:

```ts
        const { date, installments, recurring, interval, ...rest } = parsed.data
        const when = toDate(date) ?? new Date()

        if (installments && installments >= 2) {
          await createInstallments({
            walletId: rest.walletId,
            amount: rest.amount,
            type: rest.type,
            categoryId: rest.categoryId,
            description: rest.description,
            date: when,
            installments,
          })
          return Response.json(null)
        }

        const nextDue = recurring ? calcNextDue(when, interval ?? 'MONTHLY') : undefined
        const t = await createTransaction({
          ...rest,
          date: toDate(date),
          recurring,
          interval,
          nextDue,
        })
        return Response.json({ ...t, amount: t.amount.toNumber() })
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis && npx vitest run src/routes/api/mobile/transactions.test.ts && npx tsc --noEmit`
Expected: PASS. `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/mobile/transactions.ts src/routes/api/mobile/transactions.test.ts
git commit -m "feat: POST /api/mobile/transactions aceita recorrência e parcelamento"
```

---

## Task 3: `nexis` — `DELETE /api/mobile/transactions/$id?mode=`

**Repo:** `nexis`

**Files:**
- Modify: `src/routes/api/mobile/transactions.$id.ts`
- Test: `src/routes/api/mobile/transactions.$id.test.ts`

**Interfaces:**
- Consumes: `deleteTransaction`, `deleteInstallmentGroup` de `#/server/repositories/transaction.repository`.
- Produces: `DELETE /api/mobile/transactions/$id` aceitando `?mode=this|this-and-future|all` opcional. Com `mode` válido → `deleteInstallmentGroup(id, userId, mode)`. Sem `mode` (ou inválido) → `deleteTransaction(id, userId)`. Sucesso → `200` + `null`. Erro do repo → `404`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/routes/api/mobile/transactions.$id.test.ts`, adicionar `deleteInstallmentGroup` ao mock:

Trocar:

```ts
const getSession = vi.fn()
const updateTransaction = vi.fn()
const deleteTransaction = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/transaction.repository', () => ({
  updateTransaction: (...a: unknown[]) => updateTransaction(...a),
  deleteTransaction: (...a: unknown[]) => deleteTransaction(...a),
}))
```

por:

```ts
const getSession = vi.fn()
const updateTransaction = vi.fn()
const deleteTransaction = vi.fn()
const deleteInstallmentGroup = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/transaction.repository', () => ({
  updateTransaction: (...a: unknown[]) => updateTransaction(...a),
  deleteTransaction: (...a: unknown[]) => deleteTransaction(...a),
  deleteInstallmentGroup: (...a: unknown[]) => deleteInstallmentGroup(...a),
}))
```

No `beforeEach` adicionar `deleteInstallmentGroup.mockReset()`.

Adicionar um helper de request com query e os casos (dentro do `describe('/api/mobile/transactions/$id')`):

```ts
  function delReq(qs = '') {
    return new Request(`http://x/api/mobile/transactions/t1${qs}`, { method: 'DELETE' })
  }

  it('DELETE ?mode=all chama deleteInstallmentGroup', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteInstallmentGroup.mockResolvedValue(undefined)
    const res = await (await handlers()).DELETE({ request: delReq('?mode=all'), params: { id: 't1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(deleteInstallmentGroup).toHaveBeenCalledWith('t1', 'u1', 'all')
    expect(deleteTransaction).not.toHaveBeenCalled()
  })

  it('DELETE ?mode=this-and-future chama deleteInstallmentGroup', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteInstallmentGroup.mockResolvedValue(undefined)
    await (await handlers()).DELETE({ request: delReq('?mode=this-and-future'), params: { id: 't1' } })
    expect(deleteInstallmentGroup).toHaveBeenCalledWith('t1', 'u1', 'this-and-future')
  })

  it('DELETE sem mode chama deleteTransaction', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteTransaction.mockResolvedValue(undefined)
    await (await handlers()).DELETE({ request: delReq(), params: { id: 't1' } })
    expect(deleteTransaction).toHaveBeenCalledWith('t1', 'u1')
    expect(deleteInstallmentGroup).not.toHaveBeenCalled()
  })

  it('DELETE ?mode=foo (inválido) cai no deleteTransaction', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteTransaction.mockResolvedValue(undefined)
    await (await handlers()).DELETE({ request: delReq('?mode=foo'), params: { id: 't1' } })
    expect(deleteTransaction).toHaveBeenCalledWith('t1', 'u1')
  })

  it('DELETE ?mode=all com erro do repo → 404', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteInstallmentGroup.mockRejectedValue(new Error('Transaction not found'))
    const res = await (await handlers()).DELETE({ request: delReq('?mode=all'), params: { id: 't1' } })
    expect(res.status).toBe(404)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis && npx vitest run src/routes/api/mobile/transactions.\$id.test.ts`
Expected: FAIL — `deleteInstallmentGroup` nunca é chamado.

- [ ] **Step 3: Implementar na rota**

Em `src/routes/api/mobile/transactions.$id.ts`:

Trocar o import:

```ts
import { deleteTransaction, updateTransaction } from '#/server/repositories/transaction.repository'
```

por:

```ts
import {
  deleteInstallmentGroup,
  deleteTransaction,
  updateTransaction,
} from '#/server/repositories/transaction.repository'
```

Trocar o handler `DELETE` inteiro:

```ts
      DELETE: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        try {
          await deleteTransaction(txId(request, params), session.user.id)
          return Response.json(null)
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao excluir transação' },
            { status: 404 },
          )
        }
      },
```

por:

```ts
      DELETE: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const mode = new URL(request.url).searchParams.get('mode')
        const groupMode =
          mode === 'this' || mode === 'this-and-future' || mode === 'all' ? mode : null

        try {
          if (groupMode) {
            await deleteInstallmentGroup(txId(request, params), session.user.id, groupMode)
          } else {
            await deleteTransaction(txId(request, params), session.user.id)
          }
          return Response.json(null)
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao excluir transação' },
            { status: 404 },
          )
        }
      },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis && npx vitest run src/routes/api/mobile && npx tsc --noEmit`
Expected: PASS em todos os testes de `src/routes/api/mobile`. `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/mobile/transactions.$id.ts src/routes/api/mobile/transactions.$id.test.ts
git commit -m "feat: DELETE /api/mobile/transactions/\$id aceita ?mode= para grupos"
```

- [ ] **Step 6: Regenerar route tree e rodar a suíte cheia**

Run:
```bash
cd /home/welbertbarbosa/projects/personal/nexis
node -e "const {Generator,getConfig}=require('@tanstack/router-generator');new Generator({config:getConfig({},process.cwd()),root:process.cwd()}).run().then(()=>console.log('ok'))"
npx vitest run
git add src/routeTree.gen.ts
git commit -m "chore: regenera routeTree" --allow-empty
```
Expected: suíte cheia verde. (O `--allow-empty` cobre o caso do routeTree não ter mudado — as rotas já existiam.)

---

## Task 4: `nexis-mobile` — `TransactionInput` ganha recorrência/parcelamento

**Repo:** `nexis-mobile`

**Files:**
- Modify: `src/schemas/transaction.ts`
- Test: `src/schemas/transaction.test.ts`

**Interfaces:**
- Produces: `TransactionInputData` agora com `recurring?: boolean`, `interval?: 'WEEKLY'|'BIWEEKLY'|'MONTHLY'|'YEARLY'`, `installments?: number` (int 2–24). `TransactionEditInput` inalterado.

- [ ] **Step 1: Setup da branch**

```bash
cd /home/welbertbarbosa/projects/personal/nexis-mobile
git fetch origin -q && git checkout -b feat/mobile-slice-4-transactions origin/main
```

- [ ] **Step 2: Escrever os testes que falham**

Em `src/schemas/transaction.test.ts`, adicionar ao `describe('bodies')`:

```ts
  it('TransactionInput aceita recurring + interval', () => {
    const out = TransactionInput.parse({
      walletId: 'w1',
      amount: 10,
      type: 'EXPENSE',
      recurring: true,
      interval: 'WEEKLY',
    })
    expect(out).toMatchObject({ recurring: true, interval: 'WEEKLY' })
  })

  it('TransactionInput aceita installments no range 2..24 e rejeita fora', () => {
    expect(
      TransactionInput.parse({ walletId: 'w1', amount: 10, type: 'EXPENSE', installments: 3 }),
    ).toMatchObject({ installments: 3 })
    expect(() =>
      TransactionInput.parse({ walletId: 'w1', amount: 10, type: 'EXPENSE', installments: 1 }),
    ).toThrow()
    expect(() =>
      TransactionInput.parse({ walletId: 'w1', amount: 10, type: 'EXPENSE', installments: 25 }),
    ).toThrow()
  })

  it('TransactionInput rejeita interval fora do enum', () => {
    expect(() =>
      TransactionInput.parse({ walletId: 'w1', amount: 10, type: 'EXPENSE', interval: 'DAILY' }),
    ).toThrow()
  })
```

Garantir que `TransactionInput` está no import do topo do arquivo (já deve estar — o arquivo hoje importa `TransactionInput`, `TransactionEditInput`).

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/schemas/transaction.test.ts`
Expected: FAIL — `interval: 'DAILY'` não lança (campo desconhecido é ignorado hoje), `installments` idem.

- [ ] **Step 4: Implementar no schema**

Em `src/schemas/transaction.ts`, trocar:

```ts
export const TransactionInput = z.object({
  walletId: z.string(),
  amount: z.number().positive(),
  type: TX_TYPE,
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(), // 'YYYY-MM-DD'
})
export type TransactionInputData = z.infer<typeof TransactionInput>
```

por:

```ts
export const TransactionInput = z.object({
  walletId: z.string(),
  amount: z.number().positive(),
  type: TX_TYPE,
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(), // 'YYYY-MM-DD'
  recurring: z.boolean().optional(),
  interval: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  installments: z.number().int().min(2).max(24).optional(),
})
export type TransactionInputData = z.infer<typeof TransactionInput>
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/schemas/transaction.test.ts && npx tsc --noEmit`
Expected: PASS. `tsc` limpo.

- [ ] **Step 6: Commit**

```bash
git add src/schemas/transaction.ts src/schemas/transaction.test.ts
git commit -m "feat: TransactionInput aceita recurring/interval/installments"
```

---

## Task 5: `nexis-mobile` — api: `createTransaction` tolera `null`, `deleteTransaction(id, mode?)`

**Repo:** `nexis-mobile`

**Files:**
- Modify: `src/api/transactions.ts`
- Test: `src/api/transactions.test.ts`

**Interfaces:**
- Consumes: `TransactionInputData` (Task 4).
- Produces:
  - `createTransaction(body: TransactionInputData): Promise<Partial<Transaction> | null>` — resolve `null` quando o backend responde `null` (parcelamento).
  - `deleteTransaction(id: string, mode?: 'this' | 'this-and-future' | 'all'): Promise<void>` — monta `?mode=` quando passado.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/api/transactions.test.ts`, adicionar dentro do `describe('mutations')`:

```ts
  it('createTransaction resolve null quando a resposta é null (parcelamento)', async () => {
    jest.spyOn(globalThis, 'fetch').mockReturnValue(okJson(null))
    await expect(
      createTransaction({ walletId: 'w1', amount: 300, type: 'EXPENSE', installments: 3 }),
    ).resolves.toBeNull()
  })

  it('deleteTransaction(id, mode) monta ?mode=', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockReturnValue(okJson(null))
    await deleteTransaction('t1', 'all')
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/mobile/transactions/t1?mode=all')
    expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe('DELETE')
  })

  it('deleteTransaction(id) sem mode não põe query', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockReturnValue(okJson(null))
    await deleteTransaction('t1')
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/mobile/transactions/t1')
    expect(fetchSpy.mock.calls[0][0]).not.toContain('?mode=')
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/api/transactions.test.ts`
Expected: FAIL — `createTransaction` com resposta `null` lança no `TransactionSchema.partial().parse(null)`; `deleteTransaction` não aceita 2º argumento.

- [ ] **Step 3: Implementar**

Em `src/api/transactions.ts`, trocar:

```ts
export const createTransaction = (body: TransactionInputData) =>
  apiPost('/api/mobile/transactions', body, (r) => TransactionSchema.partial().parse(r))
```

por:

```ts
export const createTransaction = (body: TransactionInputData) =>
  apiPost('/api/mobile/transactions', body, (r) =>
    r == null ? null : TransactionSchema.partial().parse(r),
  )
```

E trocar:

```ts
export const deleteTransaction = (id: string) => apiDelete(`/api/mobile/transactions/${id}`)
```

por:

```ts
export const deleteTransaction = (
  id: string,
  mode?: 'this' | 'this-and-future' | 'all',
) => apiDelete(`/api/mobile/transactions/${id}${mode ? `?mode=${mode}` : ''}`)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/api/transactions.test.ts && npx tsc --noEmit`
Expected: PASS. `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add src/api/transactions.ts src/api/transactions.test.ts
git commit -m "feat: createTransaction tolera resposta null; deleteTransaction aceita mode"
```

---

## Task 6: `nexis-mobile` — sheet: bloco Repetir / Parcelar (só na criação)

**Repo:** `nexis-mobile`

**Files:**
- Modify: `src/components/transactions/transaction-sheet.tsx`
- Test: `src/__tests__/transaction-sheet.test.tsx`

**Interfaces:**
- Consumes: `createTransaction` (Task 5). `Switch` de `react-native`.
- Produces: no modo criação (`!isEdit`), o sheet mostra "Repetir" (com chip-row de intervalo quando ligado) e, se `type === 'EXPENSE'`, "Parcelar" (com contador quando ligado). Ligar um desliga o outro. O `save` da criação envia `recurring`/`interval`/`installments` conforme os toggles.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/__tests__/transaction-sheet.test.tsx`, adicionar casos. O arquivo já mocka `#/api/transactions`, `#/api/wallets`, `#/api/categories`, `@react-native-community/datetimepicker`, `expo-router`, `#/tw`, `#/components/ui/sheet`, `lucide-react-native`, `#/lib/category-icons`. `Switch` vem do `react-native` real (jest-expo renderiza).

```ts
  it('criação (EXPENSE) mostra Repetir e Parcelar', () => {
    const { getByText } = wrap(<TransactionSheet ref={createRef<SheetRef>()} />)
    expect(getByText('Repetir')).toBeTruthy()
    expect(getByText('Parcelar')).toBeTruthy()
  })

  it('criação com tipo INCOME não mostra Parcelar', () => {
    const { getByText, queryByText } = wrap(<TransactionSheet ref={createRef<SheetRef>()} />)
    fireEvent.press(getByText('Receita'))
    expect(getByText('Repetir')).toBeTruthy()
    expect(queryByText('Parcelar')).toBeNull()
  })

  it('edição não mostra Repetir nem Parcelar', () => {
    const { queryByText } = wrap(<TransactionSheet ref={createRef<SheetRef>()} tx={TX} />)
    expect(queryByText('Repetir')).toBeNull()
    expect(queryByText('Parcelar')).toBeNull()
  })
```

(`TX`, `wrap`, `WALLET`, `CATEGORY` já existem no arquivo. `fireEvent` já é importado.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/__tests__/transaction-sheet.test.tsx`
Expected: FAIL — "Repetir" / "Parcelar" não existem.

- [ ] **Step 3: Implementar — imports, const e estado**

Em `src/components/transactions/transaction-sheet.tsx`:

Trocar o import de `react-native`:

```ts
import { Animated, Modal, Platform } from 'react-native'
```

por:

```ts
import { Animated, Modal, Platform, Switch } from 'react-native'
```

Logo após `type TxType = TransactionType` (linha ~20), adicionar:

```ts
type Interval = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY'

const INTERVALS: { value: Interval; label: string }[] = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quinzenal' },
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'YEARLY', label: 'Anual' },
]

const MIN_INSTALLMENTS = 2
const MAX_INSTALLMENTS = 24
```

No corpo do componente, junto dos outros `useState` (depois de `showDatePicker`, linha ~39), adicionar:

```ts
  const [recurring, setRecurring] = useState(false)
  const [interval, setInterval] = useState<Interval>('MONTHLY')
  const [parceling, setParceling] = useState(false)
  const [installments, setInstallments] = useState(MIN_INSTALLMENTS)
```

Em `reset()`, junto dos outros setters, adicionar:

```ts
    setRecurring(false)
    setInterval('MONTHLY')
    setParceling(false)
    setInstallments(MIN_INSTALLMENTS)
```

- [ ] **Step 4: Implementar — payload do `save`**

No `save` mutation `mutationFn`, trocar o branch de criação:

```ts
        : createTransaction({
            amount,
            type,
            walletId,
            categoryId: categoryId ?? undefined,
            description: description.trim() || undefined,
            date: dateStr,
          })
```

por:

```ts
        : createTransaction({
            amount,
            type,
            walletId,
            categoryId: categoryId ?? undefined,
            description: description.trim() || undefined,
            date: dateStr,
            recurring: recurring || undefined,
            interval: recurring ? interval : undefined,
            installments: parceling ? installments : undefined,
          })
```

- [ ] **Step 5: Implementar — a tela de sucesso**

Trocar:

```ts
            <Text className="text-sm font-medium text-muted">
              {isEdit ? 'Transação atualizada' : 'Transação salva'}
            </Text>
```

por:

```ts
            <Text className="text-sm font-medium text-muted">
              {parceling
                ? `${installments} parcelas criadas`
                : isEdit
                  ? 'Transação atualizada'
                  : 'Transação salva'}
            </Text>
```

- [ ] **Step 6: Implementar — o bloco de UI**

No JSX, dentro do `<Pressable onPress={collapseChips} ...>` do modo criação, entre o campo **Descrição** (`<SheetField ... onFocus={collapseChips} />`) e o `{save.isError && ...}`, inserir:

```tsx
            {/* Repetir / Parcelar — só na criação */}
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-fg">Repetir</Text>
                <Switch
                  value={recurring}
                  onValueChange={(v) => {
                    collapseChips()
                    setRecurring(v)
                    if (v) setParceling(false)
                  }}
                  trackColor={{ true: colors.accent, false: colors.border }}
                  thumbColor={colors.fg}
                />
              </View>
              {recurring && (
                <View className="flex-row flex-wrap gap-2">
                  {INTERVALS.map((it) => {
                    const on = interval === it.value
                    return (
                      <Pressable
                        key={it.value}
                        onPress={() => setInterval(it.value)}
                        className="rounded-full px-3 py-1.5"
                        style={{ backgroundColor: on ? colors.fg : colors.border }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{ color: on ? colors.bg : colors.muted }}
                        >
                          {it.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              )}

              {type === 'EXPENSE' && (
                <>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-fg">Parcelar</Text>
                    <Switch
                      value={parceling}
                      onValueChange={(v) => {
                        collapseChips()
                        setParceling(v)
                        if (v) setRecurring(false)
                      }}
                      trackColor={{ true: colors.accent, false: colors.border }}
                      thumbColor={colors.fg}
                    />
                  </View>
                  {parceling && (
                    <View className="gap-1.5">
                      <View className="flex-row items-center justify-center gap-6">
                        <Pressable
                          onPress={() => setInstallments((n) => Math.max(MIN_INSTALLMENTS, n - 1))}
                          disabled={installments <= MIN_INSTALLMENTS}
                          className="h-9 w-9 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: colors.border,
                            opacity: installments <= MIN_INSTALLMENTS ? 0.4 : 1,
                          }}
                        >
                          <Text className="text-lg text-fg">−</Text>
                        </Pressable>
                        <Text className="text-lg font-semibold text-fg" style={tabularNums}>
                          {installments}x
                        </Text>
                        <Pressable
                          onPress={() => setInstallments((n) => Math.min(MAX_INSTALLMENTS, n + 1))}
                          disabled={installments >= MAX_INSTALLMENTS}
                          className="h-9 w-9 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: colors.border,
                            opacity: installments >= MAX_INSTALLMENTS ? 0.4 : 1,
                          }}
                        >
                          <Text className="text-lg text-fg">＋</Text>
                        </Pressable>
                      </View>
                      <Text className="text-center text-xs text-muted">
                        de {fmtBRL(cents / 100 / installments)} cada
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
```

Adicionar `fmtBRL` e `tabularNums` ao import de `#/lib/format` (hoje: `import { fmtDate, toYMD } from '#/lib/format'` → `import { fmtBRL, fmtDate, tabularNums, toYMD } from '#/lib/format'`).

- [ ] **Step 7: Guard — trocar tipo pra INCOME desliga Parcelar**

No `onPress` das pills de **Tipo** (o bloco que hoje faz `collapseChips(); setType(opt.value); setCategoryId(null)`), acrescentar a última linha:

```ts
                    onPress={() => {
                      collapseChips()
                      setType(opt.value)
                      setCategoryId(null)
                      if (opt.value === 'INCOME') setParceling(false)
                    }}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/__tests__/transaction-sheet.test.tsx && npx tsc --noEmit`
Expected: PASS. `tsc` limpo.

- [ ] **Step 9: Commit**

```bash
git add src/components/transactions/transaction-sheet.tsx src/__tests__/transaction-sheet.test.tsx
git commit -m "feat: toggles Repetir/Parcelar no sheet de nova transação"
```

---

## Task 7: `nexis-mobile` — sheet: seletor de exclusão de grupo

**Repo:** `nexis-mobile`

**Files:**
- Modify: `src/components/transactions/transaction-sheet.tsx`
- Test: `src/__tests__/transaction-sheet.test.tsx`

**Interfaces:**
- Consumes: `deleteTransaction(id, mode?)` (Task 5).
- Produces: quando `tx` é parcela (`tx.isInstallment`) ou recorrente (`tx.recurring || tx.parentId`), a confirmação de exclusão vira 3 opções → `remove.mutate('this' | 'this-and-future' | 'all')`. Caso comum → confirmação atual → `remove.mutate(undefined)`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/__tests__/transaction-sheet.test.tsx`. Primeiro, garantir fixtures. No topo do arquivo já existe `TX` (uma transação comum). Adicionar duas variações perto dele:

```ts
const TX_INSTALLMENT: Transaction = { ...TX, id: 't2', isInstallment: true, description: 'Sofá (2/6)' }
const TX_RECURRING: Transaction = { ...TX, id: 't3', recurring: true, description: 'Netflix' }
```

Casos:

```ts
  it('lixeira numa parcela abre o seletor de 3 opções', () => {
    const { getByTestId, getByText } = wrap(
      <TransactionSheet ref={createRef<SheetRef>()} tx={TX_INSTALLMENT} />,
    )
    fireEvent.press(getByTestId('transaction-delete'))
    expect(getByText('Só esta parcela')).toBeTruthy()
    expect(getByText('Esta e as próximas')).toBeTruthy()
    expect(getByText('Todas as parcelas')).toBeTruthy()
  })

  it('lixeira num recorrente abre o seletor de série', () => {
    const { getByTestId, getByText } = wrap(
      <TransactionSheet ref={createRef<SheetRef>()} tx={TX_RECURRING} />,
    )
    fireEvent.press(getByTestId('transaction-delete'))
    expect(getByText('Só esta ocorrência')).toBeTruthy()
    expect(getByText('Esta e as futuras')).toBeTruthy()
    expect(getByText('Toda a série')).toBeTruthy()
  })

  it('lixeira numa transação comum mantém a confirmação simples', () => {
    const { getByTestId, getByText, queryByText } = wrap(
      <TransactionSheet ref={createRef<SheetRef>()} tx={TX} />,
    )
    fireEvent.press(getByTestId('transaction-delete'))
    expect(getByText('Excluir esta transação?')).toBeTruthy()
    expect(queryByText('Todas as parcelas')).toBeNull()
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/__tests__/transaction-sheet.test.tsx`
Expected: FAIL — os textos do seletor não existem.

- [ ] **Step 3: Implementar — a `remove` mutation**

Trocar:

```ts
  const remove = useMutation({
    mutationFn: () => deleteTransaction(tx!.id),
    onSuccess: () => {
      invalidate()
      ;(ref as React.RefObject<SheetRef>)?.current?.dismiss()
    },
  })
```

por:

```ts
  const remove = useMutation({
    mutationFn: (mode?: 'this' | 'this-and-future' | 'all') => deleteTransaction(tx!.id, mode),
    onSuccess: () => {
      invalidate()
      ;(ref as React.RefObject<SheetRef>)?.current?.dismiss()
    },
  })

  const isGroupTx = !!tx && (tx.isInstallment || tx.recurring || !!tx.parentId)
```

- [ ] **Step 4: Implementar — o bloco `confirmDelete`**

Trocar o bloco inteiro do `) : confirmDelete ? (` (o `<View className="items-center gap-4 py-6">` com "Excluir esta transação?"):

```tsx
        ) : confirmDelete ? (
          <View className="items-center gap-4 py-6">
            <Text className="text-sm text-fg">Excluir esta transação?</Text>
            <Text className="text-center text-xs text-muted">
              O saldo da carteira será revertido.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-border py-3"
              >
                <Text className="text-center text-sm text-muted">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => remove.mutate()}
                disabled={remove.isPending}
                className="flex-1 rounded-xl py-3"
                style={{ backgroundColor: 'rgba(248,113,113,0.18)' }}
              >
                <Text className="text-center text-sm font-medium" style={{ color: colors.negative }}>
                  {remove.isPending ? 'Excluindo…' : 'Excluir'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : saved ? (
```

por:

```tsx
        ) : confirmDelete ? (
          isGroupTx ? (
            <View className="gap-3 py-4">
              <Text className="text-center text-sm text-fg">
                {tx!.isInstallment ? 'Excluir parcelamento' : 'Excluir recorrência'}
              </Text>
              <Text className="text-center text-xs text-muted">
                O saldo da carteira será revertido.
              </Text>
              <Pressable
                onPress={() => remove.mutate('this')}
                disabled={remove.isPending}
                className="rounded-xl border border-border px-4 py-3.5 active:opacity-70"
              >
                <Text className="text-sm font-medium text-fg">
                  {tx!.isInstallment ? 'Só esta parcela' : 'Só esta ocorrência'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => remove.mutate('this-and-future')}
                disabled={remove.isPending}
                className="rounded-xl border border-border px-4 py-3.5 active:opacity-70"
              >
                <Text className="text-sm font-medium text-fg">
                  {tx!.isInstallment ? 'Esta e as próximas' : 'Esta e as futuras'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => remove.mutate('all')}
                disabled={remove.isPending}
                className="rounded-xl px-4 py-3.5 active:opacity-70"
                style={{ backgroundColor: 'rgba(248,113,113,0.18)' }}
              >
                <Text className="text-sm font-medium" style={{ color: colors.negative }}>
                  {tx!.isInstallment ? 'Todas as parcelas' : 'Toda a série'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmDelete(false)}
                className="rounded-xl border border-border py-3"
              >
                <Text className="text-center text-sm text-muted">Cancelar</Text>
              </Pressable>
            </View>
          ) : (
            <View className="items-center gap-4 py-6">
              <Text className="text-sm text-fg">Excluir esta transação?</Text>
              <Text className="text-center text-xs text-muted">
                O saldo da carteira será revertido.
              </Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setConfirmDelete(false)}
                  className="flex-1 rounded-xl border border-border py-3"
                >
                  <Text className="text-center text-sm text-muted">Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => remove.mutate(undefined)}
                  disabled={remove.isPending}
                  className="flex-1 rounded-xl py-3"
                  style={{ backgroundColor: 'rgba(248,113,113,0.18)' }}
                >
                  <Text
                    className="text-center text-sm font-medium"
                    style={{ color: colors.negative }}
                  >
                    {remove.isPending ? 'Excluindo…' : 'Excluir'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )
        ) : saved ? (
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/__tests__/transaction-sheet.test.tsx && npx tsc --noEmit`
Expected: PASS. `tsc` limpo.

- [ ] **Step 6: Commit**

```bash
git add src/components/transactions/transaction-sheet.tsx src/__tests__/transaction-sheet.test.tsx
git commit -m "feat: seletor esta/futuras/série na exclusão de parcela e recorrente"
```

---

## Task 8: `nexis-mobile` — tela: estado de filtro e `filteredTxs`

**Repo:** `nexis-mobile`

**Files:**
- Modify: `src/app/(app)/transactions.tsx`
- Test: `src/__tests__/transactions-screen.test.tsx`

**Interfaces:**
- Consumes: `walletsQuery` de `#/api/wallets`.
- Produces: a `SectionList` passa a listar `filteredTxs` (filtro de `filterType` / `filterWalletId` / `filterCategoryId`); `income`/`expenses` continuam sobre `txs`. `categoriesInMonth: { id, name, color, icon }[]` derivado das `txs`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/__tests__/transactions-screen.test.tsx`. O arquivo já mocka `expo-router`, `#/tw`, `lucide-react-native`, `#/lib/category-icons`, `#/api/transactions`, `#/components/transactions/transaction-sheet-context`. Adicionar mock de `#/api/wallets` (perto dos outros mocks):

```ts
jest.mock('#/api/wallets', () => ({
  walletsQuery: { queryKey: ['wallets'], queryFn: jest.fn(), staleTime: Infinity },
}))
```

Estender a `FIXTURE` pra ter categoria e casos de tipo distintos. Substituir a `FIXTURE` atual por:

```ts
const FIXTURE = [
  {
    id: 't1', type: 'INCOME', amount: 1000, description: 'Salário', date: today.toISOString(),
    walletId: 'w1', categoryId: 'c1',
    category: { name: 'Trabalho', color: '#22c55e', icon: null },
    wallet: { id: 'w1', name: 'Nubank', color: null },
    recurring: false, parentId: null, isInstallment: false, isTransfer: false,
  },
  {
    id: 't2', type: 'EXPENSE', amount: 50, description: 'Mercado', date: today.toISOString(),
    walletId: 'w1', categoryId: 'c2',
    category: { name: 'Alimentação', color: '#f00', icon: null },
    wallet: { id: 'w1', name: 'Nubank', color: null },
    recurring: false, parentId: null, isInstallment: false, isTransfer: false,
  },
  {
    id: 't3', type: 'EXPENSE', amount: 300, description: 'Transf p/ Poupança', date: yesterday.toISOString(),
    walletId: 'w1', categoryId: null, category: null,
    wallet: { id: 'w1', name: 'Nubank', color: null },
    recurring: false, parentId: null, isInstallment: false, isTransfer: true,
  },
]
```

Adicionar um `helper` de query pra `wallets` no `renderWith` (depois de `qc.setQueryData(['transactions', ...])`):

```ts
  qc.setQueryData(['wallets'], [{ id: 'w1', name: 'Nubank', type: 'CHECKING', color: null, icon: null, balance: 0, initialBalance: 0, creditLimit: null, closingDay: null, dueDay: null }])
```

Casos novos (dentro do `describe('Transactions screen')`):

```ts
  it('filtro de tipo Despesas some as receitas da lista mas o resumo não muda', () => {
    const { getByText, queryByText, getAllByText } = renderWith(FIXTURE)
    // resumo: receitas = 1000 (card + linha)
    expect(getAllByText(/1\.000,00/).length).toBeGreaterThanOrEqual(2)
    fireEvent.press(getByText('Filtros'))
    fireEvent.press(getByText('Despesas'))
    // linha do salário sai
    expect(queryByText('Salário')).toBeNull()
    // card Receitas continua com 1.000,00
    expect(getAllByText(/1\.000,00/).length).toBeGreaterThanOrEqual(1)
  })

  it('"limpar" restaura a lista', () => {
    const { getByText, queryByText } = renderWith(FIXTURE)
    fireEvent.press(getByText('Filtros'))
    fireEvent.press(getByText('Despesas'))
    expect(queryByText('Salário')).toBeNull()
    fireEvent.press(getByText('limpar'))
    expect(getByText('Salário')).toBeTruthy()
  })

  it('filtro sem resultado mostra o empty state de filtro', () => {
    const { getByText } = renderWith([FIXTURE[0]]) // só a receita
    fireEvent.press(getByText('Filtros'))
    fireEvent.press(getByText('Despesas'))
    expect(getByText('Nenhuma transação com esses filtros')).toBeTruthy()
  })
```

(`fireEvent` precisa estar importado — adicionar ao import do `@testing-library/react-native` se ainda não estiver: `import { render, fireEvent } from '@testing-library/react-native'`. Esses `fireEvent.press` são em `Pressable` que só chamam `setState` local — não disparam `useMutation`, então não travam.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/__tests__/transactions-screen.test.tsx`
Expected: FAIL — não existe "Filtros" / "Despesas" / "limpar" na tela.

- [ ] **Step 3: Implementar — imports e estado**

Em `src/app/(app)/transactions.tsx`:

Trocar o import de `lucide-react-native`:

```ts
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react-native'
```

por:

```ts
import {
  ChevronLeft,
  ChevronRight,
  FilterX,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native'
```

Adicionar o import de `walletsQuery` (perto do import de `monthTransactionsQuery`):

```ts
import { walletsQuery } from '#/api/wallets'
```

No componente, depois do `useState` de `{ year, month }` (linha ~31), adicionar:

```ts
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [filterWalletId, setFilterWalletId] = useState<string | null>(null)
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { data: wallets = [] } = useQuery(walletsQuery)

  const clearFilters = useCallback(() => {
    setFilterType('ALL')
    setFilterWalletId(null)
    setFilterCategoryId(null)
  }, [])
```

- [ ] **Step 4: Implementar — derivações**

Trocar:

```ts
  const { income, expenses } = useMemo(() => {
    let income = 0
    let expenses = 0
    for (const t of txs) {
      if (t.isTransfer) continue
      if (t.type === 'INCOME') income += t.amount
      else expenses += t.amount
    }
    return { income, expenses }
  }, [txs])

  const sections = useMemo(() => groupByDay(txs), [txs])
```

por:

```ts
  const { income, expenses } = useMemo(() => {
    let income = 0
    let expenses = 0
    for (const t of txs) {
      if (t.isTransfer) continue
      if (t.type === 'INCOME') income += t.amount
      else expenses += t.amount
    }
    return { income, expenses }
  }, [txs])

  const categoriesInMonth = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>()
    for (const t of txs) {
      if (t.categoryId && t.category && !seen.has(t.categoryId)) {
        seen.set(t.categoryId, { id: t.categoryId, name: t.category.name })
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [txs])

  const filteredTxs = useMemo(
    () =>
      txs.filter(
        (t) =>
          (filterType === 'ALL' || t.type === filterType) &&
          (!filterWalletId || t.walletId === filterWalletId) &&
          (!filterCategoryId || t.categoryId === filterCategoryId),
      ),
    [txs, filterType, filterWalletId, filterCategoryId],
  )

  const hasActiveFilter = filterType !== 'ALL' || !!filterWalletId || !!filterCategoryId

  const sections = useMemo(() => groupByDay(filteredTxs), [filteredTxs])
```

- [ ] **Step 5: Rodar `tsc` (a UI ainda falta, testes ainda falham)**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx tsc --noEmit`
Expected: pode acusar `hasActiveFilter`/`clearFilters`/`categoriesInMonth`/`wallets` não usados — ok, a Task 9 usa. Se preferir, seguir direto pra Task 9 sem commitar aqui.

- [ ] **Step 6: Commit (parcial, sem os testes ainda verdes)**

```bash
git add src/app/(app)/transactions.tsx
git commit -m "refactor: deriva filteredTxs/categoriesInMonth na tela de Transações" --no-verify
```

> Nota: os testes da Task 8 só passam ao fim da Task 9 (precisam da UI). Task 8 e 9 podem ser feitas juntas num único ciclo se o executor preferir — a fronteira existe só pra separar "dados" de "UI".

---

## Task 9: `nexis-mobile` — tela: barra de filtros colapsável + empty state

**Repo:** `nexis-mobile`

**Files:**
- Modify: `src/app/(app)/transactions.tsx`
- Test: `src/__tests__/transactions-screen.test.tsx` (os casos já escritos na Task 8)

**Interfaces:**
- Consumes: `filterType/filterWalletId/filterCategoryId/filtersOpen`, `clearFilters`, `hasActiveFilter`, `categoriesInMonth`, `wallets`, `filteredTxs` (Task 8).
- Produces: linha-gatilho "Filtros" abaixo dos cards de resumo; painel com 3 chip-rows; `ListEmptyComponent` sensível a `hasActiveFilter`.

- [ ] **Step 1: Implementar — a barra no header**

No JSX, dentro do `<View className="gap-4 px-4 pb-4 pt-4">`, logo depois do `<View className="flex-row gap-3">...</View>` dos `SummaryCard`, inserir:

```tsx
        {/* Filtros */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => setFiltersOpen((o) => !o)}
              className="flex-row items-center gap-2 active:opacity-70"
            >
              <SlidersHorizontal
                size={16}
                color={hasActiveFilter ? colors.fg : colors.muted}
              />
              <Text
                className="text-xs font-medium"
                style={{ color: hasActiveFilter ? colors.fg : colors.muted }}
              >
                {filterSummary(filterType, filterWalletId, filterCategoryId, wallets, categoriesInMonth)}
              </Text>
            </Pressable>
            {hasActiveFilter && (
              <Pressable
                onPress={clearFilters}
                className="flex-row items-center gap-1 active:opacity-70"
              >
                <FilterX size={13} color={colors.muted} />
                <Text className="text-xs text-muted">limpar</Text>
              </Pressable>
            )}
          </View>

          {filtersOpen && (
            <View className="gap-3 pt-1">
              <FilterRow
                label="Tipo"
                options={[
                  { id: 'ALL', name: 'Todas' },
                  { id: 'INCOME', name: 'Receitas' },
                  { id: 'EXPENSE', name: 'Despesas' },
                ]}
                selectedId={filterType}
                onSelect={(id) => setFilterType(id as 'ALL' | 'INCOME' | 'EXPENSE')}
                allowClear={false}
              />
              {wallets.length > 1 && (
                <FilterRow
                  label="Carteira"
                  options={wallets.map((w) => ({ id: w.id, name: w.name }))}
                  selectedId={filterWalletId}
                  onSelect={(id) => setFilterWalletId((cur) => (cur === id ? null : id))}
                  allowClear
                />
              )}
              {categoriesInMonth.length > 0 && (
                <FilterRow
                  label="Categoria"
                  options={categoriesInMonth}
                  selectedId={filterCategoryId}
                  onSelect={(id) => setFilterCategoryId((cur) => (cur === id ? null : id))}
                  allowClear
                />
              )}
            </View>
          )}
        </View>
```

- [ ] **Step 2: Implementar — `ListEmptyComponent`**

Trocar `ListEmptyComponent={<EmptyState />}` por:

```tsx
          ListEmptyComponent={
            hasActiveFilter ? <EmptyFiltered onClear={clearFilters} /> : <EmptyState />
          }
```

- [ ] **Step 3: Implementar — os componentes auxiliares e `filterSummary`**

No fim do arquivo (junto de `EmptyState`, `ListSkeleton`, `groupByDay`), adicionar:

```tsx
function filterSummary(
  type: 'ALL' | 'INCOME' | 'EXPENSE',
  walletId: string | null,
  categoryId: string | null,
  wallets: { id: string; name: string }[],
  cats: { id: string; name: string }[],
): string {
  const parts = [
    type === 'INCOME' ? 'Receitas' : type === 'EXPENSE' ? 'Despesas' : null,
    walletId ? (wallets.find((w) => w.id === walletId)?.name ?? null) : null,
    categoryId ? (cats.find((c) => c.id === categoryId)?.name ?? null) : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Filtros'
}

function FilterRow({
  label,
  options,
  selectedId,
  onSelect,
  allowClear,
}: {
  label: string
  options: { id: string; name: string }[]
  selectedId: string | null
  onSelect: (id: string) => void
  allowClear: boolean
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-[11px] uppercase tracking-wide text-muted">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {options.map((o) => {
          const on = selectedId === o.id
          return (
            <Pressable
              key={o.id}
              onPress={() => onSelect(o.id)}
              className="shrink-0 rounded-full px-3 py-1.5"
              style={{ backgroundColor: on ? colors.fg : colors.border }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: on ? colors.bg : colors.muted }}
              >
                {o.name}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {allowClear && selectedId != null && null}
    </View>
  )
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <View className="mt-6 items-center gap-3 rounded-2xl border border-border bg-card py-12">
      <Text className="text-sm text-muted">Nenhuma transação com esses filtros</Text>
      <Pressable onPress={onClear} className="rounded-full bg-accent px-4 py-2 active:opacity-80">
        <Text className="text-xs font-medium text-white">limpar filtros</Text>
      </Pressable>
    </View>
  )
}
```

Adicionar `ScrollView` ao import de `#/tw` (hoje: `import { View, Text, Pressable } from '#/tw'` → `import { View, Text, Pressable, ScrollView } from '#/tw'`).

> A linha `{allowClear && selectedId != null && null}` é só um marcador inócuo pra deixar claro que a limpeza individual é por re-toque na pill — não renderiza nada. Pode omitir.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest src/__tests__/transactions-screen.test.tsx && npx tsc --noEmit`
Expected: PASS (inclui os casos escritos na Task 8). `tsc` limpo.

- [ ] **Step 5: Rodar a suíte cheia**

Run: `cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest`
Expected: todos os testes verdes.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/transactions.tsx src/__tests__/transactions-screen.test.tsx
git commit -m "feat: barra de filtros (tipo/carteira/categoria) na tela de Transações"
```

---

## Task 10: verificação no device + PRs

**Repo:** ambos

- [ ] **Step 1: Backend — abrir PR**

```bash
cd /home/welbertbarbosa/projects/personal/nexis
git push -u origin feat/mobile-slice-4-transactions-backend
gh pr create --repo Welbert-Soares/nexis --base main --head feat/mobile-slice-4-transactions-backend \
  --title "feat: /api/mobile/transactions — recorrência, parcelamento, delete de grupo" \
  --body "Fatia 4 do Nexis Mobile (backend aditivo). POST reganha recurring/interval/installments (espelha addTransaction do PWA); DELETE ganha ?mode=this|this-and-future|all; calcNextDue exportado. Spec: docs/superpowers/specs/2026-09-08-nexis-mobile-slice-4-transactions-recurrence-filters-design.md. 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Mergear (squash) após o CI e sincronizar `main` local.

- [ ] **Step 2: App — rodar no device (`npx expo start --tunnel`, Expo Go)**

- Criar despesa "Mensal" hoje → aparece; fechar e reabrir o app → `triggerRecurring` gera a ocorrência do mês seguinte (navegar `›` e conferir). No PWA, o template deve ter `nextDue` no mês certo.
- Criar despesa 300,00 em 3x → 3 linhas de 100,00 em 3 meses; sucesso diz "3 parcelas criadas"; a lista pula pro 1º mês; descrições `(1/3)`…`(3/3)` no PWA.
- Tocar numa parcela → lixeira → 3 opções; testar "Só esta parcela", "Esta e as próximas", "Todas as parcelas" (recriar entre os testes) e conferir cada uma no PWA.
- Tocar numa ocorrência recorrente → 3 opções; "Toda a série" → reabrir o app e confirmar que não gera mais.
- Abrir a barra de filtros; combinar Tipo + Carteira + Categoria; a lista estreita, os cards Receitas/Despesas **não** mudam; "limpar" zera; navegar de mês mantém os filtros; filtro de categoria sem correspondência → "Nenhuma transação com esses filtros".
- Toda operação reflete na aba Carteiras e no Dashboard ao focar.

- [ ] **Step 3: App — abrir PR**

```bash
cd /home/welbertbarbosa/projects/personal/nexis-mobile
git push -u origin feat/mobile-slice-4-transactions
gh pr create --repo Welbert-Soares/nexis-mobile --base main --head feat/mobile-slice-4-transactions \
  --title "feat: Fatia 4 — recorrência, parcelamento e filtros nas Transações" \
  --body "Sheet ganha toggles Repetir/Parcelar (só na criação) e seletor esta/futuras/série na exclusão de grupo; tela ganha barra de filtros colapsável (tipo/carteira/categoria, client-side, resumo do mês imune). Contra as rotas /api/mobile/transactions* atualizadas. 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review

**1. Spec coverage**

| Requisito do spec | Task |
|---|---|
| D1 recorrência (toggle + intervalo, só criação) | 6 |
| D2 parcelamento (toggle + contador, só despesa, exclusivo) | 6 |
| D3 edição só básica (sem toggles) | 6 (render `!isEdit`), testado |
| D4 `nextDue` no backend / `calcNextDue` exportado | 1, 2 |
| D5 delete de grupo (3 modos, parcela + recorrente) | 3 (backend), 7 (app) |
| D6 filtros client-side, resumo imune | 8, 9 |
| D7 categorias do filtro = as do mês | 8 (`categoriesInMonth`) |
| A1 `POST` body + handler | 2 |
| A2 `DELETE ?mode=` | 3 |
| A3 export `calcNextDue` | 1 |
| A4 testes backend | 2, 3 |
| B1 schema | 4 |
| B2 api (`null` tolerante, `deleteTransaction(id, mode?)`) | 5 |
| B3 bloco Repetir/Parcelar | 6 |
| B4 seletor de exclusão | 7 |
| C1 estado + `filteredTxs` | 8 |
| C2 UI da barra | 9 |
| C3 empty state | 9 |
| Testes app | 4, 5, 6, 7, 8, 9 |
| Verificação device | 10 |

Sem lacunas.

**2. Placeholder scan** — sem "TBD"/"implement later"; todo passo de código tem bloco real. A nota da Task 8/9 sobre a fronteira é intencional (task right-sizing), não placeholder.

**3. Type consistency**
- `deleteTransaction(id, mode?)` — assinatura idêntica na Task 5 (define) e Task 7 (usa via `remove.mutate(mode)`), `mode?: 'this' | 'this-and-future' | 'all'`.
- `calcNextDue(from: Date, interval: RecurrenceInterval)` — Task 1 exporta, Task 2 chama `calcNextDue(when, interval ?? 'MONTHLY')`.
- `createInstallments({ walletId, amount, type, categoryId?, description?, date, installments })` — Task 2 usa a assinatura já existente no repo (`date` obrigatória, por isso `when`).
- `isGroupTx` (Task 7) = `tx.isInstallment || tx.recurring || tx.parentId`; `TransactionSchema` já tem `isInstallment`, `recurring`, `parentId`.
- `filterType` union `'ALL' | 'INCOME' | 'EXPENSE'` consistente entre estado (Task 8) e `FilterRow.onSelect` cast (Task 9).
- `categoriesInMonth` shape `{ id, name }` — Task 8 produz, Task 9 (`FilterRow options`, `filterSummary cats`) consome com `{ id, name }`.

Sem inconsistências.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-4-transactions-recurrence-filters.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
