#!/usr/bin/env node
// One configuration generates the app entitlement, share URL, and web association.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'ios/links.json'),'utf8'));
for(const key of ['shareBaseURL','fallbackShareBaseURL','webFallbackURL']) {
  const url=new URL(config[key]);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error(`${key} must be a plain HTTPS URL`);
}
for(const key of ['shareBaseURL','fallbackShareBaseURL'])if(!config.associatedDomains.includes(new URL(config[key]).hostname))throw Error(`${key} domain must be associated`);
if(!/^[A-Z0-9]{10}$/.test(config.developmentTeam)||!/^[-a-zA-Z0-9.]+$/.test(config.bundleIdentifier))throw Error('Invalid Apple app identifier');
for(const host of config.associatedDomains)if(!/^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(host))throw Error('Invalid associated domain');
const out=path.join(root,'ios/.build'),site=path.join(out,'link-site');
fs.mkdirSync(path.join(site,'.well-known'),{recursive:true});
const write=(name,data)=>{const file=path.join(out,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
write('links.yml',JSON.stringify({settings:{base:{ATLAS_WEB_URL:config.shareBaseURL,ATLAS_FALLBACK_SHARE_URL:config.fallbackShareBaseURL,ATLAS_APPLE_TEAM:config.developmentTeam,ATLAS_BUNDLE_IDENTIFIER:config.bundleIdentifier,PRODUCT_BUNDLE_IDENTIFIER:config.bundleIdentifier,DEVELOPMENT_TEAM:config.developmentTeam,CODE_SIGN_ENTITLEMENTS:'$(SRCROOT)/.build/Atlas.entitlements'}}},null,2));
write('Atlas.entitlements',`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.developer.associated-domains</key><array>${config.associatedDomains.map(h=>`<string>applinks:${h}</string>`).join('')}</array></dict></plist>\n`);
const appID=`${config.developmentTeam}.${config.bundleIdentifier}`;
const prefix=new URL(config.shareBaseURL).pathname.replace(/\/$/,'');
const aasa={applinks:{details:[{appIDs:[appID],components:[{'/':prefix,'comment':'Historical atlas links'},{'/':prefix+'/*'}]}]}};
write('link-site/.well-known/apple-app-site-association',JSON.stringify(aasa,null,2));
write('link-site/vercel.json',JSON.stringify({version:2,headers:[{source:'/.well-known/apple-app-site-association',headers:[{key:'Content-Type',value:'application/json'},{key:'Cache-Control',value:'public, max-age=300'}]}],rewrites:[{source:prefix, destination:'/index.html'},{source:prefix+'/:path*',destination:'/index.html'}]},null,2));
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>江山时序 · Open atlas</title><style>body{background:#f4efe3;color:#2b2622;font:18px Georgia,serif;max-width:36rem;margin:12vh auto;padding:24px}a{color:#b5452f;display:block;margin:24px 0}</style><h1>江山时序</h1><p>Open this historical map in the iOS app or continue on the web.</p><a id="app">Open in the iOS app</a><a id="web">Continue on the web</a><script>const query=location.search;document.getElementById('app').href='jiangshan://atlas'+query;const web=new URL(${JSON.stringify(config.webFallbackURL)});web.search=query;web.hash=location.hash;document.getElementById('web').href=web.href;if(location.pathname!== '/')location.replace(web.href);</script></html>`;
write('link-site/index.html',page);
// Inline Vercel file deployments serve these paths directly. Ship a real page at
// every share prefix so app links do not depend on config-file rewrite handling.
for(const pathname of new Set([config.shareBaseURL,config.fallbackShareBaseURL].map(value=>new URL(value).pathname.replace(/^\/+|\/+$/g,'')))) {
  if(pathname)write(`link-site/${pathname}/index.html`,page);
}
console.log('Prepared configurable app links and static Vercel link service.');
