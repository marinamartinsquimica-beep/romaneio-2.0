import {conteudoCanonico} from './comprovante-baixa-agrupada.mjs?v=2.0.105';
// Baixa com duas fases compatíveis com regras Firestore já publicadas.
// Fase 1: registra PENDENTE_BAIXA sem alterar saldos.
// Fase 2: transação única atualiza saldo e marca expedições BAIXA_CONCLUIDA.
const N=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const chave=x=>JSON.stringify([N(x.sku),N(x.loteCompleto||x.lote)]);
const hash=x=>{let h=2166136261;for(const c of x)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h.toString(16)};
const base=x=>[x.destino,x.palete,x.sku,x.loteCompleto,x.lote,x.postura].map(N).join('|');
const inteiro=n=>Number.isSafeInteger(Number(n))&&Number(n)>=0;

// Identificador único compatível entre a conferência e a gravação no Firestore.
export function identidadeExpedicaoBaixa(x,ativos){
 const origemId=String(x.movimentoExclusaoId||'').trim()||(ativos?'ativo_'+String(x.registroId||'').trim():'legado_'+hash(base(x)));
 return {origemId,id:'exp_'+hash(origemId)+'_'+origemId.length};
}

export async function registrarBaixaTransacional({db,doc,runTransaction,uid,ambienteId,resultado,versaoInicial,destino,registros}){
 if(!uid||!ambienteId)throw Error('Autenticação ou ambiente compartilhado indisponível.');
 if(typeof runTransaction!=='function'||typeof doc!=='function')throw Error('Serviço Firestore indisponível.');
 if(typeof versaoInicial!=='string'||!versaoInicial)throw Error('Versão do estoque não identificada. Atualize a conferência.');
 if(!Array.isArray(registros)||!registros.length)throw Error('Nenhuma expedição localizada.');
 const aplicados=resultado?.aplicados, pendencias=resultado?.pendencias;
 if(!Array.isArray(aplicados)||!aplicados.length||!Array.isArray(pendencias))throw Error('Nenhuma baixa válida preparada.');
 const ativos=destino==='TODOS OS DESTINOS'&&registros.every(x=>!x.movimentoExclusaoId);

 const raiz=['romaneio_ambientes',ambienteId];
 const estoqueRef=doc(db,...raiz,'estoques_oficiais','embalado');
 const movimentacoesBrutas=registros.map(x=>{
   if(!x||!x.destino||!x.sku||!(x.loteCompleto||x.lote)||!inteiro(x.caixas)||Number(x.caixas)<=0)
     throw Error('Romaneio incompleto. Confira destino, SKU, lote e caixas.');
   const ativo=ativos||x.origemBaixa==='ativo';
   if(ativo&&!String(x.registroId||'').trim())throw Error('Palete sem identificador único. Sincronize o romaneio antes da baixa.');
   const {origemId,id}=identidadeExpedicaoBaixa(x,ativo);
   return {registro:x,ativo,origemId,id,ref:doc(db,...raiz,'expedicoes',id)};
 });
 // A identidade pertence ao contrato da baixa, não à representação do SDK.
 // Referências sem path público podem ter o mesmo String(ref) genérico.
 const porIdentificador=new Map(),movimentacoes=[];
 for(const m of movimentacoesBrutas){
   const anterior=porIdentificador.get(m.id);
   if(anterior){
     const primeira=anterior.registro.linhasBaixa?.[0]||anterior.registro;
     if(anterior.origemId===m.origemId&&conteudoCanonico(primeira)===conteudoCanonico(m.registro)&&!m.registro.linhasBaixa){
       const linhas=anterior.registro.linhasBaixa||[{...primeira}];
       linhas.push({...m.registro});
       anterior.registro={...primeira,caixas:linhas.reduce((n,x)=>n+Number(x.caixas),0),linhasBaixa:linhas};
       continue;
     }
     const descrever=x=>'destino '+x.destino+', palete '+x.palete+', SKU '+x.sku+', '+x.caixas+' CX';
     throw Error('Expedições com identificadores repetidos: '+m.id+' ('+descrever(anterior.registro)+' / '+descrever(m.registro)+'). Nenhum saldo alterado.');
   }
   porIdentificador.set(m.id,m);movimentacoes.push(m);
 }
 // A baixa pode cadastrar a expedição recebida antes do ciclo da Central.
 // Conferir também a identidade anterior, usada antes da exclusão no celular.
 const anteriores=movimentacoes.filter(m=>m.registro.movimentoExclusaoId&&m.registro.registroId).map(m=>{
  const anterior=identidadeExpedicaoBaixa({...m.registro,movimentoExclusaoId:''},true);
  return doc(db,...raiz,'expedicoes',anterior.id);
 });
 const conferirAnteriores=async tx=>{
  for(const ref of anteriores){const snap=await tx.get(ref);if(snap.exists())throw Error('Este romaneio possui uma baixa anterior concluída ou em andamento. Prepare novamente a conferência antes de continuar.');}
 };
 const quantidades=new Map(),solicitadas=new Map();
 for(const x of registros){const k=chave(x);solicitadas.set(k,(solicitadas.get(k)||0)+Number(x.caixas));}
 for(const x of [...aplicados,...pendencias]){
   if(!x||!inteiro(x.caixas)||Number(x.caixas)<=0)throw Error('Quantidade inválida na conferência.');
   const k=chave(x);
   if(!solicitadas.has(k))throw Error('A conferência difere dos registros atuais. Prepare novamente.');
   if(aplicados.includes(x))quantidades.set(k,(quantidades.get(k)||0)+Number(x.caixas));
 }
 const conferidas=new Map();
 for(const x of [...aplicados,...pendencias]){const k=chave(x);conferidas.set(k,(conferidas.get(k)||0)+Number(x.caixas));}
 if([...solicitadas].some(([k,q])=>conferidas.get(k)!==q))throw Error('Caixas do romaneio alteradas desde a conferência. Prepare novamente.');
 const baixadas=aplicados.reduce((a,x)=>a+Number(x.caixas),0);
 const naoBaixadas=pendencias.reduce((a,x)=>a+Number(x.caixas),0);
 const lerEstoque=async tx=>{
   const snap=await tx.get(estoqueRef);
   if(!snap.exists())throw Error('Estoque oficial indisponível.');
   const estoque=snap.data();
   if(estoque.versao!==versaoInicial)throw Error('O estoque mudou desde a conferência. Prepare novamente para evitar baixa dupla.');
   return estoque;
 };
 // Não usar BAIXA_CONCLUIDA em tx.set: a regra Firestore exige criação como PENDENTE_BAIXA.
 await runTransaction(db,async tx=>{
   await lerEstoque(tx);
   const snaps=[];
   for(const m of movimentacoes)snaps.push({m,snap:await tx.get(m.ref)});
   for(const {m,snap} of snaps){
     if(snap.exists()){
       const antigo=snap.data();
       if(antigo.estado!=='PENDENTE_BAIXA')throw Error('Expedição já baixada. Nenhum desconto adicional foi feito.');
       if(antigo.origemId&&antigo.origemId!==m.origemId)throw Error('Identidade de expedição divergente.');
       if(m.registro.linhasBaixa&&(Number(antigo.caixas)!==Number(m.registro.caixas)||conteudoCanonico(antigo.linhasBaixa)!==conteudoCanonico(m.registro.linhasBaixa)))
         throw Error('Comprovante pendente difere do agrupamento atual. Nenhum saldo alterado.');
     }else if(!m.ativo&&!(String(m.registro.movimentoExclusaoId||'').trim()&&String(m.registro.registroId||'').trim()))throw Error('Expedição excluída sem identificação de sincronização. Sincronize antes de confirmar a baixa.');
   }
   await conferirAnteriores(tx);
   const criadoEm=new Date().toISOString();
   for(const {m,snap} of snaps)if(!snap.exists())tx.set(m.ref,{
     ...m.registro,origemId:m.origemId,estado:'PENDENTE_BAIXA',criadoEm,autorUid:uid
   });
 });
 const novaVersao=crypto.randomUUID();
 await runTransaction(db,async tx=>{
   const estoque=await lerEstoque(tx);
   const snaps=[];
   for(const m of movimentacoes)snaps.push({m,snap:await tx.get(m.ref)});
   if(snaps.some(({snap})=>!snap.exists()||snap.data().estado!=='PENDENTE_BAIXA'))
     throw Error('Expedição ausente ou já concluída. Não repetir a baixa.');
   await conferirAnteriores(tx);
   const saldos=new Map();
   for(const x of estoque.itens){
     const k=chave(x);
     if(saldos.has(k)||!inteiro(x.saldo))throw Error('Lote duplicado ou saldo inválido no Firebase. Baixa cancelada.');
     saldos.set(k,Number(x.saldo));
   }
   for(const [k,q] of quantidades)if(!saldos.has(k)||saldos.get(k)<q)
     throw Error('Saldo alterado ou insuficiente. Prepare novamente.');
   const itens=estoque.itens.map(x=>({...x,saldo:Number(x.saldo)-(quantidades.get(chave(x))||0)}));
   const diferenca=estoque.itens.reduce((s,x)=>s+Number(x.saldo),0)-itens.reduce((s,x)=>s+Number(x.saldo),0);
   if(diferenca!==baixadas)throw Error('Divergência de caixas detectada. Baixa cancelada.');
   const agora=new Date().toISOString();
   tx.update(estoqueRef,{
     tipo:'embalado',nome:estoque.nome||'Estoque Embalado',versao:novaVersao,
     itens,importadoEm:agora,autorUid:uid
   });
   for(const {m} of snaps)tx.update(m.ref,{
     estado:'BAIXA_CONCLUIDA',baixaConfirmadaEm:agora,confirmadoPor:uid
   });
 });
 return {baixadas,naoBaixadas,versao:novaVersao,comprovantes:movimentacoes.map(m=>({...m.registro,id:m.id,origemId:m.origemId,estado:'BAIXA_CONCLUIDA',confirmadoPor:uid}))};
}

