import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../integracao/central-conexao.html',import.meta.url),'utf8');
const start=html.indexOf('async function lerHistoricoMovimentosCompleto(uid){');
const fonte=html.slice(start,html.indexOf('const FILA_TESTE_250',start));
function ambiente(paginas){let chamadas=0;const consultas=[];
 const c={db:{},raizOperacional:uid=>['ambiente',uid],collection:(...args)=>args,orderBy:(...args)=>args,startAfter:x=>({cursor:x.id}),limit:x=>({limite:x}),query:(...args)=>args,getDocs(){throw Error('Consulta com fallback em cache não é permitida')},getDocsFromServer:async q=>{consultas.push(q);const p=paginas[chamadas++];if(p instanceof Error)throw p;return p;}};
 runInNewContext(fonte,c);return {ler:c.lerHistoricoMovimentosCompleto,chamadas:()=>chamadas,consultas};}
const pagina=(ids,fromCache=false)=>({docs:ids.map(id=>({id})),size:ids.length,metadata:{fromCache}});
test('outro usuário recebe histórico confirmado diretamente no servidor',async()=>{const a=ambiente([pagina(['salaovos-1'])]);const r=await a.ler('marina');assert.equal(r.docs[0].id,'salaovos-1');assert.equal(r.metadata.fromCache,false);assert.equal(a.chamadas(),1)});
test('histórico paginado mantém todos os registros e avança cursor',async()=>{const a=ambiente([pagina(Array.from({length:500},(_,i)=>'op-'+i)),pagina(['fim'])]);const r=await a.ler('marina');assert.equal(r.size,501);assert.equal(a.chamadas(),2);assert.ok(a.consultas[1].some(x=>x.cursor==='op-499'))});
test('sem servidor não usa cache para simular sincronização',async()=>{const a=ambiente([Error('unavailable')]);await assert.rejects(a.ler('marina'),/unavailable/);assert.equal(a.chamadas(),1)});
test('proteção contra cache e documentos duplicados continua ativa',async()=>{await assert.rejects(ambiente([pagina(['x'],true)]).ler('marina'),/cache/);await assert.rejects(ambiente([pagina(['x','x'])]).ler('marina'),/duplicado/)});
