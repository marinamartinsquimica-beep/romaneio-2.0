import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {criarColecaoIncremental,LIMITE_COLECAO_INCREMENTAL} from '../integracao/colecao-incremental.mjs';
import * as marcos from '../integracao/marcos-romaneios-fechados.mjs';
import * as recepcao from '../integracao/recepcao-romaneios-ativos.mjs';
import * as recuperar from '../integracao/recuperar-paletes-remotos.mjs';
import {identidadeExpedicaoBaixa} from '../integracao/baixa-transacional.mjs';
const html=readFileSync(new URL('../integracao/central-conexao.html',import.meta.url),'utf8');
const fim=html.indexOf('// Compatibilidade com avisos do painel:');
const observar=html.slice(html.indexOf('let baseRecebida=null;'),fim);
const leitores=html.slice(html.indexOf('async function lerHistoricoRecebido(uid){'),html.indexOf('async function guardarHistoricoEncerradosRecebidos('));
const uniao=html.slice(html.indexOf('async function aplicarUniaoSeguraOperacional(){'),html.indexOf("$('aplicarUniaoSegura').onclick"));
const incluir={registroId:'registro-0001',data:'21/10/2026',destino:'Taeque',palete:'1',sku:'5008',loteCompleto:'L001',lote:'001',postura:'20/10/2026',caixas:13,observacoes:''};
const mov=(tipo,id,item,antes=null)=>({id,tipo,item,antes,criadoEm:'2026-10-21T10:00:0'+({'inclusao':0,'edicao':1,'exclusao':2}[tipo])+'Z',autorUid:'salaovos'});
function ambiente({mobile=false,entradas=[]}={}){
 const dados=new Map([['entradas',JSON.stringify(entradas)],['romaneio2_movimentos_pendentes_v1','[]'],['romaneio2_ultimo_estado_movimentos_v1',JSON.stringify(entradas)]]);
 const fontes=new Map(),elementos=new Map();let ciclos=0;
 const c={criarColecaoIncremental,LIMITE_COLECAO_INCREMENTAL,db:{},auth:{currentUser:{uid:'marina'},authStateReady:async()=>{}},navigator:{onLine:true},
  receberEntradasNoAparelho:()=>!mobile,raizOperacional:uid=>['romaneio_ambientes','sala-ovos'],queueMicrotask,
  cancelarMudancasRemotas:null,contaObservada:null,ultimaAssinaturaRemota:null,revisaoExpedicoesRemotas:0,cicloSolicitadoDuranteConsulta:false,cicloAutomatico:()=>ciclos++,
  collection:(_db,...path)=>({nome:path.at(-1)}),orderBy:()=>{},limit:n=>{assert.ok(n<=10000,'Consulta excede o máximo aceito pelo serviço');return n;},query:ref=>ref,
  onSnapshot(ref,opcoes,ok,erro){assert.equal(opcoes.includeMetadataChanges,true);fontes.set(ref.nome,{ok,erro,ativa:true});return ()=>{fontes.get(ref.nome).ativa=false;};},
  $:id=>{if(!elementos.has(id))elementos.set(id,{disabled:false,textContent:''});return elementos.get(id);},
  window:{addEventListener(){},removeEventListener(){},confirm:()=>true,parent:null},location:{origin:'https://romaneio.example'},
  localStorage:{getItem:k=>dados.get(k)??null,setItem:(k,v)=>dados.set(k,v),removeItem:k=>dados.delete(k)},
  registrarExclusoesRecebidas:()=>{},CHAVE_OPERACIONAL:'romaneio2_movimentos_pendentes_v1',backupUniaoNestaSessao:true,uniaoAutomaticaEmAndamento:true,CHAVE_BACKUP_AUTOMATICO:'backup',
  crypto:{randomUUID:()=> 'id-00000000'},salvarHistoricoEncerradosRecebidos:()=>{},
  guardarHistoricoEncerradosRecebidos:async registro=>({id:registro.id,data:registro.data,registros:registro.entradas.length}),
  carregarModulo:async nome=>nome.includes('marcos-romaneios')?marcos:nome.includes('recepcao-romaneios')?recepcao:recuperar
 };
 c.window.parent=c.window;
 runInNewContext(observar+'\n'+leitores+'\n'+uniao.replaceAll('await import(', 'await carregarModulo('),c);
 c.observarMovimentosAutomaticos({uid:'marina'});
 function publicar(nome,itens){const docs=itens.map(x=>({id:x.id,data:()=>structuredClone(x)}));fontes.get(nome).ok({docs,size:docs.length,metadata:{fromCache:false,hasPendingWrites:false},docChanges:()=>docs.map(doc=>({type:'modified',doc}))});}
 return {c,dados,fontes,publicar,elementos,get ciclos(){return ciclos;}};
}
test('celular não assina nem lê movimentos/expedições do computador',async()=>{
 const a=ambiente({mobile:true});assert.equal(a.fontes.size,0);await assert.rejects(a.c.lerHistoricoRecebido('marina'),/Base online/);
});
test('união usa a base recebida para incluir e editar, sem getDocs adicionais',async()=>{
 const a=ambiente();a.publicar('movimentos',[mov('inclusao','m1',incluir)]);a.publicar('expedicoes',[]);
 await a.c.aplicarUniaoSeguraOperacional();assert.equal(JSON.parse(a.dados.get('entradas'))[0].caixas,13);
 a.c.backupUniaoNestaSessao=true;const alterado={...incluir,caixas:20};
 a.publicar('movimentos',[mov('inclusao','m1',incluir),mov('edicao','m2',alterado,incluir)]);
 await a.c.aplicarUniaoSeguraOperacional();const resultado=JSON.parse(a.dados.get('entradas'));assert.equal(resultado.length,1);assert.equal(resultado[0].caixas,20);
});
test('baixa e exclusão comprovadas arquivam o antigo, permitindo novo no mesmo destino',async()=>{
 const novo={...incluir,registroId:'registro-novo',palete:'2'};const a=ambiente({entradas:[incluir]});
 a.publicar('movimentos',[mov('inclusao','m1',incluir),mov('exclusao','m2',incluir),mov('inclusao','m3',novo)]);
 a.publicar('expedicoes',[{id:identidadeExpedicaoBaixa(incluir,true).id,origemId:'ativo_'+incluir.registroId,registroId:incluir.registroId,estado:'BAIXA_CONCLUIDA'}]);
 await a.c.aplicarUniaoSeguraOperacional();assert.equal(JSON.parse(a.dados.get('entradas')).length,0);
 assert.equal(JSON.parse(a.dados.get('romaneio2_historico_fechamentos_v1')).length,1);
 a.c.backupUniaoNestaSessao=true;await a.c.aplicarUniaoSeguraOperacional();
 assert.deepEqual(JSON.parse(a.dados.get('entradas')).map(x=>x.registroId),['registro-novo']);
});
test('fila pendente impede união; exclusão sem baixa mantém registro no computador',async()=>{
 const a=ambiente({entradas:[incluir]});a.publicar('movimentos',[mov('inclusao','m1',incluir),mov('exclusao','m2',incluir)]);a.publicar('expedicoes',[]);
 await a.c.aplicarUniaoSeguraOperacional();assert.equal(JSON.parse(a.dados.get('entradas')).length,1);
 a.c.backupUniaoNestaSessao=true;
 a.dados.set('romaneio2_movimentos_pendentes_v1','[{"id":"a-enviar"}]');const antes=a.dados.get('entradas');
 await a.c.aplicarUniaoSeguraOperacional();assert.equal(a.dados.get('entradas'),antes);assert.match(a.elementos.get('resultadoAplicarUniao').textContent,/pendentes/);
});
test('troca de conta encerra fontes e impede uso da imagem anterior',async()=>{
 const a=ambiente();a.publicar('movimentos',[mov('inclusao','m1',incluir)]);a.publicar('expedicoes',[]);
 a.c.auth.currentUser={uid:'salaovos'};a.c.observarMovimentosAutomaticos(null);
 assert.equal(a.fontes.get('movimentos').ativa,false);await assert.rejects(a.c.lerHistoricoRecebido('marina'),/Base online/);
});
test('baixa recebida durante a conferência cancela a imagem anterior antes de gravar ativos',async()=>{
 const a=ambiente();a.publicar('movimentos',[mov('inclusao','m1',incluir)]);a.publicar('expedicoes',[]);
 const carregar=a.c.carregarModulo;let alterou=false;
 a.c.carregarModulo=async nome=>{
  if(!alterou&&nome.includes('recepcao-romaneios')){alterou=true;a.publicar('expedicoes',[{id:identidadeExpedicaoBaixa(incluir,true).id,origemId:'ativo_'+incluir.registroId,registroId:incluir.registroId,estado:'BAIXA_CONCLUIDA'}]);}
  return carregar(nome);
 };
 const antes=a.dados.get('entradas');await a.c.aplicarUniaoSeguraOperacional();
 assert.equal(a.dados.get('entradas'),antes);assert.match(a.elementos.get('resultadoAplicarUniao').textContent,/mudou durante/);
});
