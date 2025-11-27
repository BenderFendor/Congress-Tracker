"""This module contains utility functions for scraper"""

from .scraperfuncs import (
    make_request,
    parse_page_data,
    parse_trade_page,
    parse_trade_stats,
)

__all__ = [
    "make_request",
    "parse_page_data",
    "parse_trade_page",
    "parse_trade_stats",
]
