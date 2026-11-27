// MINERVA's pictures drawn by cdrender (step 2 of the pack, notes/minerva-pack-plan.md), in Node as the build draws:
// the three open zips unpacked, every map drawn with the pictures beside it. A species' picture in place of its shape and
// name in each box; a layer text's picture in its box, its words not drawn, under everything with a negative Z-Index
// (AsthmaMap), over everything without one (HIDmap's overview), also on a layer marked not visible; a map with no
// picture address drawn as before.
//   node tests/minerva-draw.js <folder of the zips>   (pathwayforge sources/minerva/: AD_UC_comparison.zip,
//   asthma_map_bg.zip, HIDmap_v14.zip; open projects)
var fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),here=path.join(__dirname,'..'),cd=require(path.join(here,'renderers/converter/cdrender.js')),DP=require('@xmldom/xmldom').DOMParser;
var Z=fs.mkdtempSync(path.join(os.tmpdir(),'minerva-draw-'))+'/';
['AD_UC_comparison','HIDmap_v14','asthma_map_bg'].forEach(function(z){fs.mkdirSync(Z+z);cp.execFileSync('unzip',['-q','-o',path.join(process.argv[2],z+'.zip'),'-x','__MACOSX/*','-d',Z+z]);});
var bad=0,ok=function(w,v,m){if(!v)bad++;console.log((v?'ok    ':'WRONG ')+w+(m?'  '+m:''));};
function draw(root,rel){var f=path.join(root,rel),t=fs.readFileSync(f,'utf8');var asked=[];
 var svg=cd.render(t,{DOMParser:DP,classes:true,groups:true,glyph:function(p){asked.push(p);var g=path.join(root,p);return fs.existsSync(g)?'data:x;'+p:null;}});return {svg:svg,asked:asked};}
