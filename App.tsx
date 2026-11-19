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
  CheckCircle2,
  Loader2
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

interface PdfPageBill {
  pageNumber: number;
  imageUrl: string;
  invoiceNo: string;
  shopName: string;
  amount: string;
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Fully Paid';
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
  pages: PdfPageBill[];
  isRendering?: boolean;
}

const STORAGE_KEY = 'golden_distributors_erp_orders_v1';
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const JSQR_CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';

const getLocalDateString = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const loadExternalScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
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

  const [uploadedBills, setUploadedBills] = useState<UploadedBillItem[]>([]);
  const [billToPrintModal, setBillToPrintModal] = useState<UploadedBillItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const getQrImageUrlFromPayload = (payload: string, size = 180) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=L&margin=6&data=${encodeURIComponent(payload)}`;
  };

  const getQrPayload = (ord: WholesaleOrder) => {
    return getQrPayloadFromValues(ord.id, ord.agency, ord.date, ord.netAmount, ord.paymentStatus);
  };

  const getQrImageUrl = (ord: WholesaleOrder) => {
    return getQrImageUrlFromPayload(getQrPayload(ord), 180);
  };

  const extractBillDetailsFromPageText = (
    pageText: string,
    fallbackInvoice: string,
    pageNum: number
  ): { invoiceNo: string; shopName: string; amount: string } => {
    const normalized = pageText.replace(/\s+/g, ' ').trim();

    const invMatch = normalized.match(
      /(?:Invoice\s*No\s*:?\s*)?(\d{2}[A-Z]{3}_[A-Z0-9_]+|CG\d{4}[A-Z0-9]+|[A-Z]{2,5}\d{3,}[A-Z0-9_-]*)/i
    );
    const extractedInvoice = invMatch
      ? invMatch[1].toUpperCase()
      : `${fallbackInvoice}-P${pageNum}`;

    const shopMatch = normalized.match(
      /(?:Invoiced\s*To\s*:?\s*)([A-Za-z0-9\s.&'-]{3,45}?)(?=\s+(?:Tel|Ordered|Invoice|Item|Gross|Total|\d{10}|No\.))/i
    );
    const extractedShop = shopMatch ? shopMatch[1].trim() : '';

    const totalMatch = normalized.match(
      /(?:Total\s*Value|Net\s*Total|Grand\s*Total)\s*:?\s*(?:Rs\.?|LKR)?\s*([\d,]+\.\d{2}|[\d,]+)/i
    );
    const extractedAmount = totalMatch ? totalMatch[1].replace(/,/g, '') : '';

    return {
      invoiceNo: extractedInvoice,
      shopName: extractedShop,
      amount: extractedAmount
    };
  };

  const renderPdfAllPages = async (
    dataUrl: string,
    fallbackInvoice: string
  ): Promise<PdfPageBill[]> => {
    await loadExternalScript(PDFJS_CDN);
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('PDF.js not available');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;

    const base64Part = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binaryStr = atob(base64Part);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages || 1;
    const renderedPages: PdfPageBill[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (context) {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
      }

      let pageText = '';
      try {
        const textContent = await page.getTextContent();
        pageText = (textContent.items || [])
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');
      } catch {
        pageText = '';
      }

      const extracted = extractBillDetailsFromPageText(pageText, fallbackInvoice, pageNum);
      renderedPages.push({
        pageNumber: pageNum,
        imageUrl: canvas.toDataURL('image/jpeg', 0.9),
        invoiceNo: extracted.invoiceNo,
        shopName: extracted.shopName,
        amount: extracted.amount,
        paymentStatus: 'Unpaid'
      });
    }

    return renderedPages;
  };

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) return;

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const cleanedName = file.name.replace(/\.[^/.]+$/, '');
        const matchInvoice = cleanedName.match(/(?:CG\d{4}[A-Z0-9]+|\d{2}[A-Z]{3}_[A-Z0-9_]+)/i);
        const baseInvoice = matchInvoice ? matchInvoice[0].toUpperCase() : cleanedName || `BILL-${idx + 1}`;
        const itemId = `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;

        const initialItem: UploadedBillItem = {
          id: itemId,
          fileName: file.name,
          fileType: isPdf ? 'pdf' : 'image',
          dataUrl: result,
          invoiceNo: baseInvoice,
          shopName: '',
          amount: '',
          paymentStatus: 'Unpaid',
          pages: [],
          isRendering: isPdf
        };

        setUploadedBills(prev => [initialItem, ...prev]);

        if (isPdf) {
          try {
            const pages = await renderPdfAllPages(result, baseInvoice);
            const firstPage = pages[0];
            setUploadedBills(prev =>
              prev.map(item =>
                item.id === itemId
                  ? {
                      ...item,
                      pages,
                      isRendering: false,
                      invoiceNo: firstPage?.invoiceNo || item.invoiceNo,
                      shopName: firstPage?.shopName || item.shopName,
                      amount: firstPage?.amount || item.amount
                    }
                  : item
              )
            );
          } catch (err) {
            console.error('PDF page render failed:', err);
            setUploadedBills(prev =>
              prev.map(item => (item.id === itemId ? { ...item, isRendering: false } : item))
            );
          }
        }
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

  const updatePdfPageField = (
    billId: string,
    pageNumber: number,
    field: 'invoiceNo' | 'shopName' | 'amount' | 'paymentStatus',
    value: string
  ) => {
    setUploadedBills(prev =>
      prev.map(item => {
        if (item.id !== billId) return item;
        const updatedPages = item.pages.map(p =>
          p.pageNumber === pageNumber ? { ...p, [field]: value } : p
        );
        return { ...item, pages: updatedPages };
      })
    );

    setBillToPrintModal(prev => {
      if (!prev || prev.id !== billId) return prev;
      const updatedPages = prev.pages.map(p =>
        p.pageNumber === pageNumber ? { ...p, [field]: value } : p
      );
      return { ...prev, pages: updatedPages };
    });
  };

  const savePageOrBillToOrders = (
    invoiceNo: string,
    shopName: string,
    amountStr: string,
    paymentStatus: 'Unpaid' | 'Partially Paid' | 'Fully Paid',
    fallbackLabel: string
  ) => {
    const parsedAmount = parseFloat(amountStr) || 0;
    const newOrd: WholesaleOrder = {
      id: invoiceNo.trim() || `INV-${Date.now().toString().slice(-4)}`,
      agency: activeAgency,
      shopName: shopName.trim() || fallbackLabel,
      category: 'Wholesale',
      totalAmount: parsedAmount,
      discountPercentage: 0,
      netAmount: parsedAmount,
      date: selectedDate === 'ALL' ? todayStr : selectedDate,
      status: 'Dispatched',
      paymentStatus,
      paidAmount: paymentStatus === 'Fully Paid' ? parsedAmount : 0
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
      alert(`✅ Freelan SFA Sync තත්ත්වය:\nAgency: ${activeAgency} (${username})\nදිනය: ${syncDateLabel}\nPDF බිල් Upload කර සෑම පිටුවකටම ඒ බිලේ QR එක සමඟ Print කිරීමට "Upload PDF Bill" භාවිත කරන්න.`);
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
      await loadExternalScript(JSQR_CDN).catch(() => {});

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
              return;
            }
          } catch {
            // fallback to jsQR
          }
        }

        const jsQR = (window as any).jsQR;
        if (jsQR && scanCanvasRef.current) {
          const canvas = scanCanvasRef.current;
          const ctx = canvas.getContext('2d');
          const vw = videoRef.current.videoWidth || 640;
          const vh = videoRef.current.videoHeight || 480;
          canvas.width = vw;
          canvas.height = vh;
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, vw, vh);
            const imgData = ctx.getImageData(0, 0, vw, vh);
            const code = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth'
            });
            if (code && code.data) {
              handleDecodedQrValue(String(code.data));
            }
          }
        }
      }, 350);
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
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          .print-each-page {
            position: relative !important;
            width: 100% !important;
            page-break-after: always !important;
            break-after: page !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-each-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .print-page-img {
            width: 100% !important;
            height: auto !important;
            display: block !important;
          }
          .print-top-right-qr {
            position: absolute !important;
            top: 8px !important;
            right: 8px !important;
            z-index: 50 !important;
            background: #ffffff !important;
            border: 1.5px solid #000000 !important;
            padding: 3px !important;
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

            <div className="print-each-page flex justify-between items-start gap-4 border-b-2 border-slate-800 pb-4">
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

      {/* Multi-Page PDF / Image Print Modal: Every Page Has Its Own Bill's Top-Right QR */}
      {billToPrintModal && (
        <div className="print-modal-backdrop fixed inset-0 z-50 bg-black/85 overflow-y-auto p-4">
          <div className="print-full-page-wrapper max-w-4xl mx-auto bg-white text-slate-900 rounded-2xl p-4 md:p-6 shadow-2xl space-y-6">
            <div className="no-print flex flex-wrap justify-between items-center gap-2 pb-4 border-b border-slate-200">
              <div>
                <span className="text-sm font-bold text-slate-800 block">
                  {billToPrintModal.fileName} ({billToPrintModal.pages.length > 0 ? `${billToPrintModal.pages.length} Pages` : '1 Bill'})
                </span>
                <span className="text-xs text-slate-600">
                  සෑම පිටුවකම ඉහළ දකුණු පැත්තේ ඒ බිලට අදාළ QR කෝඩ් එක සකසා ඇත.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerBrowserPrint}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print All Pages
                </button>
                <button
                  onClick={() => setBillToPrintModal(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1.5 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {billToPrintModal.pages.length > 0 ? (
              billToPrintModal.pages.map(pg => {
                const pagePayload = getQrPayloadFromValues(
                  pg.invoiceNo,
                  activeAgency,
                  activeDateForQr,
                  pg.amount || '0',
                  pg.paymentStatus
                );
                return (
                  <div key={pg.pageNumber} className="space-y-2">
                    <div className="no-print flex flex-wrap items-center gap-2 bg-slate-100 p-2.5 rounded-lg border border-slate-300 text-xs">
                      <span className="font-bold text-slate-800">Page {pg.pageNumber}:</span>
                      <input
                        type="text"
                        value={pg.invoiceNo}
                        onChange={(e) =>
                          updatePdfPageField(billToPrintModal.id, pg.pageNumber, 'invoiceNo', e.target.
