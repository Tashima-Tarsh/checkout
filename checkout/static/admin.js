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

const authHeader=()=>({Authorization:'Bearer '+document.getElementById('token').value});
async function adminJson(url,init={}){
 const response=await fetch(url,{
   ...init,
   cache:'no-store',
   headers:{...authHeader(),...(init.headers||{})}
 });
 const data=await response.json();
 if(!response.ok)throw Error(data.detail||'Request rejected');
 return data;
}
document.getElementById('loadDashboard').addEventListener('click',async()=>{
 const target=document.getElementById('overview');
 try{
   const [data,appearance]=await Promise.all([
     adminJson('/api/admin/overview'),
     adminJson('/api/admin/appearance')
   ]);
   target.textContent='Checkouts: '+data.total_checkouts+
     ' · Active: '+data.active_checkouts+
     ' · Enabled routes: '+data.configured_recipient_routes+
     ' · Recorded callbacks: '+data.recorded_observations+
     ' · Real debits verified: 0';
   document.getElementById('brandName').value=appearance.brand_name;
   document.getElementById('headline').value=appearance.headline;
   document.getElementById('accent').value=appearance.accent;
   document.getElementById('theme').value=appearance.theme;
   document.getElementById('logoLetter').value=appearance.logo_letter;
 }catch(error){target.textContent=error.message;}
});
document.getElementById('appearanceForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const status=document.getElementById('appearanceResult');
 const button=event.submitter;button.disabled=true;
 try{
   const payload={
     brand_name:document.getElementById('brandName').value.trim(),
     headline:document.getElementById('headline').value.trim(),
     accent:document.getElementById('accent').value,
     theme:document.getElementById('theme').value,
     logo_letter:document.getElementById('logoLetter').value
   };
   const data=await adminJson('/api/admin/appearance',{
     method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
   });
   status.textContent='Appearance saved: '+data.brand_name+'. Refresh the checkout page to see the theme.';
 }catch(error){status.textContent=error.message;}
 finally{button.disabled=false;}
});
