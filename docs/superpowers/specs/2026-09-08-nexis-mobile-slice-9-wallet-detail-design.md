# Nexis Mobile — Fatia 9: Tela de detalhe da carteira — Design

**Data:** 2026-09-08
**Status:** decisões travadas (D1–D6) — plano a ser derivado em `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-9-wallet-detail.md`
**Sub-projeto:** 9 do `nexis-mobile` — só app, **sem backend, sem dep nova**. Feature nova (o PWA não tem tela de detalhe de carteira).

---

## Contexto

Hoje tocar num card de carteira abre direto o sheet de **edição**. A Fatia 9 troca isso: o toque abre uma **tela de detalhe** (empilhada) com o saldo, um mini-resumo entradas/saídas do mês e a lista de transações **daquela carteira**, com navegação de mês. Editar e transferir passam a ser botões no header do detalhe.

Reaproveita tudo que já existe: `walletsQuery` (cache), `monthTransactionsQuery(y, m)` (cache compartilhado — filtra client-side por `walletId`), `TransactionRow`, `WalletSheet`, `TransferSheet`, `ScreenEnter` (Fatia 8), `useTransactionSheet` (abrir o sheet de transação ao tocar numa linha).

### O que já existe e é relevante

- **`src/app/(app)/wallets.tsx`** — a lista. Header: "Saldo total" + `⇄` (transferência, se ≥ 2 carteiras) + `+` (nova). Cada `<Pressable onPress={() => openEdit(w)}><WalletCard wallet={w} /></Pressable>`. Renderiza `<WalletSheet ref={walletRef} .../>` e `<TransferSheet ref={transferRef} wallets={wallets} />`. `useFocusEffect` invalida `['wallets']`.
- **`src/components/wallets/wallet-card.tsx`** — ícone (por `icon`/tipo) + nome + `WALLET_META[type].label` + saldo (ou fatura pra `CREDIT` via `CreditBalance`).
- **`src/components/wallets/wallet-sheet.tsx`** — `forwardRef<SheetRef, { wallet?: Wallet; onClose?: () => void }>`. `wallet` setado → edição.
- **`src/components/wallets/transfer-sheet.tsx`** — `forwardRef<SheetRef, { wallets: Wallet[] }>`.
- **`src/schemas/wallet.ts`** — `Wallet` = `{ id, name, type, color, icon, balance, initialBalance, creditLimit, closingDay, dueDay }`.
- **`src/app/(app)/transactions.tsx`** — referência de: nav de mês (`shift`, `canGoNext` até `maxDateQuery`), `groupByDay`, `SummaryCard`, `useFocusEffect` invalidando `['transactions', y, m]`, `ListSkeleton`. `monthTransactionsQuery(y, m)` key `['transactions', y, m]`. `maxDateQuery` key `['transactions-max-date']`.
- **`src/components/transactions/transaction-row.tsx`** — `<TransactionRow tx onPress? onSwipeDelete? />`. Transferência (`isTransfer`) renderiza sem `onPress`.
- **`src/components/transactions/transaction-sheet-context.tsx`** — `useTransactionSheet()` → `openEdit(tx)` abre o sheet de transação (o provider já envolve os `<Tabs>` no `(app)/_layout`).
- **`src/components/ui/screen-enter.tsx`** (Fatia 8) — `<ScreenEnter>` fade + slide na montagem, pra telas empilhadas.
- **`src/app/(app)/_layout.tsx`** — `<Tabs>` com `<Tabs.Screen name="wallets" ...>` (aba) e `<Tabs.Screen name="goals" options={{ href: null }} />` (empilhada, `router.push('/goals')`). `typedRoutes: true` no `app.json`.
- **`src/__tests__/wallets-screen.test.tsx`** — importa `#/app/(app)/wallets`, mocka `expo-router` só com `useFocusEffect`.
- Testes: jest-expo (`npx jest --forceExit`), 173. Gotchas: mock `#/tw`, `lucide-react-native` (Proxy/objeto plano), `expo-router` (`useFocusEffect`, `useRouter`, `useLocalSearchParams`), `#/api/*`, `#/components/ui/sheet`; sem `.test.tsx` sob `src/app/`; sem `fireEvent.press` que dispare `useMutation` + `waitFor`.
- **`nexis-mobile` sem prettier/eslint** — estilo na mão. Barra: `npx tsc --noEmit` limpo + jest verde.

---

## Objetivo da Fatia 9

Tocar num card de carteira → **tela de detalhe** (`/wallets/[id]`):
- Header com voltar, nome/tipo, saldo grande (ou fatura pra crédito), botões **Editar** e **Transferir**.
- Mini-resumo **Entradas / Saídas** do mês (das transações daquela carteira).
- Lista das transações **daquela carteira** no mês, agrupada por dia, com navegação de mês.
- Sem backend novo — filtro client-side sobre o mês já em cache.

