const WavesApi = require('@waves/waves-api')
const Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)

const SEEDS = ['boss machine believe review brass fringe sea palace object same report leopard duty coin orange']
const accounts = SEEDS
  .map(seed => {
    return Waves.Seed.fromExistingPhrase(seed)
  })
  .reduce((prev, next) => {
    prev[next.address] = next
    return prev
  }, {})

Waves.API.Node.addresses.get = getAddresses
Waves.API.Node.addresses.signText = signText
Waves.API.Node.assets.transfer = transfer

function transfer(sender, recipient, amount, fee = 100000, assetId = 'WAVES') {
  const seed = accounts[sender]
  const transferData = {
    // An arbitrary address; mine, in this example
    recipient: recipient,
    // ID of a token, or WAVES
    assetId: 'WAVES',
    // The real amount is the given number divided by 10^(precision of the token)
    amount: amount,
    // The same rules for these two fields
    feeAssetId: assetId,
    fee: fee,
    // 140 bytes of data (it's allowed to use Uint8Array here)
    attachment: '',
    timestamp: Date.now()
  }
  const result = Waves.API.Node.transactions.broadcast('transfer', transferData, seed.keyPair)
  console.log(result)
  return result
}

function signText(address, text) {
  const uint8Array = new TextEncoder("utf-8").encode(text)
  const signature = Waves.crypto.buildTransactionSignature(uint8Array, accounts[address].keyPair.privateKey)
  return Promise.resolve({
    "message" : text,
    "publicKey" : accounts[address].keyPair.publicKey,
    "signature" : signature
  })
}

function getAddresses() {
  return Promise.resolve(Object.keys(accounts))
}

module.exports = Waves