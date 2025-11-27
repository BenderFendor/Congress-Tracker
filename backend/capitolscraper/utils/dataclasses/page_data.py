"""This module contains a page data dataclass"""

from dataclasses import dataclass


@dataclass
class PageData:
    """Data pertaining to a single page on capitoltrades

    Args:
        current: The current page of this dataclass
        total: The total number of pages
    """

    current: int
    total: int
