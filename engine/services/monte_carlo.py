"""Monte Carlo / GBM calculations over real Binance BNB/USDT candles."""

import numpy as np
from models.schemas import PercentileResult, SimulationResponse


class MonteCarloService:
    @staticmethod
    def estimate_parameters(prices: list[float], periods_per_year: int) -> tuple[float, float]:
        returns = np.diff(np.log(np.array(prices)))
        return float(np.mean(returns) * periods_per_year), float(np.std(returns, ddof=1) * np.sqrt(periods_per_year))

    @staticmethod
    def simulate(symbol: str, current_price: float, annual_drift: float, annual_volatility: float, periods: int, periods_per_year: int, simulations: int, horizon: str, label: str) -> SimulationResponse:
        dt = 1 / periods_per_year
        shocks = np.random.standard_normal((simulations, periods))
        returns = np.exp((annual_drift - 0.5 * annual_volatility**2) * dt + annual_volatility * np.sqrt(dt) * shocks)
        paths = np.zeros((simulations, periods + 1))
        paths[:, 0] = current_price
        for period in range(periods):
            paths[:, period + 1] = paths[:, period] * returns[:, period]
        final = paths[:, -1]
        percentiles = [PercentileResult(percentile=p, price=round(float(np.percentile(final, p)), 2)) for p in [5, 10, 25, 50, 75, 90, 95]]
        selected = np.argsort(final)[np.linspace(0, simulations - 1, 5, dtype=int)]
        sample_paths = [[round(float(point), 2) for point in paths[index]] for index in selected]
        histogram = sorted(float(value) for value in np.random.choice(final, min(200, len(final)), replace=False))
        return SimulationResponse(symbol=symbol.upper(), horizon=horizon, current_price=round(current_price, 2), periods_simulated=periods, days_simulated=max(1, round(periods / 24)) if horizon == "24h" else periods, period_label=label, num_simulations=simulations, mean_price=round(float(np.mean(final)), 2), median_price=round(float(np.median(final)), 2), std_dev=round(float(np.std(final)), 2), min_price=round(float(np.min(final)), 2), max_price=round(float(np.max(final)), 2), percentiles=percentiles, prob_above_current=round(float(np.mean(final > current_price)), 4), prob_above_10pct=round(float(np.mean(final > current_price * 1.10)), 4), prob_below_10pct=round(float(np.mean(final < current_price * .90)), 4), annual_drift=round(annual_drift, 4), annual_volatility=round(annual_volatility, 4), sample_paths=sample_paths, final_prices=histogram)
