'use strict';
const btn=document.getElementById('copyCode');
const code=document.getElementById('claim');
btn?.addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(code.textContent);btn.textContent='Copied';}
 catch(e){btn.textContent='Select and copy the code above';}
});
