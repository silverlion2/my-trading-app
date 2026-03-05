import pandas as pd
import numpy as np
import scipy.stats as si
from scipy import optimize
import json
import time
import os
import requests
from datetime import datetime, date, timedelta

# =========================================================
# ⚠️ MarketData.app API Token
# =========================================================
MARKETDATA_TOKEN = os.environ.get("MARKETDATA_TOKEN", "YOUR_MARKETDATA_TOKEN")

HEADERS = {
    'Authorization': f'Bearer {MARKETDATA_TOKEN}',
    'Accept': 'application/json'
}

# 🌟 核心修复：强制获取上一个【已经完全收盘且归档】的交易日 (T-1)
def get_last_trading_day():
    today = date.today()
    weekday = today.weekday()
    
    if weekday == 0:     # 周一 (Monday) -> 返回上周五 (-3天)
        return today - timedelta(days=3)
    elif weekday == 6:   # 周日 (Sunday) -> 返回上周五 (-2天)
        return today - timedelta(days=2)
    else:                # 周二至周六 -> 返回昨天 (-1天)
        return today - timedelta(days=1)

def calculate_gamma_bs(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0.01: return 0.0
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    return si.norm.pdf(d1) / (S * sigma * np.sqrt(T))

def get_total_gex_at_spot(simulated_spot, all_options_data, r):
    total_gex = 0.0
    for opt in all_options_data:
        gamma = calculate_gamma_bs(simulated_spot, opt['strike'], opt['T'], r, opt['iv'])
        if opt['type'] == 'call':
            total_gex += gamma * opt['oi'] * 100 * simulated_spot
        else:
            total_gex -= gamma * opt['oi'] * 100 * simulated_spot
    return total_gex

# ---------------------------------------------------------
# 2. Optimized MarketData Pipeline (Historical Pricing Mode)
# ---------------------------------------------------------
def process_ticker(ticker_symbol):
    print(f"\n[{ticker_symbol}] Fetching via Historical Bulked API (Cost-saving mode)...")
    
    try:
        # 强制使用 T-1 的日期参数，必定触发 1/1000 的白菜价计费模式
        target_date = get_last_trading_day().strftime('%Y-%m-%d')
        
        # 1. 获取最新现价 (Quote 不限制历史，永远拿最新的)
        quote_url = f"https://api.marketdata.app/v1/stocks/quotes/{ticker_symbol}/"
        res_quote = requests.get(quote_url, headers=HEADERS, timeout=10)
        quote_data = res_quote.json()
        
        remaining = res_quote.headers.get('x-ratelimit-remaining', 'Unknown')
        
        if quote_data.get('s') != 'ok':
            print(f"[{ticker_symbol}] Quote Error: {quote_data.get('errmsg', 'Unknown')}")
            return None
        
        spot_price = quote_data.get('last', [0])[0]

        # 2. 🌟 绝杀优化：带上 ?date=T-1 参数，请求历史归档的全量期权链
        chain_url = f"https://api.marketdata.app/v1/options/chain/{ticker_symbol}/?date={target_date}"
        res_chain = requests.get(chain_url, headers=HEADERS, timeout=20)
        chain_data = res_chain.json()
        
        if chain_data.get('s') != 'ok':
            print(f"[{ticker_symbol}] Chain Error: {chain_data.get('errmsg', 'Unknown')}")
            return None

        # 3. 本地内存处理 (不消耗任何额外 API 额度)
        all_options_data = []
        r = 0.04 
        today = date.today()
        
        strikes = chain_data.get('strike', [])
        sides = chain_data.get('side', [])
        ois = chain_data.get('openInterest', [])
        ivs = chain_data.get('iv', [])
        gammas = chain_data.get('gamma', [])
        expirations = chain_data.get('expiration', []) # Unix timestamps

        # 提取离现在最近的 4 个核心到期日
        unique_exps = sorted(list(set(expirations)))[:4]
        target_exps = set(unique_exps)

        for i in range(len(strikes)):
            try:
                exp_ts = expirations[i]
                if exp_ts not in target_exps: continue
                
                oi = ois[i] or 0
                iv = ivs[i] or 0.5
                gamma_val = gammas[i] or 0
                
                if oi > 0:
                    exp_date = datetime.fromtimestamp(exp_ts).date()
                    T = max((exp_date - today).days / 365.0, 1/365.0)
                    
                    if gamma_val == 0:
                        gamma_val = calculate_gamma_bs(spot_price, strikes[i], T, r, iv)
                        
                    all_options_data.append({
                        'type': str(sides[i]).lower(), 
                        'strike': float(strikes[i]), 
                        'oi': int(oi), 
                        'iv': float(iv), 
                        'gamma': float(gamma_val), 
                        'T': T
                    })
            except: continue

        if not all_options_data:
            print(f"[{ticker_symbol}] No valid options data found for nearest expirations.")
            return None

        # --- 以下为完全本地计算，0 消耗 ---
        max_pain_losses = {}
        all_strikes = sorted(list(set([opt['strike'] for opt in all_options_data])))
        for test_strike in all_strikes:
            total_loss = sum((test_strike - opt['strike']) * opt['oi'] if opt['type'] == 'call' and test_strike > opt['strike'] else (opt['strike'] - test_strike) * opt['oi'] if opt['type'] == 'put' and test_strike < opt['strike'] else 0 for opt in all_options_data)
            max_pain_losses[test_strike] = total_loss

        max_pain = min(max_pain_losses, key=max_pain_losses.get)
        
        gex_profile = {}
        for opt in all_options_data:
            strike = opt['strike']
            if strike not in gex_profile: gex_profile[strike] = {'call_gex': 0, 'put_gex': 0}
            gex_val = opt['gamma'] * opt['oi'] * 100 * spot_price
            if opt['type'] == 'call': gex_profile[strike]['call_gex'] += gex_val
            else: gex_profile[strike]['put_gex'] -= gex_val

        valid_strikes = [s for s in gex_profile.keys() if spot_price * 0.75 < s < spot_price * 1.25]
        if not valid_strikes: return None
            
        call_wall = max(valid_strikes, key=lambda s: gex_profile[s]['call_gex'])
        put_wall = min(valid_strikes, key=lambda s: gex_profile[s]['put_gex'])

        try:
            zero_gamma = round(optimize.brentq(get_total_gex_at_spot, spot_price * 0.7, spot_price * 1.3, args=(all_options_data, r)), 2)
        except:
            zero_gamma = max_pain

        print(f"[{ticker_symbol}] ✅ Done! MP: {max_pain} | ZG: {zero_gamma} | Credits Left: {remaining}")

        return {
            "metadata": {"ticker": ticker_symbol, "spot_price": round(spot_price, 2), "expiration_date": f"Historical Aggregated ({target_date})", "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
            "indicators": {"max_pain": max_pain, "call_wall": call_wall, "put_wall": put_wall, "zero_gamma": zero_gamma},
            "gex_chart_data": [{"strike": strike, "net_gex": round(gex_profile[strike]['call_gex'] + gex_profile[strike]['put_gex'], 2)} for strike in sorted(valid_strikes)]
        }

    except Exception as e:
        print(f"[{ticker_symbol}] Fatal Error: {e}")
        return None

def main():
    # Top 20 核心预载列表
    tickers_to_track = [
        "SPY", "QQQ", "IWM", "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL",
        "AMD", "TSM", "SMCI", "AVGO", "PLTR", "COIN", "MSTR", "NFLX", "JPM", "V"
    ]
    
    final_database = {}
    db_path = 'public/dashboard_data.json'
    if not os.path.exists('public'): os.makedirs('public')
    
    # 增量更新逻辑
    if os.path.exists(db_path):
        try:
            with open(db_path, 'r', encoding='utf-8') as f:
                final_database = json.load(f)
            print(f"📦 Successfully loaded existing fallback data.")
        except: pass
    
    for i, ticker in enumerate(tickers_to_track):
        data = process_ticker(ticker)
        if data: final_database[ticker] = data  
        time.sleep(1) # 每拉取一个标的暂停 1 秒，极其安全，防止触发并发限制
            
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(final_database, f, ensure_ascii=False, indent=2)
    
    # 将每日数据永久归档，沉淀您的数据资产
    archive_dir = 'public/archive'
    if not os.path.exists(archive_dir): os.makedirs(archive_dir)
    today_str = datetime.now().strftime("%Y-%m-%d")
    archive_path = f"{archive_dir}/options_{today_str}.json"
    
    with open(archive_path, 'w', encoding='utf-8') as f:
        json.dump(final_database, f, ensure_ascii=False, indent=2)

    print(f"\n✅ All updates completed! Saved to dashboard_data.json and archived to {archive_path}")

if __name__ == "__main__":
    main()