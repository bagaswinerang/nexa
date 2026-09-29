"""Nexa Quant Engine — FastAPI server for Monte Carlo simulations.

Usage:
    uvicorn main:app --port 3002 --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import config
from models.schemas import (
    HealthResponse,
    MarketDataResponse,
    SimulationRequest,
    SimulationResponse,
)
from services.market_data import MarketDataService
from services.monte_carlo import MonteCarloService

# Services
market_service = MarketDataService()
monte_carlo = MonteCarloService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup/shutdown lifecycle."""
    yield
    await market_service.close()


app = FastAPI(
    title="Nexa Quant Engine",
    description="Monte Carlo simulation engine for DeFi price prediction",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse()


@app.post("/simulate", response_model=SimulationResponse)
async def simulate(request: SimulationRequest):
    """Run Monte Carlo simulation for a given trading pair.

    1. Fetches historical prices from Binance
    2. Estimates drift & volatility from historical data
    3. Runs N simulations using Geometric Brownian Motion
    4. Returns statistics, percentiles, and sample paths
    """
    try:
        # 1. Fetch historical closing prices
        prices = await market_service.get_historical_prices(
            symbol=request.symbol,
            interval=request.interval,
            limit=request.lookback_days,
        )

        if len(prices) < 10:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough historical data for {request.symbol}. "
                f"Got {len(prices)} data points, need at least 10.",
            )

        # 2. Estimate parameters from historical data
        annual_drift, annual_volatility = monte_carlo.estimate_parameters(prices)

        # 3. Run Monte Carlo simulation
        current_price = prices[-1]
        result = monte_carlo.simulate(
            current_price=current_price,
            annual_drift=annual_drift,
            annual_volatility=annual_volatility,
            days=request.days,
            num_simulations=request.simulations,
        )

        # Set the symbol
        result.symbol = request.symbol.upper()

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Simulation failed: {str(e)}"
        ) from e


@app.get("/market-data/{symbol}", response_model=MarketDataResponse)
async def get_market_data(symbol: str):
    """Get current market data for a trading pair."""
    try:
        return await market_service.get_price(symbol.upper())
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch market data: {str(e)}"
        ) from e


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
