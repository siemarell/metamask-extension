const EventEmitter = require('events')
const ObservableStore = require('obs-store')
const ComposedStore = require('obs-store/lib/composed')

const env = process.env.METAMASK_ENV
const METAMASK_DEBUG = process.env.METAMASK_DEBUG
const testMode = (METAMASK_DEBUG || env === 'test')
const WavesAPI = require('@waves/waves-api')

const NETWORK = {
  TESTNET: 'TESTNET',
  MAINNET: 'MAINNET'
}

const PROVIDER = {
  TESTNET: WavesAPI.TESTNET_CONFIG,
  MAINNET: WavesAPI.MAINNET_CONFIG,
  LOCALHOST: {}
}

const defaultProviderConfig = testMode ? PROVIDER.TESTNET : PROVIDER.MAINNET

module.exports = class WavesNetworkController extends EventEmitter{
  constructor(opts){
    super()
    // parse options
    const providerConfig = opts.provider || defaultProviderConfig
    // create stores
    this.providerStore = new ObservableStore(providerConfig)
    this.networkStore = new ObservableStore('loading')
    this.store = new ComposedStore({ wavesProvider: this.providerStore, wavesNetwork: this.networkStore })
    // create event emitter proxy
    //this._proxy = createEventEmitterProxy()

    // setup waves api
    this.Waves = WavesAPI.create(providerConfig)
    this.on('networkDidChange', this.lookupNetwork)
  }

  verifyNetwork () {
    // Check network when restoring connectivity:
    if (this.isNetworkLoading()) this.lookupNetwork()
  }

  getNetworkState () {
    return this.networkStore.getState()
  }

  setNetworkState (network) {
    return this.networkStore.putState(network)
  }

  isNetworkLoading () {
    return this.getNetworkState() === 'loading'
  }

  async lookupNetwork () {
    // Lib has no method to check network id. I ask balances of addresses. One for testnet and one for mainnet
    this.Waves.API.Node.addresses.balance('3MpkdJR4Kf2wS9XGeqANK15tN9YQZib4LaQ')
      .then(() => this.setNetworkState(NETWORK.TESTNET))
      .catch(() =>  this.Waves.API.Node.addresses.balance('3P3oWUH9oXRqiByBG7g9hYSDpCFxcT2wTBS')
        .then(() => this.setNetworkState(NETWORK.MAINNET))
        .catch(() => this.setNetworkState('loading')))
  }

  async setProviderType (type) {
    const providerConfig = PROVIDER[type]
    if (!providerConfig) throw new Error( `WavesNetworkController - Unknown provider type "${type}"`)
    this.providerConfig = providerConfig
  }

  resetConnection () {
    this.providerConfig = this.getProviderConfig()
  }

  set providerConfig (providerConfig) {
    this.providerStore.updateState(providerConfig)
    this._switchNetwork(providerConfig)
  }

  getProviderConfig () {
    return this.providerStore.getState()
  }

  //
  // Private
  //

  _switchNetwork (opts) {
    this.setNetworkState('loading')
    this._configureProvider(opts)
    this.emit('networkDidChange')
  }

  _configureProvider (opts) {
    this.Waves.config.set(opts)
  }
}