import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Fuel, 
  Wallet, 
  BellRing,
  QrCode,
  Scan,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

interface WholesaleOrder {
  id: string;
  shopName: string;
  category: 'Supermarket' | 'Wholesale';
  totalAmount: number;
  discountPercentage: number;
  netAmount: number;
  date: string;
  status: 'Pending Approval' | 'Dispatched';
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Fully Paid';
  paidAmount: number;
}

export default function App() {
  const [role, setRole] = useState<'owner' | 'sales' | 'inventory'>('owner');
  const [activeTab, setActiveTab] = useState<'orders' | 'credits' | 'scanner'>('orders');
  
  const [orders, setOrders] = useState<WholesaleOrder[]>([
    {
      id: 'ORD-001',
      shopName: 'Anuradhapura Super Stores',
      category: 'Supermarket',
      totalAmount: 150000,
      discountPercentage: 26,
      netAmount: 111000,
      date: '2026-03-30',
      status: 'Pending Approval',
      paymentStatus: 'Unpaid',
      paidAmount: 0
    }
  ]);
  
  const [newShop, setNewShop] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [newDiscount, setNewDiscount] = useState('');
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Handle Order Submission
  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop || !newTotal || !newDiscount) return;

    const total = parseFloat(newTotal);
    const disc = parseFloat(newDiscount);
    const net = total - (total * disc) / 100;

    const order: WholesaleOrder = {
      id: `ORD-${Date.now().toString().slice(-4)}`,
      shopName: newShop,
      category: disc >= 25 ? 'Supermarket' : 'Wholesale',
      totalAmount: total,
      discountPercentage: disc,
      netAmount: net,
      date: new Date().toISOString().split('T')[0],
      status: disc >= 25 ? 'Pending Approval' : 'Dispatched',
      paymentStatus: 'Unpaid',
      paidAmount: 0
    };

    setOrders([order, ...orders]);

    // SMS Alert Trigger for Owner (+94781980085) for >= 25% discount
    if (disc >= 25) {
      alert(`🚨 SMS SENT TO OWNER (+94781980085): High Discount Alert! Shop: ${newShop} requested ${disc}% discount. Net Amount: LKR ${net.toLocaleString()}`);
    }

    setNewShop('');
    setNewTotal('');
    setNewDiscount('');
  };

  // Simulate QR Bill Scanning & Status Update
  const updatePaymentStatus = (id: string, status: 'Unpaid' | 'Partially Paid' | 'Fully Paid', amountPaid: number) => {
    setOrders(orders.map(ord => {
      if (ord.id === id) {
        return { ...ord, paymentStatus: status, paidAmount: amountPaid };
      }
      return ord;
    }));
    setScanningId(null);
    alert(`✅ Bill ${id} status updated successfully to: ${status}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto bg-slate-800 border border-slate-700 rounded-2xl p-4 md:p-6 mb-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-amber-400 tracking-wide flex items-center gap-2">
            🟡 GOLDEN DISTRIBUTORS ERP
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Anuradhapura & Mihintale 12-Route Distribution Management System (Freelan Linked)
          </p>
        </div>
        
        {/* Role Switcher */}
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
          <span className="text-xs text-slate-400 px-2 font-medium">Role:</span>
          {(['owner', 'sales', 'inventory'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                role === r 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto flex gap-3 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'orders' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          <Wallet className="w-4 h-4" /> Orders & QR Invoices
        </button>
        <button
          onClick={() => setActiveTab('credits')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'credits' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" /> Credit Bills Manager
        </button>
        <button
          onClick={() => setActiveTab('scanner')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'scanner' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          <Scan className="w-4 h-4" /> QR / Camera Bill Scanner
        </button>
      </div>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Content Area */}
        <div className="md:col-span-2 space-y-6">
          
          {activeTab === 'orders' && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
              <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5" /> Wholesale Orders & QR Invoices (≥25% SMS Alert)
              </h2>

              <form onSubmit={handleAddOrder} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <input
                  type="text"
                  placeholder="Shop Name"
                  value={newShop}
                  onChange={(e) => setNewShop(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                />
                <input
                  type="number"
                  placeholder="Total Amount (LKR)"
                  value={newTotal}
                  onChange={(e) => setNewTotal(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                />
                <input
                  type="number"
                  placeholder="Discount %"
                  value={newDiscount}
                  onChange={(e) => setNewDiscount(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="sm:col-span-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all shadow-md"
                >
                  Create Order & Generate QR Invoice
                </button>
              </form>

              {/* Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="p-3">Order / QR</th>
                      <th className="p-3">Shop Name</th>
                      <th className="p-3">Net Amount</th>
                      <th className="p-3">Payment Status</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-900/30">
                        <td className="p-3 font-mono text-xs text-amber-400 flex items-center gap-1">
                          <QrCode className="w-4 h-4 text-amber-400" /> {ord.id}
                        </td>
                        <td className="p-3 font-medium">{ord.shopName}</td>
                        <td className="p-3 font-semibold">LKR {ord.netAmount.toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            ord.paymentStatus === 'Fully Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                            ord.paymentStatus === 'Partially Paid' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}>
                            {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          <button 
                            onClick={() => alert(`🖨️ Printing Invoice for ${ord.shopName} with QR Code linked to Freelan SFA!`)}
                            className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-xs font-bold text-amber-300"
                          >
                            Print QR Bill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'credits' && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
              <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" /> Morning & Evening Credit Bill Manager
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Track credit bills distributed in the morning and reconciled in the evening. Filtered by Fully Paid, Partially Paid, and Unpaid.
              </p>

              <div className="space-y-3">
                {orders.map(ord => (
                  <div key={ord.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <p className="font-bold text-white text-sm">{ord.shopName} <span className="text-xs text-amber-400 font-mono">({ord.id})</span></p>
                      <p className="text-xs text-slate-400 mt-1">Total Net: LKR {ord.netAmount.toLocaleString()} | Paid: LKR {ord.paidAmount.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                        ord.paymentStatus === 'Fully Paid' ? 'bg-emerald-500/20 text-emerald-400' :
                        ord.paymentStatus === 'Partially Paid' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {ord.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'scanner' && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg text-center py-10">
              <Scan className="w-16 h-16 text-amber-400 mx-auto mb-4 animate-pulse" />
              <h2 className="text-xl font-bold text-amber-400 mb-2">QR Code & Camera Bill Scanner</h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">
                Use your phone camera to scan the printed QR invoice during morning dispatch or evening collection to instantly update bill statuses.
              </p>
              
              <div className="max-w-md mx-auto bg-slate-900 p-4 rounded-xl border border-slate-700 text-left space-y-3">
                <p className="text-xs font-bold text-slate-400">Simulate Scanning a Bill:</p>
                {orders.map(ord => (
                  <div key={ord.id} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg">
                    <span className="text-xs font-mono text-amber-400">{ord.id} - {ord.shopName}</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => updatePaymentStatus(ord.id, 'Fully Paid', ord.netAmount)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2 py-1 rounded font-bold"
                      >
                        Paid
                      </button>
                      <button 
                        onClick={() => updatePaymentStatus(ord.id, 'Partially Paid', ord.netAmount / 2)}
                        className="bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs px-2 py-1 rounded font-bold"
                      >
                        Half
                      </button>
                      <button 
                        onClick={() => updatePaymentStatus(ord.id, 'Unpaid', 0)}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-2 py-1 rounded font-bold"
                      >
                        Unpaid
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Info */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
              <Fuel className="w-5 h-5" /> Operations Info
            </h2>
            <p className="text-sm text-slate-300 mb-4">
              Freelan SFA Link: <span className="text-xs font-mono text-amber-300">freelan.evisionmicroapps.com:60060</span>
            </p>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 mb-4">
              <p className="text-xs text-slate-400">Business Owner</p>
              <p className="text-sm font-bold text-white mt-0.5">Egodagedara Arjunal Nishantha Kumara</p>
              <p className="text-xs text-amber-400 mt-2">SMS Alert Mobile: +94 78 198 0085</p>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 text-center">
            <p className="text-xs text-slate-400">QR & Credit Tracking System</p>
            <p className="text-xs text-emerald-400 font-semibold mt-1">● Ready for Deployment</p>
          </div>
        </div>

      </main>
    </div>
  );
}
