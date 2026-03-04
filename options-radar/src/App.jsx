import React, { useState, useEffect } from 'react';
import { Target, Info, AlertTriangle, TrendingUp, ShieldAlert, BookOpen, Lightbulb, Activity, ArrowUpDown, Search, Loader2, Lock, X } from 'lucide-react';

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

  // ============================================================================
  // 搜索拦截逻辑 (Mock Premium Upsell)
  // ============================================================================
  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const val = searchInput.trim().toUpperCase();
      if (!val) return;

      if (database[val]) {
        // 如果在 Top 20 数据库里，直接显示
        setActiveTicker(val);
        setSearchInput("");
      } else {
        // 如果不在库里，弹出 Premium 提示
        setTargetTicker(val);
        setShowPremiumModal(true);
        setSearchInput("");
      }
    }
  };

  // 渲染 Loading
  if (!database) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <h2 className="text-lg font-bold animate-pulse">Loading Options Matrix...</h2>
      </div>
    );
  }

  const activeData = database[activeTicker];
  if (!activeData) return <div className="min-h-screen bg-slate-950 p-8">暂无数据</div>;

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

    if (isNearFlip) return { title: "多空分水岭战役", color: "text-blue-400 border-blue-900 bg-blue-950/20", desc: "现价正在试探零伽马反转点。若站稳则回归平缓上涨，跌破则进入高波动负反馈区间。" };
    if (isPinning) return { title: "Max Pain 引力拉扯", color: "text-purple-400 border-purple-900 bg-purple-950/20", desc: "做市商正在对冲压制现价，使其贴近最大痛点。此区间适合 Theta 耗损策略，不建议买入单边期权。" };
    if (isNearCallWall) return { title: "触及天花板阻力", color: "text-emerald-400 border-emerald-900 bg-emerald-950/20", desc: "逼近巨大的 Call Wall 阻力。通常难以逾越，但一旦带量突破，将触发做市商追涨逼空 (Gamma Squeeze)。" };
    if (isNearPutWall) return { title: "触及铁底支撑", color: "text-red-400 border-red-900 bg-red-950/20", desc: "价格落入深水区并测试 Put Wall 终极支撑。大概率产生反弹，若放量跌破则预示恐慌性抛售的开始。" };
    return { 
      title: isPositiveGamma ? "正伽马主导 (低波动震荡上涨)" : "负伽马主导 (高波动趋势跟随)", 
      color: isPositiveGamma ? "text-emerald-400 border-emerald-900 bg-emerald-950/20" : "text-amber-400 border-amber-900 bg-amber-950/20",
      desc: isPositiveGamma ? "市场处于平稳期，做市商的操作模式为高抛低吸，打压波动率。寻找支撑位低吸为上策。" : "市场情绪脆弱，做市商的操作模式为追涨杀跌，放大波动率。严禁逆势接飞刀，跟随趋势交易。" 
    };
  };

  const marketContext = getMarketContext();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans relative">
      
      {/* ⚠️ Premium Upsell Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowPremiumModal(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={24}/>
            </button>
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <Lock size={28} /> 
              <h2 className="text-2xl font-bold text-white">Premium Feature</h2>
            </div>
            <p className="text-slate-300 mb-6 text-base leading-relaxed">
              Ticker <strong className="text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{targetTicker}</strong> is not in our pre-loaded Top 20 list.<br/><br/>
              Customized ticker search and on-the-fly live computation will be available for <span className="text-amber-400 font-bold">Premium users</span> in the future. Stay tuned!
            </p>
            <div className="flex justify-end mt-4">
              <button 
                onClick={() => setShowPremiumModal(false)} 
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-2.5 rounded-lg shadow-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {isMockMode && (
        <div className="mb-6 bg-amber-900/50 border border-amber-500/50 text-amber-200 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <strong>Preview Mode Active:</strong> Failed to fetch <code>/dashboard_data.json</code>. Showing mock data. Please run Python script to generate real data.
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Activity className="text-blue-500" size={32} />
            Smart Options Radar
          </h1>
          
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex flex-wrap bg-slate-900 rounded-lg p-1 border border-slate-800 max-w-2xl">
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
                placeholder="Search any ticker..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                onKeyDown={handleSearch}
                className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white uppercase placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all w-48"
              />
              <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Lock size={14} className="text-amber-500" />
              </div>
            </div>
          </div>

          <p className="text-slate-400 mt-4 flex items-center gap-2 text-sm">
            <span>Ticker: <strong className="text-blue-400">{metadata.ticker}</strong></span>
            <span className="text-slate-600">|</span>
            <span>更新时间: {metadata.updated_at}</span>
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800 mt-4 md:mt-0 shadow-lg">
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
            <BookOpen size={16} />
            {showEducation ? 'Hide Guide' : 'Show Guide'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className={`mb-8 p-5 rounded-2xl border flex flex-col md:flex-row gap-4 items-start md:items-center ${marketContext.color}`}>
        <div className="p-3 bg-slate-950/50 rounded-full shrink-0">
          <Lightbulb size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg mb-1">AI 盘前解析: {marketContext.title}</h3>
          <p className="text-sm opacity-80 leading-relaxed">{marketContext.desc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Chart */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span> 全局 GEX 空间地形图
            </h2>
          </div>

          <div className="relative mt-4 flex-1">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700/50 z-0"></div>
            <div className="flex justify-between text-xs text-slate-500 mb-2 px-2 uppercase font-medium">
              <span>← Put 主导区 (-Gamma)</span><span>行权价 Strike</span><span>Call 主导区 (+Gamma) →</span>
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
                  <div key={data.strike} className={`flex items-center relative z-10 hover:bg-slate-800/80 rounded-md p-1.5 -mx-1.5 transition-colors ${isZeroGamma ? 'bg-blue-900/10' : ''}`}>
                    <div className="flex-1 flex justify-end items-center pr-4">
                      {!isCallDominant && data.net_gex !== 0 && (
                        <div className="h-5 rounded-l-sm bg-red-500/80 border-r border-red-400" style={{ width: `${widthPercent}%` }}></div>
                      )}
                      {isZeroGamma && (
                        <div className="mr-2 text-xs font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1">
                          <ArrowUpDown size={12} /> 翻转点
                        </div>
                      )}
                    </div>
                    <div className={`w-16 text-center font-mono text-sm relative z-20 ${isSpotNear ? 'text-blue-400 font-bold bg-slate-900 rounded px-1 ring-1 ring-blue-500/50' : 'text-slate-400'}`}>
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

        {/* Right Metrics */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className={`bg-slate-900 border ${isNearFlip ? 'border-blue-500' : 'border-slate-800'} p-5 rounded-2xl`}>
            <h3 className="text-blue-400 font-bold flex items-center gap-2 mb-2"><ArrowUpDown size={18} /> 零伽马反转点 (Zero Gamma)</h3>
            <div className="text-3xl font-black text-white font-mono">${indicators.zero_gamma.toFixed(2)}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-purple-400 font-bold flex items-center gap-2 mb-2"><Target size={18} /> 最大痛点 (Max Pain)</h3>
            <div className="text-3xl font-black text-white font-mono">${indicators.max_pain.toFixed(2)}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-emerald-400 font-bold flex items-center gap-2 mb-2"><TrendingUp size={18} /> 顶部阻力 (Call Wall)</h3>
            <div className="text-3xl font-black text-white font-mono">${indicators.call_wall.toFixed(2)}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-red-400 font-bold flex items-center gap-2 mb-2"><ShieldAlert size={18} /> 底部支撑 (Put Wall)</h3>
            <div className="text-3xl font-black text-white font-mono">${indicators.put_wall.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;