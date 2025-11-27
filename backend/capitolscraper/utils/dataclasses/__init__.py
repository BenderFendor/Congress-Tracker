"""This module contains utility dataclasses for scraper"""

from .page_data import PageData
from .trade import Dates, Politician, Trade
from .trade_stats import TradesStats
from .traded_issuer import IssuedTrader

__all__ = [
    "PageData",
    "Dates",
    "Politician",
    "Trade",
    "TradesStats",
    "IssuedTrader",
]
