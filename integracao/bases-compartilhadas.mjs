// Registro apenas em memória da janela principal; nunca armazena credenciais.
export function escopoCompartilhado(){
 if(typeof window==='undefined')return globalThis;
 try{if(window.parent&&window.parent.location.origin===window.location.origin)return window.parent;}catch{}
 return window;
}
const CHAVE='__romaneioBasesCompartilhadas117';
const registro=escopo=>escopo[CHAVE]||(escopo[CHAVE]=new Map());
export function adquirirBaseCompartilhada({chave,criar,aoMudar=()=>{},aoErro=()=>{},escopo=escopoCompartilhado()}){
 if(!chave||typeof criar!=='function')throw Error('Identificação da base compartilhada inválida.');
 const bases=registro(escopo);let entrada=bases.get(chave);
 const consumidor={aoMudar,aoErro};
 if(!entrada){
  entrada={ouvintes:new Set([consumidor]),ultima:null,erro:null,invalidada:false,metricas:{assinaturasCriadas:1,imagensConfirmadas:0,documentosAlteradosRecebidos:0,erros:0}};bases.set(chave,entrada);
  try{entrada.base=criar({aoMudar:(snap,revisao)=>{
   const anteriores=new Map((entrada.ultima?.docs||[]).map(d=>[d.id,JSON.stringify(d.data())]));
   entrada.metricas.documentosAlteradosRecebidos+=snap.docs.filter(d=>anteriores.get(d.id)!==JSON.stringify(d.data())).length;
   entrada.metricas.imagensConfirmadas++;entrada.ultima=snap;entrada.erro=null;
   for(const o of [...entrada.ouvintes]){try{o.aoMudar(snap,revisao);}catch(e){o.aoErro(e);}}
  },aoErro:e=>{entrada.erro=e;entrada.ultima=null;entrada.invalidada=true;entrada.metricas.erros++;for(const o of [...entrada.ouvintes])o.aoErro(e);}});}catch(e){bases.delete(chave);throw e;}
 }else{
  entrada.ouvintes.add(consumidor);
  if(entrada.ultima)queueMicrotask(()=>{entrada.base.ler().then(snap=>{if(entrada.ouvintes.has(consumidor))aoMudar(snap,entrada.base.revisao);}).catch(e=>{if(entrada.ouvintes.has(consumidor))aoErro(e);});});
  else if(entrada.erro)queueMicrotask(()=>{if(entrada.ouvintes.has(consumidor)&&entrada.erro)aoErro(entrada.erro);});
 }
 let encerrada=false;
 return {
  ler:()=>encerrada?Promise.reject(Error('Sessão de recebimento encerrada.')):entrada.base.ler(),
  get revisao(){return entrada.base.revisao;},
  invalidar(){if(encerrada)return;entrada.invalidada=true;entrada.ultima=null;entrada.base.invalidar();},
  reconectar(){if(encerrada||!entrada.invalidada)return;entrada.invalidada=false;entrada.erro=null;entrada.metricas.assinaturasCriadas++;entrada.base.reconectar();},
  parar(){if(encerrada)return;encerrada=true;entrada.ouvintes.delete(consumidor);if(!entrada.ouvintes.size){entrada.base.parar();bases.delete(chave);}}
 };
}
// Contadores de solicitações da aplicação; não representam faturamento.
export function metricasBasesCompartilhadas(escopo=escopoCompartilhado()){
 return [...registro(escopo)].map(([chave,e])=>({chave,consumidores:e.ouvintes.size,...e.metricas}));
}
