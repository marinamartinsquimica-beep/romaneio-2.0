/* Núcleo de conferência da etapa 4. Cálculos puros: jamais baixa ou grava planilha/Firebase. */
import {conferirEstoques} from './conferencia-estoques.mjs';
const chave = x => JSON.stringify([String(x.sku??'').trim().toUpperCase(),String(x.lote??'').trim().toUpperCase()]);
function numero(v,nome){const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw Error(nome+' deve ser inteiro não negativo.');return n;}
function mapa(itens){if(!Array.isArray(itens))throw Error('Estoque inválido.');const r=new Map();for(const x of itens){if(!String(x.sku??'').trim()||!String(x.lote??'').trim())throw Error('SKU/lote obrigatório.');const n=numero(x.saldo,'Saldo');const k=chave(x);if(r.has(k))throw Error('SKU/lote duplicado no estoque: '+x.sku+'/'+x.lote);r.set(k,{...x,saldo:n});}return r;}
export function prepararBaixa(estoque,movimentos){
 const saldos=mapa(estoque),vistos=new Set(),pendencias=[],aplicados=[];
 if(!Array.isArray(movimentos))throw Error('Movimentos inválidos.');
 for(const m of movimentos){
  const id=String(m.id??'').trim();if(!id)throw Error('ID de movimento obrigatório.');
  if(vistos.has(id))throw Error('Movimento repetido na solicitação: '+id);vistos.add(id);
  const caixas=numero(m.caixas,'Caixas'),k=chave(m),x=saldos.get(k);if(!String(m.sku??'').trim()||!String(m.lote??'').trim())throw Error('SKU/lote obrigatório na baixa.');
  if(!x||x.saldo<caixas){pendencias.push({id,sku:m.sku,lote:m.lote,caixas,disponivel:x?.saldo??null,motivo:x?'Saldo insuficiente':'Lote ausente'});continue;}
  x.saldo-=caixas;aplicados.push({id,sku:m.sku,lote:m.lote,caixas});
 }
 return {aplicados,pendencias,itens:[...saldos.values()],confirmada:false};
}
export function prepararAjuste(estoque,contagens){
 const saldos=mapa(estoque),vistos=new Set(),alteracoes=[];
 if(!Array.isArray(contagens)||!contagens.length)throw Error('Informe contagens.');
 for(const c of contagens){
  if(!String(c.sku??'').trim()||!String(c.lote??'').trim())throw Error('SKU/lote obrigatório na contagem.');const k=chave(c);if(vistos.has(k))throw Error('Contagem duplicada.');vistos.add(k);
  const item=saldos.get(k),fisico=numero(c.caixas,'Contagem física');
  if(!item)throw Error('Lote fora do estoque: '+c.sku+'/'+c.lote);
  if(item.saldo!==fisico){alteracoes.push({sku:c.sku,lote:c.lote,anterior:item.saldo,fisico,diferenca:fisico-item.saldo});item.saldo=fisico;}
 }
 return {alteracoes,itens:[...saldos.values()],confirmado:false};
}
export function reavaliarConferencia(embalado,paripassu,pendenciasAnteriores=[]){
 const resultado=conferirEstoques(embalado,paripassu);
 const atuais=new Set(resultado.pendencias.map(chave));
 const resolvidas=pendenciasAnteriores.filter(x=>!atuais.has(chave(x)));
 return {...resultado,resolvidas};
}
