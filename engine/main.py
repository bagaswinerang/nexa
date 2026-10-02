"""Nexa Quant Lab: real Binance BNB/USDT data with Monte Carlo analytics."""

from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from config import config
from models.schemas import HealthResponse, MarketDataResponse, SimulationRequest, SimulationResponse
from services.market_data import MarketDataService
from services.monte_carlo import MonteCarloService

market_data = MarketDataService()
monte_carlo = MonteCarloService()
HORIZONS = {
    "1h": ("5m", 12, 105120, 120, "1 hour"),
    "2h": ("5m", 24, 105120, 144, "2 hours"),
    "4h": ("5m", 48, 105120, 288, "4 hours"),
    "6h": ("5m", 72, 105120, 288, "6 hours"),
    "8h": ("5m", 96, 105120, 288, "8 hours"),
    "12h": ("5m", 144, 105120, 288, "12 hours"),
    "24h": ("5m", 288, 105120, 288, "24 hours"),
    "7d": ("1d", 7, 365, 180, "7 days"),
    "14d": ("1d", 14, 365, 180, "14 days"),
    "30d": ("1d", 30, 365, 180, "30 days"),
    "60d": ("1d", 60, 365, 270, "60 days"),
    "90d": ("1d", 90, 365, 365, "90 days"),
}

@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await market_data.close()

app = FastAPI(title="Nexa Quant Lab", description="Monte Carlo using real Binance BNB/USDT candles.", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse()

@app.get("/market-data/{symbol}", response_model=MarketDataResponse)
async def get_market_data(symbol: str):
    try:
        return await market_data.get_price(symbol)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Binance market data unavailable: {exc}") from exc

@app.get("/market-data/{symbol}/candles")
async def get_recent_candles(
    symbol: str,
    interval: Literal["1m", "5m", "15m", "1h", "4h", "1d"] = "1m",
    limit: int = Query(default=6, ge=1, le=1000),
):
    try:
        return await market_data.get_recent_candles(symbol, interval, limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Binance candle data unavailable: {exc}") from exc

@app.post("/simulate", response_model=SimulationResponse)
async def simulate(request: SimulationRequest):
    try:
        interval, periods, periods_per_year, lookback, label = HORIZONS[request.horizon]
        prices = await market_data.get_historical_prices(request.symbol, interval, lookback)
        spot = await market_data.get_price(request.symbol)
        drift, volatility = monte_carlo.estimate_parameters(prices, periods_per_year)
        return monte_carlo.simulate(request.symbol, spot.price, drift, volatility, periods, periods_per_year, request.simulations, request.horizon, label)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Binance Quant Lab failed: {exc}") from exc
