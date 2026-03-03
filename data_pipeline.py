import yfinance as yf
import pandas as pd
import numpy as np
import scipy.stats as si
from scipy import optimize
import json
import time
from datetime import datetime, date

# ---------------------------------------------------------
# 1. 核心数学模型：Black-Scholes Gamma 计算
# ---------------------------------------------------------
def calculate_gamma(S, K, T, r, sigma):
    # 极短期或波动率极小的情况，Gamma 趋近于 0 或极大，做平滑处理
    if T <= 0 or sigma <= 0.01:
        return 0.0
    
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    pdf_d1 = si.norm.pdf(d1)
    gamma = pdf_d1 / (S * sigma * np.sqrt(T))
    return gamma

# ---------------------------------------------------------
# 2. 零伽马测算函数：寻找全市场 Net GEX = 0 的现货价格
# ---------------------------------------------------------
def get_total_gex_at_spot(simulated_spot, all_options_data, r):
    total_gex = 0.0
    for opt in all_options_data:
        gamma = calculate_gamma(simulated_spot, opt['strike'], opt['T'], r, opt['iv'])
        if opt['type'] == 'call':
            total_gex += gamma * opt['oi'] * 100 * simulated_spot
        else:
            total_gex -= gamma * opt['oi'] * 100 * simulated_spot
    return total_gex

