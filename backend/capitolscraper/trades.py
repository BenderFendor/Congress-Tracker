"""This modules contains the scraper for the trades page"""

import asyncio
from typing import List, Optional

from .utils import make_request, parse_page_data, parse_trade_page, parse_trade_stats
from .utils.dataclasses import Trade, TradesStats


class Trades:
    """Class responsible for scraping the capitoltrades trade page

    Attributes:
        trades: The collection of trades to be scraped for
        stats: The stats for capitoltrades
        total_pages: The total number of pages
    """

    def __init__(self, page_count: Optional[int] = None) -> None:
        """Constructor for the Trades class

        Args:
            page_count: The optional number of pages to scrape
        """

        self._trades: Optional[List[Trade]] = None
        self._stats: Optional[TradesStats] = None
        self._total_pages: Optional[int] = None

        self._page_count = page_count

    @property
    async def trades(self) -> List[Trade]:
        """Return the total available trades"""
        if self._trades is not None:
            return self._trades

        self._trades = []

        async def scrape_page(num: int) -> None:
            try:
                res = await make_request("trades", num)
                page_trades = parse_trade_page(res.text)
                self._trades.extend(page_trades)  # type: ignore
            except ConnectionError as e:
                print(f"Error on {num}: {repr(e)}")

        total = (
            self._page_count if self._page_count is not None else await self.total_pages
        )
        tasks = [scrape_page(page) for page in range(1, total)]
        await asyncio.gather(*tasks)

        return self._trades

    @property
    async def stats(self) -> TradesStats:
        """Return the total stats of trades"""
        if self._stats is not None:
            return self._stats

        res = await make_request("trades")
        self._stats = parse_trade_stats(res.text)
        return self._stats

    @property
    async def total_pages(self) -> int:
        """Return the total number of pages to scrape"""
        if self._total_pages is not None:
            return self._total_pages

        res = await make_request("trades")
        self._total_pages = parse_page_data(res.text).total
        return self._total_pages
