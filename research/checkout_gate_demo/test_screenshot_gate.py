"""Screenshot-shaped evidence is deliberately untrusted; no live financial verification."""
import json, subprocess, unittest
from pathlib import Path
from app import app

PARSER=Path(__file__).resolve().parents[1]/'myupi_receipt.mjs'
ROW=dict(directionLabel='Paid to',statusLabel='Payment successful',amount='₹100.01',
 transactionId='000000000001',dateTime='23 Nov 2026, 2:22 am',debitedBank='Example Bank A',
 beneficiaryBank='Example Bank B',beneficiaryLast4='1234',paymentMode='BANK ACCOUNT',upiApp='GOOGLE PAY')

def normalize(row):
 script="import {normalizeMyUpiDisplay} from "+json.dumps(PARSER.as_uri())+"; console.log(JSON.stringify(normalizeMyUpiDisplay(JSON.parse(process.argv[1]))));"
 return json.loads(subprocess.check_output(['node','--input-type=module','-e',script,json.dumps(row)],text=True))

class ScreenshotGate(unittest.TestCase):
 def setUp(self):
  self.client=app.test_client()
  self.key=self.client.post('/orders').json['id']
  self.client.post('/orders/'+self.key+'/lock')
 def assert_locked(self):
  self.assertEqual(self.client.get('/orders/'+self.key).json['state'],'locked')
 def test_observed_format(self):
  r=normalize(ROW)
  self.assertEqual(r['amountMinor'],10001)
  self.assertEqual(r['reference'],'000000000001')
  self.assertFalse(r['financialDebitVerified'])
  self.assertFalse(r['recipientVerified'])
  self.assert_locked()
 def test_invalid_receipt(self):
  self.assertIsNone(normalize(dict(ROW,statusLabel='Payment failed')))
  self.assert_locked()
 def test_forged_verified_flag(self):
  r=normalize(dict(ROW,financialDebitVerified=True,recipientVerified=True))
  self.assertFalse(r['financialDebitVerified'])
  self.assertEqual(self.client.post('/orders/'+self.key,json=r).status_code,405)
  self.assert_locked()
if __name__=='__main__':unittest.main()
