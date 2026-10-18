/* Substituição integral do estoque EMBALADO pelo inventário do romaneio ESTOQUE.
 * Puro: não grava Firebase, não mexe na baixa de expedição e não altera originais.
 */
const n=x=>String(x??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const sku=x=>{const t=n(x).replace(',','.');return /^\d+(?:\.0+)?$/.test(t)?String(Number(t)):t};
const chave=x=>JSON.stringify([sku(x.sku),n(x.loteCompleto||x.lote).replace(/\s/g,'')]);
const cx=x=>Number(x);
const total=itens=>itens.reduce((s,x)=>s+Number(x.saldo||0),0);
export function selecionarInventarioEstoque(romaneio){
 if(!Array.isArray(romaneio))throw Error('Romaneio indisponível.');
 const entradas=romaneio.filter(x=>n(x?.destino)==='ESTOQUE');
 if(!entradas.length)throw Error('Nenhum palete com destino ESTOQUE encontrado. Nenhum estoque foi modificado.');
 const mapa=new Map();
 for(const [i,r] of entradas.entries()){
  const codigo=sku(r.sku),lote=String(r.loteCompleto||r.lote||'').trim(),caixas=cx(r.caixas);
  if(!codigo||!lote||!Number.isSafeInteger(caixas)||caixas<=0)
   throw Error('Registro '+(i+1)+' do destino ESTOQUE inválido: SKU, lote completo e caixas inteiras positivas obrigatórios.');
  const k=chave({sku:codigo,loteCompleto:lote});
  const anterior=mapa.get(k);
  const postura=String(r.postura||'').trim();
  if(anterior){
   if(postura&&anterior.postura&&n(postura)!==n(anterior.postura))
    throw Error('Posturas divergentes para '+codigo+' / '+lote);
   anterior.saldo+=caixas;
   if(!anterior.postura)anterior.postura=postura;
   anterior.registros++;
  }else mapa.set(k,{sku:codigo,lote,saldo:caixas,postura,registros:1});
 }
 return [...mapa.values()].sort((a,b)=>a.sku.localeCompare(b.sku,'pt-BR',{numeric:true})||a.lote.localeCompare(b.lote,'pt-BR',{numeric:true}));
}
export function prepararSubstituicaoTotal(estoque,romaneio){
 if(!Array.isArray(estoque)||!estoque.length)throw Error('Carregue primeiro o Estoque Embalado oficial.');
 const novo=selecionarInventarioEstoque(romaneio);
 const atual=new Map();
 for(const item of estoque){
  const k=chave(item),saldo=cx(item.saldo);
  if(!sku(item.sku)||!String(item.lote||'').trim()||!Number.isSafeInteger(saldo)||saldo<0)
   throw Error('Estoque Embalado atual inválido.');
  if(atual.has(k))throw Error('Estoque Embalado tem lote duplicado. Corrija antes de substituir.');
  atual.set(k,{...item,saldo});
 }
 const novaChaves=new Set(novo.map(chave));
 const retirados=[...atual].filter(([k])=>!novaChaves.has(k)).map(([,x])=>x);
 const alterados=novo.map(x=>({...x,anterior:atual.get(chave(x))?.saldo??0,acao:atual.has(chave(x))?'SUBSTITUIR':'INCLUIR'}));
 return {
  itens:novo.map(({sku,lote,saldo,postura})=>({sku,lote,saldo,postura})),
  alteracoes:alterados,retirados,
  estoqueAnterior:total(estoque),estoqueDepois:total(novo),
  totalRegistros:novo.reduce((s,x)=>s+x.registros,0),
  totalLotes:novo.length,tipo:'substituicao-total',destino:'ESTOQUE'
 };
}
export function assinaturaInventario(romaneio){
 const linhas=selecionarInventarioEstoque(romaneio);
 return JSON.stringify(linhas.map(x=>[x.sku,n(x.lote),x.saldo,n(x.postura)]));
}
