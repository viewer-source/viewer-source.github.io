// Change identity of an SBGN-ML entity (sbgn_edit.entityKind): a macromolecule and a macromolecule multimer of a demo map
// made a simple chemical, an unspecified entity, a nucleic acid feature and a macromolecule again; each written into the
// file (write), the class as asked (a multimer kept where the class has one), the file stable (write(s2, conv(s2)) is s2),
// a draft reopened drawn as the build will draw it; there and back leaves the file unchanged.
//   node tests/sbgn-identity.js [SBGN-ML file]   (default: the demo's glycogen muscle SBGN-ML in the site's data, its
//   folder in SITE_DATA, else the clone beside this repository named in release/site-data.txt)
var fs=require('fs'),cp=require('child_process'),path=require('path');
var here=path.join(__dirname,'..'), se=require(here+'/renderers/converter/sbgn_edit.js'), DP=require('@xmldom/xmldom').DOMParser, opt={DOMParser:DP};
var tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'sbgn-identity-'));
function conv(t){var f=path.join(tmp,'x.sbgn');fs.writeFileSync(f,t);return cp.execFileSync('python3',['-c','import sys,contextlib,io\nfrom mapconv import sbgnml,graphml\nwith contextlib.redirect_stdout(io.StringIO()): m=sbgnml.read(sys.argv[1])\nprint(graphml.write(m),end="")',f],{env:Object.assign({},process.env,{PYTHONPATH:here+'/renderers/converter'}),maxBuffer:1e8}).toString();}
var s=fs.readFileSync(process.argv[2]||path.join(process.env.SITE_DATA||path.join(here,'../..',require('fs').readFileSync(path.join(here,'../release/site-data.txt'),'utf8').match(/private ([\w-]+\/)?([\w.-]+)/)[2]),'examples/maps/extra/glycogen-muscle-graphml/glycogen-muscle-graphml.sbgn'),'utf8'), g=conv(s), bad=0;
var ids=[], re=/<glyph class="(macromolecule(?: multimer)?)" id="([^"]+)"/g, m; while((m=re.exec(s))) if(!ids.some(function(x){return x[1]===m[1];})) ids.push([m[2],m[1]]);
ids.forEach(function(q){
  ['simple chemical','unspecified entity','nucleic acid feature','macromolecule'].forEach(function(c){
    var g2=se.entityKind(g,q[0],c,opt), s2=se.write(s,g2,opt), cls=(s2.match(new RegExp('<glyph class="([^"]+)" id="'+q[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"'))||[])[1];
    var want=c+((/multimer/.test(q[1])&&c!=='unspecified entity')?' multimer':'');
    var stable=se.write(s2,conv(s2),opt)===s2, back=se.graphml(s2,g,opt), sameDraw=require(here+'/renderers/yrender/yrender.js').render(back,{sbgn:true,DOMParser:DP}).svg===require(here+'/renderers/yrender/yrender.js').render(conv(s2),{sbgn:true,DOMParser:DP}).svg;
    var ok=cls===want&&stable; if(!ok)bad++;
    console.log((ok?'ok    ':'WRONG ')+q[0]+' '+q[1]+' -> '+c+': class '+cls+', stable '+stable+', draft drawn as the build '+sameDraw);
  });
});
var u=se.entityKind(se.entityKind(g,ids[0][0],'simple chemical',opt),ids[0][0],ids[0][1].replace(/ multimer$/,''),opt);
console.log('there and back: file '+(se.write(s,u,opt)===s?'unchanged':'CHANGED'));
console.log(bad?bad+' wrong':'all ok'); process.exit(bad?1:0);
