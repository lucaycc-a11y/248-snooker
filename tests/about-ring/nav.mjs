import { webkit, chromium } from "playwright";
for (const [e,w,h] of [["chromium",1440,900],["webkit",1194,834],["webkit",390,844]]) {
  const b = await (e==="webkit"?webkit:chromium).launch(); const p = await b.newPage({viewport:{width:w,height:h}});
  await p.goto("http://localhost:3011/about",{waitUntil:"networkidle"});
  const r = async()=>p.evaluate(()=>{const n=document.querySelector('.nav-bar');const kids=[...n.querySelectorAll('*')].map(k=>k.getBoundingClientRect()).filter(r=>r.height>0);return {bar:n.getBoundingClientRect().bottom, maxKid:Math.max(...kids.map(k=>k.bottom))}});
  const a = await r(); await p.evaluate(()=>scrollTo(0,500)); await p.waitForTimeout(600); console.log(e,w,h,a, await r()); await b.close();
}
