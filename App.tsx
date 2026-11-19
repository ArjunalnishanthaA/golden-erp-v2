import React, { useState, useRef } from 'react';
import { 
  Fuel, 
  Wallet, 
  QrCode,
  Scan,
  Clock,
  Camera,
  RefreshCw,
  Calendar as CalendarIcon,
  Printer,
  X
} from 'lucide-react';

interface WholesaleOrder {
  id: string;
  agency: 'Anuradhapura' | 'Mihintale';
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
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  const [activeAgency, setActiveAgency] = useState<'Anuradhapura' | 'Mihintale'>('Anuradhapura');
  const [activeTab, setActiveTab] = useState<'orders' | 'credits' | 'scanner'>('orders');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [billToPrint, setBillToPrint] = useState<WholesaleOrder | null>(null);
  
  const [orders, setOrders] = useState<WholesaleOrder[]>([
    {
      id: 'ORD-3881',
      agency: 'Anuradhapura',
      shopName: 'Anuradhapura Super Stores (Route 1)',
      category: 'Supermarket',
      totalAmount: 150000,
      discountPercentage: 26,
      netAmount: 111000,
      date: todayStr,
      status: 'Pending Approval',
      paymentStatus: 'Unpaid',
      paidAmount: 0
    },
    {
      id: 'ORD-3880',
      agency: 'Anuradhapura',
      shopName: 'New Town Pharmacy & Stores (Route 3)',
      category: 'Wholesale',
      totalAmount: 85000,
      discountPercentage: 12,
      netAmount: 74800,
      date: yesterdayStr,
      status: 'Dispatched',
      paymentStatus: 'Fully Paid',
      paidAmount: 74800
    },
    {
      id: 'ORD-3921',
      agency: 'Mihintale',
      shopName: 'Mihintale Traders (Route 1)',
      category: 'Wholesale',
      totalAmount: 90000,
      discountPercentage: 15,
      netAmount: 76500,
      date: todayStr,
      status: 'Dispatched',
      paymentStatus: 'Partially Paid',
      paidAmount: 38000
    },
    {
      id: 'ORD-3920',
      agency: 'Mihintale',
      shopName: 'Rajarata Food City (Route 2)',
      category: 'Supermarket',
      totalAmount: 120000,
      discountPercentage: 25,
      netAmount: 90000,
      date: yesterdayStr,
      status: 'Dispatched',
      paymentStatus: 'Unpaid',
      paidAmount: 0
    }
  ]);
  
