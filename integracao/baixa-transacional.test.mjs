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
