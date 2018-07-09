const log = require('loglevel')
const ObservableStore = require('obs-store')
const WavesApi = require('@waves/waves-api/raw/src/WavesAPI.js')
const encryptor = require('browser-passworder')
const EventEmitter = require('events').EventEmitter

module.exports = class WavesKeyring {
  constructor(){
    const SEEDS = ['boss machine believe review brass fringe sea palace object same report leopard duty coin orange',
      'talk lottery wasp evolve humble staff magnet unlock agent inner frequent assist elevator critic rice']

    this.Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)
    this.accounts = SEEDS
      .map(seed => {
        return this.Waves.Seed.fromExistingPhrase(seed)
      })
      .reduce((prev, next) => {
        prev[next.address] = next
        return prev
      }, {})
  }

  getAccounts(){
    return Object.keys(this.accounts)
  }

  publicKeyFromAddress(address){
    return this.accounts[address] && this.accounts[address].keyPair.publicKey
  }

  async signTx(txData){
    const privateKey = this.accounts[txData.sender].keyPair.privateKey
    const transfer = await this.Waves.tools.createTransaction(txData.type, txData)
    transfer.addProof(privateKey)
    return await transfer.getJSON()
  }

  signBytes(address, bytes){
    const privateKey = this.accounts[address].keyPair.privateKey
    const signature =  this.Waves.crypto.buildTransactionSignature(bytes, privateKey)
    return signature
  }
}