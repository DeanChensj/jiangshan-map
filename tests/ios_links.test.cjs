'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root=path.resolve(__dirname,'..');
const config={shareBaseURL:'https://atlas.example.test/jiangshan-map/',fallbackShareBaseURL:'https://atlas.example.test/jiangshan-map/',webFallbackURL:'https://web.example.test/map/',associatedDomains:['atlas.example.test'],developmentTeam:'ABCDEFGHIJ',bundleIdentifier:'org.example.atlas'};

test('canonical web shares use the official atlas address',()=> {
  const actual=JSON.parse(fs.readFileSync(path.join(root,'ios/links.json'),'utf8'));
  assert.equal(actual.shareBaseURL,'https://deanchen.me/jiangshan-map/');
  assert.equal(actual.fallbackShareBaseURL,actual.shareBaseURL);
  assert.ok(actual.associatedDomains.includes('deanchen.me'));
});

function generate(t,changes={}) {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-links-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  fs.mkdirSync(path.join(temp,'scripts'));fs.mkdirSync(path.join(temp,'ios'));
  fs.copyFileSync(path.join(root,'scripts/prepare_ios_links.js'),path.join(temp,'scripts/prepare_ios_links.js'));
  fs.writeFileSync(path.join(temp,'ios/links.json'),JSON.stringify({...config,...changes}));
  const result=spawnSync(process.execPath,[path.join(temp,'scripts/prepare_ios_links.js')],{encoding:'utf8'});
  return {result,out:path.join(temp,'ios/.build')};
}
test('a configured app identifier reaches Xcode settings and app association',t=> {
  const {result,out}=generate(t);
  assert.equal(result.status,0,result.stderr);
  const settings=JSON.parse(fs.readFileSync(path.join(out,'links.yml'))).settings.base;
  assert.equal(settings.ATLAS_BUNDLE_IDENTIFIER,config.bundleIdentifier);
  assert.equal(settings.DEVELOPMENT_TEAM,config.developmentTeam);
  const aasa=JSON.parse(fs.readFileSync(path.join(out,'link-site/.well-known/apple-app-site-association')));
  assert.deepEqual(aasa.applinks.details[0].appIDs,['ABCDEFGHIJ.org.example.atlas']);
  assert.ok(aasa.applinks.details[0].components.some(c=>c['/']==='/jiangshan-map/*'));
});
test('the shared path has a physical fallback page, including nested prefixes',t=> {
  const {result,out}=generate(t,{shareBaseURL:'https://atlas.example.test/history/atlas/',fallbackShareBaseURL:'https://atlas.example.test/history/atlas/'});
  assert.equal(result.status,0,result.stderr);
  const html=fs.readFileSync(path.join(out,'link-site/history/atlas/index.html'),'utf8');
  assert.match(html,/location\.search/);assert.match(html,/web\.search=query/);
  assert.match(html,/jiangshan:\/\/atlas/);assert.match(html,/https:\/\/web\.example\.test\/map\//);
});
test('unassociated share hosts are rejected',t=> {
  const {result}=generate(t,{shareBaseURL:'https://other.example.test/map/'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/must be associated/);
});
test('insecure or query-bearing base URLs are rejected',t=> {
  for (const shareBaseURL of ['http://atlas.example.test/map/','https://atlas.example.test/map/?year=750']) {
    const {result}=generate(t,{shareBaseURL});
    assert.notEqual(result.status,0);assert.match(result.stderr,/plain HTTPS URL/);
  }
});
