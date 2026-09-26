const P=require('../src/Parser.js');const recs=require('./data/september-2026.json');
let ok=0,bad=[],warn=0;
for(const r of recs){
  const p=P.parseViolationText(r.fab); // без хвоста с категорией
  const exp=r.type.replace(/\\\\/g,'\\');
  const got=p.violation;
  if(got && got.replace(/\s/g,'')===exp.replace(/\s/g,'').replace('дісципліни','дісципліни')) ok++; else bad.push([exp,got,r.fab.slice(0,160)]);
  if(p.warnings.length) warn++;
  if(!/^\d{3}$/.test(p.ttNumber)||!p.employeeName||!p.date) console.log('HEAD?',p.ttNumber,p.employeeName,p.date);
}
console.log('верно',ok,'из',recs.length,'с предупреждениями',warn);
bad.forEach(b=>console.log('\nОЖИД:',b[0],'\nПОЛУЧ:',b[1],'\n',b[2]));
// с хвостом
let ok2=0;for(const r of recs){const p=P.parseViolationText(r.full);if(p.typeSource==='manual')ok2++;}
console.log('с хвостом распознано вручную:',ok2);
// нераспознанные 2 без хвоста
