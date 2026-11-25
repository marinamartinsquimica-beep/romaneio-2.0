/* Romaneio 2.0.50 — núcleo isolado de conferência.
   Sem efeitos colaterais: não altera estoque, romaneio, SharePoint ou interface.
   Integrar somente após testes em dispositivo e aprovação. */
export function chaveConferencia(sku,lote) {
  return String(sku??"").trim().toUpperCase()+"\u0000"+String(lote??"").trim().toUpperCase();
}
export function compararConferencia(romaneio,estoque) {
  if(!Array.isArray(romaneio)||!Array.isArray(estoque)) throw new TypeError("Entradas inválidas");
  const saldo=new Map(),grupos=new Map();
  for(const e of estoque) {
    const qtd=Number(e.saldo);
    if(!Number.isFinite(qtd)||qtd<0) throw new Error("Saldo inválido no estoque");
    const chave=chaveConferencia(e.sku,e.lote);
    if(!String(e.sku??"").trim()||!String(e.lote??"").trim()) throw new Error("SKU/lote ausente no estoque");
    saldo.set(chave,(saldo.get(chave)||0)+qtd);
  }
  for(const r of romaneio) {
    const qtd=Number(r.caixas);
    if(!Number.isFinite(qtd)||qtd<0) throw new Error("Quantidade inválida no romaneio");
    if(!String(r.sku??"").trim()||!String(r.lote??"").trim()) throw new Error("SKU/lote ausente no romaneio");
    const chave=chaveConferencia(r.sku,r.lote);
    const atual=grupos.get(chave)||{sku:r.sku,lote:r.lote,caixas:0,posturas:new Set(),paletes:new Set(),destinos:new Set()};
    atual.caixas+=qtd;
    if(r.postura)atual.posturas.add(String(r.postura));
    if(r.palete)atual.paletes.add(String(r.palete));
    if(r.destino)atual.destinos.add(String(r.destino));
    grupos.set(chave,atual);
  }
  return [...grupos].map(([chave,r])=>{
    const encontrado=saldo.has(chave),disponivel=encontrado?saldo.get(chave):null;
    return {sku:r.sku,lote:r.lote,posturas:[...r.posturas],paletes:[...r.paletes],destinos:[...r.destinos],
      romaneio:r.caixas,estoque:disponivel,pendente:!encontrado||r.caixas>disponivel,
      diferenca:encontrado?Math.max(0,r.caixas-disponivel):r.caixas,
      motivo:!encontrado?"SKU/lote ausente":r.caixas>disponivel?"Quantidade superior ao saldo":null};
  });
}

/** Compara revisões sem perder correções mais recentes. Nunca substitui dados locais. */
export function decidirAtualizacao(local,remoto) {
  if(!remoto||!Number.isSafeInteger(remoto.revisao)||remoto.revisao<1) return {aplicar:false,motivo:"revisão remota inválida"};
  if(!local) return {aplicar:true,motivo:"primeira leitura"};
  if(!Number.isSafeInteger(local.revisao)||local.revisao<1) return {aplicar:false,motivo:"revisão local inválida"};
  if(remoto.revisao>local.revisao) return {aplicar:true,motivo:"revisão mais recente"};
  if(remoto.revisao<local.revisao) return {aplicar:false,motivo:"revisão antiga"};
  if(JSON.stringify(remoto)===JSON.stringify(local)) return {aplicar:false,motivo:"sem alteração"};
  return {aplicar:false,motivo:"conflito na mesma revisão; requer conferência"};
}
