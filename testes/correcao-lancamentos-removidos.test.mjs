import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fonte=html.slice(html.indexOf('async function arquivarPendenciaHistoricaSemNovaBaixa('),html.indexOf('function mostrarExpedicoesExcluidasOperador(){'));
const base={data:'21/10/2026',sku:'3938',destino:'NHT',palete:'1',postura:'.18.10.26',reservaTeste:true};
const antigas=[{...base,registroId:'antiga32',movimentoExclusaoId:'exc32',loteCompleto:'L20.01.18.10.26',caixas:32,estado:'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA'},{...base,registroId:'antiga3',movimentoExclusaoId:'exc3',loteCompleto:'L21.15.19.10.26',postura:'.19.10.26',caixas:3,estado:'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA'}];
function ambiente(aprovar=true){
 const arquivo=[...antigas.map(r=>({...r})),{...antigas[0],registroId:'outra',movimentoExclusaoId:'excOutra',destino:'OUTRO',caixas:2}];
 const store=new Map([['arquivo',JSON.stringify(arquivo)]]),mensagens=[];let recalculos=0;
 const c={lerExpedicoesPendentes:()=>JSON.parse(store.get('arquivo')),confirmarRaiar:async m=>{mensagens.push(m);return aprovar;},lerJsonLocalStorage:(k,d)=>store.has(k)?JSON.parse(store.get(k)):d,criarIdentificadorMovimento:()=> 'auditoria',localStorage:{setItem:(k,v)=>store.set(k,v)},CHAVE_EXPEDICOES_PENDENTES:'arquivo',operadorAtualizarPainel(){},atualizarDestinosBaixa(){},atualizarResumoReservaTeste(){recalculos++;},renderizarPendenciasConferenciaEstoque(){recalculos++;},document:{getElementById:()=>null},alert:m=>{throw Error(m);}};
 runInNewContext(fonte,c);return {c,store,mensagens,recalculos:()=>recalculos};
}
test('correção preserva linhas e outros destinos, registra auditoria sem alegar baixa anterior',async()=>{
 const {c,store,mensagens,recalculos}=ambiente();await c.arquivarPendenciaHistoricaSemNovaBaixa('NHT',true);
 const registros=JSON.parse(store.get('arquivo'));assert.equal(registros.length,3);assert.equal(registros[2].estado,'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA');
 for(const r of registros.slice(0,2)){assert.equal(r.estado,'ARQUIVADA_APOS_CONFERENCIA');assert.equal(r.baixaConfirmadaEm,undefined);assert.match(r.motivoArquivo,/incorretos/);}
 const audit=JSON.parse(store.get('romaneio2_auditoria_pendencias_historicas_v1'));assert.equal(audit[0].caixas,35);assert.equal(audit[0].tipo,'CORRECAO_LANCAMENTOS_REMOVIDOS_SEM_BAIXA');assert.equal(audit[0].registros.length,2);
 assert.match(mensagens[0],/Registros: 2 \| Caixas: 35/);assert.doesNotMatch(mensagens[0],/Use SOMENTE se a baixa/);assert.equal(recalculos(),2);
 // Reproduz as somas do caso: apenas as parcelas removidas saem da conferência.
 const linhasAtuais=[{...base,registroId:'atual10',loteCompleto:antigas[0].loteCompleto,caixas:10},{...base,registroId:'atual35',loteCompleto:antigas[0].loteCompleto,caixas:35},...[13,16,10].map((caixas,i)=>({...base,registroId:'atual'+i,loteCompleto:antigas[1].loteCompleto,postura:'.19.10.26',caixas}))];
 const linhas=linhasAtuais.map(r=>({dataset:{registroId:r.registroId,reservaTeste:'1'},cells:[r.data,r.sku,r.destino,r.palete,r.loteCompleto,'',r.postura,r.caixas].map(t=>({textContent:String(t)}))}));
 const ctx={document:{querySelectorAll:()=>linhas},window:{},lerExpedicoesPendentes:()=>registros};
 runInNewContext(html.slice(html.indexOf('function linhasConferenciaEstoque(){'),html.indexOf('function reservasAtuaisTeste(')),ctx);
 const totais=ctx.linhasConferenciaEstoque().filter(r=>r.cells[2].textContent==='NHT').reduce((a,r)=>{const k=r.cells[4].textContent;a[k]=(a[k]||0)+Number(r.cells[7].textContent);return a;},{});
 assert.equal(totais[antigas[0].loteCompleto],45);assert.equal(totais[antigas[1].loteCompleto],39);
});
test('cancelar preserva todas as pendências e não grava auditoria',async()=>{
 const {c,store,recalculos}=ambiente(false);const antes=store.get('arquivo');await c.arquivarPendenciaHistoricaSemNovaBaixa('NHT',true);assert.equal(store.get('arquivo'),antes);assert.equal(store.size,1);assert.equal(recalculos(),0);
});
test('fluxo anterior de baixa já conferida conserva mensagem e auditoria próprias',async()=>{
 const {c,store,mensagens}=ambiente();await c.arquivarPendenciaHistoricaSemNovaBaixa('NHT');assert.match(mensagens[0],/Use SOMENTE se a baixa/);assert.equal(JSON.parse(store.get('romaneio2_auditoria_pendencias_historicas_v1'))[0].tipo,'ARQUIVO_HISTORICO_SEM_NOVA_BAIXA');
});
