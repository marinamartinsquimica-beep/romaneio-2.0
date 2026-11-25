/* Contrato de importação de estoques oficiais. Sem gravação, sem baixa e sem alteração do Excel. */
export const TIPOS_ESTOQUE = Object.freeze(['embalado','paripassu']);
const texto = valor => String(valor ?? '').trim();
const numero = valor => { const v=String(valor ?? '').trim(); return v ? Number(v.replace(',', '.')) : NaN; };
export function validarEstoqueOficial(dados, tipoEsperado) {
 if (!TIPOS_ESTOQUE.includes(tipoEsperado)) throw Error('Tipo de estoque não reconhecido.');
 if (!dados || dados.tipo !== tipoEsperado) throw Error('Arquivo não corresponde ao estoque selecionado.');
 if (!Array.isArray(dados.itens) || !dados.itens.length || dados.itens.length > 15000) throw Error('Estoque vazio ou acima do limite de segurança.');
 if (!texto(dados.nome) || !texto(dados.versao)) throw Error('Identificação e versão do estoque obrigatórias.');
 const chaves = new Set();
 const itens = dados.itens.map((linha, indice) => {
  const sku=texto(linha?.sku), lote=texto(linha?.lote), saldo=numero(linha?.saldo);
  if (!sku || !lote || (!Number.isFinite(saldo) || saldo < 0 || (tipoEsperado==='embalado' && !Number.isSafeInteger(saldo)))) throw Error('SKU, lote ou saldo inválido na linha '+(indice+1)+'.');
  const chave=JSON.stringify([sku.toUpperCase(),lote.toUpperCase()]);
  if(chaves.has(chave)) throw Error('SKU e lote duplicados na linha '+(indice+1)+'. Corrija ou consolide na origem.');
  chaves.add(chave);
  return Object.freeze({sku,lote,saldo,ovos:linha?.ovos===undefined?null:Number(linha.ovos),ovosPorCaixa:linha?.ovosPorCaixa===undefined?null:Number(linha.ovosPorCaixa),postura:texto(linha?.postura)});
 });
 return Object.freeze({tipo:tipoEsperado,nome:texto(dados.nome),versao:texto(dados.versao),itens:Object.freeze(itens)});
}
export function podeSubstituirVersao(atual, nova) {
 if(!nova || !TIPOS_ESTOQUE.includes(nova.tipo) || !texto(nova.versao))throw Error('Nova versão inválida.');
 if(!atual)return true;
 if(atual.tipo!==nova.tipo)throw Error('Tentativa de substituir estoque de tipo diferente.');
 if(atual.versao===nova.versao)throw Error('Versão já importada. Nenhuma substituição realizada.');
 return true; // Ordem temporal é controlada na transação do SharePoint.
}
