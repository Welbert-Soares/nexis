import { describe, expect, it } from 'vitest'
import { montarPrevia, type ContextoPrevia } from './montar-previa'

const CABECALHO = 'Data,Valor,Identificador,Descrição'

function extrato(...linhas: string[]) {
  return [CABECALHO, ...linhas].join('\n') + '\n'
}

function contexto(over: Partial<ContextoPrevia> = {}): ContextoPrevia {
  return {
    carteira: { id: 'w-nubank', criadaEm: new Date('2026-01-01T12:00:00Z') },
    nomeUsuario: 'Fulano de Tal',
    transacoesExistentes: [],
    externalIdsImportados: [],
    categoriaPorDescricao: {},
    escolhasDeGrupo: {},
    categoriaOutrosReceitaId: 'cat-outros-receita',
    ...over,
  }
}

describe('montarPrevia', () => {
  it('valor negativo vira Despesa e positivo vira Receita, marcadas como novas', () => {
    const previa = montarPrevia(
      extrato(
        '09/10/2026,-17.50,id-1,Compra no débito - PADARIA CENTRAL',
        '11/10/2026,200.00,id-2,Transferência recebida pelo Pix - CICLANO SILVA - •••.425.936-•• - BCO SANTANDER (BRASIL) S.A. (0033) Agência: 1582 Conta: 1014653-8',
      ),
      contexto(),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.tipo, l.valor, l.data.toISOString().slice(0, 10), l.situacao, l.marcada])).toEqual([
      ['id-1', 'EXPENSE', 17.5, '2026-10-09', 'nova', true],
      ['id-2', 'INCOME', 200, '2026-10-11', 'nova', true],
    ])
  })

  it('limpa as descrições de Pix e de compra no débito', () => {
    const previa = montarPrevia(
      extrato(
        '03/10/2026,-311.22,id-1,Transferência enviada pelo Pix - CEMIG DISTRIBUICAO S.A - 06.981.180/0001-16 - BCO SANTANDER (BRASIL) S.A. (0033) Agência: 3337 Conta: 13065587-1',
        '03/10/2026,-182.00,id-2,Transferência enviada pelo Pix - CLUBE ESPORTIVO (Transferência enviada)',
        '11/10/2026,200.00,id-3,Transferência recebida pelo Pix - CICLANO SILVA - •••.425.936-•• - BCO SANTANDER (BRASIL) S.A. (0033) Agência: 1582 Conta: 1014653-8',
        '20/10/2026,1164.00,id-4,Transferência Recebida - BELTRANO LAGE - •••.579.356-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 818359-6',
        '04/10/2026,-139.87,id-5,Compra no débito via NuPay - Amazon Debito AMZ',
        '09/10/2026,-52.65,id-6,Compra no débito - RESTAURANTE ROTA DO S',
        '29/10/2026,2000.00,id-7,Depósito de empréstimo',
      ),
      contexto(),
    )

    expect(previa.linhas.map((l) => l.descricao)).toEqual([
      'Pix enviado · CEMIG DISTRIBUICAO S.A',
      'Pix enviado · CLUBE ESPORTIVO',
      'Pix recebido · CICLANO SILVA',
      'Transferência recebida · BELTRANO LAGE',
      'Amazon Debito AMZ',
      'RESTAURANTE ROTA DO S',
      'Depósito de empréstimo',
    ])
  })

  it('sugere a categoria usada antes para a mesma descrição limpa', () => {
    const previa = montarPrevia(
      extrato(
        '06/10/2026,-28.67,id-1,Compra no débito via NuPay - iFood',
        '09/10/2026,-63.25,id-2,Compra no débito - MERCADO NOVO',
      ),
      contexto({ categoriaPorDescricao: { iFood: 'cat-alimentacao' } }),
    )

    expect(previa.linhas.map((l) => l.categoriaId)).toEqual(['cat-alimentacao', null])
  })

  it('depósito de empréstimo entra como Receita na categoria Outros', () => {
    const previa = montarPrevia(extrato('29/10/2026,2000.00,id-1,Depósito de empréstimo'), contexto())

    expect(previa.linhas.map((l) => [l.tipo, l.categoriaId, l.marcada])).toEqual([['INCOME', 'cat-outros-receita', true]])
  })

  it('linha com identificador já importado nesta carteira vem como já importada e desmarcada', () => {
    const previa = montarPrevia(
      extrato(
        '09/10/2026,-17.50,id-velho,Compra no débito - PADARIA CENTRAL',
        '10/10/2026,-20.00,id-novo,Compra no débito - PADARIA CENTRAL',
      ),
      contexto({ externalIdsImportados: ['id-velho'] }),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.situacao, l.marcada])).toEqual([
      ['id-velho', 'ja_importada', false],
      ['id-novo', 'nova', true],
    ])
  })

  it('linha anterior ao dia de criação da carteira vem desmarcada; a do próprio dia entra', () => {
    const previa = montarPrevia(
      extrato(
        '14/10/2026,-10.00,id-1,Compra no débito - PADARIA CENTRAL',
        '15/10/2026,-20.00,id-2,Compra no débito - PADARIA CENTRAL',
      ),
      contexto({ carteira: { id: 'w-nubank', criadaEm: new Date('2026-10-15T18:30:00Z') } }),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.situacao, l.marcada])).toEqual([
      ['id-1', 'anterior_a_carteira', false],
      ['id-2', 'nova', true],
    ])
  })

  it('linha com mesmo tipo e valor de transação existente até 3 dias de distância vem como possível duplicada', () => {
    const aluguelLancadoAMao = {
      id: 't-aluguel',
      walletId: 'w-nubank',
      tipo: 'EXPENSE' as const,
      valor: 612.75,
      data: new Date('2026-10-06T12:00:00Z'),
    }
    const previa = montarPrevia(
      extrato(
        '09/10/2026,-612.75,id-1,Transferência enviada pelo Pix - CONDOMINIO X - 42.672.958/0001-79 - BANCO INTER (0077) Agência: 1 Conta: 1-0',
        '10/10/2026,-612.75,id-2,Transferência enviada pelo Pix - CONDOMINIO X - 42.672.958/0001-79 - BANCO INTER (0077) Agência: 1 Conta: 1-0',
        '09/10/2026,612.75,id-3,Transferência recebida pelo Pix - CICLANO SILVA - •••.425.936-•• - BCO SANTANDER (BRASIL) S.A. (0033) Agência: 1 Conta: 1-1',
      ),
      contexto({ transacoesExistentes: [aluguelLancadoAMao] }),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.situacao, l.marcada])).toEqual([
      ['id-1', 'possivel_duplicada', false],
      ['id-2', 'nova', true],
      ['id-3', 'nova', true],
    ])
  })

  it('a janela de 3 dias conta dias do calendário em São Paulo, não horas', () => {
    const lancadaDeManha3DiasAntes = {
      id: 't-1',
      walletId: 'w-nubank',
      tipo: 'EXPENSE' as const,
      valor: 50,
      data: new Date('2026-10-06T08:00:00-03:00'),
    }
    const lancadaDeNoite4DiasAntes = {
      id: 't-2',
      walletId: 'w-nubank',
      tipo: 'EXPENSE' as const,
      valor: 80,
      data: new Date('2026-10-05T23:00:00-03:00'),
    }
    const previa = montarPrevia(
      extrato(
        '09/10/2026,-50.00,id-1,Compra no débito - LOJA A',
        '09/10/2026,-80.00,id-2,Compra no débito - LOJA B',
      ),
      contexto({ transacoesExistentes: [lancadaDeManha3DiasAntes, lancadaDeNoite4DiasAntes] }),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.situacao])).toEqual([
      ['id-1', 'possivel_duplicada'],
      ['id-2', 'nova'],
    ])
  })

  it('estorno se pareia com uma única compra igual e os dois vêm desmarcados', () => {
    const previa = montarPrevia(
      extrato(
        '04/10/2026,-139.87,id-compra-1,Compra no débito via NuPay - Amazon Debito AMZ',
        '04/10/2026,139.87,id-estorno,Estorno - Compra no débito via NuPay - Amazon Debito AMZ',
        '04/10/2026,-139.87,id-compra-2,Compra no débito via NuPay - Amazon Debito AMZ',
      ),
      contexto(),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.situacao, l.marcada, l.parExternalId])).toEqual([
      ['id-compra-1', 'estorno', false, 'id-estorno'],
      ['id-estorno', 'estorno', false, 'id-compra-1'],
      ['id-compra-2', 'nova', true, null],
    ])
  })

  it('aplicação/resgate de caixinha e pagamento de fatura viram grupos de Transferência', () => {
    const previa = montarPrevia(
      extrato(
        '04/10/2026,-300.00,id-1,Aplicação RDB',
        '05/10/2026,150.00,id-2,Resgate RDB',
        '02/10/2026,-54.19,id-3,Pagamento de fatura',
        '09/10/2026,-17.50,id-4,Compra no débito - PADARIA CENTRAL',
      ),
      contexto(),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.grupo])).toEqual([
      ['id-1', 'caixinhas'],
      ['id-2', 'caixinhas'],
      ['id-3', 'fatura_cartao'],
      ['id-4', null],
    ])
    expect(previa.grupos).toEqual([
      { grupo: 'caixinhas', quantidade: 2, carteiraOutraPontaId: null, tratarComoReceitaDespesa: false },
      { grupo: 'fatura_cartao', quantidade: 1, carteiraOutraPontaId: null, tratarComoReceitaDespesa: false },
    ])
  })

  it('Pix no próprio nome do usuário vira Pix entre minhas contas, ignorando acento e maiúsculas', () => {
    const previa = montarPrevia(
      extrato(
        '02/10/2026,1000.00,id-1,Transferência recebida pelo Pix - JOSÉ DA SILVA SAUROS - •••.275.406-•• - BCO SANTANDER (BRASIL) S.A. (0033) Agência: 1 Conta: 1-8',
        '04/10/2026,300.00,id-2,Transferência recebida pelo Pix via Open Banking - JOSE DA SILVA SAUROS - •••.275.406-•• - BCO SANTANDER (BRASIL) S.A. (0033) Agência: 1 Conta: 1-8',
        '05/10/2026,-145.00,id-3,Transferência enviada pelo Pix - JOSE DA SILVA SAUROS (Transferência enviada)',
        '11/10/2026,200.00,id-4,Transferência recebida pelo Pix - JOSEFA DA SILVA - •••.425.936-•• - BCO SANTANDER (BRASIL) S.A. (0033) Agência: 1 Conta: 1-1',
      ),
      contexto({ nomeUsuario: 'José da Silva' }),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.grupo])).toEqual([
      ['id-1', 'pix_proprio'],
      ['id-2', 'pix_proprio'],
      ['id-3', 'pix_proprio'],
      ['id-4', null],
    ])
  })

  it('preenche a escolha lembrada de cada grupo nesta carteira', () => {
    const previa = montarPrevia(
      extrato('04/10/2026,-300.00,id-1,Aplicação RDB', '02/10/2026,-54.19,id-2,Pagamento de fatura'),
      contexto({ escolhasDeGrupo: { caixinhas: 'w-investimentos', fatura_cartao: null } }),
    )

    expect(previa.grupos).toEqual([
      { grupo: 'caixinhas', quantidade: 1, carteiraOutraPontaId: 'w-investimentos', tratarComoReceitaDespesa: false },
      { grupo: 'fatura_cartao', quantidade: 1, carteiraOutraPontaId: null, tratarComoReceitaDespesa: true },
    ])
  })

  it('transferência cuja outra ponta já existe na carteira escolhida vem como possível duplicada', () => {
    const pagamentoLancadoNoCartao = {
      id: 't-cartao',
      walletId: 'w-cartao',
      tipo: 'INCOME' as const,
      valor: 54.19,
      data: new Date('2026-10-02T12:00:00Z'),
    }
    const despesaComMesmoValorNoCartao = { ...pagamentoLancadoNoCartao, id: 't-outro', tipo: 'EXPENSE' as const, valor: 96.23 }
    const previa = montarPrevia(
      extrato('02/10/2026,-54.19,id-1,Pagamento de fatura', '02/10/2026,-96.23,id-2,Pagamento de fatura'),
      contexto({
        escolhasDeGrupo: { fatura_cartao: 'w-cartao' },
        transacoesExistentes: [pagamentoLancadoNoCartao, despesaComMesmoValorNoCartao],
      }),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.situacao])).toEqual([
      ['id-1', 'possivel_duplicada'],
      ['id-2', 'nova'],
    ])
  })

  it('transferência com carteira da outra ponta não tem categoria; tratada como receita/despesa usa o histórico', () => {
    const previa = montarPrevia(
      extrato('04/10/2026,-300.00,id-1,Aplicação RDB', '02/10/2026,-54.19,id-2,Pagamento de fatura'),
      contexto({
        escolhasDeGrupo: { caixinhas: 'w-investimentos', fatura_cartao: null },
        categoriaPorDescricao: { 'Aplicação RDB': 'cat-investimentos', 'Pagamento de fatura': 'cat-cartao' },
      }),
    )

    expect(previa.linhas.map((l) => [l.externalId, l.categoriaId])).toEqual([
      ['id-1', null],
      ['id-2', 'cat-cartao'],
    ])
  })

  it('recusa arquivo que não é extrato da conta Nubank', () => {
    const faturaDoCartao = 'date,title,amount\n2026-10-09,Padaria,17.50\n'
    expect(() => montarPrevia(faturaDoCartao, contexto())).toThrow('Arquivo não reconhecido como extrato da conta Nubank')
  })

  it('recusa extrato com mais de 2.000 movimentações', () => {
    const linhas = Array.from({ length: 2001 }, (_, i) => `09/10/2026,-1.00,id-${i},Compra no débito - LOJA`)
    expect(() => montarPrevia(extrato(...linhas), contexto())).toThrow('O extrato tem mais de 2.000 movimentações')
  })

  it('recusa extrato sem nenhuma movimentação', () => {
    expect(() => montarPrevia(extrato(), contexto())).toThrow('O extrato não tem nenhuma movimentação')
  })
})
