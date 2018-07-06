const valuesFor = require('../app/util').valuesFor
const log = require('loglevel')

module.exports = function (unapprovedTxs, unapprovedMsgs, personalMsgs, typedMessages, unapprovedWavesTxs, network) {
  log.debug('tx-helper called with params:')
  log.debug({ unapprovedTxs, unapprovedMsgs, personalMsgs, typedMessages, unapprovedWavesTxs, network })

  const txValues = network ? valuesFor(unapprovedTxs).filter(txMeta => txMeta.metamaskNetworkId === network) : valuesFor(unapprovedTxs)
  log.debug(`tx helper found ${txValues.length} unapproved txs`)

  const msgValues = valuesFor(unapprovedMsgs)
  log.debug(`tx helper found ${msgValues.length} unsigned messages`)
  let allValues = txValues.concat(msgValues)

  const personalValues = valuesFor(personalMsgs)
  log.debug(`tx helper found ${personalValues.length} unsigned personal messages`)
  allValues = allValues.concat(personalValues)

  const typedValues = valuesFor(typedMessages)
  log.debug(`tx helper found ${typedValues.length} unsigned typed messages`)
  allValues = allValues.concat(typedValues)

  const wavesValues = valuesFor(unapprovedWavesTxs)
  log.debug(`tx helper found ${wavesValues.length} unsigned waves txs`)
  allValues = allValues.concat(wavesValues)

  allValues = allValues.sort((a, b) => {
    return a.time > b.time
  })

  return allValues
}
