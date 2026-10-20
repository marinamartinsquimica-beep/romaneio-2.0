/* Protocolo 2.0.50: preparação de operações para envio idempotente.
 * Sem rede e sem escrita: a aplicação deverá confirmar cada ID no servidor
 * antes de remover qualquer item da fila local.
 */
const TIPOS=new Set(['inclusao','edicao','exclusao']);
const ID=/^[a-zA-Z0-9_-]{8,160}$/;
export function prepararLoteMovimentos(fila,{limite=50}={}){
 if(!Array.isArray(fila))throw new TypeError('Fila inválida');
 if(!Number.isInteger(limite)||limite<1||limite>500)throw new RangeError('Limite inválido');
 const vistos=new Set(),lote=[],rejeitados=[];
 for(const [indice,operacao] of fila.entries()){
  const id=operacao?.id;
  if(typeof id!=='string'||!ID.test(id)||!TIPOS.has(operacao?.tipo)||!operacao?.item||typeof operacao.item!=='object'||Array.isArray(operacao.item)){
   rejeitados.push({indice,motivo:'Operação inválida'});continue;
  }
  if(vistos.has(id)){rejeitados.push({indice,id,motivo:'ID repetido na fila'});continue;}
  vistos.add(id);
  if(lote.length>=limite)continue;
  const copia=JSON.parse(JSON.stringify(operacao));
  if(copia.tipo==='edicao'&&(!copia.antes||typeof copia.antes!=='object')){
   rejeitados.push({indice,id,motivo:'Edição sem estado anterior'});continue;
  }
  lote.push(copia);
 }
 return {lote,rejeitados,total:fila.length};
}
export function reconciliarConfirmacoes(fila,confirmacoes){
 if(!Array.isArray(fila)||!Array.isArray(confirmacoes))throw new TypeError('Confirmações inválidas');
 // Confirmação só remove o ID exato; falhas, IDs ausentes e itens novos permanecem.
 const confirmados=new Set(confirmacoes.filter(c=>c&&c.confirmado===true&&typeof c.id==='string').map(c=>c.id));
 return {pendentes:fila.filter(op=>!confirmados.has(op?.id)),confirmados:fila.filter(op=>confirmados.has(op?.id)).length};
}
export function validarRegistroRemoto(registro){
 return Boolean(registro&&typeof registro.id==='string'&&ID.test(registro.id)&&TIPOS.has(registro.tipo)&&registro.item&&typeof registro.item==='object'&&(! (registro.tipo==='edicao')||registro.antes));
}

// Diagnóstico com os mesmos limites já exigidos pela Central; não altera eventos.
export function motivosFormatoOperacional(op){
 const m=[],it=op?.item;
 if(!op||!ID.test(op.id||''))m.push('ID fora do formato aceito');
 if(!TIPOS.has(op?.tipo))m.push('Tipo de operação inválido');
 if(typeof op?.dispositivoId!=='string'||!op.dispositivoId.length||op.dispositivoId.length>160)m.push('Identificação do aparelho ausente ou inválida');
 if(typeof it?.sku!=='string'||!it.sku.trim()||it.sku.length>100)m.push('SKU deve ser texto preenchido (até 100 caracteres)');
 if(typeof it?.loteCompleto!=='string'||!it.loteCompleto.trim()||it.loteCompleto.length>150)m.push('Lote completo deve ser texto preenchido (até 150 caracteres)');
 if(!((Number.isInteger(it?.caixas)&&it.caixas>0&&it.caixas<=1000000)||(typeof it?.caixas==='string'&&/^[1-9][0-9]{0,5}$/.test(it.caixas))))m.push('Quantidade de caixas fora do formato aceito');
 if(op?.tipo==='edicao'&&(!op.antes||typeof op.antes!=='object'||Array.isArray(op.antes)))m.push('Edição sem estado anterior válido');
 if(typeof op?.criadoEm!=='string'||!op.criadoEm.length||op.criadoEm.length>40)m.push('Data do movimento ausente ou inválida');
 return m;
}
