import {controleEnviosCompartilhado} from './controle-tentativas.mjs?v=2.0.117';
import {exigirFirebaseHomologacao} from './guarda-firebase-homologacao.mjs';
import {resolverAmbienteUsuario} from './ambiente-compartilhado.mjs';
/* 2.0.50: integração de envio sob comando explícito, desabilitada até homologação.
 * Não usa estoque oficial nem substitui entradas entre aparelhos.
 */
import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,getDocFromServer,runTransaction} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {criarPublicadorMovimentos} from './publicador-firestore.js?v=2.0.117';
import {criarSincronizadorFila} from './sincronizador-fila.js?v=2.0.97';
const config={apiKey:'AIzaSyCCy5uY1eAFQE9Vhykr7xNNayDtk_B-Hy4',authDomain:'romaneio-2-0-homologacao.firebaseapp.com',projectId:'romaneio-2-0-homologacao',storageBucket:'romaneio-2-0-homologacao.firebasestorage.app',messagingSenderId:'357381847782',appId:'1:357381847782:web:59ad8365c033bba8e79927'};
exigirFirebaseHomologacao(config);
const app=getApps().length?getApp():initializeApp(config),auth=getAuth(app),db=getFirestore(app);
const CHAVE='romaneio2_movimentos_pendentes_v1';
let ambienteEnvio=null;
const raizEnvio=()=>{if(!ambienteEnvio||ambienteEnvio.uid!==auth.currentUser?.uid)throw Error('Homologação sem ambiente compartilhado válido');return ['romaneio_ambientes',ambienteEnvio.ambienteId];};
const habilitado=true; // Envio operacional autorizado; nenhuma baixa de estoque.
function ler(){const f=JSON.parse(localStorage.getItem(CHAVE)||'[]');if(!Array.isArray(f))throw Error('Fila local inválida');return f;}
function gravar(f){localStorage.setItem(CHAVE,JSON.stringify(f));}
const erros=[];
const publicador=criarPublicadorMovimentos({
 transacionar:fn=>runTransaction(db,fn),
 referencia:id=>doc(db,...raizEnvio(),'movimentos',id),
 registrarErro:e=>erros.push(e),
 obterUsuario:()=>auth.currentUser
});
const sincronizador=criarSincronizadorFila({ler,gravar,publicador,avisar:r=>window.dispatchEvent(new CustomEvent('romaneio:sincronizacao-resultado',{detail:r}))});
export async function sincronizarMovimentos250(){
 if(!habilitado)throw Error('Envio ainda não habilitado; fila preservada');
 if(!ler().length)return {confirmados:0,pendentes:0};
 if(!navigator.onLine)throw Error('Sem internet; fila local preservada');
 await auth.authStateReady();
 if(!auth.currentUser)throw Error('Reconecte pela Central de Conexão');
 const uid=auth.currentUser.uid,controle=controleEnviosCompartilhado(uid);
 if(!controle.iniciar())return {confirmados:0,pendentes:ler().length,emEspera:true};
 try{
  ambienteEnvio=null;
  const vinculo=await resolverAmbienteUsuario({db,uid});if(auth.currentUser?.uid!==uid)throw Error('Sessão alterada durante a verificação');ambienteEnvio={uid,ambienteId:vinculo.ambienteId};
  const resultado=await sincronizador.executar();
  if(resultado.falhas?.length)controle.falhou(resultado.falhas[0]);else controle.sucesso();
  return resultado;
 }catch(e){controle.falhou(e);throw e;}
 finally{controle.encerrar();}
}
export function estadoSincronizacao250(){return {habilitado,autenticado:!!auth.currentUser,pendentes:ler().length,erros:erros.slice(-10)};}

export async function regularizarIdentificacaoPendencias({dispositivoId,guardarBackup}){
 if(!navigator.onLine)throw Error('Sem internet. A identificação não foi alterada.');
 await auth.authStateReady();const uid=auth.currentUser?.uid;
 if(!uid)throw Error('Reconecte pela Central de Conexão antes de regularizar.');
 const vinculo=await resolverAmbienteUsuario({db,uid});
 const validarSessao=()=>{if(auth.currentUser?.uid!==uid)throw Error('Sessão alterada; fila preservada.');};
 const {regularizarIdentificacaoFila}=await import('./regularizar-identificacao-fila.mjs?v=2.0.97');
 return regularizarIdentificacaoFila({dispositivoId,ler,gravar,guardarBackup,validarSessao,
  consultarServidor:async id=>{validarSessao();return (await getDocFromServer(doc(db,'romaneio_ambientes',vinculo.ambienteId,'movimentos',id))).exists();}
 });
}
