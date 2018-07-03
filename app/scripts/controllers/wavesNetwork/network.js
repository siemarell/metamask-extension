const EventEmitter = require('events')
const ObservableStore = require('obs-store')
const ComposedStore = require('obs-store/lib/composed')
const log = require('loglevel')
const WavesApi = require('@waves/waves-api')
const createId = require('../../lib/random-id')

const SEEDS = ['boss machine believe review brass fringe sea palace object same report leopard duty coin orange']
// const accounts = SEEDS
//   .map(seed => {
//     return Waves.Seed.fromExistingPhrase(seed)
//   })
//   .reduce((prev, next) => {
//     prev[next.address] = next
//     return prev
//   }, {})


module.exports = class WavesNetworkController extends EventEmitter {
  constructor(opts = {}) {
    super()
    this.txStore = opts.networkStore || new ObservableStore({
      wavesTransactions: []
    })

    //Setup Waves patched api
    const Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)
    Waves.API.Node.addresses.get = this.getAddresses.bind(this)
    Waves.API.Node.addresses.signText = this.signText.bind(this)
    Waves.API.Node.assets.transfer = this.transfer.bind(this)
    this.Waves = Waves
    //console.log(this.Waves)
  }

  addUnapprovedTx(tx){
    const oldState = this.txStore.getState()
    const oldTxs = this.txStore.getState().wavesTransactions
    const newTxs = [...oldTxs, Object.assign({}, tx, {status: 'unapproved'})]
    const newState = Object.assign({}, oldState, {wavesTransactions: newTxs})
    this._saveState(newState)
  }

  updateTxStatus(txId, status){
    const prevTxs = this.txStore.getState().wavesTransactions
    const newTxs = prevTxs.map(tx => {
      if (tx.Id = txId){
        return Object.assign(tx, {status: status})
      }else return tx
    })
    this._saveState({wavesTransactions: newTxs})
  }

  _saveState(newState){
    this.txStore.updateState(newState)
  }

  transfer(sender, recipient, amount, fee = 100000, assetId = 'WAVES') {
    //const seed = accounts[sender]
    const txData = {
      // Inner metamask id for tx
      id: createId(),
      // Inner metamask field sender, library need sender explicitly outside of txData
      sender: sender,
      // An arbitrary address; mine, in this example
      recipient: recipient,
      // ID of a token, or WAVES
      assetId: assetId,
      // The real amount is the given number divided by 10^(precision of the token)
      amount: amount,
      // The same rules for these two fields
      feeAssetId: assetId,
      fee: fee,
      // 140 bytes of data (it's allowed to use Uint8Array here)
      attachment: '',
      timestamp: Date.now()
    }
    this.addUnapprovedTx(txData)
    //const result = this.Waves.API.Node.transactions.broadcast('transfer', transferData, seed.keyPair)
    console.log(this.txStore.getState())
    return Promise.resolve('Go it')
  }

  signText(address, text) {
    const uint8Array = new TextEncoder("utf-8").encode(text)
    const signature = this.Waves.crypto.buildTransactionSignature(uint8Array, accounts[address].keyPair.privateKey)
    return Promise.resolve({
      "message" : text,
      "publicKey" : accounts[address].keyPair.publicKey,
      "signature" : signature
    })
  }

  getAddresses() {
    return Promise.resolve(Object.keys(accounts))
  }
}