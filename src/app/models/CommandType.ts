enum CommandType {
  None = 'None',
  GetEthereumPublicKey = 'GetEthereumPublicKey',
  GetAddress = 'GetAddress',
  SignTransaction = 'SignTransaction',
  SignMessage = 'SignMessage',
  PrepareAndSendTransaction = 'PrepareAndSendTransaction',
  SignTypedData = 'SignTypedData',
}

export default CommandType;
