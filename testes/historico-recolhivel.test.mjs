import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const inicio=html.indexOf("const CHAVE_HISTORICO_FECHAMENTOS=");
const fim=html.indexOf("async function reiniciarEntradas()",inicio);
assert.ok(inicio>=0&&fim>inicio);
const trecho=html.slice(inicio,fim);
const data='2026-10-18T22:00:00.000Z';
const indice=[
 {id:'hist1',data,registros:21},
 {id:'hist2',data,registros:3},
 {id:'hist3',data,registros:1}
];

function ambiente(confirmar=true,{falharExclusao=false}={}){
 const chave='romaneio2_historico_fechamentos_v1';
 const storage=new Map([
  [chave,JSON.stringify(indice)],
  ['entradas','[{"registroId":"ativo"}]'],
  ['romaneio2_ultimo_estado_movimentos_v1','[{"registroId":"ativo"}]'],
  ['romaneio2_expedicoes_excluidas_pendentes_v1','[{"id":"pendente"}]']
 ]);
 const copias=new Map(indice.map(x=>['fechamento-'+x.id,{id:x.id,entradas:Array(x.registros).fill({sku:'5008'})}]));
 const deletes=[], alerts=[];
 const elem=id=>({id,className:'',type:'',textContent:'',children:[],
  append(...children){this.children.push(...children)},
  replaceChildren(){this.children=[]},
  onclick:null
 });
 const historico=elem('historicoFechamentos');
 const quantidade=elem('quantidadeHistoricoFechamentos');
 const ctx=createContext({
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},
  lerJsonLocalStorage:(k,padrao)=>JSON.parse(storage.get(k)||JSON.stringify(padrao)),
  abrirBancoBackupOffline:async()=>({
   transaction:()=>{const tx={oncomplete:null,onerror:null,onabort:null,error:null,
    objectStore:()=>({delete:key=>{
      if(falharExclusao)throw Error('Sem permissão local');
      deletes.push(key);
      queueMicrotask(()=>{copias.delete(key);tx.oncomplete?.()});
    }})};
    return tx;
   },close(){}
  }),
  confirmarRaiar:async()=>confirmar,
  alert:msg=>alerts.push(msg),
  document:{getElementById:id=>id==='historicoFechamentos'?historico:id==='quantidadeHistoricoFechamentos'?quantidade:null,createElement:()=>elem('item')},
  Date,JSON,Array,Promise
 });
 runInContext(trecho,ctx);
 return {ctx,storage,copias,deletes,alerts,historico,quantidade,chave};
}

test('painel usa details recolhido por padrão (não uma lista infinita)',()=>{
 const bloco=html.match(/<details id="historicoFechamentosRecolhivel"[^>]*>/)?.[0]||'';
 assert.ok(bloco);
 assert.doesNotMatch(bloco,/\bopen\b/);
 assert.match(html,/<summary class="historico-fechamentos-resumo">/);
 assert.match(html,/id="quantidadeHistoricoFechamentos"/);
 assert.match(html,/@media \(max-width:767px\)\{#operadorHistoricoFechamentos\{display:none!important\}\}/);
});
test('cada arquivo apresenta dois botões distintos, com apagar vermelho',()=>{
 const a=ambiente();
 a.ctx.renderizarHistoricoFechamentos();
 assert.equal(a.historico.children.length,3);
 assert.equal(a.quantidade.textContent,'(3 arquivo(s))');
 const registro=a.historico.children[0];
 assert.equal(registro.children[1].className,'historico-fechamentos-acoes');
 const [baixar,apagar]=registro.children[1].children;
 assert.equal(baixar.textContent,'BAIXAR HISTÓRICO');
 assert.equal(apagar.textContent,'APAGAR HISTÓRICO');
 assert.equal(apagar.className,'btn-danger');
 assert.equal(typeof apagar.onclick,'function');
 assert.equal(typeof baixar.onclick,'function');
});
test('excluir um histórico confirmado apaga apenas sua cópia e índice',async()=>{
 const a=ambiente();
 await a.ctx.apagarHistoricoFechamento('hist2');
 assert.deepEqual(a.deletes,['fechamento-hist2']);
 assert.deepEqual(JSON.parse(a.storage.get(a.chave)).map(x=>x.id),['hist1','hist3']);
 assert.deepEqual([...a.copias.keys()],['fechamento-hist1','fechamento-hist3']);
 assert.equal(a.storage.get('entradas'),'[{"registroId":"ativo"}]');
 assert.equal(a.storage.get('romaneio2_expedicoes_excluidas_pendentes_v1'),'[{"id":"pendente"}]');
 assert.equal(a.quantidade.textContent,'(2 arquivo(s))');
});
test('cancelar mantém todos os históricos e não acessa IndexedDB para excluir',async()=>{
 const a=ambiente(false);
 const anterior=a.storage.get(a.chave);
 await a.ctx.apagarHistoricoFechamento('hist1');
 assert.deepEqual(a.deletes,[]);
 assert.equal(a.storage.get(a.chave),anterior);
 assert.equal(a.copias.size,3);
});
test('erro na exclusão conserva o índice e os demais arquivos',async()=>{
 const a=ambiente(true,{falharExclusao:true});
 await a.ctx.apagarHistoricoFechamento('hist1');
 assert.equal(a.copias.size,3);
 assert.equal(JSON.parse(a.storage.get(a.chave)).length,3);
 assert.match(a.alerts[0],/Não foi possível apagar este histórico/);
});
test('botão de download continua exportando XLSX sem alterar o modelo',()=>{
 assert.match(trecho,/async function exportarHistoricoFechamento\(id\)/);
 assert.match(trecho,/bookType:'xlsx'/);
 assert.match(trecho,/a\.download='romaneio_historico_'/);
 assert.match(trecho,/baixar\.onclick=\(\)=>exportarHistoricoFechamento\(item.id\)/);
});
