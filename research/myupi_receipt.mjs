// Research only: input is untrusted display data, not an authenticated source.
export function normalizeMyUpiDisplay(row) {
  if (!row || typeof row !== 'object' || row.directionLabel !== 'Paid to' ||
      row.statusLabel !== 'Payment successful') return null;
  const amount = /^₹\s*(\d{1,9})(?:\.(\d{1,2}))?$/.exec(row.amount ?? '');
  if (!amount || !/^\d{12}$/.test(row.transactionId ?? '') ||
      !/^\d{4}$/.test(row.beneficiaryLast4 ?? '') ||
      !['dateTime','debitedBank','beneficiaryBank','paymentMode','upiApp'].every(k =>
        typeof row[k] === 'string' && row[k].trim().length > 0)) return null;
  const amountMinor = Number(amount[1])*100+Number((amount[2]??'').padEnd(2,'0'));
  if (amountMinor <= 0) return null;
  return {amountMinor, reference:row.transactionId, dateTime:row.dateTime,
    debitedBank:row.debitedBank, beneficiaryBank:row.beneficiaryBank,
    beneficiaryLast4:row.beneficiaryLast4, paymentMode:row.paymentMode,
    upiApp:row.upiApp, claimedDirection:'DEBIT', claimedStatus:'SUCCESS',
    financialDebitVerified:false, provenance:'UNTRUSTED_DISPLAY',
    recipientVerified:false};
}
