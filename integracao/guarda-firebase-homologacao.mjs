// Guardião para a compilação de HOMOLOGAÇÃO.
// Sem projeto Firebase de teste explícito, nenhuma operação em nuvem é permitida.
export const FIREBASE_HOMOLOGACAO_ID = 'romaneio-2-0-homologacao'; // preencher somente com ID do projeto de testes criado no console.
export function exigirFirebaseHomologacao(config) {
 const esperado=FIREBASE_HOMOLOGACAO_ID.trim();
 if (!esperado || !/^[a-z][a-z0-9-]{5,64}$/.test(esperado))
   throw Error('Homologação bloqueada: configure um projeto Firebase separado.');
 if (esperado==='romaneio-2-0-laboratorio'||config?.projectId!==esperado)
   throw Error('Homologação bloqueada: projeto Firebase de produção não permitido.');
 return true;
}
