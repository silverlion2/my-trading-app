import React, { useState, useEffect } from 'react';
import { Target, Info, AlertTriangle, TrendingUp, ShieldAlert, BookOpen, Lightbulb, Activity, ArrowUpDown, Search, Loader2, Zap, X, MessageSquare } from 'lucide-react';

// ============================================================================
// ⚠️ Webhook Configuration (No Database Needed!)
// ============================================================================
// Replace this with your Discord / Slack / Telegram Webhook URL
const FEEDBACK_WEBHOOK_URL = "https://discord.com/api/webhooks/1479532998834655363/kSjET4a37ROm2eL3DZ_Y6nUBKEgruCYbXLiZ1eOr_Ry9h2Ga5rEUZppdUswdkUnnXmLM"; 

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

  // Ad State (Control visibility of ad slots)
  const [isAdActive, setIsAdActive] = useState(false);

  // Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Fetch real data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/dashboard_data.json');
        if (!response.ok) throw new Error("Failed to load dashboard_data.json");
        const data = await response.json();
        setDatabase(data);
        setIsMockMode(false);
        if (!data["SPY"] && Object.keys(data).length > 0) setActiveTicker(Object.keys(data)[0]);
      } catch (err) {
        console.warn("Fetch failed, falling back to mock data.", err);
        setDatabase(mockDatabase);
        setIsMockMode(true);
      }
    };
    fetchData();
  }, []);

  // ============================================================================
  // Feedback Logic (Webhook approach - Zero Billing!)
  // ============================================================================
  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setIsSubmittingFeedback(true);
    
    try {
      if (FEEDBACK_WEBHOOK_URL && FEEDBACK_WEBHOOK_URL.startsWith('http')) {
        // Send to Discord / Slack Webhook
        await fetch(FEEDBACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚀 **New Feedback for GexEdge**\n> ${feedbackText}`
          })
        });
      } else {
        // Simulate network delay if webhook is not configured yet
        await new Promise(res => setTimeout(res, 800));
        console.log("Feedback recorded locally (Webhook not set):", feedbackText);
      }
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  if (!database) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <h2 className="text-lg font-bold animate-pulse">Loading Options Flow Data...</h2>
      </div>
    );
  }

  const activeData = database[activeTicker];
  if (!activeData) return <div className="min-h-screen bg-slate-950 text-slate-200 p-8">Ticker not found.</div>;

  const { metadata, indicators, gex_chart_data } = activeData;
  const maxGexAbs = Math.max(...gex_chart_data.map(d => Math.abs(d.net_gex)));

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const val = searchInput.trim().toUpperCase();
      if (database[val]) { setActiveTicker(val); setSearchInput(""); }
      else showToast("Ticker not found in free tier. Support us for more!");
    }
  };

  const handleSelect = (ticker) => {
    if (database[ticker]) { setActiveTicker(ticker); setSearchInput(""); }
  };

  const isPositiveGamma = metadata.spot_price >= indicators.zero_gamma;
  const diffToZeroGamma = Math.abs(metadata.spot_price - indicators.zero_gamma);
  const isNearFlip = diffToZeroGamma <= (metadata.spot_price * 0.005); 

  const getMarketContext = () => {
    const isPinning = Math.abs(metadata.spot_price - indicators.max_pain) <= (metadata.spot_price * 0.005);
    const isNearCallWall = indicators.call_wall - metadata.spot_price <= (metadata.spot_price * 0.01);
    const isNearPutWall = metadata.spot_price - indicators.put_wall <= (metadata.spot_price * 0.01);

    if (isNearFlip) return { title: "Zero Gamma Battleground", description: `Spot is testing the Flip Point at $${indicators.zero_gamma}. Holding above means Positive Gamma (lower volatility). Breaking below triggers Negative Gamma (selling pressure).`, color: "text-blue-400 border-blue-900 bg-blue-950/20" };
    if (isPinning) return { title: `Max Pain Pinning`, description: `Spot is pinned tightly to Max Pain $${indicators.max_pain}. Dealers are hedging to keep the price anchored. Selling premium is favored here.`, color: "text-purple-400 border-purple-900 bg-purple-950/20" };
    if (isNearCallWall) return { title: "Testing Call Wall (Gamma Squeeze Alert)", description: `Price is approaching the massive Call Wall at $${indicators.call_wall}. If broken with volume, it forces dealer buying, triggering a Gamma Squeeze.`, color: "text-emerald-400 border-emerald-900 bg-emerald-950/20" };
    if (isNearPutWall) return { title: "Testing Put Wall (Support Zone)", description: `Testing the ultimate Put Wall at $${indicators.put_wall}. Acts as strong support. If decisively broken, panic selling may follow.`, color: "text-red-400 border-red-900 bg-red-950/20" };
    
    return isPositiveGamma 
      ? { title: "Positive Gamma (Buy the Dip)", description: "Market is in Positive Gamma. Dealers are buying dips and selling rips, suppressing volatility.", color: "text-emerald-400 border-emerald-900 bg-emerald-950/20" }
      : { title: "Negative Gamma (Trend Following)", description: "Market is in Negative Gamma. Dealers are selling dips and buying rips, exacerbating volatility.", color: "text-amber-400 border-amber-900 bg-amber-950/20" };
  };

  const marketContext = getMarketContext();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30 relative">
      
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <Info size={18} className="text-blue-400" /> {toastMsg}
        </div>
      )}

      {isMockMode && (
        <div className="mb-6 bg-amber-900/50 border border-amber-500/50 text-amber-200 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <strong>Preview Mode Active:</strong> Failed to fetch <code>/dashboard_data.json</code>. Showing fallback mock data.
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full relative">
            <button onClick={() => setShowFeedbackModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
              <X size={24}/>
            </button>
            
            {!feedbackSubmitted ? (
              <>
                <div className="flex items-center gap-3 mb-4 text-blue-400">
                  <MessageSquare size={28} /> <h2 className="text-2xl font-bold text-white">Share Your Thoughts</h2>
                </div>
                <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                  We're building GexEdge for traders like you. Whether it's a feature request, a bug report, or just saying hi—your voice means the world to us and shapes our future roadmap! ❤️
                </p>
                <textarea 
                  rows="4"
                  placeholder="Tell us what you think..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 mb-6 focus:outline-none focus:border-blue-500 text-white resize-none"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowFeedbackModal(false)} className="px-5 py-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors">
                    Cancel
                  </button>
                  <button 
                    onClick={submitFeedback} 
                    disabled={isSubmittingFeedback || !feedbackText.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
                  >
                    {isSubmittingFeedback ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />} 
                    {isSubmittingFeedback ? 'Sending...' : 'Send Feedback'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-900/20 text-emerald-400 border border-emerald-900 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(52,211,153,0.2)]">
                  <Activity size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Thank You! 🎉</h2>
                <p className="text-slate-300 mb-8 text-sm leading-relaxed">
                  Your voice has been heard. We read every single message and use it to make GexEdge better for the entire trading community. Happy trading and stay profitable! 🚀
                </p>
                <button 
                  onClick={() => setShowFeedbackModal(false)} 
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold px-8 py-2.5 rounded-lg shadow-lg transition-colors w-full"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header Info */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-baseline gap-3">
            <span className="flex items-center gap-2">
              <Activity className="text-blue-500" size={32} />
              GexEdge
            </span>
            <span className="text-sm font-medium text-slate-400 hidden md:inline-block tracking-normal">
              — The Smart Options Radar
            </span>
          </h1>
          
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
              <div className="absolute left-3 text-slate-500"><Search size={16} /></div>
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

        <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
          {/* Feedback Button */}
          <button 
            onClick={() => {
              setFeedbackSubmitted(false);
              setFeedbackText("");
              setShowFeedbackModal(true);
            }}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <MessageSquare size={16} />
            <span className="hidden sm:inline font-medium">Feedback</span>
          </button>

          {/* Spot Price Block */}
          <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-lg">
            <div className="text-right pr-4 border-r border-slate-700">
              <p className="text-xs text-slate-400 font-medium mb-1">Spot Price</p>
              <div className="flex items-center gap-2 justify-end">
                <p className="text-2xl font-bold text-white">${metadata.spot_price.toFixed(2)}</p>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${isPositiveGamma ? 'bg-emerald-950/80 text-emerald-400 border-emerald-900' : 'bg-red-950/80 text-red-400 border-red-900'}`}>
                  {isPositiveGamma ? '🟢 +Gamma' : '🔴 -Gamma'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setShowEducation(!showEducation)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${showEducation ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              <BookOpen size={16} /> {showEducation ? 'Hide Guide' : 'Show Guide'}
            </button>
          </div>
        </div>
      </header>

      {/* Ad Placement */}
      {isAdActive && (
        <div className="w-full max-w-[728px] h-[90px] mx-auto bg-slate-900 border border-slate-800 rounded-xl mb-8 flex items-center justify-center text-slate-500 text-sm shadow-inner">
          <span className="opacity-50">Advertisement Space (728x90)</span>
        </div>
      )}

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
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700/50 z-0"></div>
            
            <div className="flex justify-between text-xs text-slate-500 mb-2 px-2 uppercase font-medium">
              <span>← Put Dominant (Dealer +Gamma)</span>
              <span>Strike</span>
              <span>Call Dominant (Dealer -Gamma) →</span>
            </div>

            <div className="flex flex-col py-2 relative">
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
                const widthPercent = data.net_gex === 0 || maxGexAbs === 0 ? 0 : (Math.abs(data.net_gex) / maxGexAbs) * 100;
                
                const isCallWall = data.strike === indicators.call_wall;
                const isPutWall = data.strike === indicators.put_wall;
                const isZeroGamma = data.strike === indicators.zero_gamma;
                const isSpotNear = Math.abs(data.strike - metadata.spot_price) <= (metadata.spot_price * 0.005);

                return (
                  <div key={data.strike} className={`flex items-center relative z-10 group hover:bg-slate-800/80 rounded-md p-1.5 -mx-1.5 transition-colors ${isZeroGamma ? 'bg-blue-900/20 my-1' : ''}`}>
                    <div className="flex-1 flex justify-end items-center pr-4">
                      {!isCallDominant && data.net_gex !== 0 && (
                        <div className="h-5 rounded-l-sm bg-red-500/80 border-r border-red-400 transition-all duration-500" style={{ width: `${widthPercent}%` }}></div>
                      )}
                      {isZeroGamma && (
                        <div className="mr-2 text-xs font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1">
                          <ArrowUpDown size={12} /> Flip Point
                        </div>
                      )}
                    </div>

                    <div className={`w-16 text-center font-mono text-sm relative z-20 ${isSpotNear ? 'text-blue-400 font-bold bg-slate-900 rounded-md px-1 ring-1 ring-blue-500/50' : isZeroGamma ? 'text-blue-300 font-bold' : 'text-slate-400'}`}>
                      {data.strike}
                      {isSpotNear && <div className="absolute top-1/2 -translate-y-1/2 -left-4 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></div>}
                    </div>

                    <div className="flex-1 flex justify-start items-center pl-4 relative">
                      {isCallDominant && data.net_gex !== 0 && (
                        <div className="h-5 rounded-r-sm bg-emerald-500/80 border-l border-emerald-400 transition-all duration-500" style={{ width: `${widthPercent}%` }}></div>
                      )}
                      {(isCallWall || isPutWall) && (
                        <div className={`absolute left-full ml-2 whitespace-nowrap text-xs px-2 py-0.5 rounded flex items-center gap-1 ${isCallWall ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900' : 'bg-red-950/80 text-red-400 border border-red-900'}`}>
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
          <div className={`bg-slate-900 border ${isNearFlip ? 'border-blue-500' : 'border-slate-800'} p-5 rounded-2xl relative overflow-hidden group transition-colors`}>
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity"><ArrowUpDown size={120} /></div>
            <h3 className="text-blue-400 font-bold flex items-center gap-2"><ArrowUpDown size={18} /> Zero Gamma (Flip Point)</h3>
            <div className="text-3xl font-black text-white font-mono mt-1 mb-3">${indicators.zero_gamma.toFixed(2)}</div>
            {showEducation && <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">The bull/bear boundary. Trade with the flow.</p>}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-purple-500/50 transition-colors">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity"><Target size={120} /></div>
            <h3 className="text-purple-400 font-bold flex items-center gap-2"><Target size={18} /> Max Pain</h3>
            <div className="text-3xl font-black text-white font-mono mt-1 mb-3">${indicators.max_pain.toFixed(2)}</div>
            {showEducation && <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">The price where option buyers lose the most. Acts as a magnet.</p>}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity"><TrendingUp size={120} /></div>
            <h3 className="text-emerald-400 font-bold flex items-center gap-2"><TrendingUp size={18} /> Call Wall (Resistance)</h3>
            <div className="text-3xl font-black text-white font-mono mt-1 mb-3">${indicators.call_wall.toFixed(2)}</div>
            {showEducation && <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">The massive ceiling defended by dealers. Hard to break.</p>}
          </div>

           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-red-500/50 transition-colors">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity"><ShieldAlert size={120} /></div>
            <h3 className="text-red-400 font-bold flex items-center gap-2"><ShieldAlert size={18} /> Put Wall (Support)</h3>
            <div className="text-3xl font-black text-white font-mono mt-1 mb-3">${indicators.put_wall.toFixed(2)}</div>
            {showEducation && <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">The absolute physical floor in the negative gamma zone.</p>}
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center text-sm text-slate-500 border-t border-slate-800 pt-6 pb-4 flex justify-between items-center px-4">
        <p>Data is for educational purposes only. Options trading involves high risk.</p>
        <p className="opacity-50">Built with Python & React</p>
      </footer>
    </div>
  );
};

export default App;