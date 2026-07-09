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
// RT-FE14 上下文占用 danger 态（>80% 变红·裁决 C3 阈值可视化·harness 审核 #ctx=danger）
function applyCtx(){const ctx=hashVal('ctx');const bar=document.querySelector('[data-testid="play-context-usage"]');if(!bar)return;if(ctx==='danger'){bar.classList.add('danger');const f=bar.querySelector('.ctx-fill'),p=bar.querySelector('.ctx-pct'),h=bar.querySelector('.ctx-hint');if(f)f.style.width='92%';if(p)p.textContent='92%';if(h)h.hidden=false;}}
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
  initTabs();initModals();initControls();initBay();applyScreen();applyDeepView();applyCtx();
  initDataJumps();initSessRows();initPersist();
  window.addEventListener('hashchange',()=>{applyScreen();applyDeepView();applyCtx();});
  if(window.lucide)lucide.createIcons();
}
// === 共享基础设施（finding 修复 · 2026-07-09）===
// 持久化反馈 toast（原型·模拟「改完存没存」反馈，补全「全页无持久化反馈」通病）
function ensureToast(){let c=document.querySelector('.toast-wrap');if(!c){c=document.createElement('div');c.className='toast-wrap';document.body.appendChild(c);}return c;}
function toast(msg,kind){const c=ensureToast();const t=document.createElement('div');t.className='toast'+(kind?' '+kind:'');t.textContent=msg;c.appendChild(t);requestAnimationFrame(()=>t.classList.add('in'));setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300);},2200);}
// data-jump 定位：校验项点击 → 切到对应内容类型 nav + flash 高亮目标卡（补 build 校验 data-jump 未接线）
function initDataJumps(){
  document.querySelectorAll('[data-jump]').forEach(it=>{
    if(it.dataset.jumpBound)return;it.dataset.jumpBound='1';
    it.addEventListener('click',()=>{
      const key=it.getAttribute('data-jump');
      const nav=document.querySelector(`[data-nav="${key}"]`);
      if(!nav)return;nav.click();
      const view=document.querySelector(`[data-view="${key}"]`);
      if(view){const card=view.querySelector('.card');if(card){card.classList.add('flash');setTimeout(()=>card.classList.remove('flash'),1300);}}
      toast('已定位到「'+nav.textContent.trim()+'」','ok');
      const pop=it.closest('.popover');if(pop)pop.hidden=true;
    });
  });
}
// 通用 sess-row 切换：toggle on + 派发 sesschange（页面刷新 ctxbar/编辑器 · 补切会话不刷新）
function initSessRows(){
  document.querySelectorAll('.sess-row[data-sess]').forEach(s=>{
    if(s.dataset.sessBound)return;s.dataset.sessBound='1';
    s.addEventListener('click',()=>{
      const pop=s.closest('.popover');if(!pop)return;
      pop.querySelectorAll('.sess-row').forEach(x=>x.classList.remove('on'));s.classList.add('on');
      const st=s.querySelector('.st');const name=st?st.cloneNode(true).textContent.trim():'';
      const cn=document.querySelector('[data-testid="build-ctxbar"] .name');if(cn)cn.textContent=name;
      const badge=document.querySelector('[data-testid="build-ctxbar"] .badge');if(badge){const ss=s.querySelector('.sess-status');badge.textContent=ss?ss.textContent.trim():'';}
      document.dispatchEvent(new CustomEvent('dicelore:sesschange',{detail:{name}}));
      toast('已切到会话：'+name);
    });
  });
}
// 持久化反馈：[data-persist] 控件变化 → toast「已保存」
function initPersist(){
  document.querySelectorAll('[data-persist]').forEach(el=>{
    if(el.dataset.persistBound)return;el.dataset.persistBound='1';
    const ev=(el.tagName==='SELECT'||el.tagName==='INPUT'||el.tagName==='TEXTAREA')?'change':'click';
    el.addEventListener(ev,()=>toast(el.getAttribute('data-persist-msg')||'已保存到本地','ok'));
  });
}
window.addEventListener('load',initShell);
