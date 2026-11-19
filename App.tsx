import React, { useState, useRef, useEffect } from 'react';
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
  X,
  RotateCcw,
  FileUp,
  FileText
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

interface UploadedBillItem {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  dataUrl: string;
  invoiceNo: string;
  shopName: string;
  amount: string;
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Fully Paid';
}

const STORAGE_KEY = 'golden_distributors_erp_orders_v1';

const getLocalDateString = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function App() {
  const todayStr = getLocalDateString(0);
  const yesterdayStr = getLocalDateString(-1);

  const getDefaultOrders = (): WholesaleOrder[] => [
    {
      id: 'CG0392DSI034516',
      agency: 'Mihintale',
      shopName: 'Saliyapura Farm Shop - R187-000143',
      category: 'Wholesale',
      totalAmount: 3625,
      discountPercentage: 0,
      netAmount: 3625,
      date: todayStr,
      status: 'Dispatched',
      paymentStatus: 'Unpaid',
      paidAmount: 0
    },
    {
      id: 'CG0392DSI034515',
      agency: 'Mihintale',
      shopName: 'Govijana Stores - CUS25722',
      category: 'Wholesale',
      totalAmount: 1924.75,
      discountPercentage: 0,
      netAmount: 1924.75,
      date: yesterdayStr,
      status: 'Dispatched',
      paymentStatus: 'Partially Paid',
      paidAmount: 1000
    },
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
    }
  ];

  const [activeAgency, setActiveAgency] = useState<'Anuradhapura' | 'Mihintale'>('Mihintale');
  const [activeTab, setActiveTab] = useState<'pdf' | 'orders' | 'credits' | 'scanner'>('pdf');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [billToPrint, setBillToPrint] = useState<WholesaleOrder | null>(null);

  // Uploaded PDF / Bill Items
  const [uploadedBills, setUploadedBills] = useState<UploadedBillItem[]>([]);
  const [billToPrintModal, setBillToPrintModal] = useState<UploadedBillItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [orders, setOrders] = useState<WholesaleOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to load orders from localStorage:', err);
    }
    return getDefaultOrders();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (err) {
      console.error('Failed to save orders to localStorage:', err);
    }
  }, [orders]);

  const [newShop, setNewShop] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [newDiscount, setNewDiscount] = useState('');
  const [scanningActive, setScanningActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const getQrPayloadFromValues = (
    invoiceNo: string,
    agency: 'Anuradhapura' | 'Mihintale',
    dateStr: string,
    amount: string | number,
    status: string
  ) => {
    const agencyCode = agency === 'Anuradhapura' ? 'CG0388' : 'CG0392';
    return `${invoiceNo}|${agencyCode}|${dateStr}|${amount}|${status}`;
  };

  const getQrImageUrlFromPayload = (payload: string, size = 160) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=4&data=${encodeURIComponent(payload)}`;
  };

  const getQrPayload = (ord: WholesaleOrder) => {
    return getQrPayloadFromValues(ord.id, ord.agency, ord.date, ord.netAmount, ord.paymentStatus);
  };

  const getQrImageUrl = (ord: WholesaleOrder) => {
    return getQrImageUrlFromPayload(getQrPayload(ord), 160);
  };

  // Upload 1 or multiple PDF / Image bills from phone or computer
  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) return;

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const cleanedName = file.name.replace(/\.[^/.]+$/, '');
        const matchInvoice = cleanedName.match(/CG\d{4}[A-Z0-9]+/i);

        const newItem: UploadedBillItem = {
          id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          fileType: isPdf ? 'pdf' : 'image',
          dataUrl: result,
          invoiceNo: matchInvoice ? matchInvoice[0].toUpperCase() : cleanedName || `BILL-${idx + 1}`,
          shopName: '',
          amount: '',
          paymentStatus: 'Unpaid'
        };

        setUploadedBills(prev => [newItem, ...prev]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const updateUploadedBillField = (
    id: string,
    field: 'invoiceNo' | 'shopName' | 'amount' | 'paymentStatus',
    value: string
  ) => {
    setUploadedBills(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const saveUploadedBillToOrders = (item: UploadedBillItem) => {
    const parsedAmount = parseFloat(item.amount) || 0;
    const newOrd: WholesaleOrder = {
      id: item.invoiceNo.trim() || `INV-${Date.now().toString().slice(-4)}`,
      agency: activeAgency,
      shopName: item.shopName.trim() || item.fileName,
      category: 'Wholesale',
      totalAmount: parsedAmount,
      discountPercentage: 0,
      netAmount: parsedAmount,
      date: selectedDate === 'ALL' ? todayStr : selectedDate,
      status: 'Dispatched',
      paymentStatus: item.paymentStatus,
      paidAmount: item.paymentStatus === 'Fully Paid' ? parsedAmount : 0
    };

    setOrders(prev => [newOrd, ...prev]);
    alert(`✅ ${newOrd.id} බිල Orders & Credit Bills ලැයිස්තුවට එක් කරන ලදී.`);
  };

  const handleSyncFreelan = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const username = activeAgency === 'Anuradhapura' ? 'CG0388' : 'CG0392';
      const syncDateLabel = selectedDate === 'ALL' ? todayStr : selectedDate;
      alert(`✅ Freelan SFA Sync තත්ත්වය:\nAgency: ${activeAgency} (${username})\nදිනය: ${syncDateLabel}\nPDF / Bill files Upload කර Top-Right QR සමඟ Print කිරීමට "Upload SFA Bill / PDF" කොටස භාවිත කරන්න.`);
    }, 600);
  };

  const handleResetSampleData = () => {
    const fresh = getDefaultOrders();
    setOrders(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    alert('🔄 මූලික බිල් ලැයිස්තුව නැවත සකස් කරන ලදී.');
  };

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

    setOrders(prev => [order, ...prev]);

    if (disc >= 25) {
      alert(`🚨 SMS SENT TO OWNER (+94781980085): High Discount Alert! Shop: ${newShop} requested ${disc}% discount. Net Amount: LKR ${net.toLocaleString()}`);
    }

    setNewShop('');
    setNewTotal('');
    setNewDiscount('');
  };

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
    setOrders(prev => prev.map(ord => {
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

  const activeDateForQr = selectedDate === 'ALL' ? todayStr : selectedDate;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-6">
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
            padding: 8px !important;
          }
        }
      `}</style>

      {/* Order Print Modal */}
      {billToPrint && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="print-only-sheet bg-white text-slate-900 w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-300">
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
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-start gap-4 border-b-2 border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  GOLDEN DISTRIBUTORS
                </h2>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  Freelan SFA Linked | {billToPrint.agency} ({billToPrint.agency === 'Anuradhapura' ? 'CG0388' : 'CG0392'})
                </p>
                <div className="mt-3 text-xs space-y-1 text-slate-800">
                  <p><span className="font-bold">Bill / Invoice No:</span> <span className="font-mono">{billToPrint.id}</span></p>
                  <p><span className="font-bold">Date:</span> {billToPrint.date}</p>
                  <p><span className="font-bold">Customer / Shop:</span> {billToPrint.shopName}</p>
                </div>
              </div>

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

            <div className="pt-3 flex justify-between items-center text-xs text-slate-700">
              <span>Status: <strong>{billToPrint.paymentStatus}</strong></span>
              <span className="font-mono text-[11px] text-slate-500">
                {getQrPayload(billToPrint)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded PDF / Bill Print Modal with Top-Right QR */}
      {billToPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/85 overflow-y-auto p-4">
          <div className="print-only-sheet max-w-3xl mx-auto bg-white text-slate-900 rounded-2xl p-4 md:p-6 shadow-2xl">
            <div className="no-print flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-800">
                {billToPrintModal.fileName} (Top-Right QR)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerBrowserPrint}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print Now
                </button>
                <button
                  onClick={() => setBillToPrintModal(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1.5 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative border border-slate-300 rounded-lg overflow-hidden bg-white">
              {/* Top-Right QR Code */}
              <div className="absolute top-3 right-3 z-20 bg-white border-2 border-slate-900 rounded-lg p-1.5 shadow flex flex-col items-center">
                <img
                  src={getQrImageUrlFromPayload(
                    getQrPayloadFromValues(
                      billToPrintModal.invoiceNo,
                      activeAgency,
                      activeDateForQr,
                      billToPrintModal.amount || '0',
                      billToPrintModal.paymentStatus
                    ),
                    150
                  )}
                  alt={`QR ${billToPrintModal.invoiceNo}`}
                  className="w-24 h-24 object-contain"
                />
                <span className="text-[10px] font-mono font-bold text-slate-900 mt-0.5">
                  {billToPrintModal.invoiceNo}
                </span>
              </div>

              {billToPrintModal.fileType === 'pdf' ? (
                <iframe
                  src={billToPrintModal.dataUrl}
                  title={billToPrintModal.fileName}
                  className="w-full h-[75vh] border-0"
                />
              ) : (
                <img
                  src={billToPrintModal.dataUrl}
                  alt={billToPrintModal.fileName}
                  className="w-full h-auto block"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main ERP Interface */}
      <div className="no-print">
        <header className="max-w-6xl mx-auto bg-slate-800 border border-slate-700 rounded-2xl p-4 md:p-6 mb-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-amber-400 tracking-wide flex items-center gap-2">
              🟡 GOLDEN DISTRIBUTORS ERP
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Anuradhapura & Mihintale 12-Route Distribution Management System
            </p>
          </div>

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

        {/* Date Filter Bar */}
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetSampleData}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              onClick={handleSyncFreelan}
              disabled={isSyncing}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-all shadow"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : `Sync ${activeAgency}`}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto flex gap-3 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => { stopCamera(); setActiveTab('pdf'); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'pdf' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            <FileUp className="w-4 h-4" /> Upload Bill / PDF ({uploadedBills.length})
          </button>
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
          <div className="md:col-span-2 space-y-6">

            {/* Upload PDF / Bill Tab */}
            {activeTab === 'pdf' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                    <FileUp className="w-5 h-5" /> Upload SFA PDF / Bill & Add Top-Right QR
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Freelan SFA එකෙන් ගන්න PDF බිල් (හෝ ෆොටෝ) මෙතැනින් Upload කර, ඉහළ දකුණු පැත්තේ QR කෝඩ් එක සමඟ නැවත Print කරන්න.
                  </p>
                </div>

                {/* Explicit File Input + Button */}
                <div className="bg-slate-900/70 border-2 border-dashed border-amber-500/70 rounded-xl p-5 text-center space-y-3">
                  <FileText className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-sm font-bold text-white">
                    PDF / Bill ෆයිල් තෝරා Upload කරන්න
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    onChange={handleFilesUpload}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs inline-flex items-center gap-1.5"
                  >
                    <FileUp className="w-4 h-4" /> Choose PDF / Bill File
                  </button>
                </div>

                {uploadedBills.length > 0 && (
                  <div className="space-y-4">
                    {uploadedBills.map(item => {
                      const payload = getQrPayloadFromValues(
                        item.invoiceNo,
                        activeAgency,
                        activeDateForQr,
                        item.amount || '0',
                        item.paymentStatus
                      );
                      return (
                        <div
                          key={item.id}
                          className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 space-y-2">
                              <div className="text-xs font-bold text-emerald-400 break-all">
                                {item.fileName}
                              </div>
                              <input
                                type="text"
                                placeholder="Invoice No (e.g. CG0392DSI034516)"
                                value={item.invoiceNo}
                                onChange={(e) => updateUploadedBillField(item.id, 'invoiceNo', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                              />
                              <input
                                type="text"
                                placeholder="Shop Name (Optional)"
                                value={item.shopName}
                                onChange={(e) => updateUploadedBillField(item.id, 'shopName', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  placeholder="Amount (LKR)"
                                  value={item.amount}
                                  onChange={(e) => updateUploadedBillField(item.id, 'amount', e.target.value)}
                                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                />
                                <select
                                  value={item.paymentStatus}
                                  onChange={(e) => updateUploadedBillField(item.id, 'paymentStatus', e.target.value)}
                                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                                >
                                  <option value="Unpaid">Unpaid</option>
                                  <option value="Partially Paid">Partially Paid</option>
                                  <option value="Fully Paid">Fully Paid</option>
                                </select>
                              </div>
                            </div>

                            <div className="bg-white p-1.5 rounded-lg border border-slate-400 flex flex-col items-center shrink-0">
                              <img
                                src={getQrImageUrlFromPayload(payload, 120)}
                                alt={`QR ${item.invoiceNo}`}
                                className="w-20 h-20 object-contain"
                              />
                              <span className="text-[9px] font-mono font-bold text-slate-900 mt-0.5">
                                Top-Right QR
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => saveUploadedBillToOrders(item)}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs"
                            >
                              Save to Credit List
                            </button>
                            <button
                              onClick={() => setBillToPrintModal(item)}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" /> Preview & Print
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Orders & QR Invoices Tab */}
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

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="p-3">Invoice / Date</th>
                        <th className="p-3">Shop Name</th>
                        <th className="p-3">Net Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 text-xs">
                            තෝරාගත් දිනයට අදාළ බිල්පත් කිසිවක් හමු නොවීය.
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

            {/* Credit Bills Manager Tab */}
            {activeTab === 'credits' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
                <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" /> {activeAgency} Credit Bill Manager
                </h2>

                <div className="space-y-3">
                  {filteredOrders.map(ord => (
                    <div key={ord.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <p className="font-bold text-white text-sm">{ord.shopName} <span className="text-xs text-amber-400 font-mono">({ord.id})</span></p>
                        <p className="text-xs text-slate-400 mt-1">Date: {ord.date} | Net: LKR {ord.netAmount.toLocaleString()} | Paid: LKR {ord.paidAmount.toLocaleString()}</p>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                        ord.paymentStatus === 'Fully Paid' ? 'bg-emerald-500/20 text-emerald-400' :
                        ord.paymentStatus === 'Partially Paid' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {ord.paymentStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Camera QR Scanner Tab */}
            {activeTab === 'scanner' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg text-center py-8">
                <Camera className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-amber-400 mb-2">Live Camera QR Bill Scanner</h2>
                <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">
                  හවසට බිල්වල ඉහළ දකුණු පැත්තේ තියෙන QR කෝඩ් එක ස්කෑන් කර Paid / Half / Unpaid තත්ත්වය යාවත්කාලීන කරන්න.
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
              <p className="text-xs text-slate-400">PDF / Bill Top-Right QR</p>
              <p className="text-xs text-emerald-400 font-semibold mt-1">● Ready to Upload & Print</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
