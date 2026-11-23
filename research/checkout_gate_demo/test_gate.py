import unittest,time
from app import app,orders,verify_fixture
class Gate(unittest.TestCase):
 def setUp(self):
  self.c=app.test_client();self.k=self.c.post('/orders').json['id'];self.c.post('/orders/'+self.k+'/lock');self.r=dict(account_id='demo-merchant',amount='100.01',timestamp=time.time(),direction='CREDIT',status='SUCCESS',reference=self.k)
 def test_correct(self):self.assertEqual(verify_fixture(self.k,[self.r]),'demo_verified')
 def test_wrong(self):self.assertEqual(verify_fixture(self.k,[dict(self.r,amount='1')]),'locked')
 def test_empty(self):self.assertEqual(verify_fixture(self.k,[]),'locked')
 def test_client_cannot_verify(self):self.assertEqual(self.c.post('/orders/'+self.k,json={'state':'demo_verified'}).status_code,405)
 def test_expired(self):
  orders[self.k]['created_at']-=91;self.assertEqual(verify_fixture(self.k,[self.r]),'locked')
if __name__=='__main__':unittest.main()
