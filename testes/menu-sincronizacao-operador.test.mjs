import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fonte=html.slice(html.indexOf('async function operadorSincronizarAgora(){'),html.indexOf("document.getElementById('tabTotal')?.addEventListener"));
async function executar(restantes,sucesso){
 const botao={},mensagem={textContent:''},tentar={};let abriu=0,enviou=0,consulta=0;
 const c={document:{querySelector:()=>botao,getElementById:id=>id==='resultadoResolverPendencias'?mensagem:tentar},window:{atualizarConsultaCompartilhada:async()=>{consulta++}},lerFilaMovimentos:()=>Array.from({length:restantes}),consultarFilaMovimentos(){abriu++},async resolverPendenciasSincronizacao(b,m){assert.equal(b,tentar);assert.equal(m,mensagem);enviou++;m.textContent=sucesso?'Confirmado':'Motivo específico';return sucesso},localStorage:{setItem(){}},setTimeout:(f,ms)=>{if(ms===1800)f()},operadorAtualizarPainel(){},console};
 runInNewContext(fonte,c);await c.operadorSincronizarAgora();return {botao,mensagem,abriu,enviou,consulta};
}
test('menu abre a janela e mostra a mesma falha detalhada do envio',async()=>{const r=await executar(4,false);assert.equal(r.abriu,1);assert.equal(r.enviou,1);assert.equal(r.consulta,1);assert.equal(r.mensagem.textContent,'Motivo específico');assert.match(r.botao.textContent,/CONSULTE A JANELA/)});
test('sem fila o menu atualiza consulta sem criar pendência',async()=>{const r=await executar(0,true);assert.equal(r.abriu,0);assert.equal(r.enviou,0);assert.equal(r.consulta,1)});
test('diagnóstico local identifica falha sem depender de importação ou rede',()=>{
 const start=html.indexOf('function diagnosticarFormatoEnvio('),end=html.indexOf('function consultarFilaMovimentos()',start);const c={};runInNewContext(html.slice(start,end),c);
 const motivos=c.diagnosticarFormatoEnvio({id:'abcdefgh',tipo:'inclusao',item:{sku:'5002',loteCompleto:'L24',caixas:'8'},criadoEm:'2026-10-20'});
 assert.match(motivos.join(' '),/aparelho/);assert.doesNotMatch(html,/Verifique os motivos na validação da fila abaixo/);
});
