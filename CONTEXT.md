# Nexis

Sistema pessoal de finanças: carteiras, transações, orçamentos e metas de um único usuário.

## Language

### Dinheiro e movimentações

**Carteira**:
Uma conta financeira do usuário (corrente, poupança, dinheiro, investimento ou cartão de crédito), cujo saldo é o saldo inicial mais as receitas menos as despesas.
_Avoid_: Conta, account

**Transação**:
Uma movimentação de dinheiro numa carteira, sempre do tipo receita ou despesa.
_Avoid_: Lançamento, movimento

**Receita**:
Transação que aumenta o saldo da carteira.
_Avoid_: Entrada, crédito

**Despesa**:
Transação que diminui o saldo da carteira.
_Avoid_: Saída, débito, gasto

**Transferência**:
Par de transações (uma despesa numa carteira, uma receita em outra) que move dinheiro entre carteiras do próprio usuário e não conta como receita nem despesa nas análises.
_Avoid_: Movimentação interna

**Estorno**:
Devolução de uma despesa pelo banco; um estorno e a despesa que ele anula se cancelam e nenhum dos dois é registrado.
_Avoid_: Reembolso, devolução

**Recorrência**:
Transação marcada para se repetir num intervalo (semanal, quinzenal, mensal ou anual), que serve de modelo para as próximas. Parar uma recorrência só impede as próximas ocorrências.
_Avoid_: Transação fixa, assinatura

**Ocorrência**:
Transação criada automaticamente a partir de uma recorrência na data devida; excluí-la tira só aquele lançamento, sem parar a recorrência.
_Avoid_: Cópia, filha

### Importação

**Extrato**:
Arquivo exportado pelo banco com as movimentações de uma conta num período, cada linha com um identificador único dado pelo banco.
_Avoid_: CSV, planilha

**Importação**:
Criação de várias transações de uma vez numa carteira a partir de um extrato bancário em arquivo, confirmada pelo usuário numa prévia.
_Avoid_: Upload, carga

**Prévia da importação**:
Lista das linhas lidas do extrato, antes de virarem transações, onde o usuário exclui linhas e ajusta categorias.
_Avoid_: Preview, rascunho

**Possível duplicada**:
Linha da prévia que corresponde a uma transação já existente na carteira de destino.

**Grupo de transferência**:
Conjunto de linhas do extrato reconhecidas como o mesmo tipo de movimentação entre carteiras do próprio usuário (Caixinhas, Fatura do cartão, Pix entre minhas contas), para o qual o usuário escolhe uma única outra ponta.
_Avoid_: Categoria de transferência

**Outra ponta**:
A carteira que recebe a transação espelhada de uma transferência importada.
_Avoid_: Contrapartida, carteira par
