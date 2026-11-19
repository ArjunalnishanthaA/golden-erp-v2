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
  FileText,
  Mail,
  CheckCircle2
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
      id: '26NOV_R187SIN_801',
      agency: 'Mihintale',
      shopName: 'Niranjala Stores - R187-000156',
      category: 'Wholesale',
      totalAmount: 3300,
      discountPercentage: 0,
      netAmount: 3300,
      date: todayStr,
      status: 'Dispatched',
      paymentStatus: 'Unpaid',
      paidAmount: 0
    },
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

  // QR Scanner States
  const [scanningActive, setScanningActive] = useState(false);
  const [scannedResultText, setScannedResultText] = useState<string>('');
  const [matchedScannedOrder, setMatchedScannedOrder] = useState<WholesaleOrder | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        window.clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  const [newShop, setNewShop] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [newDiscount, setNewDiscount] = useState('');

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

  // High-contrast, low-density QR so camera + printer can scan easily
  const getQrImageUrlFromPayload = (payload: string, size = 200) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=L&margin=8&data=${encodeURIComponent(payload)}`;
  };

  const getQrPayload = (ord: WholesaleOrder) => {
    return getQrPayloadFromValues(ord.id, ord.agency, ord.date, ord.netAmount, ord.paymentStatus);
  };

  const getQrImageUrl = (ord: WholesaleOrder) => {
    return getQrImageUrlFromPayload(getQrPayload(ord), 200);
  };

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
        const matchInvoice = cleanedName.match(/(?:CG\d{4}[A-Z0-9]+|\d{2}[A-Z]{3}_[A-Z0-9_]+)/i);

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
      alert(`✅ Freelan SFA Sync තත්ත්වය:\nAgency: ${activeAgency} (${username})\nදිනය: ${syncDateLabel}\nPDF බිල් Upload කර Top-Right QR සමඟ Print කිරීමට "Upload PDF Bill" කොටස භාවිත කරන්න.`);
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

  const handleDecodedQrValue = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    setScannedResultText(trimmed);

    const parts = trimmed.split('|');
    const invoiceCandidate = parts[0]?.trim() || trimmed;

    const existing = orders.find(
      o => o.id.toLowerCase() === invoiceCandidate.toLowerCase()
    );

    if (existing) {
      setMatchedScannedOrder(existing);
    } else {
      const parsedAmount = parseFloat(parts[3] || '0') || 0;
      const created: WholesaleOrder = {
        id: invoiceCandidate,
        agency: parts[1] === 'CG0388' ? 'Anuradhapura' : 'Mihintale',
        shopName: `Scanned Bill (${invoiceCandidate})`,
        category: 'Wholesale',
        totalAmount: parsedAmount,
        discountPercentage: 0,
        netAmount: parsedAmount,
        date: parts[2] || todayStr,
        status: 'Dispatched',
        paymentStatus: 'Unpaid',
        paidAmount: 0
      };
      setOrders(prev => [created, ...prev]);
      setMatchedScannedOrder(created);
    }
  };

  const startCamera = async () => {
    setScanningActive(true);
    setScannedResultText('');
    setMatchedScannedOrder(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      let detector: any = null;
      if (BarcodeDetectorCtor) {
        try {
          detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }

      if (scanIntervalRef.current) {
        window.clearInterval(scanIntervalRef.current);
      }

      scanIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        if (detector) {
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleDecodedQrValue(String(barcodes[0].rawValue));
            }
          } catch {
            // Ignore frame detection error
          }
        } else if (scanCanvasRef.current) {
          const canvas = scanCanvasRef.current;
          const ctx = canvas.getContext('2d');
          canvas.width = videoRef.current.videoWidth || 640;
          canvas.height = videoRef.current.videoHeight || 480;
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          }
        }
      }, 450);
    } catch (err) {
      console.error("Camera access error:", err);
      alert("⚠️ කැමරාව ක්‍රියාත්මක කර ගැනීමට අවසර නැත නැතහොත් කැමරාව භාවිතයේ ඇත.");
      setScanningActive(false);
    }
  };

  const stopCamera = () => {
    setScanningActive(false);
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const updatePaymentStatus = (id: string, status: 'Unpaid' | 'Partially Paid' | 'Fully Paid', amountPaid: number) => {
    setOrders(prev => prev.map(ord => {
      if (ord.id === id) {
        const updated = { ...ord, paymentStatus: status, paidAmount: amountPaid };
        if (matchedScannedOrder?.id === id) {
          setMatchedScannedOrder(updated);
        }
        return updated;
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
        @page {
          size: auto;
          margin: 0mm;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
          .no-print {
            display: none !important;
          }
          .print-modal-backdrop {
            position: static !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          .print-full-page-wrapper {
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          .print-bill-frame {
            position: relative !important;
            width: 100% !important;
            height: 100vh !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .print-bill-embed {
            width: 100% !important;
            height: 100vh !important;
            display: block !important;
          }
          .print-top-right-qr {
            position: fixed !important;
            top: 10px !important;
            right: 10px !important;
            z-index: 9999 !important;
            background: #ffffff !important;
            border: 1.5px solid #000000 !important;
            padding: 4px !important;
          }
        }
      `}</style>

      {/* Order Print Modal */}
      {billToPrint && (
        <div className="print-modal-backdrop fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="print-full-page-wrapper bg-white text-slate-900 w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-300">
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

              <div className="print-top-right-qr flex flex-col items-center border border-slate-400 rounded-lg p-2 bg-white shrink-0">
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

      {/* Uploaded PDF Print Modal with Full-Size Layout & Top-Right QR Only */}
      {billToPrintModal && (
        <div className="print-modal-backdrop fixed inset-0 z-50 bg-black/85 overflow-y-auto p-4">
          <div className="print-full-page-wrapper max-w-4xl mx-auto bg-white text-slate-900 rounded-2xl p-4 md:p-6 shadow-2xl">
            <div className="no-print flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-800">
                {billToPrintModal.fileName} (Original Layout + Top-Right QR)
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

            <div className="print-bill-frame relative border border-slate-300 rounded-lg overflow-hidden bg-white">
              {/* Top-Right QR Code Only */}
              <div className="print-top-right-qr absolute top-3 right-3 z-20 bg-white border border-slate-900 rounded-md p-1.5 shadow flex flex-col items-center">
                <img
                  src={getQrImageUrlFromPayload(
                    getQrPayloadFromValues(
                      billToPrintModal.invoiceNo,
                      activeAgency,
                      activeDateForQr,
                      billToPrintModal.amount || '0',
                      billToPrintModal.paymentStatus
                    ),
                    220
                  )}
                  alt={`QR ${billToPrintModal.invoiceNo}`}
                  className="w-24 h-24 object-contain"
                />
                <span className="text-[9px] font-mono font-bold text-slate-900 mt-0.5">
                  {billToPrintModal.invoiceNo}
                </span>
              </div>

              {billToPrintModal.fileType === 'pdf' ? (
                <iframe
                  src={billToPrintModal.dataUrl}
                  title={billToPrintModal.fileName}
                  className="print-bill-embed w-full h-[80vh] border-0"
                />
              ) : (
                <img
                  src={billToPrintModal.dataUrl}
                  alt={billToPrintModal.fileName}
                  className="print-bill-embed w-full h-auto block"
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
            <FileUp className="w-4 h-4" /> Upload PDF Bill ({uploadedBills.length})
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

            {/* Upload PDF Bill Tab */}
            {activeTab === 'pdf' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                    <FileUp className="w-5 h-5" /> Upload Email / SFA PDF Bill & Add Top-Right QR
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    PDF බිල් Upload කර, original බිලේ ඉහළ දකුණු පැත්තේ QR කෝඩ් එක සමඟ Print කරන්න.
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-3.5 text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Mail className="w-4 h-4" /> ඊමේල් එකේ PDF බිල මෙතැනට ගන්නා කෙටි මඟ:
                  </p>
                  <p>1. Gmail ඇප් එකේ PDF බිල ළඟ ඇති <strong>Download (↓)</strong> බොත්තම ඔබන්න.</p>
                  <p>2. පහත <strong>Choose PDF File</strong> ඔබා, ෆෝන් එකේ <strong>Downloads / Files</strong> වලින් ඒ PDF එක තෝරන්න.</p>
                </div>

                <div className="bg-slate-900/70 border-2 border-dashed border-amber-500/70 rounded-xl p-5 text-center space-y-3">
                  <FileText className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-sm font-bold text-white">
                    PDF බිල් ෆයිල් තෝරා Upload කරන්න
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleFilesUpload}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs inline-flex items-center gap-1.5"
                  >
                    <FileUp className="w-4 h-4" /> Choose PDF File
                  </button>
                </div>

                {uploadedBills.length > 0
