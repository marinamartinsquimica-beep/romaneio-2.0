import test from 'node:test';
import assert from 'node:assert/strict';
import {publicarEstoqueOficial} from './publicacao-estoques.mjs';
const dados={tipo:'embalado',nome:'estoque.xlsx',versao:'v2',itens:[{sku:'A',lote:'L1',saldo:10}]};
function fake(atual){
 let gravado=null;
 const tx={get:async()=>({exists:()=>!!atual,data:()=>atual}),set:(_ref,v)=>{gravado=v;}};
 return {doc:()=>({}),runTransaction:async(_db,fn)=>fn(tx),gravado:()=>gravado};
}
test('impede publicação sem autorização',async()=>{
 const f=fake(null);
 await assert.rejects(publicarEstoqueOficial({db:{},uid:'u',tipo:'embalado',dados,versaoEsperada:'',...f,autorizado:false}));
 assert.equal(f.gravado(),null);
});
test('impede substituição concorrente',async()=>{
 const f=fake({...dados,versao:'v1'});
 await assert.rejects(publicarEstoqueOficial({db:{},uid:'u',tipo:'embalado',dados,versaoEsperada:'v0',...f,autorizado:true}),/outro operador/);
 assert.equal(f.gravado(),null);
});
test('publica somente quando versão coincide',async()=>{
 const f=fake({...dados,versao:'v1'});
 const r=await publicarEstoqueOficial({db:{},uid:'u',tipo:'embalado',dados,versaoEsperada:'v1',...f,autorizado:true});
 assert.equal(r.versao,'v2');assert.equal(f.gravado().itens[0].saldo,10);
});
test('impede reimportação da mesma versão',async()=>{
 const f=fake(dados);
 await assert.rejects(publicarEstoqueOficial({db:{},uid:'u',tipo:'embalado',dados,versaoEsperada:'v2',...f,autorizado:true}),/já importada/);
});

for(const tipo of ['embalado','paripassu']){
 test(tipo+': nova planilha substitui lotes e saldos, sem acumular versões ou alterar o outro estoque',async()=>{
  const outro=tipo==='embalado'?'paripassu':'embalado';
  const caminho=t=>['romaneio_ambientes','sala-ovos','estoques_oficiais',t].join('/');
  const antigo={tipo,nome:'ontem.xlsx',versao:'ontem',campoAntigo:true,itens:[{sku:'A',lote:'L1',saldo:100},{sku:'REMOVIDO',lote:'L2',saldo:50}]};
  const outroEstoque={tipo:outro,versao:'intacta',itens:[{sku:'OUTRO',lote:'L3',saldo:70}]};
  const banco=new Map([[caminho(tipo),antigo],[caminho(outro),outroEstoque]]);
  const f={doc:(_db,...p)=>p.join('/'),runTransaction:async(_db,fn)=>fn({
   get:async ref=>({exists:()=>banco.has(ref),data:()=>banco.get(ref)}),
   set:(ref,payload,opcoes)=>{assert.equal(opcoes,undefined);banco.set(ref,payload);}
  })};
  await publicarEstoqueOficial({db:{},uid:'salaovos',ambienteId:'sala-ovos',tipo,
   dados:{tipo,nome:'hoje.xlsx',versao:'hoje',itens:[{sku:'A',lote:'L1',saldo:7}]},
   versaoEsperada:'ontem',autorizado:true,...f});
  assert.equal(banco.size,2);
  assert.deepEqual(banco.get(caminho(tipo)).itens.map(x=>[x.sku,x.lote,x.saldo]),[['A','L1',7]]);
  assert.equal(banco.get(caminho(tipo)).campoAntigo,undefined);
  assert.equal(banco.get(caminho(tipo)).nome,'hoje.xlsx');
  assert.equal(banco.get(caminho(outro)),outroEstoque);
 });
}

test('limite do serviço impede publicação sem apagar o estoque vigente',async()=>{
 let escrita=false;
 const erro=Object.assign(new Error('Quota exceeded.'),{code:'resource-exhausted'});
 await assert.rejects(publicarEstoqueOficial({db:{},uid:'salaovos',ambienteId:'sala-ovos',tipo:'embalado',dados,
  versaoEsperada:'v1',autorizado:true,doc:()=>({}),
  runTransaction:async(_db,fn)=>fn({get:async()=>{throw erro},set:()=>{escrita=true}})
 }),{code:'resource-exhausted'});
 assert.equal(escrita,false);
});
