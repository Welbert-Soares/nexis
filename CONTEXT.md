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
