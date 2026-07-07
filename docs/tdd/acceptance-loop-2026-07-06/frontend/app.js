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
function initShell(){
  const tb=document.querySelector('[data-testid="shell-theme"]');
  if(tb)tb.addEventListener('click',()=>{document.body.classList.toggle('light');const lt=document.body.classList.contains('light');tb.innerHTML=lt?'<i data-lucide="sun"></i>':'<i data-lucide="moon"></i>';const on=document.querySelector('.sw.on');if(on)setAcc(on.dataset.acc);if(window.lucide)lucide.createIcons();});
  document.querySelectorAll('.sw').forEach(s=>s.addEventListener('click',()=>{document.querySelectorAll('.sw').forEach(x=>x.classList.remove('on'));s.classList.add('on');setAcc(s.dataset.acc);}));
  initTabs();initModals();initControls();applyScreen();applyDeepView();
  window.addEventListener('hashchange',()=>{applyScreen();applyDeepView();});
  if(window.lucide)lucide.createIcons();
}
window.addEventListener('load',initShell);
