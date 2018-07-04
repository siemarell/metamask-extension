const ObservableStore = require('obs-store')
const WavesApi = require('@waves/waves-api')

module.exports = class WavesKeyring {
  constructor(){
    const SEEDS = ['boss machine believe review brass fringe sea palace object same report leopard duty coin orange']
    const Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)
    this.accounts = SEEDS
      .map(seed => {
        return Waves.Seed.fromExistingPhrase(seed)
      })
      .reduce((prev, next) => {
        prev[next.address] = next
        return prev
      }, {})
    this.store = new ObservableStore({wavesAccounts: this.accounts})
  }

  sign(address, bytes){

  }
}