import pytest

from capitolscraper import Trades

pytest_plugins = ("pytest_asyncio",)


@pytest.fixture(scope="function")
def trades():
    return Trades(page_count=50)


class TestTrades:
    @pytest.mark.asyncio
    async def test_trades(self, trades):
        trade_collection = await trades.trades

        assert len(trade_collection) != 0
        assert trade_collection[0].politician is not None
        assert trade_collection[0].issuer is not None
        assert trade_collection[0].dates is not None
        assert trade_collection[0].owner is not None
        assert trade_collection[0].action is not None
        assert trade_collection[0].size is not None

        assert trade_collection == await trades.trades

    @pytest.mark.asyncio
    async def test_stats(self, trades):
        first_stats = await trades.stats
        assert first_stats.trades is not None
        assert first_stats.filings is not None
        assert first_stats.volume is not None
        assert first_stats.politicians is not None
        assert first_stats.issuers is not None

        second_stats = await trades.stats
        assert second_stats.trades == first_stats.trades
        assert second_stats.filings == first_stats.filings
        assert second_stats.volume == first_stats.volume
        assert second_stats.politicians == first_stats.politicians
        assert second_stats.issuers == first_stats.issuers

    @pytest.mark.asyncio
    async def test_total_pages(self, trades):
        first = await trades.total_pages
        assert first is not None

        second = await trades.total_pages
        assert second == first
