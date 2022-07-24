import { Component, OnInit } from '@angular/core';
import { EthereumTx } from 'lib/prokey-webcore/src/models/EthereumTx';
import { Device } from 'lib/prokey-webcore/src/device/Device';
import { EthereumCommands } from 'lib/prokey-webcore/src/device/EthereumCommands';
import { getHDPath } from 'lib/prokey-webcore/src/utils/pathUtils';
import * as Util from 'lib/prokey-webcore/src/utils/utils';
import { DEFAULT_CHAIN_ID, DEFAULT_HD_PATH, LATEST_LEGACY_SIGN_DEVICE_VERSION } from './utils/constants';
import CommandType from './models/CommandType';
import Strings from './utils/Strings';
import { FailureType } from 'lib/prokey-webcore/src/models/DeviceEvents';
import WalletConnect from '@walletconnect/client';
import { convertHexToUtf8 } from '@walletconnect/utils';
import LinkMode from './models/LinkMode';
import WalletConnectRequestType from './models/WalletConnectRequestType';
import { IJsonRpcRequest, ISessionParams, ITxData } from '@walletconnect/types';
import OptionsType from './models/OptionsType';
import WalletConnectUtil from './utils/walletConnectUtil';
import { closeWindow } from './utils/windowUtil';
import IAlert from './models/IAlert';
import AlertType from './models/AlertType';
import { SerializeEthereumTx } from 'lib/prokey-webcore/src/utils/ethereumTxSerialize';
import SimplifiedTransaction from './models/SimplifiedTransaction';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  addUserNetwork,
  convertHexToEther,
  getDeviceVersion,
  getNetwork,
  hexPrefixify,
  isNetworkSupported,
  reloadPage,
} from './utils/common';
import IPassphrase from './models/IPassphrase';
import IRPC from './models/IRPC';
import { MyConsole } from 'lib/prokey-webcore/src/utils/console';
import { EthersProviderUtilService } from './ethers-provider-util.service';
import compareVersions from 'compare-versions';
import { HashTypedData } from 'lib/prokey-webcore/src/utils/ethereum-hashTypedData';
import { HashTypedDataModel, MessageTypes, TypedMessage } from 'lib/prokey-webcore/src/models/EthereumTypedDataModel';
import { TransportType } from 'lib/prokey-webcore/src/transport/ITransport';
import { ActivatedRoute } from '@angular/router';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  //Private variables
  private _device: Device = null;
  private _path: Array<number> = DEFAULT_HD_PATH;
  private _ethereumBasedTransaction: EthereumTx;
  private _message: Uint8Array;
  private _connector: WalletConnect;

  //UI Visibility Control
  isLoading: boolean = true;
  showPassphraseForm = false;
  originAllowed: Boolean;
  showDeviceAction = false;
  showRPCFrom = false;
  showPinOnDevice = false;
  showSignTypedDataConfirm = false;

  //Enum Types to use in html
  LinkMode = LinkMode;
  CommandType = CommandType;

  //Forms data
  iPassphrase: IPassphrase;
  iRPC: IRPC;

  //Other
  parentWindow: Window = null;
  currentCommandType: CommandType;
  crossOriginSession: MessageEvent<any>;
  _walletConnectCallRequest: IJsonRpcRequest;
  currentAddress: string;
  dappMeta: ISessionParams = null;
  mode: LinkMode = LinkMode.CrossOrigin;
  isDeviceConnected: boolean = false;
  isWalletConnectConnected: Boolean = false;
  walletConnectUrl: string;
  simplifiedTx: SimplifiedTransaction;
  iAlert: IAlert;
  typedData: TypedMessage<MessageTypes>;
  hashedTypedData: HashTypedDataModel;
  directWalletConnectUrl: string;

  constructor(
    private ethersProviderUtil: EthersProviderUtilService,
    private clipboard: Clipboard,
    private route: ActivatedRoute
  ) {
    //for getting rid of undefined error when using with ngModel
    this.iPassphrase = { passphrase: '', confirmPassphrase: '' };
    this.iRPC = { chainId: 0, url: '', name: '' };
    /**
     * If parent window is null then show related WalletConnect homepage
     * if not its cross origin mode
     */
    window.onload = () => {
      this.parentWindow = window.opener;
      if (!this.parentWindow) {
        const wcUri = this.route.snapshot.queryParamMap.get('uri');
        const wcKey = this.route.snapshot.queryParamMap.get('key');
        if (wcUri && wcKey) {
          this.directWalletConnectUrl = `${wcUri}&key=${wcKey}`;
          localStorage.removeItem('walletconnect');
          this.setupWalletConnect(this.directWalletConnectUrl, OptionsType.Uri);
        } else {
          const cachedSession = WalletConnectUtil.getCachedSession();
          if (cachedSession) {
            this.setWalletConnectMode();
          }
        }
        this.isLoading = false;
      }
    };
  }

  /**
   * @returns {boolean}
   * @description Transaction and Message views are different.
   * Checks if the current command type is signing Transaction
   * on both WalletConnect mode and CrossOrigin mode
   * Used in Html
   */
  isTransaction(): boolean {
    if (this.currentCommandType && this.currentCommandType == CommandType.SignTransaction) return true;

    if (this._walletConnectCallRequest)
      if (
        this._walletConnectCallRequest.method == WalletConnectRequestType.SendTransaction ||
        this._walletConnectCallRequest.method == WalletConnectRequestType.SignTransaction ||
        this._walletConnectCallRequest.method == WalletConnectRequestType.SignTypedData
      )
        return true;
    return false;
  }

  /**
   * @returns {boolean}
   * refer to @method isTransaction() description
   * Checks if the current command type is signing Transaction
   * on both WalletConnect mode and CrossOrigin mode
   * Used in Html
   */
  isMessage(): boolean {
    if (this.currentCommandType && this.currentCommandType == CommandType.SignMessage) return true;

    if (this._walletConnectCallRequest)
      if (
        this._walletConnectCallRequest.method == WalletConnectRequestType.PersonalSign ||
        this._walletConnectCallRequest.method == WalletConnectRequestType.Sign
      )
        return true;
    return false;
  }

  /**
   * @returns {string}
   * Description for user when he/she wants to sign Transaction or Message
   */
  getMessage(): string {
    if (this._walletConnectCallRequest && this._walletConnectCallRequest.params) {
      return convertHexToUtf8(
        this._walletConnectCallRequest.params[
          this._walletConnectCallRequest.method == WalletConnectRequestType.Sign ? 1 : 0
        ]
      );
    } else {
      return this.crossOriginSession.data.param.message;
    }
  }

  /**
   * Disconnect from connected DApp on WalletConnect mode
   */
  async killWalletConnectSession() {
    try {
      await this._connector.killSession();
    } finally {
      localStorage.removeItem('walletconnect');
      reloadPage();
    }
  }

  /**
   * Transactions are broadcasted using JSON-RPC call.
   * If the incoming network from DApp is not supported
   * a form is shown to the user to add a network provider
   * with specified chain Id
   */
  submitNetwork() {
    if (this.iRPC.chainId && this.iRPC.name && this.iRPC.url) {
      addUserNetwork(this.iRPC);
      this.showRPCFrom = false;
      this.approveWalletConnectSession();
    } else {
      this.showSnackbar(Strings.error, Strings.fillAllFields, AlertType.Danger);
    }
  }

  subscribeToWalletConnectEvents() {
    this._connector.on('session_request', async (error, payload) => {
      if (error) {
        MyConsole.Error(error, 'EVENT', 'session_request');
        throw error;
      }
      MyConsole.Info(payload, 'SESSION_REQUEST');

      this.dappMeta = payload.params[0];
      /**
       * When session request received from WalletConnect
       * an address should returned to it.
       *
       * Here we run @type {CommandType.GetAddress} command
       * and return address as an approval to WalletConnect Api using @method approveWalletConnectSession()
       */
      const result = await this.runCommand(CommandType.GetAddress);
      this.currentAddress = result.address;

      if (!isNetworkSupported(this.dappMeta.chainId)) {
        this.showRPCFrom = true;
        this.iRPC.chainId = this.dappMeta.chainId;
      } else {
        this.approveWalletConnectSession();
      }
    });

    this._connector.on('call_request', async (error, payload: IJsonRpcRequest) => {
      if (error) {
        MyConsole.Error(error, 'EVENT', 'call_request');
        throw error;
      }

      MyConsole.Info(payload, 'EVENT', 'call_request');
      this._walletConnectCallRequest = payload;

      this.handleWalletConnectRequest(this._walletConnectCallRequest);
    });

    this._connector.on('connect', (error, payload) => {
      MyConsole.Info('WalletConnect connected');
      if (error) {
        MyConsole.Error(error, 'EVENT', 'connect');
        throw error;
      }
    });

    this._connector.on('disconnect', (error, payload) => {
      if (error) {
        throw error;
      }
      reloadPage();
    });
  }

  async handleWalletConnectRequest(payload) {
    /**
     * When Transaction or Message sign request received from WalletConnect
     * It Immediately fires command on device.
     */
    let requestResult = null;
    let commandResult = null;
    switch (payload.method) {
      /**
       * @type {WalletConnectRequestType.PersonalSign} and @type {WalletConnectRequestType.Sign}
       * are the same. the only difference is that the message string is on different index of array
       */
      case WalletConnectRequestType.PersonalSign:
      case WalletConnectRequestType.Sign:
        this.prepareForSignMessage(
          payload.method == WalletConnectRequestType.PersonalSign ? payload.params[0] : payload.params[1]
        );
        commandResult = await this.runCommand(CommandType.SignMessage);
        requestResult = hexPrefixify(commandResult.signature);
        break;
      case WalletConnectRequestType.SendTransaction:
      case WalletConnectRequestType.SignTransaction:
        await this.prepareForSignTransaction(payload.params[0]);
        this.simplifiedTx = WalletConnectUtil.getSimplifiedTransactionDetails(payload.params[0]);
        commandResult = await this.runCommand(CommandType.PrepareAndSendTransaction);
        requestResult = commandResult ? commandResult.payload : null;
        break;
      case WalletConnectRequestType.SignTypedData:
        this.simplifiedTx = { to: payload.params[0] };
        this.typedData = JSON.parse(payload.params[1]);
        this.hashedTypedData = HashTypedData(JSON.parse(payload.params[1]), true);
        this.showDeviceAction = true;
    }

    /**
     * return the result to WalletConnect Api as an approval
     */
    if (payload.method !== WalletConnectRequestType.SignTypedData) {
      this.handleCommandResult(requestResult);
    } else {
      this.showSignTypedDataConfirm = true;
    }
  }

  /**
   * The connecting DApp should send the chainId (in almost most cases)
   * if not the default chain id is considered the Ethereum mainnet chainId
   */
  approveWalletConnectSession() {
    this._connector.approveSession({
      accounts: [this.currentAddress],
      chainId: this.dappMeta.chainId || DEFAULT_CHAIN_ID,
    });
    this.ethersProviderUtil.setConnectedAddress(this.currentAddress);
    this.isWalletConnectConnected = true;
  }

  handleCommandResult(requestResult: any) {
    if (!requestResult) {
      this._connector.rejectRequest({
        id: this._walletConnectCallRequest.id,
        error: { message: Strings.somethingWentWrong },
      });
    } else {
      this._connector.approveRequest({
        id: this._walletConnectCallRequest.id,
        result: requestResult,
      });
    }
    this.isLoading = false;
    this.showDeviceAction = false;
  }

  prepareForSignMessage(hexMessage: string) {
    this.showDeviceAction = true;
    this._message = Util.StringToUint8Array(convertHexToUtf8(hexMessage));
  }

  supportsEIP1559(first: string, second: string): boolean {
    return compareVersions(first, second) == 1;
  }

  async confirmOnDevice() {
    this.showSignTypedDataConfirm = false;
    const commandResult = await this.runCommand(CommandType.SignTypedData);
    const requestResult = commandResult ? commandResult.signature : null;
    this.handleCommandResult(requestResult);
  }

  async prepareForSignTransaction(tx: ITxData) {
    this.isLoading = true;
    var url = getNetwork(this.dappMeta.chainId).url;
    this.ethersProviderUtil.setUrl(url);

    const wcUtil = new WalletConnectUtil(this.ethersProviderUtil);
    const deviceVersion = await getDeviceVersion(this._device);
    this._ethereumBasedTransaction = (await wcUtil.formatTransaction(
      tx,
      this.dappMeta.chainId,
      this.supportsEIP1559(deviceVersion, LATEST_LEGACY_SIGN_DEVICE_VERSION)
    )) as EthereumTx;
    this.showDeviceAction = true;
    this.isLoading = false;
  }

  /**
   * WalletConnect session is stored in local storage
   * after the first time connection.
   * When @method createSession() is called on the connector
   * it checks for the storage and tries to connect to the last connection.
   *
   * @param opt last session or new url to connect
   * @param type determines to connect using last session or new url
   */
  async setupWalletConnect(opt: any, type: OptionsType) {
    const walletConnectCallRequest = localStorage.getItem('walletConnectCallRequest');
    const connected = await this.connectDevice();
    if (!connected) {
      if (this.directWalletConnectUrl) {
        this.walletConnectUrl = this.directWalletConnectUrl;
        this.mode = LinkMode.WalletConnect;
      } else {
        this.showSnackbar(Strings.deviceNotConnected, Strings.plugInProkey, AlertType.Danger);
        if (walletConnectCallRequest) localStorage.removeItem('walletConnectCallRequest');
        this.walletConnectUrl = '';
        setTimeout(() => {
          this.killWalletConnectSession();
        }, 2000);
      }
    } else {
      this.mode = LinkMode.WalletConnect;
      this._connector = new WalletConnect({ [type]: opt });
      if (!this._connector.connected) {
        await this._connector.createSession();
        this.subscribeToWalletConnectEvents();
      } else {
        this.isWalletConnectConnected = true;
        this.dappMeta = { ...opt };
        this.currentAddress = this.dappMeta.accounts[0];
        this.ethersProviderUtil.setConnectedAddress(this.currentAddress);
        this.subscribeToWalletConnectEvents();
        if (walletConnectCallRequest) {
          this._walletConnectCallRequest = JSON.parse(walletConnectCallRequest);
          this.handleWalletConnectRequest(this._walletConnectCallRequest);
        }
      }
    }
  }

  openWalletConnect() {
    this.setupWalletConnect(this.walletConnectUrl, OptionsType.Uri);
  }

  copyTypedDataToClipboard() {
    this.clipboard.copy(JSON.stringify(this.typedData));
    this.showSnackbar('Success', 'Copied to clipboard.', AlertType.Success);
  }

  /**
   * This is for the time when the tab
   * is opened by another origin like MEW.
   * if the incoming message has one of the
   * Prokey's command types then sets the session
   *
   * Has nothing to do with WalletConnect
   * @param event
   */
  handleEventMessage(event: MessageEvent<any>) {
    if (!event.data || !event.data.type || !Object.values(CommandType).some((item) => item == event.data.type)) return;
    MyConsole.Info(event.data);
    this.crossOriginSession = event;
    this.isLoading = false;
  }

  /**
   * fires when user clicks on connect using WalletConnect.
   * if there is a cached session use it
   * if not show the uri form to the user.
   */
  setWalletConnectMode() {
    window.removeEventListener('message', this.handleEventMessage, true);
    const walletConnectSession = WalletConnectUtil.getCachedSession();
    if (walletConnectSession) {
      this.setupWalletConnect(walletConnectSession, OptionsType.Session);
    } else {
      this.mode = LinkMode.WalletConnect;
    }
  }

  /**
   * an EventListener is set when initializing the component
   * if the parent window is null, EventListener will be removed.
   * because it means user is going to use WalletConnect
   */
  ngOnInit() {
    this._device = new Device((success) => success && MyConsole.Info('device instance is successful'));
    window.addEventListener('message', (event) => this.handleEventMessage(event), false);
  }

  setPath(params: any) {
    if (params.hasOwnProperty('path')) {
      this._path = getHDPath(params.path);
    }
  }

  removeWalletConnectLastRequest() {
    const walletConnectCallRequest = localStorage.getItem('walletConnectCallRequest');
    if (walletConnectCallRequest) localStorage.removeItem('walletConnectCallRequest');
  }

  async handleFailure(failureType: FailureType) {
    switch (failureType) {
      case FailureType.ActionCancelled:
        this.showSnackbar(Strings.deviceOperation, Strings.actionCancelled, AlertType.Warning);
        if (this.mode == LinkMode.WalletConnect) {
          this._connector.rejectRequest({
            id: this._walletConnectCallRequest.id,
            error: { message: Strings.actionCancelled },
          });
          this.removeWalletConnectLastRequest();
          this.showDeviceAction = false;
        } else {
          closeWindow();
        }
        break;
      case FailureType.NotInitialized:
        if (this._walletConnectCallRequest) {
          localStorage.setItem('walletConnectCallRequest', JSON.stringify(this._walletConnectCallRequest));
        }
        try {
          await this._device.RebootDevice();
        } catch (e) {}
        this.showSnackbar(Strings.rebootDevice, Strings.shouldRebootDevice, AlertType.Info);
        setTimeout(() => {
          reloadPage();
        }, 2000);
        break;
      case FailureType.PinInvalid:
        this.showSnackbar(Strings.error, Strings.pinInvalid, AlertType.Danger);
        if (this.mode == LinkMode.WalletConnect) {
          setTimeout(() => {
            reloadPage();
          }, 2000);
        } else {
          closeWindow();
        }
    }
  }

  subscribeToDeviceEvents() {
    this._device.AddOnFailureCallBack(async (reason) => {
      this.isDeviceConnected = false;
      this.handleFailure(reason.code as FailureType);
    });

    this._device.AddOnDeviceDisconnectCallBack(() => {
      this.isDeviceConnected = false;
    });

    this._device.AddOnButtonRequestCallBack((type) => {
      console.log(type);
      switch (type) {
        case 'ButtonRequest_EnterPinOnDevice':
          this.showPinOnDevice = true;
          break;
        case 'ButtonRequest_PinOnDeviceDone':
          this.showPinOnDevice = false;
          break;
        default:
          this.showDeviceAction = true;
          break;
      }
    });

    this._device.AddOnPasspharaseRequestCallBack(() => (this.showPassphraseForm = true));
  }

  connectDevice() {
    return new Promise<Boolean>(async (resolve, reject) => {
      if (this.isDeviceConnected) {
        await this.initialize();
        resolve(true);
      } else {
        this._device.TransportConnect().then(async (res) => {
          if (res.success) {
            MyConsole.Info(await this.initialize());
            this.isDeviceConnected = true;
            this.subscribeToDeviceEvents();
            resolve(true);
          } else resolve(false);
        });
      }
    });
  }

  connect() {
    this.connectDevice().then(async (result) => {
      if (!result) {
        this.showSnackbar(Strings.error, Strings.deviceConnectionFailed, AlertType.Danger);
      }
      if (this.currentCommandType != CommandType.GetEthereumPublicKey) {
        this.showDeviceAction = true;
        const commandResult = await this.runCommand(this.currentCommandType);
        if (commandResult && this.isDeviceConnected) {
          this.postMessage(commandResult);
          this.isLoading = true;
          closeWindow();
        }
      }
    });
  }

  async exportAccount() {
    const commandResult = await this.runCommand(CommandType.GetEthereumPublicKey);
    if (commandResult && this.isDeviceConnected) {
      this.postMessage(commandResult);
      this.isLoading = true;
      closeWindow();
    }
  }

  rejectExport() {
    closeWindow();
  }

  private async initialize() {
    return await this._device.Initialize();
  }

  private postMessage(param: any) {
    this.parentWindow.postMessage(param, this.crossOriginSession.origin);
  }

  private async runCommand(commandType: CommandType) {
    this.currentCommandType = commandType;
    const ethCommands = new EthereumCommands();
    let result = null;
    switch (commandType) {
      case CommandType.GetEthereumPublicKey:
        result = await ethCommands.GetPublicKey(this._device, this._path, false);
        break;
      case CommandType.GetAddress:
        result = await ethCommands.GetAddress(this._device, this._path, false);
        break;
      case CommandType.SignTransaction:
        result = await ethCommands.SignTransaction(this._device, this._ethereumBasedTransaction);
        break;
      case CommandType.PrepareAndSendTransaction:
        result = await ethCommands.SignTransaction(this._device, this._ethereumBasedTransaction);
        this.isLoading = true;
        const serializedTx = SerializeEthereumTx(this._ethereumBasedTransaction, result);
        try {
          const { hash } = await this.ethersProviderUtil._ethersProvider.sendTransaction(serializedTx);
          result = { payload: hash };
          this.removeWalletConnectLastRequest();
        } catch (e) {
          this.showSnackbar(e.code, e.reason, AlertType.Danger);
        }
        break;
      case CommandType.SignMessage:
        result = await ethCommands.SignMessage(this._device, this._path, this._message);
        result.address = hexPrefixify(result.address);
        break;
      case CommandType.SignTypedData:
        result = await ethCommands.SignTypedData(this._device, this._path, this.typedData, true);
    }
    return result;
  }

  allowOrigin() {
    this.originAllowed = true;
    this.currentCommandType = this.crossOriginSession.data.type;
    this.setPath(this.crossOriginSession.data.param);
    switch (this.crossOriginSession.data.type) {
      case CommandType.SignTransaction: {
        const { transaction, path } = this.crossOriginSession.data.param;
        this._ethereumBasedTransaction = {
          ...transaction,
          address_n: getHDPath(path),
        };
        this.simplifiedTx = {
          ...transaction,
          value: convertHexToEther(transaction.value),
        };
        break;
      }
      case CommandType.SignMessage:
        const { message } = this.crossOriginSession.data.param;
        this._message = Util.StringToUint8Array(message);
    }
  }

  rejectOrigin() {
    window.close();
  }

  showSnackbar(title: string, message: string, type: AlertType) {
    this.iAlert = { title, message };
    var element = document.getElementById(`snackbar-${type}`);

    element.classList.add('show-snackbar');

    setTimeout(() => {
      element.className = element.className.replace('show-snackbar', '');
    }, 7000);
  }

  async enterPassphrase() {
    if (this.iPassphrase.passphrase == this.iPassphrase.confirmPassphrase) {
      await this._device.PassphraseAck(this.iPassphrase.passphrase);
      this.showPassphraseForm = false;
    } else {
      this.showSnackbar(Strings.passphrase, Strings.passphraseNotMatching, AlertType.Danger);
    }
  }
}
