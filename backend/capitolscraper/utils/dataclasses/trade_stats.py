"""This module contains the TradesStats class"""

from dataclasses import dataclass


@dataclass
class TradesStats:
    """This dataclass is stores capitoltrades trade page stats

    Args:
        trades: Total number of trades
        filings: Total number of filings
        volume: Total value volume of all trades
        politicians: Total number of politicians with trades logged
        issuers: Total number of different issuers
    """

    trades: int
    filings: int
    volume: str
    politicians: int
    issuers: int
