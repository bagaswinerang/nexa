"""Monte Carlo simulation service using Geometric Brownian Motion (GBM).

The GBM model assumes:
    dS = μ·S·dt + σ·S·dW

Where:
    S = asset price
    μ = drift (expected return)
    σ = volatility
    W = Wiener process (random walk)

Discrete form:
    S(t+1) = S(t) * exp((μ - σ²/2)·Δt + σ·√Δt·Z)
    where Z ~ N(0,1)
"""

import numpy as np
from models.schemas import PercentileResult, SimulationResponse


class MonteCarloService:
    """Runs Monte Carlo simulations for asset price prediction."""

    @staticmethod
    def estimate_parameters(prices: list[float]) -> tuple[float, float]:
        """Estimate annualized drift and volatility from historical prices.

        Args:
            prices: List of historical daily closing prices (oldest first).

        Returns:
            Tuple of (annualized_drift, annualized_volatility).
        """
        prices_arr = np.array(prices)
        # Calculate daily log returns
        log_returns = np.diff(np.log(prices_arr))

        # Daily statistics
        daily_drift = np.mean(log_returns)
        daily_volatility = np.std(log_returns, ddof=1)

        # Annualize (252 trading days)
        annual_drift = daily_drift * 252
        annual_volatility = daily_volatility * np.sqrt(252)

        return float(annual_drift), float(annual_volatility)

    @staticmethod
    def simulate(
        current_price: float,
        annual_drift: float,
        annual_volatility: float,
        days: int = 30,
        num_simulations: int = 3000,
    ) -> SimulationResponse:
        """Run Monte Carlo simulation using GBM.

        Args:
            current_price: Current asset price.
            annual_drift: Annualized drift (μ).
            annual_volatility: Annualized volatility (σ).
            days: Number of days to simulate.
            num_simulations: Number of simulation paths.

        Returns:
            SimulationResponse with statistics and sample paths.
        """
        dt = 1 / 252  # Daily time step
        mu = annual_drift
        sigma = annual_volatility

        # Generate random shocks: shape (num_simulations, days)
        np.random.seed(None)  # Ensure randomness
        Z = np.random.standard_normal((num_simulations, days))

        # Calculate daily returns using GBM discrete form
        daily_returns = np.exp((mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * Z)

        # Build price paths
        price_paths = np.zeros((num_simulations, days + 1))
        price_paths[:, 0] = current_price

        for t in range(days):
            price_paths[:, t + 1] = price_paths[:, t] * daily_returns[:, t]

        # Extract final prices
        final_prices = price_paths[:, -1]

        # Calculate statistics
        mean_price = float(np.mean(final_prices))
        median_price = float(np.median(final_prices))
        std_dev = float(np.std(final_prices))
        min_price = float(np.min(final_prices))
        max_price = float(np.max(final_prices))

        # Percentiles
        percentile_values = [5, 10, 25, 50, 75, 90, 95]
        percentiles = [
            PercentileResult(
                percentile=p, price=float(np.percentile(final_prices, p))
            )
            for p in percentile_values
        ]

        # Probabilities
        prob_above_current = float(np.mean(final_prices > current_price))
        prob_above_10pct = float(np.mean(final_prices > current_price * 1.10))
        prob_below_10pct = float(np.mean(final_prices < current_price * 0.90))

        # Select 5 representative sample paths (evenly spaced by final price)
        sorted_indices = np.argsort(final_prices)
        sample_indices = sorted_indices[
            np.linspace(0, num_simulations - 1, 5, dtype=int)
        ]
        sample_paths = [
            [round(float(p), 2) for p in price_paths[i]] for i in sample_indices
        ]

        # Subsample final prices for histogram (max 200 points)
        if len(final_prices) > 200:
            histogram_prices = sorted(
                [float(p) for p in np.random.choice(final_prices, 200, replace=False)]
            )
        else:
            histogram_prices = sorted([float(p) for p in final_prices])

        return SimulationResponse(
            symbol="",  # Will be set by caller
            current_price=current_price,
            days_simulated=days,
            num_simulations=num_simulations,
            mean_price=round(mean_price, 2),
            median_price=round(median_price, 2),
            std_dev=round(std_dev, 2),
            min_price=round(min_price, 2),
            max_price=round(max_price, 2),
            percentiles=percentiles,
            prob_above_current=round(prob_above_current, 4),
            prob_above_10pct=round(prob_above_10pct, 4),
            prob_below_10pct=round(prob_below_10pct, 4),
            annual_drift=round(annual_drift, 4),
            annual_volatility=round(annual_volatility, 4),
            sample_paths=sample_paths,
            final_prices=histogram_prices,
        )
