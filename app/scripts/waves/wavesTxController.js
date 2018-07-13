const EventEmitter = require('events')
const ObservableStore = require('obs-store')
const log = require('loglevel')
const WavesApi = require('@waves/waves-api')
const createId = require('../lib/random-id')
const WavesKeyring = require('./wavesSimpleKeyring')
const TransactionStateManager = require('../controllers/transactions/tx-state-manager')
const cleanErrorStack = require('../lib/cleanErrorStack')

module.exports = class WavesTxController extends EventEmitter {
  constructor(opts = {}) {
    super()
    this.preferencesStore = opts.preferencesStore || new ObservableStore({})
    this.memStore = new ObservableStore({})

    this._mapMethods()
    this.txStateManager = new TransactionStateManager({
      initState: opts.initState,
      txHistoryLimit: opts.txHistoryLimit,
      getNetwork: this.getNetwork.bind(this)
    })
    //this._onBootCleanUp()


    this.store = this.txStateManager.store

    this.txStateManager.store.subscribe(() => this.emit('update:badge'))
    this._setupListners()
    // memstore is computed from a few different stores
    this._updateMemstore()
    this.txStateManager.store.subscribe(() => this._updateMemstore())
    //this.networkStore.subscribe(() => this._updateMemstore())
    this.preferencesStore.subscribe(() => this._updateMemstore())


    //Setup Waves patched api
    const Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)
    Waves.API.Node.addresses.get = this.getAddresses.bind(this)
    Waves.API.Node.addresses.signText = this.signText.bind(this)
    Waves.API.Node.assets.transfer = this.transfer.bind(this)
    this.Waves = Waves
    // Setup Keyring
    this.keyring = new WavesKeyring()

  }

  /**
   Adds a tx to the txlist
   @emits ${txMeta.id}:unapproved
   */
  addTx (txMeta) {
    this.txStateManager.addTx(txMeta)
    this.emit(`${txMeta.id}:unapproved`, txMeta)
  }


  /**
   Wipes the transactions for a given account
   @param {string} address - hex string of the from address for txs being removed
   */
  wipeTransactions (address) {
    this.txStateManager.wipeTransactions(address)
  }

  /**
   add a new unapproved transaction to the pipeline

   @returns {Promise<string>} the hash of the transaction after being submitted to the network
   @param txParams {object} - txParams for the transaction
   @param opts {object} - with the key origin to put the origin on the txMeta
   */
  async newUnapprovedTransaction (txParams, opts = {}) {
    log.debug(`MetaMaskController newUnapprovedTransaction ${JSON.stringify(txParams)}`)
    const initialTxMeta = await this.addUnapprovedTransaction(txParams)
    initialTxMeta.origin = opts.origin
    this.txStateManager.updateTx(initialTxMeta, '#newUnapprovedTransaction - adding the origin')
    // listen for tx completion (success, fail)
    return new Promise((resolve, reject) => {
      this.txStateManager.once(`${initialTxMeta.id}:finished`, (finishedTxMeta) => {
        switch (finishedTxMeta.status) {
          case 'submitted':
            return resolve(finishedTxMeta.hash)
          case 'rejected':
            return reject(cleanErrorStack(new Error('MetaMask Tx Signature: User denied transaction signature.')))
          case 'failed':
            return reject(cleanErrorStack(new Error(finishedTxMeta.err.message)))
          default:
            return reject(cleanErrorStack(new Error(`MetaMask Tx Signature: Unknown problem: ${JSON.stringify(finishedTxMeta.txParams)}`)))
        }
      })
    })
  }

  /**
   Validates and generates a txMeta with defaults and puts it in txStateManager
   store

   @returns {txMeta}
   */
  async addUnapprovedTransaction (txParams) {
    let txMeta = this.txStateManager.generateTxMeta({ txParams: txParams })
    this.addTx(txMeta)
    this.emit('newUnapprovedTx', txMeta)

    return txMeta
  }

  /**
   updates the txMeta in the txStateManager
   @param txMeta {Object} - the updated txMeta
   */
  async updateTransaction (txMeta) {
    this.txStateManager.updateTx(txMeta, 'confTx: user updated transaction')
  }

  /**
   updates and approves the transaction
   @param txMeta {Object}
   */
  async updateAndApproveTransaction (txMeta) {
    this.txStateManager.updateTx(txMeta, 'confTx: user approved transaction')
    await this.approveTransaction(txMeta.id)
  }

  /**
   sets the tx status to approved
   signs the transaction
   publishes the transaction
   if any of these steps fails the tx status will be set to failed
   @param txId {number} - the tx's Id
   */
  async approveTransaction (txId) {
    try {
      // approve
      this.txStateManager.setTxStatusApproved(txId)
      // sign transaction
      await this.signTransaction(txId)
      // publish transaction
      await this.publishTransaction(txId)
    } catch (err) {
        this.txStateManager.setTxStatusFailed(txId, err)
      throw err
    }
  }

  /**
   signs the transaction, saves it to store and sets the status to signed
   @param txId {number} - the tx's Id
   */
  async signTransaction(txId){
    const txMeta = this.txStateManager.getTx(txId)
    const signedTxParams = await this.keyring.signTransaction(txMeta.txParams.sender, txMeta.txParams)
    const newTxMeta = Object.assign({}, txMeta, {txParams: signedTxParams})
    this.txStateManager.updateTx(newTxMeta, 'transactions#signTransaction')
    this.txStateManager.setTxStatusSigned(txMeta.id)
  }

  async publishTransaction(txId){
    const txMeta = this.txStateManager.getTx(txId)
    try{
      const publishedTxParams = await this.Waves.API.Node.transactions.rawBroadcast(txMeta.txParams)
      const newTxMeta = Object.assign({}, txMeta, {txParams: publishedTxParams})
      this.setTxHash(txId, newTxMeta.txParams.id)
      this.txStateManager.setTxStatusSubmitted(txId)
    }catch (e) {
      this.txStateManager.setTxStatusFailed(txId, e)
    }
  }

  /**
   Convenience method for the ui thats sets the transaction to rejected
   @param txId {number} - the tx's Id
   @returns {Promise<void>}
   */
  async cancelTransaction (txId) {
    this.txStateManager.setTxStatusRejected(txId)
  }

  /**
   Sets the txHas on the txMeta
   @param txId {number} - the tx's Id
   @param txHash {string} - the hash for the txMeta
   */
  setTxHash (txId, txHash) {
    // Add the tx hash to the persisted meta-tx object
    const txMeta = this.txStateManager.getTx(txId)
    txMeta.hash = txHash
    this.txStateManager.updateTx(txMeta, 'transactions#setTxHash')
  }
  //
