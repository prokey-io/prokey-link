import { ITxData } from '@walletconnect/types';
import SimplifiedTransaction from '../models/SimplifiedTransaction';
import { convertHexToEther } from './common';

export const getCachedSession = (): any => {
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
};

export const formatTransaction = (path: Array<number>, tx: ITxData, chainId: number) => ({
  address_n: path,
  gasPrice: tx.gasPrice.toString(),
  gasLimit: tx.gas ? tx.gas.toString() : tx.gasLimit ? tx.gasLimit.toString() : '',
  to: tx.to,
  value: tx.value ? tx.value.toString() : '0',
  data: tx.data || '',
  chainId: chainId,
});

export const getSimplifiedTransactionDetails = (transaction: ITxData): SimplifiedTransaction => ({
  to: transaction.to,
  value: transaction.value ? convertHexToEther(transaction.value.toString()) : '0',
  data: transaction.data || '',
});
