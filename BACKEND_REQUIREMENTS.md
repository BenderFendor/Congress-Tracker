# Backend Requirements for Portfolio Dashboard

The new Portfolio dashboard introduced several advanced metrics and insights that are currently mocked on the frontend because the necessary data isn't provided by the backend APIs yet.

To make the dashboard fully functional, the backend needs to support the following features/endpoints:

1.  **Estimated Returns (Performance)**
    *   **Requirement**: Calculate or estimate the financial return (e.g., `+18.7%`) of a politician's stock portfolio over a specific timeframe (e.g., YTD, 1-year).
    *   **Usage**: Displayed on the "Top Active Members" table and the "Featured Portfolio" card.

2.  **Market Pulse / Congress Trading Activity Trend**
    *   **Requirement**: Aggregate total trading volume or count across Congress and compare it to previous periods (e.g., "Congress trading activity is up 14.3% this month").
    *   **Usage**: Displayed in the "Market Pulse" footer card.

3.  **Trending Sector Performance**
    *   **Requirement**: Track the performance or trading volume of specific sectors over time to identify which sector is "trending" (e.g., "Technology +22.4%").
    *   **Usage**: Displayed in the "Trending Sector" footer card.

4.  **Disclosure Compliance Rate**
    *   **Requirement**: Calculate the percentage of trades reported within the required 45-day window under the STOCK Act.
    *   **Usage**: Displayed in the "Compliance" footer card (e.g., "98.6% Timely Rate").

5.  **Detailed Portfolio Holdings (Asset Allocation)**
    *   **Requirement**: Provide a breakdown of a member's current estimated holdings (by ticker and allocation percentage) based on their historical trades.
    *   **Usage**: Displayed in the "Top Holdings" list and the "Asset Allocation" donut chart on the "Featured Portfolio" card.

6.  **Sector Exposure vs. Benchmark (S&P 500)**
    *   **Requirement**: Provide aggregated sector exposure for Congress as a whole and compare its performance against a benchmark like the S&P 500.
    *   **Usage**: Displayed in the "Sector Exposure" card's performance metric.