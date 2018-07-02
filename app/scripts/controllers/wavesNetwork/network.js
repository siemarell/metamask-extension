const EventEmitter = require('events')
const ObservableStore = require('obs-store')
const ComposedStore = require('obs-store/lib/composed')
const log = require('loglevel')
const Waves = require('./wavesPatchedApi')

module.exports = class WavesNetworkController extends EventEmitter {
  constructor(opts = {}) {
    super()
    this.txStore = opts.networkStore || new ObservableStore({
      transactions: []
    })
  }

  addUnapprovedTx(tx){
    const newState = [...this.txStore.getState(), {status: 'unapproved', tx: tx}]
    this._saveState(newState)
  }

  updateTxStatus(txId, status){

  }

  _saveState(newState){
    this.txStore.updateState(newState)
  }

}