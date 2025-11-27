# Capitol trades bot

# Based on [CapitolTrades](https://github.com/TommasoAmici/capitoltrades)

This takes Tommaso Amici's [CapitolTrades](https://github.com/TommasoAmici/capitoltrades) and extends it for the backend for my project. *I stripped out the Telegram bot code*

## CapitolTrades API 

The [capitoltrades_api](./crates/capitoltrades_api/) crate is a standalone
client for fetching data from <https://www.capitoltrades.com>.
It uses [reqwest](https://docs.rs/reqwest/latest/reqwest/) for synchronous HTTP requests.
