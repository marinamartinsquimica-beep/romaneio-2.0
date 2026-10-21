import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registrarBaixaTransacional} from './baixa-transacional.mjs';

const membro={uid:'operador',ambienteId:'homologacao_romaneio20'};
const origem=[
 {sku:'5008',lote:'L25.03.14.10.26',saldo:56},
 {sku:'11745',lote:'L21.15.13.10.26',saldo:0},
 {sku:'outro',lote:'L',saldo:1520}
];
const reg=[
 {registroId:'registro-um',destino:'A',palete:'1',sku:'5008',loteCompleto:'L25.03.14.10.26',lote:'L25.03.14.10.26',caixas:30},
 {registroId:'registro-dois',destino:'B',palete:'2',sku:'11745',loteCompleto:'L21.15.13.10.26',lote:'L21.15.13.10.26',caixas:7}
];
const parcial={aplicados:[{id:'r1',sku:'5008',lote:'L25.03.14.10.26',caixas:30}],pendencias:[{id:'r2',sku:'11745',lote:'L21.15.13.10.26',caixas:7}]};
function memoria({estoque=origem,versao='v0',falharNaSegunda=false}={}){
 const docs=new Map([['romaneio_ambientes/homologacao_romaneio20/estoques_oficiais/embalado',{
  tipo:'embalado',nome:'ESTOQUE.xlsx',versao,itens:structuredClone(estoque),importadoEm:'antigo',autorUid:'outro'
 }]]);
 const doc=(_db,...partes)=>({path:partes.join('/')});
 let transacoes=0;
 const runTransaction=async(_db,fn)=>{
  transacoes++;
  if(falharNaSegunda&&transacoes===2)throw Error('rede indisponível');
  const writes=[];
  let escreveu=false;
  const tx={
   get:async ref=>{
    if(escreveu)throw Error('Firestore: leituras devem anteceder as escritas');
    const d=docs.get(ref.path);
    return {exists:()=>d!==undefined,data:()=>structuredClone(d)};
   },
   set:(ref,data)=>{escreveu=true;writes.push({tipo:'set',ref,data});},
   update:(ref,data)=>{escreveu=true;writes.push({tipo:'update',ref,data});}
  };
  const value=await fn(tx);
  for(const w of writes){
   const velho=docs.get(w.ref.path);
   if(w.tipo==='set'){
    if(velho)throw Error('documento duplicado');
    if(w.ref.path.includes('/expedicoes/')&&w.data.estado!=='PENDENTE_BAIXA')
      throw Error('PERMISSION_DENIED: regra de criação exige PENDENTE_BAIXA');
    docs.set(w.ref.path,structuredClone(w.data));
   }else{
    if(!velho)throw Error('documento ausente');
    if(w.ref.path.includes('/expedicoes/')){
      if(velho.estado!=='PENDENTE_BAIXA'||w.data.estado!=='BAIXA_CONCLUIDA')
       throw Error('PERMISSION_DENIED: transição não autorizada');
    }else if(w.ref.path.endsWith('/embalado')){
      assert.deepEqual(Object.keys(w.data).sort(),['autorUid','importadoEm','itens','nome','tipo','versao'].sort());
    }
    docs.set(w.ref.path,{...velho,...structuredClone(w.data)});
   }
  }
  return value;
 };
 const estoqueAtual=()=>docs.get('romaneio_ambientes/homologacao_romaneio20/estoques_oficiais/embalado');
 const expedicoes=()=>[...docs].filter(([k])=>k.includes('/expedicoes/')).map(([,v])=>v);
 return {doc,runTransaction,docs,estoqueAtual,expedicoes,get transacoes(){return transacoes}};
}
const args=(m,registros=reg,resultado=parcial)=>({
 db:{},doc:m.doc,runTransaction:m.runTransaction,...membro,
 versaoInicial:'v0',destino:'TODOS OS DESTINOS',registros,resultado
});
test('baixa parcial e múltiplos destinos: estoque e expedições concluem atomicamente',async()=>{
 const m=memoria();
 const r=await registrarBaixaTransacional(args(m));
 assert.equal(r.baixadas,30);
 assert.equal(r.naoBaixadas,7);
 assert.equal(m.transacoes,2);
 assert.equal(m.estoqueAtual().itens[0].saldo,26);
 assert.equal(m.estoqueAtual().itens[1].saldo,0);
 assert.equal(m.estoqueAtual().itens.reduce((s,x)=>s+x.saldo,0),1546);
 assert.deepEqual(m.expedicoes().map(x=>x.estado),['BAIXA_CONCLUIDA','BAIXA_CONCLUIDA']);
});
test('nova tentativa do mesmo romaneio não desconta segunda vez',async()=>{
 const m=memoria();
 await registrarBaixaTransacional(args(m));
 const saldo=m.estoqueAtual().itens[0].saldo;
 await assert.rejects(registrarBaixaTransacional(args(m)),/já baixada|estoque mudou/i);
 assert.equal(m.estoqueAtual().itens[0].saldo,saldo);
});
test('falha na segunda transação não desconta nenhuma caixa',async()=>{
 const m=memoria({falharNaSegunda:true});
 await assert.rejects(registrarBaixaTransacional(args(m)),/rede indisponível/);
 assert.equal(m.estoqueAtual().itens[0].saldo,56);
 assert.ok(m.expedicoes().every(x=>x.estado==='PENDENTE_BAIXA'));
});
test('versão desatualizada impede criação de pendências e a baixa',async()=>{
 const m=memoria({versao:'outra-versao'});
 await assert.rejects(registrarBaixaTransacional(args(m)),/estoque mudou/);
 assert.equal(m.estoqueAtual().itens[0].saldo,56);
 assert.equal(m.expedicoes().length,0);
});
test('baixa completa registra zero caixas não baixadas',async()=>{
 const m=memoria();
 const r=await registrarBaixaTransacional(args(m,[reg[0]],{aplicados:parcial.aplicados,pendencias:[]}));
 assert.equal(r.naoBaixadas,0);assert.equal(r.baixadas,30);
 assert.equal(m.expedicoes().length,1);
});
test('não aceita quantidades preparadas diferentes do romaneio',async()=>{
 const m=memoria();
 await assert.rejects(registrarBaixaTransacional(args(m,[{...reg[0],caixas:31}],{aplicados:parcial.aplicados,pendencias:[]})),/alteradas|difere/);
 assert.equal(m.transacoes,0);
});
test('não aceita paletes repetidos com mesmo registroId',async()=>{
 const m=memoria();
 await assert.rejects(registrarBaixaTransacional(args(m,[reg[0],{...reg[0],caixas:7}],{aplicados:parcial.aplicados,pendencias:[{id:'r2',sku:reg[0].sku,lote:reg[0].lote,caixas:7}]})),/identificadores repetidos/);
 assert.equal(m.transacoes,0);
});
test('as regras oficiais impedem criação concluída e permitem a transição atômica',()=>{
 const s=readFileSync(new URL('../firebase/firestore-novo-ambiente.rules',import.meta.url),'utf8');
 assert.match(s,/allow create: if operadorAutorizado\(ambiente\)[\s\S]*?request.resource.data.estado == 'PENDENTE_BAIXA'/);
 assert.match(s,/resource.data.estado == 'PENDENTE_BAIXA'[\s\S]*?request.resource.data.estado == 'BAIXA_CONCLUIDA'/);
});

