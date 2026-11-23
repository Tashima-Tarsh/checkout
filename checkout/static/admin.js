'use strict';
document.getElementById('inventory').addEventListener('submit',async event=>{
 event.preventDefault();
 const status=document.getElementById('result');
 const file=document.getElementById('file').files[0];
 const token=document.getElementById('token').value;
 const button=event.submitter;
 if(!file||!token)return;
 button.disabled=true;
 status.textContent='Validating inventory...';
 try{
   const form=new FormData();form.append('file',file);
   const response=await fetch('/api/admin/vpas/import',{
     method:'POST',headers:{Authorization:'Bearer '+token},body:form,cache:'no-store'
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.detail||'Import failed');
   status.textContent='Imported '+result.imported+' configured recipients. Payment evidence remains unverified.';
 }catch(error){status.textContent=error.message;}
 finally{button.disabled=false;}
});
