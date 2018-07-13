const log = require('loglevel')
const ObservableStore = require('obs-store')
const WavesApi = require('@waves/waves-api')
const EventEmitter = require('events').EventEmitter
const type = 'Waves Simple Keyring'

class WavesSimpleKeyring extends EventEmitter{
  constructor(opts){
    super()
    this.type = type
    const SEEDS = ['boss machine believe review brass fringe sea palace object same report leopard duty coin orange',
      'talk lottery wasp evolve humble staff magnet unlock agent inner frequent assist elevator critic rice']

    this.Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)

    this.deserialize(opts || SEEDS)
  }

  async serialize(){
    const result = Object.keys(this.accounts).map(key => this.accounts[key].phrase)
    return result
  }

  async deserialize(seeds = []){
    this.accounts = seeds.map(seed => this.Waves.Seed.fromExistingPhrase(seed))
      .reduce((prev, next) => {
        prev[next.address] = next
        return prev
      }, {})
  }

  getAccounts(){
    return Promise.resolve(Object.keys(this.accounts))
  }

  async signTransaction(withAccount, txData){
    const privateKey = this.accounts[withAccount].keyPair.privateKey
    const transfer = await this.Waves.tools.createTransaction(txData.type, txData)
    transfer.addProof(privateKey)
    return await transfer.getJSON()
  }

  async signMessage(withAccount, bytes){
    const privateKey = this.accounts[withAccount].keyPair.privateKey
    const signature =  this.Waves.crypto.buildTransactionSignature(bytes, privateKey)
    return signature
  }

  // exportAccount should return a hex-encoded private key:
  exportAccount (address) {
    const wallet = this._getWalletForAccount(address)
    return Promise.resolve(wallet.getPrivateKey().toString('hex'))
  }

  publicKeyFromAddress(address){
    return this.accounts[address] && this.accounts[address].keyPair.publicKey
  }


  _getWalletForAccount (address) {
    let wallet = this.accounts[address]
    if (!wallet) throw new Error('Waves Simple Keyring - Unable to find matching address.')
    return wallet
  }
}
WavesSimpleKeyring.type = type
module.exports = WavesSimpleKeyring