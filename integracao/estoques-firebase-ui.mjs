import {exigirFirebaseHomologacao} from './guarda-firebase-homologacao.mjs';
import {resolverAmbienteUsuario} from './ambiente-compartilhado.mjs';
import {guardarModeloEmbalado} from './modelo-estoque-persistente.mjs';
import {initializeApp,getApp,getApps} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,collection,query,orderBy,limit,onSnapshot,runTransaction} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {publicarEstoqueOficial} from './publicacao-estoques.mjs';
import {conferirEstoques} from './conferencia-estoques.mjs';
const config={apiKey:'AIzaSyCCy5uY1eAFQE9Vhykr7xNNayDtk_B-Hy4',authDomain:'romaneio-2-0-homologacao.firebaseapp.com',projectId:'romaneio-2-0-homologacao',storageBucket:'romaneio-2-0-homologacao.firebasestorage.app',messagingSenderId:'357381847782',appId:'1:357381847782:web:59ad8365c033bba8e79927'};
exigirFirebaseHomologacao(config);
const app=getApps().length?getApp():initializeApp(config),auth=getAuth(app),db=getFirestore(app);
let unsub=[],versoes={embalado:'',paripassu:''},ambienteAtual=null,usuarioAtual=null;
const $=id=>document.getElementById(id),mostrar=(s)=>{const el=$('etapa4FirebaseStatus');if(el)el.textContent=s};
const N=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
function lerEmbalado(linhas){
 const i=linhas.findIndex(l=>l.some(x=>N(x)==='SKU')&&l.some(x=>N(x)==='LOTE COMPLETO')&&l.some(x=>N(x)==='SALDO'));
 if(i<0)throw Error('Colunas SKU, LOTE COMPLETO, SALDO ausentes.');
 const h=linhas[i].map(N),map=new Map(),q=h.indexOf('SALDO'),s=h.indexOf('SKU'),l=h.indexOf('LOTE COMPLETO'),p=h.indexOf('POSTURA');
 for(const row of linhas.slice(i+1)){const sku=String(row[s]??'').trim(),lote=String(row[l]??'').trim();if(!sku&&!lote)continue;if(!sku||!lote)throw Error('Linha de estoque sem SKU/lote.');const saldo=Number(row[q]);if(!Number.isSafeInteger(saldo)||saldo<0)throw Error('Saldo de caixas inválido no lote '+lote);const k=JSON.stringify([N(sku),N(lote)]),a=map.get(k);if(a)a.saldo+=saldo;else map.set(k,{sku,lote,saldo,postura:p<0?'':String(row[p]??'')});}
 if(!map.size)throw Error('Estoque Embalado vazio.');return [...map.values()];
}
async function importar(file,tipo){
 if(!file)throw Error('Selecione o arquivo.');if(typeof XLSX==='undefined')throw Error('Biblioteca Excel indisponível.');
 const w=XLSX.read(await file.arrayBuffer(),{type:'array'}),aba=w.SheetNames.find(n=>N(n)===N(tipo==='embalado'?'ESTOQUE':'1. ESTOQUE'));
 if(!aba)throw Error('Aba de estoque não encontrada.');
 const linhas=XLSX.utils.sheet_to_json(w.Sheets[aba],{header:1,defval:'',raw:true});
 if(tipo==='embalado')return lerEmbalado(linhas);
 const {extrairParipassu}=await import('./leitor-paripassu.mjs');return extrairParipassu(linhas).itens;
}
let avisoPariAtual=null,assinaturaPariAtual='';
function mostrarAvisoParipassu(qtd,assinatura){
 if(window.matchMedia('(max-width:767px)').matches)return;
 const atual=document.querySelector('.eme-aviso-overlay[data-tipo="paripassu"]');
 if(atual)return;
 if(sessionStorage.getItem('romaneio2-paripassu-ack')===assinatura)return;
 const overlay=document.createElement('div');overlay.className='eme-aviso-overlay';overlay.dataset.tipo='paripassu';
 const card=document.createElement('section');card.className='eme-aviso-card';card.setAttribute('role','alertdialog');card.setAttribute('aria-modal','true');
 const title=document.createElement('h2');title.className='eme-aviso-topo';title.textContent='Pendências na conferência PariPassu';
 const descricao=document.createElement('p');descricao.className='eme-aviso-sub';descricao.textContent=qtd+' pendência(s). Confira a aba CONFERÊNCIA PARIPASSU. O romaneio não foi bloqueado.';
 const btn=document.createElement('button');btn.className='eme-aviso-ok';btn.type='button';btn.textContent='OK, ENTENDI';
 btn.addEventListener('click',()=>{sessionStorage.setItem('romaneio2-paripassu-ack',assinatura);avisoPariAtual=null;overlay.remove()});
 card.append(title,descricao,btn);overlay.append(card);document.body.append(overlay);avisoPariAtual=overlay;assinaturaPariAtual=assinatura;btn.focus();
}
const vigiarAviso=new MutationObserver(()=>{
 if(avisoPariAtual&&!avisoPariAtual.isConnected&&assinaturaPariAtual&&sessionStorage.getItem('romaneio2-paripassu-ack')!==assinaturaPariAtual)document.body.append(avisoPariAtual);
});
vigiarAviso.observe(document.body,{childList:true});

