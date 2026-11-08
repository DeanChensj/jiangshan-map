// Optional regeneration with the official MapLibre Font Maker WASM. Run from the repo root.
const fs=require('fs'),vm=require('vm'),path=require('path');const dir=path.resolve('ios/.build/font-maker');
(async()=>{let ready;const done=new Promise(r=>ready=r);const sandbox={console,require,process,__dirname:dir,__filename:dir+'/sdfglyph.js',Buffer,setTimeout,clearTimeout,TextDecoder,TextEncoder,Module:{wasmBinary:fs.readFileSync(dir+'/sdfglyph.wasm'),onRuntimeInitialized(){ready();}}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(dir+'/sdfglyph.js','utf8'),sandbox);await done;const m=sandbox.Module;
for (const weight of ['Regular','Bold']) {
const stack=m.ccall('create_fontstack','number',['string'],['Noto Serif '+weight]);const font=fs.readFileSync('ios/JiangshanAtlas/Resources/Fonts/NotoSerifSC-'+weight+'.ttf'),ptr=m._malloc(font.length);m.HEAPU8.set(font,ptr);m.ccall('fontstack_add_face',null,['number','number','number'],[stack,ptr,font.length]);
const output='ios/JiangshanAtlas/Resources/Glyphs/Noto Serif '+weight;fs.mkdirSync(output,{recursive:true});for(const start of [0,256,8192,8448,9216]){const g=m.ccall('generate_glyph_buffer','number',['number','number'],[stack,start]);const p=m.ccall('glyph_buffer_data','number',['number'],[g]),n=m.ccall('glyph_buffer_size','number',['number'],[g]);fs.writeFileSync(output+'/'+start+'-'+(start+255)+'.pbf',Buffer.from(m.HEAPU8.subarray(p,p+n)));m.ccall('free_glyph_buffer',null,['number'],[g]);console.log(start,n)}
}
})();
