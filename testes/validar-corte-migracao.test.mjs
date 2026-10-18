import test from 'node:test';
import assert from 'node:assert/strict';
import {validarCorteMigracao} from '../integracao/validar-corte-migracao.mjs';
const base={origem:{total:30,assinatura:'hash-confirmado'},destino:{total:30,assinatura:'hash-confirmado'},estoquesOrigem:{embalado:{versao:'a'},paripassu:{versao:'b'}},estoquesDestino:{embalado:{versao:'a'},paripassu:{versao:'b'}},pendenciasOrigem:2,pendenciasDestino:2};
test('corte só é apto com dados, versões e pendências iguais',()=>{assert.equal(validarCorteMigracao(base).apto,true)});
test('corte bloqueia divergência de eventos, estoques e pendências',()=>{const v=validarCorteMigracao({...base,destino:{total:29,assinatura:'outro'},estoquesDestino:{embalado:{versao:'b'},paripassu:{versao:'b'}},pendenciasDestino:1});assert.equal(v.apto,false);assert.equal(v.erros.length,4)});
test('corte bloqueia dados incompletos',()=>{assert.equal(validarCorteMigracao({}).apto,false)});
