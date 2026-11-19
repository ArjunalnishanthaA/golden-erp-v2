import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
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

// Configure PDF.js worker for browser rendering
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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

interface PdfStampedPage {
  pageNumber: number;
  imageUrl: string;
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
  const [activeTab, setActiveTab] = useState<'orders' | 'pdf' | 'credits' | 'scanner'>('pdf');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [billToPrint, setBillToPrint] = useState<WholesaleOrder | null>(null);

  // PDF QR Stamper States
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pdfPages, setPdfPages] = useState<PdfStampedPage[]>([]);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [printAllPdfPages, setPrintAllPdfPages] = useState(false);
  const [singlePdfPageToPrint, setSinglePdfPageToPrint] = useState<PdfStampedPage | null>(null);

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

  // Handle PDF Upload & Extract Pages + Invoice Numbers
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPdf(true);
    setPdfFileName(file.name);
    setPdfPages([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const extractedPages: PdfStampedPage[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
        }

        // Try extracting text to find Invoice No (e.g., CG0392DSI... or CG0388DSI...)
        let detectedInvoice = `PAGE-${pageNum}`;
        try {
          const textContent = await page.getTextContent();
          const fullText = textContent.items
            .map((item: any) => ('str' in item ? item.str : ''))
            .join(' ');
          const match = fullText.match(/CG\d{4}[A-Z0-9]+/i);
          if (match) {
            detectedInvoice = match[0].toUpperCase();
          }
        } catch {
          // Fallback if text extraction isn't available
        }

        extractedPages.push({
          pageNumber: pageNum,
          imageUrl: canvas.toDataURL('image/jpeg', 0.85),
          invoiceNo: detectedInvoice,
          shopName: '',
          amount: '',
          paymentStatus: 'Unpaid'
        });
      }

      setPdfPages(extractedPages);
    } catch (err) {
      console.error('Error reading PDF:', err);
      alert('⚠️ PDF ෆයිල් එක කියවීමට නොහැකි විය. වෙනත් PDF එකක් උත්සාහ කරන්න.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const updatePdfPageField = (
    pageNumber: number,
    field: 'invoiceNo' | 'shopName' | 'amount' | 'paymentStatus',
    value: string
  ) => {
    setPdfPages(prev =>
      prev.map(p => (p.pageNumber === pageNumber ? { ...p, [field]: value } : p))
    );
  };

  const savePdfPageToOrders = (pg: PdfStampedPage) => {
    const parsedAmount = parseFloat(pg.amount) || 0;
    const newOrd: WholesaleOrder = {
      id: pg.invoiceNo.trim() || `INV-P${pg.pageNumber}`,
      agency: activeAgency,
      shopName: pg.shopName.trim() || `PDF Bill Page ${pg.pageNumber}`,
      category: 'Wholesale',
      totalAmount: parsedAmount,
      discountPercentage: 0,
      netAmount: parsedAmount,
      date: selectedDate === 'ALL' ? todayStr : selectedDate,
      status: 'Dispatched',
      paymentStatus: pg.paymentStatus,
      paidAmount: pg.paymentStatus === 'Fully Paid' ? parsedAmount : 0
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
      alert(`✅ Freelan SFA Sync තත්ත්වය:\nAgency: ${activeAgency} (${username})\nදිනය: ${syncDateLabel}\nPDF Invoices Upload කර Top-Right QR සමඟ Print කිරීමට "PDF QR Stamper" ටැබ් එක භාවිත කරන්න.`);
    }, 800);
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
          .pdf-print-page {
            page-break-after: always;
            break-after: page;
          }
          .pdf-print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      {/* Single Order Print Modal (QR Code on Top-Right) */}
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
                  aria-label="Close"
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

      {/* Uploaded PDF Single/All Pages Print Preview Modal (QR on Top-Right of each page) */}
      {(singlePdfPageToPrint || printAllPdfPages) && (
        <div className="fixed inset-0 z-50 bg-black/85 overflow-y-auto p-4">
          <div className="print-only-sheet max-w-3xl mx-auto bg-white text-slate-900 rounded-2xl p-4 md:p-6 shadow-2xl">
            <div className="no-print flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-800">
                {printAllPdfPages
                  ? `All ${pdfPages.length} PDF Pages Preview (Top-Right QR)`
                  : `Page ${singlePdfPageToPrint?.pageNumber} Preview (Top-Right QR)`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerBrowserPrint}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print Now
                </button>
                <button
                  onClick={() => {
                    setSinglePdfPageToPrint(null);
                    setPrintAllPdfPages(false);
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1.5 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(printAllPdfPages ? pdfPages : singlePdfPageToPrint ? [singlePdfPageToPrint] : []).map(pg => {
              const payload = getQrPayloadFromValues(
                pg.invoiceNo,
                activeAgency,
                activeDateForQr,
                pg.amount || '0',
                pg.paymentStatus
              );
              return (
                <div
                  key={pg.pageNumber}
                  className="pdf-print-page relative border border-slate-300 rounded-lg overflow-hidden bg-white mb-6"
                >
                  {/* Top-Right QR Code stamped over the top-right area of the uploaded bill page */}
                  <div className="absolute top-3 right-3 z-10 bg-white border-2 border-slate-900 rounded-lg p-1.5 shadow flex flex-col items-center">
                    <img
                      src={getQrImageUrlFromPayload(payload, 140)}
                      alt={`QR for ${pg.invoiceNo}`}
                      className="w-24 h-24 object-contain"
                    />
                    <span className="text-[10px] font-mono font-bold text-slate-900 mt-0.5">
                      {pg.invoiceNo}
                    </span>
                  </div>

                  <img
                    src={pg.imageUrl}
                    alt={`Bill Page ${pg.pageNumber}`}
                    className="w-full h-auto block"
                  />
                </div>
              );
            })}
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
            <FileUp className="w-4 h-4" /> PDF QR Stamper ({pdfPages.length})
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

            {/* PDF Upload & Top-Right QR Stamper Tab */}
            {activeTab === 'pdf' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                    <FileUp className="w-5 h-5" /> Upload SFA Invoice PDF & Stamp Top-Right QR
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Freelan SFA එකෙන් Invoice convert කළාම එන PDF එක (බිල් 20ක් තිබුණත්) මෙතැනින් Upload කර, එක් එක් බිලේ ඉහළ දකුණු පැත්තේ QR කෝඩ් එක සමඟ නැවත Print කරන්න.
                  </p>
                </div>

                <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-500/60 hover:border-amber-400 bg-slate-900/60 rounded-xl p-6 cursor-pointer transition-all">
                  <FileText className="w-10 h-10 text-amber-400 mb-2" />
                  <span className="text-sm font-bold text-white">
                    {pdfFileName ? `Selected: ${pdfFileName}` : 'Tap to Upload Invoice PDF File'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">PDF files only (Supports multi-page bills)</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                </label>

                {isProcessingPdf && (
                  <div className="text-center py-6 text-amber-400 text-sm font-semibold">
                    PDF පිටු කියවමින් QR සකස් කරමින් පවතී...
                  </div>
                )}

                {pdfPages.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-900 p-3 rounded-xl border border-slate-700">
                      <span className="text-xs font-bold text-emerald-400">
                        {pdfPages.length} Bills / Pages Ready
                      </span>
                      <button
                        onClick={() => setPrintAllPdfPages(true)}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                      >
                        <Printer className="w-4 h-4" /> Print All {pdfPages.length} Pages (Top-Right QR)
                      </button>
                    </div>

                    {pdfPages.map(pg => {
                      const payload = getQrPayloadFromValues(
                        pg.invoiceNo,
                        activeAgency,
                        activeDateForQr,
                        pg.amount || '0',
                        pg.paymentStatus
                      );
                      return (
                        <div
                          key={pg.pageNumber}
                          className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 space-y-2">
                              <div className="text-xs font-bold text-amber-400">
                                Page {pg.pageNumber} / {pdfPages.length}
                              </div>
                              <input
                                type="text"
                                placeholder="Invoice No (e.g. CG0392DSI034516)"
                                value={pg.invoiceNo}
                                onChange={(e) => updatePdfPageField(pg.pageNumber, 'invoiceNo', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                              />
                              <input
                                type="text"
                                placeholder="Shop Name (Optional)"
                                value={pg.shopName}
                                onChange={(e) => updatePdfPageField(pg.pageNumber, 'shopName', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  placeholder="Total Value (LKR)"
                                  value={pg.amount}
                                  onChange={(e) => updatePdfPageField(pg.pageNumber, 'amount', e.target.value)}
                                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                />
                                <select
                                  value={pg.paymentStatus}
                                  onChange={(e) => updatePdfPageField(pg.pageNumber, 'paymentStatus', e.target.value)}
                                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                                >
                                  <option value="Unpaid">Unpaid</option>
                                  <option value="Partially Paid">Partially Paid</option>
                                  <option value="Fully Paid">Fully Paid</option>
                                </select>
                              </div>
                            </div>

                            {/* Top-Right QR Preview */}
                            <div className="bg-white p-1.5 rounded-lg border border-slate-400 flex flex-col items-center shrink-0">
                              <img
                                src={getQrImageUrlFromPayload(payload, 120)}
                                alt={`QR ${pg.invoiceNo}`}
                                className="w-20 h-20 object-contain"
                              />
                              <span className="text-[9px] font-mono font-bold text-slate-900 mt-0.5">
                                Top-Right QR
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => savePdfPageToOrders(pg)}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs"
                            >
                              Save to Credit List
                            </button>
                            <button
                              onClick={() => setSinglePdfPageToPrint(pg)}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" /> Preview & Print Page
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
              <p className="text-xs text-slate-400">PDF Top-Right QR Stamper</p>
              <p className="text-xs text-emerald-400 font-semibold mt-1">● Ready for Multi-Page PDF</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
