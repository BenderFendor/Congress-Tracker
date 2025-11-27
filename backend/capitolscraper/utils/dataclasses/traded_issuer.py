"""This module contains a IssuedTrader dataclass"""

from dataclasses import dataclass


@dataclass
class IssuedTrader:
    """Dataclass containing issuer data

    Attributes:
        name: The name of this issuer
        symbol: The symbol of this issuer
    """

    name: str
    symbol: str
