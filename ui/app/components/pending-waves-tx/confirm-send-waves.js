const Component = require('react').Component
const { withRouter } = require('react-router-dom')
const { compose } = require('recompose')
const PropTypes = require('prop-types')
const connect = require('react-redux').connect
const h = require('react-hyperscript')
const inherits = require('util').inherits
const actions = require('../../actions')
const clone = require('clone')
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const hexToBn = require('../../../../app/scripts/lib/hex-to-bn')
const classnames = require('classnames')
const {
  conversionUtil,
  addCurrencies,
  multiplyCurrencies,
} = require('../../conversion-util')
const {
  calcGasTotal,
  isBalanceSufficient,
} = require('../send_/send.utils')
//const GasFeeDisplay = require('../send_/send-content/send-gas-row/gas-fee-display/gas-fee-display.component').default
const SenderToRecipient = require('../sender-to-recipient')
const NetworkDisplay = require('../network-display')
const currencyFormatter = require('currency-formatter')
const currencies = require('currency-formatter/currencies')

const { MIN_GAS_PRICE_HEX } = require('../send_/send.constants')
const { SEND_ROUTE, DEFAULT_ROUTE } = require('../../routes')
const {
  ENVIRONMENT_TYPE_POPUP,
  ENVIRONMENT_TYPE_NOTIFICATION,
} = require('../../../../app/scripts/lib/enums')

import {
  updateSendErrors,
} from '../../ducks/send.duck'

confirmSendWaves.contextTypes = {
  t: PropTypes.func,
}

module.exports = compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps)
)(confirmSendWaves)


function mapStateToProps (state) {
  const {
    conversionRate,
    identities,
    currentCurrency,
    send,
  } = state.metamask
  const accounts = state.metamask.accounts
  const selectedAddress = state.metamask.selectedAddress || Object.keys(accounts)[0]
  //const { balance } = accounts[selectedAddress]
  return {
    conversionRate,
    identities,
    selectedAddress,
    currentCurrency,
    send,
   // balance,
  }
}

function mapDispatchToProps (dispatch) {
  return {
    clearSend: () => dispatch(actions.clearSend()),
    cancelTransaction: (txMeta) => dispatch(actions.cancelTx(txMeta)),
    updateSendErrors: error => dispatch(updateSendErrors(error)),
  }
}

inherits(confirmSendWaves, Component)
function confirmSendWaves () {
  Component.call(this)
  this.state = {}
  this.onSubmit = this.onSubmit.bind(this)
}

confirmSendWaves.prototype.updateComponentSendErrors = function (prevProps) {
  // const {
  //   balance: oldBalance,
  //   conversionRate: oldConversionRate,
  // } = prevProps
  // const {
  //   updateSendErrors,
  //   balance,
  //   conversionRate,
  //   send: {
  //     errors: {
  //       simulationFails,
  //     },
  //   },
  // } = this.props
  // const txMeta = this.gatherTxMeta()
  //
  // const shouldUpdateBalanceSendErrors = balance && [
  //   balance !== oldBalance,
  //   conversionRate !== oldConversionRate,
  // ].some(x => Boolean(x))
  //
  // if (shouldUpdateBalanceSendErrors) {
  //   const balanceIsSufficient = this.isBalanceSufficient(txMeta)
  //   updateSendErrors({
  //     insufficientFunds: balanceIsSufficient ? false : 'insufficientFunds',
  //   })
  // }
  //
  // const shouldUpdateSimulationSendError = Boolean(txMeta.simulationFails) !== Boolean(simulationFails)
  //
  // if (shouldUpdateSimulationSendError) {
  //   updateSendErrors({
  //     simulationFails: !txMeta.simulationFails ? false : 'transactionError',
  //   })
  // }
}

confirmSendWaves.prototype.componentWillMount = function () {
  this.updateComponentSendErrors({})
}

confirmSendWaves.prototype.componentDidUpdate = function (prevProps) {
  this.updateComponentSendErrors(prevProps)
}


confirmSendWaves.prototype.renderHeaderRow = function () {
  const windowType = window.METAMASK_UI_TYPE
  const isFullScreen = windowType !== ENVIRONMENT_TYPE_NOTIFICATION &&
    windowType !== ENVIRONMENT_TYPE_POPUP

  if (isFullScreen) {
    return null
  }

  return (
    h('.page-container__header-row', [
      !isFullScreen &&  h('.network-display__container', [h('.network-name', this.props.txData.metamaskNetworkId)
      ]),
    ])
  )
}

