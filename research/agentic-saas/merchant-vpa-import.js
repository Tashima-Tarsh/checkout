/* Merchant UPI account CSV parser; browser and Node regression-test compatible. */
(function(root){
  'use strict';
  const VPA=/^[a-z0-9._-]{2,100}@[a-z0-9._-]{2,40}$/i;
  const MAX_ACCOUNTS=1000;
  const MAX_BYTES=512*1024;
  function csvRows(input){
    const rows=[],row=[];
    let cell='',quoted=false,afterQuote=false;
    for(let i=0;i<input.length;i++){
      const c=input[i];
      if(quoted){
        if(c==='"' && input[i+1]==='"'){cell+='"';i++;continue}
        if(c==='"'){quoted=false;afterQuote=true;continue}
        cell+=c;continue;
      }
      if(c==='"'){
        if(cell.trim()!==''||afterQuote)throw Error('Invalid CSV quoting');
        quoted=true;continue;
      }
      if(c===','){row.push(cell.trim());cell='';afterQuote=false;continue}
      if(c==='\r'&&input[i+1]==='\n'){i++}
      if(c==='\r'||c==='\n'){
        row.push(cell.trim());cell='';afterQuote=false;
        if(row.some(value=>value!==''))rows.push(row.slice());
        row.length=0;
        continue;
      }
      if(afterQuote && c!==' ' && c!=='\t')throw Error('Invalid CSV quoting');
      cell+=c;
    }
    if(quoted)throw Error('Invalid CSV: unclosed quotation mark');
    row.push(cell.trim());
    if(row.some(value=>value!==''))rows.push(row);
    return rows;
  }
  function parseVpaCsv(source){
    if(typeof source!=='string'||source.length>MAX_BYTES)throw Error('CSV file must be smaller than 512 KB');
    const rows=csvRows(source.replace(/^\uFEFF/,''));
    if(rows.length<2)throw Error('Upload a CSV containing a header and at least one UPI account');
    const header=rows.shift().map(v=>v.trim().toLowerCase().replace(/[\s-]+/g,'_'));
    const column=key=>header.indexOf(key);
    if(column('upi_id')<0||column('account_holder')<0)throw Error('CSV requires upi_id and account_holder columns');
    if(rows.length>MAX_ACCOUNTS)throw Error('Import at most '+MAX_ACCOUNTS+' UPI accounts at a time');
    const seen=new Set();
    return rows.map((values,index)=>{
      const field=key=>String(values[column(key)]||'').trim();
      const vpaAddress=field('upi_id').toLowerCase();
      const holderName=field('account_holder');
      const bankName=field('bank_name');
      const accountType=(field('account_type')||'PERSONAL').toUpperCase();
      const mcc=field('mcc');
      const registeredMobile=field('registered_mobile');
      const receivingLast4=field('receiving_last4');
      const line=index+2;
      if(!/^[0-9]{10}$/.test(registeredMobile)||!/^\d{4}$/.test(receivingLast4))throw Error('Invalid mobile or receiving suffix on CSV line '+line);
      if(!VPA.test(vpaAddress))throw Error('Invalid UPI ID on CSV line '+line);
      if(holderName.length<2||holderName.length>100)throw Error('Invalid account holder name on CSV line '+line);
      if(bankName.length>100)throw Error('Bank name too long on CSV line '+line);
      if(!['PERSONAL','MERCHANT'].includes(accountType))throw Error('Invalid account type on CSV line '+line);
      if(accountType==='MERCHANT'&&!/^\d{4}$/.test(mcc))throw Error('Merchant MCC must be 4 digits on CSV line '+line);
      if(seen.has(vpaAddress))throw Error('Duplicate UPI ID on CSV line '+line);
      seen.add(vpaAddress);
      return {vpaAddress,holderName,bankName,registeredMobile,receivingLast4,accountType,mcc:accountType==='MERCHANT'?mcc:''};
    });
  }
  const api=Object.freeze({parseVpaCsv,MAX_ACCOUNTS,MAX_BYTES});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AgenticVpaImport=api;
})(typeof window!=='undefined'?window:globalThis);