# ---------------------------------------------------------
# 3. 单个标的的数据处理流水线 (全期限聚合版)
# ---------------------------------------------------------
def process_ticker(ticker_symbol):
    print(f"\n[{ticker_symbol}] 正在拉取数据...")
    ticker = yf.Ticker(ticker_symbol)
    
    todays_data = ticker.history(period="1d")
    if todays_data.empty:
        print(f"[{ticker_symbol}] 无法获取现价，跳过。")
        return None
    spot_price = todays_data['Close'].iloc[-1]
    
    expirations = ticker.options
    if not expirations:
        print(f"[{ticker_symbol}] 无法获取期权链，跳过。")
        return None
        
    # 抓取最近的 6 个到期日（覆盖近 1-2 个月的主要 Gamma）
    target_expirations = expirations[:6] 
    print(f"[{ticker_symbol}] 现价: ${spot_price:.2f} | 聚合到期日数量: {len(target_expirations)}")
    
    all_options_data = [] # 扁平化存储所有合约的列表
    max_pain_losses = {}  # 聚合计算最大痛点
    
    r = 0.04 
    today_date = date.today()

    # 遍历所有目标期限，拉取并组装数据
    for exp_date_str in target_expirations:
        try:
            opt = ticker.option_chain(exp_date_str)
            
            # 计算这个特定到期日的 T (年化时间)
            expiry_date = datetime.strptime(exp_date_str, '%Y-%m-%d').date()
            days_to_expiry = (expiry_date - today_date).days
            T = max(days_to_expiry / 365.0, 1/365.0)

            # 处理 Calls
            for _, call in opt.calls.iterrows():
                if call['openInterest'] > 0 and call['impliedVolatility'] > 0.01:
                    all_options_data.append({
                        'type': 'call', 'strike': call['strike'], 'oi': call['openInterest'],
                        'iv': call['impliedVolatility'], 'T': T
                    })
                    
            # 处理 Puts
            for _, put in opt.puts.iterrows():
                if put['openInterest'] > 0 and put['impliedVolatility'] > 0.01:
                    all_options_data.append({
                        'type': 'put', 'strike': put['strike'], 'oi': put['openInterest'],
                        'iv': put['impliedVolatility'], 'T': T
                    })
                    
            # 内部休眠 0.5 秒，防止单个标的请求过快
            time.sleep(0.5)
            
        except Exception as e:
            print(f"拉取 {exp_date_str} 失败: {e}")
            continue

    if not all_options_data:
        return None

    # === 模块A：聚合计算最大痛点 (Max Pain) ===
    all_strikes = sorted(list(set([opt['strike'] for opt in all_options_data])))
    
    for test_strike in all_strikes:
        total_loss = 0.0
        for opt in all_options_data:
            if opt['type'] == 'call' and test_strike > opt['strike']:
                total_loss += (test_strike - opt['strike']) * opt['oi']
            elif opt['type'] == 'put' and test_strike < opt['strike']:
                total_loss += (opt['strike'] - test_strike) * opt['oi']
        max_pain_losses[test_strike] = total_loss

    max_pain = min(max_pain_losses, key=max_pain_losses.get)
    
    # === 模块B：计算各行权价的全局 GEX 分布 ===
    gex_profile = {}
    
    for opt in all_options_data:
        strike = opt['strike']
        gamma = calculate_gamma(spot_price, strike, opt['T'], r, opt['iv'])
        
        if strike not in gex_profile:
            gex_profile[strike] = {'call_gex': 0, 'put_gex': 0}
            
        if opt['type'] == 'call':
            gex_profile[strike]['call_gex'] += gamma * opt['oi'] * 100 * spot_price
        else:
            gex_profile[strike]['put_gex'] -= gamma * opt['oi'] * 100 * spot_price

    for strike in gex_profile:
        gex_profile[strike]['net_gex'] = gex_profile[strike]['call_gex'] + gex_profile[strike]['put_gex']

    # 提取靠近现价上下 25% 区间的数据
    valid_strikes = [s for s in gex_profile.keys() if spot_price * 0.75 < s < spot_price * 1.25]
    if not valid_strikes:
        return None
        
    call_wall = max(valid_strikes, key=lambda s: gex_profile[s]['call_gex'])
    put_wall = min(valid_strikes, key=lambda s: gex_profile[s]['put_gex'])

    # === 模块C：使用求根算法(Root-finding)寻找全局 Zero-Gamma 点 ===
    try:
        zero_gamma = optimize.brentq(
            get_total_gex_at_spot, spot_price * 0.7, spot_price * 1.3, args=(all_options_data, r)
        )
        zero_gamma = round(zero_gamma, 2)
    except ValueError:
        zero_gamma = max_pain

    print(f"[{ticker_symbol}] 完毕 -> Max Pain: {max_pain} | Call Wall: {call_wall} | Put Wall: {put_wall} | Zero Gamma: {zero_gamma}")

    return {
        "metadata": {
            "ticker": ticker_symbol,
            "spot_price": round(spot_price, 2),
            "expiration_date": "Multiple (Aggregated)",
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        },
        "indicators": {
            "max_pain": max_pain,
            "call_wall": call_wall,
            "put_wall": put_wall,
            "zero_gamma": zero_gamma
        },
        "gex_chart_data": [
            {
                "strike": strike, 
                "net_gex": round(gex_profile[strike]['net_gex'], 2)
            } 
            for strike in sorted(valid_strikes)
        ]
    }

def main():
    # 20 个最受关注的核心期权标的
    tickers_to_track = [
        # 指数 ETF
        "SPY", "QQQ", "IWM", 
        # 科技巨头 (Magnificent 7)
        "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL",
        # 热门芯片股
        "AMD", "TSM", "SMCI", "AVGO",
        # 热门散户与金融/消费股
        "PLTR", "COIN", "MSTR", "NFLX", "JPM", "V"
    ]
    
    final_database = {}
    
    for i, ticker in enumerate(tickers_to_track):
        data = process_ticker(ticker)
        if data:
            final_database[ticker] = data
            
        # 标的之间的保护性休眠，防止请求过于密集被雅虎拉黑
        if i < len(tickers_to_track) - 1:
            time.sleep(2)
            
    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(final_database, f, ensure_ascii=False, indent=2)
    
    print("\n✅ 所有 20 个标的的数据已成功聚合计算，并保存至 dashboard_data.json")

if __name__ == "__main__":
    main()