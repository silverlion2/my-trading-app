import React, { useState, useEffect } from 'react';
import { Target, Info, AlertTriangle, TrendingUp, ShieldAlert, ArrowRight, BookOpen, Lightbulb, Activity, ArrowUpDown, Search, Loader2 } from 'lucide-react';

// 模拟数据库 (当 fetch 失败时作为沙盒环境的兜底数据)
const mockDatabase = {
  "SPY": {
    metadata: { ticker: "SPY", spot_price: 508.45, expiration_date: "2024-03-15", updated_at: "Mocked Data (Preview)" },
    indicators: { max_pain: 507.00, call_wall: 515.00, put_wall: 495.00, zero_gamma: 502.00 },
    gex_chart_data: [
      { strike: 490, net_gex: -120000 }, { strike: 495, net_gex: -450000 }, { strike: 500, net_gex: -210000 },
      { strike: 502, net_gex: 0 }, { strike: 505, net_gex: 50000 }, { strike: 507, net_gex: 80000 },
      { strike: 510, net_gex: 230000 }, { strike: 515, net_gex: 580000 }, { strike: 520, net_gex: 150000 }
    ]
  },
  "QQQ": {
    metadata: { ticker: "QQQ", spot_price: 438.20, expiration_date: "2024-03-15", updated_at: "Mocked Data (Preview)" },
    indicators: { max_pain: 440.00, call_wall: 445.00, put_wall: 430.00, zero_gamma: 441.00 },
    gex_chart_data: [
      { strike: 425, net_gex: -80000 }, { strike: 430, net_gex: -320000 }, { strike: 435, net_gex: -150000 },
      { strike: 438, net_gex: -40000 }, { strike: 440, net_gex: 20000 }, { strike: 441, net_gex: 0 },
      { strike: 445, net_gex: 410000 }, { strike: 450, net_gex: 120000 }
    ]
  },
  "TSLA": {
    metadata: { ticker: "TSLA", spot_price: 172.50, expiration_date: "2024-03-15", updated_at: "Mocked Data (Preview)" },
    indicators: { max_pain: 175.00, call_wall: 185.00, put_wall: 160.00, zero_gamma: 168.00 },
    gex_chart_data: [
      { strike: 155, net_gex: -30000 }, { strike: 160, net_gex: -180000 }, { strike: 165, net_gex: -60000 },
      { strike: 168, net_gex: 0 }, { strike: 170, net_gex: 40000 }, { strike: 172.5, net_gex: 55000 },
      { strike: 175, net_gex: 90000 }, { strike: 180, net_gex: 120000 }, { strike: 185, net_gex: 210000 }
    ]
  }
};

