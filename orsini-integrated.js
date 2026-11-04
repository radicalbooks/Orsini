/* Orsini dins Radical Books · moviment amb sentit i petites ajudes d'interfície. Sense dependències. */
(function(){
 'use strict';
 var d=document,root=d.documentElement;
 var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!reduce&&'IntersectionObserver' in window)root.classList.add('o-motion');

 // Capçalera compacta en desplaçar
 var bar=d.querySelector('.topbar');
 if(bar){var ticking=false;var on=function(){bar.classList.toggle('is-scrolled',window.scrollY>12);ticking=false};
  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(on)}},{passive:true});on()}

 // Revelació progressiva de blocs (no s'aplica a res que ja sigui visible en carregar)
 if(root.classList.contains('o-motion')){
  var sel='main section, main .course-row, main .person-card, main .practical-grid > *, main details, main .key-facts > div, main .next-links a, main .archive-item';
  var nodes=[].slice.call(d.querySelectorAll(sel));
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.05});
  var vh=window.innerHeight;
  nodes.forEach(function(n,i){var r=n.getBoundingClientRect();if(r.top<vh*.9)return;n.setAttribute('data-reveal','');n.style.setProperty('--o-delay',(i%4)*60+'ms');io.observe(n)});
 }

 // Selector d'idioma: conserva l'àncora actual
 d.querySelectorAll('.rb-strip__lang a').forEach(function(a){a.addEventListener('click',function(){if(location.hash)a.href=a.href.split('#')[0]+location.hash;try{sessionStorage.setItem('orsini-lang',a.getAttribute('hreflang'))}catch(e){}})});

 // Consentiment: un sol gestor (Radical Books). Si el diàleg de RB no és present (subdomini de previsualització), enllaça a la política.
 d.querySelectorAll('[data-rb-cookie-open]').forEach(function(b){b.addEventListener('click',function(ev){if(!d.getElementById('rbd-cookie-dialog')){ev.preventDefault();location.href=b.getAttribute('data-cookie-fallback')||'cookies.html'}})});
})();
