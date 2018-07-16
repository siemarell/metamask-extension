const WavesApi = require('@waves/waves-api')
//Setup Waves patched api
export const Waves = WavesApi.create(WavesApi.TESTNET_CONFIG)
// Waves.API.Node.addresses.get = this.getAddresses.bind(this)
// Waves.API.Node.addresses.signText = this.signText.bind(this)
// Waves.API.Node.assets.transfer = this.transfer.bind(this)
// this.Waves = Waves