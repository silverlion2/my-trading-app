import pandas as pd
import numpy as np
import scipy.stats as si
from scipy import optimize
import json
import time
import os
import requests
from datetime import datetime, date

# =========================================================
# ⚠️ MarketData.app API Token
# =========================================================
MARKETDATA_TOKEN = os.environ.get("MARKETDATA_TOKEN", "YOUR_MARKETDATA_TOKEN")

HEADERS = {
    'Authorization': f'Bearer {MARKETDATA_TOKEN}',
    'Accept': 'application/json'
}

# ---------------------------------------------------------
# 1. B-S 模型 (仅用于计算 Zero-Gamma 时的模拟现价求导)
# ---------------------------------------------------------
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
# 2. MarketData.app 核心流水线
# ---------------------------------------------------------
def process_ticker(ticker_symbol):
    print(f"\n[{ticker_symbol}] 正在通过 MarketData 官方 API 获取数据...")
    
    if MARKETDATA_TOKEN == "YOUR_MARKETDATA_TOKEN":
        print("❌ 错误：请先填入 MarketData API Token！")
        return None

    try:
        # 1. 获取准确的现价 (Spot Price)
        quote_url = f"https://api.marketdata.app/v1/stocks/quotes/{ticker_symbol}/"
        res_quote = requests.get(quote_url, headers=HEADERS, timeout=10)
        
        if res_quote.status_code == 401 or res_quote.status_code == 403:
            print(f"❌ 认证失败！请检查您的 Token 是否正确。")
            return None
            
        quote_data = res_quote.json()
        if quote_data.get('s') != 'ok':
            print(f"[{ticker_symbol}] 无法获取现价: {quote_data}")
            return None
            
        spot_price = quote_data.get('last', [0])[0]

        # 2. 获取期权到期日列表
        exp_url = f"https://api.marketdata.app/v1/options/expirations/{ticker_symbol}/"
        res_exp = requests.get(exp_url, headers=HEADERS, timeout=10)
        exp_data = res_exp.json()
        
        if exp_data.get('s') != 'ok':
            print(f"[{ticker_symbol}] 未获取到期权到期日。")
            return None
            
        exp_dates = exp_data.get('expirations', [])[:4]
        print(f"[{ticker_symbol}] 现价: ${spot_price:.2f} | 聚合到期日: {len(exp_dates)} 个")

        all_options_data = []
        r = 0.04 
        today_date = date.today()

        # 3. 按到期日拉取全量期权链 (自带 Greeks)
        for ed in exp_dates:
            chain_url = f"https://api.marketdata.app/v1/options/chain/{ticker_symbol}/?expiration={ed}"
            res_chain = requests.get(chain_url, headers=HEADERS, timeout=15)
            chain_data = res_chain.json()
            
            if chain_data.get('s') != 'ok':
                continue
                
            strikes = chain_data.get('strike', [])
            sides = chain_data.get('side', [])
            ois = chain_data.get('openInterest', [])
            ivs = chain_data.get('iv', [])
            gammas = chain_data.get('gamma', [])

            exp_date_obj = datetime.strptime(ed, '%Y-%m-%d').date()
            days_to_expiry = (exp_date_obj - today_date).days
            T = max(days_to_expiry / 365.0, 1/365.0)

            for i in range(len(strikes)):
                oi = ois[i]
                iv = ivs[i]
                gamma_val = gammas[i]
                
                if oi is not None and oi > 0 and iv is not None and iv > 0.01:
                    if gamma_val is None or gamma_val == 0:
                        gamma_val = calculate_gamma_bs(spot_price, strikes[i], T, r, iv)
                        
                    all_options_data.append({
                        'type': sides[i].lower(), 
                        'strike': strikes[i], 
                        'oi': oi, 
                        'iv': iv, 
                        'gamma': gamma_val, 
                        'T': T
                    })
            
            time.sleep(0.1)

        if not all_options_data:
            print(f"[{ticker_symbol}] 该标的过滤后无有效期权数据。")
            return None

        # 计算 Max Pain
        max_pain_losses = {}
        all_strikes = sorted(list(set([opt['strike'] for opt in all_options_data])))
        for test_strike in all_strikes:
            total_loss = sum((test_strike - opt['strike']) * opt['oi'] if opt['type'] == 'call' and test_strike > opt['strike'] else (opt['strike'] - test_strike) * opt['oi'] if opt['type'] == 'put' and test_strike < opt['strike'] else 0 for opt in all_options_data)
            max_pain_losses[test_strike] = total_loss

        max_pain = min(max_pain_losses, key=max_pain_losses.get)
        
        # 计算全局 GEX 分布
        gex_profile = {}
        for opt in all_options_data:
            strike = opt['strike']
            if strike not in gex_profile: gex_profile[strike] = {'call_gex': 0, 'put_gex': 0}
            
            if opt['type'] == 'call': 
                gex_profile[strike]['call_gex'] += opt['gamma'] * opt['oi'] * 100 * spot_price
            else: 
                gex_profile[strike]['put_gex'] -= opt['gamma'] * opt['oi'] * 100 * spot_price

        for strike in gex_profile: 
            gex_profile[strike]['net_gex'] = gex_profile[strike]['call_gex'] + gex_profile[strike]['put_gex']

        valid_strikes = [s for s in gex_profile.keys() if spot_price * 0.75 < s < spot_price * 1.25]
        if not valid_strikes: return None
            
        call_wall = max(valid_strikes, key=lambda s: gex_profile[s]['call_gex'])
        put_wall = min(valid_strikes, key=lambda s: gex_profile[s]['put_gex'])

        try:
            zero_gamma = round(optimize.brentq(get_total_gex_at_spot, spot_price * 0.7, spot_price * 1.3, args=(all_options_data, r)), 2)
        except ValueError:
            zero_gamma = max_pain

        print(f"[{ticker_symbol}] ✅ 完毕 -> MP: {max_pain} | CW: {call_wall} | PW: {put_wall} | ZG: {zero_gamma}")

        return {
            "metadata": {"ticker": ticker_symbol, "spot_price": round(spot_price, 2), "expiration_date": "Multiple (Aggregated)", "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
            "indicators": {"max_pain": max_pain, "call_wall": call_wall, "put_wall": put_wall, "zero_gamma": zero_gamma},
            "gex_chart_data": [{"strike": strike, "net_gex": round(gex_profile[strike]['net_gex'], 2)} for strike in sorted(valid_strikes)]
        }

    except Exception as e:
        print(f"[{ticker_symbol}] 致命错误: {e}")
        return None

def main():
    # 🌟 扩展为 20 只最具代表性的股票和 ETF
    tickers_to_track = [
        "SPY", "QQQ", "IWM", "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL",
        "AMD", "TSM", "SMCI", "AVGO", "PLTR", "COIN", "MSTR", "NFLX", "JPM", "V"
    ]
    
    final_database = {}
    db_path = 'public/dashboard_data.json'
    
    if not os.path.exists('public'): os.makedirs('public')
        
    if os.path.exists(db_path):
        try:
            with open(db_path, 'r', encoding='utf-8') as f:
                final_database = json.load(f)
            print(f"📦 已加载本地兜底历史数据。")
        except: pass
    
    for i, ticker in enumerate(tickers_to_track):
        data = process_ticker(ticker)
        if data:
            final_database[ticker] = data  
        else:
            print(f"⚠️ [{ticker}] 获取失败，保留历史数据不变。")
            
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(final_database, f, ensure_ascii=False, indent=2)
    
    # 将每日数据永久归档留存
    archive_dir = 'public/archive'
    if not os.path.exists(archive_dir):
        os.makedirs(archive_dir)
        
    today_str = datetime.now().strftime("%Y-%m-%d")
    archive_path = f"{archive_dir}/options_{today_str}.json"
    
    with open(archive_path, 'w', encoding='utf-8') as f:
        json.dump(final_database, f, ensure_ascii=False, indent=2)
        
    print(f"📦 今日核心数据已永久归档至: {archive_path}")

    print("\n✅ 更新完毕并保存至 public/dashboard_data.json")

if __name__ == "__main__":
    main()