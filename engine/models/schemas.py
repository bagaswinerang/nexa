"""Pydantic schemas for the Nexa Quant Engine."""

from pydantic import BaseModel, Field


class SimulationRequest(BaseModel):
    """Request body for Monte Carlo simulation."""

    symbol: str = Field(
        default="BNBUSDT",
        description="Trading pair symbol (e.g. BNBUSDT, BTCUSDT)",
    )
    days: int = Field(
        default=30,
        ge=1,
        le=365,
        description="Number of days to simulate forward",
    )
    simulations: int = Field(
        default=3000,
        ge=100,
        le=10000,
        description="Number of Monte Carlo paths to simulate",
    )
    interval: str = Field(
        default="1d",
        description="Historical data interval for volatility calculation",
    )
    lookback_days: int = Field(
        default=90,
        ge=7,
        le=365,
        description="Number of historical days to use for parameter estimation",
    )


class PercentileResult(BaseModel):
    """Price at a specific percentile."""

    percentile: int
    price: float


class SimulationResponse(BaseModel):
    """Response from Monte Carlo simulation."""

    symbol: str
    current_price: float
    days_simulated: int
    num_simulations: int

    # Statistical summary
    mean_price: float
    median_price: float
    std_dev: float
    min_price: float
    max_price: float

    # Percentiles
    percentiles: list[PercentileResult]

    # Probabilities
    prob_above_current: float  # Probability price goes up
    prob_above_10pct: float  # Probability of >10% gain
    prob_below_10pct: float  # Probability of >10% loss

    # Historical parameters used
    annual_drift: float
    annual_volatility: float

    # Sample paths for charting (5 representative paths)
    sample_paths: list[list[float]]

    # All final prices for histogram
    final_prices: list[float]


class MarketDataResponse(BaseModel):
    """Current market data for a symbol."""

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
    """Health check response."""

    status: str = "ok"
    service: str = "nexa-engine"
    version: str = "1.0.0"
