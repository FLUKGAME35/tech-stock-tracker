import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, Activity, BarChart2, Clock, Globe, Pin, RefreshCw, Star, Plus, Minus, AlertCircle, Loader2, Sun, Moon, Banknote } from 'lucide-react';

// ==========================================
// 🔴 จุดที่ต้องแก้ไข: ใส่ API KEY ของ FINNHUB ที่นี่
// ==========================================
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY ?? '';

// โครงสร้างข้อมูลเริ่มต้น
const DEFAULT_STOCK = {
  symbol: 'NVDA',
  name: 'NVIDIA Corp.',
  basePrice: 0,
  prevClose: 0,
  marketCap: 'N/A',
  pe: 'N/A'
};

const generateChartData = (targetEndPrice: number, points: number, volatility: number) => {
  if (targetEndPrice === 0) return Array(points).fill(0);
  let p = targetEndPrice;
  const data = [p];
  for (let i = 1; i < points; i++) {
    const change = p * (Math.random() - 0.48) * volatility;
    p += change;
    data.push(p);
  }
  const diff = targetEndPrice - data[data.length - 1];
  return data.map(val => val + diff);
};

// 🟢 ฟังก์ชันช่วยจัดการฟอร์แมตราคา (รองรับ USD / THB)
const formatPrice = (price: number, currency: string, exchangeRate: number) => {
  if (price === 0) return 'กำลังโหลด...';
  if (currency === 'THB') {
    return `฿${(price * exchangeRate).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function App() {
  // 🟢 ระบบธีม (ดึงค่าเริ่มต้นจากระบบเครื่อง)
  const getInitialTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };
  
  const [theme, setTheme] = useState(getInitialTheme());
  
  // 🟢 ระบบสกุลเงิน (USD/THB)
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(36.5); // ค่าเริ่มต้นเผื่อ API ขัดข้อง

  // ดึงค่า Exchange Rate ล่าสุด (USD to THB)
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data && data.rates && data.rates.THB) {
          setExchangeRate(data.rates.THB);
        }
      } catch (e) {
        console.warn('ไม่สามารถดึงอัตราแลกเปลี่ยนได้ ใช้ค่าเริ่มต้นแทน');
      }
    };
    fetchExchangeRate();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState(DEFAULT_STOCK); 
  const [currentPrice, setCurrentPrice] = useState(selectedStock.basePrice);
  const [timeframe, setTimeframe] = useState('1D');
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUsingRealApi, setIsUsingRealApi] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const [apiSearchResults, setApiSearchResults] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  
  const [savedWatchlist, setSavedWatchlist] = useState<any[]>(() => {
    const saved = localStorage.getItem('techTick_watchlist_v4');
    if (saved) return JSON.parse(saved);
    return [
      { symbol: 'NVDA', name: 'NVIDIA CORP' },
      { symbol: 'AAPL', name: 'APPLE INC' },
      { symbol: 'MSFT', name: 'MICROSOFT CORP' },
      { symbol: 'TSLA', name: 'TESLA INC' }
    ];
  });

  const [pinnedStocks, setPinnedStocks] = useState<string[]>(() => {
    const saved = localStorage.getItem('techTick_pinned_v4');
    return saved ? JSON.parse(saved) : [];
  });

  const [pinnedPrices, setPinnedPrices] = useState<Record<string, { c: number, pc: number }>>({});
  const [pinErrorMsg, setPinErrorMsg] = useState('');

  useEffect(() => localStorage.setItem('techTick_watchlist_v4', JSON.stringify(savedWatchlist)), [savedWatchlist]);
  useEffect(() => localStorage.setItem('techTick_pinned_v4', JSON.stringify(pinnedStocks)), [pinnedStocks]);

  useEffect(() => {
    const fetchInitialPrices = async () => {
      if (FINNHUB_API_KEY === 'YOUR_FINNHUB_API_KEY' || FINNHUB_API_KEY === '') return;
      
      let needsUpdate = false;
      const updatedWatchlist = await Promise.all(savedWatchlist.map(async (stock) => {
        if (stock.prevClose && stock.basePrice) return stock; 
        needsUpdate = true;
        try {
          const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${FINNHUB_API_KEY}`);
          const data = await res.json();
          return { ...stock, prevClose: data.pc || 0, basePrice: data.c || 0 };
        } catch (e) {
          return stock;
        }
      }));

      if (needsUpdate) {
        setSavedWatchlist(updatedWatchlist);
        if (selectedStock.symbol === updatedWatchlist[0].symbol && selectedStock.basePrice === 0) {
          setSelectedStock(prev => ({
            ...prev,
            basePrice: updatedWatchlist[0].basePrice,
            prevClose: updatedWatchlist[0].prevClose
          }));
        }
      }
    };
    fetchInitialPrices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isWatchlisted = savedWatchlist.some(s => s.symbol === selectedStock.symbol);
  
  const toggleWatchlist = () => {
    if (isWatchlisted) {
      setSavedWatchlist(prev => prev.filter(s => s.symbol !== selectedStock.symbol));
      setPinnedStocks(prev => prev.filter(s => s !== selectedStock.symbol));
    } else {
      setSavedWatchlist(prev => [{
        symbol: selectedStock.symbol,
        name: selectedStock.name,
        prevClose: selectedStock.prevClose,
        basePrice: currentPrice
      }, ...prev]);
    }
  };

  useEffect(() => {
    const fetchSearch = async () => {
      if (!searchQuery.trim()) {
        setApiSearchResults([]);
        setIsSearchLoading(false);
        return;
      }
      setIsSearchLoading(true);
      try {
        const res = await fetch(`https://finnhub.io/api/v1/search?q=${searchQuery}&token=${FINNHUB_API_KEY}`);
        const data = await res.json();
        if (data && data.result) {
          const filtered = data.result.filter((r: any) => r.type === 'Common Stock' && !r.symbol.includes('.')).slice(0, 8);
          setApiSearchResults(filtered);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearchLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => fetchSearch(), 500);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleSelectFromSearch = async (symbol: string, name: string) => {
    setSearchQuery('');
    setApiSearchResults([]);
    setIsSearching(false);
    
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
      const data = await res.json();
      setSelectedStock({
        symbol,
        name,
        basePrice: data.c || 0,
        prevClose: data.pc || 0,
        marketCap: 'N/A', 
        pe: 'N/A'
      });
    } catch (e) {
      setSelectedStock({ symbol, name, basePrice: 0, prevClose: 0, marketCap: 'N/A', pe: 'N/A' });
    }
  };

  const sortedWatchlist = useMemo(() => {
    const pinned = pinnedStocks
      .map(symbol => savedWatchlist.find(s => s.symbol === symbol))
      .filter((s) => s !== undefined);
    const unpinned = savedWatchlist.filter(s => !pinnedStocks.includes(s.symbol));
    return [...pinned, ...unpinned];
  }, [pinnedStocks, savedWatchlist]);

  const togglePin = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    setPinnedStocks(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else {
        if (prev.length >= 5) {
          setPinErrorMsg('คุณสามารถปักหมุดได้สูงสุด 5 ตัวเท่านั้น!');
          setTimeout(() => setPinErrorMsg(''), 3000);
          return prev;
        }
        return [symbol, ...prev];
      }
    });
  };

  const fetchRealData = useCallback(async () => {
    if (FINNHUB_API_KEY === 'YOUR_FINNHUB_API_KEY' || FINNHUB_API_KEY === '') return false;
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${selectedStock.symbol}&token=${FINNHUB_API_KEY}`);
      if (!res.ok) throw new Error('API Rate Limit Error');
      const data = await res.json();
      
      if (data.c && data.c > 0) {
        setCurrentPrice(data.c);
        setIsUsingRealApi(true);
        setChartData(prev => {
          if (prev.length === 0 || prev[0] === 0) return generateChartData(data.c, 40, 0.01);
          const diff = data.c - prev[prev.length - 1];
          return prev.map(p => p + diff);
        });
        
        if (selectedStock.prevClose !== data.pc) {
          setSelectedStock(prev => ({ ...prev, prevClose: data.pc }));
        }
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }, [selectedStock.symbol, selectedStock.prevClose]);

  useEffect(() => {
    const fetchPinnedData = async () => {
      if (FINNHUB_API_KEY === 'YOUR_FINNHUB_API_KEY' || pinnedStocks.length === 0) return;
      
      const newPrices = { ...pinnedPrices };
      for (const symbol of pinnedStocks) {
        try {
          const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
          const data = await res.json();
          if (data && data.c) {
            newPrices[symbol] = { c: data.c, pc: data.pc };
          }
        } catch (e) {
           console.warn(`Error fetching pinned stock ${symbol}`);
        }
      }
      setPinnedPrices(newPrices);
    };

    fetchPinnedData(); 
    const interval = setInterval(fetchPinnedData, 10000); 
    return () => clearInterval(interval);
  }, [pinnedStocks]); 

  useEffect(() => {
    let points = 50;
    let volatility = 0.02;
    switch(timeframe) {
      case '1H': points = 60; volatility = 0.005; break; 
      case '1D': points = 24; volatility = 0.01; break;  
      case '1W': points = 7; volatility = 0.03; break;   
      case '1M': points = 31; volatility = 0.05; break;  
      case '3M': points = 90; volatility = 0.08; break;  
      case '1Y': points = 12; volatility = 0.15; break;  
    }
    const newData = generateChartData(currentPrice, points, volatility);
    setChartData(newData);
    setCurrentPrice(newData[newData.length - 1]);
    
    const labels = [];
    const now = new Date();
    for (let i = points - 1; i >= 0; i--) {
      const d = new Date(now);
      if (timeframe === '1H') {
        d.setMinutes(d.getMinutes() - i);
        labels.push(d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
      } else if (timeframe === '1D') {
        d.setHours(d.getHours() - i);
        labels.push(d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.');
      } else if (timeframe === '1W') {
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('th-TH', { weekday: 'short' }));
      } else if (timeframe === '1M' || timeframe === '3M') {
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));
      } else if (timeframe === '1Y') {
        d.setMonth(d.getMonth() - i);
        labels.push(d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }));
      }
    }
    setChartLabels(labels);
    fetchRealData();
  }, [selectedStock.symbol, timeframe, fetchRealData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (FINNHUB_API_KEY !== 'YOUR_FINNHUB_API_KEY' && FINNHUB_API_KEY !== '') {
        fetchRealData(); 
      } else {
        setIsUsingRealApi(false);
        setCurrentPrice(prev => {
          if (prev === 0) return 0;
          const change = prev * (Math.random() - 0.5) * 0.005;
          const newPrice = prev + change;
          setChartData(currentData => {
            const newData = [...currentData];
            newData[newData.length - 1] = newPrice;
            return newData;
          });
          return newPrice;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchRealData, isUsingRealApi, timeframe]);

  const prevClose = selectedStock.prevClose;
  const priceChange = currentPrice - prevClose;
  const percentChange = prevClose ? (priceChange / prevClose) * 100 : 0;
  
  let strokeColor = '#38bdf8'; 
  let statusColorClass = 'text-sky-500';
  let TrendIcon = Minus;
  let sign = '';

  if (priceChange > 0) {
    strokeColor = '#10b981'; 
    statusColorClass = 'text-emerald-500';
    TrendIcon = TrendingUp;
    sign = '+';
  } else if (priceChange < 0) {
    strokeColor = '#ef4444'; 
    statusColorClass = 'text-red-500';
    TrendIcon = TrendingDown;
    sign = ''; 
  }

  const renderChart = () => {
    if (chartData.length === 0 || currentPrice === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p>กำลังดึงข้อมูลตลาดล่าสุด...</p>
        </div>
      );
    }
    
    let min = Math.min(...chartData);
    let max = Math.max(...chartData);

    if (timeframe === '1D') {
      min = Math.min(min, prevClose);
      max = Math.max(max, prevClose);
    }
    
    if (min === max) {
      min -= 1; max += 1;
    }

    const padding = (max - min) * 0.15;
    const adjustedMin = min - padding;
    const adjustedMax = max + padding;
    const width = 800;
    const height = 300; 
    const svgHeight = 330; 
    
    const getCoordinate = (val: number, index: number) => {
      const x = (index / (chartData.length - 1)) * width;
      const y = height - ((val - adjustedMin) / (adjustedMax - adjustedMin)) * height;
      return { x, y };
    };

    const pointsStr = chartData.map((val, index) => {
      const { x, y } = getCoordinate(val, index);
      return `${x},${y}`;
    }).join(' ');

    const prevCloseY = height - ((prevClose - adjustedMin) / (adjustedMax - adjustedMin)) * height;
    const showPrevClose = prevCloseY >= 0 && prevCloseY <= height;

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const index = Math.round((x / rect.width) * (chartData.length - 1));
      if (index >= 0 && index < chartData.length) setHoveredIndex(index);
    };

    // 🟢 สีแกนกราฟตามธีม
    const gridLineColor = theme === 'dark' ? '#1e293b' : '#e2e8f0';
    const gridTextColor = theme === 'dark' ? '#ffffff' : '#64748b';
    const prevLineColor = theme === 'dark' ? '#475569' : '#cbd5e1';
    const prevBadgeBg = theme === 'dark' ? '#334155' : '#f1f5f9';
    const prevBadgeText = theme === 'dark' ? '#ffffff' : '#475569';
    
    // 🟢 สี Tooltip ตามธีม
    const tooltipBg = theme === 'dark' ? '#1e293b' : '#ffffff';
    const tooltipBorder = theme === 'dark' ? '#334155' : '#e2e8f0';
    const tooltipText = theme === 'dark' ? '#ffffff' : '#0f172a';
    const tooltipSubText = theme === 'dark' ? '#94a3b8' : '#64748b';

    return (
      <svg 
        viewBox={`0 0 ${width} ${svgHeight}`} 
        className="w-full h-full overflow-visible font-sans cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = height * ratio;
          const priceLevel = adjustedMax - (ratio * (adjustedMax - adjustedMin));
          return (
            <g key={ratio}>
              <line x1="0" y1={y} x2={width} y2={y} stroke={gridLineColor} strokeWidth="1" />
              <text x="0" y={y - 5} fill={gridTextColor} fontSize="11" opacity="0.8">
                {formatPrice(priceLevel, currency, exchangeRate)}
              </text>
            </g>
          );
        })}
        
        {showPrevClose && (
          <g>
            <line x1="0" y1={prevCloseY} x2={width} y2={prevCloseY} stroke={prevLineColor} strokeDasharray="4 4" strokeWidth="1.5" opacity="0.7"/>
            <rect x={width - 55} y={prevCloseY - 10} width="55" height="20" rx="4" fill={prevBadgeBg} />
            <text x={width - 27} y={prevCloseY + 3} fill={prevBadgeText} fontSize="10" textAnchor="middle" fontWeight="bold">Prev Cls</text>
          </g>
        )}
        
        <polygon points={`0,${height} ${pointsStr} ${width},${height}`} fill="url(#gradient)" />
        <polyline points={pointsStr} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinejoin="round"/>
        
        {(() => {
          const lastPoint = getCoordinate(chartData[chartData.length - 1], chartData.length - 1);
          return (
            <g>
              <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill={strokeColor} className="animate-pulse" />
              <circle cx={lastPoint.x} cy={lastPoint.y} r="10" fill={strokeColor} opacity="0.2" className="animate-ping" />
            </g>
          );
        })()}

        <g>
          <line x1="0" y1={height} x2={width} y2={height} stroke={gridLineColor} strokeWidth="1.5" />
          {(() => {
            const numLabels = timeframe === '1W' ? 7 : timeframe === '1Y' ? 6 : 6;
            const step = Math.max(1, Math.floor((chartData.length - 1) / (numLabels - 1)));
            const labelElements = [];
            
            for (let i = 0; i <= chartData.length; i += step) {
              const idx = Math.min(i, chartData.length - 1);
              if (i > 0 && idx === chartData.length - 1 && i !== chartData.length - 1) continue; 
              
              if (chartLabels[idx]) {
                const { x } = getCoordinate(0, idx);
                labelElements.push(
                  <g key={`x-label-${idx}`}>
                    <line x1={x} y1={height} x2={x} y2={height + 6} stroke={prevLineColor} strokeWidth="1.5" />
                    <text x={x} y={height + 22} fill={gridTextColor} fontSize="11" textAnchor="middle" fontWeight="500">
                      {chartLabels[idx]}
                    </text>
                  </g>
                );
              }
            }
            return labelElements;
          })()}
        </g>

        {hoveredIndex !== null && (
          <g>
            {(() => {
              const hoverPoint = getCoordinate(chartData[hoveredIndex], hoveredIndex);
              const currentP = chartData[hoveredIndex];
              const previousP = hoveredIndex > 0 ? chartData[hoveredIndex - 1] : prevClose;
              const pDiff = currentP - previousP;
              const pDiffPct = previousP ? (pDiff / previousP) * 100 : 0;
              
              let hoverColor = '#38bdf8';
              let hoverSign = '';
              let HoverIcon = '−';
              if (pDiff > 0) {
                  hoverColor = '#10b981';
                  hoverSign = '+';
                  HoverIcon = '▲';
              } else if (pDiff < 0) {
                  hoverColor = '#ef4444';
                  hoverSign = '';
                  HoverIcon = '▼';
              }
              
              const tooltipWidth = 140;
              const tooltipHeight = 78;
              const tooltipX = Math.max(tooltipWidth / 2 + 10, Math.min(width - (tooltipWidth / 2) - 10, hoverPoint.x));
              const tooltipY = Math.max(tooltipHeight + 15, hoverPoint.y - 15);

              return (
                <>
                  <line x1={hoverPoint.x} y1="0" x2={hoverPoint.x} y2={height} stroke={gridTextColor} strokeDasharray="4 4" opacity="0.4" />
                  <circle cx={hoverPoint.x} cy={hoverPoint.y} r="5" fill={tooltipBg} stroke={strokeColor} strokeWidth="2" />
                  
                  <rect 
                    x={tooltipX - tooltipWidth / 2} 
                    y={tooltipY - tooltipHeight} 
                    width={tooltipWidth} 
                    height={tooltipHeight} 
                    rx="6" 
                    fill={tooltipBg} 
                    stroke={tooltipBorder} 
                    strokeWidth="1.5" 
                    className="shadow-xl" 
                  />
                  
                  <text x={tooltipX} y={tooltipY - tooltipHeight + 18} fill={tooltipSubText} fontSize="10" textAnchor="middle" fontWeight="bold">
                    {chartLabels[hoveredIndex]}
                  </text>
                  
                  <text x={tooltipX} y={tooltipY - tooltipHeight + 36} fill={tooltipText} fontSize="14" textAnchor="middle" fontWeight="bold">
                    {formatPrice(currentP, currency, exchangeRate)}
                  </text>
                  
                  <text x={tooltipX} y={tooltipY - tooltipHeight + 52} fill={tooltipSubText} fontSize="10" textAnchor="middle">
                    Prev: {formatPrice(previousP, currency, exchangeRate)}
                  </text>
                  
                  <text x={tooltipX} y={tooltipY - tooltipHeight + 68} fill={hoverColor} fontSize="11" textAnchor="middle" fontWeight="bold">
                    {HoverIcon} {formatPrice(Math.abs(pDiff), currency, exchangeRate)} ({hoverSign}{pDiffPct.toFixed(2)}%)
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </svg>
    );
  };

  // 🟢 หุ้มทั้ง Application ด้วยคลาสธีมหลัก
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30 transition-colors duration-300">
        
        {/* Navbar */}
        <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              
              {/* Logo */}
              <div className="flex items-center gap-2">
                <Activity className="w-8 h-8 text-blue-500" />
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">
                  TechTick Pro
                </span>
                {isUsingRealApi && (
                  <span className="ml-2 px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] rounded-full border border-emerald-500/30 uppercase tracking-wide">
                    Live API
                  </span>
                )}
              </div>
              
              {/* Search Bar */}
              <div className="relative w-full max-w-md mx-4 hidden sm:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาหุ้นทั่วโลกจาก Finnhub (เช่น TSLA, F, KO)..."
                    className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all dark:text-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearching(true)}
                    onBlur={() => setTimeout(() => setIsSearching(false), 200)}
                  />
                  {isSearchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                </div>

                {isSearching && searchQuery && (
                  <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    {apiSearchResults.length > 0 ? (
                      apiSearchResults.map(stock => (
                        <button
                          key={stock.symbol}
                          className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex justify-between items-center"
                          onClick={() => handleSelectFromSearch(stock.symbol, stock.description)}
                        >
                          <div>
                            <div className="font-bold text-blue-600 dark:text-blue-400">{stock.symbol}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate w-64">{stock.description}</div>
                          </div>
                          {savedWatchlist.some(s => s.symbol === stock.symbol) && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                        {!isSearchLoading && 'พิมพ์เพื่อค้นหาผ่าน Global API'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 🟢 Controls (Currency & Theme) */}
              <div className="flex items-center gap-2 sm:gap-4">
                
                {/* ปุ่มสลับสกุลเงิน */}
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                  <button 
                    onClick={() => setCurrency('USD')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${currency === 'USD' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    USD
                  </button>
                  <button 
                    onClick={() => setCurrency('THB')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${currency === 'THB' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    THB
                  </button>
                </div>

                {/* ปุ่มสลับ Theme */}
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                  title="สลับโหมดหน้าจอ"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
                </button>
              </div>

            </div>
          </div>
        </nav>

        {pinErrorMsg && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 text-sm font-medium animate-bounce">
            <AlertCircle className="w-4 h-4" /> {pinErrorMsg}
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
          
          {/* ฝั่งซ้าย (ข้อมูลหลัก + กราฟ) */}
          <div className="flex-1 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-bold tracking-tight">{selectedStock.symbol}</h1>
                  <span className="text-lg text-slate-500 dark:text-slate-400 font-medium">{selectedStock.name}</span>
                  
                  <button
                    onClick={toggleWatchlist}
                    className={`ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isWatchlisted 
                        ? 'bg-yellow-50 dark:bg-slate-800 text-yellow-600 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-500/30 hover:bg-yellow-100 dark:hover:bg-slate-700' 
                        : 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-600/30'
                    }`}
                  >
                    {isWatchlisted ? <><Star className="w-3.5 h-3.5 fill-current" /> Watchlisted</> : <><Plus className="w-3.5 h-3.5" /> Add to Watchlist</>}
                  </button>
                </div>

                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-5xl font-light tracking-tight">
                    {formatPrice(currentPrice, currency, exchangeRate)}
                  </span>
                  {currentPrice > 0 && (
                    <div className={`flex items-center text-xl font-medium ${statusColorClass}`}>
                      <TrendIcon className="w-5 h-5 mr-1" />
                      {sign}{formatPrice(Math.abs(priceChange), currency, exchangeRate)} ({sign}{percentChange.toFixed(2)}%)
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> 
                  {isUsingRealApi ? 'ดึงข้อมูลจริงจาก Finnhub' : 'Simulation Mode'}
                  <span className="mx-2 text-slate-300 dark:text-slate-700">|</span>
                  Prev Close: {prevClose > 0 ? formatPrice(prevClose, currency, exchangeRate) : '-'}
                </div>
              </div>

              <div className="flex bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-1">
                {['1H', '1D', '1W', '1M', '3M', '1Y'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${timeframe === tf ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-300 dark:border-slate-700' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-6 h-[400px] w-full flex items-center justify-center relative shadow-sm dark:shadow-[inset_0_0_20px_rgba(0,0,0,0.2)] transition-colors duration-300">
              {renderChart()}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Market Cap', value: selectedStock.marketCap || 'N/A' },
                { label: 'P/E Ratio', value: selectedStock.pe || 'N/A' },
                { label: 'Prev Close', value: prevClose > 0 ? formatPrice(prevClose, currency, exchangeRate) : '-' },
                { label: '52W High', value: 'N/A' } 
              ].map((stat, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 rounded-lg p-4 shadow-sm backdrop-blur-sm transition-colors duration-300">
                  <div className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">{stat.label}</div>
                  <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ฝั่งขวา (Watchlist) */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">My Watchlist</h2>
              </div>
              {pinnedStocks.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">
                    หมุด {pinnedStocks.length}/5
                  </span>
                  <button onClick={() => setPinnedStocks([])} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors" title="ลบหมุดทั้งหมด">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="space-y-2 overflow-y-auto pr-1 pb-4 custom-scrollbar">
              {sortedWatchlist.length === 0 ? (
                <div className="text-center p-6 bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl border-dashed">
                  <Search className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-600 dark:text-slate-400 text-sm">ยังไม่มีหุ้นในรายการ</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">ค้นหาหุ้นด้านบนแล้วกด Add to Watchlist</p>
                </div>
              ) : (
                sortedWatchlist.map((stock) => {
                  const isActive = selectedStock.symbol === stock.symbol;
                  const isPinned = pinnedStocks.includes(stock.symbol);
                  
                  const sidePrice = (isPinned && pinnedPrices[stock.symbol]) 
                      ? pinnedPrices[stock.symbol].c 
                      : (stock.basePrice || 0); 
                  
                  const sidePrev = (isPinned && pinnedPrices[stock.symbol])
                      ? pinnedPrices[stock.symbol].pc
                      : (stock.prevClose || 0);
                      
                  const sideDiff = sidePrice - sidePrev;
                  const sidePercent = sidePrev ? (sideDiff / sidePrev) * 100 : 0;
                  
                  let itemColorClass = 'text-sky-500 dark:text-sky-400';
                  let itemSign = '';
                  if (sideDiff > 0) { itemColorClass = 'text-emerald-500 dark:text-emerald-400'; itemSign = '+'; }
                  else if (sideDiff < 0) { itemColorClass = 'text-red-500 dark:text-red-400'; itemSign = ''; }

                  return (
                    <button
                      key={stock.symbol}
                      onClick={() => setSelectedStock({ ...stock, basePrice: sidePrice, prevClose: sidePrev, marketCap: 'N/A', pe: 'N/A' })}
                      className={`w-full group flex items-center justify-between p-3 rounded-lg border transition-all text-left relative overflow-hidden ${
                        isActive ? 'bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-500/50 shadow-md' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {isPinned && <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500/80 rounded-l-lg" />}

                      <div className="flex items-center gap-3 pl-2">
                        <div 
                          onClick={(e) => togglePin(e, stock.symbol)}
                          className={`p-1.5 rounded-md transition-colors ${
                            isPinned ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-500/10' : 'text-slate-400 dark:text-slate-600 hover:text-yellow-500 hover:bg-slate-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            {stock.symbol}
                            {isPinned && isUsingRealApi && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate w-24">{stock.name}</div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                          {sidePrice > 0 ? formatPrice(sidePrice, currency, exchangeRate) : <Loader2 className="w-3 h-3 animate-spin inline-block text-slate-400" />}
                        </div>
                        {sidePrev > 0 && (
                          <div className={`text-[11px] flex items-center justify-end ${itemColorClass}`}>
                            {itemSign}{sidePercent.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}