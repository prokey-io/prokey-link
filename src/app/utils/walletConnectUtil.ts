import { ICallTxData, ITxData } from '@walletconnect/types';
import { EthersProviderUtilService } from '../ethers-provider-util.service';
import SimplifiedTransaction from '../models/SimplifiedTransaction';
import WalletConnectTx from '../models/WalletConnectTx';
import { convertHexToEther } from './common';
import { DEFAULT_CHAIN_ID, DEFAULT_HD_PATH } from './constants';

class WalletConnectUtil {
  constructor(private ethersProviderUtil: EthersProviderUtilService) {}

  static getCachedSession(): any {
    const local = localStorage ? localStorage.getItem('walletconnect') : null;

    let session = null;
    if (local) {
      try {
        session = JSON.parse(local);
      } catch (error) {
        throw error;
      }
    }
    return session;
  }

  async formatTransaction(tx: ICallTxData, chainId: number = DEFAULT_CHAIN_ID, isEIP1559: boolean) {
    const tempTx: WalletConnectTx = {
      address_n: DEFAULT_HD_PATH,
      gasLimit: tx.gas ? tx.gas.toString() : tx.gasLimit ? tx.gasLimit.toString() : '',
      to: tx.to,
      value: tx.value ? tx.value.toString() : '0',
      data: tx.data || '',
      chainId: chainId,
      nonce: (await this.ethersProviderUtil.getNonce()).toString(),
    };
    if (tx.gasPrice || !isEIP1559) {
      if (tx.gasPrice) {
        tempTx.gasPrice = tx.gasPrice.toString();
      } else {
        tempTx.gasPrice = (await this.ethersProviderUtil._ethersProvider.getGasPrice()).toHexString();
      }
    } else if (isEIP1559) {
      const feeData = await this.ethersProviderUtil._ethersProvider.getFeeData();
      tempTx.maxFeePerGas = feeData.maxFeePerGas.toHexString();
      tempTx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.toHexString();
    }
    return tempTx;
  }

  static getSimplifiedTransactionDetails = (transaction: ITxData): SimplifiedTransaction => ({
    to: transaction.to,
    value: transaction.value ? convertHexToEther(transaction.value) : '0',
    data: transaction.data || '',
  });
}

export default WalletConnectUtil;
