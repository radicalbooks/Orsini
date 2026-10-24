/* Shared UI only. Editorial content remains in Pages CMS. */
document.documentElement.classList.add('js');
const menu=document.querySelector('.menubtn'),navigation=document.getElementById('navegacio');
if(menu&&navigation){menu.hidden=false;const close=()=>{navigation.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='Menú'};menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';navigation.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'Tanca':'Menú'});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){close();menu.focus()}})}
const route=location.pathname.split('/').pop()||'index.html';
document.querySelectorAll('.navlinks a').forEach(a=>{if(a.getAttribute('href')===route)a.setAttribute('aria-current','page')});
