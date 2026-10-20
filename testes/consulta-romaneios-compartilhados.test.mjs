import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('let filtroConsultaCompartilhada=null;'),html.indexOf('function operadorAbrirEstoque()'));
function ambiente(){
 const ids=new Map();
 class El{
  constructor(tag){this.tag=tag;this.children=[];this.textContent='';}
  set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}
  append(...children){this.children.push(...children);}prepend(child){this.children.unshift(child);}
  replaceChildren(){this.children=[];}createTHead(){const e=new El('thead');this.append(e);return e;}
  createTBody(){const e=new El('tbody');this.append(e);return e;}
  insertRow(){const e=new El('tr');this.append(e);return e;}
  insertCell(){const e=new El('td');this.append(e);return e;}scrollIntoView(){}
 }
 const aba=new El('main');aba.id='abaTotal';
 const locais=[{registroId:'local'}];
 const shared=[{registroId:'a',destino:'A',palete:'1',sku:'5008',caixas:17,observacoes:'<img onerror=alert(1)>'},{registroId:'b',destino:'B',palete:'2',sku:'12209',caixas:3},{registroId:'local',destino:'A',palete:'3'}];
 const context={document:{getElementById:id=>ids.get(id),createElement:tag=>new El(tag)},window:{__paletesDeOutrosUsuarios:shared},lerJsonLocalStorage:()=>locais,operadorVoltarRomaneios(){}};
 runInNewContext(source,context);
 const secao=()=>ids.get('romaneiosCompartilhados');
 const rows=()=>secao().children.find(x=>x.tag==='div').children[0].children.find(x=>x.tag==='tbody').children;
 return {context,secao,rows,locais};
}
test('consulta abre palete, mostra todos e atualiza sem alterar entradas locais',()=>{
 const {context:c,secao,rows,locais}=ambiente();
 c.renderizarRomaneiosCompartilhados();assert.equal(rows().length,2);
 c.abrirConsultaCompartilhada('A','1');assert.equal(rows().length,1);
 assert.equal(rows()[0].children[8].textContent,'<img onerror=alert(1)>');
 secao().children.find(x=>x.tag==='button').onclick();assert.equal(rows().length,2);
 c.window.__paletesDeOutrosUsuarios[0].caixas=22;c.renderizarRomaneiosCompartilhados();assert.equal(rows()[0].children[7].textContent,'22');
 c.window.__paletesDeOutrosUsuarios=[];c.renderizarRomaneiosCompartilhados();assert.equal(secao().hidden,true);
 assert.deepEqual(locais,[{registroId:'local'}]);
});
test('mesmo login sem projeção adicional mantém consulta oculta',()=>{
 const {context:c,secao}=ambiente();c.window.__paletesDeOutrosUsuarios=[];c.renderizarRomaneiosCompartilhados();assert.equal(secao().hidden,true);
});