function renderizarDestinosExcluidos(registros=[]){
 // A área de expedições excluídas é controlada pelo histórico operacional
 // do computador; não substituir seu conteúdo por eventos brutos incompletos.
 window.__destinosExcluidosRemotos=registros.filter(x=>x.tipo==='exclusao'&&x.item?.destino);
 window.operadorAtualizarPainel?.();
}

function observar(uid,ambienteId=null){
 unsub.forEach(f=>f());unsub=[];
 if(!ambienteId)throw Error('Homologação sem ambiente compartilhado');
 const raiz=['romaneio_ambientes',ambienteId];
 for(const tipo of ['embalado','paripassu']){
  unsub.push(onSnapshot(doc(db,...raiz,'estoques_oficiais',tipo),snap=>{
   const d=snap.exists()?snap.data():null;versoes[tipo]=d?.versao||'';
   if(tipo==='embalado'&&d?.itens?.length){window.estoqueTesteConsulta=new Map(d.itens.map((x,i)=>[String(i),x]));window.reservaTesteAtiva=true;for(const fn of ['atualizarResumoReservaTeste','renderizarEstoqueCompletoTeste','operadorAtualizarCardsEstoque','renderizarPendenciasConferenciaEstoque'])try{window[fn]?.()}catch{}}
   window.__etapa4=window.__etapa4||{};window.__etapa4[tipo]=d?.itens||null;
   const e=window.__etapa4.embalado,p=window.__etapa4.paripassu;
   if(e&&p){
    const r=conferirEstoques(e,p),el=$('etapa4Resumo'),out=$('etapa4Pendencias'),ok=$('etapa4Conformes'),alerta=$('etapa4Aviso');
    if(el)el.textContent=r.conferidos+' lotes do Embalado | '+r.conformes+' OK no PariPassu | '+r.pendencias.length+' pendências. Conferência automática.';
    if(out){out.replaceChildren();for(const x of r.pendencias){const li=document.createElement('li');li.textContent=x.sku+' / '+x.lote+' / '+(x.postura||'sem postura')+' — '+(x.tipo==='ausente_paripassu'?'NÃO LOCALIZADO NO PARIPASSU':'DIVERGÊNCIA DE CAIXAS')+' | Embalado '+x.embalado+' | PariPassu '+x.paripassu;out.appendChild(li)}}
    const painelCount=$('etapa4PainelContador'),painelMsg=$('etapa4PainelMensagem'),painelLista=$('etapa4PainelLista');
    if(painelCount)painelCount.textContent=String(r.pendencias.length);
    const visao=$('etapa4ResumoVisao');if(visao){visao.textContent=r.pendencias.length?'PariPassu: '+r.pendencias.length+' pendência(s). Consulte CONFERÊNCIA PARIPASSU no menu lateral.':'PariPassu: '+r.conformes+' lote(s) conferido(s), sem pendências.';visao.style.borderLeftColor=r.pendencias.length?'#f97316':'#5CDCF2';}
    if(painelMsg)painelMsg.textContent=r.pendencias.length?'Verifique no PariPassu, corrija e importe a nova planilha. Não bloqueia o romaneio.':'Conferência concluída: '+r.conformes+' lote(s) OK no PariPassu.';
    if(painelLista){painelLista.replaceChildren();
      const table=document.createElement('table');table.className='etapa4-pari-tabela';
      const thead=table.createTHead().insertRow();
      for(const label of ['SKU','Lote completo','Situação','Embalado (CX)','PariPassu (CX)','Faltam (CX)']){const th=document.createElement('th');th.textContent=label;thead.append(th)}
      const body=table.createTBody();
      const fmt=x=>Number(x).toLocaleString('pt-BR',{maximumFractionDigits:3});
      for(const x of r.pendencias){const tr=body.insertRow();const valores=[x.sku,x.lote,x.tipo==='ausente_paripassu'?'Ausente':'Saldo inferior',fmt(x.embalado),fmt(x.paripassu),fmt(x.diferenca)];for(const v of valores){const td=tr.insertCell();td.textContent=String(v)}}
      if(r.pendencias.length)painelLista.append(table);
      else{const msg=document.createElement('p');msg.textContent='Sem pendências. Todos os lotes do Embalado estão atendidos no PariPassu.';msg.style.padding='15px';painelLista.append(msg)}
    }
    if(ok){
      ok.replaceChildren();
      const details=document.createElement('details'),summary=document.createElement('summary');
      summary.textContent='OK no PariPassu ('+r.conformes+') — clique para expandir';
      details.appendChild(summary);
      const wrap=document.createElement('div');wrap.className='etapa4-pari-lista';
      const table=document.createElement('table');table.className='etapa4-pari-tabela';
      const tr=table.createTHead().insertRow();
      for(const label of ['SKU','Lote completo','Situação','Embalado (CX)','PariPassu (CX)','Diferença (CX)']){const th=document.createElement('th');th.textContent=label;tr.appendChild(th)}
      const body=table.createTBody();const fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:3});
      for(const x of r.conformesItens){const row=body.insertRow();for(const value of [x.sku,x.lote,'OK',fmt(x.saldo),fmt(x.paripassu),fmt(Math.max(0,x.saldo-x.paripassu))]){const td=row.insertCell();td.textContent=String(value)}}
      wrap.append(table);details.append(wrap);ok.append(details);
    }

    if(alerta){alerta.hidden=true;alerta.style.display='none';
      const chave='romaneio2-etapa4-alerta-'+uid,assinatura=r.pendencias.map(x=>[x.sku,x.lote,x.tipo,x.diferenca].join('|')).join(';');
      if(r.pendencias.length)mostrarAvisoParipassu(r.pendencias.length,assinatura);
      if(!r.pendencias.length){sessionStorage.removeItem(chave);avisoPariAtual=null;assinaturaPariAtual='';document.querySelector('.eme-aviso-overlay[data-tipo="paripassu"]')?.remove();}
    }
   }else{if($('etapa4Resumo'))$('etapa4Resumo').textContent='Aguardando importar os dois estoques.';}

   mostrar('Firebase conectado — '+tipo+': '+(d?.itens?.length??0)+' lotes; versão '+(versoes[tipo]||'não importada'));
  },e=>mostrar('Firebase: '+e.message)));
 }
 renderizarDestinosExcluidos();
 unsub.push(onSnapshot(query(collection(db,...raiz,'movimentos'),orderBy('criadoEm','desc'),limit(50)),snapshot=>{
   renderizarDestinosExcluidos(snapshot.docs.map(d=>d.data()));
 },err=>{const alvo=$('listaDestinosExcluidos');if(alvo){const p=document.createElement('p');p.textContent='Histórico remoto indisponível: '+err.message+'. As exclusões locais e a fila não foram descartadas.';alvo.append(p)}}));
}
onAuthStateChanged(auth,async u=>{unsub.forEach(f=>f());unsub=[];ambienteAtual=null;usuarioAtual=u?.uid||null;versoes={embalado:'',paripassu:''};if(!u){mostrar('Faça login na Central de Conexão para compartilhar os estoques.');return;}try{const vinculo=await resolverAmbienteUsuario({db,uid:u.uid});if(usuarioAtual!==u.uid)return;ambienteAtual=vinculo;observar(u.uid,vinculo.ambienteId);}catch(e){if(usuarioAtual!==u.uid)return;mostrar('Sincronização suspensa: '+e.message);}});
$('etapa4Arquivo')?.addEventListener('change',async()=>{const arquivo=$('etapa4Arquivo')?.files?.[0];if(!arquivo||$('etapa4Tipo')?.value!=='embalado')return;try{await importar(arquivo,'embalado');await guardarModeloEmbalado(arquivo);window.__etapa4ArquivoEmbalado=arquivo;mostrar('Modelo de Estoque Embalado preservado neste navegador. Publique para sincronizar os saldos no Firebase.')}catch(err){mostrar('Arquivo não preservado: '+err.message)}});
$('etapa4Publicar')?.addEventListener('click',async()=>{
 const b=$('etapa4Publicar');b.disabled=true;
 try{
  await auth.authStateReady();const u=auth.currentUser;if(!u)throw Error('Autenticação necessária na Central de Conexão.');
  const tipo=$('etapa4Tipo').value,file=$('etapa4Arquivo').files?.[0],itens=await importar(file,tipo);
  if(tipo==='embalado')window.__etapa4ArquivoEmbalado=file;
  if(!navigator.onLine)throw Error('Sem conexão. Arquivo não publicado.');
  if(new TextEncoder().encode(JSON.stringify(itens)).length>750000)throw Error('Estoque excede tamanho seguro para um documento Firebase; publicação cancelada sem perda de dados.');
  if(!confirm('Publicar '+itens.length+' lotes de '+tipo+' para os aparelhos autenticados? A planilha oficial não será modificada.'))return;
  const versao=crypto.randomUUID();
  if(ambienteAtual&&!ambienteAtual.permissoes.publicarExcel)throw Error('Usuário sem permissão para publicar Excel.');
  const r=await publicarEstoqueOficial({db,uid:u.uid,tipo,dados:{tipo,nome:file.name,versao,itens},versaoEsperada:versoes[tipo],doc,runTransaction,autorizado:true,ambienteId:ambienteAtual?.ambienteId||null});
  if(tipo==='embalado'){try{await guardarModeloEmbalado(file)}catch(err){mostrar('Publicado no Firebase, mas a cópia local do Excel não foi preservada: '+err.message);return;}}
  mostrar('Publicado no Firebase: '+r.quantidadeLotes+' lotes, versão '+r.versao);
 }catch(e){mostrar('Publicação não concluída: '+e.message)}finally{b.disabled=false}
});
