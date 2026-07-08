// Dicelore 前端 · 共享行为（墨金）· acceptance-loop 第一步·前端
// lucide + 明暗 + 强调色 + 子页切换(data-nav) + modal + hash 单状态(#s) + 深链(#v) + 基础控件职能。
const ACC = {
  gold:['#d4a83e','#e6bd5a','#ecd28c','#13261d'], copper:['#c47a3e','#d6925a','#e6b189','#1c1209'],
  teal:['#3aa896','#57c4b1','#8ad9cb','#06231f'], crimson:['#b4453a','#cd6256','#e08b80','#fff'],
  indigo:['#6f74e8','#8a8ef0','#b3b6f6','#fff'],
};
function setAcc(k){const m=ACC[k];if(!m)return;const r=document.documentElement.style,lt=document.body.classList.contains('light');r.setProperty('--acc',m[0]);r.setProperty('--acc-h',m[1]);r.setProperty('--acc-soft',lt?m[0]:m[2]);r.setProperty('--acc-on',m[3]);}
function hashVal(key){const m=location.hash.match(new RegExp(key+'=([\\w-]+)'));return m?m[1]:null;}

function initTabs(){
  document.querySelectorAll('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.getAttribute('data-nav'),g=btn.getAttribute('data-navgroup')||'';
    document.querySelectorAll(`[data-nav]${g?`[data-navgroup="${g}"]`:''}`).forEach(b=>b.classList.toggle('on',b===btn));
    document.querySelectorAll(`[data-view]${g?`[data-viewgroup="${g}"]`:''}`).forEach(v=>v.hidden=v.getAttribute('data-view')!==key);
  }));
}
function initModals(){
  document.querySelectorAll('[data-modal-open]').forEach(t=>t.addEventListener('click',()=>{const m=document.getElementById(t.getAttribute('data-modal-open'));if(m)m.hidden=false;}));
  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-modal-close]'))m.hidden=true;}));
}
function applyScreen(){
  const s=hashVal('s')||document.body.getAttribute('data-screen-default');
  if(!s)return;
  document.querySelectorAll('[data-screen]').forEach(el=>el.hidden=!el.getAttribute('data-screen').split(/\s+/).includes(s));
  document.querySelectorAll('[data-screen-label]').forEach(l=>l.textContent=s);
}
function applyDeepView(){const v=hashVal('v');if(v){const b=document.querySelector(`[data-nav="${v}"]`);if(b)b.click();}}
// 控件职能：会话切换（点顶栏会话高亮）
function initControls(){
  document.querySelectorAll('.sessionbar').forEach(bar=>bar.querySelectorAll('.sess:not(.new)').forEach(s=>s.addEventListener('click',()=>{
    bar.querySelectorAll('.sess').forEach(x=>x.classList.remove('on'));s.classList.add('on');
  })));
}
// 全局 bay：仿 mac 聚焦出现 + popover 开关 + 显隐模式（focus/always/hidden）+ hash 驱动
function initBay(){
  const btns=document.querySelectorAll('[data-bay]');
  if(!btns.length)return;
  // 显隐模式：localStorage（配置页写）+ hash #baybar=show 强制常驻（供 harness 审核）
  const mode=localStorage.getItem('bay-mode')||'focus';
  if(mode==='always'||/baybar=show/.test(location.hash))document.body.classList.add('bay-always');
  if(mode==='hidden'&&!/baybar=show/.test(location.hash))document.body.classList.add('bay-hidden');
  const keys=[...new Set([...btns].map(b=>b.getAttribute('data-bay')))];
  const closeAll=()=>keys.forEach(k=>{const p=document.getElementById('bay-'+k),b=document.querySelector(`[data-bay="${k}"]`);if(p)p.hidden=true;if(b)b.classList.remove('on');});
  keys.forEach(k=>{
    const btn=document.querySelector(`[data-bay="${k}"]`),pop=document.getElementById('bay-'+k);
    if(!btn||!pop)return;
    btn.addEventListener('click',e=>{e.stopPropagation();if(k==='nav'){document.body.classList.remove('bay-nav-collapsed');return;}const open=!pop.hidden;closeAll();if(!open){pop.hidden=false;btn.classList.add('on');}});
    pop.addEventListener('click',ev=>{if(ev.target===pop||ev.target.closest('[data-bay-close]')){pop.hidden=true;btn.classList.remove('on');}});
  });
  const applyBayHash=()=>{const m=location.hash.match(/bay=(\w+)/);closeAll();if(m){const pop=document.getElementById('bay-'+m[1]),btn=document.querySelector(`[data-bay="${m[1]}"]`);if(pop)pop.hidden=false;if(btn)btn.classList.add('on');}};
  applyBayHash();
  window.addEventListener('hashchange',applyBayHash);
  // bay 导航：当前页 tab 高亮 + 展开/收起切换（默认跑团页收起、其他页展开）
  const here=location.pathname.split('/').pop()||'home.html';
  document.querySelectorAll('.bay-tab').forEach(t=>{if(t.getAttribute('href')===here)t.classList.add('on');});
  if(here==='play.html')document.body.classList.add('bay-nav-collapsed');
  const colBtn=document.querySelector('.bay-nav-collapse');
  if(colBtn)colBtn.addEventListener('click',()=>document.body.classList.add('bay-nav-collapsed'));
  document.querySelectorAll('.bay-nav-expand').forEach(b=>b.addEventListener('click',()=>{document.body.classList.remove('bay-nav-collapsed');const p=document.getElementById('bay-nav'),ob=document.querySelector('[data-bay="nav"]');if(p)p.hidden=true;if(ob)ob.classList.remove('on');}));
}
function initShell(){
  const tb=document.querySelector('[data-testid="shell-theme"]');
  if(tb)tb.addEventListener('click',()=>{document.body.classList.toggle('light');const lt=document.body.classList.contains('light');tb.innerHTML=lt?'<i data-lucide="sun"></i>':'<i data-lucide="moon"></i>';const on=document.querySelector('.sw.on');if(on)setAcc(on.dataset.acc);if(window.lucide)lucide.createIcons();});
  document.querySelectorAll('.sw').forEach(s=>s.addEventListener('click',()=>{document.querySelectorAll('.sw').forEach(x=>x.classList.remove('on'));s.classList.add('on');setAcc(s.dataset.acc);}));
  initTabs();initModals();initControls();initBay();applyScreen();applyDeepView();
  window.addEventListener('hashchange',()=>{applyScreen();applyDeepView();});
  if(window.lucide)lucide.createIcons();
}
window.addEventListener('load',initShell);