confirmSendWaves.prototype.renderHeader = function () {
  const title = this.context.t('confirm')
  const subtitle = this.context.t('pleaseReviewTransaction')

  return (
    h('.page-container__header', [
      this.renderHeaderRow(),
      h('.page-container__title', title),
      h('.page-container__subtitle', subtitle),
    ])
  )
}

confirmSendWaves.prototype.render = function () {
  const txParams = this.props.txData.txParams
  console.log(txParams)
  return (
    // Main Send token Card
    h('.page-container', [
      this.renderHeader(),
      h('.page-container__content', [
        h(SenderToRecipient, {
          senderName:txParams.sender,
          senderAddress: txParams.sender,
          recipientName: txParams.recipient,
          recipientAddress: txParams.recipient,
        }),

        h('h3.flex-center.confirm-screen-sending-to-message', {
          style: {
            textAlign: 'center',
            fontSize: '16px',
          },
        }, [
          `You're sending to Recipient ${txParams.recipient}`,
        ]),

       h('h3.flex-center.confirm-screen-send-amount', [`${txParams.amount / 100000000}`]),
        h('h3.flex-center.confirm-screen-send-amount-currency', [ `${txParams.assetId}` ]),
        // h('div.flex-center.confirm-memo-wrapper', [
        //   h('h3.confirm-screen-send-memo', [ memo ? `"${memo}"` : '' ]),
        // ]),

        h('div.confirm-screen-rows', [
          h('section.flex-row.flex-center.confirm-screen-row', [
            h('span.confirm-screen-label.confirm-screen-section-column', [ this.context.t('from') ]),
            h('div.confirm-screen-section-column', [
              h('div.confirm-screen-row-info', 'Sender'),
              h('div.confirm-screen-row-detail', `${txParams.sender}`),
            ]),
          ]),

          h('section.flex-row.flex-center.confirm-screen-row', [
            h('span.confirm-screen-label.confirm-screen-section-column', [ this.context.t('to') ]),
            h('div.confirm-screen-section-column', [
              h('div.confirm-screen-row-info', 'Recipient'),
              h('div.confirm-screen-row-detail', `${txParams.recipient}`),
            ]),
          ]),

          // h('section.flex-row.flex-center.confirm-screen-row', [
          //   h('span.confirm-screen-label.confirm-screen-section-column', [ this.context.t('gasFee') ]),
          //   h('div.confirm-screen-section-column', [
          //     h(GasFeeDisplay, {
          //       gasTotal: gasTotal || gasFeeInHex,
          //       conversionRate,
          //       convertedCurrency,
          //       onClick: () => showCustomizeGasModal(txMeta, sendGasLimit, sendGasPrice, gasTotal),
          //     }),
          //   ]),
          // ]),

          h('section.flex-row.flex-center.confirm-screen-row.confirm-screen-total-box ', [
            h('div', {
              className: classnames({
                //'confirm-screen-section-column--with-error': errors['insufficientFunds'],
                //'confirm-screen-section-column': !errors['insufficientFunds'],
              }),
            }, [
              h('span.confirm-screen-label', [ this.context.t('total') + ' ' ]),
              h('div.confirm-screen-total-box__subtitle', [ 'Amount + fee' ]),
            ]),

            h('div.confirm-screen-section-column', [
              h('div.confirm-screen-row-info', `${(+txParams.amount + txParams.fee)/100000000} ${txParams.assetId}`),
              h('div.confirm-screen-row-detail', ``),
            ]),

            this.renderErrorMessage('insufficientFunds'),
          ]),
        ]),
      ]),

      h('form#pending-tx-form', {
        className: 'confirm-screen-form',
        onSubmit: this.onSubmit,
      }, [
        this.renderErrorMessage('simulationFails'),
        h('.page-container__footer', [
          // Cancel Button
          h('button.btn-cancel.page-container__footer-button.allcaps', {
            onClick: (event) => {
              this.props.clearSend()
              this.cancel(event, this.props.txData)
            },
          }, this.context.t('cancel')),

          // Accept Button
          h('button.btn-confirm.page-container__footer-button.allcaps', {
            onClick: event => this.onSubmit(event),
          }, this.context.t('confirm')),
        ]),
      ]),
    ])
  )
}

confirmSendWaves.prototype.renderErrorMessage = function (message) {
  const { send: { errors } } = this.props

  return errors[message]
    ? h('div.confirm-screen-error', [ errors[message] ])
    : null
}

confirmSendWaves.prototype.onSubmit = function (event) {
  event.preventDefault()
  this.props.sendTransaction(this.props.txData, event)
}

confirmSendWaves.prototype.cancel = function (event, txMeta) {
  event.preventDefault()
  const { cancelTransaction } = this.props

  cancelTransaction(txMeta)
    .then(() => this.props.history.push(DEFAULT_ROUTE))
}



