const EventEmitter = require('events')
const ObservableStore = require('obs-store')
const log = require('loglevel')
const WavesApi = require('@waves/waves-api/raw/src/WavesAPI.js')
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
  getUnapprovedTxCount = () => Object.keys(this.unapprovedTxStore.getState().unapprovedWavesTxs).length
  addUnapprovedTx(txMeta){
    this.once(`${txMeta.id}:approved`, function (txId) {
      this.removeAllListeners(`${txMeta.id}:rejected`)
    })
    this.once(`${txMeta.id}:rejected`, function (txId) {
      this.removeAllListeners(`${txMeta.id}:approved`)
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
    try {
      this.updateTx(txMeta)
      this.emit(`${txMeta.id}:${status}`, txId)
      this.emit(`tx:status-update`, txId, status)
      if (['submitted', 'rejected', 'failed'].includes(status)) {
        this.emit(`${txMeta.id}:finished`, txMeta)
      }
      this.emit('update:badge')
    } catch (error) {
      log.error(error)
    }
  }

  _saveState(newState){
    this.txStore.updateState(newState)
  }

  transfer(sender, recipient, amount, fee = 100000, assetId = 'WAVES') {
    //const seed = accounts[sender]
    const senderPublicKey = this.keyring.publicKeyFromAddress(sender)
    if (!senderPublicKey) return Promise.reject(new Error('No account found with this address'))
    const transferData = {
      //Sender
      sender: sender,
      senderPublicKey: senderPublicKey,
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
    this.emit('update:badge')
    this.emit('newUnapprovedTx', txMeta)
    //const result = this.Waves.API.Node.transactions.broadcast('transfer', transferData, seed.keyPair)
    return new Promise((resolve, reject) => {
      this.once(`${txMeta.id}:finished`, (finishedTxMeta) => {
        switch (finishedTxMeta.status) {
          case 'submitted':
            return resolve(finishedTxMeta.txParams)
          case 'rejected':
            return reject(new Error('MetaMask Tx Signature: User denied transaction signature.'))
          case 'failed':
            return reject(new Error(finishedTxMeta.err.message))
          default:
            return reject(new Error(`MetaMask Tx Signature: Unknown problem: ${JSON.stringify(finishedTxMeta.txParams)}`))
        }
      })
    });
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
    return Promise.resolve(Object.keys(this.keyring.store.getState().wavesAccounts))
  }

  getTx (txId) {
    const txList = this.txStore.getState().transactions
    const txMeta = txList.filter(tx=> tx.id === txId )[0]
    return txMeta
  }

  _updateUnapprovedTxStore(){
    const unapprovedTxs = this.txStore.getState().transactions
      .filter(tx => tx.status === 'unapproved')
      .reduce((prev,next) =>{
        prev[next.id] = next
        return prev
      },{})
    this.unapprovedTxStore.updateState({unapprovedWavesTxs: unapprovedTxs})
  }

  updateTx(txMeta){
    // commit txMeta to state
    const txId = txMeta.id
    const txList = this.txStore.getState().transactions
    const index = txList.findIndex(txData => txData.id === txId)
    txList[index] = txMeta
    this._saveState({transactions: txList})
  }

  async approveTransaction(txId){
    this._setTxStatus(txId, 'approved')
  }

  async signTransaction(txId){
    const txMeta = this.getTx(txId)
    const signedTxParams = await this.keyring.sign(txMeta.txParams, txMeta.type.split('_')[1])
    const newTxMeta = Object.assign({}, txMeta, {txParams: signedTxParams})
    this.updateTx(newTxMeta)
    this._setTxStatus(txMeta.id, 'signed')
  }

  async publishTransaction(txId){
    const txMeta = this.getTx(txId)
    try{
      const publishedTx = await this.Waves.API.Node.transactions.rawBroadcast(txMeta.txParams)
      const newTxMeta = Object.assign(txMeta, {txParams: publishedTx})
      this.updateTx(newTxMeta)
      this._setTxStatus(txId, 'submitted')
    }catch (e) {
      const newTxMeta = Object.assign(txMeta, {err: e})
      this.updateTx(newTxMeta)
      this._setTxStatus(txId, 'failed')
    }

    this._setTxStatus(txId, 'submitted')
  }

  async sendTransaction(txMeta){
    const txId = txMeta.id
    try{
      await this.approveTransaction(txId)
      await this.signTransaction(txId)
      await this.publishTransaction(txId)
    }catch (e) {
      console.log(e)
    }
  }



  async cancelTransaction(txId){
    this._setTxStatus(txId, 'rejected')
  }
}