// AsthmaMap top level: 18 buttons as pictures in place of their shape and name, the overview under everything
var r=draw(Z+'asthma_map_bg','map.xml'),s=r.svg;
var imgs=s.match(/<image [^>]*>/g)||[];
ok('AsthmaMap top: 18 buttons and the overview drawn as pictures',imgs.length===19,imgs.length+' pictures');
ok('AsthmaMap top: the overview (Z-Index -1, layer not visible) first, under everything',s.indexOf('glyphs/overview.png')<s.indexOf('<g data-n=')&&/overview.png" x="0" y="0" width="5481" height="4400" preserveAspectRatio="none" pointer-events="none"/.test(s));
ok('AsthmaMap top: no button name drawn ("pathway 1")',!/>pathway 1</.test(s));
ok('AsthmaMap top: the overview text\'s words not drawn',!/Asthma map Cellular Interactions</.test(s));
// a submap: its background under everything
r=draw(Z+'asthma_map_bg','submaps/AF03 B Cell.xml');s=r.svg;
ok('AsthmaMap B cell: background under everything',(s.match(/<image /g)||[]).length===1&&s.indexOf('AF03_B_Cell.png')<s.indexOf('<g data-n='));
// HIDmap overview: no Z-Index, over everything
r=draw(Z+'HIDmap_v14','overview.xml');s=r.svg;
ok('HIDmap overview: its picture under everything (no Z-Index: a full-map picture never hides the map)',(s.match(/<image /g)||[]).length===1&&s.indexOf('glyphs/overview.png')<s.indexOf('<g data-n='));
// a positive Z-Index: over everything
var tz=fs.readFileSync(Z+'HIDmap_v14/overview.xml','utf8').replace('Glyph:glyphs/overview.png','Glyph:glyphs/overview.png\nZ-Index: 3');
s=cd.render(tz,{DOMParser:DP,groups:true,glyph:function(){return 'data:z';}});
ok('a positive Z-Index: the picture over everything, never picked by the pointer',s.lastIndexOf('<image href="data:z"')>s.lastIndexOf('<g data-n=')&&/data:z"[^>]*pointer-events="none"/.test(s));
// a hidden layer's text with no notes: skipped, as before
var tn=fs.readFileSync(Z+'asthma_map_bg/map.xml','utf8').replace(/<celldesigner:layerNotes>[\s\S]*?<\/celldesigner:layerNotes>/,'');
var thrown=null;try{cd.render(tn,{DOMParser:DP,glyph:function(){return 'data:z';}});}catch(x){thrown=x.message;}
ok('a hidden layer\'s text with no notes: skipped, no error',!thrown,thrown||'');
// AD/UC: compartments and 3 species
r=draw(Z+'AD_UC_comparison','AD_UC_comparison.xml');s=r.svg;
var n=(s.match(/<image /g)||[]).length-(s.match(/<symbol /g)||[]).length+(s.match(/<use /g)||[]).length;   // a node's image: its own <image>, or a <use> of one kept once
ok('AD/UC: compartments and the titles and logo drawn as pictures',n>=24&&/butad.png/.test(s)&&/butuc.png/.test(s)&&/z4.png/.test(s),n+' pictures');
ok('AD/UC: no title name drawn',!/>ATOPIC DERMATITIS</.test(s)&&!/>LOGO</.test(s));
// an image used by several nodes kept once: each address once in the drawing, every node a <use> of it
var hs=(s.match(/href="data:[^"]*"/g)||[]),uq=hs.filter(function(h,i){return hs.indexOf(h)===i;});
ok('AD/UC: every image\'s data once in the drawing, the nodes sharing one drawn by <use>',hs.length===uq.length&&/<use href="#m2img-/.test(s),hs.length+' addresses, '+uq.length+' different, '+(s.match(/<use /g)||[]).length+' uses');
// 200 nodes with one image: the drawing one image larger, not 200
var big='data:image/png;base64,'+'A'.repeat(30000),tt=fs.readFileSync(Z+'AD_UC_comparison/AD_UC_comparison.xml','utf8');
var sp=(tt.match(/<celldesigner:speciesAlias id="[^"]+"/g)||[]).length;
var t200=tt.replace(/<species [^>]*>/g,function(m){return m;}).replace(/(<species [^>]*>\s*)(?!<notes>)/g,'$1<notes><html xmlns="http://www.w3.org/1999/xhtml"><head><title/></head><body>Glyph: glyphs/same.png</body></html></notes>');
var s0=cd.render(t200,{DOMParser:DP,groups:true,glyph:function(){return null;}}),s1=cd.render(t200,{DOMParser:DP,groups:true,glyph:function(p){return p==='glyphs/same.png'?big:null;}});
var uses=(s1.match(/<use [^>]*href="#m2img-[^"]*"/g)||[]).length,copies=s1.split(big).length-1;
ok('many nodes with one image: its data once, the drawing about one image larger',uses>=50&&copies===1&&s1.length-s0.length<2*big.length,uses+' nodes use it, '+copies+' copy, '+Math.round((s1.length-s0.length)/1024)+' KB larger for a '+Math.round(big.length/1024)+' KB image');
// without glyph: as before (no image)
var t=fs.readFileSync(Z+'asthma_map_bg/map.xml','utf8');s=cd.render(t,{DOMParser:DP});
ok('AsthmaMap top without pictures: none drawn, names drawn, the hidden layer\'s text not drawn',!/<image/.test(s)&&/>pathway 1</.test(s)&&!/Asthma map Cellular/.test(s));
// a picture named but not kept: drawn as before
s=cd.render(t,{DOMParser:DP,glyph:function(p){return p==='glyphs/button01.png'?null:'data:x';}});
ok('a button whose picture is missing drawn as a species with its name',/>pathway 1</.test(s)&&!/>pathway 2</.test(s));
// one(): a species alone
var A=(t.match(/<celldesigner:speciesAlias id="([^"]+)"[^>]*species="s1"/)||[])[1];
var o=cd.one(t,A,{DOMParser:DP,glyph:function(){return 'data:y';}});
ok('one species drawn alone as its picture (the editor\'s drawing of one)',o&&o.out.join('').indexOf('<image href="data:y"')>0,A);
// every map of the three zips drawn without error
var all=0,err=0;['AD_UC_comparison','HIDmap_v14','asthma_map_bg'].forEach(function(z){(function walk(d){fs.readdirSync(d,{withFileTypes:true}).forEach(function(e){var p=path.join(d,e.name);if(e.isDirectory())return walk(p);if(!/\.xml$/.test(e.name)||/mapping/.test(e.name))return;all++;try{draw(Z+z,path.relative(Z+z,p));}catch(x){err++;console.log(p,x.message);}});})(Z+z);});
ok('every map of the three zips drawn',err===0,all+' maps');
fs.rmSync(Z,{recursive:true,force:true});
console.log(bad?bad+' WRONG':'all ok');process.exit(bad?1:0);
