const EventEmitter = require('events')
const ObservableStore = require('obs-store')
const log = require('loglevel')
const WavesApi = require('@waves/waves-api')
const createId = require('../../lib/random-id')
const WavesKeyring = require('./wavesKeyring')

module.exports = class WavesNetworkController extends EventEmitter {
  constructor(opts = {}) {
    super()

    //setup store
    const initState =  opts.initState || {transactions: []}
    this.txStore = new ObservableStore(initState)
    this.unapprovedTxStore =  new ObservableStore()
    this._updateUnapprovedTxStore()
    this.txStore.subscribe(()=>this._updateUnapprovedTxStore())

    //Setup Waves patched api
    const Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)
    Waves.API.Node.addresses.get = this.getAddresses.bind(this)
    Waves.API.Node.addresses.signText = this.signText.bind(this)
    Waves.API.Node.assets.transfer = this.transfer.bind(this)
    this.Waves = Waves

    // Setup Keyring
    this.keyring = new WavesKeyring()

  }

  addUnapprovedTx(txMeta){
    this.once(`${txMeta.id}:signed`, function (txId) {
      this.removeAllListeners(`${txMeta.id}:rejected`)
    })
    this.once(`${txMeta.id}:rejected`, function (txId) {
      this.removeAllListeners(`${txMeta.id}:signed`)
    })
    const oldState = this.txStore.getState()
    const oldTxs = this.txStore.getState().transactions
    const newTxs = [...oldTxs, txMeta]
    const newState = Object.assign({}, oldState, {transactions: newTxs})
    this._saveState(newState)
  }

  _setTxStatus(txId, status){
    const txMeta = this.getTx(txId)
    txMeta.status = status
    const txList = this.txStore.getState().transactions
    const index = txList.findIndex(txMeta=> txMeta.id === txId)
    txList[index] = txMeta
    this.emit(`${txMeta.id}:${status}`, txId)
    this.emit(`tx:status-update`, txId, status)
    this.emit('update:badge')
    this._saveState({transactions: txList})
  }

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
      this.once(`${txMeta.id}:approved`, txId => {
        resolve(`approved: ${txId}`)
      })
      this.once(`${txMeta.id}:rejected`, txId => {
        reject(`rejected: ${txId}`)
      })
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

  getTx (txId) {
    const txMeta = this.txStore.getState().transactions.filter(tx=> tx.id === txId )[0]
    return txMeta
  }

  _updateUnapprovedTxStore(){
    const unapprovedTxs = this.txStore.getState().transactions.filter(tx => tx.status === 'unapproved')
    this.unapprovedTxStore.updateState({unapprovedWavesTxs: unapprovedTxs})
  }

  async approveTransaction(txId){
    this._setTxStatus(txId, 'approved')
  }

  async cancelTransaction(txId){
    this._setTxStatus(txId, 'rejected')
  }
}