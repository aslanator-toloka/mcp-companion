/* Independent UI preference: collection, rosters and match state are unaffected. */
(function(){
 'use strict';
 const key='mcp-companion-sidebar-collapsed-v1';
 const button=document.getElementById('sidebar-toggle'),sidebar=document.getElementById('app-sidebar');
 if(!button||!sidebar)return;
 function apply(collapsed){
  sidebar.hidden=collapsed;
  document.documentElement.classList.toggle('sidebar-is-collapsed',collapsed);
  button.setAttribute('aria-expanded',String(!collapsed));
  const label=collapsed?'Развернуть меню':'Свернуть меню';
  button.setAttribute('aria-label',label);button.title=label;
 }
 let collapsed=false;try{collapsed=localStorage.getItem(key)==='1';}catch{}
 apply(collapsed);
 button.addEventListener('click',()=>{
  const next=button.getAttribute('aria-expanded')==='true';apply(next);
  try{localStorage.setItem(key,next?'1':'0');}catch{}
 });
})();
