"""Schemas for live Binance market data and the Quant Lab."""

from typing import Literal
from pydantic import BaseModel, Field


class SimulationRequest(BaseModel):
    symbol: str = Field(default="BNBUSDT", min_length=3, max_length=20)
    horizon: Literal[
        "1h", "2h", "4h", "6h", "8h", "12h", "24h",
        "7d", "14d", "30d", "60d", "90d"
    ] = "24h"
    simulations: int = Field(default=3000, ge=100, le=10000)


class PercentileResult(BaseModel):
    percentile: int
    price: float


class SimulationResponse(BaseModel):
    symbol: str
    horizon: str
    current_price: float
    periods_simulated: int
    days_simulated: int
    period_label: str
    num_simulations: int
    mean_price: float
    median_price: float
    std_dev: float
    min_price: float
    max_price: float
    percentiles: list[PercentileResult]
    prob_above_current: float
    prob_above_10pct: float
    prob_below_10pct: float
    annual_drift: float
    annual_volatility: float
    sample_paths: list[list[float]]
    final_prices: list[float]


class MarketDataResponse(BaseModel):
    symbol: str
    price: float
    price_change_24h: float
    price_change_pct_24h: float
    high_24h: float
    low_24h: float
    volume_24h: float
    fear_greed_index: int | None = None
    fear_greed_label: str | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "nexa-quant-lab"
    version: str = "1.0.0"