//           PRIVATE METHODS
//
  /** maps methods for convenience*/
  _mapMethods () {
    /** @returns the state in transaction controller */
    this.getState = () => this.memStore.getState()
    /** @returns the network number stored in networkStore */
    this.getNetwork = () => 'WAVES_TESTNET'
    //this.getNetwork = () => this.networkStore.getState()
    /** @returns the user selected address */
    this.getSelectedAddress = () => this.preferencesStore.getState().selectedAddress
    /** Returns an array of transactions whos status is unapproved */
    this.getUnapprovedTxCount = () => Object.keys(this.txStateManager.getUnapprovedTxList()).length
    /**
     @returns a number that represents how many transactions have the status submitted
     @param account {String} - hex prefixed account
     */
    this.getPendingTxCount = (account) => this.txStateManager.getPendingTransactions(account).length
    /** see txStateManager */
    this.getFilteredTxList = (opts) => this.txStateManager.getFilteredTxList(opts)
  }

  /**
   is called in constructor applies the listeners for pendingTxTracker txStateManager
   and blockTracker
   */
  _setupListners () {
    this.txStateManager.on('tx:status-update', this.emit.bind(this, 'tx:status-update'))
    // this.pendingTxTracker.on('tx:warning', (txMeta) => {
    //   this.txStateManager.updateTx(txMeta, 'transactions/pending-tx-tracker#event: tx:warning')
    // })
    // this.pendingTxTracker.on('tx:confirmed', (txId) => this.txStateManager.setTxStatusConfirmed(txId))
    // this.pendingTxTracker.on('tx:confirmed', (txId) => this._markNonceDuplicatesDropped(txId))
    // this.pendingTxTracker.on('tx:failed', this.txStateManager.setTxStatusFailed.bind(this.txStateManager))
    // this.pendingTxTracker.on('tx:block-update', (txMeta, latestBlockNumber) => {
    //   if (!txMeta.firstRetryBlockNumber) {
    //     txMeta.firstRetryBlockNumber = latestBlockNumber
    //     this.txStateManager.updateTx(txMeta, 'transactions/pending-tx-tracker#event: tx:block-update')
    //   }
    // })
    // this.pendingTxTracker.on('tx:retry', (txMeta) => {
    //   if (!('retryCount' in txMeta)) txMeta.retryCount = 0
    //   txMeta.retryCount++
    //   this.txStateManager.updateTx(txMeta, 'transactions/pending-tx-tracker#event: tx:retry')
    // })
    //
    // this.blockTracker.on('block', this.pendingTxTracker.checkForTxInBlock.bind(this.pendingTxTracker))
    // // this is a little messy but until ethstore has been either
    // // removed or redone this is to guard against the race condition
    // this.blockTracker.on('latest', this.pendingTxTracker.resubmitPendingTxs.bind(this.pendingTxTracker))
    // this.blockTracker.on('sync', this.pendingTxTracker.queryPendingTxs.bind(this.pendingTxTracker))

  }

  /**
   Updates the memStore in transaction controller
   */
  _updateMemstore () {
    const wavesUnapprovedTxs = this.txStateManager.getUnapprovedTxList()
    const wavesSelectedAddressTxList = this.txStateManager.getFilteredTxList({
      from: this.getSelectedAddress(),
      metamaskNetworkId: this.getNetwork(),
    })
    this.memStore.updateState({ wavesUnapprovedTxs, wavesSelectedAddressTxList })
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
      timestamp: Date.now(),
      type: 'transfer'
    }

    return this.newUnapprovedTransaction(transferData)
  }

  async signText(address, text) {
    const uint8Array = new TextEncoder("utf-8").encode(text)
    const signature = await this.keyring.signMessage(address, uint8Array)
    return {
      "message" : text,
      "publicKey" : this.keyring.publicKeyFromAddress(address),
      "signature" : signature
    }
  }

  async getAddresses() {
    return this.keyring.getAccounts()
  }


}