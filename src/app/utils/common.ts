import { convertHexToNumber } from '@walletconnect/utils';
import { ethers } from 'ethers';
import IRPC from '../models/IRPC';
import networks from '../data/networks.json';
import { Device } from 'lib/prokey-webcore/src/device/Device';

const USER_NETWORKS_KEY = 'userNetworks';

export const hexPrefixify = (str: string) => {
  if (!str.startsWith('0x')) {
    return `0x${str}`;
  }
  return str;
};

export const convertHexToEther = (value: string | number) => ethers.utils.formatEther(BigInt(value));

export const getUserNetworks = (): Array<IRPC> => {
  const networks = localStorage.getItem(USER_NETWORKS_KEY);
  if (networks) return JSON.parse(networks);
  return [];
};

export const addUserNetwork = (iRPC: IRPC) => {
  let networks = getUserNetworks();
  networks.push(iRPC);
  localStorage.setItem(USER_NETWORKS_KEY, JSON.stringify(networks));
};

export const getAllNetworks = (): Array<IRPC> => {
  const userNetworks = getUserNetworks();
  return userNetworks.concat(networks);
};

export const isNetworkSupported = (chainId: number) => getAllNetworks().some((item) => item.chainId == chainId);

export const getNetwork = (chainId: number) => getAllNetworks().find((item) => item.chainId == chainId);

export const getDeviceVersion = async (device: Device) => {
  const { major_version, minor_version, patch_version } = await device.GetFeatures();
  return `${major_version}.${minor_version}.${patch_version}`;
};
