const EventEmitter = require('events')
const ObservableStore = require('obs-store')
const ComposedStore = require('obs-store/lib/composed')
const log = require('loglevel')

module.exports = class WavesNetworkController extends EventEmitter {
    constructor(opts = {}){
        super()
    }

    _configureProvider(opts){
        const {nodeUrl} = opts
        
    }
}