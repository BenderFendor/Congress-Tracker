"""This module contains utility functions for the scraper module"""

from datetime import datetime, timedelta
from typing import List

import httpx
from bs4 import BeautifulSoup

from .dataclasses import Dates, IssuedTrader, PageData, Politician, Trade, TradesStats


async def make_request(page: str, page_num: int = 1) -> httpx.Response:
    """Make an async request on capitoltrades

    Args:
        page: The page to make a request on, valid options are: \"trades\"
        page_num: The specific page to make a request on

    Raises:
        HTTPStatusError on unsuccessful status code
    """
    async with httpx.AsyncClient(
        transport=httpx.AsyncHTTPTransport(retries=3),
        timeout=10,
    ) as client:
        res = await client.get(
            f"https://www.capitoltrades.com/{page}?page={page_num}&pageSize=96"
        )
        res.raise_for_status()
        return res


def parse_trade_page(text: str) -> List[Trade]:
    """Parse the trades found within a page"""
    soup = BeautifulSoup(text, "html.parser")
    trades = soup.find_all(
        "tr",
    )

    return [_parse_trade(trade) for trade in trades[1:]]


def _parse_trade(trade) -> Trade:
    data = trade.find_all(
        "td", {"class": "align-middle [&:has([role=checkbox])]:pr-0 p-0"}
    )

    return Trade(
        _parse_politician(data[0].text),
        _parse_issuer(data[1]),
        _parse_dates(data[2:5]),
        data[5].text,
        data[6].text.capitalize(),
        data[7].text.replace("\u2013", "-"),
        None if data[8].text == "N/A" else float(data[8].text[1:].replace(",", "")),
    )


def _parse_politician(text: str) -> Politician:
    if "Democrat" in text:
        party = "Democrat"
        text = text.replace("Democrat", " ")
    elif "Republican" in text:
        party = "Republican"
        text = text.replace("Republican", " ")
    else:
        party = "Independent"
        text = text.replace("Other", " ")

    if "House" in text:
        chamber = "House"
        text = text.replace("House", "")
    else:
        chamber = "Senate"
        text = text.replace("Senate", "")

    return Politician(text[0:-2].strip(), party, chamber, text[-2:])


def _parse_issuer(block) -> IssuedTrader:
    name = block.find("h3").text
    symbol = block.find("span").text
    return IssuedTrader(name, symbol)


def _parse_dates(trades: List) -> Dates:
    data: List[str] = []
    for dates in trades[:2]:
        if "Today" in dates.text:
            data.append(datetime.today().strftime("%Y-%m-%d"))
        elif "Yesterday" in dates.text:
            data.append((datetime.today() - timedelta(1)).strftime("%Y-%m-%d"))
        else:
            day_month = dates.find("div", {"class": "text-size-3 font-medium"}).text
            if "Sept" in day_month:
                day_month = day_month.replace("Sept", "Sep")
            year = dates.find("div", {"class": "text-size-2 text-txt-dimmer"}).text
            data.append(
                datetime.strptime(" ".join([day_month, year]), "%d %b %Y").strftime(
                    "%Y-%m-%d"
                )
            )
    return Dates(
        data[0],
        data[1],
        int(trades[2].find("div", {"class": "q-value leading-snug"}).text),
    )


def parse_page_data(text: str) -> PageData:
    """Parse the page for page specific data"""
    soup = BeautifulSoup(text, "html.parser")

    elem = soup.find(
        "p",
        {"class": "hidden leading-7 sm:block"},
    )

    nums = elem.find_all("b")  # type: ignore

    data = [int(num.text) for num in nums]
    return PageData(*data)


def parse_trade_stats(text: str) -> TradesStats:
    """Parse the page for trade stats"""
    soup = BeautifulSoup(text, "html.parser")

    elems = soup.find_all(
        "div",
        {"class": "text-size-5 font-medium leading-6 text-txt"},
    )

    data = [elem.text for elem in elems]
    return TradesStats(
        int(data[0].replace(",", "")),
        int(data[1].replace(",", "")),
        data[2],
        int(data[3].replace(",", "")),
        int(data[4].replace(",", "")),
    )
