import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
import * as modulo from '../integracao/reconciliar-pendencias-baixadas.mjs';import {identidadeExpedicaoBaixa} from '../integracao/baixa-transacional.mjs';
const html=readFileSync(new URL('../integracao/central-conexao.html',import.meta.url),'utf8');
const fonte=html.slice(html.indexOf('async function sincronizarExpedicoesCompartilhadasInterno(){'),html.indexOf('function aplicarCorrecoesConfirmadas(')).replaceAll('await import(','await carregarModulo(');
function ambiente(){
 const registros=Array.from({length:40},(_,i)=>({registroId:'registro-'+i,movimentoExclusaoId:'exclusao-'+i,data:'22/10/2026',sku:'5002',destino:'DESTINO',palete:String(i),loteCompleto:'L'+i,postura:'21/10/26',caixas:10,estado:'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA'}));
 let bruto=JSON.stringify(registros),leituras=0,gravacoes=0;const comprovantes=[];const base={expedicoes:{revisao:1}};
 const c={receberEntradasNoAparelho:()=>true,auth:{currentUser:{uid:'u'}},escopoOperacionalPronto:true,navigator:{onLine:true},localStorage:{getItem:()=>bruto,setItem:(_k,v)=>bruto=v},raizOperacional:()=>[],obterBaseRecebida:()=>base,lerExpedicoesParaRecepcao:async()=>comprovantes,carregarModulo:async()=>modulo,ambienteOperacional:{permissoes:{usuarios:false}},db:{},getDocFromServer:async()=>{leituras++;throw Error('Leitura pontual indevida')},runTransaction:async()=>{gravacoes++;throw Error('Escrita indevida')}};
 runInNewContext(fonte,c);return {c,base,registros,comprovantes,get leituras(){return leituras},get gravacoes(){return gravacoes},get bruto(){return bruto}};
}
test('40 pendências e 80 IDs ausentes: 100 ciclos não fazem consulta individual nem alteram saldos',async()=>{
 const a=ambiente();const antes=a.bruto;for(let i=0;i<100;i++)await a.c.sincronizarExpedicoesCompartilhadasInterno();assert.equal(a.leituras,0);assert.equal(a.gravacoes,0);assert.equal(a.bruto,antes);
});
test('comprovante recebido é aplicado em memória somente ao ID correspondente',async()=>{
 const a=ambiente();a.comprovantes.push({...a.registros[0],id:identidadeExpedicaoBaixa(a.registros[0],false).id,origemId:a.registros[0].movimentoExclusaoId,estado:'BAIXA_CONCLUIDA'});
 await a.c.sincronizarExpedicoesCompartilhadasInterno();const final=JSON.parse(a.bruto);assert.equal(final.filter(r=>r.estado==='BAIXA_CONCLUIDA').length,1);assert.equal(final.length,40);assert.equal(a.leituras,0);
});
test('erro na confirmação da base preserva pendências sem consultar IDs isolados',async()=>{
 const a=ambiente();const antes=a.bruto;a.c.lerExpedicoesParaRecepcao=async()=>{throw Error('base não confirmada')};await assert.rejects(a.c.sincronizarExpedicoesCompartilhadasInterno(),/base não confirmada/);assert.equal(a.bruto,antes);assert.equal(a.leituras,0);
});
test('mudança remota durante a conciliação exige repetir antes de salvar',async()=>{
 const a=ambiente();const antes=a.bruto;a.c.carregarModulo=async()=>{a.base.expedicoes.revisao++;return modulo};await assert.rejects(a.c.sincronizarExpedicoesCompartilhadasInterno(),/mudaram/);assert.equal(a.bruto,antes);
});
