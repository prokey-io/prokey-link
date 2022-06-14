import { ICallTxData } from '@walletconnect/types';

interface WalletConnectTx extends ICallTxData {
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  address_n: Array<number>;
  chainId: number;
}

export default WalletConnectTx;
