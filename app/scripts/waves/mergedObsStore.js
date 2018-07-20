const EventEmitter = require('events')
const R = require('ramda')
/**
 * Readonly merged state of many obs-stores. Concatenates arrays
 */
const mergeStates = R.reduce(R.mergeDeepWith(R.concat),{})

class MergedObservableStore extends EventEmitter{

  constructor (...stores) {
    super()
    this.stores = stores
    this.stores.forEach(store => {
      store.on('update', this.sendUpdate.bind(this))
    })
  }

  getState(){
    const states = this.stores.map(store => store.getState())
    return mergeStates(states)
  }

  sendUpdate(){
    const state = this.getState()
    this.emit('update', state)
  }

    // subscribe to changes
  subscribe (handler) {
    this.on('update', handler)
  }

  // unsubscribe to changes
  unsubscribe (handler) {
    this.removeListener('update', handler)
  }
}


module.exports = MergedObservableStore