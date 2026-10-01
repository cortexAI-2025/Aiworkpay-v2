const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const exportsObject={};
const code=ts.transpileModule(fs.readFileSync('lib/i18n/shared.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
vm.runInNewContext(code,{exports:exportsObject,require:()=>require('../lib/i18n/en.json')});
const {resolveLocale,translate}=exportsObject;
test('locale cookie takes precedence and unsupported cookies fall back to browser preferences',()=>{
 assert.equal(resolveLocale('fr','en-GB,en;q=0.9'),'fr');
 assert.equal(resolveLocale('en','fr-FR'),'en');
 assert.equal(resolveLocale('invalid','de,en;q=0.8,fr;q=0.5'),'en');
 assert.equal(resolveLocale(undefined,'en;q=0,fr;q=1'),'fr');
 assert.equal(resolveLocale(undefined,'es'),'fr');
});
test('UI translations preserve unknown content and French originals',()=>{
 assert.equal(translate('en','Connexion'),'Sign in');
 assert.equal(translate('fr','Connexion'),'Connexion');
 assert.equal(translate('en','Mission personnalisée Casablanca'),'Mission personnalisée Casablanca');
});
