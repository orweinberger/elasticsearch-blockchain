elasticsearch-blockchain
========================

This node script queries your bitcoin-core client via RPC and inserts data into an elasticsearch index.

### How does it work?

1. `getLastHeight()` will check if an index named `blocks` already exists in your elasticsearch instance.
2. If the index does not exist, it will return `0` to the `run()` function which will start the data gathering. If the index already exists it will query it to get the last inserted block height and will pass that value to `run()` so the process will continue where it was last stopped.
3. Data is pulled via the bitcoin-core RPC in the following manner:
  1. Run `getBlockHash()` with the current block height.
  2. Run `getBlock()` with the result.
  3. Iterate through all block transactions and get `getRawTransction()` .
  4. Get the TX information by running `decodeRawTransaction()`.
4. All trnasaction details for the given block are then flattened into block information under `block.txinfo`.