const App = () => {
  // State for data and UI
  const [database, setDatabase] = useState(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [activeTicker, setActiveTicker] = useState("SPY");
  const [searchInput, setSearchInput] = useState("");
  const [showEducation, setShowEducation] = useState(true);

  // Fetch real data from dashboard_data.json on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/dashboard_data.json');
        if (!response.ok) {
          throw new Error("Failed to load dashboard_data.json");
        }
        const data = await response.json();
        setDatabase(data);
        setIsMockMode(false);
        // If SPY isn't in the dataset, default to the first available ticker
        if (!data["SPY"] && Object.keys(data).length > 0) {
          setActiveTicker(Object.keys(data)[0]);
        }
      } catch (err) {
        console.warn("Fetch failed. Falling back to mock data.", err);
        // Fallback to mock data to prevent crashes
        setDatabase(mockDatabase);
        setIsMockMode(true);
      }
    };

    fetchData();
  }, []);

  if (!database) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <h2 className="text-lg font-bold animate-pulse">Loading Options Flow Data...</h2>
      </div>
    );
  }

  // Safely get data for active ticker
  const activeData = database[activeTicker];
  
  if (!activeData) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 p-8">Ticker {activeTicker} data not found in database.</div>;
  }

  const { metadata, indicators, gex_chart_data } = activeData;

  // Find the maximum absolute GEX value for calculating chart bar widths
  const maxGexAbs = Math.max(...gex_chart_data.map(d => Math.abs(d.net_gex)));

  // Handle search input submission
  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const val = searchInput.trim().toUpperCase();
      if (database[val]) {
        setActiveTicker(val);
        setSearchInput("");
      }
      // Silently ignore if ticker is not in database
    }
  };

  // Handle quick select clicks
  const handleSelect = (ticker) => {
    if (database[ticker]) {
      setActiveTicker(ticker);
      setSearchInput("");
    }
  };

  // Determine global Gamma environment and calculate key metric deviations
  const isPositiveGamma = metadata.spot_price >= indicators.zero_gamma;
  const diffToZeroGamma = Math.abs(metadata.spot_price - indicators.zero_gamma);
  const isNearFlip = diffToZeroGamma <= (metadata.spot_price * 0.005); // ~0.5% buffer

  // Smart Market Context AI Logic
  const getMarketContext = () => {
    const diffToMaxPain = Math.abs(metadata.spot_price - indicators.max_pain);
    const isPinning = diffToMaxPain <= (metadata.spot_price * 0.005);
    const isNearCallWall = indicators.call_wall - metadata.spot_price <= (metadata.spot_price * 0.01);
    const isNearPutWall = metadata.spot_price - indicators.put_wall <= (metadata.spot_price * 0.01);

    let title = "";
    let description = "";
    let color = "";

    if (isNearFlip) {
      title = "Zero Gamma Battleground (Directional Shift)";
      description = `Spot is testing the Flip Point at $${indicators.zero_gamma}. Holding above means Positive Gamma (lower volatility, grind higher). Breaking below triggers Negative Gamma (higher volatility, selling pressure). Watch for volume confirmation.`;
      color = "text-blue-400 border-blue-900 bg-blue-950/20";
    } else if (isPinning) {
      title = `Max Pain Pinning + ${isPositiveGamma ? 'Positive Gamma' : 'Negative Gamma'}`;
      description = `Spot is pinned tightly to Max Pain $${indicators.max_pain}. Dealers are hedging to keep the price anchored. Directional single-leg options carry high Theta burn risk. Selling premium is favored here.`;
      color = "text-purple-400 border-purple-900 bg-purple-950/20";
    } else if (isNearCallWall) {
      title = "Testing Call Wall (Gamma Squeeze Alert)";
      description = `Price is approaching the massive Call Wall at $${indicators.call_wall} in a strong Positive Gamma state. This is major resistance. However, a high-volume breakout forces dealer buying, potentially triggering a Gamma Squeeze.`;
      color = "text-emerald-400 border-emerald-900 bg-emerald-950/20";
    } else if (isNearPutWall) {
      title = "Testing Put Wall (Support Zone)";
      description = `Price has dropped deep into Negative Gamma and is testing the ultimate Put Wall at $${indicators.put_wall}. This acts as strong support. If decisively broken, panic selling and capitulation may follow.`;
      color = "text-red-400 border-red-900 bg-red-950/20";
    } else {
      title = isPositiveGamma ? "Positive Gamma (Buy the Dip)" : "Negative Gamma (Trend Following)";
      description = isPositiveGamma 
        ? "Market is in Positive Gamma. Dealers are buying dips and selling rips, suppressing volatility. The intraday trend is generally stable, favoring long setups at support levels."
        : "Market is in Negative Gamma. Dealers are selling dips and buying rips, exacerbating volatility. Avoid catching falling knives; follow the momentum trend instead.";
      color = isPositiveGamma ? "text-emerald-400 border-emerald-900 bg-emerald-950/20" : "text-amber-400 border-amber-900 bg-amber-950/20";
    }

    return { title, description, color };
  };

  const marketContext = getMarketContext();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      
      {/* 针对预览沙盒的警告提示 */}
      {isMockMode && (
        <div className="mb-6 bg-amber-900/50 border border-amber-500/50 text-amber-200 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <strong>No Data File Found:</strong> Failed to fetch <code>/dashboard_data.json</code>. Showing mock data. <br />
            <span className="opacity-80">Run your Python script to generate real data, place it in the public folder, and refresh.</span>
          </div>
        </div>
      )}

      {/* Header Info */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Activity className="text-blue-500" size={32} />
            Smart Options Radar
          </h1>
          
          {/* Ticker Switch & Search */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex flex-wrap bg-slate-900 rounded-lg p-1 border border-slate-800 max-w-2xl">
              {Object.keys(database).map(ticker => (
                <button
                  key={ticker}
                  onClick={() => handleSelect(ticker)}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${activeTicker === ticker ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  {ticker}
                </button>
              ))}
            </div>
            
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-500">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Search Ticker..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                onKeyDown={handleSearch}
                className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white uppercase placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-48"
              />
            </div>
          </div>

          <p className="text-slate-400 mt-4 flex items-center gap-2 text-sm">
            <span>Ticker: <strong className="text-blue-400 text-base">{metadata.ticker}</strong></span>
            <span className="text-slate-600">|</span>
            <span>Target Expiry: <strong className="text-slate-200">{metadata.expiration_date}</strong></span>
            <span className="text-slate-600">|</span>
            <span>Updated: {metadata.updated_at}</span>
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800 mt-4 md:mt-0">
          <div className="text-right pr-4 border-r border-slate-700">
            <p className="text-xs text-slate-400 font-medium mb-1">Spot Price</p>
            <div className="flex items-center gap-2 justify-end">
              <p className="text-2xl font-bold text-white">${metadata.spot_price.toFixed(2)}</p>
              {/* Global Gamma Status Indicator */}
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${isPositiveGamma ? 'bg-emerald-950/80 text-emerald-400 border-emerald-900' : 'bg-red-950/80 text-red-400 border-red-900'}`}>
                {isPositiveGamma ? '🟢 Positive Gamma' : '🔴 Negative Gamma'}
              </span>
            </div>
          </div>
          <button 
            onClick={() => setShowEducation(!showEducation)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${showEducation ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <BookOpen size={16} />
            {showEducation ? 'Hide Guide' : 'Show Guide'}
          </button>
        </div>
      </header>

      {/* Smart Market Context Banner */}
      <div className={`mb-8 p-5 rounded-2xl border flex flex-col md:flex-row gap-4 items-start md:items-center ${marketContext.color}`}>
        <div className="p-3 bg-slate-950/50 rounded-full shrink-0">
          <Lightbulb size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg mb-1">AI Market Context: {marketContext.title}</h3>
          <p className="text-sm opacity-80 leading-relaxed">{marketContext.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Net GEX Profile Chart */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
              Net GEX Profile & Gamma Zones
            </h2>
          </div>

          {showEducation && (
            <div className="mb-6 text-sm text-slate-300 bg-blue-950/20 border border-blue-900/50 p-4 rounded-xl leading-relaxed">
              <strong className="text-blue-400 block mb-1">Beginner's Guide: Understanding Gamma Zones</strong>
              👉 The <strong className="text-blue-400">Flip Point (Zero Axis)</strong> is the waterline. When Spot is above it, we are in the <strong className="text-emerald-400">Positive Gamma Zone (above water)</strong>: volatility is compressed, favoring mean-reversion and buying dips.<br/>
              👉 Dropping below the Flip Point enters the <strong className="text-red-400">Negative Gamma Zone (underwater)</strong>: dealer hedging acts as trend-amplifiers, leading to explosive, volatile moves.
            </div>
          )}

          {/* Pure CSS Horizontal Bar Chart */}
          <div className="relative mt-4 flex-1">
            {/* Zero Axis Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700/50 z-0"></div>
            
            {/* Chart Axis Labels */}
            <div className="flex justify-between text-xs text-slate-500 mb-2 px-2 uppercase font-medium">
              <span>← Put Dominant (Dealer +Gamma)</span>
              <span>Strike</span>
              <span>Call Dominant (Dealer -Gamma) →</span>
            </div>

            <div className="flex flex-col py-2 relative">
              {/* Background Zone Overlay */}
              <div className="absolute top-0 bottom-0 left-0 right-0 z-0 pointer-events-none flex flex-col">
                <div className="flex-1 bg-red-950/10 border-b border-dashed border-red-900/30 relative">
                  <div className="absolute left-2 top-2 text-xs font-bold text-red-900/60 uppercase tracking-widest">Negative Gamma Zone</div>
                </div>
                <div className="flex-1 bg-emerald-950/10 relative">
                  <div className="absolute right-2 bottom-2 text-xs font-bold text-emerald-900/60 uppercase tracking-widest">Positive Gamma Zone</div>
                </div>
              </div>

              {gex_chart_data.map((data) => {
                const isCallDominant = data.net_gex > 0;
                // Calculate width percentage safely to avoid dividing by 0
                const widthPercent = data.net_gex === 0 || maxGexAbs === 0 ? 0 : (Math.abs(data.net_gex) / maxGexAbs) * 100;
                
                // Identify key levels
                const isCallWall = data.strike === indicators.call_wall;
                const isPutWall = data.strike === indicators.put_wall;
                const isZeroGamma = data.strike === indicators.zero_gamma;
                const isSpotNear = Math.abs(data.strike - metadata.spot_price) <= (metadata.spot_price * 0.005);

                return (
                  <div key={data.strike} className={`flex items-center relative z-10 group hover:bg-slate-800/80 rounded-md p-1.5 -mx-1.5 transition-colors ${isZeroGamma ? 'bg-blue-900/20 my-1' : ''}`}>
                    
                    {/* Left Side (Put Zone) */}
                    <div className="flex-1 flex justify-end items-center pr-4">
                      {!isCallDominant && data.net_gex !== 0 && (
                        <div 
                          className={`h-5 rounded-l-sm bg-red-500/80 border-r border-red-400 transition-all duration-500`} 
                          style={{ width: `${widthPercent}%` }}
                        ></div>
                      )}
                      
                      {/* Zero Gamma Tag (Left) */}
                      {isZeroGamma && (
                        <div className="mr-2 text-xs font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1">
                          <ArrowUpDown size={12} />
                          Flip Point
                        </div>
                      )}
                    </div>

                    {/* Middle: Strike */}
                    <div className={`w-16 text-center font-mono text-sm relative z-20 ${isSpotNear ? 'text-blue-400 font-bold bg-slate-900 rounded-md px-1 ring-1 ring-blue-500/50' : isZeroGamma ? 'text-blue-300 font-bold' : 'text-slate-400'}`}>
                      {data.strike}
                      {isSpotNear && (
                        <div className="absolute top-1/2 -translate-y-1/2 -left-4 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></div>
                      )}
                    </div>

                    {/* Right Side (Call Zone) */}
                    <div className="flex-1 flex justify-start items-center pl-4 relative">
                      {isCallDominant && data.net_gex !== 0 && (
                        <div 
                          className={`h-5 rounded-r-sm bg-emerald-500/80 border-l border-emerald-400 transition-all duration-500`} 
                          style={{ width: `${widthPercent}%` }}
                        ></div>
                      )}

                      {/* Special Level Tags */}
                      {(isCallWall || isPutWall) && (
                        <div className={`absolute left-full ml-2 whitespace-nowrap text-xs px-2 py-0.5 rounded flex items-center gap-1
                          ${isCallWall ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900' : 'bg-red-950/80 text-red-400 border border-red-900'}`}
                        >
                          {isCallWall ? 'Call Wall (Resistance)' : 'Put Wall (Support)'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-500 pt-4 border-t border-slate-800 uppercase">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div> Spot Price</span>
               <span className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500/80 rounded-sm"></div> Call Dominant (+GEX)</span>
               <span className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500/80 rounded-sm"></div> Put Dominant (-GEX)</span>
            </div>
          </div>
        </div>

        {/* Right: Top 4 Key Metrics */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* 1. Zero Gamma Flip Point */}
          <div className={`bg-slate-900 border ${isNearFlip ? 'border-blue-500' : 'border-slate-800'} p-5 rounded-2xl relative overflow-hidden group transition-colors`}>
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <ArrowUpDown size={120} />
            </div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-blue-400 font-bold flex items-center gap-2">
                <ArrowUpDown size={18} /> Zero Gamma (Flip Point)
              </h3>
            </div>
            <div className="text-3xl font-black text-white font-mono mt-1 mb-3">
              ${indicators.zero_gamma.toFixed(2)}
            </div>
            {showEducation ? (
               <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800">
               <strong className="text-slate-300">How to use?</strong><br/>The bull/bear boundary. **Above it**, dealers buy dips/sell rips (calm grinds). **Below it**, dealers sell dips/buy rips (volatile trends). Trade with the flow.
             </p>
            ) : null}
          </div>

          {/* 2. Max Pain Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-purple-500/50 transition-colors">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <Target size={120} />
            </div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-purple-400 font-bold flex items-center gap-2">
                <Target size={18} /> Max Pain
              </h3>
            </div>
            <div className="text-3xl font-black text-white font-mono mt-1 mb-3">
              ${indicators.max_pain.toFixed(2)}
            </div>
            {showEducation ? (
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <strong className="text-slate-300">How to use?</strong><br/>
                The price where option buyers lose the most. Without major catalysts, the underlying tends to gravitate towards this price due to dealer hedging.
              </p>
            ) : null}
          </div>

          {/* 3. Call Wall Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <TrendingUp size={120} />
            </div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-emerald-400 font-bold flex items-center gap-2">
                <TrendingUp size={18} /> Call Wall (Resistance)
              </h3>
            </div>
            <div className="text-3xl font-black text-white font-mono mt-1 mb-3">
              ${indicators.call_wall.toFixed(2)}
            </div>
            {showEducation ? (
               <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800">
               <strong className="text-slate-300">How to use?</strong><br/>
               The massive ceiling defended by dealers. Extremely hard to break. However, a high-volume breakout forces a rapid short-covering rally (Gamma Squeeze).
             </p>
            ) : null}
          </div>

           {/* 4. Put Wall Card */}
           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-red-500/50 transition-colors">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <ShieldAlert size={120} />
            </div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-red-400 font-bold flex items-center gap-2">
                <ShieldAlert size={18} /> Put Wall (Support)
              </h3>
            </div>
            <div className="text-3xl font-black text-white font-mono mt-1 mb-3">
              ${indicators.put_wall.toFixed(2)}
            </div>
            {showEducation ? (
               <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800">
               <strong className="text-slate-300">How to use?</strong><br/>
               The absolute physical floor in the negative gamma zone. Bounces are common here; but a clean break causes dealer capitulation and cascading sell-offs.
             </p>
            ) : null}
          </div>

        </div>
      </div>

      <footer className="mt-12 text-center text-sm text-slate-500 border-t border-slate-800 pt-6 pb-4">
        <p>Data is for educational purposes only. Options trading involves high risk.</p>
        <p className="mt-2 text-xs opacity-50">Built with Python & React</p>
      </footer>
    </div>
  );
};

export default App;