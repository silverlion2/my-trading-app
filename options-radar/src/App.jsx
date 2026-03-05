import React, { useState, useEffect } from 'react';
import { Target, Info, AlertTriangle, TrendingUp, ShieldAlert, BookOpen, Lightbulb, Activity, ArrowUpDown, Search, Loader2, Lock, X, Coffee, Megaphone, Heart } from 'lucide-react';

// ============================================================================
// 1. 本地 Mock 数据兜底 (防报错)
// ============================================================================
const mockDatabase = {
  "SPY": {
    metadata: { ticker: "SPY", spot_price: 508.45, expiration_date: "Mocked Data", updated_at: "Please run Python script" },
    indicators: { max_pain: 507.00, call_wall: 515.00, put_wall: 495.00, zero_gamma: 502.00 },
    gex_chart_data: [
      { strike: 490, net_gex: -120000 }, { strike: 495, net_gex: -450000 }, { strike: 500, net_gex: -210000 },
      { strike: 502, net_gex: 0 }, { strike: 505, net_gex: 50000 }, { strike: 507, net_gex: 80000 },
      { strike: 510, net_gex: 230000 }, { strike: 515, net_gex: 580000 }, { strike: 520, net_gex: 150000 }
    ]
  }
};

const App = () => {
  // 核心状态
  const [database, setDatabase] = useState(null);
  const [activeTicker, setActiveTicker] = useState("SPY");
  const [searchInput, setSearchInput] = useState("");
  const [showEducation, setShowEducation] = useState(true);
  const [isMockMode, setIsMockMode] = useState(false);

  // Premium 弹窗状态
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [targetTicker, setTargetTicker] = useState("");

  // 加载每日跑批的静态 JSON
  useEffect(() => {
    const fetchStaticData = async () => {
      try {
        const response = await fetch('/dashboard_data.json');
        if (!response.ok) throw new Error("文件不存在");
        const data = await response.json();
        setDatabase(data);
        setIsMockMode(false);
        if (!data["SPY"] && Object.keys(data).length > 0) {
          setActiveTicker(Object.keys(data)[0]);
        }
      } catch (err) {
        setDatabase(mockDatabase);
        setIsMockMode(true);
      }
    };
    fetchStaticData();
  }, []);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const val = searchInput.trim().toUpperCase();
      if (!val) return;

      if (database[val]) {
        setActiveTicker(val);
        setSearchInput("");
      } else {
        setTargetTicker(val);
        setShowPremiumModal(true);
        setSearchInput("");
      }
    }
  };

  if (!database) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <h2 className="text-lg font-bold animate-pulse">Loading Options Matrix...</h2>
      </div>
    );
  }

  const activeData = database[activeTicker];
  if (!activeData) return <div className="min-h-screen bg-slate-950 p-8">No data available</div>;

  const { metadata, indicators, gex_chart_data } = activeData;
  const maxGexAbs = Math.max(...gex_chart_data.map(d => Math.abs(d.net_gex)));

  const isPositiveGamma = metadata.spot_price >= indicators.zero_gamma;
  const diffToZeroGamma = Math.abs(metadata.spot_price - indicators.zero_gamma);
  const isNearFlip = diffToZeroGamma <= (metadata.spot_price * 0.005); 

  const getMarketContext = () => {
    const diffToMaxPain = Math.abs(metadata.spot_price - indicators.max_pain);
    const isPinning = diffToMaxPain <= (metadata.spot_price * 0.005);
    const isNearCallWall = indicators.call_wall - metadata.spot_price <= (metadata.spot_price * 0.01);
    const isNearPutWall = metadata.spot_price - indicators.put_wall <= (metadata.spot_price * 0.01);

    if (isNearFlip) return { title: "Zero Gamma Battleground", color: "text-blue-400 border-blue-900 bg-blue-950/20", desc: "Spot is testing the Zero Gamma flip point. Holding above means a steady grind higher; breaking below triggers high-volatility negative feedback." };
    if (isPinning) return { title: "Max Pain Pinning", color: "text-purple-400 border-purple-900 bg-purple-950/20", desc: "Dealers are hedging to pin the spot near Max Pain. High Theta decay zone. Directional buying is not recommended." };
    if (isNearCallWall) return { title: "Testing Call Wall Resistance", color: "text-emerald-400 border-emerald-900 bg-emerald-950/20", desc: "Approaching massive Call Wall resistance. Hard to break, but a high-volume breakout could trigger a Gamma Squeeze." };
    if (isNearPutWall) return { title: "Testing Put Wall Support", color: "text-red-400 border-red-900 bg-red-950/20", desc: "Testing the ultimate Put Wall support. High probability of a bounce. A high-volume breakdown indicates panic selling." };
    return { 
      title: isPositiveGamma ? "Positive Gamma (Low Volatility Grind)" : "Negative Gamma (High Volatility Trend)", 
      color: isPositiveGamma ? "text-emerald-400 border-emerald-900 bg-emerald-950/20" : "text-amber-400 border-amber-900 bg-amber-950/20",
      desc: isPositiveGamma ? "Market is calm. Dealers are buying dips and selling rips, suppressing volatility. Look for support to buy." : "Market is fragile. Dealers are selling dips and buying rips, amplifying volatility. Follow the trend, don't catch falling knives." 
    };
  };

  const marketContext = getMarketContext();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 lg:p-8 font-sans relative">
      
      {/* ⚠️ Premium Upsell Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowPremiumModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <Lock size={28} /> <h2 className="text-2xl font-bold text-white">Premium Feature</h2>
            </div>
            <p className="text-slate-300 mb-6 text-base leading-relaxed">
              Ticker <strong className="text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{targetTicker}</strong> is not in our pre-loaded Top 20 list.<br/><br/>
              Customized ticker search and on-the-fly live computation will be available for <span className="text-amber-400 font-bold">Premium users</span> in the future. Stay tuned!
            </p>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowPremiumModal(false)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-2.5 rounded-lg shadow-lg transition-colors">Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Navigation */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Activity className="text-blue-500" size={32} />
            Smart Options Radar
          </h1>
          
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex flex-wrap bg-slate-900 rounded-lg p-1 border border-slate-800 max-w-3xl">
              {Object.keys(database).map(ticker => (
                <button
                  key={ticker}
                  onClick={() => setActiveTicker(ticker)}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${activeTicker === ticker ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  {ticker}
                </button>
              ))}
            </div>
            
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-slate-500"><Search size={16} /></div>
              <input
                type="text"
                placeholder="Search ticker..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                onKeyDown={handleSearch}
                className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white uppercase placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all w-40 md:w-48"
              />
              <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Lock size={14} className="text-amber-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 xl:mt-0">
          {/* Donation / Support Button */}
          <a 
            href="https://buy.stripe.com/test_5kQ00bh2u5jP6G5du52B200" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-pink-900/20 group"
          >
            <Heart size={18} className="group-hover:animate-pulse" />
            Support Us
          </a>

          <div className="flex items-center gap-4 bg-slate-900 p-2.5 rounded-xl border border-slate-800 shadow-lg">
            <div className="text-right pr-4 border-r border-slate-700">
              <p className="text-xs text-slate-400 font-medium mb-1">Spot Price</p>
              <div className="flex items-center gap-2 justify-end">
                <p className="text-xl font-bold text-white">${metadata.spot_price.toFixed(2)}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowEducation(!showEducation)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${showEducation ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              <BookOpen size={16} /> Guide
            </button>
          </div>
        </div>
      </header>

      {/* Quick Start Guide (Collapsible) */}
      {showEducation && (
        <div className="mb-6 bg-slate-800/50 border border-slate-700 p-5 rounded-2xl flex flex-col md:flex-row gap-6 animate-in slide-in-from-top-4">
          <div className="flex-1">
            <h3 className="text-white font-bold flex items-center gap-2 mb-2"><Info size={18} className="text-blue-400"/> How to use this dashboard?</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              This dashboard tracks the massive options positions held by Wall Street Market Makers. Their hedging activities act as invisible magnets and walls for the stock price.
            </p>
            <ul className="text-sm text-slate-400 space-y-1.5 list-disc pl-4">
              <li><strong className="text-blue-400">Zero Gamma:</strong> The trend boundary. Above it = Calm/Bullish. Below it = High Volatility/Bearish.</li>
              <li><strong className="text-emerald-400">Call Wall:</strong> Major resistance ceiling. Hard to break above.</li>
              <li><strong className="text-red-400">Put Wall:</strong> Major support floor. Hard to break below.</li>
            </ul>
          </div>
          <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center">
             <p className="text-xs text-slate-400 mb-2">Data Updated: {metadata.updated_at}</p>
             <p className="text-xs text-slate-400">Source: <span className="text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{metadata.expiration_date}</span></p>
          </div>
        </div>
      )}

      {/* 🟢 Ad Space Placeholder 1 (Top Banner) */}
      <div className="w-full h-24 mb-6 bg-slate-900/30 border-2 border-dashed border-slate-700/50 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:bg-slate-900/50 hover:border-slate-600 transition-colors cursor-pointer group">
        <Megaphone size={24} className="mb-1 opacity-50 group-hover:opacity-80" />
        <span className="text-sm font-medium tracking-widest uppercase">Advertisement Space (728 x 90)</span>
      </div>

      {/* AI Market Context */}
      <div className={`mb-6 p-5 rounded-2xl border flex flex-col md:flex-row gap-4 items-start md:items-center ${marketContext.color}`}>
        <div className="p-3 bg-slate-950/50 rounded-full shrink-0"><Lightbulb size={24} /></div>
        <div>
          <h3 className="font-bold text-lg mb-1">AI Market Context: {marketContext.title}</h3>
          <p className="text-sm opacity-90 leading-relaxed">{marketContext.desc}</p>
        </div>
      </div>

      {/* 🌟 核心指标前置 (4 Metrics Horizontal Layout) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={`bg-slate-900 border ${isNearFlip ? 'border-blue-500 shadow-blue-900/20 shadow-lg' : 'border-slate-800'} p-5 rounded-2xl flex flex-col justify-center`}>
          <h3 className="text-blue-400 font-bold flex items-center gap-2 mb-1 text-sm"><ArrowUpDown size={16} /> Zero Gamma</h3>
          <div className="text-3xl font-black text-white font-mono">${indicators.zero_gamma.toFixed(2)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-center">
          <h3 className="text-purple-400 font-bold flex items-center gap-2 mb-1 text-sm"><Target size={16} /> Max Pain</h3>
          <div className="text-3xl font-black text-white font-mono">${indicators.max_pain.toFixed(2)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-center">
          <h3 className="text-emerald-400 font-bold flex items-center gap-2 mb-1 text-sm"><TrendingUp size={16} /> Call Wall (Resist)</h3>
          <div className="text-3xl font-black text-white font-mono">${indicators.call_wall.toFixed(2)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-center">
          <h3 className="text-red-400 font-bold flex items-center gap-2 mb-1 text-sm"><ShieldAlert size={16} /> Put Wall (Support)</h3>
          <div className="text-3xl font-black text-white font-mono">${indicators.put_wall.toFixed(2)}</div>
        </div>
      </div>

      {/* Main Layout Split: Chart & Right Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left: Global GEX Profile Chart (Takes 9 columns) */}
        <div className="xl:col-span-9 bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span> Global Net GEX Profile
            </h2>
          </div>

          <div className="relative mt-2 flex-1">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700/50 z-0"></div>
            <div className="flex justify-between text-xs text-slate-500 mb-2 px-2 uppercase font-medium">
              <span>← Put Dominant (-Gamma)</span><span>Strike</span><span>Call Dominant (+Gamma) →</span>
            </div>

            <div className="flex flex-col py-2 relative">
              {gex_chart_data.map((data) => {
                const isCallDominant = data.net_gex > 0;
                const widthPercent = data.net_gex === 0 || maxGexAbs === 0 ? 0 : (Math.abs(data.net_gex) / maxGexAbs) * 100;
                const isCallWall = data.strike === indicators.call_wall;
                const isPutWall = data.strike === indicators.put_wall;
                const isZeroGamma = data.strike === indicators.zero_gamma;
                const isSpotNear = Math.abs(data.strike - metadata.spot_price) <= (metadata.spot_price * 0.005);

                return (
                  <div key={data.strike} className={`flex items-center relative z-10 hover:bg-slate-800/80 rounded-md p-1.5 -mx-1.5 transition-colors ${isZeroGamma ? 'bg-blue-900/20' : ''}`}>
                    <div className="flex-1 flex justify-end items-center pr-4">
                      {!isCallDominant && data.net_gex !== 0 && (
                        <div className="h-5 rounded-l-sm bg-red-500/80 border-r border-red-400" style={{ width: `${widthPercent}%` }}></div>
                      )}
                      {isZeroGamma && (
                        <div className="mr-2 text-xs font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1">
                          <ArrowUpDown size={12} /> Flip Point
                        </div>
                      )}
                    </div>
                    <div className={`w-16 text-center font-mono text-sm relative z-20 ${isSpotNear ? 'text-white font-bold bg-blue-600 rounded px-1 shadow-lg shadow-blue-900/50' : 'text-slate-400'}`}>
                      {data.strike}
                    </div>
                    <div className="flex-1 flex justify-start items-center pl-4 relative">
                      {isCallDominant && data.net_gex !== 0 && (
                        <div className="h-5 rounded-r-sm bg-emerald-500/80 border-l border-emerald-400" style={{ width: `${widthPercent}%` }}></div>
                      )}
                      {(isCallWall || isPutWall) && (
                        <div className={`absolute left-full ml-2 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded
                          ${isCallWall ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-red-950 text-red-400 border border-red-900'}`}
                        >
                          {isCallWall ? 'Call Wall' : 'Put Wall'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Monetization & Ad Space (Takes 3 columns) */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          
          {/* Premium Teaser Box */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 p-6 rounded-2xl flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-bl-full blur-xl"></div>
            <Lock className="text-amber-500 mb-4" size={36} />
            <h3 className="text-white font-bold text-lg mb-2">Want to search any ticker?</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Unlock real-time Greek profiling for 5,000+ US stocks. Custom search feature is coming to Premium members.
            </p>
            <button className="w-full bg-slate-800 border border-slate-600 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
              Join Waitlist
            </button>
          </div>

          {/* 🟢 Ad Space Placeholder 2 (Sidebar Skyscraper) */}
          <div className="w-full h-96 bg-slate-900/30 border-2 border-dashed border-slate-700/50 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:bg-slate-900/50 hover:border-slate-600 transition-colors cursor-pointer group flex-1">
            <Megaphone size={32} className="mb-2 opacity-50 group-hover:opacity-80" />
            <span className="text-sm font-medium tracking-widest uppercase text-center px-4">Advertisement<br/>(300 x 600)</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;