import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function operadorAtualizarPainel(){');
const end=html.indexOf('function operadorSelecionarAba(',start);
assert.ok(start>=0&&end>start);
const codigo=html.slice(start,end);
const linha=(palete,destino,sku,caixas)=>{
 const cells=Array.from({length:9},()=>({textContent:''}));
 cells[1].textContent=sku;cells[2].textContent=destino;
 cells[3].textContent=palete;cells[7].textContent=String(caixas);
 return {cells};
};
function simular(linhas,compartilhados=[]){
 const tbody={rows:[],replaceChildren(){this.rows=[]},insertRow(){
  const tr={cells:[],insertCell(){const c={textContent:'',colSpan:1,appendChild(x){this.button=x}};this.cells.push(c);return c}};
  this.rows.push(tr);return tr;
 }};
 const ids=new Map();
 for(const id of ['opDestinos','opPaletes','opCaixas','opPendentes','opResumoEstoque','opUltimaConsulta','resumoReservaTeste'])
 ids.set(id,{textContent:''});
 ids.set('opTabelaDestinos',tbody);
 const document={
  querySelectorAll:selector=>selector==='#tabela tbody tr'?linhas:[],
  getElementById:id=>ids.get(id)||null,
  createElement:()=>({type:'',textContent:'',addEventListener(){}})
 };
 runInNewContext(codigo+'\noperadorAtualizarPainel();',{
  window:{__paletesDeOutrosUsuarios:compartilhados},lerJsonLocalStorage(){return []},document,renderizarRomaneiosCompartilhados(){},mostrarExpedicoesExcluidasOperador(){},obterRomaneiosDestino(){return [{nome:'A'}]},
  lerFilaMovimentos(){return []},atualizarResumoReservaTeste(){},operadorAtualizarCardsEstoque(){},
  operadorVoltarRomaneios(){}
 });
 return {tbody,ids};
}
test('painel do operador inclui a coluna SKU e mantém as outras colunas',()=>{
 assert.match(html,/<th>Palete<\/th><th>Destino<\/th><th>SKU<\/th><th>Caixas<\/th><th>Ação<\/th>/);
});
test('palete com dois SKUs mostra ambos sem duplicá-los e soma as caixas',()=>{
 const r=simular([linha('1','TESTE','5008',10),linha('1','TESTE','11745',7),linha('1','TESTE','5008',3)]);
 assert.equal(r.tbody.rows.length,1);
 assert.deepEqual(r.tbody.rows[0].cells.slice(0,4).map(x=>x.textContent),['1','TESTE','5008, 11745','20']);
 assert.equal(r.ids.get('opPaletes').textContent,1);
 assert.equal(r.ids.get('opCaixas').textContent,'20');
 assert.equal(r.tbody.rows[0].cells[4].button.textContent,'Conferir');
});
test('paletes de destinos diferentes permanecem separados',()=>{
 const r=simular([linha('1','A','5008',10),linha('1','B','11745',7)]);
 assert.equal(r.tbody.rows.length,2);
 assert.equal(r.ids.get('opPaletes').textContent,2);
 assert.deepEqual(r.tbody.rows.map(x=>x.cells[2].textContent),['5008','11745']);
});
test('estado vazio usa cinco colunas',()=>{
 const r=simular([]);
 assert.equal(r.tbody.rows.length,1);
 assert.equal(r.tbody.rows[0].cells[0].colSpan,5);
});

test('cards e lista do operador incluem os mesmos paletes compartilhados',()=>{
 const r=simular([],[{registroId:'a',palete:'1',destino:'ANGELONI',sku:'3829',caixas:156},{registroId:'b',palete:'2',destino:'SHOPPER',sku:'5008',caixas:129}]);
 assert.equal(r.ids.get('opPaletes').textContent,2);
 assert.equal(r.ids.get('opCaixas').textContent,'285');
 assert.equal(r.tbody.rows.length,2);
 assert.equal(r.tbody.rows[0].cells[4].button.textContent,'Consulta compartilhada');
});