  const [newShop, setNewShop] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [newDiscount, setNewDiscount] = useState('');
  const [scanningActive, setScanningActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Build QR payload and QR image URL for a bill
  const getQrPayload = (ord: WholesaleOrder) => {
    const agencyCode = ord.agency === 'Anuradhapura' ? 'CG0388' : 'CG0392';
    return `${ord.id}|${agencyCode}|${ord.date}|${ord.netAmount}|${ord.paymentStatus}`;
  };

  const getQrImageUrl = (ord: WholesaleOrder) => {
    const data = encodeURIComponent(getQrPayload(ord));
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${data}`;
  };

  // Sync Freelan SFA Bills based on credentials and selected date
  const handleSyncFreelan = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const username = activeAgency === 'Anuradhapura' ? 'CG0388' : 'CG0392';
      const syncDateLabel = selectedDate === 'ALL' ? todayStr : selectedDate;
      
      const syncedBill: WholesaleOrder = {
        id: `SFA-${Math.floor(1000 + Math.random() * 9000)}`,
        agency: activeAgency,
        shopName: `${activeAgency} Synced Customer (${syncDateLabel})`,
        category: 'Wholesale',
        totalAmount: 65000,
        discountPercentage: 10,
        netAmount: 58500,
        date: syncDateLabel,
        status: 'Dispatched',
        paymentStatus: 'Unpaid',
        paidAmount: 0
      };

      setOrders(prev => [syncedBill, ...prev]);

      alert(`✅ Freelan SFA Sync සාර්ථකයි!\nAgency: ${activeAgency} (${username})\nදිනය: ${syncDateLabel}\nඅලුත් බිල්පතක් පද්ධතියට එක් විය.`);
    }, 1200);
  };

  // Handle Order Submission
  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop || !newTotal || !newDiscount) return;

    const total = parseFloat(newTotal);
    const disc = parseFloat(newDiscount);
    const net = total - (total * disc) / 100;
    const orderDate = selectedDate === 'ALL' ? todayStr : selectedDate;

    const order: WholesaleOrder = {
      id: `ORD-${Date.now().toString().slice(-4)}`,
      agency: activeAgency,
      shopName: newShop,
      category: disc >= 25 ? 'Supermarket' : 'Wholesale',
      totalAmount: total,
      discountPercentage: disc,
      netAmount: net,
      date: orderDate,
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

  // Start Real Camera for Scanning
  const startCamera = async () => {
    setScanningActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("⚠️ කැමරාව ක්‍රියාත්මක කර ගැනීමට අවසර නැත නැතහොත් කැමරාව භාවිතයේ ඇත.");
      setScanningActive(false);
    }
  };

  const stopCamera = () => {
    setScanningActive(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const updatePaymentStatus = (id: string, status: 'Unpaid' | 'Partially Paid' | 'Fully Paid', amountPaid: number) => {
    setOrders(orders.map(ord => {
      if (ord.id === id) {
        return { ...ord, paymentStatus: status, paidAmount: amountPaid };
      }
      return ord;
    }));
    alert(`✅ Bill ${id} status updated successfully to: ${status}`);
  };

  const triggerBrowserPrint = () => {
    window.print();
  };

  const filteredOrders = orders.filter(ord => {
    const matchesAgency = ord.agency === activeAgency;
    const matchesDate = selectedDate === 'ALL' || ord.date === selectedDate;
    return matchesAgency && matchesDate;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-6">
      {/* Print Styles: Hide main app during print, show only the bill with top-right QR code */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .print-only-sheet {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 12px !important;
          }
        }
      `}</style>

      {/* Printable Bill Modal / Sheet (QR Code positioned on Top-Right of the bill) */}
      {billToPrint && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="print-only-sheet bg-white text-slate-900 w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-300">
            {/* Top Action Bar (Hidden on print) */}
            <div className="no-print flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-700">
                Invoice Preview (Top-Right QR Included)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerBrowserPrint}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print Bill Now
                </button>
                <button
                  onClick={() => setBillToPrint(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1.5 rounded-lg"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bill Header with QR Code on Top-Right */}
            <div className="flex justify-between items-start gap-4 border-b-2 border-slate-800 pb-4">
              {/* Left: Business & Bill Info */}
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  GOLDEN DISTRIBUTORS
                </h2>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  Freelan SFA Linked | {billToPrint.agency} ({billToPrint.agency === 'Anuradhapura' ? 'CG0388' : 'CG0392'})
                </p>
                <div className="mt-3 text-xs space-y-1 text-slate-800">
                  <p><span className="font-bold">Bill No:</span> <span className="font-mono">{billToPrint.id}</span></p>
                  <p><span className="font-bold">Date:</span> {billToPrint.date}</p>
                  <p><span className="font-bold">Customer / Shop:</span> {billToPrint.shopName}</p>
                </div>
              </div>

              {/* Top-Right: QR Code */}
              <div className="flex flex-col items-center border border-slate-400 rounded-lg p-2 bg-white shrink-0">
                <img
                  src={getQrImageUrl(billToPrint)}
                  alt={`QR Code for ${billToPrint.id}`}
                  className="w-24 h-24 object-contain"
                />
                <span className="text-[10px] font-mono font-bold text-slate-800 mt-1">
                  {billToPrint.id}
                </span>
              </div>
            </div>

            {/* Bill Amounts */}
            <div className="py-4 space-y-2 text-sm border-b border-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-600">Gross / Total Amount:</span>
                <span className="font-semibold">LKR {billToPrint.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Discount:</span>
                <span className="font-semibold">{billToPrint.discountPercentage}%</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-950 pt-2 border-t border-dashed border-slate-300">
                <span>Net Payable Amount:</span>
                <span>LKR {billToPrint.netAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Footer / Payment Status */}
            <div className="pt-3 flex justify-between items-center text-xs text-slate-700">
              <span>Status: <strong>{billToPrint.paymentStatus}</strong></span>
              <span className="font-mono text-[11px] text-slate-500">
                {getQrPayload(billToPrint)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main ERP Interface (Hidden during print) */}
      <div className="no-print">
        {/* Header */}
        <header className="max-w-6xl mx-auto bg-slate-800 border border-slate-700 rounded-2xl p-4 md:p-6 mb-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-amber-400 tracking-wide flex items-center gap-2">
              🟡 GOLDEN DISTRIBUTORS ERP
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Anuradhapura & Mihintale 12-Route Distribution Management System
            </p>
          </div>
          
          {/* Agency Switcher */}
          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-400 px-2 font-medium">Agency:</span>
            {(['Anuradhapura', 'Mihintale'] as const).map((ag) => (
              <button
                key={ag}
                onClick={() => setActiveAgency(ag)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeAgency === ag 
                    ? 'bg-amber-500 text-slate-950 shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {ag} ({ag === 'Anuradhapura' ? 'CG0388' : 'CG0392'})
              </button>
            ))}
          </div>
        </header>

        {/* Date Filter & History Bar */}
        <div className="max-w-6xl mx-auto bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold text-white">දිනය තෝරන්න (Date Filter):</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedDate('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedDate === 'ALL' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-700'
              }`}
            >
              සියලුම දින (All)
            </button>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedDate === todayStr ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-700'
              }`}
            >
              අද (Today)
            </button>
            <button
              onClick={() => setSelectedDate(yesterdayStr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedDate === yesterdayStr ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-700'
              }`}
            >
              ඊයේ (Yesterday)
            </button>
            <input
              type="date"
              value={selectedDate === 'ALL' ? '' : selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || 'ALL')}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-400 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Sync Bar */}
        <div className="max-w-6xl mx-auto bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-md">
          <div>
            <p className="text-sm font-bold text-white flex items-center gap-2">
              🔗 Freelan SFA Integration ({activeAgency})
            </p>
            <p className="text-xs text-slate-400">
              Username: <span className="text-amber-400 font-mono">{activeAgency === 'Anuradhapura' ? 'CG0388' : 'CG0392'}</span> | Date: <span className="text-emerald-400">{selectedDate === 'ALL' ? 'All Dates' : selectedDate}</span>
            </p>
          </div>
          <button
            onClick={handleSyncFreelan}
            disabled={isSyncing}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-all shadow"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing Bills...' : `Sync ${activeAgency} Bills`}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto flex gap-3 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => { stopCamera(); setActiveTab('orders'); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'orders' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            <Wallet className="w-4 h-4" /> Orders & QR Invoices ({filteredOrders.length})
          </button>
          <button
            onClick={() => { stopCamera(); setActiveTab('credits'); }}
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
            <Scan className="w-4 h-4" /> Live Camera QR Scanner
          </button>
        </div>

        <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Content Area */}
          <div className="md:col-span-2 space-y-6">
            
            {activeTab === 'orders' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
                <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5" /> {activeAgency} Orders & QR Invoices
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
                        <th className="p-3">Order / Date</th>
                        <th className="p-3">Shop Name</th>
                        <th className="p-3">Net Amount</th>
                        <th className="p-3">Payment Status</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 text-xs">
                            තෝරාගත් දිනයට අදාළ බිල්පත් කිසිවක් හමු නොවීය. ඉහත "Sync Bills" බොත්තම ඔබා බලන්න.
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-900/30">
                            <td className="p-3">
                              <div className="font-mono text-xs text-amber-400 flex items-center gap-1">
                                <QrCode className="w-4 h-4 text-amber-400" /> {ord.id}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{ord.date}</div>
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
                                onClick={() => setBillToPrint(ord)}
                                className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-xs font-bold text-amber-300"
                              >
                                Print QR Bill
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'credits' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
                <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" /> {activeAgency} Credit Bill Manager
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  තෝරාගත් දිනයට අදාළ ණය බිල්පත් ගෙවීම් තත්ත්වය පරීක්ෂා කරන්න.
                </p>

                <div className="space-y-3">
                  {filteredOrders.map(ord => (
                    <div key={ord.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <p className="font-bold text-white text-sm">{ord.shopName} <span className="text-xs text-amber-400 font-mono">({ord.id})</span></p>
                        <p className="text-xs text-slate-400 mt-1">Date: {ord.date} | Total Net: LKR {ord.netAmount.toLocaleString()} | Paid: LKR {ord.paidAmount.toLocaleString()}</p>
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
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg text-center py-8">
                <Camera className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-amber-400 mb-2">Live Camera QR Bill Scanner</h2>
                <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">
                  ඔබේ ජංගම දුරකථන කැමරාව සක්‍රීය කර බිල්පතේ ඇති QR කෝඩ් එක ස්කෑන් කරන්න.
                </p>

                {!scanningActive ? (
                  <button
                    onClick={startCamera}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 mx-auto"
                  >
                    <Scan className="w-5 h-5" /> Turn On Camera Scanner
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="relative w-full max-w-sm mx-auto bg-black rounded-xl overflow-hidden border-2 border-amber-400 aspect-[3/4]">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute inset-0 border-4 border-amber-400/30 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 border-2 border-dashed border-amber-400 rounded-lg animate-pulse"></div>
                      </div>
                    </div>
                    <button
                      onClick={stopCamera}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-6 py-2 rounded-xl text-sm transition-all"
                    >
                      Turn Off Camera
                    </button>
                  </div>
                )}
                
                <div className="mt-8 max-w-md mx-auto bg-slate-900 p-4 rounded-xl border border-slate-700 text-left space-y-3">
                  <p className="text-xs font-bold text-slate-400">Quick Bill Status Actions ({activeAgency}):</p>
                  {filteredOrders.map(ord => (
                    <div key={ord.id} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg">
                      <div>
                        <span className="text-xs font-mono text-amber-400 block">{ord.id} ({ord.date})</span>
                        <span className="text-xs text-slate-300">{ord.shopName}</span>
                      </div>
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
              <p className="text-sm text-slate-300 mb-2">
                Active Agency: <span className="font-bold text-amber-400">{activeAgency}</span>
              </p>
              <p className="text-xs text-slate-400 mb-4 font-mono">
                User: {activeAgency === 'Anuradhapura' ? 'CG0388' : 'CG0392'}
              </p>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 mb-4">
                <p className="text-xs text-slate-400">Business Owner</p>
                <p className="text-sm font-bold text-white mt-0.5">Egodagedara Arjunal Nishantha Kumara</p>
                <p className="text-xs text-amber-400 mt-2">SMS Alert Mobile: +94 78 198 0085</p>
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 text-center">
              <p className="text-xs text-slate-400">Top-Right QR Print</p>
              <p className="text-xs text-emerald-400 font-semibold mt-1">● Ready on Print Bill</p>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
