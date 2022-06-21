import { Injectable } from '@angular/core';
import { JsonRpcProvider } from '@ethersproject/providers';

@Injectable({
  providedIn: 'root',
})
export class EthersProviderUtilService {
  _ethersProvider: JsonRpcProvider;
  private _connectedAddress: string;

  setUrl(url: string) {
    this._ethersProvider = new JsonRpcProvider(url);
    console.log(this._ethersProvider.connection);
  }

  setConnectedAddress(address: string) {
    this._connectedAddress = address;
  }

  async getNonce(): Promise<number> {
    return await this._ethersProvider.getTransactionCount(this._connectedAddress);
  }
}