**Princípio (todo o projeto mobile):** a tela aparece na hora (cache ou vazia); dados preenchem depois. `<ScreenEnter>` na entrada.

---

## Decisões travadas

| # | Decisão | Escolha |
|---|---------|---------|
| D1 | **Estrutura de rotas** | `src/app/(app)/wallets.tsx` → **`src/app/(app)/wallets/index.tsx`** (a lista, sem mudança de conteúdo além do D2). Novo **`src/app/(app)/wallets/[id].tsx`** (o detalhe). No `_layout`: o `<Tabs.Screen name="wallets">` continua (resolve pro `wallets/index`); **adicionar `<Tabs.Screen name="wallets/[id]" options={{ href: null }} />`** (empilhada, não é aba — mesmo padrão do `goals`). Navegação: `router.push({ pathname: '/wallets/[id]', params: { id: w.id } })`. Paths de rota inalterados (`/wallets`, `/wallets/<id>`). |
| D2 | **Toque no card da lista** | Tocar num `WalletCard` → **push pro detalhe** (antes abria `openEdit` direto). O `+` (nova) e o `⇄` (transferência) continuam no header da lista. `openEdit`/`walletRef`/`<WalletSheet>` **saem da lista** (migram pro detalhe) — a lista fica só listagem + navegação. `<TransferSheet>` **fica** na lista (transferência é entre todas). |
| D3 | **Conteúdo do detalhe** | `useLocalSearchParams<{ id: string }>()` → `id`. `const wallet = walletsQuery.data?.find((w) => w.id === id)`. Se `!wallet` (e não `isLoading`) → `View` "Carteira não encontrada" + voltar. Layout: **Header** `flex-row` — `‹` (`router.back()`) · nome + `WALLET_META[type].label` (empilhados) · nada à direita. Abaixo: **saldo** `text-4xl font-bold` (ou, pra `CREDIT`, "Fatura atual" + valor + `de <limite> · <pct>%`, reusando a lógica de `CreditBalance`). **Ações**: `flex-row gap-3` — `Pressable` "Editar" (`Pencil`, `bg-card`) → `walletSheetRef.current?.present()`; `Pressable` "Transferir" (`ArrowLeftRight`, `bg-card`) → `transferSheetRef.current?.present()` (**só se `wallets.length >= 2`**). **Mini-resumo do mês**: `flex-row gap-3` de 2 `SummaryCard` (Entradas / Saídas) — somando as txs da carteira do mês, **incluindo transferências** (uma transferência de/pra esta carteira É um fluxo real dela; difere da tela geral de Transações que ignora `isTransfer`). **Nav de mês** `‹ ›` (mesma lógica de `transactions.tsx`: passado sempre, futuro até `maxDateQuery`, fallback 24 meses). **Lista**: `SectionList` de `groupByDay` das txs do mês filtradas por `t.walletId === id`; `renderItem` = `<TransactionRow tx onPress={tx.isTransfer ? undefined : () => openEdit(tx)} />` (via `useTransactionSheet().openEdit`). **Sem swipe-to-delete** no detalhe (v1). Empty: "Nenhuma transação nesta carteira neste mês". Tudo dentro de `<ScreenEnter>`. |
| D4 | **Backend** | **Nenhuma rota nova.** `monthTransactionsQuery(y, m)` (key `['transactions', y, m]`, cache compartilhado com a tela Transações) + filtro client-side `t.walletId === id`. Gráfico de evolução multi-mês **fora de escopo** (precisaria de rota de série temporal — anotado como futuro). |
| D5 | **Query / invalidação** | O detalhe roda `useQuery(walletsQuery)` + `useQuery({ ...monthTransactionsQuery(y, m), placeholderData: keepPreviousData })` + `useQuery(maxDateQuery)`. `useFocusEffect` invalida `['wallets']` **e** `['transactions', y, m]`. Editar (WalletSheet) e transferir (TransferSheet) já invalidam `['wallets']`/`['transactions']`/`['dashboard']` — o saldo e a lista atualizam ao voltar o foco. |
| D6 | **Sheets no detalhe** | `<WalletSheet ref={walletSheetRef} wallet={wallet} onClose={...} />` e `<TransferSheet ref={transferSheetRef} wallets={wallets} />` renderizados no fim do `wallets/[id].tsx`. Ao **excluir** a carteira pelo `WalletSheet` (que dá `dismiss()` no sucesso), a carteira some do `walletsQuery` → o `find` retorna `undefined` → a tela cai no "Carteira não encontrada"; adicionar um `useEffect` que faz `router.back()` quando `!wallet && !isLoading && !!id` (a carteira foi excluída enquanto a tela estava aberta). |

