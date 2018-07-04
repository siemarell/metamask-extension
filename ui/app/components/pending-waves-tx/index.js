const Component = require('react').Component
const connect = require('react-redux').connect
const h = require('react-hyperscript')
const PropTypes = require('prop-types')
const clone = require('clone')
const inherits = require('util').inherits
const actions = require('../../actions')
const Loading = require('../loading-screen')

const TX_TYPES = {
  SEND_WAVES: 'waves_transfer',
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(PendingTx)

function mapStateToProps (state) {
  const {
    conversionRate,
    identities,
    tokens: existingTokens,
  } = state.metamask
  const accounts = state.metamask.accounts
  const selectedAddress = state.metamask.selectedAddress || Object.keys(accounts)[0]
  return {
    conversionRate,
    identities,
    selectedAddress,
    existingTokens,
  }
}

function mapDispatchToProps (dispatch) {
  return {
    backToAccountDetail: address => dispatch(actions.backToAccountDetail(address)),
    cancelTransaction: ({ id }) => dispatch(actions.cancelTx({ id })),
  }
}

inherits(PendingTx, Component)


function PendingTx () {
  Component.call(this)
  this.state = {
    isFetching: true,
    transactionType: '',
    tokenAddress: '',
    tokenSymbol: '',
    tokenDecimals: '',
  }
}

PendingTx.prototype.componentDidMount = function () {
  this.setTokenData()
}

PendingTx.prototype.componentDidUpdate = function (prevProps, prevState) {
  if (prevState.isFetching) {
    this.setTokenData()
  }
}

PendingTx.prototype.setTokenData = async function () {
  this.setState({
    transactionType: TX_TYPES.SEND_WAVES,
    isFetching: false,
  })
}

PendingTx.prototype.gatherTxMeta = function () {
  const props = this.props
  const state = this.state
  const txData = clone(state.txData) || clone(props.txData)

  return txData
}

PendingTx.prototype.render = function () {
  const {
    isFetching,
    transactionType,
    tokenAddress,
    tokenSymbol,
    tokenDecimals,
  } = this.state

  const { sendTransaction } = this.props

  if (isFetching) {
    return h(Loading, {
      loadingMessage: this.context.t('generatingTransaction'),
    })
  }

  switch (transactionType) {
    case TX_TYPES.SEND_WAVES:
      return h(ConfirmSendWaves, {
        txData: this.gatherTxMeta(),
        sendTransaction,
      })
    default:
      return h(Loading)
  }
}

PendingTx.contextTypes = {
  t: PropTypes.func,
}
