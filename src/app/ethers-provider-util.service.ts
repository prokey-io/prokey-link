import { Injectable } from '@angular/core';
import { ethers } from 'ethers';

@Injectable({
  providedIn: 'root',
})
export class EthersProviderUtilService {
  _ethersProvider: ethers.providers.JsonRpcProvider;
  private _connectedAddress: string;

  setUrl(url: string) {
    this._ethersProvider = new ethers.providers.JsonRpcProvider(url);
    console.log(this._ethersProvider.connection);
  }

  setConnectedAddress(address: string) {
    this._connectedAddress = address;
  }

  async getNonce(): Promise<number> {
    return await this._ethersProvider.getTransactionCount(this._connectedAddress);
  }
}