---

## Arquitetura (delta sobre a Fatia 8)

```
nexis-mobile
  src/app/(app)/wallets.tsx            → RENAME → src/app/(app)/wallets/index.tsx   (MOD: tap = router.push; remove WalletSheet/openEdit)
  src/app/(app)/wallets/[id].tsx       # NEW — tela de detalhe
  src/app/(app)/_layout.tsx            # MOD: + <Tabs.Screen name="wallets/[id]" options={{ href: null }} />
  src/__tests__/wallets-screen.test.tsx   # MOD: import path + mock useRouter
  src/__tests__/wallet-detail-screen.test.tsx  # NEW
```

### `wallets/[id].tsx` (esqueleto)
```tsx
export default function WalletDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()

  const { data: wallets = [], isLoading: walletsLoading } = useQuery(walletsQuery)
  const wallet = wallets.find((w) => w.id === id)

  const now = useMemo(() => new Date(), [])
  const [{ year, month }, setYM] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const txq = useQuery({ ...monthTransactionsQuery(year, month), placeholderData: keepPreviousData })
  const { data: maxDateStr } = useQuery(maxDateQuery)
  const { openEdit } = useTransactionSheet()

  const walletTxs = useMemo(
    () => (txq.data ?? []).filter((t) => t.walletId === id),
    [txq.data, id],
  )
  const { income, expenses } = useMemo(() => { /* soma incluindo isTransfer */ }, [walletTxs])
  const sections = useMemo(() => groupByDay(walletTxs), [walletTxs])

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['wallets'] })
    qc.invalidateQueries({ queryKey: ['transactions', year, month] })
  }, [qc, year, month]))

  // carteira excluída com a tela aberta
  useEffect(() => {
    if (!walletsLoading && id && !wallet) router.back()
  }, [walletsLoading, id, wallet, router])

  const walletSheetRef = useRef<SheetRef>(null)
  const transferSheetRef = useRef<SheetRef>(null)

  // ... canGoNext / shift iguais a transactions.tsx ...

  if (!wallet) return null // (o useEffect acima já dá back; evita flash)

  return (
    <ScreenEnter>
      {/* header + saldo + ações + mini-resumo + nav de mês */}
      <SectionList ... />
      <WalletSheet ref={walletSheetRef} wallet={wallet} onClose={() => {}} />
      <TransferSheet ref={transferSheetRef} wallets={wallets} />
    </ScreenEnter>
  )
}
```
`groupByDay` / `SummaryCard` / `ListSkeleton` — **extrair** os de `transactions.tsx` pra um lugar compartilhado (`src/lib/tx-group.ts` pra `groupByDay`; `src/components/ui/summary-card.tsx` pra o card) **ou** duplicar (são pequenos). Proposta: extrair `groupByDay` + o tipo `Section` pra `src/lib/tx-group.ts` (usado pelos dois); `SummaryCard` fica duplicado (leve, e o de `transactions.tsx` tem `kind: 'in'|'out'` — reusar como está, exportando-o de lá **ou** copiando). **Decisão: extrair `groupByDay` pra `src/lib/tx-group.ts`; exportar `SummaryCard` de `transactions.tsx`** (import `{ SummaryCard }` — precisa de `export function SummaryCard`).

---

## Testes

**`nexis-mobile` (jest-expo, `--forceExit`):**
- `wallets-screen.test.tsx` (MOD) — `import Wallets from '#/app/(app)/wallets/index'`; `jest.mock('expo-router', () => ({ useFocusEffect: () => {}, useRouter: () => ({ push: jest.fn() }) }))`. Casos existentes seguem (saldo total, cards, crédito→fatura, empty). Novo: tocar num card **não** abre sheet (o `WalletSheet` saiu da lista); (opcional) `router.push` foi chamado com o id.
- `wallet-detail-screen.test.tsx` (NEW) — mock `expo-router` (`useLocalSearchParams: () => ({ id: 'w1' })`, `useRouter: () => ({ back: jest.fn(), push: jest.fn() })`, `useFocusEffect: (cb) => cb()`), `react-native-safe-area-context`, `#/tw`, `lucide` (Proxy), `#/api/wallets` + `#/api/transactions` (queries inertes), `#/components/wallets/wallet-sheet` + `transfer-sheet` (`() => null`), `#/components/transactions/transaction-sheet-context` (`useTransactionSheet: () => ({ openEdit: jest.fn() })`), `#/components/ui/screen-enter` (`ScreenEnter: ({children}) => children`). Semear `['wallets']` com `w1` e `['transactions', y, m]` com 2 txs (uma de `w1`, uma de `w2`):
  - header mostra o nome de `w1` e o saldo.
  - mini-resumo "Entradas" / "Saídas".
  - a lista mostra a tx de `w1` e **não** a de `w2`.
  - `['transactions', y, m]` vazio → "Nenhuma transação nesta carteira neste mês".
  - `['wallets']` sem `w1` (e não loading) → chama `router.back()` (via o `useEffect`).
