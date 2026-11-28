import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import About from './pages/About';
import WhyDisha from './pages/WhyDisha';
import HowItWorks from './pages/HowItWorks';
import PaymentSafety from './pages/PaymentSafety';
import Checkout from './pages/Checkout';
import Receipt from './pages/Receipt';
import MerchantPortal from './pages/MerchantPortal';
import AgentPortal from './pages/AgentPortal';
import OwnerDashboard from './pages/OwnerDashboard';
import CompareAndSave from './pages/CompareAndSave';
import Contact from './pages/Contact';
import Navbar from './components/navigation/Navbar';
import Footer from './components/layout/Footer';

function App() {
  return (
    <BrowserRouter>
      <div className="disha-body">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/why-disha" element={<WhyDisha />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/payment-safety" element={<PaymentSafety />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/:orderId" element={<Checkout />} />
          <Route path="/receipt/:orderId" element={<Receipt />} />
          <Route path="/receipt" element={<Receipt />} />
          <Route path="/merchant-portal" element={<MerchantPortal />} />
          <Route path="/agent-portal" element={<AgentPortal />} />
          <Route path="/owner-dashboard" element={<OwnerDashboard />} />
          <Route path="/compare-and-save" element={<CompareAndSave />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
