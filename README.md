# Prokey Link

Prokey Link is a platform for integrating Prokey device into 3rd party services. It provides functionalities like accessing public keys and sign messages or transactions.




## Installation

There is no need to install any package for using link layer.

Prokey Link is using browser cross-origin communication method to send or receive data from other tabs.

Basically you just need to open [Prokey Link](https://link.prokey.io) and post your request to the tab.


## Usage

before sending any request, one link tab must be opened like this:
```javascript
const popup = window.open('https://link.prokey.io');
```

* **Sending Request**

Now `popup` is a `Window` type object that you can use `popup.postMessage()` method to communicate with link layer.

```javascript
const popup = window.open('https://link.prokey.io');
popup.postMessage({ param, type }, 'https://link.prokey.io');
```

* **Receiving Results**

The process of communication between your tab and link layer is asynchronous.

You should also listen and wait for the message that is being sent from the link.


```javascript
const handleMessage = event => {
  if (event.origin.startsWith('https://link.prokey.io')) {
    window.removeEventListener('message', handleMessage);
    //do something with event.data
  }
};

window.addEventListener(
  'message',
  event => handleMessage(event),
  false
);
```


## Command Types
There are some certain command types that you can send to link and run it on device.
**All results are objects.**

| Key       | Type     | Description                |
| :-------- | :------- | :------------------------- |
| GetEthereumPublicKey | `string` | returns `xpub` |
| GetAddress | `string` | returns `address` |
| SignTransaction | `string` | returns `v`,`r`,`s` |
| SignMessage | `string` | returns `signature`,`address` |



## Arguments Format
* **GetEthereumPublicKey**

| Key       | Type     | Description                |
| :-------- | :------- | :------------------------- |
| path | `string` | a `BIP44` path for requested public key |

```javascript
popup.postMessage(
  { param: { path: "m/44'/60'/0'/0/0" }, type: 'GetEthereumPublicKey' },
  'https://link.prokey.io'
);
```

* **GetAddress**

| Key       | Type     | Description                |
| :-------- | :------- | :------------------------- |
| path | `string` | a `BIP44` path for requested address |

```javascript
popup.postMessage(
  { param: { path: "m/44'/60'/0'/0/0" }, type: 'GetAddress' },
  'https://link.prokey.io'
);
```



* **SignTransaction**

Prokey supports both `legacy` and `EIP1559` sign methods depending on the parameters it receives.

| Key       | Type     | Description                |
| :-------- | :------- | :------------------------- |
| path | `string` | a `BIP44` path to sign with |
| transaction | `object` |  common :<ul><li>`to`: string</li><li>`value`: string</li><li>`gasLimit`: string</li><li>`nonce`: string</li><li>`data?`: string</li><li>`chainId`: number</li></ul> for legacy: <ul><li>`gasPrice`: string</li></ul> for eip1559: <ul><li>`maxPriorityFeePerGas`: string</li><li>`maxFeePerGas`: string</li></ul>

```javascript
const transaction = {
    "chainId": "0x4",
    "nonce": "0x2",
    "maxPriorityFeePerGas": "0x59682f00",
    "maxFeePerGas": "0x98e16788",
    "gasLimit": "0x5208",
    "to": "0xbd20f6f5f1616947a39e11926e78ec94817b3931",
    "value": "0x49e57d6354000",
    "data": "0x",
}

popup.postMessage(
  { param: { path: "m/44'/60'/0'/0/0" , transaction }, type: 'SignTransaction' },
  'https://link.prokey.io'
);
```

* **SignMessage**

 Key       | Type     | Description                |
| :-------- | :------- | :------------------------- |
| path | `string` | a `BIP44` path to sign with |
| message | `string` |  - |

```javascript
popup.postMessage(
  { param: { path: "m/44'/60'/0'/0/0" , message: "This is my msg." }, type: 'SignMessage' },
  'https://link.prokey.io'
);
```


After any operation the link tab will be closed and it should be opened as mentioned above for the next operation.

## Example

A recommended method for sending and receiving requests:

```javascript
const handleMessage = (event, resolve) => {
  if (event.origin.startsWith(PROKEY_LINK_URL)) {
    window.removeEventListener('message', handleMessage);
    resolve(event.data);
  }
};

const openProkeyLink = (param, type) =>
  new Promise((resolve) => {
    const popup = window.open(PROKEY_LINK_URL);
    setTimeout(() => {
      popup.postMessage({ param, type }, PROKEY_LINK_URL);
    }, 2000);
    window.addEventListener('message', (event) => handleMessage(event, resolve), false);
  });

const params = {
  path: "m/44'/60'/0'/0/0",
  message: 'my message',
};
const { signature, address } = await openProkeyLink(params, 'SignMessage');

```