test('baixa parcial transacional desconta apenas saldos disponíveis e preserva faltantes',async()=>{
 const m=memoria({estoque:[
  {sku:'3938',lote:'L21.15.13.10.26',saldo:8},
  {sku:'5008',lote:'L25.03.14.10.26',saldo:26},
  {sku:'3826',lote:'L32.18.13.10.26',saldo:0},
  {sku:'OUTRO',lote:'L',saldo:1496}
 ]});
 const registros=[
  {registroId:'parcial1',destino:'A',palete:'1',sku:'3938',loteCompleto:'L21.15.13.10.26',caixas:10},
  {registroId:'parcial2',destino:'B',palete:'2',sku:'5008',loteCompleto:'L25.03.14.10.26',caixas:50},
  {registroId:'parcial3',destino:'C',palete:'3',sku:'3826',loteCompleto:'L32.18.13.10.26',caixas:16}
 ];
 const resultado={
  aplicados:[{id:'p1',sku:'3938',lote:'L21.15.13.10.26',caixas:8},{id:'p2',sku:'5008',lote:'L25.03.14.10.26',caixas:26}],
  pendencias:[{id:'p1',sku:'3938',lote:'L21.15.13.10.26',caixas:2},{id:'p2',sku:'5008',lote:'L25.03.14.10.26',caixas:24},{id:'p3',sku:'3826',lote:'L32.18.13.10.26',caixas:16}]
 };
 const r=await registrarBaixaTransacional(args(m,registros,resultado));
 assert.equal(r.baixadas,34);
 assert.equal(r.naoBaixadas,42);
 assert.equal(m.estoqueAtual().itens.reduce((sum,x)=>sum+x.saldo,0),1496);
 assert.deepEqual(m.estoqueAtual().itens.slice(0,3).map(x=>x.saldo),[0,0,0]);
 assert.ok(m.expedicoes().every(x=>x.estado==='BAIXA_CONCLUIDA'));
});

