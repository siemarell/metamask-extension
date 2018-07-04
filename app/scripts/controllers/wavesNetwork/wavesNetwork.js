const EventEmitter = require('events')
const ObservableStore = require('obs-store')
const ComposableObservableStore = require('../../lib/ComposableObservableStore')
const log = require('loglevel')
const WavesApi = require('@waves/waves-api')
const createId = require('../../lib/random-id')
const WavesKeyring = require('./wavesKeyring')

module.exports = class WavesNetworkController extends EventEmitter {
  constructor(opts = {}) {
    super()
    this.txStore = opts.networkStore || new ObservableStore({
      //wavesTransactions: [],
      unapprovedWavesTxs: []
    })

    //Setup Waves patched api
    const Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)
    Waves.API.Node.addresses.get = this.getAddresses.bind(this)
    Waves.API.Node.addresses.signText = this.signText.bind(this)
    Waves.API.Node.assets.transfer = this.transfer.bind(this)
    this.Waves = Waves
    //console.log(this.Waves)

    // Setup Keyring
    this.keyring = new WavesKeyring()

    // Setup composed store doesnt work !!!
    // this.store = new ComposableObservableStore(null,{
    //   txStore: this.txStore,
    //   keyringStore: this.keyring.store
    // })
    // console.log(this.store.getFlatState())
  }

  addUnapprovedTx(txMeta){
    const oldState = this.txStore.getState()
    const oldTxs = this.txStore.getState().unapprovedWavesTxs
    const newTxs = [...oldTxs, txMeta]
    const newState = Object.assign({}, oldState, {unapprovedWavesTxs: newTxs})
    this._saveState(newState)
  }

  // updateTxStatus(txId, status){
  //   const prevTxs = this.txStore.getState().wavesTransactions
  //   const newTxs = prevTxs.map(tx => {
  //     if (tx.Id = txId){
  //       return Object.assign(tx, {status: status})
  //     }else return tx
  //   })
  //   this._saveState({wavesTransactions: newTxs})
  // }

  _saveState(newState){
    this.txStore.updateState(newState)
  }

  transfer(sender, recipient, amount, fee = 100000, assetId = 'WAVES') {
    //const seed = accounts[sender]
    const transferData = {
      //Metamask field sender
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

    const txMeta = {
      id: createId(),
      status: 'unapproved',
      type: 'waves_transfer',
      txParams: transferData,
      time: transferData.timestamp
    }
    this.addUnapprovedTx(txMeta)
    //const result = this.Waves.API.Node.transactions.broadcast('transfer', transferData, seed.keyPair)
    const result = new Promise((resolve, reject) => {
      resolve('got it')
    });
    return result
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
    return Promise.resolve(this.keyring.store.getState())
  }
}