const log = require('loglevel')
const ObservableStore = require('obs-store')
const WavesApi = require('@waves/waves-api')
const EventEmitter = require('events').EventEmitter
const {Address} = require('./util')
const type = 'Waves Simple Keyring'

class WavesSimpleKeyring extends EventEmitter{
  constructor(opts){
    super()
    this.type = type
    // const SEEDS = ['boss machine believe review brass fringe sea palace object same report leopard duty coin orange',
    //   'talk lottery wasp evolve humble staff magnet unlock agent inner frequent assist elevator critic rice']

    this.Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)

    this.deserialize(opts)// || SEEDS)
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

  async getAccounts(){
    return Object.keys(this.accounts).map(address=> Address(address, "WAVES"))
  }

  async signTransaction(withAccount, txData){
    const wallet = this._getWalletForAccount(withAccount)
    Object.assign(txData, {senderPublicKey: wallet.keyPair.publicKey})

    const transfer = await this.Waves.tools.createTransaction(txData.type, txData)
    transfer.addProof(wallet.keyPair.privateKey)
    return await transfer.getJSON()
  }

  async signMessage(withAccount, bytes){
    const wallet = this._getWalletForAccount(withAccount)
    const signature =  this.Waves.crypto.buildTransactionSignature(bytes, wallet.keyPair.privateKey)
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
    if (!wallet) throw new Error(`Waves Simple Keyring - Unable to find matching address ${address}`)
    return wallet
  }
}
WavesSimpleKeyring.type = type
module.exports = WavesSimpleKeyring