- `tx-group.test.ts` (NEW, se extrair) — `groupByDay` agrupa por dia, título via `fmtDayGroup`, mantém a ordem.

Alvo: +8–12 jest (total ~183+).

**Barra:** `npx tsc --noEmit` limpo; suíte verde. Sem backend.

---

## Verificar no device

- `npx expo start --tunnel`, Expo Go.
- Tocar num card de carteira → abre a tela de detalhe com fade; `‹` volta.
- Header: nome + tipo + saldo grande (crédito → "Fatura atual" + limite + %).
- **Editar** → abre o `WalletSheet` daquela carteira; salvar → o saldo/nome atualiza ao voltar pro detalhe.
- **Transferir** → abre o `TransferSheet` (some se só houver 1 carteira); fazer uma transferência → aparece na lista da carteira e o saldo muda.
- **Mini-resumo**: Entradas/Saídas batem com as transações da carteira no mês (transferências **contam**).
- **Lista**: só as transações daquela carteira; nav de mês `‹ ›` funciona (até o mês da transação mais futura); tocar numa linha abre o sheet de transação.
- Excluir a carteira pelo Editar → a tela volta sozinha pra lista.
- `tsc` limpo + jest verde.

---

## Fora de escopo (Fatia 9)

- **Gráfico de evolução do saldo** (multi-mês) — precisa de rota de série temporal; anotado como futuro.
- Rota backend dedicada `GET /api/mobile/wallets/$id/transactions` (paginação/histórico) — v1 é client-side sobre o mês.
- Swipe-to-delete na lista do detalhe (usar a tela Transações pra isso).
- Detalhe de **categoria** ou de **meta** (mesmo padrão, fatia futura se quiser).
- Editar carteira por long-press na lista (o toque agora é sempre "abrir detalhe").

---

## Riscos / pontos de atenção

- **Restruturar `wallets.tsx` → `wallets/index.tsx`** — `typedRoutes: true` regenera os tipos de rota no `expo start`/`expo customize`; conferir que `/wallets` continua resolvendo (o `index` de um grupo/dir resolve pro path do dir). O import de teste muda (`#/app/(app)/wallets` → `#/app/(app)/wallets/index`).
- **`wallets/[id]` como `Tabs.Screen href:null`** — abre com a tab bar visível, sem push/swipe-back nativo (igual `goals`). O `<ScreenEnter>` dá o fade. Aceitável; o refactor Stack-sobre-Tabs (que daria push nativo pros dois) segue anotado como futuro.
- **Carteira excluída com a tela aberta** — o `useEffect` que dá `router.back()` quando `!wallet && !isLoading`; cuidar do primeiro render (enquanto `walletsQuery` carrega, `wallet` é `undefined` mas `isLoading` true → não dar back).
- **Transferências no mini-resumo** — decisão deliberada de **incluir** `isTransfer` aqui (fluxo real da carteira), diferente da tela geral. Deixar claro no código.
- **`monthTransactionsQuery` compartilhado** — o detalhe e a tela Transações usam a mesma key `['transactions', y, m]`; navegar o mês num não afeta o outro (state local separado), mas o cache é reaproveitado — bom.
- **`SummaryCard` exportado de `transactions.tsx`** — ao exportar, garantir que não vira erro de "componente não usado" (não há `noUnusedLocals` pra exports) e que o import no detalhe não cria ciclo (o detalhe importa de `transactions.tsx`, que não importa do detalhe — sem ciclo).

---

## A confirmar no plano (não bloqueiam o spec)

- Extrair `groupByDay` pra `src/lib/tx-group.ts` (proposto) vs. duplicar no detalhe.
- `SummaryCard` exportado de `transactions.tsx` (proposto) vs. mover pra `src/components/ui/summary-card.tsx` (mais limpo, mas mexe em 2 telas).
- Botão "Editar" no header do detalhe vs. um ícone de lápis no canto.
- Incluir `isTransfer` no mini-resumo (proposto) vs. separar numa 3ª métrica "Transferências".
- `wallets/[id]` via `href:null` (proposto) vs. já fazer o refactor Stack-sobre-Tabs pra `goals` + `wallets/[id]` juntos.
