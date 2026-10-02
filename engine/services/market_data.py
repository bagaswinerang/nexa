"""Direct Binance BNB/USDT market data and historical candles for Quant Lab."""

import time
import httpx
from config import config
from models.schemas import MarketDataResponse


class MarketDataService:
    BINANCE_BASE = "https://data-api.binance.vision/api/v3"

    def __init__(self) -> None:
        self.client = httpx.AsyncClient(timeout=5.0)
        self.headers = config.get_binance_headers()
        self.fear_greed_url = config.FEAR_GREED_URL
        self._ticker_cache: dict[str, tuple[float, MarketDataResponse]] = {}
        self._fg_cache: tuple[float, int | None, str | None] | None = None

    async def _get_fear_greed(self) -> tuple[int | None, str | None]:
        now = time.time()
        if self._fg_cache and now - self._fg_cache[0] < 600:
            return self._fg_cache[1], self._fg_cache[2]
        try:
            response = await self.client.get(self.fear_greed_url)
            data = response.json().get("data", [])
            if data:
                self._fg_cache = (now, int(data[0]["value"]), data[0]["value_classification"])
        except Exception:
            pass
        return (self._fg_cache[1], self._fg_cache[2]) if self._fg_cache else (None, None)

    async def get_price(self, symbol: str = "BNBUSDT") -> MarketDataResponse:
        symbol = symbol.upper()
        now = time.time()
        if symbol in self._ticker_cache and now - self._ticker_cache[symbol][0] < 15:
            return self._ticker_cache[symbol][1]
        response = await self.client.get(f"{self.BINANCE_BASE}/ticker/24hr?symbol={symbol}", headers=self.headers)
        response.raise_for_status()
        data = response.json()
        fg_index, fg_label = await self._get_fear_greed()
        result = MarketDataResponse(symbol=symbol, price=float(data["lastPrice"]), price_change_24h=float(data["priceChange"]), price_change_pct_24h=float(data["priceChangePercent"]), high_24h=float(data["highPrice"]), low_24h=float(data["lowPrice"]), volume_24h=float(data["volume"]), fear_greed_index=fg_index, fear_greed_label=fg_label)
        self._ticker_cache[symbol] = (now, result)
        return result

    async def get_historical_prices(self, symbol: str, interval: str, limit: int) -> list[float]:
        response = await self.client.get(f"{self.BINANCE_BASE}/klines?symbol={symbol.upper()}&interval={interval}&limit={limit}", headers=self.headers)
        response.raise_for_status()
        prices = [float(candle[4]) for candle in response.json()]
        if len(prices) < 10:
            raise ValueError("Binance returned insufficient BNB/USDT candles")
        return prices

    async def get_recent_candles(self, symbol: str, interval: str, limit: int) -> list[dict[str, int | float]]:
        response = await self.client.get(f"{self.BINANCE_BASE}/klines?symbol={symbol.upper()}&interval={interval}&limit={limit}", headers=self.headers)
        response.raise_for_status()
        return [
            {
                "open_time": int(candle[0]),
                "open": float(candle[1]),
                "high": float(candle[2]),
                "low": float(candle[3]),
                "close": float(candle[4]),
                "volume": float(candle[5]),
                "close_time": int(candle[6]),
            }
            for candle in response.json()
        ]

    async def close(self) -> None:
        await self.client.aclose()
