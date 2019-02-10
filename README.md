Crypto trade bot using a logistic regression algorithm to determine buys. Utilizes the tulind indicator library with data fetched from CryptoCompare as log reg input. Executes buys/sells on Bittrex. MongoDB will need to be installed and running in order to record ticks/personal trade data.

To get started:

1. Run 'commands.js data refresh-ticks' to collect initial tick data
2. Run 'record-ticks.js' from root to start collecting tick data, this window will stay open and running, it'll run every hour on the hour
3. Run 'index.js' to start trading, options are global vars at the top of the file