// Reproduz referências válidas com representação pública opaca (SDK/adaptador).
test('referências opacas distintas não geram falsa duplicidade de expedições',async()=>{
 const m=memoria(),caminhos=new WeakMap();
 const doc=(...partes)=>{const real=m.doc(...partes),ref={};caminhos.set(ref,real.path);return ref;};
 const runTransaction=(db,fn)=>m.runTransaction(db,tx=>fn({
  get:ref=>tx.get({path:caminhos.get(ref)}),
  set:(ref,dados)=>tx.set({path:caminhos.get(ref)},dados),
  update:(ref,dados)=>tx.update({path:caminhos.get(ref)},dados)
 }));
 const r=await registrarBaixaTransacional({...args(m),doc,runTransaction});
 assert.equal(r.baixadas,30);assert.equal(r.naoBaixadas,7);
 assert.equal(m.estoqueAtual().itens[0].saldo,26);
 assert.equal(m.expedicoes().length,2);
 await assert.rejects(registrarBaixaTransacional({...args(m),doc,runTransaction}),/estoque mudou|já baixada/i);
 assert.equal(m.estoqueAtual().itens[0].saldo,26);
});
test('identidade realmente repetida continua bloqueada antes de qualquer transação, com paletes identificados',async()=>{
 const m=memoria();
 await assert.rejects(registrarBaixaTransacional(args(m,[reg[0],{...reg[0],caixas:7}],{aplicados:parcial.aplicados,pendencias:[{id:'r2',sku:reg[0].sku,lote:reg[0].lote,caixas:7}]})),e=>{
  assert.match(e.message,/identificadores repetidos/);assert.match(e.message,/palete 1/);assert.match(e.message,/SKU 5008/);return true;
 });
 assert.equal(m.transacoes,0);
});
test('baixa total sintética de 31 paletes e 9 destinos: 2625 menos 1950 resulta em 675, com 39 sem baixa',async()=>{
 const registros=Array.from({length:31},(_,i)=>({registroId:'reg-expedicao-'+i,destino:'Destino '+i%9,palete:String(i+1),sku:'SKU'+i,loteCompleto:'LOTE'+i,caixas:i===30?189:60}));
 const estoque=registros.map((x,i)=>({sku:x.sku,lote:x.loteCompleto,saldo:i===30?150:60}));estoque.push({sku:'OUTRO',lote:'ESTOQUE',saldo:675});
 const resultado={aplicados:registros.map((x,i)=>({id:'r'+i,sku:x.sku,lote:x.loteCompleto,caixas:i===30?150:60})),pendencias:[{id:'r30',sku:'SKU30',lote:'LOTE30',caixas:39}]};
 const m=memoria({estoque}),r=await registrarBaixaTransacional(args(m,registros,resultado));
 assert.equal(registros.reduce((a,x)=>a+x.caixas,0),1989);
 assert.equal(r.baixadas,1950);assert.equal(r.naoBaixadas,39);
 assert.equal(m.estoqueAtual().itens.reduce((a,x)=>a+x.saldo,0),675);
 assert.equal(m.expedicoes().filter(x=>x.estado==='BAIXA_CONCLUIDA').length,31);
 await assert.rejects(registrarBaixaTransacional(args(m,registros,resultado)),/estoque mudou|já baixada/i);
 assert.equal(m.estoqueAtual().itens.reduce((a,x)=>a+x.saldo,0),675);
});
test('duas linhas idênticas com mesmo ID preservam as caixas e registram um comprovante detalhado',async()=>{
 const linha={...reg[0],caixas:10},invertida=Object.fromEntries(Object.entries(linha).reverse());
 const registros=[linha,invertida],resultado={aplicados:[{sku:linha.sku,lote:linha.lote,caixas:20}],pendencias:[]};
 const m=memoria(),r=await registrarBaixaTransacional(args(m,registros,resultado));
 assert.equal(r.baixadas,20);assert.equal(m.estoqueAtual().itens[0].saldo,36);
 assert.equal(m.expedicoes().length,1);assert.equal(m.expedicoes()[0].caixas,20);
 assert.equal(m.expedicoes()[0].linhasBaixa.length,2);assert.equal(registros[0].caixas,10);assert.equal(registros[1].caixas,10);
 const {filtrarExpedicoesJaBaixadas}=await import('./filtro-expedicoes-baixadas.mjs');
 const f=await filtrarExpedicoesJaBaixadas({registros,destino:'TODOS OS DESTINOS',buscar:async id=>m.docs.get('romaneio_ambientes/homologacao_romaneio20/expedicoes/'+id)});
 assert.equal(f.pendentes.length,0);assert.equal(f.concluidos.length,2);
 await assert.rejects(registrarBaixaTransacional(args(m,registros,resultado)),/estoque mudou|já baixada/i);
 assert.equal(m.estoqueAtual().itens[0].saldo,36);
});
test('comprovante pendente com dez caixas não pode ser reutilizado para vinte',async()=>{
 const {identidadeExpedicaoBaixa}=await import('./baixa-transacional.mjs');
 const linha={...reg[0],caixas:10},m=memoria();
 m.docs.set('romaneio_ambientes/homologacao_romaneio20/expedicoes/'+identidadeExpedicaoBaixa(linha,true).id,{...linha,estado:'PENDENTE_BAIXA'});
 await assert.rejects(registrarBaixaTransacional(args(m,[linha,{...linha}],{aplicados:[{sku:linha.sku,lote:linha.lote,caixas:20}],pendencias:[]})),/difere do agrupamento/);
 assert.equal(m.estoqueAtual().itens[0].saldo,56);
});
